"""
tests/test_selenium.py — 8 Selenium tests for the combined MyVibe project.

Prerequisites:
    pip install selenium

You also need ONE of:
    - Google Chrome / Chromium installed (test driver autodetects via Selenium 4+ Selenium Manager)
    - Firefox installed (set BROWSER=firefox env var)

How the live server works:
    These tests spin up the Flask app in a background thread bound to
    127.0.0.1 on an unused port. A fresh SQLite DB is created per test class
    and torn down afterward. No real network or email is used — OTPs are
    pulled directly from the Flask session via a hidden /test/peek-otp/<email>
    route that is registered only when TESTING is on.

Run all 8 tests:
    python -m unittest tests.test_selenium -v

Run just one:
    python -m unittest tests.test_selenium.LoginRejectsBadPasswordTest -v

Headed mode (watch the browser):
    HEADLESS=0 python -m unittest tests.test_selenium -v
"""

import os
import socket
import sys
import tempfile
import threading
import time
import unittest
from urllib.parse import urlparse

# Project root on sys.path
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Force OTPs to dev-mode so we don't try to hit Gmail
os.environ["MAIL_USERNAME"] = ""
os.environ["MAIL_PASSWORD"] = ""
os.environ["FLASK_SECRET_KEY"] = "test-secret"

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException


# ─────────────────────────────────────────────────────────────────────────────
# Live-server harness — one shared server per test class, fresh DB each class
# ─────────────────────────────────────────────────────────────────────────────

def _pick_free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _make_driver():
    """Build a headless Chrome driver (or Firefox via BROWSER=firefox)."""
    headless = os.environ.get("HEADLESS", "1") != "0"
    browser  = os.environ.get("BROWSER", "chrome").lower()

    if browser == "firefox":
        opts = webdriver.FirefoxOptions()
        if headless:
            opts.add_argument("-headless")
        return webdriver.Firefox(options=opts)

    opts = webdriver.ChromeOptions()
    if headless:
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1280,900")
    return webdriver.Chrome(options=opts)


class SeleniumTestBase(unittest.TestCase):
    """One Flask server + one driver per test class. Fresh DB per class."""

    @classmethod
    def setUpClass(cls):
        # Fresh DB
        cls.db_fd, cls.db_path = tempfile.mkstemp(suffix=".db")
        os.environ["DATABASE_URL"] = f"sqlite:///{cls.db_path}"

        # (Re)import app cleanly so the DB env var is read fresh
        import importlib
        if "app" in sys.modules:
            importlib.reload(sys.modules["app"])
        import app as app_module

        cls.app_module = app_module
        cls.app = app_module.app
        cls.app.config["TESTING"] = True

        # ── Test-only routes for peeking OTPs and seeding mutual follows ────
        # These exist only on the live test server; not in production.
        @cls.app.route("/test/peek-otp/<purpose>/<email>")
        def _peek_otp(purpose, email):  # pragma: no cover - test only
            from flask import session, jsonify
            entry = session.get(f"otp_{purpose}")
            if entry and entry.get("email", "").lower() == email.lower():
                return jsonify(ok=True, code=entry["code"])
            return jsonify(ok=False), 404

        @cls.app.route("/test/seed-user/<username>", methods=["POST"])
        def _seed_user(username):  # pragma: no cover - test only
            from flask import jsonify
            from models import db, User
            from utils import hash_password
            existing = User.query.filter_by(username=username).first()
            if existing:
                return jsonify(ok=True, existed=True, user_id=existing.id)
            u = User(
                username      = username,
                email         = f"{username}@example.com",
                password_hash = hash_password("password123"),
                bio           = f"Hi, I'm {username}.",
            )
            db.session.add(u); db.session.commit()
            return jsonify(ok=True, existed=False, user_id=u.id)

        @cls.app.route("/test/make-mutual/<a>/<b>", methods=["POST"])
        def _make_mutual(a, b):  # pragma: no cover - test only
            from flask import jsonify
            from models import db, User, Follow
            ua = User.query.filter_by(username=a).first()
            ub = User.query.filter_by(username=b).first()
            if not ua or not ub:
                return jsonify(ok=False, error="user-missing"), 404
            for fa, fb in [(ua.id, ub.id), (ub.id, ua.id)]:
                exists = Follow.query.filter_by(follower_id=fa, following_id=fb).first()
                if not exists:
                    db.session.add(Follow(follower_id=fa, following_id=fb))
            db.session.commit()
            return jsonify(ok=True)

        # ── Boot the Flask dev server in a background thread ─────────────────
        cls.port = _pick_free_port()
        cls.base_url = f"http://127.0.0.1:{cls.port}"

        def _run():
            cls.app.run(host="127.0.0.1", port=cls.port, debug=False,
                        use_reloader=False, threaded=True)

        cls.server_thread = threading.Thread(target=_run, daemon=True)
        cls.server_thread.start()
        cls._wait_for_server()

        # ── Browser driver ──────────────────────────────────────────────────
        cls.driver = _make_driver()
        cls.driver.implicitly_wait(2)
        cls.wait = WebDriverWait(cls.driver, 10)

    @classmethod
    def tearDownClass(cls):
        try:
            cls.driver.quit()
        except Exception:
            pass
        # Flask dev server thread is daemon — process exit will clean it up.
        os.close(cls.db_fd)
        if os.path.exists(cls.db_path):
            os.unlink(cls.db_path)

    @classmethod
    def _wait_for_server(cls, timeout=10):
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                s = socket.create_connection(("127.0.0.1", cls.port), timeout=0.5)
                s.close()
                return
            except OSError:
                time.sleep(0.1)
        raise RuntimeError(f"Flask server didn't come up on port {cls.port}")

    # ── Helpers ──────────────────────────────────────────────────────────────

    def go(self, path):
        self.driver.get(self.base_url + path)

    def find(self, css):
        return self.driver.find_element(By.CSS_SELECTOR, css)

    def login(self, username, password="password123"):
        """Drive the login form for the given user."""
        self.go("/login")
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='username']")))
        self.find("input[name='username']").send_keys(username)
        self.find("input[name='password']").send_keys(password)
        self.find("button[type='submit'], #loginBtn").click()
        self.wait.until(lambda d: "/login" not in d.current_url)

    def seed_user(self, username):
        """Create a user with password=password123 via the test endpoint."""
        import urllib.request
        req = urllib.request.Request(
            self.base_url + f"/test/seed-user/{username}",
            method="POST",
        )
        urllib.request.urlopen(req).read()

    def make_mutual(self, a, b):
        import urllib.request
        req = urllib.request.Request(
            self.base_url + f"/test/make-mutual/{a}/{b}",
            method="POST",
        )
        urllib.request.urlopen(req).read()


# ─────────────────────────────────────────────────────────────────────────────
# 1. Landing page loads
# ─────────────────────────────────────────────────────────────────────────────

class LandingPageTest(SeleniumTestBase):
    def test_landing_renders_with_login_link(self):
        """The landing page should load and show a path to /login."""
        self.go("/")
        # Landing page renders something with "MyVibe" in the title or body
        self.assertIn("MyVibe", self.driver.title)
        # And there should be at least one link/button taking the user to /login
        login_links = self.driver.find_elements(By.CSS_SELECTOR, "a[href*='/login']")
        self.assertGreater(
            len(login_links), 0,
            "Landing page should have at least one link to the login page.",
        )


# ─────────────────────────────────────────────────────────────────────────────
# 2. Signup form sends user to OTP verify step
# ─────────────────────────────────────────────────────────────────────────────

class SignupRedirectsToOtpVerifyTest(SeleniumTestBase):
    def test_signup_form_redirects_to_verify(self):
        self.go("/signup")
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='suEmail']")))

        self.find("input[name='suName']").send_keys("Selenium User")
        self.find("input[name='suEmail']").send_keys("seleniumuser@example.com")
        self.find("input[name='suUsername']").send_keys("seleniumuser")
        self.find("input[name='suPassword']").send_keys("secret123")
        self.find("input[name='suPassword2']").send_keys("secret123")
        self.find("button[type='submit']").click()

        # Should land on /signup/verify
        self.wait.until(EC.url_contains("/signup/verify"))
        self.assertIn("/signup/verify", self.driver.current_url)

        # And the OTP entry field should be visible
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='otp']")))


# ─────────────────────────────────────────────────────────────────────────────
# 3. Login with valid credentials reaches dashboard
# ─────────────────────────────────────────────────────────────────────────────

class ValidLoginReachesDashboardTest(SeleniumTestBase):
    def test_valid_login_reaches_dashboard(self):
        self.seed_user("alice")
        self.login("alice")
        self.assertIn("/dashboard", self.driver.current_url)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Wrong password shows server-side error
# ─────────────────────────────────────────────────────────────────────────────

class LoginRejectsBadPasswordTest(SeleniumTestBase):
    def test_wrong_password_shows_error(self):
        self.seed_user("bob")

        self.go("/login")
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='username']")))
        self.find("input[name='username']").send_keys("bob")
        self.find("input[name='password']").send_keys("definitely-not-the-password")
        self.find("button[type='submit'], #loginBtn").click()

        # We should still be on /login and see "Incorrect password"
        self.assertIn("/login", self.driver.current_url)
        body_text = self.driver.find_element(By.TAG_NAME, "body").text
        self.assertIn("Incorrect password", body_text)


# ─────────────────────────────────────────────────────────────────────────────
# 5. Edit profile persists display_name and bio across reload
# ─────────────────────────────────────────────────────────────────────────────

class EditProfilePersistsTest(SeleniumTestBase):
    def test_edit_profile_updates_visible_fields(self):
        self.seed_user("carol")
        self.login("carol")

        self.go("/profile/edit")
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='display_name']")))

        # Clear and type a new display name + bio
        dn = self.find("input[name='display_name']")
        dn.clear(); dn.send_keys("Carol the Cartographer")

        bio = self.find("textarea[name='bio']")
        bio.clear(); bio.send_keys("Map nerd. Long walks at sunset.")

        self.find("button[type='submit']").click()

        # Wait for the success banner
        self.wait.until(lambda d: "Profile updated" in d.find_element(By.TAG_NAME, "body").text)

        # Now reload /profile and confirm the new values are rendered server-side
        self.go("/profile")
        body_text = self.driver.find_element(By.TAG_NAME, "body").text
        self.assertIn("Carol the Cartographer", body_text)
        self.assertIn("Map nerd. Long walks at sunset.", body_text)


# ─────────────────────────────────────────────────────────────────────────────
# 6. Follow user → button flips to Unfollow + follower count rises on /user/<u>
# ─────────────────────────────────────────────────────────────────────────────

class FollowFlowTest(SeleniumTestBase):
    def test_follow_button_flips_and_count_increments(self):
        self.seed_user("dave")
        self.seed_user("erin")
        self.login("dave")

        self.go("/user/erin")
        self.wait.until(EC.presence_of_element_located((By.ID, "followBtn")))

        before = self.find("#followBtn").text.strip().lower()
        self.assertEqual(before, "follow",
                         f"Expected the button to say 'Follow' initially, got: {before!r}")

        # Click and wait for the API call to resolve
        self.find("#followBtn").click()

        self.wait.until(
            lambda d: d.find_element(By.ID, "followBtn").text.strip().lower() == "unfollow"
        )

        # Reload the page — the follower count on user_profile should now read >= 1
        self.go("/user/erin")
        body_text = self.driver.find_element(By.TAG_NAME, "body").text
        # "1" should appear near the word "Followers" / similar — we just look for the digit
        # near the "Followers" label without being too brittle:
        self.assertRegex(body_text, r"1\s*\n?\s*Followers")


# ─────────────────────────────────────────────────────────────────────────────
# 7. Mutual followers can open a conversation and send a message
# ─────────────────────────────────────────────────────────────────────────────

class MutualMessagingTest(SeleniumTestBase):
    def test_mutuals_can_send_and_see_message(self):
        self.seed_user("fred")
        self.seed_user("gina")
        self.make_mutual("fred", "gina")

        # Fred logs in, navigates to gina's profile, hits Message button
        self.login("fred")
        self.go("/user/gina")
        self.wait.until(EC.presence_of_element_located((By.LINK_TEXT, "Message")))
        self.find("a[href*='/messages/gina']").click()

        # We should land on the conversation page with the compose box
        self.wait.until(EC.url_contains("/messages/gina"))
        self.wait.until(EC.presence_of_element_located((By.ID, "composeBody")))

        # Send a message
        body = self.find("#composeBody")
        body.send_keys("hello from Selenium")
        self.find("#composeSend").click()

        # Wait for the message bubble to render in #thread
        def has_message(d):
            return "hello from Selenium" in d.find_element(By.ID, "thread").text
        self.wait.until(has_message)

        # Reload and confirm it persisted (i.e. came from the DB on second load)
        self.driver.refresh()
        self.wait.until(has_message)
        self.assertIn("hello from Selenium",
                      self.driver.find_element(By.ID, "thread").text)


# ─────────────────────────────────────────────────────────────────────────────
# 8. Non-mutual users see the Message button disabled with explanatory text
# ─────────────────────────────────────────────────────────────────────────────

class NonMutualMessageDisabledTest(SeleniumTestBase):
    def test_non_mutual_message_button_is_disabled(self):
        self.seed_user("hank")
        self.seed_user("ivy")
        # Note: deliberately NOT calling make_mutual — hank and ivy aren't connected.

        self.login("hank")
        self.go("/user/ivy")
        self.wait.until(EC.presence_of_element_located((By.ID, "followBtn")))

        # There should be a disabled button mentioning "mutual follow required"
        # (not an <a> link — the mutual case renders an <a>, the non-mutual a <button>)
        disabled_buttons = [
            b for b in self.driver.find_elements(By.CSS_SELECTOR, "button[disabled]")
            if "mutual follow" in b.text.lower() or "message" in b.text.lower()
        ]
        self.assertGreaterEqual(
            len(disabled_buttons), 1,
            "Expected a disabled Message button on the non-mutual profile page.",
        )

        # And there should NOT be a clickable <a> linking to /messages/ivy.
        clickable_message_links = self.driver.find_elements(
            By.CSS_SELECTOR, "a[href*='/messages/ivy']"
        )
        self.assertEqual(
            len(clickable_message_links), 0,
            "Non-mutual users must NOT see an enabled Message link.",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
