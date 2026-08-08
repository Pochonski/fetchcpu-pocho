// Random Access Memory view.
//
// Each cell is a small card showing:
//   * Address badge (00..99)
//   * Mnemonic badge if it looks like an instruction (INP, LDA, ...) or DAT
//   * Raw 3-digit value (with a leading "-" for negative)
//   * Label (if the loader mapped a label onto this cell)
//
// A horizontal "memory map" above the cells visualises used / instruction /
// data cells at a glance.

const MNEMONIC_BY_OPCODE = {
  901: "INP",
  902: "OUT",
  5: "LDA",
  3: "STA",
  1: "ADD",
  2: "SUB",
  8: "BRP",
  7: "BRZ",
  6: "BRA",
};

function disassemble(word) {
  if (word === 901) return { tag: "INP", operand: "" };
  if (word === 902) return { tag: "OUT", operand: "" };
  if (word === 0)   return { tag: "HLT", operand: "" };
  const opcode = Math.floor(word / 100);
  const operand = word % 100;
  const tag = MNEMONIC_BY_OPCODE[opcode];
  if (!tag) return { tag: "DAT", operand: String(word) };
  return { tag, operand: String(operand).padStart(2, "0") };
}

function formatValue(word) {
  // Display as 3-digit unsigned by default, but show sign for negative.
  if (word < 0) return `-${String(-word).padStart(3, "0")}`;
  return String(word).padStart(3, "0");
}

export function createRAMView(ram, cpu) {
  const root = document.getElementById("ram-body");
  const mapEl = document.getElementById("ram-map");
  const statsEl = document.getElementById("ram-stats");
  if (!root) throw new Error("ram-body element missing");

  // Cell metadata received from the loader.
  const labelsByAddr = new Map();
  const instrByAddr = new Set();
  const dataByAddr = new Set();
  const immediateByAddr = new Set();

  let lastModified = -1;
  let modifiedFlash = 0;

  // --- Layout: grid of 10 columns × 10 rows ---
  root.innerHTML = "";

  // Column header row.
  const headRow = document.createElement("tr");
  headRow.className = "ram-row ram-row-head";
  headRow.appendChild(headerCell(""));
  for (let c = 0; c < 10; c++) headRow.appendChild(headerCell(`0${c}`));
  root.appendChild(headRow);

  // Cell rows.
  const rows = [];
  const cells = [];
  for (let r = 0; r < 10; r++) {
    const tr = document.createElement("tr");
    tr.className = "ram-row";
    tr.appendChild(headerCell(`${r}0`, true));
    const rowCells = [];
    for (let c = 0; c < 10; c++) {
      const addr = r * 10 + c;
      const td = document.createElement("td");
      td.className = "ram-cell";
      td.dataset.addr = addr;
      td.innerHTML = `
        <span class="cell-addr"></span>
        <div class="cell-stack">
          <span class="cell-tag"></span>
          <span class="cell-value"></span>
          <span class="cell-label"></span>
        </div>
        <input class="cell-input" type="text" value="000" maxlength="3" inputmode="numeric" aria-label="Edit cell ${addr}" />
      `;
      const input = td.querySelector(".cell-input");
      input.addEventListener("focus", () => { tdFocus(addr); });
      input.addEventListener("blur", () => { tdBlur(addr); });
      input.addEventListener("input", () => {
        const v = clampInput(input.value);
        ram.write(addr, v);
        sync();
      });
      td.dataset.editing = "false";
      tr.appendChild(td);
      rowCells.push(td);
    }
    root.appendChild(tr);
    rows.push(tr);
    cells.push(...rowCells);
  }

  function tdFocus(addr) {
    const td = cells[addr];
    if (td) td.dataset.editing = "true";
  }
  function tdBlur(addr) {
    const td = cells[addr];
    if (td) td.dataset.editing = "false";
    sync();
  }

  function headerCell(text, isRow = false) {
    const td = document.createElement("td");
    td.className = "ram-header";
    if (isRow) td.dataset.row = "true";
    td.textContent = text;
    return td;
  }

  function clampInput(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    if (n > 999) return 999;
    if (n < -999) return -999;
    return Math.trunc(n);
  }

  // --- Program metadata ---
  function setProgramMetadata(metadata) {
    labelsByAddr.clear();
    instrByAddr.clear();
    dataByAddr.clear();
    immediateByAddr.clear();
    if (!metadata) return;
    if (metadata.labels) {
      for (const [name, addr] of Object.entries(metadata.labels)) labelsByAddr.set(Number(addr), name);
    }
    if (Array.isArray(metadata.instructions)) {
      for (const instr of metadata.instructions) {
        const addr = Number(instr.address);
        if (instr.mnemonic === "DAT") dataByAddr.add(addr);
        else instrByAddr.add(addr);
      }
    }
    if (Array.isArray(metadata.immediates)) {
      for (const a of metadata.immediates) immediateByAddr.add(Number(a));
    }
    sync();
  }

  function sync() {
    const pc = cpu.state.pc;
    const mar = cpu.state.mar;
    if (ram.getLastWritten() >= 0) {
      lastModified = ram.getLastWritten();
      modifiedFlash = Date.now();
    }
    let used = 0, codeCount = 0, dataCount = 0;

    for (let i = 0; i < 100; i++) {
      const td = cells[i];
      const inp = td.querySelector("input");
      const tag = td.querySelector(".cell-tag");
      const valueEl = td.querySelector(".cell-value");
      const addrEl = td.querySelector(".cell-addr");
      const labelEl = td.querySelector(".cell-label");
      const value = ram.read(i);
      const isInstr = instrByAddr.has(i);
      const isData = dataByAddr.has(i) || immediateByAddr.has(i);
      const wasModified = lastModified === i && (Date.now() - modifiedFlash) < 300;

      const formatted = formatValue(value);
      // Always update both the read-only display and the (hidden) input so
      // editing picks up the latest RAM value.
      valueEl.textContent = formatted;
      if (!td.hasAttribute("data-editing") || td.dataset.editing === "false") {
        inp.value = formatted;
      }
      addrEl.textContent = String(i).padStart(2, "0");
      const dis = disassemble(value);
      // If the loader says this is a DAT cell, prefer that tag (regardless of value).
      let displayTag = dis.tag;
      if (dataByAddr.has(i) || immediateByAddr.has(i)) displayTag = "DAT";
      // If it's a known instruction cell, prefer the mnemonic we recognise at load time.
      if (instrByAddr.has(i)) displayTag = dis.tag === "DAT" ? "DAT" : dis.tag;
      tag.textContent = displayTag;
      tag.dataset.tag = displayTag.toLowerCase();
      tag.title = displayTag + (dis.operand ? ` ${dis.operand}` : "");
      const labelName = labelsByAddr.get(i);
      labelEl.textContent = labelName || "";

      // Counts
      if (isInstr || isData || value !== 0) used++;
      if (isInstr) codeCount++;
      if (isData) dataCount++;

      // State classes
      td.dataset.pc = i === pc ? "true" : "false";
      td.dataset.mar = i === mar ? "true" : "false";
      td.dataset.instr = isInstr ? "true" : "false";
      td.dataset.data = isData ? "true" : "false";
      td.dataset.modified = wasModified ? "true" : "false";
      td.dataset.immediate = immediateByAddr.has(i) ? "true" : "false";
    }

    if (mapEl) {
      mapEl.innerHTML = "";
      for (let i = 0; i < 100; i++) {
        const d = document.createElement("div");
        d.className = "ram-map-cell";
        if (instrByAddr.has(i)) d.classList.add("map-code");
        else if (dataByAddr.has(i) || immediateByAddr.has(i)) d.classList.add("map-data");
        else if (ram.read(i) !== 0) d.classList.add("map-data");
        if (i === pc) d.classList.add("map-pc");
        if (i === mar) d.classList.add("map-mar");
        mapEl.appendChild(d);
      }
    }
    if (statsEl) {
      statsEl.innerHTML = `
        <span><strong>${used}</strong>/100 used</span>
        <span class="dot dot-code"></span><strong>${codeCount}</strong> instructions
        <span class="dot dot-data"></span><strong>${dataCount}</strong> data
      `;
    }
  }

  return { sync, setProgramMetadata };
}
