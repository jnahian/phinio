import SwiftUI

/// Sign-in / sign-up with the "check your email" verification loop:
/// after sign-up we retry sign-in on demand until verification sticks.
struct AuthStepView: View {
  let done: () -> Void
  @EnvironmentObject private var auth: AuthManager

  enum Mode { case signIn, signUp, checkEmail, forgotPassword }
  @State private var mode: Mode
  @State private var name = ""
  @State private var email = ""
  @State private var password = ""
  @State private var showPassword = false
  @State private var currency = "BDT"
  @State private var error: String?
  @State private var busy = false
  @State private var resetSent = false

  init(startMode: Mode = .signIn, done: @escaping () -> Void) {
    _mode = State(initialValue: startMode)
    self.done = done
  }

  var body: some View {
    NavigationStack {
      Form {
        headerSection
        switch mode {
        case .checkEmail: checkEmailSections
        case .forgotPassword: forgotPasswordSections
        case .signIn, .signUp: formSections
        }
      }
      .scrollDismissesKeyboard(.interactively)
      .toolbar(.hidden, for: .navigationBar)
      .safeAreaInset(edge: .bottom) { actions }
    }
  }

  /// Brand lockup up top (logo + wordmark), then the page heading and its
  /// sub-heading — the navigation bar is hidden so this is the only title.
  private var headerSection: some View {
    Section {
      VStack(alignment: .leading, spacing: 22) {
        HStack(spacing: 12) {
          Image("PhinioLogo")
            .resizable()
            .scaledToFit()
            .frame(width: 40, height: 40)
            .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
            .accessibilityHidden(true)
          Text("Phinio")
            .font(.title2.weight(.bold))
        }
        VStack(alignment: .leading, spacing: 6) {
          Text(title)
            .font(.largeTitle.weight(.bold))
          Text(subtitle)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.top, 8)
      .padding(.bottom, 4)
    }
    .listRowBackground(Color.clear)
  }

  private var title: LocalizedStringKey {
    switch mode {
    case .signIn: "Welcome back"
    case .signUp: "Create account"
    case .checkEmail: "Check your email"
    case .forgotPassword: "Reset password"
    }
  }

  private var subtitle: LocalizedStringKey {
    switch mode {
    case .signIn: "Sign in to your vault."
    case .signUp: "Start tracking investments and EMIs."
    case .checkEmail: "Verify your email to continue."
    case .forgotPassword:
      resetSent ? "Check your inbox." : "Enter your email to get a reset link."
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
  private var forgotPasswordSections: some View {
    if resetSent {
      Section {
        Text("If an account exists for \(email), we've sent a link to reset your password. Open it, set a new password, then come back and log in.")
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
    } else {
      Section {
        TextField("Email", text: $email)
          .textContentType(.emailAddress)
          .keyboardType(.emailAddress)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
      }
      if let error { errorSection(error) }
    }
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
        case .forgotPassword:
          if resetSent { backToSignIn() } else { Task { await sendReset() } }
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

      if mode == .signIn {
        Button("Forgot password?") {
          error = nil
          mode = .forgotPassword
        }
        .buttonStyle(.borderless)
        .controlSize(.large)
      }

      if showSecondary {
        Button(secondaryCta) {
          error = nil
          switch mode {
          case .signUp: mode = .signIn
          case .signIn: mode = .signUp
          case .checkEmail: mode = .signUp
          case .forgotPassword: backToSignIn()
          }
        }
        .buttonStyle(.borderless)
        .controlSize(.large)
      }
    }
    .padding(.horizontal, 20)
    .padding(.bottom, 8)
    .tint(Brand.blue)
  }

  private var primaryCta: LocalizedStringKey {
    switch mode {
    case .signIn: "Login"
    case .signUp: "Create Account"
    case .checkEmail: "I've verified — continue"
    case .forgotPassword: resetSent ? "Back to login" : "Send reset link"
    }
  }

  /// Hidden once the reset link is sent — the primary button becomes the only,
  /// obvious way back to login, so a second one would be redundant.
  private var showSecondary: Bool {
    !(mode == .forgotPassword && resetSent)
  }

  private var secondaryCta: LocalizedStringKey {
    switch mode {
    case .signIn: "Don't have an account? Sign Up"
    case .signUp: "Already have an account? Login"
    case .checkEmail: "Use a different email"
    case .forgotPassword: "Back to login"
    }
  }

  private var canSubmit: Bool {
    if mode == .checkEmail { return true }
    if mode == .forgotPassword { return resetSent || !email.isEmpty }
    guard !email.isEmpty, !password.isEmpty else { return false }
    if mode == .signUp {
      return Validate.name(name, min: 2) != nil && password.count >= 8
    }
    return true
  }

  private func backToSignIn() {
    error = nil
    resetSent = false
    mode = .signIn
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

  private func sendReset() async {
    busy = true
    defer { busy = false }
    do {
      try await auth.requestPasswordReset(email: email)
      error = nil
      resetSent = true
    } catch {
      // Better Auth returns success even for unknown emails, so a failure here
      // is transport/validation, not "no such account".
      self.error = "Couldn't send the reset link. Check your connection and try again."
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
