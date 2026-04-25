import { Game } from "./game.js";
import { loadState, saveState, resetBest } from "./storage.js";
import { setSoundEnabled, unlockAudio } from "./audio.js";

const $ = (id) => document.getElementById(id);

const canvas = $("game");
const scoreEl = $("score");
const bestEl = $("best");
const comboEl = $("combo");
const multiplierEl = $("multiplier");
const comboBox = $("comboBox");
const comboPop = $("comboPop");
const startOverlay = $("startOverlay");
const settingsOverlay = $("settingsOverlay");
const startBtn = $("startBtn");
const settingsBtn = $("settingsBtn");
const closeSettingsBtn = $("closeSettingsBtn");
const soundToggle = $("soundToggle");
const hapticToggle = $("hapticToggle");
const fxSelect = $("fxSelect");
const difficultySelect = $("difficultySelect");
const resetBestBtn = $("resetBestBtn");

let state = loadState();

function applyState() {
  bestEl.textContent = state.best;
  soundToggle.checked = !!state.sound;
  hapticToggle.checked = !!state.haptic;
  fxSelect.value = state.fx;
  difficultySelect.value = state.difficulty;
  setSoundEnabled(state.sound);
}
applyState();

const game = new Game(canvas, {
  difficulty: state.difficulty,
  fx: state.fx,
  haptic: state.haptic,
  onScore: (s) => {
    scoreEl.textContent = s;
    if (s > state.best) {
      state = saveState({ best: s });
      bestEl.textContent = s;
    }
  },
  onCombo: (c, m) => {
    comboEl.textContent = c;
    multiplierEl.textContent = m.toFixed(1);
    if (c >= 3) comboBox.hidden = false;
    else comboBox.hidden = true;
  },
  onComboMilestone: (c) => {
    comboPop.textContent = `${c} COMBO!`;
    comboPop.classList.remove("show");
    void comboPop.offsetWidth; // restart animation
    comboPop.classList.add("show");
  },
});

function startGame() {
  unlockAudio();
  startOverlay.hidden = true;
  settingsBtn.classList.add("visible");
  game.start();
}

startBtn.addEventListener("click", startGame);

settingsBtn.addEventListener("click", () => {
  settingsOverlay.hidden = false;
});
closeSettingsBtn.addEventListener("click", () => {
  settingsOverlay.hidden = true;
});

soundToggle.addEventListener("change", () => {
  state = saveState({ sound: soundToggle.checked });
  setSoundEnabled(state.sound);
  if (state.sound) unlockAudio();
});

hapticToggle.addEventListener("change", () => {
  state = saveState({ haptic: hapticToggle.checked });
  game.setHaptic(state.haptic);
});

fxSelect.addEventListener("change", () => {
  state = saveState({ fx: fxSelect.value });
  game.setFx(state.fx);
});

difficultySelect.addEventListener("change", () => {
  state = saveState({ difficulty: difficultySelect.value });
  game.setDifficulty(state.difficulty);
});

resetBestBtn.addEventListener("click", () => {
  state = resetBest();
  bestEl.textContent = state.best;
  resetBestBtn.textContent = "リセット完了";
  setTimeout(() => { resetBestBtn.textContent = "ベスト記録をリセット"; }, 1200);
});

// Pキーで一時停止 / Rでリスタート
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!settingsOverlay.hidden) settingsOverlay.hidden = true;
  }
  if (e.key === "r" || e.key === "R") {
    if (!startOverlay.hidden) return;
    game.start();
  }
});

// 画面が非アクティブになったら音を一時停止しない (BGM ではないので不要)
// ただし AudioContext を resume する
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) unlockAudio();
});
