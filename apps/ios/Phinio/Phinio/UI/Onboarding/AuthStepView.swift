import SwiftUI

/// Sign-in / sign-up with the "check your email" verification loop:
/// after sign-up we retry sign-in on demand until verification sticks.
struct AuthStepView: View {
  let done: () -> Void
  @EnvironmentObject private var auth: AuthManager

  enum Mode { case signIn, signUp, checkEmail }
  @State private var mode: Mode
  @State private var name = ""
  @State private var email = ""
  @State private var password = ""
  @State private var showPassword = false
  @State private var currency = "BDT"
  @State private var error: String?
  @State private var busy = false

  init(startMode: Mode = .signIn, done: @escaping () -> Void) {
    _mode = State(initialValue: startMode)
    self.done = done
  }

  var body: some View {
    NavigationStack {
      Form {
        switch mode {
        case .checkEmail: checkEmailSections
        case .signIn, .signUp: formSections
        }
      }
      .scrollDismissesKeyboard(.interactively)
      .navigationTitle(title)
      .safeAreaInset(edge: .bottom) { actions }
    }
  }

  private var title: LocalizedStringKey {
    switch mode {
    case .signIn: "Welcome back"
    case .signUp: "Create account"
    case .checkEmail: "Check your email"
    }
  }

  @ViewBuilder
  private var formSections: some View {
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
      HStack(spacing: 8) {
        Group {
          if showPassword {
            TextField(passwordPrompt, text: $password)
          } else {
            SecureField(passwordPrompt, text: $password)
          }
        }
        .textContentType(mode == .signUp ? .newPassword : .password)
        Button { showPassword.toggle() } label: {
          Image(systemName: showPassword ? "eye.slash" : "eye")
            .foregroundStyle(.secondary)
        }
        .buttonStyle(.borderless)
        .accessibilityLabel(showPassword ? "Hide password" : "Show password")
      }
    } footer: {
      Text(mode == .signUp
        ? "Start tracking investments and EMIs."
        : "Sign in to your vault.")
    }

    if mode == .signUp {
      Section("Preferred currency") {
        Picker("Preferred currency", selection: $currency) {
          Text("৳ BDT").tag("BDT")
          Text("$ USD").tag("USD")
        }
        .pickerStyle(.segmented)
        .labelsHidden()
      }
    }

    if let error { errorSection(error) }
  }

  @ViewBuilder
  private var checkEmailSections: some View {
    Section {
      Text("We sent a verification link to \(email). Tap it, then come back here.")
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
    if let error { errorSection(error) }
  }

  /// Form-level slot — auth failures ("wrong password", "can't reach the
  /// server") belong to the form, not a single field.
  private func errorSection(_ message: String) -> some View {
    Section {
      Text(message).foregroundStyle(.red)
    }
  }

  private var passwordPrompt: LocalizedStringKey {
    mode == .signUp ? "At least 8 characters" : "Password"
  }

  private var actions: some View {
    VStack(spacing: 4) {
      Button {
        switch mode {
        case .checkEmail, .signIn: Task { await trySignIn() }
        case .signUp: Task { await submitSignUp() }
        }
      } label: {
        Group {
          if busy {
            ProgressView().controlSize(.small)
          } else {
            Text(primaryCta)
          }
        }
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.glassProminent)
      .controlSize(.large)
      .disabled(busy || !canSubmit)

      Button(secondaryCta) {
        error = nil
        switch mode {
        case .signUp: mode = .signIn
        case .signIn: mode = .signUp
        case .checkEmail: mode = .signUp
        }
      }
      .buttonStyle(.borderless)
      .controlSize(.large)
    }
    .padding(.horizontal, 20)
    .padding(.bottom, 8)
  }

  private var primaryCta: LocalizedStringKey {
    switch mode {
    case .signIn: "Login"
    case .signUp: "Create Account"
    case .checkEmail: "I've verified — continue"
    }
  }

  private var secondaryCta: LocalizedStringKey {
    switch mode {
    case .signIn: "Don't have an account? Sign Up"
    case .signUp: "Already have an account? Login"
    case .checkEmail: "Use a different email"
    }
  }

  private var canSubmit: Bool {
    if mode == .checkEmail { return true }
    guard !email.isEmpty, !password.isEmpty else { return false }
    if mode == .signUp {
      return Validate.name(name, min: 2) != nil && password.count >= 8
    }
    return true
  }

  private func trySignIn() async {
    busy = true
    defer { busy = false }
    do {
      try await auth.signIn(email: email, password: password)
      done()
    } catch let APIError.rejected(_, message) {
      error = mode == .checkEmail
        ? "Not verified yet — try again in a moment."
        : message
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
        email: email, password: password, preferredCurrency: currency)
      error = nil
      mode = .checkEmail
    } catch let APIError.rejected(_, message) {
      error = message
    } catch {
      self.error = "Could not reach the server."
    }
  }
}
