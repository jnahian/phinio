/**
 * HTML email templates for Phinio transactional emails.
 *
 * Design system tokens (inline — email clients strip <style> blocks):
 *   surface             #0b1326
 *   surface-container   #171f33
 *   surface-container-low  #131b2e
 *   on-surface          #dae2fd
 *   on-surface-variant  #c3c6d7
 *   primary-container   #2563eb   ← CTA button
 *   on-primary-container #eeefff
 *   secondary           #4edea3   ← positive accent
 *   tertiary            #ffb3ad   ← warning accent
 *   outline-variant     #434655
 */

// Resolved at send-time so it always reflects the live deployment URL.
function logoUrl(): string | null {
  const base = process.env.BETTER_AUTH_URL
  return base ? `${base}/phinio-square.png` : null
}

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

// ── Shared shell ──────────────────────────────────────────────────────────────

function shell(title: string, body: string, year: number): string {
  const logo = logoUrl()

  const logoBlock = logo
    ? `<table cellpadding="0" cellspacing="0" border="0" role="presentation">
        <tr>
          <td style="padding-right:10px;vertical-align:middle;">
            <img src="${logo}" alt="" width="34" height="34"
                 style="display:block;border-radius:10px;border:0;" />
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:18px;font-weight:700;color:#dae2fd;
                         letter-spacing:-0.02em;font-family:-apple-system,
                         BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
              Phinio
            </span>
          </td>
        </tr>
      </table>`
    : `<span style="font-size:20px;font-weight:700;color:#dae2fd;
                   letter-spacing:-0.02em;font-family:-apple-system,
                   BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
         Phinio
       </span>`

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0b1326;
             -webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         role="presentation"
         style="background-color:#0b1326;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px 64px;">

        <!-- Card (max 560px) -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               role="presentation"
               style="max-width:560px;background-color:#171f33;
                      border-radius:24px;overflow:hidden;">

          <!-- ── Header ── -->
          <tr>
            <td align="center"
                style="padding:28px 40px;
                       border-bottom:1px solid rgba(67,70,85,0.35);">
              ${logoBlock}
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="padding:40px 40px 32px;">
              ${body}
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding:20px 40px 24px;
                       background-color:#131b2e;
                       border-top:1px solid rgba(67,70,85,0.25);">
              <p style="margin:0;font-size:11px;line-height:1.7;
                        color:rgba(195,198,215,0.45);text-align:center;
                        font-family:-apple-system,BlinkMacSystemFont,
                        'Segoe UI',Helvetica,Arial,sans-serif;">
                You received this email from Phinio because an action was
                taken on your account.<br />
                If you did not request this, you can safely ignore it.<br /><br />
                &copy; ${year} Phinio &mdash; Your private financial vault.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ctaButton(label: string, url: string): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%"
           role="presentation">
      <tr>
        <td align="center" style="padding:4px 0 32px;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                       xmlns:w="urn:schemas-microsoft-com:office:word"
                       href="${url}"
                       style="height:50px;v-text-anchor:middle;width:220px;"
                       arcsize="24%" stroke="f"
                       fillcolor="#2563eb">
            <w:anchorlock/>
            <center style="color:#eeefff;font-family:sans-serif;
                           font-size:15px;font-weight:700;">${label}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${url}" target="_blank"
             style="display:inline-block;background-color:#2563eb;
                    color:#eeefff;text-decoration:none;font-size:15px;
                    font-weight:700;padding:15px 36px;border-radius:12px;
                    letter-spacing:-0.01em;line-height:1;
                    box-shadow:0 8px 24px -6px rgba(37,99,235,0.55);
                    font-family:-apple-system,BlinkMacSystemFont,
                    'Segoe UI',Helvetica,Arial,sans-serif;">
            ${label}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`
}

function noticeBox(accentColor: string, text: string): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%"
           role="presentation"
           style="background-color:#0b1326;border-radius:12px;
                  margin-bottom:28px;border-left:3px solid ${accentColor};">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0;font-size:13px;line-height:1.6;
                    color:rgba(195,198,215,0.8);
                    font-family:-apple-system,BlinkMacSystemFont,
                    'Segoe UI',Helvetica,Arial,sans-serif;">
            ${text}
          </p>
        </td>
      </tr>
    </table>`
}

function fallbackUrl(url: string): string {
  return `
    <p style="margin:0;font-size:12px;line-height:1.7;
              color:rgba(195,198,215,0.38);
              font-family:-apple-system,BlinkMacSystemFont,
              'Segoe UI',Helvetica,Arial,sans-serif;">
      Button not working? Copy and paste this link into your browser:<br />
      <a href="${url}" target="_blank"
         style="color:rgba(180,197,255,0.55);word-break:break-all;">
        ${url}
      </a>
    </p>`
}

// ── Email verification ────────────────────────────────────────────────────────

export function verificationEmailHtml(name: string, url: string): string {
  const first = firstNameOf(name)

  const body = `
    <h1 style="margin:0 0 10px;font-size:26px;font-weight:700;
               color:#dae2fd;letter-spacing:-0.025em;line-height:1.15;
               font-family:-apple-system,BlinkMacSystemFont,
               'Segoe UI',Helvetica,Arial,sans-serif;">
      Verify your email
    </h1>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.65;
              color:#c3c6d7;
              font-family:-apple-system,BlinkMacSystemFont,
              'Segoe UI',Helvetica,Arial,sans-serif;">
      Hi ${first}, welcome to Phinio. Tap the button below to confirm your
      email address and open your vault.
    </p>

    ${ctaButton('Verify email address', url)}

    ${noticeBox(
      '#4edea3',
      `<strong style="color:#4edea3;">This link expires in 1 hour.</strong>
       If it expires, sign in and we will send a fresh one automatically.`,
    )}

    ${fallbackUrl(url)}
  `

  return shell('Verify your Phinio email', body, new Date().getFullYear())
}

export function verificationEmailText(name: string, url: string): string {
  const first = firstNameOf(name)
  return `Hi ${first},

Welcome to Phinio! Click the link below to verify your email address and finish setting up your vault:

${url}

This link expires in 1 hour. If you didn't create a Phinio account, you can safely ignore this email.

— The Phinio team`
}

// ── Password reset ────────────────────────────────────────────────────────────

export function passwordResetEmailHtml(name: string, url: string): string {
  const first = firstNameOf(name)

  const body = `
    <h1 style="margin:0 0 10px;font-size:26px;font-weight:700;
               color:#dae2fd;letter-spacing:-0.025em;line-height:1.15;
               font-family:-apple-system,BlinkMacSystemFont,
               'Segoe UI',Helvetica,Arial,sans-serif;">
      Reset your password
    </h1>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.65;
              color:#c3c6d7;
              font-family:-apple-system,BlinkMacSystemFont,
              'Segoe UI',Helvetica,Arial,sans-serif;">
      Hi ${first}, we received a request to reset the password on your
      Phinio account. Click the button below to choose a new one.
    </p>

    ${ctaButton('Reset password', url)}

    ${noticeBox(
      '#ffb3ad',
      `<strong style="color:#ffb3ad;">Security notice.</strong>
       This link expires in 1 hour. If you did not request a password reset,
       your account is safe &mdash; no changes have been made.`,
    )}

    ${fallbackUrl(url)}
  `

  return shell('Reset your Phinio password', body, new Date().getFullYear())
}

export function passwordResetEmailText(name: string, url: string): string {
  const first = firstNameOf(name)
  return `Hi ${first},

We received a request to reset the password on your Phinio account.
Click the link below to set a new password:

${url}

This link expires in 1 hour. If you didn't request this, your account is safe — no changes have been made.

— The Phinio team`
}
