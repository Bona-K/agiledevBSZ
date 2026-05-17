"""
tests/test_unit.py — 10 unit tests for the combined MyVibe project.

Run from project root:
    python -m unittest tests.test_unit -v

These tests use the Flask test client (no browser, no live server).
A fresh SQLite DB is created per-test in a temp file and torn down afterward.
Email sending is forced into dev-print mode by clearing MAIL_USERNAME so the
OTPs are visible in the captured stdout / mockable via direct session access.
"""

import os
import sys
import tempfile
import unittest

# Ensure project root is on sys.path so `import app` works from tests/
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Force dev-mode email (OTP printed to console; we read from session instead)
os.environ["MAIL_USERNAME"] = ""
os.environ["MAIL_PASSWORD"] = ""
os.environ["FLASK_SECRET_KEY"] = "test-secret"


class MyVibeTestBase(unittest.TestCase):
    """Common fixture: temp DB per test, app/client/app_context ready."""

    def setUp(self):
        # Fresh DB file for this test
        self.db_fd, self.db_path = tempfile.mkstemp(suffix=".db")
        os.environ["DATABASE_URL"] = f"sqlite:///{self.db_path}"

        # Import here (after env vars set) so the app picks them up
        import importlib
        # Reload app module so each test gets a clean app state
        if "app" in sys.modules:
            importlib.reload(sys.modules["app"])
        import app as app_module

        self.app_module = app_module
        self.app = app_module.app
        self.app.config["TESTING"] = True
        self.app.config["WTF_CSRF_ENABLED"] = False
        self.client = self.app.test_client()

        # All tests need an app context for DB ops
        self.app_context = self.app.app_context()
        self.app_context.push()

    def tearDown(self):
        self.app_context.pop()
        os.close(self.db_fd)
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _create_user(self, username, password="password123", email=None, bio=""):
        """Insert a user directly via the model (bypassing OTP)."""
        from models import db, User
        from utils import hash_password
        u = User(
            username      = username,
            email         = email or f"{username}@example.com",
            password_hash = hash_password(password),
            bio           = bio,
        )
        db.session.add(u)
        db.session.commit()
        return u

    def _login(self, client, username, password="password123"):
        return client.post(
            "/login",
            data={"username": username, "password": password},
            follow_redirects=False,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 1. Password hashing roundtrip
# ─────────────────────────────────────────────────────────────────────────────

class TestPasswordHashing(MyVibeTestBase):
    def test_hash_password_then_check_password(self):
        """hash_password + check_password should match plain text, reject wrong."""
        from utils import hash_password, check_password
        h = hash_password("supersecret")
        self.assertNotEqual(h, "supersecret",
                            "Hash must not equal plaintext password.")
        self.assertTrue(check_password("supersecret", h))
        self.assertFalse(check_password("wrong-password", h))
        # Different salts → different hashes for the same password
        h2 = hash_password("supersecret")
        self.assertNotEqual(h, h2, "Two hashes of the same password should differ (salt).")


# ─────────────────────────────────────────────────────────────────────────────
# 2. OTP create / verify / replay prevention
# ─────────────────────────────────────────────────────────────────────────────

class TestOtpFlow(MyVibeTestBase):
    def test_otp_create_verify_and_replay(self):
        from otp_service import (
            create_otp_session,
            verify_otp_session,
        )
        # Fake "session" dict — the service treats any mutable mapping as a session
        fake_session = {}

        code = create_otp_session(fake_session, "signup", "x@example.com")
        self.assertEqual(len(code), 6)
        self.assertTrue(code.isdigit())

        # Wrong code → False
        ok, msg = verify_otp_session(fake_session, "signup", "x@example.com", "000000")
        self.assertFalse(ok, "Wrong OTP must fail verification.")

        # Correct code → True
        ok, _ = verify_otp_session(fake_session, "signup", "x@example.com", code)
        self.assertTrue(ok, "Correct OTP must verify on first try.")

        # Replay → False (already used)
        ok, msg = verify_otp_session(fake_session, "signup", "x@example.com", code)
        self.assertFalse(ok, "Used OTP must not be accepted a second time.")
        self.assertIn("already been used", msg.lower())


# ─────────────────────────────────────────────────────────────────────────────
# 3. Signup → verify creates the User row
# ─────────────────────────────────────────────────────────────────────────────

class TestSignupFlow(MyVibeTestBase):
    def test_signup_then_verify_creates_user(self):
        from models import User

        client = self.client

        # Step 1: submit signup form → should redirect to /signup/verify
        resp = client.post("/signup", data={
            "suName":      "Test User",
            "suEmail":     "newuser@example.com",
            "suUsername":  "newuser",
            "suPassword":  "secret123",
            "suPassword2": "secret123",
        }, follow_redirects=False)
        self.assertEqual(resp.status_code, 302)
        self.assertIn("/signup/verify", resp.headers.get("Location", ""))

        # Pull the OTP from the Flask session
        with client.session_transaction() as s:
            otp_entry = s.get("otp_signup")
            self.assertIsNotNone(otp_entry, "OTP entry should be in session after signup.")
            otp_code = otp_entry["code"]

        # User must NOT yet exist (only after verify)
        self.assertIsNone(User.query.filter_by(username="newuser").first())

        # Step 2: submit OTP → user is created
        resp = client.post("/signup/verify", data={"otp": otp_code},
                           follow_redirects=False)
        self.assertEqual(resp.status_code, 302)
        self.assertIn("/dashboard", resp.headers.get("Location", ""))

        u = User.query.filter_by(username="newuser").first()
        self.assertIsNotNone(u, "User row should exist after OTP verification.")
        self.assertEqual(u.email, "newuser@example.com")


# ─────────────────────────────────────────────────────────────────────────────
# 4. Login with wrong password fails
# ─────────────────────────────────────────────────────────────────────────────

class TestLoginRejectsBadPassword(MyVibeTestBase):
    def test_login_wrong_password_shows_error(self):
        self._create_user("alice", password="rightpass")

        resp = self.client.post("/login", data={
            "username": "alice",
            "password": "wrongpass",
        }, follow_redirects=False)
        # Re-renders login page with error (200), not a redirect
        self.assertEqual(resp.status_code, 200)
        self.assertIn(b"Incorrect password", resp.data)

        # And the session must NOT have a user_id set
        with self.client.session_transaction() as s:
            self.assertIsNone(s.get("user_id"))


# ─────────────────────────────────────────────────────────────────────────────
# 5. Profile edit updates display_name and bio
# ─────────────────────────────────────────────────────────────────────────────

class TestProfileEdit(MyVibeTestBase):
    def test_profile_edit_updates_user(self):
        from models import User
        u = self._create_user("bob", bio="old bio")
        self._login(self.client, "bob")

        resp = self.client.post("/profile/edit", data={
            "display_name": "Robert the Brave",
            "bio":          "Hi, I'm Bob. Updated bio.",
        }, follow_redirects=False)
        self.assertEqual(resp.status_code, 200)
        self.assertIn(b"Profile updated", resp.data)

        # Re-fetch from DB
        u_refreshed = User.query.filter_by(username="bob").first()
        self.assertEqual(u_refreshed.display_name, "Robert the Brave")
        self.assertEqual(u_refreshed.bio, "Hi, I'm Bob. Updated bio.")


# ─────────────────────────────────────────────────────────────────────────────
# 6. Following creates a follow notification
# ─────────────────────────────────────────────────────────────────────────────

class TestFollowCreatesNotification(MyVibeTestBase):
    def test_follow_creates_follow_notification(self):
        from models import Follow, Notification

        alice = self._create_user("alice")
        bob   = self._create_user("bob")

        self._login(self.client, "alice")

        resp = self.client.post("/follow/bob")
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertTrue(body["ok"])
        self.assertTrue(body["is_following"])
        self.assertEqual(body["follower_count"], 1)

        # DB: one Follow row, one Notification row of type 'follow'
        self.assertEqual(Follow.query.count(), 1)
        notif = Notification.query.filter_by(
            recipient_id=bob.id, sender_id=alice.id, type="follow",
        ).first()
        self.assertIsNotNone(notif, "A 'follow' notification should have been created for bob.")
        self.assertFalse(notif.is_read)


# ─────────────────────────────────────────────────────────────────────────────
# 7. Message requires mutual follow (403 when one-way)
# ─────────────────────────────────────────────────────────────────────────────

class TestMessageRequiresMutual(MyVibeTestBase):
    def test_one_way_follow_cannot_message(self):
        from models import Message, Follow

        alice = self._create_user("alice")
        bob   = self._create_user("bob")

        # Alice follows Bob, but Bob does NOT follow Alice → not mutual
        self._login(self.client, "alice")
        self.client.post("/follow/bob")

        resp = self.client.post(
            "/api/messages/bob",
            json={"body": "hi bob!"},
        )
        self.assertEqual(resp.status_code, 403)
        body = resp.get_json()
        self.assertFalse(body["ok"])
        self.assertIn("mutually follow", body["error"])

        # No message was persisted
        self.assertEqual(Message.query.count(), 0)


# ─────────────────────────────────────────────────────────────────────────────
# 8. Mutual followers can exchange messages
# ─────────────────────────────────────────────────────────────────────────────

class TestMutualMessaging(MyVibeTestBase):
    def test_mutual_follow_allows_message_send_and_receive(self):
        from models import Message, Follow

        alice = self._create_user("alice")
        bob   = self._create_user("bob")

        # Establish mutual follow
        self._login(self.client, "alice")
        self.client.post("/follow/bob")

        # Use a separate client for bob (clean session)
        bob_client = self.app.test_client()
        self._login(bob_client, "bob")
        bob_client.post("/follow/alice")

        # Alice sends a message
        resp = self.client.post(
            "/api/messages/bob",
            json={"body": "hi bob, let's hike sunday!"},
        )
        self.assertEqual(resp.status_code, 201)
        body = resp.get_json()
        self.assertTrue(body["ok"])
        self.assertEqual(body["message"]["body"], "hi bob, let's hike sunday!")
        self.assertEqual(body["message"]["sender"], "alice")
        self.assertEqual(body["message"]["recipient"], "bob")

        # Bob fetches the thread and sees it
        resp = bob_client.get("/api/messages/alice")
        body = resp.get_json()
        self.assertTrue(body["ok"])
        self.assertEqual(len(body["messages"]), 1)
        self.assertEqual(body["messages"][0]["body"], "hi bob, let's hike sunday!")
        # From bob's perspective, the sender is "alice" (not "me")
        self.assertEqual(body["messages"][0]["sender"], "alice")

        # DB has exactly one Message row
        self.assertEqual(Message.query.count(), 1)


# ─────────────────────────────────────────────────────────────────────────────
# 9. _are_mutual() helper covers all 4 cases
# ─────────────────────────────────────────────────────────────────────────────

class TestAreMutualHelper(MyVibeTestBase):
    def test_are_mutual_logic(self):
        from models import db, Follow
        from app import _are_mutual

        alice = self._create_user("alice")
        bob   = self._create_user("bob")

        # 1) Neither follows the other → False
        self.assertFalse(_are_mutual(alice, bob))

        # 2) Alice → Bob only → False
        db.session.add(Follow(follower_id=alice.id, following_id=bob.id))
        db.session.commit()
        self.assertFalse(_are_mutual(alice, bob))

        # 3) Mutual → True
        db.session.add(Follow(follower_id=bob.id, following_id=alice.id))
        db.session.commit()
        self.assertTrue(_are_mutual(alice, bob))
        self.assertTrue(_are_mutual(bob, alice),
                        "Mutuality is symmetric.")

        # 4) Self-mutual is always False
        self.assertFalse(_are_mutual(alice, alice))


# ─────────────────────────────────────────────────────────────────────────────
# 10. Polling endpoint returns unread counts + new notifications
# ─────────────────────────────────────────────────────────────────────────────

class TestNotificationPoll(MyVibeTestBase):
    def test_poll_returns_unread_counts_and_items(self):
        alice = self._create_user("alice")
        bob   = self._create_user("bob")

        # Alice and Bob mutually follow each other
        self._login(self.client, "alice")
        self.client.post("/follow/bob")
        bob_client = self.app.test_client()
        self._login(bob_client, "bob")
        bob_client.post("/follow/alice")

        # Alice sends a message → that creates a "message" notification for bob
        self.client.post("/api/messages/bob",
                         json={"body": "hello there"})

        # Bob polls
        resp = bob_client.get("/api/notifications/poll")
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertTrue(body["ok"])
        # Bob has 2 unread notifications: the follow from alice + the message
        self.assertEqual(body["unread_notif_count"], 2)
        # And 1 unread message
        self.assertEqual(body["unread_msg_count"], 1)
        # New items list includes both types
        types = {n["type"] for n in body["new_notifications"]}
        self.assertEqual(types, {"follow", "message"})

        # Passing since_id beyond the max returns no new items
        max_id = max(n["id"] for n in body["new_notifications"])
        resp = bob_client.get(f"/api/notifications/poll?since_id={max_id}")
        body = resp.get_json()
        self.assertEqual(body["new_notifications"], [])
        # ...but unread counts stay the same until reads happen
        self.assertEqual(body["unread_notif_count"], 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
