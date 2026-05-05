"""
Route persistence and ownership rules for create / detail / my-page (future CRUD).

Single client-facing dict shape matches create-route.js: camelCase keys, locations[].order/desc.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from models import db, Route, RouteLocation, User


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
    Validate payload for create. Returns (errors, None) or ({}, (aid, title, description, theme, tags, is_public, validated_stops)).
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

    return {}, (aid, title, description, theme, tags, is_public, validated_stops)


def create_route_from_payload(author_id: Optional[int], payload: dict[str, Any]) -> Route:
    """
    Insert a Route and its RouteLocation rows in one transaction.

    Payload keys align with the create-route form / localStorage mock:
      title, description, theme, tags (list[str]), isPublic (bool), locations (list)
    Each location: order, name, time, desc, parking; optional photoUrl, lat, lng.
    """
    prep = _prepare_create_route_data(author_id, payload)
    errors, data = prep
    if errors or data is None:
        raise RouteValidationError(errors or {"": "Validation failed."})

    aid, title, description, theme, tags, is_public, validated_stops = data

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
    author_username = ""
    if getattr(route, "author", None) is not None:
        author_username = str(route.author.username or "")

    return {
        "id": route.id,
        "authorId": route.author_id,
        "authorUsername": author_username,
        "title": route.title,
        "description": route.description,
        "theme": route.theme,
        "tags": list(route.tags or []),
        "isPublic": bool(route.is_public),
        "createdAt": _iso_utc_z(route.created_at),
        "updatedAt": _iso_utc_z(route.updated_at),
        "likes": 0,
        # mock data for testing
        "rating": 4.0,
        # mock data for testing
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
    
