(function (global) {
  const DEFAULT_DURATION = 7000;
  let container = null;

  const styles = {
    info: "toast-info",
    success: "toast-success",
    error: "toast-error",
    warning: "toast-warning",
  };

  function ensureContainer() {
    if (container) return container;
    container = document.createElement("div");
    container.id = "toast-root";
    container.className = "toast-root";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
    return container;
  }

  function dismiss(el) {
    if (!el || !el.parentNode) return;
    el.classList.add("toast-out");
    window.setTimeout(() => el.remove(), 200);
  }

  function showToast(message, type, duration) {
    const root = ensureContainer();
    const kind = styles[type] ? type : "info";
    const ms = typeof duration === "number" ? duration : DEFAULT_DURATION;

    const el = document.createElement("div");
    el.className = `toast ${styles[kind]}`;
    el.setAttribute("role", "status");

    const text = document.createElement("p");
    text.className = "toast-text";
    text.textContent = message;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast-close";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";
    close.addEventListener("click", () => dismiss(el));

    el.appendChild(text);
    el.appendChild(close);
    root.appendChild(el);

    window.setTimeout(() => dismiss(el), ms);
    return el;
  }

  global.KaarobarToast = {
    show: (message, opts) =>
      showToast(message, (opts && opts.type) || "info", opts && opts.duration),
    success: (message, duration) => showToast(message, "success", duration),
    error: (message, duration) => showToast(message, "error", duration),
    info: (message, duration) => showToast(message, "info", duration),
    warning: (message, duration) => showToast(message, "warning", duration),
  };
})(window);
