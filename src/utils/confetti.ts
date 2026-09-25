interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

const COLORS = ['#10b981', '#14b8a6', '#34d399', '#fbbf24', '#a78bfa', '#f1f5f9'];
const PARTICLE_COUNT = 40;
const GRAVITY = 0.12;
const DURATION_MS = 1500;

export function fireConfetti(originX: number, originY: number): void {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
    x: originX,
    y: originY,
    vx: (Math.random() - 0.5) * 12,
    vy: Math.random() * -10 - 4,
    size: Math.random() * 6 + 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 8,
    opacity: 1,
  }));

  const startTime = performance.now();

  function animate(now: number): void {
    const elapsed = now - startTime;
    if (elapsed > DURATION_MS || !ctx) {
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fadeProgress = Math.max(0, (elapsed - DURATION_MS * 0.6) / (DURATION_MS * 0.4));

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += GRAVITY;
      p.rotation += p.rotationSpeed;
      p.opacity = 1 - fadeProgress;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}
