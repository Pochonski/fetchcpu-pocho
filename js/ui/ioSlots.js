// Input slots: renders a list of <input type="number"> slots matching the
// INP mnemonics of the loaded program. Each top-level INP gets its own slot.
// If INP lives inside a loop the slot is marked with an "∞" badge and an
// "Add value" button is shown so the user can stage values per iteration.

const DEFAULT_MAX = 50;

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

  function buildSlot(index) {
    const wrap = el("div", { class: "io-slot" + (isLoop ? " io-slot--loop" : "") });
    const label = el("span", { class: "io-slot-label" }, [`#${index + 1}`]);
    const input = el("input", {
      type: "number",
      step: "1",
      min: "-499",
      max: "500",
      inputmode: "numeric",
      "aria-label": `Input value #${index + 1}`,
      class: "io-slot-input",
      oninput: () => emitChange(),
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
  }

  function setValues(values) {
    if (!Array.isArray(values)) return;
    render();
    const slots = container.querySelectorAll(".io-slot-input");
    const trimmed = values.slice(0, slots.length);
    slots.forEach((node, i) => {
      const v = trimmed[i];
      if (v === undefined || v === null || Number.isNaN(v)) return;
      node.value = String(v);
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

  function addSlot() {
    if (count >= max) return;
    count += 1;
    const slot = buildSlot(count - 1);
    container.appendChild(slot.wrap);
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

  return {
    setCount,
    setValues,
    getValues: currentValues,
    addSlot,
    isLoop: () => isLoop,
    count: () => count,
  };
}
