import Combine
import SwiftUI
import UIKit

/// The profile photo, cached on-device so avatars render offline and don't
/// flicker between screens.
///
/// The photo is not part of the sync snapshot — it lives on Better Auth's
/// `user.image`, not the Phinio `Profile` row, and `SyncEngine.apply` deletes
/// and re-inserts every `Profile` on each pull. Keeping the cache here rather
/// than on the model keeps it from being wiped on the next sync.
@MainActor
final class AvatarStore: ObservableObject {
  /// Matches the web profile screen's `resizeImage(file, 300)` +
  /// `toDataURL('image/jpeg', 0.85)` so both clients write the same-sized
  /// payload into the same column.
  static let maxEdge: CGFloat = 300
  static let jpegQuality: CGFloat = 0.85

  private static let defaultsKey = "profileAvatarDataURL"

  @Published private(set) var image: UIImage?
  @Published private(set) var isUploading = false

  private let client: APIClient
  private let defaults: UserDefaults

  init(client: APIClient, defaults: UserDefaults = .standard) {
    self.client = client
    self.defaults = defaults
    if let cached = defaults.string(forKey: Self.defaultsKey) {
      image = Self.decode(dataURL: cached)
    }
  }

  /// Pull the server's copy. Silent on failure — offline just keeps the cache.
  func refresh() async {
    guard let dataURL = try? await client.fetchAvatar() else { return }
    apply(dataURL: dataURL)
  }

  /// Downscale, upload, then adopt. Throws so the caller can surface the error;
  /// the local cache only changes once the server has accepted the write.
  func upload(_ picked: UIImage) async throws {
    isUploading = true
    defer { isUploading = false }
    guard let dataURL = Self.encode(picked) else { throw APIError.decoding }
    try await client.updateAvatar(dataURL: dataURL)
    apply(dataURL: dataURL)
  }

  func remove() async throws {
    isUploading = true
    defer { isUploading = false }
    try await client.updateAvatar(dataURL: "")
    apply(dataURL: nil)
  }

  func clear() {
    apply(dataURL: nil)
  }

  private func apply(dataURL: String?) {
    // Better Auth returns "" for a cleared photo; treat it as absent.
    let value = (dataURL?.isEmpty ?? true) ? nil : dataURL
    if let value {
      defaults.set(value, forKey: Self.defaultsKey)
    } else {
      defaults.removeObject(forKey: Self.defaultsKey)
    }
    image = value.flatMap(Self.decode(dataURL:))
  }

  // MARK: Data URL codec

  /// Aspect-preserving downscale to `maxEdge` (never upscales), then a
  /// `data:image/jpeg;base64,…` string.
  static func encode(_ source: UIImage) -> String? {
    let scale = min(maxEdge / source.size.width, maxEdge / source.size.height, 1)
    let target = CGSize(
      width: (source.size.width * scale).rounded(),
      height: (source.size.height * scale).rounded())
    let resized = UIGraphicsImageRenderer(size: target).image { _ in
      source.draw(in: CGRect(origin: .zero, size: target))
    }
    guard let jpeg = resized.jpegData(compressionQuality: jpegQuality) else { return nil }
    return "data:image/jpeg;base64," + jpeg.base64EncodedString()
  }

  static func decode(dataURL: String) -> UIImage? {
    guard let comma = dataURL.firstIndex(of: ","),
          dataURL.hasPrefix("data:"),
          let bytes = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...]))
    else { return nil }
    return UIImage(data: bytes)
  }
}
