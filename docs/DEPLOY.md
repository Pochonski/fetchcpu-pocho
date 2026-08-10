# Deploy notes

Production: **https://fetchcpu-pocho.vercel.app**

This repo uses **Vercel** for static hosting and **GitHub autodeploy on push
to `main`**.

## First-time setup (already done on this repo)

1. Created the Vercel project (`fetchcpu-simulator`) via `vercel deploy --name fetchcpu-pocho`.
2. Linked the GitHub repo `Pochonski/fetchcpu-pocho` via `vercel git connect`.
3. Aliased `fetchcpu-pocho.vercel.app` to the canonical production deployment.

## How autodeploys work today

After `git push origin main`:

1. GitHub sends a `push` webhook to Vercel.
2. Vercel detects the change and runs `Build` for the project.
3. A new **Production** deployment is created at
   `https://fetchcpu-simulator-<hash>-pochonskis-projects.vercel.app`.
4. **Vercel does not always auto-aliase** the new deployment to
   `fetchcpu-pocho.vercel.app`. With `framework: null` static-site configs, this
   happens 100% of the time on this project, but as a safety net the
   `scripts/promote.sh` helper script can be run manually.

## promote.sh

```bash
./scripts/promote.sh   # alias the latest Ready deployment to fetchcpu-pocho.vercel.app
```

This script:

1. Reads the most recent **Ready** deployment from `vercel ls`.
2. Promotes it and re-aliasses `fetchcpu-pocho.vercel.app` to it.

Useful as a one-shot or as a GitHub Action (see `.github/workflows/promote.yml`).

## Optional: enable auto-promotion in the Vercel dashboard

For zero-touch deployments, in the Vercel dashboard:

1. Go to the **`fetchcpu-simulator`** project → **Settings** → **Git**.
2. Set **Production Branch** to `main`.
3. Enable **Automatically alias to the production domain** under **Deployment domains**.
4. (Optional) Add a **Deploy Hook** URL in **Settings** → **Git** → **Deploy Hooks**
   and point a GitHub workflow to call it on `push` for explicit control.

## Health checks (after each deploy)

```bash
curl -sS https://fetchcpu-pocho.vercel.app/ | grep -oE '<title>[^<]+</title>'
curl -sS -I https://fetchcpu-pocho.vercel.app | grep -iE 'content-security-policy|strict-transport-security|x-frame-options'
curl -sS https://fetchcpu-pocho.vercel.app/robots.txt
curl -sS https://fetchcpu-pocho.vercel.app/sitemap.xml | head -c 200
```

## Cache headers + browser cache-busting

`vercel.json` sets `Cache-Control: public, max-age=31536000, immutable` on
every `.js` / `.css` / `.svg` response. That is correct for cache lifetime
but means **the browser keeps loading the previous build for a full year**
unless the URL itself changes.

The `index.html` `<script>` tag therefore carries a version query string:

```html
<script type="module" src="js/main.js?v=1.1.2"></script>
```

**Whenever you ship a change to anything under `js/` or `css/`, bump the
`?v=` value in `index.html`.** Any browser that already has the old URL
cached will fetch the new one because the URL is now different. Without
the bump, users stuck on a previous version will report "the bug is still
there" — and they will be right, because they are still running the old
build.

## Known issue: GitHub autodeploys land as Preview-only on this project

When a push to `main` triggers an autodeploy via the GitHub integration, the
resulting deployments are stuck at `UNKNOWN` (Preview environment) and the
alias does **not** auto-update. Public URLs from these deploys return HTTP
302 to a Vercel SSO wall.

Two fixes — pick one:

**A.** Project → Settings → **Security** → turn off **Vercel Authentication**
   for production deployments. After that, autodeploys become `● Ready`
   and the alias updates automatically on every push to `main`.

**B.** Keep deployment protection on. After each push, run
   `bash scripts/promote.sh` locally — it picks the latest successful
   build and aliases `fetchcpu-pocho.vercel.app` to it. This workflow is what
   the docs above describe.

The CI workflow in `.github/workflows/promote.yml` makes option **B**
zero-touch on CI; it needs a `VERCEL_TOKEN` secret in the GitHub repo
settings to authenticate against the Vercel API.

