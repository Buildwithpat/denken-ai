# DenkenAI – Project Context

---

## 🧠 Overview

DenkenAI is an adaptive test + revision platform for:

* JEE
* NEET
* CBSE
* Custom Exams

The platform focuses on:

* Smart test generation
* Revision system
* Performance analysis
* Manual evaluation (AI evaluator later)
* Guided learning (DenBot)

---

## 🏗️ Tech Stack

* Next.js 14 (App Router)
* TypeScript
* Tailwind CSS
* Shadcn/UI
* Node.js backend (planned)
* MongoDB (planned)
* FastAPI AI service (planned)

---

## 📁 Project Structure

* /frontend → Next.js app
* /backend → Express (in progress)
* /ai-service → FastAPI (planned)

---

## 🏗️ Current Status (UI Phase)

### ✅ Completed

* Dashboard UI

* Onboarding (exam selection)

* Sidebar + Topbar

* Notifications Page (grid layout)

* Test Page (configuration)

* Test Attempt Page (MCQ + Numerical + Timer + Palette + Bookmark)

* Result Page:

  * JEE/NEET → objective results
  * CBSE/CUSTOM → manual evaluation UI

* Revision Center:

  * Smart Notes (structured + depth toggle)
  * Quick Revision Modes
  * Weak Areas
  * Mistake Log
  * Revision Roadmap (connected)

* Analysis Page:

  * Performance stats
  * Subject breakdown
  * Weak topics
  * Recommendations
  * Roadmap

* Exam Mode (JEE/NEET only)

* Denken Studio (Smart Test Builder)

* Focus Areas Page (priority-based learning UI)

* Profile Page:

  * User details
  * Avatar edit
  * Password change
  * Mobile number (UI)
  * Saved Questions system

* DenBot (interactive guide, no AI)

---

## 🧪 Test System

### Test Types:

* Normal Test
* Rapid Drill
* PYQ Mode (not for CUSTOM)
* Mistake Revision
* Smart Test (Denken Studio)

---

### Test Flow:

User → Select Mode → Configure → Start → Loader → Attempt → Result → Analysis → Revision

---

### TestContext (Global State)

```ts
{
  mode: "rapid" | "pyq" | "mistake" | "normal" | "smart",
  exam: "JEE" | "NEET" | "CBSE" | "CUSTOM",
  subject: string,
  chapter: string,
  questions: number,
  time: number
}
```

---

## 📚 Revision System

### Smart Notes:

Supports:

* Theory
* Formula
* Both

Structured:

* Concepts
* Explanation
* Key Points
* Formulas
* Mistakes

Includes:

* Depth toggle (Short / Medium / Detailed)
* Regenerate (UI only)

---

### Navigation:

* Roadmap → Revision
* Weak Topics → Revision
* Mistake Log → Revision/Test

---

## 📊 Analysis System

Includes:

* Performance overview
* Subject breakdown
* Mistake analysis
* Question type analysis
* Weak topics (clickable)
* Recommendations
* Revision roadmap

---

## 🎯 Focus Areas (IMPORTANT)

Focus Areas = What student should study next

---

### Structure:

* High Priority 🔴
* Medium Priority 🟡
* Strong Areas 🟢

---

### Each Topic:

* Accuracy
* Attempts
* Trend

---

### Actions:

* Practice
* Revise
* View Analysis

---

### Side Panel:

* Suggestions
* Quick Actions

---

## 🧾 Evaluation System (MVP)

### CBSE / CUSTOM:

Manual evaluation:

* Question grid
* Suggested answer
* Marking scheme
* Score calculation

---

### AI Evaluator:

* NOT implemented
* Marked as "Coming Soon"

---

## 🔖 Saved Questions System

* Bookmark questions during test
* Stored in state (UI phase)

---

### In Profile:

* View saved questions
* Filter by subject/unit
* Actions:

  * Practice
  * View Solution

---

## 🤖 DenBot (IMPORTANT)

DenBot = Interactive guide (NOT AI chat)

---

### Features:

* Explains platform features
* Feature cards navigation
* CTA navigation

---

### Includes:

* Header robot icon trigger
* Floating button trigger
* Feedback system (UI)
* Chat-style interface

---

## 🔔 Notifications System

Includes:

* Updates
* Performance alerts
* Revision reminders
* Streak alerts

---

### Layout:

* Grid-based (2 columns desktop)

---

## 📱 Mobile Restrictions

Allowed on mobile:

* Dashboard
* Revision
* Profile

---

Restricted pages:

* Tests
* Exam Mode
* Denken Studio
* Focus Areas
* Analysis

---

### Behavior:

Show:

"Use desktop to access this feature"

---

## ⏳ Loading System

Before test/exam start:

* Full-screen loader
* Same as onboarding style

---

### Messages:

* "Preparing your test..."
* "Analyzing performance..."
* "Optimizing difficulty..."

---

## ⚠️ Rules (VERY IMPORTANT)

* DO NOT redesign UI
* Maintain dark theme (#0B0E14)
* Use #8762F7 as primary color
* Keep components modular
* Use mock data only
* NO backend logic yet
* DO NOT disable features
* Simulate behavior using state

---

## 🎯 Current Task

## 🎯 Current Task (Landing Page Upgrade)

Add a dashboard preview inside the Hero section of the landing page.

---

### Goal:

Make the product feel real and increase visual trust by showing an actual dashboard preview.

---

### Implementation Details:

* Use an image from `/public/DashboardPreview.png`
* Place it inside the existing Hero frame (DO NOT redesign layout)
* Image must:

  * Fill container properly
  * Maintain aspect ratio
  * Not look centered/boxed
  * Avoid empty padding

---

### Design Requirements:

* Keep current frame structure
* Remove unnecessary wrappers (no scaling containers)
* Remove fixed height restrictions
* Use full-width responsive image
* Add subtle glow background (#8762F7)
* Maintain dark theme consistency

---

### Behavior:

* Responsive on mobile
* No animations required initially
* No backend logic

---

### Important Constraints:

* DO NOT redesign hero layout
* DO NOT change typography or spacing of text
* Only improve preview section
* Use Next.js Image component

---

### Expected Output:

* Clean, full-width dashboard preview
* Premium look (not boxed or floating)
* Integrated naturally into hero section


## 🚀 Goal

Complete ALL UI flows before backend integration

* Everything must feel real and interactive
* Backend should plug in without redesign
