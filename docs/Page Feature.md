# MyVibe – Page Feature Mapping

## 0. Landing Page

**Purpose:** Introduce app and drive conversions

**Features:**
- App name & slogan
- Description
- Hero section
- CTA buttons:
  - Sign Up
  - Login

---

## 1. Authentication Pages

### 1.1 Sign Up Page
- User registration
- Input validation
- Error handling
- Link to Login

### 1.2 Login Page
- User login
- Error handling
- Link to Sign Up

---

## 2. Home / Dashboard

**Purpose:** Main entry after login

**Features:**
- Search bar
- Create Route button
- Popular routes section
- Latest routes section

---

## 3. Explore Page

**Purpose:** Route discovery

**Features:**
- Search routes
- Filter (tags, themes)
- Sort (latest, most liked)
- Route list (cards)
- Pagination / infinite scroll

---

## 4. Route Detail Page

**Features:**

### Display
- Route information
- Locations timeline

### Interactions
- Like
- Bookmark
- Share

### Owner Actions
- Edit route
- Delete route (with confirmation)

### Optional
- Comments

---

## 5. Create / Edit Route Page

**Features:**

### Route Info
- Title
- Description
- Theme
- Tags
- Visibility toggle

### Locations
- Add location
- Edit location
- Delete location
- Reorder locations

### Integration
- Select from saved locations

### Actions
- Save route
- Cancel

### Optional
- Route preview

---

## 6. Add Location Component (Modal)

**Features:**
- Input location details
- Validation
- Parking selection (Yes / No / Unknown)
- Save / Cancel

---

## 7. Profile Page

### User Info
- Username
- Profile photo

### Tabs

#### My Routes
- View created routes
- Edit / Delete

#### Saved Routes
- View bookmarked routes

#### My Locations (Optional)
- View saved locations

#### Settings
- Change password
- Logout

---

## 8. System-Wide Features

**Applies to multiple pages:**

- Authorization (owner-only actions)
- Input validation
- Empty states
- Loading states