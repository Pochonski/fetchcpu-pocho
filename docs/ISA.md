# FetchCPU-Pocho ISA — semantics, quirks and safety rails

Source of truth: `js/cpu/opcodes.js` (encoding), `js/cpu/parser.js`
(assembly), `js/cpu/executor.js` (Fetch/Decode/Execute). Covered by
`tests/isa_audit.test.js` plus the pre-existing suite.

## Instruction set

| Mnemonic | Encoding | Operand | Effect |
|---|---|---|---|
| `INP` | 901 | none | `ACC = stdin`, flags refreshed |
| `OUT` | 902 | none | `stdout = ACC` (`MDR = ACC`) |
| `LDA` | 5xx | address | `ACC = RAM[xx]`, flags refreshed |
| `STA` | 3xx | address | `RAM[xx] = ACC` (flags untouched) |
| `ADD` | 1xx | address | `ACC += RAM[xx]`, flags refreshed |
| `SUB` | 2xx | address | `ACC -= RAM[xx]`, flags refreshed |
| `BRA` | 6xx | address | `PC = xx` (unconditional) |
| `BRZ` | 7xx | address | `PC = xx` iff `ACC == 0` |
| `BRP` | 8xx | address | `PC = xx` iff `ACC >= 0` (zero jumps) |
| `HLT` | 000 | none | `halted = true`, `haltedAt = PC` |
| `DAT` | value | optional initial value | data cell, not an instruction |

Flags: `ACC == 0 → Z`, `ACC < 0 → N`, else `P`.

## Addressing modes (FetchCPU-Pocho extension)

- **Direct** (`LDA 05`): `RAM[05]`.
- **Immediate** (`LDA #5`): resolved by the **loader**, not the executor —
  the literal is pre-stored in a high data cell and the instruction is
  rewritten to a direct reference (`js/cpu/parser.js`, `js/main.js`
  `loadProgram`).
- **Indirect** (`LDA @05`): double read `RAM[RAM[05]]` for
  `LDA/STA/ADD/SUB`.

## Documented quirks (do not "fix" without updating tests + UI)

1. **Branch instructions ignore indirect mode.** `BRA/BRZ/BRP @xx`
   jump to `xx` directly, no double read (`performExecute` branches on
   `operandValue` only).
2. **Executing a `DAT` (or any non-instruction word, empty cell `000`
   included) halts** instead of crashing: `decodeInstruction` remaps
   `DAT` to `HLT`. Falling off the end of a program without `HLT`
   therefore terminates normally.
3. **`STA` does not refresh flags** (it does not change `ACC`, so the
   stale flag stays valid).
4. `PC` outside `00..99` raises `RangeError` from RAM: the UI shows an
   error and pauses; `run()` stops via the `error` event.

## Loops: expected behavior and safety rails

Loops (`BRA`/`BRP`/`BRZ` back-edges) are legitimate programs
(countdown, multiply, factorial). An **infinite** loop is a user program
bug (back-edge whose exit condition never becomes true, e.g. `BRA 00`).

- `js/cpu/executor.js` exports `MAX_CYCLES = 50000`: `step()` returns
  `false` and emits `cycle-limit` once reached; `run()` stops. Manual
  single-stepping past the limit is a no-op. The UI shows
  `log.cycleLimit` (EN/ES) and pauses.
- `MAX_HISTORY = 1000` bounds undo snapshots (one per cycle holds a
  full RAM copy); the History tab renders the last 50.
- `INP` with exhausted input raises `EndOfInputError`, which also stops
  `run()` (`input-exhausted` event) — so input-driven loops terminate.
