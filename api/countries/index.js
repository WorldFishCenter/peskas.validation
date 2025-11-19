/**
 * GET/POST /api/countries
 *
 * List countries (GET) or create new country (POST)
 * GET requires authentication, POST requires admin
 */

const { withMiddleware, authenticateUser, requireAdmin } = require('../../lib/middleware');
const { getDb } = require('../../lib/db');
const { sendBadRequest, sendServerError, setCorsHeaders } = require('../../lib/response');

async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return await handleGet(req, res);
  } else if (req.method === 'POST') {
    // Check admin for POST
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return await handlePost(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req, res) {
  try {
    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
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

    return res.json({
      success: true,
      countries: countriesWithCount
    });
  } catch (error) {
    console.error('Get countries error:', error);
    return sendServerError(res, 'Failed to fetch countries');
  }
}

async function handlePost(req, res) {
  try {
    const { code, name, metadata } = req.body;

    // Validation
    if (!code || code.length < 2) {
      return sendBadRequest(res, 'Country code must be at least 2 characters');
    }

    if (!name || name.length < 2) {
      return sendBadRequest(res, 'Country name required');
    }

    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
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

    return res.status(201).json({
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

    return sendServerError(res, 'Failed to create country');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
