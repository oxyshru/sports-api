// api/coaches/[id]/players.cjs
const { VercelRequest, VercelResponse } = require('@vercel/node');
const { getConnection } = require('../../utils/db');
const { sendApiResponse } = require('../../utils/apiResponse');
const { authMiddleware } = require('../../utils/authMiddleware');
// const { Player, User } = require('../../../src/types/database.types'); // Types not needed at runtime
const { PoolClient } = require('pg');


// Wrap the handler with authMiddleware
exports.handler = authMiddleware(async (req, res) => { // Changed export default to exports.handler
    const coachId = parseInt(req.query.id, 10); // Use req.query.id directly

    if (isNaN(coachId)) {
        sendApiResponse(res, false, undefined, 'Invalid coach ID', 400);
        return;
    }

    if (req.method !== 'GET') {
        sendApiResponse(res, false, undefined, 'Method Not Allowed', 405);
        return;
    }

    let client; // Untyped variable
    try {
        client = await getConnection();

        // Allow admin to get players for any coach
        // Allow a coach to get players assigned to their batches
        if (req.user?.role !== 'admin') {
             // Find the coach profile for the current user
             const coachResult = await client.query('SELECT id FROM coaches WHERE user_id = $1', [req.user.id]);
             const requestingCoach = coachResult.rows[0];

             if (!requestingCoach || requestingCoach.id !== coachId) {
                  sendApiResponse(res, false, undefined, 'Access Denied', 403);
                  return;
             }
        }


        // --- Complex Query Needed Here ---
        // To get players *for this coach*, you'd typically:
        // 1. Find batches assigned to this coach (batches.coach_id = coachId)
        // 2. Find training sessions within those batches (training_sessions.batch_id IN (...batchIds))
        // 3. Find players who attended those sessions (session_attendance.session_id IN (...sessionIds))
        // 4. Fetch player details for those player IDs.
        // 5. Augment player data with attendance stats based on session_attendance for this coach's sessions.

        // Simplified Query for Demo: Just return all players for now.
        // This does NOT reflect players specific to the coach's batches.
        // Implementing the full logic requires complex SQL joins or multiple queries.

        console.warn(`Fetching players for coach ${coachId} is simplified in this demo backend. Returning all players.`);
        const result = await client.query('SELECT id, user_id, first_name, last_name, position, date_of_birth, height, weight, created_at, updated_at FROM players');

        // Transform snake_case from DB to camelCase for frontend
        const transformedPlayers = result.rows.map(row => ({ // Untyped variable for CJS
            id: row.id,
            userId: row.user_id,           // Transform
            firstName: row.first_name,     // Transform
            lastName: row.last_name,       // Transform
            position: row.position,
            dateOfBirth: row.date_of_birth, // Transform
            height: row.height,
            weight: row.weight,
            createdAt: row.created_at,     // Transform
            updatedAt: row.updated_at,     // Transform
            // Frontend mock-specific fields are not part of the DB response here
        }));


        sendApiResponse(res, true, transformedPlayers, undefined, 200);

    } catch (error) {
        console.error('Get players for coach error:', error);
        sendApiResponse(res, false, undefined, error instanceof Error ? error.message : 'Failed to fetch players for coach', 500);
    } finally {
        if (client) {
            client.release();
        }
    }
}, ['admin', 'coach']); // Allow admin or coach

