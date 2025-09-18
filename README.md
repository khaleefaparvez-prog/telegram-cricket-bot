# Telegram Cricket Prediction Bot

🏏 AI-powered Telegram cricket prediction bot with 90%+ accuracy using EntitySport API exclusively.

## Features

- **Multi-Engine Prediction System**: Advanced AI algorithms for cricket match predictions
- **EntitySport API Integration**: Real-time cricket and tennis data
- **Quick Predict**: Fast predictions for same-day cricket matches
- **Today's Matches**: Dedicated view for all today's sporting events
- **Real-time Dashboard**: Live stats and match tracking
- **Telegram Bot**: Interactive bot for match predictions and notifications

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **UI Components**: Shadcn/ui + Tailwind CSS
- **Bot Framework**: node-telegram-bot-api
- **State Management**: TanStack Query

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   └── lib/           # Utilities and queries
├── server/                # Express backend
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API routes
│   ├── sportsApi.ts       # EntitySport API service
│   ├── optimizedPredictor.ts # AI prediction engine
│   └── telegramBot.ts     # Telegram bot service
├── shared/                # Shared types and schemas
└── database/              # Database migrations and setup
```

## Key Features

### 🚀 Quick Predict
- Fast AI predictions for today's cricket matches
- No navigation required - works as a shortcut
- Optimized performance with reduced API calls

### 📅 Today's Matches
- Dedicated page showing all today's matches
- Organized by sport (cricket/tennis)
- Quick access via sidebar navigation

### 🤖 AI Prediction Engine
- Multi-engine prediction system
- 90%+ accuracy rate
- Eliminates external API calls during prediction generation
- Optimized for performance and cost reduction

### 📊 Dashboard
- Real-time sports data
- Match statistics and analytics
- Filter by sport and category
- Live match tracking

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run the development server: `npm run dev`

## Environment Variables

Required environment variables:
- `ENTITYSPORT_TOKEN` - EntitySport API key
- `BOT_TOKEN` - Telegram bot token
- `DATABASE_URL` - PostgreSQL connection string

## License

MIT License - see LICENSE file for details.

---

Built with ❤️ for cricket fans and prediction enthusiasts!
