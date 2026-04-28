from flask import Flask, render_template, redirect, url_for, request, session
from functools import wraps
from models import db, User

app = Flask(__name__)
app.secret_key = "myvibe-dev-secret-change-in-production"

# ---------------------------------------------------------------------------
# Database configuration
# ---------------------------------------------------------------------------

app.config["SQLALCHEMY_DATABASE_URI"]        = "sqlite:///myvibe.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    db.create_all()

# ---------------------------------------------------------------------------
# Mock data (기존 JS 프론트 호환용 — 추후 DB로 교체)
# ---------------------------------------------------------------------------

DEMO_USERS = {"alex", "mina", "sam"}

THEMES = ["first date", "picnic", "active day", "hidden gems"]

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def current_user():
    """
    session["user_id"] 로 DB에서 User 객체를 조회해 반환한다.
    세션이 없거나 DB에 없으면 None을 반환한다.

    NOTE: mock 로그인 구간(Issue 4 이전)에서는 user_id가 0으로 저장되므로
          DB 조회 결과가 None이 되며, 템플릿에는 server_username을 별도 주입한다.
    """
    user_id = session.get("user_id")
    if not user_id:
        return None
    return User.query.get(user_id)


@app.context_processor
def inject_template_globals():
    """
    모든 템플릿에 current_user 객체와 server_username을 주입한다.
    - current_user : User 객체 또는 None
    - server_username : 기존 템플릿 호환용 문자열 (username 또는 None)
    """
    user = current_user()
    # mock 구간에서는 session에 _mock_username을 함께 저장해 호환성 유지
    mock_username = session.get("_mock_username")
    server_username = user.username if user else mock_username
    return {
        "current_user":    user,
        "server_username": server_username,
    }


def login_required(f):
    """
    session["user_id"] 기준으로 인증 여부를 판단한다.
    미인증 시 login 페이지로 리다이렉트한다.

    NOTE: mock 구간에서는 user_id=0 으로 저장하므로
          0도 로그인된 상태로 간주한다.
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

        # ---------------------------------------------------------------
        # Mock auth — Issue 4에서 실제 DB 인증으로 교체 예정
        # user_id=0 은 mock 전용 임시값
        # ---------------------------------------------------------------
        session["user_id"]       = 0
        session["_mock_username"] = username
        return redirect(url_for("dashboard"))

    return render_template("login.html")


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        username = request.form.get("suEmail", "").strip().lower()
        password = request.form.get("suPassword", "")
        confirm  = request.form.get("suPassword2", "")

        if not username:
            return render_template("signup.html", error="Please enter a username.")
        if len(password) < 6:
            return render_template("signup.html", error="Password must be at least 6 characters.")
        if password != confirm:
            return render_template("signup.html", error="Passwords do not match.")

        # ---------------------------------------------------------------
        # Mock — Issue 6에서 실제 DB 저장으로 교체 예정
        # ---------------------------------------------------------------
        session["user_id"]       = 0
        session["_mock_username"] = username
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
    username = user.username if user else session.get("_mock_username", "—")
    return render_template(
        "dashboard.html",
        active_page="dashboard",
        username=username,
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
    username = user.username if user else session.get("_mock_username", "—")
    return render_template(
        "profile.html",
        active_page="profile",
        username=username,
    )


@app.route("/route/<route_id>")
@login_required
def route_detail(route_id):
    user = current_user()
    mock_username = session.get("_mock_username", "")

    mock_route = {
        "id":          route_id,
        "title":       "Perth First Date",
        "theme":       "first date",
        "author":      "alex",
        "meta":        "3 stops · 5h · public",
        "description": "A curated first-date day in Perth — coffee, sunset, and good vibes.",
        "tags":        ["date", "cheap", "sunset"],
    }
    author_name = user.username if user else mock_username
    is_owner = (author_name == mock_route["author"])
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