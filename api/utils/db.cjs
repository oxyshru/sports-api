// api/utils/db.cjs
// api/utils/db.cjs
// Use standard imports for Pool and PoolClient
const { Pool, PoolClient } = require('pg'); // Use require

// Database connection details from environment variables
// Use POSTGRES_URL if available (standard for Supabase/Render), otherwise fall back to individual POSTGRES_ variables
const connectionString = process.env.POSTGRES_URL;

const dbConfig = connectionString ?
  {
    connectionString,
    // No need for manual SSL config if sslmode=require is in the URL
    // ssl: { rejectUnauthorized: false }, // Remove or comment out if using connection string with sslmode=require
  } :
  {
    host: process.env.POSTGRES_HOST, // Use POSTGRES_HOST
    user: process.env.POSTGRES_USER, // Use POSTGRES_USER
    password: process.env.POSTGRES_PASSWORD, // Use POSTGRES_PASSWORD
    database: process.env.POSTGRES_DATABASE, // Use POSTGRES_DATABASE
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10), // Use POSTGRES_PORT
    // Add SSL config if not using connection string and connecting to cloud DB
    ssl: {
      rejectUnauthorized: false, // Keep this if not using connection string and need SSL
    },
  };


// Create a connection pool
// Use the required Pool variable here
let pool = null;

// Use the required Pool variable here
function getPool() { // Use function keyword for CJS export
  if (!pool) {
    // Basic validation
    if (!dbConfig.connectionString && (!dbConfig.host || !dbConfig.user || !dbConfig.database)) {
        console.error("Missing required database environment variables (POSTGRES_URL or individual POSTGRES_ params).");
        throw new Error("Database configuration is incomplete.");
    }
    // Instantiate the Pool class using the required variable
    pool = new Pool(dbConfig);
    console.log("PostgreSQL database pool created.");

    // Optional: Add error handling for the pool
    pool.on('error', (err, client) => {
        console.error('Unexpected error on idle client', err);
        // process.exit(-1); // Exiting might be too aggressive in a serverless function
    });
  }
  return pool;
}

/**
 * Get a database connection from the pool.
 * Remember to release the connection using `client.release()`.
 */
// Use the required PoolClient variable here
async function getConnection() { // Use function keyword for CJS export
  try {
    // Connect using the pool
    const client = await getPool().connect();
    // console.log("Database connection obtained.");
    return client;
  } catch (error) {
    console.error("Error getting database connection:", error);
    throw error; // Re-throw to be caught by the API endpoint handler
  }
}

exports.getConnection = getConnection; // Export the function

