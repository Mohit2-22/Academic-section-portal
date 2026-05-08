# 📊 GUNI Academic Portal (AMPICS)

A high-end, unified digital ecosystem designed for academic administration, faculty empowerment, and student success. This platform leverages AI/ML to automate complex tasks such as exam paper generation, career guidance, and attendance tracking with a premium user experience.

---

## 🛠️ Tech Stack

### **Frontend (React 19 + Vite 7)**
- **Styling:** TailwindCSS 4 (Utility-first, Glassmorphic effects)
- **Icons:** Lucide React
- **State Management:** React Hooks & Context API
- **Routing:** React Router DOM 7
- **APIs:** Axios for seamless Backend integration

### **Backend (Django 4.2.7)**
- **API Framework:** Django REST Framework (DRF)
- **Authentication:** Simple JWT (JSON Web Tokens)
- **Database:** PostgreSQL (Primary), Redis (Caching/Celery)
- **Asynchronous Tasks:** Celery (For PDF generation and ML processing)
- **ML/AI Libraries:** 
  - `scikit-learn`, `pandas`, `numpy` (Question Ranking & Data Processing)
  - `opencv-python`, `face-recognition`, `deepface` (Face ID & Anomaly Detection)
  - `reportlab`, `fpdf2` (Dynamic PDF Generation)

---

## ✨ Core Modules & Features

### 🔹 1. AI-Powered Exam Paper Generator
- **Intelligent Ranking:** Uses a trained ML model (`pyq_intelligent_model.pkl`) to rank questions based on historical importance and syllabus weightage.
- **Automated Formatting:** Generates External, Internal, and Mid-term papers instantly in professional PDF formats.
- **Syllabus Mapping:** Automatically maps questions to specific curriculum units and difficulty levels.

### 🔹 2. Smart Attendance & Anomaly Detection
- **Multi-Modal Tracking:** Supports both QR-code based scanning and **AI Face Recognition**.
- **Proxy Detection:** AI identifies suspicious attendance patterns (e.g., location mismatches or unauthorized proxies) and alerts faculty.
- **Real-time Hub:** A centralized dashboard for faculty to monitor live session attendance.

### 🔹 3. Proxy Management System (New)
- **Authorized Substitutions:** Faculty can mark proxies only for their authorized subjects.
- **Targeted Notifications:** Intelligent broadcast system that filters alerts by Course, Semester, and Section, ensuring only relevant students are notified.
- **Audit Logs:** Full tracking of who marked the proxy and when.

### 🔹 4. Intelligent Timetable Generator
- **Conflict Resolution:** Automated logic to prevent faculty double-booking and room clashes.
- **Workload Management:** Enforces a strict 3-subject cap per faculty member to maintain academic quality.
- **Shift Support:** Manages complex UG (Morning) and PG (Noon) schedules independently.

### 🔹 5. AI Career Guidance
- **Resume Analyzer:** Predicts "Job Fit" by analyzing student resumes against real-world job descriptions.
- **Skill Assessment:** Interactive technical quizzes (Python/JS) to evaluate proficiency.
- **Path Recommendations:** Generates personalized career roadmaps based on performance and interests.

### 🔹 6. Academic & HR Management
- **Curriculum Matrix:** Deep management of programs, credit systems, and multi-level syllabus trees.
- **Faculty HR:** Full onboarding system with leave logs, teaching load tracking, and credential verification.
- **Student Metrics:** 360-degree view of student profiles, guardian information, and academic progress.

---

## 📂 Project Structure

```text
Academic-module/
├── Backend/                 # Django Application (REST API)
│   ├── academics/           # Program, Curriculum & Timetable Logic
│   ├── ai_career/           # Career Guidance & Resume Analysis
│   ├── AI_Powered_..._Gen/  # ML Engine for Exam Papers
│   ├── attendance/          # QR & Basic Tracking
│   ├── attendance_ai/       # Face Recognition & Anomaly Detection
│   ├── users/               # Multi-role Auth (Admin, Faculty, Student)
│   └── ampics/              # Core Settings & Config
├── frontend/                # React Application (Vite)
│   ├── src/                 # Source Code
│   │   ├── components/      # Reusable UI (Glassmorphic design)
│   │   ├── pages/admin/     # Admin Dashboards (HR, Config)
│   │   ├── pages/faculty/   # Faculty Tools (Attendance, PYQs, Proxy)
│   │   └── pages/student/   # Student Portal (Results, Career)
└── START_ALL_SERVICES.bat   # One-click system startup
```

---

## 🚀 Getting Started

1. **Quick Launch:**
   Double-click `.\START_ALL_SERVICES.bat` in the root directory to start both Backend and Frontend.

2. **Manual Backend Setup:**
   ```bash
   cd Backend
   python -m venv .venv
   source .venv/bin/activate  # or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   python manage.py runserver
   ```

3. **Manual Frontend Setup:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 🔒 Copyright & Credits

**Developed by:**
- **Mohit Prajapati**
- **Aadarsh Singh**

© 2026 GUNI Academic Portal. All rights reserved. No part of this project may be reproduced or transmitted in any form without the prior written permission of the developers.

---
> **Status:** Active Development | **Target:** AMPICS, Ganpat University
