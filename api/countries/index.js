/**
 * GET/POST /api/countries
 *
 * List countries (GET) or create new country (POST)
 * GET requires authentication, POST requires admin
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { getDb } = require('../../lib/db');
const { logAuditEvent } = require('../../lib/audit-logger');
const { getAccessibleCountries, getAccessibleSurveys, normalizeCountryCode } = require('../../lib/filter-permissions');
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
    const countries = await getAccessibleCountries(req.user);

    // Survey counts are derived from the surveys this user can actually see, matched on the
    // normalized country slug. The previous implementation counted on `surveys.country_code`,
    // a field nothing ever writes, so every count was zero.
    const accessibleSurveys = await getAccessibleSurveys(req.user);
    const surveyCountByCode = accessibleSurveys.reduce((acc, survey) => {
      const code = normalizeCountryCode(survey.country_id);
      if (code) acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});

    const countriesWithCount = countries.map(country => ({
      id: country._id.toString(),
      code: country.code,
      name: country.name,
      active: country.active,
      metadata: country.metadata,
      survey_count: surveyCountByCode[normalizeCountryCode(country.code)] || 0,
      created_at: country.created_at,
      created_by: country.created_by
    }));

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

    // Existing codes are stored capitalized, so an exact lowercase lookup would miss them and
    // let a duplicate through. Compare normalized.
    const wanted = normalizeCountryCode(code);
    const existing = await database.collection('countries').find({}, { projection: { code: 1 } }).toArray();

    if (existing.some(c => normalizeCountryCode(c.code) === wanted)) {
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

    await logAuditEvent(database, {
      username: req.user.username, user_id: req.user.id,
      category: 'admin', action: 'country_created', status: 'success',
      details: { country_code: newCountry.code, country_name: newCountry.name },
      req
    });

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
