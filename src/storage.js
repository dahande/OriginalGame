const KEY = "bubble-smash-v1";

const defaults = {
  best: 0,
  sound: true,
  haptic: true,
  fx: "medium",
  difficulty: "normal",
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
    /* quota exceeded or storage disabled — ignore */
  }
}

export function loadState() {
  return { ...defaults, ...readRaw() };
}

export function saveState(patch) {
  const merged = { ...readRaw(), ...patch };
  writeRaw(merged);
  return merged;
}

export function resetBest() {
  return saveState({ best: 0 });
}
