import { World } from "./world.js";
import { TIERS, MAX_TIER, pickDropTier, drawApple, setRenderDPR } from "./apple.js";
import { loadState, saveState } from "./storage.js";
import { setSoundEnabled, unlockAudio, sfx } from "./audio.js";

const $ = (id) => document.getElementById(id);

const MODES = {
  normal: { name: "ふつう", width: 480, height: 720, dangerY: 110, bestKey: "bestNormal" },
  hard:   { name: "ハード", width: 360, height: 640, dangerY: 100, bestKey: "bestHard" },
};

const DROP_COOLDOWN = 0.45;

const canvas = $("game");
const nextCanvas = $("next");
const ctx = canvas.getContext("2d");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = $("score");
const bestEl = $("best");
const soundBtn = $("soundBtn");
const homeOverlay = $("homeOverlay");
const gameOverModal = $("gameOverModal");
const finalScoreEl = $("finalScore");
const recordLine = $("recordLine");
const bestTierName = $("bestTierName");
const restartBtn = $("restartBtn");
const menuBtn = $("menuBtn");
const evoList = $("evoList");
const popLayer = $("popLayer");
const bestNormalLabel = $("bestNormalLabel");
const bestHardLabel = $("bestHardLabel");

let state = loadState();

let currentMode = null;
let world = null;
let cursorX = 0;
let nextTier = pickDropTier();
let pendingTier = pickDropTier();
let dropCooldown = 0;
let lastFrame = performance.now();
let loopStarted = false;

const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
setRenderDPR(dpr);

function setupCanvas(c, logicalW, logicalH) {
  c.width = Math.floor(logicalW * dpr);
  c.height = Math.floor(logicalH * dpr);
  const cx = c.getContext("2d");
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
setupCanvas(nextCanvas, 64, 64);

function ensureWorld() {
  if (world) return world;
  world = new World(480, 720, {
    dangerY: 110,
    onScore: (s, earned, x, y) => {
      scoreEl.textContent = s;
      if (s > state.best) {
        state = saveState({ best: s });
        bestEl.textContent = s;
      }
      if (currentMode) {
        const key = MODES[currentMode].bestKey;
        if (s > (state[key] || 0)) state = saveState({ [key]: s });
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
      const m = MODES[currentMode];
      const modeBest = m ? state[m.bestKey] || 0 : state.best;
      if (s > 0 && s >= modeBest) {
        recordLine.textContent = "新記録 達成!";
      } else {
        recordLine.textContent = `ベスト: ${modeBest}`;
      }
      gameOverModal.hidden = false;
      sfx.gameOver();
      refreshHomeBests();
    },
  });
  return world;
}

function startMode(modeKey) {
  const m = MODES[modeKey];
  if (!m) return;
  currentMode = modeKey;
  unlockAudio();

  // キャンバスを モードサイズに 切替
  canvas.style.aspectRatio = `${m.width} / ${m.height}`;
  canvas.style.maxWidth = `${m.width}px`;
  setupCanvas(canvas, m.width, m.height);
  cursorX = m.width / 2;

  // ワールドを そのサイズに
  ensureWorld();
  world.w = m.width;
  world.h = m.height;
  world.dangerY = m.dangerY;
  world.reset();

  homeOverlay.hidden = true;
  gameOverModal.hidden = true;
  scoreEl.textContent = "0";

  nextTier = pickDropTier();
  pendingTier = pickDropTier();
  dropCooldown = 0;
  drawNext();

  if (!loopStarted) {
    loopStarted = true;
    lastFrame = performance.now();
    requestAnimationFrame(loop);
  }
}

function returnToMenu() {
  gameOverModal.hidden = true;
  homeOverlay.hidden = false;
  if (world) world.reset();
  refreshHomeBests();
}

function refreshHomeBests() {
  bestNormalLabel.textContent = `ベスト ${state.bestNormal || 0}`;
  bestHardLabel.textContent = `ベスト ${state.bestHard || 0}`;
}

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
  if (!world) return;
  const rect = canvas.getBoundingClientRect();
  const sx = rect.left + (worldX / world.w) * rect.width;
  const sy = rect.top + (worldY / world.h) * rect.height;
  const el = document.createElement("div");
  el.className = "score-pop";
  el.textContent = text;
  el.style.left = `${sx}px`;
  el.style.top = `${sy}px`;
  popLayer.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function pointerToWorldX(clientX) {
  if (!world) return 0;
  const rect = canvas.getBoundingClientRect();
  const px = clientX - rect.left;
  return (px / rect.width) * world.w;
}

canvas.addEventListener("pointermove", (e) => {
  cursorX = pointerToWorldX(e.clientX);
});

canvas.addEventListener("pointerdown", (e) => {
  unlockAudio();
  if (!world || world.gameOver) return;
  cursorX = pointerToWorldX(e.clientX);
  if (dropCooldown > 0) return;
  dropApple();
});

canvas.addEventListener("touchmove", (e) => {
  if (e.cancelable) e.preventDefault();
}, { passive: false });

function dropApple() {
  if (!world) return;
  const r = TIERS[nextTier].r;
  const x = clamp(cursorX, r + 6, world.w - r - 6);
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
  if (!world || world.gameOver) return;
  const tier = nextTier;
  const r = TIERS[tier].r;
  const x = clamp(cursorX, r + 6, world.w - r - 6);
  const y = r + 6;

  ctx.save();
  ctx.strokeStyle = "rgba(120, 80, 30, 0.35)";
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.lineTo(x, world.h - 8);
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
  if (world) {
    world.step(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, world.w, world.h);
    world.draw(ctx);
    drawCursor();
  }
  requestAnimationFrame(loop);
}

// モード選択
document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => startMode(btn.dataset.mode));
});

restartBtn.addEventListener("click", () => {
  unlockAudio();
  startMode(currentMode || "normal");
});

menuBtn.addEventListener("click", () => {
  returnToMenu();
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
  if (e.key === "Escape") {
    if (!gameOverModal.hidden) menuBtn.click();
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) unlockAudio();
});

bestEl.textContent = state.best;
setSoundEnabled(state.sound);
soundBtn.classList.toggle("muted", !state.sound);
buildEvolutionList();
refreshHomeBests();
drawNext();

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
