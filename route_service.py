"""
Route persistence and ownership rules for create / detail / my-page (future CRUD).

Single client-facing dict shape matches create-route.js: camelCase keys, locations[].order/desc.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import joinedload

from models import (
    CompletedRoute,
    db,
    Route,
    RouteComment,
    RouteLike,
    RouteLocation,
    RouteRating,
    SavedRoute,
    User,
)


class RouteValidationError(Exception):
    """Raised when create payload fails validation; carries per-field messages for API/UI."""

    def __init__(self, errors: dict[str, str]):
        self.errors = errors
        msg = next(iter(errors.values()), "Validation failed.")
        super().__init__(msg)


def _iso_utc_z(dt: Optional[datetime]) -> Optional[str]:
    """Turn stored UTC datetimes into the same style as JavaScript Date#toISOString()."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (
        dt.astimezone(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _require_author_id(author_id: Optional[int]) -> int:
    """Routes must always have a real user owner (matches DB NOT NULL + product rules)."""
    if author_id is None or int(author_id) <= 0:
        raise ValueError("author_id is required to create a route.")
    return int(author_id)


def _author_user(author_id: int) -> User:
    """Load author or fail; prevents orphan routes pointing at missing users."""
    user = User.query.get(author_id)
    if user is None:
        raise ValueError("author_id must reference an existing user.")
    return user


def _prepare_create_route_data(
    author_id: Optional[int], payload: dict[str, Any]
) -> tuple[dict[str, str], Optional[tuple[int, str, str, str, list[str], bool, list[dict[str, Any]]]]]:
    """
    Validate payload for create/update.
    Returns (errors, None) or ({}, (aid, title, description, theme, tags, is_public, cover_photo_url, validated_stops)).
    """
    errors: dict[str, str] = {}
    try:
        aid = _require_author_id(author_id)
    except ValueError as exc:
        return {"author": str(exc)}, None
    try:
        _author_user(aid)
    except ValueError as exc:
        return {"author": str(exc)}, None

    title = str(payload.get("title") or "").strip()
    if not title:
        errors["title"] = "Title is required."

    description = str(payload.get("description") or "").strip()
    theme = str(payload.get("theme") or "").strip()
    if not theme:
        errors["theme"] = "Please choose a theme."

    tags = payload.get("tags") or []
    if not isinstance(tags, list):
        errors["tags"] = "Tags must be a list."
    else:
        tags = [str(t).strip() for t in tags if str(t).strip()]

    is_public = bool(payload.get("isPublic", True))

    raw_locs = payload.get("locations") or []
    if not isinstance(raw_locs, list):
        errors["locations"] = "Add at least one location with name and time."
    elif len(raw_locs) == 0:
        errors["locations"] = "Add at least one location."

    if errors:
        return errors, None

    assert isinstance(raw_locs, list)

    normalized: list[tuple[int, dict[str, Any]]] = []
    for idx, item in enumerate(raw_locs):
        if not isinstance(item, dict):
            errors[f"locations.{idx}"] = "Each stop must be a valid entry."
            continue
        order_val = item.get("order")
        if order_val is None:
            errors[f"locations.{idx}.order"] = "Order is required for each stop."
            continue
        try:
            stop_order = int(order_val)
        except (TypeError, ValueError):
            errors[f"locations.{idx}.order"] = "Order must be a whole number."
            continue
        if stop_order < 1:
            errors[f"locations.{idx}.order"] = "Order must be 1 or greater."
            continue
        normalized.append((stop_order, item))

    if errors:
        return errors, None

    normalized.sort(key=lambda x: x[0])
    used_orders: set[int] = set()
    for idx, (stop_order, item) in enumerate(normalized):
        if stop_order in used_orders:
            errors["locations"] = "Each stop must have a unique order."
            break
        used_orders.add(stop_order)

        name = str(item.get("name") or "").strip()
        if not name:
            errors[f"locations.{idx}.name"] = "Location name is required."
        time_s = str(item.get("time") or "").strip()
        if not time_s:
            errors[f"locations.{idx}.time"] = "Time is required for each stop."

    if errors:
        return errors, None

    validated_stops: list[dict[str, Any]] = []
    for stop_order, item in normalized:
        name = str(item.get("name") or "").strip()
        time_s = str(item.get("time") or "").strip()
        desc = str(item.get("desc") or item.get("description") or "").strip()
        parking = str(item.get("parking") or "unknown").strip() or "unknown"

        photo_raw = item.get("photoUrl", item.get("photo_url"))
        photo_url = str(photo_raw).strip() if photo_raw else None
        if photo_url == "":
            photo_url = None

        lat = item.get("lat")
        lng = item.get("lng")
        try:
            lat_f = float(lat) if lat is not None and lat != "" else None
            lng_f = float(lng) if lng is not None and lng != "" else None
        except (TypeError, ValueError):
            lat_f, lng_f = None, None

        place_raw = item.get("placeName", item.get("place_name"))
        place_name = str(place_raw).strip() if place_raw else None
        if place_name == "":
            place_name = None

        rating_raw = item.get("rating")
        rating_f = None
        if rating_raw is not None and rating_raw != "":
            try:
                ri = int(rating_raw)
                if 1 <= ri <= 5:
                    rating_f = ri
            except (TypeError, ValueError):
                rating_f = None

        validated_stops.append(
            {
                "stop_order": stop_order,
                "name": name,
                "place_name": place_name,
                "time": time_s,
                "description": desc,
                "parking": parking,
                "photo_url": photo_url,
                "lat": lat_f,
                "lng": lng_f,
                "rating": rating_f,
            }
        )

    cover_raw = payload.get("photoUrl")
    cover_photo_url = None
    if cover_raw is not None:
        s = str(cover_raw).strip()
        if s:
            if len(s) > 500:
                return {"photoUrl": "Cover image URL is too long."}, None
            cover_photo_url = s

    return {}, (aid, title, description, theme, tags, is_public, cover_photo_url, validated_stops)


def create_route_from_payload(author_id: Optional[int], payload: dict[str, Any]) -> Route:
    """
    Insert a Route and its RouteLocation rows in one transaction.

    Payload keys align with the create-route form / localStorage mock:
      title, description, theme, tags (list[str]), isPublic (bool), photoUrl (optional route cover), locations (list)
    Each location: order, name, time, desc, parking; optional photoUrl, lat, lng.
    """
    prep = _prepare_create_route_data(author_id, payload)
    errors, data = prep
    if errors or data is None:
        raise RouteValidationError(errors or {"": "Validation failed."})

    aid, title, description, theme, tags, is_public, cover_photo_url, validated_stops = data

    route = Route(
        author_id=aid,
        title=title,
        description=description,
        theme=theme,
        tags=tags,
        is_public=is_public,
        cover_photo_url=cover_photo_url,
    )
    db.session.add(route)
    db.session.flush()

    for row in validated_stops:
        db.session.add(
            RouteLocation(
                route_id=route.id,
                stop_order=row["stop_order"],
                name=row["name"],
                place_name=row["place_name"],
                time=row["time"],
                description=row["description"],
                parking=row["parking"],
                photo_url=row["photo_url"],
                lat=row["lat"],
                lng=row["lng"],
                rating=row["rating"],
            )
        )

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return route


def get_route_by_id(route_id: int) -> Optional[Route]:
    """Primary key lookup; does not apply visibility rules."""
    return Route.query.get(route_id)


def get_route_for_viewer(route_id: int, viewer_user_id: Optional[int]) -> Optional[Route]:
    """
    Detail / explore rule: public routes are visible; private only to the author.
    Used so later HTTP handlers do not repeat ownership checks.
    """
    route = get_route_by_id(route_id)
    if route is None:
        return None
    if route.is_public:
        return route
    if viewer_user_id is not None and int(viewer_user_id) == int(route.author_id):
        return route
    return None


def list_routes_for_author(author_id: int) -> list[Route]:
    """My-page / author profile listing; newest first (same idea as explore sort)."""
    aid = _require_author_id(author_id)
    return (
        Route.query.filter_by(author_id=aid)
        .order_by(Route.created_at.desc())
        .all()
    )


def list_public_routes_for_author(author_id: int) -> list[Route]:
    """Public profile: only routes this author has marked public."""
    aid = _require_author_id(author_id)
    return (
        Route.query.filter_by(author_id=aid, is_public=True)
        .order_by(Route.created_at.desc())
        .all()
    )


def list_public_routes(limit: int = 500) -> list[Route]:
    """Dashboard / explore: all public routes, newest first (bounded for safety)."""
    lim = max(1, min(int(limit), 2000))
    return (
        Route.query.filter_by(is_public=True)
        .order_by(Route.created_at.desc())
        .limit(lim)
        .all()
    )


def duplicate_route_for_user(source_route_id: int, new_author_id: int) -> Optional[Route]:
    """
    Clone a visible route into a new route owned by new_author_id.
    Returns None when source route does not exist.
    """
    source = get_route_by_id(int(source_route_id))
    if source is None:
        return None

    aid = _require_author_id(new_author_id)
    _author_user(aid)

    clone = Route(
        author_id=aid,
        title=source.title,
        description=source.description,
        theme=source.theme,
        tags=list(source.tags or []),
        is_public=bool(source.is_public),
        cover_photo_url=getattr(source, "cover_photo_url", None),
    )
    db.session.add(clone)
    db.session.flush()

    for loc in sorted(source.locations, key=lambda x: x.stop_order):
        db.session.add(
            RouteLocation(
                route_id=clone.id,
                stop_order=loc.stop_order,
                name=loc.name,
                place_name=loc.place_name,
                time=loc.time,
                description=loc.description,
                parking=loc.parking,
                photo_url=loc.photo_url,
                lat=loc.lat,
                lng=loc.lng,
                rating=loc.rating,
            )
        )
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return clone


class RouteOwnershipError(Exception):
    """Raised when a mutation targets a route the user does not own."""

    pass


def update_route_for_owner(route_id: int, owner_id: int, payload: dict[str, Any]) -> Route:
    """
    Replace route metadata and ordered stops for an existing route.

    Raises RouteOwnershipError if the route exists but owner_id is not the author.
    Raises RouteValidationError on invalid payload.
    """
    route = get_route_by_id(int(route_id))
    if route is None:
        raise ValueError("Route not found.")
    if int(route.author_id) != int(owner_id):
        raise RouteOwnershipError("Not allowed to edit this route.")

    prep = _prepare_create_route_data(int(owner_id), payload)
    errors, data = prep
    if errors or data is None:
        raise RouteValidationError(errors or {"": "Validation failed."})

    _aid, title, description, theme, tags, is_public, cover_photo_url, validated_stops = data

    route.title = title
    route.description = description
    route.theme = theme
    route.tags = tags
    route.is_public = is_public
    route.cover_photo_url = cover_photo_url

    # Replace stops so UI order matches persisted stop_order exactly.
    route.locations.clear()
    db.session.flush()

    for row in validated_stops:
        db.session.add(
            RouteLocation(
                route_id=route.id,
                stop_order=row["stop_order"],
                name=row["name"],
                place_name=row["place_name"],
                time=row["time"],
                description=row["description"],
                parking=row["parking"],
                photo_url=row["photo_url"],
                lat=row["lat"],
                lng=row["lng"],
                rating=row["rating"],
            )
        )

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return route


def delete_route_for_owner(route_id: int, owner_id: int) -> bool:
    """
    Permanently remove a route and its stops. Returns True when deleted.

    Raises RouteOwnershipError if the route exists but owner_id is not the author.
    """
    route = get_route_by_id(int(route_id))
    if route is None:
        return False
    if int(route.author_id) != int(owner_id):
        raise RouteOwnershipError("Not allowed to delete this route.")
    try:
        db.session.delete(route)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return True


def get_saved_route_ids_for_user(user_id: int) -> list[int]:
    """Route ids the user has bookmarked, newest save first."""
    uid = _require_author_id(user_id)
    rows = (
        SavedRoute.query.filter_by(user_id=uid)
        .order_by(SavedRoute.created_at.desc())
        .all()
    )
    return [int(row.route_id) for row in rows]


def list_saved_routes_for_user(user_id: int) -> list[Route]:
    """Full route rows for saved routes, preserving save order."""
    route_ids = get_saved_route_ids_for_user(user_id)
    if not route_ids:
        return []
    routes = Route.query.filter(Route.id.in_(route_ids)).all()
    by_id = {int(r.id): r for r in routes}
    return [by_id[rid] for rid in route_ids if rid in by_id]


def save_route_for_user(user_id: int, route_id: int) -> bool:
    """Bookmark a route the user is allowed to view. Returns False if not found."""
    uid = _require_author_id(user_id)
    route = get_route_for_viewer(int(route_id), uid)
    if route is None:
        return False
    exists = SavedRoute.query.filter_by(user_id=uid, route_id=route.id).first()
    if exists:
        return True
    db.session.add(SavedRoute(user_id=uid, route_id=route.id))
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return True


def unsave_route_for_user(user_id: int, route_id: int) -> bool:
    """Remove bookmark. Returns False if bookmark did not exist."""
    uid = _require_author_id(user_id)
    row = SavedRoute.query.filter_by(user_id=uid, route_id=int(route_id)).first()
    if row is None:
        return False
    db.session.delete(row)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return True


def get_completed_route_ids_for_user(user_id: int) -> list[int]:
    """Route ids the user marked completed, most recent first."""
    uid = _require_author_id(user_id)
    rows = (
        CompletedRoute.query.filter_by(user_id=uid)
        .order_by(CompletedRoute.completed_at.desc())
        .all()
    )
    return [int(row.route_id) for row in rows]


def list_completed_routes_for_user(user_id: int) -> list[Route]:
    """Full route rows for completions, preserving completion order."""
    route_ids = get_completed_route_ids_for_user(user_id)
    if not route_ids:
        return []
    routes = Route.query.filter(Route.id.in_(route_ids)).all()
    by_id = {int(r.id): r for r in routes}
    return [by_id[rid] for rid in route_ids if rid in by_id]


def mark_route_completed_for_user(user_id: int, route_id: int) -> bool:
    """Mark a viewable route complete for this user. Returns False if route missing."""
    uid = _require_author_id(user_id)
    route = get_route_for_viewer(int(route_id), uid)
    if route is None:
        return False
    exists = CompletedRoute.query.filter_by(user_id=uid, route_id=route.id).first()
    if exists:
        return True
    db.session.add(CompletedRoute(user_id=uid, route_id=route.id))
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return True


def unmark_route_completed_for_user(user_id: int, route_id: int) -> bool:
    """Remove completion record. Returns False if none."""
    uid = _require_author_id(user_id)
    row = CompletedRoute.query.filter_by(user_id=uid, route_id=int(route_id)).first()
    if row is None:
        return False
    db.session.delete(row)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return True


def user_has_completed_route(user_id: int, route_id: int) -> bool:
    return (
        CompletedRoute.query.filter_by(
            user_id=int(user_id), route_id=int(route_id)
        ).first()
        is not None
    )


# ---------------------------------------------------------------------------
# Route comments (viewer must be allowed to see the route)
# ---------------------------------------------------------------------------

_COMMENT_MAX_LEN = 4000


def _serialize_route_comment(row: RouteComment) -> dict[str, Any]:
    u = row.author_user
    if u is not None:
        label = (u.display_name or "").strip() or u.username or "Unknown"
        username = str(u.username or "")
    else:
        label = "Unknown"
        username = ""
    return {
        "id": row.id,
        "author": label,
        "authorUsername": username,
        "text": row.body,
        "createdAt": _iso_utc_z(row.created_at),
    }


def list_route_comments(route_id: int, viewer_user_id: Optional[int]) -> list[dict[str, Any]]:
    """Oldest first. Raises ValueError if route not visible to viewer."""
    route = get_route_for_viewer(int(route_id), viewer_user_id)
    if route is None:
        raise ValueError("Route not found.")
    rows = (
        RouteComment.query.options(joinedload(RouteComment.author_user))
        .filter_by(route_id=route.id)
        .order_by(RouteComment.created_at.asc())
        .all()
    )
    return [_serialize_route_comment(r) for r in rows]


def add_route_comment(user_id: int, route_id: int, text: str) -> dict[str, Any]:
    """Persist one comment. Raises ValueError if route not visible; RouteValidationError on bad text."""
    uid = _require_author_id(user_id)
    route = get_route_for_viewer(int(route_id), uid)
    if route is None:
        raise ValueError("Route not found.")

    body = (text or "").strip()
    if not body:
        raise RouteValidationError({"text": "Comment cannot be empty."})
    if len(body) > _COMMENT_MAX_LEN:
        raise RouteValidationError(
            {"text": f"Comment is too long (max {_COMMENT_MAX_LEN} characters)."}
        )

    row = RouteComment(route_id=route.id, user_id=uid, body=body)
    db.session.add(row)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    row = (
        RouteComment.query.options(joinedload(RouteComment.author_user))
        .filter_by(id=row.id)
        .first()
    )
    if row is None:
        raise RuntimeError("Comment row missing after insert.")
    return _serialize_route_comment(row)


def count_likes_for_route(route_id: int) -> int:
    return int(RouteLike.query.filter_by(route_id=int(route_id)).count())


def average_rating_for_route(route_id: int) -> Optional[float]:
    avg = (
        db.session.query(func.avg(RouteRating.score))
        .filter(RouteRating.route_id == int(route_id))
        .scalar()
    )
    if avg is None:
        return None
    return round(float(avg), 1)


def user_has_liked_route(user_id: int, route_id: int) -> bool:
    return (
        RouteLike.query.filter_by(user_id=int(user_id), route_id=int(route_id)).first()
        is not None
    )


def get_user_route_rating(user_id: int, route_id: int) -> Optional[int]:
    row = RouteRating.query.filter_by(user_id=int(user_id), route_id=int(route_id)).first()
    return int(row.score) if row is not None else None


def toggle_route_like(user_id: int, route_id: int) -> tuple[bool, int]:
    """
    Like or unlike a route the user may view.

    Returns (liked, likes_count). Raises ValueError when route is not visible.
    """
    uid = _require_author_id(user_id)
    route = get_route_for_viewer(int(route_id), uid)
    if route is None:
        raise ValueError("Route not found.")

    row = RouteLike.query.filter_by(user_id=uid, route_id=route.id).first()
    if row is not None:
        db.session.delete(row)
        liked = False
    else:
        db.session.add(RouteLike(user_id=uid, route_id=route.id))
        liked = True
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return liked, count_likes_for_route(route.id)


def set_route_rating(user_id: int, route_id: int, score: int) -> tuple[Optional[float], int]:
    """
    Create or update a 1–5 rating for a visible route.

    Returns (average_rating, user_rating). Raises ValueError when route is not visible.
    """
    uid = _require_author_id(user_id)
    route = get_route_for_viewer(int(route_id), uid)
    if route is None:
        raise ValueError("Route not found.")

    rating_score = int(score)
    if rating_score < 1 or rating_score > 5:
        raise RouteValidationError({"rating": "Rating must be between 1 and 5."})

    row = RouteRating.query.filter_by(user_id=uid, route_id=route.id).first()
    if row is None:
        db.session.add(RouteRating(user_id=uid, route_id=route.id, score=rating_score))
    else:
        row.score = rating_score
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return average_rating_for_route(route.id), rating_score


def serialize_route_for_client(
    route: Route, viewer_user_id: Optional[int] = None
) -> dict[str, Any]:
    """
    One JSON-shaped dict for create response, detail, edit prefill, and listings.

    Mirrors static/js/pages/create-route.js and seed routes in interactions.js.
    rating is null when no one has rated; userLiked/userRating/userCompleted when viewer is known.
    """
    locs = sorted(route.locations, key=lambda x: x.stop_order)
    author_username = ""
    author_display_name = ""
    if getattr(route, "author", None) is not None:
        author_username = str(route.author.username or "")
        author_display_name = (route.author.display_name or "").strip() or author_username

    rid = int(route.id)
    payload: dict[str, Any] = {
        "id": route.id,
        "authorId": route.author_id,
        "authorUsername": author_username,
        "authorDisplayName": author_display_name,
        "title": route.title,
        "description": route.description,
        "theme": route.theme,
        "tags": list(route.tags or []),
        "isPublic": bool(route.is_public),
        "photoUrl": getattr(route, "cover_photo_url", None) or None,
        "createdAt": _iso_utc_z(route.created_at),
        "updatedAt": _iso_utc_z(route.updated_at),
        "likes": count_likes_for_route(rid),
        "rating": average_rating_for_route(rid),
        "locations": [
            {
                "order": loc.stop_order,
                "name": loc.name,
                "placeName": loc.place_name,
                "time": loc.time,
                "desc": loc.description,
                "parking": loc.parking,
                # Optional stop fields; null when unset so all clients share one shape.
                "photoUrl": loc.photo_url,
                "lat": loc.lat,
                "lng": loc.lng,
                "rating": loc.rating,
            }
            for loc in locs
        ],
    }
    if viewer_user_id is not None:
        vid = int(viewer_user_id)
        payload["userLiked"] = user_has_liked_route(vid, rid)
        payload["userRating"] = get_user_route_rating(vid, rid)
        payload["userCompleted"] = user_has_completed_route(vid, rid)
    return payload

