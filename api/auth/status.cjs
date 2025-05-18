// api/status.cjs
const { VercelRequest, VercelResponse } = require('@vercel/node');
const { getConnection } = require('./utils/db');
const { sendApiResponse } = require('./utils/apiResponse');
const { PoolClient } = require('pg');

exports.handler = async function handler(req, res) {
  // --- ADDED ---
  // Set CORS headers for this endpoint (not using authMiddleware here)
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // --- END ADDED ---


  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
  }

  if (req.method !== 'GET') {
    sendApiResponse(res, false, undefined, 'Method Not Allowed', 405);
    return;
  }

  let client;
  try {
    // Attempt to get a connection to test the database
    client = await getConnection();
    client.release(); // Release immediately if successful

    sendApiResponse(res, true, { connected: true }, undefined, 200);
  } catch (error) {
    console.error('Database connection test failed:', error);
    sendApiResponse(res, false, { connected: false }, 'Database connection failed', 500);
  }
}
