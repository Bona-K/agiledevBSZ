# MyVibe Low-Fi Wireframes

This document outlines the core page layouts for the **MyVibe** platform, mapped to the specific functional requirements defined in the Feature List.

## Global Navigation Bar (Header)
**Consistency Rule**: Applied across all authenticated and unauthenticated pages.
`[myvibe Logo] ---- [Home] ---- [Explore] ---- [Profile/Login]`

---

## 1. Landing Page
**Consistency Rule**: 2 (Lading Page Features)
```
__________________________________________________________________
|  [myvibe LOGO]                                [Login] [Sign Up] |
|________________________________________________________________|
|                                                                |
|            [ HERO IMAGE / ILLUSTRATION ]                       |
|          "Plan your perfect day, effortlessly."                |
|                                                                |
|           [ Start Planning Now (CTA Button) ]                  |
|________________________________________________________________|
|  [ Feature 1 ]        [ Feature 2 ]         [ Feature 3 ]      |
|  Create Locations     Build Routes          Share with Friends |
|________________________________________________________________|
```
---

## 2. Authentication & User Management
**Related Features**: 1.1 (Sign Up), 1.2 (Login), 1.4 (Change Password)

### Sign Up 
```
__________________________________________________________________
| [Logo]          [Home]          [Explore]               [Login] |
|________________________________________________________________|
|                                                                |
|                        CREATE ACCOUNT                          |
|                                                                |
|          Username:      [____________________]                 |
|          Email:         [____________________]                 |
|          Password:      [____________________]                 |
|          Confirm Pass:  [____________________]                 |
|                                                                |
|          [ ERROR: Passwords do not match ] (Validation)        |
|                                                                |
|                        [ SIGN UP (Button) ]                    |
|________________________________________________________________|
```
### Login
```
__________________________________________________________________
| [Logo]          [Home]          [Explore]             [Sign Up] |
|________________________________________________________________|
|                                                                |
|                             LOGIN                              |
|                                                                |
|          Email/User:    [____________________]                 |
|          Password:      [____________________]                 |
|                                                                |
|          [ ERROR: Invalid credentials ]                        |
|                                                                |
|                        [ LOGIN (Button) ]                      |
|________________________________________________________________|
```
### Change Password
```
__________________________________________________________________
| [Logo]          [Home]          [Explore]             [Profile] |
|________________________________________________________________|
|                                                                |
|                        CHANGE PASSWORD                         |
|                                                                |
|          Old Password:  [____________________]                 |
|          New Password:  [____________________]                 |
|          Confirm New:   [____________________]                 |
|                                                                |
|          [ SUCCESS: Password updated ]                         |
|                                                                |
|                        [ UPDATE (Button) ]                     |
|________________________________________________________________|
```
---

## 3. Home / Dashboard
**Related Features**: 3 (Dashboard Layout), 10 (Ranking Features)

```text
__________________________________________________________________
| [Logo]          [Home]          [Explore]             [Profile] |
|________________________________________________________________|
|                                                                |
|  [ Search Bar (Placeholder: Search routes...) ]    [+ Create]  |
|________________________________________________________________|
|                                                                |
|  RANKING (Top Rated/Liked) - Feature 10                        |
|  1. Route Title A  [❤❤ 250] [Comment 12]                       |
|  2. Route Title B  [❤❤ 180] [Comment 08]                       |
|  3. Route Title C  [❤❤ 155] [Comment 05]                       |
|________________________________________________________________|
|                                                                |
|  LATEST ROUTES - Feature 3                                     |
|  [ Card ]  [ Card ]  [ Card ]  [ Card ]                        |
|________________________________________________________________|
```

---

## 4. Explore (Search & Discovery)
**Related Features**: 4.1 - 4.5 (Search, Filter, Sort, List Display), 10 (Ranking via Filters)
* **Default State**: Theme(All), Tag(All), Sort(Most Likes) to achieve ranking effect.

```text
_______________________________________________________________________________________
| [Logo]          [Home]          [Explore]                                  [Profile] |
|_______________________________________________________________________________________|
|                                                                                       |
|  FILTER & SORT          |  [ Search by keyword (4.1)        ] [ Search Button ]       |
|                         |_____________________________________________________________|
|  [ SORT - 4.3 ]         |                                                             |
|  (●) Most Likes         |  Showing results for: "All Themes", "All Tags"              |
|  ( ) Newest             |                                                             |
|                         |  _________________________________________________________  |
|  [ THEME - 4.2 ]        |  | [ Route Card (4.4) ] [ Route Card ]      [ Route Card ] | |
|  (●) All                |  |  Thumbnail Image      Image                Image         | |
|  ( ) Food               |  |  Route Title          Title                Title         | |
|  ( ) Nature             |  |  Tags...              Tags...              Tags...       | |
|  ( ) City               |  |  [❤ Like Count]       [❤ Count]            [❤ Count]     | |
|                         |  |_________________________________________________________| |
|  [ TAG - 4.2 ]          |                                                             |
|  (●) All                |  _________________________________________________________  |
|  ( ) Cafe               |  | [ Route Card ]       [ Route Card ]       [ Route Card ] | |
|  ( ) Hiking             |  |  Image                Image                Image         | |
|  ( ) Photo              |  |  Title                Title                Title         | |
|  ( ) History            |  |  Tags...              Tags...              Tags...       | |
|                         |  |  [❤ Count]            [❤ Count]            [❤ Count]     | |
|                         |  |_________________________________________________________| |
|                         |                                                             |
|                         |             [ Pagination: 1 2 3... - 4.5 ]                  |
|_________________________|_____________________________________________________________|
```

---

## 5. Create / Edit Route & Add Location
**Related Features**: 6 (Create), 7 (Edit), 8 (Add Location Management)

### Create / Edit Route Page
```text
__________________________________________________________________
| [Logo]          [Home]          [Explore]             [Profile] |
|________________________________________________________________|
|                                                                |
|  ROUTE INFO (Feature 6.1 / 7)                                  |
|  Title: [___________]  Theme: [Select v]  Visibility: [Pub/Pri]|
|  Desc:  [____________________________________________________] |
|  Tags:  [_________________] [+ Add]                            |
|________________________________________________________________|
|                                                                |
|  LOCATIONS (Feature 6.2 - Drag to Reorder)                     |
|  1. [Name] - [Visit Time]   [Edit] [Remove]                    |
|  2. [Name] - [Visit Time]   [Edit] [Remove]                    |
|                                                                |
|  [ + ADD LOCATION ] (Triggers Modal Below)                     |
|________________________________________________________________|
|                                                                |
|  [ SAVE ROUTE (Feature 6.3) ]                                  |
|________________________________________________________________|
```

### Add Location Modal (8.1, 8.2, 8.3)
```text
__________________________________________________________________
|                      ADD NEW LOCATION (8.1)            [ X ]   |
|________________________________________________________________|
|                                                                |
|  *Place Name:  [____________________________________]          |
|  *Description: [____________________________________]          |
|  *Visit Time:  [ HH : MM ] (e.g., 10:30 AM)                    |
|   Parking:     [ Select: Easy/Paid/No v ]                      |
|   Tags:        [_________________] [+ Add]                     |
|   Image:       [ Choose File / Upload Image ]                  |
|                                                                |
|  -- OR --                                                      |
|  SAVED LOCATIONS (8.2):                                        |
|  [ ] Saved Location A  [ ] Saved Location B                    |
|                                                                |
|  [ Cancel ]                          [ SAVE LOCATION (8.3) ]   |
|________________________________________________________________|
```

---

## 6. Route Detail
**Related Features**: 5.1 - 5.5 (Info, Location List, Interaction, Owner Controls, Comments)

```text
__________________________________________________________________
| [Logo]          [Home]          [Explore]             [Profile] |
|________________________________________________________________|
|                                                                |
|  [ HERO IMAGE ]  TITLE: Perth Coastal Drive (5.1)              |
|  By: User123 | [❤ Like] [Bookmark] [Share] (5.3)               |
|________________________________________________________________|
|                                                                |
|  [ Owner Only (5.4/11): EDIT ROUTE ] [ DELETE ROUTE ]          |
|________________________________________________________________|
|                                                                |
|  ORDERED LOCATIONS (5.2):                                      |
|  09:00 - Location Name A                                       |
|          "Description..." [Parking: Easy] [Image]              |
|  ------------------------------------------------------------  |
|  14:00 - Location Name B                                       |
|________________________________________________________________|
|                                                                |
|  COMMENTS (5.5):                                               |
|  [User X]: "Great route, very helpful!" [Timestamp]            |
|  [Write a comment...] [Submit]                                 |
|________________________________________________________________|
```

---

## 7. User Profile
**Related Features**: 9.1 - 9.4 (UserInfo, My Routes, Saved Routes, My Locations), 9.5 (Settings)

```text
__________________________________________________________________
| [Logo]          [Home]          [Explore]    [Settings][Logout]|
|________________________________________________________________|
|                                                                |
|  ( Profile Photo )  Username (9.1)                             |
|________________________________________________________________|
|  [ MY ROUTES (9.2) ] [ SAVED ROUTES (9.3) ] [ MY LOCATIONS (9.4) ]|
|________________________________________________________________|
|                                                                |
|  [ Route Card ] -> [ Detail View | Edit | Delete ]             |
|  [ Route Card ] -> [ Detail View | Edit | Delete ]             |
|________________________________________________________________|
```