# Waste Monitor Mobile Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add attendance/upload/SLA APIs to the FastAPI backend, then build a 5-tab vanilla-JS mobile Web App served at `/app/` by Nginx.

**Architecture:** Backend-first (Tasks 1–4), then frontend (Tasks 5–10). Frontend is pure HTML/CSS/JS ES modules — no build step. Deployed alongside the existing React admin panel under the same Nginx container.

**Tech Stack:** Python 3.11 / FastAPI / SQLAlchemy 2 async / MySQL (backend); Vanilla HTML + CSS + JS ES modules (frontend); Docker + Nginx (deployment).

## Global Constraints

- Backend repo root: `E:\project\waste-overflow-monitor`
- Frontend repo root: `E:\front\waste-monitor-web`
- All backend routes prefixed `/api/`
- JWT header: `Authorization: Bearer <token>` on every request
- `accept_task` checks `role == "cleaner"` (exact lowercase string)
- SLA threshold: 2 hours = 7200 seconds
- Upload: jpg/png/webp only, max 5 MB
- Uploads stored at `/app/uploads/` inside backend container, served at `/uploads/`
- SQLAlchemy model pattern: `Mapped[T]` / `mapped_column(...)` from SQLAlchemy 2
- Async CRUD pattern: `await db.execute(select(...))`, `db.add()`, `await db.commit()`, `await db.refresh()`
- Design spec: `docs/superpowers/specs/2026-07-07-waste-monitor-app-design.md`

---

## File Map

**Backend — create:**
- `models/attendance.py` — Attendance ORM model
- `schemas/attendance.py` — Pydantic AttendanceOut schema
- `crud/attendance.py` — get_today, clock_in, clock_out
- `routers/attendance.py` — GET /today, POST /clock-in, POST /clock-out

**Backend — create:**
- `routers/upload.py` — POST /api/upload (multipart → save → return URL)

**Backend — modify:**
- `schemas/user.py` — add `on_time_rate: Optional[float]` to UserPerformance
- `routers/users.py` — compute SLA in user_performance endpoint
- `main.py` — import attendance model, register attendance + upload routers, mount StaticFiles
- `docker-compose.yml` — add `uploads_data` volume for backend

**Frontend — create:**
- `app/css/app.css` — shared mobile styles (extracted from prototype)
- `app/js/auth.js` — token helpers, requireAuth, logout
- `app/js/api.js` — fetch wrapper + all endpoint functions
- `app/index.html` — login page
- `app/main.html` — 5-tab main interface

**Frontend — modify:**
- `nginx.conf` — add `/app/` static serving + `/uploads/` proxy to backend

---

## Task 1: Attendance model + schema

**Files:**
- Create: `models/attendance.py`
- Create: `schemas/attendance.py`
- Modify: `main.py` lines 15–16 (add attendance to model import list)

**Interfaces:**
- Produces: `Attendance` ORM class (used by Task 2 CRUD), `AttendanceOut` Pydantic model (used by Task 2 router)

- [ ] **Step 1: Create `models/attendance.py`**

```python
"""Attendance ORM model — maps to MySQL 'attendance' table."""

from datetime import date, datetime
from typing import Optional
from sqlalchemy import Integer, ForeignKey, DateTime, Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_attendance_user_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id"), nullable=False, index=True
    )
    clock_in: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    clock_out: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
```

- [ ] **Step 2: Create `schemas/attendance.py`**

```python
"""Pydantic schemas for Attendance."""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AttendanceOut(BaseModel):
    id: int
    user_id: int
    clock_in: datetime
    clock_out: Optional[datetime]
    date: date

    model_config = ConfigDict(from_attributes=True)
```

- [ ] **Step 3: Register model in `main.py` so SQLAlchemy creates the table**

Find line:
```python
from models import block, bin, user, cleaner_block, task, role      # noqa: F401
```
Replace with:
```python
from models import block, bin, user, cleaner_block, task, role, attendance      # noqa: F401
```

- [ ] **Step 4: Commit**

```bash
cd E:/project/waste-overflow-monitor
git add models/attendance.py schemas/attendance.py main.py
git commit -m "feat: add Attendance model and schema"
```

---

## Task 2: Attendance CRUD + router

**Files:**
- Create: `crud/attendance.py`
- Create: `routers/attendance.py`
- Modify: `main.py` (register router)

**Interfaces:**
- Consumes: `Attendance` from `models/attendance.py`, `AttendanceOut` from `schemas/attendance.py`, `get_db` from `core.database`, `get_current_user` from `core.deps`
- Produces: `GET /api/attendance/today`, `POST /api/attendance/clock-in`, `POST /api/attendance/clock-out`

- [ ] **Step 1: Create `crud/attendance.py`**

```python
"""CRUD for Attendance — clock-in/out logic."""

from datetime import date, datetime
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.attendance import Attendance


async def get_today(db: AsyncSession, user_id: int) -> Optional[Attendance]:
    result = await db.execute(
        select(Attendance).where(
            Attendance.user_id == user_id,
            Attendance.date == date.today(),
        )
    )
    return result.scalars().first()


async def clock_in(db: AsyncSession, user_id: int) -> Attendance:
    record = Attendance(
        user_id=user_id,
        clock_in=datetime.now(),
        date=date.today(),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def clock_out(db: AsyncSession, record: Attendance) -> Attendance:
    record.clock_out = datetime.now()
    await db.commit()
    await db.refresh(record)
    return record
```

- [ ] **Step 2: Create `routers/attendance.py`**

```python
"""Attendance HTTP endpoints — clock-in / clock-out."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_user
from models.user import User
from schemas.attendance import AttendanceOut
from crud import attendance as crud_attendance

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


@router.get("/today", response_model=Optional[AttendanceOut])
async def get_today(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await crud_attendance.get_today(db, current_user.id)


@router.post(
    "/clock-in",
    response_model=AttendanceOut,
    status_code=status.HTTP_201_CREATED,
)
async def clock_in(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if await crud_attendance.get_today(db, current_user.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Already clocked in today")
    return await crud_attendance.clock_in(db, current_user.id)


@router.post("/clock-out", response_model=AttendanceOut)
async def clock_out(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = await crud_attendance.get_today(db, current_user.id)
    if not record:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No clock-in record for today")
    if record.clock_out:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Already clocked out today")
    return await crud_attendance.clock_out(db, record)
```

- [ ] **Step 3: Register router in `main.py`**

Add after the existing router imports:
```python
from routers import attendance as attendance_router
```

Add after `app.include_router(roles_router.router)`:
```python
app.include_router(attendance_router.router)
```

- [ ] **Step 4: Commit**

```bash
git add crud/attendance.py routers/attendance.py main.py
git commit -m "feat: add attendance clock-in/out endpoints"
```

- [ ] **Step 5: Verify locally (optional)**

```bash
uvicorn main:app --reload
# Open http://127.0.0.1:8000/docs
# Find /api/attendance/* routes — should show GET /today, POST /clock-in, POST /clock-out
```

---

## Task 3: Photo upload endpoint

**Files:**
- Create: `routers/upload.py`
- Modify: `main.py` (import + register router + mount StaticFiles)
- Modify: `docker-compose.yml` (add uploads volume)

**Interfaces:**
- Produces: `POST /api/upload` → `{ "url": "/uploads/<uuid>.<ext>" }`, static files served at `/uploads/`

- [ ] **Step 1: Create `routers/upload.py`**

```python
"""Photo upload endpoint — saves file to /app/uploads/, returns public URL."""

import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from core.deps import get_current_user
from models.user import User

UPLOAD_DIR = Path("/app/uploads")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only jpg/png/webp images allowed")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "File too large (max 5 MB)")
    ext = (file.filename or "file").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / filename).write_bytes(content)
    return {"url": f"/uploads/{filename}"}
```

- [ ] **Step 2: Update `main.py` — add upload router + StaticFiles mount**

Add import:
```python
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from routers import upload as upload_router
```

After `app.include_router(attendance_router.router)` add:
```python
app.include_router(upload_router.router)

# Serve uploaded photos
Path("/app/uploads").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")
```

- [ ] **Step 3: Add uploads volume to `docker-compose.yml`**

Find the `backend:` service block. Add volumes:
```yaml
  backend:
    image: ghcr.io/peilin-dev/waste-overflow-monitor:latest
    container_name: waste_backend
    environment:
      DATABASE_URL: mysql+aiomysql://${DB_USER}:${DB_PASSWORD}@db:3306/waste_monitor
      SECRET_KEY: ${SECRET_KEY}
      CORS_ORIGINS: '["*"]'
      DEBUG: "false"
    volumes:
      - uploads_data:/app/uploads
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
```

At the bottom `volumes:` section add:
```yaml
volumes:
  mysql_data:
  uploads_data:
```

- [ ] **Step 4: Commit**

```bash
git add routers/upload.py main.py docker-compose.yml
git commit -m "feat: add photo upload endpoint and uploads volume"
```

---

## Task 4: SLA field in performance endpoint

**Files:**
- Modify: `schemas/user.py` — add `on_time_rate` to UserPerformance
- Modify: `routers/users.py` — compute SLA in `user_performance`

**Interfaces:**
- Consumes: `Task.accepted_at`, `Task.completed_at` (already on Task model)
- Produces: `GET /api/users/{id}/performance` now returns `on_time_rate: float | null`

- [ ] **Step 1: Add `on_time_rate` to `UserPerformance` in `schemas/user.py`**

Find:
```python
class UserPerformance(BaseModel):
    """Cleaner performance metrics."""
    user_id: int
    name: str
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    average_rating: Optional[float]
    rating_distribution: Dict[str, int]
```
Replace with:
```python
class UserPerformance(BaseModel):
    """Cleaner performance metrics."""
    user_id: int
    name: str
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    average_rating: Optional[float]
    rating_distribution: Dict[str, int]
    on_time_rate: Optional[float]
```

- [ ] **Step 2: Compute SLA in `routers/users.py` `user_performance` function**

At the top of `routers/users.py`, add after existing imports:
```python
SLA_SECONDS = 7200  # 2 hours
```

Inside the `user_performance` function, just before the `return {` statement, add:

```python
    sla_rows = await db.execute(
        select(Task.accepted_at, Task.completed_at).where(
            Task.cleaner_id == user_id,
            Task.status.in_(["completed", "rated"]),
            Task.accepted_at.isnot(None),
            Task.completed_at.isnot(None),
        )
    )
    sla_data = sla_rows.all()
    if sla_data:
        on_time = sum(
            1 for a, c in sla_data
            if (c - a).total_seconds() <= SLA_SECONDS
        )
        on_time_rate = round(on_time / len(sla_data) * 100, 1)
    else:
        on_time_rate = None
```

Then add `"on_time_rate": on_time_rate,` to the return dict:
```python
    return {
        "user_id": user.id,
        "name": user.name,
        "total_tasks": total or 0,
        "completed_tasks": completed or 0,
        "pending_tasks": pending or 0,
        "average_rating": float(avg_rating) if avg_rating else None,
        "rating_distribution": distribution,
        "on_time_rate": on_time_rate,
    }
```

- [ ] **Step 3: Commit and push backend**

```bash
git add schemas/user.py routers/users.py
git commit -m "feat: add on_time_rate SLA field to performance endpoint"
git push
```

Expected: GitHub Actions triggers backend deploy. Takes ~5–10 min.

---

## Task 5: Nginx config + `auth.js` + `api.js`

**Files:**
- Modify: `nginx.conf` (frontend repo)
- Create: `app/js/auth.js`
- Create: `app/js/api.js`

**Interfaces:**
- Produces:
  - `/app/` serves static files from `/usr/share/nginx/html/app/`
  - `/uploads/` proxies to `http://backend:8000/uploads/`
  - `auth.js` exports: `getToken`, `setToken`, `getUser`, `setUser`, `logout`, `requireAuth`
  - `api.js` exports: `login`, `getMe`, `getBlocks`, `getToday`, `clockIn`, `clockOut`, `getTasks`, `acceptTask`, `reportTask`, `rateTask`, `getPerformance`, `uploadFile`

- [ ] **Step 1: Update `nginx.conf`**

Add these two blocks inside the `server { }` block, before the closing `}`:

```nginx
    # Mobile app — serve static files from /app/ subdirectory
    location /app/ {
        alias /usr/share/nginx/html/app/;
    }

    # Uploaded photos — proxy to backend StaticFiles mount
    location /uploads/ {
        proxy_pass http://backend:8000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
```

- [ ] **Step 2: Create `app/js/auth.js`**

```javascript
export const getToken = () => localStorage.getItem('wm_token');
export const setToken = t => localStorage.setItem('wm_token', t);
export const getUser = () => JSON.parse(localStorage.getItem('wm_user') || 'null');
export const setUser = u => localStorage.setItem('wm_user', JSON.stringify(u));

export const logout = () => {
    localStorage.removeItem('wm_token');
    localStorage.removeItem('wm_user');
    window.location.href = '/app/';
};

export const requireAuth = () => {
    if (!getToken()) window.location.href = '/app/';
};
```

- [ ] **Step 3: Create `app/js/api.js`**

```javascript
import { getToken, logout } from './auth.js';

const BASE = '/api';

async function req(method, path, body = null) {
    const token = getToken();
    const opts = { method, headers: {} };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(BASE + path, opts);
    // Skip logout redirect for the login endpoint itself (wrong credentials also return 401)
    if (res.status === 401 && path !== '/auth/login') { logout(); return; }
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Request failed');
    return data;
}

export const login    = (username, password) => req('POST', '/auth/login', { username, password });
export const getMe    = () => req('GET', '/auth/me');
export const getBlocks = () => req('GET', '/blocks');

export const getToday  = () => req('GET', '/attendance/today');
export const clockIn   = () => req('POST', '/attendance/clock-in');
export const clockOut  = () => req('POST', '/attendance/clock-out');

export const getTasks   = (params = {}) => {
    const q = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return req('GET', '/tasks' + (q ? '?' + q : ''));
};
export const acceptTask = id => req('POST', `/tasks/${id}/accept`);
export const reportTask = (id, result, photos) =>
    req('POST', `/tasks/${id}/report`, { result, photos });
export const rateTask   = (id, rating, comment) =>
    req('POST', `/tasks/${id}/rate`, { rating, comment });

export const getPerformance = id => req('GET', `/users/${id}/performance`);

export async function uploadFile(file) {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
}
```

- [ ] **Step 4: Commit**

```bash
cd E:/front/waste-monitor-web
git add nginx.conf app/js/auth.js app/js/api.js
git commit -m "feat: add nginx app route, auth.js and api.js modules"
```

---

## Task 6: Login page + shared CSS

**Files:**
- Create: `app/css/app.css`
- Create: `app/index.html`

**Interfaces:**
- Consumes: `auth.js` (getToken, setToken, setUser), `api.js` (login, getMe)
- Produces: login page at `/app/` — on success stores token+user, redirects to `/app/main.html`

- [ ] **Step 1: Create `app/css/app.css`**

```css
:root {
    --primary-blue: #3B82F6;
    --pale-blue: #EFF6FF;
    --light-blue: #DBEAFE;
    --white: #FFFFFF;
    --text-dark: #1E293B;
    --text-gray: #64748B;
    --danger-red: #EF4444;
    --success-green: #10B981;
    --warning-orange: #F59E0B;
}

* { box-sizing: border-box; margin: 0; padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

body { background: #E2E8F0; display: flex; justify-content: center;
       align-items: center; min-height: 100vh; padding: 20px; }

.mobile-frame {
    width: 390px; height: 844px; background: #F8FAFC;
    border-radius: 40px; border: 8px solid #1E293B;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    display: flex; flex-direction: column; overflow: hidden; position: relative;
}

.status-bar { height: 44px; display: flex; justify-content: space-between;
    align-items: center; padding: 0 20px; font-size: 14px;
    font-weight: 600; color: var(--text-dark); background: var(--white); z-index: 10; }

.header-section { background: var(--white); padding: 20px;
    border-bottom-left-radius: 20px; border-bottom-right-radius: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.03); margin-bottom: 16px; }

.card { background: var(--white); margin: 0 16px 14px; border-radius: 16px;
    padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    border: 1px solid rgba(59,130,246,0.08); }

.btn-primary { width: 100%; background: var(--primary-blue); color: white;
    border: none; padding: 14px; border-radius: 12px; font-size: 16px;
    font-weight: 600; cursor: pointer; display: flex; justify-content: center;
    align-items: center; gap: 8px; margin-top: 10px; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-success { background: var(--success-green); }
.btn-danger  { background: var(--danger-red); }

.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 13px; font-weight: 600;
    color: var(--text-dark); margin-bottom: 6px; }
.form-group input, .form-group select {
    width: 100%; border: 1px solid #CBD5E1; border-radius: 10px;
    padding: 12px; font-size: 14px; background: var(--white); outline: none; }

.bottom-nav { position: absolute; bottom: 0; left: 0; width: 100%;
    background: var(--white); height: 80px; display: flex;
    border-top: 1px solid #E2E8F0; z-index: 100;
    border-bottom-left-radius: 32px; border-bottom-right-radius: 32px;
    padding-bottom: 12px; }

.nav-btn { flex: 1; display: flex; flex-direction: column; justify-content: center;
    align-items: center; color: var(--text-gray); background: none; border: none;
    cursor: pointer; font-size: 10px; font-weight: 600; gap: 3px; }
.nav-btn i { font-size: 20px; }
.nav-btn.active { color: var(--primary-blue); }

.content-area { flex: 1; overflow: hidden; position: relative; }
.page { position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    display: none; overflow-y: auto; padding-bottom: 90px; }
.page.active { display: block; }

.bar-bg { height: 8px; background: #F1F5F9; border-radius: 4px; margin: 8px 0; }
.bar-fill { height: 100%; border-radius: 4px; }

.badge { display: inline-block; padding: 2px 8px; border-radius: 10px;
    font-size: 11px; font-weight: 700; }

.star { font-size: 22px; color: #CBD5E1; cursor: pointer; }
.star.active { color: var(--warning-orange); }

.upload-area { border: 2px dashed #CBD5E1; border-radius: 12px; height: 100px;
    display: flex; flex-direction: column; justify-content: center;
    align-items: center; color: var(--text-gray); background: #F8FAFC;
    cursor: pointer; gap: 6px; }

.score-circle { width: 130px; height: 130px; border-radius: 50%;
    border: 8px solid var(--primary-blue); margin: 16px auto;
    display: flex; flex-direction: column; justify-content: center;
    align-items: center; background: var(--pale-blue); }

.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
.stat-box { background: #F1F5F9; padding: 14px; border-radius: 12px; text-align: center; }

.photo-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
.photo-thumb { width: 60px; height: 60px; border-radius: 8px; object-fit: cover;
    border: 1px solid #E2E8F0; }
```

- [ ] **Step 2: Create `app/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SWOMS</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="css/app.css">
</head>
<body>
<div class="mobile-frame">
    <div class="status-bar">
        <span id="sb-time">09:41</span>
        <div style="display:flex;gap:5px">
            <i class="fa-solid fa-signal"></i>
            <i class="fa-solid fa-wifi"></i>
            <i class="fa-solid fa-battery-full"></i>
        </div>
    </div>

    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:28px 22px;">
        <div style="text-align:center;margin-bottom:36px;">
            <div style="width:68px;height:68px;background:var(--pale-blue);border-radius:18px;
                        display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
                <i class="fa-solid fa-trash-can" style="font-size:30px;color:var(--primary-blue)"></i>
            </div>
            <h1 style="font-size:22px;font-weight:700;color:var(--text-dark);margin-bottom:4px;">SWOMS</h1>
            <p style="color:var(--text-gray);font-size:13px;">Smart Waste Overflow Monitoring</p>
        </div>

        <div id="err" style="display:none;background:#FEE2E2;color:#DC2626;
             padding:10px 14px;border-radius:10px;font-size:13px;margin-bottom:14px;"></div>

        <div class="form-group">
            <label>Username</label>
            <input type="text" id="username" placeholder="Enter username" autocomplete="username">
        </div>
        <div class="form-group">
            <label>Password</label>
            <input type="password" id="password" placeholder="Enter password" autocomplete="current-password">
        </div>
        <button class="btn-primary" id="login-btn">
            <i class="fa-solid fa-right-to-bracket"></i> Sign In
        </button>
    </div>
</div>

<script type="module">
import { setToken, setUser, getToken } from './js/auth.js';
import { login, getMe } from './js/api.js';

if (getToken()) location.href = '/app/main.html';

setInterval(() => {
    document.getElementById('sb-time').textContent =
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}, 1000);

const btn = document.getElementById('login-btn');
const err = document.getElementById('err');

async function doLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) { showErr('Please fill in all fields'); return; }
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…';
    err.style.display = 'none';
    try {
        const res = await login(username, password);
        setToken(res.access_token);
        const me = await getMe();
        setUser(me);
        location.href = '/app/main.html';
    } catch (e) {
        showErr(e.message || 'Login failed. Check your credentials.');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    }
}

function showErr(msg) { err.textContent = msg; err.style.display = 'block'; }

btn.addEventListener('click', doLogin);
document.getElementById('password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
});
</script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add app/css/app.css app/index.html
git commit -m "feat: add login page and shared CSS"
```

---

## Task 7: main.html — shell + Tab 1 (Clock In/Out)

**Files:**
- Create: `app/main.html`

**Interfaces:**
- Consumes: `auth.js` (requireAuth, getUser, logout), `api.js` (getToday, clockIn, clockOut, getMe)
- Produces: `/app/main.html` with working Tab 1 (打卡) and nav skeleton for tabs 2–5

- [ ] **Step 1: Create `app/main.html` with shell + Tab 1**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SWOMS</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="css/app.css">
</head>
<body>
<div class="mobile-frame">
    <div class="status-bar">
        <span id="sb-time">09:41</span>
        <div style="display:flex;gap:5px">
            <i class="fa-solid fa-signal"></i>
            <i class="fa-solid fa-wifi"></i>
            <i class="fa-solid fa-battery-full"></i>
        </div>
    </div>

    <div class="content-area" id="content">
        <!-- Tab 1: Clock -->
        <div class="page active" id="page-clock">
            <div class="header-section">
                <div style="display:flex;align-items:center;gap:14px;">
                    <div style="width:46px;height:46px;background:var(--pale-blue);border-radius:12px;
                                display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--primary-blue);">
                        <i class="fa-solid fa-user-tie"></i>
                    </div>
                    <div>
                        <div id="user-name" style="font-size:18px;font-weight:700;color:var(--text-dark);">—</div>
                        <div id="user-zone" style="font-size:12px;color:var(--text-gray);">—</div>
                    </div>
                    <button onclick="doLogout()" style="margin-left:auto;background:none;border:none;
                        color:var(--text-gray);font-size:20px;cursor:pointer;">
                        <i class="fa-solid fa-right-from-bracket"></i>
                    </button>
                </div>
            </div>
            <div class="card" style="border:none;box-shadow:none;background:transparent;">
                <div style="display:flex;gap:10px;margin-bottom:32px;">
                    <div style="flex:1;background:#F8FAFC;padding:14px;border-radius:12px;border:1px solid #E2E8F0;">
                        <div style="font-size:13px;color:var(--text-gray);margin-bottom:4px;">Clock In</div>
                        <div id="ci-time" style="font-size:16px;font-weight:700;color:var(--text-dark);">—</div>
                        <div id="ci-status" style="font-size:11px;color:var(--text-gray);margin-top:4px;">Not yet</div>
                    </div>
                    <div style="flex:1;background:#F8FAFC;padding:14px;border-radius:12px;border:1px solid #E2E8F0;">
                        <div style="font-size:13px;color:var(--text-gray);margin-bottom:4px;">Clock Out</div>
                        <div id="co-time" style="font-size:16px;font-weight:700;color:var(--text-dark);">—</div>
                        <div id="co-status" style="font-size:11px;color:var(--text-gray);margin-top:4px;">Pending</div>
                    </div>
                </div>

                <div id="clock-btn-wrap" style="display:flex;justify-content:center;margin-bottom:24px;">
                    <button id="clock-btn" onclick="handleClock()"
                        style="width:150px;height:150px;border-radius:50%;
                               background:linear-gradient(135deg,#60A5FA,#2563EB);
                               color:white;border:none;display:flex;flex-direction:column;
                               justify-content:center;align-items:center;
                               box-shadow:0 10px 25px rgba(59,130,246,0.4);cursor:pointer;">
                        <div id="clock-btn-label" style="font-size:20px;font-weight:700;">Clock In</div>
                        <div id="clock-btn-time" style="font-size:13px;opacity:0.9;margin-top:4px;">—</div>
                    </button>
                </div>

                <div id="clock-msg" style="display:none;text-align:center;padding:10px;
                     border-radius:10px;font-size:13px;margin-bottom:8px;"></div>
            </div>
        </div>

        <!-- Tab 2: Tasks (filled in Task 8) -->
        <div class="page" id="page-tasks">
            <div class="header-section">
                <h2 style="font-size:20px;font-weight:700;color:var(--text-dark);">Task Dispatch</h2>
                <p style="font-size:13px;color:var(--text-gray);">New alerts from sensor network</p>
            </div>
            <div id="tasks-list" style="padding:0 4px;"></div>
        </div>

        <!-- Tab 3: Report (filled in Task 8) -->
        <div class="page" id="page-report">
            <div class="header-section">
                <h2 style="font-size:20px;font-weight:700;color:var(--text-dark);">Task Report</h2>
                <p style="font-size:13px;color:var(--text-gray);">Submit completion or issues</p>
            </div>
            <div id="report-content" style="padding:0 4px;"></div>
        </div>

        <!-- Tab 4: KPI (filled in Task 9) -->
        <div class="page" id="page-kpi">
            <div class="header-section">
                <h2 style="font-size:20px;font-weight:700;color:var(--text-dark);">My Performance</h2>
                <p style="font-size:13px;color:var(--text-gray);">Weekly summary &amp; ratings</p>
            </div>
            <div id="kpi-content" style="padding:0 4px;"></div>
        </div>

        <!-- Tab 5: Admin Rate (filled in Task 9) -->
        <div class="page" id="page-admin">
            <div class="header-section" style="background:var(--text-dark);">
                <h2 style="font-size:20px;font-weight:700;color:white;">Admin Scoring</h2>
                <p style="font-size:13px;color:#94A3B8;">Review completed tasks</p>
            </div>
            <div id="admin-list" style="padding:0 4px;"></div>
        </div>
    </div>

    <div class="bottom-nav">
        <button class="nav-btn active" id="nav-clock" onclick="switchTab('clock')">
            <i class="fa-regular fa-clock"></i><span>Time</span>
        </button>
        <button class="nav-btn" id="nav-tasks" onclick="switchTab('tasks')">
            <i class="fa-solid fa-list-check"></i><span>Tasks</span>
        </button>
        <button class="nav-btn" id="nav-report" onclick="switchTab('report')">
            <i class="fa-solid fa-camera"></i><span>Report</span>
        </button>
        <button class="nav-btn" id="nav-kpi" onclick="switchTab('kpi')">
            <i class="fa-solid fa-chart-simple"></i><span>My KPI</span>
        </button>
        <button class="nav-btn" id="nav-admin" onclick="switchTab('admin')">
            <i class="fa-solid fa-user-shield"></i><span>Admin</span>
        </button>
    </div>
</div>

<script type="module">
import { requireAuth, getUser, logout } from './js/auth.js';
import { getMe, getToday, clockIn, clockOut,
         getTasks, acceptTask, reportTask, rateTask,
         getPerformance, uploadFile, getBlocks } from './js/api.js';

requireAuth();

// ─── Globals ────────────────────────────────────────────────────────────────
let ME = getUser();
let blockMap = {};       // { id: name }
let uploadedPhotos = []; // URLs collected before submit
let selectedRatings = {}; // { taskId: stars }

// ─── Nav ────────────────────────────────────────────────────────────────────
window.switchTab = async (tab) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + tab).classList.add('active');
    document.getElementById('nav-' + tab).classList.add('active');
    if (tab === 'clock')  await loadClock();
    if (tab === 'tasks')  await loadTasks();
    if (tab === 'report') await loadReport();
    if (tab === 'kpi')    await loadKpi();
    if (tab === 'admin')  await loadAdmin();
};

window.doLogout = () => logout();

// ─── Clock ───────────────────────────────────────────────────────────────────
async function loadClock() {
    if (ME) {
        document.getElementById('user-name').textContent = ME.name;
        document.getElementById('user-zone').textContent =
            (ME.zone || 'No zone') + ' · SWOMS';
    }
    const rec = await getToday().catch(() => null);
    updateClockUI(rec);
}

function updateClockUI(rec) {
    const fmt = dt => dt ? new Date(dt).toLocaleTimeString('en-US',
        { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
    document.getElementById('ci-time').textContent = fmt(rec?.clock_in);
    document.getElementById('co-time').textContent = fmt(rec?.clock_out);
    document.getElementById('ci-status').textContent =
        rec?.clock_in ? '✓ Done' : 'Not yet';
    document.getElementById('co-status').textContent =
        rec?.clock_out ? '✓ Done' : 'Pending';
    const btnLabel = document.getElementById('clock-btn-label');
    const btnTime  = document.getElementById('clock-btn-time');
    btnTime.textContent = new Date().toLocaleTimeString('en-US',
        { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    if (!rec) {
        btnLabel.textContent = 'Clock In';
        document.getElementById('clock-btn').style.background =
            'linear-gradient(135deg,#60A5FA,#2563EB)';
    } else if (!rec.clock_out) {
        btnLabel.textContent = 'Clock Out';
        document.getElementById('clock-btn').style.background =
            'linear-gradient(135deg,#34D399,#059669)';
    } else {
        btnLabel.textContent = 'Done';
        document.getElementById('clock-btn').style.background = '#94A3B8';
        document.getElementById('clock-btn').disabled = true;
    }
}

window.handleClock = async () => {
    const btn = document.getElementById('clock-btn');
    const msg = document.getElementById('clock-msg');
    btn.disabled = true;
    msg.style.display = 'none';
    try {
        const rec = await getToday();
        let updated;
        if (!rec) {
            updated = await clockIn();
            showClockMsg('Clocked in successfully!', 'success');
        } else if (!rec.clock_out) {
            updated = await clockOut();
            showClockMsg('Clocked out successfully!', 'success');
        }
        if (updated) updateClockUI(updated);
    } catch (e) {
        showClockMsg(e.message || 'Error', 'error');
        btn.disabled = false;
    }
};

function showClockMsg(text, type) {
    const el = document.getElementById('clock-msg');
    el.textContent = text;
    el.style.background = type === 'success' ? '#D1FAE5' : '#FEE2E2';
    el.style.color = type === 'success' ? '#065F46' : '#DC2626';
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

// ─── Tabs 2–5 placeholder (filled in Tasks 8 & 9) ───────────────────────────
async function loadTasks()  { document.getElementById('tasks-list').innerHTML  = '<p style="padding:20px;color:#94A3B8;text-align:center">Loading…</p>'; }
async function loadReport() { document.getElementById('report-content').innerHTML = '<p style="padding:20px;color:#94A3B8;text-align:center">Loading…</p>'; }
async function loadKpi()    { document.getElementById('kpi-content').innerHTML  = '<p style="padding:20px;color:#94A3B8;text-align:center">Loading…</p>'; }
async function loadAdmin()  { document.getElementById('admin-list').innerHTML   = '<p style="padding:20px;color:#94A3B8;text-align:center">Loading…</p>'; }

// ─── Init ────────────────────────────────────────────────────────────────────
setInterval(() => {
    document.getElementById('sb-time').textContent =
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const tEl = document.getElementById('clock-btn-time');
    if (tEl) tEl.textContent = new Date().toLocaleTimeString('en-US',
        { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}, 1000);

(async () => {
    if (!ME) { ME = await getMe().catch(() => null); }
    const blocks = await getBlocks().catch(() => []);
    blocks.forEach(b => { blockMap[b.id] = b.name; });
    await loadClock();
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Test Tab 1 manually**

```
1. Push to GitHub, wait for deploy (or test locally with live server)
2. Open http://SERVER_IP/app/ in Chrome
3. Press F12 → device toolbar → iPhone 14 Pro (390×844)
4. Log in with cleaner credentials (e.g. liwei / cleaner123)
5. Tab 1 should show name, zone
6. Click Clock In → time appears in Clock In box
7. Click Clock Out → time appears in Clock Out box, button turns gray
```

- [ ] **Step 3: Commit**

```bash
git add app/main.html
git commit -m "feat: main.html shell with Tab 1 clock in/out"
```

---

## Task 8: Tab 2 (Task Dispatch) + Tab 3 (Task Report)

**Files:**
- Modify: `app/main.html` — replace `loadTasks` and `loadReport` placeholder functions

**Interfaces:**
- Consumes: `getTasks`, `acceptTask`, `reportTask`, `uploadFile` from `api.js`; `blockMap` set in Task 7 init

- [ ] **Step 1: Replace `loadTasks` function in `app/main.html`**

Find:
```javascript
async function loadTasks()  { document.getElementById('tasks-list').innerHTML  = '<p style="padding:20px;color:#94A3B8;text-align:center">Loading…</p>'; }
```
Replace with:
```javascript
async function loadTasks() {
    const el = document.getElementById('tasks-list');
    el.innerHTML = '<p style="padding:20px;color:#94A3B8;text-align:center">Loading…</p>';
    try {
        const tasks = await getTasks({ status: 'pending' });
        if (!tasks.length) {
            el.innerHTML = '<p style="padding:30px;color:#94A3B8;text-align:center;font-size:14px;">No pending tasks 🎉</p>';
            return;
        }
        el.innerHTML = tasks.map(t => {
            const bin = t.bin || {};
            const fill = bin.current_fill ?? 0;
            const blockName = blockMap[bin.block_id] || `Block #${bin.block_id}`;
            const isUrgent = fill >= 90;
            const color = fill >= 90 ? 'var(--danger-red)' : fill >= 60 ? 'var(--warning-orange)' : 'var(--success-green)';
            return `
            <div class="card">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                    <div style="width:42px;height:42px;border-radius:12px;display:flex;align-items:center;
                                justify-content:center;font-size:18px;
                                background:${isUrgent ? '#FEE2E2' : '#FEF3C7'};
                                color:${color};">
                        <i class="fa-solid fa-trash-can"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:700;font-size:14px;color:var(--text-dark);">
                            ${blockName} · Floor ${bin.floor ?? '?'} · Bin ${bin.bin_number ?? '?'}
                        </div>
                        <div style="font-size:12px;color:var(--text-gray);">Sensor: ${bin.sensor_id || '—'}</div>
                    </div>
                    ${isUrgent ? '<span class="badge" style="background:#FEE2E2;color:var(--danger-red);">URGENT</span>' : ''}
                </div>
                <div class="bar-bg">
                    <div class="bar-fill" style="width:${fill}%;background:${color};"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:12px;
                            font-weight:600;color:var(--text-dark);margin-bottom:12px;">
                    <span>Fill Level</span><span>${fill}%</span>
                </div>
                <button class="btn-primary" onclick="doAccept(${t.id}, this)">
                    <i class="fa-solid fa-hand-pointer"></i> Accept Task
                </button>
            </div>`;
        }).join('');
    } catch (e) {
        el.innerHTML = `<p style="padding:20px;color:var(--danger-red);text-align:center">${e.message}</p>`;
    }
}

window.doAccept = async (taskId, btn) => {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Accepting…';
    try {
        await acceptTask(taskId);
        btn.closest('.card').remove();
        const el = document.getElementById('tasks-list');
        if (!el.querySelector('.card')) {
            el.innerHTML = '<p style="padding:30px;color:#94A3B8;text-align:center;font-size:14px;">No pending tasks 🎉</p>';
        }
    } catch (e) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-hand-pointer"></i> Accept Task';
        alert(e.message);
    }
};
```

- [ ] **Step 2: Replace `loadReport` function in `app/main.html`**

Find:
```javascript
async function loadReport() { document.getElementById('report-content').innerHTML = '<p style="padding:20px;color:#94A3B8;text-align:center">Loading…</p>'; }
```
Replace with:
```javascript
async function loadReport() {
    uploadedPhotos = [];
    const el = document.getElementById('report-content');
    el.innerHTML = '<p style="padding:20px;color:#94A3B8;text-align:center">Loading…</p>';
    try {
        const tasks = ME ? await getTasks({ status: 'in_progress', cleaner_id: ME.id }) : [];
        if (!tasks.length) {
            el.innerHTML = '<div class="card" style="text-align:center;padding:24px;color:var(--text-gray);font-size:14px;">No active tasks.<br>Accept a task first.</div>';
            return;
        }
        const options = tasks.map(t => {
            const bin = t.bin || {};
            const blockName = blockMap[bin.block_id] || `Block #${bin.block_id}`;
            return `<option value="${t.id}">${blockName} · Floor ${bin.floor} · Bin ${bin.bin_number}</option>`;
        }).join('');
        el.innerHTML = `
        <div class="card">
            <div class="form-group">
                <label>Select Active Task</label>
                <select id="report-task-sel">${options}</select>
            </div>
            <div class="form-group">
                <label>Result</label>
                <select id="report-result">
                    <option value="cleaned">Successfully Emptied</option>
                    <option value="damaged">Bin Damaged / Needs Repair</option>
                    <option value="false_alarm">False Alarm</option>
                    <option value="unable">Unable to Complete</option>
                </select>
            </div>
            <div class="form-group">
                <label>Photos (optional)</label>
                <div class="upload-area" onclick="document.getElementById('photo-input').click()">
                    <i class="fa-solid fa-camera" style="font-size:22px;color:var(--primary-blue);"></i>
                    <span style="font-size:13px;">Tap to upload photo</span>
                </div>
                <input type="file" id="photo-input" accept="image/*" style="display:none" multiple>
                <div id="photo-preview" class="photo-row"></div>
            </div>
            <div id="report-msg" style="display:none;padding:10px;border-radius:10px;
                 font-size:13px;margin-bottom:8px;"></div>
            <button class="btn-primary btn-success" id="report-submit-btn" onclick="doReport()">
                <i class="fa-solid fa-paper-plane"></i> Submit Report
            </button>
        </div>`;

        document.getElementById('photo-input').addEventListener('change', async (e) => {
            const preview = document.getElementById('photo-preview');
            for (const file of e.target.files) {
                try {
                    const { url } = await uploadFile(file);
                    uploadedPhotos.push(url);
                    const img = document.createElement('img');
                    img.src = url; img.className = 'photo-thumb';
                    preview.appendChild(img);
                } catch (err) { alert('Upload failed: ' + err.message); }
            }
        });
    } catch (e) {
        el.innerHTML = `<p style="padding:20px;color:var(--danger-red);text-align:center">${e.message}</p>`;
    }
}

window.doReport = async () => {
    const btn = document.getElementById('report-submit-btn');
    const msg = document.getElementById('report-msg');
    const taskId = parseInt(document.getElementById('report-task-sel').value);
    const result = document.getElementById('report-result').value;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting…';
    msg.style.display = 'none';
    try {
        await reportTask(taskId, result, uploadedPhotos);
        msg.textContent = 'Report submitted!';
        msg.style.background = '#D1FAE5'; msg.style.color = '#065F46';
        msg.style.display = 'block';
        setTimeout(() => loadReport(), 1500);
    } catch (e) {
        msg.textContent = e.message || 'Submit failed';
        msg.style.background = '#FEE2E2'; msg.style.color = '#DC2626';
        msg.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Report';
    }
};
```

- [ ] **Step 3: Commit**

```bash
git add app/main.html
git commit -m "feat: Tab 2 task dispatch and Tab 3 task report with photo upload"
```

---

## Task 9: Tab 4 (My KPI) + Tab 5 (Admin Rate)

**Files:**
- Modify: `app/main.html` — replace `loadKpi` and `loadAdmin` placeholder functions

**Interfaces:**
- Consumes: `getPerformance`, `getTasks`, `rateTask` from `api.js`; `ME` global from Task 7

- [ ] **Step 1: Replace `loadKpi` function**

Find:
```javascript
async function loadKpi()    { document.getElementById('kpi-content').innerHTML  = '<p style="padding:20px;color:#94A3B8;text-align:center">Loading…</p>'; }
```
Replace with:
```javascript
async function loadKpi() {
    const el = document.getElementById('kpi-content');
    el.innerHTML = '<p style="padding:20px;color:#94A3B8;text-align:center">Loading…</p>';
    if (!ME) { el.innerHTML = '<p style="padding:20px;color:var(--danger-red);text-align:center">Not logged in</p>'; return; }
    try {
        const p = await getPerformance(ME.id);
        const rating = p.average_rating ? p.average_rating.toFixed(1) : '—';
        const stars = p.average_rating
            ? Array.from({ length: 5 }, (_, i) =>
                `<i class="fa-${i < Math.round(p.average_rating) ? 'solid' : 'regular'} fa-star"
                    style="color:${i < Math.round(p.average_rating) ? 'var(--warning-orange)' : '#CBD5E1'}"></i>`
              ).join('')
            : '—';
        el.innerHTML = `
        <div class="card" style="text-align:center;">
            <div class="score-circle">
                <div style="font-size:36px;font-weight:700;color:var(--primary-blue);line-height:1;">${rating}</div>
                <div style="font-size:13px;margin-top:4px;">${stars}</div>
            </div>
            <h3 style="font-size:16px;font-weight:700;color:var(--text-dark);">
                ${p.average_rating >= 4.5 ? 'Excellent Work!' : p.average_rating >= 3.5 ? 'Good Work!' : 'Keep it up!'}
            </h3>
            <div class="stats-grid">
                <div class="stat-box">
                    <div style="font-size:24px;font-weight:700;color:var(--text-dark);">${p.completed_tasks}</div>
                    <div style="font-size:12px;color:var(--text-gray);margin-top:4px;">Bins Emptied</div>
                </div>
                <div class="stat-box">
                    <div style="font-size:24px;font-weight:700;color:var(--success-green);">
                        ${p.on_time_rate != null ? p.on_time_rate + '%' : '—'}
                    </div>
                    <div style="font-size:12px;color:var(--text-gray);margin-top:4px;">On-Time SLA</div>
                </div>
                <div class="stat-box">
                    <div style="font-size:24px;font-weight:700;color:var(--primary-blue);">${p.total_tasks}</div>
                    <div style="font-size:12px;color:var(--text-gray);margin-top:4px;">Total Tasks</div>
                </div>
                <div class="stat-box">
                    <div style="font-size:24px;font-weight:700;color:var(--warning-orange);">${p.pending_tasks}</div>
                    <div style="font-size:12px;color:var(--text-gray);margin-top:4px;">In Progress</div>
                </div>
            </div>
        </div>`;
    } catch (e) {
        el.innerHTML = `<p style="padding:20px;color:var(--danger-red);text-align:center">${e.message}</p>`;
    }
}
```

- [ ] **Step 2: Replace `loadAdmin` function**

Find:
```javascript
async function loadAdmin()  { document.getElementById('admin-list').innerHTML   = '<p style="padding:20px;color:#94A3B8;text-align:center">Loading…</p>'; }
```
Replace with:
```javascript
async function loadAdmin() {
    selectedRatings = {};
    const el = document.getElementById('admin-list');
    el.innerHTML = '<p style="padding:20px;color:#94A3B8;text-align:center">Loading…</p>';
    try {
        const tasks = await getTasks({ status: 'completed' });
        if (!tasks.length) {
            el.innerHTML = '<div class="card" style="text-align:center;padding:24px;color:var(--text-gray);font-size:14px;">No completed tasks to rate.</div>';
            return;
        }
        el.innerHTML = tasks.map(t => {
            const bin = t.bin || {};
            const cl  = t.cleaner || {};
            const blockName = blockMap[bin.block_id] || `Block #${bin.block_id}`;
            const completedAt = t.completed_at
                ? new Date(t.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '—';
            const photos = (t.photos || []).map(url =>
                `<img src="${url}" class="photo-thumb" onerror="this.style.display='none'">`
            ).join('');
            const stars = Array.from({ length: 5 }, (_, i) =>
                `<i class="fa-regular fa-star star" data-task="${t.id}" data-val="${i + 1}"
                    onclick="setStar(${t.id}, ${i + 1})"></i>`
            ).join('');
            return `
            <div class="card" id="rate-card-${t.id}">
                <div style="display:flex;justify-content:space-between;font-size:13px;
                            font-weight:700;color:var(--text-dark);margin-bottom:8px;">
                    <span><i class="fa-solid fa-user"></i> ${cl.name || '—'}</span>
                    <span style="color:var(--text-gray);font-weight:400;font-size:12px;">${completedAt}</span>
                </div>
                <div style="font-size:13px;font-weight:600;color:var(--text-dark);margin-bottom:8px;">
                    ${blockName} · Floor ${bin.floor ?? '?'} · Bin ${bin.bin_number ?? '?'}
                </div>
                ${photos ? `<div class="photo-row">${photos}</div>` : ''}
                <div id="stars-${t.id}" style="display:flex;gap:4px;margin:10px 0;">${stars}</div>
                <input type="text" id="comment-${t.id}" placeholder="Add a comment…" 
                       style="width:100%;border:1px solid #CBD5E1;border-radius:10px;
                              padding:10px;font-size:13px;margin-bottom:10px;">
                <button class="btn-primary" onclick="doRate(${t.id}, this)">
                    <i class="fa-solid fa-star"></i> Submit Rating
                </button>
            </div>`;
        }).join('');
    } catch (e) {
        el.innerHTML = `<p style="padding:20px;color:var(--danger-red);text-align:center">${e.message}</p>`;
    }
}

window.setStar = (taskId, val) => {
    selectedRatings[taskId] = val;
    document.querySelectorAll(`[data-task="${taskId}"]`).forEach(s => {
        const isActive = parseInt(s.dataset.val) <= val;
        s.className = `fa-${isActive ? 'solid' : 'regular'} fa-star star${isActive ? ' active' : ''}`;
    });
};

window.doRate = async (taskId, btn) => {
    const rating = selectedRatings[taskId];
    if (!rating) { alert('Please select a star rating first'); return; }
    const comment = document.getElementById('comment-' + taskId).value.trim();
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting…';
    try {
        await rateTask(taskId, rating, comment || undefined);
        const card = document.getElementById('rate-card-' + taskId);
        card.style.border = '1px solid var(--success-green)';
        card.style.background = '#F0FDF4';
        btn.outerHTML = `<div style="text-align:center;color:var(--success-green);
            font-weight:700;padding:10px;">
            <i class="fa-solid fa-check-circle"></i> Rated ${rating} Star${rating > 1 ? 's' : ''}
        </div>`;
    } catch (e) {
        alert(e.message || 'Rating failed');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-star"></i> Submit Rating';
    }
};
```

- [ ] **Step 3: Commit**

```bash
git add app/main.html
git commit -m "feat: Tab 4 KPI dashboard and Tab 5 admin rating"
```

---

## Task 10: Deploy + smoke test

**Files:**
- None new — push both repos, verify live

- [ ] **Step 1: Push frontend repo**

```bash
cd E:/front/waste-monitor-web
git push
```

Expected: GitHub Actions builds and deploys frontend container (~3–5 min).

- [ ] **Step 2: Push backend repo (if not already pushed after Task 4)**

```bash
cd E:/project/waste-overflow-monitor
git push
```

Expected: GitHub Actions builds and deploys backend container (~5–10 min).

- [ ] **Step 3: Smoke test — login**

```
1. Open http://SERVER_IP/app/ in Chrome
2. Press F12 → Toggle device toolbar (Ctrl+Shift+M) → iPhone 14 Pro
3. Log in: liwei / cleaner123
4. Should redirect to /app/main.html showing Tab 1 with "Li Wei" name
```

- [ ] **Step 4: Smoke test — clock in/out**

```
1. Tab 1: click Clock In → Clock In time box shows current time
2. Click Clock Out → Clock Out time box shows current time, button turns gray
3. Refresh page → times persist (from DB)
```

- [ ] **Step 5: Smoke test — task dispatch**

```
1. Log in as admin (admin/admin123) in admin panel, create a task for a bin
2. Log in as liwei in the App, go to Tasks tab
3. Task card should appear with fill level bar
4. Click Accept → card disappears from list
```

- [ ] **Step 6: Smoke test — report**

```
1. After accepting a task, go to Report tab
2. Task appears in dropdown
3. Select result, optionally upload a photo
4. Click Submit → success message, task disappears from list
```

- [ ] **Step 7: Smoke test — KPI**

```
1. Go to My KPI tab
2. Should show completed task count, average rating, on_time_rate
   (may show — if no completed tasks yet)
```

- [ ] **Step 8: Smoke test — Admin Rate**

```
1. Log in as admin in the App (admin/admin123)
2. Go to Admin tab
3. Completed tasks should appear with cleaner name, location
4. Click stars → highlight, add comment, submit → card turns green
```

- [ ] **Step 9: Final commit (if any last fixes)**

```bash
git add -p   # stage only intentional changes
git commit -m "fix: post-deploy smoke test corrections"
git push
```
