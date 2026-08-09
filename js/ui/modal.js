// Modal manager: handles open/close, Escape-to-close, focus trap, and
// focus restoration. Replaces the bare `el.hidden = false` calls so every
// modal gets a consistent, accessible experience.

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusables(modal) {
  return Array.from(modal.querySelectorAll(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute("hidden")) return false;
    if (el.offsetParent === null) return false;
    return true;
  });
}

function trapTab(e, modal) {
  if (e.key !== "Tab") return;
  const items = focusables(modal);
  if (items.length === 0) {
    e.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

function onKeydown(e, modal) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeModal(modal);
    return;
  }
  trapTab(e, modal);
}

export function openModal(modalEl) {
  if (!modalEl || !modalEl.hidden) return;
  modalEl.dataset.opener = document.activeElement
    ? String(document.activeElement.id || "")
    : "";
  modalEl.hidden = false;
  const onKey = (e) => onKeydown(e, modalEl);
  modalEl._cleanupKey = () => modalEl.removeEventListener("keydown", onKey);
  modalEl.addEventListener("keydown", onKey);
  // Focus first focusable element (or the modal itself) on next frame.
  requestAnimationFrame(() => {
    const items = focusables(modalEl);
    if (items.length > 0) items[0].focus();
    else modalEl.setAttribute("tabindex", "-1"), modalEl.focus();
  });
}

export function closeModal(modalEl) {
  if (!modalEl || modalEl.hidden) return;
  modalEl.hidden = true;
  if (modalEl._cleanupKey) modalEl._cleanupKey();
  const openerId = modalEl.dataset.opener;
  if (openerId) {
    const opener = document.getElementById(openerId);
    if (opener) opener.focus();
  }
  delete modalEl.dataset.opener;
}
