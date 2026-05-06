from flask import Flask, abort, jsonify, redirect, render_template, request, session, url_for
from functools import wraps

from models import db, User, Follow, Notification
from utils import check_password, hash_password

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

    follower_count  = Follow.query.filter_by(following_id=user.id).count()
    following_count = Follow.query.filter_by(follower_id=user.id).count()

    return render_template(
        "profile.html",
        active_page="profile",
        username=user.username if user else "—",
        follower_count=follower_count,
        following_count=following_count,
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
    me = current_user()

    profile_user = User.query.filter_by(username=username).first()
    if not profile_user:
        abort(404)

    if me and me.id == profile_user.id:
        return redirect(url_for("profile"))

    follower_count  = Follow.query.filter_by(following_id=profile_user.id).count()
    following_count = Follow.query.filter_by(follower_id=profile_user.id).count()

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
        user_routes=[],  # route_service는 팀원 PR 머지 후 연결
    )


@app.route("/follow/<username>", methods=["POST"])
@login_required
def follow_user(username):
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
        db.session.delete(existing)
        db.session.commit()
        is_following = False
    else:
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