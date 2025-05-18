// api/utils/authMiddleware.cjs
// api/utils/authMiddleware.cjs
const { sendApiResponse } = require('./apiResponse');
const { getConnection } = require('./db'); // Require db for database access
// const { User } = require('../../src/types/database.types'); // Types not needed at runtime

// --- Simplified Mock Authentication ---
// In a real app, you would use JWT (jsonwebtoken library)
// and verify the token against a secret key.
// You would also likely fetch the user details from the DB
// based on the token's payload (e.g., user ID).

// Removed mockUsers array

// Mock token generation (replace with JWT)
function generateMockToken(user) { // Use function keyword for CJS export, untyped variable
    // A simple base64 encoding of user id and role for demo
    return Buffer.from(`${user.id}:${user.role}`).toString('base64');
}

// Mock token verification (replace with JWT verification)
// Modified to query the database instead of mockUsers
async function verifyMockToken(token) { // Use async function keyword for CJS export, untyped variable
    let client; // Untyped variable
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const [userId, userRole] = decoded.split(':');
        const id = parseInt(userId, 10);

        if (isNaN(id) || !userRole) {
             return null; // Invalid token format
        }

        // Fetch the user from the database based on ID and role
        client = await getConnection();
        const result = await client.query('SELECT id, username, email, role, status, created_at, updated_at FROM users WHERE id = $1 AND role = $2', [id, userRole]);
        const user = result.rows[0];

        if (!user) {
             return null; // User not found or role mismatch
        }

        // Return user data in camelCase format (excluding password)
        return { // Untyped variable
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            status: user.status,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
        };

    } catch (error) {
        console.error("Mock token verification failed:", error);
        return null;
    } finally {
        if (client) {
            client.release();
        }
    }
}
// --- End Simplified Mock Authentication ---


/**
 * Middleware to check for authentication.
 * Attaches user info to req.user if authenticated.
 * @param handler The API endpoint handler function
 * @param requiredRoles Optional array of roles required to access this endpoint
 */
function authMiddleware(handler, requiredRoles) { // Use function keyword for CJS export, untyped variables
  return async (req, res) => { // Untyped variables
    // Handle OPTIONS preflight requests before authentication
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*'); // Use env var for origin
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(200).end();
        return;
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      sendApiResponse(res, false, undefined, 'Authentication required', 401);
      return;
    }

    // Verify the token (using mock or JWT)
    const user = await verifyMockToken(token); // Use await as verifyMockToken is now async

    if (!user) {
      sendApiResponse(res, false, undefined, 'Invalid token', 401);
      return;
    }

    // Check if user status is active (optional, but good practice)
    if (user.status !== 'active') {
         sendApiResponse(res, false, undefined, 'Account is not active', 403);
         return;
    }


    // Check for required roles
    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
      sendApiResponse(res, false, undefined, 'Access denied', 403);
      return;
    }

    // Attach user info to the request for the handler
    req.user = user; // Attach to req object

    // Proceed to the actual endpoint handler
    await handler(req, res);
  };
}

// Export mock token functions for the auth endpoints
exports.generateMockToken = generateMockToken; // Export named
exports.verifyMockToken = verifyMockToken; // Export named
exports.authMiddleware = authMiddleware; // Export named

