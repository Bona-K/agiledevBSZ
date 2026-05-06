import os
import secrets

from flask import Flask, abort, jsonify, redirect, render_template, request, session, url_for
from functools import wraps
from werkzeug.utils import secure_filename

from models import db, User
from route_service import (
    RouteValidationError,
    create_route_from_payload,
    get_route_for_viewer,
    serialize_route_for_client,
)
from utils import check_password, hash_password
from flask import Flask, render_template, redirect, url_for, request, session, abort
from functools import wraps
from models import db, User, Follow
from utils import hash_password, check_password
from route_service import list_routes_for_author

app = Flask(__name__)
app.secret_key = "myvibe-dev-secret-change-in-production"

# ---------------------------------------------------------------------------
# Database configuration
# ---------------------------------------------------------------------------

app.config["SQLALCHEMY_DATABASE_URI"]        = "sqlite:///myvibe.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

# ---------------------------------------------------------------------------
# Demo user seed
# ---------------------------------------------------------------------------

def seed_demo_users():
    """
    데모 계정 (alex / mina / sam) 을 DB에 삽입한다.
    이미 존재하는 계정은 건너뛴다.
    비밀번호는 모두 'password123' 으로 통일 (데모용).
    """
    demo_accounts = [
        {
            "username": "alex",
            "email":    "alex@myvibe.demo",
            "password": "password123",
            "bio":      "Hi, I'm Alex. I love exploring the city.",
        },
        {
            "username": "mina",
            "email":    "mina@myvibe.demo",
            "password": "password123",
            "bio":      "Mina here — always looking for the next great route.",
        },
        {
            "username": "sam",
            "email":    "sam@myvibe.demo",
            "password": "password123",
            "bio":      "Sam — coffee and sunset chaser.",
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


with app.app_context():
    db.create_all()
    seed_demo_users()

# ---------------------------------------------------------------------------
# Mock data
# ---------------------------------------------------------------------------

THEMES = ["first date", "picnic", "active day", "hidden gems"]

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def current_user():
    """
    session["user_id"] 로 DB에서 User 객체를 조회해 반환한다.
    세션이 없거나 DB에 없으면 None을 반환한다.
    """
    user_id = session.get("user_id")
    if not user_id:
        return None
    return User.query.get(user_id)


@app.context_processor
def inject_template_globals():
    user = current_user()
    return {
        "current_user":    user,
        "server_username": user.username if user else None,
        "myvibe_bootstrap": {
            "isAuthenticated": user is not None,
            "username":        user.username if user else None,
            "userId":          user.id if user else None,
        },
    }


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get("user_id") is None:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

# ---------------------------------------------------------------------------
# Routes
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

        new_user = User(
            username      = username,
            email         = email,
            password_hash = hash_password(password),
            bio           = f"Hi, I'm {name}.",
        )
        db.session.add(new_user)
        db.session.commit()

        session["user_id"] = new_user.id
        return redirect(url_for("dashboard"))

    return render_template("signup.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


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
    return render_template(
        "profile.html",
        active_page="profile",
        username=user.username if user else "—",
    )


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


@app.route("/user/<username>")
@login_required
def user_profile(username):
    """
    유저 공개 프로필 페이지.
    - 유저 정보, 공개 루트, 팔로워/팔로잉 수, 팔로우 여부를 DB에서 조회한다.
    """
    me = current_user()

    # 존재하지 않는 유저 → 404
    profile_user = User.query.filter_by(username=username).first()
    if not profile_user:
        abort(404)

    # 본인 프로필 접근 → /profile 리다이렉트
    if me and me.id == profile_user.id:
        return redirect(url_for("profile"))

    # -------------------------------------------------------------------
    # 공개 루트 목록 조회 (route_service 활용, is_public=True 필터)
    # -------------------------------------------------------------------
    all_routes  = list_routes_for_author(profile_user.id)
    user_routes = [r for r in all_routes if r.is_public]

    # -------------------------------------------------------------------
    # 팔로워 / 팔로잉 수 조회
    # -------------------------------------------------------------------
    follower_count  = Follow.query.filter_by(following_id=profile_user.id).count()
    following_count = Follow.query.filter_by(follower_id=profile_user.id).count()

    # -------------------------------------------------------------------
    # 현재 유저의 팔로우 여부 확인
    # -------------------------------------------------------------------
    is_following = False
    if me:
        follow_record = Follow.query.filter_by(
            follower_id  = me.id,
            following_id = profile_user.id,
        ).first()
        is_following = follow_record is not None

    return render_template(
        "user_profile.html",
        active_page=None,
        profile_user=profile_user,
        is_own_profile=False,
        is_following=is_following,
        follower_count=follower_count,
        following_count=following_count,
        user_routes=user_routes,
    )


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
        return redirect(url_for("route_detail", route_id=route_id))
    return redirect(url_for("dashboard"))


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True)