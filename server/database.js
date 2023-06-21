const sqlite3 = require('sqlite3').verbose();

// Create a new SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');

    // Create the users table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        password TEXT,
        lastLoginTime INTEGER,
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
    db.run(`
      CREATE TABLE IF NOT EXISTS items (
        itemId TEXT PRIMARY KEY,
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

    // Drop the orders table if it exists
    db.run(`
      DROP TABLE IF EXISTS orders
    `, (err) => {
      if (err) {
        console.error('Error dropping orders table:', err);
      } else {
        console.log('Orders table dropped successfully');

        // Recreate the orders table with necessary columns
        db.run(`
          CREATE TABLE IF NOT EXISTS orders (
            orderId INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT,
            itemId TEXT,
            quantity INTEGER,
            name TEXT,
            price REAL,
            imageUrl TEXT,
            addedTime INTEGER,
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

        // Drop the sessions table if it exists
        db.run(`
          DROP TABLE IF EXISTS sessions
        `, (err) => {
          if (err) {
            console.error('Error dropping sessions table:', err);
          } else {
            console.log('Sessions table dropped successfully');

            // Recreate the sessions table with necessary columns
            db.run(`
              CREATE TABLE IF NOT EXISTS sessions (
                sessionId TEXT PRIMARY KEY,
                userId TEXT,
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
          }
        });
      }
    });
  }
});

module.exports = db;

