# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Current Version**: 2.3.0 (see [NEWS.md](NEWS.md) for full changelog)

## 📚 Documentation

- **[CLAUDE.md](CLAUDE.md)** - This file - comprehensive project guide
- **[README.md](README.md)** - Quick start and overview
- **[NEWS.md](NEWS.md)** - Version history and changelog (v1.0.0 - v2.3.0)
- **[.env.example](.env.example)** - Environment configuration template with detailed comments

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
- `npm run dev:backend` - Start Express dev server (`server/dev.js`) on PORT env var (default 3001)
- `npm run server` - Start production server

### Full Development Setup
- `npm run dev` - Recommended for development (runs both frontend and backend concurrently)

### Testing

**Current Status**: This project does not currently have a test suite.

When adding tests in the future, consider:
- Jest for unit/integration tests
- React Testing Library for component tests
- Supertest for API endpoint tests
- Test files should follow pattern: `*.test.ts` or `*.spec.ts`

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
- **`countries`**: Country metadata for multi-country support
- **`districts`**: GAUL code districts synced from Airtable
- **`surveys_flags-{asset_id}`**: Submission data per survey (written by R pipeline)
  - Fields: submission_id, submitted_by, submission_date, alert_flag
  - Fields: validation_status, validated_at, validated_by
- **`enumerators_stats-{asset_id}`**: Pre-computed statistics per survey/enumerator
  - Contains totalSubmissions, submissionsWithAlerts, errorRate, submissionTrend
  - Refreshed via admin endpoint `/api/admin/refresh-enumerator-stats`
- **`users_audit`**: Security audit log (auth/validation/download events)
  - 90-day TTL auto-expiry; compound indexes on timestamp, username, category
- **Infrastructure**: `sync_audit_log` (Airtable sync history), `system_locks` (distributed locks)

#### API Endpoints
All endpoints live in `api/` (Vercel serverless). `server/dev.js` mounts these same handlers for local dev. **`server/index.js` was deleted** — do not reference it.

**Auth**:
- `POST /api/auth/login` - JWT authentication using MongoDB users collection
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/forgot-password` - Request password reset email
- `GET /api/auth/validate-reset-token` - Validate reset token
- `POST /api/auth/reset-password` - Complete password reset

**Submissions**:
- `GET /api/kobo/submissions` - Reads from MongoDB `surveys_flags-{asset_id}` (filtered by permissions)
- `PATCH /api/submissions/:id/validation_status` - Update validation status in MongoDB (tracks validated_by, logs audit event)
- `PATCH /api/kobo/validation-status/:id` - Update validation status in KoboToolbox
- `GET /api/kobo/edit-url/:id` - Generate Enketo edit URL

**Surveys**:
- `GET /api/surveys` - List surveys (filtered by user permissions)
- `GET /api/surveys/:asset_id/alert-codes` - Get alert codes for a survey

**Users** (admin only):
- `GET /api/users` / `POST /api/users` - List / create users
- `GET /api/users/:id` / `PATCH /api/users/:id` / `DELETE /api/users/:id` - Get / update / delete user
- `PATCH /api/users/:id/reset-password` - Admin password reset
- `PATCH /api/users/:id/permissions` - Update survey permissions
- `GET /api/users/:id/accessible-surveys` - List accessible surveys for user

**Countries & Districts**:
- `GET /api/countries` / `POST /api/countries` - List / create countries
- `GET /api/countries/:code` / `PATCH /api/countries/:code` / `DELETE /api/countries/:code`
- `GET /api/districts` - List districts (GAUL codes from MongoDB)

**Stats**:
- `GET /api/enumerators-stats` - Pre-computed enumerator statistics (multi-survey aware)

**Admin** (admin only):
- `POST /api/admin/sync-users` - Manual Airtable user sync
- `POST /api/admin/refresh-enumerator-stats` - Rebuild enumerators_stats collections
- `GET /api/admin/audit-logs` - Paginated security audit log (filterable, sortable)

**Data Download** (PeSKAS API integration):
- `GET /api/data-download/metadata` - Countries, surveys, districts filtered by user permissions
- `GET /api/data-download/preview` - First 20 rows from PeSKAS API
- `GET /api/data-download/export` - Full CSV export (max 1M rows, sanitized)
- `GET /api/data-download/metadata-fields` - PeSKAS field descriptions

#### Data Download Feature - Known Limitations
- **Survey ID filtering**: Currently disabled - PeSKAS API uses different survey identifiers than MongoDB `surveys.asset_id`. Requires ID mapping table or PeSKAS API update to support.
- **GAUL code filtering**: Only supports single district per request (PeSKAS API limitation). Multiple districts require separate API calls and client-side merging.
- **API authentication**: Shared `PESKAS_API_KEY` for all users (no per-user rate limiting). Consider per-country or per-user API keys in future for better access control.

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
- **Admin Components**: User management (AdminUsers, UserForm, UserPermissions) + AuditLog (security event viewer)
- **DataDownload**: PeSKAS data download with preview-before-export UX (DataDownload, DownloadFilters, DataPreview, FieldMetadataModal, FieldInfoIcon)
- **HowItWorks**: Onboarding page explaining portal features and workflows
- **Auth Components**: Login form and AuthContext for state management
- **Layout**: MainLayout and Navbar with routing
- **ErrorBoundary**: Global error catcher that prevents full app crashes

#### Shared Utilities (lib/)
Backend utilities shared between `server/dev.js` and `api/` serverless functions:

- **response.js** - Standardized API response helpers (`sendSuccess`, `sendBadRequest`, `sendServerError`, `sendMethodNotAllowed`, `setCorsHeaders`)
- **db.js** - MongoDB connection management (`getDb`, `connectToDatabase`)
- **helpers.js** - Common utilities (`validateObjectId`, `sanitizeCSV`, `getSurveyFlagsCollection`, `getEnumeratorStatsCollection`, `escapeRegex`, `isValidDate`)
- **jwt.js** - JWT token generation and verification
- **middleware.js** - Express middleware (`authenticateUser`, `requireAdmin`, `withMiddleware`)
- **audit-logger.js** - Security audit logging (`logAuditEvent`, `ensureAuditIndexes`) — always `await` before responding
- **filter-permissions.js** - Permission-based filtering (`applyDownloadPermissions`, `getAccessibleSurveys`, `getAccessibleCountries`, `getAccessibleDistricts`)
- **peskas-api.js** - PeSKAS API client with rate limiting, auth, input validation
- **email.js** - AWS SES transactional email (password reset, multi-language)
- **rate-limit.js** - App-level rate limiting for auth endpoints
- **api-utils.js** - KoboToolbox API client (edit URLs, validation status updates)
- **sync-transaction.js** / **sync-audit-logger.js** / **sync-lock.js** / **airtable-rate-limiter.js** - Airtable sync infrastructure

**Pattern**: Always use these utilities instead of duplicating logic. Both `server/dev.js` and `api/` import from `lib/`.

#### Internationalization (i18n)
- **Supported Languages**: English (en), Portuguese (pt), Swahili (sw)
- **Translation Files**: Organized by namespace in `public/locales/{lang}/`
  - `common.json` - Shared UI elements, navigation, buttons
  - `validation.json` - ValidationTable component strings
  - `enumerators.json` - EnumeratorPerformance dashboard strings
  - `admin.json` - Admin interface strings
  - `guide.json` - Alert guide and help content
- **Components**:
  - LanguageSwitcher - Navbar dropdown for language selection
  - Persists preference to localStorage and user profile
  - Automatic detection from browser preferences
- **Implementation**: i18next + react-i18next with lazy loading

#### Custom Hooks
`src/api/api.ts`:
- `useFetchSubmissions()` - Fetches and normalizes submission data
- `useUpdateValidationStatus()` - Updates validation status with loading state
- `useFetchEnumeratorStats()` - Fetches enumerator statistics with retry logic
- `useFetchDownloadMetadata()` - Countries, surveys, districts in one request
- `useFetchDownloadPreview()` - PeSKAS API preview (20 rows)
- `useFetchFieldMetadata()` - PeSKAS field descriptions (lazy, sessionStorage cached)
- `refreshEnumeratorStats(adminToken)` - Triggers admin rebuild of stats

`src/api/admin.ts`:
- `useFetchUsers()` / `useFetchSurveys()` - Admin data hooks
- `useFetchAuditLogs(filters)` - Paginated, sortable audit log hook
- `createUser` / `updateUser` / `deleteUser` / `updateUserPermissions` - Mutation helpers

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
  - `prepare_password_reset.js` - Prepare password reset for users
- **Airtable Sync** (used by GitHub Actions):
  - `sync_all_from_airtable.js` - Master sync script (districts → surveys → users)
  - `sync_districts_from_airtable.cjs` - Sync districts from Airtable
  - `sync_surveys_from_airtable.js` - Sync surveys from Airtable
  - `sync_users_from_airtable.js` - Sync users from Airtable
- **Survey Configuration** (R scripts):
  - `list_surveys.R` - List all surveys with their configuration status
  - `update_single_survey.R` - Configure one survey at a time (kobo_config + alert_codes)
  - `update_all_surveys.R` - Batch configure all surveys
- **Performance**:
  - `add_performance_indexes.cjs` - Add MongoDB indexes for query optimization

### Automated Airtable Sync (GitHub Actions)

User management and permissions are automatically synced from Airtable using GitHub Actions.

**Workflow**: [`.github/workflows/sync-airtable.yml`](.github/workflows/sync-airtable.yml)

- **Schedule**: Daily at 2:00 AM UTC (automated)
- **Manual Trigger**: Via GitHub Actions UI or API
- **Sync Order**: Districts → Surveys → Users (respects dependencies)
- **Features**:
  - ✅ Retry logic (3 attempts with 30s delay)
  - ✅ Comprehensive error handling and validation
  - ✅ Audit logs stored as GitHub artifacts (30 days)
  - ✅ Slack notifications on failure (optional)
  - ✅ Manual trigger with selective sync (all/districts/surveys/users)
  - ✅ Platform-agnostic (works with any hosting provider)

**Setup Guide**: [`.github/AIRTABLE_SYNC_SETUP.md`](.github/AIRTABLE_SYNC_SETUP.md)

**Required GitHub Secrets**:
- `MONGODB_VALIDATION_URI` - MongoDB connection string
- `MONGODB_VALIDATION_DB` - Database name
- `AIRTABLE_BASE_ID` - Airtable base ID
- `AIRTABLE_TOKEN` - Airtable personal access token
- `SLACK_WEBHOOK_URL` - Slack webhook (optional, for notifications)

**Manual Sync Options**:
1. **GitHub UI**: Actions → Sync Airtable to MongoDB → Run workflow
2. **CLI**: `npm run sync:all` (runs `scripts/sync_all_from_airtable.js`)
3. **Individual syncs**: `npm run sync:users`, `npm run sync:surveys`, `npm run sync:districts`

**Migration Notes**:
- Replaced previous Vercel cron job (removed from `vercel.json`)
- Same sync scripts used (`scripts/sync_*_from_airtable.js`)
- Vercel endpoint `/api/admin/cron-sync-all` kept as backup (not scheduled)

### Environment Configuration

Required environment variables (see `.env.example`):
- **MongoDB**:
  - `MONGODB_VALIDATION_URI` - MongoDB connection string to validation cluster
  - `MONGODB_VALIDATION_DB` - Database name (validation-dev or validation-prod)
- **Server**:
  - `PORT` - Express server port (default: 3001)
  - `NODE_ENV` - Node environment (development or production)
- **JWT**:
  - `JWT_SECRET` - Secret key for JWT token signing (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
  - `JWT_EXPIRY` - Token expiry duration (default: 7d, optional)
- **Airtable** (optional, for sync scripts):
  - `AIRTABLE_TOKEN` - Airtable personal access token
  - `AIRTABLE_BASE_ID` - Base ID for user/survey management

**Notes**:
- KoboToolbox configuration is now stored per-survey in MongoDB (not env vars)
- CORS is auto-configured: development allows all origins, production allows `*.vercel.app` domains
- Only set `ALLOWED_ORIGINS` if you need additional custom domains in production

### Vercel Deployment Configuration

The [vercel.json](vercel.json) file configures Vercel deployment:

```json
{
  "version": 2,
  "buildCommand": "npm run build",          // TypeScript + Vite build
  "outputDirectory": "dist",                 // Frontend build output
  "installCommand": "npm install",
  "rewrites": [
    {
      "source": "/((?!api).*)",            // SPA routing - all non-API to index.html
      "destination": "/index.html"
    }
  ],
  "functions": {
    "api/**/*.js": {
      "maxDuration": 10,                   // 10s timeout for serverless functions
      "memory": 1024                       // 1GB memory allocation
    }
  }
}
```

**Deployment Process**:
1. Frontend builds to `dist/` directory
2. Serverless functions in `api/` directory deploy automatically
3. Environment variables configured in Vercel dashboard
4. CORS auto-configured for *.vercel.app domains in production

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

#### Audit Logging
Security-sensitive actions are logged to `users_audit` via `lib/audit-logger.js`:
- Categories: `auth` (login_success/failure), `validation` (validation_status_changed), `download` (data_preview/data_export)
- **Always `await logAuditEvent(db, event)` BEFORE sending the response** — Vercel freezes context after `res.json()`, so fire-and-forget calls are silently lost
- Admin UI: `/admin/audit-logs` — filterable, sortable, paginated

#### Development Best Practices
- Always stick to the overall theme style and logic when integrating new features
- Always prioritize the use of prebuilt theme features and elements
- Always ensure to avoid code duplication and redundancy
- Always ensure to have a clear understanding of the context and implementation logic before making changes
- "Don't be superficial, be persistent in completing the task"

## Claude Code Configuration

This project uses a structured Claude Code setup for code quality, security, and efficient AI-assisted development.

### Quick Commands
- `/code-review` - Comprehensive code quality review (uses Code Reviewer agent)
- `/plan` - Create implementation plan for new features (uses Architect agent)
- `/build-fix` - Fix TypeScript/ESLint errors automatically
- `/refactor-clean` - Remove dead code and cleanup codebase
- `/ui-check` - Validate UI implementation uses Tabler components
- `/document` - Document significant changes (updates architecture-decisions.md, session-context.json)

### Agents

**Code Reviewer** (`.claude/agents/code-reviewer.md`)
- Reviews TypeScript, React, Express, and MongoDB patterns
- Checks for type safety, immutability, framework consistency
- Validates Tabler UI usage and i18n implementation
- Provides detailed feedback with examples and references

**Security Reviewer** (`.claude/agents/security-reviewer.md`)
- Audits authentication and authorization
- Checks for injection vulnerabilities (SQL/NoSQL)
- Validates input sanitization and secrets management
- Reviews MongoDB query safety and CORS configuration

**Architect** (`.claude/agents/architect.md`)
- Guides system design and architectural decisions
- Evaluates scalability and performance implications
- Ensures alignment with multi-survey architecture
- Provides implementation plans with trade-off analysis

### Skills Library

Organized by domain in `.claude/skills/`:

**Backend Patterns**:
- `express-api.md` - API response patterns, middleware, error handling
- `mongodb-patterns.md` - Query safety, indexing, collection naming
- `authentication.md` - JWT flow, password hashing, authorization

**Frontend Patterns**:
- `react-typescript.md` - Component structure, type safety, hooks usage
- `react-hooks.md` - useState, useEffect, custom hooks patterns
- `tanstack-table.md` - Data table implementation with TanStack Table v8
- `tabler-ui.md` - Tabler UI components, utilities, icons

**Coding Standards**:
- `typescript.md` - Type definitions, generics, utility types
- `immutability.md` - Array/object operations, state updates
- `framework-consistency.md` - UI framework usage, dependency management

**Security Review**:
- `checklist.md` - Comprehensive security audit checklist

### Rules (Always Follow)

**Global Rules** (`~/.cursor/rules/`):
- `security.md` - No hardcoded secrets, validate input, hash passwords
- `coding-style.md` - TypeScript strict mode, functional components, clear naming
- `git-workflow.md` - Conventional commits, atomic changes, branch naming
- `ui-consistency.md` - Framework-first approach, no custom CSS without checking framework

**Project-Specific Rules**:
- **UI Consistency**: Always use Tabler UI components before creating custom CSS
- **Backend Consistency**: Always use `lib/` patterns (response.js, db.js, helpers.js)
- **Security**: Validate ObjectIds, use auth middleware, exclude sensitive fields
- **Immutability**: Never mutate state directly, always create new arrays/objects
- **Files**: Keep files under 400 lines, extract when growing too large

### Project-Specific Patterns

**MongoDB Collections**:
- Static: `users`, `surveys`, `countries`, `districts`, `users_audit`
- Dynamic: `surveys_flags-{asset_id}`, `enumerators_stats-{asset_id}`
- Infrastructure: `sync_audit_log`, `system_locks`
- Always validate `asset_id` before constructing dynamic collection names

**API Structure**:
- Production: Vercel serverless functions in `api/`
- Development: `server/dev.js` — mounts `api/` handlers via `mountServerlessFunction()`. **`server/index.js` was deleted.**
- Shared: Utilities in `lib/` (response.js, db.js, middleware.js, helpers.js, audit-logger.js, filter-permissions.js, peskas-api.js)
- **Rule**: When adding a new `api/` endpoint, also add `mountServerlessFunction(...)` to `server/dev.js`

**Authentication Flow**:
- JWT tokens with 7-day expiry (lib/jwt.js)
- `authenticateUser` middleware for protected routes
- `requireAdmin` middleware for admin-only endpoints
- Frontend stores token in localStorage

**Frontend State Management**:
- Custom hooks pattern (`src/api/api.ts` for data, `src/api/admin.ts` for admin)
- React Context for global state (AuthContext, SurveyContext, I18nContext)
- No Redux/MobX — use hooks and context
- `SurveyContext` is the single source of truth for selected survey across routes

**Multi-Survey Architecture**:
- User permissions control survey access
- Admin users: empty `permissions.surveys` = access all
- Regular users: only access surveys in `permissions.surveys` array
- Frontend adapts based on accessible surveys

**UI Framework**:
- Tabler UI (@tabler/core) - Bootstrap 5 based
- Icons: @tabler/icons-react only
- Check https://tabler.io/docs before creating custom components
- Use utility classes for spacing, colors, layout

### Context Memory & Token Optimization

**Session Context** (`.claude/memory/session-context.json`):
- Framework decisions (UI library, database, state management)
- Architecture patterns (API structure, auth, data flow)
- External services (KoboToolbox, Airtable, R Pipeline)
- Common patterns (API endpoints, React components, database queries)
- Token optimization notes (reference by link, use grep, check skills first)

**Architecture Decisions** (`.claude/memory/architecture-decisions.md`):
- Chronological log of significant changes
- Includes context, approach, files changed, trade-offs
- Documents "why" for future reference
- Reduces need to re-read codebase

**Optimization Strategy**:
1. Reference session-context.json for current patterns
2. Check architecture-decisions.md for past decisions
3. Use skills for established patterns
4. Reference CLAUDE.md for architecture overview
5. Only read actual code when implementation details needed

**Token Savings**: ~2000-3000 tokens per reference by using documentation instead of reading multiple files

### Hooks (Automated Checks)

Configured in `~/.cursor/settings.json`:

1. **Console.log Detection**: Warns when editing files with console.log
2. **Secrets Detection**: Blocks edits with hardcoded secrets (JWT_SECRET, passwords, MongoDB URI)
3. **Auth Middleware Check**: Warns if API routes lack authentication
4. **TypeScript Check**: Runs `tsc --noEmit` after editing .ts/.tsx files
5. **ESLint Check**: Runs eslint after editing JavaScript/TypeScript files
6. **Custom UI Detection**: Warns about custom CSS classes (check Tabler first)

### Contexts (Mode-Based Behavior)

**Dev Context** (`.claude/contexts/dev.md`):
- Active during feature development and bug fixes
- Implementation-focused, makes reasonable assumptions
- Follows established patterns, optimizes for speed
- Tests changes in browser, fixes errors proactively

**Review Context** (`.claude/contexts/review.md`):
- Active during code reviews and audits
- Thorough and critical, checks against standards
- Provides detailed feedback with examples
- Prioritizes issues by severity (critical, high, medium, low)

### Workflow Example

**Adding a New Feature**:
1. Plan: `/plan Add CSV export to validation table`
2. Implement: Follow Tabler UI, use TypeScript, add i18n
3. Fix: `/build-fix` to resolve any type/lint errors
4. Check UI: `/ui-check` to verify Tabler usage
5. Review: `/code-review` for quality check
6. Document: `/document` to update architecture decisions

**Fixing a Bug**:
1. Understand issue (error messages, browser console)
2. Fix root cause (not symptoms)
3. Test thoroughly (reproduce bug, verify fix)
4. Clean up: Remove debug logs, run `/build-fix`
5. Review: `/code-review` before committing

**Code Review**:
1. Switch to review context
2. Run `/code-review` on changed files
3. Check security with security-reviewer agent
4. Verify UI compliance with `/ui-check`
5. Provide actionable feedback with examples

### Documentation Updates

**When to Use `/document`**:
- After major feature implementations
- Architectural changes or decisions
- New patterns established
- Framework migrations
- Security implementations
- Database schema changes

**What Gets Updated**:
- `architecture-decisions.md` - Detailed entry with context, approach, trade-offs
- `session-context.json` - New patterns, utilities, external services
- Skills library - If pattern used 4+ times across codebase

### Testing the Setup

**Verify Installation**:
```bash
# Check .claude/ structure
ls -R .claude/

# Verify agents
ls .claude/agents/

# Verify skills
ls -R .claude/skills/

# Verify commands
ls .claude/commands/

# Check global rules
ls ~/.cursor/rules/

# Check hooks
cat ~/.cursor/settings.json
```

**Test Commands**:
```
# Run a code review
/code-review src/components/ValidationTable/ValidationTable.tsx

# Plan a feature
/plan Add user profile page

# Fix build issues
/build-fix

# Check UI compliance
/ui-check src/components/
```

**Test Hooks** (edit a file with console.log or custom CSS to trigger warnings)

### Getting Help

**Documentation**:
- Architecture: See "Architecture Overview" section in this file
- Changelog: See [NEWS.md](NEWS.md) for version history and features
- API: See "API Endpoints" section in this file
- Deployment: See "Vercel Deployment Configuration" section in this file
- Environment: See [.env.example](.env.example) for detailed variable documentation

**Claude Code**:
- Commands: See `.claude/commands/` for detailed usage
- Skills: See `.claude/skills/` for patterns and examples
- Agents: See `.claude/agents/` for specialized assistance
- Rules: See `~/.cursor/rules/` for global standards

**Quick Reference**:
- Tabler UI: https://tabler.io/docs
- TanStack Table: https://tanstack.com/table/v8
- Highcharts: https://www.highcharts.com/docs
- i18next: https://www.i18next.com

### Maintenance

**Regular Tasks**:
- Run `/refactor-clean` monthly to remove dead code
- Update `architecture-decisions.md` for significant changes
- Review and update skills as patterns evolve
- Keep `session-context.json` current with new patterns

**Before Major Changes**:
- Review relevant skills in `.claude/skills/`
- Check past decisions in `architecture-decisions.md`
- Use `/plan` for complex features
- Run `/code-review` after implementation

**Context Optimization**:
- Reference documentation by link (not full content)
- Use skills for patterns (don't re-discover)
- Check session context for framework decisions
- Only read code when implementation details needed