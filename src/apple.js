// 青森のりんご 11 品種を 進化チェーンで 配置。
// 半径 r は 物理サイズ ( ピクセル )、score は 合体時の 加点。

export const TIERS = [
  { id: 0,  name: "紅玉",          r: 18, color: "#c0271e", score: 1  },
  { id: 1,  name: "千秋",          r: 24, color: "#dd3a2c", score: 3  },
  { id: 2,  name: "つがる",        r: 32, color: "#ec6f3a", score: 6  },
  { id: 3,  name: "きおう",        r: 40, color: "#efc94c", score: 10 },
  { id: 4,  name: "ジョナゴールド", r: 50, color: "#dd8a30", score: 15 },
  { id: 5,  name: "トキ",          r: 60, color: "#f1d36f", score: 21 },
  { id: 6,  name: "シナノスイート", r: 72, color: "#a31a1a", score: 28 },
  { id: 7,  name: "王林",          r: 86, color: "#bccf6c", score: 36 },
  { id: 8,  name: "陸奥",          r: 100, color: "#9bb558", score: 45 },
  { id: 9,  name: "ふじ",          r: 116, color: "#cd2f2a", score: 55 },
  { id: 10, name: "世界一",        r: 134, color: "#811414", score: 66 },
];

export const MAX_TIER = TIERS.length - 1;
export const STEM_COLOR = "#5a3a1a";
export const LEAF_COLOR = "#3f8c3f";

// プレイヤーが ドロップ可能な ティア ( 0..3 )
export const DROPPABLE_TIERS = 4;

export function pickDropTier() {
  return Math.floor(Math.random() * DROPPABLE_TIERS);
}

export function drawApple(ctx, x, y, r, tier, opts = {}) {
  const t = TIERS[tier];
  const { opacity = 1, danger = 0 } = opts;
  ctx.save();
  ctx.globalAlpha = opacity;

  // 影
  ctx.fillStyle = "rgba(60, 30, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(x + r * 0.05, y + r * 0.95, r * 0.85, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // 危険オーラ
  if (danger > 0.05) {
    ctx.save();
    const auraR = r + 10 + danger * 6;
    const aura = ctx.createRadialGradient(x, y, r * 0.9, x, y, auraR);
    aura.addColorStop(0, `rgba(255, 60, 60, ${0.0})`);
    aura.addColorStop(1, `rgba(255, 60, 60, ${0.45 * danger})`);
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y, auraR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 本体
  const body = ctx.createRadialGradient(x - r * 0.32, y - r * 0.32, r * 0.05, x, y, r);
  body.addColorStop(0, lighten(t.color, 0.5));
  body.addColorStop(0.4, lighten(t.color, 0.12));
  body.addColorStop(0.85, t.color);
  body.addColorStop(1, darken(t.color, 0.45));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // 上の くぼみ
  ctx.fillStyle = darken(t.color, 0.5);
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.93, r * 0.22, r * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  // 軸
  ctx.fillStyle = STEM_COLOR;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.06, y - r * 0.88);
  ctx.lineTo(x + r * 0.06, y - r * 0.88);
  ctx.lineTo(x + r * 0.08, y - r * 1.18);
  ctx.lineTo(x - r * 0.08, y - r * 1.18);
  ctx.closePath();
  ctx.fill();

  // 葉
  ctx.fillStyle = LEAF_COLOR;
  ctx.beginPath();
  ctx.ellipse(x + r * 0.26, y - r * 1.02, r * 0.24, r * 0.1, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = darken(LEAF_COLOR, 0.3);
  ctx.lineWidth = Math.max(1, r * 0.025);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.06, y - r * 0.98);
  ctx.lineTo(x + r * 0.46, y - r * 1.06);
  ctx.stroke();

  // ハイライト
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.42, y - r * 0.42, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // 品種名
  if (r >= 24) {
    const fs = Math.max(10, r * 0.22);
    ctx.font = `800 ${fs}px "Hiragino Sans", "Yu Gothic UI", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(2, fs * 0.22);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    ctx.strokeText(t.name, x, y + r * 0.12);
    ctx.fillText(t.name, x, y + r * 0.12);
  }

  ctx.restore();
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function lighten(hex, amt) { return mix(hex, "#ffffff", clamp01(amt)); }
function darken(hex, amt)  { return mix(hex, "#000000", clamp01(amt)); }
function mix(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const c = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, c].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
