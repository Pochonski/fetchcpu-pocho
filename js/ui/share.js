// URL hash sharing: encode/decode the program source and (optionally)
// input into the URL hash so a link reproduces the same state.

const HASH_PREFIX = "lmc=";

export function encodeShare(source, input = "") {
  const payload = JSON.stringify({ s: source, i: input });
  // Use encodeURIComponent-friendly base64 (browser-safe).
  const b64 = btoa(unescape(encodeURIComponent(payload)));
  return `${HASH_PREFIX}${b64}`;
}

export function decodeShare(hash) {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  try {
    const b64 = hash.slice(HASH_PREFIX.length);
    const payload = JSON.parse(decodeURIComponent(escape(atob(b64))));
    return { source: payload.s ?? "", input: payload.i ?? "" };
  } catch {
    return null;
  }
}

export function currentShare(source, input) {
  const enc = encodeShare(source, input);
  return `${location.origin}${location.pathname}#${enc}`;
}
