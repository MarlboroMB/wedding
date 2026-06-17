(() => {
  // Intro envelope (simple click-to-open)
  const intro = document.querySelector("[data-intro]");
  const envelope = document.querySelector("[data-envelope]");
  const INTRO_KEY = "wedding_intro_seen_v1";

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const hideIntro = () => {
    if (!intro) return;
    intro.hidden = true;
    document.body.classList.remove("is-locked");
  };

  const showIntro = () => {
    if (!intro) return;
    intro.hidden = false;
    document.body.classList.add("is-locked");
  };

  const markSeen = () => {
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      // ignore
    }
  };

  const hasSeen = () => {
    try {
      return sessionStorage.getItem(INTRO_KEY) === "1";
    } catch {
      return false;
    }
  };

  if (intro) {
    if (hasSeen()) {
      hideIntro();
    } else {
      showIntro();
    }
  }

  if (intro && envelope && !hasSeen()) {
    let opened = false;

    const openOnce = () => {
      if (opened) return;
      opened = true;
      intro.classList.add("is-opening");
      markSeen();
      envelope.classList.add("is-opening");
      const openDelay = prefersReduced ? 0 : 360;
      window.setTimeout(() => {
        envelope.classList.remove("is-opening");
        envelope.classList.add("is-open");
        finishIntro();
      }, openDelay);
    };

    const finishIntro = () => {
      if (!opened || intro.classList.contains("is-opened")) return;
      intro.classList.add("is-opened");
      window.setTimeout(() => {
        hideIntro();
        intro.classList.remove("is-opened", "is-opening");
      }, prefersReduced ? 0 : 620);
    };

    envelope.addEventListener("click", (e) => {
      if (intro.hidden) return;
      e.preventDefault();
      openOnce();
    });

    envelope.addEventListener("keydown", (e) => {
      if (intro.hidden) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openOnce();
      }
    });

    intro.addEventListener("click", (e) => {
      if (intro.hidden || opened) return;
      openOnce();
    });
  }

  const nav = document.getElementById("site-nav");
  const toggle = document.querySelector(".nav-toggle");

  function setOpen(open) {
    if (!nav || !toggle) return;
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");

    const lines = toggle.querySelector(".nav-toggle__lines");
    if (lines) {
      if (open) {
        lines.style.transform = "rotate(45deg)";
        lines.style.background = "transparent";
        lines.style.setProperty("--open", "1");
      } else {
        lines.style.transform = "";
        lines.style.background = "";
        lines.style.removeProperty("--open");
      }
      const before = window.getComputedStyle(lines, "::before");
      const after = window.getComputedStyle(lines, "::after");
      void before;
      void after;
    }
    document.body.dataset.navOpen = open ? "1" : "0";
  }

  if (toggle && nav) {
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
    nav.addEventListener("click", (e) => {
      const a = e.target?.closest?.("a[href^='#']");
      if (a) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }

  // Smooth scroll offset fix for sticky header
  const header = document.querySelector(".site-header");
  function scrollToHash(hash) {
    const id = hash?.replace?.("#", "");
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    const headerH = header?.getBoundingClientRect?.().height || 0;
    const y = window.scrollY + target.getBoundingClientRect().top - headerH - 10;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  document.addEventListener("click", (e) => {
    const a = e.target?.closest?.("a[href^='#']");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href || href === "#") return;
    const id = href.slice(1);
    if (!document.getElementById(id)) return;
    e.preventDefault();
    history.pushState(null, "", href);
    scrollToHash(href);
  });

  if (location.hash) {
    // Let layout settle (fonts, sticky header)
    window.setTimeout(() => scrollToHash(location.hash), 60);
  }

  // Calendar: August 2026, week starts Monday
  const grid = document.getElementById("calendar-grid");
  if (grid) {
    const year = 2026;
    const month = 7; // August (0-based)
    const highlight = 3;
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const jsDay = first.getDay(); // 0=Sun..6=Sat
    const mondayIndex = (jsDay + 6) % 7; // 0=Mon..6=Sun

    const totalCells = 42; // 6 weeks grid
    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement("div");
      cell.className = "day";
      const dayNum = i - mondayIndex + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cell.classList.add("day--empty");
        cell.setAttribute("aria-hidden", "true");
        cell.textContent = "";
      } else {
        cell.dataset.day = String(dayNum);
        cell.setAttribute("role", "gridcell");
        cell.textContent = String(dayNum);
        cell.setAttribute("aria-label", `${dayNum} августа 2026`);
        if (dayNum === highlight) {
          cell.classList.add("day--highlight");
          cell.setAttribute("aria-label", `${dayNum} августа 2026 — день свадьбы`);
        }
      }
      grid.appendChild(cell);
    }
  }

  // Slider
  const sliders = Array.from(document.querySelectorAll("[data-slider]"));
  for (const slider of sliders) {
    const track = slider.querySelector("[data-slider-track]");
    const counter = slider.querySelector("[data-slider-counter]");
    const dots = Array.from(slider.querySelectorAll("[data-slider-dot]"));
    const prev = slider.querySelector("[data-slider-prev]");
    const next = slider.querySelector("[data-slider-next]");
    const slides = track ? Array.from(track.children) : [];
    let index = 0;

    function setIndex(i, opts = { focus: false }) {
      const max = slides.length - 1;
      index = Math.max(0, Math.min(max, i));
      const x = -index * 100;
      if (track) track.style.transform = `translate3d(${x}%, 0, 0)`;
      if (counter) counter.textContent = `${index + 1}/${slides.length}`;
      for (const d of dots) d.setAttribute("aria-current", "false");
      const activeDot = dots[index];
      if (activeDot) activeDot.setAttribute("aria-current", "true");
      prev && (prev.disabled = index === 0);
      next && (next.disabled = index === max);
      if (opts.focus) activeDot?.focus?.();
    }

    prev?.addEventListener("click", () => setIndex(index - 1));
    next?.addEventListener("click", () => setIndex(index + 1));
    for (const d of dots) {
      d.addEventListener("click", () => setIndex(Number(d.dataset.sliderDot || "0")));
    }
    slider.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") setIndex(index - 1);
      if (e.key === "ArrowRight") setIndex(index + 1);
    });

    setIndex(0);
  }
})();

