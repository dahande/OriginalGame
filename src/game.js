import { Bubble, TYPES, pickType, pickStressWord } from "./bubble.js";
import { ParticleSystem } from "./particles.js";
import { sfx } from "./audio.js";

const DIFFICULTY = {
  easy:   { spawnBase: 0.85, spawnRamp: 0.0008, sizeMul: 1.15 },
  normal: { spawnBase: 0.55, spawnRamp: 0.0012, sizeMul: 1.0  },
  hard:   { spawnBase: 0.32, spawnRamp: 0.0018, sizeMul: 0.88 },
  insane: { spawnBase: 0.18, spawnRamp: 0.0022, sizeMul: 0.78 },
};

const FX = {
  low:    { particleMul: 0.5, shakeMul: 0.5 },
  medium: { particleMul: 1.0, shakeMul: 1.0 },
  high:   { particleMul: 1.6, shakeMul: 1.4 },
};

// モード別 設定。未指定の フィールドは デフォルト挙動。
const MODES = {
  classic: {
    name: "classic",
  },
  zen: {
    name: "zen",
    spawnBase: 1.4,         // ゆったり
    spawnRamp: 0,           // 加速なし
    sizeMul: 1.1,
    onlyNormal: true,       // 通常バブルのみ
    skipCombo: true,        // コンボ計算なし
    shakeMul: 0.15,         // ほぼ揺れない
    flashMul: 0.3,
    bgGradient: ["#0d2a3a", "#0f1a30", "#070a1a"],
  },
  rage: {
    name: "rage",
    spawnBase: 0.45,
    spawnRamp: 0.001,
    sizeMul: 1.05,
    label: true,            // ストレスワードを 載せる
    bgGradient: ["#3a0f1f", "#1a0a1c", "#070a1a"],
  },
};

const COMBO_HOLD_TIME = 1.6;

export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.particles = new ParticleSystem();
    this.bubbles = [];
    this.bubblePool = [];
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.spawnTimer = 0;
    this.elapsed = 0;
    this.shake = 0;
    this.flash = 0;
    this.running = false;
    this.time = 0;
    this.difficulty = opts.difficulty || "normal";
    this.fx = opts.fx || "medium";
    this.haptic = opts.haptic ?? true;
    this.mode = opts.mode || "classic";
    this.onScore = opts.onScore || (() => {});
    this.onCombo = opts.onCombo || (() => {});
    this.onComboMilestone = opts.onComboMilestone || (() => {});
    this.onRagePop = opts.onRagePop || (() => {});
    this.lastFrame = 0;
    this.boundLoop = this.loop.bind(this);
    this.boundResize = this.resize.bind(this);

    this.resize();
    window.addEventListener("resize", this.boundResize);
    window.addEventListener("orientationchange", this.boundResize);
    this.attachInput();
  }

  setDifficulty(d) { if (DIFFICULTY[d]) this.difficulty = d; }
  setFx(f) { if (FX[f]) this.fx = f; }
  setHaptic(v) { this.haptic = !!v; }
  setMode(m) { if (MODES[m]) this.mode = m; }
  modeCfg() { return MODES[this.mode] || MODES.classic; }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.w = w;
    this.h = h;
  }

  attachInput() {
    const onPointer = (e) => {
      if (!this.running) return;
      const rect = this.canvas.getBoundingClientRect();
      const points = e.changedTouches
        ? Array.from(e.changedTouches).map((t) => ({ x: t.clientX - rect.left, y: t.clientY - rect.top }))
        : [{ x: e.clientX - rect.left, y: e.clientY - rect.top }];
      for (const p of points) this.handleHit(p.x, p.y);
      if (e.cancelable) e.preventDefault();
    };
    this.canvas.addEventListener("pointerdown", onPointer);
    this.canvas.addEventListener("touchstart", onPointer, { passive: false });
  }

  start(mode) {
    if (mode) this.setMode(mode);
    this.running = true;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.shake = 0;
    this.flash = 0;
    this.bubbles.forEach((b) => this.bubblePool.push(b));
    this.bubbles.length = 0;
    this.particles.clear();
    this.onScore(this.score);
    this.onCombo(this.combo, this.multiplier());
    if (!this.lastFrame) {
      this.lastFrame = performance.now();
      requestAnimationFrame(this.boundLoop);
    }
  }

  stop() {
    this.running = false;
  }

  multiplier() {
    return Math.min(8, 1 + this.combo * 0.1);
  }

  spawnInterval() {
    const m = this.modeCfg();
    const d = DIFFICULTY[this.difficulty];
    const base = m.spawnBase ?? d.spawnBase;
    const ramp = m.spawnRamp ?? d.spawnRamp;
    return Math.max(0.07, base - this.elapsed * ramp);
  }

  acquireBubble(opts) {
    const b = this.bubblePool.pop() || new Bubble();
    b.reset(opts);
    this.bubbles.push(b);
    return b;
  }

  spawn() {
    const m = this.modeCfg();
    const d = DIFFICULTY[this.difficulty];
    const sizeMul = m.sizeMul ?? d.sizeMul;
    const r = (22 + Math.random() * 26) * sizeMul;
    const x = r + Math.random() * (this.w - r * 2);
    const y = this.h + r + 10;
    const speedMul = m.name === "zen" ? 0.6 : 1.0;
    const speed = (70 + Math.random() * 80 + Math.min(120, this.elapsed * 1.4)) * speedMul;
    const type = m.onlyNormal ? TYPES.NORMAL : pickType();
    const label = (m.label && type === TYPES.NORMAL) ? pickStressWord() : null;
    this.acquireBubble({
      x, y, r,
      vx: (Math.random() - 0.5) * 30,
      vy: -speed,
      type,
      label,
    });
  }

  handleHit(px, py) {
    let hitBubble = null;
    // 後ろ（最前面）から判定
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (b.alive && b.hit(px, py)) {
        hitBubble = b;
        break;
      }
    }
    if (!hitBubble) {
      this.onMiss();
      return;
    }
    this.popBubble(hitBubble);
  }

  onMiss() {
    if (this.combo >= 3) sfx.miss();
    this.combo = 0;
    this.comboTimer = 0;
    this.onCombo(this.combo, this.multiplier());
  }

  popBubble(b, chained = false) {
    if (!b.alive) return;
    b.alive = false;

    const m = this.modeCfg();
    const fxMul = FX[this.fx].particleMul;
    const shakeMul = FX[this.fx].shakeMul * (m.shakeMul ?? 1);
    const flashMul = m.flashMul ?? 1;

    let baseScore = 10;
    let shakeAdd = 4;
    let flashAdd = 0.05;

    if (b.type === TYPES.NORMAL) {
      sfx.pop(this.combo);
      this.particles.emitBurst(b.x, b.y, {
        count: Math.round(16 * fxMul),
        colors: b.paletteColors(),
        speed: 260,
        size: 4,
        sizeJitter: 4,
        life: 0.55,
        gravity: 720,
      });
    } else if (b.type === TYPES.BOMB) {
      baseScore = 30;
      shakeAdd = 18;
      flashAdd = 0.18;
      sfx.bomb();
      this.particles.emitBurst(b.x, b.y, {
        count: Math.round(50 * fxMul),
        colors: b.paletteColors(),
        speed: 460,
        size: 6,
        sizeJitter: 6,
        life: 0.85,
        lifeJitter: 0.5,
        gravity: 800,
        shape: "square",
      });
      this.particles.emitRing(b.x, b.y, { count: 36, radius: 8, color: "#ffb347", thickness: 4, life: 0.5 });
      this.bombSplash(b.x, b.y, b.r * 4.5);
    } else if (b.type === TYPES.RAINBOW) {
      baseScore = 25;
      shakeAdd = 22;
      flashAdd = 0.3;
      sfx.rainbow();
      this.particles.emitBurst(b.x, b.y, {
        count: Math.round(80 * fxMul),
        colors: ["#ff5fa2", "#ffb347", "#ffd860", "#a4ff5f", "#5ad7ff", "#c08bff"],
        speed: 520,
        size: 5,
        sizeJitter: 5,
        life: 1.1,
        lifeJitter: 0.6,
        gravity: 600,
      });
      this.rainbowAll(b.x, b.y);
    } else if (b.type === TYPES.GOLD) {
      baseScore = 100;
      shakeAdd = 8;
      flashAdd = 0.12;
      sfx.gold();
      this.particles.emitBurst(b.x, b.y, {
        count: Math.round(60 * fxMul),
        colors: ["#fff8d2", "#ffd860", "#fff", "#ffb347"],
        speed: 360,
        size: 5,
        sizeJitter: 4,
        life: 0.95,
        gravity: 600,
        shape: "square",
      });
    }

    if (!chained && !m.skipCombo) {
      this.combo += 1;
      this.comboTimer = COMBO_HOLD_TIME;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      sfx.combo(this.combo);
      this.onCombo(this.combo, this.multiplier());
      if (this.combo > 0 && this.combo % 10 === 0) {
        this.onComboMilestone(this.combo);
        this.flash = Math.min(1, this.flash + 0.25);
      }
    }

    const gained = Math.round(baseScore * this.multiplier());
    this.score += gained;
    this.onScore(this.score);

    this.shake = Math.min(40, this.shake + shakeAdd * shakeMul);
    this.flash = Math.min(1, this.flash + flashAdd * flashMul);

    if (b.label && !chained) {
      this.onRagePop(b.label, b.x, b.y);
    }

    if (this.haptic && navigator.vibrate) {
      try { navigator.vibrate(b.type === TYPES.BOMB ? 35 : 12); } catch { /* ignore */ }
    }
  }

  bombSplash(x, y, radius) {
    for (const o of this.bubbles) {
      if (!o.alive) continue;
      const dx = o.x - x;
      const dy = o.y - y;
      if (dx * dx + dy * dy <= radius * radius) {
        this.popBubble(o, true);
      }
    }
  }

  rainbowAll(srcX, srcY) {
    const survivors = [];
    for (const o of this.bubbles) {
      if (!o.alive) continue;
      survivors.push(o);
    }
    survivors.forEach((o, i) => {
      setTimeout(() => {
        if (this.running) this.popBubble(o, true);
      }, i * 25);
    });
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time += dt;

    if (this.running) {
      this.elapsed += dt;
      this.spawnTimer -= dt;
      while (this.spawnTimer <= 0) {
        this.spawn();
        this.spawnTimer += this.spawnInterval();
      }
    }

    // 更新
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.update(dt, this.h);
      if (!b.alive) {
        this.bubbles.splice(i, 1);
        this.bubblePool.push(b);
      }
    }
    this.particles.update(dt);

    // コンボ減衰
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.onCombo(this.combo, this.multiplier());
      }
    }

    this.shake = Math.max(0, this.shake - dt * 80);
    this.flash = Math.max(0, this.flash - dt * 1.6);

    // 描画
    this.draw(dt);

    requestAnimationFrame(this.boundLoop);
  }

  draw(dt) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    // 背景 ( モード別 )
    const bgColors = this.modeCfg().bgGradient || ["#1f1547", "#0f1530", "#070a1a"];
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, bgColors[0]);
    bg.addColorStop(0.5, bgColors[1]);
    bg.addColorStop(1, bgColors[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 星
    drawStars(ctx, w, h, this.time);

    // シェイク
    let ox = 0, oy = 0;
    if (this.shake > 0.1) {
      ox = (Math.random() - 0.5) * this.shake;
      oy = (Math.random() - 0.5) * this.shake;
      ctx.save();
      ctx.translate(ox, oy);
    }

    for (const b of this.bubbles) b.draw(ctx, this.time);
    this.particles.draw(ctx);

    if (this.shake > 0.1) ctx.restore();

    // フラッシュ
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flash * 0.5})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  destroy() {
    this.running = false;
    window.removeEventListener("resize", this.boundResize);
    window.removeEventListener("orientationchange", this.boundResize);
  }
}

const STAR_SEED = [];
function drawStars(ctx, w, h, time) {
  if (STAR_SEED.length === 0) {
    for (let i = 0; i < 80; i++) {
      STAR_SEED.push({
        x: Math.random(),
        y: Math.random(),
        s: 0.6 + Math.random() * 1.6,
        ph: Math.random() * Math.PI * 2,
      });
    }
  }
  ctx.fillStyle = "#fff";
  for (const s of STAR_SEED) {
    const a = 0.3 + Math.sin(time * 1.5 + s.ph) * 0.3;
    ctx.globalAlpha = Math.max(0.1, a);
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
