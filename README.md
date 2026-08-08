# FetchCPU-Pocho

> **An interactive CPU simulator with Fetch / Decode / Execute cycle visualization, breakpoints, signed integers, immediate & indirect addressing, statistics, history timeline, and English/Spanish UI — built by Pocho.**

A modern, accessible, dependency-free teaching simulator for the classic
**Von Neumann** architecture. Designed to make every Fetch / Decode / Execute
cycle visible, every memory access inspectable, and every supported idiom
exercisable without leaving the browser.

---

## Table of contents

- [Live preview / running locally](#live-preview--running-locally)
- [Features](#features)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Quick example walkthrough](#quick-example-walkthrough)
- [Installation & development](#installation--development)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Architecture notes](#architecture-notes)
- [Localization (English / Spanish)](#localization-english--spanish)
- [Roadmap & ideas](#roadmap--ideas)
- [Credits](#credits)
- [License](#license)

---

## Live preview / running locally

The project is fully static — no backend needed.

```bash
cd ~/Projects/fetchcpu-pocho
npm start                # http://localhost:8000
```

> `npm start` is an alias for `npm run serve` which starts the bundled Node.js
> static file server (`scripts/serve.mjs`). You can also use any other static
> server, e.g.:
>
> ```bash
> python3 -m http.server 8000
> npx serve .
> ```
>
> Or just open `index.html` directly in a modern browser (the simulator
> uses ES modules and runs without a build step).

---

## Features

### Didactic (the heart of it)

| Feature | Description |
|---|---|
| **FDE flow visualizer** | The `Fetch → Decode → Execute` row highlights the active phase on every cycle. |
| **Disassembler strip** | Shows the current instruction (CIR) and the next one (PC) in mnemonics, plus operand. |
| **Status flags** | Z / N / P indicators on the accumulator with a glow when set. |
| **Memory access strip** | Every read/write the CPU performs is logged: direction, address, value, and phase. |
| **Bus animation** | Two pills (`CPU reads from RAM`, `CPU writes to RAM`) flash on each access. |
| **Register diffs** | Every register shows `← previous value` for ~300 ms after a change. |
| **Step forward / step back** | `F9` advances one cycle; `F8` rewinds through the cycle history. |
| **Breakpoints** | Click in the line-number gutter to set a breakpoint; `Run` halts when PC reaches it. |
| **Run to halt** | `Shift+F5` runs as fast as the UI allows until the program halts. |
| **Memory map** | A 100-cell bar summarizes used / code / data cells, with PC and MAR highlighted. |
| **Mnemonic badges** | Each RAM cell shows its mnemonic badge (`INP`, `LDA`, `BRP`, …) with semantic color. |
| **Edited-value indicator** | The cell value pads 3-digit and supports negatives via nine's complement. |
| **Halt indicator** | After a `HLT`, the halted cell keeps a visible marker. |

### UI / UX

- **Modern dark & light themes** — auto-initialised from system preference if no override.
- **Fully responsive** — mobile-first layout from iPhone SE to 1480 px desktop with 5 breakpoints and a hamburger bottom-sheet menu on phones.
- **Touch-optimised** — 44 px minimum tap targets on coarse pointers (Apple HIG), `-webkit-tap-highlight-color: transparent`, hover-only states replaced by `:active`/`:focus-visible` on touch.
- **iOS / Android safe-area aware** — `env(safe-area-inset-*)` insets the header, footer and modals so content never sits under the notch / Dynamic Island / home indicator.
- **Glass / radial gradients** — non-flat surfaces.
- **Inter + JetBrains Mono** — typographic hierarchy.
- **Editable RAM cells** — type in a value to override (great for demos).
- **Code editor** — line numbers, breakpoints, syntax highlighting for mnemonics, labels, comments.
- **Tabbed Activity panel** — Live feed · History · Stats · Log file.
- **Keyboard shortcuts** — see [the table below](#keyboard-shortcuts).

### Responsive breakpoints

| Range        | Device                          | Layout                                                          |
|--------------|---------------------------------|-----------------------------------------------------------------|
| 0 – 479 px   | iPhone SE / small phones        | 1 column, RAM cells drop address + label, FDE flow stacks       |
| 480 – 819 px | Standard phones / phablets      | 1 column, IO panels single column, full-width controls          |
| 820 – 1023 px| iPad portrait                   | 2 columns (RAM full-width left, Controls+CPU right)             |
| 1024 – 1279 px| iPad landscape / small laptops | 2 columns with refined ratios                                   |
| ≥ 1280 px    | Desktop                         | Same 2-column layout with larger gaps and breathing room        |

The breakpoint scale is declared in `css/tokens.css` (`--bp-xs/sm/md/tablet/lg/xl/2xl`) and consumed throughout `css/layout.css` and `css/components.css`.

### Developer workflow

- **Persistent state** — the source code, input, theme, and language persist in localStorage between sessions.
- **URL hash sharing** — `↗` copies an encoded `#fcpu=base64…` link so a program can be shared verbatim.
- **Import / Export `.fcpu` files** — round-trips the source plus default input values.
- **Download log .txt** — full transcript of every cycle for offline study.
- **Statistics** — cycles, instructions executed per opcode, branches taken, reads, writes, runtime.
- **History timeline** — the most recent 50 cycles with mnemonic, PC, ACC and "click to rewind".
- **Sound effects** — optional, off by default. Short sine envelopes on Fetch / Decode / Execute.

### Accessibility

- All controls keyboard-reachable.
- `aria-pressed` on toggle buttons, `aria-selected` on tabs, `role="grid"` on the RAM table.
- Live regions (`aria-live="polite"`) for the live feed and the FDE phase.
- Visible focus rings on every interactive element.
- Color-coded states have semantic labels (Z/N/P, MAR/PC labels on the RAM table).
- **Modals** close on `Escape`, trap focus, and restore focus to the opener.
- **`prefers-reduced-motion`** disables animations and transitions for users
  who request it.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `F5` | Run / resume |
| `Shift` + `F5` | Run to halt (uses min interval for speed) |
| `F6` | Run / Pause toggle |
| `F4` | Restart — reload the program in the editor from scratch |
| `F8` | Step backward |
| `F9` | Step forward |
| `F10` | Step one phase (Fetch → Decode → Execute) |
| `Ctrl` / `Cmd` + `S` | Download log file |
| `←` `→` (inside the Activity panel tabs) | Switch tabs |
| Double-click the `−` / `+` clock buttons | Jump ±250 ms |

On the editor gutter, click any line number to toggle a breakpoint.

---

## Quick example walkthrough

1. Open `http://127.0.0.1:8000/`.
2. The example picker defaults to **"Adding 2 inputs"** — the program reads two values and prints their sum. The **Input** panel reshapes itself automatically and shows **two slots** labeled `#1` and `#2`, pre-populated with `3` and `4`.
3. Press **Try example** — the program is assembled into RAM and starts running at 500 ms per cycle (slow enough to follow).
4. Hit `F9` a few times to step manually. Watch:
   - the **CIR** register showing the current instruction mnemonic,
   - the **MAR** register jumping to the operand address,
   - the highlighted RAM cell moving from PC to operand,
   - **ACC** updating on `ADD` / `LDA`,
   - the **bus** flashing on each memory access,
   - the **access log** showing `READ 03 = 042` or `WRITE 06 = 003` style entries.
5. The **Input** slots update live: as `INP` runs, the slot that was just consumed becomes "empty" so you can see exactly which values the program still has queued.
6. Toggle the language with **EN / ES** in the header — every label, button, log message, modal and slot hint updates instantly.

### Input slots: how they work

- When you **load a program**, the Input panel renders one slot per top-level `INP` (e.g. a program with two `INP`s shows `#1` and `#2`).
- If the program has an `INP` inside a **loop**, the panel shows **one slot with an `∞` badge** and a **+ Add value** button so you can stage one value per iteration.
- **Pasting** a list of numbers into the panel distributes them across slots and silently discards overflow.
- Anything you write in the slots is mirrored to the share/export `.fcpu` format, so the new UI is fully compatible with the old text-based input box.

---

## Installation & development

```bash
git clone <your-fork-url>
cd fetchcpu-pocho

# No build step. No deps to run (only vitest/eslint as devDeps).
npm install           # optional, only needed for tests / lint

# Run the simulator
npm start

# Run a static file server if you prefer:
python3 -m http.server 8000
```

### Available scripts

| Script | Description |
|---|---|
| `npm start` / `npm run serve` | Start a static server on `http://127.0.0.1:8000/`. |
| `npm test` | Run all 65 unit + integration + smoke tests with Vitest. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run lint` | ESLint across `js/` and `tests/`. |

---

## Testing

The project ships with **65+ tests** that exercise every public module and the most
critical user-facing flows.

| Suite | What it covers |
|---|---|
| `tests/parser.test.js` | Two-pass assembler, labels, immediate, indirect, comments, edge cases. |
| `tests/executor.test.js` | Core CPU mechanics: add, indirect load, step-back, halt. |
| `tests/integration.test.js` | All twelve example programs end-to-end through the parser + executor. |
| `tests/clock.test.js` | Slider behaviour, ± buttons, clamping, slow execution timing. |
| `tests/memory_access.test.js` | MAR fidelity, event emission, indirect two-step reads, UI access log. |
| `tests/share_fileio.test.js` | URL hash sharing round-trip and `.fcpu` file import/export. |
| `tests/stats_events.test.js` | Stats aggregation and event pub/sub. |
| `tests/i18n.test.js` | Key resolution, interpolation, fallback, DOM translation, EN/ES switching. |
| `tests/smoke.test.js` | jsdom-based UI smoke tests (boot, layout, breakpoints, try-example). |

Run them all:

```bash
npm test           # one-shot
npm run test:watch # watch mode
```

The smoke tests use Vitest's `jsdom` environment to boot the full module graph
and exercise real DOM events — no browser required.

---

## Project structure

```
fetchcpu-pocho/
├── index.html                     # Single-page UI; no build step
├── README.md                      # this file
├── package.json
├── eslint.config.js               # ESLint flat config
├── vitest.config.js
├── .gitignore
│
├── assets/
│   └── favicon.svg
│
├── css/
│   ├── reset.css                  # modern CSS reset
│   ├── tokens.css                 # design tokens (spacing, radii, motion)
│   ├── themes.css                 # dark / light palettes, glass, brand gradient
│   ├── layout.css                 # responsive grid, header, footer
│   └── components.css             # panels, buttons, registers, RAM cells, modals
│
├── js/
│   ├── main.js                    # entry point — wires DOM, events, modules
│   │
│   ├── cpu/                       # CPU model
│   │   ├── opcodes.js             # opcode table
│   │   ├── ram.js                 # 100-cell RAM with diff tracking
│   │   ├── cpu.js                 # PC / CIR / MAR / MDR / ACC + flags
│   │   ├── parser.js              # two-pass assembler: labels, immediate, indirect
│   │   ├── executor.js            # Fetch / Decode / Execute cycle + step history
│   │   ├── events.js              # pub/sub for simulator events
│   │   └── stats.js               # runtime metrics
│   │
│   ├── ui/                        # view layer (no business logic)
│   │   ├── cpuView.js
│   │   ├── ramView.js
│   │   ├── editor.js
│   │   ├── logger.js
│   │   ├── statsView.js
│   │   ├── historyView.js
│   │   ├── disassemblerView.js
│   │   ├── io.js
│   │   ├── theme.js
│   │   ├── sound.js
│   │   ├── tabs.js
│   │   ├── share.js
│   │   ├── fileIO.js
│   │   └── i18n/
│   │       ├── dictionaries.js   # EN + ES dictionaries
│   │       └── index.js           # t() / setLanguage() / translateDom()
│   │
│   └── programs/
│       └── examples.js            # 12 example programs with i18n keys
│
├── scripts/
│   └── serve.mjs                  # tiny Node.js static file server (no deps)
│
└── tests/
    ├── parser.test.js
    ├── executor.test.js
    ├── integration.test.js
    ├── clock.test.js
    ├── memory_access.test.js
    ├── share_fileio.test.js
    ├── stats_events.test.js
    ├── i18n.test.js
    └── smoke.test.js
```

---

## Architecture notes

### CPU model

The simulator models a tiny Von Neumann machine: 100 memory cells and
three-digit numeric words. Three layers keep the model honest:

1. **`ram.js`** — `createRAM()` returns an immutable-ish object with
   `read(addr)`, `write(addr, value)`, `snapshot()`, `getLastWritten()`. Cells are
   plain integers; clamping is left to the loader so that instruction words
   (901, 902, 000–999) round-trip cleanly.

2. **`cpu.js`** — `createCPU()` exposes `state.pc|acc|cir|mar|mdr|halted|phase`
   plus `markChanged(name)` / `lastChanged` (a `Set`) so the UI can render diffs
   and animations without polling.

3. **`executor.js`** — the heart. `step()` runs one Fetch / Decode / Execute
   cycle, mutates CPU + RAM, emits events, and pushes a snapshot onto
   `history` (used by step-backwards). `run()` wraps this in a `setTimeout`
   loop that re-reads the clock on each iteration so the user can move the
   slider at runtime.

### Immediate & indirect addressing

The encoded numeric instruction word doesn't carry mode information — every
LOAD, STORE, etc. looks the same to the runtime decoder.

- **Immediate** (`LDA #5`): the loader pre-allocates a free RAM cell, stores
  the literal in it, and rewrites the instruction to reference that cell. By
  the time the executor runs, the addressing is plain **direct**.
- **Indirect** (`LDA @5`): the loader remembers which source-lines are indirect.
  The executor holds a `Set` of addresses that are indirect, and during
  Execute it performs the extra memory dereference (`MAR ← RAM[MAR]; MDR ←
  RAM[MAR]`).

### Step backward

Every `step()` records a snapshot of CPU + RAM + IO + phase + mnemonic.
Step-back (`stepBack()`) pops the most recent snapshot and restores it. The
RAM snapshot is held as a plain array so `restore()` can rebuild.

### FDE timeline

Each FDE step emits `flag`, `memory-access`, `tick`, `halt`, etc. The UI
subscribes to these events:

- `cpuView` listens for `flag` (refresh the Z/N/P indicator),
- the same view listens for `memory-access` (flash the bus + update the
  access log strip),
- `ramView` refreshes on `tick` (highlight the current PC and MAR cells),
- the live feed, stats panel, and history timeline all listen for `tick`.

### Themes & fonts

- Themes use `data-theme="dark|light"` on `<html>`, with two complete
  palettes in `themes.css`.
- Glass surfaces use `backdrop-filter: blur(...)` with a translucent panel
  color.
- The brand gradient is defined as `--brand-grad` and used by the logo and
  the "FetchCPU-Pocho" footer badge.

---

## Localization (English / Spanish)

The UI is fully bilingual.

- **Dictionary** in `js/ui/i18n/dictionaries.js` with two fully-populated
  trees (`en` and `es`) — keys use dotted notation (`panels.cpu.registers.pc`).
- **t(key, ...args)** accepts varargs or arrays for interpolation
  (`t("log.stepDescription", cycle, phase, pc, mar, mdr, cir, acc)`).
- **setLanguage("en"|"es")** persists the choice in localStorage and fires
  registered change listeners.
- **translateDom(root)** walks the DOM and applies translations from
  attributes:
  - `data-i18n="key"` → `textContent`
  - `data-i18n-html="key"` → `innerHTML` (for HTML-bearing strings)
  - `data-i18n-attr="title:key;aria-label:key"` → multiple attributes
  - `data-i18n-placeholder="key"` → `placeholder` attribute
- **Missing keys** log `console.warn("[i18n] missing key '…' for '…'")` and
  fall back to the key itself, so unfinished translations are obvious
  during development.

---

## Roadmap & ideas

Want to help? Pick one:

- [ ] Add a small **assembler listing view** (labels ↔ address) per program.
- [ ] Add **signed positive** vs **nine's complement** toggle (educational).
- [ ] Add **watchpoints** (RAM-cell-based, not just PC-based).
- [ ] Add **3-bit / 6-bit variants** (memory sizes of 10 / 100 / 1000).
- [ ] Add a **CSV export** of the stats panel.
- [ ] Add **Web Audio synth** driven by register activity (a melody per
      instruction) for a "sonic CPU".
- [ ] i18n for **Portuguese** 🇧🇷 / **French** 🇫🇷.

---

## Credits

- **Built by [Pocho](https://github.com/Pochonski)** as a teaching aid for the
  classic Von Neumann architecture.
- Inspired by the long tradition of small, didactic CPU simulators — kept
  tiny on purpose so every Fetch / Decode / Execute cycle fits on one screen.

---

## License

MIT — see `LICENSE` for the full text.
