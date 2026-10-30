(function () {
  "use strict";

  const app = window.BookNest;
  const SECONDARY_PAGES = {
    "borrow.html": "Borrow Books",
    "library.html": "My Library",
    "cart.html": "Shopping Cart & Wishlist",
    "wishlist.html": "My Wishlist",
    "profile.html": "My Profile",
    "contact.html": "Contact Us",
    "feedback.html": "Feedback"
  };
  const WATCHED_KEYS = Object.values(app.KEYS);
  const DATA_AND_TECH = ["Data Science", "Programming"];
  const DEFAULT_VISIBLE_BOOKS = 5;

  const $ = function (id) { return document.getElementById(id); };
  const refs = {
    sidebar: $("sidebar"),
    menuButton: $("menuButton"),
    menuOverlay: $("menuOverlay"),
    searchForm: $("searchForm"),
    searchInput: $("searchInput"),
    categoryFilter: $("categoryFilter"),
    bookList: $("bookList"),
    bookCount: $("bookCount"),
    noBooks: $("noBooks"),
    cartCount: $("cartCount"),
    notice: $("notice"),
    pageModal: $("pageModal"),
    pageFrame: $("pageFrame"),
    pageModalTitle: $("pageModalTitle")
  };

  let showAllBooks = false;
  let noticeTimer = null;
  let modalOpener = null;
  function notice(message) {
    refs.notice.textContent = message;
    refs.notice.classList.add("show");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { refs.notice.classList.remove("show"); }, 3000);
  }

  function scrollToSection(id) {
    const section = $(id);
    if (section) section.scrollIntoView({ behavior: "smooth" });
  }

  function openMenu() {
    refs.sidebar.classList.add("open");
    refs.menuOverlay.classList.add("show");
    refs.menuButton.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    refs.sidebar.classList.remove("open");
    refs.menuOverlay.classList.remove("show");
    refs.menuButton.setAttribute("aria-expanded", "false");
  }

  function openPage(path) {
    const parts = String(path).split("#");
    const file = parts[0];
    if (!SECONDARY_PAGES[file]) return;
    refs.pageModalTitle.textContent = SECONDARY_PAGES[file];
    refs.pageFrame.title = SECONDARY_PAGES[file];
    refs.pageFrame.src = file + (parts[1] ? "#" + parts[1] : "");
    document.body.style.overflow = "hidden";
    closeMenu();
    if (!refs.pageModal.open) {
      modalOpener = document.activeElement;
      refs.pageModal.showModal();
    }
  }

  function handlePageClosed() {
    refs.pageFrame.src = "about:blank";
    document.body.style.overflow = "";
    renderAll();
    if (modalOpener && typeof modalOpener.focus === "function") modalOpener.focus();
  }

  function handleFrameMessage(event) {
    const data = event.data;
    if (event.source !== refs.pageFrame.contentWindow || !data || data.namespace !== "booknest") return;
    if (data.type === "refresh") renderAll();
    if (data.type === "close") refs.pageModal.close();
    if (data.type === "navigate" && typeof data.path === "string") {
      const parts = data.path.split("#");
      if (parts[0] === "index.html") {
        refs.pageModal.close();
        if (parts[1]) scrollToSection(parts[1]);
      } else {
        openPage(data.path);
      }
    }
  }

  /*Rendering ----------------------------------------------------------- */
  function renderThemeButton() {
    const dark = app.isDark();
    $("themeIcon").textContent = dark ? "☼" : "☾";
    $("themeLabel").textContent = dark ? "Light mode" : "Dark mode";
    $("themeButton").setAttribute("aria-pressed", String(dark));
  }

  function renderHeroShelf() {
    const shelf = $("heroShelf");
    app.BOOKS.slice(0, 3).forEach(function (book) {
      const item = app.button("", function () { app.openBookDetails(book.id, renderAll); }, "hero-book");
      item.setAttribute("aria-label", "View details: " + book.title);
      item.append(app.bookCover(book));
      shelf.append(item);
    });
  }

  function matchesCategory(book, category) {
    if (category === "All") return true;
    if (category === "Data and Technology") return DATA_AND_TECH.includes(book.category);
    return book.category === category;
  }

  function filteredBooks() {
    const query = refs.searchInput.value.trim().toLowerCase();
    const category = refs.categoryFilter.value;
    return app.BOOKS.filter(function (book) {
      const text = (book.title + " " + book.author + " " + book.category).toLowerCase();
      return text.includes(query) && matchesCategory(book, category);
    });
  }

  function bookCard(book) {
    const card = create("article", "book-card");
    const cover = app.bookCover(book);
    cover.addEventListener("click", function () { app.openBookDetails(book.id, renderAll); });

    const title = create("h3", "book-title");
    title.append(app.button(book.title, function () { app.openBookDetails(book.id, renderAll); }, ""));

    const saved = app.isWishlisted(book.id);
    const borrowed = app.isBorrowed(book.id);
    const borrowBlocked = !borrowed && app.borrowLimitReached();
    const borrowLabel = borrowed ? "Borrowed" : "Borrow";
    const borrowButton = app.button(borrowLabel, function () { runAction(app.borrowBook(book.id)); }, "btn btn-soft btn-sm borrow-button");
    borrowButton.disabled = borrowed || borrowBlocked;
    if (borrowBlocked) borrowButton.title = "Monthly borrowing limit reached";

    const wishButton = app.button(saved ? "♥" : "♡", function () {
      const nowSaved = app.toggleWishlist(book.id);
      renderAll();
      notice(nowSaved ? "Added to wishlist." : "Removed from wishlist.");
    }, "btn btn-soft btn-sm wish-button" + (saved ? " is-saved" : ""));
    wishButton.setAttribute("aria-pressed", String(saved));
    wishButton.setAttribute("aria-label", (saved ? "Remove from wishlist: " : "Add to wishlist: ") + book.title);

    const cartButton = app.button("Add to Cart", function () {
      app.addToCart(book.id);
      renderAll();
      notice("“" + book.title + "” added to cart.");
    }, "btn btn-primary btn-sm");

    const buttons = create("div", "book-buttons");
    buttons.append(cartButton, borrowButton, wishButton);
    const info = create("div", "book-info");
    info.append(app.el("span", app.money(book.price), "book-price"));
    card.append(cover, title, app.el("p", book.author + " · " + book.category, "book-author"), info, buttons);
    return card;
  }

  function renderCatalogue() {
    const found = filteredBooks();
    const filtering = refs.searchInput.value.trim() !== "" || refs.categoryFilter.value !== "All";
    const visible = showAllBooks || filtering ? found : found.slice(0, DEFAULT_VISIBLE_BOOKS);
    refs.bookList.replaceChildren.apply(refs.bookList, visible.map(bookCard));
    refs.bookCount.textContent = visible.length + " of " + found.length + " books";
    refs.noBooks.classList.toggle("hidden", visible.length > 0);
  }

  function renderBorrowed() {
    const host = $("borrowedBooks");
    const loans = app.activeLoans();
    if (!loans.length) {
      host.replaceChildren(emptyState("No borrowed books yet. Browse the catalogue to borrow one.", "Browse books", function () { scrollToSection("books"); }));
      return;
    }
    host.replaceChildren.apply(host, loans.map(function (loan) {
      const book = app.getBook(loan.id);
      const due = app.loanDueInfo(loan);
      const content = create("div", "personal-card-content");
      content.append(
        app.el("h3", book.title),
        app.el("p", book.author + " · " + book.category),
        app.el("p", "Borrowed: " + app.formatDate(loan.borrowedAt)),
        app.el("p", "Due: " + app.formatDate(loan.dueAt)),
        app.el("span", due.text, "status-badge" + (due.overdue ? " is-overdue" : ""))
      );
      const actions = create("div", "card-actions");
      actions.append(app.button("Return book", function () { runAction(app.returnBook(loan.id)); }, "btn btn-primary btn-sm"));
      content.append(actions);
      return personalCard(book, content);
    }));
  }

  function personalCard(book, content) {
    const card = create("article", "personal-card");
    card.append(app.bookCover(book, true), content);
    return card;
  }

  function renderCurrentlyReading() {
    const host = $("currentlyReading");
    const reading = app.getReading();
    const ids = Object.keys(reading).filter(function (id) { return reading[id].status !== app.STATUS.COMPLETED; });
    if (!ids.length) {
      host.replaceChildren(emptyState("Nothing in progress yet. Open a book and mark it as Started.", "Browse books", function () { scrollToSection("books"); }));
      return;
    }
    host.replaceChildren.apply(host, ids.map(function (id) {
      const book = app.getBook(id);
      const entry = reading[id];
      const bar = create("div", "progress");
      const fill = create("span");
      fill.style.width = entry.progress + "%";
      bar.append(fill);
      const actions = create("div", "card-actions");
      actions.append(app.button("Mark completed", function () { runAction(app.completeBook(book.id)); }));
      const content = create("div", "personal-card-content");
      content.append(
        app.el("h3", book.title),
        app.el("p", book.author),
        app.el("span", entry.status, "status-badge"),
        app.el("p", entry.progress + "% complete"),
        bar,
        app.progressForm(book, entry, runAction),
        actions
      );
      return personalCard(book, content);
    }));
  }

  function renderCompleted() {
    const host = $("completedBooks");
    const reading = app.getReading();
    const ids = Object.keys(reading)
      .filter(function (id) { return reading[id].status === app.STATUS.COMPLETED; })
      .sort(function (a, b) { return new Date(reading[b].completedAt) - new Date(reading[a].completedAt); })
      .slice(0, 3);
    if (!ids.length) {
      host.replaceChildren(emptyState("Finished books will appear here when you reach 100% or mark a book completed."));
      return;
    }
    host.replaceChildren.apply(host, ids.map(function (id) {
      const book = app.getBook(id);
      const content = create("div", "personal-card-content");
      content.append(
        app.el("h3", book.title),
        app.el("p", book.author),
        app.el("span", "Completed", "status-badge is-complete"),
        app.el("p", "Finished: " + app.formatDate(reading[id].completedAt))
      );
      const actions = create("div", "card-actions");
      actions.append(app.button("Read again", function () { runAction(app.readAgain(book.id)); }));
      content.append(actions);
      return personalCard(book, content);
    }));
  }

  function renderChallenge() {
    const count = app.completedThisMonth();
    const target = app.getGoalTarget();
    const percent = Math.min(100, Math.round((count / target) * 100));
    const remaining = Math.max(0, target - count);

    $("challengeCompleted").textContent = count;
    $("challengeRemaining").textContent = remaining;
    $("challengePercent").textContent = percent + "%";
    $("challengeFill").style.width = percent + "%";
    $("sideGoalCount").textContent = count + " / " + target + " books";
    $("sideGoalFill").style.width = percent + "%";
    $("heroGoalCount").textContent = count + " / " + target + " books";
    $("heroGoalFill").style.width = percent + "%";
    $("goalTargetDisplay").textContent = target;

    let message = "Great progress! " + remaining + " more book" + (remaining === 1 ? "" : "s") + " to reach your goal.";
    if (count >= target) message = "Goal reached. Choose another challenge when you're ready.";
    else if (count === 0) message = "Every great reading streak starts with one page.";
    $("goalMotivation").textContent = message;

    const reading = app.getReading();
    const chips = Object.keys(reading).map(function (id) {
      return app.button(app.getBook(id).title + " · " + reading[id].status, function () { openPage("library.html"); }, "btn btn-outline btn-sm");
    });
    $("challengeBooks").replaceChildren.apply($("challengeBooks"), chips);
  }

  function emptyState(message, label, onClick) {
    const box = create("div", "empty-state");
    box.append(app.el("p", message));
    if (label) box.append(app.button(label, onClick, "btn btn-primary btn-sm"));
    return box;
  }

  function renderAll() {
    refs.cartCount.textContent = app.cartCount();
    renderCatalogue();
    renderBorrowed();
    renderCurrentlyReading();
    renderCompleted();
    renderChallenge();
  }
  function create(tag, className) {
    return app.el(tag, "", className);
  }
  function runAction(result) {
    renderAll();
    notice(result.message);
  }

  function showAllAndRender() {
    showAllBooks = true;
    renderCatalogue();
  }

  function bindCatalogueControls() {
    refs.searchForm.addEventListener("submit", function (event) {
      event.preventDefault();
      showAllAndRender();
      scrollToSection("books");
    });
    refs.searchInput.addEventListener("input", showAllAndRender);
    refs.categoryFilter.addEventListener("change", showAllAndRender);
    $("showAllButton").addEventListener("click", function () {
      refs.categoryFilter.value = "All";
      refs.searchInput.value = "";
      showAllAndRender();
    });
    document.querySelectorAll("[data-category]").forEach(function (card) {
      card.addEventListener("click", function () {
        refs.categoryFilter.value = card.dataset.category;
        showAllAndRender();
        scrollToSection("books");
      });
    });
  }

  function bindNavigation() {
    document.querySelectorAll("[data-open]").forEach(function (trigger) {
      trigger.addEventListener("click", function () { openPage(trigger.dataset.open); });
    });
    document.querySelectorAll(".side-nav a").forEach(function (link) {
      link.addEventListener("click", function () {
        document.querySelectorAll(".side-nav a").forEach(function (other) {
          other.classList.toggle("active", other === link);
          if (other === link) other.setAttribute("aria-current", "true");
          else other.removeAttribute("aria-current");
        });
        closeMenu();
      });
    });
    document.querySelectorAll("[data-scroll]").forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        scrollToSection(trigger.dataset.scroll);
        closeMenu();
      });
    });
    refs.menuButton.addEventListener("click", openMenu);
    $("closeMenuButton").addEventListener("click", closeMenu);
    refs.menuOverlay.addEventListener("click", closeMenu);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });
  }

  function bindPageDialog() {
    $("closePageModal").addEventListener("click", function () { refs.pageModal.close(); });
    refs.pageModal.addEventListener("close", handlePageClosed);
    app.closeOnBackdropClick(refs.pageModal);
    window.addEventListener("message", handleFrameMessage);
  }

  function bindGoalForm() {
    const form = $("goalEditForm");
    const input = $("goalTarget");
    const status = $("goalStatus");
    const editButton = $("editGoalButton");

    function toggleEditing(editing) {
      form.classList.toggle("hidden", !editing);
      editButton.classList.toggle("hidden", editing);
      status.textContent = "";
      input.value = app.getGoalTarget();
      if (editing) input.focus();
      else editButton.focus();
    }

    editButton.addEventListener("click", function () { toggleEditing(true); });
    $("cancelGoalButton").addEventListener("click", function () { toggleEditing(false); });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!app.setGoalTarget(input.value)) {
        status.textContent = "Enter a whole number from 1 to 100.";
        return;
      }
      toggleEditing(false);
      renderChallenge();
      notice("Monthly reading goal saved.");
    });
  }

  function bindThemeAndStorage() {
    $("themeButton").addEventListener("click", function () {
      app.toggleTheme();
      renderThemeButton();
    });
    window.addEventListener("storage", function (event) {
      if (event.key !== null && !WATCHED_KEYS.includes(event.key)) return;
      app.applyTheme();
      renderThemeButton();
      renderAll();
    });
  }
  function init() {
    renderThemeButton();
    renderHeroShelf();
    bindCatalogueControls();
    bindNavigation();
    bindPageDialog();
    bindGoalForm();
    bindThemeAndStorage();
    renderAll();
  }

  init();
}());
