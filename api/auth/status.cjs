// api/auth/status.cjs
const { VercelRequest, VercelResponse } = require('@vercel/node');
const { getConnection } = require('../utils/db'); // Corrected import path
const { sendApiResponse } = require('../utils/apiResponse'); // Corrected import path
const { PoolClient } = require('pg'); // Import PoolClient type

exports.handler = async function handler(req, res) { // Changed export default to exports.handler
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
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
  client = await getConnection(); // <--- This is the most probable line causing the crash
  client.release();
  sendApiResponse(res, true, { connected: true }, undefined, 200);
} catch (error) {
  console.error('Database connection test failed:', error); // <--- If it crashes here, this error should appear in Vercel logs
  sendApiResponse(res, false, { connected: false }, 'Database connection failed', 500);
}

}

