"""
Route persistence and ownership rules for create / detail / my-page (future CRUD).

Single client-facing dict shape matches create-route.js: camelCase keys, locations[].order/desc.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from models import db, Route, RouteLocation, User


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


def create_route_from_payload(author_id: Optional[int], payload: dict[str, Any]) -> Route:
    """
    Insert a Route and its RouteLocation rows in one transaction.

    Payload keys align with the create-route form / localStorage mock:
      title, description, theme, tags (list[str]), isPublic (bool), locations (list)
    Each location: order, name, time, desc, parking; optional photoUrl, lat, lng.
    """
    aid = _require_author_id(author_id)
    _author_user(aid)

    title = str(payload.get("title") or "").strip()
    if not title:
        raise ValueError("title is required.")

    description = str(payload.get("description") or "").strip()
    theme = str(payload.get("theme") or "").strip()
    tags = payload.get("tags") or []
    if not isinstance(tags, list):
        raise ValueError("tags must be a list of strings.")
    tags = [str(t).strip() for t in tags if str(t).strip()]

    is_public = bool(payload.get("isPublic", True))

    raw_locs = payload.get("locations") or []
    if not isinstance(raw_locs, list) or len(raw_locs) == 0:
        raise ValueError("locations must be a non-empty list.")

    # Validate every stop before touching the ORM so the session never half-applies.
    normalized: list[tuple[int, dict[str, Any]]] = []
    for item in raw_locs:
        if not isinstance(item, dict):
            raise ValueError("each location must be an object.")
        order_val = item.get("order")
        if order_val is None:
            raise ValueError("each location must include order.")
        try:
            stop_order = int(order_val)
        except (TypeError, ValueError) as exc:
            raise ValueError("location.order must be an integer.") from exc
        if stop_order < 1:
            raise ValueError("location.order must be >= 1.")
        normalized.append((stop_order, item))

    normalized.sort(key=lambda x: x[0])
    used_orders: set[int] = set()
    validated_stops: list[dict[str, Any]] = []
    for stop_order, item in normalized:
        if stop_order in used_orders:
            raise ValueError("duplicate location order is not allowed.")
        used_orders.add(stop_order)

        name = str(item.get("name") or "").strip()
        if not name:
            raise ValueError("each location must include a non-empty name.")
        time_s = str(item.get("time") or "").strip()
        if not time_s:
            raise ValueError("each location must include time.")
        desc = str(item.get("desc") or item.get("description") or "").strip()
        parking = str(item.get("parking") or "unknown").strip() or "unknown"

        photo_raw = item.get("photoUrl", item.get("photo_url"))
        photo_url = str(photo_raw).strip() if photo_raw else None
        if photo_url == "":
            photo_url = None

        lat = item.get("lat")
        lng = item.get("lng")
        lat_f = float(lat) if lat is not None and lat != "" else None
        lng_f = float(lng) if lng is not None and lng != "" else None

        validated_stops.append(
            {
                "stop_order": stop_order,
                "name": name,
                "time": time_s,
                "description": desc,
                "parking": parking,
                "photo_url": photo_url,
                "lat": lat_f,
                "lng": lng_f,
            }
        )

    route = Route(
        author_id=aid,
        title=title,
        description=description,
        theme=theme,
        tags=tags,
        is_public=is_public,
    )
    db.session.add(route)
    db.session.flush()

    for row in validated_stops:
        db.session.add(
            RouteLocation(
                route_id=route.id,
                stop_order=row["stop_order"],
                name=row["name"],
                time=row["time"],
                description=row["description"],
                parking=row["parking"],
                photo_url=row["photo_url"],
                lat=row["lat"],
                lng=row["lng"],
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


def serialize_route_for_client(route: Route) -> dict[str, Any]:
    """
    One JSON-shaped dict for create response, detail, edit prefill, and listings.

    Mirrors static/js/pages/create-route.js and seed routes in interactions.js.
    """
    locs = sorted(route.locations, key=lambda x: x.stop_order)
    return {
        "id": route.id,
        "authorId": route.author_id,
        "title": route.title,
        "description": route.description,
        "theme": route.theme,
        "tags": list(route.tags or []),
        "isPublic": bool(route.is_public),
        "createdAt": _iso_utc_z(route.created_at),
        "updatedAt": _iso_utc_z(route.updated_at),
        "locations": [
            {
                "order": loc.stop_order,
                "name": loc.name,
                "time": loc.time,
                "desc": loc.description,
                "parking": loc.parking,
                # Optional stop fields; null when unset so all clients share one shape.
                "photoUrl": loc.photo_url,
                "lat": loc.lat,
                "lng": loc.lng,
            }
            for loc in locs
        ],
    }
