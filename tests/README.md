# Tests

This directory contains two test suites for MyVibe.

## Unit tests (10 tests)

Fast — uses Flask's test client, no browser needed. Each test gets a fresh
SQLite DB in a temp file.

```bash
# from project root
python -m unittest tests.test_unit -v
```

What they cover:
1. `test_hash_password_then_check_password` — password hashing roundtrip + salt uniqueness
2. `test_otp_create_verify_and_replay` — OTP generation, verification, single-use replay prevention
3. `test_signup_then_verify_creates_user` — full signup → OTP verify flow creates the User row
4. `test_login_wrong_password_shows_error` — bad password renders error page, no session set
5. `test_profile_edit_updates_user` — POST `/profile/edit` updates display_name + bio in DB
6. `test_follow_creates_follow_notification` — `/follow/<user>` creates Follow + Notification
7. `test_one_way_follow_cannot_message` — non-mutual DM attempt returns 403
8. `test_mutual_follow_allows_message_send_and_receive` — mutuals can DM both ways
9. `test_are_mutual_logic` — covers all 4 cases of the helper
10. `test_poll_returns_unread_counts_and_items` — `/api/notifications/poll` shape

## Selenium tests (8 tests)

Real browser. Spins up the Flask app on a free port in a background thread,
drives Chrome headless. Each test class gets a fresh SQLite DB.

```bash
pip install selenium
python -m unittest tests.test_selenium -v
```

Requires Google Chrome / Chromium on the machine (Selenium 4 autodetects the
driver via Selenium Manager). For Firefox, set `BROWSER=firefox`. To watch
the browser instead of running headless, set `HEADLESS=0`.

What they cover:
1. `LandingPageTest` — landing page renders with login link
2. `SignupRedirectsToOtpVerifyTest` — signup form → `/signup/verify` page
3. `ValidLoginReachesDashboardTest` — happy-path login → dashboard
4. `LoginRejectsBadPasswordTest` — bad password keeps user on `/login` with error
5. `EditProfilePersistsTest` — display name + bio update persist across reload
6. `FollowFlowTest` — Follow button flips to Unfollow; follower count rises
7. `MutualMessagingTest` — mutuals open conversation, send message, message persists
8. `NonMutualMessageDisabledTest` — non-mutual profile shows disabled Message button (no link)

## Notes

The Selenium suite mounts three test-only routes onto the live app for
seeding (`/test/seed-user/<u>`, `/test/make-mutual/<a>/<b>`,
`/test/peek-otp/<purpose>/<email>`). They are only registered when
`app.config["TESTING"]` is true — production runs never see them.

Both suites force `MAIL_USERNAME=""` so OTP delivery falls back to the
dev-mode "print to console" path. No real emails are sent.
