// api/admin/reset-db.cjs
const { VercelRequest, VercelResponse } = require('@vercel/node');
const { getConnection } = require('../utils/db');
const { sendApiResponse } = require('../utils/apiResponse');
const { authMiddleware } = require('../utils/authMiddleware');
// Import necessary types (types are not needed at runtime in CJS, but keep for reference if converting back to TS later)
// const { User, Player, Coach, Game, Batch, Payment, TrainingSession, Attendance, PerformanceNote, PlayerStats, UserSeed, PlayerSeed, CoachSeed, GameSeed, BatchSeed, PaymentSeed, TrainingSessionSeed, AttendanceSeed, PerformanceNoteSeed, PlayerGameSeed } = require('../../src/types/database.types'); // Corrected import path - types are not needed at runtime
const { PoolClient } = require('pg');


// Initial seed data (matches the structure for SQL INSERTs - uses snake_case for DB columns)
// Keep this data structure as is, it's used to build the SQL
const initialSeedData = {
    users: [
        { username: 'admin', email: 'admin@example.com', password: 'password123', role: 'admin', status: 'active' },
        { username: 'coach1', email: 'coach@example.com', password: 'password123', role: 'coach', status: 'active' },
        { username: 'player1', email: 'player@example.com', password: 'password123', role: 'player', status: 'active' },
        { username: 'player2', email: 'player2@example.com', password: 'password123', role: 'player', status: 'active' },
        { username: 'player3', email: 'player3@example.com', password: 'password123', role: 'player', status: 'active' },
        { username: 'coach2', email: 'coach2@example.com', password: 'password123', role: 'coach', status: 'active' },
    ],
    players: [
        { userId: 3, firstName: 'John', lastName: 'Smith', position: 'Forward', dateOfBirth: '2002-05-15', height: 180.5, weight: 75.2, sports: ['Badminton'] },
        { userId: 4, firstName: 'Emily', lastName: 'Johnson', position: 'Midfielder', dateOfBirth: '2003-11-20', height: 165.0, weight: 58.0, sports: ['Badminton'] },
        { userId: 5, firstName: 'Michael', lastName: 'Brown', position: 'Defender', dateOfBirth: '2000-01-30', height: 190.0, weight: 85.5, sports: ['Swimming'] },
        { userId: 6, firstName: 'Sarah', lastName: 'Davis', position: 'Goalkeeper', dateOfBirth: '2004-07-07', height: 170.0, weight: 62.0, sports: ['Swimming'] },
    ],
    coaches: [
        { userId: 2, firstName: 'Alex', lastName: 'Johnson', specialization: 'Badminton', experience: 5 },
        { userId: 6, firstName: 'Sarah', lastName: 'Williams', specialization: 'Swimming', experience: 8 },
    ],
    games: [
        { name: 'Badminton' },
        { name: 'Swimming' },
        { name: 'Football' },
        { name: 'Basketball' },
        { name: 'Tennis' },
    ],
    batches: [
        { id: 1, gameId: 1, name: 'Morning Batch', schedule: 'Mon, Wed, Fri 9:00 AM', coachId: 1 },
        { id: 2, gameId: 2, name: 'Evening Batch', schedule: 'Tue, Thu 4:00 PM', coachId: 2 },
    ],
     training_sessions: [
         { id: 1, batchId: 1, title: 'Badminton Footwork', description: 'Drills focusing on court movement', date: '2025-05-17 09:00:00+00', duration: 90, location: 'Court 1' },
         { id: 2, batchId: 1, title: 'Badminton Serve Practice', description: 'Improving serve accuracy and power', date: '2025-05-19 09:00:00+00', duration: 60, location: 'Court 1' },
         { id: 3, batchId: 2, title: 'Swimming Technique', description: 'Freestyle stroke correction', date: '2025-05-18 16:00:00+00', duration: 90, location: 'Pool Lane 2' },
     ],
    payments: [
        { id: 1, player_id: 1, date: '2025-04-15', amount: 150.00, description: 'Monthly Fee' },
        { id: 2, player_id: 1, date: '2025-05-15', amount: 150.00, description: 'Monthly Fee' },
        { id: 3, player_id: 2, date: '2025-05-20', amount: 150.00, description: 'Monthly Fee' },
        { id: 4, player_id: 3, date: '2025-04-01', amount: 200.00, description: 'Registration Fee' },
        { id: 5, player_id: 3, date: '2025-05-01', amount: 150.00, description: 'Monthly Fee' },
    ],
    performance_notes: [
        { id: 1, player_id: 1, date: '2025-05-10', note: 'Significant improvement in backhand technique', coach_id: 1, created_at: '2025-05-10', updated_at: '2025-05-10' },
        { id: 2, player_id: 2, date: '2025-05-12', note: 'Good stamina during drills', coach_id: 1, created_at: '2025-05-12', updated_at: '2025-05-12' },
        { id: 3, player_id: 3, date: '2025-05-18', note: 'Strong performance in freestyle', coach_id: 2, created_at: '2025-05-18', updated_at: '2025-05-18' },
        { id: 4, player_id: 4, date: '2025-05-18', note: 'Improving dive technique', coach_id: 2, created_at: '2025-05-18', updated_at: '2025-05-18' },
    ],
    player_games: [
        { player_id: 1, game_id: 1 },
        { player_id: 2, game_id: 1 },
        { player_id: 3, game_id: 2 },
        { player_id: 4, game_id: 2 },
    ],
     attendance: [
         { session_id: 1, player_id: 1, status: 'present', created_at: '2025-05-17 09:30:00+00', updated_at: '2025-05-17 09:30:00+00' },
         { session_id: 1, player_id: 2, status: 'present', created_at: '2025-05-17 09:31:00+00', updated_at: '2025-05-17 09:31:00+00' },
         { session_id: 3, player_id: 3, status: 'present', created_at: '2025-05-18 16:10:00+00', updated_at: '2025-05-18 16:10:00+00' },
     ]
};


// Helper to execute multiple SQL statements
async function executeSqlStatements(client, sql) { // Use untyped variables for CJS
     await client.query(sql);
}


// SQL to drop and recreate tables (matches utils/db.schema.sql structure)
// Includes dropping and recreating ENUM types
const resetSql = `
-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS performance_notes CASCADE;
DROP TABLE IF EXISTS session_attendance CASCADE;
DROP TABLE IF EXISTS training_sessions CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS player_stats CASCADE;
DROP TABLE IF EXISTS player_games CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS coaches CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom ENUM types if they exist
DROP TYPE IF EXISTS user_role_enum;
DROP TYPE IF EXISTS user_status_enum;
DROP TYPE IF EXISTS attendance_status_enum;

-- Recreate custom ENUM types for PostgreSQL
CREATE TYPE user_role_enum AS ENUM('player', 'coach', 'admin');
CREATE TYPE user_status_enum AS ENUM('active', 'inactive', 'suspended');
CREATE TYPE attendance_status_enum AS ENUM('present', 'absent', 'excused');

-- Recreate tables (copy-paste from utils/db.schema.sql, excluding comments and sample data)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role user_role_enum NOT NULL DEFAULT 'player',
  status user_status_enum NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  position VARCHAR(50),
  date_of_birth DATE,
  height DECIMAL(5,2),
  weight DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE player_games (
  player_id INTEGER NOT NULL,
  game_id INTEGER NOT NULL,
  PRIMARY KEY (player_id, game_id),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE coaches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  specialization VARCHAR(100),
  experience INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE player_stats (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL UNIQUE,
  games_played INTEGER DEFAULT 0,
  goals_scored INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  minutes_played INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE batches (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  schedule VARCHAR(255),
  coach_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE SET NULL
);

CREATE TABLE training_sessions (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL,
  title VARCHAR(100),
  description TEXT,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL,
  location VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

CREATE TABLE session_attendance (
  session_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  status attendance_status_enum NOT NULL DEFAULT 'absent',
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, player_id),
  FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE performance_notes (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL,
    coach_id INTEGER,
    date DATE NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE SET NULL
);
`;

// SQL to insert seed data (simplified - assumes IDs match initialSeedData)
// Added setval calls to reset sequences after explicit ID inserts
const seedSql = `
INSERT INTO users (id, username, email, password, role, status, created_at, updated_at) VALUES
(1, 'admin', 'admin@example.com', 'password123', 'admin', 'active', NOW(), NOW()),
(2, 'coach1', 'coach@example.com', 'password123', 'coach', 'active', NOW(), NOW()),
(3, 'player1', 'player@example.com', 'password123', 'player', 'active', NOW(), NOW()),
(4, 'player2', 'player2@example.com', 'password123', 'player', 'active', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
(5, 'player3', 'player3@example.com', 'password123', 'player', 'active', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
(6, 'coach2', 'coach2@example.com', 'password123', 'coach', 'active', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days');

-- Reset SERIAL sequences after inserting with explicit IDs
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));


INSERT INTO games (id, name, created_at, updated_at) VALUES
(1, 'Badminton', NOW(), NOW()),
(2, 'Swimming', NOW(), NOW()),
(3, 'Football', NOW(), NOW()),
(4, 'Basketball', NOW(), NOW()),
(5, 'Tennis', NOW(), NOW());

SELECT setval('games_id_seq', (SELECT MAX(id) FROM games));


INSERT INTO players (id, user_id, first_name, last_name, position, date_of_birth, height, weight, created_at, updated_at) VALUES
(1, 3, 'John', 'Smith', 'Forward', '2002-05-15', 180.5, 75.2, NOW(), NOW()),
(2, 4, 'Emily', 'Johnson', 'Midfielder', '2003-11-20', 165.0, 58.0, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
(3, 5, 'Michael', 'Brown', 'Defender', '2000-01-30', 190.0, 85.5, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
(4, 6, 'Sarah', 'Davis', 'Goalkeeper', '2004-07-07', 170.0, 62.0, NOW(), NOW());
-- Note: Players 5 and 6 from frontend mock are not seeded here to keep it simple.

SELECT setval('players_id_seq', (SELECT MAX(id) FROM players));


INSERT INTO coaches (id, user_id, first_name, last_name, specialization, experience, created_at, updated_at) VALUES
(1, 2, 'Alex', 'Johnson', 'Badminton', 5, NOW(), NOW()),
(2, 6, 'Sarah', 'Williams', 'Swimming', 8, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days');

SELECT setval('coaches_id_seq', (SELECT MAX(id) FROM coaches));


INSERT INTO batches (id, game_id, name, schedule, coach_id, created_at, updated_at) VALUES
(1, 1, 'Morning Batch', 'Mon, Wed, Fri 9:00 AM', 1, NOW(), NOW()),
(2, 2, 'Evening Batch', 'Tue, Thu 4:00 PM', 2, NOW(), NOW');

SELECT setval('batches_id_seq', (SELECT MAX(id) FROM batches));


INSERT INTO training_sessions (id, batch_id, title, description, date, duration, location, created_at, updated_at) VALUES
(1, 1, 'Badminton Footwork', 'Drills focusing on court movement', '2025-05-17 09:00:00+00', 90, 'Court 1', NOW(), NOW()),
(2, 1, 'Badminton Serve Practice', 'Improving serve accuracy and power', '2025-05-19 09:00:00+00', 60, 'Court 1', NOW(), NOW()),
(3, 2, 'Swimming Technique', 'Freestyle stroke correction', date '2025-05-18 16:00:00+00', 90, 'Pool Lane 2', NOW(), NOW());

SELECT setval('training_sessions_id_seq', (SELECT MAX(id) FROM training_sessions));


INSERT INTO payments (id, player_id, date, amount, description, created_at, updated_at) VALUES
(1, 1, '2025-04-15', 150.00, 'Monthly Fee', '2025-04-15', '2025-04-15'),
(2, 1, '2025-05-15', 150.00, 'Monthly Fee', '2025-05-15', '2025-05-15'),
(3, 2, '2025-05-20', 150.00, 'Monthly Fee', '2025-05-20', '2025-05-20'),
(4, 3, '2025-04-01', 200.00, 'Registration Fee', '2025-04-01', '2025-04-01'),
(5, 3, '2025-05-01', 150.00, 'Monthly Fee', '2025-05-01', '2025-05-01');

SELECT setval('payments_id_seq', (SELECT MAX(id) FROM payments));


INSERT INTO performance_notes (id, player_id, coach_id, date, note, created_at, updated_at) VALUES
(1, 1, 1, '2025-05-10', 'Significant improvement in backhand technique', NOW(), NOW()),
(2, 2, 1, '2025-05-12', 'Good stamina during drills', NOW(), NOW()),
(3, 3, 2, '2025-05-18', 'Strong performance in freestyle', NOW(), NOW()),
(4, 4, 2, '2025-05-18', 'Improving dive technique', NOW(), NOW());

SELECT setval('performance_notes_id_seq', (SELECT MAX(id) FROM performance_notes));


-- Link players to games (example based on frontend mock)
INSERT INTO player_games (player_id, game_id) VALUES
(1, 1), -- John Smith (player 1) -> Badminton (game 1)
(2, 1), -- Emily Johnson (player 2) -> Badminton (game 1)
(3, 2), -- Michael Brown (player 3) -> Swimming (game 2)
(4, 2); -- Sarah Davis (player 4) -> Swimming (game 2)

-- Add some mock attendance records (simplified)
INSERT INTO session_attendance (session_id, player_id, status, created_at, updated_at) VALUES
(1, 1, 'present', '2025-05-17 09:30:00+00', '2025-05-17 09:30:00+00'),
(1, 2, 'present', '2025-05-17 09:31:00+00', '2025-05-17 09:31:00+00'),
(3, 3, 'present', '2025-05-18 16:10:00+00', '2025-05-18 16:10:00+00');
`;


// This endpoint should be protected and only accessible by the Super Admin
// Use AuthenticatedRequest type for req (types are not needed at runtime in CJS)
exports.handler = authMiddleware(async (req, res) => { // Changed export default to exports.handler
    if (req.method !== 'POST') {
        sendApiResponse(res, false, undefined, 'Method Not Allowed', 405);
        return;
    }

    // Check if the authenticated user is an admin
    if (req.user?.role !== 'admin') {
        sendApiResponse(res, false, undefined, 'Access Denied: Admins only', 403);
        return;
    }


    let client; // Use untyped variable for CJS
    try {
        client = await getConnection();

        // Start a transaction
        await client.query('BEGIN');

        // Execute the reset SQL
        await executeSqlStatements(client, resetSql);

        // Execute the seed SQL
        await executeSqlStatements(client, seedSql);

        // Commit the transaction
        await client.query('COMMIT');

        sendApiResponse(res, true, undefined, 'Database reset and seeded successfully', 200);

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK'); // Rollback transaction on error
        }
        console.error('Database reset failed:', error);
        sendApiResponse(res, false, undefined, error instanceof Error ? error.message : 'Failed to reset database', 500);
    } finally {
        if (client) {
            client.release();
        }
    }
}, ['admin']); // Ensure only users with the 'admin' role can access this endpoint

