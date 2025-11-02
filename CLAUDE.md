# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend Development
- `npm run dev:frontend` - Start Vite development server on port 3000
- `npm run build` - Build for production (TypeScript compilation + Vite build)
- `npm run lint` - Run ESLint with TypeScript type checking
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run preview` - Preview production build

### Backend Development
- `npm run dev:backend` - Start Express server on port 3001 (or PORT env var)
- `npm run server` - Start production server

### Full Development Setup
- `npm run dev` - Recommended for development (runs both frontend and backend concurrently)

## Architecture Overview

This is a full-stack React + Express + MongoDB application for data validation and enumerator performance tracking for survey data from KoboToolbox.

### Project Structure
- **Frontend (`src/`)**: React 18 + TypeScript + Vite + React Router v7 + TanStack Table v8
- **Backend (`server/`)**: Express.js server with MongoDB native driver
- **API Routes (`api/`)**: Serverless functions (Vercel-compatible) for KoboToolbox integration and data management

### Key Architecture Concepts

#### Data Flow (Updated Architecture - MongoDB as Single Source of Truth)
1. **KoboToolbox** collects survey submissions via mobile/web forms
2. **R Pipeline** (external process):
   - Fetches submissions from KoboToolbox API
   - Calculates alert flags based on validation rules
   - Updates validation status in KoboToolbox
   - Writes all data to MongoDB `surveys_flags-{asset_id}` collections (including validation_status, validated_at, validated_by)
3. **Backend** reads submissions from MongoDB only (no KoboToolbox API calls during page load)
4. **Frontend** displays data in ValidationTable (TanStack Table) and EnumeratorPerformance dashboard (Highcharts)
5. **Validation Status Updates** (from portal):
   - Update MongoDB `surveys_flags-{asset_id}` collection
   - Optionally update KoboToolbox via `/api/kobo/validation_status/:id`
   - Next R pipeline run syncs any external changes

#### Authentication Flow
- JWT-based authentication using MongoDB users collection
- `authenticateUser` middleware validates tokens and adds `req.user`
- `requireAdmin` middleware restricts admin-only endpoints
- User permissions stored in `users` collection with `permissions.surveys` array
- AuthContext provides authentication state to React components

#### Multi-Survey Architecture
- **Dynamic Collections per Survey**:
  - `surveys_flags-{asset_id}` - Submission data and alert flags per survey
  - `enumerators_stats-{asset_id}` - Pre-computed statistics per survey
- **Survey Configuration** (`surveys` collection):
  - `name`, `country_id`, `asset_id`, `active` status
  - `kobo_config` - API URL and token for each survey's KoboToolbox server
  - `alert_codes` - Survey-specific alert code definitions
- **User Permissions**:
  - Admin users can access all surveys (if `permissions.surveys` is empty)
  - Regular users only access surveys in their `permissions.surveys` array
  - Managed via Airtable sync (`scripts/sync_users_from_airtable.js`)

#### Database Collections
- **`users`**: User accounts with roles and survey permissions
- **`surveys`**: Survey metadata, KoboToolbox config, alert codes
- **`surveys_flags-{asset_id}`**: Submission data per survey (written by R pipeline)
  - Fields: submission_id, submitted_by, submission_date, alert_flag
  - Fields: validation_status, validated_at, validated_by (NEW - from R pipeline)
- **`enumerators_stats-{asset_id}`**: Pre-computed statistics per survey/enumerator
  - Contains totalSubmissions, submissionsWithAlerts, errorRate, submissionTrend
  - Refreshed via admin endpoint `/api/admin/refresh-enumerator-stats`
- **`countries`**: Country metadata for multi-country support

#### API Endpoints (server/index.js)
- `GET /api/kobo/submissions` - Reads submissions from MongoDB `surveys_flags-{asset_id}` collections (filtered by user permissions)
- `PATCH /api/submissions/:id/validation_status` - Update validation status in MongoDB (requires auth, tracks validated_by)
- `PATCH /api/kobo/validation_status/:id` - Update validation status in KoboToolbox (uses survey-specific config)
- `GET /api/kobo/edit_url/:id` - Generate Enketo edit URL for submission (uses survey-specific config)
- `POST /api/auth/login` - JWT authentication using MongoDB users collection
- `GET /api/auth/me` - Get current user info
- `GET /api/enumerators-stats` - Fetch pre-computed enumerator statistics from MongoDB (multi-survey aware)
- `POST /api/admin/refresh-enumerator-stats` - Admin endpoint to rebuild enumerators_stats collections
- `GET /api/users` - Admin: List all users
- `POST /api/users` - Admin: Create new user
- `PATCH /api/users/:id` - Admin: Update user
- `DELETE /api/users/:id` - Admin: Delete user

#### Frontend Components
- **ValidationTable**: Main data validation interface with filtering, sorting, and status updates
  - TanStack Table for advanced table functionality
  - **Survey Column** - Shows survey name and country for each submission
  - **Survey Filter** - Dropdown to filter by specific survey (only shown if 2+ surveys)
  - StatusBadge and AlertBadge components for visual indicators
  - StatusUpdateForm for changing validation status
  - AlertGuideModal explains alert flag codes
- **EnumeratorPerformance**: Dashboard with multiple Highcharts visualizations
  - SummaryCards: Overview statistics
  - AlertDistributionChart: Alert frequency across enumerators
  - QualityRankingChart: Enumerators ranked by error rate
  - SubmissionVolumeChart: Total submissions per enumerator
  - SubmissionTrendChart: Submissions over time
  - EnumeratorDetail: Detailed view with filtering by date range
- **Auth Components**: Login form and AuthContext for state management
- **Layout**: MainLayout and Navbar with routing

#### Custom Hooks (src/api/api.ts)
- `useFetchSubmissions()` - Fetches and normalizes submission data
- `useUpdateValidationStatus()` - Updates validation status with loading state
- `useFetchEnumeratorStats()` - Fetches enumerator statistics with retry logic
- `refreshEnumeratorStats(adminToken)` - Triggers admin refresh of stats

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, React Router v7, TanStack Table v8, Highcharts, Axios
- **Styling**: Tabler Core UI framework (Bootstrap-based)
- **Backend**: Express.js, MongoDB native driver, Axios for external API calls, bcrypt for password hashing, JWT for authentication
- **Development**: Concurrently for dual-server development, ESLint + Prettier for code quality
- **Data Pipeline**: R scripts for KoboToolbox data fetching and processing

### Management Scripts (`scripts/`)
- **User Management**:
  - `create_first_admin.js` - Interactive admin user creation
  - `create_admin_simple.js` - Quick admin creation (CLI args)
  - `delete_user.js` - Delete user by username
  - `sync_users_from_airtable.js` - Sync users from Airtable (with survey permissions)
- **Survey Configuration**:
  - `list_surveys.R` / `list_surveys.cjs` - List all surveys with their configuration status
  - `update_single_survey.R` - Configure one survey at a time (kobo_config + alert_codes)
  - `update_all_surveys.R` / `update_all_surveys.cjs` - Batch configure all surveys
  - `sync_surveys_from_airtable.js` - Sync survey metadata from Airtable
- **Migration & Setup**:
  - `migrate_to_multi_country.js` - Migrate from single-survey to multi-survey architecture
  - `seed_initial_data.js` - Seed initial countries and surveys
- **Testing**:
  - `test_airtable_fetch.js` - Test Airtable API connection

### Environment Configuration

Required environment variables (see `.env.example`):
- **MongoDB**:
  - `MONGODB_VALIDATION_URI` - MongoDB connection string to validation cluster
  - `MONGODB_VALIDATION_DB` - Database name (validation-dev or validation-prod)
- **Server**: `PORT` - Express server port (default: 3001)
- **JWT**: `JWT_SECRET` - Secret key for JWT token signing
- **Admin**: `ADMIN_TOKEN` - Token for admin-only endpoints (stats refresh)
- **Frontend**: `VITE_API_URL` - API base URL for production (optional, defaults to relative /api)
- **Airtable** (optional, for sync scripts):
  - `AIRTABLE_API_KEY` - Airtable personal access token
  - `AIRTABLE_BASE_ID` - Base ID for user/survey management

**Note**: KoboToolbox configuration is now stored per-survey in MongoDB (not env vars)

### Key Development Notes

#### Multi-Survey Architecture
- Portal reads submissions from MongoDB only (R pipeline writes all data including validation_status)
- Each survey has its own MongoDB collections: `surveys_flags-{asset_id}` and `enumerators_stats-{asset_id}`
- Survey-specific KoboToolbox configuration stored in MongoDB `surveys` collection
- User permissions control which surveys each user can access
- Frontend automatically shows survey column and filter when multiple surveys are present
- Alert codes can differ per survey (configured in `surveys.alert_codes`)

#### Data & Authentication
- TypeScript strict mode enabled (`strict: true` in tsconfig.json)
- ESLint configured with TypeScript support and file-specific rules
- Custom hooks pattern for data fetching with loading/error states
- MongoDB connection established before server starts listening
- JWT authentication with bcrypt password hashing
- KoboToolbox API uses Token authentication (per-survey config)
- Alert flags are numeric codes (1-10) with meanings defined per survey
- Validation statuses follow KoboToolbox format: `validation_status_approved`, `validation_status_not_approved`, `validation_status_on_hold`

#### Development Best Practices
- Always stick to the overall theme style and logic when integrating new features
- Always prioritize the use of prebuilt theme features and elements
- Always ensure to avoid code duplication and redundancy
- Always ensure to have a clear understanding of the context and implementation logic before making changes
- "Don't be superficial, be persistent in completing the task"