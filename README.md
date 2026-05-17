# MyVibe – Social Route Sharing Platform

## Overview

MyVibe is a Flask-based web application that allows users to create, explore, and share travel routes with other users in a social-media style environment. The application combines user authentication, OTP email verification, interactive maps, route sharing, notifications, and profile management into a single collaborative platform.

The application was designed to provide an engaging and user-friendly experience where users can:

- Create routes with multiple locations
- View routes visually on interactive maps
- Follow other users and explore shared routes
- Manage profiles and notifications
- Securely authenticate using OTP verification

The project uses a lightweight Flask + Jinja architecture with SQLite as the database backend and Leaflet.js for map visualisation.

---

# Application Design and Features

## Core Features

### Authentication System

- User registration and login
- OTP-based email verification
- Password reset with OTP verification
- Session-based authentication

### Route Management

- Create travel routes with multiple stops
- Store route coordinates and location details
- Interactive route visualisation using Leaflet maps
- Explore routes shared by other users

### Social Features

- User profiles
- Follow/unfollow functionality
- Notifications system
- Public route sharing

### Interactive UI

- Responsive frontend design
- Modern social-media inspired interface
- Dynamic map rendering
- Smooth navigation between pages

---

# Technology Stack

| Technology              | Purpose                    |
| ----------------------- | -------------------------- |
| HTML / CSS / JavaScript | Frontend development       |
| Flask                   | Backend web framework      |
| Jinja2                  | Template rendering         |
| SQLite                  | Database                   |
| SQLAlchemy              | ORM database integration   |
| Leaflet.js              | Interactive maps           |
| Selenium                | Browser automation testing |
| Python unittest         | Unit testing               |

---

# Project Structure

```text
agiledevBSZ/
├── app.py
├── auth.py
├── models.py
├── otp_service.py
├── route_service.py
├── utils.py
├── requirements.txt
├── templates/
├── static/
├── tests/
└── instance/
```

---

# Group Members

| UWA ID   | Name                                  | GitHub Username |
| -------- | ------------------------------------- | --------------- |
| 25079168 | SHARMEL RAYEN REMINGTON VILLAVA RAYEN | SharmelRayen    |
| 24691469 | BONA KIM                              | Bona-K          |
| 25079109 | ZHENYAO XU                            | Haze7l8         |

# Installation and Setup

## 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd agiledevBSZ
```

## 2. Create a Virtual Environment

### macOS / Linux

```bash
python3 -m venv venv
source venv/bin/activate
```

### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

## 3. Install Dependencies

```bash
pip install -r requirements.txt
```

## 4. Configure Environment Variables

Create a `.env` file in the project root and configure the following:

```env
SECRET_KEY=your_secret_key
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
```

---

# Launching the Application

Run the Flask application using:

```bash
python3 app.py
```

The application will start locally and can typically be accessed at:

```text
http://127.0.0.1:5000
```

---

# Running the Tests

## Unit Tests (Fast, No Browser)

```bash
python -m unittest tests.test_unit -v
```

## Selenium Tests (Requires Chrome/Chromium)

Install Selenium:

```bash
pip install selenium
```

Run Selenium tests:

```bash
python -m unittest tests.test_selenium -v
```

## Run Selenium Tests with Visible Browser

```bash
HEADLESS=0 python -m unittest tests.test_selenium -v
```

---

# Application Usage

1. Create an account using the signup page.
2. Verify your email using the OTP sent to your inbox.
3. Login to access the dashboard.
4. Create and manage routes.
5. Explore routes shared by other users.
6. Follow users and interact through notifications.

---

# Future Improvements

- Real-time chat between users
- Mobile responsive enhancements
- Route recommendations using AI
- Advanced social interaction features
- Cloud deployment support

---

# License

This project was developed for academic purposes as part of a UWA Agile Web Development assignment.
