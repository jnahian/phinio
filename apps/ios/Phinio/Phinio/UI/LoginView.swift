import SwiftUI

/// Minimal sign-in for the foundation checkpoint. Plan 3 replaces this with
/// the real onboarding flow (welcome pages, signup, verification, priming).
struct LoginView: View {
  @EnvironmentObject private var auth: AuthManager
  @State private var email = ""
  @State private var password = ""
  @State private var error: String?
  @State private var busy = false

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Email", text: $email)
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
          SecureField("Password", text: $password)
            .textContentType(.password)
        }
        if let error {
          Section { Text(error).foregroundStyle(.red) }
        }
        Section {
          Button(busy ? "Signing in…" : "Sign in") {
            Task { await submit() }
          }
          .disabled(busy || email.isEmpty || password.isEmpty)
        }
      }
      .navigationTitle("Phinio")
    }
  }

  private func submit() async {
    busy = true
    defer { busy = false }
    do {
      try await auth.signIn(email: email, password: password)
    } catch let APIError.rejected(_, message) {
      error = message
    } catch {
      self.error = "Could not reach the server."
    }
  }
}
