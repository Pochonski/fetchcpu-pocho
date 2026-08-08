# Changelog

All notable changes to Pocho LMC will be documented in this file. Versions
follow [SemVer](https://semver.org/). Dates are in ISO 8601.

## [1.0.0] — 2026-08-07

### The first public release

Pocho LMC ships as a complete, dependency-free, bilingual Little Man Computer
simulator designed for teaching the Fetch/Decode/Execute cycle.

### Production-readiness pass (2026-08-08)

- **Behaviour** — `INP` no longer leaves the executor stuck when input runs
  out: a dedicated `EndOfInputError` is caught in the run loop and the
  executor halts cleanly with a friendly log entry. The parser rejects
  programs that exceed the 100-cell RAM. The audit-i18n script now
  recognises template-literal references and dynamic property access.
- **Accessibility** — modals close on `Escape`, trap focus, and restore
  focus to the opener. A `prefers-reduced-motion` media query disables
  animations for users who request it.
- **Security** — the CSP no longer allows `unsafe-inline` for styles or
  `connect-src` to `api.github.com`. The deprecated `escape`/`unescape`
  pair in the share encoder was replaced with `TextEncoder`/`TextDecoder`.
- **i18n** — `flashShare`, the theme toggle, and the pause/run button
  now use the i18n dictionary. The `log.parseError` and `log.outOfMemory`
  keys are now wired in. ~17 unused keys were removed.
- **Repo** — `.env.local` (containing an expired Vercel OIDC token) was
  removed from disk.

### Added

- **CPU model**
  - Full FDE cycle (`executor.step()`) with detailed phase bookkeeping.
  - Registers PC, CIR, MAR, MDR, ACC with diff indicators.
  - Indirect addressing (`@`) supported at runtime via a per-instruction
    indirect-address set populated by the loader.
  - Immediate addressing (`#`) resolved by the loader through pre-allocated
    data cells.
  - Step-back through a snapshot history with full CPU + RAM + IO rollback.
  - Capped nine's-complement semantics for the accumulator.

- **UI**
  - Three-pane responsive grid (Editor / CPU / RAM + Activity) with activity
    tabs.
  - Light and dark themes, persisted in localStorage.
  - English and Spanish UI via a tiny i18n module (`js/ui/i18n`) and
    data-`i18n*` attributes on the DOM.
  - Memory-access strip showing `READ`/`WRITE` with address and value.
  - 10×10 RAM grid with mnemonic badges, label display, click-to-edit,
    PC/MAR highlighting and modified-cell flash.
  - 100-cell memory map overview above the grid.
  - FDE flow visualizer with three phase indicators.
  - Disassembler showing the current and next instruction with operand.
  - Bus indicators that flash on each CPU read/write.
  - DDE history timeline (last 50 cycles, click to rewind).
  - Statistics panel (cycles, branches, reads, writes, runtime, per-opcode
    counts).
  - Live feed log + downloadable `.txt` transcript.
  - Step forward (`F9`), step back (`F8`), run (`F5`), fast-forward
    (`Shift+F5`), pause (`F6`).
  - Breakpoints via gutter click.
  - Clock slider with `−`/`+` adjusters, live update while running, and
    a slow default (500 ms) so each cycle is clearly visible.

- **Tooling & quality**
  - 65+ tests (parser, executor, integration, clock, memory-access, i18n,
    share/fileio, stats/events, smoke).
  - ESLint flat config (`eslint.config.js`) — zero warnings.
  - Vitest with `jsdom` environment for UI smoke tests.
  - 12 example programs covering direct, immediate and indirect
    addressing; one with each of `INP`/`STA`/`LDA`/`BRP`/`DAT` patterns.

- **Deployment**
  - Vanilla ES modules — no bundler, no transpilation.
  - `vite`-free Node.js static server (`scripts/serve.mjs`).
  - Vercel configuration with security headers, CSP, cache controls and
    autodeploy on push to `main`.
  - Production URL: https://pocho-lmc.vercel.app
  - GitHub repo: https://github.com/Pochonski/pocho-lmc

- **Docs**
  - `README.md` — installation, usage, architecture, i18n guide.
  - `CONTRIBUTING.md` — workflow, style, i18n contribution notes.
  - `COMPARISON.md` — diff vs the 101computing.net/LMC reference.
  - `LICENSE` — MIT.

[1.0.0]: https://github.com/Pochonski/pocho-lmc/releases/tag/v1.0.0

## Unreleased

### UI simplification

- **CPU play controls** — only two buttons remain in the play strip:
  Run/Pause toggle (F5) and Step (F9). The rewind (F8), step-phase (F10)
  and run-to-halt (⇧F5) buttons are removed from the UI but their keyboard
  shortcuts remain active for power users.


