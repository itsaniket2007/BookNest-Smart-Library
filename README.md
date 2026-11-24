#  BookNest – Smart Library & Book Marketplace

**Discover. Borrow. Read. Own.**

BookNest is a full-stack online library and book marketplace built to make reading and book discovery easier for students and book lovers.

The idea behind BookNest is simple: bring the experience of a traditional library and an online bookstore together in one platform. Users can explore books, manage their personal reading lists, borrow books, purchase titles, track their reading progress and access authorized digital books through an integrated PDF reader.

What started as a frontend web programming project has evolved into a complete web application with a Node.js backend, MongoDB database, authentication system and REST APIs.

The project focuses on building a practical application where the frontend and backend work together, user data remains independent and important operations are handled securely on the server.

---

##  What Makes BookNest Different?

BookNest is designed around the complete reading experience, rather than simply displaying a collection of books.

- Browse books and explore categories without creating an account.
- Maintain a personal wishlist and shopping cart.
- Borrow books with defined monthly borrowing rules.
- Purchase books through the integrated checkout system.
- Track reading activity and maintain reading progress.
- Participate in monthly reading challenges.
- Read authorized digital books directly in the browser.
- Manage books, uploaded files and customer feedback through an administrator dashboard.

Every registered customer gets an independent account. Their cart, wishlist, borrowing history, orders and reading activity remain associated with their own account.

---

##  Features

### 1. Book Discovery and Catalogue

Explore the available book collection through an organised catalogue.

- Browse books without logging in.
- Search books by relevant information.
- Filter books by category.
- Sort catalogue results.
- View individual book details.
- Paginated API responses for efficient catalogue loading.
- Dynamically managed book covers.

### 2. Authentication and Account Management

BookNest includes an authentication system designed around individual customer accounts.

- Customer registration and login.
- Password hashing using bcrypt.
- JWT-based authentication.
- HttpOnly cookie-based browser sessions.
- Email verification.
- Forgot password and password reset.
- Authenticated password changes.
- Customer profile management.
- Profile photo uploads.
- Separate customer and administrator roles.

Ownership checks ensure that customers cannot access another customer's personal information or account data.

### 3. Shopping Cart and Wishlist

Customers can manage their selected books through their personal shopping experience.

**Shopping Cart**
- Add books to the cart.
- Update cart quantities.
- Remove individual items.
- Clear the cart.
- Calculate totals on the server.
- Apply GST calculations.

**Wishlist**
- Save interesting books for later.
- View saved books.
- Remove books from the wishlist.

Cart and wishlist information is stored independently for each customer.

### 4. Book Borrowing System

The borrowing system follows defined business rules rather than allowing unlimited borrowing.

- Borrow available books.
- Track active and previous loans.
- Maintain borrowing history.
- Support book returns.
- Track loan duration and overdue status.

**Current borrowing rules:**
- Maximum two loans per calendar month.
- Standard borrowing duration of 30 days.
- Returning a book early does not restore the monthly borrowing slot.

These rules are managed through the application's business configuration.

### 5. Reading Progress and Monthly Challenges

BookNest also helps users maintain their reading habits.

- Personal reading list.
- Save and update reading progress.
- Continue from the previously saved reading position.
- Monthly reading challenges.
- Track reading targets.
- Maintain monthly completion history.

Reading completion records are stored separately so historical monthly challenge credits are preserved.

### 6. Checkout and Payment Integration

The checkout system supports different payment options.

**Demo Checkout**
- UPI
- Card
- Cash on Delivery

The standard checkout options use simulated payments. They should not be treated as real financial transactions.

**Optional Razorpay Integration**

BookNest also supports an optional Razorpay-hosted checkout integration for test-mode payment processing.

- Create Razorpay checkout orders.
- Redirect customers to the hosted checkout experience.
- Verify payment information.
- Handle signed Razorpay webhooks.
- Support administrator-authorized refunds.

Card information is handled by Razorpay Checkout and does not pass through BookNest's application.

### 7. Integrated PDF Reader

Users can read authorized digital books without leaving the application.

The reader uses PDF.js and includes:

- Page navigation.
- Zoom controls.
- Fullscreen reading.
- Saved reading position.
- Access based on purchase or active borrowing entitlement.

PDF files are stored privately and streamed through protected backend routes.

A customer can access an authorized PDF only when they have purchased the book or hold an active, non-overdue borrowing record.

### 8. Administrator Dashboard

The administrative section provides management functionality for the platform.

Administrators can:

- Manage the book catalogue.
- Add, update and delete books.
- Upload book covers.
- Upload PDF documents.
- Manage PDF distribution authorization.
- Review customer feedback.
- Access administrative functionality through role-based authorization.
- Perform supported refund operations.

### 9. Feedback System

Customers can submit feedback through the application.

- Submit feedback.
- Store feedback in MongoDB.
- View personal feedback.
- Allow administrators to review all customer feedback.

---

##  Technology Stack

BookNest uses a traditional frontend with a REST-based backend architecture.

| Component | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Styling | Custom CSS |
| Backend | Node.js |
| Server Framework | Express.js |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Authentication | JWT |
| Password Security | bcrypt |
| Session Management | HttpOnly Cookies |
| PDF Reading | PDF.js |
| File Uploads | Multer |
| Payment Integration | Razorpay |
| Email Configuration | SMTP |
| API Testing | Postman |
| Automated Testing | Jest, Supertest |
| Security | Helmet, CORS, express-rate-limit |
| Validation | express-validator |
| Environment Management | dotenv |
| Development | Nodemon |

---

## 🏗️ Project Architecture

BookNest follows an MVC-based backend architecture combined with REST APIs and service-layer functionality.

The frontend communicates with the Express backend through HTTP requests. Business operations are processed by the backend, while MongoDB stores application data.

### Application Flow

```text
                 USER
                   |
                   v
          BOOKNEST FRONTEND
           HTML / CSS / JS
                   |
                   v
             API LAYER
          Fetch + REST APIs
                   |
                   v
          EXPRESS.JS SERVER
                   |
          -------------------
          |         |       |
          v         v       v
     Middleware  Routes  Controllers
          |         |       |
          -------------------
                   |
                   v
              SERVICES
          ----------------
          |      |       |
        Cart   PDF    JSON Data
       Totals Access  Management
          ----------------
                   |
                   v
              MONGOOSE
                   |
                   v
              MONGODB
```

### Backend Architecture

**Models**

Define database schemas, relationships, validation and indexes.

**Controllers**

Process incoming requests and return appropriate HTTP responses.

**Routes**

Organise the application's REST API endpoints.

**Middleware**

Handle authentication, authorization, validation, file uploads and error processing.

**Services**

Contain reusable business logic, including cart calculations, PDF entitlements and JSON data loading.

---

## 📁 Project Structure

```text
BookNestProject/
│
├── _backup_original_frontend/
│
├── css/
│   └── Stylesheets
│
├── html/
│   ├── Home and catalogue pages
│   ├── Login and registration pages
│   ├── Cart and wishlist pages
│   ├── Library and reading pages
│   ├── Orders and profile pages
│   ├── Admin dashboard
│   └── PDF reader
│
├── js/
│   ├── api.js
│   ├── common.js
│   ├── script.js
│   ├── pages.js
│   └── reader.js
│
├── server/
│   └── src/
│       ├── config/
│       │   ├── env.js
│       │   └── db.js
│       │
│       ├── models/
│       ├── controllers/
│       ├── routes/
│       ├── middleware/
│       ├── services/
│       │
│       ├── data/
│       │   ├── books.json
│       │   ├── categories.json
│       │   ├── businessRules.json
│       │   └── siteContent.json
│       │
│       ├── seed/
│       │   └── seed.js
│       │
│       ├── uploads/
│       │   ├── pdfs/
│       │   ├── covers/
│       │   ├── profiles/
│       │   └── samples/
│       │
│       ├── app.js
│       └── server.js
│
├── postman/
│   ├── BookNest.postman_collection.json
│   └── BookNest.postman_environment.json
│
├── tests/
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── BACKEND_DEMONSTRATION.md
```

The `_backup_original_frontend/` directory contains a copy of the starting frontend. It is retained as a reference and is not used by the application.

---

## 🗄️ Database Design

MongoDB Atlas is used as the primary database.

The application organises its information into separate collections.

| Collection | Purpose |
|---|---|
| Users | Customer and administrator accounts |
| Books | Book catalogue |
| Categories | Book categories |
| Carts | Individual customer carts |
| Wishlists | Saved books |
| Borrowings | Borrowing and return records |
| ReadingProgress | Reading positions and progress |
| ReadingCompletions | Monthly reading completion history |
| Orders | Purchase and checkout records |
| Feedback | Customer feedback |

### Data Integrity

BookNest uses Mongoose schemas, validation, references and database indexes to maintain consistency.

Important implementation details include:

- Customer-owned records are associated with their respective accounts.
- Reading completion records have a unique user-book-month index.
- Catalogue data is managed through JSON seed files.
- Database seeding uses upserts based on book slugs.
- Existing customer information is preserved during catalogue updates.

---

## 🔌 REST API Overview

The Express backend exposes REST endpoints for the application's main operations.

### Authentication

| Method | Endpoint |
|---|---|
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| GET | `/api/auth/me` |
| POST | `/api/auth/logout` |
| POST | `/api/auth/verify-email` |
| POST | `/api/auth/forgot-password` |
| POST | `/api/auth/reset-password` |
| POST | `/api/auth/change-password` |

### Users and Profiles

| Method | Endpoint |
|---|---|
| GET / PUT | `/api/users/me` |
| GET | `/api/users/me/dashboard` |
| POST / DELETE | `/api/users/me/photo` |

### Books and Catalogue

| Method | Endpoint |
|---|---|
| GET | `/api/books` |
| GET | `/api/books/:id` |
| GET | `/api/books/:id/pdf` |

### Administration

| Method | Endpoint |
|---|---|
| POST / PUT / DELETE | `/api/admin/books` |
| POST | `/api/admin/books/:id/pdf` |

### Customer Operations

| Functionality | Endpoint |
|---|---|
| Cart | `/api/cart...` |
| Wishlist | `/api/wishlist...` |
| Borrowing | `/api/borrowings...` |
| Reading | `/api/reading...` |
| Orders | `/api/orders...` |
| Feedback | `/api/feedback...` |

### Payments and Webhooks

| Method | Endpoint |
|---|---|
| POST | `/api/orders/razorpay` |
| POST | `/api/orders/:id/razorpay/verify` |
| POST | `/api/webhooks/razorpay` |

### Health Check

```http
GET /api/health
```

The health endpoint reports the Express application status and MongoDB connection status.

---

## ⚙️ Getting Started

Follow these steps to run BookNest on your local machine.

### Prerequisites

Make sure you have installed:

- Node.js 18 or later.
- npm.
- MongoDB Atlas account or a compatible MongoDB instance.
- Git.
- Visual Studio Code or another code editor.

### 1. Clone the Repository

```bash
git clone https://github.com/itsaniket2007/BookNest-Smart-Library.git
```

### 2. Open the Project

```bash
cd BookNest-Smart-Library
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a local `.env` file using the example configuration.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS/Linux:**

```bash
cp .env.example .env
```

Open `.env` and configure your local environment.

At a minimum, configure the following:

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_long_random_secret
```

SMTP and Razorpay credentials can be configured when those optional integrations are required.

Never upload your actual `.env` file or expose database credentials and API secrets publicly.

### 5. Seed the Database

```bash
npm run seed
```

This command loads the configured catalogue, categories and business rules into MongoDB.

The seeding process uses upserts so catalogue updates do not unnecessarily overwrite customer transactions or personal data.

Configure your administrator credentials before running the seed process.

### 6. Start the Development Server

```bash
npm run dev
```

The application should start at:

```text
http://localhost:5000
```

Open the address in your browser to access BookNest.

---

## 💳 Payment Configuration

Razorpay integration is optional.

To enable Razorpay test-mode checkout, configure the following environment variables:

```env
RAZORPAY_KEY_ID=your_razorpay_key_id

RAZORPAY_KEY_SECRET=your_razorpay_key_secret

RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```

Configure your Razorpay webhook to point to:

```text
https://YOUR-HOST/api/webhooks/razorpay
```

During local development, a secure public tunnel can be used to expose the webhook endpoint for testing.

Keep the Razorpay secret and webhook secret private.

Standard UPI, Card and Cash on Delivery checkout options remain simulated unless the optional payment integration is configured.

---

## 📖 PDF Reader and Copyright Protection

BookNest uses a controlled PDF access system.

Digital books are not exposed through unrestricted public file URLs.

The application checks whether a customer has the necessary entitlement before streaming a PDF.

The access process is:

1. An administrator uploads a PDF.
2. The PDF remains unavailable to customers until distribution authorization is granted.
3. The system checks the customer's purchase or active borrowing record.
4. An eligible customer can access the PDF through the protected API endpoint.

Third-party copyrighted PDFs must not be distributed without the appropriate permission.

The project includes an authorised sample PDF for classroom demonstrations.

---

## 🧪 Testing

BookNest includes automated backend testing and API testing resources.

### Automated Tests

```bash
npm test
```

The project uses:

- Jest for test execution.
- Supertest for HTTP endpoint testing.
- An in-memory MongoDB instance for database testing.

The automated tests do not require a connection to MongoDB Atlas.

### Postman Testing

The repository includes a Postman collection and environment.

To test the APIs:

1. Open Postman.
2. Import `BookNest.postman_collection.json`.
3. Import `BookNest.postman_environment.json`.
4. Select the **BookNest Local** environment.
5. Execute the health check.
6. Test book catalogue endpoints.
7. Register or log in.
8. Continue testing authenticated endpoints.

Authentication tokens are stored automatically by the configured collection.

---

## 📜 Available npm Commands

| Command | Description |
|---|---|
| `npm install` | Install project dependencies |
| `npm run dev` | Start development server using Nodemon |
| `npm start` | Start the application |
| `npm run seed` | Seed catalogue and configuration data |
| `npm test` | Run automated tests |

---

## 🔐 Security Considerations

Security and data ownership are important parts of the BookNest implementation.

The application includes:

- bcrypt password hashing.
- JWT authentication.
- HttpOnly cookies.
- Role-based access control.
- Customer ownership verification.
- Request validation.
- Helmet security headers.
- CORS configuration.
- Rate limiting.
- Protected file uploads.
- Private PDF storage.
- Signed Razorpay webhook verification.
- Hashed verification and password-reset tokens.

For production deployment, environment variables, administrator credentials, CORS settings, cookie security and upload permissions should be configured appropriately.

---

## 🔮 Future Improvements

BookNest provides a foundation that can be extended further.

Some possible improvements include:

- Real-time notifications for borrowing and orders.
- Advanced book recommendation system.
- Improved reading analytics.
- More detailed administrator reporting.
- Additional payment gateway support.
- Cloud-based file storage.
- Mobile application for Android and iOS.
- Advanced search and discovery.
- Deployment with automated CI/CD workflows.

These are potential improvements rather than claims about currently implemented functionality.

---

## 👨‍💻 Developed By

**Aniket Kumar Pathak**

B.Tech – Computer Science and Engineering  
BML Munjal University

BookNest was developed as a Web Programming project with the aim of applying frontend development, backend engineering, database management, authentication and API integration to a practical application.

The project represents the transition from designing individual webpages to developing a connected full-stack system.

---

## 📌 Project Information

| Detail | Information |
|---|---|
| Project | BookNest – Smart Library & Book Marketplace |
| Project Type | Full-Stack Web Application |
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| Architecture | MVC + REST API |
| Repository | [BookNest-Smart-Library](https://github.com/itsaniket2007/BookNest-Smart-Library) |
| Status | Active Development |

---

**BookNest — Bringing the library and bookstore experience together, one book at a time.** 📚
