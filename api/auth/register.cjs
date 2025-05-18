// api/auth/register.cjs
const { VercelRequest, VercelResponse } = require('@vercel/node');
const { getConnection } = require('../utils/db');
const { sendApiResponse } = require('../utils/apiResponse');
const { generateMockToken } = require('../utils/authMiddleware');
// const { User, Player, Coach, Game } = require('../../src/types/database.types'); // Types not needed at runtime
const { PoolClient } = require('pg');

exports.handler = async function handler(req, res) { // Changed export default to exports.handler
    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        sendApiResponse(res, false, undefined, 'Method Not Allowed', 405);
        return;
    }

    // Expected data from frontend registration form (manual or public)
    const { username, email, password, role, firstName, lastName, sports, specialization, experience } = req.body;

    if (!email || !password || !role || !firstName || !lastName) {
        sendApiResponse(res, false, undefined, 'Required user and profile fields are missing', 400);
        return;
    }

    // Basic role validation
    if (!['player', 'coach', 'admin'].includes(role)) {
        sendApiResponse(res, false, undefined, 'Invalid role specified', 400);
        return;
    }

    // Specific validation based on role
    if (role === 'player') {
         if (!Array.isArray(sports) || sports.length === 0) {
              sendApiResponse(res, false, undefined, 'Player registration requires selecting at least one sport.', 400);
              return;
         }
    }
    // Coach specialization/experience are optional in this demo INSERT


    let client; // Untyped variable
    try {
        client = await getConnection();

        // Check if user already exists
        const existingUsersResult = await client.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
        if (existingUsersResult.rows.length > 0) {
            sendApiResponse(res, false, undefined, 'User with this email or username already exists', 409);
            return;
        }

        // Start a transaction
        await client.query('BEGIN');

        // 1. Create User
        // In a real app, hash the password here
        const userResult = await client.query(
            'INSERT INTO users (username, email, password, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role, status, created_at, updated_at',
            [username, email, password, role, 'active'] // Default status to active on registration
        );
        const newUser = userResult.rows[0];
        const newUserId = newUser.id;

        let newProfileId = null;

        // 2. Create Player or Coach Profile
        if (role === 'player') {
             // Create Player profile
            const playerResult = await client.query(
                'INSERT INTO players (user_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id',
                [newUserId, firstName, lastName]
            );
             newProfileId = playerResult.rows[0].id;

             // Link the player to selected games in the player_games table
             if (Array.isArray(sports) && sports.length > 0) {
                 // Fetch game IDs based on names
                 const gameNames = sports;
                 const gameIdsResult = await client.query('SELECT id FROM games WHERE name = ANY($1)', [gameNames]);
                 const gameIds = gameIdsResult.rows.map(row => row.id);

                 // Insert into player_games table
                 if (gameIds.length > 0) {
                     const playerGamesValues = gameIds.map(gameId => `(${newProfileId}, ${gameId})`).join(',');
                     await client.query(`INSERT INTO player_games (player_id, game_id) VALUES ${playerGamesValues}`);
                 }
             }


        } else if (role === 'coach') {
            const coachResult = await client.query(
                 // Simplified Coach creation - specialization and experience are optional in this demo INSERT
                'INSERT INTO coaches (user_id, first_name, last_name, specialization, experience) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [newUserId, firstName, lastName, specialization || null, experience || null]
            );
             newProfileId = coachResult.rows[0].id;
        }
        // Admin profiles are typically created manually in the database or via a separate admin tool,
        // not via this public registration endpoint.

        // Commit the transaction
        await client.query('COMMIT');

        // Generate a mock token for the new user
         const token = generateMockToken(newUser);

        // Return the new user data and token (excluding password)
        // Transform snake_case from DB to camelCase for frontend
        const newUserResponseData = { // Untyped variable for CJS
             id: newUser.id,
             username: newUser.username,
             email: newUser.email,
             role: newUser.role,
             status: newUser.status,
             createdAt: newUser.created_at, // Transform
             updatedAt: newUser.updated_at, // Transform
             token: token,
        };


        sendApiResponse(res, true, newUserResponseData, undefined, 201); // 201 Created

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK'); // Rollback transaction on error
        }
        console.error('Registration error:', error);
        sendApiResponse(res, false, undefined, error instanceof Error ? error.message : 'Registration failed', 500);
    } finally {
        if (client) {
            client.release();
        }
    }
}

