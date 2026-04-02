# Nevigation Flow
graph TD
    %% Entry Point
    Landing[Landing Page] --> Login[Login Page]
    Landing --> SignUp[Sign Up Page]
    
    %% Main Hubs
    Login --> Home[Home / Dashboard]
    SignUp --> Home
    
    %% Core Navigation (Global Header)
    Home <--> Explore[Explore / Search]
    Home <--> Profile[User Profile]
    Explore <--> Profile
    
    %% Functional Flows (The Click Actions)
    Home -->|Click Route Card| Detail[Route Detail]
    Home -->|Click Button| Create[Create Route]
    
    Explore -->|Click Route Card| Detail
    
    Profile -->|Click My Route| Detail
    Profile -->|Click Saved Route| Detail
    
    %% Detail Page Actions
    Detail -->|Owner Only: Click Edit| Edit[Edit Route]
    
    %% Sub-flows
    Create --> AddLoc[Add Location Modal]
    Edit --> AddLoc
    Profile --> Settings[Settings / Change Pass]

# Information Architecture
myvibe Overall Architecture
├── Public Access
│   ├── Landing Page (Intro, CTA)
│   └── Auth
│       ├── Login (Email, Password)
│       ├── Sign Up (Username, Email, Validation)
│       └── Change Password (Secure Update)
│
├── Authenticated Core (Global Header)
│   ├── Home / Dashboard
│   │   ├── Search Bar (Quick Entry)
│   │   ├── Rankings (Top-Liked)
│   │   └── Latest Routes (Recents)
│   │
│   ├── Explore (Main Discovery)
│   │   ├── Sidebar (Theme/Tag Filters, Sort)
│   │   └── Main Grid (Route Cards, Pagination)
│   │
│   └── User Profile
│       ├── User Info (Overview)
│       ├── Tab: My Routes (Created)
│       ├── Tab: Saved Routes (Bookmarks)
│       └── Tab: My Locations (Saved Places)
│
├── Functional Pages
│   ├── Route Detail
│   │   ├── Location Timeline (Visit Times, Parking)
│   │   ├── Interaction (Like, Share, Bookmark)
│   │   └── Comment Section (Read/Write)
│   │
│   └── Route Editor (Create & Edit)
│       ├── Route Form (Metadata, Visibility)
│       ├── Location Manager (Reorder/Remove)
│       └── Add Location (New Input vs. Reuse Saved)
│
└── System
    └── Settings (Account Management)