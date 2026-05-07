import { TIERS, MAX_TIER, drawApple } from "./apple.js";
import { ParticleSystem } from "./particles.js";

const GRAVITY = 1500;
const RESTITUTION = 0.18;
const SUBSTEPS = 4;
const VEL_DAMP = 0.999;
const GROUND_FRICTION = 0.92;
const DANGER_HOLD = 1.8;   // 何秒 危険ラインを 越え続けたら ゲームオーバー
const DANGER_GRACE = 1.2;  // 投下直後 この秒数は 判定しない

let nextId = 1;

export class World {
  constructor(w, h, opts = {}) {
    this.w = w;
    this.h = h;
    this.dangerY = opts.dangerY ?? 110;
    this.apples = [];
    this.particles = new ParticleSystem();
    this.score = 0;
    this.bestTierReached = 0;
    this.gameOver = false;
    this.shake = 0;
    this.onScore = opts.onScore || (() => {});
    this.onGameOver = opts.onGameOver || (() => {});
    this.onMerge = opts.onMerge || (() => {});
    this.onTierReached = opts.onTierReached || (() => {});
  }

  reset() {
    this.apples.length = 0;
    this.particles.clear();
    this.score = 0;
    this.bestTierReached = 0;
    this.gameOver = false;
    this.shake = 0;
    this.onScore(this.score);
  }

  spawn(x, tier) {
    const t = TIERS[tier];
    const a = {
      id: nextId++,
      tier,
      x,
      y: -t.r,
      vx: 0,
      vy: 0,
      r: t.r,
      mass: Math.max(1, t.r * t.r / 100),
      age: 0,
      dangerTime: 0,
    };
    this.apples.push(a);
    return a;
  }

  step(dt) {
    if (this.gameOver) {
      this.particles.update(dt);
      this.shake = Math.max(0, this.shake - dt * 80);
      return;
    }

    const sub = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) this.physicsStep(sub);

    for (const a of this.apples) {
      a.age += dt;
      const top = a.y - a.r;
      const settled = Math.abs(a.vy) < 30 && Math.abs(a.vx) < 30;
      if (top < this.dangerY && settled && a.age > DANGER_GRACE) {
        a.dangerTime += dt;
        if (a.dangerTime > DANGER_HOLD) {
          this.gameOver = true;
          this.shake = 30;
          this.onGameOver(this.score);
          return;
        }
      } else if (top >= this.dangerY) {
        a.dangerTime = 0;
      }
    }

    this.particles.update(dt);
    this.shake = Math.max(0, this.shake - dt * 80);
  }

  physicsStep(dt) {
    const apples = this.apples;

    for (const a of apples) {
      a.vy += GRAVITY * dt;
      a.vx *= VEL_DAMP;
      a.vy *= VEL_DAMP;
      a.x += a.vx * dt;
      a.y += a.vy * dt;

      if (a.x - a.r < 0)      { a.x = a.r;          a.vx = -a.vx * RESTITUTION; }
      if (a.x + a.r > this.w) { a.x = this.w - a.r; a.vx = -a.vx * RESTITUTION; }
      if (a.y + a.r > this.h) {
        a.y = this.h - a.r;
        a.vy = -a.vy * RESTITUTION;
        a.vx *= GROUND_FRICTION;
      }
    }

    const merges = [];
    const merged = new Set();
    for (let i = 0; i < apples.length; i++) {
      const a = apples[i];
      if (merged.has(a.id)) continue;
      for (let j = i + 1; j < apples.length; j++) {
        const b = apples[j];
        if (merged.has(b.id)) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const sumR = a.r + b.r;
        const dSq = dx * dx + dy * dy;
        if (dSq >= sumR * sumR) continue;
        if (dSq < 1e-6) {
          // 完全重なり → ずらす
          a.x += 0.5;
          continue;
        }

        const d = Math.sqrt(dSq);
        const nx = dx / d;
        const ny = dy / d;
        const overlap = sumR - d;

        if (a.tier === b.tier && a.tier < MAX_TIER) {
          merges.push([a, b]);
          merged.add(a.id);
          merged.add(b.id);
          break;
        }

        const totalMass = a.mass + b.mass;
        a.x += nx * overlap * (b.mass / totalMass);
        a.y += ny * overlap * (b.mass / totalMass);
        b.x -= nx * overlap * (a.mass / totalMass);
        b.y -= ny * overlap * (a.mass / totalMass);

        const rvx = a.vx - b.vx;
        const rvy = a.vy - b.vy;
        const velN = rvx * nx + rvy * ny;
        if (velN < 0) {
          const e = RESTITUTION;
          const jImp = -(1 + e) * velN / (1 / a.mass + 1 / b.mass);
          const ix = jImp * nx;
          const iy = jImp * ny;
          a.vx += ix / a.mass;
          a.vy += iy / a.mass;
          b.vx -= ix / b.mass;
          b.vy -= iy / b.mass;
        }
      }
    }

    if (merges.length > 0) {
      const removeIds = new Set();
      for (const [a, b] of merges) {
        removeIds.add(a.id);
        removeIds.add(b.id);
        const newTier = a.tier + 1;
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const newR = TIERS[newTier].r;
        this.apples.push({
          id: nextId++,
          tier: newTier,
          x: cx,
          y: cy,
          vx: (a.vx + b.vx) / 2 * 0.5,
          vy: (a.vy + b.vy) / 2 * 0.5 - 80,
          r: newR,
          mass: Math.max(1, newR * newR / 100),
          age: 0,
          dangerTime: 0,
        });

        const earned = TIERS[newTier].score;
        this.score += earned;
        if (newTier > this.bestTierReached) {
          this.bestTierReached = newTier;
          this.onTierReached(newTier);
        }
        this.onScore(this.score, earned, cx, cy);
        this.onMerge(newTier, cx, cy);

        const palette = [TIERS[newTier].color, "#ffffff", "#fff2c0", "#fff7e0"];
        this.particles.emitBurst(cx, cy, {
          count: Math.min(48, 16 + newTier * 3),
          colors: palette,
          speed: 200 + newTier * 22,
          speedJitter: 140,
          life: 0.55,
          lifeJitter: 0.4,
          size: 3 + newTier * 0.4,
          gravity: 700,
        });
        this.particles.emitRing(cx, cy, {
          count: 22,
          radius: newR * 0.6,
          color: TIERS[newTier].color,
          thickness: 3,
          life: 0.4,
        });

        this.shake = Math.min(20, this.shake + 2 + newTier * 0.6);
      }
      this.apples = this.apples.filter((a) => !removeIds.has(a.id));
    }
  }

  draw(ctx) {
    const w = this.w;
    const h = this.h;

    // 背景 ( クラフト紙 風 )
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#fde7c2");
    bg.addColorStop(1, "#fff7e3");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 木目 風
    ctx.strokeStyle = "rgba(150, 90, 40, 0.06)";
    ctx.lineWidth = 1;
    for (let y = 24; y < h; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + 4, w * 0.7, y - 4, w, y);
      ctx.stroke();
    }

    // シェイク
    let ox = 0, oy = 0;
    if (this.shake > 0.1) {
      ox = (Math.random() - 0.5) * this.shake;
      oy = (Math.random() - 0.5) * this.shake;
      ctx.save();
      ctx.translate(ox, oy);
    }

    // 危険ライン
    ctx.strokeStyle = "rgba(220, 60, 60, 0.55)";
    ctx.setLineDash([10, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.dangerY);
    ctx.lineTo(w, this.dangerY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "700 11px 'Hiragino Sans', system-ui, sans-serif";
    ctx.fillStyle = "rgba(180, 40, 40, 0.7)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("LINE", 8, this.dangerY - 8);

    // りんご
    for (const a of this.apples) {
      const danger = Math.min(1, a.dangerTime / DANGER_HOLD);
      drawApple(ctx, a.x, a.y, a.r, a.tier, { danger });
    }

    // パーティクル
    this.particles.draw(ctx);

    if (this.shake > 0.1) ctx.restore();

    // 壁の 影
    const wallShade = ctx.createLinearGradient(0, 0, 16, 0);
    wallShade.addColorStop(0, "rgba(80, 40, 0, 0.18)");
    wallShade.addColorStop(1, "rgba(80, 40, 0, 0)");
    ctx.fillStyle = wallShade;
    ctx.fillRect(0, 0, 12, h);
    const wallShade2 = ctx.createLinearGradient(w - 16, 0, w, 0);
    wallShade2.addColorStop(0, "rgba(80, 40, 0, 0)");
    wallShade2.addColorStop(1, "rgba(80, 40, 0, 0.18)");
    ctx.fillStyle = wallShade2;
    ctx.fillRect(w - 12, 0, 12, h);
    const floorShade = ctx.createLinearGradient(0, h - 16, 0, h);
    floorShade.addColorStop(0, "rgba(80, 40, 0, 0)");
    floorShade.addColorStop(1, "rgba(80, 40, 0, 0.22)");
    ctx.fillStyle = floorShade;
    ctx.fillRect(0, h - 12, w, 12);
  }
}
