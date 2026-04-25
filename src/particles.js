// Pooled particle system. Allocations are amortized so spawn-heavy frames stay smooth.

const POOL_MAX = 1500;

export class ParticleSystem {
  constructor() {
    this.alive = [];
    this.pool = [];
  }

  acquire() {
    return this.pool.pop() || {
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 0,
      size: 0, color: "#fff",
      gravity: 0, drag: 0.99,
      shape: "circle",
      rotation: 0, spin: 0,
    };
  }

  release(p) {
    if (this.pool.length < POOL_MAX) this.pool.push(p);
  }

  emitBurst(x, y, opts = {}) {
    const {
      count = 18,
      colors = ["#fff"],
      speed = 320,
      speedJitter = 220,
      life = 0.7,
      lifeJitter = 0.4,
      size = 5,
      sizeJitter = 4,
      gravity = 600,
      drag = 0.97,
      shape = "circle",
      angle = null,
      spread = Math.PI * 2,
    } = opts;

    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      const a = angle !== null
        ? angle + (Math.random() - 0.5) * spread
        : Math.random() * Math.PI * 2;
      const v = speed + Math.random() * speedJitter;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v - 60;
      p.maxLife = life + Math.random() * lifeJitter;
      p.life = p.maxLife;
      p.size = size + Math.random() * sizeJitter;
      p.color = colors[(Math.random() * colors.length) | 0];
      p.gravity = gravity;
      p.drag = drag;
      p.shape = shape;
      p.rotation = Math.random() * Math.PI * 2;
      p.spin = (Math.random() - 0.5) * 12;
      this.alive.push(p);
    }
  }

  emitRing(x, y, opts = {}) {
    const { count = 24, radius = 30, life = 0.5, color = "#fff", thickness = 2 } = opts;
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      const a = (i / count) * Math.PI * 2;
      p.x = x + Math.cos(a) * radius;
      p.y = y + Math.sin(a) * radius;
      p.vx = Math.cos(a) * 220;
      p.vy = Math.sin(a) * 220;
      p.maxLife = life;
      p.life = life;
      p.size = thickness;
      p.color = color;
      p.gravity = 0;
      p.drag = 0.94;
      p.shape = "circle";
      p.rotation = 0;
      p.spin = 0;
      this.alive.push(p);
    }
  }

  update(dt) {
    const list = this.alive;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        this.release(p);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
    }
  }

  draw(ctx) {
    const list = this.alive;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, Math.min(1, t));
      ctx.fillStyle = p.color;
      if (p.shape === "square") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * t), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    while (this.alive.length) this.release(this.alive.pop());
  }
}
