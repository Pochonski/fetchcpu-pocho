// Assembly syntax highlighter used as a transparent overlay above a textarea.
// The textarea carries the caret and editable content; the overlay is a
// styled <pre> that mirrors the text for visual highlighting.

const MNEMONICS = new Set([
  "INP", "OUT",
  "LDA", "STA", "ADD", "SUB",
  "BRP", "BRZ", "BRA",
  "HLT", "DAT",
]);

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Highlight a single line into HTML. Operates on the text up until any comment.
function highlightLine(rawLine) {
  const commentIdx = findCommentIdx(rawLine);
  const code = commentIdx === -1 ? rawLine : rawLine.slice(0, commentIdx);
  const comment = commentIdx === -1 ? "" : rawLine.slice(commentIdx);

  let html = "";
  let rest = code;
  let i = 0;
  let labelEmitted = false;

  // Tokens at position 0 with no label can still be a mnemonic.
  while (rest.length > 0) {
    const skipWs = rest.match(/^\s*/)[0];
    rest = rest.slice(skipWs.length);
    i += skipWs.length;
    if (rest.length === 0) break;

    // Mode prefix (# immediate / @ indirect).
    if (rest[0] === "#" || rest[0] === "@") {
      const cls = rest[0] === "#" ? "tk-immediate" : "tk-indirect";
      html += `<span class="${cls}">${escapeHtml(rest[0])}</span>`;
      rest = rest.slice(1);
      i += 1;
      continue;
    }

    const labelMatch = rest.match(/^[A-Za-z_][A-Za-z0-9_]*:/);
    if (labelMatch) {
      html += `<span class="tk-label">${escapeHtml(labelMatch[0])}</span>`;
      rest = rest.slice(labelMatch[0].length);
      i += labelMatch[0].length;
      labelEmitted = true;
      continue;
    }

    const identMatch = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identMatch) {
      const tok = identMatch[0];
      // Is the previous-line identifier a label? Look at the source line so we
      // can detect "loop OUT" patterns. The caller passes rawLine, we just
      // assume first token that is followed by whitespace + mnemonic = label.
      const next = rest.slice(tok.length).trimStart();
      const followedByMnemonic = MNEMONICS.has(next.split(/\s+/)[0]?.toUpperCase());
      if (i === 0 && followedByMnemonic && !labelEmitted) {
        html += `<span class="tk-label">${escapeHtml(tok)}</span>`;
        labelEmitted = true;
      } else if (MNEMONICS.has(tok.toUpperCase())) {
        html += `<span class="${mnemonicClass(tok.toUpperCase())}">${escapeHtml(tok)}</span>`;
      } else {
        html += escapeHtml(tok);
      }
      rest = rest.slice(tok.length);
      i += tok.length;
      continue;
    }

    const numMatch = rest.match(/^-?\d+/);
    if (numMatch) {
      html += `<span class="tk-numeric">${escapeHtml(numMatch[0])}</span>`;
      rest = rest.slice(numMatch[0].length);
      i += numMatch[0].length;
      continue;
    }

    html += escapeHtml(rest[0]);
    rest = rest.slice(1);
    i += 1;
  }

  if (comment) {
    html += `<span class="tk-comment">${escapeHtml(comment)}</span>`;
  }
  return html || "&nbsp;";
}

function findCommentIdx(line) {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inString = !inString;
    if (inString) continue;
    if (line[i] === ";") return i;
    if (line[i] === "/" && line[i + 1] === "/") return i;
  }
  return -1;
}

function mnemonicClass(m) {
  switch (m) {
    case "INP":
    case "OUT": return "tk-mnemonic tk-mnemonic-io";
    case "HLT": return "tk-mnemonic tk-mnemonic-hlt";
    case "BRP":
    case "BRZ":
    case "BRA": return "tk-mnemonic tk-mnemonic-branch";
    default: return "tk-mnemonic";
  }
}

export function createEditorView(textareaEl, gutterEl, highlightEl, { onChange, onToggleBreakpoint } = {}) {
  const state = {
    breakpoints: new Set(),
  };

  function rerender() {
    const lines = textareaEl.value.split("\n");
    gutterEl.innerHTML = "";
    const fragments = [];
    lines.forEach((line, idx) => {
      const div = document.createElement("div");
      div.className = "gutter-line";
      div.dataset.line = idx;
      if (state.breakpoints.has(idx)) div.classList.add("has-bp");
      div.innerHTML = `<span class="bp-dot"></span><span class="line-num">${String(idx + 1).padStart(3, " ")}</span>`;
      gutterEl.appendChild(div);
      fragments.push(highlightLine(line));
    });
    highlightEl.innerHTML = fragments.join("\n");
    if (typeof onChange === "function") onChange(state);
  }

  function toggleBreakpoint(lineIdx) {
    if (state.breakpoints.has(lineIdx)) state.breakpoints.delete(lineIdx);
    else state.breakpoints.add(lineIdx);
    rerender();
    if (typeof onToggleBreakpoint === "function") onToggleBreakpoint(state.breakpoints);
  }

  // Click on gutter to toggle breakpoint.
  gutterEl.addEventListener("click", (e) => {
    const lineEl = e.target.closest(".gutter-line");
    if (!lineEl) return;
    toggleBreakpoint(Number(lineEl.dataset.line));
  });

  // Sync scrolling: gutter and highlight both follow textarea.
  function syncScroll() {
    gutterEl.scrollTop = textareaEl.scrollTop;
    highlightEl.scrollTop = textareaEl.scrollTop;
    highlightEl.scrollLeft = textareaEl.scrollLeft;
  }
  textareaEl.addEventListener("scroll", syncScroll);
  textareaEl.addEventListener("input", rerender);
  textareaEl.addEventListener("keyup", syncScroll);

  // Resize observer to keep the overlay aligned when the panel stretches.
// Held in a closure so destroy() can disconnect it (no listener leak across
// re-boots of the app in test harnesses).
  let resizeObserver = null;
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(syncScroll);
    resizeObserver.observe(textareaEl);
  }

  rerender();

  return {
    state,
    rerender,
    syncScroll,
    setProgram(text) {
      textareaEl.value = text;
      rerender();
    },
    highlightLine(sourceLineNumber) {
      const spans = gutterEl.querySelectorAll(".gutter-line");
      spans.forEach((s) => s.classList.remove("active"));
      if (sourceLineNumber == null) return;
      const span = spans[sourceLineNumber - 1];
      if (span) {
        span.classList.add("active");
        setTimeout(() => span.classList.remove("active"), 600);
      }
    },
    destroy() {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    },
  };
}
