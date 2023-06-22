const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const ejs = require('ejs');
const session = require('express-session');
// const FileStore = require('session-file-store')(session);
const { v4: uuidv4 } = require('uuid');
const ordersDirectory = path.join(__dirname, 'orders');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3');
const db = require('./database.js');
const SQLiteStore = require('connect-sqlite3')(session);


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

// Serve static files from the 'profile-images' folder
app.use('/profile-images', express.static('profile-images'));

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
      maxAge: 3600000, // Set the maximum age (in milliseconds) for the session cookie
      // Additional cookie options can be added here
    },
    unset: 'destroy', // Clear the session data on expiration
    rolling: true, // Extend the session expiration on each request
    store: new SQLiteStore({
      db: './database.db', // Path to your SQLite database file
      table: 'session_store', // Change the table name to 'session_store'
      // Additional options can be added here
    }),
  })
);


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'hamiconfectionery@gmail.com',
    pass: 'avlcrmsamttomubt'
  }
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

  // Generate a unique userId
  const userId = uuidv4();

  // Hash the password
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      console.error('Error hashing password:', err);
      return res.status(500).send('Internal Server Error');
    }

    // Insert the user into the database with the generated userId
    db.run('INSERT INTO users (userId, name, email, password) VALUES (?, ?, ?, ?)', [userId, name, email, hash], (err) => {
      if (err) {
        console.error('Error inserting user:', err);
        return res.status(500).send('Internal Server Error');
      }

    // Send the welcome email to the user
    const welcomeMailOptions = {
      from: 'hamiconfectionery@gmail.com',
      to: email,
      subject: 'Welcome to Hami Confectionery!',
      html: `
      <html>
        <head>
          <style>
            /* CSS styles for the email */
            body {
              font-family: 'Arial', sans-serif;
              background-color: #f5f5f5;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #ffffff;
              border-radius: 5px;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
            h1 {
              color: #333333;
              font-size: 24px;
              margin: 0 0 20px;
            }
            p {
              color: #666666;
              font-size: 16px;
              line-height: 1.5;
              margin: 0 0 10px;
            }
            ul {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            li {
              margin-bottom: 5px;
            }
            strong {
              font-weight: bold;
            }
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
    `
    };

    transporter.sendMail(welcomeMailOptions, (error, info) => {
      if (error) {
        console.error('Error sending welcome email:', error);
      } else {
        console.log('Welcome email sent:', info.response);
      }

        // Redirect the user to the sign-up success page
        res.redirect('/signup-success.html');
      });
    });
  });
});

// const sessions = {};

app.get('/index.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname + '/../client/index.html'));
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.status(500).send('Error querying database');
    }

    if (!row) {
      return res.status(401).send('User not found');
    }

    bcrypt.compare(password, row.password, (bcryptErr, result) => {
      if (bcryptErr) {
        console.error('Error comparing passwords:', bcryptErr);
        return res.status(500).send('Error comparing passwords');
      }

      if (result) {
        const sessionId = uuidv4();
        const loginTime = Date.now();

        db.run('UPDATE users SET lastLoginTime = ? WHERE email = ?', [loginTime, email], (updateErr) => {
          if (updateErr) {
            console.error('Error updating last login time:', updateErr.message);
            return res.status(500).send('Error updating last login time');
          }

          const userId = row.userId;

          db.run(
            'INSERT INTO sessions (sessionId, userId, email) VALUES (?, ?, ?)',
            [sessionId, userId, email],
            (sessionErr) => {
              if (sessionErr) {
                console.error('Error saving session data:', sessionErr);
                return res.status(500).send('Error saving session data');
              }

              res.cookie('sessionId', sessionId, {
                maxAge: 3600000,
              });

              return res.redirect('/dashboard.html');
            }
          );
        });
      } else {
        return res.status(401).send('Invalid email or password');
      }
    });
  });
});


app.get('/dashboard.html', (req, res) => {
  // Assuming you have a way to identify the currently logged-in user
  const sessionId = req.cookies.sessionId;
  console.log('Session ID from cookie:', sessionId);

  db.get('SELECT * FROM sessions WHERE sessionId = ?', [sessionId], (err, row) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.sendStatus(500);
    }

    if (row) {
      const userId = row.userId;

      // Find the user with the matching ID in the SQLite database
      db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, row) => {
        if (err) {
          console.error('Error querying database:', err.message);
          return res.sendStatus(500);
        }

        if (row) {
          // Determine if the pop-up should be shown based on the session's isNewUser flag
          const shouldShowPopup = row.isNewUser;

          // Determine the notification message based on whether the user is a new user or an existing user
          let notificationMessage;
          if (shouldShowPopup) {
            notificationMessage = `<p><strong>Welcome to Hami Confectionery, ${row.name}!</strong></p> This is your first login, go and complete your KYC in the Profile section. <p>We are here to serve you better.</p>`;
          } else {
            notificationMessage = `<p><strong>Welcome back, ${row.name}!</strong></p> Our services run from 08:00 - 18:00, Mondays - Saturdays. <p>You can reach us via Call/Chat 08145336427.</p>`;
          }

          // Update the isNewUser flag to false for the current session
          db.run('UPDATE sessions SET isNewUser = 0 WHERE sessionId = ?', [sessionId], (err) => {
            if (err) {
              console.error('Error updating session:', err.message);
            }

            // Render the dashboard page and pass the user, username, notificationMessage, and shouldShowPopup to the template
            res.render('dashboard', { user: row, username: row.name, notificationMessage, shouldShowPopup });
          });
        } else {
          console.error('User not found:', userId);
          res.sendStatus(404);
        }
      });
    } else {
      // Clear the session cookie and redirect to the login page
      res.clearCookie('sessionId');
      res.redirect('/index.html');
    }
  });
});

app.get('/profile', (req, res) => {
  // Assuming you have a way to identify the currently logged-in user
  const sessionId = req.cookies.sessionId;

  db.get('SELECT * FROM sessions WHERE sessionId = ?', [sessionId], (err, row) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.sendStatus(500);
    }

    if (row) {
      const userId = row.userId;

      // Find the user with the matching ID in the SQLite database
      db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, row) => {
        if (err) {
          console.error('Error querying database:', err.message);
          return res.sendStatus(500);
        }

        if (row) {
          // Render the profile page and pass the user data to the template
          res.render('profile', { user: row });
        } else {
          console.error('User not found:', userId);
          res.sendStatus(404);
        }
      });
    } else {
      // Clear the session cookie and redirect to the login page
      res.clearCookie('sessionId');
      res.redirect('/index.html');
    }
  });
});



app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, '/../client/views/about-us.html'));
});


const multer = require('multer');

// Set up the Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'profile-images'); // Specify the directory to save the uploaded images
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = file.originalname.split('.').pop();
    cb(null, 'profile-' + uniqueSuffix + '.' + fileExtension); // Generate a unique filename for the uploaded image
  }
});

// Create a Multer instance with the storage configuration
const upload = multer({ storage: storage });

app.post('/update-profile', upload.single('profileImage'), (req, res) => {
  // Assuming you have a way to identify the currently logged-in user
  const sessionId = req.cookies.sessionId;

  db.get('SELECT * FROM sessions WHERE sessionId = ?', [sessionId], (err, session) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.sendStatus(500);
    }

    if (session && session.userId) {
      const userId = session.userId;

      // Get the updated profile information from the request body
      const { name, email, phone } = req.body;

      // If a file was uploaded, update the profile image path
      const profileImage = req.file ? req.file.filename : null;

      // Update the user profile in the SQLite database
      db.run(
        'UPDATE users SET name = ?, email = ?, phone = ?, profileImage = ? WHERE userId = ?',
        [name, email, phone, profileImage, userId],
        (err) => {
          if (err) {
            console.error('Error updating user profile:', err.message);
            res.sendStatus(500);
            return;
          }

          // Send a success response
          res.redirect('/profile?success=true');

          // Send an email to the user to confirm the profile update
          const updateMailOptions = {
            from: 'hamiconfectionery@gmail.com',
            to: email,
            subject: 'Profile Update Confirmation',
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
                    <h1>Profile Update Confirmation</h1>
                    <p>Your profile has been successfully updated.</p>
                    <p>Here are your updated profile details:</p>
                    <ul>
                      <li><strong>Name:</strong> ${name}</li>
                      <li><strong>Email:</strong> ${email}</li>
                      <li><strong>Phone:</strong> ${phone}</li>
                    </ul>
                  </div>
                </body>
              </html>
            `
          };

          transporter.sendMail(updateMailOptions, (error, info) => {
            if (error) {
              console.error('Error sending profile update email:', error);
            } else {
              console.log('Profile update email sent:', info.response);
            }
          });
        }
      );
    } else {
      res.sendStatus(401); // Unauthorized access
    }
  });
});


app.post('/logout', (req, res) => {
  const sessionId = req.cookies.sessionId;

  db.get('SELECT * FROM sessions WHERE sessionId = ?', [sessionId], (err, session) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.sendStatus(500);
    }

    if (session && session.userId) {
      const userId = session.userId;
      const email = session.email;

      // Check if the user exists in the database
      db.get('SELECT * FROM users WHERE userId = ? AND email = ?', [userId, email], (err, user) => {
        if (err) {
          console.error('Error checking user existence:', err);
          return res.send('Error logging out');
        }

        if (user) {
          // User exists, proceed with order deletion
          db.run('DELETE FROM orders WHERE userId = ?', [userId], (err) => {
            if (err) {
              console.error('Error deleting order:', err.message);
            } else {
              console.log('User order deleted successfully');
            }
          });
        } else {
          console.log('User not found:', userId);
        }

        // Delete the session from the sessions table
        db.run('DELETE FROM sessions WHERE sessionId = ?', [sessionId], (err) => {
          if (err) {
            console.error('Error deleting session:', err.message);
            return res.sendStatus(500);
          }

          // Clear session cookie and redirect to the index page
          res.clearCookie('sessionId');
          res.redirect('/index.html');
        });
      });
    } else {
      // Session or userId is not available
      console.log('Invalid session or user ID');
      res.send('Error logging out');
    }
  });
});


// app.post('/logout', (req, res) => {
//   const sessionId = req.cookies.sessionId;

//   db.get('SELECT * FROM sessions WHERE sessionId = ?', [sessionId], (err, session) => {
//     if (err) {
//       console.error('Error querying database:', err.message);
//       return res.sendStatus(500);
//     }

//     if (session && session.userId) {
//       const userId = session.userId;

//       // Check if the user exists in the database
//       db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, user) => {
//         if (err) {
//           console.error('Error checking user existence:', err);
//           res.send('Error logging out');
//         } else if (user) {
//           // User exists, proceed with order deletion
//           db.run('DELETE FROM orders WHERE userId = ?', [userId], (err) => {
//             if (err) {
//               console.error('Error deleting order:', err.message);
//             } else {
//               console.log('User order deleted successfully');
//             }
//           });
//         } else {
//           console.log('User not found:', userId);
//         }

//         // Delete the session from the sessions table
//         db.run('DELETE FROM sessions WHERE sessionId = ?', [sessionId], (err) => {
//           if (err) {
//             console.error('Error deleting session:', err.message);
//             return res.sendStatus(500);
//           }

//           // Clear session cookie and redirect to the index page
//           res.clearCookie('sessionId');
//           res.redirect('/index.html');
//         });
//       });
//     } else {
//       // Session or userId is not available
//       console.log('Invalid session or user ID');
//       res.send('Error logging out');
//     }
//   });
// });



// app.post('/logout', (req, res) => {
//   const sessionId = req.cookies.sessionId;

//   db.get('SELECT * FROM sessions WHERE sessionId = ?', [sessionId], (err, session) => {
//     if (err) {
//       console.error('Error querying database:', err.message);
//       return res.sendStatus(500);
//     }

//     if (session && session.userId) {
//       const userId = session.userId;

//       // Check if the user exists in the database
//       db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, user) => {
//         if (err) {
//           console.error('Error checking user existence:', err);
//           res.send('Error logging out');
//         } else if (user) {
//           // User exists, proceed with order deletion
//           const orderFilePath = path.join(__dirname, 'orders', `${userId}.json`);
//           fs.unlink(orderFilePath, (error) => {
//             if (error) {
//               console.error('Error deleting order file:', error);
//             } else {
//               console.log('User order deleted successfully');
//             }

//             // Delete the session from the sessions table
//             db.run('DELETE FROM sessions WHERE sessionId = ?', [sessionId], (err) => {
//               if (err) {
//                 console.error('Error deleting session:', err.message);
//                 return res.sendStatus(500);
//               }

//               // Clear session cookie and redirect to the index page
//               res.clearCookie('sessionId');
//               res.redirect('/index.html');
//             });
//           });
//         } else {
//           console.log('User not found:', userId);

//           // Delete the session from the sessions table even if the user is not found
//           db.run('DELETE FROM sessions WHERE sessionId = ?', [sessionId], (err) => {
//             if (err) {
//               console.error('Error deleting session:', err.message);
//               return res.sendStatus(500);
//             }

//             // Clear session cookie and redirect to the index page
//             res.clearCookie('sessionId');
//             res.redirect('/index.html');
//           });
//         }
//       });
//     } else {
//       // Session or userId is not available
//       console.log('Invalid session or user ID');
//       res.send('Error logging out');
//     }
//   });
// });






app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hami Confectionery</title>
    // <link href="https://fonts.googleapis.com/css?family=Roboto|Open+Sans:200,300,400,700,800,900&subset=latin" rel="stylesheet">
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
        <a class="footer-link" href="/privacy-policy">Privacy Policy</a>
        <a class="footer-link" href="/terms-of-service">Terms of Service</a>
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

  db.get('SELECT * FROM sessions WHERE sessionId = ?', [sessionId], (err, session) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }

    if (!session || !session.userId) {
      // Handle the case where the user is not logged in
      return res.status(401).json({ status: 'error', message: 'User not authenticated' });
    }

    const userId = session.userId;

    // Check if the user exists in the database
    db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, user) => {
      if (err) {
        console.error('Error checking user existence:', err.message);
        return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
      }

      if (!user) {
        console.error('User not found:', userId);
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      // Check if the user's profile is complete
      if (!user.phone || !user.profileImage) {
        return res.status(403).json({ status: 'error', message: 'Please update your profile information before placing an order.' });
      }

      // Insert the cart item into the orders table
      const query = 'INSERT INTO orders (userId, itemId, name, price, quantity, imageUrl, addedTime) VALUES (?, ?, ?, ?, ?, ?, ?)';
      const values = [userId, cartItem.itemId, cartItem.name, cartItem.price, cartItem.quantity, cartItem.imageUrl, Date.now()];
      db.run(query, values, function (err) {
        if (err) {
          console.error('Error adding item to cart:', err.message);
          return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
        }

        res.json({ status: 'success', message: 'Item added to cart', data: { itemId: cartItem.itemId } });
      });
    });
  });
});


app.get('/cart-count', (req, res) => {
  const sessionId = req.cookies.sessionId;

  db.get('SELECT * FROM sessions WHERE sessionId = ?', [sessionId], (err, session) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.sendStatus(500);
    }

    if (session && session.userId) {
      const userId = session.userId;
      const query = 'SELECT COUNT(*) AS count FROM orders WHERE userId = ?';
      db.get(query, [userId], (err, result) => {
        if (err) {
          console.error('Error retrieving cart count:', err.message);
          res.sendStatus(500);
        } else {
          const cartCount = result.count || 0;
          res.json({ count: cartCount });
        }
      });
    } else {
      res.json({ count: 0 }); // Return count as 0 if the user is not logged in or has no items in the cart
    }
  });
});


app.get('/order', (req, res) => {
  const sessionId = req.cookies.sessionId;

  db.get('SELECT * FROM sessions WHERE sessionId = ?', [sessionId], (err, session) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.sendStatus(500);
    }

    if (!session || !session.userId) {
      return res.redirect('/index.html');
    }

    const userId = session.userId;
    const currentTime = Date.now();
    const query = 'SELECT * FROM orders WHERE userId = ? AND addedTime >= ?';
    const timeThreshold = currentTime - (3 * 60 * 60 * 1000); // 3 hours in milliseconds

    db.all(query, [userId, timeThreshold], (err, rows) => {
      if (err) {
        console.error('Error retrieving order data:', err.message);
        return res.sendStatus(500);
      }

      res.render('order', { cartItems: rows });
    });
  });
});


app.post('/delete-from-cart', (req, res) => {
  const sessionId = req.cookies.sessionId;

  db.get('SELECT * FROM sessions WHERE sessionId = ?', [sessionId], (err, session) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.sendStatus(500);
    }

    if (session && session.userId) {
      const userId = session.userId;
      const itemId = req.body.itemId;

      const query = 'DELETE FROM orders WHERE userId = ? AND itemId = ?';
      const values = [userId, itemId];
      db.run(query, values, function (err) {
        if (err) {
          console.error('Error deleting item from cart:', err.message);
          res.sendStatus(500);
        } else if (this.changes > 0) {
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

  db.get('SELECT * FROM sessions WHERE sessionId = ?', [sessionId], (err, session) => {
    if (err) {
      console.error('Error retrieving session from the database:', err);
      res.redirect('/index.html');
      return;
    }

    console.log('Session ID from cookie:', sessionId);

    if (session && session.userId && session.email) {
      const userId = session.userId;

      console.log('User ID:', userId);

      db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, user) => {
        if (err) {
          console.error('Error retrieving user data from the database:', err);
          res.redirect('/index.html');
          return;
        }

        console.log('User:', user);

        if (session.sessionId !== sessionId) {
          console.error('Session ID mismatch');
          res.redirect('/login');
          return;
        }

        if (!user || user.email !== session.email) {
          console.error('User authentication failed');
          res.redirect('/login');
          return;
        }

        console.log('Database connected:', db);
        console.log('User ID:', userId);

        db.all('SELECT * FROM orders WHERE userId = ?', [userId], (err, orderData) => {
          if (err) {
            console.error('Error retrieving order data from the database:', err);
            res.redirect('/index.html');
            return;
          }

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


app.post('/submit-payment-proof', upload.single('paymentProof'), (req, res) => {
  const sessionId = req.cookies.sessionId;

  db.get('SELECT * FROM sessions WHERE sessionId = ?', [sessionId], (err, session) => {
    if (err) {
      console.error('Error retrieving session from the database:', err);
      res.redirect('/index.html');
      return;
    }

    if (session && session.userId) {
      const userId = session.userId;
      const userEmail = session.email;

      db.all('SELECT * FROM orders WHERE userId = ?', [userId], (err, orderData) => {
        if (err) {
          console.error('Error retrieving order data from the database:', err);
          res.redirect('/index.html');
          return;
        }

        const { items, quantity, itemId, itemImage, total, deliveryTime } = req.body;

        console.log('Payment proof submitted:', req.file);
        console.log('User Email:', userEmail);
        console.log('Order Items:', items);
        console.log('Quantity:', quantity);
        console.log('Item IDs:', itemId);
        console.log('Item Images:', itemImage);
        console.log('Total:', total);
        console.log('Delivery Time:', deliveryTime);

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
                        (item, index) => `
                          <li>
                            <h3>${item}</h3>
                            <p>Quantity: ${quantity[index]}</p>
                            <p>ItemId: ${itemId[index]}</p>
                            <img src="${baseUrl}${item.imageUrl}" alt="Item Image" />
                          </li>
                        `
                      )
                      .join('')}
                  </ul>
                  <p>Total: $${total}</p>
                  <p>Delivery Time: ${deliveryTime}</p>
                  <p>We will deliver your order as soon as possible. If you have any questions, please contact us.</p>
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
                        (item, index) => `
                          <li>
                            <h3>${item}</h3>
                            <p>Quantity: ${quantity[index]}</p>
                            <p>ItemId: ${itemId[index]}</p>
                            <img src="${baseUrl}${item.imageUrl}" alt="Item Image" />
                          </li>
                        `
                      )
                      .join('')}
                  </ul>
                  <p>Total: $${total}</p>
                  <p>Delivery Time: ${deliveryTime}</p>
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
              content: fs.createReadStream(req.file.path),
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
                <a class="button" href="/dashboard.html">Continue</a>
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
