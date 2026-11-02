# uni-erp (AIECCE rebuild, MERN)

MongoDB + Express + React (Vite, TypeScript) + Node.

## Run locally

Backend (`uni-erp-backend`):

```
npm install
cp .env.example .env     # set JWT_SECRET and MONGO_URI
npm run seed             # dev accounts: admin / center1001 (see src/seed.js)
npm run dev              # http://localhost:5000
```

Frontend (`uni-erp-frontend`):

```
npm install
npm run dev              # http://localhost:5173, /api is proxied to :5000
```

## What exists

- Login (`POST /api/auth/login`, JWT) with two roles: `admin` (head office) and `center` (scoped to its own center).
- Dashboard tiles and analytics counters (`GET /api/dashboard`).
- Student Registration: list by session with search and pagination, create, update, soft delete (`/api/students`).
- Center Details: list and admin CRUD (`/api/centers`).
- Models for courses, course types and marks.

## Not built yet

Registration form UI, Employee Details, Fill Exam Form, Mark Information UI, Certificate / ID Card / Admit Card printing, Publish Result, Book Allocated, Stock Details, Change Password UI, and the Miscellaneous master-data screens.
