# MyVibe — Flask + Jinja2 (OTP + Maps integrated)

This build merges two feature branches into one project:

1. **OTP email verification** — sign-up and password reset via emailed one-time codes
2. **Maps integration** — Leaflet-based route maps with per-stop lat/lng, place name, and rating

Both features are wired into a single Flask app and share the same database.

## Project structure

```
agiledevBSZ/
├── app.py                        # Flask app — all routes (OTP + maps)
├── auth.py                       # Auth helpers (current_user, login_required)
├── models.py                     # SQLAlchemy models (User, Route, RouteLocation, Follow, Notification)
├── otp_service.py                # OTP generation, verification, Gmail SMTP delivery
├── route_service.py              # Route CRUD with lat/lng/place_name/rating support
├── utils.py                      # Password hashing helpers
├── requirements.txt
├── .env                          # Mail credentials + Flask secret (do not commit)
├── templates/
│   ├── base.html                 # Shared layout — includes Leaflet CSS/JS
│   ├── index.html                # Landing                  → /
│   ├── login.html                # Login + "Forgot password" → /login
│   ├── signup.html               # Signup step 1            → /signup
│   ├── signup_verify.html        # OTP entry step 2         → /signup/verify
│   ├── forgot_password.html      # Reset step 1             → /forgot-password
│   ├── forgot_password_verify.html # Reset step 2           → /forgot-password/verify
│   ├── change_password.html      # Authenticated change     → /change-password
│   ├── dashboard.html
│   ├── explore.html
│   ├── create_route.html         # Create route + map picker
│   ├── profile.html
│   ├── user_profile.html
│   ├── notifications.html
│   └── route.html                # Route detail + map
└── static/
    ├── myvibe_logo.svg
    ├── css/styles.css            # Includes Leaflet/glass map styling
    └── js/
        ├── app-animations.js
        ├── interactions.js
        └── pages/
            ├── login.js
            ├── signup.js
            ├── change-password.js
            ├── dashboard.js
            ├── explore.js
            ├── create-route.js
            ├── location-picker.js   # MAPS — pick lat/lng for a stop
            ├── route-map.js         # MAPS — render the route on Leaflet
            ├── profile.js
            ├── user_profile.js
            └── route.js
```

## Route map

| URL                                    | Template                       | Auth |
|----------------------------------------|--------------------------------|------|
| `/`                                    | `index.html`                   | No   |
| `/login`                               | `login.html`                   | No   |
| `/signup`                              | `signup.html` (step 1)         | No   |
| `/signup/verify`                       | `signup_verify.html` (step 2)  | No   |
| `/signup/resend-otp`                   | re-sends OTP                   | No   |
| `/forgot-password`                     | `forgot_password.html`         | No   |
| `/forgot-password/verify`              | `forgot_password_verify.html`  | No   |
| `/dashboard`                           | `dashboard.html`               | Yes  |
| `/explore`                             | `explore.html`                 | Yes  |
| `/create-route`                        | `create_route.html`            | Yes  |
| `/profile`                             | `profile.html`                 | Yes  |
| `/user/<username>`                     | `user_profile.html`            | Yes  |
| `/route/<route_id>`                    | `route.html`                   | Yes  |
| `/change-password`                     | `change_password.html`         | Yes  |
| `/notifications`                       | `notifications.html`           | Yes  |
| `/follow/<username>` (POST)            | JSON                           | Yes  |
| `/api/routes` (POST)                   | create route                   | Yes  |
| `/api/routes/<id>` (GET/PATCH/DELETE)  | read/update/delete             | Yes  |
| `/api/routes/<id>/duplicate` (POST)    | duplicate                      | Yes  |
| `/api/my-routes`                       | own routes                     | Yes  |
| `/api/routes/public`                   | filtered public feed           | Yes  |
| `/api/uploads/place-photo` (POST)      | upload stop image              | Yes  |
| `/logout`                              | clears session                 | —    |

## Quick start

```bash
pip install -r requirements.txt
python app.py
# Open http://127.0.0.1:5000
```

The first run creates `instance/myvibe.db` and seeds demo accounts (alex, mina) plus four sample routes with map coordinates.

## OTP email setup

OTPs are delivered via Gmail SMTP. To send real emails:

1. Enable 2-Step Verification on your Google account.
2. Visit https://myaccount.google.com/apppasswords and create an App Password (label it "MyVibe").
3. Edit `.env`:

```
MAIL_USERNAME=you@gmail.com
MAIL_PASSWORD=xxxx xxxx xxxx xxxx
MAIL_FROM_NAME=MyVibe
```

**Dev fallback:** if `MAIL_USERNAME` / `MAIL_PASSWORD` are empty, OTPs are printed to the Flask console instead of emailed. Useful for local testing without real Gmail credentials.

OTPs expire after 10 minutes and are single-use. They are stored in the Flask session (no extra DB table).

## Maps integration

- Each `RouteLocation` has optional `lat`, `lng`, `place_name`, and `rating` (1–5).
- `templates/base.html` loads Leaflet 1.9.4 from unpkg.
- `static/js/pages/location-picker.js` powers the map on the create-route form.
- `static/js/pages/route-map.js` renders the polyline + markers on the route detail page.
- The seed step in `app.py` creates four sample routes (Sydney, Bondi-to-Coogee, Melbourne laneways, Fitzroy) so the map UI lights up on first run.

## Demo accounts

| Username | Password   |
|----------|------------|
| alex     | 11111111   |
| mina     | 11111111   |

(These come from the maps seed. New users created via the OTP signup flow set their own passwords.)

## Notes on the merge

- The OTP feature and maps feature are independent at runtime — they touch different routes, templates, and JS files, so there are no logic conflicts.
- `login.html` has a "Forgot password?" link added above the "No account? Sign up" line so the new flow is discoverable.
- The `signup` route is the OTP version (form submit → email OTP → verify → create user). The maps branch's direct-create variant was dropped.
- `models.py` is the maps version (with `place_name` and `rating` columns). If you have an old `instance/myvibe.db` from the OTP-only branch, delete it before first run so schema is rebuilt cleanly.
- `app.py` runs `ensure_route_cover_photo_url_column()` on startup to ALTER an older sqlite db that's missing `cover_photo_url`, but it does **not** add `place_name`/`rating`; deleting the old DB is the simplest path.
