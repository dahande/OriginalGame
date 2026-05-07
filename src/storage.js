const KEY = "aomori-ringo-v1";

const defaults = {
  best: 0,
  bestTier: 0,
  sound: true,
};

function readRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeRaw(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function loadState() {
  return { ...defaults, ...readRaw() };
}

export function saveState(patch) {
  const merged = { ...defaults, ...readRaw(), ...patch };
  writeRaw(merged);
  return merged;
}

export function resetBest() {
  return saveState({ best: 0, bestTier: 0 });
}
