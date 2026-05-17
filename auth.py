"""
auth.py — Centralised session-based authentication middleware.
Issue #34: Extracted from app.py for separation of concerns.
"""

from functools import wraps
from flask import session, redirect, url_for, request, jsonify
from models import User, Notification


def get_current_user():
    """Return the logged-in User object from session, or None."""
    user_id = session.get("user_id")
    if not user_id:
        return None
    return User.query.get(user_id)


def login_required(f):
    """
    Decorator: redirect unauthenticated page requests to login.
    For API routes (URL starts with /api/), returns a 401 JSON response instead.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get("user_id") is None:
            if request.path.startswith("/api/"):
                return jsonify(ok=False, error="Authentication required."), 401
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


def get_template_globals():
    """
    Returns shared variables injected into every template via context_processor.
    Includes: current_user, server_username, myvibe_bootstrap, unread_count.
    """
    user = get_current_user()

    unread_count = 0
    if user:
        unread_count = Notification.query.filter_by(
            recipient_id=user.id,
            is_read=False,
        ).count()

    return {
        "current_user":    user,
        "server_username": user.username if user else None,
        "myvibe_bootstrap": {
            "isAuthenticated": user is not None,
            "username":        user.username if user else None,
            "userId":          user.id if user else None,
        },
        "unread_count": unread_count,
    }