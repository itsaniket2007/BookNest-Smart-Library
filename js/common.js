(function () {
  "use strict";
  const KEYS = {
    cart: "booknestCart",
    wishlist: "booknestWishlist",
    borrowed: "booknestBorrowed",
    reading: "booknestReading",
    history: "booknestReadingHistory",
    goal: "booknestGoalData",
    profile: "booknestProfile",
    feedback: "booknestFeedback",
    theme: "booknestDarkMode"
  };

  const BORROW_LIMIT = 2;
  const LOAN_DAYS = 30;
  const MAX_QUANTITY = 99;
  const GST_RATE = 0.05;
  const DEFAULT_GOAL = 5;
  const MAX_GOAL = 100;

  const STATUS = { STARTED: "Started", IN_PROGRESS: "In Progress", COMPLETED: "Completed" };

  const BOOKS = Object.freeze([
    { id: 1, title: "Atomic Habits", author: "James Clear", category: "Self Help", price: 499, year: 2018, cover: "cover-purple", description: "A practical guide to building good habits and breaking bad ones." },
    { id: 2, title: "The Psychology of Money", author: "Morgan Housel", category: "Business", price: 399, year: 2020, cover: "cover-yellow", description: "Simple lessons about wealth, greed, and happiness through stories." },
    { id: 3, title: "Thinking, Fast and Slow", author: "Daniel Kahneman", category: "Self Help", price: 550, year: 2011, cover: "cover-blue", description: "An exploration of fast intuitive thinking and slower deliberate reasoning." },
    { id: 4, title: "Rich Dad Poor Dad", author: "Robert Kiyosaki", category: "Business", price: 350, year: 1997, cover: "cover-dark", description: "Personal finance lessons about assets, liabilities, and financial independence." },
    { id: 5, title: "The Alchemist", author: "Paulo Coelho", category: "Fiction", price: 299, year: 1988, cover: "cover-orange", description: "A young shepherd follows his dream and discovers his personal legend." },
    { id: 6, title: "Clean Code", author: "Robert C. Martin", category: "Programming", price: 650, year: 2008, cover: "cover-green", description: "Principles and practices for writing readable, maintainable software." },
    { id: 7, title: "JavaScript: The Good Parts", author: "Douglas Crockford", category: "Programming", price: 450, year: 2008, cover: "cover-gold", description: "A concise guide to the core features of JavaScript." },
    { id: 8, title: "Data Science from Scratch", author: "Joel Grus", category: "Data Science", price: 599, year: 2015, cover: "cover-indigo", description: "An introduction to data science using practical Python examples." },
    { id: 9, title: "A Short History of Nearly Everything", author: "Bill Bryson", category: "History", price: 499, year: 2003, cover: "cover-brown", description: "An accessible journey through science and the history of our world." },
    { id: 10, title: "The Pragmatic Programmer", author: "Andrew Hunt and David Thomas", category: "Programming", price: 599, year: 1999, cover: "cover-indigo", description: "Timeless pragmatic techniques for improving software development." }
  ]);

  function getBook(id) {
    return BOOKS.find(function (book) { return book.id === Number(id); });
  }
  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null || value === undefined ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }
  function money(amount) {
    return "₹" + Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function roundMoney(amount) {
    return Math.round(amount * 100) / 100;
  }

  function monthKey(date) {
    const d = date || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function formatDate(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function isValidDate(isoString) {
    return !Number.isNaN(new Date(isoString).getTime());
  }
  function clampQuantity(value) {
    const quantity = Math.floor(Number(value)) || 1;
    return Math.min(MAX_QUANTITY, Math.max(1, quantity));
  }
  function getCart() {
    const raw = readJSON(KEYS.cart, []);
    if (!Array.isArray(raw)) return [];
    const quantities = new Map();
    raw.forEach(function (item) {
      const id = Number(item && item.id);
      if (!getBook(id)) return;
      quantities.set(id, clampQuantity((quantities.get(id) || 0) + clampQuantity(item.quantity)));
    });
    return Array.from(quantities, function (entry) { return { id: entry[0], quantity: entry[1] }; });
  }

  function saveCart(cart) {
    return writeJSON(KEYS.cart, cart);
  }

  function addToCart(id) {
    if (!getBook(id)) return false;
    const cart = getCart();
    const item = cart.find(function (entry) { return entry.id === Number(id); });
    if (item) item.quantity = clampQuantity(item.quantity + 1);
    else cart.push({ id: Number(id), quantity: 1 });
    return saveCart(cart);
  }

  function changeCartQuantity(id, delta) {
    const cart = getCart();
    const item = cart.find(function (entry) { return entry.id === Number(id); });
    if (!item) return false;
    item.quantity = clampQuantity(item.quantity + delta);
    return saveCart(cart);
  }

  function removeFromCart(id) {
    return saveCart(getCart().filter(function (entry) { return entry.id !== Number(id); }));
  }

  function clearCart() {
    return saveCart([]);
  }

  function cartCount() {
    return getCart().reduce(function (sum, item) { return sum + item.quantity; }, 0);
  }
  function cartTotals() {
    const subtotal = getCart().reduce(function (sum, item) {
      return sum + getBook(item.id).price * item.quantity;
    }, 0);
    const gst = roundMoney(subtotal * GST_RATE);
    return { subtotal: subtotal, gst: gst, total: roundMoney(subtotal + gst) };
  }

  function getWishlist() {
    const raw = readJSON(KEYS.wishlist, []);
    if (!Array.isArray(raw)) return [];
    const ids = raw.map(Number).filter(function (id) { return Boolean(getBook(id)); });
    return Array.from(new Set(ids));
  }

  function isWishlisted(id) {
    return getWishlist().includes(Number(id));
  }
  function toggleWishlist(id) {
    const numericId = Number(id);
    const wishlist = getWishlist();
    const saved = wishlist.includes(numericId);
    writeJSON(KEYS.wishlist, saved ? wishlist.filter(function (x) { return x !== numericId; }) : wishlist.concat(numericId));
    return !saved;
  }

  function removeFromWishlist(id) {
    writeJSON(KEYS.wishlist, getWishlist().filter(function (x) { return x !== Number(id); }));
  }
  function getLoans() {
    const raw = readJSON(KEYS.borrowed, []);
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (loan) {
      return loan && getBook(loan.id) && isValidDate(loan.borrowedAt) && isValidDate(loan.dueAt);
    }).map(function (loan) {
      return { id: Number(loan.id), borrowedAt: loan.borrowedAt, dueAt: loan.dueAt, returnedAt: loan.returnedAt || null };
    });
  }

  function activeLoans() {
    return getLoans().filter(function (loan) { return !loan.returnedAt; });
  }

  function isBorrowed(id) {
    return activeLoans().some(function (loan) { return loan.id === Number(id); });
  }
  function loansThisMonth() {
    const current = monthKey();
    return getLoans().filter(function (loan) { return monthKey(new Date(loan.borrowedAt)) === current; }).length;
  }

  function borrowLimitReached() {
    return loansThisMonth() >= BORROW_LIMIT;
  }

  function borrowBook(id) {
    const book = getBook(id);
    if (!book) return { ok: false, message: "That book is not in the catalogue." };
    if (isBorrowed(id)) return { ok: false, message: "“" + book.title + "” is already borrowed and has not been returned." };
    if (borrowLimitReached()) {
      return { ok: false, message: "Monthly borrowing limit reached. You can borrow only " + BORROW_LIMIT + " books per calendar month, even if you return one early." };
    }
    const now = new Date();
    const due = new Date(now);
    due.setDate(due.getDate() + LOAN_DAYS);
    const loans = getLoans();
    loans.push({ id: book.id, borrowedAt: now.toISOString(), dueAt: due.toISOString(), returnedAt: null });
    if (!writeJSON(KEYS.borrowed, loans)) return { ok: false, message: "Could not save this loan. Browser storage may be full or blocked." };
    return { ok: true, message: "“" + book.title + "” borrowed. Due in " + LOAN_DAYS + " days." };
  }

  function returnBook(id) {
    const loans = getLoans();
    const loan = loans.find(function (entry) { return entry.id === Number(id) && !entry.returnedAt; });
    if (!loan) return { ok: false, message: "This book is not currently borrowed." };
    loan.returnedAt = new Date().toISOString();
    writeJSON(KEYS.borrowed, loans);
    return { ok: true, message: "Book returned. It still counts towards this month's borrowing limit." };
  }

  function loanDueInfo(loan) {
    const days = Math.ceil((new Date(loan.dueAt) - new Date()) / 86400000);
    if (days < 0) return { text: Math.abs(days) + " day(s) overdue", overdue: true };
    if (days === 0) return { text: "Due today", overdue: false };
    return { text: days + " day(s) remaining", overdue: false };
  }

  function getReading() {
    const raw = readJSON(KEYS.reading, {});
    const reading = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return reading;
    Object.keys(raw).forEach(function (key) {
      const entry = raw[key];
      if (!getBook(key) || !entry || !Object.values(STATUS).includes(entry.status)) return;
      const progress = Math.min(100, Math.max(0, Number(entry.progress) || 0));
      reading[Number(key)] = Object.assign({}, entry, { progress: entry.status === STATUS.COMPLETED ? 100 : progress });
    });
    return reading;
  }

  function saveReading(reading) {
    return writeJSON(KEYS.reading, reading);
  }

  function getHistory() {
    const raw = readJSON(KEYS.history, []);
    return Array.isArray(raw) ? raw.filter(function (item) { return item && getBook(item.id) && item.completedMonth; }) : [];
  }

  function completedThisMonth() {
    const current = monthKey();
    const ids = new Set(getHistory().filter(function (item) { return item.completedMonth === current; }).map(function (item) { return Number(item.id); }));
    return ids.size;
  }

  function addToReading(id) {
    const book = getBook(id);
    if (!book) return { ok: false, message: "That book is not in the catalogue." };
    const reading = getReading();
    if (reading[book.id]) return { ok: false, message: "“" + book.title + "” is already in your reading list." };
    reading[book.id] = { status: STATUS.STARTED, progress: 0, startedAt: new Date().toISOString() };
    saveReading(reading);
    return { ok: true, message: "“" + book.title + "” added to your reading list as Started." };
  }
  function completeBook(id) {
    const book = getBook(id);
    if (!book) return { ok: false, message: "That book is not in the catalogue." };
    const reading = getReading();
    const entry = reading[book.id];
    if (entry && entry.status === STATUS.COMPLETED) {
      return { ok: false, message: "“" + book.title + "” is already marked as completed." };
    }
    const completedAt = new Date().toISOString();
    reading[book.id] = Object.assign({ startedAt: completedAt }, entry, { status: STATUS.COMPLETED, progress: 100, completedAt: completedAt });
    saveReading(reading);

    const month = monthKey();
    const history = getHistory();
    if (!history.some(function (item) { return Number(item.id) === book.id && item.completedMonth === month; })) {
      history.unshift({ id: book.id, title: book.title, completedAt: completedAt, completedMonth: month });
      writeJSON(KEYS.history, history);
    }
    return { ok: true, message: "“" + book.title + "” completed. Your monthly challenge has been updated." };
  }

  function setProgress(id, value) {
    const book = getBook(id);
    const progress = Number(value);
    if (!book) return { ok: false, message: "That book is not in the catalogue." };
    if (value === "" || value === null || !Number.isInteger(progress) || progress < 0 || progress > 100) {
      return { ok: false, message: "Enter a whole number from 0 to 100." };
    }
    const reading = getReading();
    const entry = reading[book.id] || { startedAt: new Date().toISOString() };
    if (entry.status === STATUS.COMPLETED) return { ok: false, message: "This book is already completed. Use “Read again” to restart it." };
    if (progress >= 100) return completeBook(book.id);
    reading[book.id] = Object.assign({}, entry, {
      status: progress > 0 ? STATUS.IN_PROGRESS : STATUS.STARTED,
      progress: progress,
      updatedAt: new Date().toISOString()
    });
    saveReading(reading);
    return { ok: true, message: "Reading progress saved (" + progress + "%)." };
  }

  function readAgain(id) {
    const book = getBook(id);
    const reading = getReading();
    if (!book || !reading[book.id] || reading[book.id].status !== STATUS.COMPLETED) {
      return { ok: false, message: "Only completed books can be read again." };
    }
    reading[book.id] = { status: STATUS.STARTED, progress: 0, startedAt: new Date().toISOString() };
    saveReading(reading);
    return { ok: true, message: "“" + book.title + "” is back on your reading list." };
  }

  function getGoalTarget() {
    const goal = readJSON(KEYS.goal, {});
    const target = Number(goal && goal.target);
    return Number.isInteger(target) && target >= 1 && target <= MAX_GOAL ? target : DEFAULT_GOAL;
  }

  function setGoalTarget(value) {
    const target = Number(value);
    if (value === "" || !Number.isInteger(target) || target < 1 || target > MAX_GOAL) return false;
    return writeJSON(KEYS.goal, { target: target });
  }

  function getProfile() {
    const profile = readJSON(KEYS.profile, {});
    return profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {};
  }

  function saveProfile(profile) {
    return writeJSON(KEYS.profile, profile);
  }

  function saveFeedback(item) {
    const list = readJSON(KEYS.feedback, []);
    const entries = Array.isArray(list) ? list : [];
    entries.push(Object.assign({}, item, { createdAt: new Date().toISOString() }));
    return writeJSON(KEYS.feedback, entries);
  }
  function isDark() {
    try {
      return localStorage.getItem(KEYS.theme) === "yes";
    } catch (error) {
      return false;
    }
  }

  function applyTheme() {
    document.documentElement.classList.toggle("dark", isDark());
  }

  function toggleTheme() {
    try {
      localStorage.setItem(KEYS.theme, isDark() ? "no" : "yes");
    } catch (error) {
      document.documentElement.classList.toggle("dark");
      return;
    }
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
    const cover = el("div", "", (mini ? "mini-cover " : "book-cover ") + book.cover);
    cover.setAttribute("aria-hidden", "true");
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
      onResult(setProgress(book.id, input.value));
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

    function act(result) {
      message.textContent = result.message;
      message.className = "form-status " + (result.ok ? "is-success" : "is-error");
      if (typeof onChange === "function") onChange();
      render();
    }

    function render() {
      const entry = getReading()[book.id];
      const status = entry ? entry.status : "";
      const title = el("h2", book.title);
      title.id = "bookDetailsTitle";
      const actions = el("div", "", "dialog-actions");
      actions.append(button("Add to cart", function () {
        addToCart(book.id);
        act({ ok: true, message: "Added to cart." });
      }, "btn btn-primary btn-sm"));

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

      body.replaceChildren(
        title,
        el("p", "Author: " + book.author),
        el("p", "Category: " + book.category),
        el("p", "First published: " + book.year),
        el("p", "Price: " + money(book.price)),
        el("p", book.description),
        el("p", status ? "Reading status: " + status : "Reading status: not on your reading list"),
        actions,
        message
      );
    }

    render();
    dialog.showModal();
  }

  window.BookNest = {
    KEYS: KEYS, BORROW_LIMIT: BORROW_LIMIT, LOAN_DAYS: LOAN_DAYS, STATUS: STATUS, BOOKS: BOOKS,
    getBook: getBook, money: money, monthKey: monthKey, formatDate: formatDate,
    getCart: getCart, addToCart: addToCart, changeCartQuantity: changeCartQuantity,
    removeFromCart: removeFromCart, clearCart: clearCart, cartCount: cartCount, cartTotals: cartTotals,
    getWishlist: getWishlist, isWishlisted: isWishlisted, toggleWishlist: toggleWishlist, removeFromWishlist: removeFromWishlist,
    getLoans: getLoans, activeLoans: activeLoans, isBorrowed: isBorrowed, loansThisMonth: loansThisMonth,
    borrowLimitReached: borrowLimitReached, borrowBook: borrowBook, returnBook: returnBook, loanDueInfo: loanDueInfo,
    getReading: getReading, getHistory: getHistory, completedThisMonth: completedThisMonth,
    addToReading: addToReading, completeBook: completeBook, setProgress: setProgress, readAgain: readAgain,
    getGoalTarget: getGoalTarget, setGoalTarget: setGoalTarget,
    getProfile: getProfile, saveProfile: saveProfile, saveFeedback: saveFeedback,
    isDark: isDark, applyTheme: applyTheme, toggleTheme: toggleTheme,
    el: el, button: button, bookCover: bookCover, progressForm: progressForm, isEmbedded: isEmbedded, notifyParent: notifyParent,
    closeOnBackdropClick: closeOnBackdropClick, openBookDetails: openBookDetails
  };
}());
