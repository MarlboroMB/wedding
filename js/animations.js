(() => {
  // === Reveal on scroll (improved) ===
  const revealElements = Array.from(document.querySelectorAll(".reveal"));
  if (!revealElements.length) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) {
    for (const el of revealElements) el.classList.add("is-visible");
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target;

          // Stagger for timeline items
          if (el.classList.contains("timeline__item")) {
            const siblings = el.closest(".timeline")?.querySelectorAll(".timeline__item");
            if (siblings) {
              let idx = 0;
              for (const sib of siblings) {
                if (sib === el) break;
                if (!sib.classList.contains("is-visible")) idx++;
              }
              el.style.transitionDelay = `${idx * 120}ms`;
            }
          }

          // Stagger for swatches
          if (el.classList.contains("swatch")) {
            const siblings = el.closest(".swatches")?.querySelectorAll(".swatch");
            if (siblings) {
              let idx = 0;
              for (const sib of siblings) {
                if (sib === el) break;
                idx++;
              }
              el.style.transitionDelay = `${idx * 60}ms`;
            }
          }

          el.classList.add("is-visible");
          io.unobserve(el);
        }
      }
    },
    { root: null, threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
  );

  for (const el of revealElements) {
    // If timeline item, set base delay
    if (el.classList.contains("timeline__item")) {
      el.style.transitionDuration = "500ms";
    }
    io.observe(el);
  }
})();
