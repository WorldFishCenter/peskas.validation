/**
 * GET/PATCH/DELETE /api/countries/:code
 *
 * Get, update, or delete a country
 * GET requires authentication, PATCH/DELETE require admin
 */

const { withMiddleware } = require('../../lib/middleware');
const { logAuditEvent } = require('../../lib/audit-logger');
const { getAccessibleSurveys, normalizeCountryCode } = require('../../lib/filter-permissions');
const { sendNotFound, sendBadRequest, sendForbidden, sendServerError } = require('../../lib/response');

/**
 * Count the surveys in a country that this user can access.
 *
 * Scoped to the user's permissions so it agrees with `GET /api/countries`, which reports the
 * same figure — otherwise the list and the detail view disagree about the same country. It
 * also avoids disclosing how many surveys exist that the user cannot see.
 *
 * Survey documents carry `country_id` (capitalized, occasionally an array) and never
 * `country_code`, so this cannot be expressed as a MongoDB `countDocuments` predicate.
 *
 * @param {import('mongodb').Db} database - Database handle (`req.db`)
 * @param {Object} user - req.user
 * @param {string} code - Country code in any casing
 * @returns {Promise<number>}
 */
async function countAccessibleSurveysForCountry(database, user, code) {
  const surveys = await getAccessibleSurveys(database, user, code);
  return surveys.length;
}

/**
 * Count every active survey in a country, ignoring permissions.
 *
 * Distinct from the permission-scoped count above on purpose: this one answers "is it safe to
 * delete this country", which must consider surveys the acting admin cannot see. Using the
 * scoped count here would let an admin with a restricted survey list delete a country that
 * still has data under it.
 *
 * @param {import('mongodb').Db} database
 * @param {string} code - Country code in any casing
 * @returns {Promise<number>}
 */
async function countAllActiveSurveysForCountry(database, code) {
  const wanted = normalizeCountryCode(code);
  const surveys = await database.collection('surveys')
    .find({ active: true }, { projection: { country_id: 1 } })
    .toArray();
  return surveys.filter(s => normalizeCountryCode(s.country_id) === wanted).length;
}

/**
 * Look up a country by code, ignoring casing.
 *
 * `countries.code` is stored capitalized ("Zanzibar"), so the previous
 * `findOne({ code: code.toLowerCase() })` matched nothing and every request 404'd.
 *
 * @param {import('mongodb').Db} database
 * @param {string} code - Country code from the URL, in any casing
 * @returns {Promise<Object|null>}
 */
async function findCountryByCode(database, code) {
  const wanted = normalizeCountryCode(code);
  if (!wanted) return null;
  const countries = await database.collection('countries').find({}).toArray();
  return countries.find(c => normalizeCountryCode(c.code) === wanted) || null;
}

async function handler(req, res) {
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
  }
}

async function handleGet(req, res, code) {
  try {
    const database = req.db;
    const country = await findCountryByCode(database, code);

    if (!country) {
      return sendNotFound(res, 'Country not found');
    }

    // A user has access to a country when they have access to at least one of its surveys.
    // Full-access admins (empty permissions.surveys) match every survey, so the same call
    // answers both the access check and the count.
    const accessibleSurveys = await getAccessibleSurveys(req.db, req.user, country.code);

    if (accessibleSurveys.length === 0) {
      return sendForbidden(res, 'Access denied to this country');
    }

    const surveyCount = accessibleSurveys.length;

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

    const database = req.db;
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

    // Resolved case-insensitively first, then updated by _id: matching on a lowercased code
    // never hit the capitalized values actually stored.
    const target = await findCountryByCode(database, code);
    if (!target) {
      return sendNotFound(res, 'Country not found');
    }

    const result = await database.collection('countries').findOneAndUpdate(
      { _id: target._id },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );

    // The mongodb driver returns the document itself from findOneAndUpdate (v4+ default);
    // `result.value` is undefined, so guarding on it reported 404 on every successful update.
    if (!result) {
      return sendNotFound(res, 'Country not found');
    }

    const updatedCountry = result;

    const surveyCount = await countAccessibleSurveysForCountry(req.db, req.user, updatedCountry.code);

    await logAuditEvent(database, {
      username: req.user.username, user_id: req.user.id,
      category: 'admin', action: 'country_updated', status: 'success',
      details: {
        country_code: updatedCountry.code,
        fields: Object.keys(updateDoc).filter(k => k !== 'updated_at' && k !== 'updated_by')
      },
      req
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
    const database = req.db;
    // Check if country has surveys. This guard counted on `surveys.country_code`, which no
    // document has, so it always read zero and never actually blocked a delete.
    const surveyCount = await countAllActiveSurveysForCountry(database, code);

    if (surveyCount > 0) {
      return res.status(400).json({
        error: `Cannot delete country with ${surveyCount} survey(s). Delete surveys first.`
      });
    }

    const target = await findCountryByCode(database, code);
    if (!target) {
      return sendNotFound(res, 'Country not found');
    }

    await database.collection('countries').deleteOne({ _id: target._id });

    await logAuditEvent(database, {
      username: req.user.username, user_id: req.user.id,
      category: 'admin', action: 'country_deleted', status: 'success',
      details: { country_code: target.code, country_name: target.name },
      req
    });

    return res.json({
      success: true,
      message: 'Country deleted successfully'
    });
  } catch (error) {
    console.error('Delete country error:', error);
    return sendServerError(res, 'Failed to delete country');
  }
}

module.exports = withMiddleware(handler, { methods: ['GET', 'PATCH', 'DELETE'] });
