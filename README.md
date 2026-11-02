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

## Settings (Miscellaneous)

Course Type, Course Details, Subject Details, User Role, Financial year, State, City, Menu and Sub Menu are all editable in the app.
Run `npm run seed` after pulling to load the default states, financial years, menus and roles (existing settings are kept).
A role's *base role* decides what the API allows; its *menus* decide what shows in the sidebar.

## Importing the old database (MySQL dump)

```
cd uni-erp-backend
npm run seed                                   # once: creates the roles and settings the import needs
npm run import-sql -- path/to/dump.sql         # dry run: reports what would be imported, writes nothing
npm run import-sql -- path/to/dump.sql --apply # imports into the database in MONGO_URI
```

- Add `--replace` to import again; it removes only records that came from an earlier import.
- It stops if the database already holds students or exams entered in the app.
- Passwords from the old data are never imported. Each user gets a new random password, written to
  `import-output/new-passwords.csv` (git-ignored). Hand them out, then delete the file.
- `import-output/needs-attention.csv` lists students that would not pass today's entry rules (for example a mobile number
  that is not 10 digits). They are imported as they are so nothing is lost; fix them as you go.
- `import-output/duplicate-enrollments.csv` lists enrollment numbers that two students shared. The second student of each pair
  gets `-2` added so numbers stay unique.
- Never commit the `.sql` file or `import-output/`; both contain personal data (they are git-ignored).
- `npm run import-selftest -- path/to/dump.sql` checks the whole import against an in-memory fake database.

## What exists

- Login (`POST /api/auth/login`, JWT) with two roles: `admin` (head office) and `center` (scoped to its own center).
- Dashboard tiles and analytics counters (`GET /api/dashboard`).
- Student Registration: list by session with search and pagination, create, update, soft delete (`/api/students`).
- Center Details: list and admin CRUD (`/api/centers`).
- Models for courses, course types and marks.

## Not built yet

Registration form UI, Employee Details, Fill Exam Form, Mark Information UI, Certificate / ID Card / Admit Card printing, Publish Result, Book Allocated, Stock Details, Change Password UI, and the Miscellaneous master-data screens.
