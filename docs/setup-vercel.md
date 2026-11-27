# Set up Vercel

Vercel builds and hosts the site. Every push to `main` deploys production; every other branch
and pull request gets its own preview address.

You need: a Vercel account (Hobby is fine for a public repo; the repo
`EIC-Robocup/eic_website` is public), the Supabase project from the
[Supabase guide](./setup-supabase.md), and permission to install apps on the `EIC-Robocup`
GitHub organization (or an org owner to approve). About 20 minutes, plus DNS time for the domain.

> Menu names are from late 2026. If something has moved, use the search box in the Vercel
> dashboard.

## 1. Import the repository

1. On [vercel.com](https://vercel.com), choose **Add New… → Project → Import Git Repository**.
2. Connect GitHub if asked and install the **Vercel GitHub App** on the `EIC-Robocup`
   organization (all repos, or just `eic_website`). GitHub asks an organization owner to approve
   it. If the repo isn't listed, click **Adjust GitHub App Permissions**.
3. Pick **EIC-Robocup/eic_website**.
4. Project name: `eic-website`. It becomes part of every preview URL.
5. **Framework Preset**: SvelteKit (detected automatically). Leave Build Command, Output
   Directory, Install Command and Root Directory (`./`) on their defaults. Vercel reads pnpm
   from `pnpm-lock.yaml` and the `packageManager` field.
6. Don't add environment variables yet: connect Supabase first (step 2). Click **Deploy**. This
   first deployment builds `main`. If `feat/v1` is not merged yet (Supabase guide, step 3
   "First deploy"), `main` is still the starter scaffold and this build fails with
   `env_invalid ... DATABASE_URL`. That is expected: it goes green once `feat/v1` is merged
   (step 4). After the merge it builds without variables, but has no database until step 2.

Production branch: `main` (Vercel uses the repo's default branch). Pushes to `feat/v1` and pull
requests become **preview** deployments. Branches named `claude/*` are not deployed
(`vercel.json`).

### Node.js

`package.json` asks for Node `>=24`. Vercel builds with the newest Node that satisfies it (26 at
the time of writing) and logs a warning about it. The site's server functions always run on
Node 24, because `vite.config.ts` pins `runtime: 'nodejs24.x'`. Nothing to do. To build on 24
as well, change `engines.node` to `24.x`.

## 2. Connect Supabase (environment variables)

Use **Supabase's Vercel integration**. It writes the right variables into the Vercel project and,
with Supabase preview branches, gives every pull request its own database credentials.

1. In the **Supabase Dashboard**, open your **organization** (not the project) →
   **Integrations** → **Vercel** → **Install integration**. Approve it on Vercel for your account
   or team.
2. Back on Supabase's Integrations page, **Add new project connection**: choose the Supabase
   project `eic-website` and the Vercel project `eic-website`. Leave the environments ticked
   (Production, Preview, Development).
3. In Vercel → project → **Settings → Environment Variables**, check that these now exist:
   `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `POSTGRES_URL` (plus a few
   `POSTGRES_*` and `NEXT_PUBLIC_*` extras the site ignores).

> Don't use "Vercel Marketplace → Storage → Create Database → Supabase". That creates a *new*
> Supabase organization billed through Vercel. We want the existing project from the Supabase
> guide.

Then add the variables the integration doesn't know about:

| Name | Value | Environments |
| --- | --- | --- |
| `ADMIN_EMAILS` | Your email (comma separated for several people). These people can always sign in and become owners. | Production, Preview |
| `CRON_SECRET` | Optional but recommended. A random string of 16 or more characters, for example from `openssl rand -hex 24`. Vercel sends it with each cron call, so only the cron can run the daily tidy up (step 7). Mark it **Sensitive**. | Production |

Do **not** add `DATABASE_URL` on Vercel when the integration is connected: the site prefers
`DATABASE_URL` over `POSTGRES_URL`, so it would point every preview at the production database.
Never set `DEV_AUTH_EMAIL` on Vercel (it is ignored outside `pnpm dev` anyway).

Changing variables only affects new deployments: **Deployments → ⋯ → Redeploy** afterwards.
`SUPABASE_URL` is also read while the site is built, to allow resizing of uploaded photos
(step 9), so a redeploy is needed for that too.

### Without the integration (manual variables)

If you'd rather not connect the integration, add these yourself (values from step 2 of the
Supabase guide), mark the keys **Sensitive**, and tick Production and Preview:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **transaction pooler** URI (port 6543) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` |
| `ADMIN_EMAILS` | your email |

### Preview deployments and the database

- **Free Supabase plan (no branching):** previews use the production database and sign in. Treat
  a preview like production: editing content on a preview edits the real site.
- **Pro plan with branching:** Supabase copies each preview branch's credentials into Vercel when
  the **pull request is opened**, then redeploys it. Open the pull request early (a draft is
  fine): pushes before that use the production credentials.

## 3. Function region

The site's server runs in **Singapore (`sin1`)**, next to the Supabase database, which is set in
`vite.config.ts`. Also set the project default so nothing falls back to the US: **Settings →
Functions → Function Region → Singapore (sin1)**.

## 4. Deploy

1. If `feat/v1` is not merged into `main` yet, turn the Supabase GitHub integration on first
   (Supabase guide, step 3), then merge `feat/v1` into `main` now (pull request on GitHub).
   Vercel deploys production and Supabase applies the migrations at the same time.
2. If you merged it earlier (you did the whole Supabase guide first), redeploy production so it
   picks up the variables from step 2: **Deployments** → the newest production deployment →
   **⋯** → **Redeploy**.
3. Load the starter content once (Supabase guide, step 4), if you haven't yet, and open the
   site.

Check:

- `https://<your-project>.vercel.app/api/health` returns `{"ok":true,"database":"ok"}`.
- The home page shows Walkie 4, the projects and the people.
- `/admin` shows the sign in page with GitHub, Google and email options.
- Sign in, open **Admin → Media** and upload a photo. It should appear in the library. This
  checks the upload path and the site's Content-Security-Policy (step 9).
- Load the home page twice and look at the response headers in the browser's developer tools
  (Network tab, the first request). The second load shows `x-vercel-cache: HIT`, so Vercel's
  CDN serves the page (step 9).

## 5. Custom domain `eicchula.club`

1. Project → **Settings → Domains → Add** → `eicchula.club`. Accept adding `www.eicchula.club` and
   set it to **redirect** to `eicchula.club`.
2. At your domain registrar, add the DNS records shown on each domain card:
   - `eicchula.club`: an **A** record for `@` with the IP Vercel shows (often `76.76.21.21`, but
     use the value on the card).
   - `www`: a **CNAME** to the target Vercel shows.
   - Remove old A/AAAA records for `@` from a previous host. If the zone has CAA records, add
     `0 issue "letsencrypt.org"`.
   - Alternatively, move the domain's nameservers to Vercel (`ns1.vercel-dns.com`,
     `ns2.vercel-dns.com`) and recreate any email (MX/TXT) records in Vercel first.
3. Wait until both cards say **Valid Configuration** (minutes to a few hours). HTTPS
   certificates are issued automatically.
4. In Supabase → Authentication → URL Configuration, set **Site URL** to
   `https://eicchula.club` and make sure `https://eicchula.club/**` is in Redirect URLs. In Google
   Cloud, add `https://eicchula.club` to the OAuth client's JavaScript origins.

## 6. Sign in on preview addresses

Every preview has its own address, like `eic-website-git-feat-v1-<team-slug>.vercel.app`. The
`<team-slug>` is the last part of those addresses: copy it from a real preview URL. Add these to
Supabase → Authentication → URL Configuration → **Redirect URLs** (if you haven't already):

```
https://eicchula.club/**
https://eic-website.vercel.app/**
https://*-<team-slug>.vercel.app/**
http://localhost:5173/**
```

Then replace `<vercel-team-slug>` in `supabase/config.toml` with the same slug (used by Supabase
preview branches).

By default Vercel protects preview addresses (and the `*.vercel.app` production address) with
**Vercel Authentication**: only people signed in to Vercel with access to the project can open
them. The custom domain is public. Change this in **Settings → Deployment Protection**.

## 7. The daily keep-alive

`vercel.json` schedules `GET /api/health` once a day (03:17 UTC). The endpoint runs one tiny
query, which keeps a Free plan Supabase project from pausing after a quiet week. The same run
tidies up: it deletes rate limit counters older than a day and removes the hashed sender
address from contact messages older than a day. Anyone can open `/api/health`, but only the
cron's call tidies up: with `CRON_SECRET` set (step 2), the call must carry it, and without it
the site goes by the cron's user agent. It shows up under **Settings → Cron Jobs** after the
first production deployment. Cron jobs only run on production.

## 8. Local environment from Vercel (optional)

```bash
pnpm dlx vercel@latest login
pnpm dlx vercel@latest link        # choose the eic-website project
pnpm dlx vercel@latest env pull    # writes .env.local with the Development values
```

`.env.local` overrides `.env`. If the Development values include the production `POSTGRES_URL`,
keep a local `DATABASE_URL` in `.env` (it wins over `POSTGRES_URL`) so local work doesn't touch
production.

## 9. Caching, security and photos

Nothing to switch on here: the code already does all of this. It is written down so the site's
behaviour is no surprise.

- **Public pages are cached for about a minute.** Vercel's CDN keeps each public page (and
  `/rss.xml` and `/sitemap.xml`) for 60 seconds and serves it without running the site's code
  or the database. After that, it may serve the old copy once more while it fetches a new one
  (for up to 10 minutes). So a change saved in the admin panel shows on the site within about
  a minute; reload once more if it hasn't. A new deployment starts with an empty cache. The
  admin panel, sign in and the About page (its contact form needs a fresh copy for each
  visitor) are never cached.
- **Content-Security-Policy.** The site tells browsers where a page may load things from.
  Scripts, styles and fonts come only from the site itself. Posts can show images, videos and
  3D models from any `https://` address. The only embedded players allowed are YouTube and
  Vimeo. Embedding any other player (or loading an outside script or font) needs a code change
  in `vite.config.ts` (see the README); editors can't add one from the admin panel. Vercel's
  comment toolbar on previews is blocked by the same rule, which does no harm.
- **Uploaded photos are resized by Vercel** (Image Optimization) to the size each page needs.
  Only photos in this project's `media` bucket are resized, at one quality, so nobody else can
  bill their images to the club's account. The project is read from `SUPABASE_URL` while the
  site is built; without it, photos load at full size.
- **Site photos** in `static/images/archive` and `static/images/people` come with smaller
  copies made by a script (see the README). They don't go through Vercel.
- **Sign in and the contact form have rate limits** (Supabase guide, step 5.3, and the
  README). They are counted in the database, so they hold across all of Vercel's servers.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `/api/health` says `"database":"error"` | Check `POSTGRES_URL` (or `DATABASE_URL`) exists for that environment, uses the pooler host on port 6543, and redeploy. |
| Sign in on a preview lands on production | Add the preview wildcard to Supabase Redirect URLs (step 6). |
| "Uploads are not set up yet" | `SUPABASE_URL` or `SUPABASE_SECRET_KEY` is missing for that environment. Redeploy after adding it. |
| The sign in page says "Sign in is not set up yet" | `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` is missing for that environment. Add it and redeploy. |
| A saved change doesn't show on the site | Public pages are cached for about a minute (step 9). Wait a minute and reload, twice if needed. |
| Uploaded photos load at full size, not resized | `SUPABASE_URL` was missing when the site was built (step 9). Check it exists for that environment and redeploy. |
| The browser console shows "Content-Security-Policy" errors | Something tried to load from a host the site doesn't allow (step 9). On previews, errors for `vercel.live` come from the Vercel toolbar and are harmless. |
| Visitors say the contact form refused their message ("You have sent a lot of messages in a short time" or "We are getting a lot of messages right now") | The contact form's rate limits (README, "Rate limits"). They clear within 10 minutes to an hour; a day for 20 messages from one email address. |
| Build log warns about Node 26 | Expected (see Node.js above). |
| Pages are slow | Make sure the function region is Singapore (step 3) and Supabase is in Singapore. |
