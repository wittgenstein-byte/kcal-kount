# 🎯 KcalKount — Premium Calorie Tracker & TDEE Planner

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![JavaScript](https://img.shields.io/badge/javascript-%23F7DF1E.svg?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=flat&logo=css3&logoColor=white)](https://www.w3.org/TR/css-2020/)

**KcalKount** is a modern, responsive, privacy-first health and nutrition web application built as a Vanilla JavaScript SPA. It blends clean design with scientific TDEE calculations and AI-assisted food recognition to make daily calorie and macro tracking fast, interactive, and effortless.

---

## ✨ Features

### 1. 📊 Modern Interactive Dashboard
- **Circular Progress Metrics**: Real-time SVG progress ring displaying consumed calories against your daily target budget.
- **Macronutrient Tracking**: Live macro breakdown for Protein, Carbohydrates, and Fats with visual rings and goal thresholds.
- **⚡ Quick-Log Input**: Log meals directly from the dashboard keyboard in seconds (e.g. typing `Banana 105` and pressing Enter).
- **Calorie Warning Banner**: Immediate visual alert if you exceed your daily calorie goal.
- **Theme Support**: Seamless Dark and Light theme toggle with custom CSS design tokens.

### 2. 🧠 Smart BMR & TDEE Calculator
- Scientific **Mifflin-St Jeor Equation** calculates your Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE).
- **Activity Multipliers**: Configurable for Sedentary, Lightly Active, Moderately Active, Very Active, or Extra Active lifestyles.
- **Goal Alignment**: Custom caloric adjustments for weight loss (deficit), weight maintenance, or muscle gain (surplus).
- **Manual Goal Option**: Set custom calorie targets directly if recommended by your nutritionist or trainer.

### 3. 📷 AI Food Scanner (Vision AI)
- **Camera & Gallery**: Live video camera stream capture with mobile-optimized full-screen viewfinder, flashlight toggle, and image upload fallback.
- **Portion & Scale Reference**: System prompt tuned to gauge scale using reference objects (cutlery, hands, plates, bowls) for accurate portion estimations.
- **Smart JSON Mode Extraction**: Connects via `/api/analyze` to Gemini models (`gemini-3.1-flash-lite`, etc.) with robust JSON parsing.
- **Telemetry & Accuracy Log**: Tracks difference (deltas) between AI predictions and user-verified nutrition edits (stores up to 50 logs).

### 4. 📈 Analytics & Trends
- **Interactive Charting**: Built with [ApexCharts](https://apexcharts.com/) featuring calorie target annotation lines and responsive axes.
- **Flexible Ranges**: Switch between 7-day and 30-day historical time windows.
- **Summary Metrics**: Instant calculation of average daily intake, goal compliance rate, and maximum/minimum calorie days.

### 5. ⭐️ Favorites Library & Daily Logs
- **One-Click Quick Log**: Save frequent meals to Favorites and log them in a single tap.
- **Searchable Favorites**: Real-time filtering and search for saved meals.
- **Daily Meal Management**: Grouped meal listings with inline macro pills, quick editing, deleting, and favorite toggling.

### 6. 💾 Local-First & Data Privacy
- **Zero Login Friction**: No sign-up or remote user database required. Data resides locally in your browser.
- **Full Data Portability**: Comprehensive JSON Export and Import for seamless device migration and offline backups.

---

## 🏛️ Architecture & Design Patterns

The codebase is engineered around **SOLID Principles** and **GRASP Patterns** without heavy front-end framework bloat:

- **Single Responsibility Principle (SRP)**: Separated domain concerns into dedicated services (`MealService`, `FavoriteService`, `GoalService`, `TelemetryService`, `StorageService`).
- **Observer / Indirection (EventBus)**: `src/core/events.js` decouples domain model changes from UI render routines.
- **Dependency Inversion Principle (DIP)**: `StorageService` abstracts `localStorage` access and batches rapid writes via debouncing.
- **Controller Pattern (GRASP)**: `app.js` acts as the Application Controller, orchestrating UI events and delegating business operations to domain services.
- **Information Expert & Creator**: Domain services encapsulate entity creation, validation, filtering, and summary math.

---

## 📁 Project Structure

```text
├── index.html                  # Single-page application markup
├── style.css                   # Custom CSS variables, themes, and layout styles
├── app.js                      # Application Controller (DOM events & orchestration)
├── package.json                # Project scripts and dependencies
├── vite.config.js              # Vite configuration
├── vite-plugin-ai-proxy.js     # Dev-server proxy for Gemini AI endpoint
└── src/
    ├── core/
    │   ├── events.js           # EventBus for decoupled domain-to-view notifications
    │   └── storage.js          # StorageService abstraction with debouncing
    ├── domain/
    │   ├── MealService.js      # Meal CRUD, entity creation & daily summaries
    │   ├── FavoriteService.js  # Favorites management & duplicate detection
    │   └── GoalService.js      # TDEE & calorie budget calculations
    ├── ai.js                   # Gemini API food analysis & JSON extraction
    ├── backup.js               # BackupService for JSON export/import
    ├── calculator.js           # Mifflin-St Jeor math formula
    ├── camera.js               # Camera stream, HEIC conversion & image compression
    ├── chart.js                # ApexCharts wrapper and configuration
    ├── state.js                # Reactive state facade
    ├── telemetry.js            # TelemetryService for scan prediction tracking
    └── ui.js                   # DOM rendering, modals, progress rings, and toasts
```

---

## 🛠️ Tech Stack

- **Core**: Vanilla HTML5, Modern CSS (Custom Properties, Themes)
- **Logic**: ES6+ JavaScript Modules
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/)
- **Visuals**: [ApexCharts](https://apexcharts.com/)
- **Image Handling**: [browser-image-compression](https://www.npmjs.com/package/browser-image-compression), [heic2any](https://www.npmjs.com/package/heic2any)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm`

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/narawit/kcal-kount.git
   cd kcal-kount
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
Start the Vite development server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### Building for Production
```bash
npm run build
npm run preview
```

### Configuring AI Food Scanner
1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
2. Set your Google AI Studio / Gemini API key:
   ```env
   AI_API_KEY=your_actual_gemini_api_key_here
   ```
3. During development, Vite automatically proxies `/api/analyze` and `/api/models` to Google's OpenAI-compatible endpoint.

---

## 🔒 License
Distributed under the MIT License. See [LICENSE](LICENSE) for more details.
