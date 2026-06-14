(() => {
  "use strict";

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) return;

  // Палитра свадьбы
  const COLORS = ["#b77a4a", "#f2e8c9", "#a6c4a2", "#8b5d49", "#9e8a78", "#c9bdb0", "#d4a5a5"];

  let canvas = null;
  let ctx = null;
  let particles = [];
  let rafId = null;

  function createCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;display:none;";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    if (ctx) ctx.scale(devicePixelRatio, devicePixelRatio);
  }

  function randomBetween(a, b) {
    return a + Math.random() * (b - a);
  }

  function spawn(x, y, count) {
    for (let i = 0; i < count; i++) {
      const angle = randomBetween(0, Math.PI * 2);
      const speed = randomBetween(4, 14);
      const size = randomBetween(5, 10);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        size,
        color,
        rotation: randomBetween(0, Math.PI * 2),
        rotSpeed: randomBetween(-0.2, 0.2),
        opacity: 1,
        decay: randomBetween(0.008, 0.02),
        shape: Math.random() > 0.5 ? "rect" : "circle",
      });
    }
  }

  function drawParticle(p) {
    if (!ctx) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = Math.max(0, p.opacity);
    ctx.fillStyle = p.color;

    if (p.shape === "rect") {
      const half = p.size / 2;
      ctx.fillRect(-half, -half / 2, p.size, p.size * 0.6);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function animate() {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio);

    let alive = false;

    for (const p of particles) {
      p.x += p.vx;
      p.vy += 0.25; // gravity
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.opacity -= p.decay;

      if (p.opacity > 0 && p.y < window.innerHeight + 20) {
        drawParticle(p);
        alive = true;
      }
    }

    particles = particles.filter(
      (p) => p.opacity > 0 && p.y < window.innerHeight + 20,
    );

    if (alive || particles.length > 0) {
      rafId = requestAnimationFrame(animate);
    } else {
      cleanup();
    }
  }

  function cleanup() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    particles = [];
    if (canvas) {
      canvas.style.display = "none";
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function fire(opts = {}) {
    const count = opts.count || 60;
    const spread = opts.spread || 1;

    createCanvas();
    if (!canvas || !ctx) return;

    resize();
    canvas.style.display = "block";

    const cx = canvas.width / 2 / devicePixelRatio;
    const cy = canvas.height / 2 / devicePixelRatio;

    // Разбрасываем частицы из центра ± spread
    const originX = cx;
    const originY = cy - 60;

    spawn(originX, originY, count);

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    animate();
  }

  // Пересчёт размера canvas при ресайзе
  window.addEventListener("resize", () => {
    if (canvas && canvas.style.display !== "none") resize();
  });

  window.confetti = { fire };
})();
