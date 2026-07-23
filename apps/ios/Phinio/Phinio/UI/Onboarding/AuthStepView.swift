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
    ZStack {
      Color.surface.ignoresSafeArea()
      ScrollView {
        VStack(alignment: .leading, spacing: 0) {
          Text(title)
            .font(.screenTitle).tracking(Tracking.screenTitle)
            .foregroundStyle(Color.onSurface)
          Text(subtitle)
            .font(.body).foregroundStyle(Color.onSurfaceVariant)
            .padding(.top, 6)

          switch mode {
          case .checkEmail: checkEmailBody
          case .signIn, .signUp: formBody
          }
        }
        .padding(.horizontal, Layout.screenHorizontalPadding)
        .padding(.top, 40)
        .padding(.bottom, 40)
      }
      .scrollIndicators(.hidden)
      .scrollDismissesKeyboard(.interactively)
    }
  }

  private var title: String {
    switch mode {
    case .signIn: "Welcome back"
    case .signUp: "Create account"
    case .checkEmail: "Check your email"
    }
  }

  private var subtitle: String {
    switch mode {
    case .signIn: "Sign in to your vault."
    case .signUp: "Start tracking investments and EMIs."
    case .checkEmail: "We sent a verification link to \(email). Tap it, then come back here."
    }
  }

  private var checkEmailBody: some View {
    VStack(spacing: 12) {
      PrimaryButton("I've verified — continue", busy: busy) {
        Task { await trySignIn() }
      }
      TextButton("Use a different email") {
        error = nil
        mode = .signUp
      }
      if let error { errorSlot(error) }
    }
    .padding(.top, 32)
  }

  private var formBody: some View {
    VStack(alignment: .leading, spacing: 14) {
      if mode == .signUp {
        field("Full name") {
          CarvedTextField(placeholder: "Rahim Ahmed", text: $name)
            .textContentType(.name)
        }
      }

      field("Email") {
        CarvedTextField(placeholder: "you@example.com", text: $email)
          .textContentType(.emailAddress)
          .keyboardType(.emailAddress)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
      }

      field("Password") {
        HStack(spacing: 8) {
          CarvedTextField(
            placeholder: mode == .signUp ? "At least 8 characters" : "Password",
            text: $password, secure: !showPassword)
            .textContentType(mode == .signUp ? .newPassword : .password)
          Button { showPassword.toggle() } label: {
            Image(systemName: showPassword ? "eye.slash" : "eye")
              .font(.system(size: 16))
              .foregroundStyle(Color.onSurfaceVariant)
              .frame(width: 44, height: 44)
              .contentShape(.rect)
          }
          .buttonStyle(.plain)
          .accessibilityLabel(showPassword ? "Hide password" : "Show password")
        }
      }

      if mode == .signUp {
        field("Preferred currency") {
          HStack(spacing: 10) {
            currencyTile("৳ BDT", "Bangladeshi Taka", code: "BDT")
            currencyTile("$ USD", "US Dollar", code: "USD")
          }
        }
      }

      if let error { errorSlot(error) }

      PrimaryButton(
        mode == .signUp ? "Create Account" : "Login",
        busy: busy, enabled: canSubmit
      ) {
        Task { mode == .signUp ? await submitSignUp() : await trySignIn() }
      }
      .padding(.top, 6)

      TextButton(
        mode == .signUp
          ? "Already have an account? Login"
          : "Don't have an account? Sign Up"
      ) {
        error = nil
        mode = mode == .signUp ? .signIn : .signUp
      }
    }
    .padding(.top, 32)
  }

  private func field<Content: View>(
    _ label: String, @ViewBuilder content: () -> Content
  ) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(label).font(.meta).foregroundStyle(Color.onSurfaceVariant)
      content()
    }
  }

  /// Form-level slot, distinct from CarvedTextField's per-field errors — auth
  /// failures ("wrong password", "can't reach the server") belong to the form.
  private func errorSlot(_ message: String) -> some View {
    Text(message)
      .font(.caption)
      .foregroundStyle(Color.error)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(12)
      .background(
        Color.tertiaryContainer.opacity(0.12),
        in: RoundedRectangle(cornerRadius: Radii.input, style: .continuous))
  }

  private func currencyTile(_ title: String, _ subtitle: String, code: String) -> some View {
    let selected = currency == code
    return Button { currency = code } label: {
      VStack(alignment: .leading, spacing: 3) {
        Text(title).font(.custom("Manrope-Bold", size: 18))
        Text(subtitle).font(.meta).opacity(0.7)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(14)
      .foregroundStyle(selected ? Color.brandPrimary : Color.onSurfaceVariant)
      .background(
        selected ? Color.primaryContainer.opacity(0.18) : Color.surfaceLowest,
        in: RoundedRectangle(cornerRadius: Radii.currencyTile, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: Radii.currencyTile, style: .continuous)
          .strokeBorder(selected ? Color.brandPrimary.opacity(0.4) : .clear, lineWidth: 0.5))
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
  }

  private var canSubmit: Bool {
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
