import os
import secrets

from flask import Flask, abort, jsonify, redirect, render_template, request, session, url_for
from auth import get_current_user, login_required, get_template_globals
from sqlalchemy import text
from werkzeug.utils import secure_filename

from models import db, User, Follow, Notification, Message
from route_service import (
    RouteOwnershipError,
    RouteValidationError,
    create_route_from_payload,
    delete_route_for_owner,
    duplicate_route_for_user,
    get_route_for_viewer,
    list_public_routes,
    list_routes_for_author,
    serialize_route_for_client,
    update_route_for_owner,
)
from utils import check_password, hash_password
from otp_service import (
    create_otp_session,
    verify_otp_session,
    clear_otp_session,
    send_signup_otp,
    send_reset_otp,
)

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Security configuration — load from .env file or environment variables
# ---------------------------------------------------------------------------

# Load .env file manually if it exists (no extra dependencies needed)
_env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _val = _line.split("=", 1)
                os.environ.setdefault(_key.strip(), _val.strip())

_secret = os.environ.get("FLASK_SECRET_KEY", "").strip()
if not _secret:
    _secret = "myvibe-dev-secret-change-in-production"

app.secret_key = _secret

# Session cookie hardening
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = 60 * 60 * 24 * 7   # 7 days

# ---------------------------------------------------------------------------
# Database configuration
# ---------------------------------------------------------------------------

app.config["SQLALCHEMY_DATABASE_URI"]        = os.environ.get("DATABASE_URL", "sqlite:///myvibe.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

# ---------------------------------------------------------------------------
# Demo user seed
# ---------------------------------------------------------------------------

def seed_demo_users():
    """Insert demo accounts on first run. Skips existing usernames."""
    from models import Route, RouteLocation
    from datetime import datetime

    demo_accounts = [
        {
            "username": "alex",
            "email":    "alex@myvibe.demo",
            "password": "11111111",
            "bio":      "Hi, I'm Alex. I love exploring Sydney's hidden gems.",
        },
        {
            "username": "mina",
            "email":    "mina@myvibe.demo",
            "password": "11111111",
            "bio":      "Mina here — Melbourne foodie, route designer, sunset chaser.",
        },
    ]

    for account in demo_accounts:
        exists = User.query.filter_by(username=account["username"]).first()
        if not exists:
            user = User(
                username      = account["username"],
                email         = account["email"],
                password_hash = hash_password(account["password"]),
                bio           = account["bio"],
            )
            db.session.add(user)

    db.session.commit()

    # Seed sample routes (only if none exist) so the map demo lights up immediately.
    if Route.query.count() == 0:
        alex = User.query.filter_by(username="alex").first()
        mina = User.query.filter_by(username="mina").first()

        if alex:
            r = Route(
                author_id=alex.id,
                title="Sydney Harbour first date",
                description="Coffee at the Rocks, Opera House views, ferry across to Manly. Easy, scenic, photogenic.",
                theme="first date",
                tags=["date", "sunset", "iconic"],
                is_public=True,
            )
            db.session.add(r); db.session.flush()
            stops_a = [
                # (order, event, place, time, desc, parking, lat, lng, rating)
                (1, "Morning coffee", "The Fine Food Store",      "09:30", "Cosy laneway cafe in the Rocks.",        "<500m", -33.8587, 151.2099, 5),
                (2, "Opera House walk", "Sydney Opera House",     "11:00", "Walk the forecourt and snap photos.",    "<1km",  -33.8568, 151.2153, 5),
                (3, "Ferry to Manly", "Circular Quay Wharf 3",    "13:30", "Grab a seat on the right side for views.","<500m", -33.8613, 151.2106, 4),
                (4, "Sunset at the cliffs", "North Head Lookout", "17:45", "Golden hour over the harbour.",          "yes",   -33.8230, 151.2960, 5),
            ]
            for order, event, place, time, desc, parking, lat, lng, rating in stops_a:
                db.session.add(RouteLocation(
                    route_id=r.id, stop_order=order, name=event, place_name=place,
                    time=time, description=desc, parking=parking,
                    lat=lat, lng=lng, rating=rating,
                ))

            r2 = Route(
                author_id=alex.id,
                title="Bondi to Coogee coastal walk",
                description="The classic coastal walk — beaches, cliffs, swims along the way.",
                theme="active day",
                tags=["walk", "beach", "summer"],
                is_public=True,
            )
            db.session.add(r2); db.session.flush()
            stops_a2 = [
                (1, "Start at Bondi",   "Bondi Beach",       "08:00", "Stretch and start the walk.",        "<1km",  -33.8915, 151.2767, 4),
                (2, "Tamarama break",   "Tamarama Beach",    "08:45", "Small bay, often quieter.",          "<500m", -33.9007, 151.2710, 4),
                (3, "Bronte swim",      "Bronte Beach",      "09:30", "Optional dip in the rock pool.",     "<1km",  -33.9043, 151.2680, 5),
                (4, "Finish at Coogee", "Coogee Beach",      "11:00", "Coffee or beer to celebrate.",       "<1km",  -33.9215, 151.2587, 5),
            ]
            for order, event, place, time, desc, parking, lat, lng, rating in stops_a2:
                db.session.add(RouteLocation(
                    route_id=r2.id, stop_order=order, name=event, place_name=place,
                    time=time, description=desc, parking=parking,
                    lat=lat, lng=lng, rating=rating,
                ))

        if mina:
            r3 = Route(
                author_id=mina.id,
                title="Melbourne laneway picnic day",
                description="Brunch, laneway art, then picnic in the Botanic Gardens. Pure Melbourne energy.",
                theme="picnic",
                tags=["picnic", "coffee", "art"],
                is_public=True,
            )
            db.session.add(r3); db.session.flush()
            stops_m = [
                (1, "Brunch",           "Hardware Société",         "09:00", "Iconic Melbourne brunch — go early.",   "<1km",  -37.8128, 144.9620, 5),
                (2, "Laneway art",      "Hosier Lane",              "11:00", "Walk through the famous street art.",  "<500m", -37.8160, 144.9690, 4),
                (3, "Pick up snacks",   "Queen Victoria Market",    "12:00", "Cheese, bread, fruit for the picnic.", "<1km",  -37.8076, 144.9568, 4),
                (4, "Picnic",           "Royal Botanic Gardens",    "13:30", "Find a shaded lawn and chill.",        "<1km",  -37.8304, 144.9796, 5),
            ]
            for order, event, place, time, desc, parking, lat, lng, rating in stops_m:
                db.session.add(RouteLocation(
                    route_id=r3.id, stop_order=order, name=event, place_name=place,
                    time=time, description=desc, parking=parking,
                    lat=lat, lng=lng, rating=rating,
                ))

            r4 = Route(
                author_id=mina.id,
                title="Hidden gems of Fitzroy",
                description="Bookshops, vintage stores, a sneaky cocktail bar. Slow Saturday vibes.",
                theme="hidden gems",
                tags=["hidden", "drinks", "vintage"],
                is_public=True,
            )
            db.session.add(r4); db.session.flush()
            stops_m2 = [
                (1, "Coffee + record shop", "Polyester Records",   "11:00", "Browse vinyl with a flat white.",       "<500m", -37.8004, 144.9789, 4),
                (2, "Vintage hunting",      "Smith Street vintage","12:30", "Plenty of small stores along Smith.",   "<1km",  -37.7965, 144.9846, 4),
                (3, "Late lunch",           "Cutler & Co",         "14:30", "Tasting menu if you're feeling fancy.", "<500m", -37.7995, 144.9826, 5),
                (4, "Cocktails",            "The Everleigh",       "18:00", "Speakeasy upstairs — quiet, classy.",   "<1km",  -37.7993, 144.9776, 5),
            ]
            for order, event, place, time, desc, parking, lat, lng, rating in stops_m2:
                db.session.add(RouteLocation(
                    route_id=r4.id, stop_order=order, name=event, place_name=place,
                    time=time, description=desc, parking=parking,
                    lat=lat, lng=lng, rating=rating,
                ))

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()


def ensure_route_cover_photo_url_column():
    """SQLite: add routes.cover_photo_url if missing (db.create_all does not ALTER)."""
    try:
        if db.engine.dialect.name != "sqlite":
            return
        rows = db.session.execute(text("PRAGMA table_info(routes)")).fetchall()
        col_names = {row[1] for row in rows}
        if "cover_photo_url" in col_names:
            return
        db.session.execute(text("ALTER TABLE routes ADD COLUMN cover_photo_url VARCHAR(500)"))
        db.session.commit()
    except Exception:
        db.session.rollback()


def _ensure_column(table: str, column: str, ddl: str):
    """SQLite helper: add a column if it isn't already present. Silent on failure."""
    try:
        if db.engine.dialect.name != "sqlite":
            return
        rows = db.session.execute(text(f"PRAGMA table_info({table})")).fetchall()
        col_names = {row[1] for row in rows}
        if column in col_names:
            return
        db.session.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
        db.session.commit()
    except Exception:
        db.session.rollback()


def ensure_user_profile_columns():
    """Older DBs may not have display_name / profile_img on users — add if missing."""
    _ensure_column("users", "display_name", "VARCHAR(120) DEFAULT ''")
    _ensure_column("users", "profile_img",  "VARCHAR(300) DEFAULT ''")


with app.app_context():
    db.create_all()
    ensure_route_cover_photo_url_column()
    ensure_user_profile_columns()
    seed_demo_users()

# ---------------------------------------------------------------------------
# Static data
# ---------------------------------------------------------------------------

THEMES = ["first date", "picnic", "active day", "hidden gems"]

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

# current_user moved to auth.py
current_user = get_current_user


@app.context_processor
def inject_template_globals():
    """Inject shared auth variables into every template. Logic lives in auth.py."""
    return get_template_globals()


# login_required moved to auth.py

# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "").strip()

        if not username:
            return render_template("login.html", error="Please enter a username.")
        if not password:
            return render_template("login.html", error="Please enter a password.")

        user = User.query.filter_by(username=username).first()
        if not user:
            return render_template("login.html", error="Username not found. Please check and try again.")

        if not check_password(password, user.password_hash):
            return render_template("login.html", error="Incorrect password. Please try again.")

        session["user_id"] = user.id
        return redirect(url_for("dashboard"))

    return render_template("login.html")


@app.route("/signup", methods=["GET", "POST"])
def signup():
    """
    Step 1 (GET / first POST): collect details, send OTP → redirect to /signup/verify
    Step 1 POST: validate form, send OTP, store pending data in session.
    """
    if request.method == "POST":
        name     = request.form.get("suName",      "").strip()
        email    = request.form.get("suEmail",     "").strip().lower()
        username = request.form.get("suUsername",  "").strip().lower()
        password = request.form.get("suPassword",  "")
        confirm  = request.form.get("suPassword2", "")

        if not name:
            return render_template("signup.html", error="Please enter your name.")
        if not email:
            return render_template("signup.html", error="Please enter your email.")
        if not username:
            return render_template("signup.html", error="Please enter a username.")
        if len(password) < 6:
            return render_template("signup.html", error="Password must be at least 6 characters.")
        if password != confirm:
            return render_template("signup.html", error="Passwords do not match.")

        if User.query.filter_by(username=username).first():
            return render_template("signup.html", error="Username already taken. Please choose another.")
        if User.query.filter_by(email=email).first():
            return render_template("signup.html", error="Email already registered. Please use another.")

        # Generate OTP and email it
        otp = create_otp_session(session, "signup", email)
        ok, err = send_signup_otp(email, otp)
        if not ok:
            return render_template("signup.html", error=f"Could not send verification email: {err}")

        # Stash pending registration (password stored hashed so it's not plain-text in session)
        session["pending_signup"] = {
            "name":     name,
            "email":    email,
            "username": username,
            "pw_hash":  hash_password(password),
        }
        return redirect(url_for("signup_verify"))

    return render_template("signup.html")


@app.route("/signup/verify", methods=["GET", "POST"])
def signup_verify():
    """Step 2: user enters the OTP they received by email."""
    pending = session.get("pending_signup")
    if not pending:
        return redirect(url_for("signup"))

    if request.method == "POST":
        code  = request.form.get("otp", "").strip()
        email = pending["email"]

        ok, msg = verify_otp_session(session, "signup", email, code)
        if not ok:
            return render_template("signup_verify.html", email=email, error=msg)

        # OTP valid → create the account
        if User.query.filter_by(username=pending["username"]).first():
            session.pop("pending_signup", None)
            clear_otp_session(session, "signup")
            return redirect(url_for("signup"))

        new_user = User(
            username      = pending["username"],
            email         = pending["email"],
            password_hash = pending["pw_hash"],
            bio           = f"Hi, I'm {pending['name']}.",
        )
        db.session.add(new_user)
        db.session.commit()

        session.pop("pending_signup", None)
        clear_otp_session(session, "signup")
        session["user_id"] = new_user.id
        return redirect(url_for("dashboard"))

    return render_template("signup_verify.html", email=pending["email"])


@app.route("/signup/resend-otp", methods=["POST"])
def signup_resend_otp():
    pending = session.get("pending_signup")
    if not pending:
        return redirect(url_for("signup"))
    email = pending["email"]
    otp = create_otp_session(session, "signup", email)
    ok, err = send_signup_otp(email, otp)
    if not ok:
        return render_template("signup_verify.html", email=email,
                               error=f"Could not resend email: {err}")
    return render_template("signup_verify.html", email=email,
                           success="A new OTP has been sent to your email.")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


# ---------------------------------------------------------------------------
# Forgot password — OTP via email
# ---------------------------------------------------------------------------

@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    """Step 1: user enters email → receive OTP."""
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        if not email:
            return render_template("forgot_password.html", error="Please enter your email address.")

        user = User.query.filter_by(email=email).first()
        # Always show "sent" message to avoid user-enumeration
        if user:
            otp = create_otp_session(session, "reset", email)
            ok, err = send_reset_otp(email, otp)
            if not ok:
                return render_template("forgot_password.html",
                                       error=f"Could not send email: {err}")
            session["reset_email"] = email

        return render_template(
            "forgot_password.html",
            sent=True,
            email=email,
        )
    return render_template("forgot_password.html")


@app.route("/forgot-password/verify", methods=["GET", "POST"])
def forgot_password_verify():
    """Step 2: user enters OTP → set new password."""
    reset_email = session.get("reset_email")
    if not reset_email:
        return redirect(url_for("forgot_password"))

    if request.method == "POST":
        action = request.form.get("action", "verify")

        if action == "resend":
            otp = create_otp_session(session, "reset", reset_email)
            ok, err = send_reset_otp(reset_email, otp)
            msg = "A new code has been sent." if ok else f"Could not resend: {err}"
            return render_template("forgot_password_verify.html",
                                   email=reset_email, success=msg if ok else None,
                                   error=None if ok else msg)

        code = request.form.get("otp", "").strip()
        new_pw  = request.form.get("new_password", "")
        confirm = request.form.get("confirm_password", "")

        ok, msg = verify_otp_session(session, "reset", reset_email, code)
        if not ok:
            return render_template("forgot_password_verify.html",
                                   email=reset_email, error=msg)

        if len(new_pw) < 6:
            # Re-mark OTP as unused so they can try again with same code
            if session.get("otp_reset"):
                session["otp_reset"]["used"] = False
            return render_template("forgot_password_verify.html",
                                   email=reset_email,
                                   error="Password must be at least 6 characters.")
        if new_pw != confirm:
            if session.get("otp_reset"):
                session["otp_reset"]["used"] = False
            return render_template("forgot_password_verify.html",
                                   email=reset_email,
                                   error="Passwords do not match.")

        user = User.query.filter_by(email=reset_email).first()
        if user:
            user.password_hash = hash_password(new_pw)
            db.session.commit()

        session.pop("reset_email", None)
        clear_otp_session(session, "reset")
        return render_template("forgot_password_verify.html",
                               email=reset_email, done=True)

    return render_template("forgot_password_verify.html", email=reset_email)


# ---------------------------------------------------------------------------
# Main page routes
# ---------------------------------------------------------------------------

@app.route("/dashboard")
@login_required
def dashboard():
    user = current_user()
    return render_template(
        "dashboard.html",
        active_page="dashboard",
        username=user.username if user else "—",
    )


@app.route("/explore")
@login_required
def explore():
    query      = request.args.get("q", "")
    sort       = request.args.get("sort", "latest")
    active_tag = request.args.get("tag", "")
    return render_template(
        "explore.html",
        active_page="explore",
        query=query,
        sort=sort,
        active_tag=active_tag,
    )


@app.route("/create-route")
@app.route("/create_route")
@login_required
def create_route():
    return render_template(
        "create_route.html",
        active_page="create",
        themes=THEMES,
    )


@app.route("/profile")
@login_required
def profile():
    user = current_user()

    follower_count  = Follow.query.filter_by(following_id=user.id).count()
    following_count = Follow.query.filter_by(follower_id=user.id).count()

    return render_template(
        "profile.html",
        active_page="profile",
        username=user.username if user else "—",
        display_name=(user.display_name or user.username) if user else "—",
        bio=user.bio if user else "",
        profile_img=user.profile_img if user else "",
        joined_at=user.joined_at if user else None,
        follower_count=follower_count,
        following_count=following_count,
    )


# ---------------------------------------------------------------------------
# Edit profile
# ---------------------------------------------------------------------------

def _avatar_upload_dir() -> str:
    path = os.path.join(app.root_path, "static", "uploads", "avatars")
    os.makedirs(path, exist_ok=True)
    return path


_ALLOWED_AVATAR_EXT = frozenset({"png", "jpg", "jpeg", "gif", "webp"})
_MAX_AVATAR_BYTES   = 4 * 1024 * 1024   # 4 MB


@app.route("/profile/edit", methods=["GET", "POST"])
@login_required
def profile_edit():
    """Edit display name, bio, and avatar."""
    user = current_user()

    if request.method == "POST":
        display_name = request.form.get("display_name", "").strip()
        bio          = request.form.get("bio", "").strip()
        remove_avatar = request.form.get("remove_avatar") == "1"

        # Validate display name (optional — falls back to username when blank)
        if len(display_name) > 120:
            return render_template(
                "profile_edit.html", active_page="profile", user=user,
                error="Display name must be 120 characters or fewer.",
            )
        if len(bio) > 1000:
            return render_template(
                "profile_edit.html", active_page="profile", user=user,
                error="Bio must be 1000 characters or fewer.",
            )

        # Handle avatar (optional)
        file = request.files.get("avatar")
        new_avatar_rel = None
        if file and file.filename:
            ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
            if ext not in _ALLOWED_AVATAR_EXT:
                return render_template(
                    "profile_edit.html", active_page="profile", user=user,
                    error="Avatar must be PNG, JPG, GIF, or WebP.",
                )
            # Size check — read once, then save
            file.stream.seek(0, os.SEEK_END)
            size = file.stream.tell()
            file.stream.seek(0)
            if size > _MAX_AVATAR_BYTES:
                return render_template(
                    "profile_edit.html", active_page="profile", user=user,
                    error="Avatar must be 4 MB or smaller.",
                )
            safe_base = secure_filename(file.filename.rsplit(".", 1)[0]) or "avatar"
            stored_name = f"u{user.id}_{secrets.token_hex(4)}_{safe_base}.{ext}"
            dest_path = os.path.join(_avatar_upload_dir(), stored_name)
            file.save(dest_path)
            new_avatar_rel = f"uploads/avatars/{stored_name}"

        # Persist
        user.display_name = display_name
        user.bio          = bio
        if new_avatar_rel is not None:
            user.profile_img = new_avatar_rel
        elif remove_avatar:
            user.profile_img = ""
        db.session.commit()

        return render_template(
            "profile_edit.html", active_page="profile", user=user,
            success="Profile updated.",
        )

    return render_template("profile_edit.html", active_page="profile", user=user)


# ---------------------------------------------------------------------------
# Change password
# ---------------------------------------------------------------------------

@app.route("/change-password", methods=["GET", "POST"])
@login_required
def change_password():
    user = current_user()

    if request.method == "POST":
        current_pw = request.form.get("currentPassword", "").strip()
        new_pw     = request.form.get("newPassword",     "")
        confirm_pw = request.form.get("confirmPassword", "")

        if not current_pw:
            return render_template(
                "change_password.html", active_page="profile",
                error="Please enter your current password.",
            )
        if not new_pw:
            return render_template(
                "change_password.html", active_page="profile",
                error="Please enter a new password.",
            )
        if not confirm_pw:
            return render_template(
                "change_password.html", active_page="profile",
                error="Please confirm your new password.",
            )
        if not check_password(current_pw, user.password_hash):
            return render_template(
                "change_password.html", active_page="profile",
                error="Current password is incorrect. Please try again.",
            )
        if len(new_pw) < 6:
            return render_template(
                "change_password.html", active_page="profile",
                error="New password must be at least 6 characters.",
            )
        if new_pw != confirm_pw:
            return render_template(
                "change_password.html", active_page="profile",
                error="New passwords do not match.",
            )

        user.password_hash = hash_password(new_pw)
        db.session.commit()

        return render_template(
            "change_password.html", active_page="profile",
            success="Password updated successfully.",
        )

    return render_template("change_password.html", active_page="profile")

# ---------------------------------------------------------------------------
# User public profile
# ---------------------------------------------------------------------------

@app.route("/user/<username>")
@login_required
def user_profile(username):
    """Public profile page for any user. Redirects to /profile if viewing own page."""
    me = current_user()

    profile_user = User.query.filter_by(username=username).first()
    if not profile_user:
        abort(404)

    # Redirect to own profile if the viewer is the same user
    if me and me.id == profile_user.id:
        return redirect(url_for("profile"))

    follower_count  = Follow.query.filter_by(following_id=profile_user.id).count()
    following_count = Follow.query.filter_by(follower_id=profile_user.id).count()

    is_following  = False
    is_followed_by = False
    if me:
        follow_record = Follow.query.filter_by(
            follower_id  = me.id,
            following_id = profile_user.id,
        ).first()
        is_following = follow_record is not None

        reverse_follow = Follow.query.filter_by(
            follower_id  = profile_user.id,
            following_id = me.id,
        ).first()
        is_followed_by = reverse_follow is not None

    # Mutual follow = both ways. Required to message each other.
    is_mutual = bool(is_following and is_followed_by)

    return render_template(
        "user_profile.html",
        active_page=None,
        profile_user=profile_user,
        is_own_profile=False,
        is_following=is_following,
        is_mutual=is_mutual,
        follower_count=follower_count,
        following_count=following_count,
        user_routes=[],  # Connected after team PR route_service merge
    )

# ---------------------------------------------------------------------------
# Follow / Unfollow
# ---------------------------------------------------------------------------

def _places_upload_dir() -> str:
    path = os.path.join(app.root_path, "static", "uploads", "places")
    os.makedirs(path, exist_ok=True)
    return path


_ALLOWED_PLACE_PHOTO = frozenset({"png", "jpg", "jpeg", "gif", "webp"})


@app.route("/api/routes", methods=["POST"])
@login_required
def api_create_route():
    """Persist a new route with ordered locations (JSON body, session user is author)."""
    user = current_user()
    if user is None:
        return jsonify(ok=False, errors={"": "Not signed in."}), 401
    if not request.is_json:
        return jsonify(ok=False, errors={"": "Send JSON (Content-Type: application/json)."}), 400
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify(ok=False, errors={"": "Invalid JSON body."}), 400
    try:
        route = create_route_from_payload(user.id, body)
    except RouteValidationError as exc:
        return jsonify(ok=False, errors=exc.errors), 400
    except Exception:
        return jsonify(ok=False, errors={"": "Could not save route. Try again."}), 500
    return jsonify(ok=True, route=serialize_route_for_client(route)), 201


@app.route("/api/routes/<int:route_id>", methods=["GET"])
@login_required
def api_get_route(route_id):
    user = current_user()
    if user is None:
        return jsonify(ok=False, error="Not signed in."), 401
    route = get_route_for_viewer(route_id, user.id)
    if route is None:
        return jsonify(ok=False, error="Not found."), 404
    return jsonify(ok=True, route=serialize_route_for_client(route))


@app.route("/api/routes/<int:route_id>", methods=["PATCH", "PUT"])
@login_required
def api_update_route(route_id):
    """Full replace of route fields and ordered locations; author only."""
    user = current_user()
    if user is None:
        return jsonify(ok=False, errors={"": "Not signed in."}), 401
    if not request.is_json:
        return jsonify(ok=False, errors={"": "Send JSON (Content-Type: application/json)."}), 400
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify(ok=False, errors={"": "Invalid JSON body."}), 400
    try:
        route = update_route_for_owner(route_id, user.id, body)
    except ValueError:
        return jsonify(ok=False, error="Not found."), 404
    except RouteOwnershipError:
        return jsonify(ok=False, error="Forbidden."), 403
    except RouteValidationError as exc:
        return jsonify(ok=False, errors=exc.errors), 400
    except Exception:
        return jsonify(ok=False, errors={"": "Could not update route. Try again."}), 500
    return jsonify(ok=True, route=serialize_route_for_client(route))


@app.route("/api/routes/<int:route_id>", methods=["DELETE"])
@login_required
def api_delete_route(route_id):
    """Remove route and stops; author only."""
    user = current_user()
    if user is None:
        return jsonify(ok=False, error="Not signed in."), 401
    try:
        deleted = delete_route_for_owner(route_id, user.id)
    except RouteOwnershipError:
        return jsonify(ok=False, error="Forbidden."), 403
    except Exception:
        return jsonify(ok=False, error="Could not delete route. Try again."), 500
    if not deleted:
        return jsonify(ok=False, error="Not found."), 404
    return jsonify(ok=True)


@app.route("/api/routes/<int:route_id>/duplicate", methods=["POST"])
@login_required
def api_duplicate_route(route_id):
    user = current_user()
    if user is None:
        return jsonify(ok=False, error="Not signed in."), 401
    source_route = get_route_for_viewer(route_id, user.id)
    if source_route is None:
        return jsonify(ok=False, error="Not found."), 404
    try:
        cloned = duplicate_route_for_user(route_id, user.id)
    except Exception:
        return jsonify(ok=False, error="Could not duplicate route. Try again."), 500
    if cloned is None:
        return jsonify(ok=False, error="Not found."), 404
    return jsonify(ok=True, route=serialize_route_for_client(cloned)), 201


@app.route("/api/my-routes", methods=["GET"])
@login_required
def api_list_my_routes():
    user = current_user()
    if user is None:
        return jsonify(ok=False, error="Not signed in."), 401
    routes = list_routes_for_author(user.id)
    return jsonify(ok=True, routes=[serialize_route_for_client(route) for route in routes])


@app.route("/api/routes/public", methods=["GET"])
@login_required
def api_list_public_routes():
    """Public routes for explore/dashboard with optional search, sort, and tag filtering."""
    user = current_user()
    if user is None:
        return jsonify(ok=False, error="Not signed in."), 401

    q       = request.args.get("q",    "").strip().lower()
    sort    = request.args.get("sort", "latest")
    tag     = request.args.get("tag",  "").strip().lower()
    theme   = request.args.get("theme","").strip().lower()

    routes = list_public_routes()

    # Filter by keyword (title, description, tags)
    if q:
        routes = [
            r for r in routes
            if q in r.title.lower()
            or q in (r.description or "").lower()
            or any(q in t.lower() for t in (r.tags or []))
        ]

    # Filter by tag
    if tag:
        routes = [r for r in routes if tag in [t.lower() for t in (r.tags or [])]]

    # Filter by theme
    if theme:
        routes = [r for r in routes if (r.theme or "").lower() == theme]

    # Sort
    if sort == "liked":
        routes = sorted(routes, key=lambda r: 0, reverse=True)  # likes field added later
    else:
        routes = sorted(routes, key=lambda r: r.created_at, reverse=True)

    return jsonify(ok=True, routes=[serialize_route_for_client(route) for route in routes])


@app.route("/api/uploads/place-photo", methods=["POST"])
@login_required
def api_upload_place_photo():
    """Store one image for a route stop; returns a URL path under /static/."""
    if current_user() is None:
        return jsonify(ok=False, error="Not signed in."), 401
    file = request.files.get("file")
    if file is None or file.filename == "":
        return jsonify(ok=False, error="Choose an image file."), 400
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in _ALLOWED_PLACE_PHOTO:
        return jsonify(ok=False, error="Use PNG, JPG, GIF, or WebP."), 400
    safe_base = secure_filename(file.filename.rsplit(".", 1)[0]) or "photo"
    stored_name = f"{secrets.token_hex(6)}_{safe_base}.{ext}"
    dest_dir = _places_upload_dir()
    dest_path = os.path.join(dest_dir, stored_name)
    file.save(dest_path)
    rel = f"uploads/places/{stored_name}"
    return jsonify(ok=True, url=url_for("static", filename=rel))


@app.route("/follow/<username>", methods=["POST"])
@login_required
def follow_user(username):
    """
    Toggle follow state between the current user and the target user.
    Returns JSON with updated is_following and follower_count.
    """
    me = current_user()
    if me is None:
        return jsonify(ok=False, error="Not signed in."), 401

    profile_user = User.query.filter_by(username=username).first()
    if not profile_user:
        return jsonify(ok=False, error="User not found."), 404

    if me.id == profile_user.id:
        return jsonify(ok=False, error="You cannot follow yourself."), 400

    existing = Follow.query.filter_by(
        follower_id  = me.id,
        following_id = profile_user.id,
    ).first()

    if existing:
        # Unfollow — remove the Follow row
        db.session.delete(existing)
        db.session.commit()
        is_following = False
    else:
        # Follow — create Follow row and a follow Notification
        new_follow = Follow(
            follower_id  = me.id,
            following_id = profile_user.id,
        )
        db.session.add(new_follow)

        notification = Notification(
            recipient_id = profile_user.id,
            sender_id    = me.id,
            type         = "follow",
        )
        db.session.add(notification)
        db.session.commit()
        is_following = True

    follower_count = Follow.query.filter_by(following_id=profile_user.id).count()

    return jsonify(
        ok=True,
        is_following=is_following,
        follower_count=follower_count,
    )

# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

@app.route("/notifications")
@login_required
def notifications():
    """List all notifications for the current user, newest first."""
    user = current_user()

    notifs = (
        Notification.query
        .filter_by(recipient_id=user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )

    # Attach sender User objects for display
    sender_ids = {n.sender_id for n in notifs if n.sender_id}
    senders    = {u.id: u for u in User.query.filter(User.id.in_(sender_ids)).all()}

    notifications_with_sender = [
        {"notification": n, "sender": senders.get(n.sender_id)}
        for n in notifs
    ]

    unread_count = sum(1 for n in notifs if not n.is_read)

    return render_template(
        "notifications.html",
        active_page="notifications",
        notifications_with_sender=notifications_with_sender,
        unread_count=unread_count,
    )


@app.route("/notifications/read", methods=["POST"])
@login_required
def notification_read():
    """Mark a single notification as read. Accepts JSON body: {notification_id: int}."""
    user = current_user()
    data = request.get_json(silent=True) or {}
    notif_id = data.get("notification_id")

    if not notif_id:
        return jsonify(ok=False, error="notification_id is required."), 400

    notif = Notification.query.filter_by(
        id           = notif_id,
        recipient_id = user.id,
    ).first()

    if not notif:
        return jsonify(ok=False, error="Notification not found."), 404

    notif.is_read = True
    db.session.commit()

    return jsonify(ok=True)


@app.route("/notifications/read-all", methods=["POST"])
@login_required
def notification_read_all():
    """Mark all notifications for the current user as read."""
    user = current_user()

    Notification.query.filter_by(
        recipient_id = user.id,
        is_read      = False,
    ).update({"is_read": True})

    db.session.commit()

    return jsonify(ok=True)


# ---------------------------------------------------------------------------
# Real-time polling endpoint
# ---------------------------------------------------------------------------

@app.route("/api/notifications/poll", methods=["GET"])
@login_required
def api_notifications_poll():
    """
    Returns recent unread notifications + total unread counts.
    The client polls this every ~10s while a tab is open to show toasts and
    update the bell / message badges without a page reload.

    Query string:
      since_id   — only return notifications with id > since_id (int, optional)
    """
    user = current_user()
    if user is None:
        return jsonify(ok=False, error="Not signed in."), 401

    try:
        since_id = int(request.args.get("since_id", "0"))
    except ValueError:
        since_id = 0

    q = Notification.query.filter_by(recipient_id=user.id, is_read=False)
    if since_id > 0:
        q = q.filter(Notification.id > since_id)
    new_notifs = q.order_by(Notification.created_at.asc()).limit(20).all()

    # Resolve sender usernames for display (one query for all senders)
    sender_ids = {n.sender_id for n in new_notifs if n.sender_id}
    senders    = {u.id: u for u in User.query.filter(User.id.in_(sender_ids)).all()}

    new_items = []
    for n in new_notifs:
        sender = senders.get(n.sender_id) if n.sender_id else None
        new_items.append({
            "id":         n.id,
            "type":       n.type,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "sender":     {
                "username":     sender.username if sender else None,
                "display_name": (sender.display_name or sender.username) if sender else None,
            } if sender else None,
        })

    unread_notif_count = Notification.query.filter_by(
        recipient_id=user.id, is_read=False,
    ).count()
    unread_msg_count = Message.query.filter_by(
        recipient_id=user.id, is_read=False,
    ).count()

    return jsonify(
        ok=True,
        new_notifications=new_items,
        unread_notif_count=unread_notif_count,
        unread_msg_count=unread_msg_count,
    )


# ---------------------------------------------------------------------------
# Direct messages (1-to-1, mutual followers only)
# ---------------------------------------------------------------------------

def _are_mutual(user_a: User, user_b: User) -> bool:
    """True iff user_a follows user_b AND user_b follows user_a."""
    if user_a.id == user_b.id:
        return False
    a_follows_b = Follow.query.filter_by(
        follower_id=user_a.id, following_id=user_b.id,
    ).first() is not None
    b_follows_a = Follow.query.filter_by(
        follower_id=user_b.id, following_id=user_a.id,
    ).first() is not None
    return a_follows_b and b_follows_a


def _conversation_partners(user: User):
    """
    Return all users this person has exchanged messages with, paired with the
    latest message in that conversation. Used to render the inbox list.
    """
    # Gather all messages involving this user, newest first.
    msgs = (
        Message.query
        .filter((Message.sender_id == user.id) | (Message.recipient_id == user.id))
        .order_by(Message.created_at.desc())
        .all()
    )

    # Bucket each conversation under the *other* user's id; keep first (newest) msg.
    seen = {}
    for m in msgs:
        other_id = m.recipient_id if m.sender_id == user.id else m.sender_id
        if other_id in seen:
            continue
        seen[other_id] = m

    # Hydrate users + unread counts
    if not seen:
        return []
    other_ids = list(seen.keys())
    users     = {u.id: u for u in User.query.filter(User.id.in_(other_ids)).all()}

    convos = []
    for other_id, last_msg in seen.items():
        other = users.get(other_id)
        if not other:
            continue
        unread = Message.query.filter_by(
            sender_id=other_id, recipient_id=user.id, is_read=False,
        ).count()
        convos.append({
            "other":    other,
            "last_msg": last_msg,
            "unread":   unread,
        })

    # Sort by latest activity, newest first
    convos.sort(key=lambda c: c["last_msg"].created_at, reverse=True)
    return convos


@app.route("/messages")
@login_required
def messages_inbox():
    """List of conversations (one row per partner, newest first)."""
    user = current_user()
    convos = _conversation_partners(user)
    return render_template(
        "messages.html",
        active_page="messages",
        convos=convos,
    )


@app.route("/messages/<username>")
@login_required
def conversation(username):
    """Thread view for one conversation. Marks incoming messages as read."""
    me = current_user()

    other = User.query.filter_by(username=username).first()
    if not other:
        abort(404)
    if other.id == me.id:
        return redirect(url_for("messages_inbox"))

    is_mutual = _are_mutual(me, other)

    # Load full thread (both directions)
    thread = (
        Message.query
        .filter(
            ((Message.sender_id == me.id)    & (Message.recipient_id == other.id)) |
            ((Message.sender_id == other.id) & (Message.recipient_id == me.id))
        )
        .order_by(Message.created_at.asc())
        .all()
    )

    # Mark incoming as read on view
    Message.query.filter_by(
        sender_id=other.id, recipient_id=me.id, is_read=False,
    ).update({"is_read": True})
    db.session.commit()

    return render_template(
        "conversation.html",
        active_page="messages",
        other=other,
        is_mutual=is_mutual,
        thread=thread,
    )


@app.route("/api/messages/<username>", methods=["POST"])
@login_required
def api_send_message(username):
    """Send a single message. Both users must be mutual followers."""
    me = current_user()
    if me is None:
        return jsonify(ok=False, error="Not signed in."), 401

    other = User.query.filter_by(username=username).first()
    if not other:
        return jsonify(ok=False, error="User not found."), 404
    if other.id == me.id:
        return jsonify(ok=False, error="You cannot message yourself."), 400

    if not _are_mutual(me, other):
        return jsonify(
            ok=False,
            error="You can only message users you mutually follow.",
        ), 403

    data = request.get_json(silent=True) or {}
    body = (data.get("body") or "").strip()
    if not body:
        return jsonify(ok=False, error="Message cannot be empty."), 400
    if len(body) > 4000:
        return jsonify(ok=False, error="Message is too long (max 4000 chars)."), 400

    msg = Message(sender_id=me.id, recipient_id=other.id, body=body)
    db.session.add(msg)

    # Also drop a 'message' notification so the bell badge updates and the
    # recipient sees a toast next time they poll.
    notif = Notification(
        recipient_id=other.id,
        sender_id=me.id,
        type="message",
    )
    db.session.add(notif)
    db.session.commit()

    return jsonify(
        ok=True,
        message={
            "id":         msg.id,
            "body":       msg.body,
            "sender":     me.username,
            "recipient":  other.username,
            "created_at": msg.created_at.isoformat(),
        },
    ), 201


@app.route("/api/messages/<username>", methods=["GET"])
@login_required
def api_get_messages(username):
    """
    Fetch messages with `username` newer than ?since_id=<int>.
    Used by the conversation page to poll for incoming messages.
    """
    me = current_user()
    if me is None:
        return jsonify(ok=False, error="Not signed in."), 401

    other = User.query.filter_by(username=username).first()
    if not other:
        return jsonify(ok=False, error="User not found."), 404

    try:
        since_id = int(request.args.get("since_id", "0"))
    except ValueError:
        since_id = 0

    q = Message.query.filter(
        ((Message.sender_id == me.id)    & (Message.recipient_id == other.id)) |
        ((Message.sender_id == other.id) & (Message.recipient_id == me.id))
    )
    if since_id > 0:
        q = q.filter(Message.id > since_id)
    msgs = q.order_by(Message.created_at.asc()).limit(100).all()

    # Mark incoming-from-other as read on poll too (so badge updates accurately)
    if msgs:
        Message.query.filter_by(
            sender_id=other.id, recipient_id=me.id, is_read=False,
        ).update({"is_read": True})
        db.session.commit()

    return jsonify(
        ok=True,
        messages=[
            {
                "id":         m.id,
                "body":       m.body,
                "sender":     "me" if m.sender_id == me.id else other.username,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in msgs
        ],
    )


@app.route("/route/<route_id>")
@login_required
def route_detail(route_id):
    user = current_user()
    if route_id.isdigit():
        rid = int(route_id)
        route_obj = get_route_for_viewer(rid, user.id if user else None)
        if route_obj is None:
            abort(404)
        author_username = route_obj.author.username if route_obj.author else "—"
        route_payload = serialize_route_for_client(route_obj)
        route_dict = {
            "id":          str(route_obj.id),
            "title":       route_obj.title,
            "theme":       route_obj.theme,
            "author":      author_username,
            "meta":        f"{len(route_obj.locations)} stops · public" if route_obj.is_public else f"{len(route_obj.locations)} stops · private",
            "description": route_obj.description,
            "tags":        list(route_obj.tags or []),
        }
        is_owner = bool(user and route_obj.author_id == user.id)
        return render_template(
            "route.html",
            active_page=None,
            route=route_dict,
            route_json=route_payload,
            is_owner=is_owner,
            comments=[],
        )

    mock_route = {
        "id":          route_id,
        "title":       "Perth First Date",
        "theme":       "first date",
        "author":      "alex",
        "meta":        "3 stops · 5h · public",
        "description": "A curated first-date day in Perth — coffee, sunset, and good vibes.",
        "tags":        ["date", "cheap", "sunset"],
    }
    is_owner = (user.username == mock_route["author"]) if user else False
    return render_template(
        "route.html",
        active_page=None,
        route=mock_route,
        route_json=None,
        is_owner=is_owner,
        comments=[],
    )


# ---------------------------------------------------------------------------
# Legacy page redirects
# ---------------------------------------------------------------------------

@app.route("/pages/login.html")
def legacy_login_page():
    return redirect(url_for("login"))


@app.route("/pages/signup.html")
def legacy_signup_page():
    return redirect(url_for("signup"))


@app.route("/pages/dashboard.html")
def legacy_dashboard_page():
    return redirect(url_for("dashboard"))


@app.route("/pages/explore.html")
def legacy_explore_page():
    return redirect(url_for("explore"))


@app.route("/pages/profile.html")
def legacy_profile_page():
    return redirect(url_for("profile"))


@app.route("/pages/create-route.html")
def legacy_create_route_page():
    route_id = request.args.get("r")
    mode     = request.args.get("mode")
    if route_id and mode:
        return redirect(url_for("create_route", r=route_id, mode=mode))
    if route_id:
        return redirect(url_for("create_route", r=route_id))
    return redirect(url_for("create_route"))


@app.route("/pages/route.html")
def legacy_route_page():
    route_id = request.args.get("r")
    if route_id:
        return redirect(url_for("dashboard"))
    return redirect(url_for("dashboard"))


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True)