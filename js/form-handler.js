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

  // === Отправка в Telegram ===
  // Укажите здесь ваш токен бота и ID чата.
  const TG_BOT_TOKEN = "8982605046:AAHrih20F3B9hY9kmKY7BRKGyVZdOp5kXu0";
  const TG_CHAT_ID = "584025747"; // личный чат с создателем (Mikhail)
  // ⚠️ Если хотите получать анкеты в группу:
  //    1. Добавьте бота в группу как администратора
  //    2. Напишите любое сообщение в группу
  //    3. Выполните: curl https://api.telegram.org/bot<TOKEN>/getUpdates
  //    4. Скопируйте chat.id из ответа (обычно с минусом: -1001234567890)

  function formatTelegramMessage(data) {
    const attendanceText =
      data.attendance === "yes" ? "Обязательно буду" : data.attendance === "no" ? "К сожалению, не смогу присутствовать" : "—";

    const drinksMap = {
      red_wine: "Вино красное",
      white_wine: "Вино белое",
      champagne: "Шампанское",
      whiskey: "Виски",
      cognac: "Коньяк",
      vodka: "Водка",
      other: "Другое",
    };

    const selectedDrinks = Array.isArray(data.drinks) ? data.drinks : [];
    const drinksList = selectedDrinks.length
      ? selectedDrinks
          .map((d) => {
            if (d !== "other") return drinksMap[d] || d;
            return data.otherDrinkText ? `другое (${data.otherDrinkText})` : "другое";
          })
          .join(", ")
      : "не выбрано";

    return [
      "Новая анкета гостя",
      "",
      `Имя: ${data.name || "—"}`,
      `Присутствие: ${attendanceText}`,
      `Напитки: ${drinksList}`,
      "",
      `Отправлено: ${new Date(data.ts).toLocaleString("ru-RU")}`,
    ].join("\n");
  }

  /**
   * Отправка через Image GET — основной метод.
   * Работает из любого контекста (file://, http://, локально).
   * Telegram Bot API принимает GET-запросы с параметрами в URL.
   * Браузер делает запрос без CORS-ограничений.
   */
  function sendViaImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { resolve({ ok: true }); };
      img.onerror = () => { resolve({ ok: true }); };
      try {
        img.src = url;
      } catch {
        resolve({ ok: false });
      }
    });
  }

  async function submitToTelegram(payload) {
    if (!TG_BOT_TOKEN || TG_BOT_TOKEN === "PASTE_YOUR_BOT_TOKEN_HERE") {
      return { ok: true };
    }

    const text = formatTelegramMessage(payload);

    // GET-запрос через Image — работает откуда угодно (file://, http://).
    // Telegram API принимает sendMessage через GET.
    const params = new URLSearchParams({
      chat_id: TG_CHAT_ID,
      text,
      disable_web_page_preview: "true",
    });
    params.set("_", Date.now());

    const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage?${params.toString()}`;
    await sendViaImage(url);
    return { ok: true };
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
      await submitToTelegram(data);
      sent = true;
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
      syncOtherDrinkField();
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

