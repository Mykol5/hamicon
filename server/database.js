const { Pool } = require('pg');

const pool = new Pool({
   connectionString: 'postgres://xyplnpvs:xOJSBmp2PauWW0JbfkacjzMmbro_xzzl@stampy.db.elephantsql.com/xyplnpvs',
});

const createTablesQuery = `
  CREATE TABLE IF NOT EXISTS users (
    userId UUID PRIMARY KEY,
    name TEXT,
    email TEXT,
    password TEXT,
    lastLoginTime BIGINT,
    phone TEXT,
    profileImage TEXT
  );

  CREATE TABLE IF NOT EXISTS items (
    itemId UUID PRIMARY KEY,
    name TEXT,
    price REAL,
    quantity INTEGER,
    imageUrl TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    orderId UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    userId UUID,
    itemId UUID,
    quantity INTEGER,
    name TEXT,
    price REAL,
    imageUrl TEXT,
    addedTime BIGINT,
    paymentProof BYTEA,
    FOREIGN KEY (userId) REFERENCES users(userId),
    FOREIGN KEY (itemId) REFERENCES items(itemId)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sessionId UUID PRIMARY KEY,
    userId UUID,
    email TEXT,
    data TEXT NULL,
    isNewUser INTEGER DEFAULT 0,
    FOREIGN KEY (userId) REFERENCES users(userId)
  );

  CREATE TABLE IF NOT EXISTS profile_images (
    id SERIAL PRIMARY KEY,
    user_id UUID UNIQUE REFERENCES users(userId),
    image_data BYTEA
  );

  -- Add more table creation statements here
`;

pool.query(createTablesQuery, (err) => {
  if (err) {
    console.error('Error creating tables:', err);
  } else {
    console.log('Tables created successfully');
  }
});

module.exports = pool;





