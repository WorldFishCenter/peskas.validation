const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const { spawn } = require('child_process');
// const path = require('path'); // Currently unused
const axios = require('axios');

// Load .env file from parent directory
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MONGODB_VALIDATION_URI = process.env.MONGODB_VALIDATION_URI;
const MONGODB_VALIDATION_DB = process.env.MONGODB_VALIDATION_DB;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

// Initialize cache with 5 minute TTL
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

if (!MONGODB_VALIDATION_URI) {
  console.error('Error: MONGODB_VALIDATION_URI not set in environment variables');
  process.exit(1);
}

if (!MONGODB_VALIDATION_DB) {
  console.error('Error: MONGODB_VALIDATION_DB not set in environment variables. Please set it in your .env file.');
  process.exit(1);
}

let db;

// Function to get the MongoDB database connection
const getDb = () => db;

// Helper functions for dynamic collection names
const getEnumeratorStatsCollection = (assetId) => {
  if (!assetId) {
    throw new Error('Asset ID is required for enumerator stats collection');
  }
  return `enumerators_stats-${assetId}`;
};

const getSurveyFlagsCollection = (assetId) => {
  if (!assetId) {
    throw new Error('Asset ID is required for survey flags collection');
  }
  return `surveys_flags-${assetId}`;
};

// Helper to get all asset IDs from surveys collection
const getAllAssetIds = async () => {
  const database = getDb();
  if (!database) return [];

  const surveys = await database.collection('surveys').find({ active: true }).toArray();
  return surveys.map(s => s.asset_id);
};

// Connect to MongoDB
async function connectToMongo() {
  try {
    if (!MONGODB_VALIDATION_URI) {
      console.error('ERROR: MONGODB_VALIDATION_URI not found in environment variables');
      process.exit(1);
    }

    // Connect to unified validation database
    const client = new MongoClient(MONGODB_VALIDATION_URI);
    await client.connect();

    db = client.db(MONGODB_VALIDATION_DB);

    // Create indexes for users collection (if not exists)
    try {
      await db.collection('users').createIndex({ username: 1 }, { unique: true });
      // Note: email index removed because many users have null email values
      // and MongoDB unique indexes don't allow multiple null values
    } catch (error) {
      if (error.code === 86) {
        // Index already exists - this is fine
      } else {
        throw error;
      }
    }

    // Note: surveys_flags, countries, surveys, and enumerators_stats indexes
    // are created by the migration script (scripts/migrate_to_multi_country.js)
    // No need to recreate them here

    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Authentication middleware - validates JWT token
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Authentication system not configured' });
    }

    // Get full user data including permissions
    const user = await database.collection('users').findOne({
      username: decoded.username,
      active: true
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Attach complete user data to request (to avoid redundant DB lookups)
    req.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name,
      country: user.country,
      permissions: user.permissions // Include permissions.surveys and permissions.enumerators
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Admin-only middleware - must be used after authenticateUser
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Get submissions filtered by user permissions
app.get('/api/kobo/submissions', authenticateUser, async (req, res) => {
  try {
    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000; // Default 1000 for backward compatibility
    const skip = (page - 1) * limit;

    // User data is now in req.user from middleware (no redundant DB query!)
    const user = req.user;

    // Build cache key
    const cacheKey = `submissions_${user.username}_${page}_${limit}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      res.set('X-Cache', 'HIT');
      return res.json(cachedData);
    }

    // Determine which surveys the user has access to
    let accessibleSurveys;

    if (user.role === 'admin' && (!user.permissions?.surveys || user.permissions.surveys.length === 0)) {
      // Admin users get full access to ALL active surveys
      accessibleSurveys = await database.collection('surveys')
        .find({ active: true })
        .toArray();
    } else {
      // Regular user - only their assigned surveys
      accessibleSurveys = await database.collection('surveys')
        .find({
          asset_id: { $in: user.permissions?.surveys || [] },
          active: true
        })
        .toArray();
    }

    if (accessibleSurveys.length === 0) {
      return res.json({
        count: 0,
        next: null,
        previous: null,
        results: [],
        page: page,
        limit: limit
      });
    }

    // Determine if user has enumerator restrictions
    const allowedEnumerators = user.permissions?.enumerators || [];
    const hasEnumeratorRestrictions = allowedEnumerators.length > 0;

    // Build enumerator filter for MongoDB query
    const enumeratorFilter = hasEnumeratorRestrictions
      ? { submitted_by: { $in: allowedEnumerators } }
      : {};

    // Fetch submissions from MongoDB for each accessible survey with pagination
    const submissionsPromises = accessibleSurveys.map(async (survey) => {
      const collectionName = getSurveyFlagsCollection(survey.asset_id);

      try {
        // Fetch submissions with filters and projection (only needed fields)
        const mongoSubmissions = await database.collection(collectionName)
          .find(
            {
              type: { $ne: 'metadata' },
              ...enumeratorFilter
            },
            {
              projection: {
                submission_id: 1,
                submission_date: 1,
                vessel_number: 1,
                catch_number: 1,
                submitted_by: 1,
                validation_status: 1,
                validated_at: 1,
                validated_by: 1,
                alert_flag: 1,
                _id: 0
              }
            }
          )
          .sort({ submission_date: -1 })
          .toArray();

        return {
          asset_id: survey.asset_id,
          submissions: mongoSubmissions,
          survey_name: survey.name,
          survey_country: survey.country_id
        };
      } catch (error) {
        console.error(`Error fetching from ${collectionName}:`, error);
        return {
          asset_id: survey.asset_id,
          submissions: [],
          survey_name: survey.name,
          survey_country: survey.country_id
        };
      }
    });

    const surveySubmissions = await Promise.all(submissionsPromises);

    // Process and combine all submissions from all accessible surveys
    let allSubmissions = [];

    surveySubmissions.forEach(surveyData => {
      const processedSubmissions = surveyData.submissions.map(mongoDoc => ({
        submission_id: mongoDoc.submission_id,
        submission_date: mongoDoc.submission_date,
        vessel_number: mongoDoc.vessel_number || '',
        catch_number: mongoDoc.catch_number || '',
        submitted_by: mongoDoc.submitted_by || '',
        validation_status: mongoDoc.validation_status || 'validation_status_on_hold',
        validated_at: mongoDoc.validated_at || mongoDoc.submission_date,
        validated_by: mongoDoc.validated_by || '',
        alert_flag: mongoDoc.alert_flag || '',
        alert_flags: mongoDoc.alert_flag ? mongoDoc.alert_flag.split(', ') : [],
        asset_id: surveyData.asset_id,
        survey_name: surveyData.survey_name || 'Unknown Survey',
        survey_country: surveyData.survey_country || ''
      }));

      allSubmissions = [...allSubmissions, ...processedSubmissions];
    });

    // Sort by submission_date descending (most recent first)
    allSubmissions.sort((a, b) => {
      if (!a.submission_date) return 1;
      if (!b.submission_date) return -1;
      return b.submission_date.localeCompare(a.submission_date);
    });

    // Apply pagination after combining all surveys
    const totalCount = allSubmissions.length;
    const paginatedSubmissions = allSubmissions.slice(skip, skip + limit);
    const hasNextPage = skip + limit < totalCount;

    const response = {
      count: totalCount,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalCount / limit),
      next: hasNextPage ? `/api/kobo/submissions?page=${page + 1}&limit=${limit}` : null,
      previous: page > 1 ? `/api/kobo/submissions?page=${page - 1}&limit=${limit}` : null,
      results: paginatedSubmissions,
      metadata: {
        accessible_surveys: accessibleSurveys.map(s => ({
          asset_id: s.asset_id,
          name: s.name,
          country_id: s.country_id
        }))
      }
    };

    // Cache the response
    cache.set(cacheKey, response);
    res.set('X-Cache', 'MISS');
    res.set('Cache-Control', 'private, max-age=300'); // 5 minutes

    res.json(response);
  } catch (error) {
    console.error('Error fetching combined data:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Update validation status
app.patch('/api/submissions/:id/validation_status', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { validation_status, asset_id } = req.body;

    if (!asset_id) {
      return res.status(400).json({ error: 'asset_id is required' });
    }

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const collectionName = getSurveyFlagsCollection(asset_id);

    await database.collection(collectionName).updateOne(
      { submission_id: id },
      {
        $set: {
          validation_status,
          validated_at: new Date(),
          validated_by: req.user.username  // Track who made the update
        }
      },
      { upsert: true }
    );

    // Clear submissions cache for all users (data changed)
    const keys = cache.keys();
    keys.forEach(key => {
      if (key.startsWith('submissions_')) {
        cache.del(key);
      }
    });

    res.json({ success: true, message: `Validation status correctly updated for submission ${id}` });
  } catch (error) {
    console.error('Error updating validation status:', error);
    res.status(500).json({ error: 'Failed to update validation status' });
  }
});

// Auth endpoint - now using MongoDB users collection
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    const database = getDb();
    if (!database) {
      console.error('Database not configured');
      return res.status(500).json({ success: false, error: 'Authentication system not configured' });
    }

    // Find user by username
    const user = await database.collection('users').findOne({
      username: username.toLowerCase().trim()
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    // Check if user is active
    if (!user.active) {
      return res.status(401).json({ success: false, error: 'Account is disabled' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    // Update last_login timestamp
    await database.collection('users').updateOne(
      { _id: user._id },
      { $set: { last_login: new Date() } }
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id.toString(),
        username: user.username,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Return user object and token (exclude password_hash)
    const userResponse = {
      id: user._id.toString(),
      username: user.username,
      name: user.name,
      country: user.country,
      role: user.role,
      active: user.active,
      created_at: user.created_at,
      last_login: new Date()
    };

    res.status(200).json({
      success: true,
      token: token,
      user: userResponse,
      expiresIn: JWT_EXPIRY
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// ========================================
// User Management Endpoints (Admin Only)
// ========================================

// Get current user (authenticated users)
app.get('/api/auth/me', authenticateUser, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ========================================
// Password Reset Routes
// ========================================

// Request password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  const forgotPasswordHandler = require('../api/auth/forgot-password');
  return forgotPasswordHandler(req, res);
});

// Validate reset token
app.get('/api/auth/validate-reset-token', async (req, res) => {
  const validateTokenHandler = require('../api/auth/validate-reset-token');
  return validateTokenHandler(req, res);
});

// Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
  const resetPasswordHandler = require('../api/auth/reset-password');
  return resetPasswordHandler(req, res);
});

// ========================================
// User Management Routes (Admin)
// ========================================

// Create new user (Admin only)
app.post('/api/users', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { username, name, password, country, role, permissions } = req.body;

    // Validation
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or user' });
    }

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user document
    const newUser = {
      username: username.trim().toLowerCase(),
      password_hash,
      role,
      active: true,
      created_at: new Date(),
      created_by: req.user.username,
      last_login: null
    };

    // Add optional fields
    if (name && name.trim()) {
      newUser.name = name.trim();
    }

    if (country && Array.isArray(country) && country.length > 0) {
      newUser.country = country;
    }

    if (permissions) {
      newUser.permissions = permissions;
    }

    // Insert user
    const result = await database.collection('users').insertOne(newUser);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: result.insertedId.toString(),
        username: newUser.username,
        name: newUser.name,
        country: newUser.country,
        role: newUser.role,
        active: newUser.active,
        permissions: newUser.permissions,
        created_at: newUser.created_at,
        created_by: newUser.created_by
      }
    });
  } catch (error) {
    console.error('Create user error:', error);

    if (error.code === 11000) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get all users (Admin only)
app.get('/api/users', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const users = await database.collection('users')
      .find({}, { projection: { password_hash: 0 } }) // Exclude password_hash
      .sort({ created_at: -1 })
      .toArray();

    res.json({
      success: true,
      users: users.map(user => ({
        _id: user._id.toString(),
        username: user.username,
        name: user.name,
        country: user.country,
        role: user.role,
        active: user.active,
        permissions: user.permissions,
        created_at: user.created_at,
        created_by: user.created_by,
        last_login: user.last_login
      }))
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user (Admin only)
app.get('/api/users/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const user = await database.collection('users').findOne(
      { _id: new ObjectId(id) },
      { projection: { password_hash: 0 } }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        _id: user._id.toString(),
        username: user.username,
        name: user.name,
        country: user.country,
        role: user.role,
        active: user.active,
        permissions: user.permissions,
        created_at: user.created_at,
        created_by: user.created_by,
        last_login: user.last_login
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user (Admin only)
app.patch('/api/users/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, country, role, active, password } = req.body;

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Get existing user to check role changes
    const existingUser = await database.collection('users').findOne({ _id: new ObjectId(id) });
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update object
    const updateDoc = {
      updated_at: new Date(),
      updated_by: req.user.username
    };

    const unsetDoc = {};

    if (name !== undefined) {
      updateDoc.name = name.trim();
    }

    if (country !== undefined) {
      updateDoc.country = country;
    }

    const newRole = role !== undefined ? role : existingUser.role;

    if (role !== undefined) {
      if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Role must be admin or user' });
      }
      updateDoc.role = role;
    }

    // Handle country field based on role
    if (country !== undefined) {
      if (newRole === 'viewer') {
        if (country.length < 2) {
          return res.status(400).json({ error: 'Country code required for viewer role' });
        }
        updateDoc.country = country.trim().toLowerCase();
      } else if (newRole === 'admin') {
        // Admins should not have country field - remove it
        unsetDoc.country = '';
      }
    } else if (role === 'admin' && existingUser.country) {
      // If changing to admin role and user has country, remove it
      unsetDoc.country = '';
    } else if (role === 'viewer' && !existingUser.country && !country) {
      return res.status(400).json({ error: 'Country code required when changing to viewer role' });
    }

    if (active !== undefined) {
      updateDoc.active = Boolean(active);
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      updateDoc.password_hash = await bcrypt.hash(password, 10);
    }

    // Note: Permissions are managed through Airtable sync only
    // Do not allow manual permission updates via this endpoint

    // Update user
    const updateQuery = { $set: updateDoc };
    if (Object.keys(unsetDoc).length > 0) {
      updateQuery.$unset = unsetDoc;
    }

    const result = await database.collection('users').findOneAndUpdate(
      { _id: new ObjectId(id) },
      updateQuery,
      { returnDocument: 'after', projection: { password_hash: 0 } }
    );

    const updatedUser = result.value || result;

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        _id: updatedUser._id.toString(),
        username: updatedUser.username,
        name: updatedUser.name,
        country: updatedUser.country,
        role: updatedUser.role,
        active: updatedUser.active,
        permissions: updatedUser.permissions,
        created_at: updatedUser.created_at,
        created_by: updatedUser.created_by,
        last_login: updatedUser.last_login,
        updated_at: updatedUser.updated_at,
        updated_by: updatedUser.updated_by
      }
    });
  } catch (error) {
    console.error('Update user error:', error);

    if (error.code === 11000) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (Admin only)
app.delete('/api/users/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Prevent deleting yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await database.collection('users').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Reset user password (Admin only)
app.patch('/api/users/:id/reset-password', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const database = getDb();
    if (!database) {
      return res.status(500).json({
        success: false,
        message: 'Database not configured'
      });
    }

    // Hash the new password
    const password_hash = await bcrypt.hash(newPassword, 10);

    // Update the password
    const result = await database.collection('users').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          password_hash,
          updated_at: new Date(),
          updated_by: req.user.username
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
});

// Sync users from Airtable (Admin only)
app.post('/api/admin/sync-users', authenticateUser, requireAdmin, async (req, res) => {
  try {
    // Execute the sync script
    const syncScript = spawn('node', ['scripts/sync_users_from_airtable.js'], {
      cwd: process.cwd(),
      env: process.env
    });

    let output = '';
    let errorOutput = '';

    syncScript.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
    });

    syncScript.stderr.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      console.error(message);
    });

    syncScript.on('close', (code) => {
      if (code === 0) {
        // Parse output to extract stats
        const createdMatch = output.match(/Created: (\d+) users/);
        const updatedMatch = output.match(/Updated: (\d+) users/);
        const deletedMatch = output.match(/Deleted: (\d+) users/);

        const created = createdMatch ? parseInt(createdMatch[1]) : 0;
        const updated = updatedMatch ? parseInt(updatedMatch[1]) : 0;
        const deleted = deletedMatch ? parseInt(deletedMatch[1]) : 0;

        res.json({
          success: true,
          message: 'User sync completed successfully',
          created,
          updated,
          deleted
        });
      } else {
        console.error('Sync script failed with code:', code);
        res.status(500).json({
          success: false,
          message: 'Sync failed. Check server logs for details.',
          error: errorOutput
        });
      }
    });

  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start sync process'
    });
  }
});

// Update user permissions (Admin only)
app.patch('/api/users/:id/permissions', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { surveys } = req.body;

    if (!Array.isArray(surveys)) {
      return res.status(400).json({ error: 'Surveys must be an array of asset_ids' });
    }

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Validate that all survey asset_ids exist
    if (surveys.length > 0) {
      const existingSurveys = await database.collection('surveys').find({
        asset_id: { $in: surveys }
      }).toArray();

      if (existingSurveys.length !== surveys.length) {
        return res.status(400).json({
          error: 'One or more survey asset_ids do not exist',
          found: existingSurveys.map(s => s.asset_id),
          requested: surveys
        });
      }
    }

    // Update user permissions
    const result = await database.collection('users').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          'permissions.surveys': surveys,
          updated_at: new Date(),
          updated_by: req.user.username
        }
      },
      { returnDocument: 'after', projection: { password_hash: 0 } }
    );

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: result._id.toString(),
        username: result.username,
        email: result.email,
        role: result.role,
        permissions: result.permissions,
        updated_at: result.updated_at,
        updated_by: result.updated_by
      }
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// Get surveys accessible to a user
app.get('/api/users/:id/accessible-surveys', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Check if requesting user has permission to view this
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await database.collection('users').findOne({ _id: new ObjectId(id) });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let surveys;

    // Admin with empty permissions.surveys array = all access
    if (user.role === 'admin' && (!user.permissions?.surveys || user.permissions.surveys.length === 0)) {
      surveys = await database.collection('surveys')
        .find({ active: true })
        .sort({ country_code: 1, name: 1 })
        .toArray();
    } else {
      // Regular user - only their assigned surveys
      surveys = await database.collection('surveys')
        .find({
          asset_id: { $in: user.permissions?.surveys || [] },
          active: true
        })
        .sort({ country_code: 1, name: 1 })
        .toArray();
    }

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role
      },
      surveys: surveys.map(survey => ({
        id: survey._id.toString(),
        asset_id: survey.asset_id,
        name: survey.name,
        country_code: survey.country_code,
        active: survey.active,
        description: survey.description
      }))
    });
  } catch (error) {
    console.error('Get accessible surveys error:', error);
    res.status(500).json({ error: 'Failed to get accessible surveys' });
  }
});

// Get all surveys (for admin user management UI)
app.get('/api/surveys', authenticateUser, async (req, res) => {
  try {
    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const surveys = await database.collection('surveys')
      .find({})
      .sort({ country_id: 1, name: 1 })
      .toArray();

    res.json(surveys.map(survey => ({
      _id: survey._id.toString(),
      asset_id: survey.asset_id,
      name: survey.name,
      country_id: survey.country_id,
      active: survey.active,
      description: survey.description,
      kobo_config: survey.kobo_config
    })));
  } catch (error) {
    console.error('Get surveys error:', error);
    res.status(500).json({ error: 'Failed to get surveys' });
  }
});

// ========================================
// Country Management Endpoints (Admin Only)
// ========================================

// Get all countries
app.get('/api/countries', authenticateUser, async (req, res) => {
  try {
    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // For admins with empty permissions.surveys array, show all countries
    // For regular users, show only countries they have access to via their surveys
    let countries;

    const user = await database.collection('users').findOne({ username: req.user.username });

    if (user.role === 'admin' && (!user.permissions?.surveys || user.permissions.surveys.length === 0)) {
      // Admin with full access - show all countries
      countries = await database.collection('countries')
        .find({ active: true })
        .sort({ name: 1 })
        .toArray();
    } else {
      // Regular user - find countries they have access to via their surveys
      const accessibleSurveys = await database.collection('surveys').find({
        asset_id: { $in: user.permissions?.surveys || [] },
        active: true
      }).toArray();

      const countryCodes = [...new Set(accessibleSurveys.map(s => s.country_code))];

      countries = await database.collection('countries')
        .find({
          code: { $in: countryCodes },
          active: true
        })
        .sort({ name: 1 })
        .toArray();
    }

    // Get survey count for each country
    const countriesWithCount = await Promise.all(
      countries.map(async (country) => {
        const surveyCount = await database.collection('surveys').countDocuments({
          country_code: country.code,
          active: true
        });

        return {
          id: country._id.toString(),
          code: country.code,
          name: country.name,
          active: country.active,
          metadata: country.metadata,
          survey_count: surveyCount,
          created_at: country.created_at,
          created_by: country.created_by
        };
      })
    );

    res.json({
      success: true,
      countries: countriesWithCount
    });
  } catch (error) {
    console.error('Get countries error:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// Create new country (Admin only)
app.post('/api/countries', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { code, name, metadata } = req.body;

    // Validation
    if (!code || code.length < 2) {
      return res.status(400).json({ error: 'Country code must be at least 2 characters' });
    }

    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Country name required' });
    }

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Check if country already exists
    const existingCountry = await database.collection('countries').findOne({
      code: code.trim().toLowerCase()
    });

    if (existingCountry) {
      return res.status(409).json({ error: 'Country code already exists' });
    }

    // Create country document
    const newCountry = {
      code: code.trim().toLowerCase(),
      name: name.trim(),
      active: true,
      metadata: metadata || {},
      created_at: new Date(),
      created_by: req.user.username
    };

    const result = await database.collection('countries').insertOne(newCountry);

    res.status(201).json({
      success: true,
      country: {
        id: result.insertedId.toString(),
        code: newCountry.code,
        name: newCountry.name,
        active: newCountry.active,
        metadata: newCountry.metadata,
        created_at: newCountry.created_at,
        created_by: newCountry.created_by
      }
    });
  } catch (error) {
    console.error('Create country error:', error);

    if (error.code === 11000) {
      return res.status(409).json({ error: 'Country code already exists' });
    }

    res.status(500).json({ error: 'Failed to create country' });
  }
});

// Get single country
app.get('/api/countries/:code', authenticateUser, async (req, res) => {
  try {
    const { code } = req.params;

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const country = await database.collection('countries').findOne({
      code: code.toLowerCase()
    });

    if (!country) {
      return res.status(404).json({ error: 'Country not found' });
    }

    // Check if user has access to this country
    const user = await database.collection('users').findOne({ username: req.user.username });
    const isAdmin = user.role === 'admin' && (!user.permissions?.surveys || user.permissions.surveys.length === 0);

    if (!isAdmin) {
      // Check if user has access to any survey in this country
      const accessibleSurveys = await database.collection('surveys').find({
        asset_id: { $in: user.permissions?.surveys || [] },
        country_code: country.code
      }).toArray();

      if (accessibleSurveys.length === 0) {
        return res.status(403).json({ error: 'Access denied to this country' });
      }
    }

    // Get survey count
    const surveyCount = await database.collection('surveys').countDocuments({
      country_code: country.code,
      active: true
    });

    res.json({
      success: true,
      country: {
        id: country._id.toString(),
        code: country.code,
        name: country.name,
        active: country.active,
        metadata: country.metadata,
        survey_count: surveyCount,
        created_at: country.created_at,
        created_by: country.created_by,
        updated_at: country.updated_at,
        updated_by: country.updated_by
      }
    });
  } catch (error) {
    console.error('Get country error:', error);
    res.status(500).json({ error: 'Failed to fetch country' });
  }
});

// Update country (Admin only)
app.patch('/api/countries/:code', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { code } = req.params;
    const { name, active, metadata } = req.body;

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Build update object
    const updateDoc = {
      updated_at: new Date(),
      updated_by: req.user.username
    };

    if (name !== undefined) {
      if (name.length < 2) {
        return res.status(400).json({ error: 'Country name must be at least 2 characters' });
      }
      updateDoc.name = name.trim();
    }

    if (active !== undefined) {
      updateDoc.active = Boolean(active);
    }

    if (metadata !== undefined) {
      updateDoc.metadata = metadata;
    }

    // Update country
    const result = await database.collection('countries').findOneAndUpdate(
      { code: code.toLowerCase() },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );

    if (!result || !result._id) {
      return res.status(404).json({ error: 'Country not found' });
    }

    // Get survey count
    const surveyCount = await database.collection('surveys').countDocuments({
      country_code: result.code,
      active: true
    });

    res.json({
      success: true,
      country: {
        id: result._id.toString(),
        code: result.code,
        name: result.name,
        active: result.active,
        metadata: result.metadata,
        survey_count: surveyCount,
        created_at: result.created_at,
        created_by: result.created_by,
        updated_at: result.updated_at,
        updated_by: result.updated_by
      }
    });
  } catch (error) {
    console.error('Update country error:', error);
    res.status(500).json({ error: 'Failed to update country' });
  }
});

// Delete country (Admin only)
app.delete('/api/countries/:code', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { code } = req.params;

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Check if country has surveys
    const surveyCount = await database.collection('surveys').countDocuments({
      country_code: code.toLowerCase()
    });

    if (surveyCount > 0) {
      return res.status(400).json({
        error: `Cannot delete country with ${surveyCount} survey(s). Delete surveys first.`
      });
    }

    const result = await database.collection('countries').deleteOne({
      code: code.toLowerCase()
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }

    res.json({
      success: true,
      message: 'Country deleted successfully'
    });
  } catch (error) {
    console.error('Delete country error:', error);
    res.status(500).json({ error: 'Failed to delete country' });
  }
});

// Proxy route for getting edit URL
app.get('/api/kobo/edit-url/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { asset_id } = req.query;
    const koboAssetId = asset_id || process.env.KOBO_ASSET_ID;

    if (!id) {
      return res.status(400).json({ error: 'Submission ID is required' });
    }

    if (!koboAssetId) {
      return res.status(400).json({ error: 'asset_id parameter or KOBO_ASSET_ID env var is required' });
    }

    // Fetch survey configuration to get the correct API URL
    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const survey = await database.collection('surveys').findOne({ asset_id: koboAssetId });
    if (!survey) {
      return res.status(404).json({ error: `Survey with asset_id '${koboAssetId}' not found in database` });
    }

    if (!survey.kobo_config) {
      return res.status(500).json({ error: `Survey '${survey.name}' (${koboAssetId}) has no kobo_config. Run update_single_survey.R to configure.` });
    }

    const { api_url, token } = survey.kobo_config;

    if (!api_url || !token) {
      return res.status(500).json({ error: `Survey '${survey.name}' kobo_config is missing api_url or token` });
    }

    const url = `${api_url}/assets/${koboAssetId}/data/${id}/enketo/edit/?return_url=false`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Token ${token}`
      }
    });

    if (!response.data.url) {
      return res.status(500).json({ error: 'KoboToolbox API did not return an edit URL' });
    }

    res.json({ url: response.data.url });
  } catch (error) {
    console.error('Error generating edit URL:', error);
    if (error.isAxiosError) {
      return res.status(error.response?.status || 500).json({
        error: `KoboToolbox API error: ${error.response?.status} ${error.response?.statusText || error.message}`
      });
    }
    res.status(500).json({ error: 'Failed to generate edit URL' });
  }
});

// Proxy route for updating validation status
app.patch('/api/kobo/validation-status/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { validation_status, asset_id } = req.body;
    const koboAssetId = asset_id || process.env.KOBO_ASSET_ID;

    if (!id) {
      return res.status(400).json({ error: 'Submission ID is required' });
    }

    if (!validation_status) {
      return res.status(400).json({ error: 'validation_status is required' });
    }

    if (!koboAssetId) {
      return res.status(400).json({ error: 'asset_id parameter or KOBO_ASSET_ID env var is required' });
    }

    // Fetch survey configuration to get the correct API URL
    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const survey = await database.collection('surveys').findOne({ asset_id: koboAssetId });
    if (!survey) {
      return res.status(404).json({ error: `Survey with asset_id '${koboAssetId}' not found in database` });
    }

    if (!survey.kobo_config) {
      return res.status(500).json({ error: `Survey '${survey.name}' (${koboAssetId}) has no kobo_config. Run update_single_survey.R to configure.` });
    }

    const { api_url, token } = survey.kobo_config;

    if (!api_url || !token) {
      return res.status(500).json({ error: `Survey '${survey.name}' kobo_config is missing api_url or token` });
    }

    const url = `${api_url}/assets/${koboAssetId}/data/${id}/validation_status/`;

    // Create form data
    const formData = new URLSearchParams();
    formData.append('validation_status.uid', validation_status);

    await axios.patch(url, formData.toString(), {
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    res.json({
      success: true,
      message: `Validation status correctly updated for submission ${id}`
    });
  } catch (error) {
    console.error('Error updating validation status:', error);
    if (error.isAxiosError) {
      return res.status(error.response?.status || 500).json({
        success: false,
        error: `KoboToolbox API error: ${error.response?.status} ${error.response?.statusText || error.message}`
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update validation status',
      message: `An error occurred: ${error.message}`
    });
  }
});

// Get survey-specific alert codes
app.get('/api/surveys/:asset_id/alert-codes', async (req, res) => {
  try {
    const { asset_id } = req.params;

    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const survey = await database.collection('surveys').findOne({ asset_id });
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    // Return survey-specific alert codes if available, otherwise return default codes
    const alertCodes = survey.alert_codes || {
      "1": "A catch was reported, but no taxon was specified",
      "2": "A taxon was specified, but no information was provided about the number of fish, their size, or their weight",
      "3": "Length is smaller than minimum length threshold for the selected catch taxon",
      "4": "Length exceeds maximum length threshold for the selected catch taxon",
      "5": "Bucket weight exceeds maximum (50kg)",
      "6": "Number of buckets exceeds maximum (300)",
      "7": "Number of individuals exceeds maximum (100)",
      "8": "Price per kg exceeds threshold",
      "9": "Catch per unit effort exceeds maximum (30kg per hour per fisher)",
      "10": "Revenue per unit effort exceeds threshold"
    };

    res.json({
      asset_id,
      alert_codes: alertCodes
    });
  } catch (error) {
    console.error('Error fetching alert codes:', error);
    res.status(500).json({ error: 'Failed to fetch alert codes' });
  }
});

// Add this endpoint to collect enumerator statistics
app.get('/api/enumerator-stats', async (req, res) => {
  try {
    const koboAssetId = process.env.KOBO_ASSET_ID;
    const koboAssetIdV2 = process.env.KOBO_ASSET_ID_V2;
    const koboToken = process.env.KOBO_API_TOKEN;

    if (!koboAssetId || !koboToken) {
      return res.status(500).json({ error: 'Missing KoboToolbox configuration' });
    }

    // Fetch submissions from KoboToolbox assets (V2 is optional for backward compatibility)
    const koboUrl1 = `https://eu.kobotoolbox.org/api/v2/assets/${koboAssetId}/data/`;
    
    const requests = [
      axios.get(koboUrl1, {
        headers: {
          Authorization: `Token ${koboToken}`
        }
      })
    ];
    
    // Only fetch from second asset if V2 ID is configured
    if (koboAssetIdV2) {
      const koboUrl2 = `https://eu.kobotoolbox.org/api/v2/assets/${koboAssetIdV2}/data/`;
      requests.push(
        axios.get(koboUrl2, {
          headers: {
            Authorization: `Token ${koboToken}`
          }
        })
      );
    }

    const responses = await Promise.all(requests);
    let submissions = responses[0].data.results;
    
    // Add second asset data if available
    if (responses[1]) {
      submissions = [...submissions, ...responses[1].data.results];
    }
    
    // Group by enumerator
    const enumeratorStats = {};
    
    submissions.forEach(submission => {
      const enumerator = submission.submitted_by || submission._submitted_by || 'Unknown';
      
      if (!enumeratorStats[enumerator]) {
        enumeratorStats[enumerator] = {
          totalSubmissions: 0,
          submissionsWithAlerts: 0,
          alertFrequency: {},
          submissionsByDate: {},
          validationStatus: {
            approved: 0,
            not_approved: 0,
            on_hold: 0
          }
        };
      }
      
      // Increment total submissions
      enumeratorStats[enumerator].totalSubmissions++;
      
      // Count submissions with alerts
      if (submission.alert_flag && submission.alert_flag.trim() !== '') {
        enumeratorStats[enumerator].submissionsWithAlerts++;
        
        // Count each alert type
        const alerts = submission.alert_flag.split(' ');
        alerts.forEach(alert => {
          if (!enumeratorStats[enumerator].alertFrequency[alert]) {
            enumeratorStats[enumerator].alertFrequency[alert] = 0;
          }
          enumeratorStats[enumerator].alertFrequency[alert]++;
        });
      }
      
      // Track submissions by date (for frequency chart)
      const submissionDate = submission._submission_time.split('T')[0]; // Get just the date part
      if (!enumeratorStats[enumerator].submissionsByDate[submissionDate]) {
        enumeratorStats[enumerator].submissionsByDate[submissionDate] = 0;
      }
      enumeratorStats[enumerator].submissionsByDate[submissionDate]++;
      
      // Count validation statuses
      const status = submission._validation_status?.validation_status?.uid || 
                   submission._validation_status?.uid || 
                   'validation_status_on_hold';
      
      if (status.includes('approved')) {
        enumeratorStats[enumerator].validationStatus.approved++;
      } else if (status.includes('not_approved')) {
        enumeratorStats[enumerator].validationStatus.not_approved++;
      } else {
        enumeratorStats[enumerator].validationStatus.on_hold++;
      }
    });
    
    // Calculate error percentages and create formatted response
    const formattedStats = Object.entries(enumeratorStats).map(([name, stats]) => {
      return {
        name,
        totalSubmissions: stats.totalSubmissions,
        submissionsWithAlerts: stats.submissionsWithAlerts,
        errorRate: (stats.submissionsWithAlerts / stats.totalSubmissions) * 100,
        alertFrequency: Object.entries(stats.alertFrequency).map(([code, count]) => {
          const ALERT_FLAG_DESCRIPTIONS = {
            '1': 'A catch was reported, but no taxon was specified',
            '2': 'A taxon was specified, but no information was provided about the number of fish, their size, or their weight',
            '3': 'Length is smaller than minimum length treshold for the selected catch taxon',
            '4': 'Length exceeds maximum length treshold for the selected catch taxon',
            '5': 'Bucket weight exceeds maximum (50kg)',
            '6': 'Number of buckets exceeds maximum (300)',
            '7': 'Number of individuals exceeds maximum (100)',
            '8': 'Price per kg exceeds 81420 TZS',
            '9': 'Catch per unit effort exceeds maximum (30kg per hour per fisher)',
            '10': 'Revenue per unit effort exceeds maximum (81420 TZS per hour per fisher)'
          };
          return {
            code,
            count,
            description: ALERT_FLAG_DESCRIPTIONS[code] || 'Unknown alert'
          };
        }).sort((a, b) => b.count - a.count),
        submissionTrend: Object.entries(stats.submissionsByDate)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => new Date(a.date) - new Date(b.date)),
        validationStatus: stats.validationStatus
      };
    }).sort((a, b) => b.totalSubmissions - a.totalSubmissions);
    
    res.json(formattedStats);
  } catch (error) {
    console.error('Error fetching enumerator statistics:', error);
    res.status(500).json({ error: 'Failed to fetch enumerator statistics' });
  }
});

// Endpoint to fetch data from the enumerators_stats collection (filtered by permissions)
app.get('/api/enumerators-stats', authenticateUser, async (req, res) => {
  try {
    const database = getDb();
    if (!database) {
      return res.status(500).json({ error: 'Database connection not established' });
    }

    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10000; // High default for backward compatibility
    const skip = (page - 1) * limit;

    // User data is now in req.user from middleware (no redundant DB query!)
    const user = req.user;

    // Build cache key
    const cacheKey = `stats_${user.username}_${page}_${limit}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      res.set('X-Cache', 'HIT');
      return res.json(cachedData);
    }

    // Determine which asset_ids the user has access to
    let accessibleAssetIds;

    if (user.role === 'admin' && (!user.permissions?.surveys || user.permissions.surveys.length === 0)) {
      // Admin users get full access to ALL active surveys
      const surveys = await database.collection('surveys').find({ active: true }).toArray();
      accessibleAssetIds = surveys.map(s => s.asset_id);
    } else {
      // Regular user - only their assigned surveys
      accessibleAssetIds = user.permissions?.surveys || [];
    }

    if (accessibleAssetIds.length === 0) {
      return res.json([]);
    }

    // Get survey metadata for enrichment
    const surveys = await database.collection('surveys').find({
      asset_id: { $in: accessibleAssetIds }
    }).toArray();

    const surveyMap = {};
    surveys.forEach(survey => {
      surveyMap[survey.asset_id] = {
        name: survey.name,
        country_id: survey.country_id
      };
    });

    // Determine if user has enumerator restrictions
    const allowedEnumerators = user.permissions?.enumerators || [];
    const hasEnumeratorRestrictions = allowedEnumerators.length > 0;

    // Build enumerator filter for MongoDB query
    const enumeratorFilter = hasEnumeratorRestrictions
      ? { submitted_by: { $in: allowedEnumerators } }
      : {};

    // Fetch stats from each survey's collection with optimizations
    const statsPromises = accessibleAssetIds.map(async (assetId) => {
      const collectionName = getEnumeratorStatsCollection(assetId);
      try {
        const stats = await database.collection(collectionName)
          .find({
            type: { $ne: 'metadata' },
            ...enumeratorFilter
          })
          .toArray();

        // Add asset_id, survey name, and country to each stat record for frontend filtering
        const surveyInfo = surveyMap[assetId] || { name: 'Unknown', country_id: null };
        return stats.map(stat => ({
          ...stat,
          asset_id: assetId,
          survey_name: surveyInfo.name,
          survey_country: surveyInfo.country_id
        }));
      } catch (error) {
        console.error(`Error fetching stats from ${collectionName}:`, error);
        return [];
      }
    });

    const allStats = await Promise.all(statsPromises);
    let flattenedStats = allStats.flat();

    // Sort by submission_date descending if available
    flattenedStats.sort((a, b) => {
      if (!a.submission_date) return 1;
      if (!b.submission_date) return -1;
      return b.submission_date.localeCompare(a.submission_date);
    });

    // Apply pagination
    const totalCount = flattenedStats.length;
    const paginatedStats = flattenedStats.slice(skip, skip + limit);
    const hasNextPage = skip + limit < totalCount;

    const response = {
      count: totalCount,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalCount / limit),
      next: hasNextPage ? `/api/enumerators-stats?page=${page + 1}&limit=${limit}` : null,
      previous: page > 1 ? `/api/enumerators-stats?page=${page - 1}&limit=${limit}` : null,
      results: paginatedStats
    };

    // Cache the response
    cache.set(cacheKey, response);
    res.set('X-Cache', 'MISS');
    res.set('Cache-Control', 'private, max-age=300'); // 5 minutes

    res.json(response);
  } catch (error) {
    console.error('Error fetching enumerator statistics:', error);
    res.status(500).json({ error: 'Failed to fetch enumerator statistics' });
  }
});

// Admin endpoint to manually refresh enumerator stats
// NOTE: This endpoint is DISABLED because the data pipeline handles stats generation.
// The pipeline writes directly to:
//   - surveys_flags-{assetId} collections
//   - enumerators_stats-{assetId} collections
// If you need to re-enable this, update it to work with dynamic collections per survey.
/*
app.post('/api/admin/refresh-enumerator-stats', async (req, res) => {
  res.status(501).json({
    error: 'This endpoint is disabled. Stats are managed by the data pipeline.'
  });
});
*/

// Start server after connecting to MongoDB
connectToMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}); 