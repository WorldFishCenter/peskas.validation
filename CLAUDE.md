# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend Development
- `npm run dev:frontend` - Start Vite development server on port 3000
- `npm run build` - Build the frontend for production (TypeScript compilation + Vite build)
- `npm run lint` - Run ESLint with TypeScript support
- `npm run preview` - Preview production build

### Backend Development
- `npm run dev:backend` - Start Express server on port 3001 (or PORT env var)
- `npm run server` - Start production server
- `npm run dev` - Start both frontend and backend concurrently

### Full Development Setup
- `npm run dev` - Recommended for development (runs both frontend and backend)

## Architecture Overview

This is a full-stack React + Express + MongoDB application for data validation and enumerator performance tracking.

### Project Structure
- **Frontend**: React 18 + TypeScript + Vite + React Router + TanStack Table
- **Backend**: Express.js server with MongoDB integration
- **External API**: KoboToolbox integration for survey data

### Key Components Architecture

#### Frontend (`src/`)
- **App.tsx**: Main application with routing, authentication flow, and error boundaries
- **Authentication**: Context-based auth system (`src/components/Auth/`)
- **Main Features**:
  - `ValidationTable`: Data validation interface with TanStack Table for sorting/filtering
  - `EnumeratorPerformance`: Dashboard with Highcharts for performance metrics
- **Layout**: Shared layout components with Tabler UI framework
- **API Layer**: Custom hooks for data fetching (`src/api/`)

#### Backend (`server/`)
- **Express Server**: REST API with CORS enabled
- **MongoDB**: Database connection with connection pooling
- **KoboToolbox Integration**: Fetches survey submissions and syncs with local database
- **Key Endpoints**:
  - `/api/kobo/submissions` - Main data endpoint combining KoboToolbox API with local MongoDB data

#### External API Integration (`api/`)
- **KoboToolbox**: Survey data collection platform integration
- **Admin Functions**: Data refresh and management endpoints

### Data Flow
1. KoboToolbox collects survey submissions
2. Backend fetches data from KoboToolbox API and stores/syncs with MongoDB
3. Frontend displays data through ValidationTable and EnumeratorPerformance dashboards
4. Users can update validation statuses which sync back to the database

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, React Router v7, TanStack Table v8, Highcharts
- **Styling**: Tabler Core UI framework, Bootstrap components
- **Backend**: Express.js, MongoDB with native driver
- **Development**: Concurrently for running both servers, ESLint for linting

### Environment Configuration
- Uses `.env` files for configuration
- Separate `.env.production` for production settings
- Required environment variables include MongoDB URI and KoboToolbox API credentials

### Key Development Notes
- TypeScript strict mode enabled with comprehensive linting rules
- Component-based architecture with shared layout and error boundaries
- Custom hooks pattern for API data fetching
- Highcharts integration requires extended TypeScript declarations
- Authentication state managed through React Context