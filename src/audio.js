// Web Audio API でレイテンシの低い効果音を 合成。
// 音声ファイル不要、ブラウザ間で 安定。

let ctx = null;
let masterGain = null;
let enabled = true;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.55;
  masterGain.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = ensureCtx();
  if (c && c.state === "suspended") c.resume();
}

export function setSoundEnabled(v) {
  enabled = !!v;
  if (masterGain) masterGain.gain.value = enabled ? 0.55 : 0;
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

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
function pentNote(tier) {
  const semis = PENTATONIC[Math.min(tier, PENTATONIC.length - 1)];
  return 330 * Math.pow(2, semis / 12);
}

export const sfx = {
  drop() {
    envBeep({ freq: 280, type: "sine", dur: 0.07, vol: 0.18, slide: -120 });
    noiseBurst({ dur: 0.04, vol: 0.06, freq: 900, q: 1.4 });
  },
  merge(tier) {
    const f = pentNote(tier);
    envBeep({ freq: f,        type: "sine",     dur: 0.16, vol: 0.22 });
    envBeep({ freq: f * 1.5,  type: "triangle", dur: 0.22, vol: 0.16, delay: 0.04 });
    envBeep({ freq: f * 2,    type: "sine",     dur: 0.18, vol: 0.12, delay: 0.08 });
    noiseBurst({ dur: 0.06, vol: 0.06, freq: 2400, q: 1.6 });
  },
  maxTier() {
    const base = 523;
    [0, 0.09, 0.18, 0.28, 0.4, 0.55].forEach((d, i) => {
      envBeep({ freq: base * Math.pow(1.122, i), type: "sine", dur: 0.28, vol: 0.22, delay: d });
    });
  },
  gameOver() {
    envBeep({ freq: 440, type: "sawtooth", dur: 0.4,  vol: 0.18, slide: -300 });
    envBeep({ freq: 220, type: "sawtooth", dur: 0.55, vol: 0.16, slide: -120, delay: 0.3 });
    envBeep({ freq: 110, type: "sine",     dur: 0.7,  vol: 0.14, delay: 0.6 });
  },
  hover() {
    envBeep({ freq: 660, type: "sine", dur: 0.04, vol: 0.06 });
  },
};
