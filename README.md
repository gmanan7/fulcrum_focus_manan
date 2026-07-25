# Fulcrum Focus - Manufacturing Operations App

Fulcrum Focus is organized into separate `frontend` and `backend` directories.

## Project Structure

```
fulcrum-focus/
├── frontend/             # React + Vite + TypeScript + Tailwind CSS Frontend
├── backend/              # Node.js + Express + PostgreSQL Backend API
├── supabase/             # Supabase Migrations & Config
├── package.json          # Root runner scripts & workspace management
└── README.md
```

## Getting Started

### Installation

Install dependencies for both frontend and backend from the root directory:

```bash
# Install root dependencies (concurrently)
npm install

# Install workspace dependencies
npm run install:all
```

### Running in Development Mode

You can run both frontend and backend concurrently from the root directory:

```bash
# Run both frontend (port 8080) and backend (port 3001) concurrently
npm run dev

# Or run individual applications
npm run dev:frontend
npm run dev:backend
```

### Building for Production

```bash
# Build both frontend and backend
npm run build

# Or build individually
npm run build:frontend
npm run build:backend
```
