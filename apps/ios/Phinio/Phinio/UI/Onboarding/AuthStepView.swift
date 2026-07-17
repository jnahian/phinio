import SwiftUI

/// Sign-in / sign-up with the "check your email" verification loop:
/// after sign-up we retry sign-in on demand until verification sticks.
struct AuthStepView: View {
  let done: () -> Void
  @EnvironmentObject private var auth: AuthManager

  enum Mode { case signIn, signUp, checkEmail }
  @State private var mode: Mode = .signIn
  @State private var name = ""
  @State private var email = ""
  @State private var password = ""
  @State private var error: String?
  @State private var busy = false

  var body: some View {
    NavigationStack {
      Form {
        switch mode {
        case .checkEmail:
          Section {
            Label("Check your email", systemImage: "envelope.badge")
              .font(.headline)
            Text("We sent a verification link to \(email). Tap it, then come back here.")
              .foregroundStyle(.secondary)
          }
          Section {
            Button(busy ? "Checking…" : "I've verified — continue") {
              Task { await trySignIn() }
            }
            .disabled(busy)
          }
        case .signIn, .signUp:
          Section {
            if mode == .signUp {
              TextField("Full name", text: $name)
                .textContentType(.name)
            }
            TextField("Email", text: $email)
              .textContentType(.emailAddress)
              .keyboardType(.emailAddress)
              .textInputAutocapitalization(.never)
              .autocorrectionDisabled()
            SecureField("Password", text: $password)
              .textContentType(mode == .signUp ? .newPassword : .password)
          }
          if let error {
            Section { Text(error).foregroundStyle(.red) }
          }
          Section {
            Button(busy ? "Working…" : (mode == .signUp ? "Create account"
                                                        : "Sign in")) {
              Task { mode == .signUp ? await submitSignUp()
                                     : await trySignIn() }
            }
            .disabled(busy || email.isEmpty || password.isEmpty
                      || (mode == .signUp && name.trimmingCharacters(
                            in: .whitespaces).count < 2))
            Button(mode == .signUp ? "Have an account? Sign in"
                                   : "New here? Create an account") {
              error = nil
              mode = mode == .signUp ? .signIn : .signUp
            }
          }
        }
      }
      .navigationTitle("Phinio")
    }
  }

  private func trySignIn() async {
    busy = true
    defer { busy = false }
    do {
      try await auth.signIn(email: email, password: password)
      done()
    } catch let APIError.rejected(_, message) {
      error = message
      if mode == .checkEmail { error = "Not verified yet — try again in a moment." }
    } catch {
      self.error = "Could not reach the server."
    }
  }

  private func submitSignUp() async {
    busy = true
    defer { busy = false }
    do {
      try await auth.signUp(
        name: name.trimmingCharacters(in: .whitespaces),
        email: email, password: password)
      error = nil
      mode = .checkEmail
    } catch let APIError.rejected(_, message) {
      error = message
    } catch {
      self.error = "Could not reach the server."
    }
  }
}
