// api/players.cjs
const { VercelRequest, VercelResponse } = require('@vercel/node');
const { getConnection } = require('./utils/db');
const { sendApiResponse } = require('./utils/apiResponse');
const { authMiddleware } = require('./utils/authMiddleware');
// const { Player, User } = require('../src/types/database.types'); // Types not needed at runtime
const { PoolClient } = require('pg');

// Wrap the handler with authMiddleware
exports.handler = authMiddleware(async (req, res) => { // Changed export default to exports.handler
    let client; // Untyped variable
    try {
        client = await getConnection();

        const playerId = req.query.id ? parseInt(req.query.id, 10) : undefined; // Use req.query.id directly
        const userIdQuery = req.query.userId ? parseInt(req.query.userId, 10) : undefined; // Added userId query param


        if (req.method === 'GET') {
            if (playerId !== undefined) {
                // Handle GET /api/players/:id
                const result = await client.query('SELECT id, user_id, first_name, last_name, position, date_of_birth, height, weight, created_at, updated_at FROM players WHERE id = $1', [playerId]);
                const player = result.rows[0];

                if (!player) {
                    sendApiResponse(res, false, undefined, 'Player not found', 404);
                    return;
                }

                // Allow admin or the player themselves (by checking user_id) to get player data
                // Also allow coaches to view player details (simplified access control)
                if (req.user?.role !== 'admin' && req.user?.role !== 'coach' && req.user.id !== player.user_id) {
                     sendApiResponse(res, false, undefined, 'Access Denied', 403);
                     return;
                }

                // Transform snake_case from DB to camelCase for frontend
                const transformedPlayer = { // Untyped variable for CJS
                    id: player.id,
                    userId: player.user_id,           // Transform
                    firstName: player.first_name,     // Transform
                    lastName: player.last_name,       // Transform
                    position: player.position,
                    dateOfBirth: player.date_of_birth, // Transform
                    height: player.height,
                    weight: player.weight,
                    createdAt: player.created_at,     // Transform
                    updatedAt: player.updated_at,     // Transform
                    // Frontend mock-specific fields are not part of the DB response here
                };

                sendApiResponse(res, true, transformedPlayer, undefined, 200);

            } else {
                // Handle GET /api/players
                // Allow coaches and admins to get all players
                if (req.user?.role !== 'admin' && req.user?.role !== 'coach') {
                     sendApiResponse(res, false, undefined, 'Access Denied', 403);
                     return;
                }

                let sql = 'SELECT id, user_id, first_name, last_name, position, date_of_birth, height, weight, created_at, updated_at FROM players';
                const values = []; // Untyped variable
                const conditions = []; // Untyped variable
                let paramIndex = 1;

                if (userIdQuery !== undefined) { // Filter by userId if provided
                     conditions.push(`user_id = $${paramIndex++}`);
                     values.push(userIdQuery);
                }


                if (conditions.length > 0) {
                     sql += ' WHERE ' + conditions.join(' AND ');
                }

                const result = await client.query(sql, values);

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
            }

        } else if (req.method === 'POST') {
            // Handle POST /api/players (assuming this is for creating players, though registration is handled elsewhere)
            // This endpoint might not be needed if registration handles player creation.
            // If it is needed, define logic here.
            sendApiResponse(res, false, undefined, 'POST method not implemented for /api/players', 501); // Not Implemented

        } else if (req.method === 'PUT') {
             // Handle PUT /api/players/:id
             if (playerId === undefined) {
                  sendApiResponse(res, false, undefined, 'Player ID is required for PUT method', 400);
                  return;
             }

             // Allow admin or the player themselves (by checking user_id) to update player data
             const playerResult = await client.query('SELECT user_id FROM players WHERE id = $1', [playerId]);
             const player = playerResult.rows[0];

             if (!player) {
                  sendApiResponse(res, false, undefined, 'Player not found', 404);
                  return;
             }

             if (req.user?.role !== 'admin' && req.user.id !== player.user_id) {
                  sendApiResponse(res, false, undefined, 'Access Denied', 403);
                  return;
             }

             const { firstName, lastName, position, dateOfBirth, height, weight, sports } = req.body;
             const updateFields = []; // Untyped variable
             const updateValues = []; // Untyped variable
             let paramIndex = 1;

            if (firstName !== undefined) { updateFields.push(`first_name = $${paramIndex++}`); updateValues.push(firstName); }
            if (lastName !== undefined) { updateFields.push(`last_name = $${paramIndex++}`); updateValues.push(lastName); }
            if (position !== undefined) { updateFields.push(`position = $${paramIndex++}`); updateValues.push(position); }
            if (dateOfBirth !== undefined) { updateFields.push(`date_of_birth = $${paramIndex++}`); updateValues.push(dateOfBirth); }
            if (height !== undefined) { updateFields.push(`height = $${paramIndex++}`); updateValues.push(height); }
            if (weight !== undefined) { updateFields.push(`weight = $${paramIndex++}`); updateValues.push(weight); }


              // Handling 'sports' (many-to-many) is complex. Requires a transaction.
              if (sports !== undefined) {
                   await client.query('BEGIN'); // Start transaction
                   try {
                       // Delete existing player_games entries for this player
                       await client.query('DELETE FROM player_games WHERE player_id = $1', [playerId]);

                       // Insert new player_games entries
                       if (Array.isArray(sports) && sports.length > 0) {
                           // Fetch game IDs based on names
                           const gameNames = sports;
                           const gameIdsResult = await client.query('SELECT id FROM games WHERE name = ANY($1)', [gameNames]);
                           const gameIds = gameIdsResult.rows.map(row => row.id);

                           // Insert into player_games table
                           if (gameIds.length > 0) {
                               // Construct the VALUES part of the INSERT query
                               const playerGamesValues = gameIds.map(gameId => `(${playerId}, ${gameId})`).join(',');
                               await client.query(`INSERT INTO player_games (player_id, game_id) VALUES ${playerGamesValues}`);
                           }
                       }
                       await client.query('COMMIT'); // Commit transaction
                   } catch (transactionError) {
                       await client.query('ROLLBACK'); // Rollback on error
                       console.error('Transaction failed during player sports update:', transactionError);
                       sendApiResponse(res, false, undefined, 'Failed to update player sports', 500);
                       return; // Exit the handler after rollback and error response
                   }
              }


             if (updateFields.length > 0) {
                  // Only run UPDATE query if there are fields to update (excluding sports which was handled separately)
                  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
                  updateValues.push(playerId);

                  const sql = `UPDATE players SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
                  const result = await client.query(sql, updateValues);
                  sendApiResponse(res, true, { affectedRows: result.rowCount }, undefined, 200);
             } else if (sports !== undefined) {
                  // If only sports were updated, return success (affectedRows might be 0 for player table itself)
                   sendApiResponse(res, true, { affectedRows: 1 }, undefined, 200); // Indicate success
             }
             else {
                 sendApiResponse(res, false, undefined, 'No valid fields provided for update', 400);
             }


        } else if (req.method === 'DELETE') {
             // Handle DELETE /api/players/:id
             if (playerId === undefined) {
                  sendApiResponse(res, false, undefined, 'Player ID is required for DELETE method', 400);
                  return;
             }
            // Only allow admin to delete players
            if (req.user?.role !== 'admin') {
                sendApiResponse(res, false, undefined, 'Access Denied: Admins only', 403);
                return;
            }

            const result = await client.query('DELETE FROM players WHERE id = $1', [playerId]);
            sendApiResponse(res, true, { affectedRows: result.rowCount }, undefined, 200);

        } else {
            sendApiResponse(res, false, undefined, 'Method Not Allowed', 405);
        }

    } catch (error) {
        console.error('Players endpoint error:', error);
        sendApiResponse(res, false, undefined, error instanceof Error ? error.message : 'Failed to process players request', 500);
    } finally {
        if (client) {
            client.release();
        }
    }
}, ['admin', 'coach', 'player']); // Adjust required roles based on which methods are allowed for each role

