# BookNest final project test report

## Delivered implementation

The original HTML/CSS/vanilla-JavaScript BookNest interface was retained. The Express/Mongoose MVC application provides customer registration/login, JWT HttpOnly-cookie sessions, role-protected administration, isolated carts/wishlists/borrowings/orders/feedback, server-side GST, simulated checkout, profile photos, PDF entitlement streaming, PDF.js reader progress, JSON catalogue seeding and responsive/dark-mode frontend behavior.

This completion adds database-aware health reporting, cart clearing, customer dashboard counts, paginated/escaped catalogue search, immutable monthly reading completion history, safer upload signature validation, expanded admin editing/cover/PDF controls, account email verification/reset/change-password flows, optional SMTP delivery, optional Razorpay hosted checkout/webhooks/refunds, and completed Postman workflow requests.

## API and data architecture

- API roots: `/api/auth`, `/api/users`, `/api/books`, `/api/admin`, `/api/cart`, `/api/wishlist`, `/api/borrowings`, `/api/reading`, `/api/orders`, `/api/feedback`.
- Health: `GET /api/health` returns Express status, MongoDB connected/ready state and ISO timestamp; it returns 503 when disconnected.
- MongoDB collections: `users`, `books`, `categories`, `carts`, `wishlists`, `borrowings`, `readingprogresses`, `readingcompletions`, `orders`, `feedback`.
- Payment collection: `payments` records Razorpay gateway order/payment/refund identifiers, state and verified webhook audit events. It is not used for simulated checkout.
- `readingcompletions` is an immutable ledger with a unique `{ user, book, month }` index. Existing `ReadingProgress.completedMonth` records are migrated lazily, so prior history is retained.
- `server/src/data/books.json`, `categories.json`, `businessRules.json`, and `siteContent.json` are the live configuration inputs. The seed upserts catalogue fields while preserving uploaded PDF filenames, original names, authorization flags/timestamps and admin references.

## Security controls

Passwords use bcrypt; JWTs expire and use HttpOnly cookies in the browser. Email-verification and reset tokens are random, expire and are persisted only as hashes. Personal-resource queries are scoped to the signed-in user; admin endpoints require the admin role. Upload folders are not static. Uploads have MIME, size, generated-name and magic-signature checks. Searches escape regular-expression metacharacters. Helmet, CORS, rate limiting, validation and centralized error handling are enabled. Razorpay uses its hosted checkout, signature verification and signed webhooks; BookNest never receives card numbers/CVVs.

## Postman

Import `postman/BookNest.postman_collection.json` and `postman/BookNest.postman_environment.json`, choose **BookNest Local**, then run Health and Get books first. The environment base URL is `http://localhost:5000`; set `adminEmail`/`adminPassword` to values from `.env` if changed. The collection includes photos, cart clear, dashboard, challenge/history, restart, pagination, cover upload and PDF authorization/revocation.

## Verification results

- Passed static verification: JavaScript syntax checks for changed server/frontend/tests; valid JSON parsing for active legacy marker and Postman collection.
- Added automated coverage for health metadata, clear cart, dashboard, pagination and controlled-month completion uniqueness.
- `npm test` could not complete in this environment: `mongodb-memory-server` remained waiting for its MongoDB binary/download and produced no test result within the execution limit. No claim is made that the Jest suite passed here. Run it on the laptop with internet access (or a cached MongoDB test binary); it uses an isolated in-memory database and never targets the configured Atlas database.

## Run commands

```powershell
cd C:\Users\opani\Downloads\BookNestProject
copy .env.example .env
# edit .env: MONGODB_URI and a long JWT_SECRET are required
npm install
npm run seed
npm run dev
```

Open `http://localhost:5000`. For a production-style local start use `npm start`. Run `npm test` separately after the memory-server binary is available.

## Required configuration and limits

Provide a MongoDB Atlas/local `MONGODB_URI`, a long `JWT_SECRET`, and optionally non-default `ADMIN_*` credentials in `.env`. The generated **BookNest Authorized Sample Reader** is the only supplied reading PDF. Do not upload or authorize third-party PDFs unless distribution rights have been established.

## Modified files and purpose

- `server/src/app.js`, cart/user/reading/book controllers and routes: health, dashboard, clear-cart, challenge/history, safer search/pagination.
- `server/src/controllers/authController.js`, `services/emailService.js`, `models/User.js`, and new account pages: email verification, reset and password-change workflows with hashed expiring tokens.
- `server/src/models/Payment.js`, order/webhook/Razorpay service files: optional hosted checkout, signature verification, webhooks and refunds.
- `server/src/models/*`: removed duplicate index declarations and added `ReadingCompletion`.
- `server/src/seed/seed.js`: preserves runtime PDF authorization data during catalogue synchronization.
- `server/src/middleware/upload.js`, `errorHandler.js`: signature validation and useful invalid-file responses.
- `js/pages.js`: admin edit, cover upload and PDF authorization controls.
- `js/data.json`: valid deprecated marker; not a live data source.
- Postman collection, README, demonstration guide and API tests: completed workflows and accurate documentation.
