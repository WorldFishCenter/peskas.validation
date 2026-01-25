/**
 * Local Development Server
 *
 * This Express server mounts Vercel serverless functions for local development.
 * It provides the same API as the production Vercel deployment while maintaining
 * the ability to run `npm run dev` for local testing.
 *
 * Usage: node server/dev.js
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { connectToDatabase } = require('../lib/db');

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Helper to load and mount a serverless function
function mountServerlessFunction(route, filePath) {
  try {
    // Clear require cache to support hot reloading during development
    delete require.cache[require.resolve(filePath)];

    const handler = require(filePath);

    // Mount the handler at the specified route
    app.all(route, async (req, res) => {
      try {
        // Vercel serverless functions expect route params in req.query
        // Copy Express req.params to req.query to maintain compatibility
        req.query = { ...req.query, ...req.params };

        await handler(req, res);
      } catch (error) {
        console.error(`Error in ${route}:`, error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });

    console.log(`✓ Mounted: ${route} -> ${filePath}`);
  } catch (error) {
    console.error(`✗ Failed to mount ${route}:`, error.message);
  }
}

// Mount all API endpoints
console.log('Mounting API endpoints...\n');

// Authentication endpoints
mountServerlessFunction('/api/auth/login', path.join(__dirname, '../api/auth/login.js'));
mountServerlessFunction('/api/auth/me', path.join(__dirname, '../api/auth/me.js'));
mountServerlessFunction('/api/auth/forgot-password', path.join(__dirname, '../api/auth/forgot-password.js'));
mountServerlessFunction('/api/auth/validate-reset-token', path.join(__dirname, '../api/auth/validate-reset-token.js'));
mountServerlessFunction('/api/auth/reset-password', path.join(__dirname, '../api/auth/reset-password.js'));

// KoboToolbox endpoints
mountServerlessFunction('/api/kobo/submissions', path.join(__dirname, '../api/kobo/submissions.js'));
mountServerlessFunction('/api/kobo/edit-url/:id', path.join(__dirname, '../api/kobo/edit-url/[id].js'));
mountServerlessFunction('/api/kobo/validation-status/:id', path.join(__dirname, '../api/kobo/validation-status/[id].js'));

// Submissions endpoints
mountServerlessFunction('/api/submissions/:id/validation_status', path.join(__dirname, '../api/submissions/[id]/validation-status.js'));

// Survey endpoints
mountServerlessFunction('/api/surveys', path.join(__dirname, '../api/surveys/index.js'));
mountServerlessFunction('/api/surveys/:asset_id/alert-codes', path.join(__dirname, '../api/surveys/[asset_id]/alert-codes.js'));

// User management endpoints
mountServerlessFunction('/api/users', path.join(__dirname, '../api/users/index.js'));
mountServerlessFunction('/api/users/:id', path.join(__dirname, '../api/users/[id]/index.js'));
mountServerlessFunction('/api/users/:id/reset-password', path.join(__dirname, '../api/users/[id]/reset-password.js'));
mountServerlessFunction('/api/users/:id/permissions', path.join(__dirname, '../api/users/[id]/permissions.js'));
mountServerlessFunction('/api/users/:id/accessible-surveys', path.join(__dirname, '../api/users/[id]/accessible-surveys.js'));

// Country management endpoints
mountServerlessFunction('/api/countries', path.join(__dirname, '../api/countries/index.js'));
mountServerlessFunction('/api/countries/:code', path.join(__dirname, '../api/countries/[code].js'));

// Districts endpoint (GAUL codes from Airtable)
mountServerlessFunction('/api/districts', path.join(__dirname, '../api/districts/index.js'));

// Enumerator stats endpoint
mountServerlessFunction('/api/enumerators-stats', path.join(__dirname, '../api/enumerators-stats.js'));

// Admin endpoints
mountServerlessFunction('/api/admin/sync-users', path.join(__dirname, '../api/admin/sync-users.js'));
mountServerlessFunction('/api/admin/refresh-enumerator-stats', path.join(__dirname, '../api/admin/refresh-enumerator-stats.js'));

// Data download endpoints (PeSKAS API integration)
mountServerlessFunction('/api/data-download/metadata', path.join(__dirname, '../api/data-download/metadata.js'));
mountServerlessFunction('/api/data-download/preview', path.join(__dirname, '../api/data-download/preview.js'));
mountServerlessFunction('/api/data-download/export', path.join(__dirname, '../api/data-download/export.js'));

console.log('\n✅ All endpoints mounted successfully!\n');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Development server running' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Validation Portal API - Development Server',
    version: '1.2.0-vercel',
    endpoints: {
      auth: [
        'POST /api/auth/login',
        'GET /api/auth/me',
        'POST /api/auth/forgot-password',
        'GET /api/auth/validate-reset-token',
        'POST /api/auth/reset-password'
      ],
      kobo: [
        'GET /api/kobo/submissions',
        'GET /api/kobo/edit-url/:id',
        'PATCH /api/kobo/validation-status/:id'
      ],
      submissions: [
        'PATCH /api/submissions/:id/validation_status'
      ],
      surveys: [
        'GET /api/surveys',
        'GET /api/surveys/:asset_id/alert-codes'
      ],
      users: [
        'GET /api/users',
        'POST /api/users',
        'GET /api/users/:id',
        'PATCH /api/users/:id',
        'DELETE /api/users/:id',
        'PATCH /api/users/:id/reset-password',
        'PATCH /api/users/:id/permissions',
        'GET /api/users/:id/accessible-surveys'
      ],
      countries: [
        'GET /api/countries',
        'POST /api/countries',
        'GET /api/countries/:code',
        'PATCH /api/countries/:code',
        'DELETE /api/countries/:code'
      ],
      districts: [
        'GET /api/districts'
      ],
      stats: [
        'GET /api/enumerators-stats'
      ],
      admin: [
        'POST /api/admin/sync-users (requires refactoring)',
        'POST /api/admin/refresh-enumerator-stats'
      ],
      dataDownload: [
        'GET /api/data-download/metadata',
        'GET /api/data-download/preview',
        'GET /api/data-download/export'
      ]
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    message: 'This endpoint has not been implemented yet. Check server/index.js for the original implementation.'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Helper function to try starting server on a port
function tryStartServer(port, originalPort = port, maxAttempts = 10) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`🚀 Development server running on port ${port}`);
      console.log(`   http://localhost:${port}`);
      console.log(`\nBackend ready! Start the frontend with: npm run dev:frontend\n`);
      resolve(server);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        server.close();
        if (maxAttempts > 0) {
          console.log(`Port ${port} is in use, trying port ${port + 1}...`);
          tryStartServer(port + 1, originalPort, maxAttempts - 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`Could not find an available port starting from ${originalPort}`));
        }
      } else {
        server.close();
        reject(error);
      }
    });
  });
}

// Start server with MongoDB connection validation
async function startServer() {
  try {
    // Validate MongoDB connection at startup
    console.log('🔌 Validating MongoDB connection...');
    const { db } = await connectToDatabase();
    console.log(`✓ MongoDB connected: ${db.databaseName}\n`);

    // Try to start server on the specified port, or find an available port
    await tryStartServer(PORT);
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    if (error.message.includes('MongoDB') || error.message.includes('MONGODB')) {
      console.error('\nPlease check your MongoDB connection settings:');
      console.error('  - MONGODB_VALIDATION_URI in .env file');
      console.error('  - MONGODB_VALIDATION_DB in .env file');
    }
    console.error(`\nError details: ${error.stack}`);
    process.exit(1);
  }
}

startServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nSIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
