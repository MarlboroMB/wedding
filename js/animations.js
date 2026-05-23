(() => {
  const elements = Array.from(document.querySelectorAll(".reveal"));
  if (!elements.length) return;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) {
    for (const el of elements) el.classList.add("is-visible");
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      }
    },
    { root: null, threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
  );

  for (const el of elements) io.observe(el);
})();

