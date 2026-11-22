export const STAGES = {
  render: "Rendering…",
  chrome: "Running Chrome…",
  metadata: "Embedding metadata…",
  save: "Saving…",
};

// Tracks one export at a time and reports stage changes to listeners.
export function createExportTracker() {
  let busy = false;
  const listeners = new Set();
  const emit = (event) => listeners.forEach((fn) => fn(event));
  return {
    get busy() {
      return busy;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // Returns false when an export is already running.
    start() {
      if (busy) return false;
      busy = true;
      emit({ type: "start" });
      return true;
    },
    stage(name) {
      if (busy && STAGES[name]) emit({ type: "stage", stage: name, label: STAGES[name] });
    },
    finish(outcome) {
      if (!busy) return;
      busy = false;
      emit({ type: "end", outcome });
    },
  };
}
