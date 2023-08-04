const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const ejs = require('ejs');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const { v4: uuid } = require('uuid');
const nodemailer = require('nodemailer');
// const { Pool } = require('pg'); // Import the PostgreSQL package
const pool = require('./database.js');

let newUsersWelcomeMessage = `<p><strong>Welcome to Hami Confectionery, {user.name}!</strong></p> This is your first login, go and complete your KYC in the Profile section. <p>We are here to serve you better.</p>`;
let returningUsersWelcomeMessage = `<p><strong>Welcome back, {user.name}!</strong></p> Our services run from 08:00 - 18:00, Mondays - Saturdays. <p>You can reach us via Call/Chat 08145336427.</p>`;


const app = express();

app.use(express.static(path.join(__dirname, 'client'), {
  etag: false,
  maxAge: 0,
  lastModified: false,
  cacheControl: false,
  extensions: ['html', 'css', 'js', 'jpeg', 'png', 'mp4']
}));

app.get('/images/:filename', (req, res) => {
  const filePath = path.join(__dirname, '..', 'client', 'images', req.params.filename);
  const contentType = getContentType(filePath);
  res.set('Content-Type', contentType);
  res.sendFile(filePath);
});

// // Serve static files from the 'profile-images' folder
// app.use('/profile-images', express.static('profile-images'));

app.use('/images', express.static('client/images'));

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.mp4':
      return 'image/mp4';  
    default:
      return 'application/octet-stream';
  }
}

app.set('views', path.join(__dirname, '..', 'client', 'views'));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors()); // Allow cross-origin requests

// Configure express-session middleware
app.use(
  session({
    secret: 'mysecretkey',
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 3600000,
    },
  })
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'hamiconfectionery@gmail.com',
    pass: 'avlcrmsamttomubt',
  },
});

app.get('/signup.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname + '/../client/signup.html'));
});

app.get('/signup-success.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname + '/../client/signup-success.html'));
});

app.post('/signup', (req, res) => {
  const { name, email, password } = req.body;

  const userId = uuidv4();

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      console.error('Error hashing password:', err);
      return res.status(500).send('Internal Server Error');
    }

    pool.query(
      'INSERT INTO users (userId, name, email, password) VALUES ($1, $2, $3, $4)',
      [userId, name, email, hash],
      (err) => {
        if (err) {
          console.error('Error inserting user:', err);
          return res.status(500).send('Internal Server Error');
        }

        const welcomeMailOptions = {
          from: 'hamiconfectionery@gmail.com',
          to: email,
          subject: 'Welcome to Hami Confectionery!',
          html: `
            <html>
              <head>
                <style>
                  /* CSS styles for the email */
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>Welcome to Hami Confectionery!</h1>
                  <p>We provide the best services in pastries and cuisines.</p>
                  <p>Thank you for signing up. Your login details are:</p>
                  <ul>
                    <li><strong>Email:</strong> ${email}</li>
                    <li><strong>Password:</strong> ${password}</li>
                  </ul>
                </div>
              </body>
            </html>
          `,
        };

        transporter.sendMail(welcomeMailOptions, (error, info) => {
          if (error) {
            console.error('Error sending welcome email:', error);
          } else {
            console.log('Welcome email sent:', info.response);
          }

          // Log the user details for debugging
          console.log('User inserted:', { userId, name, email });

          res.redirect('/signup-success.html');
        });
      }
    );
  });
});



app.get('/index.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname + '/../client/index.html'));
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  pool.query('SELECT * FROM users WHERE email = $1', [email], (err, result) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.status(500).send('Error querying database');
    }

    console.log('Result rows:', result.rows);

    const user = result.rows[0];

    if (user) {
      bcrypt.compare(password, user.password, (bcryptErr, match) => {
        if (bcryptErr) {
          console.error('Error comparing passwords:', bcryptErr.message);
          return res.status(500).send('Error comparing passwords');
        }

        console.log('User:', user);

        if (match) {
          const sessionId = uuidv4();
          const loginTime = Date.now();

          pool.query(
            'UPDATE users SET lastLoginTime = $1 WHERE email = $2',
            [loginTime, email],
            (updateErr) => {
              if (updateErr) {
                console.error('Error updating last login time:', updateErr.message);
                return res.status(500).send('Error updating last login time');
              }

              const userId = user.userid;

              pool.query(
                'INSERT INTO sessions (sessionId, userId, email) VALUES ($1, $2, $3)',
                [sessionId, userId, email],
                (sessionErr) => {
                  if (sessionErr) {
                    console.error('Error saving session data:', sessionErr);
                    return res.status(500).send('Error saving session data');
                  }

                  res.cookie('sessionId', sessionId, {
                    maxAge: 3600000,
                  });

                  return res.redirect('/dashboard');
                }
              );
            }
          );
        } else {
          console.log('Invalid email or password:', email);
          return res.status(401).send('Invalid email or password');
        }
      });
    } else {
      console.log('User not found:', email);
      return res.status(401).send('Invalid email or password');
    }
  });
});




app.get('/adminindex.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname + '/../client/adminindex.html'));
});

// Admin credentials
const adminEmail = 'admin@example.com';
const adminPassword = 'adminPassword';

// Admin login route
app.post('/admin/login', (req, res) => {
  const { email, password } = req.body;

  // Check if the provided email and password match the admin credentials
  if (email === adminEmail && password === adminPassword) {
    // Admin login successful
    req.session.isAdmin = true; // Store admin session
    res.redirect('/adminpanel'); // Redirect to the admin panel
  } else {
    // Admin login failed
    res.status(401).send('Invalid credentials');
  }
});

// Protected admin panel route
app.get('/adminpanel', (req, res) => {
  // Check if admin is logged in
  if (req.session.isAdmin) {
    // Admin is logged in, serve the adminindex.html file
    // return res.redirect('/adminpanel.html');
    res.sendFile(path.join(__dirname, '/../client/views/adminpanel.html'));
  } else {
    // Admin is not logged in, redirect to login page
    res.redirect('/adminindex.html');
  }
});

// API endpoint for fetching the user list
app.get('/api/users', async (req, res) => {
  try {
    // Query the database to fetch the user data
    const result = await pool.query('SELECT * FROM users');
    const users = result.rows;

    // Format the user list to include the id property
    const formattedUserList = users.map(user => ({
      id: user.userid,
      name: user.name,
      email: user.email,
      phone: user.phone
    }));

    // Send the formatted user list as a JSON response
    res.json(formattedUserList);
  } catch (error) {
    // Handle any errors that occur during the database query
    console.error('Error fetching user list:', error);
    res.status(500).json({ error: 'An error occurred while fetching the user list' });
  }
});


// API endpoint to fetch chat history for a specific user
app.get('/api/chat/:userId', async (req, res) => {
  try {
    // Retrieve the userId from the request parameters
    const { userId } = req.params;
    // console.log(userId); // Add this line to log the userId value

    // Connect to the database
    const client = await pool.connect();

    // Query the chat history table for the given userId
    const query = 'SELECT * FROM chat_history WHERE user_id = $1';
    const values = [userId]; // Use the userId directly without parsing

    const result = await client.query(query, values);
    // console.log(result); // Add this line to log the result object

    // Release the database connection
    client.release();

    // Get the chat history rows from the result
    const chatHistory = result.rows;

    // Return the chat history as a response
    res.json(chatHistory);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});


// API endpoint to send a message to a user
app.post('/api/chat/:userId/send', (req, res) => {
  // Retrieve the userId from the request parameters
  const { userId } = req.params;
  // Retrieve the message content from the request body
  const { message } = req.body;

    // Check if the message is empty or null
    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
  

  // Create a SQL query to insert the message into the database
  const insertMessageQuery = `
    INSERT INTO messages (user_id, content, sent_at)
    VALUES ($1, $2, NOW())
    RETURNING *
  `;

  // Execute the query using the PostgreSQL pool
  pool.query(insertMessageQuery, [userId, message], (err, result) => {
    if (err) {
      console.error('Error sending message:', err);
      res.sendStatus(500);
    } else {
      // Message sent successfully
      res.sendStatus(200);
    }
  });
});




// Endpoint to handle user's messages and generate response
app.post('/api/chat/send', (req, res) => {
  const { message } = req.body;

  // Process the user's message and generate a response
  // You can add your custom logic here to generate the agent's response based on the user's message

  const agentResponse = "Hi! Thank you for your message. Our customer service agent will be with you shortly.";

  // Send the agent's response back to the frontend
  res.json({ response: agentResponse });
});

app.post('/api/updateWelcomeMessages', (req, res) => {
  const { newUsersMessage, returningUsersMessage } = req.body;

  // Update the welcome messages with the new values
  newUsersWelcomeMessage = newUsersMessage;
  returningUsersWelcomeMessage = returningUsersMessage;

  // Send a success response
  res.json({ success: true });
});












// Assign the pool to the db variable
const db = pool;

app.get('/dashboard', (req, res) => {
  const sessionId = req.cookies.sessionId;
  console.log('Session ID from cookie:', sessionId);

  pool.query('SELECT * FROM sessions WHERE sessionid = $1', [sessionId], (err, sessionResult) => {
    if (err) {
      console.error('Error querying sessions table:', err.message);
      return res.status(500).send('Error querying database');
    }

    const session = sessionResult.rows[0];

    if (session) {
      const userId = session.userid;
      console.log('Retrieved User ID:', userId);

      pool.query('SELECT * FROM users WHERE userid = $1', [userId], (err, userResult) => {
        if (err) {
          console.error('Error querying users table:', err.message);
          return res.status(500).send('Error querying database');
        }

        const user = userResult.rows[0];

        if (user) {
          // Retrieve the profile image for the user
          pool.query('SELECT image_data FROM profile_images WHERE user_id = $1', [userId], (err, imageResult) => {
            if (err) {
              console.error('Error querying profile images:', err.message);
              return res.status(500).send('Error querying database');
            }

            const profileImage = imageResult.rows.length > 0 ? imageResult.rows[0].image_data : null;

            const shouldShowPopup = user.isnewuser === 1 || session.isnewuser === 1;

            // Retrieve the welcome messages from the database or any other data source
            // and assign them to the respective variables
            const newUsersWelcomeMessage = `<p><strong>Welcome to Hami Confectionery, {user.name}!</strong></p> This is your first login, go and complete your KYC in the Profile section. <p>We are here to serve you better.</p>`;
            const returningUsersWelcomeMessage = `<p><strong>Welcome back, {user.name}!</strong></p> Our services run from 08:00 - 18:00, Mondays - Saturdays. <p>You can reach us via Call/Chat 08145336427.</p>`;

            let notificationMessage;
            if (shouldShowPopup) {
              notificationMessage = newUsersWelcomeMessage.replace('{user.name}', user.name);
            } else {
              notificationMessage = returningUsersWelcomeMessage.replace('{user.name}', user.name);
            }

            pool.query('UPDATE sessions SET isnewuser = 0 WHERE sessionid = $1', [sessionId], (err) => {
              if (err) {
                console.error('Error updating session:', err.message);
              }

              console.log('User found:', user.userid);
              res.render('dashboard', { user, username: user.name, notificationMessage, shouldShowPopup, profileImage });
            });
          });
        } else {
          console.error('User not found:', userId);
          res.status(404).send('User not found');
        }
      });
    } else {
      res.clearCookie('sessionId');
      res.redirect('/index.html');
    }
  });
});




app.get('/about', (_req, res) => {
  res.sendFile(path.join(__dirname, '/../client/views/about-us.html'));
});

app.get('/customerservice', (_req, res) => {
  res.sendFile(path.join(__dirname, '/../client/views/customerservice.html'));
});


app.get('/profile', (req, res) => {
  const sessionId = req.cookies.sessionId;

  pool.query('SELECT * FROM sessions WHERE sessionid = $1', [sessionId], (err, sessionResult) => {
    if (err) {
      console.error('Error querying sessions:', err.message);
      return res.sendStatus(500);
    }

    const session = sessionResult.rows[0];

    if (session) {
      const userId = session.userid;

      const query = {
        text: 'SELECT * FROM users WHERE userid = $1',
        values: [userId],
      };

      pool.query(query, (err, userResult) => {
        if (err) {
          console.error('Error querying users:', err.message);
          return res.sendStatus(500);
        }

        const user = userResult.rows[0];

        if (user) {
          // Fetch profile image from profile_images table
          pool.query('SELECT image_data FROM profile_images WHERE user_id = $1', [userId], (err, imageResult) => {
            if (err) {
              console.error('Error querying profile images:', err.message);
              return res.sendStatus(500);
            }

            const profileImage = imageResult.rows[0] ? imageResult.rows[0].image_data : null;

            res.render('profile', { user, profileImage });
          });
        } else {
          console.error('User not found:', userId);
          res.sendStatus(404);
        }
      });
    } else {
      res.clearCookie('sessionId');
      res.redirect('/index.html');
    }
  });
});



const multer = require('multer');

// Set up the Multer storage configuration
const storage = multer.memoryStorage();

// Create a Multer instance with the storage configuration
const upload = multer({ storage: storage });

app.post('/update-profile', upload.single('profileImage'), (req, res) => {
  console.log('Multer middleware executed');
  const sessionId = req.cookies.sessionId;

  pool.query('SELECT * FROM sessions WHERE sessionid = $1', [sessionId], (err, sessionResult) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.sendStatus(500);
    }

    const session = sessionResult.rows[0];

    if (session && session.userid) {
      const userId = session.userid;

      const { name, email, phone } = req.body;
      const profileImage = req.file ? req.file.buffer : null;

      // Check if a profile image exists for the user
      pool.query('SELECT * FROM profile_images WHERE user_id = $1', [userId], (err, imageResult) => {
        if (err) {
          console.error('Error querying profile images:', err.message);
          return res.sendStatus(500);
        }

        if (imageResult.rows.length > 0) {
          // Update the existing profile image
          pool.query('UPDATE profile_images SET image_data = $1 WHERE user_id = $2', [profileImage, userId], (err) => {
            if (err) {
              console.error('Error updating profile image:', err.message);
              return res.sendStatus(500);
            }

            // Update the user profile details
            pool.query('UPDATE users SET name = $1, email = $2, phone = $3 WHERE userid = $4', [name, email, phone, userId], (err) => {
              if (err) {
                console.error('Error updating user profile:', err.message);
                return res.sendStatus(500);
              }

              res.redirect('/profile?success=true');
            });
          });
        } else {
          // Insert a new profile image
          pool.query('INSERT INTO profile_images (user_id, image_data) VALUES ($1, $2)', [userId, profileImage], (err) => {
            if (err) {
              console.error('Error inserting profile image:', err.message);
              return res.sendStatus(500);
            }

            // Update the user profile details
            pool.query('UPDATE users SET name = $1, email = $2, phone = $3 WHERE userid = $4', [name, email, phone, userId], (err) => {
              if (err) {
                console.error('Error updating user profile:', err.message);
                return res.sendStatus(500);
              }

              res.redirect('/profile?success=true');
            });
          });
        }
      });
    } else {
      res.sendStatus(401);
    }
  });
});




app.post('/logout', (req, res) => {
  const sessionId = req.cookies.sessionId;

  pool.query('SELECT * FROM sessions WHERE sessionId = $1', [sessionId], (err, sessionResult) => {
    if (err) {
      console.error('Error querying session:', err.message);
      return res.sendStatus(500);
    }

    const session = sessionResult.rows[0];

    if (session) {
      const userId = session.userId;

      pool.query('DELETE FROM sessions WHERE userId = $1', [userId], (err, deleteResult) => {
        if (err) {
          console.error('Error deleting session:', err.message);
          return res.sendStatus(500);
        }

        res.clearCookie('sessionId');
        res.redirect('/index.html');
      });
    } else {
      console.error('Invalid session or userId');
      res.sendStatus(400);
    }
  });
});



app.get('/privacypolicy.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname + '/../client/privacypolicy.html'));
});

app.get('/termsofservice.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname + '/../client/termsofservice.html'));
});


app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hami Confectionery</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
    <style>
      /* Global Styles */
      body {
        margin: 0;
        padding: 0;
        font-family: system-ui, 'Open Sans';
        overflow-x: hidden;
      }
  
    /* Navbar Styles */
    /* Navbar Styles */
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      background-color: #535252;
      color: #333;
      z-index: 101;
      margin-left: -30px;
    }
  
    .navbar-logo {
      width: 150px;
      margin-left: 25px;
      margin-top: 5px;
    }
  
    .navbar-links {
      display: flex;
    }
  
    .navbar-link {
      text-decoration: none;
      color: #fff;
      margin-right: 10px;
    }
  
    .hamburger {
      display: none;
      flex-direction: column;
      cursor: pointer;
    }
  
    /* .hamburger span {
      display: block;
      width: 25px;
      height: 3px;
      background-color: #fff;
      margin-bottom: 5px;
    } */
  
    /* Welcome Section Styles */
    .welcome-section {
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
    }
    
    .welcome-video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .welcome-heading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 2.5em;
      text-align: center;
      color: #fff;
    }
    
    .carousel-arrows {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      z-index: 1;
    }
    
    .carousel-arrow {
      font-size: 2em;
      color: #fff;
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.3s ease-in-out;
    }
    
    .carousel-arrow:hover {
      opacity: 1;
    }
    
    .carousel-prev {
      margin-left: 20px;
    }
    
    .carousel-next {
      margin-right: 20px;
    }
    
    
    /* Services Section Styles */
    .services-section {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      padding: 50px 20px;
      background-color: #f5f5f5;
    }
  
    .service-card {
      flex-basis: 30%;
      margin: 20px;
      padding: 20px;
      border-radius: 5px;
      text-align: center;
      background-color: #fff;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
  
    .service-card-icon {
      width: 100px;
      height: 100px;
      margin-bottom: 0px;
      font-size: 40px;
    }
  
    .service-card-title {
      font-size: 1.5em;
      margin-bottom: 10px;
      margin-top: 0px;
    }
  
    .service-card-description {
      font-size: 1em;
      color: #666;
    }

    i .fas fa-birthday-cake service-card-icon {
      margin-bottom: 2px;
    }
  
    /* Testimonials Section Styles */
    .testimonials-section {
      text-align: center;
      padding: 50px 20px;
      background-color: #333;
      color: #fff;
    }
  
    .testimonial-slide {
      display: none;
    }
  
    .testimonial-slide.active {
      display: block;
    }
  
    .testimonial-slide p {
      font-size: 1.2em;
      margin-bottom: 10px;
    }
  
    .testimonial-slide span {
      font-weight: bold;
    }
  
    /* Footer Styles */
    .footer {
      text-align: center;
      padding: 20px;
      background-color: #333;
      color: #fff;
    }
  
    .footer-link {
      text-decoration: none;
      color: #fff;
      margin-right: 10px;
    }
    .footer-icon {
      color: #fff;
    }
  
    /* Navbar Styles */
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      background-color: #189259;
      color: #333;
      z-index: 100;
    }
  
    .navbar-logo {
      width: 150px;
    }
  
    .navbar-links {
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }
  
    .navbar-link {
      text-decoration: none;
      color: #fafafa;
      margin-right: 30px;
      transition: color 0.9s ease-in;
    }
  
    .navbar-link:hover {
      color: #bceec7;
    }
  
    .hamburger {
      display: none;
      position: relative;
      cursor: pointer;
      z-index: 101;
    }
  
    .hamburger span {
      display: block;
      width: 25px;
      height: 3px;
      background-color: #ffffff;
      margin-bottom: 5px;
      transition: background-color 0.7s ease-in;
    }
  
    .hamburger.active span:nth-child(1) {
      transform: translateY(8px) rotate(45deg);
      background-color: #bceec7;
    }
  
    .hamburger.active span:nth-child(2) {
      opacity: 0;
    }
  
    .hamburger.active span:nth-child(3) {
      transform: translateY(-8px) rotate(-45deg);
      background-color: #bceec7;
    }
  
    /* Media Queries */
    @media screen and (max-width: 768px) {
      .navbar-links {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: #189259;
        transform: translateX(100%);
        transition: transform 0.3s ease-in;
        z-index: 100;
      }
  
      .navbar-links.active {
        transform: translateX(0%);
      }
  
      .navbar-link {
        margin-bottom: 10px;
      }
  
      .navbar-link:hover {
        color: #bceec7;
      }
  
      .hamburger {
        display: flex;
        margin-left: 10px;
      }
    }
  </style>
  
  </head>
  
  <body>
    <nav class="navbar">
      <img class="navbar-logo" src="/images/WhatsApp_Image_2023-05-18_at_4.45.03_PM-removebg-preview.png" alt="Hami Confectionery Logo">
      <div class="navbar-links">
        <a class="navbar-link" href="/">Home</a>
        <a class="navbar-link" href="/about">About</a>
        <a class="navbar-link" href="/contact">Contact</a>
        <a class="navbar-link" href="/index.html">Login</a>
        <a class="navbar-link" href="/signup.html">Sign Up</a>
      </div>
      <div class="hamburger">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </nav>
  
    <section class="welcome-section">
    <video class="welcome-video" src="/images/chopping.mp4" autoplay muted loop></video>
    <h2 class="welcome-heading">
      <span id="word-carousel"></span>
    </h2>
    <div class="carousel-arrows">
      <div class="carousel-arrow carousel-prev">&#8249;</div>
      <div class="carousel-arrow carousel-next">&#8250;</div>
    </div>
  </section>
  
  
  
  <section class="services-section">
  <div class="service-card">
    <i class="fas fa-birthday-cake service-card-icon"></i>
    <h3 class="service-card-title">Cakes</h3>
    <p class="service-card-description">Indulgent and beautifully crafted cakes for every occasion.</p>
  </div>
  <div class="service-card">
    <i class="fas fa-utensils service-card-icon"></i>
    <h3 class="service-card-title">Pastry</h3>
    <p class="service-card-description">Artisanal pastries that delight the senses with their delicate flavors and textures.</p>
  </div>
  <div class="service-card">
    <i class="fas fa-utensil-spoon service-card-icon"></i>
    <h3 class="service-card-title">Cuisines</h3>
    <p class="service-card-description">Explore a diverse range of culinary delights from around the world.</p>
  </div>
</section>
  
    <section class="testimonials-section">
      <div class="testimonial-slide active">
        <p>"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis semper sapien a nisi laoreet congue. Nam non
          hendrerit tellus."</p>
        <span>- Charissa Isaiah</span>
      </div>
      <div class="testimonial-slide">
        <p>"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis semper sapien a nisi laoreet congue. Nam non
          hendrerit tellus."</p>
        <span>- Bankebi Akinsola</span>
      </div>
      <div class="testimonial-slide">
        <p>"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis semper sapien a nisi laoreet congue. Nam non
          hendrerit tellus."</p>
        <span>- Peter Adegoke</span>
    </section>
  
    <footer class="footer">
      <div class="footer-icons">
          <a class="footer-icon" href="https://wa.me/+2348145336427" target="_blank"><i class="fab fa-whatsapp"></i></a>
          <a class="footer-icon" href="mailto:hamiconfectionery@gmail.com"><i class="fas fa-envelope"></i></a>
          <a class="footer-icon" href="https://facebook.com" target="_blank"><i class="fab fa-facebook"></i></a>
          <a class="footer-icon" href="https://instagram.com" target="_blank"><i class="fab fa-instagram"></i></a>
      </div>
      <div class="footer-links">
        <a class="footer-link" href="/privacypolicy.html">Privacy Policy</a>
        <a class="footer-link" href="/termsofservice.html">Terms of Service</a>
      </div>
      <p>&copy; 2023 Hami Confectionery. All rights reserved.</p>
      <p>Kemta Idi-aba, Abeokuta, Nigeria</p>
    </footer>
  
    <script>
      const hamburger = document.querySelector('.hamburger');
      const navbarLinks = document.querySelector('.navbar-links');
    
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navbarLinks.classList.toggle('active');
      });
    
      window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
          navbarLinks.classList.remove('active');
          hamburger.classList.remove('active');
        }
      });
    
      const testimonialSlides = document.querySelectorAll('.testimonial-slide');
      let currentSlide = 0;
    
      function showSlide() {
        testimonialSlides.forEach((slide) => slide.classList.remove('active'));
        testimonialSlides[currentSlide].classList.add('active');
        currentSlide = (currentSlide + 1) % testimonialSlides.length;
      }
    
      setInterval(showSlide, 3000);
    
      window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        navbar.classList.toggle('sticky', window.scrollY > 0);
      });
    </script>
    

    <script>
      
    const words = [
      "Welcome to Hami Confectionery! Your best cuisines and pastries plug",
      "Our services are top-notch! We provide your taste",
      "Hami Confectionery! We make your taste"
    ];
    
    let currentIndex = 0;
    const wordCarousel = document.getElementById("word-carousel");
    
    function rotateWords() {
      wordCarousel.innerHTML = words[currentIndex];
      currentIndex = (currentIndex + 1) % words.length;
    }
    
    function showNextWord() {
      currentIndex = (currentIndex + 1) % words.length;
      rotateWords();
    }
    
    function showPreviousWord() {
      currentIndex = (currentIndex - 1 + words.length) % words.length;
      rotateWords();
    }
    
    // Initial word rotation
    rotateWords();
    
    // Automatic word rotation every 4 seconds
    setInterval(showNextWord, 4000);
    
    // Arrow button event listeners
    document.querySelector(".carousel-prev").addEventListener("click", showPreviousWord);
    document.querySelector(".carousel-next").addEventListener("click", showNextWord);
    
    
    
    </script>
    
  </body>
  
  </html>

  `);
});







// Parse JSON request bodies
app.use(express.json());


app.post('/add-to-cart', (req, res) => {
  const cartItem = req.body;
  console.log('Received cart item:', cartItem);

  const sessionId = req.cookies.sessionId;

  pool.query('SELECT * FROM sessions WHERE sessionId = $1', [sessionId], (err, sessionResult) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }

    const session = sessionResult.rows[0];

    if (!session || !session.userid) {
      return res.status(401).json({ status: 'error', message: 'User not authenticated' });
    }

    const userId = session.userid;

    pool.query('SELECT * FROM users WHERE userid = $1', [userId], (err, userResult) => {
      if (err) {
        console.error('Error checking user existence:', err.message);
        return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
      }

      const user = userResult.rows[0];

      if (!user) {
        console.error('User not found:', userId);
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      if (!user.phone || !user.profileimage) {
        return res.status(403).json({ status: 'error', message: 'Please update your profile information before placing an order.' });
      }

      const itemId = uuidv4(); // Generate a new UUID for the itemId

      // Proceed with inserting the item into the items table
      const query = 'INSERT INTO items (itemId, name, price, quantity, imageUrl) VALUES ($1, $2, $3, $4, $5)';
      const values = [itemId, cartItem.name, cartItem.price, cartItem.quantity, cartItem.imageUrl];
      pool.query(query, values, (err) => {
        if (err) {
          console.error('Error adding item to items table:', err.message);
          return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
        }

        // Proceed with inserting the item into the orders table
        const query = 'INSERT INTO orders (userid, itemid, name, price, quantity, imageurl, addedtime) VALUES ($1, $2, $3, $4, $5, $6, $7)';
        const values = [userId, itemId, cartItem.name, cartItem.price, cartItem.quantity, cartItem.imageUrl, Date.now()];
        pool.query(query, values, (err) => {
          if (err) {
            console.error('Error adding item to cart:', err.message);
            return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
          }

          // Pass the item ID and image URL to the order page
          const orderId = itemId;
          const imageUrl = cartItem.imageUrl;

          res.json({ status: 'success', message: 'Item added to cart', data: { orderId, imageUrl } });
        });
      });
    });
  });
});



app.get('/cart-count', (req, res) => {
  const sessionId = req.cookies.sessionId;

  pool.query('SELECT * FROM sessions WHERE sessionId = $1', [sessionId], (err, sessionResult) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.sendStatus(500);
    }

    const session = sessionResult.rows[0];

    if (session && session.userid) {
      const userId = session.userid;
      const query = 'SELECT COUNT(*) AS count FROM orders WHERE userid = $1';
      pool.query(query, [userId], (err, result) => {
        if (err) {
          console.error('Error retrieving cart count:', err.message);
          return res.sendStatus(500);
        } else {
          const cartCount = result.rows[0].count || 0;
          res.json({ count: cartCount });
        }
      });
    } else {
      res.json({ count: 0 });
    }
  });
});

app.get('/order', (req, res) => {
  const sessionId = req.cookies.sessionId;

  pool.query('SELECT * FROM sessions WHERE sessionId = $1', [sessionId], (err, sessionResult) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.sendStatus(500);
    }

    const session = sessionResult.rows[0];

    if (!session || !session.userid) {
      return res.redirect('/index.html');
    }

    const userId = session.userid;
    const currentTime = Date.now();
    const query = 'SELECT * FROM orders WHERE userid = $1 AND addedtime >= $2';
    const timeThreshold = currentTime - (3 * 60 * 60 * 1000); // 3 hours in milliseconds

    pool.query(query, [userId, timeThreshold], (err, result) => {
      if (err) {
        console.error('Error retrieving order data:', err.message);
        return res.sendStatus(500);
      }

      const rows = result.rows;
      console.log('Retrieved cart items:', rows); // Moved logging statement here
      res.render('order', { cartItems: rows, itemId: 'itemId', imageUrl: 'imageUrl' });
    });
  });
});

app.post('/delete-from-cart', (req, res) => {
  const sessionId = req.cookies.sessionId;
  
  console.log('Session ID:', sessionId);
  
  if (!sessionId) {
    return res.json({ success: false, message: 'Invalid session ID' });
  }
  
  pool.query('SELECT * FROM sessions WHERE sessionId = $1', [sessionId], (err, sessionResult) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.sendStatus(500);
    }
  
    const session = sessionResult.rows[0];
  
    console.log('Session:', session);
  
    if (session && session.userid) {
      const userId = session.userid;
      const itemId = req.body.itemId;
  
      console.log('User ID:', userId);
      console.log('Item ID:', itemId);
  
      const query = 'DELETE FROM orders WHERE userid = $1 AND itemid = $2';
      const values = [userId, itemId];
      pool.query(query, values, (err, result) => {
        if (err) {
          console.error('Error deleting item from cart:', err.message);
          return res.sendStatus(500);
        } else if (result.rowCount > 0) {
          res.json({ success: true });
        } else {
          res.json({ success: false, message: 'Item not found in cart' });
        }
      });
    } else {
      res.json({ success: false, message: 'User not logged in' });
    }
  });
});


app.get('/payment', (req, res) => {
  const sessionId = req.cookies.sessionId;

  console.log('Session ID:', sessionId);

  pool.query('SELECT * FROM sessions WHERE sessionId = $1', [sessionId], (err, sessionResult) => {
    if (err) {
      console.error('Error retrieving session from the database:', err);
      res.redirect('/index.html');
      return;
    }

    const session = sessionResult.rows[0];

    console.log('Session ID from cookie:', sessionId);

    if (session && session.userid && session.email) {
      const userId = session.userid;

      console.log('User ID:', userId);

      pool.query('SELECT * FROM users WHERE userid = $1', [userId], (err, userResult) => {
        if (err) {
          console.error('Error retrieving user data from the database:', err);
          res.redirect('/index.html');
          return;
        }

        const user = userResult.rows[0];

        console.log('User:', user);

        if (session.sessionid !== sessionId) {
          console.error('Session ID mismatch');
          res.redirect('/login');
          return;
        }

        if (!user || user.email !== session.email) {
          console.error('User authentication failed');
          res.redirect('/login');
          return;
        }

        console.log('Database connected:', pool);
        console.log('User ID:', userId);

        pool.query('SELECT * FROM orders WHERE userid = $1', [userId], (err, orderResult) => {
          if (err) {
            console.error('Error retrieving order data from the database:', err);
            res.redirect('/index.html');
            return;
          }

          const orderData = orderResult.rows;

          console.log('Order Data:', orderData);

          const totalPrice = orderData.reduce((total, item) => total + item.price * item.quantity, 0);

          console.log('Total Price:', totalPrice);

          res.render('payment', { cartItems: orderData, totalPrice });
        });
      });
    } else {
      res.redirect('/index.html');
    }
  });
});


app.post('/process-payment', (req, res) => {
  const { cardNumber, cardHolder, expiryDate, cvv } = req.body;
  // Process the payment here

  res.redirect('/payment-success');
});


// Set up the Multer storage configuration for payment proof upload
const paymentProofStorage = multer.diskStorage({
  destination: path.join(__dirname, 'paymentProof'),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = path.extname(file.originalname);
    const filename = `payment-proof-${uniqueSuffix}${extension}`;
    cb(null, filename);
  },
});
const paymentProofUpload = multer({ storage: paymentProofStorage });


app.post('/submit-payment-proof', upload.single('paymentProof'), (req, res) => {
  const sessionId = req.cookies.sessionId;



  pool.query('SELECT * FROM sessions WHERE sessionId = $1', [sessionId], (err, sessionResult) => {
    if (err) {
      console.error('Error retrieving session from the database:', err);
      res.redirect('/index.html');
      return;
    }

    const session = sessionResult.rows[0];

    if (session && session.userid) {
      const userId = session.userid;
      const userEmail = session.email;

        // Retrieve the payment proof file path
      const paymentProofPath = req.file.path;

      // Retrieve the shipping address and other data from the request body
      const city = req.body.city;
      const shippingAddress = req.body.shippingAddress;
      
      // Calculate shipping fee based on the selected city
      let shippingFee = 0;
      if (city === 'Abeokuta') {
        shippingFee = 10; // Set the appropriate shipping fee for Abeokuta
      } else if (city === 'Ibadan') {
        shippingFee = 15; // Set the appropriate shipping fee for Ibadan
      } else if (city === 'Lagos') {
        shippingFee = 20; // Set the appropriate shipping fee for Lagos
      }

      // Retrieve other data from the request body
      const paymentProof = req.file;
      const total = parseFloat(req.body.total);

      // Calculate the new total price with the shipping fee added
      const newTotal = total + shippingFee;

      pool.query('SELECT * FROM orders WHERE userid = $1', [userId], (err, orderResult) => {
        if (err) {
          console.error('Error retrieving order data from the database:', err);
          res.redirect('/index.html');
          return;
        }

        const orderData = orderResult.rows;

        console.log('Order Data:', orderData);

        // Extract item IDs and images from orderData
        const items = orderData.map((item) => item.name);
        const quantity = orderData.map((item) => item.quantity);
        const itemId = orderData.map((item) => item.itemid);
        const itemImages = orderData.map((item) => item.imageurl);
        const total = orderData.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const deliverytime = 'In some minutes.'; // Replace with the actual delivery time


        console.log('Payment proof submitted:', req.file);
        console.log('User Email:', userEmail);
        console.log('Order Items:', items);
        console.log('Quantity:', quantity);
        console.log('Item IDs:', itemId);
        console.log('Item Images:', itemImages);
        console.log('Total Price:', total);
        console.log('Delivery Time:', deliverytime);

        const baseUrl = 'https://hamcon.onrender.com';

        const userConfirmationMailOptions = {
          from: 'hamiconfectionery@gmail.com',
          to: userEmail,
          subject: 'Order Confirmation',
          html: `
            <html>
              <head>
                <style>
                  /* CSS styles for the email */
                  /* Add your custom CSS styles here */
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>Order Confirmation</h1>
                  <p>Thank you for your order!</p>
                  <p>Your order has been confirmed and is being processed.</p>
                  <p>Items:</p>
                  <ul>
                    ${items
                      .map(
                        (items, index) => `
                          <li>
                            <h3>${items}</h3>
                            <p>Quantity: ${quantity[index]}</p>
                            <p>ItemId: ${itemId[index]}</p>
                            <img src="${baseUrl}${itemImages[index]}" alt="Item Image" />
                          </li>
                        `
                      )
                      .join('')}
                  </ul>
                  <p>Shipping Address: ${shippingAddress}</p>
                  <p>City: ${city}</p>
                  <p>Shipping Fee: $${shippingFee}</p>
                  <p>Item Total: $${total}</p>
                  <p>Total: $${newTotal}</p> <!-- Update the total price display with the new total -->
                  <p>Delivery Time: ${deliverytime}</p>
                  <p>We will deliver your order as soon as possible. If you have any questions, please contact us on 08145336427.</p>
                </div>
              </body>
            </html>
          `,
        };

        transporter.sendMail(userConfirmationMailOptions, (error, info) => {
          if (error) {
            console.error('Error sending order confirmation email to user:', error);
          } else {
            console.log('Order confirmation email sent to user:', info.response);
          }
        });


        const paymentProofData = req.file.buffer;
        const paymentProofDataUrl = `data:image/png;base64,${paymentProofData.toString('base64')}`;

        const adminNotificationMailOptions = {
          from: 'hamiconfectionery@gmail.com',
          to: 'michaelkolawole25@gmail.com',
          subject: 'New Order Received',
          html: `
            <html>
              <head>
                <style>
                  /* CSS styles for the email */
                  /* Add your custom CSS styles here */
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>New Order Received</h1>
                  <p>A new order has been received.</p>
                  <p>User Email: ${userEmail}</p>
                  <p>Items:</p>
                  <ul>
                    ${items
                      .map(
                        (items, index) => `
                          <li>
                            <h3>${items}</h3>
                            <p>Quantity: ${quantity[index]}</p>
                            <p>ItemId: ${itemId[index]}</p>
                            <img src="${baseUrl}${itemImages[index]}" alt="Item Image" />
                          </li>
                        `
                      )
                      .join('')}
                  </ul>
                  <p>Shipping Address: ${shippingAddress}</p>
                  <p>City: ${city}</p>
                  <p>Shipping Fee: $${shippingFee}</p>
                  <p>Item Total: $${total}</p>
                  <p>Total: $${newTotal}</p> <!-- Update the total price display with the new total -->
                  <p>Delivery Time: ${deliverytime}</p>
                  <p>Please process the order and contact the user for further details.</p>
                  <p>Payment Proof:</p>
                  <img src="cid:paymentProof" alt="Payment Proof Image" />
                </div>
              </body>
            </html>
          `,
          attachments: [
            {
              filename: req.file.originalname,
              content: paymentProofData,
              cid: 'paymentProof',
            },
          ],          
        };

        transporter.sendMail(adminNotificationMailOptions, (error, info) => {
          if (error) {
            console.error('Error sending order notification email to admin:', error);
          } else {
            console.log('Order notification email sent to admin:', info.response);
          }
        });

        res.send(`
          <html>
            <head>
              <style>
                /* CSS styles for the success message */
                html, body {
                  height: 100%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-family: system-ui, 'Open Sans';
                }
                
                .success-message {
                  text-align: center;
                  padding: 20px;
                  background-color: #f0f8f3;
                }
                
                .success-message .icon {
                  font-size: 48px;
                  color: green;
                }
                
                .success-message .message {
                  margin-top: 10px;
                  font-size: 24px;
                  color: #333;
                }
                
                .success-message .button {
                  margin-top: 30px;
                  padding: 10px 20px;
                  background-color: green;
                  color: white;
                  font-size: 16px;
                  text-decoration: none;
                  border-radius: 4px;
                  display: block;
                  width: 100px;
                  margin: 0 auto;
                }      
              </style>
            </head>
            <body>
              <div class="success-message">
                <div class="icon">&#10004;</div>
                <div class="message">Payment proof submitted successfully</div>
                <br>
                <a class="button" href="/dashboard">Continue</a>
              </div>
            </body>
          </html>
        `);
      });
    } else {
      res.redirect('/index.html');
    }
  });
});




// Use the environment variable assigned by render.com for the port
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});






