# Stocky — Inventory Management System

A full-stack stock management web app with offline PWA support.

## Stack
- **Backend**: Django 4.2 + Django REST Framework + JWT auth
- **Database**: PostgreSQL (Supabase)
- **Frontend**: HTML + CSS + Vanilla JS (PWA)
- **Backend hosting**: Render
- **Frontend hosting**: Vercel

---

## Local Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env from example
cp .env.example .env
# Edit .env with your local DB credentials (or leave DB_SSLMODE=prefer for local postgres)

python manage.py migrate
python manage.py createsuperuser   # creates admin user
python manage.py runserver
```

API available at: `http://localhost:8000/api/`

### Frontend

Serve the `frontend/` folder with any static file server:

```bash
# Python built-in
cd frontend
python -m http.server 5500

# Or use VS Code Live Server extension
```

Open `http://localhost:5500/index.html`

> **Note:** Set `window.API_BASE` in `frontend/js/config.js` to match your backend URL.

---

## Environment Variables (Backend)

| Variable | Description |
|---|---|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | `True` for dev, `False` for prod |
| `ALLOWED_HOSTS` | Comma-separated allowed hosts |
| `DB_NAME` | PostgreSQL database name |
| `DB_USER` | PostgreSQL user |
| `DB_PASSWORD` | PostgreSQL password |
| `DB_HOST` | Database host (Supabase: `db.<ref>.supabase.co`) |
| `DB_PORT` | Database port (default: `5432`) |
| `DB_SSLMODE` | `require` for Supabase, `prefer` for local |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins |

---

## Deployment

### Backend → Render

1. Create a new **Web Service** on Render, connect this repository
2. Set **Root Directory** to `backend`
3. **Build command**: `pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --no-input`
4. **Start command**: `gunicorn stocky.wsgi`
5. Add all environment variables from `.env.example`

### Frontend → Vercel

1. Create a new project on Vercel, connect this repository
2. Set **Root Directory** to `frontend`
3. **Framework preset**: Other (static)
4. Update `window.API_BASE` in `frontend/js/config.js` to your Render URL

### Supabase Database

1. Create a new Supabase project
2. Go to **Settings → Database → Connection string → URI**
3. Use the **direct connection** (port 5432), not the pooler
4. Copy credentials to Render environment variables

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login/` | — | Get JWT tokens |
| POST | `/api/auth/refresh/` | — | Refresh access token |
| POST | `/api/auth/logout/` | JWT | Blacklist refresh token |
| GET, POST | `/api/items/` | JWT | List / create items |
| GET, PUT, DELETE | `/api/items/{id}/` | JWT (DELETE: admin) | Item detail |
| POST | `/api/variants/` | JWT | Create variant |
| GET, PUT, DELETE | `/api/variants/{id}/` | JWT | Variant detail |
| POST | `/api/stock/add/` | JWT | Add stock to variant |
| POST | `/api/stock/remove/` | JWT | Remove stock from variant |
| GET | `/api/logs/` | Admin | Activity logs |
| GET | `/api/report/daily/` | Admin | Today's logs + inventory snapshot |

---

## Creating Users

```bash
# Admin user
python manage.py createsuperuser

# Staff user (via Django shell)
python manage.py shell
>>> from api.models import User
>>> User.objects.create_user(username="staff1", password="pass123", role="staff")
```

Or use the Django admin at `/admin/`.
