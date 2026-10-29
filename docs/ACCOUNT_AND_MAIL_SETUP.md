# Public MIRROR X accounts and email setup

Public entry: https://mirror-x-three.vercel.app. This production alias does not require a Vercel account. Standard Protection continues to protect deployment URLs/previews, including the private provider check. Share the production alias, not a generated deployment URL.

The account form supports sign-up, sign-in, password reveal, resend-confirmation cooldown, password recovery and password update after a recovery callback. Existing short passwords are accepted on login; new passwords require 12 characters. Successful sign-in opens the workspace. Excel import/export and local portfolio work are available without an account.

Public Supabase settings were actually read on the protected server: email enabled, sign-up enabled, autoconfirm false. This confirms the email-confirmation requirement; it does NOT prove SMTP delivery to arbitrary recipients. No test email was sent, and no shared Jetuu Auth settings were changed.

## Required operator setup for public email delivery

Supabase's built-in SMTP is restricted to project-team addresses. Its official documentation requires custom SMTP for general public delivery: https://supabase.com/docs/guides/auth/auth-smtp . Resend is supported; no Resend installation was found in the connected Vercel team. CLI marketplace discovery could not authenticate in this environment. Connected tools do not provide an integration-install or Supabase Auth-config API. A provider account and verified sender/domain cannot be fabricated by the application.

1. Connect/create Resend at https://vercel.com/marketplace/resend or an existing SMTP provider supported by Supabase. Use a free plan if its current terms suit the volume. Complete the provider's account and sender/domain verification. No paid subscription is authorized or created by this release.
2. Configure SMTP host, port, user, password, sender address and MIRROR X sender name in https://supabase.com/dashboard/project/edpuovkgoisyzpguksdi/auth/smtp . Enter credentials there, not in browser code or Git.
3. In Auth URL Configuration, ADD these redirect URLs, retaining all existing Jetuu entries and its Site URL: `https://mirror-x-three.vercel.app/auth/callback` and `https://mirror-x-three.vercel.app/auth/callback?recovery=1`.
4. Verify sign-up, confirmation, login and password recovery with an operator-owned recipient. This release does not claim this real-mail end-to-end verification.

No confirmation setting is disabled on the shared Auth service. A different login provider also requires its own account/client configuration; it does not remove the need for operator-owned credentials. Guest Excel/local work is the working alternative while email delivery is being configured.

## Verification

69 unit/Postgres tests, 12 standard local browser scenarios passed after the account/Excel changes. `scripts/verify-account-ui.mjs` additionally verifies signup, password reveal and recovery UI against mocked Auth responses with a test-only configured build; it creates no real user and sends no email. Build that fixture using nonsecret dummy Supabase URL/key, run the server on port3100, then run the script. These are UI proofs, not SMTP delivery proofs.

Excel now has hidden gridlines, A4 landscape print sizing, repeating headers, page footers, filters for Positions/Financials, and explicit totals covering priced positions only. Personal native charts/raw data and the existing contest gate are preserved.
