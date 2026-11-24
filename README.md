# BOOKNEST – SMART LIBRARY & BOOK MARKETPLACE

BookNest is a college Web Programming project: a smart library and book marketplace. This repository keeps the original BookNest HTML, CSS and page layout, and connects that frontend to a Node.js / Express / MongoDB backend.

Customers can browse the catalogue without an account. Registration, login, cart, wishlist, borrowing, reading progress, checkout, feedback and PDF reading are stored per customer in MongoDB.

## Features

- Original BookNest design (sidebar, catalogue cards, dark mode)
- Customer registration and login (JWT + HttpOnly cookie)
- Email verification, forgot/reset password and authenticated password change (SMTP-configured)
- Independent accounts: carts, wishlists, loans, orders and reading progress are never shared
- Catalogue search (escaped regular expressions), category filter, sort and API pagination (`?page=1&limit=12`)
- Server-side cart totals and GST
- Borrowing rules: two loans per calendar month, 30-day duration, early return does not restore a slot
- Reading list, progress, monthly reading challenge and immutable per-book monthly completion history
- Demo checkout (UPI / Card / Cash on Delivery) with simulated payments only
- Optional Razorpay hosted checkout, signed webhook confirmation and administrator refunds
- Feedback stored in MongoDB (customers see their own; admin sees all)
- Admin catalogue and authorized PDF upload
- PDF.js in-browser reader for **authorized** files only
- JSON files for catalogue and business rules, synced with `npm run seed`
- Postman collection and Jest tests

## Technology stack

| Layer | Tools |
| --- | --- |
| Frontend | HTML5, CSS3, vanilla JavaScript, PDF.js |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas, Mongoose |
| Auth | JWT, bcrypt, HttpOnly cookies |
| Uploads | Multer |
| Security | Helmet, CORS, express-rate-limit, express-validator, dotenv |
| Testing | Jest, Supertest, Postman |
| Dev | Nodemon |

Architecture: MVC + REST, with services for cart totals, entitlements and JSON loading.

## Folder structure

```
BookNestProject/
├── css/                          Original styles
├── html/                         Original pages plus login, register, orders, admin, reader
├── js/                           api.js, common.js, pages.js, script.js, reader.js
├── server/src/
│   ├── config/                   env.js, db.js
│   ├── models/                   User, Book, Cart, Wishlist, Borrowing, ReadingProgress, Order, Feedback, Category
│   ├── controllers/
│   ├── routes/
│   ├── middleware/               auth, validation, uploads, errors
│   ├── services/                 cart, PDF entitlement, JSON data
│   ├── data/                     books.json, categories.json, businessRules.json, siteContent.json
│   ├── seed/seed.js
│   ├── uploads/                  pdfs, covers, profiles, samples (not public static URLs)
│   ├── app.js
│   └── server.js
├── postman/
├── tests/
├── .env.example
├── package.json
├── README.md
└── BACKEND_DEMONSTRATION.md
```

`_backup_original_frontend/` is a copy of the starting frontend. Do not serve it.

## Frontend architecture

- `js/api.js` — `fetch` helper with `credentials: "include"`
- `js/common.js` — shared state; all business actions call REST APIs
- `js/script.js` — home page catalogue, navigation, auth buttons
- `js/pages.js` — borrow, cart, wishlist, library, profile, feedback, login, register, admin, orders
- `js/reader.js` — PDF.js viewer, page/zoom/fullscreen, saved position
- Dark mode still uses `localStorage` only

The Express server serves the homepage at `http://localhost:5000`.

## Backend architecture (MVC)

- **Models** — Mongoose schemas with validation, references and indexes
- **Controllers** — request handlers and HTTP status codes
- **Routes** — `/api/...` REST endpoints
- **Middleware** — JWT, roles, ownership, Multer, validators, Helmet, rate limit
- **Services** — GST/totals, PDF entitlement (purchase or active loan), JSON loaders

## REST APIs

| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Customer / admin |
| POST | `/api/auth/logout` | Customer / admin |
| POST | `/api/auth/verify-email`, `/forgot-password`, `/reset-password`, `/change-password` | Public / owner |
| GET/PUT | `/api/users/me` | Customer / admin |
| GET | `/api/users/me/dashboard` | Customer / admin |
| POST/DELETE | `/api/users/me/photo` | Customer / admin |
| GET | `/api/books` | Public |
| GET | `/api/books/:id` | Public |
| GET | `/api/books/:id/pdf` | Entitled user |
| POST/PUT/DELETE | `/api/admin/books` | Admin |
| POST | `/api/admin/books/:id/pdf` | Admin |
| GET/POST/PATCH/DELETE | `/api/cart...` (including `DELETE /api/cart`) | Owner |
| GET/POST/DELETE | `/api/wishlist...` | Owner |
| GET/POST/PATCH | `/api/borrowings...` | Owner |
| GET/POST/PATCH | `/api/reading...` (including `/challenge`) | Owner |
| POST/GET | `/api/orders...` | Owner |
| POST/GET | `/api/feedback...` | Owner / admin |
| POST | `/api/orders/razorpay`, `/:id/razorpay/verify` | Customer |
| POST | `/api/webhooks/razorpay` | Razorpay signed webhook |
| GET | `/api/health` | Public |

## MongoDB

Customer data lives in separate collections: users, carts, wishlists, borrowings, readingprogresses, **readingcompletions**, orders, feedback. `readingcompletions` has a unique user-book-month index, preserving historical challenge credit across restarts. Catalogue books and categories are seeded from JSON.

Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas). Use a database user and the `MONGODB_URI` connection string.

## JSON data management (college requirement)

Edit these files, then run `npm run seed`:

- `server/src/data/books.json` — title, author, category, price, year, description, cover class, availability, PDF flags
- `server/src/data/categories.json`
- `server/src/data/businessRules.json` — borrowing limit, loan days, GST %, reading target, upload limits
- `server/src/data/siteContent.json`

Seed uses **upsert by slug**. Changing a book in JSON and re-running seed updates catalogue-managed fields only. Carts, passwords, orders, borrowings, feedback, reading progress and uploaded PDF filenames/authorization audit fields are **not** deleted or overwritten. `js/data.json` is only a valid deprecated compatibility marker; live data is always `server/src/data/`.

The sixteen supplied titles are in `books.json` with `pdfAuthorized: false` and `pdfAvailable: false`. Copyrighted files are **not** copied into public folders or marked readable.

A project-generated file, **BookNest Authorized Sample Reader**, is the only PDF enabled for classroom reading.

## Authentication

- Passwords hashed with bcrypt
- JWT in an HttpOnly cookie for the browser
- The same JWT is returned in JSON so Postman can send `Authorization: Bearer <token>`
- Roles: `customer` and `admin`
- Ownership checks on every personal collection
- Verification and reset tokens are random, expire, and are stored only as SHA-256 hashes

## Optional email and Razorpay configuration

`.env.example` documents SMTP and Razorpay values. SMTP sends verification/reset links; without it, development logs a mail preview but does not deliver email. Razorpay is optional: standard UPI/Card/COD checkout remains simulated. To enable live test-mode Razorpay, provide `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`, then configure Razorpay to send signed events to `http(s)://YOUR-HOST/api/webhooks/razorpay`. Card details are handled only by Razorpay Checkout and never pass through BookNest.

Default admin (created by seed if missing):

- Email: `admin@booknest.local` (or `ADMIN_EMAIL`)
- Password: `AdminPass123!` (or `ADMIN_PASSWORD`)

Change these before any public deployment.

## PDF reader and copyright

Supplied third-party PDFs must stay unpublished until you have distribution rights.

1. Administrator uploads a PDF with `authorizedForDistribution=false` (stored privately; customers cannot read it).
2. After legal confirmation, the admin sets authorization to true.
3. Customers may read an authorized PDF only if they **purchased** it or have an **active, non-overdue loan**.
4. PDFs are streamed from `/api/books/:id/pdf` after those checks. They are not static public URLs.

Development: use the generated sample PDF. PDF.js provides page navigation, zoom and fullscreen. The last page is stored in MongoDB.

## Book covers and stored uploads

The seeded catalogue uses the original BookNest CSS cover treatment until an administrator uploads a real cover image. Upload a JPG, PNG, WebP, or GIF from **Admin → Catalogue**. The selected-file control will always reset after reload (browser security); the row below it now shows the persisted cover/PDF filename. Uploaded covers are served through the application route, appear on catalogue cards after refresh, and the first uploaded cover is used as a subtle hero backdrop. Copyrighted cover art should only be uploaded where you have permission to use it.

## Installation

Requires Node.js 18+.

```bash
cd BookNestProject
npm install
copy .env.example .env
```

On macOS/Linux use `cp .env.example .env`.

## Environment configuration

Edit `.env`:

```
PORT=5000
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/booknest?retryWrites=true&w=majority
JWT_SECRET=a-long-random-secret
```

`.env` is gitignored. Never commit Atlas passwords.

## Database seeding

```bash
npm run seed
```

## Server execution

```bash
npm run dev      # Nodemon
npm start        # production-style start
```

Open [http://localhost:5000](http://localhost:5000).

## Tests

```bash
npm test
```

Jest + Supertest + an in-memory MongoDB. Atlas is not required for tests.

The health check at `/api/health` reports Express status, MongoDB connection status/ready state and a timestamp. It returns HTTP 503 when MongoDB is unavailable.

## Postman testing

1. Import `postman/BookNest.postman_collection.json`
2. Import `postman/BookNest.postman_environment.json`
3. Select **BookNest Local**
4. Run **GET health**, then **Get books** (saves IDs)
5. Register or log in; tokens are stored automatically

See `BACKEND_DEMONSTRATION.md` for the viva sequence.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start with Nodemon |
| `npm start` | Start Node |
| `npm run seed` | Upsert JSON into MongoDB |
| `npm test` | API tests |
