# Domain-free MIRROR X registration

The default signup is now **handle + password + a recovery key** at https://mirror-x-three.vercel.app/account . No user email, telephone, custom domain, SMTP provider, external login provider or Vercel account is required. Existing email accounts remain available through a secondary option.

This supersedes the SMTP requirement for the default registration flow. SMTP is only needed if the operator separately wants to support general-purpose email signup/recovery.

## Real identities and privacy

This uses official Supabase Auth Admin APIs inside the new `mirror-x-accounts` Edge Function. It does not implement custom password hashing or insert into auth.users with SQL. Password storage/sign-in/session refresh are handled by Supabase Auth. The server constructs a reserved, non-deliverable identifier `mirrorx-handle-<normalized handle>@accounts.invalid`. `email_confirm: true` confirms that internal identifier only; it never verifies or impersonates a real email address, and no email is sent. The UI displays the handle, not the internal identifier. Real email verification for existing Jetuu accounts remains unchanged.

New handles are 3–30 ASCII letters/digits/underscores, starting with a letter, normalized to lowercase. Passwords require 12–128 characters. Existing email-login users retain their original route and credentials. Authorization always uses the verified auth.uid(), never user_metadata.

## Recovery

Registration returns a cryptographically random 256-bit recovery code, prefixed `mxr_`. The UI shows it once, offers a text download/copy, and requires explicit acknowledgement before entering the workspace. It does not automatically store the code in localStorage or the database. Only its SHA-256 hash is stored in `mirror_x.handle_accounts`. A high-entropy secret does not require password-style slow hashing. The key is an account-reset credential and must be kept separately from the password.

Recovery atomically exchanges the old hash for a new one before calling the Auth password-update API. A replay cannot claim the same key. If the password update fails, the function attempts to compensate by restoring the prior hash. A signed-in owner may rotate the recovery key without an email. If a network interruption loses the new key after a successful password change, the user can sign in with the new password and rotate it again.

If password, recovery key and all active sessions are lost, recovery is intentionally impossible. Login does not prove a real-world identity or ownership of an email address. Ordinary Supabase token/session expiry behavior applies; this release does not promise immediate invalidation of every already-issued access token after a password change.

## Server security

- Node `/api/handle-account`: same-origin protection, bounded JSON, strict action/handle/password/key validation; private no-store responses. It does not accept a client-supplied email or user ID. Failed requests do not echo credentials.
- Supabase Edge gateway keeps `verify_jwt=true`. The Node service uses a legacy **public anon JWT** in encrypted `SUPABASE_EDGE_ANON_JWT` for the gateway only. This is not a service-role credential. Key material is absent from Git and responses.
- The service-role key is read only from Supabase's built-in Edge environment. It is never stored in Vercel or sent to browsers. Privileged calls are limited to creating internal handle identities, initializing recovery hashes, changing the password for a successfully claimed mapping, and rotating the signed-in handle owner's key.
- `handle_accounts` and `handle_budgets` are RLS-enabled, explicitly denied to authenticated/anon users, with no client grants or public views. The four fixed SQL RPCs use SECURITY INVOKER and are callable only by service_role. No new SECURITY DEFINER function is introduced.
- Persistent request budgets: up to 10 registration/recovery attempts per IP hint/10 minutes and a hard total of 1,000/day UTC. IP hints are abuse signals, not authentication; the global cap remains if they are spoofed. These are bounded MVP quotas, not a claim of unlimited or CAPTCHA-grade bot protection. Login also uses GoTrue's own limits. No paid plan change.
- Existing Jetuu tables, Auth configuration, email settings, Edge functions and policies are not modified. Ordinary Auth creation/deletion can fire existing project triggers. The new Edge function has a separate name and the new records live in the approved mirror_x namespace.

## Verified

- 78 unit/Postgres tests pass, including recovery replay, private hash/RPC denial, rate budgets and identity normalization.
- Deno 2.9.6 type checking passes for the actual function, using the already installed/pinned SDK. Next.js production build and 12 standard browser scenarios pass.
- Mocked configured-browser UI verifies signup, explicit recovery acknowledgement, key download, no automatic secret storage, recovery form and 390/1366 responsiveness. It creates no real user and sends no email.
- Protected remote preview verified 12 real checks: two official Auth creations without user email, actual password login, cookie→Next API→Supabase workspace persistence, cross-user isolation, password recovery, new-password login, old-password rejection, single-use key, owner key rotation and invalidation of the old key.
- Both temporary QA users were signed out and deleted by exact IDs plus internal identifiers. Auth foreign-key cascades remove their handle/workspace rows. No test password/recovery code is retained in source, logs or proof reports.
- Security advisors report no findings for the new objects. Existing unrelated Jetuu findings remain outside this change.

`docs/HANDLE_VERIFICATION.json` records the proofs and production release. The protected QA handler exists only on the qa/handle-auth-check branch, not in production.
