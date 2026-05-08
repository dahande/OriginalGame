import { World } from "./world.js";
import { TIERS, MAX_TIER, pickDropTier, drawApple, setRenderDPR } from "./apple.js";
import { loadState, saveState } from "./storage.js";
import { setSoundEnabled, unlockAudio, sfx } from "./audio.js";

const $ = (id) => document.getElementById(id);

// 全モード 共通の 箱サイズ ( 旧ハードに 統一 )
const BOX_W = 360;
const BOX_H = 640;
const DANGER_Y = 100;

const MODES = {
  normal: { name: "ふつう", dropLimit: Infinity, bestKey: "bestNormal" },
  hard:   { name: "ハード", dropLimit: 1.5,      bestKey: "bestHard"   },
  skull:  { name: "ドクロ", dropLimit: 1.0,      bestKey: "bestSkull",
            horrorThreshold: 3000 },
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
const bestSkullLabel = $("bestSkullLabel");
const horrorOverlay = $("horrorOverlay");
const horrorCloseBtn = $("horrorCloseBtn");
const horrorScore = $("horrorScore");
const horrorVideo = $("horrorVideo");

let state = loadState();

let currentMode = null;
let world = null;
let cursorX = 0;
let nextTier = pickDropTier();
let pendingTier = pickDropTier();
let dropCooldown = 0;
let dropTimer = 0;     // モード別 制限時間 ( 0 で 自動投下 )
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
  world = new World(BOX_W, BOX_H, {
    dangerY: DANGER_Y,
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
      // ドクロモード で 規定スコア未満 → ホラー演出
      if (m && m.horrorThreshold && s < m.horrorThreshold) {
        horrorScore.textContent = `SCORE ${s}`;
        showHorror();
      }
    },
  });
  return world;
}

function startMode(modeKey) {
  const m = MODES[modeKey];
  if (!m) return;
  currentMode = modeKey;
  unlockAudio();

  // キャンバスは 全モード 共通サイズ ( 旧ハード )
  canvas.style.aspectRatio = `${BOX_W} / ${BOX_H}`;
  canvas.style.maxWidth = `${BOX_W}px`;
  setupCanvas(canvas, BOX_W, BOX_H);
  cursorX = BOX_W / 2;

  ensureWorld();
  world.w = BOX_W;
  world.h = BOX_H;
  world.dangerY = DANGER_Y;
  world.reset();

  homeOverlay.hidden = true;
  gameOverModal.hidden = true;
  closeHorror();
  scoreEl.textContent = "0";

  nextTier = pickDropTier();
  pendingTier = pickDropTier();
  dropCooldown = 0;
  dropTimer = m.dropLimit;
  drawNext();

  if (!loopStarted) {
    loopStarted = true;
    lastFrame = performance.now();
    requestAnimationFrame(loop);
  }
}

function returnToMenu() {
  gameOverModal.hidden = true;
  closeHorror();
  homeOverlay.hidden = false;
  if (world) world.reset();
  refreshHomeBests();
}

function refreshHomeBests() {
  bestNormalLabel.textContent = `ベスト ${state.bestNormal || 0}`;
  bestHardLabel.textContent = `ベスト ${state.bestHard || 0}`;
  bestSkullLabel.textContent = `ベスト ${state.bestSkull || 0}`;
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
  // タイマーを 次の りんごの 制限時間で 再セット
  const m = currentMode ? MODES[currentMode] : null;
  dropTimer = m ? m.dropLimit : Infinity;
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

  // 制限時間の カウントダウン リング ( ハード / ドクロ )
  const m = currentMode ? MODES[currentMode] : null;
  if (m && Number.isFinite(m.dropLimit) && dropCooldown === 0) {
    const ratio = Math.max(0, dropTimer / m.dropLimit);
    const ringR = r + 8;
    ctx.save();
    // 残り時間が 少ないと 赤
    const urgent = ratio < 0.35;
    ctx.strokeStyle = urgent ? "#ff3838" : (currentMode === "skull" ? "#ff5fa2" : "#c0271e");
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y, ringR, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
    ctx.stroke();
    if (urgent) {
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(x, y, ringR, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
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

  // モード制限時間: クールダウンが 終わってる + ゲームオーバーでない 時に カウント
  if (world && !world.gameOver && dropCooldown === 0 && Number.isFinite(dropTimer)) {
    dropTimer = Math.max(0, dropTimer - dt);
    if (dropTimer === 0) dropApple();
  }

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

// 動画音声を Web Audio で 増幅 ( ブラウザ仕様上、OS の 音量を 直接
// 操作する API は 存在しないため、GainNode で ハードウェア出力上限まで 押し上げる )。
const VIDEO_GAIN = 4.0;
let videoAudioCtx = null;
let videoSourceNode = null;
let videoGainNode = null;

function boostVideoVolume() {
  if (!horrorVideo) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!videoAudioCtx) videoAudioCtx = new AC();
    if (videoAudioCtx.state === "suspended") videoAudioCtx.resume().catch(() => {});
    if (!videoSourceNode) {
      videoSourceNode = videoAudioCtx.createMediaElementSource(horrorVideo);
      videoGainNode = videoAudioCtx.createGain();
      videoGainNode.gain.value = VIDEO_GAIN;
      videoSourceNode.connect(videoGainNode).connect(videoAudioCtx.destination);
    } else if (videoGainNode) {
      videoGainNode.gain.value = VIDEO_GAIN;
    }
  } catch { /* ignore - フォールバックは video.volume = 1.0 */ }
}

function showHorror() {
  horrorOverlay.hidden = false;
  if (horrorVideo) {
    horrorOverlay.classList.add("has-video");
    try {
      horrorVideo.muted = false;
      horrorVideo.volume = 1.0;
      horrorVideo.currentTime = 0;
      boostVideoVolume();
      const p = horrorVideo.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // 自動再生が ブラウザに 拒否された場合は ミュートで リトライ
          horrorVideo.muted = true;
          horrorVideo.play().catch(() => {});
        });
      }
    } catch { /* ignore */ }
    // フルスクリーン要求 ( 失敗しても overlay 自体が 100vw/vh )
    const reqFs = horrorOverlay.requestFullscreen ||
                  horrorOverlay.webkitRequestFullscreen ||
                  horrorOverlay.msRequestFullscreen;
    if (reqFs) {
      try {
        const r = reqFs.call(horrorOverlay);
        if (r && typeof r.catch === "function") r.catch(() => {});
      } catch { /* ignore */ }
    }
  }
}

function closeHorror() {
  if (horrorVideo) {
    horrorVideo.pause();
    horrorVideo.currentTime = 0;
  }
  horrorOverlay.classList.remove("has-video");
  horrorOverlay.hidden = true;
  const exitFs = document.exitFullscreen ||
                 document.webkitExitFullscreen ||
                 document.msExitFullscreen;
  if (exitFs && document.fullscreenElement) {
    try {
      const r = exitFs.call(document);
      if (r && typeof r.catch === "function") r.catch(() => {});
    } catch { /* ignore */ }
  }
}

horrorCloseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  closeHorror();
});

// オーバーレイ内なら どこを タップしても 閉じる ( クローズボタン以外 )
horrorOverlay.addEventListener("click", () => closeHorror());
horrorOverlay.addEventListener("touchend", (e) => {
  if (e.cancelable) e.preventDefault();
  closeHorror();
}, { passive: false });

soundBtn.addEventListener("click", () => {
  state = saveState({ sound: !state.sound });
  setSoundEnabled(state.sound);
  if (state.sound) unlockAudio();
  soundBtn.classList.toggle("muted", !state.sound);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!horrorOverlay.hidden) { closeHorror(); return; }
    if (!gameOverModal.hidden) { menuBtn.click(); return; }
  }
  if (e.key === "r" || e.key === "R") {
    if (!horrorOverlay.hidden) return;
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
