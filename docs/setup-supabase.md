# Set up Supabase

Supabase gives the site its Postgres database, sign in (GitHub, Google and email links) and
file storage for uploads. This guide sets up the production project, connects it to GitHub
so merged migrations deploy themselves, and turns on sign in.

You need: a Supabase account, admin access to the `EIC-Robocup/eic_website` GitHub repo, and
about 30 minutes. Do the [Vercel guide](./setup-vercel.md) after this one (or alongside it).

> Dashboard names below are from late 2026. If a menu has moved, use the search box at the
> top of the Supabase Dashboard.

## How the pieces fit

- `src/lib/server/db/schema.ts` (Drizzle) is the source of truth for the database.
- `pnpm db:generate` turns schema changes into SQL files in `supabase/migrations/`.
- When those files are merged into `main`, the **Supabase GitHub integration** applies them to
  the production database. Nobody runs SQL by hand.
- The site connects to Postgres directly from its server. Supabase's auto-generated REST API
  (the "Data API") is not used, and every table has row level security switched on with no
  policies, so the public API keys can't read or change any data.

## 1. Create the project

1. In the [Supabase Dashboard](https://supabase.com/dashboard), open your organization (or create
   one for the club) and click **New project**.
2. Name: `eic-website`. Region: **Southeast Asia (Singapore)**, the closest to Bangkok, and the
   same region the site's Vercel functions run in (`sin1`).
3. Generate a strong **database password** and save it in the club's password manager. You need
   it for the connection strings.
4. Plan: **Free** works. Things to know:
   - Free projects pause after about a week without database activity. The site has a daily
     Vercel cron (`vercel.json` → `/api/health`) that queries the database, which keeps it
     awake once the site is deployed.
   - **Preview branches** (a throwaway database per pull request) need the **Pro** plan. The
     GitHub integration's "Deploy to production" works on every plan.

## 2. Collect keys and connection strings

Click **Connect** in the project's top bar.

| What | Where | Used as |
| --- | --- | --- |
| Project URL `https://<ref>.supabase.co` | Connect dialog, or Project Settings → Data API | `SUPABASE_URL` |
| Publishable key `sb_publishable_...` | Project Settings → **API Keys** → "Publishable and secret API keys" (click **Create new API keys** if empty) | `SUPABASE_PUBLISHABLE_KEY` |
| Secret key `sb_secret_...` | same page, **Secret keys** → reveal → copy | `SUPABASE_SECRET_KEY` (server only, never share it) |
| Transaction pooler URI (port **6543**) | Connect → **Connection String** → Transaction pooler | `DATABASE_URL` on Vercel |
| Session pooler URI (port **5432**) | Connect → **Connection String** → Session pooler | for `pnpm db:seed`, `pnpm db:migrate` and Drizzle Studio from your laptop |

Replace `[YOUR-PASSWORD]` in the URIs with the database password. Pooler URIs look like
`postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`.

Use the new publishable and secret keys. The legacy `anon` and `service_role` keys stop working
at the end of 2026. (The site still reads `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` as a
fallback, but don't rely on them.)

Don't use the "Direct connection" host (`db.<ref>.supabase.co`): it is IPv6 only and Vercel
can't reach it.

## 3. Turn on the GitHub integration

This makes Supabase apply new migrations whenever they are merged into `main`.

1. Project Settings → **Integrations** → **GitHub Integration** → **Authorize GitHub**. On GitHub,
   authorize Supabase and install the Supabase GitHub App on the `EIC-Robocup` organization (or
   just the `eic_website` repo). An organization owner may need to approve it.
2. Back on the Integrations page, pick the repository **EIC-Robocup/eic_website**.
3. Settings:
   - **Working directory**: `.` (the `supabase/` folder is at the repo root).
   - **Production branch**: `main`.
   - **Deploy to production**: **on**. Supabase then applies new files in `supabase/migrations`
     and creates the storage buckets from `supabase/config.toml` on every push to `main`.
   - **Automatic branching** (Pro plan only): on if you want a preview database per pull request.
     Turn on **Supabase changes only** too, and set a small **branch limit** (for example 3):
     preview branches are billed per hour.
4. Click **Enable integration**.

What it does and doesn't deploy to production:

- Deploys: new migrations, storage buckets.
- Ignores on production: the `[auth]` and `[api]` parts of `config.toml` and `seed.sql`. Set
  production sign in in the Dashboard (step 5), and load starter content with `pnpm db:seed`
  (step 4).

### First deploy

The production database must be empty for the first migration: don't create tables in the
Table Editor.

1. Merge `feat/v1` into `main` (open a pull request on GitHub and merge it).
2. In the Dashboard, open the branch dropdown in the top bar → **Manage branches** → `main` →
   **View logs**, and check that the three migrations ran: `init`, `storage_media_bucket` and
   `revoke_data_api_access`.
3. **Table Editor** should now list the tables (`projects`, `posts`, `people`, ...) and
   **Storage** a public bucket called `media`.

Without the integration (or to apply migrations by hand), run from your laptop:

```bash
DATABASE_URL="<session pooler URI>" pnpm db:migrate
```

`pnpm db:migrate` records migrations in the same table the Supabase CLI uses, so it and the
integration agree on what has run. Never run `drizzle-kit migrate` or `drizzle-kit push`
against Supabase: they keep their own records and would apply migrations twice.

### Preview branches (Pro)

- Each pull request gets its own database with the migrations and `supabase/seed.sql` applied.
- If Vercel is connected to Supabase (see the Vercel guide), Supabase copies the preview
  branch's credentials into that pull request's Vercel preview deployment.
- Preview databases have their own auth callback URL, so GitHub and Google sign in won't work
  on them. Use the email link there.
- Optional: in GitHub → repo **Settings → Branches** → rule for `main` → **Require status checks**
  → add **Supabase Preview**, so a pull request with a broken migration can't be merged.

## 4. Load the starter content

Seeds never run on production automatically. Load the club's content (projects, people, posts,
achievements, archive photos) once, from your laptop, after the first deploy:

```bash
pnpm install
DATABASE_URL="<session pooler URI>" pnpm db:seed
```

It refuses to run if the database already has projects (pass `--force` to insert any missing
rows anyway; existing rows are never overwritten). Afterwards, everything is edited in the
admin panel.

## 5. Set up sign in

The admin panel accepts GitHub, Google and a passwordless email link. Only invited people get in:
the site checks every sign in against its own `editors` table, and anyone not on it is signed
out (and their Supabase user is deleted).

### 5.1 URL configuration

Authentication → **URL Configuration**:

- **Site URL**: `https://eicchula.club` (or your `https://<project>.vercel.app` address until the
  domain is connected).
- **Redirect URLs** → **Add URL**, one per line:
  - `https://eicchula.club/**`
  - `https://<project>.vercel.app/**` (your production Vercel address)
  - `https://*-<vercel-team-slug>.vercel.app/**` (Vercel preview deployments; the slug is the
    last part of your preview URLs, e.g. `eic-robocup`)
  - `http://localhost:5173/**` (local development)

Sign in returns to the address the person started from only if it matches this list.
Otherwise Supabase sends them to the Site URL.

### 5.2 Email templates

Authentication → **Emails** → **Templates**. Replace the body of both **Magic link** and
**Confirm signup** (a person's first sign in uses "Confirm signup") with:

```html
<h2>Sign in to EIC Chula</h2>
<p>Use this link to sign in to the EIC Chula content editor:</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Continue to sign in</a></p>
<p>Or enter this code on the sign in page: <strong>{{ .Token }}</strong></p>
<p>The link and code work once and expire in one hour. If you did not ask to sign in, ignore this email.</p>
```

Subject for both: `Your EIC Chula sign in link`. (The same template is in
`supabase/templates/magic_link.html`.)

Why: the link goes to the site's `/auth/confirm` page, which asks for one click before signing
in. Email scanners such as Microsoft 365 Safe Links open links in emails automatically, and
would otherwise use up a one-time link before you click it. The 6-digit code is a fallback.

### 5.3 Email delivery (do this before inviting anyone)

Supabase's built-in email sender only delivers to members of your Supabase organization and
sends very few emails an hour. For real use, connect your own SMTP provider:

1. Create an account with an email provider (for example Resend, Brevo or Amazon SES) and verify
   a sending domain such as `eicchula.club` (they give you DNS records for SPF and DKIM).
2. Authentication → **Emails** → **SMTP Settings** → enable custom SMTP and fill in host, port,
   username, password, sender email (e.g. `no-reply@eicchula.club`) and sender name
   (`EIC Chula`).
3. Authentication → **Rate Limits**: raise "emails per hour" if needed (it starts at 30).

Until then, GitHub and Google sign in work without email.

### 5.4 GitHub sign in

1. In Supabase: Authentication → **Sign In / Providers** → **GitHub**, and copy the
   **Callback URL** (`https://<ref>.supabase.co/auth/v1/callback`).
2. On GitHub, create the OAuth app under the organization so it outlives any one member:
   `https://github.com/organizations/EIC-Robocup/settings/applications` → **New OAuth app**
   (or your personal Settings → Developer settings → OAuth Apps).
   - Application name: `EIC Chula website`
   - Homepage URL: `https://eicchula.club`
   - Authorization callback URL: the Supabase callback URL from step 1
   - Register, then copy the **Client ID** and **Generate a new client secret**.
3. Back in Supabase, switch **GitHub** on, paste the Client ID and Client Secret, and **Save**.

The person's GitHub account needs a verified email address that matches their invite.

### 5.5 Google sign in

1. In the [Google Cloud console](https://console.cloud.google.com), create a project (e.g.
   `eic-website`).
2. **Google Auth Platform** → get started:
   - Audience: **External**. While the app is in "Testing", add the editors' Google accounts as
     test users, or click **Publish app** to allow any Google account (the site still checks
     the invite list).
   - Data access: make sure `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`
     are listed.
3. **Clients** → **Create client** → **Web application**:
   - Authorized JavaScript origins: `https://eicchula.club` (and your Vercel address).
   - Authorized redirect URIs: the Supabase callback URL
     (`https://<ref>.supabase.co/auth/v1/callback`).
   - Create, then copy the Client ID and Client secret.
4. In Supabase: Authentication → **Sign In / Providers** → **Google** → switch on, paste both
   values, **Save**.

### 5.6 Sign ups

Leave **Allow new users to sign up** on (Authentication → Sign In / Providers). The site already
decides who gets in: email links are only sent to invited addresses, and anyone else who signs
in with GitHub or Google is signed out and removed straight away. Turning sign ups off would
block invited editors on their very first sign in.

## 6. The first admin

The `editors` table starts empty. Set the `ADMIN_EMAILS` variable on Vercel (see the Vercel
guide) to your email, comma separated for several people. Those addresses can always sign in
and become **owners** on their first sign in. Owners invite everyone else from **Admin →
Settings**; once that's done you can remove `ADMIN_EMAILS`.

## 7. Security check

- **Advisors → Security Advisor**: run it after the first deploy. "RLS enabled, no policy" notes
  on the app's tables are expected: that is what keeps the public API out.
- Optional: turn the Data API off entirely (**Integrations → Data API** → disable). The site
  doesn't use it; sign in and storage keep working.
- Keep the secret key and database password only in Vercel and the club's password manager.

## 8. Changing the database later

1. Edit `src/lib/server/db/schema.ts`.
2. Run `pnpm db:generate`. It writes a new file in `supabase/migrations/` (and updates
   `supabase/migrations/meta/`). Commit both.
3. Open a pull request into `main`. With Pro branching on, a preview database tests it.
4. Merge. The integration applies the migration to production.

Rules: never edit a migration that has already been merged (write a new one), and prefer
changes that old code can live with for a minute (add a column first, remove the old one in a
later release): Vercel and Supabase deploy at the same time.

## 9. Local development

Two options:

- **Full Supabase locally** (needs Docker): `pnpm dlx supabase@3 start` runs Postgres, Auth,
  Storage and a test inbox with this repo's `supabase/config.toml`, migrations and seed. It
  prints local URLs and keys; put them in `.env` (`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`,
  `SUPABASE_URL=http://127.0.0.1:54321`, plus the printed publishable and secret keys).
  Sign in emails show up in the local inbox it prints (Mailpit).
- **Just Postgres** (no Docker): `scripts/local-db.sh start` starts a local Postgres 16 with
  stand-ins for Supabase's schemas, then `pnpm db:migrate && pnpm db:seed`. Set
  `DEV_AUTH_EMAIL=you@example.com` in `.env` to skip sign in during `pnpm dev` (ignored in
  production builds). Uploads need a real Supabase project.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Sign in returns to the home page instead of the admin | Add the site's address to Redirect URLs (5.1). |
| "This account isn't invited" | Invite the email in Admin → Settings, or add it to `ADMIN_EMAILS`. The GitHub/Google account's email must match. |
| No sign in email arrives | Set up custom SMTP (5.3). The built-in sender only mails Supabase org members. |
| Email link says it expired right away | Check the template from 5.2 is in place (both templates). |
| First migration fails with "already exists" | Tables were created by hand. Use a fresh project, or drop them. |
| Site shows the designed defaults but no projects | Run `pnpm db:seed` (step 4) or add content in the admin. |
| Uploads fail with "not set up" | Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` on Vercel and redeploy. |
