// models/createUsersTable.js
const pool = require('../config/db');

const createUsersTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `;

  try {
    await pool.query(query);
    console.log('✅ users table created successfully');
  } catch (error) {
    console.error('❌ Error creating users table:', error);
  } finally {
    await pool.end();
  }
};

createUsersTable();
