const { Pool } = require('pg');
const { Sequelize } = require('sequelize');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'pg_attendance',
  password: 'anupgurung123',
  port: 5432,
});

const sequelize = new Sequelize('pg_attendance', 'postgres', 'anupgurung123', {
  host: 'localhost',
  dialect: 'postgres',
  port: 5432,
  logging: false, // optional, for debugging SQL queries
});

sequelize.authenticate()
  .then(() => console.log('Connected to DB via Sequelize'))
  .catch(err => console.error('DB connection error:', err));

module.exports = { pool, sequelize };
