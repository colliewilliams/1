# 🥗 NutriAI — Smart Nutrition & Fitness Tracker

> MyFitnessPal meets ChatGPT — AI-powered nutrition and fitness tracking with a conversational coach.

## Features

### 📊 Dashboard
- Daily calorie ring with goal vs. consumed visualization
- Macro tracking (protein, carbs, fat, fiber) with progress bars
- Water intake tracker with one-tap logging
- Today's meals and workouts summary

### 🍽️ Food Log
- Search 900,000+ foods via USDA FoodData Central database
- Log meals to breakfast, lunch, dinner, or snack categories
- Manual food entry with full nutritional details
- Serving size calculator (adjusts nutrition per gram)
- Date navigation to review past days

### 🏋️ Exercise Log
- Log any exercise with duration and calorie burn
- Smart auto-calorie estimation based on exercise type
- Quick-add buttons for common workouts
- Exercise type categorization (cardio, strength, flexibility, sports)

### 🤖 AI Coach (Powered by Claude Opus)
- **Natural language food logging** — "I had 2 scrambled eggs for breakfast"
- **Exercise logging** — "I just did 30 minutes of running"
- **Nutrition analysis** — "How am I doing against my goals today?"
- **Meal planning** — "What should I eat for dinner to hit my protein goal?"
- **Personalized advice** — AI sees your actual data and goals
- Real-time streaming responses with tool-use transparency

### 🎯 Goals
- Set custom calorie and macro goals
- Pre-built presets: Weight Loss, Maintenance, Muscle Gain, High Protein
- Macro calorie calculator to ensure goals add up
- Weight tracking (current vs. target)

## Setup

### Prerequisites
- Node.js 18+
- Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))

### Installation

```bash
# Install all dependencies
npm run install:all

# Set your API key
export ANTHROPIC_API_KEY=your_api_key_here
# Or create backend/.env:  ANTHROPIC_API_KEY=your_key

# Start both servers (runs on localhost:5173)
npm run dev
```

### Running separately
```bash
# Backend (port 3001)
cd backend && node server.js

# Frontend (port 5173)
cd frontend && npm run dev
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| AI | Anthropic Claude Opus 4.6 with streaming + tool use |
| Database | SQLite (via better-sqlite3) |
| Food Data | USDA FoodData Central API |

## Architecture

```
frontend (React)  ←→  backend (Express)  ←→  Claude API
                            ↕
                        SQLite DB
                            ↕
                       USDA Food API
```

The AI coach uses Claude's tool use feature to:
1. Search the USDA food database
2. Log food to your diary in real-time
3. Log exercise sessions
4. Retrieve your daily summary for context
5. Check your nutrition goals

All tool executions happen server-side while Claude's text responses stream to the UI.
