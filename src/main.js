import { World } from "./world.js";
import { TIERS, MAX_TIER, pickDropTier, drawApple, setRenderDPR } from "./apple.js";
import { loadState, saveState } from "./storage.js";
import { setSoundEnabled, unlockAudio, sfx } from "./audio.js";

const $ = (id) => document.getElementById(id);

const WORLD_W = 480;
const WORLD_H = 720;
const DANGER_Y = 110;
const DROP_COOLDOWN = 0.45;

const canvas = $("game");
const nextCanvas = $("next");
const ctx = canvas.getContext("2d");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = $("score");
const bestEl = $("best");
const soundBtn = $("soundBtn");
const gameOverModal = $("gameOverModal");
const finalScoreEl = $("finalScore");
const recordLine = $("recordLine");
const bestTierName = $("bestTierName");
const restartBtn = $("restartBtn");
const evoList = $("evoList");
const popLayer = $("popLayer");

let state = loadState();
let cursorX = WORLD_W / 2;
let nextTier = pickDropTier();
let pendingTier = pickDropTier();
let dropCooldown = 0;
let lastFrame = performance.now();

const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
setRenderDPR(dpr);

function setupCanvas(c, logicalW, logicalH) {
  const cx = c.getContext("2d");
  c.width = Math.floor(logicalW * dpr);
  c.height = Math.floor(logicalH * dpr);
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
setupCanvas(canvas, WORLD_W, WORLD_H);
setupCanvas(nextCanvas, 64, 64);

const world = new World(WORLD_W, WORLD_H, {
  dangerY: DANGER_Y,
  onScore: (s, earned, x, y) => {
    scoreEl.textContent = s;
    if (s > state.best) {
      state = saveState({ best: s });
      bestEl.textContent = s;
    }
    if (earned && x !== undefined) showScorePop(`+${earned}`, x, y);
  },
  onMerge: (tier) => {
    if (tier === MAX_TIER) sfx.maxTier();
    else sfx.merge(tier);
  },
  onTierReached: (tier) => {
    highlightEvo(tier, true);
    if (tier > (state.bestTier || 0)) {
      state = saveState({ bestTier: tier });
    }
  },
  onGameOver: (s) => {
    finalScoreEl.textContent = s;
    bestTierName.textContent = TIERS[world.bestTierReached].name;
    if (s > 0 && s >= state.best) {
      recordLine.textContent = "新記録 達成!";
    } else {
      recordLine.textContent = `ベスト: ${state.best}`;
    }
    gameOverModal.hidden = false;
    sfx.gameOver();
  },
});

function buildEvolutionList() {
  evoList.innerHTML = "";
  TIERS.forEach((t, i) => {
    const li = document.createElement("li");
    li.className = "evo-row";
    li.dataset.tier = i;
    li.innerHTML = `
      <span class="evo-dot" style="background: radial-gradient(circle at 30% 30%, ${lightenHex(t.base, 0.4)}, ${t.base} 60%, ${darkenHex(t.base, 0.3)} 100%);"></span>
      <span class="evo-name">${t.name}</span>
      <span class="evo-num">${i + 1}</span>
    `;
    evoList.appendChild(li);
  });
  if (state.bestTier) {
    for (let i = 0; i <= state.bestTier; i++) highlightEvo(i, false);
  }
}

function highlightEvo(tier, animate) {
  const li = evoList.querySelector(`[data-tier="${tier}"]`);
  if (!li) return;
  li.classList.add("reached");
  if (animate) {
    li.classList.add("just-reached");
    setTimeout(() => li.classList.remove("just-reached"), 800);
  }
}

function showScorePop(text, worldX, worldY) {
  const rect = canvas.getBoundingClientRect();
  const sx = rect.left + (worldX / WORLD_W) * rect.width;
  const sy = rect.top + (worldY / WORLD_H) * rect.height;
  const el = document.createElement("div");
  el.className = "score-pop";
  el.textContent = text;
  el.style.left = `${sx}px`;
  el.style.top = `${sy}px`;
  popLayer.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function pointerToWorldX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const px = clientX - rect.left;
  return (px / rect.width) * WORLD_W;
}

canvas.addEventListener("pointermove", (e) => {
  cursorX = pointerToWorldX(e.clientX);
});

canvas.addEventListener("pointerdown", (e) => {
  unlockAudio();
  if (world.gameOver) return;
  cursorX = pointerToWorldX(e.clientX);
  if (dropCooldown > 0) return;
  dropApple();
});

canvas.addEventListener("touchmove", (e) => {
  if (e.cancelable) e.preventDefault();
}, { passive: false });

function dropApple() {
  const r = TIERS[nextTier].r;
  const x = clamp(cursorX, r + 6, WORLD_W - r - 6);
  const a = world.spawn(x, nextTier);
  a.vy = 80;
  a.y = -r;
  sfx.drop();
  nextTier = pendingTier;
  pendingTier = pickDropTier();
  dropCooldown = DROP_COOLDOWN;
  drawNext();
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function drawCursor() {
  if (world.gameOver) return;
  const tier = nextTier;
  const r = TIERS[tier].r;
  const x = clamp(cursorX, r + 6, WORLD_W - r - 6);
  const y = r + 6;

  ctx.save();
  ctx.strokeStyle = "rgba(120, 80, 30, 0.35)";
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.lineTo(x, WORLD_H - 8);
  ctx.stroke();
  ctx.restore();

  drawApple(ctx, x, y, r, tier, { opacity: dropCooldown > 0 ? 0.25 : 0.65 });
}

function drawNext() {
  nextCtx.clearRect(0, 0, 64, 64);
  const r = 22;
  drawApple(nextCtx, 32, 36, r, pendingTier);
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (dropCooldown > 0) dropCooldown = Math.max(0, dropCooldown - dt);
  world.step(dt);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  world.draw(ctx);
  drawCursor();
  requestAnimationFrame(loop);
}

restartBtn.addEventListener("click", () => {
  unlockAudio();
  world.reset();
  nextTier = pickDropTier();
  pendingTier = pickDropTier();
  dropCooldown = 0;
  scoreEl.textContent = "0";
  gameOverModal.hidden = true;
  drawNext();
});

soundBtn.addEventListener("click", () => {
  state = saveState({ sound: !state.sound });
  setSoundEnabled(state.sound);
  if (state.sound) unlockAudio();
  soundBtn.classList.toggle("muted", !state.sound);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R") {
    if (!gameOverModal.hidden) restartBtn.click();
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) unlockAudio();
});

bestEl.textContent = state.best;
setSoundEnabled(state.sound);
soundBtn.classList.toggle("muted", !state.sound);
buildEvolutionList();
drawNext();
requestAnimationFrame(loop);

function lightenHex(hex, amt) { return mixHex(hex, "#ffffff", amt); }
function darkenHex(hex, amt)  { return mixHex(hex, "#000000", amt); }
function mixHex(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const c = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, c].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
