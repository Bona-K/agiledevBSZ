# MyVibe — Flask + Jinja2

Static HTML demo converted to a full Flask + Jinja2 project.

## Project structure

```
myvibe_flask/
├── app.py                        # Flask app with all routes
├── requirements.txt
├── templates/
│   ├── base.html                 # Shared layout (header, nav, toast, scripts)
│   ├── index.html                # Landing page  →  /
│   ├── login.html                # Login         →  /login
│   ├── signup.html               # Sign up       →  /signup
│   ├── dashboard.html            # Home feed     →  /dashboard
│   ├── explore.html              # Explore       →  /explore
│   ├── create_route.html         # Create route  →  /create-route
│   ├── profile.html              # Profile       →  /profile
│   └── route.html                # Route detail  →  /route/<id>
└── static/
    ├── css/styles.css
    └── js/
        ├── interactions.js
        └── pages/
            ├── login.js
            ├── signup.js
            ├── dashboard.js
            ├── explore.js
            ├── create-route.js
            ├── profile.js
            └── route.js
```

## Route map

| URL                | Template            | Auth required |
|--------------------|---------------------|---------------|
| `/`                | `index.html`        | No            |
| `/login`           | `login.html`        | No            |
| `/signup`          | `signup.html`       | No            |
| `/dashboard`       | `dashboard.html`    | Yes           |
| `/explore`         | `explore.html`      | Yes           |
| `/create-route`    | `create_route.html` | Yes           |
| `/profile`         | `profile.html`      | Yes           |
| `/route/<route_id>`| `route.html`        | Yes           |
| `/logout`          | —redirect→`/`       | —             |

## Quick start

```bash
pip install -r requirements.txt
python app.py
# Open http://127.0.0.1:5000
```

## What changed from static HTML

- All `<head>`, `<header>`, `<nav>`, and `<toast>` are in `base.html`
- Every page uses `{% extends "base.html" %}` and fills `{% block content %}`
- `href` links converted from relative paths (`../pages/login.html`) to `{{ url_for('login') }}`
- `<link href="../assets/css/...">` → `{{ url_for('static', filename='...') }}`
- Active nav item highlighted dynamically via `active_page` variable
- Login/signup forms use `method="POST"` with Flask session-based mock auth
- `@login_required` decorator redirects unauthenticated users to `/login`
- `explore.html` reads `query`, `sort`, and `active_tag` from Flask context
- `route.html` renders a mock route object (replace with real DB query)
- `create_route.html` renders `themes` list from Flask (easy to extend)
