# Supabase auth email templates

The mobile app signs people in with a 6-digit code emailed by Supabase Auth
(`signInWithOtp` + `verifyOtp`). Supabase uses the **Magic Link** template for
existing users and the **Confirm signup** template for new users, so both are
set to [sign-in-code.html](sign-in-code.html), which shows `{{ .Token }}`.

The website (d14-angular) doesn't send either of these emails: it signs in
with a password, and email confirmation is turned off (`mailer_autoconfirm`).
The password-reset template is the website's and is not managed here.

Applied with the Supabase Management API
(`PATCH /v1/projects/{ref}/config/auth`):

| Setting | Value |
|---|---|
| `mailer_subjects_magic_link` | `Your District 14 sign-in code` |
| `mailer_templates_magic_link_content` | contents of `sign-in-code.html` |
| `mailer_subjects_confirmation` | `Your District 14 sign-in code` |
| `mailer_templates_confirmation_content` | contents of `sign-in-code.html` |
| `rate_limit_email_sent` | `100` (emails per hour, whole project; was 2, which also throttled the website's password-reset emails) |

`mailer_otp_exp` is left as is (staging 1 h, prod 24 h): it also controls how
long password-reset links last, and the reset email promises 24 hours.

Status: staging applied 2026-11-12; prod applied 2026-11-13 (prod's previous
templates were the Supabase defaults; a backup of the old auth config was
taken before the change).
