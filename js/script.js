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
    "feedback.html": "Feedback",
    "login.html": "Log in",
    "register.html": "Create account",
    "forgot-password.html": "Forgot password",
    "reset-password.html": "Reset password",
    "verify-email.html": "Verify email",
    "orders.html": "My orders",
    "admin.html": "Admin"
  };
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

  let showAllBooks = new URLSearchParams(window.location.search).get("catalogue") === "all";
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
    if (data.type === "refresh") app.refresh().then(renderAll);
    if (data.type === "close") refs.pageModal.close();
    if (data.type === "auth-changed") app.refresh().then(function () { renderAuth(); renderAll(); });
    if (data.type === "navigate" && typeof data.path === "string") {
      const parts = data.path.split("#");
      if (parts[0] === "index.html" || parts[0] === "/") {
        refs.pageModal.close();
        if (parts[1]) scrollToSection(parts[1]);
      } else {
        openPage(data.path);
      }
    }
  }

  function renderThemeButton() {
    const dark = app.isDark();
    $("themeIcon").textContent = dark ? "☼" : "☾";
    $("themeLabel").textContent = dark ? "Light mode" : "Dark mode";
    $("themeButton").setAttribute("aria-pressed", String(dark));
  }

  function renderAuth() {
    const host = $("authActions");
    if (!host) return;
    host.replaceChildren();
    const user = app.state.user;
    if (!user) {
      host.append(
        app.button("Log in", function () { openPage("login.html"); }, "btn btn-outline btn-sm"),
        app.button("Register", function () { openPage("register.html"); }, "btn btn-primary btn-sm")
      );
      return;
    }
    host.append(app.el("span", user.firstName, "auth-name"));
    host.append(app.button("Profile", function () { openPage("profile.html"); }, "btn btn-outline btn-sm"));
    host.append(app.button("Orders", function () { openPage("orders.html"); }, "btn btn-outline btn-sm"));
    if (user.role === "admin") {
      host.append(app.button("Admin", function () { openPage("admin.html"); }, "btn btn-soft btn-sm"));
    }
    host.append(app.button("Log out", function () {
      app.logout().then(function () {
        renderAuth();
        renderAll();
        notice("You have logged out.");
      });
    }, "btn btn-outline btn-sm"));
  }

  function renderHeroShelf() {
    const shelf = $("heroShelf");
    const hero = document.querySelector(".hero");
    const featuredWithCover = app.BOOKS.find(function (book) { return book.hasCoverImage && book.coverImageUrl; });
    if (hero && featuredWithCover) {
      hero.classList.add("has-featured-cover");
      hero.style.setProperty("--featured-cover", "url('" + featuredWithCover.coverImageUrl.replace(/'/g, "%27") + "')");
    } else if (hero) {
      hero.classList.remove("has-featured-cover");
      hero.style.removeProperty("--featured-cover");
    }
    shelf.replaceChildren();
    app.BOOKS.slice(0, 3).forEach(function (book) {
      const item = app.button("", function () { app.openBookDetails(book.id, renderAll); }, "hero-book");
      item.setAttribute("aria-label", "View details: " + book.title);
      item.append(app.bookCover(book));
      shelf.append(item);
    });
  }

  function fillCategories() {
    const select = refs.categoryFilter;
    const current = select.value || "All";
    const names = ["All", "Data and Technology"].concat(
      app.state.categories.map(function (item) { return item.name || item; })
    );
    const unique = Array.from(new Set(names));
    select.replaceChildren();
    unique.forEach(function (name) {
      const option = app.el("option", name);
      option.value = name;
      select.append(option);
    });
    select.value = unique.indexOf(current) >= 0 ? current : "All";
  }

  function matchesCategory(book, category) {
    if (category === "All") return true;
    if (category === "Data and Technology") return DATA_AND_TECH.includes(book.category);
    return book.category === category;
  }

  function filteredBooks() {
    const query = refs.searchInput.value.trim().toLowerCase();
    const category = refs.categoryFilter.value;
    const sort = ($("sortBooks") && $("sortBooks").value) || "title";
    const found = app.BOOKS.filter(function (book) {
      const text = (book.title + " " + book.author + " " + book.category).toLowerCase();
      return text.includes(query) && matchesCategory(book, category);
    });
    found.sort(function (a, b) {
      if (sort === "price") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "year") return (b.year || 0) - (a.year || 0);
      return a.title.localeCompare(b.title);
    });
    return found;
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
      app.toggleWishlist(book.id).then(function (result) {
        renderAll();
        notice(result.message);
        if (result.auth) openPage("login.html");
      });
    }, "btn btn-soft btn-sm wish-button" + (saved ? " is-saved" : ""));
    wishButton.setAttribute("aria-pressed", String(saved));
    wishButton.setAttribute("aria-label", (saved ? "Remove from wishlist: " : "Add to wishlist: ") + book.title);

    const cartButton = app.button("Add to Cart", function () {
      app.addToCart(book.id).then(function (result) {
        renderAll();
        notice(result.message);
        if (result.auth) openPage("login.html");
      });
    }, "btn btn-primary btn-sm");

    const buttons = create("div", "book-buttons");
    buttons.append(cartButton, borrowButton, wishButton);
    if (book.pdfAvailable) {
      buttons.append(app.button("Read", function () { window.location.href = "/reader.html?id=" + encodeURIComponent(book.id); }, "btn btn-outline btn-sm"));
    }
    const info = create("div", "book-info");
    info.append(app.el("span", app.money(book.price), "book-price"));
    if (book.pdfAvailable) info.append(app.el("span", "PDF ready", "status-badge"));
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
    if (!app.state.user) {
      host.replaceChildren(emptyState("Log in to borrow books and see your loans.", "Log in", function () { openPage("login.html"); }));
      return;
    }
    if (!loans.length) {
      host.replaceChildren(emptyState("No borrowed books yet. Browse the catalogue to borrow one.", "Browse books", function () { scrollToSection("books"); }));
      return;
    }
    host.replaceChildren.apply(host, loans.map(function (loan) {
      const book = loan.book || app.getBook(loan.bookId);
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
      const book = app.getBook(id) || reading[id].book;
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
      const book = app.getBook(id) || reading[id].book;
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
    const percent = Math.min(100, Math.round((count / target) * 100) || 0);
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
      const book = app.getBook(id) || reading[id].book;
      return app.button((book && book.title) + " · " + reading[id].status, function () { openPage("library.html"); }, "btn btn-outline btn-sm");
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
    fillCategories();
    renderCatalogue();
    renderBorrowed();
    renderCurrentlyReading();
    renderCompleted();
    renderChallenge();
  }

  function create(tag, className) {
    return app.el(tag, "", className);
  }

  function runAction(resultPromise) {
    Promise.resolve(resultPromise).then(function (result) {
      renderAll();
      notice(result.message);
      if (result.auth) openPage("login.html");
    });
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
    if ($("sortBooks")) $("sortBooks").addEventListener("change", showAllAndRender);
    $("showAllButton").addEventListener("click", function () {
      window.open("/?catalogue=all#books", "_blank", "noopener");
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
      app.setGoalTarget(input.value).then(function (ok) {
        if (!ok) {
          status.textContent = app.state.user ? "Enter a whole number from 1 to 100." : "Log in to save a monthly goal.";
          if (!app.state.user) openPage("login.html");
          return;
        }
        toggleEditing(false);
        renderChallenge();
        notice("Monthly reading goal saved.");
      });
    });
  }

  function bindThemeAndStorage() {
    $("themeButton").addEventListener("click", function () {
      app.toggleTheme();
      renderThemeButton();
    });
  }

  function init() {
    renderThemeButton();
    bindCatalogueControls();
    bindNavigation();
    bindPageDialog();
    bindGoalForm();
    bindThemeAndStorage();
    app.boot().then(function () {
      renderAuth();
      renderHeroShelf();
      renderAll();
      if (showAllBooks) setTimeout(function () { scrollToSection("books"); }, 0);
    }).catch(function () {
      notice("Could not reach the BookNest server. Start it with npm run dev.");
    });
  }

  init();
}());
