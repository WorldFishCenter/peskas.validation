# validation-zanzibar 1.6.0

## New Features

- **PeSKAS API Data Download Integration**
  - Download landings data from PeSKAS database (api.peskas.org)
  - Permission-based filtering by country and GAUL codes
  - Preview-before-download UX pattern (20 rows preview + total count)
  - Filter options: country, GAUL Level 2, status, catch taxon, scope
  - Single-select UI for surveys and districts (matches API constraint)
  - CSV export with automatic sanitization and security hardening
  - Multi-language support (English, Portuguese, Swahili)

## Infrastructure Improvements

- **60-70% Faster Page Load Performance**
  - Unified metadata endpoint: 3 HTTP requests → 1 request (~900-1500ms → ~300-400ms)
  - Server-side pre-filtered data (countries, districts, surveys)
  - Single loading state instead of 3 independent states
  - Eliminated runtime Airtable dependency for districts

- **Districts Migration to MongoDB**
  - Migrated districts from runtime Airtable fetching to MongoDB `districts` collection
  - Created sync script `scripts/sync_districts_from_airtable.js` (follows user/survey pattern)
  - Added indexes: `code` (unique), `country_id`, `active`, compound indexes
  - Airtable now only used for periodic syncs (not runtime dependency)

- **Shared Permission Utilities**
  - NEW: `lib/filter-permissions.js` - Centralized permission filtering logic
  - Functions: `getAccessibleCountries()`, `getAccessibleSurveys()`, `getAccessibleDistricts()`, `applyDownloadPermissions()`
  - Removed ~200 lines of duplicated code across endpoints
  - Single source of truth for permission filtering

## Security Improvements

- **Input Validation for External API**
  - Validates all PeSKAS API parameters before external calls
  - Regex patterns: country, status, scope, catch_taxon, survey_id, gaul_2
  - Whitelist validation for status and scope parameters
  - Prevents injection attacks and ensures data integrity

- **CSV Injection Prevention**
  - NEW: `sanitizeCSV()` function in lib/helpers.js
  - Detects dangerous characters: `=`, `+`, `-`, `@`, `\t`, `\r`
  - Prepends single quote to cells starting with dangerous characters
  - Prevents formula injection in Excel/Google Sheets

- **Debug Logging Removal**
  - Removed console.log/console.warn from production code
  - Prevents sensitive data exposure in browser console
  - Cleaner production deployment

## Bug Fixes

- **Country Case Mismatch**
  - Fixed: Database has `country_id: "Zanzibar"` but code lowercased to `"zanzibar"` before querying
  - Impact: Survey/GAUL filtering returned empty arrays (no matches)
  - Solution: Preserve original case for MongoDB queries, lowercase only for external API

- **Scope Filter Defaulting Incorrectly**
  - Fixed: `scope = 'trip_info'` in parameter destructuring defaulted even when empty
  - Impact: Users couldn't get "all data" by leaving scope empty
  - Solution: Removed default value, only include if explicitly provided

- **Survey/GAUL Multi-Select Confusion**
  - Fixed: PeSKAS API doesn't support multiple survey IDs or GAUL codes
  - Impact: UI allowed multi-select but only first value was used (confusing UX)
  - Solution: Changed from checkboxes to radio buttons (single-select)
  - Updated translations to singular forms ("Survey" not "Surveys")

## UI/UX Improvements

- **Adaptive Layout**
  - Before preview: Centered single-column layout (filters only)
  - After preview: Two-column layout (filters left, preview right)
  - Filters become sticky sidebar when preview shown
  - More intuitive space utilization

- **Tabler UI Framework Compliance (95%)**
  - Excellent adherence to Tabler UI standards
  - Using official Tabler components: cards, forms, tables, buttons, alerts
  - Proper spacing utilities, layout classes, responsive grid
  - TanStack Table v8 integrated with Tabler styling
  - Icons exclusively from @tabler/icons-react

- **Simplified Component Architecture**
  - Removed client-side filtering (~60 lines removed)
  - Server returns pre-filtered data
  - Single loading state
  - Cleaner permission logic

## Backend

- **New API Endpoints**
  - `GET /api/data-download/metadata` - Unified metadata endpoint (countries, districts, surveys)
  - `GET /api/data-download/preview` - Preview data (20 rows + total count)
  - `GET /api/data-download/export` - Full CSV export with sanitization
  - `GET /api/districts` - Districts endpoint using MongoDB

- **New Utilities**
  - `lib/peskas-api.js` - PeSKAS API client with rate limiting (1s delay), authentication, validation
  - `lib/filter-permissions.js` - Shared permission filtering utilities
  - `lib/helpers.js` - Added `sanitizeCSV()` function for CSV sanitization

- **Refactored Endpoints**
  - `api/data-download/preview.js` - Uses shared utilities (~230 → ~100 lines)
  - `api/data-download/export.js` - Uses shared utilities + CSV sanitization (~230 → ~100 lines)

## Frontend

- **New Components**
  - `src/components/DataDownload/DataDownload.tsx` - Main page with adaptive layout
  - `src/components/DataDownload/DownloadFilters.tsx` - Filter form with single-select
  - `src/components/DataDownload/DataPreview.tsx` - Preview table with TanStack Table v8

- **New Hooks**
  - `useFetchDownloadMetadata()` - Single hook replaces 3 separate hooks
  - `useFetchDownloadPreview()` - Fetch preview data with loading/error states
  - `downloadCSV()` - Client-side CSV download function

- **New Types**
  - `src/types/download.ts` - TypeScript interfaces for filters, responses, metadata

## Database

- **New Collection: `districts`**
  ```javascript
  {
    code: String,           // GAUL 2 Code (e.g., "15048") - unique indexed
    name: String,           // GAUL 2 Name (e.g., "Nampula")
    country_id: String,     // Country code - indexed
    survey_label: String,   // Survey Label from Airtable
    active: Boolean,
    metadata: Object,
    created_at: Date,
    created_by: String,
    updated_at: Date
  }
  ```

- **Indexes Created**
  - `districts.code` (unique)
  - `districts.country_id`
  - `districts.active`
  - `districts.code + active` (compound)

## Management Scripts

- **New Scripts**
  - `scripts/sync_districts_from_airtable.js` - Sync districts from Airtable to MongoDB
  - Follows same pattern as user/survey sync scripts
  - Handles pagination, field mapping, upsert logic, orphan deletion

## Performance Metrics

- Page load: 900-1500ms → 300-400ms (**60-70% faster**)
- HTTP requests: 3 → 1 (**67% reduction**)
- Code duplication: ~200 lines removed
- Loading states: 3 → 1 (simpler state management)

## Code Quality

- **Production-Ready Code**
  - No debug console.log statements in production code
  - Input validation prevents injection attacks
  - CSV sanitization prevents formula injection
  - Server-side permission filtering (cannot be bypassed)
  - 95% Tabler UI compliance (verified via /ui-check)
  - Comprehensive documentation in architecture-decisions.md

## Environment Variables

- **PeSKAS API Integration**
  - `PESKAS_API_KEY` - API key for PeSKAS API authentication
  - Falls back to `API_SECRET_KEY` if not set

## Migration Checklist

All infrastructure improvements completed:
- ✅ Districts MongoDB collection created with indexes
- ✅ Sync script following user/survey pattern
- ✅ Shared permission utilities (lib/filter-permissions.js)
- ✅ Unified metadata endpoint
- ✅ Input validation for external API
- ✅ CSV injection sanitization
- ✅ Country case mismatch bug fixed
- ✅ Scope defaulting bug fixed
- ✅ Single-select UI implemented
- ✅ Debug logging removed
- ✅ Tabler UI compliance verified

---

# validation-zanzibar 1.5.0

## New Features

- **Password Reset Functionality**
  - Users can now reset their password via email if they forget it
  - "Forgot Password?" link on login page
  - Secure token-based reset flow with 1-hour expiration
  - Multi-language email templates (English, Portuguese, Swahili)
  - Rate limiting protection against abuse (10 requests per 24h)

## Security Improvements

- **Password Reset Security Hardening**
  - Added CORS support for password reset endpoints
  - Fixed rate limiting to properly reset after 24 hours
  - Implemented timing attack protection in token validation
  - All endpoints follow security best practices (input validation, enumeration prevention)

## Backend

- **Email Integration**
  - Support for Gmail, Outlook, and custom SMTP providers
  - Configurable via environment variables (see `.env.example`)
  - Language-aware email content based on user preferences

- **New API Endpoints**
  - `POST /api/auth/forgot-password` - Request password reset
  - `POST /api/auth/reset-password` - Reset password with token
  - `GET /api/auth/validate-reset-token` - Validate reset token

## Database

- New user fields: `reset_token`, `reset_token_expires_at`, `reset_token_created_at`
- New collection: `password_reset_rate_limits` for tracking requests

## Dependencies

- Added `nodemailer@^6.9.9` for email functionality

---

# validation-zanzibar 1.4.0

## Features

- **Full Internationalization (i18n) Support**
  - Complete multi-language support for English, Portuguese, and Swahili
  - Language switcher component in navbar and login page
  - Persistent language preference stored in localStorage and user profile
  - Organized translation files by namespace (common, validation, enumerators, admin, guide, etc.)
  - Automatic language detection from browser preferences
  - Type-safe translations with TypeScript support

## Performance Improvements

- **Backend Query Optimization for Large Datasets**
  - Added NodeCache for API response caching (5-minute TTL)
  - Optimized pagination queries: skip expensive `countDocuments` for first 3 pages
  - Fetch only requested `limit` submissions per collection in parallel
  - In-memory sorting and merging of submissions for faster pagination
  - Reduced frontend and backend timeouts to more appropriate values after optimizations
  - Significantly improved load times for datasets with 45k+ submissions

## UI/UX Improvements

- **Complete Tabler UI Framework Compliance**
  - Standardized all color classes to Tabler semantic colors:
    - `text-blue` → `text-primary` (all loading spinners)
    - `btn-green` → `btn-success` (status update buttons)
    - `border-blue` → `border-primary` (alert borders)
  - Fixed container classes: `container container-slim` → `container-tight`
  - Removed deprecated `form-group` classes (replaced with direct spacing classes)
  - All components now use consistent Tabler utility classes throughout

- **Login Page Redesign**
  - Redesigned login page with proper Tabler styling
  - Integrated language switcher directly into login card for better UX
  - More prominent language switcher with improved visibility
  - Fixed focus outline issues on card elements
  - Updated all login elements to use Tabler primary color classes

- **Navbar Language Switcher Enhancements**
  - Improved styling to match Tabler navbar user dropdown
  - Added proper spacing between language switcher and user dropdown
  - Replaced badge with IconCheck for active language indicator
  - Better visual consistency with Tabler design patterns

## Code Quality

- **Consistent Styling Architecture**
  - Removed all non-standard color classes
  - Standardized button classes across all components
  - Consistent badge color usage with Tabler light variants
  - Clean separation of concerns with proper component structure

---

# validation-zanzibar 1.3.0

## Architecture & Scalability

- **Scalable Multi-Survey Portal**
  - Portal now fully supports multiple surveys across different KoboToolbox servers
  - Dynamic MongoDB collections per survey (`surveys_flags-{asset_id}`, `enumerators_stats-{asset_id}`)
  - Survey-specific configurations and alert codes stored in MongoDB
  - User permissions control survey-level access
  - Automatic survey filtering in UI when multiple surveys are present

- **Airtable Management Backend**
  - Centralized user management through Airtable synchronization
  - Automatic survey configuration sync from Airtable base
  - Enumerator assignment management via Airtable
  - Consistent data structure between Airtable and MongoDB
  - Automated sync scripts for users, surveys, and permissions

- **MongoDB as Single Source of Truth**
  - Simplified data flow: R pipeline → MongoDB → Portal
  - Removed KoboToolbox API dependencies during page loads (eliminates timeouts)
  - R pipeline writes validation status, validated_at, validated_by directly to MongoDB
  - Portal reads exclusively from MongoDB for faster performance
  - Validation updates sync to both MongoDB (primary) and KoboToolbox (secondary)

## Bug Fixes

- **Fixed KoboToolbox 401 Authentication Error**
  - Fixed spread operator order in `lib/api-utils.js` to preserve Authorization header
  - Changed validation status update endpoint to use JSON format instead of form-urlencoded
  - Matches working R implementation for KoboToolbox API v2 compatibility
  - Validation status updates to KoboToolbox now work reliably

- **Fixed Validation Status Synchronization**
  - Validation status updates now sync to BOTH MongoDB and KoboToolbox
  - MongoDB updated first so table reflects changes immediately
  - Both updates must succeed to ensure data consistency
  - Fixed URL from `/validation_status` to `/validation-status` for proper routing
  - Table refreshes automatically after status updates

## UI/UX Improvements

- **Tabler UI Framework Compliance**
  - Restructured ValidationTable to follow Tabler page structure (page-header, page-body)
  - Separated filters into dedicated card with proper spacing
  - Added Tabler-compliant pagination in card footer
  - Removed all inline styles in favor of Tabler utility classes
  - Fixed EnumeratorPerformance dashboard layout structure
  - Removed double container wrapping in MainLayout and PageHeader components
  - Added utility classes: `.cursor-pointer` and `.mw-12` in index.css

- **Modernized Alert Codes Reference Modal**
  - Replaced table layout with Tabler list-group component
  - Added circular avatar badges for alert codes (red theme)
  - Improved two-line layout: description on top, subtitle below
  - Better visual hierarchy and scannability
  - Added modal-dialog-scrollable for better mobile experience
  - More intuitive and modern design

- **Page Structure Consistency**
  - ValidationTable: Added proper page-header with title "Data Validation"
  - EnumeratorPerformance: Fixed container structure and removed duplicate wrappers
  - All pages now follow consistent Tabler architecture
  - Improved loading and error states across all components

## Code Quality

- **Production-Ready Layouts**
  - No inline styles - all styling uses Tabler utility classes
  - Consistent spacing and grid system usage throughout
  - Better responsive design across mobile and desktop
  - Clean component structure following Tabler best practices

## Deployment

- **Vercel Environment Configuration**
  - Cleaned up stale environment variables (KOBO_*, ALLOWED_ORIGINS)
  - Documented JWT_EXPIRY as optional with default 7d
  - CORS auto-configured: development allows all origins, production allows *.vercel.app
  - Only set ALLOWED_ORIGINS for additional custom domains in production

---

# validation-zanzibar 1.2.1

## Features

- **Alert Guide in Enumerator Performance Dashboard**
  - Added "Alert Guide" button to Enumerator Performance page header
  - Modal displays survey-specific alert codes from MongoDB `surveys` collection
  - Supports multi-survey selection when multiple surveys are present
  - Uses shared `AlertGuideModal` component and `useContextualAlertCodes` hook for consistency
  - Works identically to ValidationTable's Alert Guide feature

- **Survey Filter in Enumerator Performance Dashboard**
  - Added mandatory survey filter when multiple surveys are available
  - Only one survey can be selected at a time (no "All Surveys" option)
  - Auto-selects first survey when multiple surveys exist
  - Filters all charts and statistics by selected survey
  - Clean integration using Tabler's grid system

## UI/UX Improvements

- **Improved Filter Layout in ValidationTable**
  - Restructured to clean two-row layout using Tabler grid system
  - Row 1: Search bar (66% width) + Alert Guide and Reset buttons (33% width)
  - Row 2: Survey, Status, Alert, and Date Range filters with responsive columns
  - Consistent spacing and sizing across all filter elements
  - Proper grid alignment with no floating elements
  - Better proportioned and more visually balanced

## Backend Enhancements

- **Enumerator Stats API Enrichment**
  - `/api/enumerators-stats` endpoint now enriches each submission record with survey metadata
  - Adds `asset_id`, `survey_name`, and `survey_country` fields to every record
  - Fetches survey information from MongoDB `surveys` collection
  - Enables frontend Alert Guide and filtering features to work correctly
  - Filters out metadata records (type: "metadata") from results

## Code Quality

- **Production-Ready Code**
  - No debug console.log statements in production code
  - No TODO/FIXME comments
  - Clean TypeScript compilation with no warnings
  - Reusable components and hooks across ValidationTable and EnumeratorPerformance
  - Consistent Tabler UI framework usage throughout

---

# validation-zanzibar 1.2.0

## Features

- **Manager-Level Filtering Now Fully Operational**
  - Managers now see only data from enumerators assigned to them in both ValidationTable and EnumeratorPerformance dashboard
  - Automatic enumerator assignment from Airtable during user sync
  - Admin users continue to see all data without restrictions

## Bug Fixes

- **Fixed admin access logic in serverless API endpoints**
  - Admin users now see ALL active surveys regardless of assigned surveys in permissions
  - Fixed in serverless endpoints: `/api/kobo/submissions` and `/api/enumerators-stats`
  - Server endpoint (`server/index.js`) was already correct
  - Ensures consistent admin behavior across all deployment environments

- **Fixed user schema data type mismatches**
  - Corrected `permissions.enumerators` from object `{}` to array `[]` for 2 users
  - Corrected `country` from object `{}` to array `[]` for 2 users
  - Created migration script `scripts/fix_user_schema.js` to automatically fix existing data
  - Prevents filtering errors when checking enumerator permissions

- **Fixed hardcoded database name in R scripts**
  - `update_single_survey.R` now reads `MONGODB_VALIDATION_DB` from environment
  - Falls back to "validation-dev" with warning if not set
  - Ensures scripts work correctly in both dev and production environments

- **Fixed enumerator filtering implementation**
  - Corrected Airtable field mapping to use "Kobo Username" codes instead of full names
  - Fixed backend filtering to properly match enumerator codes in submission data using `submitted_by` field
  - Added filtering to skip metadata records in stats collections

- **Resolved MongoDB unique email index conflict**
  - Removed unique email index creation from server startup
  - Allows multiple users with null email values (common in Airtable sync)

## Code Cleanup

- **Removed development debug code**
  - Removed all console.log statements from frontend code (src/)
  - Removed all console.log statements from serverless API endpoints (api/)
  - Removed debug console.log statements from server code (server/index.js)
  - Kept only essential logging (console.error for errors, server startup messages)

- **Removed test and temporary files**
  - Deleted 10 .cjs test files from root and scripts directories
  - Deleted api/debug directory with debug endpoints
  - Removed all .DS_Store system files

## Migration Tools

- **fix_user_schema.js** - Automatically fix user data schema mismatches
  - Converts `permissions.enumerators` from object to array
  - Converts `country` from object to array
  - Safe to run multiple times (idempotent)
  - Usage: `node scripts/fix_user_schema.js`

---

# validation-zanzibar 1.1.0

## New Features

- **Manager-Level Enumerator Filtering**
  - Managers can now be assigned specific enumerators they supervise
  - ValidationTable automatically filters submissions by assigned enumerators
  - EnumeratorPerformance dashboard shows only stats for assigned enumerators
  - Admin users see all data (no filtering applied)
  - Airtable sync automatically populates enumerator assignments
  - AdminUsers table displays assigned enumerators per user

- **Survey and Country Filtering in Enumerator Performance Dashboard**
  - Added survey filter dropdown (shown when 2+ surveys available)
  - Added country filter dropdown (shown when 2+ countries available)
  - Country flags displayed in filter options for better visual identification
  - Filters work seamlessly with existing date range filtering
  - Backend API enriches enumerator stats with survey_name and survey_country

- **Multi-Country Support in ValidationTable**
  - Country filter dropdown in table filters (shown when 2+ countries available)
  - Country flags displayed throughout the interface
  - Country metadata utilities for consistent flag and name display

## UI/UX Improvements

- **Tabler UI Design System Compliance**
  - Fixed badge styling in AdminUsers table with proper `text-{color}-fg` classes
  - Fixed action button responsiveness using `d-none d-xl-inline` classes
  - Added sort indicator for unsorted state (neutral chevron icon)
  - Consistent button colors across the application (btn-outline-primary)
  - Updated pagination button styling for consistency

- **Primary Color Customization**
  - Changed primary color to cyan (#0891b2) using CSS custom properties
  - Added Tabler color override system in index.css
  - Documented process for easy future color changes

- **Navbar Enhancements**
  - Added country/flag display in navbar based on user permissions
  - Shows single country flag for single-country users
  - Shows "Multi-Country" badge for multi-country users
  - "Alert Codes" button for quick access to validation guide

## Code Quality & Production Readiness

- **Debug Code Removal**
  - Removed 45+ console.log statements from frontend code
  - Deleted debug utility file (src/utils/debug.ts) and all usages
  - Cleaned up Login.tsx (8 console.log statements)
  - Cleaned up chart components (3 files)
  - Cleaned up data processing utilities (2 files)
  - Removed commented code from App.tsx

- **Security Improvements**
  - Removed .env.production from git tracking (security issue fixed)
  - Added countryMetadata.ts to git (was untracked)

- **Development Tools**
  - Installed prettier as devDependency for code formatting
  - All code follows consistent formatting standards

## Technical Improvements

- **Backend Enhancements**
  - Added enumerator-based filtering to `/api/kobo/submissions` endpoint
  - Added enumerator-based filtering to `/api/enumerators-stats` endpoint
  - Enhanced Airtable sync script to fetch and map enumerator assignments
  - Added survey name and country enrichment for filtering support
  - Improved data structure for multi-survey/multi-country operations
  - Removed problematic unique email index from MongoDB users collection

- **TypeScript Type Definitions**
  - Added `enumerators` field to User permissions interface
  - Updated SubmissionData interface with survey_name and survey_country
  - Updated EnumeratorData interface for comprehensive filtering support
  - Better type safety across the application

## Bug Fixes

- Fixed sort indicators in AdminUsers table showing only up/down states
- Fixed responsive layout issues with action buttons on small screens
- Improved error handling in data processing utilities

---

# validation-zanzibar 1.0.0

## New features

- **Multi-Survey Support**: Validation portal now supports multiple surveys across different KoboToolbox servers
  - Survey column in ValidationTable displaying survey name and country
  - Survey filter dropdown (shown only when 2+ surveys exist)
  - Survey-specific KoboToolbox configurations stored in MongoDB
  - User permissions with survey-level access control

- **User Management System**: Complete admin interface for managing portal users
  - Admin Users UI with create/edit/delete functionality
  - Role-based access control (admin/user roles)
  - Survey-specific permissions per user
  - Password reset functionality
  - User activity tracking (last login, created by, etc.)

- **Airtable Integration**: Automatic synchronization of users and surveys
  - `sync_users_from_airtable.js` - Sync user data from Airtable
  - `sync_surveys_from_airtable.js` - Sync survey configurations from Airtable
  - Automatic permission mapping based on Airtable data

## Architecture

- **MongoDB-Only Data Flow**: Simplified backend architecture for better performance
  - Removed KoboToolbox API fetching during page loads (previously caused timeouts)
  - R pipeline now writes `validation_status`, `validated_at`, `validated_by` directly to MongoDB
  - Portal reads all data from MongoDB collections only
  - Validation status updates write to both MongoDB and KoboToolbox

- **Survey-Specific Collections**: Dynamic MongoDB collection names per survey
  - Pattern: `surveys_flags-{asset_id}` for submission data
  - Pattern: `enumerators_stats-{asset_id}` for statistics
  - Centralized `surveys` collection stores metadata and configurations

## Enhancements

- **Improved Error Handling**: StatusBadge component gracefully handles unexpected validation status values
- **Audit Trail**: Track who validated each submission with `validated_by` field
- **Better User Experience**: Survey filter only appears when multiple surveys are available

## Configuration

- **Management Scripts**: Added comprehensive tooling for administration
  - `create_first_admin.js` - Create initial admin user
  - `create_admin_simple.js` - Quick admin creation command
  - `delete_user.js` - User removal tool
  - `list_surveys.R` / `list_surveys.cjs` - View all surveys and their configurations
  - `update_all_surveys.R` / `update_all_surveys.cjs` - Bulk update survey configurations
  - `update_single_survey.R` - Update individual survey settings
  - `migrate_to_multi_country.js` - Migration tool for existing databases

## Documentation

- **MULTI_SURVEY_FEATURES.md**: Comprehensive documentation of multi-survey implementation
- **Updated CLAUDE.md**: Reflects new MongoDB-only architecture and multi-survey support
- **Scripts README files**: Detailed guides for using management scripts
- **MIGRATION_STEPS.md**: Step-by-step guide for configuring surveys
- **SURVEY_SCHEMA.md**: MongoDB schema documentation for surveys collection
- **PIPELINE_INTEGRATION.md**: R pipeline integration guide

## Other Changes

- Removed unused Vercel serverless API routes (`api/` folder)
- Removed outdated planning documentation files
- Removed redundant nested CLAUDE.md files
- Updated dependencies for better security and performance
