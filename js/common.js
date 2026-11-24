(function () {
  "use strict";

  const KEYS = { theme: "booknestDarkMode" };
  const STATUS = { STARTED: "Started", IN_PROGRESS: "In Progress", COMPLETED: "Completed" };
  const api = function () { return window.BookNestAPI; };

  const state = {
    books: [],
    user: null,
    rules: {
      maxBorrowingPerMonth: 2,
      borrowingDurationDays: 30,
      gstPercentage: 5,
      monthlyReadingTarget: 5,
      maxMonthlyReadingTarget: 100,
      maxProfileImageBytes: 2 * 1024 * 1024,
      maxCartQuantity: 99
    },
    site: {},
    categories: [],
    cart: { items: [], itemCount: 0, subtotal: 0, gst: 0, total: 0, gstPercentage: 5 },
    wishlist: [],
    borrowings: [],
    usedThisMonth: 0,
    limitReached: false,
    reading: [],
    history: [],
    challenge: { completed: 0, remaining: 5, target: 5, percent: 0 },
    orders: [],
    ready: false
  };

  function money(amount) {
    return "₹" + Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDate(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function getBook(id) {
    return state.books.find(function (book) { return book.id === String(id); });
  }

  function resultOk(message, extra) {
    return Object.assign({ ok: true, message: message }, extra || {});
  }

  function resultFail(error) {
    return { ok: false, message: error && error.message ? error.message : "Something went wrong." };
  }

  function needsAuth(error) {
    return error && (error.status === 401);
  }

  async function loadPublic() {
    const [booksRes, contentRes] = await Promise.all([
      api().get("/api/books"),
      api().get("/api/books/content")
    ]);
    state.books = booksRes.books || [];
    state.rules = Object.assign(state.rules, contentRes.rules || {});
    state.site = contentRes.site || {};
    state.categories = contentRes.categories || [];
  }

  async function loadSession() {
    try {
      const me = await api().get("/api/auth/me");
      state.user = me.user;
    } catch (error) {
      state.user = null;
    }
  }

  async function loadPrivate() {
    if (!state.user) {
      state.cart = { items: [], itemCount: 0, subtotal: 0, gst: 0, total: 0, gstPercentage: state.rules.gstPercentage };
      state.wishlist = [];
      state.borrowings = [];
      state.usedThisMonth = 0;
      state.limitReached = false;
      state.reading = [];
      state.history = [];
      state.challenge = { completed: 0, remaining: state.rules.monthlyReadingTarget, target: state.user && state.user.monthlyReadingTarget || state.rules.monthlyReadingTarget, percent: 0 };
      state.orders = [];
      return;
    }
    const [cartRes, wishRes, borrowRes, readingRes, orderRes] = await Promise.all([
      api().get("/api/cart"),
      api().get("/api/wishlist"),
      api().get("/api/borrowings"),
      api().get("/api/reading"),
      api().get("/api/orders")
    ]);
    state.cart = cartRes.cart;
    state.wishlist = wishRes.wishlist || [];
    state.borrowings = borrowRes.borrowings || [];
    state.usedThisMonth = borrowRes.usedThisMonth || 0;
    state.limitReached = Boolean(borrowRes.limitReached);
    state.reading = readingRes.reading || [];
    state.history = readingRes.history || [];
    state.challenge = readingRes.challenge || state.challenge;
    state.orders = orderRes.orders || [];
  }

  async function boot() {
    await loadPublic();
    await loadSession();
    await loadPrivate();
    state.ready = true;
    return state;
  }

  async function refresh() {
    await loadSession();
    await loadPublic();
    await loadPrivate();
    return state;
  }

  function requireUser() {
    if (state.user) return true;
    return false;
  }

  async function addToCart(id) {
    if (!requireUser()) return { ok: false, message: "Please log in to add books to your cart.", auth: true };
    try {
      const data = await api().post("/api/cart/items", { bookId: id, quantity: 1 });
      state.cart = data.cart;
      return resultOk("Added to cart.");
    } catch (error) { return resultFail(error); }
  }

  async function changeCartQuantity(id, delta) {
    const item = (state.cart.items || []).find(function (entry) { return entry.bookId === String(id); });
    if (!item) return { ok: false, message: "That book is not in your cart." };
    try {
      const data = await api().patch("/api/cart/items/" + id, { quantity: item.quantity + delta });
      state.cart = data.cart;
      return resultOk("Cart updated.");
    } catch (error) { return resultFail(error); }
  }

  async function removeFromCart(id) {
    try {
      const data = await api().del("/api/cart/items/" + id);
      state.cart = data.cart;
      return resultOk("Removed from cart.");
    } catch (error) { return resultFail(error); }
  }

  function cartCount() {
    return state.cart.itemCount || 0;
  }

  function cartTotals() {
    return { subtotal: state.cart.subtotal || 0, gst: state.cart.gst || 0, total: state.cart.total || 0 };
  }

  function getCart() {
    return (state.cart.items || []).map(function (item) {
      return { id: item.bookId, quantity: item.quantity, book: item.book };
    });
  }

  function isWishlisted(id) {
    return state.wishlist.some(function (book) { return book.id === String(id); });
  }

  async function toggleWishlist(id) {
    if (!requireUser()) return { ok: false, saved: false, message: "Please log in to use the wishlist.", auth: true };
    try {
      if (isWishlisted(id)) {
        const data = await api().del("/api/wishlist/" + id);
        state.wishlist = data.wishlist;
        return { ok: true, saved: false, message: "Removed from wishlist." };
      }
      const data = await api().post("/api/wishlist/" + id);
      state.wishlist = data.wishlist;
      return { ok: true, saved: true, message: "Added to wishlist." };
    } catch (error) { return Object.assign(resultFail(error), { saved: isWishlisted(id) }); }
  }

  async function removeFromWishlist(id) {
    try {
      const data = await api().del("/api/wishlist/" + id);
      state.wishlist = data.wishlist;
      return resultOk("Removed from wishlist.");
    } catch (error) { return resultFail(error); }
  }

  async function moveWishlistToCart(id) {
    if (!requireUser()) return { ok: false, message: "Please log in first.", auth: true };
    try {
      const data = await api().post("/api/wishlist/" + id + "/to-cart");
      state.cart = data.cart;
      return resultOk("Added to cart. It also stays in your wishlist.");
    } catch (error) { return resultFail(error); }
  }

  function getWishlist() {
    return state.wishlist.map(function (book) { return book.id; });
  }

  function activeLoans() {
    return state.borrowings.filter(function (loan) { return !loan.returnedAt; });
  }

  function isBorrowed(id) {
    return activeLoans().some(function (loan) { return loan.bookId === String(id); });
  }

  function loansThisMonth() {
    return state.usedThisMonth;
  }

  function borrowLimitReached() {
    return state.limitReached;
  }

  async function borrowBook(id) {
    if (!requireUser()) return { ok: false, message: "Please log in to borrow books.", auth: true };
    try {
      const data = await api().post("/api/borrowings", { bookId: id });
      await loadPrivate();
      return resultOk(data.message);
    } catch (error) { return resultFail(error); }
  }

  async function returnBook(loanOrBookId) {
    let loan = state.borrowings.find(function (item) {
      return item.id === String(loanOrBookId) || (item.bookId === String(loanOrBookId) && !item.returnedAt);
    });
    if (!loan) return { ok: false, message: "This book is not currently borrowed." };
    try {
      const data = await api().patch("/api/borrowings/" + loan.id + "/return");
      await loadPrivate();
      return resultOk(data.message);
    } catch (error) { return resultFail(error); }
  }

  function loanDueInfo(loan) {
    return { text: loan.dueText, overdue: loan.overdue };
  }

  function readingMap() {
    const map = {};
    state.reading.forEach(function (item) {
      map[item.bookId] = item;
    });
    return map;
  }

  async function addToReading(id) {
    if (!requireUser()) return { ok: false, message: "Please log in to use your reading list.", auth: true };
    try {
      const data = await api().post("/api/reading", { bookId: id });
      await loadPrivate();
      return resultOk(data.message);
    } catch (error) { return resultFail(error); }
  }

  async function completeBook(id) {
    if (!requireUser()) return { ok: false, message: "Please log in first.", auth: true };
    try {
      const data = await api().patch("/api/reading/" + id + "/complete");
      await loadPrivate();
      return resultOk(data.message);
    } catch (error) { return resultFail(error); }
  }

  async function setProgress(id, value) {
    if (!requireUser()) return { ok: false, message: "Please log in first.", auth: true };
    try {
      const data = await api().patch("/api/reading/" + id + "/progress", { progress: Number(value) });
      await loadPrivate();
      return resultOk(data.message);
    } catch (error) { return resultFail(error); }
  }

  async function readAgain(id) {
    if (!requireUser()) return { ok: false, message: "Please log in first.", auth: true };
    try {
      const data = await api().patch("/api/reading/" + id + "/restart");
      await loadPrivate();
      return resultOk(data.message);
    } catch (error) { return resultFail(error); }
  }

  async function savePage(id, page, percent) {
    try {
      const safePercent = Math.min(99, Number(percent) || 0);
      await api().patch("/api/reading/" + id + "/progress", { currentPage: page, progress: safePercent });
      await loadPrivate();
    } catch (error) { return resultFail(error); }
  }

  function getGoalTarget() {
    if (state.user && state.user.monthlyReadingTarget) return state.user.monthlyReadingTarget;
    return state.challenge.target || state.rules.monthlyReadingTarget;
  }

  async function setGoalTarget(value) {
    if (!requireUser()) return false;
    try {
      const data = await api().put("/api/users/me", { monthlyReadingTarget: Number(value) });
      state.user = data.user;
      await loadPrivate();
      return true;
    } catch (error) {
      return false;
    }
  }

  async function saveProfile(profile) {
    try {
      const data = await api().put("/api/users/me", {
        firstName: profile.firstName,
        lastName: profile.lastName,
        mobile: profile.mobile,
        address: profile.address,
        category: profile.category
      });
      state.user = data.user;
      return true;
    } catch (error) {
      return false;
    }
  }

  async function saveFeedback(item) {
    try {
      await api().post("/api/feedback", item);
      return true;
    } catch (error) {
      error.saved = false;
      throw error;
    }
  }

  async function checkout(paymentMethod) {
    try {
      const data = await api().post("/api/orders/checkout", { paymentMethod: paymentMethod });
      await loadPrivate();
      return resultOk(data.message, { order: data.order });
    } catch (error) { return resultFail(error); }
  }

  function loadRazorpayCheckout() {
    if (window.Razorpay) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      script.onerror = function () { reject(new Error("Razorpay checkout could not be loaded.")); };
      document.head.append(script);
    });
  }

  async function checkoutRazorpay() {
    try {
      const created = await api().post("/api/orders/razorpay", {});
      await loadRazorpayCheckout();
      const verified = await new Promise(function (resolve, reject) {
        const checkout = new window.Razorpay(Object.assign({}, created.razorpay, {
    key: created.razorpay.keyId,
          handler: function (response) {
            api().post("/api/orders/" + created.order.id + "/razorpay/verify", response).then(resolve).catch(reject);
          },
          modal: { ondismiss: function () { reject(new Error("Razorpay checkout was cancelled. Your cart was not cleared.")); } }
        }));
        checkout.open();
      });
      await loadPrivate();
      return resultOk(verified.message, { order: verified.order });
    } catch (error) { return resultFail(error); }
  }

  async function login(email, password) {
    const data = await api().post("/api/auth/login", { email: email, password: password });
    state.user = data.user;
    await loadPrivate();
    return data;
  }

  async function register(payload) {
    const data = await api().post("/api/auth/register", payload);
    state.user = data.user;
    await loadPrivate();
    return data;
  }

  async function logout() {
    await api().post("/api/auth/logout");
    state.user = null;
    await loadPrivate();
  }

  function isDark() {
    try { return localStorage.getItem(KEYS.theme) === "yes"; } catch (error) { return false; }
  }

  function applyTheme() {
    document.documentElement.classList.toggle("dark", isDark());
  }

  function toggleTheme() {
    try { localStorage.setItem(KEYS.theme, isDark() ? "no" : "yes"); } catch (error) { document.documentElement.classList.toggle("dark"); return; }
    applyTheme();
  }

  applyTheme();

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null && text !== "") node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function button(label, onClick, className) {
    const node = el("button", label, typeof className === "string" ? className : "btn btn-soft btn-sm");
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  function bookCover(book, mini) {
    const cover = el("div", "", (mini ? "mini-cover " : "book-cover ") + (book.cover || "cover-purple"));
    if (book.coverImageUrl) {
      const image = document.createElement("img");
      image.src = book.coverImageUrl + "?v=" + encodeURIComponent(book.coverImageName || book.id || "cover");
      image.alt = "Cover of " + book.title;
      image.className = "uploaded-cover-image";
      image.addEventListener("error", function () { image.remove(); cover.classList.remove("has-uploaded-cover"); });
      cover.classList.add("has-uploaded-cover");
      cover.append(image);
    }
    cover.append(el("span", book.title, "cover-title"));
    if (!mini) cover.append(el("span", book.author, "cover-author"));
    return cover;
  }

  function progressForm(book, entry, onResult) {
    const form = el("form", "", "progress-form");
    form.noValidate = true;
    const input = el("input");
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.value = entry.progress;
    input.setAttribute("aria-label", "Progress percentage for " + book.title);
    const save = el("button", "Update", "btn btn-soft btn-sm");
    save.type = "submit";
    form.append(input, save);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      Promise.resolve(setProgress(book.id, input.value)).then(onResult);
    });
    return form;
  }

  function isEmbedded() {
    return window.parent !== window;
  }

  function notifyParent(type, extra) {
    if (!isEmbedded()) return;
    window.parent.postMessage(Object.assign({ namespace: "booknest", type: type }, extra), "*");
  }

  function closeOnBackdropClick(dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
      if (outside) dialog.close();
    });
  }

  function getDetailsDialog() {
    let dialog = document.getElementById("bookDetailsDialog");
    if (dialog) return dialog;
    dialog = el("dialog");
    dialog.id = "bookDetailsDialog";
    dialog.setAttribute("aria-labelledby", "bookDetailsTitle");
    dialog.innerHTML = '<div class="dialog"><button type="button" class="icon-btn dialog-close" aria-label="Close book details">×</button><div class="dialog-body"></div></div>';
    document.body.append(dialog);
    dialog.querySelector(".dialog-close").addEventListener("click", function () { dialog.close(); });
    closeOnBackdropClick(dialog);
    return dialog;
  }

  function openBookDetails(id, onChange) {
    const book = getBook(id);
    if (!book) return;
    const dialog = getDetailsDialog();
    const body = dialog.querySelector(".dialog-body");
    const message = el("p", "", "form-status");
    message.setAttribute("role", "status");

    function act(resultPromise) {
      Promise.resolve(resultPromise).then(function (result) {
        message.textContent = result.message;
        message.className = "form-status " + (result.ok ? "is-success" : "is-error");
        if (typeof onChange === "function") onChange();
        render();
      });
    }

    function render() {
      const entry = readingMap()[book.id];
      const status = entry ? entry.status : "";
      const title = el("h2", book.title);
      title.id = "bookDetailsTitle";
      const actions = el("div", "", "dialog-actions");
      actions.append(button("Add to cart", function () { act(addToCart(book.id)); }, "btn btn-primary btn-sm"));

      if (status === STATUS.COMPLETED) {
        actions.append(button("Read again", function () { act(readAgain(book.id)); }));
      } else {
        const started = button(STATUS.STARTED, function () { act(addToReading(book.id)); });
        started.disabled = Boolean(status);
        const inProgress = button(STATUS.IN_PROGRESS, function () {
          act(setProgress(book.id, Math.max(1, entry ? entry.progress : 1)));
        });
        inProgress.disabled = status === STATUS.IN_PROGRESS;
        actions.append(started, inProgress, button(STATUS.COMPLETED, function () { act(completeBook(book.id)); }));
      }

      if (book.pdfAvailable) {
        actions.append(button("Read PDF", function () {
          window.top.location.href = "/reader.html?id=" + encodeURIComponent(book.id);
        }, "btn btn-outline btn-sm"));
      }

      const pdfNote = book.pdfAvailable
        ? "Authorized PDF available after purchase or an active loan."
        : "PDF not authorized for distribution yet.";

      body.replaceChildren(
        title,
        el("p", "Author: " + book.author),
        el("p", "Category: " + book.category),
        el("p", "First published: " + (book.year || "Not recorded")),
        el("p", "Price: " + money(book.price)),
        el("p", book.description),
        el("p", pdfNote),
        el("p", status ? "Reading status: " + status : "Reading status: not on your reading list"),
        actions,
        message
      );
    }

    render();
    dialog.showModal();
  }

  window.BookNest = {
    KEYS: KEYS,
    STATUS: STATUS,
    state: state,
    boot: boot,
    refresh: refresh,
    get BOOKS() { return state.books; },
    get BORROW_LIMIT() { return state.rules.maxBorrowingPerMonth; },
    get LOAN_DAYS() { return state.rules.borrowingDurationDays; },
    getBook: getBook,
    money: money,
    formatDate: formatDate,
    getCart: getCart,
    addToCart: addToCart,
    changeCartQuantity: changeCartQuantity,
    removeFromCart: removeFromCart,
    cartCount: cartCount,
    cartTotals: cartTotals,
    getWishlist: getWishlist,
    isWishlisted: isWishlisted,
    toggleWishlist: toggleWishlist,
    removeFromWishlist: removeFromWishlist,
    moveWishlistToCart: moveWishlistToCart,
    getLoans: function () { return state.borrowings; },
    activeLoans: activeLoans,
    isBorrowed: isBorrowed,
    loansThisMonth: loansThisMonth,
    borrowLimitReached: borrowLimitReached,
    borrowBook: borrowBook,
    returnBook: returnBook,
    loanDueInfo: loanDueInfo,
    getReading: readingMap,
    getHistory: function () { return state.history; },
    completedThisMonth: function () { return state.challenge.completed || 0; },
    addToReading: addToReading,
    completeBook: completeBook,
    setProgress: setProgress,
    readAgain: readAgain,
    savePage: savePage,
    getGoalTarget: getGoalTarget,
    setGoalTarget: setGoalTarget,
    getProfile: function () { return state.user || {}; },
    saveProfile: saveProfile,
    saveFeedback: saveFeedback,
    checkout: checkout,
    checkoutRazorpay: checkoutRazorpay,
    login: login,
    register: register,
    logout: logout,
    needsAuth: needsAuth,
    isDark: isDark,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    el: el,
    button: button,
    bookCover: bookCover,
    progressForm: progressForm,
    isEmbedded: isEmbedded,
    notifyParent: notifyParent,
    closeOnBackdropClick: closeOnBackdropClick,
    openBookDetails: openBookDetails
  };
}());
