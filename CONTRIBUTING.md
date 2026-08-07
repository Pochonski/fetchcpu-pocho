# Contributing to Pocho LMC

Thanks for the interest! Pocho LMC is a small, dependency-free teaching
simulator for the Little Man Computer architecture.

## Local setup

```bash
git clone <your-fork-url>
cd pocho-lmc
npm install
npm start                 # http://localhost:8000
npm test                  # 65+ tests
npm run lint
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
  `js/lmc/`, examples under `js/programs/`.
- 2-space indentation, single quotes, no trailing commas in object literals,
  semicolons avoided inside arrow function bodies when one expression.

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
