/**
 * GET/PATCH/DELETE /api/countries/:code
 *
 * Get, update, or delete a country
 * GET requires authentication, PATCH/DELETE require admin
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { getDb } = require('../../lib/db');
const { sendNotFound, sendBadRequest, sendForbidden, sendServerError, setCorsHeaders } = require('../../lib/response');

async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get country code from query parameter (Vercel converts [code] to query.code)
  const code = req.query.code;

  if (req.method === 'GET') {
    return await handleGet(req, res, code);
  } else if (req.method === 'PATCH') {
    // Check admin for PATCH
    if (req.user.role !== 'admin') {
      return sendForbidden(res, 'Admin access required');
    }
    return await handlePatch(req, res, code);
  } else if (req.method === 'DELETE') {
    // Check admin for DELETE
    if (req.user.role !== 'admin') {
      return sendForbidden(res, 'Admin access required');
    }
    return await handleDelete(req, res, code);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req, res, code) {
  try {
    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

    const country = await database.collection('countries').findOne({
      code: code.toLowerCase()
    });

    if (!country) {
      return sendNotFound(res, 'Country not found');
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
        return sendForbidden(res, 'Access denied to this country');
      }
    }

    // Get survey count
    const surveyCount = await database.collection('surveys').countDocuments({
      country_code: country.code,
      active: true
    });

    return res.json({
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
    return sendServerError(res, 'Failed to fetch country');
  }
}

async function handlePatch(req, res, code) {
  try {
    const { name, active, metadata } = req.body;

    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

    // Build update object
    const updateDoc = {
      updated_at: new Date(),
      updated_by: req.user.username
    };

    if (name !== undefined) {
      if (name.length < 2) {
        return sendBadRequest(res, 'Country name must be at least 2 characters');
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

    if (!result || !result.value) {
      return sendNotFound(res, 'Country not found');
    }

    const updatedCountry = result.value || result;

    // Get survey count
    const surveyCount = await database.collection('surveys').countDocuments({
      country_code: updatedCountry.code,
      active: true
    });

    return res.json({
      success: true,
      country: {
        id: updatedCountry._id.toString(),
        code: updatedCountry.code,
        name: updatedCountry.name,
        active: updatedCountry.active,
        metadata: updatedCountry.metadata,
        survey_count: surveyCount,
        created_at: updatedCountry.created_at,
        created_by: updatedCountry.created_by,
        updated_at: updatedCountry.updated_at,
        updated_by: updatedCountry.updated_by
      }
    });
  } catch (error) {
    console.error('Update country error:', error);
    return sendServerError(res, 'Failed to update country');
  }
}

async function handleDelete(req, res, code) {
  try {
    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
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
      return sendNotFound(res, 'Country not found');
    }

    return res.json({
      success: true,
      message: 'Country deleted successfully'
    });
  } catch (error) {
    console.error('Delete country error:', error);
    return sendServerError(res, 'Failed to delete country');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
