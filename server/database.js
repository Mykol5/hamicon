const { Pool } = require('pg');

// Create a new PostgreSQL pool
const pool = new Pool({
  user: 'postgres',
  password: 'Mykol~5555',
  host: '34.213.214.55',
  port: 5433, // default PostgreSQL port is 5432
  database: 'postgres',
});

// Create the users table if it doesn't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    userId UUID PRIMARY KEY,
    name TEXT,
    email TEXT,
    password TEXT,
    lastLoginTime BIGINT,
    phone TEXT,
    profileImage TEXT
  )
`, (err) => {
  if (err) {
    console.error('Error creating users table:', err);
  } else {
    console.log('Users table created successfully');
  }
});

// Create the items table if it doesn't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS items (
    itemId UUID PRIMARY KEY,
    name TEXT,
    price REAL,
    quantity INTEGER,
    imageUrl TEXT
  )
`, (err) => {
  if (err) {
    console.error('Error creating items table:', err);
  } else {
    console.log('Items table created successfully');
  }
});

// Create the orders table if it doesn't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS orders (
    orderId UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    userId UUID,
    itemId UUID,
    quantity INTEGER,
    name TEXT,
    price REAL,
    imageUrl TEXT,
    addedTime BIGINT,
    paymentProof BYTEA, -- New column for storing payment proof file data
    FOREIGN KEY (userId) REFERENCES users(userId),
    FOREIGN KEY (itemId) REFERENCES items(itemId)
  )
`, (err) => {
  if (err) {
    console.error('Error creating orders table:', err);
  } else {
    console.log('Orders table created successfully');
  }
});

// Create the sessions table if it doesn't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS sessions (
    sessionId UUID PRIMARY KEY,
    userId UUID,
    email TEXT,
    data TEXT NULL,
    isNewUser INTEGER DEFAULT 0,
    FOREIGN KEY (userId) REFERENCES users(userId)
  )
`, (err) => {
  if (err) {
    console.error('Error creating sessions table:', err);
  } else {
    console.log('Sessions table created successfully');
  }
});

// Create the profile_images table if it doesn't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS profile_images (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id),
    image_data BYTEA
  )
`, (err) => {
  if (err) {
    console.error('Error creating profile_images table:', err);
  } else {
    console.log('Profile Images table created successfully');
  }
});

// Create the chat_history table if it doesn't exist
pool.query(`
  DROP TABLE chat_history;
  CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL
  )
`, (err) => {
  if (err) {
    console.error('Error creating chat_history table:', err);
  } else {
    console.log('Chat History table created successfully');
  }
});

// Create the messages table if it doesn't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL
  )
`, (err) => {
  if (err) {
    console.error('Error creating messages table:', err);
  } else {
    console.log('Messages table created successfully');
  }
});


module.exports = pool;





