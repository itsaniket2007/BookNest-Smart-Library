(function () {
  "use strict";

  const app = window.BookNest;
  const bookId = new URLSearchParams(window.location.search).get("id");
  const status = document.getElementById("readerStatus");
  const toolbar = document.getElementById("readerToolbar");
  const stage = document.getElementById("readerStage");
  const pagesHost = document.getElementById("readerPages");
  const pageLabel = document.getElementById("pageLabel");
  const progressLabel = document.getElementById("progressLabel");

  let pdfDoc = null;
  let currentPage = 1;
  let scale = 1.2;
  let pageWidth = 0;
  let pageHeight = 0;
  let slotHeight = 0;
  let saveTimer = null;
  const rendered = new Set();
  const rendering = new Set();

  function setStatus(message, ok) {
    status.textContent = message;
    status.className = "form-status " + (ok ? "is-success" : "is-error");
  }

  function percentForPage(page) {
    return pdfDoc ? Math.min(100, Math.round((page / pdfDoc.numPages) * 100)) : 0;
  }

  function updatePosition(page, save) {
    currentPage = Math.max(1, Math.min(page, pdfDoc.numPages));
    pageLabel.textContent = "Page " + currentPage + " of " + pdfDoc.numPages;
    progressLabel.textContent = percentForPage(currentPage) + "%";
    if (save) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        app.savePage(bookId, currentPage, percentForPage(currentPage));
      }, 450);
    }
  }

  function slotFor(page) {
    return pagesHost.querySelector('[data-page="' + page + '"]');
  }

  function renderPage(pageNumber) {
    if (!pdfDoc || rendered.has(pageNumber) || rendering.has(pageNumber)) return Promise.resolve();
    const slot = slotFor(pageNumber);
    if (!slot) return Promise.resolve();
    rendering.add(pageNumber);
    return pdfDoc.getPage(pageNumber).then(function (page) {
      const viewport = page.getViewport({ scale: scale });
      const canvas = document.createElement("canvas");
      canvas.className = "pdf-page-canvas";
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      slot.replaceChildren(canvas);
      slot.style.height = Math.ceil(viewport.height) + "px";
      return page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
    }).then(function () {
      rendered.add(pageNumber);
    }).catch(function () {
      slot.textContent = "This page could not be rendered.";
    }).finally(function () {
      rendering.delete(pageNumber);
    });
  }

  function renderNear(page) {
    let chain = Promise.resolve();
    const start = Math.max(1, page - 2);
    const end = Math.min(pdfDoc.numPages, page + 3);
    for (let number = start; number <= end; number += 1) {
      chain = chain.then(function (p) { return function () { return renderPage(p); }; }(number));
    }
    return chain;
  }

  function renderVisiblePages() {
    if (!pdfDoc) return;
    const estimated = Math.max(1, Math.floor(stage.scrollTop / slotHeight) + 1);
    updatePosition(estimated, true);
    renderNear(estimated);
  }

  function scrollToPage(page, behavior) {
    const safePage = Math.max(1, Math.min(page, pdfDoc.numPages));
    stage.scrollTo({ top: (safePage - 1) * slotHeight, behavior: behavior || "auto" });
    updatePosition(safePage, true);
    renderNear(safePage);
  }

  function buildSlots() {
    rendered.clear();
    rendering.clear();
    pagesHost.replaceChildren();
    for (let page = 1; page <= pdfDoc.numPages; page += 1) {
      const slot = document.createElement("section");
      slot.className = "pdf-page-slot";
      slot.dataset.page = String(page);
      slot.style.width = Math.ceil(pageWidth) + "px";
      slot.style.height = Math.ceil(pageHeight) + "px";
      slot.setAttribute("aria-label", "Page " + page);
      pagesHost.append(slot);
    }
  }

  function recalculateLayout(restorePage) {
    return pdfDoc.getPage(1).then(function (page) {
      const viewport = page.getViewport({ scale: scale });
      pageWidth = viewport.width;
      pageHeight = viewport.height;
      slotHeight = Math.ceil(pageHeight) + 18;
      buildSlots();
      scrollToPage(restorePage || currentPage, "auto");
    });
  }

  function adjustZoom(change) {
    scale = Math.max(0.7, Math.min(2.2, scale + change));
    recalculateLayout(currentPage);
  }

  document.getElementById("zoomIn").addEventListener("click", function () { adjustZoom(0.15); });
  document.getElementById("zoomOut").addEventListener("click", function () { adjustZoom(-0.15); });
  document.getElementById("fullScreen").addEventListener("click", function () {
    if (!document.fullscreenElement) stage.requestFullscreen().then(function () { stage.focus(); }).catch(function () {});
    else document.exitFullscreen();
  });

  stage.addEventListener("scroll", renderVisiblePages, { passive: true });
  stage.addEventListener("keydown", function (event) {
    const amount = Math.max(160, Math.round(stage.clientHeight * 0.78));
    if (["ArrowDown", "PageDown", " "].includes(event.key)) { event.preventDefault(); stage.scrollBy({ top: amount, behavior: "smooth" }); }
    if (["ArrowUp", "PageUp"].includes(event.key)) { event.preventDefault(); stage.scrollBy({ top: -amount, behavior: "smooth" }); }
    if (event.key === "Home") { event.preventDefault(); scrollToPage(1, "smooth"); }
    if (event.key === "End") { event.preventDefault(); scrollToPage(pdfDoc.numPages, "smooth"); }
  });

  const themeButton = document.getElementById("themeButton");
  if (themeButton) {
    themeButton.textContent = app.isDark() ? "☼ Light mode" : "☾ Dark mode";
    themeButton.addEventListener("click", function () { app.toggleTheme(); themeButton.textContent = app.isDark() ? "☼ Light mode" : "☾ Dark mode"; });
  }

  if (!bookId) return setStatus("Open the reader from a book that has an authorized PDF.", false);
  if (typeof pdfjsLib === "undefined") return setStatus("PDF.js failed to load. Check your internet connection for the CDN script.", false);
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  app.boot().then(function () {
    const book = app.getBook(bookId);
    if (book) document.getElementById("readerTitle").textContent = book.title;
    if (!app.state.user) throw new Error("Log in, then buy or borrow an authorized title to read it.");
    return fetch("/api/books/" + bookId + "/pdf", { credentials: "include" });
  }).then(function (response) {
    if (!response.ok) return response.json().then(function (data) { throw new Error(data.message || "You cannot open this PDF."); });
    return response.arrayBuffer();
  }).then(function (buffer) {
    return pdfjsLib.getDocument({ data: buffer }).promise;
  }).then(function (pdf) {
    pdfDoc = pdf;
    toolbar.classList.remove("hidden");
    stage.classList.remove("hidden");
    const saved = app.getReading()[bookId];
    currentPage = saved && saved.currentPage ? Math.min(saved.currentPage, pdf.numPages) : 1;
    setStatus("Scroll naturally to read. Your page position is saved automatically.", true);
    return window.BookNestAPI.post("/api/reading", { bookId: bookId }).catch(function () {}).then(function () { return recalculateLayout(currentPage); });
  }).catch(function (error) {
    setStatus(error.message || "Could not open the PDF.", false);
  });
}());
