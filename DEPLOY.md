# Deploy notes

Production: **https://pocho-lmc.vercel.app**

This repo uses **Vercel** for static hosting and **GitHub autodeploy on push
to `main`**.

## First-time setup (already done on this repo)

1. Created the Vercel project (`lmc-simulator`) via `vercel deploy --name pocho-lmc`.
2. Linked the GitHub repo `Pochonski/pocho-lmc` via `vercel git connect`.
3. Aliased `pocho-lmc.vercel.app` to the canonical production deployment.

## How autodeploys work today

After `git push origin main`:

1. GitHub sends a `push` webhook to Vercel.
2. Vercel detects the change and runs `Build` for the project.
3. A new **Production** deployment is created at
   `https://lmc-simulator-<hash>-pochonskis-projects.vercel.app`.
4. **Vercel does not always auto-aliase** the new deployment to
   `pocho-lmc.vercel.app`. With `framework: null` static-site configs, this
   happens 100% of the time on this project, but as a safety net the
   `scripts/promote.sh` helper script can be run manually.

## promote.sh

```bash
./scripts/promote.sh   # alias the latest Ready deployment to pocho-lmc.vercel.app
```

This script:

1. Reads the most recent **Ready** deployment from `vercel ls`.
2. Promotes it and re-aliasses `pocho-lmc.vercel.app` to it.

Useful as a one-shot or as a GitHub Action (see `.github/workflows/promote.yml`).

## Optional: enable auto-promotion in the Vercel dashboard

For zero-touch deployments, in the Vercel dashboard:

1. Go to the **`lmc-simulator`** project → **Settings** → **Git**.
2. Set **Production Branch** to `main`.
3. Enable **Automatically alias to the production domain** under **Deployment domains**.
4. (Optional) Add a **Deploy Hook** URL in **Settings** → **Git** → **Deploy Hooks**
   and point a GitHub workflow to call it on `push` for explicit control.

## Health checks (after each deploy)

```bash
curl -sS https://pocho-lmc.vercel.app/ | grep -oE '<title>[^<]+</title>'
curl -sS -I https://pocho-lmc.vercel.app | grep -iE 'content-security-policy|strict-transport-security|x-frame-options'
curl -sS https://pocho-lmc.vercel.app/robots.txt
curl -sS https://pocho-lmc.vercel.app/sitemap.xml | head -c 200
```

All four pass on the current build.
