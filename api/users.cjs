// api/users.cjs
// This file handles the GET all users endpoint
const { VercelRequest, VercelResponse } = require('@vercel/node');
const { getConnection } = require('./utils/db');
const { sendApiResponse } = require('./utils/apiResponse');
const { authMiddleware } = require('./utils/authMiddleware');
// const { User } = require('../src/types/database.types'); // Types not needed at runtime
const { PoolClient } = require('pg');

// Wrap the handler with authMiddleware, requiring 'admin' role for GET
exports.handler = authMiddleware(async (req, res) => { // Changed export default to exports.handler
    if (req.method !== 'GET') {
        sendApiResponse(res, false, undefined, 'Method Not Allowed', 405);
        return;
    }

    // The authMiddleware already checked for admin role, so we can proceed
    let client; // Untyped variable
    try {
        client = await getConnection();

        // Fetch all users (excluding password)
        const result = await client.query('SELECT id, username, email, role, status, created_at, updated_at FROM users');

        // Transform snake_case from DB to camelCase for frontend
        const transformedUsers = result.rows.map(row => ({ // Untyped variable for CJS
            id: row.id,
            username: row.username,
            email: row.email,
            role: row.role,
            status: row.status,
            createdAt: row.created_at, // Transform
            updatedAt: row.updated_at, // Transform
        }));


        sendApiResponse(res, true, transformedUsers, undefined, 200);

    } catch (error) {
        console.error('Get all users error:', error);
        sendApiResponse(res, false, undefined, error instanceof Error ? error.message : 'Failed to fetch users', 500);
    } finally {
        if (client) {
            client.release();
        }
    }
}, ['admin']); // This endpoint requires 'admin' role

