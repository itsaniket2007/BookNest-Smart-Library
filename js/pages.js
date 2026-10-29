const app = window.BookNest;
  const $ = function (id) { return document.getElementById(id); };

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

  /* 1. Shared helpers ------------------------------------------------------ */
  function setStatus(node, message, ok) {
    if (!node) return;
    node.textContent = message;
    node.className = "form-status " + (ok ? "is-success" : "is-error");
  }