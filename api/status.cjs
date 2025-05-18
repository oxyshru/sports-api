// api/status.cjs
const { VercelRequest, VercelResponse } = require('@vercel/node');
const { getConnection } = require('./utils/db'); // Corrected import path
const { sendApiResponse } = require('./utils/apiResponse'); // Corrected import path
const { PoolClient } = require('pg'); // Import PoolClient type

exports.handler = async function handler(req, res) { // Changed export default to exports.handler
  // --- ADDED ---
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  // --- END ADDED ---

  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
      // Note: Setting headers here is also necessary for preflight,
      // but setting it at the top covers all methods.
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(200).end();
      return;
  }

  if (req.method !== 'GET') {
    sendApiResponse(res, false, undefined, 'Method Not Allowed', 405);
    return;
  }

  let client; // Use untyped variable for CJS
  try {
    // Attempt to get a connection to test the database
    client = await getConnection(); // <--- This is the most probable line causing the crash
    client.release(); // Release immediately if successful

    sendApiResponse(res, true, { connected: true }, undefined, 200);
  } catch (error) {
    console.error('Database connection test failed:', error);
    // sendApiResponse is called here, and it should now set the CORS header
    sendApiResponse(res, false, { connected: false }, 'Database connection failed', 500);
  }
}
