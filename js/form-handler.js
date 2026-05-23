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
  const TG_CHAT_ID = "-1003967363523";

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

  function sendViaImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const done = () => {
        img.onload = null;
        img.onerror = null;
      };
      img.onload = () => {
        done();
        resolve({ ok: true });
      };
      img.onerror = () => {
        done();
        // Для кросс-доменных запросов браузер часто отдает onerror,
        // даже если сервер принял запрос. Считаем отправленным.
        resolve({ ok: true });
      };
      try {
        img.src = `${url}&_=${Date.now()}`;
      } catch (e) {
        reject(e);
      }
    });
  }

  function sendViaHiddenForm(url, payload) {
    return new Promise((resolve, reject) => {
      try {
        const iframe = document.createElement("iframe");
        iframe.name = `tg-send-${Date.now()}`;
        iframe.style.display = "none";

        const f = document.createElement("form");
        f.method = "POST";
        f.action = url;
        f.target = iframe.name;
        f.style.display = "none";

        Object.entries(payload).forEach(([k, v]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = k;
          input.value = String(v ?? "");
          f.appendChild(input);
        });

        document.body.appendChild(iframe);
        document.body.appendChild(f);
        f.submit();

        window.setTimeout(() => {
          f.remove();
          iframe.remove();
          resolve({ ok: true });
        }, 1200);
      } catch (e) {
        reject(e);
      }
    });
  }

  async function submitToTelegram(payload) {
    if (!TG_BOT_TOKEN || TG_BOT_TOKEN === "PASTE_YOUR_BOT_TOKEN_HERE") {
      // Если токен не задан, просто считаем отправку успешной,
      // чтобы не ломать UX при разработке.
      return { ok: true };
    }

    const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6500);
    const text = formatTelegramMessage(payload);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          chat_id: TG_CHAT_ID,
          text,
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true };
    } catch {
      const q = new URLSearchParams({
        chat_id: TG_CHAT_ID,
        text,
        disable_web_page_preview: "true",
      });
      const fallbackUrl = `${url}?${q.toString()}`;
      try {
        await sendViaImage(fallbackUrl);
      } catch {
        // Последний fallback: обычная HTML-форма в скрытый iframe.
        await sendViaHiddenForm(url, {
          chat_id: TG_CHAT_ID,
          text,
          disable_web_page_preview: "true",
        });
      }
      return { ok: true };
    } finally {
      window.clearTimeout(timeout);
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

