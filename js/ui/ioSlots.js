// Input slots: renders a list of <input type="number"> slots matching the
// INP mnemonics of the loaded program. Each top-level INP gets its own slot.
// If INP lives inside a loop the slot is marked with an "∞" badge and an
// "Add value" button is shown so the user can stage values per iteration.
//
// Range enforcement: the LMC word is 3 digits in nine's complement, so
// valid input values are -499..+500. Values outside that range are flagged
// with the .io-slot-input--invalid class and reported by isValid(). The
// main app refuses to run/step while any slot is invalid.

const DEFAULT_MAX = 50;
const RANGE_MIN = -499;
const RANGE_MAX = 500;
// -499 has 4 chars ("-499"); +500 has 4 chars ("500" with implicit sign).
// We allow 5 chars to be safe with browser quirks on paste.
const MAX_LEN = 5;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "dataset") {
      for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
    } else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== null && v !== undefined && v !== false) {
      node.setAttribute(k, v);
    }
  }
  for (const c of children) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function inRange(n) {
  return Number.isFinite(n) && n >= RANGE_MIN && n <= RANGE_MAX;
}

function parsePasted(text) {
  return text
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

export function createInputSlots(container, options = {}) {
  const t = options.t || ((k) => k);
  const max = options.max ?? DEFAULT_MAX;
  const onChange = options.onChange || (() => {});
  let isLoop = false;
  let count = 0;

  function setValidity(node) {
    const raw = node.value.trim();
    if (raw === "") {
      node.classList.remove("io-slot-input--invalid");
      node.removeAttribute("aria-invalid");
      return;
    }
    const n = Number(raw);
    const ok = inRange(n);
    node.classList.toggle("io-slot-input--invalid", !ok);
    if (ok) node.removeAttribute("aria-invalid");
    else node.setAttribute("aria-invalid", "true");
  }

  function buildSlot(index) {
    const wrap = el("div", { class: "io-slot" + (isLoop ? " io-slot--loop" : "") });
    // Slot label: "#1 INP" — the leading "#N" is the slot index (so the user
    // can see "Value for INP #2"); the trailing "INP" mnemonic badge makes the
    // label unambiguous in the input panel (vs. the output to its right).
    const label = el("span", { class: "io-slot-label" }, [
      `#${index + 1}`,
      el("span", { class: "io-slot-mnemonic" }, ["INP"]),
    ]);
    const input = el("input", {
      type: "number",
      step: "1",
      min: String(RANGE_MIN),
      max: String(RANGE_MAX),
      maxlength: String(MAX_LEN),
      inputmode: "numeric",
      "aria-label": `Input value #${index + 1}`,
      class: "io-slot-input",
      title: `${RANGE_MIN} to ${RANGE_MAX}`,
      oninput: () => { setValidity(input); emitChange(); },
    });
    if (isLoop) {
      const badge = el("span", {
        class: "io-slot-loop-badge",
        title: t("panels.cpu.inputLoopHint"),
      }, ["∞"]);
      wrap.appendChild(label);
      wrap.appendChild(input);
      wrap.appendChild(badge);
    } else {
      wrap.appendChild(label);
      wrap.appendChild(input);
    }
    return { wrap, input };
  }

  function render() {
    container.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const slot = buildSlot(i);
      container.appendChild(slot.wrap);
      setValidity(slot.input);
    }
  }

  function emitChange() {
    onChange(currentValues());
  }

  function setCount(n, asLoop = false) {
    count = Math.max(0, Math.floor(n));
    isLoop = count > 0 && Boolean(asLoop);
    render();
    if (options.addButton) {
      options.addButton.hidden = !isLoop;
    }
    updateCounter();
  }

  function setValues(values) {
    if (!Array.isArray(values)) return;
    render();
    const slots = container.querySelectorAll(".io-slot-input");
    // Truncate to the current slot count. The underlying IO queue retains
    // any extra values, so the user can surface them later by adding
    // slots (via addSlot() or by loading a program with more INPs).
    const trimmed = values.slice(0, slots.length);
    slots.forEach((node, i) => {
      const v = trimmed[i];
      if (v === undefined || v === null || Number.isNaN(v)) return;
      node.value = String(v);
      setValidity(node);
    });
    emitChange();
  }

  function currentValues() {
    const slots = container.querySelectorAll(".io-slot-input");
    const out = [];
    slots.forEach((node) => {
      const v = node.value.trim();
      if (v === "") return;
      const n = Number(v);
      if (Number.isFinite(n)) out.push(n);
    });
    return out;
  }

  // Returns true only when every non-empty slot holds a value inside
  // [-499, 500]. Empty slots are fine (they are skipped by readInput).
  function isValid() {
    const slots = container.querySelectorAll(".io-slot-input");
    for (const node of slots) {
      const raw = node.value.trim();
      if (raw === "") continue;
      if (!inRange(Number(raw))) return false;
    }
    return true;
  }

  // First invalid slot — used to focus + announce the error. Null if all OK.
  function firstInvalid() {
    const slots = container.querySelectorAll(".io-slot-input");
    for (const node of slots) {
      const raw = node.value.trim();
      if (raw === "") continue;
      if (!inRange(Number(raw))) return node;
    }
    return null;
  }

  function addSlot() {
    if (count >= max) return;
    count += 1;
    const slot = buildSlot(count - 1);
    container.appendChild(slot.wrap);
    setValidity(slot.input);
    slot.input.focus();
  }

  // Paste handler at the container level — replace slots with pasted numbers
  // (truncated to count). Skip if the container is detached (tests that boot
  // without the full DOM).
  if (container && typeof container.addEventListener === "function") {
    container.addEventListener("paste", (e) => {
      const text = e.clipboardData?.getData("text") ?? "";
      if (!text) return;
      const nums = parsePasted(text);
      if (nums.length === 0) return;
      e.preventDefault();
      setValues(nums);
    });
  }

  // Helper called by main.js after setCount / setLanguage so the visible
  // counter pill in the panel header stays in sync. The element id is
  // resolved at call time (rather than passed in on construction) so the
  // test harness can change the DOM between boot and counter update.
  function updateCounter() {
    const el = typeof document !== "undefined"
      ? document.getElementById("io-input-counter")
      : null;
    if (!el) return;
    if (count === 0) { el.textContent = ""; return; }
    const key = count === 1 ? "panels.cpu.inputCountOne" : "panels.cpu.inputCountMany";
    el.textContent = t(key, { count });
  }

  return {
    setCount,
    setValues,
    getValues: currentValues,
    addSlot,
    isLoop: () => isLoop,
    count: () => count,
    isValid,
    firstInvalid,
    rangeMin: () => RANGE_MIN,
    rangeMax: () => RANGE_MAX,
    updateCounter,
  };
}
