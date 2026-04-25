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
const ragePop = $("ragePop");
const startOverlay = $("startOverlay");
const settingsOverlay = $("settingsOverlay");
const settingsBtn = $("settingsBtn");
const menuBtn = $("menuBtn");
const closeSettingsBtn = $("closeSettingsBtn");
const soundToggle = $("soundToggle");
const hapticToggle = $("hapticToggle");
const fxSelect = $("fxSelect");
const difficultySelect = $("difficultySelect");
const resetBestBtn = $("resetBestBtn");
const modeBadge = $("modeBadge");
const modeBadgeIcon = $("modeBadgeIcon");
const modeBadgeName = $("modeBadgeName");
const modeCards = document.querySelectorAll(".mode-card");

const MODE_META = {
  classic: { icon: "🫧", name: "クラシック" },
  zen:     { icon: "🌿", name: "禅" },
  rage:    { icon: "💢", name: "仕事ストレス爆破" },
};

let state = loadState();
let currentMode = "classic";

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
  mode: "classic",
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
    if (currentMode === "zen") {
      comboBox.hidden = true;
      return;
    }
    comboBox.hidden = c < 3;
  },
  onComboMilestone: (c) => {
    comboPop.textContent = `${c} COMBO!`;
    comboPop.classList.remove("show");
    void comboPop.offsetWidth;
    comboPop.classList.add("show");
  },
  onRagePop: (label) => {
    const pops = ["粉砕!", "撃破!", "破壊!", "KO!", "スカッ!", "ざまみろ!", "解放!"];
    const tag = pops[(Math.random() * pops.length) | 0];
    ragePop.textContent = `${label} ${tag}`;
    ragePop.classList.remove("show");
    void ragePop.offsetWidth;
    ragePop.classList.add("show");
  },
});

function startMode(mode) {
  currentMode = mode;
  unlockAudio();
  startOverlay.hidden = true;
  settingsBtn.classList.add("visible");
  menuBtn.classList.add("visible");
  const meta = MODE_META[mode] || MODE_META.classic;
  modeBadgeIcon.textContent = meta.icon;
  modeBadgeName.textContent = meta.name;
  modeBadge.hidden = false;
  comboBox.hidden = true;
  game.start(mode);
}

function returnToMenu() {
  game.stop();
  modeBadge.hidden = true;
  comboBox.hidden = true;
  startOverlay.hidden = false;
  // settings ボタンは メニューでは 不要
  settingsBtn.classList.remove("visible");
  menuBtn.classList.remove("visible");
}

modeCards.forEach((card) => {
  card.addEventListener("click", () => {
    const mode = card.dataset.mode;
    if (!mode) return;
    startMode(mode);
  });
});

menuBtn.addEventListener("click", returnToMenu);

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

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!settingsOverlay.hidden) { settingsOverlay.hidden = true; return; }
    if (startOverlay.hidden) returnToMenu();
  }
  if (e.key === "r" || e.key === "R") {
    if (!startOverlay.hidden) return;
    game.start(currentMode);
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) unlockAudio();
});
