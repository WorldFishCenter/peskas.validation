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
