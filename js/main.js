// Entry point: wires up all DOM, simulator modules and event handlers.

import { createRAM } from "./cpu/ram.js";
import { createCPU } from "./cpu/cpu.js";
import { parse, encodeInstruction, resolveLabels } from "./cpu/parser.js";
import { createExecutor } from "./cpu/executor.js";
import { createEvents } from "./cpu/events.js";
import { createStats } from "./cpu/stats.js";
import { createIO } from "./ui/io.js";
import { createInputSlots } from "./ui/ioSlots.js";
import { createRAMView } from "./ui/ramView.js";
import { createCPUView } from "./ui/cpuView.js";
import { createEditorView } from "./ui/editor.js";
import { createLogger } from "./ui/logger.js";
import { createDisassemblerView } from "./ui/disassemblerView.js";
import { createStatsView } from "./ui/statsView.js";
import { createHistoryView } from "./ui/historyView.js";
import { createSound } from "./ui/sound.js";
import { createTabs } from "./ui/tabs.js";
import { initTheme } from "./ui/theme.js";
import { PROGRAMS, getProgramMeta } from "./programs/examples.js";
import { decodeShare, currentShare } from "./ui/share.js";
import { parseFile, downloadAs } from "./ui/fileIO.js";
import { t, currentLanguage, setLanguage, translateDom, initI18n } from "./ui/i18n/index.js";
import { en as enDict, es as esDict } from "./ui/i18n/dictionaries.js";
import { openModal as openModalA11y, closeModal as closeModalA11y } from "./ui/modal.js";
import { initMobileMenu } from "./ui/mobileMenu.js";

const SOURCE_KEY = "fetchcpu.source";
const INPUT_KEY = "fetchcpu.input";

const $ = (id) => document.getElementById(id);

let booted = false;
function boot() {
  if (booted) return;
  booted = true;

  initI18n();
  initTheme($("theme-toggle"));
  initMobileMenu();

  // Module-level references cached up front (avoid TDZ in nested functions).
  const sel = $("files");
  const events = createEvents();
  const stats = createStats();
  const sound = createSound();
  const cpu = createCPU();
  const ram = createRAM();
  const io = createIO($("input"), $("output"));
  const executor = createExecutor(cpu, ram, io, events, stats);

  // Render the input as discrete slots matching the program's INP count.
  const inputSlots = createInputSlots($("input-list"), {
    t,
    addButton: $("btn-add-input"),
    onChange: (values) => {
      io.setInputValues(values);
      // Mirror to the hidden input so share/export/serialize still work.
      const hidden = $("input");
      if (hidden) hidden.value = io.getInputText();
      localStorage.setItem(INPUT_KEY, hidden ? hidden.value : "");
    },
  });
  $("btn-add-input")?.addEventListener("click", () => inputSlots.addSlot());

  const cpuView = createCPUView(cpu, events);
  const ramView = createRAMView(ram, cpu);
  const disasmView = createDisassemblerView(ram, cpu);
  const statsView = createStatsView(stats);
  const historyView = createHistoryView(executor);
  const logger = createLogger($("liveFeed"), $("log"));

  const editor = createEditorView(
    $("codeListing"),
    $("editor-gutter"),
    $("editor-highlight"),
    {
      onChange: () => localStorage.setItem(SOURCE_KEY, $("codeListing").value),
      onToggleBreakpoint: () => {
        // Breakpoints are tracked as source line indices in the editor
        // but consumed as RAM addresses by the executor. Re-derive the
        // address set whenever the user toggles one so Run/Step reflect
        // the latest state without forcing a full reload.
        currentBreakpointsByAddress = new Set();
        editor.state.breakpoints.forEach((lineIdx) => {
          const addr = currentAddressesBySourceLine.get(lineIdx + 1);
          if (addr != null) currentBreakpointsByAddress.add(addr);
        });
      },
    },
  );

  // State shared across editor callbacks, loadProgram(), and the executor.
  // Breakpoints live in the editor as source-line indices but are consumed
  // as RAM addresses by the executor; loadProgram() rebuilds the address
  // set, and onToggleBreakpoint keeps it fresh between reloads.
  let currentBreakpointsByAddress = new Set();
  const currentAddressesBySourceLine = new Map();

  // Populate example dropdown with current-language labels.
  function fillExamples() {
    sel.innerHTML = "";
    PROGRAMS.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.value;
      opt.textContent = getProgramMeta(p, t).label;
      sel.appendChild(opt);
    });
  }
  fillExamples();
  sel.value = "1";

  function updateBlurb() {
    const program = PROGRAMS.find((p) => p.value === sel.value);
    if (!program) return;
    const meta = getProgramMeta(program, t);
    const title = $("blurb-title");
    const text = $("blurb-text");
    if (title) title.textContent = meta.label;
    if (text) text.textContent = meta.blurb || "";
  }

  // Apply translations to static DOM and dynamic content.
  function applyAllTranslations() {
    translateDom(document.body);
    fillExamples();
    updateBlurb();
    rebuildModalContent();
    refreshView();
  }

  function refreshView() {
    cpuView.render();
    ramView.sync();
    disasmView.render();
    statsView.render();
    historyView.render();
  }

  function rebuildModalContent() {
    // About
    const a1 = $("about-p1");
    const a2 = $("about-p2");
    const a3 = $("about-p3");
    const shorts = $("about-shortcuts");
    const creds = $("about-credits");
    if (a1) a1.innerHTML = t("modal.about.paragraphs");
    if (a2) a2.innerHTML = t("modal.about.paragraph2");
    // Feature cards: 2-column grid, each card has an icon + title + desc.
    if (a3) {
      const features = readArray("modal.about.features");
      if (Array.isArray(features)) {
        a3.innerHTML = features.map((f) => `
          <div class="feature-card">
            <div class="feature-icon" aria-hidden="true">${featureIconSvg(f.icon)}</div>
            <div class="feature-title">${escapeHtml(f.title)}</div>
            <div class="feature-desc">${escapeHtml(f.desc)}</div>
          </div>
        `).join("");
      } else {
        // Fallback: render the paragraph3 string verbatim.
        a3.innerHTML = t("modal.about.paragraph3");
      }
    }
    if (shorts) {
      shorts.innerHTML = t("modal.about.shortcuts", { shortcuts: kbdShortcutsHtml(keysForFooter()) });
    }
    if (creds) creds.innerHTML = t("modal.about.credits");

    // Instructions table (Mnemonic / Name / Description / Op Code)
    renderInstructionTable(
      "instructions-thead-row",
      "instructions-tbody",
      readArray("modal.instructions.instructions"),
      "modal.instructions.th",
      /* withCode */ true,
    );

    // Addressing variants sub-table
    renderInstructionTable(
      "addressing-thead-row",
      "addressing-tbody",
      readArray("modal.instructions.addressing"),
      "modal.instructions.th",
      /* withCode */ true,
    );

    // Tutorial
    const tlist = $("tutorial-steps");
    if (tlist) {
      const steps = readArray("modal.tutorial.steps");
      tlist.innerHTML = "";
      if (Array.isArray(steps)) {
        for (const step of steps) {
          const li = document.createElement("li");
          // Wrap the step text in a span so the grid layout (number |
          // content) has exactly two items per row. Otherwise a
          // mixed-content step like "<strong>Hi</strong> there" yields
          // three grid items and the text node wraps into a stray row.
          li.innerHTML = `<span class="step-body">${step}</span>`;
          tlist.appendChild(li);
        }
      }
    }

    // Footer — only the keyboard-hints span is rewritten. The brand-badge
    // (with the logo) lives as a sibling in the HTML so it survives every
    // translation pass intact.
    const footerText = $("footer-text");
    if (footerText) {
      // t() flattens the {keys} array into a string. We join the
      // "F5 run · F6 pause · …" segments with " · " so the footer
      // shows both the shortcut keys and the human-readable labels.
      footerText.textContent = t("footer.text", {
        keys: keysForFooter().map((it) => `${it.kbd} ${it.label}`).join(" · "),
      });
    }
  }

  function keysForFooter() {
    return [
      { kbd: t("shortcutFormat.f5"),    label: t("footer.keys.run") },
      { kbd: t("shortcutFormat.f6"),    label: t("footer.keys.pause") },
      { kbd: t("shortcutFormat.f9"),    label: t("footer.keys.step") },
      { kbd: t("shortcutFormat.f10"),   label: t("footer.keys.phase") || t("panels.cpu.stepPhase").toLowerCase() },
      { kbd: t("shortcutFormat.f8"),    label: t("footer.keys.back") },
      { kbd: t("shortcutFormat.f4"),    label: t("footer.keys.restart") },
      { kbd: t("shortcutFormat.ctrlS"), label: t("footer.keys.save") },
    ];
  }

  // Render a [{ kbd, label }, ...] list as a flat, dot-separated string of
  // <kbd>...</kbd> keys + plain labels. Used for both the footer
  // keyboard hints and the About modal "Keyboard shortcuts" section.
  function kbdShortcutsHtml(items) {
    return items
      .map((it, i) => `${i > 0 ? " · " : ""}<kbd>${escapeHtml(it.kbd)}</kbd> ${escapeHtml(it.label)}`)
      .join("");
  }

  // Escape a string for safe injection into innerHTML. The modal
  // renderers interpolate i18n values directly, so anything coming
  // from the dictionary needs to be HTML-escaped first to avoid
  // injection via translated strings.
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // SVG markup for the feature cards in the About modal. The 4 variants
  // match the icons in modal.about.features[].icon. Each is intentionally
  // minimal so they render sharply at 18 px.
  const FEATURE_ICONS = {
    bus: '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 12h7M3 7h7M3 17h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M14 8l4-2v12l-4-2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/><path d="M14 8v8" stroke="currentColor" stroke-width="1.6"/></svg>',
    ram: '<svg viewBox="0 0 24 24" focusable="false"><rect x="3" y="6" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 10h18M7 6v12M11 6v12M15 6v12" stroke="currentColor" stroke-width="1.2"/></svg>',
    bilingual: '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 6h7M5 6v0M6.5 6c0 5-2 8-3.5 9M4 11c1 2 3 4 6 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M11 12h10M14 12c0 4-2 7-4 8M14 12c0 4 2 7 4 8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" focusable="false"><circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 11l8-4M8 13l8 4" stroke="currentColor" stroke-width="1.5"/></svg>',
  };
  function featureIconSvg(name) {
    return FEATURE_ICONS[name] || "";
  }

  // Render one of the instruction tables. Each row in the dictionary
  // is one of:
  //   [mnemonic, name, description, opCode]                (standard)
  //   [mnemonic, name, description, opCode, category]      (extended)
  // The 5th element is the "category" used to colour the mnemonic
  // chip: io | memory | branch | control | dat. If absent, we
  // fall back to the opcode prefix.
  function renderInstructionTable(headId, bodyId, list, thKeyPrefix, withCode) {
    const head = $(headId);
    const body = $(bodyId);
    if (head) {
      const tMnemonic = t(thKeyPrefix + ".mnemonic");
      const tName     = t(thKeyPrefix + ".name");
      const tDesc     = t(thKeyPrefix + ".desc");
      const tCode     = t(thKeyPrefix + ".code");
      head.innerHTML = [tMnemonic, tName, tDesc, tCode]
        .map((s) => `<th>${escapeHtml(s)}</th>`)
        .join("");
    }
    if (!body) return;
    body.innerHTML = "";
    if (!Array.isArray(list)) return;
    for (const row of list) {
      const [mnemonic, name, desc, code] = row;
      const tr = document.createElement("tr");
      const cat = guessCategoryFromCode(code);
      tr.innerHTML = `
        <td class="col-mnemonic"><span class="mnemonic-chip mnemonic-${cat}">${escapeHtml(mnemonic)}</span></td>
        <td class="col-name">${escapeHtml(name || "")}</td>
        <td class="col-desc">${desc || ""}</td>
        ${withCode && code ? `<td class="col-code"><code>${escapeHtml(code)}</code></td>` : ""}
      `;
      body.appendChild(tr);
    }
  }

  // Guess the chip category from the op-code prefix when the dictionary
  // didn't provide one explicitly. Used as a fallback so an old
  // dictionary (e.g. 1.0.0) still renders the colours.
  function guessCategoryFromCode(code) {
    if (!code) return "memory";
    if (code === "901" || code === "902") return "io";
    if (code === "000") return "control";
    if (code === "8xx" || code === "7xx" || code === "6xx") return "branch";
    if (code === "5xx" || code === "3xx" || code === "1xx" || code === "2xx") return "memory";
    return "memory";
  }

  function readArray(key) {
    const dicts = { en: enDict, es: esDict };
    const d = dicts[currentLanguage()] || enDict;
    const parts = key.split(".");
    let cur = d;
    for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
    return cur;
  }

  sel.addEventListener("change", updateBlurb);

  // Wire language switch buttons.
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.dataset.lang;
      setLanguage(lang);
      document.querySelectorAll(".lang-btn").forEach((b) => {
        b.setAttribute("aria-pressed", b.dataset.lang === lang ? "true" : "false");
      });
      applyAllTranslations();
    });
  });

  // Sync aria-pressed to the active language on boot.
  document.querySelectorAll(".lang-btn").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.lang === currentLanguage() ? "true" : "false");
  });

  // Apply once on boot.
  applyAllTranslations();

  // ---- Loading a program into RAM ----
  function loadProgram() {
    logger.clear();
    cpu.reset();
    ram.reset();
    io.reset();
    stats.reset();

    const source = $("codeListing").value;
    const result = parse(source);
    if (!result.ok) {
      for (const err of result.errors) {
        const msg = err.key ? t(err.key, err.args) : err.message;
        logger.onError(t("log.parseError", [err.line, msg]));
      }
      refreshView();
      return;
    }

    const { instructions, labels } = result.program;

    // Re-shape the input panel to match the number of INPs in the program,
    // then sync the current IO queue into the slots (truncated to count).
    const inpShape = countInps(instructions);
    inputSlots.setCount(inpShape.count, inpShape.isLoop);
    inputSlots.setValues(io.getInputValues());

    // PHASE 1 — prepare: mutate the instruction tree and build the data-cell
    // list, but do NOT touch RAM yet. This keeps the load transactional:
    // any failure below leaves RAM in its freshly-reset state rather than
    // half-loaded.
    const dataCells = [];
    const allocator = 99;
    const usedAddresses = new Set(instructions.map((i) => i.address));
    const indirectSourceLines = new Set();

    let prepError = null;
    for (const instr of instructions) {
      if (instr.mnemonic === "DAT") continue;
      if (!instr.operand) continue;
      if (instr.operand.mode === "immediate") {
        let dataAddr = allocator;
        while (usedAddresses.has(dataAddr) && dataAddr > 0) dataAddr -= 1;
        if (dataAddr < 0) {
          prepError = t("log.outOfMemory", [instr.sourceLine]);
          break;
        }
        dataCells.push({ addr: dataAddr, value: Number(instr.operand.value) });
        usedAddresses.add(dataAddr);
        instr.operand = { mode: "direct", value: String(dataAddr), ref: null };
      } else if (instr.operand.mode === "indirect") {
        indirectSourceLines.add(instr.sourceLine);
      }
    }

    // PHASE 2 — encode every instruction. Aborts the load on the first
    // failure without writing anything to RAM.
    const entries = [];
    currentAddressesBySourceLine.clear();
    let encodeError = null;
    if (!prepError) {
      for (const instr of instructions) {
        try {
          const code = encodeInstruction(instr);
          entries.push({ ...instr, code });
          currentAddressesBySourceLine.set(instr.sourceLine, instr.address);
        } catch (e) {
          encodeError = e.message;
          break;
        }
      }
    }

    // PHASE 3 — resolve labels. Again, no RAM writes until everything is OK.
    let resolveError = null;
    if (!prepError && !encodeError) {
      try {
        resolveLabels(entries, labels);
      } catch (e) {
        resolveError = e.message;
      }
    }

    if (prepError || encodeError || resolveError) {
      const msg = prepError || encodeError || resolveError;
      logger.onError(msg);
      refreshView();
      return;
    }

    // PHASE 4 — commit. All preparation succeeded, so it is now safe to
    // mutate RAM. We write entries and data cells in a single pass.
    for (const e of entries) {
      const addr = e.address;
      let value = 0;
      if (e.mnemonic === "DAT") value = e.code.value ?? 0;
      else if (e.code.value != null) value = e.code.value;
      ram.write(addr, value);
    }
    for (const { addr, value } of dataCells) {
      ram.write(addr, value);
    }

    const indirectAddrs = new Set();
    for (const sl of indirectSourceLines) {
      const addr = currentAddressesBySourceLine.get(sl);
      if (addr != null) indirectAddrs.add(addr);
    }
    executor.setIndirectAddresses(indirectAddrs);

    currentBreakpointsByAddress = new Set();
    editor.state.breakpoints.forEach((lineIdx) => {
      const addr = currentAddressesBySourceLine.get(lineIdx + 1);
      if (addr != null) currentBreakpointsByAddress.add(addr);
    });

    ramView.setProgramMetadata({
      labels,
      instructions,
      immediates: dataCells.map((d) => d.addr),
    });

    logger.onProgramLoaded(entries.length);
    setExplanationText(t("explanation.idle"));
    refreshView();
  }

  // Refuse to run/step while any slot holds a value outside the 3-digit
  // LMC range. Focuses the first invalid slot and pushes a friendly log
  // entry so the user knows why nothing happened.
  function guardInputRange() {
    if (inputSlots.isValid()) return true;
    const bad = inputSlots.firstInvalid();
    if (bad) {
      bad.focus();
      const raw = bad.value.trim();
      const msg = t("panels.cpu.inputOutOfRange", {
        value: raw,
        min: inputSlots.rangeMin(),
        max: inputSlots.rangeMax(),
      });
      logger.onError(msg);
    } else {
      logger.onError(t("panels.cpu.inputBlockedRange"));
    }
    refreshView();
    return false;
  }

  function runProgram() {
    if (cpu.state.halted) loadProgram();
    if (!guardInputRange()) return;
    if (!executor.isRunning()) {
      executor.run({
        getSpeed: () => Number($("clock").value),
        breakpoints: [...currentBreakpointsByAddress],
        onTick: () => {
          refreshView();
          const sourceLine = lineOf(cpu.state.halted ? cpu.state.haltedAt : cpu.state.pc - 1);
          if (sourceLine != null) editor.highlightLine(sourceLine);
        },
      });
      setPauseIcon(true);
    }
  }

  function runUntilHalt() {
    if (cpu.state.halted) loadProgram();
    if (!guardInputRange()) return;
    executor.run({
      // Fast-forward: cap at 20 ms so the UI can still render between cycles.
      getSpeed: () => Math.min(Number($("clock").value) || 50, 20),
      breakpoints: [...currentBreakpointsByAddress],
      onTick: () => {
        refreshView();
        const sourceLine = lineOf(cpu.state.halted ? cpu.state.haltedAt : cpu.state.pc - 1);
        if (sourceLine != null) editor.highlightLine(sourceLine);
      },
    });
    setPauseIcon(true);
  }

  function pauseProgram() {
    executor.stop();
    setPauseIcon(false);
  }

  function setPauseIcon(isRunning) {
    const btn = $("btn-pause");
    if (!btn) return;
    const icon = btn.querySelector(".icon");
    if (icon) {
      // Swap the SVG path between Play (triangle) and Pause (two bars).
      icon.innerHTML = isRunning
        ? '<path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" fill="currentColor"/>'
        : '<path d="M8 5v14l11-7z" fill="currentColor"/>';
      icon.classList.toggle("icon-pause", isRunning);
      icon.classList.toggle("icon-play", !isRunning);
    }
    btn.setAttribute("data-running", isRunning ? "true" : "false");
    btn.setAttribute("aria-label", isRunning ? t("app.pauseLabel") : t("app.runLabel"));
  }

  function singleStep() {
    if (cpu.state.halted) return;
    if (executor.isRunning()) pauseProgram();
    if (!guardInputRange()) return;
    try {
      const cont = executor.step();
      refreshView();
      const src = currentAddressesBySourceLine.get(cpu.state.halted ? cpu.state.haltedAt : cpu.state.pc - 1);
      if (src != null) editor.highlightLine(src);
      if (!cont) {
        logger.onProgramHalted(cpu);
        sound.halt();
      }
    } catch (e) {
      logger.onError(e.message);
      pauseProgram();
    }
  }

  function stepPhase() {
    if (cpu.state.halted) return;
    if (executor.isRunning()) pauseProgram();
    try {
      const cont = executor.stepPhase();
      refreshView();
      const src = currentAddressesBySourceLine.get(
        cpu.state.halted ? cpu.state.haltedAt : cpu.state.pc - 1,
      );
      if (src != null) editor.highlightLine(src);
      if (!cont) {
        logger.onProgramHalted(cpu);
        sound.halt();
      }
    } catch (e) {
      logger.onError(e.message);
      pauseProgram();
    }
  }

  function stepBack() {
    if (executor.isRunning()) pauseProgram();
    if (executor.stepBack()) refreshView();
  }

  function lineOf(addr) {
    for (const [sl, a] of currentAddressesBySourceLine.entries()) {
      if (a === addr) return sl;
    }
    return null;
  }

  // Count INP mnemonics and detect whether any live inside a backward
  // branch (loop). Returns { count, isLoop } used to size the input slots.
  function countInps(instructions) {
    const branchAddrs = [];
    for (const instr of instructions) {
      if (
        instr.mnemonic === "BRA" ||
        instr.mnemonic === "BRP" ||
        instr.mnemonic === "BRZ"
      ) {
        const target = Number(instr.operand?.value);
        if (Number.isFinite(target)) branchAddrs.push({ addr: instr.address, target });
      }
    }
    const inLoop = new Set();
    for (const { addr, target } of branchAddrs) {
      if (target < addr) {
        for (let i = target; i <= addr; i++) inLoop.add(i);
      }
    }
    let linear = 0;
    let loopHasInp = false;
    for (const instr of instructions) {
      if (instr.mnemonic !== "INP") continue;
      if (inLoop.has(instr.address)) loopHasInp = true;
      else linear += 1;
    }
    if (loopHasInp) return { count: Math.max(1, linear), isLoop: true };
    return { count: Math.max(1, linear), isLoop: false };
  }

  function selectExample() {
    const v = $("files").value;
    const program = PROGRAMS.find((p) => p.value === v);
    if (!program) return;
    editor.setProgram(program.code);
    editor.state.breakpoints.clear();
    editor.rerender();
    if (program.input != null) {
      const text = program.input;
      $("input").value = text;
      io.setInputText(text);
      localStorage.setItem(INPUT_KEY, text);
    } else {
      $("input").value = "";
      io.setInputText("");
      localStorage.setItem(INPUT_KEY, "");
    }
    // Slots get populated by loadProgram() based on the parsed INP count.
    updateBlurb();
  }

  function tryExample() {
    selectExample();
    loadProgram();
    runProgram();
  }

  function clearEditor() { editor.setProgram(""); }
  function resetState() {
    pauseProgram();
    executor.reset();
    logger.clear();
    cpuView.resetAccessLog();
    refreshView();
  }

  // Restart: stop execution and reload the program currently in the editor
  // from scratch — RAM, CPU, IO, stats and log are all reset, then the
  // editor source is parsed and assembled again. Equivalent to clicking
  // Load, but with a single button next to Run and Step.
  function restartProgram() {
    pauseProgram();
    loadProgram();
  }

  function downloadLog() {
    if (!logger.isLogFileEnabled()) logger.setLogFile(true);
    logger.download();
  }

  function exportProgram() {
    const source = $("codeListing").value;
    const input = $("input").value;
    downloadAs(source, input, "program.fcpu");
  }

  function importProgramFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { source, input } = parseFile(text);
      editor.setProgram(source);
      io.setInputText(input);
      $("input").value = input;
      localStorage.setItem(SOURCE_KEY, source);
      localStorage.setItem(INPUT_KEY, input);
      // Slots will be sized and populated by loadProgram() below.
      loadProgram();
      refreshView();
    };
    reader.readAsText(file);
  }

  function copyShareUrl() {
    const url = currentShare($("codeListing").value, $("input").value);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () => flashShare(true),
        () => flashShare(false),
      );
    } else {
      prompt("Share URL", url);
    }
  }

  let shareFlashTimer = null;
  function flashShare(ok) {
    const btn = $("share-btn");
    const icon = btn.querySelector(".icon");
    if (icon) {
      icon.innerHTML = ok
        ? '<path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="currentColor"/>'
        : '<path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" fill="currentColor"/>';
    }
    btn.setAttribute("title", ok ? t("app.shareCopied") : t("app.shareFailed"));
    clearTimeout(shareFlashTimer);
    shareFlashTimer = setTimeout(() => {
      if (icon) {
        icon.innerHTML = '<path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1.5-8 6-12.5 11-13z" fill="currentColor"/>';
      }
      btn.setAttribute("title", t("app.share"));
    }, 1500);
  }

  function openModal(id) { openModalA11y($(id)); }
  function closeModal(el) { closeModalA11y(el); }

  // ----- Wire DOM listeners -----
  $("btn-load").addEventListener("click", loadProgram);
  $("btn-run").addEventListener("click", runProgram);
  $("btn-step").addEventListener("click", singleStep);
  $("btn-pause").addEventListener("click", () => {
    if (executor.isRunning()) pauseProgram(); else runProgram();
  });
  $("btn-restart").addEventListener("click", restartProgram);
  $("btn-select-program").addEventListener("click", selectExample);
  $("btn-try-example").addEventListener("click", tryExample);
  $("btn-clear").addEventListener("click", clearEditor);
  $("btn-reset").addEventListener("click", resetState);
  $("btn-download-log").addEventListener("click", downloadLog);
  $("btn-clear-log").addEventListener("click", () => logger.clear());
  $("btn-export").addEventListener("click", exportProgram);
  $("btn-import").addEventListener("click", () => $("file-input").click());
  $("file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importProgramFile(file);
  });

  $("clock").addEventListener("input", (e) => {
    updateClockDisplay(e.target.value);
  });

  function formatClock(value) {
    const ms = Math.max(0, Number(value) || 0);
    return `${ms} ms`;
  }

  function updateClockDisplay(value) {
    const out = $("clock-value");
    out.textContent = formatClock(value);
    out.dataset.changed = "true";
    clearTimeout(updateClockDisplay._t);
    updateClockDisplay._t = setTimeout(() => { out.dataset.changed = "false"; }, 250);
  }

  function stepClock(deltaMs) {
    const slider = $("clock");
    const min = Number(slider.min);
    const max = Number(slider.max);
    const next = Math.min(max, Math.max(min, Number(slider.value) + deltaMs));
    slider.value = String(next);
    updateClockDisplay(next);
    slider.dispatchEvent(new Event("input"));
  }

  $("btn-clock-down")?.addEventListener("click", () => stepClock(+50));
  $("btn-clock-up")?.addEventListener("click", () => stepClock(-50));
  $("btn-clock-down")?.addEventListener("dblclick", () => stepClock(+250));
  $("btn-clock-up")?.addEventListener("dblclick", () => stepClock(-250));

  $("logFile").addEventListener("change", (e) => logger.setLogFile(e.target.checked));

  $("sound-toggle").addEventListener("click", (e) => {
    const enabled = !sound.isEnabled();
    sound.enable(enabled);
    const icon = e.currentTarget.querySelector(".icon");
    if (icon) {
      icon.innerHTML = enabled
        ? '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z" fill="currentColor"/>'
        : '<path d="M16.5 12a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54zM3 9v6h4l5 5V4L7 9H3z" fill="currentColor" opacity="0.5"/><path d="M3 3l18 18-1.5 1.5L1.5 4.5 3 3z" fill="currentColor"/>';
    }
    e.currentTarget.dataset.enabled = enabled;
  });

  $("share-btn").addEventListener("click", copyShareUrl);
  $("tutorial-btn").addEventListener("click", (e) => { e.preventDefault(); openModal("tutorialPopup"); });

  document.querySelectorAll(".modal-close").forEach((b) => {
    b.addEventListener("click", () => closeModal(b.closest(".modal")));
  });
  document.querySelectorAll(".modal").forEach((m) => {
    m.addEventListener("click", (e) => { if (e.target === m) closeModal(m); });
  });
  $("help-link").addEventListener("click", (e) => { e.preventDefault(); openModal("linkPopup"); });
  $("about-link").addEventListener("click", (e) => { e.preventDefault(); openModal("aboutPopup"); });

  // Tab controller for the Activity panel.
  createTabs(document.querySelector(".log-panel"));

  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "F9") { e.preventDefault(); singleStep(); }
    else if (e.key === "F10") { e.preventDefault(); stepPhase(); }
    else if (e.key === "F4") { e.preventDefault(); restartProgram(); }
    else if (e.key === "F5" && e.shiftKey) { e.preventDefault(); runUntilHalt(); }
    else if (e.key === "F5") { e.preventDefault(); runProgram(); }
    else if (e.key === "F6") { e.preventDefault(); executor.isRunning() ? pauseProgram() : runProgram(); }
    else if (e.key === "F8") { e.preventDefault(); stepBack(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault(); downloadLog();
    }
  });

  // Wire the executor's translator so per-instruction notes come out localized.
  executor.setTranslator(t);

  function setExplanationText(text) {
    const a = $("explanation-controls");
    const b = $("explanation-cpu");
    if (a) a.textContent = text;
    if (b) b.textContent = text;
  }

  events.on("tick", (info) => {
    if (info && info.note) setExplanationText(info.note);
    logger.onCycle(cpu, info);
    refreshView();
  });
  events.on("halt", () => {
    sound.halt();
    setPauseIcon(false);
    setExplanationText(t("explanation.hlt"));
    refreshView();
  });
  events.on("run-stop", () => {
    setPauseIcon(false);
  });
  events.on("input-exhausted", () => {
    logger.onInputExhausted();
    pauseProgram();
    refreshView();
  });
  events.on("error", ({ message }) => {
    logger.onError(message);
    pauseProgram();
    refreshView();
  });
  events.on("memory-access", ({ direction }) => {
    const el = direction === "out" ? $("bus-memory-out") : $("bus-memory-in");
    if (!el) return;
    el.dataset.active = "true";
    setTimeout(() => { el.dataset.active = "false"; }, 130);
  });

  // First-time state: shared URL > localStorage > default example.
  const shared = decodeShare(location.hash);
  if (shared) {
    editor.setProgram(shared.source);
    $("input").value = shared.input || "";
    io.setInputText(shared.input || "");
    localStorage.setItem(SOURCE_KEY, shared.source);
    localStorage.setItem(INPUT_KEY, shared.input || "");
    // Drop the consumed hash so a subsequent reload doesn't keep
    // re-importing the shared snapshot — the localStorage copy above is
    // now the source of truth.
    history.replaceState(null, "", location.pathname + location.search);
  } else {
    const savedSource = localStorage.getItem(SOURCE_KEY);
    const savedInput = localStorage.getItem(INPUT_KEY);
    if (savedSource && savedSource.trim().length > 0) editor.setProgram(savedSource);
    else selectExample();
    if (savedInput != null) {
      $("input").value = savedInput;
      io.setInputText(savedInput);
    }
  }

  // Assemble the source that just landed in the editor so RAM matches it.
  // Without this, clicking Step on a fresh page reads RAM[0]=0 (HLT) and
  // immediately halts, leaving subsequent Step clicks no-ops.
  loadProgram();

  $("codeListing").addEventListener("input", () => {
    localStorage.setItem(SOURCE_KEY, $("codeListing").value);
  });

  $("clock-value").textContent = formatClock(Number($("clock").value));
  refreshView();

  // expose clock helper for tests
  globalThis.__fetchcpu = {
    stepClock,
    getClock: () => Number($("clock").value),
    setClock: (v) => { $("clock").value = String(v); updateClockDisplay(v); },
  };
}

// Auto-boot detection: only call boot() in the actual browser, not in tests.
// Vitest's jsdom env exposes `globalThis.__vitest_worker__` so we gate on that.
if (typeof globalThis !== "undefined" &&
    typeof globalThis.__vitest_worker__ === "undefined" &&
    typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}

export { boot, resetBoot };

function resetBoot() { booted = false; }
