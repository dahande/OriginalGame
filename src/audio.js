// Web Audio API でレイテンシの低い効果音を合成する。
// 音声ファイル不要、かつブラウザ間で安定する。

let ctx = null;
let masterGain = null;
let enabled = true;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.6;
  masterGain.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = ensureCtx();
  if (c && c.state === "suspended") c.resume();
}

export function setSoundEnabled(v) {
  enabled = !!v;
  if (masterGain) masterGain.gain.value = enabled ? 0.6 : 0;
}

function envBeep({ freq = 440, type = "sine", dur = 0.15, vol = 0.3, slide = 0, delay = 0 }) {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst({ dur = 0.18, vol = 0.25, freq = 1200, q = 0.9, delay = 0 }) {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(masterGain);
  src.start(t0);
}

export const sfx = {
  pop(combo = 0) {
    const base = 540 + Math.min(combo, 30) * 28;
    envBeep({ freq: base, type: "triangle", dur: 0.09, vol: 0.22, slide: -300 });
    noiseBurst({ dur: 0.08, vol: 0.12, freq: 2200, q: 1.2 });
  },
  bomb() {
    envBeep({ freq: 180, type: "square", dur: 0.25, vol: 0.3, slide: -120 });
    noiseBurst({ dur: 0.4, vol: 0.32, freq: 380, q: 0.6 });
    noiseBurst({ dur: 0.25, vol: 0.18, freq: 90, q: 0.5, delay: 0.04 });
  },
  rainbow() {
    [0, 0.05, 0.1, 0.16, 0.22].forEach((d, i) => {
      envBeep({ freq: 520 + i * 110, type: "triangle", dur: 0.18, vol: 0.18, slide: 200, delay: d });
    });
    noiseBurst({ dur: 0.5, vol: 0.18, freq: 3200, q: 0.8 });
  },
  gold() {
    envBeep({ freq: 880, type: "sine", dur: 0.12, vol: 0.22 });
    envBeep({ freq: 1320, type: "sine", dur: 0.18, vol: 0.18, delay: 0.07 });
    envBeep({ freq: 1760, type: "sine", dur: 0.22, vol: 0.16, delay: 0.14 });
  },
  combo(combo) {
    const f = 660 + Math.min(combo, 40) * 35;
    envBeep({ freq: f, type: "sine", dur: 0.16, vol: 0.22, slide: 300 });
  },
  miss() {
    envBeep({ freq: 220, type: "sawtooth", dur: 0.12, vol: 0.12, slide: -120 });
  },
};
