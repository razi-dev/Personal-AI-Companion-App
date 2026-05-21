# AI Digital Twin

AI Digital Twin is an Expo + React Native app that acts as a personalized AI life coach. It learns from your daily logs, habits, journal entries, and chat history to generate practical, context-aware guidance.

## Features

- Daily logging (energy, mood, planned/completed tasks)
- Habit tracking with streaks and completion stats
- Journal capture with AI-aware context
- Conversational AI coach with structured responses
- Behavioral insights (patterns, consistency, trends, risk)
- Weekly review and proactive guidance
- 3D avatar support via Three.js + `expo-gl`
- Local-first storage with optional Supabase sync

## Tech Stack

- Expo SDK 54 + React Native 0.81
- TypeScript
- Expo Router (file-based routing)
- AsyncStorage (local persistence)
- Supabase (cloud sync/auth)
- Groq/OpenAI-compatible chat completions API
- Three.js + expo-three + expo-gl
- NativeWind + TailwindCSS

## Project Structure

```text
app/
  (tabs)/
    index.tsx      # Dashboard
    chat.tsx       # AI chat
    log.tsx        # Daily log form
    habits.tsx     # Habit tracking
    journal.tsx    # Journal
    insights.tsx   # Analytics & explainability
    review.tsx     # Weekly review
    training.tsx   # Training module (WIP)
services/          # Core business logic (AI, memory, habits, journals, sync)
components/        # Reusable UI and avatar/chat components
types/             # Shared TypeScript types
utils/             # Pattern + temporal analysis utilities
supabase/          # Supabase-related assets/config
```

## Prerequisites

- Node.js 18+
- npm 9+
- Expo Go app (for physical-device testing) or Android/iOS emulator

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Update `.env` values:

```env
EXPO_PUBLIC_OPENAI_API_KEY=your_api_key_here
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_KEY=your_supabase_anon_key
```

Notes:
- `EXPO_PUBLIC_OPENAI_API_KEY` is used for an OpenAI-compatible endpoint (Groq in this project).
- If no API key is available, local fallback decision logic is still expected to work.

## Running the App

Start the Expo dev server:

```bash
npm run start
```

Platform shortcuts:

```bash
npm run android
npm run ios
npm run web
npm run reset
```

## Core Architecture (High Level)

1. Input Layer
- Collects logs, habits, journals, and chat messages.
- Stores local data in AsyncStorage.

2. Processing Layer
- Computes feature vectors and behavior model updates.
- Runs temporal analysis and explainability generation.

3. Intelligence Layer
- Builds a rich decision context.
- Calls the AI model with a JSON-only response schema.
- Falls back to local decision engine when offline/no key.

4. Output Layer
- Renders coaching responses in chat.
- Shows insights/reviews and drives avatar/notification experiences.

## Environment Variables

Required:

- `EXPO_PUBLIC_OPENAI_API_KEY`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY`

## Useful Development Notes

- Keep date handling local-time safe to avoid UTC day-shift bugs.
- Maintain response schema compatibility when editing AI output fields.
- Keep local fallback logic functional for degraded network/API conditions.
- When adding new persisted models, use the `@digital_twin_` AsyncStorage key prefix convention.

## Troubleshooting

- Metro cache issues:

```bash
npm run reset
```

- Missing environment variables:
  - Verify `.env` exists at project root.
  - Restart Expo after changing env values.

- Emulator/device connection issues:
  - Ensure device and machine are on the same network (Expo Go), or use emulator defaults.

## Scripts

- `npm run start` - Start Expo development server
- `npm run android` - Launch Android flow
- `npm run ios` - Launch iOS flow
- `npm run web` - Launch web build in dev mode
- `npm run reset` - Start with cleared Metro cache

## License

No license file is currently included in this repository.
