# MyVibe – Feature List

## 1. Authentication

### 1.1 User Registration
- Register with email/username and password
- Validate required fields
- Enforce password rules
- Display error messages (e.g. user already exists)

### 1.2 User Login
- Login with email/username and password
- Display error messages (invalid credentials)

### 1.3 Change Password
- Change password from Profile → Settings
- Validate old password and confirm new password

---

## 2. Route Management

### 2.1 Create Route
- Create a new route with:
  - Title
  - Description
  - Theme
  - Tags
- Set visibility (public/private)

### 2.2 Edit Route
- Edit route details
- Edit locations within the route
- Accessible only by route owner

### 2.3 Delete Route
- Delete a route
- Confirmation dialog required
- Accessible only by route owner

### 2.4 View Route Details
- View route information:
  - Title
  - Description
  - Author
  - Tags
- View ordered list of locations

---

## 3. Location Management

### 3.1 Add Location
- Add location to a route with:
  - Name (required)
  - Time (validated)
  - Description
  - Tags
  - Image
  - Parking (Yes / No / Unknown)

### 3.2 Edit Location
- Modify location details

### 3.3 Delete Location
- Remove location from route
- Confirmation dialog required

### 3.4 Reorder Locations
- Change order of locations (drag & drop or buttons)

### 3.5 Saved Locations
- Save locations for reuse
- Select from saved locations when creating routes

---

## 4. Explore & Discovery

### 4.1 Search Routes
- Search routes by keyword

### 4.2 Filter Routes
- Filter by:
  - Tags
  - Themes

### 4.3 Sort Routes
- Sort by:
  - Latest
  - Most liked

### 4.4 Browse Routes
- View routes in card layout
- Pagination or infinite scroll

---

## 5. User Interaction

### 5.1 Like Route
- Like/unlike a route

### 5.2 Bookmark Route
- Save route to “Saved Routes”

### 5.3 Share Route
- Generate shareable link
- Copy link functionality

---

## 6. Profile Management

### 6.1 View Profile
- View username and profile info

### 6.2 My Routes
- View created routes
- Edit/delete owned routes

### 6.3 Saved Routes
- View bookmarked routes

### 6.4 My Locations (Optional)
- View saved locations
- Reuse in route creation

### 6.5 Settings
- Change password
- Logout

---

## 7. System Features

### 7.1 Authorization
- Only route owner can:
  - Edit route
  - Delete route

### 7.2 Input Validation
- Required field validation
- Time format validation
- Clear error messages

### 7.3 Empty States
- Display messages when no data:
  - No routes
  - No saved routes
  - No locations

### 7.4 Loading States
- Show loading indicators:
  - Login
  - Fetching routes
  - Creating routes

---

## 8. Optional Features (Post-MVP)

- Comments system
- Rating system
- Route preview before saving
- Map integration
- Recommendation system