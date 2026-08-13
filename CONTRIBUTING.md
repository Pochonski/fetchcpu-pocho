# Contributing to FetchCPU-Pocho

Thanks for the interest! FetchCPU-Pocho is a small, dependency-free teaching
simulator for the classic Von Neumann architecture.

## Local setup

```bash
git clone <your-fork-url>
cd fetchcpu-pocho
npm install
npm start                 # http://localhost:8000
npm test                  # 382 tests across 43 suites
npm run lint              # ESLint over js/ and tests/
npm run audit:i18n        # validates every key exists in EN + ES
npm run test:coverage     # v8 coverage report (text + html)
```

## Workflow

1. Open an issue describing the change (bug, idea, or proposal).
2. Fork the repo and create a feature branch: `git checkout -b feature/<short-slug>`.
3. Make focused commits: `git commit -m "<what and why>"`.
4. **Add or update tests** for any behavior change. The smoke tests in
   `tests/smoke.test.js` already cover the main user flows via jsdom.
5. Run the full suite and the linter:

   ```bash
   npm test
   npm run lint
   ```

6. Push and open a Pull Request against `main`. Describe the change and link
   any related issue.

## Style

- Plain ES modules, no bundler, no transpilation.
- Vanilla DOM — no React, no Vue, no jQuery.
- Public modules live under `js/`, view layer under `js/ui/`, CPU model under
  `js/cpu/`, examples under `js/programs/`.
- CSS lives under `css/`. The stylesheet bundle `css/components.css` is a
  thin facade that `@import`s per-concern files under `css/components/`
  (panel, buttons, forms, editor, cpu, ram, stats, log, modal, utilities).
- 2-space indentation, single quotes, no trailing commas in object literals,
  semicolons avoided inside arrow function bodies when one expression.
- **If you modify anything under `js/` or `css/`, bump the `?v=` query string
  in `index.html`** (`js/main.js?v=X.Y.Z` and the favicon URLs). Vercel
  serves `.js` / `.css` with `Cache-Control: public, max-age=31536000,
  immutable`, so without the bump the browser keeps loading the previous
  build for a year.
- **The `?v=` counter is intentionally independent of `package.json`
  `version`.** Hot-fixes or mid-release changes can bump `?v=` without
  publishing a new release. The About modal shows `package.json`'s value;
  the `?v=` (and the favicons) can run ahead. Don't try to keep them in
  lockstep.

## Internationalization (i18n)

If you're adding or updating UI strings:

- Edit **both** `en` and `es` trees in `js/ui/i18n/dictionaries.js`.
- Use dotted keys: `panels.cpu.registers.pc`, `log.halted`, etc.
- For HTML-bearing strings (links, `<strong>`, …) use `data-i18n-html`.
- For attribute translations use `data-i18n-attr="title:key;aria-label:key"`.
- For dynamic text use `t("key", [arg0, arg1, arg2])`.
- Missing keys log a warning and fall back to the key string — visible at
  runtime as `some.missing.key`, which is the desired DX.

## Thank you

This project exists because clear, animated simulators are one of the best
ways to teach low-level computing. If you find a way to make it clearer,
please send a PR.

