// api/auth/login.cjs
const { VercelRequest, VercelResponse } = require('@vercel/node');
const { getConnection } = require('../utils/db');
const { sendApiResponse } = require('../utils/apiResponse');
const { generateMockToken } = require('../utils/authMiddleware');
// const { User } = require('../../src/types/database.types'); // Types not needed at runtime
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

    const { email, password } = req.body;

    if (!email || !password) {
        sendApiResponse(res, false, undefined, 'Email and password are required', 400);
        return;
    }

    let client; // Untyped variable
    try {
        client = await getConnection();

        // In a real app, you would hash the password and compare
        // For this demo, we'll do a plain text password check (INSECURE!)
        const result = await client.query('SELECT id, username, email, role, status, created_at, updated_at FROM users WHERE email = $1 AND password = $2', [email, password]);

        const user = result.rows[0];

        if (!user) {
            sendApiResponse(res, false, undefined, 'Invalid email or password', 401);
            return;
        }

        // Check user status
        if (user.status !== 'active') {
             sendApiResponse(res, false, undefined, 'Account is not active', 403);
             return;
        }


        // Generate a mock token (replace with JWT)
        const token = generateMockToken(user);

        // Return user data (excluding password) and the token
        // Transform snake_case from DB to camelCase for frontend
        const userData = { // Untyped variable for CJS
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            status: user.status,
            createdAt: user.created_at, // Transform
            updatedAt: user.updated_at, // Transform
            token: token,
        };


        sendApiResponse(res, true, userData, undefined, 200);

    } catch (error) {
        console.error('Login error:', error);
        sendApiResponse(res, false, undefined, error instanceof Error ? error.message : 'Login failed', 500);
    } finally {
        if (client) {
            client.release();
        }
    }
}

