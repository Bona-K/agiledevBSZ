from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(db.Model):
    __tablename__ = "users"

    id           = db.Column(db.Integer, primary_key=True)
    username     = db.Column(db.String(80), unique=True, nullable=False)
    email        = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    display_name = db.Column(db.String(120), default="")
    bio          = db.Column(db.Text, default="")
    joined_at    = db.Column(db.DateTime, default=datetime.utcnow)
    profile_img  = db.Column(db.String(300), default="")

    # relationships
    notifications_received = db.relationship(
        "Notification",
        foreign_keys="Notification.recipient_id",
        backref="recipient",
        lazy="dynamic",
    )
    notifications_sent = db.relationship(
        "Notification",
        foreign_keys="Notification.sender_id",
        backref="sender",
        lazy="dynamic",
    )

    # Routes owned by this user (author_id on Route).
    routes = db.relationship("Route", back_populates="author", lazy="dynamic")
    saved_routes = db.relationship(
        "SavedRoute",
        back_populates="user",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<User {self.username}>"


# ---------------------------------------------------------------------------
# Follow
# ---------------------------------------------------------------------------

class Follow(db.Model):
    __tablename__ = "follows"

    id           = db.Column(db.Integer, primary_key=True)
    follower_id  = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    following_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    follower  = db.relationship("User", foreign_keys=[follower_id],  backref="following")
    following = db.relationship("User", foreign_keys=[following_id], backref="followers")

    __table_args__ = (
        db.UniqueConstraint("follower_id", "following_id", name="unique_follow"),
    )

    def __repr__(self):
        return f"<Follow {self.follower_id} → {self.following_id}>"


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------

class Notification(db.Model):
    __tablename__ = "notifications"

    id           = db.Column(db.Integer, primary_key=True)
    recipient_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    sender_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    type         = db.Column(db.String(50), nullable=False)   # 'follow' | 'like' | 'comment'
    route_id     = db.Column(db.String(100), nullable=True)
    is_read      = db.Column(db.Boolean, default=False)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Notification {self.type} → user {self.recipient_id}>"


# ---------------------------------------------------------------------------
# Route (one-day plan) and RouteLocation (ordered stops)
# ---------------------------------------------------------------------------

class Route(db.Model):
    """A user-authored route plan; matches create-route form fields."""

    __tablename__ = "routes"

    id = db.Column(db.Integer, primary_key=True)
    # Required owner; enforced again in route_service for clarity at API layer.
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False, default="")
    theme = db.Column(db.String(80), nullable=False, default="")
    # List of tag strings (same shape as front-end tags array).
    tags = db.Column(db.JSON, nullable=False, default=list)
    is_public = db.Column(db.Boolean, nullable=False, default=True)
    # Optional hero image for cards / detail; same upload pipeline as stop photos.
    cover_photo_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    author = db.relationship("User", back_populates="routes")
    saved_by = db.relationship(
        "SavedRoute",
        back_populates="route",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    likes = db.relationship(
        "RouteLike",
        back_populates="route",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    ratings = db.relationship(
        "RouteRating",
        back_populates="route",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    # Ordered stops; cascade delete keeps DB aligned when a route is removed later.
    locations = db.relationship(
        "RouteLocation",
        back_populates="route",
        order_by="RouteLocation.stop_order",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<Route {self.id} {self.title!r}>"


class RouteLocation(db.Model):
    """One stop on a route; order is stable via stop_order (1-based)."""

    __tablename__ = "route_locations"

    id = db.Column(db.Integer, primary_key=True)
    route_id = db.Column(db.Integer, db.ForeignKey("routes.id"), nullable=False)
    stop_order = db.Column(db.Integer, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    time = db.Column(db.String(32), nullable=False)
    description = db.Column(db.Text, nullable=False, default="")
    parking = db.Column(db.String(32), nullable=False, default="unknown")
    photo_url = db.Column(db.String(500), nullable=True)
    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)

    route = db.relationship("Route", back_populates="locations")

    __table_args__ = (
        db.UniqueConstraint("route_id", "stop_order", name="uq_route_stop_order"),
    )

    def __repr__(self):
        return f"<RouteLocation {self.id} route={self.route_id} #{self.stop_order}>"


# ---------------------------------------------------------------------------
# SavedRoute (user bookmarks a route)
# ---------------------------------------------------------------------------

class SavedRoute(db.Model):
    __tablename__ = "saved_routes"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    route_id = db.Column(db.Integer, db.ForeignKey("routes.id", ondelete="CASCADE"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", back_populates="saved_routes")
    route = db.relationship("Route", back_populates="saved_by")

    __table_args__ = (
        db.UniqueConstraint("user_id", "route_id", name="unique_saved_route"),
    )

    def __repr__(self):
        return f"<SavedRoute user={self.user_id} route={self.route_id}>"


# ---------------------------------------------------------------------------
# RouteLike / RouteRating (one per user per route)
# ---------------------------------------------------------------------------

class RouteLike(db.Model):
    __tablename__ = "route_likes"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    route_id = db.Column(db.Integer, db.ForeignKey("routes.id", ondelete="CASCADE"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    route = db.relationship("Route", back_populates="likes")

    __table_args__ = (
        db.UniqueConstraint("user_id", "route_id", name="unique_route_like"),
    )

    def __repr__(self):
        return f"<RouteLike user={self.user_id} route={self.route_id}>"


class RouteRating(db.Model):
    __tablename__ = "route_ratings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    route_id = db.Column(db.Integer, db.ForeignKey("routes.id", ondelete="CASCADE"), nullable=False)
    score = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    route = db.relationship("Route", back_populates="ratings")

    __table_args__ = (
        db.UniqueConstraint("user_id", "route_id", name="unique_route_rating"),
    )

    def __repr__(self):
        return f"<RouteRating user={self.user_id} route={self.route_id} score={self.score}>"
