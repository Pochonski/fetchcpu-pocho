// Export / import .fcpu program files. The .fcpu format is plain text:
//   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   ; Lines starting with ';' are comments
//   INP
//   STA num1
//   ...
//   num1 DAT
//   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// JSON metadata (input values) is stored after a separator.

const META_SEPARATOR = ";; INPUT:";

export function exportFile(source, input = "") {
  if (input && input.trim().length > 0) {
    return [source.trimEnd(), META_SEPARATOR, input].join("\n");
  }
  return source;
}

export function parseFile(text) {
  const idx = text.indexOf(META_SEPARATOR);
  if (idx === -1) return { source: text, input: "" };
  return {
    source: text.slice(0, idx).trimEnd(),
    input: text.slice(idx + META_SEPARATOR.length).trim(),
  };
}

export function downloadAs(source, input, filename = "program.fcpu") {
  const blob = new Blob([exportFile(source, input)], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 250);
}
