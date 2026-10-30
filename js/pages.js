(function () {
  "use strict";

  const app = window.BookNest;
  const $ = function (id) { return document.getElementById(id); };

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

  function setStatus(node, message, ok) {
    if (!node) return;
    node.textContent = message;
    node.className = "form-status " + (ok ? "is-success" : "is-error");
  }

  function dataChanged() {
    app.notifyParent("refresh");
  }

  function create(tag, className) {
    return app.el(tag, "", className);
  }

  function bookRow(book, detail, actions, extra) {
    const row = create("article", "book-row");
    const body = create("div", "book-row-body");
    const heading = create("h3");
    heading.append(app.button(book.title, function () { app.openBookDetails(book.id, onDetailsChanged); }, ""));
    body.append(heading, app.el("p", detail, "muted"));
    if (extra) body.append(extra);
    const buttons = create("div", "row-actions");
    buttons.append.apply(buttons, actions);
    body.append(buttons);
    row.append(app.bookCover(book, true), body);
    return row;
  }

  function emptyMessage(text) {
    return app.el("p", text, "empty-state");
  }

  function onDetailsChanged() {
    renderCurrentPage();
    dataChanged();
  }

  function validateForm(form, rules) {
    const values = {};
    let firstInvalid = null;
    Object.keys(rules).forEach(function (name) {
      const field = form.elements[name];
      const raw = field.value;
      const value = typeof raw === "string" ? raw.trim() : raw;
      const error = rules[name](value);
      const errorNode = $(name + "Error");
      field.classList.toggle("is-invalid", Boolean(error));
      field.setAttribute("aria-invalid", String(Boolean(error)));
      if (errorNode) errorNode.textContent = error;
      if (error && !firstInvalid) firstInvalid = field;
      values[name] = value;
    });
    if (firstInvalid) firstInvalid.focus();
    return firstInvalid ? null : values;
  }

  function clearFieldErrors(form) {
    form.querySelectorAll(".field-error").forEach(function (node) { node.textContent = ""; });
    form.querySelectorAll("[aria-invalid]").forEach(function (field) {
      field.classList.remove("is-invalid");
      field.removeAttribute("aria-invalid");
    });
  }

  /* Borrow page --------------------------------------------------------- */
  function renderBorrow() {
    const loans = app.activeLoans();
    const limitReached = app.borrowLimitReached();
    $("borrowCount").textContent = app.loansThisMonth() + " / " + app.BORROW_LIMIT + " this month";

    const current = $("borrowedList");
    current.replaceChildren();
    if (!loans.length) current.append(emptyMessage("You have no books currently borrowed."));
    loans.forEach(function (loan) {
      const book = app.getBook(loan.id);
      const due = app.loanDueInfo(loan);
      const detail = book.author + " · Borrowed " + app.formatDate(loan.borrowedAt) + " · Due " + app.formatDate(loan.dueAt) + " · " + due.text;
      const returnButton = app.button("Return book", function () { borrowAction(app.returnBook(loan.id)); }, "btn btn-primary btn-sm");
      current.append(bookRow(book, detail, [returnButton]));
    });

    const catalogue = $("borrowCatalog");
    catalogue.replaceChildren();
    app.BOOKS.forEach(function (book) {
      const borrowed = app.isBorrowed(book.id);
      const label = borrowed ? "Already borrowed" : "Borrow book";
      const borrowButton = app.button(label, function () { borrowAction(app.borrowBook(book.id)); }, "btn btn-primary btn-sm");
      borrowButton.disabled = borrowed || limitReached;
      catalogue.append(bookRow(book, book.author + " · " + book.category, [borrowButton]));
    });
  }

  function borrowAction(result) {
    renderBorrow();
    setStatus($("borrowStatus"), result.message, result.ok);
    dataChanged();
  }

  /*Cart, checkout and wishlist ---------------------------------------- */
  function renderCart() {
    const cart = app.getCart();
    const host = $("cartPage");
    host.replaceChildren();
    if (!cart.length) host.append(emptyMessage("Your cart is empty. Add books from Browse Books."));

    cart.forEach(function (item) {
      const book = app.getBook(item.id);
      const decrease = app.button("−", function () { cartAction(function () { app.changeCartQuantity(book.id, -1); }); });
      decrease.setAttribute("aria-label", "Decrease quantity of " + book.title);
      decrease.disabled = item.quantity <= 1;
      const increase = app.button("+", function () { cartAction(function () { app.changeCartQuantity(book.id, 1); }); });
      increase.setAttribute("aria-label", "Increase quantity of " + book.title);
      const quantity = app.el("span", String(item.quantity), "quantity");
      quantity.setAttribute("aria-label", "Quantity " + item.quantity);
      const remove = app.button("Remove", function () { cartAction(function () { app.removeFromCart(book.id); }); }, "btn btn-danger btn-sm");
      host.append(bookRow(book, book.author + " · " + app.money(book.price) + " each", [decrease, quantity, increase, remove]));
    });

    const totals = app.cartTotals();
    $("cartSubtotal").textContent = app.money(totals.subtotal);
    $("cartGst").textContent = app.money(totals.gst);
    $("cartTotal").textContent = app.money(totals.total);
    $("checkoutButton").disabled = !cart.length;
  }

  function cartAction(change) {
    change();
    renderCart();
    dataChanged();
  }

  function renderWishlist() {
    const host = $("wishlistPage");
    const wishlist = app.getWishlist();
    host.replaceChildren();
    if (!wishlist.length) host.append(emptyMessage("Your wishlist is empty. Tap the heart on a book to save it."));
    wishlist.forEach(function (id) {
      const book = app.getBook(id);
      const addButton = app.button("Add to cart", function () {
        app.addToCart(book.id);
        renderCurrentPage();
        dataChanged();
        setStatus($("wishlistStatus"), "“" + book.title + "” added to cart. It also stays in your wishlist.", true);
      }, "btn btn-primary btn-sm");
      const removeButton = app.button("Remove", function () {
        app.removeFromWishlist(book.id);
        renderCurrentPage();
        dataChanged();
        setStatus($("wishlistStatus"), "“" + book.title + "” removed from your wishlist.", true);
      }, "btn btn-danger btn-sm");
      host.append(bookRow(book, book.author + " · " + book.category + " · " + app.money(book.price), [addButton, removeButton]));
    });
  }

  function initCheckout() {
    const dialog = $("checkoutDialog");
    const options = $("paymentOptions");
    const success = $("orderSuccess");

    $("checkoutButton").addEventListener("click", function () {
      const totals = app.cartTotals();
      $("checkoutSubtotal").textContent = app.money(totals.subtotal);
      $("checkoutGst").textContent = app.money(totals.gst);
      $("checkoutTotal").textContent = app.money(totals.total);
      options.classList.remove("hidden");
      success.classList.add("hidden");
      dialog.showModal();
    });
    $("checkoutClose").addEventListener("click", function () { dialog.close(); });
    app.closeOnBackdropClick(dialog);

    document.querySelectorAll("[data-payment]").forEach(function (choice) {
      choice.addEventListener("click", function () {
        if (!app.getCart().length) return;
        success.textContent = "Order placed using " + choice.dataset.payment + ". This is a demo order; no real payment was processed.";
        options.classList.add("hidden");
        success.classList.remove("hidden");
        app.clearCart();
        renderCart();
        dataChanged();
      });
    });
  }

  /*Library page -------------------------------------------------------- */
  let libraryFilter = "All";

  function renderLibrary() {
    const reading = app.getReading();
    const ids = Object.keys(reading).filter(function (id) {
      return libraryFilter === "All" || reading[id].status === libraryFilter;
    });
    const host = $("libraryBooks");
    host.replaceChildren();
    if (!ids.length) {
      host.append(emptyMessage(libraryFilter === "All"
        ? "Your reading list is empty. Add a book above or from the catalogue."
        : "No books with status “" + libraryFilter + "” yet."));
    }
    ids.forEach(function (id) {
      const book = app.getBook(id);
      const entry = reading[id];
      const bar = create("div", "progress");
      const fill = create("span");
      fill.style.width = entry.progress + "%";
      bar.append(fill);
      const actions = [];
      if (entry.status === app.STATUS.COMPLETED) {
        actions.push(app.button("Read again", function () { libraryAction(app.readAgain(book.id)); }));
      } else {
        actions.push(app.progressForm(book, entry, libraryAction));
        actions.push(app.button("Mark completed", function () { libraryAction(app.completeBook(book.id)); }));
      }
      const detail = book.author + " · " + book.category + " · " + entry.status + " · " + entry.progress + "% complete";
      host.append(bookRow(book, detail, actions, bar));
    });
    renderReadingOptions(reading);
  }

  function renderReadingOptions(reading) {
    const select = $("readingBookSelect");
    const available = app.BOOKS.filter(function (book) { return !reading[book.id]; });
    select.replaceChildren();
    available.forEach(function (book) {
      const option = app.el("option", book.title + " — " + book.author);
      option.value = book.id;
      select.append(option);
    });
    select.disabled = !available.length;
    $("addReadingBook").disabled = !available.length;
  }

  function libraryAction(result) {
    renderLibrary();
    setStatus($("libraryStatus"), result.message, result.ok);
    dataChanged();
  }

  function initLibrary() {
    $("addReadingBook").addEventListener("click", function () {
      libraryAction(app.addToReading($("readingBookSelect").value));
    });
    document.querySelectorAll("[data-filter]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        libraryFilter = tab.dataset.filter;
        document.querySelectorAll("[data-filter]").forEach(function (other) {
          other.setAttribute("aria-pressed", String(other === tab));
        });
        renderLibrary();
      });
    });
  }

  /*Profile page -------------------------------------------------------- */
  const PROFILE_FIELDS = [
    ["firstName", "First name"],
    ["lastName", "Last name"],
    ["email", "Email address"],
    ["mobile", "Mobile number"],
    ["address", "Address"],
    ["category", "Favourite book category"]
  ];

  const PROFILE_RULES = {
    firstName: function (v) { return v.length < 2 ? "Enter your first name (at least 2 characters)." : ""; },
    lastName: function (v) { return v.length < 1 ? "Enter your last name." : ""; },
    email: function (v) { return EMAIL_PATTERN.test(v) ? "" : "Enter a valid email address, such as name@example.com."; },
    mobile: function (v) { return v === "" || /^\d{10}$/.test(v) ? "" : "Enter a 10-digit mobile number, or leave it empty."; },
    category: function (v) { return v === "" ? "Choose a favourite category." : ""; }
  };

  function initProfile() {
    const form = $("profileForm");
    const status = $("profileStatus");
    let profile = app.getProfile();
    let pendingPhoto = profile.photo || "";
    let editing = !hasSavedProfile(profile);

    function hasSavedProfile(p) {
      return Boolean(p.firstName && p.lastName && p.email);
    }

    function showPhoto(photo) {
      const image = $("profilePreview");
      if (photo) image.src = photo;
      else image.removeAttribute("src");
      image.classList.toggle("hidden", !photo);
      $("profileInitials").classList.toggle("hidden", Boolean(photo));
      $("profileInitials").textContent = ((profile.firstName || "R").charAt(0) + (profile.lastName || "").charAt(0)).toUpperCase();
      $("removePhotoButton").disabled = !photo;
    }

    function render() {
      const saved = hasSavedProfile(profile);
      PROFILE_FIELDS.forEach(function (field) { form.elements[field[0]].value = profile[field[0]] || ""; });
      form.classList.toggle("hidden", !editing);
      $("profilePhotoActions").classList.toggle("hidden", !editing);
      $("profileView").classList.toggle("hidden", editing || !saved);
      $("cancelProfileButton").classList.toggle("hidden", !saved);

      const details = $("profileDetails");
      details.replaceChildren();
      PROFILE_FIELDS.forEach(function (field) {
        const row = create("div", "summary-line");
        row.append(app.el("strong", field[1]), app.el("span", profile[field[0]] || "Not provided"));
        details.append(row);
      });
      showPhoto(editing ? pendingPhoto : profile.photo);
    }

    function stopEditing() {
      editing = false;
      pendingPhoto = profile.photo || "";
      $("photoInput").value = "";
      clearFieldErrors(form);
      render();
    }

    $("editProfileButton").addEventListener("click", function () {
      editing = true;
      status.textContent = "";
      render();
      form.elements.firstName.focus();
    });

    $("cancelProfileButton").addEventListener("click", function () {
      status.textContent = "";
      stopEditing();
      $("editProfileButton").focus();
    });

    $("changePhotoButton").addEventListener("click", function () { $("photoInput").click(); });

    $("removePhotoButton").addEventListener("click", function () {
      pendingPhoto = "";
      $("photoInput").value = "";
      showPhoto("");
      setStatus(status, "Photo will be removed when you save.", true);
    });

    $("photoInput").addEventListener("change", function (event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setStatus(status, "Choose an image file (JPG, PNG, WebP, etc.).", false);
        event.target.value = "";
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setStatus(status, "Image is too large. Choose a file under 2 MB.", false);
        event.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        pendingPhoto = String(reader.result);
        showPhoto(pendingPhoto);
        setStatus(status, "Preview ready. Save your profile to keep this photo.", true);
      };
      reader.onerror = function () { setStatus(status, "Could not read this image. Please try another.", false); };
      reader.readAsDataURL(file);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const values = validateForm(form, PROFILE_RULES);
      if (!values) {
        setStatus(status, "Please correct the highlighted fields.", false);
        return;
      }
      const updated = Object.assign({}, values, { address: form.elements.address.value.trim(), photo: pendingPhoto });
      if (!app.saveProfile(updated)) {
        setStatus(status, "Could not save the profile. Browser storage may be full; try a smaller photo.", false);
        return;
      }
      profile = updated;
      stopEditing();
      setStatus(status, "Profile saved in this browser.", true);
      dataChanged();
      $("editProfileButton").focus();
    });

    render();
  }
  const FEEDBACK_RULES = {
    name: function (v) { return v.length < 2 ? "Enter your name (at least 2 characters)." : ""; },
    email: function (v) { return EMAIL_PATTERN.test(v) ? "" : "Enter a valid email address, such as name@example.com."; },
    type: function (v) { return v === "" ? "Choose a feedback type." : ""; },
    message: function (v) { return v.length < 10 ? "Write at least 10 characters so the message is useful." : ""; }
  };

  function initFeedback() {
    const form = $("feedbackForm");
    const status = $("feedbackStatus");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const values = validateForm(form, FEEDBACK_RULES);
      if (!values) {
        setStatus(status, "Please correct the highlighted fields.", false);
        return;
      }
      if (!app.saveFeedback(values)) {
        setStatus(status, "Could not save your feedback. Browser storage may be full or blocked.", false);
        return;
      }
      form.reset();
      clearFieldErrors(form);
      setStatus(status, "Saved in this browser only. Your feedback has not been sent to the BookNest team. To reach them, email booknest@bmu.edu.in.", true);
    });
  }
  const pageName = document.body.dataset.page;

  const PAGE_RENDERERS = {
    borrow: renderBorrow,
    cart: function () { renderCart(); renderWishlist(); },
    wishlist: renderWishlist,
    library: renderLibrary
  };

  function renderCurrentPage() {
    if (PAGE_RENDERERS[pageName]) PAGE_RENDERERS[pageName]();
  }

  function renderThemeButton() {
    const button = $("themeButton");
    if (!button) return;
    button.textContent = app.isDark() ? "☼ Light mode" : "☾ Dark mode";
    button.setAttribute("aria-pressed", String(app.isDark()));
  }

  function closeParentOnEscape(event) {
    if (event.key === "Escape" && !document.querySelector("dialog[open]")) app.notifyParent("close");
  }

  /* Inside the homepage dialog, links to other pages open in the dialog. */
  function routeLinksThroughParent(event) {
    const link = event.target.closest("a[href]");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!/^[\w-]+\.html(#[\w-]+)?$/.test(href)) return;
    event.preventDefault();
    app.notifyParent("navigate", { path: href });
  }

  function init() {
    if (app.isEmbedded()) {
      document.body.classList.add("embed-mode");
      document.addEventListener("click", routeLinksThroughParent);
      document.addEventListener("keydown", closeParentOnEscape);
    }

    const themeButton = $("themeButton");
    if (themeButton) {
      themeButton.addEventListener("click", function () {
        app.toggleTheme();
        renderThemeButton();
      });
    }
    renderThemeButton();

    if (pageName === "cart") initCheckout();
    if (pageName === "library") initLibrary();
    if (pageName === "profile") initProfile();
    if (pageName === "feedback") initFeedback();
    renderCurrentPage();

    window.addEventListener("storage", function () {
      app.applyTheme();
      renderThemeButton();
      renderCurrentPage();
    });
  }

  init();
}());
