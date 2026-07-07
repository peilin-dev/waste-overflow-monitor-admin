# Waste Monitor — Mobile Web App Design

Date: 2026-07-07

## Overview

Build a mobile-oriented Web App for cleaners and admins, based on the existing
`WasteMonitor-app-ui.html` prototype. Deployed to the server, accessed via
browser (Chrome mobile simulation for demos, real phone browser for production).

## Architecture

### Frontend — new `app/` directory in `waste-monitor-web` repo

```
waste-monitor-web/
└── app/
    ├── index.html      # Login page
    ├── main.html       # Main interface (5 tabs)
    ├── js/
    │   ├── api.js      # All backend API calls (fetch wrapper with auth)
    │   └── auth.js     # Token storage, login guard
    └── css/
        └── app.css     # Styles extracted from WasteMonitor-app-ui.html
```

Nginx change: add `/app/` static file serving so it doesn't fall through to
React Router's `index.html` catch-all.

### Backend — new files in `waste-overflow-monitor` repo

```
models/attendance.py
schemas/attendance.py
crud/attendance.py
routers/attendance.py
routers/upload.py
```

Plus a patch to `routers/users.py` performance endpoint for SLA field.

## Backend API Changes

### 1. Attendance

**Table: `attendance`**

| Column    | Type          | Notes                              |
|-----------|---------------|------------------------------------|
| id        | int PK        |                                    |
| user_id   | int FK→user   |                                    |
| clock_in  | datetime      | Set on clock-in                    |
| clock_out | datetime NULL | Set on clock-out                   |
| date      | date          | Unique constraint (user_id + date) |

**Endpoints:**

```
POST /api/attendance/clock-in
  Auth: any logged-in user
  Body: none
  Returns: AttendanceOut
  Errors: 400 if already clocked in today

POST /api/attendance/clock-out
  Auth: any logged-in user
  Body: none
  Returns: AttendanceOut
  Errors: 400 if no clock-in record for today

GET /api/attendance/today
  Auth: any logged-in user
  Returns: AttendanceOut | null
```

### 2. Photo Upload

```
POST /api/upload
  Auth: any logged-in user
  Body: multipart/form-data, field name "file"
  Returns: { "url": "/uploads/<uuid>.<ext>" }
  Constraints: images only (jpg/png/webp), max 5MB
```

Files stored at `/app/uploads/` inside the backend container.
Nginx proxies `/uploads/` → backend container so URLs are publicly accessible.

### 3. Performance SLA (patch existing endpoint)

`GET /api/users/{id}/performance` gains one new field:

- `on_time_rate` (float | null): percentage of completed tasks where
  `completed_at - accepted_at ≤ 2 hours`. Null if no completed tasks.

## Frontend Pages

### Auth flow
- `index.html`: login form → `POST /api/auth/login` → store token in
  `localStorage` → redirect to `main.html`
- `auth.js`: `getToken()`, `setToken()`, `logout()`, `requireAuth()` (redirect
  to `index.html` if no token)
- `api.js`: base `request()` wrapper that attaches `Authorization` header,
  handles 401 by calling `logout()`

### main.html — 5 tabs

**Tab 1 — Clock (打卡)**
- On load: `GET /api/auth/me` (show name/zone), `GET /api/attendance/today`
- Clock In button: `POST /api/attendance/clock-in`, refresh display
- Clock Out button: `POST /api/attendance/clock-out`, refresh display
- Show clock-in time, clock-out time, current time

**Tab 2 — Tasks (接单)**
- On load: `GET /api/tasks?status=pending` (all unassigned pending tasks)
- Each card shows: block, floor, sensor ID, fill %, urgency colour
- Accept button: `POST /api/tasks/{id}/accept`, remove card from list

**Tab 3 — Report (汇报)**
- On load: `GET /api/tasks?status=in_progress&cleaner_id={me.id}`
- Select active task from dropdown
- Upload photo: `POST /api/upload` → get URL → store in array
- Result selector: cleaned / damaged / false_alarm / unable
- Submit: `POST /api/tasks/{id}/report` with `{ result, photos }`

**Tab 4 — My KPI**
- On load: `GET /api/users/{me.id}/performance`
- Show: average rating (score circle), completed tasks, on_time_rate

**Tab 5 — Admin Rate**
- On load: `GET /api/tasks?status=completed`
- Each card: cleaner name, location, completion time, photo thumbnails
- Star selector (1–5) + comment input
- Submit: `POST /api/tasks/{id}/rate`
- Re-rating allowed (endpoint supports rated→re-rate)

## Deployment

1. Nginx `app/` rule added to `waste-monitor-web/nginx.conf`
2. Backend `uploads/` directory mounted as Docker volume so files persist
   across container restarts
3. Backend Nginx rule: `location /uploads/` → proxy to backend container

## Constraints & Notes

- `accept_task` endpoint checks `role == "cleaner"` — cleaner accounts must
  have role stored as exactly `"cleaner"` (lowercase)
- SLA threshold: 2 hours (adjustable in one constant in `crud/users.py`)
- Photo upload max: 5 MB per file, images only
- No pagination needed for MVP — task lists are small
