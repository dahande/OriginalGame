// 青森のりんご 11 品種を 進化チェーンで 配置。
// 半径 r は 物理サイズ ( ピクセル )、score は 合体時の 加点。
// 各品種は 実物の 特徴 ( 縞 / 斑点 / 果点 / 二色 ) を 持つ。
//
// imageUrl は バンドルした 実物の 写真 ( Fruit-Images-Dataset, MIT,
// (c) 2017-2020 Mihai Oltean and Horea Muresan より 各品種に 近い 色味の
// りんごを マッピング )。読み込み失敗時は 自前の Canvas 描画に フォールバック。

const IMG = (file) => `img/varieties/${file}`;

const VARIETIES = [
  { id: 0,  name: "紅玉",          r: 18,  score: 1,
    base: "#c0271e", deep: "#7a0d0a",
    pattern: { type: "solid" },
    speckles: { count: 5,  color: "#fbe6c0", opacity: 0.45 },
    imageUrl: IMG("kougyoku.jpg") },
  { id: 1,  name: "千秋",          r: 24,  score: 3,
    base: "#dd3a2c", deep: "#86120c",
    pattern: { type: "solid" },
    speckles: { count: 8,  color: "#fbe6c0", opacity: 0.4 },
    imageUrl: IMG("senshu.jpg") },
  { id: 2,  name: "つがる",        r: 32,  score: 6,
    base: "#e76e3d", deep: "#9a3010",
    pattern: { type: "stripes-mild", stripe: "#9a2814", count: 16, opacity: 0.32 },
    speckles: { count: 10, color: "#fbe6c0", opacity: 0.4 },
    imageUrl: IMG("tsugaru.jpg") },
  { id: 3,  name: "きおう",        r: 40,  score: 10,
    base: "#f0d54e", deep: "#9a7820",
    pattern: { type: "blush", color: "#e89a30", side: 0.7, strength: 0.35 },
    speckles: { count: 14, color: "#a06820", opacity: 0.5 },
    imageUrl: IMG("kio.jpg") },
  { id: 4,  name: "ジョナゴールド", r: 50,  score: 15,
    base: "#e8b248", deep: "#7a4a10",
    pattern: { type: "bicolor", topColor: "#cc2820", bottomColor: "#e8b248", split: 0.55 },
    speckles: { count: 14, color: "#fff0c0", opacity: 0.4 },
    imageUrl: IMG("jonagold.jpg") },
  { id: 5,  name: "トキ",          r: 60,  score: 21,
    base: "#f1d36f", deep: "#9a7c30",
    pattern: { type: "blush", color: "#ec7048", side: 0.65, strength: 0.4 },
    speckles: { count: 18, color: "#a06820", opacity: 0.4 },
    imageUrl: IMG("toki.jpg") },
  { id: 6,  name: "シナノスイート", r: 72,  score: 28,
    base: "#a31a1a", deep: "#5a0808",
    pattern: { type: "solid-glossy" },
    speckles: { count: 22, color: "#ffe080", opacity: 0.5 },
    imageUrl: IMG("shinano-sweet.jpg") },
  { id: 7,  name: "王林",          r: 86,  score: 36,
    base: "#c2cf68", deep: "#6a7028",
    pattern: { type: "speckle-heavy" },
    speckles: { count: 60, color: "#7a8038", opacity: 0.5 },
    imageUrl: IMG("ourin.jpg") },
  { id: 8,  name: "陸奥",          r: 100, score: 45,
    base: "#a8b558", deep: "#5a6020",
    pattern: { type: "stripes-mild", stripe: "#7a8038", count: 22, opacity: 0.28,
               blush: { color: "#c87830", side: 0.7, strength: 0.22 } },
    speckles: { count: 30, color: "#7a8038", opacity: 0.5 },
    imageUrl: IMG("mutsu.jpg") },
  { id: 9,  name: "ふじ",          r: 116, score: 55,
    base: "#cd2f2a", deep: "#7a0808",
    pattern: { type: "stripes-fuji", stripe: "#a82820", undertone: "#e8a248", count: 28, opacity: 0.5 },
    speckles: { count: 26, color: "#fff0c0", opacity: 0.42 },
    imageUrl: IMG("fuji.jpg") },
  { id: 10, name: "世界一",        r: 134, score: 66,
    base: "#9a1818", deep: "#460606",
    pattern: { type: "solid-glossy" },
    speckles: { count: 32, color: "#ffe080", opacity: 0.55 },
    imageUrl: IMG("sekaiichi.jpg") },
];

export const TIERS = VARIETIES;
export const MAX_TIER = TIERS.length - 1;
export const DROPPABLE_TIERS = 4;

export function pickDropTier() {
  return Math.floor(Math.random() * DROPPABLE_TIERS);
}

const STEM_LIGHT = "#7a4f24";
const STEM_DARK  = "#3a1f0a";
const LEAF_LIGHT = "#5fa84e";
const LEAF_DARK  = "#2c5a26";

let _dpr = 2;
let _imagesStarted = false;
const cache = new Map();
const loadedImages = new Map(); // tier -> HTMLImageElement ( 成功した もの )

export function setRenderDPR(dpr) {
  const d = Math.max(1, Math.min(3, dpr));
  if (d !== _dpr) {
    _dpr = d;
    cache.clear();
    // 既に 読み込んだ 画像が ある なら、新しい DPR で 再描画
    for (const [tier, img] of loadedImages) {
      renderImageSprite(VARIETIES[tier], tier, img);
    }
  }
  if (!_imagesStarted) {
    _imagesStarted = true;
    VARIETIES.forEach((v, i) => loadVarietyImage(v, i));
  }
}

function loadVarietyImage(v, tier) {
  if (!v.imageUrl) return;
  const img = new Image();
  img.onload = () => {
    try {
      loadedImages.set(tier, img);
      renderImageSprite(v, tier, img);
    } catch (e) { /* fallback to canvas drawing */ }
  };
  img.onerror = () => { /* fallback to canvas drawing */ };
  img.src = v.imageUrl;
}

function renderImageSprite(v, tier, img) {
  const padding = Math.max(28, v.r * 0.55);
  const size = (v.r + padding) * 2;
  const r = v.r;
  const cx = size / 2;
  const cy = size / 2;

  const canvas = document.createElement("canvas");
  canvas.width  = Math.ceil(size * _dpr);
  canvas.height = Math.ceil(size * _dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(_dpr, _dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 床に 落ちる 影
  ctx.fillStyle = "rgba(60, 30, 0, 0.20)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.96, r * 0.88, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // 円形 クリップに 写真を フィット
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // 写真は 中央に 寄せて、外周の 白背景が 見えないように 0.82 倍 で クロップ
  const iw = img.naturalWidth  || img.width;
  const ih = img.naturalHeight || img.height;
  const imgSide = Math.min(iw, ih) * 0.82;
  const sx = (iw - imgSide) / 2;
  const sy = (ih - imgSide) / 2;
  ctx.drawImage(img, sx, sy, imgSide, imgSide, cx - r, cy - r, r * 2, r * 2);

  // 縁の 暗影 ( 球体感 )
  const edge = ctx.createRadialGradient(cx, cy, r * 0.65, cx, cy, r);
  edge.addColorStop(0, "rgba(0, 0, 0, 0)");
  edge.addColorStop(1, "rgba(0, 0, 0, 0.36)");
  ctx.fillStyle = edge;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // ハイライト ( 写真の 上に 軽く )
  const hl = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.45, 0, cx - r * 0.38, cy - r * 0.45, r * 0.6);
  hl.addColorStop(0, "rgba(255, 255, 255, 0.28)");
  hl.addColorStop(0.5, "rgba(255, 255, 255, 0.08)");
  hl.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = hl;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  ctx.restore();

  const key = tier * 10 + Math.round(_dpr * 10);
  cache.set(key, { canvas, size, baseR: v.r, isImage: true });
}

export function drawApple(ctx, x, y, r, tier, opts = {}) {
  const { opacity = 1, danger = 0 } = opts;
  const cached = getCached(tier);
  const scale = r / cached.baseR;
  const drawSize = cached.size * scale;

  if (danger > 0.05) {
    ctx.save();
    const auraR = r + 8 + danger * 10;
    const aura = ctx.createRadialGradient(x, y, r * 0.85, x, y, auraR);
    aura.addColorStop(0, "rgba(255, 60, 60, 0)");
    aura.addColorStop(0.6, `rgba(255, 70, 60, ${0.25 * danger})`);
    aura.addColorStop(1, `rgba(255, 60, 60, ${0.55 * danger})`);
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y, auraR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cached.canvas, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
  ctx.restore();

  // 品種名は キャッシュに 入れず 毎回 描く ( 拡縮で 文字が ぼやけないように )
  if (r >= 22) drawName(ctx, x, y, r, TIERS[tier].name);
}

function getCached(tier) {
  const key = tier * 10 + Math.round(_dpr * 10);
  let c = cache.get(key);
  if (c) return c;
  const v = VARIETIES[tier];
  const padding = Math.max(28, v.r * 0.55);
  const size = (v.r + padding) * 2;
  const canvas = document.createElement("canvas");
  canvas.width  = Math.ceil(size * _dpr);
  canvas.height = Math.ceil(size * _dpr);
  const cx = canvas.getContext("2d");
  cx.scale(_dpr, _dpr);
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = "high";
  drawAppleSprite(cx, size / 2, size / 2, v.r, v);
  c = { canvas, size, baseR: v.r };
  cache.set(key, c);
  return c;
}

function drawAppleSprite(ctx, cx, cy, r, v) {
  // 床に 落ちる 影
  ctx.save();
  ctx.fillStyle = "rgba(60, 30, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.96, r * 0.86, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 本体は 円形で クリップ → その内側に 多層的な 質感を 重ねる
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // 1. ベース ( 多段ラジアルグラデ )
  const baseGrad = ctx.createRadialGradient(
    cx - r * 0.32, cy - r * 0.42, r * 0.05,
    cx, cy, r * 1.05,
  );
  baseGrad.addColorStop(0,    mix(v.base, "#ffffff", 0.7));
  baseGrad.addColorStop(0.1,  mix(v.base, "#ffffff", 0.45));
  baseGrad.addColorStop(0.3,  mix(v.base, "#ffffff", 0.18));
  baseGrad.addColorStop(0.55, v.base);
  baseGrad.addColorStop(0.85, mix(v.base, v.deep, 0.6));
  baseGrad.addColorStop(1,    v.deep);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // 2. 品種別 パターン
  applyPattern(ctx, cx, cy, r, v);

  // 3. 果点 ( lenticels )
  if (v.speckles) drawSpeckles(ctx, cx, cy, r, v);

  // 4. 横の 陰影
  const sideShade = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  sideShade.addColorStop(0,   "rgba(0, 0, 0, 0.14)");
  sideShade.addColorStop(0.5, "rgba(0, 0, 0, 0)");
  sideShade.addColorStop(1,   "rgba(0, 0, 0, 0.18)");
  ctx.fillStyle = sideShade;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // 5. 下方向の 陰影
  const btmShade = ctx.createLinearGradient(cx, cy + r * 0.3, cx, cy + r);
  btmShade.addColorStop(0, "rgba(0, 0, 0, 0)");
  btmShade.addColorStop(1, "rgba(0, 0, 0, 0.32)");
  ctx.fillStyle = btmShade;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // 6. 軸の 凹み ( 上 )
  const dimpleGrad = ctx.createRadialGradient(cx, cy - r * 0.93, 0, cx, cy - r * 0.93, r * 0.4);
  dimpleGrad.addColorStop(0,   "rgba(0, 0, 0, 0.5)");
  dimpleGrad.addColorStop(0.5, "rgba(0, 0, 0, 0.18)");
  dimpleGrad.addColorStop(1,   "rgba(0, 0, 0, 0)");
  ctx.fillStyle = dimpleGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.93, r * 0.32, r * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  // 7. カリックス ( 下、がくの 名残 )
  drawCalyx(ctx, cx, cy, r);

  // 8. 鏡面ハイライト ( 拡散 )
  const gloss1 = ctx.createRadialGradient(
    cx - r * 0.38, cy - r * 0.45, 0,
    cx - r * 0.38, cy - r * 0.45, r * 0.55,
  );
  gloss1.addColorStop(0,   "rgba(255, 255, 255, 0.55)");
  gloss1.addColorStop(0.45, "rgba(255, 255, 255, 0.12)");
  gloss1.addColorStop(1,   "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gloss1;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // 9. 鏡面ハイライト ( シャープ )
  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.42, cy - r * 0.5, r * 0.16, r * 0.085, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.18, cy - r * 0.55, r * 0.06, r * 0.04, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // クリップ外: 軸 と 葉 を 描く
  drawStem(ctx, cx, cy, r);
  drawLeaf(ctx, cx, cy, r);
}

function applyPattern(ctx, cx, cy, r, v) {
  const p = v.pattern;
  if (!p || p.type === "solid") return;

  if (p.type === "solid-glossy") {
    // 追加の グロスレイヤー で つるっとした質感
    const g = ctx.createRadialGradient(cx, cy + r * 0.3, 0, cx, cy + r * 0.3, r);
    g.addColorStop(0, "rgba(255, 255, 255, 0.08)");
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    return;
  }

  if (p.type === "blush") {
    // 片側に 赤い 染み
    const sx = cx + (p.side - 0.5) * r * 1.4;
    const sy = cy - r * 0.3;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.1);
    g.addColorStop(0,   hexA(p.color, p.strength));
    g.addColorStop(0.6, hexA(p.color, p.strength * 0.4));
    g.addColorStop(1,   hexA(p.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    return;
  }

  if (p.type === "bicolor") {
    // 上半が 赤、下半が 黄 ( ジョナゴールド )
    const split = p.split ?? 0.5;
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0,                hexA(p.topColor, 0.55));
    g.addColorStop(split - 0.05,     hexA(p.topColor, 0.5));
    g.addColorStop(split + 0.05,     hexA(p.bottomColor, 0.0));
    g.addColorStop(1,                hexA(p.bottomColor, 0.0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    return;
  }

  if (p.type === "stripes-mild") {
    drawVerticalStreaks(ctx, cx, cy, r, v.id, p.count, p.stripe, p.opacity);
    if (p.blush) {
      const b = p.blush;
      const sx = cx + (b.side - 0.5) * r * 1.4;
      const sy = cy - r * 0.2;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.1);
      g.addColorStop(0, hexA(b.color, b.strength));
      g.addColorStop(1, hexA(b.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    return;
  }

  if (p.type === "stripes-fuji") {
    // 黄ベースが 透けて見える + 細かい 赤の 縞
    const tone = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    tone.addColorStop(0,   hexA(p.undertone, 0.0));
    tone.addColorStop(0.5, hexA(p.undertone, 0.15));
    tone.addColorStop(1,   hexA(p.undertone, 0.45));
    ctx.fillStyle = tone;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    drawVerticalStreaks(ctx, cx, cy, r, v.id, p.count, p.stripe, p.opacity);
    return;
  }

  if (p.type === "speckle-heavy") {
    // 王林の 黄緑斑点 ( 速度的に 後段で speckles により 描かれる )
    return;
  }
}

function drawVerticalStreaks(ctx, cx, cy, r, seed, count, color, alpha) {
  const rand = seedRandom(seed * 9301 + 17);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    const xRel = (rand() - 0.5) * r * 1.85;
    const len  = r * (0.55 + rand() * 0.7);
    const yOff = (rand() - 0.5) * r * 0.3;
    const lw   = 0.6 + rand() * (r * 0.025);
    const wob  = (rand() - 0.5) * r * 0.06;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(cx + xRel,       cy + yOff - len * 0.5);
    ctx.bezierCurveTo(
      cx + xRel + wob, cy + yOff - len * 0.2,
      cx + xRel - wob, cy + yOff + len * 0.2,
      cx + xRel,       cy + yOff + len * 0.5,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpeckles(ctx, cx, cy, r, v) {
  const { count, color, opacity } = v.speckles;
  const rand = seedRandom(v.id * 7919 + 13);
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * r * 0.95;
    const sx = cx + Math.cos(angle) * dist;
    const sy = cy + Math.sin(angle) * dist;
    const sz = 0.4 + rand() * Math.max(0.6, r * 0.022);
    ctx.beginPath();
    ctx.arc(sx, sy, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCalyx(ctx, cx, cy, r) {
  const cy2 = cy + r * 0.92;
  const g = ctx.createRadialGradient(cx, cy2, 0, cx, cy2, r * 0.32);
  g.addColorStop(0,   "rgba(0, 0, 0, 0.5)");
  g.addColorStop(0.5, "rgba(0, 0, 0, 0.2)");
  g.addColorStop(1,   "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy2, r * 0.24, r * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();

  // 5 本の 細い暗線 ( がくの 跡 )
  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = Math.max(0.5, r * 0.012);
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(a) * r * 0.04;
    const y1 = cy2 + Math.sin(a) * r * 0.02;
    const x2 = cx + Math.cos(a) * r * 0.16;
    const y2 = cy2 + Math.sin(a) * r * 0.06;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStem(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  const w = r * 0.07;
  const top = -r * 1.32;
  const bot = -r * 0.86;
  const grad = ctx.createLinearGradient(0, bot, 0, top);
  grad.addColorStop(0,    STEM_DARK);
  grad.addColorStop(0.45, STEM_LIGHT);
  grad.addColorStop(1,    mix(STEM_LIGHT, "#000000", 0.35));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-w, bot);
  ctx.lineTo(w, bot);
  ctx.bezierCurveTo(w * 0.9, top + r * 0.2, w * 0.6, top + r * 0.05, w * 0.6, top);
  ctx.lineTo(-w * 0.6, top);
  ctx.bezierCurveTo(-w * 0.6, top + r * 0.05, -w * 0.9, top + r * 0.2, -w, bot);
  ctx.closePath();
  ctx.fill();

  // 軸の 縦の ハイライト
  ctx.strokeStyle = "rgba(255, 220, 180, 0.35)";
  ctx.lineWidth = Math.max(0.5, r * 0.012);
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, bot - 1);
  ctx.bezierCurveTo(-w * 0.25, top + r * 0.15, -w * 0.2, top + r * 0.05, -w * 0.2, top);
  ctx.stroke();
  ctx.restore();
}

function drawLeaf(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx + r * 0.05, cy - r * 1.05);
  ctx.rotate(-0.55);
  const lw = r * 0.5;
  const lh = r * 0.18;

  const grad = ctx.createLinearGradient(0, -lh, 0, lh);
  grad.addColorStop(0,    LEAF_LIGHT);
  grad.addColorStop(0.5,  mix(LEAF_LIGHT, LEAF_DARK, 0.5));
  grad.addColorStop(1,    LEAF_DARK);
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(lw * 0.1, -lh * 1.1, lw * 0.7, -lh * 1.0, lw, 0);
  ctx.bezierCurveTo(lw * 0.7, lh * 1.0, lw * 0.1, lh * 1.1, 0, 0);
  ctx.closePath();
  ctx.fill();

  // 中央葉脈
  ctx.strokeStyle = mix(LEAF_DARK, "#000000", 0.3);
  ctx.lineWidth = Math.max(0.6, r * 0.02);
  ctx.beginPath();
  ctx.moveTo(lw * 0.05, 0);
  ctx.lineTo(lw * 0.95, 0);
  ctx.stroke();

  // 側脈
  ctx.lineWidth = Math.max(0.4, r * 0.012);
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const x = lw * t;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + lw * 0.12, -lh * 0.6);
    ctx.moveTo(x, 0);
    ctx.lineTo(x + lw * 0.12,  lh * 0.6);
    ctx.stroke();
  }

  // ハイライト
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.beginPath();
  ctx.ellipse(lw * 0.4, -lh * 0.4, lw * 0.3, lh * 0.32, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawName(ctx, x, y, r, name) {
  const fs = Math.max(10, r * 0.2);
  ctx.save();
  ctx.font = `800 ${fs}px "Hiragino Sans", "Yu Gothic UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2.5, fs * 0.28);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.strokeText(name, x, y + r * 0.1);
  ctx.fillText(name, x, y + r * 0.1);
  ctx.restore();
}

// ---- helpers ----

function seedRandom(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function mix(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const c = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, c].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function hexA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
