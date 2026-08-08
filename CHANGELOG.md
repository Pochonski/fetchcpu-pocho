# Changelog

All notable changes to FetchCPU-Pocho will be documented in this file. Versions
follow [SemVer](https://semver.org/). Dates are in ISO 8601.

## [1.1.0] — 2026-08-08

### Rebrand: Pocho LMC → FetchCPU-Pocho

The project is now branded as **FetchCPU-Pocho**, an independent teaching
simulator for the classic Von Neumann architecture. All "Little Man Computer"
attribution and the 101computing.net comparison have been removed.

- **Renames** — `js/lmc/` → `js/cpu/`, `.lmc` → `.fcpu`, all localStorage keys,
  URL hash prefix (`#fcpu=…`), Vercel project (`fetchcpu-simulator`) and the
  production alias (`fetchcpu-pocho.vercel.app`).
- **Removed** — `COMPARISON.md` (was specific to 101computing.net), the
  Madnick/101computing credits in the About modal, and the redirect from
  `/LMC` to `/`.
- **Updated** — README, CONTRIBUTING, LICENSE, i18n dictionaries (EN+ES),
  package.json, sitemap, robots.txt, all meta tags in `index.html`.

### The first public release — [1.0.0] — 2026-08-07

FetchCPU-Pocho ships as a complete, dependency-free, bilingual CPU
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

### Added (1.0.0)

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
  - Production URL: https://fetchcpu-pocho.vercel.app
  - GitHub repo: https://github.com/Pochonski/fetchcpu-pocho

- **Docs**
  - `README.md` — installation, usage, architecture, i18n guide.
  - `CONTRIBUTING.md` — workflow, style, i18n contribution notes.
  - `LICENSE` — MIT.

## Unreleased

### Input slots: shaped to the program

The Input panel is no longer a free-form textarea. After the parser runs,
the panel renders **one `<input type="number">` per top-level `INP`** of the
loaded program (labelled `#1`, `#2`, …). When `INP` is detected inside a
backward branch the panel collapses to a single slot with an **`∞` badge**
and a **+ Add value** button so the user can stage one value per iteration.

- `js/ui/ioSlots.js` is a new module exporting `createInputSlots(container,
  { t, addButton, onChange })` with `setCount`, `setValues`, `getValues`,
  `addSlot`, `isValid`, `firstInvalid` and `rangeMin/Max` accessors.
- `js/main.js` learns `countInps(instructions)` (detects loops via
  backward `BRA`/`BRP`/`BRZ` branches) and resizes the slots on every
  `loadProgram()`.
- Share URLs, `.fcpu` files and `localStorage["fetchcpu-input"]` keep
  using plain text under the hood — the slots UI is a typed view of the
  same queue, so existing programs and saved state stay compatible.

### 3-digit LMC range validation

- Each input slot is bounded to the LMC's nine's-complement signed range
  (`-499` to `+500`) via `min` / `max` / `maxlength` attributes plus a
  `setValidity()` hook that toggles `.io-slot-input--invalid` (red border
  + tinted background).
- `guardInputRange()` in `main.js` blocks `Run`, `Run to halt` and `Step`
  while any slot holds an out-of-range value; the first invalid slot is
  focused and a localised error (`panels.cpu.inputOutOfRange`) is pushed
  to the live feed.
- Empty slots are valid (they are simply skipped by `readInput`).
- New i18n keys (EN+ES): `panels.cpu.inputAddValue`,
  `panels.cpu.inputLoopHint`, `panels.cpu.inputOutOfRange`,
  `panels.cpu.inputBlockedRange`.

### i18n audit improvements

- `scripts/audit-i18n.mjs` now recognises `tFn(...)` calls (used by the
  executor's per-cycle explanations) and `["dotted.key"]` bracket-access
  references (used by the parser's EN-fallback object). After the
  rebrand this reports **0 missing keys and 0 unreferenced keys**.
- Two truly dead keys were removed (`panels.cpu.inputPlaceholder`,
  `panels.cpu.restartLabel`).

### Bug fix: rich live-feed diffs

- The rich live feed (added in 520aa2f) silently never rendered any
  register diffs because `regDiff` was indexing `prev` with UPPERCASE
  names (`"PC"`, `"ACC"`) against a `prev` literal that uses lowercase
  keys (`{pc:0, acc:0, ...}`). `regDiff` now lower-cases the lookup so
  every cycle row shows `old → new` strikethroughs as designed.
- The "tick" event subscriber in `main.js` was never wired to
  `logger.onCycle(cpu, info)`, so the rich feed rendered nothing. Now
  every FDE cycle produces a structured row with cycle counter, phase
  badge, mnemonic (colour-coded by category), register diffs, active
  flag and a human-readable note.

### Documentation

- `README.md` rewritten end-to-end: 173 tests reflected, every test suite
  listed, project structure and architecture notes updated, Input slots
  section now documents the range validation, Responsive section
  references the 7 breakpoint tokens, Deployment section added.

### UI simplification

- **CPU play controls** — only two buttons remain in the play strip:
  Run/Pause toggle (F5) and Step (F9). The rewind (F8), step-phase (F10)
  and run-to-halt (⇧F5) buttons are removed from the UI but their keyboard
  shortcuts remain active for power users.

### Restart button + SVG icon system

- **Restart button** — a third `↻` button is added to the play strip (next
  to Run/Pause and Step). Clicking it pauses any running execution,
  reloads the program currently in the editor from scratch, and resets the
  CPU, RAM, IO, stats and log. A new `F4` keyboard shortcut does the same.
- **SVG icon system** — every header / control button now uses a 24×24
  inline SVG that picks up its colour from `currentColor`. The previous
  unicode glyphs (`▶`, `▸`, `↗`, `☀`, `♪`, `⋯`, `+`, `−`) are replaced
  with crisp vectors that stay sharp at any pixel density and colour
  correctly in both themes. The play/pause button now swaps its SVG path
  between a play triangle and two pause bars instead of mutating text.

### Full responsive overhaul (mobile / iPad / desktop)

- **Mobile-first layout** — the layout grid, header and every component now
  adapt to viewport widths from 360 px (iPhone SE) to 1480 px desktop via a
  five-step breakpoint scale declared in `css/tokens.css`
  (`--bp-xs / --bp-sm / --bp-md / --bp-tablet / --bp-lg / --bp-xl / --bp-2xl`).
- **Hamburger bottom-sheet menu** — the three text-only header actions
  (Tutorial / Instruction Set / About) collapse into a `⋯` button on
  viewports < 640 px and open a translated, ARIA-correct bottom sheet
  implemented in `js/ui/mobileMenu.js`.
- **Touch targets ≥ 44 px** — every `.btn` and `.icon-btn` enforces the
  Apple HIG minimum via `@media (hover: none) { min-height: var(--tap-min) }`.
  The press-down animation and hover-only visual feedback are disabled on
  touch; `:active` and `:focus-visible` replace them.
- **iOS safe areas** — `env(safe-area-inset-*)` insets the sticky header,
  footer and modals so the simulator never sits under the notch, Dynamic
  Island or home indicator.
- **Per-component polish** — the CPU chip collapses to one column under
  420 px; the FDE flow stacks vertically under 480 px; the editor gets a
  taller 0.9375 rem caret on phones; the IO panels and Examples strip
  stack; RAM cells drop the address badge and label under 360 px to stay
  legible on iPhone SE; tabs scroll horizontally with snap; modals go
  full-screen under 480 px; touch-device hover effects are suppressed.
- **Accessibility & meta** — `viewport-fit=cover`, `interactive-widget=resizes-content`,
  `color-scheme: light dark`, and per-scheme `theme-color` meta tags.
  `-webkit-tap-highlight-color: transparent` on interactive elements and
  `-webkit-overflow-scrolling: touch` on scroll surfaces.
- **Tests** — new `tests/responsive.test.js` asserts the meta tags, the
  presence of the breakpoint scale, the safe-area custom properties, the
  44 px tap minimum, and the key responsive rules (`(hover: none)`,
  `max-width: 360px`, etc.).

[1.1.0]: https://github.com/Pochonski/fetchcpu-pocho/releases/tag/v1.1.0
[1.0.0]: https://github.com/Pochonski/fetchcpu-pocho/releases/tag/v1.0.0
