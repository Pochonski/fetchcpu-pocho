// Small dispatcher so any module can subscribe to simulator events:
//   tick: fired after every FDE cycle
//   load: fired after a program is loaded into RAM
//   run-start / run-stop: when auto-execution starts/stops
//   flag: fires whenever ACC state (zero / negative / positive) changes
//   error: simulator error message

export function createEvents() {
  const listeners = new Map();
  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => listeners.get(event).delete(fn);
    },
    emit(event, payload) {
      const subs = listeners.get(event);
      if (!subs) return;
      for (const fn of subs) {
        try { fn(payload); }
        catch { /* swallow subscriber errors */ }
      }
    },
    clear(event) {
      if (event) listeners.delete(event);
      else listeners.clear();
    },
  };
}
