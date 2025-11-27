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
