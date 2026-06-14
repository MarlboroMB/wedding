(() => {
  "use strict";

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) return;

  // Только десктоп (768px+)
  if (window.innerWidth < 768) return;

  const hero = document.querySelector(".hero");
  const bg = hero?.querySelector(".hero__bg");
  if (!hero || !bg) return;

  const FACTOR = 0.25;

  function update() {
    const rect = hero.getBoundingClientRect();
    // Если секция вне зоны видимости — не трогаем
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;

    const viewportH = window.innerHeight;
    const offset = viewportH - rect.top;
    // y от 0 до ~ -60px
    const y = Math.max(-70, Math.min(0, offset * FACTOR - 100));
    bg.style.transform = `translate3d(0, ${y}px, 0)`;
  }

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          update();
          ticking = false;
        });
        ticking = true;
      }
    },
    { passive: true },
  );

  // Первый вызов на случай если hero уже в зоне видимости
  update();
})();
