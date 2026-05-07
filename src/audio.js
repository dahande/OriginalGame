// Web Audio API でレイテンシの低い 効果音を 音楽的に 合成。
// 音声ファイル不要、ブラウザ間で 安定。
//
// 信号経路:  各音源 → busGain → compressor → masterGain → 出力
//                                        ↘ delay → fbGain → wetGain ↗  ( アンビエンス )

let ctx = null;
let masterGain = null;   // 最終ボリューム
let busGain = null;      // 全効果音の バス ( ここに 各音源を 接続 )
let compressor = null;   // クリップ防止 + グルー
let wetGain = null;      // リバーブ的 ディレイの ウェット量
let enabled = true;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();

  masterGain = ctx.createGain();
  masterGain.gain.value = 0.55;
  masterGain.connect(ctx.destination);

  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;
  compressor.connect(masterGain);

  busGain = ctx.createGain();
  busGain.gain.value = 1.0;
  busGain.connect(compressor);

  // 軽いディレイ・リバーブ ( 厚み付け )
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = 0.13;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  wetGain = ctx.createGain();
  wetGain.gain.value = 0.18;
  // ハイカット フィルタ で 暗い ディレイに
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 4500;

  busGain.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(tone).connect(wetGain).connect(compressor);

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

// 単純な ベース ビープ ( 短い 効果音 )
function envBeep({ freq = 440, type = "sine", dur = 0.15, vol = 0.3, slide = 0, delay = 0, attack = 0.005 }) {
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
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(busGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
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
  src.connect(filter).connect(g).connect(busGain);
  src.start(t0);
}

// ベル / チャイム の 倍音重ね ( 音楽的 )
// 倍音 1, 2, 3.01, 4.2, 5.4 を 比率 [1, 0.5, 0.32, 0.18, 0.1] で 重ねる
function bellTone({ freq = 440, dur = 0.55, vol = 0.22, delay = 0, harmonics = 4 }) {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const ratios = [1, 2, 3.01, 4.2, 5.4, 6.8];
  const amps   = [1.0, 0.55, 0.34, 0.2, 0.12, 0.08];
  const decays = [1.0, 0.85, 0.7, 0.55, 0.4, 0.3];
  const t0 = c.currentTime + delay;
  const n = Math.min(harmonics, ratios.length);
  for (let i = 0; i < n; i++) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * ratios[i], t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol * amps[i], t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * decays[i]);
    osc.connect(g).connect(busGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
}

// ペンタトニック ( ヨナ抜き 風 ) で コンボごとに 音階を 上げる
// ティアの 進行で メロディが 上がっていくように
const PENTATONIC_HZ = [
  261.63,  // C4
  293.66,  // D4
  329.63,  // E4
  392.00,  // G4
  440.00,  // A4
  523.25,  // C5
  587.33,  // D5
  659.25,  // E5
  783.99,  // G5
  880.00,  // A5
  1046.50, // C6
];

function noteForTier(tier) {
  return PENTATONIC_HZ[Math.min(tier, PENTATONIC_HZ.length - 1)];
}

export const sfx = {
  // 落下: 木琴ぽい 短い 「ぽん」
  drop() {
    bellTone({ freq: 440, dur: 0.18, vol: 0.16, harmonics: 2 });
    envBeep({ freq: 220, type: "sine", dur: 0.08, vol: 0.08, slide: -160 });
    noiseBurst({ dur: 0.025, vol: 0.04, freq: 1500, q: 2 });
  },

  // 合体: ベル + 完全5度の 重ね、ティアで メロディが 上昇
  merge(tier) {
    const root = noteForTier(tier);
    // ルート ( ベル )
    bellTone({ freq: root, dur: 0.6, vol: 0.22, harmonics: 4 });
    // 完全5度を 軽く 重ねて 厚み
    bellTone({ freq: root * 1.5, dur: 0.45, vol: 0.10, harmonics: 3, delay: 0.015 });
    // 高音の 装飾 ( キラッ )
    bellTone({ freq: root * 3, dur: 0.25, vol: 0.06, harmonics: 2, delay: 0.04 });
    // 高ティアでは オクターブ上の ハイライト も
    if (tier >= 5) {
      bellTone({ freq: root * 2, dur: 0.55, vol: 0.12, harmonics: 3, delay: 0.02 });
    }
    if (tier >= 8) {
      noiseBurst({ dur: 0.18, vol: 0.05, freq: 5000, q: 2.4, delay: 0.03 });
    }
  },

  // 世界一達成: I-V-vi-IV 風の 上昇カデンツ + 大ベル
  maxTier() {
    // C メジャー トライアド を ベルで 鳴らす
    [261.63, 329.63, 392.00, 523.25].forEach((f, i) => {
      bellTone({ freq: f, dur: 1.6, vol: 0.16, harmonics: 4, delay: i * 0.03 });
    });
    // 上行 アルペジオ
    [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => {
      bellTone({ freq: f, dur: 0.5, vol: 0.12, harmonics: 2, delay: 0.4 + i * 0.09 });
    });
    // シマー ( 高域の 雑味 )
    noiseBurst({ dur: 0.5, vol: 0.05, freq: 6500, q: 1.4, delay: 0.05 });
    noiseBurst({ dur: 0.4, vol: 0.04, freq: 4500, q: 1.6, delay: 0.4 });
  },

  // ゲームオーバー: マイナーコード + 下降
  gameOver() {
    // Am コード ( A, C, E ) を 重ねて
    [220.00, 261.63, 329.63].forEach((f, i) => {
      bellTone({ freq: f, dur: 1.0, vol: 0.16, harmonics: 3, delay: i * 0.05 });
    });
    // 下降ライン
    envBeep({ freq: 220, type: "triangle", dur: 0.5, vol: 0.13, slide: -60, delay: 0.5 });
    envBeep({ freq: 174.61, type: "triangle", dur: 0.7, vol: 0.12, slide: -40, delay: 0.85 });
    // ローエンドの 余韻
    envBeep({ freq: 65, type: "sine", dur: 1.2, vol: 0.18, delay: 0.4, attack: 0.05 });
  },
};
