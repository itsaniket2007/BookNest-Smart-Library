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

  function authChanged() {
    app.notifyParent("auth-changed");
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

  function loginPrompt(host, action) {
    host.replaceChildren(emptyMessage("Please log in to " + action + "."));
    host.append(app.button("Log in", function () { app.notifyParent("navigate", { path: "login.html" }); }, "btn btn-primary btn-sm"));
  }

  function renderBorrow() {
    const current = $("borrowedList");
    const catalogue = $("borrowCatalog");
    if (!app.state.user) {
      $("borrowCount").textContent = "0 / " + app.BORROW_LIMIT + " this month";
      loginPrompt(current, "borrow books");
      catalogue.replaceChildren();
      return;
    }
    const loans = app.activeLoans();
    const limitReached = app.borrowLimitReached();
    $("borrowCount").textContent = app.loansThisMonth() + " / " + app.BORROW_LIMIT + " this month";

    current.replaceChildren();
    if (!loans.length) current.append(emptyMessage("You have no books currently borrowed."));
    loans.forEach(function (loan) {
      const book = loan.book || app.getBook(loan.bookId);
      const due = app.loanDueInfo(loan);
      const detail = book.author + " · Borrowed " + app.formatDate(loan.borrowedAt) + " · Due " + app.formatDate(loan.dueAt) + " · " + due.text;
      const returnButton = app.button("Return book", function () { borrowAction(app.returnBook(loan.id)); }, "btn btn-primary btn-sm");
      current.append(bookRow(book, detail, [returnButton]));
    });

    catalogue.replaceChildren();
    app.BOOKS.forEach(function (book) {
      const borrowed = app.isBorrowed(book.id);
      const label = borrowed ? "Already borrowed" : "Borrow book";
      const borrowButton = app.button(label, function () { borrowAction(app.borrowBook(book.id)); }, "btn btn-primary btn-sm");
      borrowButton.disabled = borrowed || limitReached;
      catalogue.append(bookRow(book, book.author + " · " + book.category, [borrowButton]));
    });
  }

  function borrowAction(resultPromise) {
    Promise.resolve(resultPromise).then(function (result) {
      renderBorrow();
      setStatus($("borrowStatus"), result.message, result.ok);
      dataChanged();
    });
  }

  function renderCart() {
    const host = $("cartPage");
    if (!host) return;
    if (!app.state.user) {
      loginPrompt(host, "use the cart");
      $("checkoutButton").disabled = true;
      return;
    }
    const cart = app.getCart();
    host.replaceChildren();
    if (!cart.length) host.append(emptyMessage("Your cart is empty. Add books from Browse Books."));

    cart.forEach(function (item) {
      const book = item.book || app.getBook(item.id);
      const decrease = app.button("−", function () { cartAction(app.changeCartQuantity(book.id, -1)); });
      decrease.setAttribute("aria-label", "Decrease quantity of " + book.title);
      decrease.disabled = item.quantity <= 1;
      const increase = app.button("+", function () { cartAction(app.changeCartQuantity(book.id, 1)); });
      increase.setAttribute("aria-label", "Increase quantity of " + book.title);
      const quantity = app.el("span", String(item.quantity), "quantity");
      const remove = app.button("Remove", function () { cartAction(app.removeFromCart(book.id)); }, "btn btn-danger btn-sm");
      host.append(bookRow(book, book.author + " · " + app.money(book.price) + " each", [decrease, quantity, increase, remove]));
    });

    const totals = app.cartTotals();
    $("cartSubtotal").textContent = app.money(totals.subtotal);
    $("cartGst").textContent = app.money(totals.gst);
    $("cartTotal").textContent = app.money(totals.total);
    const gstPct = app.state.cart.gstPercentage || app.state.rules.gstPercentage;
    $("cartGstLabel").textContent = "GST (" + gstPct + "%)";
    $("checkoutButton").disabled = !cart.length;
  }

  function cartAction(changePromise) {
    Promise.resolve(changePromise).then(function () {
      renderCart();
      dataChanged();
    });
  }

  function renderWishlist() {
    const host = $("wishlistPage");
    if (!host) return;
    if (!app.state.user) {
      loginPrompt(host, "use the wishlist");
      return;
    }
    const wishlist = app.state.wishlist;
    host.replaceChildren();
    if (!wishlist.length) host.append(emptyMessage("Your wishlist is empty. Tap the heart on a book to save it."));
    wishlist.forEach(function (book) {
      const addButton = app.button("Add to cart", function () {
        app.moveWishlistToCart(book.id).then(function (result) {
          renderCurrentPage();
          dataChanged();
          setStatus($("wishlistStatus"), result.message, result.ok);
        });
      }, "btn btn-primary btn-sm");
      const removeButton = app.button("Remove", function () {
        app.removeFromWishlist(book.id).then(function (result) {
          renderCurrentPage();
          dataChanged();
          setStatus($("wishlistStatus"), result.message, result.ok);
        });
      }, "btn btn-danger btn-sm");
      host.append(bookRow(book, book.author + " · " + book.category + " · " + app.money(book.price), [addButton, removeButton]));
    });
  }

  function initCheckout() {
    const dialog = $("checkoutDialog");
    const options = $("paymentOptions");
    const success = $("orderSuccess");

    $("checkoutButton").addEventListener("click", function () {
      if (!app.state.user) {
        app.notifyParent("navigate", { path: "login.html" });
        return;
      }
      const totals = app.cartTotals();
      $("checkoutSubtotal").textContent = app.money(totals.subtotal);
      $("checkoutGst").textContent = app.money(totals.gst);
      $("checkoutTotal").textContent = app.money(totals.total);
      const gstPct = app.state.cart.gstPercentage || app.state.rules.gstPercentage;
      $("checkoutGstLabel").textContent = "GST (" + gstPct + "%)";
      options.classList.remove("hidden");
      success.classList.add("hidden");
      dialog.showModal();
    });
    $("checkoutClose").addEventListener("click", function () { dialog.close(); });
    app.closeOnBackdropClick(dialog);

    function openOrders() {
      if (app.isEmbedded()) app.notifyParent("navigate", { path: "orders.html" });
      else window.location.href = "/orders.html";
    }

    document.querySelectorAll("[data-payment]").forEach(function (choice) {
      choice.addEventListener("click", function () {
        const razorpay = choice.dataset.payment === "Razorpay";
        // Razorpay opens its own hosted checkout. Close our summary first so
        // the customer never sees stacked BookNest/payment popups.
        if (razorpay) dialog.close();
        const action = razorpay ? app.checkoutRazorpay() : app.checkout(choice.dataset.payment);
        Promise.resolve(action).then(function (result) {
          success.textContent = result.ok && result.order
            ? result.message + " Order ID: " + result.order.orderId
            : result.message;
          success.className = "form-status " + (result.ok ? "is-success" : "is-error") + (result.ok ? "" : "");
          if (result.ok) {
            dialog.close();
            renderCart();
            dataChanged();
            openOrders();
          } else {
            if (razorpay && !dialog.open) dialog.showModal();
            success.classList.remove("hidden");
          }
        });
      });
    });
  }

  let libraryFilter = "All";

  function renderLibrary() {
    const host = $("libraryBooks");
    if (!app.state.user) {
      loginPrompt(host, "use your reading list");
      return;
    }
    const reading = app.getReading();
    const ids = Object.keys(reading).filter(function (id) {
      return libraryFilter === "All" || reading[id].status === libraryFilter;
    });
    host.replaceChildren();
    if (!ids.length) {
      host.append(emptyMessage(libraryFilter === "All"
        ? "Your reading list is empty. Add a book above or from the catalogue."
        : "No books with status “" + libraryFilter + "” yet."));
    }
    ids.forEach(function (id) {
      const book = app.getBook(id) || reading[id].book;
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
      if (book.pdfAvailable) {
        actions.push(app.button("Read PDF", function () { window.top.location.href = "/reader.html?id=" + encodeURIComponent(book.id); }));
      }
      const detail = book.author + " · " + book.category + " · " + entry.status + " · " + entry.progress + "% complete";
      host.append(bookRow(book, detail, actions, bar));
    });
    renderReadingOptions(reading);
  }

  function renderReadingOptions(reading) {
    const select = $("readingBookSelect");
    if (!select) return;
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

  function libraryAction(resultPromise) {
    Promise.resolve(resultPromise).then(function (result) {
      renderLibrary();
      setStatus($("libraryStatus"), result.message, result.ok);
      dataChanged();
    });
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
    mobile: function (v) { return v === "" || /^\d{10}$/.test(v) ? "" : "Enter a 10-digit mobile number, or leave it empty."; },
    category: function (v) { return v === "" ? "Choose a favourite category." : ""; }
  };

  function initProfile() {
    const form = $("profileForm");
    const status = $("profileStatus");
    let pendingFile = null;
    let removePhoto = false;
    let editing = false;

    function profileFromUser() {
      const user = app.state.user || {};
      return {
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        mobile: user.mobile || "",
        address: user.address || "",
        category: user.category || "",
        photoUrl: user.photoUrl || ""
      };
    }

    function showPhoto(url) {
      const image = $("profilePreview");
      if (url) image.src = url;
      else image.removeAttribute("src");
      image.classList.toggle("hidden", !url);
      $("profileInitials").classList.toggle("hidden", Boolean(url));
      const profile = profileFromUser();
      $("profileInitials").textContent = ((profile.firstName || "R").charAt(0) + (profile.lastName || "").charAt(0)).toUpperCase();
      $("removePhotoButton").disabled = !url && !pendingFile;
    }

    function render() {
      const profile = profileFromUser();
      const saved = Boolean(app.state.user);
      PROFILE_FIELDS.forEach(function (field) {
        if (form.elements[field[0]]) form.elements[field[0]].value = profile[field[0]] || "";
      });
      if (form.elements.email) form.elements.email.readOnly = true;
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
      showPhoto(removePhoto ? "" : (pendingFile ? URL.createObjectURL(pendingFile) : profile.photoUrl));
    }

    if (!app.state.user) {
      $("pageTitle").textContent = "Reader profile";
      $("profileView").classList.add("hidden");
      form.classList.add("hidden");
      setStatus(status, "Log in to view and edit your BookNest profile.", false);
      return;
    }

    $("editProfileButton").addEventListener("click", function () {
      editing = true;
      status.textContent = "";
      render();
      form.elements.firstName.focus();
    });

    $("cancelProfileButton").addEventListener("click", function () {
      editing = false;
      pendingFile = null;
      removePhoto = false;
      $("photoInput").value = "";
      clearFieldErrors(form);
      render();
    });

    $("changePhotoButton").addEventListener("click", function () { $("photoInput").click(); });

    $("removePhotoButton").addEventListener("click", function () {
      pendingFile = null;
      removePhoto = true;
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
      pendingFile = file;
      removePhoto = false;
      showPhoto(URL.createObjectURL(file));
      setStatus(status, "Preview ready. Save your profile to keep this photo.", true);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const values = validateForm(form, PROFILE_RULES);
      if (!values) {
        setStatus(status, "Please correct the highlighted fields.", false);
        return;
      }
      const updated = Object.assign({}, values, { address: form.elements.address.value.trim() });
      app.saveProfile(updated).then(function (ok) {
        if (!ok) {
          setStatus(status, "Could not save the profile.", false);
          return;
        }
        const afterPhoto = function () {
          editing = false;
          pendingFile = null;
          removePhoto = false;
          render();
          setStatus(status, "Profile saved to your BookNest account.", true);
          dataChanged();
        };
        if (removePhoto) {
          window.BookNestAPI.del("/api/users/me/photo").then(function (data) {
            app.state.user = data.user;
            afterPhoto();
          }).catch(function (error) { setStatus(status, error.message, false); });
        } else if (pendingFile) {
          const formData = new FormData();
          formData.append("photo", pendingFile);
          window.BookNestAPI.upload("/api/users/me/photo", formData).then(function (data) {
            app.state.user = data.user;
            afterPhoto();
          }).catch(function (error) { setStatus(status, error.message, false); });
        } else afterPhoto();
      });
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
      if (!app.state.user) {
        setStatus(status, "Please log in before sending feedback.", false);
        app.notifyParent("navigate", { path: "login.html" });
        return;
      }
      const values = validateForm(form, FEEDBACK_RULES);
      if (!values) {
        setStatus(status, "Please correct the highlighted fields.", false);
        return;
      }
      app.saveFeedback(values).then(function () {
        form.reset();
        clearFieldErrors(form);
        setStatus(status, "Thanks. Your feedback has been saved for the BookNest team.", true);
        renderMyFeedback();
      }).catch(function (error) {
        setStatus(status, error.message || "Could not save your feedback.", false);
      });
    });
    renderMyFeedback();
  }

  function renderMyFeedback() {
    const host = $("myFeedback");
    if (!host || !app.state.user) return;
    window.BookNestAPI.get("/api/feedback/mine").then(function (data) {
      host.replaceChildren();
      if (!data.feedback.length) {
        host.append(emptyMessage("You have not submitted feedback yet."));
        return;
      }
      data.feedback.forEach(function (item) {
        const row = create("article", "book-row");
        row.append(app.el("div", "", "book-row-body"));
        row.firstChild.append(
          app.el("h3", item.type),
          app.el("p", app.formatDate(item.createdAt) + " · " + item.email, "muted"),
          app.el("p", item.message)
        );
        host.append(row);
      });
    }).catch(function () {});
  }

  function initLogin() {
    const form = $("loginForm");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      app.login(email, password).then(function () {
        setStatus($("loginStatus"), "Logged in. You can return to BookNest.", true);
        authChanged();
        app.notifyParent("navigate", { path: "profile.html" });
        if (!app.isEmbedded()) window.location.href = "/";
      }).catch(function (error) {
        setStatus($("loginStatus"), error.message, false);
      });
    });
  }

  function initForgotPassword() {
    const form = $("forgotPasswordForm");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      window.BookNestAPI.post("/api/auth/forgot-password", { email: form.elements.email.value.trim() })
        .then(function (data) { setStatus($("forgotPasswordStatus"), data.message, true); })
        .catch(function (error) { setStatus($("forgotPasswordStatus"), error.message, false); });
    });
  }

  function initResetPassword() {
    const form = $("resetPasswordForm");
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setStatus($("resetPasswordStatus"), "This reset link is missing its token.", false); form.querySelector("button").disabled = true; return; }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const password = form.elements.newPassword.value;
      if (password !== form.elements.confirmPassword.value) return setStatus($("resetPasswordStatus"), "Passwords do not match.", false);
      window.BookNestAPI.post("/api/auth/reset-password", { token: token, newPassword: password })
        .then(function (data) { setStatus($("resetPasswordStatus"), data.message + " You can now log in.", true); form.reset(); })
        .catch(function (error) { setStatus($("resetPasswordStatus"), error.message, false); });
    });
  }

  function initVerifyEmail() {
    const status = $("verifyEmailStatus");
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return setStatus(status, "This verification link is missing its token.", false);
    window.BookNestAPI.post("/api/auth/verify-email", { token: token })
      .then(function (data) { setStatus(status, data.message + " You may now use all account features.", true); })
      .catch(function (error) { setStatus(status, error.message, false); });
  }

  function initChangePassword() {
    const form = $("changePasswordForm");
    const panel = $("passwordPanel");
    if (!form) return;
    if (!app.state.user) { panel.classList.add("hidden"); return; }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const newPassword = form.elements.newPassword.value;
      if (newPassword !== form.elements.confirmNewPassword.value) return setStatus($("changePasswordStatus"), "Passwords do not match.", false);
      window.BookNestAPI.post("/api/auth/change-password", { currentPassword: form.elements.currentPassword.value, newPassword: newPassword })
        .then(function (data) { form.reset(); setStatus($("changePasswordStatus"), data.message, true); })
        .catch(function (error) { setStatus($("changePasswordStatus"), error.message, false); });
    });
  }

  function initRegister() {
    const form = $("registerForm");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const payload = {
        firstName: form.elements.firstName.value.trim(),
        lastName: form.elements.lastName.value.trim(),
        email: form.elements.email.value.trim(),
        mobile: form.elements.mobile.value.trim(),
        password: form.elements.password.value,
        confirmPassword: form.elements.confirmPassword.value
      };
      app.register(payload).then(function () {
        setStatus($("registerStatus"), "Account created. You are logged in.", true);
        authChanged();
        if (!app.isEmbedded()) window.location.href = "/";
        else app.notifyParent("navigate", { path: "profile.html" });
      }).catch(function (error) {
        setStatus($("registerStatus"), error.message, false);
      });
    });
  }

  function renderOrders() {
    const host = $("ordersList");
    if (!host) return;
    if (!app.state.user) {
      loginPrompt(host, "view orders");
      return;
    }
    const orders = app.state.orders || [];
    host.replaceChildren();
    if (!orders.length) host.append(emptyMessage("No orders yet. Checkout from the cart to create a demo order."));
    orders.forEach(function (order) {
      const row = create("article", "book-row");
      const body = create("div", "book-row-body");
      body.append(
        app.el("h3", order.orderId),
        app.el("p", app.formatDate(order.createdAt) + " · " + order.paymentMethod + " · " + order.status, "muted"),
        app.el("p", "Total " + app.money(order.total) + " (includes GST)"),
        app.el("p", order.paymentNote, "muted")
      );
      order.items.forEach(function (item) {
        body.append(app.el("p", item.title + " × " + item.quantity));
      });
      row.append(body);
      host.append(row);
    });
  }

  function initAdmin() {
    if (!app.state.user || app.state.user.role !== "admin") {
      setStatus($("adminStatus"), "Admin access required.", false);
      return;
    }
    const form = $("adminBookForm");
    const list = $("adminBookList");

    function renderStats(stats) {
      const host = $("adminStats");
      if (!host) return;
      const entries = [
        ["Customers", stats.customers], ["Catalogue books", stats.books], ["Orders", stats.orders],
        ["Feedback", stats.feedback], ["Authorized PDFs", stats.authorizedPdfs], ["PDFs awaiting authorization", stats.pendingPdfs]
      ];
      host.replaceChildren();
      entries.forEach(function (entry) {
        const card = create("div", "admin-stat");
        card.append(app.el("strong", String(entry[1])), app.el("span", entry[0]));
        host.append(card);
      });
    }

    function renderBooks() {
      list.replaceChildren();
      app.BOOKS.forEach(function (book) {
        const row = bookRow(book, book.author + " · " + app.money(book.price) + " · PDF " + (book.pdfAvailable ? "authorized" : "pending"), [
          app.button("Edit details", function () {
            const title = window.prompt("Title", book.title);
            if (title === null) return;
            const author = window.prompt("Author", book.author);
            const category = window.prompt("Category", book.category);
            const year = window.prompt("Publication year (blank to clear)", book.year || "");
            const description = window.prompt("Description", book.description);
            window.BookNestAPI.put("/api/admin/books/" + book.id, {
              title: title, author: author, category: category, year: year, description: description
            }).then(function () { return app.refresh(); }).then(function () {
              renderBooks(); setStatus($("adminStatus"), "Book details updated.", true);
            }).catch(function (error) { setStatus($("adminStatus"), error.message, false); });
          }),
          app.button("Save price", function () {
            const input = row.querySelector("input[data-price]");
            window.BookNestAPI.put("/api/admin/books/" + book.id, { price: Number(input.value) }).then(function () {
              return app.refresh();
            }).then(function () {
              renderBooks();
              setStatus($("adminStatus"), "Updated " + book.title, true);
            });
          }),
          app.button("Delete", function () {
            if (!window.confirm("Delete " + book.title + "?")) return;
            window.BookNestAPI.del("/api/admin/books/" + book.id).then(function () { return app.refresh(); }).then(renderBooks);
          }, "btn btn-danger btn-sm")
        ]);
        const price = document.createElement("input");
        price.type = "number";
        price.value = book.price;
        price.dataset.price = "1";
        const pdf = document.createElement("input");
        pdf.type = "file";
        pdf.accept = "application/pdf";
        pdf.addEventListener("change", function () {
          if (!pdf.files[0]) return;
          const data = new FormData();
          data.append("pdf", pdf.files[0]);
          data.append("authorizedForDistribution", $("authorizePdf").checked ? "true" : "false");
          window.BookNestAPI.upload("/api/admin/books/" + book.id + "/pdf", data).then(function (res) {
            setStatus($("adminStatus"), res.message, true);
            return app.refresh();
          }).then(renderBooks).catch(function (error) { setStatus($("adminStatus"), error.message, false); });
        });
        const cover = document.createElement("input");
        cover.type = "file";
        cover.accept = "image/png,image/jpeg,image/webp,image/gif";
        cover.addEventListener("change", function () {
          if (!cover.files[0]) return;
          const data = new FormData(); data.append("cover", cover.files[0]);
          window.BookNestAPI.upload("/api/admin/books/" + book.id + "/cover", data).then(function () { return app.refresh(); })
            .then(function () { renderBooks(); setStatus($("adminStatus"), "Cover uploaded.", true); })
            .catch(function (error) { setStatus($("adminStatus"), error.message, false); });
        });
        const authorization = app.button(book.pdfAuthorized ? "Revoke PDF" : "Authorize PDF", function () {
          window.BookNestAPI.patch("/api/admin/books/" + book.id + "/pdf/authorize", {
            authorizedForDistribution: book.pdfAuthorized ? "false" : "true"
          }).then(function () { return app.refresh(); }).then(function () {
            renderBooks(); setStatus($("adminStatus"), "PDF authorization updated.", true);
          }).catch(function (error) { setStatus($("adminStatus"), error.message, false); });
        }, "btn btn-outline btn-sm");
        const files = create("p", "file-status");
        const coverLabel = book.hasCoverImage ? "Cover: " + (book.coverImageName || "uploaded image") : "Cover: using BookNest colour placeholder";
        const pdfLabel = book.hasPdfFile ? "PDF: " + (book.pdfOriginalName || "uploaded PDF") : "PDF: none uploaded";
        files.textContent = coverLabel + " · " + pdfLabel;
        cover.setAttribute("aria-label", "Replace cover image for " + book.title);
        pdf.setAttribute("aria-label", "Replace PDF for " + book.title);
        row.querySelector(".book-row-body").append(price, cover, pdf, authorization, files);
        list.append(row);
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      window.BookNestAPI.post("/api/admin/books", {
        title: form.elements.title.value,
        author: form.elements.author.value,
        category: form.elements.category.value,
        price: Number(form.elements.price.value),
        year: form.elements.year.value,
        description: form.elements.description.value
      }).then(function () {
        form.reset();
        return app.refresh();
      }).then(function () {
        renderBooks();
        setStatus($("adminStatus"), "Book added.", true);
      }).catch(function (error) { setStatus($("adminStatus"), error.message, false); });
    });

    window.BookNestAPI.get("/api/admin/dashboard").then(function (data) {
      renderStats(data.stats || {});
    }).catch(function (error) { setStatus($("adminStatus"), error.message, false); });
    window.BookNestAPI.get("/api/admin/feedback").then(function (data) {
      const host = $("adminFeedback");
      host.replaceChildren();
      data.feedback.forEach(function (item) {
        host.append(app.el("p", item.type + " · " + item.email + " · " + item.message));
      });
    });
    window.BookNestAPI.get("/api/admin/users").then(function (data) {
      const host = $("adminUsers");
      if (!host) return;
      host.replaceChildren();
      data.users.forEach(function (user) {
        host.append(app.el("p", user.firstName + " " + user.lastName + " · " + user.email + " · " + user.role));
      });
    });
    renderBooks();
  }

  const pageName = document.body.dataset.page;
  const PAGE_RENDERERS = {
    borrow: renderBorrow,
    cart: function () { renderCart(); renderWishlist(); },
    wishlist: renderWishlist,
    library: renderLibrary,
    orders: renderOrders
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

    app.boot().then(function () {
      if (pageName === "cart") initCheckout();
      if (pageName === "library") initLibrary();
      if (pageName === "profile") initProfile();
      if (pageName === "feedback") initFeedback();
      if (pageName === "login") initLogin();
      if (pageName === "forgot-password") initForgotPassword();
      if (pageName === "reset-password") initResetPassword();
      if (pageName === "verify-email") initVerifyEmail();
      if (pageName === "register") initRegister();
      if (pageName === "admin") initAdmin();
      if (pageName === "profile") initChangePassword();
      renderCurrentPage();
    });
  }

  init();
}());
