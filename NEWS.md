# validation-zanzibar 1.2.0

## Features

- **Manager-Level Filtering Now Fully Operational**
  - Managers now see only data from enumerators assigned to them in both ValidationTable and EnumeratorPerformance dashboard
  - Automatic enumerator assignment from Airtable during user sync
  - Admin users continue to see all data without restrictions

## Bug Fixes

- **Fixed enumerator filtering implementation**
  - Corrected Airtable field mapping to use "Kobo Username" codes instead of full names
  - Fixed backend filtering to properly match enumerator codes in submission data
  - Resolved MongoDB unique email index conflict that prevented server startup

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
