// URL hash sharing: encode/decode the program source and (optionally)
// input into the URL hash so a link reproduces the same state.

const HASH_PREFIX = "lmc=";

function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeShare(source, input = "") {
  const payload = JSON.stringify({ s: source, i: input });
  const bytes = new TextEncoder().encode(payload);
  return `${HASH_PREFIX}${bytesToBase64(bytes)}`;
}

export function decodeShare(hash) {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  try {
    const b64 = hash.slice(HASH_PREFIX.length);
    const payload = new TextDecoder().decode(base64ToBytes(b64));
    const parsed = JSON.parse(payload);
    return { source: parsed.s ?? "", input: parsed.i ?? "" };
  } catch {
    return null;
  }
}

export function currentShare(source, input) {
  const enc = encodeShare(source, input);
  return `${location.origin}${location.pathname}#${enc}`;
}
