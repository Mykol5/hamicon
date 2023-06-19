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

// const sqlite3 = require('sqlite3').verbose();
// const db = new sqlite3.Database('./database.db');

db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, password TEXT)');

const app = express();
const port = 8080;


app.use(express.static(path.join(__dirname, 'client'), {
  etag: false,
  maxAge: 0,
  lastModified: false,
  cacheControl: false,
  extensions: ['html', 'css', 'js', 'jpeg', 'png', 'mp4']
}));

app.get('/images/:filename', (req, res) => {
  const filePath = path.join(__dirname, '..', 'client', 'images', req.params.filename);
  // console.log('filePath:', filePath);
  const contentType = getContentType(filePath);
  res.set('Content-Type', contentType);
  res.sendFile(filePath);
  // const contentType = getContentType(filePath);
  // res.set('Content-Type', contentType);
  // res.sendFile(path.join(__dirname + '/../client/images'));
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


// Use express-session middleware
app.use(session({
  secret: 'mysecretkey',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 3600000, // Set the maximum age (in milliseconds) for the session cookie
    // Additional cookie options can be added here
  },
  unset: 'destroy', // Clear the session data on expiration
  rolling: true, // Extend the session expiration on each request
}));


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

      // Redirect the user to the login page
      res.redirect('/index.html');
    });
    
  });
});
});

const sessions = {};

app.get('/index.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname + '/../client/index.html'));
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Find the user with the matching email in the SQLite database
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error('Error querying database:', err.message);
      res.sendStatus(500);
      return;
    }

    if (row) {
      // Check if the user's credentials are correct
      bcrypt.compare(password, row.password, (bcryptErr, result) => {
        if (bcryptErr) {
          console.error('Error comparing passwords:', bcryptErr);
          res.sendStatus(500);
          return;
        }

        if (result) {
          // Generate a session ID and update the session data
          const sessionId = uuidv4();
          console.log('Generated session ID:', sessionId);

          // Update the last login time for the user in the SQLite database
          const loginTime = Date.now();
          db.run('UPDATE users SET lastLoginTime = ? WHERE email = ?', [loginTime, email], (updateErr) => {
            if (updateErr) {
              console.error('Error updating last login time:', updateErr.message);
              res.sendStatus(500);
              return;
            }

            // Assign the userId value to the session
            const userId = row.userId; // Update the column name if necessary

            // Update the user's session entry in the sessions table
// Save the session data to the sessions table
db.run(
  'INSERT INTO sessions (sessionId, userId, email, data) VALUES (?, ?, ?, ?)',
  [sessionId, userId, email, JSON.stringify(session)],
  (err) => {
    if (err) {
      console.error('Error saving session data:', err);
    } else {
      console.log('Session data saved successfully');
    }




                // Create a session for the user
                sessions[sessionId] = {
                  userId: row.userId,
                  name: row.name,
                  email: row.email,
                  isNewUser: !row.lastLoginTime,
                };

                console.log('Session from sessions object:', sessions[sessionId]);
                console.log('Session ID from cookie:', req.cookies.sessionId);

                // Set the sessionId cookie
                res.cookie('sessionId', sessionId, {
                  maxAge: 3600000, // Set the maximum age (in milliseconds) for the session cookie
                  // Additional cookie options can be added here
                });

                // Redirect to the dashboard page
                console.log('Redirecting to dashboard...');
                res.redirect('/dashboard.html');
              }
            );
          });
        } else {
          // If the credentials are incorrect, show an error message
          res.send('Invalid email or password');
        }
      });
    } else {
      // If the user is not found, show an error message
      res.send('User not found');
    }
  });
});

app.get('/dashboard.html', (req, res) => {
  // Assuming you have a way to identify the currently logged-in user
  const sessionId = req.cookies.sessionId;
  console.log('Session ID from cookie:', sessionId);

  const session = sessions[sessionId];
  console.log('Session from sessions object:', session);

  if (session && session.userId) {
    const userId = session.userId;

    // Find the user with the matching ID in the SQLite database
    db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, row) => {
      if (err) {
        console.error('Error querying database:', err.message);
        res.sendStatus(500);
        return;
      }

      if (row) {
        // Determine if the pop-up should be shown based on the session's isNewUser flag
        const shouldShowPopup = session.isNewUser;

        // Determine the notification message based on whether the user is a new user or an existing user
        let notificationMessage;
        if (shouldShowPopup) {
          notificationMessage = `<p><strong>Welcome to Hami Confectionery, ${row.name}!</strong></p> This is your first login, go and complete your KYC in the Profile section. <p>We are here to serve you better.</p>`;
        } else {
          notificationMessage = `<p><strong>Welcome back, ${row.name}!</strong></p> Our services run from 08:00 - 18:00, Mondays - Saturdays. <p>You can reach us via Call/Chat 08145336427.</p>`;
        }

        // Update the isNewUser flag to false for the current session
        session.isNewUser = false;

        // Render the dashboard page and pass the user, username, notificationMessage, and shouldShowPopup to the template
        res.render('dashboard', { user: row, username: row.name, notificationMessage, shouldShowPopup });
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


app.get('/profile', (req, res) => {
  // Assuming you have a way to identify the currently logged-in user
  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];

  if (session && session.userId) {
    const userId = session.userId;

    // Find the user with the matching ID in the SQLite database
    db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, row) => {
      if (err) {
        console.error('Error querying database:', err.message);
        res.sendStatus(500);
        return;
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
  const session = sessions[sessionId];

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


app.post('/logout', (req, res) => {
  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];

  if (session && session.userId) {
    const userId = session.userId;

    // Check if the user exists in the database
    db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, user) => {
      if (err) {
        console.error('Error checking user existence:', err);
        res.send('Error logging out');
      } else if (user) {
        // User exists, proceed with order deletion
        const orderFilePath = path.join(__dirname, 'orders', `${userId}.json`);
        try {
          fs.unlinkSync(orderFilePath);
          console.log('User order deleted successfully');
        } catch (error) {
          console.error('Error deleting order file:', error);
        }
      } else {
        console.log('User not found:', userId);
      }

      // Clear session and redirect to index page
      req.session.destroy(err => {
        if (err) {
          console.log(err);
          res.send('Error logging out');
        } else {
          res.clearCookie('sessionId');
          res.redirect('/index.html');
        }
      });
    });
  } else {
    // Session or userId is not available
    console.log('Invalid session or user ID');
    res.send('Error logging out');
  }
});


app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hami Confectionery</title>
    <link href="https://fonts.googleapis.com/css?family=Roboto|Open+Sans:200,300,400,700,800,900&subset=latin"
      rel="stylesheet">
    <style>
      /* Global Styles */
      body {
        margin: 0;
        padding: 0;
        font-family: 'Roboto', 'Open Sans', sans-serif;
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
      margin-bottom: 10px;
    }
  
    .service-card-title {
      font-size: 1.5em;
      margin-bottom: 10px;
    }
  
    .service-card-description {
      font-size: 1em;
      color: #666;
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
        <a class="navbar-link" href="/">About</a>
        <a class="navbar-link" href="/">Contact</a>
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
        <img class="service-card-icon" src="/images/service-icon-1.png" alt="Service 1 Icon">
        <h3 class="service-card-title">Service 1</h3>
        <p class="service-card-description">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
      </div>
      <div class="service-card">
        <img class="service-card-icon" src="/images/service-icon-2.png" alt="Service 2 Icon">
        <h3 class="service-card-title">Service 2</h3>
        <p class="service-card-description">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
      </div>
      <div class="service-card">
        <img class="service-card-icon" src="/images/service-icon-3.png" alt="Service 3 Icon">
        <h3 class="service-card-title">Service 3</h3>
        <p class="service-card-description">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
      </div>
    </section>
  
    <section class="testimonials-section">
      <div class="testimonial-slide active">
        <p>"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis semper sapien a nisi laoreet congue. Nam non
          hendrerit tellus."</p>
        <span>- John Doe</span>
      </div>
      <div class="testimonial-slide">
        <p>"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis semper sapien a nisi laoreet congue. Nam non
          hendrerit tellus."</p>
        <span>- Jane Smith</span>
      </div>
      <div class="testimonial-slide">
        <p>"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis semper sapien a nisi laoreet congue. Nam non
          hendrerit tellus."</p>
        <span>- David Johnson</span>
      </div>
    </section>
  
    <footer class="footer">
      <div class="footer-icons">
        <a class="footer-icon" href="https://www.whatsapp.com"><img src="/images/whatsapp-icon.png" alt="WhatsApp Icon"></a>
        <a class="footer-icon" href="mailto:info@hamiconfectionery.com"><img src="/images/email-icon.png" alt="Email Icon"></a>
        <a class="footer-icon" href="https://www.instagram.com/hamiconfectionery"><img src="/images/instagram-icon.png" alt="Instagram Icon"></a>
        <a class="footer-icon" href="https://www.facebook.com/hamiconfectionery"><img src="/images/facebook-icon.png" alt="Facebook Icon"></a>
      </div>
      <div class="footer-links">
        <a class="footer-link" href="/privacy-policy">Privacy Policy</a>
        <a class="footer-link" href="/terms-of-service">Terms of Service</a>
      </div>
      <p>&copy; 2023 Hami Confectionery. All rights reserved.</p>
      <p>123 Main Street, City, Country</p>
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
app.use(bodyParser.json());


app.post('/add-to-cart', (req, res) => {
  const cartItem = req.body;
  console.log('Received cart item:', cartItem);

  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];
  if (!session || !session.userId) {
    // Handle the case where the user is not logged in
    return res.status(401).json({ status: 'error', message: 'User not authenticated' });
  }

  const userId = session.userId;

  // Check if the user exists in the database
  db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, user) => {
    if (err) {
      console.error('Error checking user existence:', err);
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
        console.error('Error adding item to cart:', err);
        return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
      }

      res.json({ status: 'success', message: 'Item added to cart', data: { itemId: cartItem.itemId } });
    });
  });
});




app.get('/cart-count', (req, res) => {
  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];

  if (session && session.userId) {
    const userId = session.userId;
    const query = 'SELECT COUNT(*) AS count FROM orders WHERE userId = ?';
    db.get(query, [userId], (err, result) => {
      if (err) {
        console.error('Error retrieving cart count:', err);
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


app.get('/order', (req, res) => {
  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];
  
  if (!session || !session.userId) {
    return res.redirect('/index.html');
  }

  const userId = session.userId;
  const currentTime = Date.now();
  const query = 'SELECT * FROM orders WHERE userId = ? AND addedTime >= ?';
  const timeThreshold = currentTime - (3 * 60 * 60 * 1000); // 3 hours in milliseconds

  db.all(query, [userId, timeThreshold], (err, rows) => {
    if (err) {
      console.error('Error retrieving order data:', err);
      return res.sendStatus(500);
    }

    res.render('order', { cartItems: rows });
  });
});


app.post('/delete-from-cart', (req, res) => {
  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];

  if (session && session.userId) {
    const userId = session.userId;
    const itemId = req.body.itemId;

    const query = 'DELETE FROM orders WHERE userId = ? AND itemId = ?';
    const values = [userId, itemId];
    db.run(query, values, function (err) {
      if (err) {
        console.error('Error deleting item from cart:', err);
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


app.get('/payment', (req, res) => {
  const sessionId = req.cookies.sessionId;

  console.log('Session ID:', sessionId);

  // Retrieve the session from the SQLite database using the session ID
  db.get('SELECT * FROM sessions WHERE sessionId = ?', sessionId, (err, session) => {
    if (err) {
      console.error('Error retrieving session from the database:', err);
      res.redirect('/index.html');
      return;
    }

    console.log('Session ID from cookie:', sessionId);
    console.log('Session from sessions object:', session);

    if (session && session.userId && session.email) {
      const userId = session.userId;

      console.log('User ID:', userId);

      // Retrieve the user data from the users table
      db.get('SELECT * FROM users WHERE userId = ?', userId, (err, user) => {
        if (err) {
          console.error('Error retrieving user data from the database:', err);
          res.redirect('/index.html');
          return;
        }

        console.log('User:', user);

        // Check if the session ID matches the one stored in the session cookie
        if (session.sessionId !== sessionId) {
          console.error('Session ID mismatch');
          res.redirect('/login');
          return;
        }

        // Check if the user's email matches the one stored in the users table
        if (!user || user.email !== session.email) {
          console.error('User authentication failed');
          res.redirect('/login');
          return;
        }

        console.log('Database connected:', db);
        console.log('User ID:', userId);

        // User is authenticated, continue processing the payment

        // Retrieve the order data for the user from the orders table
        db.all('SELECT * FROM orders WHERE userId = ?', userId, (err, orderData) => {
          if (err) {
            console.error('Error retrieving order data from the database:', err);
            res.redirect('/index.html');
            return;
          }

          console.log('Order Data:', orderData);

          // Calculate the total price based on the order items
          const totalPrice = orderData.reduce((total, item) => total + item.price * item.quantity, 0);

          console.log('Total Price:', totalPrice);

          res.render('payment', { cartItems: orderData, totalPrice }); // Pass order data and total price to the payment page
        });
      });
    } else {
      // Session or user not found, redirect to the login page
      res.redirect('/login');
    }
  });
});


// Handle the POST request for processing the payment
app.post('/process-payment', (req, res) => {
  const { cardNumber, cardHolder, expiryDate, cvv } = req.body;
  // Process the payment here

  // Assuming the payment is successful, redirect the user to a success page
  res.redirect('/payment-success');
});


// Handle the POST request for submitting the payment proof
app.post('/submit-payment-proof', upload.single('paymentProof'), (req, res) => {
  const sessionId = req.cookies.sessionId;

  // Retrieve the session from the SQLite database using the session ID
  db.get('SELECT * FROM sessions WHERE sessionId = ?', sessionId, (err, session) => {
    if (err) {
      console.error('Error retrieving session from the database:', err);
      res.redirect('/index.html');
      return;
    }

    if (session && session.userId) {
      const userId = session.userId;
      const userEmail = session.email;

      // Retrieve the order data for the user from the orders table
      db.all('SELECT * FROM orders WHERE userId = ?', userId, (err, orderData) => {
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

        // Process the payment proof submission and perform necessary actions (e.g., save payment proof file)

        const baseUrl = 'https://hamcon.onrender.com';

        // Send confirmation email to the user
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

        // Send notification email to the admin
        const adminNotificationMailOptions = {
          from: 'hamiconfectionery@gmail.com',
          to: 'michaelkolawole25@gmail.com', // Replace with the admin's email address
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
                  <img src="cid:paymentProof" alt="Payment Proof Image" /> <!-- Use 'cid' for embedding the image -->
                </div>
              </body>
            </html>
          `,
          attachments: [
            {
              filename: req.file.originalname,
              content: fs.createReadStream(req.file.path),
              cid: 'paymentProof', // Use the same 'cid' as in the img src attribute
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
                  display: block; /* Add this line to make the button a block-level element */
                  width: 100px; /* Adjust the width as needed */
                  margin: 0 auto; /* Add this line to center the button horizontally */
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



app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});