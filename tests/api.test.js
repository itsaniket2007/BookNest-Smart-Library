process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-booknest";
process.env.ADMIN_EMAIL = "admin@booknest.local";
process.env.ADMIN_PASSWORD = "AdminPass123!";

const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { connectDb, disconnectDb } = require("../server/src/config/db");
const { seedDatabase } = require("../server/src/seed/seed");
const { ReadingCompletion, User } = require("../server/src/models");
const app = require("../server/src/app");

let mongod;

function auth(token) {
  return { Authorization: "Bearer " + token };
}

async function register(email, firstName) {
  const res = await request(app).post("/api/auth/register").send({
    firstName: firstName,
    lastName: "Customer",
    email: email,
    mobile: "9876543210",
    password: "Pass12345",
    confirmPassword: "Pass12345"
  });
  return res;
}

beforeAll(async function () {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri());
  await seedDatabase();
});

afterAll(async function () {
  await disconnectDb();
  if (mongod) await mongod.stop();
});

describe("BookNest API", function () {
  test("health check", async function () {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.express.status).toBe("running");
    expect(res.body.mongodb.connected).toBe(true);
    expect(res.body.timestamp).toBeTruthy();
  });

  test("lists books from JSON seed", async function () {
    const res = await request(app).get("/api/books");
    expect(res.status).toBe(200);
    expect(res.body.books.length).toBeGreaterThanOrEqual(16);
    const atomic = res.body.books.find(function (book) { return book.slug === "atomic-habits"; });
    expect(atomic.pdfAvailable).toBe(false);
    const sample = res.body.books.find(function (book) { return book.slug === "booknest-authorized-sample-reader"; });
    expect(sample.pdfAvailable).toBe(true);
  });

  test("searches books by title", async function () {
    const res = await request(app).get("/api/books").query({ search: "Atomic" });
    expect(res.body.books.some(function (book) { return book.title === "Atomic Habits"; })).toBe(true);
  });

  test("registers, logs in and isolates two customers", async function () {
    const a = await register("alice@booknest.test", "Alice");
    const b = await register("bob@booknest.test", "Bob");
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const books = await request(app).get("/api/books");
    const sample = books.body.books.find(function (book) { return book.slug === "booknest-authorized-sample-reader"; });
    const other = books.body.books.find(function (book) { return book.slug === "atomic-habits"; });

    await request(app).post("/api/cart/items").set(auth(a.body.token)).send({ bookId: sample.id, quantity: 2 });
    await request(app).post("/api/wishlist/" + other.id).set(auth(a.body.token));

    const aCart = await request(app).get("/api/cart").set(auth(a.body.token));
    const bCart = await request(app).get("/api/cart").set(auth(b.body.token));
    expect(aCart.body.cart.itemCount).toBe(2);
    expect(bCart.body.cart.itemCount).toBe(0);

    const aWish = await request(app).get("/api/wishlist").set(auth(a.body.token));
    const bWish = await request(app).get("/api/wishlist").set(auth(b.body.token));
    expect(aWish.body.wishlist.length).toBe(1);
    expect(bWish.body.wishlist.length).toBe(0);
  });

  test("rejects duplicate registration and bad passwords", async function () {
    const dup = await register("alice@booknest.test", "Alice");
    expect(dup.status).toBe(409);
    const weak = await request(app).post("/api/auth/register").send({
      firstName: "Weak",
      lastName: "User",
      email: "weak@booknest.test",
      password: "short",
      confirmPassword: "short"
    });
    expect(weak.status).toBe(400);
  });

  test("calculates GST on the server and checks out a demo order", async function () {
    const login = await request(app).post("/api/auth/login").send({
      email: "alice@booknest.test",
      password: "Pass12345"
    });
    const books = await request(app).get("/api/books");
    const sample = books.body.books.find(function (book) { return book.slug === "booknest-authorized-sample-reader"; });
    const cart = await request(app).get("/api/cart").set(auth(login.body.token));
    const expectedGst = Math.round(cart.body.cart.subtotal * 0.05 * 100) / 100;
    expect(cart.body.cart.gst).toBe(expectedGst);

    const blockedPdf = await request(app).get("/api/books/" + sample.id + "/pdf").set(auth(login.body.token));
    expect(blockedPdf.status).toBe(403);

    const order = await request(app).post("/api/orders/checkout").set(auth(login.body.token)).send({ paymentMethod: "UPI" });
    expect(order.status).toBe(201);
    expect(order.body.order.paymentNote).toMatch(/Simulated/);
    const empty = await request(app).get("/api/cart").set(auth(login.body.token));
    expect(empty.body.cart.itemCount).toBe(0);

    const pdf = await request(app).get("/api/books/" + sample.id + "/pdf").set(auth(login.body.token));
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toMatch(/pdf/);
  });

  test("enforces borrowing rules", async function () {
    const login = await request(app).post("/api/auth/login").send({
      email: "bob@booknest.test",
      password: "Pass12345"
    });
    const books = await request(app).get("/api/books");
    const first = books.body.books[0];
    const second = books.body.books[1];
    const third = books.body.books[2];

    const loan1 = await request(app).post("/api/borrowings").set(auth(login.body.token)).send({ bookId: first.id });
    const loan2 = await request(app).post("/api/borrowings").set(auth(login.body.token)).send({ bookId: second.id });
    expect(loan1.status).toBe(201);
    expect(loan2.status).toBe(201);

    const again = await request(app).post("/api/borrowings").set(auth(login.body.token)).send({ bookId: first.id });
    expect(again.status).toBe(409);

    const returned = await request(app).patch("/api/borrowings/" + loan1.body.borrowing.id + "/return").set(auth(login.body.token));
    expect(returned.status).toBe(200);

    const thirdTry = await request(app).post("/api/borrowings").set(auth(login.body.token)).send({ bookId: third.id });
    expect(thirdTry.status).toBe(409);
  });

  test("saves reading progress and feedback per customer", async function () {
    const login = await request(app).post("/api/auth/login").send({
      email: "alice@booknest.test",
      password: "Pass12345"
    });
    const books = await request(app).get("/api/books");
    const sample = books.body.books.find(function (book) { return book.slug === "booknest-authorized-sample-reader"; });
    await request(app).post("/api/reading").set(auth(login.body.token)).send({ bookId: sample.id });
    const progress = await request(app).patch("/api/reading/" + sample.id + "/progress").set(auth(login.body.token)).send({ progress: 40, currentPage: 2 });
    expect(progress.status).toBe(200);
    expect(progress.body.item.progress).toBe(40);
    const complete = await request(app).patch("/api/reading/" + sample.id + "/complete").set(auth(login.body.token));
    expect(complete.status).toBe(200);
    expect(complete.body.challenge.completed).toBeGreaterThanOrEqual(1);

    const feedback = await request(app).post("/api/feedback").set(auth(login.body.token)).send({
      name: "Alice Customer",
      email: "alice@booknest.test",
      type: "Suggestion",
      message: "Please keep the original BookNest design."
    });
    expect(feedback.status).toBe(201);

    const bob = await request(app).post("/api/auth/login").send({
      email: "bob@booknest.test",
      password: "Pass12345"
    });
    const bobFeedback = await request(app).get("/api/feedback/mine").set(auth(bob.body.token));
    expect(bobFeedback.body.feedback.length).toBe(0);
  });

  test("admin can manage books; customers cannot", async function () {
    const admin = await request(app).post("/api/auth/login").send({
      email: "admin@booknest.local",
      password: "AdminPass123!"
    });
    expect(admin.status).toBe(200);
    const created = await request(app).post("/api/admin/books").set(auth(admin.body.token)).send({
      title: "Classroom Notes",
      author: "BookNest Team",
      category: "Programming",
      price: 10,
      description: "A short internal notes title for admin tests."
    });
    expect(created.status).toBe(201);

    const customer = await request(app).post("/api/auth/login").send({
      email: "alice@booknest.test",
      password: "Pass12345"
    });
    const denied = await request(app).post("/api/admin/books").set(auth(customer.body.token)).send({
      title: "Should Fail",
      author: "Nope",
      category: "Fiction",
      price: 1,
      description: "Customers must not create catalogue books."
    });
    expect(denied.status).toBe(403);
  });

  test("supports cart clearing, dashboard, pagination and monthly completion history", async function () {
    const login = await request(app).post("/api/auth/login").send({ email: "alice@booknest.test", password: "Pass12345" });
    const books = await request(app).get("/api/books").query({ page: 1, limit: 12, search: "Atomic" });
    expect(books.status).toBe(200);
    expect(books.body.page).toBe(1);
    expect(books.body.limit).toBe(12);
    expect(books.body.total).toBeGreaterThanOrEqual(1);
    const sample = (await request(app).get("/api/books")).body.books.find(function (book) { return book.slug === "booknest-authorized-sample-reader"; });
    await request(app).post("/api/cart/items").set(auth(login.body.token)).send({ bookId: sample.id, quantity: 1 });
    const cleared = await request(app).delete("/api/cart").set(auth(login.body.token));
    expect(cleared.status).toBe(200);
    expect(cleared.body.cart.itemCount).toBe(0);
    const challenge = await request(app).get("/api/reading/challenge").set(auth(login.body.token));
    expect(challenge.status).toBe(200);
    expect(Array.isArray(challenge.body.history)).toBe(true);
    const dashboard = await request(app).get("/api/users/me/dashboard").set(auth(login.body.token));
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.dashboard).toHaveProperty("orders");
  });

  test("keeps one completion per user, book and controlled calendar month", async function () {
    const alice = await request(app).post("/api/auth/login").send({ email: "alice@booknest.test", password: "Pass12345" });
    const user = require("jsonwebtoken").verify(alice.body.token, process.env.JWT_SECRET).sub;
    const sample = (await request(app).get("/api/books")).body.books.find(function (book) { return book.slug === "booknest-authorized-sample-reader"; });
    await ReadingCompletion.create({ user: user, book: sample.id, month: "2026-01", completedAt: new Date("2026-01-10") });
    await ReadingCompletion.create({ user: user, book: sample.id, month: "2026-02", completedAt: new Date("2026-02-10") });
    await expect(ReadingCompletion.create({ user: user, book: sample.id, month: "2026-02", completedAt: new Date("2026-02-20") })).rejects.toMatchObject({ code: 11000 });
    expect(await ReadingCompletion.countDocuments({ user: user, book: sample.id })).toBe(3);
  });

  test("supports email verification, password reset and password change without storing raw tokens", async function () {
    const registered = await register("secure@booknest.test", "Secure");
    const user = await User.findOne({ email: "secure@booknest.test" }).select("+passwordHash");
    expect(user.isEmailVerified).toBe(false);
    expect(user.emailVerificationToken).toMatch(/^[a-f0-9]{64}$/);
    const forgot = await request(app).post("/api/auth/forgot-password").send({ email: "secure@booknest.test" });
    expect(forgot.status).toBe(200);
    const afterForgot = await User.findById(user._id);
    expect(afterForgot.passwordResetToken).toMatch(/^[a-f0-9]{64}$/);
    const changed = await request(app).post("/api/auth/change-password").set(auth(registered.body.token)).send({ currentPassword: "Pass12345", newPassword: "Changed123" });
    expect(changed.status).toBe(200);
    const login = await request(app).post("/api/auth/login").send({ email: "secure@booknest.test", password: "Changed123" });
    expect(login.status).toBe(200);
  });

  test("keeps live Razorpay checkout unavailable without credentials and rejects unsigned webhooks", async function () {
    const login = await request(app).post("/api/auth/login").send({ email: "alice@booknest.test", password: "Pass12345" });
    await request(app).post("/api/cart/items").set(auth(login.body.token)).send({ bookId: (await request(app).get("/api/books")).body.books[0].id, quantity: 1 });
    const checkout = await request(app).post("/api/orders/razorpay").set(auth(login.body.token)).send({});
    expect(checkout.status).toBe(503);
    const webhook = await request(app).post("/api/webhooks/razorpay").set("Content-Type", "application/json").send({ event: "payment.captured" });
    expect(webhook.status).toBe(400);
  });
});
