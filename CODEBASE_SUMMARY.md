# Codebase Summary — Student-Teacher Portal (Three-Tier Application)

---

## 1. Repository File Map and What Each File Does

```
/
├── README.md                          Project overview, architecture diagram, Docker deployment steps
├── package.json                       Root-level package: only dependency is react-icons ^5.5.0
├── package-lock.json                  Root lock file
├── .gitignore                         Excludes node_modules and AL project cache files
├── LICENSE                            Project license
├── docker-compose.yaml                Orchestrates db → backend → frontend containers
├── assets/
│   └── Infra.gif                      Architecture diagram used in README
│
├── backend/
│   ├── server.js                      Express app: SSM fetch → DB connect → table creation → routes
│   ├── package.json                   Backend npm dependencies
│   ├── package-lock.json              Backend lock file
│   ├── .env                           Local dev DB credentials (NOT committed in production)
│   ├── Dockerfile                     Multi-stage production build (node:18-alpine, non-root user)
│   └── Dockerfile-NBP                 Single-stage non-best-practices alternative (node:14)
│
├── database/
│   ├── Dockerfile                     MySQL 9.5.0-oraclelinux9 with school DB and volume
│   └── Dockerfile-NBP                 mysql:latest alternative (less pinned)
│
└── frontend/
    ├── package.json                   Frontend npm dependencies
    ├── package-lock.json              Frontend lock file
    ├── .env                           Sets REACT_APP_API_BASE_URL=/api (Nginx proxy path)
    ├── .env.example                   Template showing http://localhost:5000 default
    ├── Dockerfile                     Multi-stage: node:21-alpine build → nginx:1.25.3-alpine serve
    ├── Dockerfile-BP                  Identical to Dockerfile (alternative name)
    ├── nginx.conf                     Nginx reverse proxy: /api/* → backend:3500, / → React SPA
    ├── README.md                      Standard Create React App documentation
    │
    ├── public/
    │   ├── index.html                 HTML shell; sets page title "Student–Teacher Portal"
    │   ├── manifest.json              PWA manifest (still has CRA default values)
    │   ├── favicon.ico                App favicon
    │   ├── robots.txt                 Standard allow-all robots directive
    │   ├── logo192.png                PWA icon 192px
    │   └── logo512.png                PWA icon 512px
    │
    └── src/
        ├── index.js                   React root — wraps App in HelmetProvider
        ├── App.js                     Root component: ChakraProvider + Router + Navbar + Footer
        ├── Routes.js                  Defines 3 routes: /, /student, /teacher
        ├── Home.js                    Landing page with two navigation buttons
        ├── Student.js                 Student CRUD page (fetch/add/delete via native fetch API)
        ├── Teacher.js                 Teacher CRUD page (mirrors Student.js)
        ├── theme.js                   Chakra UI theme: system color mode, Inter font
        ├── index.css                  Global body/font baseline styles
        ├── App.css                    CRA default styles (logo spin animation)
        ├── Home.css                   Full-screen bg image, button styles, bounce animation
        ├── Student.css                Student page bg, table, form, delete button styles
        ├── Teacher.css                Teacher page bg, form, table styles
        │
        ├── services/
        │   └── api.js                 Exports API_BASE_URL from process.env; not used by pages yet
        │
        ├── config/
        │   └── socialLinks.js         Commented-out social link config; currently inactive
        │
        └── components/
            ├── Navbar.jsx             Sticky header: links to /, /student, /teacher; dark-mode toggle
            ├── Footer.jsx             Footer with copyright and social icon links (Chakra UI + inline SVG)
            ├── ToastProvider.jsx      Renders react-toastify ToastContainer (top-right, 2500ms)
            ├── ErrorBoundary.jsx      Class component that catches render errors and shows a message
            ├── LoadingSpinner.jsx     Centered Chakra Spinner shown while API calls are in-flight
            └── EmptyState.jsx         Centered message shown when a table has no rows
```

---

## 2. Backend Routes (server.js)

All routes live directly in `server.js` with no router files.

| Method | Path | Handler summary |
|--------|------|-----------------|
| GET | `/` | `SELECT * FROM student`; returns `{ message, data }` — health-check endpoint |
| GET | `/student` | `SELECT * FROM student`; returns array of row objects |
| GET | `/teacher` | `SELECT * FROM teacher`; returns array of row objects |
| POST | `/addstudent` | Body: `{ name, rollNo, class }` → `INSERT INTO student (name, roll_number, class)` |
| POST | `/addteacher` | Body: `{ name, subject, class }` → `INSERT INTO teacher (name, subject, class)` |
| DELETE | `/student/:id` | `DELETE FROM student WHERE id = ?`; 404 if no rows affected |
| DELETE | `/teacher/:id` | `DELETE FROM teacher WHERE id = ?`; 404 if no rows affected |

**Error handling:** Only the DELETE routes have try/catch; GET and POST routes have no explicit error handling.

**Port:** Hardcoded to `3500` (not read from `process.env.PORT`).

---

## 3. Frontend Pages

### `Home.js` (`/`)
- Renders a centered heading "Welcome to Student–Teacher Portal"
- Two `<Button>` components act as `<RouterLink>` to `/student` and `/teacher`
- Sets `<title>` via react-helmet-async

### `Student.js` (`/student`)
- **State:** `studentData` (form fields), `data` (table rows), `loading` flag
- **On mount:** calls `getData()` → `GET {API_BASE_URL}/student`
- **Add form:** collects `name`, `rollNo`, `class` → `POST {API_BASE_URL}/addstudent`
- **Delete:** `DELETE {API_BASE_URL}/student/{id}`; refreshes list afterward
- **Display:** Chakra UI Table with flexible key resolution (handles `roll_number`, `rollNo`, `rollno`, etc.)
- **Feedback:** Chakra `useToast()` for success/error messages; `LoadingSpinner` during fetch; `EmptyState` when empty

### `Teacher.js` (`/teacher`)
- Mirrors `Student.js` exactly, using subject instead of rollNo
- Form fields: `name`, `subject`, `class`
- Table columns: Teacher ID (from `id`/`_id`), Name, Subject, Class, Actions

---

## 4. How SSM Credential Fetching Works in `server.js`

```
startup
  └─ connectWithRetry(retries=10, delay=3000ms)
       └─ getDBConfig()                          ← SSM call
            ├─ Creates SSMClient with region from AWS_REGION env (default "us-east-1")
            ├─ Sends GetParametersCommand with Names:
            │    /myapp/db/host
            │    /myapp/db/user
            │    /myapp/db/password
            │    /myapp/db/name
            │  WithDecryption: true  (supports SecureString params)
            ├─ Maps response: key = last path segment (host/user/password/name)
            └─ Throws if any of the four values is missing
       └─ ensureDatabaseExists(config)           ← Creates DB if not present
            ├─ Opens a no-database connection
            └─ Runs: CREATE DATABASE IF NOT EXISTS `{name}`
       └─ mysql.createPool(...)                  ← Pool with ssl.rejectUnauthorized=false
            └─ Returns pool; stored in module-level `db` variable
  └─ ensureTables(db)                            ← Idempotent DDL
       ├─ CREATE TABLE IF NOT EXISTS student (...)
       └─ CREATE TABLE IF NOT EXISTS teacher (...)
  └─ app.listen(3500)
```

**Key detail:** If SSM is unreachable (e.g., local dev without AWS credentials), the server will retry 10 times over ~30 seconds then crash. The backend `.env` file has fallback values (`host`, `user`, `password`, `database`) but `dotenv` is listed as a dependency yet **`require('dotenv').config()` is never called** in `server.js` — so `.env` values are only available if injected via docker-compose environment keys.

---

## 5. How the Frontend Calls the Backend API

**Configuration:**
- `frontend/.env` sets `REACT_APP_API_BASE_URL=/api`
- This value is baked into the React bundle at build time via CRA

**Request path (production with Docker):**
```
Browser
  → GET /api/student
  → Nginx (port 80) matches location ^~ /api/
  → Strips /api prefix (proxy_pass http://127.0.0.1:3500/)
  → Backend receives GET /student
```

**In Student.js and Teacher.js:**
```javascript
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;  // "/api"
fetch(`${API_BASE_URL}/student`)    // → GET /api/student → backend GET /student
fetch(`${API_BASE_URL}/addstudent`, { method: 'POST', ... })
fetch(`${API_BASE_URL}/student/${id}`, { method: 'DELETE' })
```

**HTTP client:** Native browser `fetch()` — axios is installed but not used in any page component.

**Note:** `services/api.js` exports `API_BASE_URL` but it is **not imported** by Student.js or Teacher.js. Both pages read `process.env.REACT_APP_API_BASE_URL` directly.

---

## 6. NPM Packages Currently Installed

### Backend (`backend/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-ssm` | ^3.962.0 | Fetch DB credentials from AWS Parameter Store |
| `cors` | ^2.8.5 | Enable cross-origin requests |
| `dotenv` | ^16.3.1 | Load .env — **imported but never called** in server.js |
| `express` | ^4.18.2 | HTTP server framework |
| `mysql2` | ^3.6.0 | MySQL driver with promise support |
| `nodemon` | ^3.0.1 | Auto-restart during development |
| `pm2` | ^5.3.0 | Process manager — listed but not used in current server.js |

### Frontend (`frontend/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `@chakra-ui/icons` | ^2.2.4 | Icon library for Chakra UI |
| `@chakra-ui/react` | ^2.8.2 | Component library (all UI elements) |
| `@emotion/react` | ^11.13.0 | CSS-in-JS runtime (Chakra peer dep) |
| `@emotion/styled` | ^11.13.0 | Styled components (Chakra peer dep) |
| `@hookform/resolvers` | ^3.9.0 | Yup resolver for react-hook-form |
| `axios` | ^1.7.2 | HTTP client — **installed but not used** |
| `classnames` | ^2.5.1 | Conditional CSS class names — **installed but not used** |
| `framer-motion` | ^11.2.6 | Animation library (Chakra peer dep) |
| `pm2` | ^6.0.13 | Process manager — **installed but not used** in frontend |
| `react` | ^18.2.0 | UI library |
| `react-dom` | ^18.2.0 | React DOM renderer |
| `react-helmet-async` | ^2.0.5 | Manage `<head>` tags (page titles) |
| `react-hook-form` | ^7.52.0 | Form state management — **installed but not used** |
| `react-router-dom` | ^6.15.0 | Client-side routing |
| `react-scripts` | ^5.0.1 | CRA build toolchain |
| `react-toastify` | ^10.0.5 | Toast notifications (used in ToastProvider) |
| `web-vitals` | ^2.1.4 | Performance metrics reporting |
| `yup` | ^1.4.0 | Schema validation — **installed but not used** |

### Dev Dependencies (Frontend)

| Package | Version | Purpose |
|---------|---------|---------|
| `eslint` | ^8.57.0 | Linter |
| `eslint-config-react-app` | ^7.0.1 | CRA ESLint rules |
| `prettier` | ^3.3.3 | Code formatter |

### Root (`package.json`)
| Package | Version | Purpose |
|---------|---------|---------|
| `react-icons` | ^5.5.0 | Icon library — installed at root, not used in src/ |

---

## 7. Database Tables

**Database name:** `school`

### `student`
```sql
CREATE TABLE IF NOT EXISTS student (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255),
  roll_number VARCHAR(255),
  class       VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `teacher`
```sql
CREATE TABLE IF NOT EXISTS teacher (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255),
  subject    VARCHAR(255),
  class      VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Both tables are created automatically on server startup via `ensureTables()`. There are no migration files, seed files, or schema version tracking.

---

## 8. Environment Variables Currently Needed

### Backend

| Variable | Source | Value in docker-compose | Purpose |
|----------|--------|------------------------|---------|
| `AWS_REGION` | process.env | (not set — defaults to `"us-east-1"`) | AWS region for SSM client |
| `host` | docker-compose env | `db` | DB host (overridden by SSM in production) |
| `user` | docker-compose env | `root` | DB user (overridden by SSM in production) |
| `password` | docker-compose env | `mysql123` | DB password (overridden by SSM in production) |
| `database` | docker-compose env | `school` | DB name (overridden by SSM in production) |

**Important:** The backend reads DB credentials exclusively from SSM. The docker-compose `environment` block sets `host/user/password/database` but `dotenv` is never initialized, so those values are only accessible as OS-level environment variables (which docker-compose does inject). However, `server.js` never reads `process.env.host` etc. — it always calls `getDBConfig()` → SSM.

### Frontend

| Variable | Source | Value | Purpose |
|----------|--------|-------|---------|
| `REACT_APP_API_BASE_URL` | `.env` / build arg | `/api` (prod) or `http://localhost:3500` (dev) | Base URL for all API fetch calls |
| `NODE_ENV` | docker-compose env | `production` | CRA environment mode |
