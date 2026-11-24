# BookNest — professor demonstration guide

Use this sequence in the viva. Keep MongoDB Atlas, a terminal, the browser and Postman open.

## Before you start

1. Copy `.env.example` to `.env`.
2. Paste your Atlas `MONGODB_URI` and a `JWT_SECRET`.
3. `npm install`
4. `npm run seed`
5. `npm run dev`

You should see:

```
Connected to MongoDB
BookNest running at http://localhost:5000
```

If MongoDB fails, the URI in `.env` is wrong (user, password, or IP allowlist).

## Demonstration sequence

### 1. Start the backend

Terminal: `npm run dev`. Point at `server/src/server.js` and `server/src/app.js`.

### 2. Connect MongoDB

Atlas → Database → Browse Collections. After seed you should see `books`, `categories` and an `admin@booknest.local` user. Customer carts appear only after someone uses the site.

### 3. Open the BookNest website

Browser: [http://localhost:5000](http://localhost:5000)

Show the original layout: sidebar, hero, catalogue, dark mode. While logged out, Login/Register appear. The catalogue still loads (public `GET /api/books`).

### 4. Register Customer A

Register → Alice, email such as `alice.demo@booknest.test`, password `Pass12345`.

File: `html/register.html` → `js/pages.js` → `POST /api/auth/register` (`authController.js`). Password is hashed in MongoDB (`users` collection).

### 5. Register Customer B

Log out, then register Bob (`bob.demo@booknest.test`). Two documents appear under `users`.

### 6. Log into Customer A

Login form: `html/login.html` → `POST /api/auth/login`. The header shows Alice’s name, Profile, Orders and Log out (`js/script.js` `renderAuth`).

### 7. Add books to the cart

On Browse Books, Add to Cart. Open Cart. Change quantity. Totals and GST come from the server (`cartService.js`), not from the browser.

MongoDB: `carts` document for Alice only.

### 8. Add books to the wishlist

Heart icon or Wishlist page. Duplicates are ignored (`wishlistController.js`).

### 9. Borrow a book

Borrow page. Rules (backend):

- maximum two borrowings this calendar month
- 30 days
- returning early does **not** free a slot
- same book cannot be borrowed twice at once

Code: `borrowingController.js` and `businessRules.json`.

### 10. Update reading progress

My Library: add a book, set a percentage, Mark completed. Home page challenge counts update. `readingprogresses` stores current state and `readingcompletions` retains one immutable credit per user/book/calendar month, even after a restart.

### 11. Log out

Header Log out → `POST /api/auth/logout` clears the cookie. Cart count returns to 0 for a guest.

### 12. Log into Customer B

Bob’s cart and wishlist are empty.

### 13. Verify Customer A’s data is not visible

Bob cannot see Alice’s cart, wishlist, loans, orders or profile. This is enforced in queries (`user: req.user._id`), not only in HTML.

Optional: in Postman, call Alice’s order ID with Bob’s token → 404.

### 14. Complete a checkout (as Alice or Bob)

Cart → Demo checkout → UPI / Card / Cash on Delivery.

Say clearly: **simulated payment only; no real money; no card number or CVV is collected.**

Order ID is stored. Cart clears. `orders` collection. Orders page: `html/orders.html`.

Buy **BookNest Authorized Sample Reader** if you want to demo PDF reading as a customer.

### 15. Test REST APIs in Postman

Import:

- `postman/BookNest.postman_collection.json`
- `postman/BookNest.postman_environment.json`

Run Health, Get books, Login, Cart, Borrow, Checkout. Show JSON bodies and 201/401/403/409 statuses.

### 16. Show database records in MongoDB Atlas

Open `users`, `books`, `carts`, `wishlists`, `borrowings`, `readingprogresses`, `readingcompletions`, `orders`, `feedback`. Point at `user` ObjectIds to show isolation.

### 17. Demonstrate authorized PDF reading

1. Log in as admin (`admin@booknest.local` / `AdminPass123!` unless you changed `.env`).
2. Admin page: catalogue, prices, PDF upload checkbox.
3. Copyrighted titles stay **PDF pending**.
4. As a customer who purchased or borrowed the **sample** title, click Read PDF.

Reader: `html/reader.html` + `js/reader.js` (PDF.js). File bytes come from `GET /api/books/:id/pdf` after `entitlementService.js`.

Without a purchase/loan the same URL returns 403. Admin can open stored files for review.

## Which files handle what

| Feature | Frontend | Backend |
| --- | --- | --- |
| Home / catalogue | `html/index.html`, `js/script.js` | `bookController.js` |
| Login / register | `html/login.html`, `html/register.html` | `authController.js` |
| Profile / photo | `html/profile.html` | `userController.js`, Multer |
| Cart / GST / checkout | `html/cart.html` | `cartController.js`, `orderController.js` |
| Wishlist | `html/wishlist.html`, cart panel | `wishlistController.js` |
| Borrow / return | `html/borrow.html` | `borrowingController.js` |
| Library / challenge | `html/library.html`, home challenge | `readingController.js` |
| PDF reader | `html/reader.html`, `js/reader.js` | `bookController.readPdf` |
| Feedback | `html/feedback.html` | `feedbackController.js` |
| Admin | `html/admin.html` | `admin.routes.js` |
| JSON seed | — | `server/src/data/*.json`, `seed/seed.js` |
| API client | `js/api.js`, `js/common.js` | `server/src/app.js` |

## JSON edits during the viva

1. Change a price in `server/src/data/books.json`.
2. Change `gstPercentage` in `businessRules.json`.
3. Stop is not required; run `npm run seed`.
4. Refresh the site: catalogue and GST update; Alice’s orders stay.

## If something fails

- Blank catalogue: server not running or `MONGODB_URI` missing.
- 401 on cart: not logged in.
- PDF 403: title not authorized, or customer has not bought/borrowed it.
- Seed error: JSON syntax error.

Automated check (does not need Atlas): `npm test`.

Health check: open `http://localhost:5000/api/health`. It reports `express.status`, `mongodb.connected`, `mongodb.readyState` and `timestamp`; a disconnected database returns HTTP 503.
