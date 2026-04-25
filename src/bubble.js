export const TYPES = {
  NORMAL:  "normal",
  BOMB:    "bomb",
  RAINBOW: "rainbow",
  GOLD:    "gold",
};

export const STRESS_WORDS = [
  "会議", "締切", "メール", "残業", "報告書", "上司",
  "満員電車", "月曜日", "クレーム", "資料", "押印",
  "電話", "Slack", "ミス", "雑用", "バグ", "監査",
  "請求書", "進捗", "見積もり", "稟議", "面接",
];

export function pickStressWord() {
  return STRESS_WORDS[(Math.random() * STRESS_WORDS.length) | 0];
}

export const RAGE_POPS = ["粉砕!", "撃破!", "破壊!", "KO!", "スカッ!", "ざまみろ!", "解放!"];

const NORMAL_PALETTE = [
  "#ff5fa2", "#ffb347", "#ffd860", "#a4ff5f",
  "#5ad7ff", "#c08bff", "#ff7676", "#7affd1",
];

export function pickType() {
  const r = Math.random();
  if (r < 0.012) return TYPES.RAINBOW;
  if (r < 0.05)  return TYPES.GOLD;
  if (r < 0.13)  return TYPES.BOMB;
  return TYPES.NORMAL;
}

export class Bubble {
  constructor() { this.reset(); }

  reset(opts = {}) {
    this.alive = true;
    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    this.r = opts.r ?? 28;
    this.targetR = this.r;
    this.vx = opts.vx ?? 0;
    this.vy = opts.vy ?? -60;
    this.type = opts.type ?? TYPES.NORMAL;
    this.color = opts.color ?? NORMAL_PALETTE[(Math.random() * NORMAL_PALETTE.length) | 0];
    this.label = opts.label ?? null;
    this.age = 0;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 1.4 + Math.random() * 1.2;
    this.wobbleAmp = 14 + Math.random() * 14;
    this.spawnT = 0;
    return this;
  }

  update(dt, h) {
    this.age += dt;
    this.wobble += this.wobbleSpeed * dt;
    if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt * 4);
    }
    this.x += this.vx * dt + Math.sin(this.wobble) * this.wobbleAmp * dt;
    this.y += this.vy * dt;
    if (this.y < -this.r * 2) this.alive = false;
  }

  hit(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    const r = this.r * (0.5 + 0.5 * this.spawnT);
    return dx * dx + dy * dy <= r * r;
  }

  draw(ctx, time) {
    const r = this.r * (0.5 + 0.5 * this.spawnT);
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.type === TYPES.RAINBOW) {
      const grad = ctx.createConicGradient ? ctx.createConicGradient(time * 2, 0, 0) : null;
      if (grad) {
        grad.addColorStop(0,    "#ff5fa2");
        grad.addColorStop(0.16, "#ffb347");
        grad.addColorStop(0.33, "#ffd860");
        grad.addColorStop(0.5,  "#a4ff5f");
        grad.addColorStop(0.66, "#5ad7ff");
        grad.addColorStop(0.83, "#c08bff");
        grad.addColorStop(1,    "#ff5fa2");
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = "#ff5fa2";
      }
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === TYPES.BOMB) {
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      // ヒューズ
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r * 0.4, -r * 1.4, r * 0.6, -r * 1.55);
      ctx.stroke();
      // スパーク
      const spark = (Math.sin(time * 30) + 1) * 0.5;
      ctx.fillStyle = `rgba(255, ${140 + spark * 100}, 60, ${0.6 + spark * 0.4})`;
      ctx.beginPath();
      ctx.arc(r * 0.6, -r * 1.55, 4 + spark * 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === TYPES.GOLD) {
      const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      grad.addColorStop(0, "#fff8d2");
      grad.addColorStop(0.5, "#ffd860");
      grad.addColorStop(1, "#a87b00");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      // キラッ
      ctx.fillStyle = "rgba(255, 255, 200, 0.6)";
      const sp = (Math.sin(time * 6 + this.wobble) + 1) * 0.5;
      ctx.beginPath();
      ctx.arc(r * 0.35, -r * 0.35, 2 + sp * 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      grad.addColorStop(0.35, this.color);
      grad.addColorStop(1, shade(this.color, -40));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 共通ハイライト
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.25, r * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // 縁取り
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // ストレスワード ( rage モード )
    if (this.label) {
      const fontSize = Math.max(10, Math.min(r * 0.55, 22));
      ctx.font = `900 ${fontSize}px "Hiragino Sans", "Yu Gothic UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
      ctx.strokeText(this.label, 0, 1);
      ctx.fillStyle = "#fff";
      ctx.fillText(this.label, 0, 1);
    }

    ctx.restore();
  }

  paletteColors() {
    if (this.type === TYPES.RAINBOW) return NORMAL_PALETTE;
    if (this.type === TYPES.BOMB) return ["#ff7676", "#ffb347", "#ffd860", "#3a3a3a"];
    if (this.type === TYPES.GOLD) return ["#fff8d2", "#ffd860", "#fff", "#ffb347"];
    return [this.color, shade(this.color, 30), "#ffffff"];
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.replace("#", ""), 16);
  let r = (n >> 16) + amt;
  let g = ((n >> 8) & 0xff) + amt;
  let b = (n & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
