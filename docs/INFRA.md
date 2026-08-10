# Infrastructure documentation

This document describes every moving part of the project that lives
outside the application code: static server, deployment, CI, security
headers, build/test/lint scripts, and local-storage conventions.

> **Audience:** anyone debugging a failed deploy, extending CI, or
> onboarded as a new maintainer. If you only care about the simulator
> itself, see [`README.md`](../README.md) and
> [`CHANGELOG.md`](../CHANGELOG.md).

---

## Table of contents

1. [Topology](#topology)
2. [Local development](#local-development)
3. [npm scripts](#npm-scripts)
4. [Static server (`scripts/serve.mjs`)](#static-server-scriptsservemjs)
5. [i18n audit (`scripts/audit-i18n.mjs`)](#i18n-audit-scriptsaudit-i18nmjs)
6. [Promotion workflow](#promotion-workflow)
   - [`scripts/promote.sh`](#scripts-promotesh)
   - [`.github/workflows/promote.yml`](#githubworkflowspromoteyml)
7. [Vercel](#vercel)
   - [`vercel.json`](#verceljson)
   - [`.vercelignore`](#vercelignore)
   - [Deploy hooks](#deploy-hooks)
8. [Security headers](#security-headers)
9. [Test infrastructure](#test-infrastructure)
   - [`vitest.config.js`](#vitestconfigjs)
   - [`tests/` directory layout](#tests-directory-layout)
10. [Lint infrastructure](#lint-infrastructure)
11. [Persistence keys](#persistence-keys)
12. [Environment variables](#environment-variables)
13. [File layout at a glance](#file-layout-at-a-glance)

---

## Topology

```
┌────────────────────────────────────────────────────────────────────┐
│                         GitHub repo                                │
│  Pochonski/fetchcpu-pocho  (private for now)                       │
│                                                                    │
│  push to main ────┬────────────────────────────┐                  │
│                   │                            │                  │
│                   ▼                            ▼                  │
│   ┌──────────────────────────┐   ┌────────────────────────────┐   │
│   │ .github/workflows/       │   │ Vercel GitHub integration  │   │
│   │ promote.yml              │   │ (webhook)                 │   │
│   │ (vercel alias + smoke)   │   │                           │   │
│   └──────────────┬───────────┘   └──────────────┬────────────┘   │
│                  │                              │                │
│                  ▼                              ▼                │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │                    Vercel platform                       │   │
│   │   project: fetchcpu-simulator                           │   │
│   │   domain: fetchcpu-pocho.vercel.app (canonical)         │   │
│   │   legacy aliases: pocho-lmc.vercel.app,                │   │
│   │                    lmc-simulator.vercel.app (301)        │   │
│   │   headers: HSTS, CSP, X-Frame-Options, Permissions-Policy│   │
│   │   cache: immutable for JS/CSS/SVG, no-cache for index.html│   │
│   └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

Static, no server-side runtime. Every endpoint is a file under `js/`,
`css/`, or `assets/`.

---

## Local development

Requires **Node 20+** (`.nvmrc` pins the major version). Tests run on
Node, the browser is exercised via `jsdom`.

```bash
git clone https://github.com/Pochonski/fetchcpu-pocho.git
cd fetchcpu-pocho
npm install              # only needed for tests, lint, audit
npm start                # http://127.0.0.1:8000

# Quality gates
npm test                 # 310 tests, 35 suites
npm run lint             # eslint js/ tests/
npm run audit:i18n       # EN/ES parity + missing references
npm run test:coverage    # v8 coverage (text + html)
```

The first three commands are safe to run in parallel. **Always run lint
+ tests + audit before pushing.**

---

## npm scripts

All scripts are defined in `package.json` and run on the local Node 20
toolchain.

| Script | Command | Purpose |
|---|---|---|
| `npm start` | `npm run serve` | Convenience alias for the static server. |
| `npm run serve` | `node scripts/serve.mjs` | Bind `127.0.0.1:8000` and serve the repo root. |
| `npm test` | `vitest run` | One-shot test run. |
| `npm run test:watch` | `vitest` | Vitest watch mode (re-runs on file change). |
| `npm run test:coverage` | `vitest run --coverage` | Vitest + v8 coverage, emits `coverage/` (text + html). |
| `npm run lint` | `eslint js tests` | ESLint flat config over `js/` and `tests/`. |
| `npm run audit:i18n` | `node scripts/audit-i18n.mjs` | Static check that every i18n key exists in both EN and ES. |

### `engines` and `volta` pins

`package.json` declares `"node": ">=20"` and `.nvmrc` pins Node 20.
There is no `packageManager` pin; CI installs whatever `npm install`
resolves, which is `npm@10.x` on Node 20.

---

## Static server (`scripts/serve.mjs`)

A ~60-line dependency-free Node HTTP server meant to replace
`python3 -m http.server` for local development. Bind only to `127.0.0.1`
so it cannot accidentally expose the workspace to a LAN.

### Usage

```bash
npm run serve                       # default port 8000
PORT=3000 npm run serve              # override
```

The server reads the request URL, strips the query string, runs
`decodeURIComponent` (in a `try/catch` — malformed URLs return `400
Bad Request`), rewrites `/` to `/index.html`, resolves the path with
`path.join(ROOT, urlPath)`, and rejects any resolved path that escapes
`ROOT` via `path.relative` (defends against symlink-style
`%2e%2e/root-evil` traversal).

### MIME table

`.html`, `.js`, `.mjs`, `.css`, `.svg`, `.json`, `.txt`, `.md`,
`.fcpu` (the project-specific file extension). Anything else is served
as `application/octet-stream`.

### Headers

Sets `Cache-Control: no-store` on every response so local iterations
always see the latest source. Production uses Vercel's immutable cache
(see [Vercel](#vercel)).

### Limitations vs. Vercel

- No security headers (CSP, HSTS). Local dev makes no guarantees.
- No immutable cache. Vercel sets `max-age=31536000, immutable` for
  fingerprinted assets.
- No redirects. The hash-router (`#fcpu=…`) does not need any, and the
  static `vercel.json` redirects are not required for local hosting.

If you need a closer parity, run `vercel dev` instead.

---

## i18n audit (`scripts/audit-i18n.mjs`)

A static analyser that walks `index.html` and every file under `js/` to
verify two invariants:

1. **Every referenced key resolves.** All `data-i18n*` attributes,
   `t(...)`, `tFn(...)`, `error(...)`, `readArray(...)`, and `["…"]`
   bracket-access references must point to a path that exists in at
   least one of the dictionaries.
2. **EN and ES parity.** Every leaf defined in `en` must also exist in
   `es`, and vice versa. This was a silent gap in the previous version
   of the audit.

### Recognition patterns

| Pattern | Notes |
|---|---|
| `data-i18n[-…]="key"` | HTML, `.html`, `.js`. |
| `data-i18n-attr="title:key;aria-label:key"` | Comma **or** semicolon separated. |
| `t("key")`, `t('key')`, `` t(`key`) `` | Static first argument. |
| `tFn("key")` | Parser emits translated explanations; treated identically to `t`. |
| `error("key", ...)` | Parser emits error keys; the UI resolves them later. |
| `["a.b.c"]` | Bracket access on the EN/ES fallback objects in `parser.js`. |
| `readArray("path.to.array")` | Reads arrays/objects from dictionaries. |
| `` t(`prefix.${x}`).prop `` | Adds every leaf matching `prefix.*.prop` from the dictionary. |
| `` t(`prefix.${x}`) `` | Adds every leaf under `prefix.*`. |

### Output

```
### Missing references (referenced but not in dictionary)
  (none — all references resolve ✓ — 4 template-literal suffix ignored)

### EN / ES parity (leaves defined in only one dictionary)
  (parity ✓ — every leaf exists in both EN and ES)

### Defined but never referenced
  0 keys (kept for future use)
```

Exit status: **0** if every check passes, **1** otherwise. Any parity
gap or missing reference fails the CI gate.

### When the audit misfires

- **`template-literal suffix ignored`** — the legacy `t(\`a.${x}\`)` form
  with no projection is ambiguous. The audit forces expansion under
  the static prefix; ignore the count if the closure covers it.
- **`SKIP_REFS = new Set(["key"])`** — internal placeholder used in
  docstrings. Honoured but never removes your real keys.

### Extending the audit

If you add a new translation call shape (e.g. `tr("key")`), add a new
regex block in the matching numbered section. The structure is
deliberately linear so each new pattern is a 5-line section.

---

## Promotion workflow

Pushes to `main` create a Vercel deployment via the Vercel GitHub
integration, but **Vercel does not always re-alias `fetchcpu-pocho.vercel.app`
to the new deployment**. Two paths exist to make the alias match the
deploy:

### `scripts/promote.sh`

A 36-line shell script that:

1. Lists the 10 most recent deployments of `fetchcpu-simulator`.
2. Picks the first URL that matches `https://<slug>-pochonskis-projects.vercel.app`
   **and** contains `● … Ready`.
3. Exits 1 if no Ready deployment is found.
4. Runs `vercel alias set <url> fetchcpu-pocho.vercel.app`.
5. Smoke-tests the alias with `curl --fail` (any non-2xx returns exit 1).

Environment variables:

| Var | Default | Purpose |
|---|---|---|
| `VERCEL_PROJECT` | `fetchcpu-simulator` | The Vercel project to list. |
| `VERCEL_ALIAS` | `fetchcpu-pocho.vercel.app` | The canonical production domain. |

Usage:

```bash
# Local one-shot (requires `vercel` CLI authenticated globally)
./scripts/promote.sh
```

Set `set -euo pipefail` at the top so any failure aborts.

### `.github/workflows/promote.yml`

Mirrors the shell script but runs after every push to `main`. Requires
the `VERCEL_TOKEN` secret (Settings → Secrets and variables →
Actions). When the secret is missing, the workflow logs a warning and
exits 0 so the push green-lights even without auto-promote.

| Trigger | `push` to `main` |
| Timeout | 5 minutes |
| Image | `ubuntu-latest` |
| Required secret | `VERCEL_TOKEN` |

Steps:

1. Install the latest `vercel` CLI locally.
2. `vercel login` with the team scope.
3. `vercel ls fetchcpu-simulator --limit 10`, filter for `Ready`, take
   the first URL.
4. `vercel alias set <url> fetchcpu-pocho.vercel.app`.
5. `curl --fail` against the canonical domain. If the smoke test
   fails, exit 1 to flag the deployment as broken.

The workflow intentionally matches the shell script's logic so manual
promotion and CI promotion stay in sync.

---

## Vercel

The project is hosted on Vercel as a static site. No build step
(`buildCommand: null`), no install step (`installCommand: echo "no
install — static site"`), and the repository root is the output
directory.

### `vercel.json`

| Section | Purpose |
|---|---|
| `cleanUrls: true` | `/foo` instead of `/foo.html`. |
| `trailingSlash: false` | Match GitHub-style URLs. |
| `headers[0]` (catch-all) | HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP — see [Security headers](#security-headers). |
| `headers[1]` (`(.*).js`) | `Cache-Control: public, max-age=31536000, immutable` for fingerprinted JS. |
| `headers[2]` (`(.*).css`) | Same, for CSS. |
| `headers[3]` (`(.*).svg`) | Same, for SVG. |
| `headers[4]` (`/index.html`) | `Cache-Control: no-cache, must-revalidate` so the entry point always re-validates. |
| `redirects[*]` | 301 redirects from `pocho-lmc.vercel.app` and `lmc-simulator.vercel.app` (legacy aliases) to the canonical domain. |

> **Cache-bust caveat:** because `.js` is served with
> `max-age=31536000, immutable`, the browser keeps the previous build for a
> full year unless the URL changes. `index.html` therefore references the
> main script as `js/main.js?v=<version>`; **bump the `?v=` value whenever
> you ship a change to anything under `js/` or `css/`**. See
> [`DEPLOY.md`](./DEPLOY.md) for the full note.

### `.vercelignore`

Excludes `node_modules/`, `.git/`, `.vscode/`, `.idea/`, `*.log`, and
`tests/` from the deployment bundle. The `tests/` exclusion keeps the
shipped artefacts small while still allowing every test to run in CI.

### Deploy hooks

The Vercel dashboard offers **Deploy Hooks** (Settings → Git → Deploy
Hooks). If you want explicit control over promotion per push, wire a
GitHub workflow to call the deploy-hook URL on `push`. The current
`.github/workflows/promote.yml` does not use this — it uses the Vercel
CLI directly because the alias step is the real goal.

---

## Security headers

Every production response carries the following headers (set in
`vercel.json`):

| Header | Value | Purpose |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Force HTTPS for 2 years. **No `preload`** — be conservative for `*.vercel.app` wildcards. |
| `X-Content-Type-Options` | `nosniff` | Block MIME sniffing. |
| `X-Frame-Options` | `DENY` | Disable iframe embedding. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | Disable sensors and FLoC. |
| `Content-Security-Policy` | See below | The strict CSP. |

### Content-Security-Policy

```
default-src 'self';
script-src 'self';
style-src 'self' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data:;
connect-src 'self';
media-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

Why each directive matters:

- **`default-src 'self'`** — every fetch by default is same-origin.
- **`script-src 'self'`** — no inline JS, no remote scripts. The whole
  app is ES modules loaded from `/js/`.
- **`style-src 'self' https://fonts.googleapis.com`** — Inter and
  JetBrains Mono come from Google Fonts. No inline `<style>` blocks.
- **`font-src 'self' https://fonts.gstatic.com data:`** — the actual
  font binaries. `data:` allows inline `data:` URIs as a fallback.
- **`img-src 'self' data:`** — SVG brand mark + inline data URIs only.
- **`connect-src 'self'`** — no `fetch`/`XHR` to external origins. The
  app is fully offline-capable.
- **`object-src 'none'`** — disables `<object>`, `<embed>`, `<applet>`.
- **`base-uri 'self'`** — `<base>` can only target same-origin.
- **`form-action 'self'`** — forms can only post to same-origin.
- **`frame-ancestors 'none'`** — complements `X-Frame-Options: DENY`.
- **`upgrade-insecure-requests`** — silently upgrades any accidental
  `http://` subrequests to `https://`.

Health check from any shell:

```bash
curl -sSI https://fetchcpu-pocho.vercel.app | grep -iE 'content-security|strict-transport|x-frame-options'
```

---

## Test infrastructure

### `vitest.config.js`

```js
{
  test: {
    include: "tests/**/*.test.js",
    environment: "node",                 // default; suites override with `// @vitest-environment jsdom`
    coverage: {
      provider: "v8",
      include: ["js/**/*.js"],
      exclude: ["js/**/index.js", "node_modules/**"],
      reporter: ["text", "html"],
    },
  },
}
```

The `exclude: ["js/**/index.js"]` line is intentional — the only file
in that glob is `js/ui/i18n/index.js`, which is a re-export module
exercised indirectly through consumers.

### `tests/` directory layout

30 suites organised by the module they cover:

| Category | Suites |
|---|---|
| CPU model | `parser`, `executor`, `step_phase`, `step_fresh_load`, `memory_access`, `cell_visual`, `clock`, `stats_events`, `ram_format`, `cpu_flag` |
| Program | `integration` |
| UI | `cpuView`, `disassemblerView` (inside `views_unit`), `historyView` (inside `views_unit`), `editor`, `ramView` (inside `cell_visual`), `ioSlots`, `io`, `tabs`, `modal`, `theme`, `mobileMenu`, `statsView`, `sound`, `logger` (inside `live_feed`), `share_fileio`, `share_fileio_extra` |
| End-to-end | `smoke`, `play_buttons`, `live_feed`, `instruction_explanation`, `responsive` |
| Tooling | `audit_parity`, `editor_destroy` |

Coverage by domain (v8):

| Domain | Statements | Branches |
|---|---|---|
| `js/cpu` | ~92% | ~86% |
| `js/programs` | 100% | 25% (only `getProgramMeta` is exercised) |
| `js/ui` | ~91% | ~82% |
| `js/ui/i18n` | 100% | 100% |

---

## Lint infrastructure

`eslint.config.js` is a flat config (ESLint 9) that:

- Targets `js/**/*.js` and `tests/**/*.js`.
- Uses `ecmaVersion: 2022` and `sourceType: "module"`.
- Enables both browser and Node globals (the codebase imports from
  both).
- Warns on `no-unused-vars` (ignoring arguments prefixed with `_`).
- Errors on `no-undef`.
- Warns on `prefer-const`.

`npm run lint` runs the flat config over both `js/` and `tests/`. The
package.json script (`eslint js tests`) is the single source of truth
here — directly running `eslint` without arguments defaults to
`eslint .` which would also lint `scripts/`, `docs/`, and the
`coverage/` output. If you add new top-level directories, update the
script.

---

## Persistence keys

The app stores two values in `localStorage` under the `fetchcpu.*`
namespace:

| Key | Read by | Written by | Purpose |
|---|---|---|---|
| `fetchcpu.source` | `main.js` boot | `editor.onChange`, `share decoder`, `importProgramFile` | The last program source. |
| `fetchcpu.input` | `io.loadFromShare`, `share decoder` | Slot value changes, `importProgramFile` | The IO queue. |
| `fetchcpu-theme` | `theme.js` boot | `theme.js` click | `dark` or `light`. |

If you add persistence, follow the same dotted-namespace convention.

---

## Environment variables

| Var | Where | Default | Purpose |
|---|---|---|---|
| `PORT` | `scripts/serve.mjs` | `8000` | Local server port. |
| `VERCEL_TOKEN` | GitHub Actions | _required_ | Vercel API token for the promote workflow. |
| `VERCEL_PROJECT` | `scripts/promote.sh` | `fetchcpu-simulator` | Vercel project name override. |
| `VERCEL_ALIAS` | `scripts/promote.sh` | `fetchcpu-pocho.vercel.app` | Production domain override. |

There is no runtime configuration for the simulator itself — every
deploy uses the same hard-coded production URL.

---

## File layout at a glance

```
fetchcpu-pocho/
├── index.html                  # entry point
├── README.md                   # user-facing docs
├── CHANGELOG.md                # version history
├── CONTRIBUTING.md             # dev workflow
├── docs/
│   ├── INFRA.md                # this file
│   └── DEPLOY.md               # Vercel + GitHub setup
├── LICENSE                     # MIT
│
├── assets/
│   └── brand-mark.svg
│
├── css/
│   ├── reset.css
│   ├── tokens.css              # design tokens (spacing, color, breakpoints)
│   ├── themes.css              # dark + light palettes
│   ├── layout.css              # responsive grid
│   └── components.css           # @import facade
│   └── components/             # split per concern
│       ├── panel.css
│       ├── buttons.css
│       ├── forms.css
│       ├── editor.css
│       ├── cpu.css
│       ├── ram.css
│       ├── stats.css
│       ├── log.css
│       ├── modal.css
│       └── utilities.css
│
├── js/
│   ├── main.js                 # boot orchestrator
│   ├── cpu/                    # CPU model (no DOM)
│   │   ├── opcodes.js          # ISA + disassemble()
│   │   ├── ram.js              # 100-cell RAM
│   │   ├── cpu.js              # PC/CIR/MAR/MDR/ACC + flag
│   │   ├── parser.js           # two-pass assembler
│   │   ├── executor.js         # FDE cycle, history, run loop
│   │   ├── events.js           # pub/sub
│   │   └── stats.js            # runtime metrics
│   ├── ui/                     # view layer (no business logic)
│   │   ├── inputShape.js       # countInps() — loop-aware INP count
│   │   ├── io.js               # IO queue + textarea bridge
│   │   ├── ioSlots.js          # typed <input> slots with range validation
│   │   ├── editor.js           # code editor with gutter + breakpoints
│   │   ├── cpuView.js, ramView.js, disassemblerView.js
│   │   ├── logger.js, statsView.js, historyView.js
│   │   ├── theme.js, sound.js, tabs.js, modal.js, mobileMenu.js
│   │   ├── share.js            # #fcpu=base64 URL hash
│   │   ├── fileIO.js           # .fcpu import / export
│   │   └── i18n/
│   │       ├── dictionaries.js
│   │       └── index.js
│   └── programs/
│       └── examples.js
│
├── scripts/
│   ├── serve.mjs               # local static server
│   ├── audit-i18n.mjs          # i18n static analyser
│   └── promote.sh              # one-shot Vercel promotion
│
├── tests/                      # 35 suites, 310 tests
│
├── .github/
│   └── workflows/
│       └── promote.yml
│
├── vercel.json                 # headers + redirects + cache
├── .vercelignore               # what Vercel skips
├── vitest.config.js
├── eslint.config.js
├── package.json
├── package-lock.json
├── .nvmrc                      # Node 20
├── .gitignore
├── robots.txt
└── sitemap.xml
```

---

## When something breaks

| Symptom | First check |
|---|---|
| `npm run serve` fails on macOS | `lsof -ti:8000 \| xargs kill -9` |
| `npm test` flakes with "localStorage not available" | The suite is missing `// @vitest-environment jsdom` at the top. |
| `npm run audit:i18n` fails on a key the user clearly translated | Check `data-i18n-attr` separating pairs with `,` or `;`. |
| `npm run lint` complains about `no-undef` for a browser global | The file is missing `// @vitest-environment jsdom` AND the global isn't in the lint config. |
| A `<bucket>-pochonskis-projects.vercel.app` URL returns 302 | Vercel auth is enabled. Either disable it for `main` or rely on `scripts/promote.sh`. |
| The canonical domain shows stale content | The promote step didn't run. Check `.github/workflows/promote.yml` for failures and re-run `scripts/promote.sh`. |
| `fetchcpu-pocho.vercel.app` serves the wrong assets (e.g. missing `logo.png` or a 13h-old `index.html`) | The alias points at a stale deployment. Re-alias with `bash scripts/promote.sh` locally (auth via `vercel login`). The script is idempotent: `vercel alias set` replaces the existing alias without leaving a 404 window. |

### Diagnosing a stale alias

```bash
# What is the canonical domain pointing at?
vercel alias ls
# Look for the row whose `url` column is `fetchcpu-pocho.vercel.app`
# and check the age in the `age` column.

# What are the most recent Ready deployments?
vercel ls fetchcpu-simulator --no-color --limit 5

# Verify the new assets are reachable on the canonical domain
curl -sSI https://fetchcpu-pocho.vercel.app/assets/logo.png
# → should be HTTP/2 200 with Content-Type: image/png.
# If 404, the alias is stale; re-run scripts/promote.sh.
```

### Manual re-aliasing

The canonical domain (`fetchcpu-pocho.vercel.app`) only re-aliases
to the latest deployment when either:

1. The `.github/workflows/promote.yml` workflow runs successfully
   (it has been wired and runs on every push to `main`), **and**
2. The `VERCEL_TOKEN` secret is configured in GitHub (Settings →
   Secrets and variables → Actions).

If the token is missing the workflow **fails loudly with exit 1**
(since the last refactor) so you notice the stale alias in CI
immediately. If that happens, the only thing left to do is run the
promote script locally with your authenticated `vercel` CLI:

```bash
bash scripts/promote.sh
# or, with overrides
VERCEL_PROJECT=fetchcpu-simulator \
VERCEL_ALIAS=fetchcpu-pocho.vercel.app \
  bash scripts/promote.sh
```

The script:

1. Lists the 10 most recent deployments.
2. Picks the first one matching `Ready`.
3. Calls `vercel alias set <url> <alias>` (idempotent — replaces
   the existing alias without a 404 window).
4. Smoke-tests the canonical domain with `curl --fail`.
5. Regression-guards against a stale alias by HEADing
   `assets/logo.png` — if the alias points at a pre-rebrand
   deployment, this fails and the script exits 1.

### Why a stale alias happens

Vercel creates a new preview URL (`<project>-<hash>-<team>.vercel.app`)
on every push to `main`, but it does **not** automatically re-alias
the canonical domain unless either:

- Vercel deployment protection is disabled (Settings → Security), in
  which case the alias updates automatically, or
- The `promote.yml` workflow successfully calls
  `vercel alias set` (requires `VERCEL_TOKEN`).

If the user only sees their changes on the preview URL (e.g.
`https://fetchcpu-simulator-e8h04mdd0-pochonskis-projects.vercel.app/`)
but not on the canonical URL (`https://fetchcpu-pocho.vercel.app/`),
that's the symptom of a stale alias. The fix is the manual
re-aliasing step above, or configuring `VERCEL_TOKEN` so the
workflow can do it automatically.

**Note on the redirect aliases**: the legacy domains
`pocho-lmc.vercel.app` and `lmc-simulator.vercel.app` have their
own 301 redirects in `vercel.json` and are not affected by the
alias state.

