// Random Access Memory: 100 cells (00..99)
// Each cell holds an integer. The simulator displays values in three digits
// and treats the Accumulator as signed (-499..+500) using nine's complement.
// Stored cell values follow whatever convention the caller chooses.

export const RAM_SIZE = 100;

export function createRAM(initial = {}) {
  const cells = new Array(RAM_SIZE).fill(0);
  for (const [addr, value] of Object.entries(initial)) {
    cells[Number(addr)] = Math.trunc(Number(value));
  }
  let lastWritten = -1;

  return {
    read(addr) {
      const a = normalizeAddr(addr);
      return cells[a];
    },
    write(addr, value) {
      const a = normalizeAddr(addr);
      const v = Math.trunc(Number(value));
      if (cells[a] !== v) {
        cells[a] = v;
        lastWritten = a;
      }
      return v;
    },
    getLastWritten() {
      const lw = lastWritten;
      lastWritten = -1;
      return lw;
    },
    snapshot() {
      return cells.slice();
    },
    load(values) {
      for (let i = 0; i < RAM_SIZE; i++) cells[i] = 0;
      for (const [addr, value] of Object.entries(values)) {
        cells[Number(addr)] = Math.trunc(Number(value));
      }
    },
    reset() {
      for (let i = 0; i < RAM_SIZE; i++) cells[i] = 0;
      lastWritten = -1;
    },
    format(addr) {
      return String(cells[normalizeAddr(addr)]).padStart(3, "0");
    },
  };
}

export function normalizeAddr(addr) {
  const n = Number(addr);
  if (!Number.isInteger(n) || n < 0 || n >= RAM_SIZE) {
    throw new RangeError(`Invalid memory address: ${addr}`);
  }
  return n;
}
