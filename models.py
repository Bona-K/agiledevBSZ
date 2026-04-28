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