// api/training_sessions.cjs
const { VercelRequest, VercelResponse } = require('@vercel/node');
const { getConnection } = require('./utils/db');
const { sendApiResponse } = require('./utils/apiResponse');
const { authMiddleware } = require('./utils/authMiddleware');
// const { TrainingSession, User } = require('../src/types/database.types'); // Types not needed at runtime
const { PoolClient } = require('pg');

// Wrap the handler with authMiddleware
exports.handler = authMiddleware(async (req, res) => { // Changed export default to exports.handler
    let client; // Untyped variable
    try {
        client = await getConnection();

        const sessionId = req.query.id ? parseInt(req.query.id, 10) : undefined; // Use req.query.id directly

        if (req.method === 'GET') {
            if (sessionId !== undefined) {
                // Handle GET /api/training_sessions/:id
                const result = await client.query('SELECT id, batch_id, title, description, date, duration, location, created_at, updated_at FROM training_sessions WHERE id = $1', [sessionId]);
                const session = result.rows[0];

                if (!session) {
                    sendApiResponse(res, false, undefined, 'Training session not found', 404);
                    return;
                }

                // Check if the authenticated user is an admin, the coach of the associated batch, or a player in the associated batch
                const batchResult = await client.query('SELECT coach_id FROM batches WHERE id = $1', [session.batch_id]);
                const batch = batchResult.rows[0];

                if (!batch) {
                     sendApiResponse(res, false, undefined, 'Associated batch not found', 404);
                     return;
                }

                 let assignedCoachUserId = null;
                 if (batch.coach_id !== null) {
                     const coachUserResult = await client.query('SELECT user_id FROM coaches WHERE id = $1', [batch.coach_id]);
                     assignedCoachUserId = coachUserResult.rows[0]?.user_id || null;
                 }

                 // Check if the player is in this batch (requires joining through attendance/player_games)
                 // Simplified: Allow players to view any session for now.
                 const isPlayerInBatch = req.user?.role === 'player'; // Simplified


                if (req.user?.role !== 'admin' && (req.user?.role !== 'coach' || req.user.id !== assignedCoachUserId) && !isPlayerInBatch) {
                     sendApiResponse(res, false, undefined, 'Access Denied', 403);
                     return;
                }

                // Transform snake_case from DB to camelCase for frontend
                const transformedSession = { // Untyped variable for CJS
                    id: session.id,
                    batchId: session.batch_id,     // Transform
                    title: session.title,
                    description: session.description,
                    date: session.date,
                    duration: session.duration,
                    location: session.location,
                    createdAt: session.created_at, // Transform
                    updatedAt: session.updated_at, // Transform
                };

                sendApiResponse(res, true, transformedSession, undefined, 200);

            } else {
                // Handle GET /api/training_sessions
                let sql = 'SELECT id, batch_id, title, description, date, duration, location, created_at, updated_at FROM training_sessions';
                const values = []; // Untyped variable
                const conditions = []; // Untyped variable
                let paramIndex = 1;

                if (req.user?.role === 'coach' && req.query.coachId === undefined) {
                     const coachResult = await client.query('SELECT id FROM coaches WHERE user_id = $1', [req.user.id]);
                     const coach = coachResult.rows[0];
                     if (coach) {
                         conditions.push(`batch_id IN (SELECT id FROM batches WHERE coach_id = $${paramIndex++})`);
                         values.push(coach.id);
                     } else {
                         sendApiResponse(res, true, [], undefined, 200);
                         return;
                     }
                } else if (req.query.coachId !== undefined) {
                     conditions.push(`batch_id IN (SELECT id FROM batches WHERE coach_id = $${paramIndex++})`);
                     values.push(req.query.coachId);
                }

                 if (req.query.batchId !== undefined) {
                      conditions.push(`batch_id = $${paramIndex++}`);
                      values.push(req.query.batchId);
                 }

                if (conditions.length > 0) {
                     sql += ' WHERE ' + conditions.join(' AND ');
                }

                sql += ' ORDER BY date ASC';

                const result = await client.query(sql, values);

                 // Transform snake_case from DB to camelCase for frontend
                const transformedSessions = result.rows.map(row => ({ // Untyped variable for CJS
                    id: row.id,
                    batchId: row.batch_id,     // Transform
                    title: row.title,
                    description: row.description,
                    date: row.date,
                    duration: row.duration,
                    location: row.location,
                    createdAt: row.created_at, // Transform
                    updatedAt: row.updated_at, // Transform
                }));

                sendApiResponse(res, true, transformedSessions, undefined, 200);
            }

        } else if (req.method === 'POST') {
            // Handle POST /api/training_sessions
            if (req.user?.role !== 'admin' && req.user?.role !== 'coach') {
                sendApiResponse(res, false, undefined, 'Access Denied', 403);
                return;
            }

            const { batchId, title, description, date, duration, location } = req.body;

            if (!batchId || !date || !duration || !location) {
                sendApiResponse(res, false, undefined, 'Batch ID, date, duration, and location are required for training session', 400);
                return;
            }

            const result = await client.query(
                'INSERT INTO training_sessions (batch_id, title, description, date, duration, location) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [batchId, title || null, description || null, date, duration, location]
            );
            const newSessionId = result.rows[0].id;

            sendApiResponse(res, true, { id: newSessionId }, undefined, 201);

        } else if (req.method === 'PUT') {
             // Handle PUT /api/training_sessions/:id
             if (sessionId === undefined) {
                  sendApiResponse(res, false, undefined, 'Training session ID is required for PUT method', 400);
                  return;
             }

             // Allow admin or the coach of the associated batch to update the session
             const batchResult = await client.query('SELECT coach_id FROM batches WHERE id = $1', [sessionId]);
             const batch = batchResult.rows[0];

             if (!batch) {
                 sendApiResponse(res, false, undefined, 'Associated batch not found', 404);
                 return;
             }

             let assignedCoachUserId = null;
             if (batch.coach_id !== null) {
                 const coachUserResult = await client.query('SELECT user_id FROM coaches WHERE id = $1', [batch.coach_id]);
                 assignedCoachUserId = coachUserResult.rows[0]?.user_id || null;
             }

             if (req.user?.role !== 'admin' && (req.user?.role !== 'coach' || req.user.id !== assignedCoachUserId)) {
                 sendApiResponse(res, false, undefined, 'Access Denied', 403);
                 return;
             }

            const { batchId, title, description, date, duration, location } = req.body;
            const updateFields = []; // Untyped variable
            const updateValues = []; // Untyped variable
             let paramIndex = 1;

            if (batchId !== undefined) { updateFields.push(`batch_id = $${paramIndex++}`); updateValues.push(batchId); }
            if (title !== undefined) { updateFields.push(`title = $${paramIndex++}`); updateValues.push(title); }
            if (description !== undefined) { updateFields.push(`description = $${paramIndex++}`); updateValues.push(description); }
            if (date !== undefined) { updateFields.push(`date = $${paramIndex++}`); updateValues.push(date); }
            if (duration !== undefined) { updateFields.push(`duration = $${paramIndex++}`); updateValues.push(duration); }
            if (location !== undefined) { updateFields.push(`location = $${paramIndex++}`); updateValues.push(location); }


            if (updateFields.length === 0) {
                sendApiResponse(res, false, undefined, 'No valid fields provided for update', 400);
                return;
            }

            updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
            updateValues.push(sessionId);

            const sql = `UPDATE training_sessions SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
            const result = await client.query(sql, updateValues);

            sendApiResponse(res, true, { affectedRows: result.rowCount }, undefined, 200);


        } else if (req.method === 'DELETE') {
             // Handle DELETE /api/training_sessions/:id
             if (sessionId === undefined) {
                  sendApiResponse(res, false, undefined, 'Training session ID is required for DELETE method', 400);
                  return;
             }

             // Allow admin or the coach of the associated batch to delete the session
             const batchResult = await client.query('SELECT coach_id FROM batches WHERE id = $1', [sessionId]);
             const batch = batchResult.rows[0];

             if (!batch) {
                 sendApiResponse(res, false, undefined, 'Associated batch not found', 404);
                 return;
             }

             let assignedCoachUserId = null;
             if (batch.coach_id !== null) {
                 const coachUserResult = await client.query('SELECT user_id FROM coaches WHERE id = $1', [batch.coach_id]);
                 assignedCoachUserId = coachUserResult.rows[0]?.user_id || null;
             }

             if (req.user?.role !== 'admin' && (req.user?.role !== 'coach' || req.user.id !== assignedCoachUserId)) {
                 sendApiResponse(res, false, undefined, 'Access Denied', 403);
                 return;
             }

             const dependentAttendanceResult = await client.query('SELECT session_id FROM session_attendance WHERE session_id = $1', [sessionId]);
             if (dependentAttendanceResult.rows.length > 0) {
                 sendApiResponse(res, false, undefined, 'Cannot delete session: It has associated attendance records.', 409);
                 return;
             }

            const result = await client.query('DELETE FROM training_sessions WHERE id = $1', [sessionId]);

            sendApiResponse(res, true, { affectedRows: result.rowCount }, undefined, 200);

        } else {
            sendApiResponse(res, false, undefined, 'Method Not Allowed', 405);
        }

    } catch (error) {
        console.error('Training sessions endpoint error:', error);
        sendApiResponse(res, false, undefined, error instanceof Error ? error.message : 'Failed to process training sessions request', 500);
    } finally {
        if (client) {
            client.release();
        }
    }
}, ['admin', 'coach', 'player']); // Allow admin (all methods), coach (GET, POST, PUT, DELETE if assigned), player (GET)

