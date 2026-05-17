"""
otp_service.py — Free OTP delivery via Gmail SMTP.

Setup (one-time):
  1. Enable 2-Step Verification on your Google account.
  2. Go to https://myaccount.google.com/apppasswords
  3. Create an App Password (name it "MyVibe").
  4. Add to .env:
       MAIL_USERNAME=you@gmail.com
       MAIL_PASSWORD=xxxx xxxx xxxx xxxx   ← the 16-char app password
       MAIL_FROM_NAME=MyVibe

OTPs are stored in Flask session (no extra DB table needed).
They expire after OTP_EXPIRY_MINUTES and are single-use.
"""

import os
import random
import smtplib
import string
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# ── Config (read from environment / .env) ────────────────────────────────────

MAIL_USERNAME   = os.environ.get("MAIL_USERNAME", "")
MAIL_PASSWORD   = os.environ.get("MAIL_PASSWORD", "")
MAIL_FROM_NAME  = os.environ.get("MAIL_FROM_NAME", "MyVibe")
MAIL_SMTP_HOST  = os.environ.get("MAIL_SMTP_HOST", "smtp.gmail.com")
MAIL_SMTP_PORT  = int(os.environ.get("MAIL_SMTP_PORT", "587"))

OTP_EXPIRY_MINUTES = 10
OTP_LENGTH = 6


# ── OTP helpers ───────────────────────────────────────────────────────────────

def _generate_otp() -> str:
    """Return a zero-padded numeric OTP."""
    return "".join(random.choices(string.digits, k=OTP_LENGTH))


def create_otp_session(flask_session, purpose: str, email: str) -> str:
    """
    Generate a fresh OTP, store it in the Flask session keyed by purpose,
    and return the code so the caller can email it.

    purpose: 'signup' | 'reset'
    """
    code = _generate_otp()
    flask_session[f"otp_{purpose}"] = {
        "code":    code,
        "email":   email.lower().strip(),
        "expires": time.time() + OTP_EXPIRY_MINUTES * 60,
        "used":    False,
    }
    return code


def verify_otp_session(flask_session, purpose: str, email: str, code: str) -> tuple[bool, str]:
    """
    Validate the OTP for the given purpose and email.
    Returns (ok: bool, message: str).
    Marks the OTP as used on success to prevent replay.
    """
    key = f"otp_{purpose}"
    entry = flask_session.get(key)

    if not entry:
        return False, "No OTP found. Please request a new one."

    if entry.get("used"):
        return False, "This OTP has already been used. Please request a new one."

    if time.time() > entry["expires"]:
        flask_session.pop(key, None)
        return False, f"OTP expired (valid for {OTP_EXPIRY_MINUTES} minutes). Please request a new one."

    if entry["email"] != email.lower().strip():
        return False, "Email mismatch. Please start over."

    if entry["code"] != code.strip():
        return False, "Incorrect OTP. Please check and try again."

    # Mark used
    entry["used"] = True
    flask_session[key] = entry
    return True, "OK"


def clear_otp_session(flask_session, purpose: str):
    flask_session.pop(f"otp_{purpose}", None)


# ── Email sending ─────────────────────────────────────────────────────────────

def _send_email(to_email: str, subject: str, html_body: str) -> tuple[bool, str]:
    """Send via Gmail SMTP. Returns (ok, error_message)."""
    if not MAIL_USERNAME or not MAIL_PASSWORD:
        # Dev fallback: print to console so developer sees the OTP
        print(f"\n{'='*60}")
        print(f"📧  [DEV MODE — email not configured]")
        print(f"    To:      {to_email}")
        print(f"    Subject: {subject}")
        # Strip HTML tags crudely for console output
        import re
        plain = re.sub(r"<[^>]+>", "", html_body).strip()
        print(f"    Body:\n{plain}")
        print(f"{'='*60}\n")
        return True, ""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{MAIL_FROM_NAME} <{MAIL_USERNAME}>"
    msg["To"]      = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(MAIL_SMTP_HOST, MAIL_SMTP_PORT, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(MAIL_USERNAME, MAIL_PASSWORD)
            smtp.sendmail(MAIL_USERNAME, to_email, msg.as_string())
        return True, ""
    except smtplib.SMTPAuthenticationError:
        return False, "Email authentication failed. Check MAIL_USERNAME / MAIL_PASSWORD in .env."
    except Exception as exc:
        return False, f"Could not send email: {exc}"


# ── Public senders ────────────────────────────────────────────────────────────

def send_signup_otp(to_email: str, otp: str) -> tuple[bool, str]:
    subject = f"MyVibe — your sign-up code: {otp}"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;
                background:#f8fafc;border-radius:16px;">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Verify your email</h2>
      <p style="margin:0 0 24px;color:#475569;font-size:15px;">
        Use the code below to complete your MyVibe sign-up.
        It expires in <strong>{OTP_EXPIRY_MINUTES} minutes</strong>.
      </p>
      <div style="background:#fff;border:2px solid #e2e8f0;border-radius:12px;
                  padding:24px;text-align:center;letter-spacing:10px;
                  font-size:36px;font-weight:700;color:#0ea5e9;">
        {otp}
      </div>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    """
    return _send_email(to_email, subject, html)


def send_reset_otp(to_email: str, otp: str) -> tuple[bool, str]:
    subject = f"MyVibe — password reset code: {otp}"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;
                background:#f8fafc;border-radius:16px;">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Reset your password</h2>
      <p style="margin:0 0 24px;color:#475569;font-size:15px;">
        Use the code below to reset your MyVibe password.
        It expires in <strong>{OTP_EXPIRY_MINUTES} minutes</strong>.
      </p>
      <div style="background:#fff;border:2px solid #e2e8f0;border-radius:12px;
                  padding:24px;text-align:center;letter-spacing:10px;
                  font-size:36px;font-weight:700;color:#f59e0b;">
        {otp}
      </div>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">
        If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
    """
    return _send_email(to_email, subject, html)
