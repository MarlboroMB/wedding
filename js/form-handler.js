(() => {
  const form = document.getElementById("rsvp-form");
  if (!form) return;

  const LS_KEY = "wedding_rsvp_v1";
  const otherDrinkToggle = document.getElementById("drink-other-toggle");
  const otherDrinkField = document.getElementById("drink-other-field");
  const otherDrinkInput = document.getElementById("drink-other-text");

  const modal = document.getElementById("thanks-modal");
  const closeEls = modal ? Array.from(modal.querySelectorAll("[data-modal-close]")) : [];
  let lastActive = null;

  function openModal() {
    if (!modal) return;
    lastActive = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    const focusTarget = modal.querySelector(".modal__close") || modal.querySelector("button, [href], input, textarea");
    focusTarget?.focus?.();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    lastActive?.focus?.();
  }

  for (const el of closeEls) el.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.hidden) closeModal();
  });
  modal?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.matches?.("[data-modal-close]")) closeModal();
  });

  function setError(name, message) {
    const holder = form.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
    if (holder) holder.textContent = message || "";
  }

  function getFormData() {
    const fd = new FormData(form);
    const drinks = fd.getAll("drinks");
    return {
      name: String(fd.get("name") || "").trim(),
      attendance: String(fd.get("attendance") || ""),
      drinks,
      otherDrinkText: String(fd.get("drink_other_text") || "").trim(),
      allergy: String(fd.get("allergy") || "").trim(),
      ts: new Date().toISOString(),
    };
  }

  function syncOtherDrinkField() {
    const show = Boolean(otherDrinkToggle?.checked);
    if (otherDrinkField) otherDrinkField.hidden = !show;
    if (!show && otherDrinkInput) {
      otherDrinkInput.value = "";
      setError("drink_other_text", "");
    }
  }

  function validate(data) {
    let ok = true;

    setError("name", "");
    setError("attendance", "");
    setError("drink_other_text", "");

    if (!data.name) {
      setError("name", "Пожалуйста, укажите имя и фамилию.");
      ok = false;
    }

    if (!data.attendance) {
      setError("attendance", "Пожалуйста, выберите вариант ответа.");
      ok = false;
    }

    const wantsOtherDrink = Array.isArray(data.drinks) && data.drinks.includes("other");
    if (wantsOtherDrink && !data.otherDrinkText) {
      setError("drink_other_text", "Пожалуйста, укажите ваш вариант напитка.");
      ok = false;
    }

    return ok;
  }

  function saveDraft() {
    try {
      const draft = getFormData();
      localStorage.setItem(LS_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.name) form.elements.namedItem("name").value = d.name;
      if (d?.attendance) {
        const r = form.querySelector(`input[name="attendance"][value="${CSS.escape(d.attendance)}"]`);
        if (r) r.checked = true;
      }
      if (Array.isArray(d?.drinks)) {
        for (const v of d.drinks) {
          const c = form.querySelector(`input[name="drinks"][value="${CSS.escape(String(v))}"]`);
          if (c) c.checked = true;
        }
      }
      if (d?.otherDrinkText && otherDrinkInput) otherDrinkInput.value = d.otherDrinkText;
      syncOtherDrinkField();
    } catch {
      // ignore
    }
  }

  restoreDraft();
  syncOtherDrinkField();

  otherDrinkToggle?.addEventListener("change", () => {
    syncOtherDrinkField();
    saveDraft();
  });

  form.addEventListener("input", () => {
    window.clearTimeout(form.__saveTimer);
    form.__saveTimer = window.setTimeout(saveDraft, 200);
  });

  // === Отправка анкеты на email через PHP ===
  const PHP_ENDPOINT = "send.php";
  const REQUEST_TIMEOUT = 8000; // 8 секунд

  async function submitForm(data) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(PHP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      const result = await response.json();
      return { ok: response.ok, ...result };
    } finally {
      clearTimeout(timer);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = getFormData();
    if (!validate(data)) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const prevText = submitBtn?.textContent || "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Отправляем…";
    }

    let sent = false;
    try {
      const result = await submitForm(data);
      sent = result.ok === true;
    } catch {
      sent = false;
    }

    try {
      if (sent) {
        localStorage.removeItem(LS_KEY);
      } else {
        localStorage.setItem(LS_KEY, JSON.stringify({ ...data, sent }));
      }
    } catch {
      // ignore
    }

    if (sent) {
      form.reset();
      setError("name", "");
      setError("attendance", "");
      setError("drink_other_text", "");
      setError("allergy", "");
      syncOtherDrinkField();

      // Конфетти 🎊
      if (typeof window.confetti?.fire === "function") {
        window.confetti.fire({ count: 80 });
      }
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = prevText;
    }

    const modalText = modal?.querySelector(".muted");
    if (modalText) {
      modalText.textContent = sent
        ? "Мы получили анкету и очень ждём встречи."
        : "Не удалось отправить анкету. Проверьте интернет и попробуйте ещё раз.";
    }

    openModal();
  });
})();
