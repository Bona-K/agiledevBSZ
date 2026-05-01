from flask import Flask, render_template, redirect, url_for, request, session
from functools import wraps
from models import db, User
from utils import hash_password, check_password

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
# Mock data (기존 JS 프론트 호환용)
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
    """
    모든 템플릿에 current_user 객체와 server_username을 주입한다.
    - current_user    : User 객체 또는 None
    - server_username : 기존 템플릿 호환용 문자열
    """
    user = current_user()
    return {
        "current_user":    user,
        "server_username": user.username if user else None,
    }


def login_required(f):
    """
    session["user_id"] 기준으로 인증 여부를 판단한다.
    미인증 시 login 페이지로 리다이렉트한다.
    """
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


@app.route("/change-password", methods=["GET"])
@login_required
def change_password():
    # POST 처리는 Issue 9에서 구현 예정
    return render_template(
        "change_password.html",
        active_page="profile",
    )


@app.route("/route/<route_id>")
@login_required
def route_detail(route_id):
    user = current_user()

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