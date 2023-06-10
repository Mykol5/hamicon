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

const app = express();
const port = 8080;


const userFilePath = path.join(__dirname, 'users.json');

function readUserDetails() {
  try {
    const userData = fs.readFileSync(userFilePath, 'utf8');
    return JSON.parse(userData);
  } catch (error) {
    console.error('Error reading user details:', error);
    return {}; // Return an empty object if there's an error or the file is empty
  }
}

function writeUserDetails(user) {
  try {
    const userData = JSON.stringify(user, null, 2);
    fs.writeFileSync(userFilePath, userData, 'utf8');
    console.log('User details updated successfully.');
  } catch (error) {
    console.error('Error writing user details:', error);
  }
}

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
  console.log('POST request received');
  const { name, email, password } = req.body;

  // Validate the input (e.g., check if email is valid and password is strong enough)

  // Hash the password for security
  bcrypt.hash(password, 10, (err, hash) => {
    // Check if the users.json file exists, and create it if it doesn't
    if (!fs.existsSync('users.json')) {
      fs.writeFileSync('users.json', '[]');
    }

    // Generate a unique userId for the new user
    const userId = uuidv4();

    // Create a new user object
    const user = {
      userId: userId,
      name: name,
      email: email,
      password: hash
    };

    // Read the existing users from the JSON file
    const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
    // Add the new user to the array
    users.push(user);
    // Write the updated users array back to the JSON file
    fs.writeFileSync('users.json', JSON.stringify(users));

    // Send the welcome email to the user
    const welcomeMailOptions = {
      from: 'hamiconfectionery@gmail.com',
      to: email,
      subject: 'Welcome to Hami Confectionery!',
      text: `Welcome to Hami Confectionery! We provide the best services in pastries and cuisines.

      Thank you for signing up. Your login details are:
      Email: ${email}
      Password: ${password}`
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


const sessions = {};

app.get('/index.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname + '/../client/index.html'));
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));

  // Find the user with the matching email in the JSON file
  const user = users.find((user) => user.email === email);

  const loginTime = Date.now();
  req.session.loginTime = loginTime;

  if (user) {
    // Check if the user's credentials are correct
    bcrypt.compare(password, user.password, (err, result) => {
      if (result) {
        // Generate a session ID
        const sessionId = uuidv4();
        console.log('Generated session ID:', sessionId);

        // Verify the presence and value of the name property
        console.log('User object:', user);
        console.log('Name:', user.name);

        // Check if the user is a new user (first login)
        const isNewUser = !user.lastLoginTime;

        if (isNewUser) {
          // Update the last login time for the user if it's a new user
          user.lastLoginTime = loginTime;

          // Update the users.json file with the updated user data
          fs.writeFileSync('users.json', JSON.stringify(users));
        }

        // Associate the session ID with the user's session data
        sessions[sessionId] = {
          userId: user.userId,
          name: user.name,
          email: user.email,
          isNewUser,
        };

        // Set the session ID as a cookie
        res.cookie('sessionId', sessionId, { httpOnly: true });

        // Set the email as a separate cookie
        res.cookie('email', user.email, { httpOnly: true });

        // Redirect the user to the dashboard page
        console.log('Redirecting to dashboard...');
        res.redirect('/dashboard.html');
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

app.get('/dashboard.html', (req, res) => {
  // Assuming you have a way to identify the currently logged-in user
  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];

  if (session && session.userId) {
    const userId = session.userId;

    // Read the contents of the users.json file
    fs.readFile('users.json', 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading users.json:', err);
        res.sendStatus(500);
        return;
      }

      // Parse the JSON data into an array of user objects
      const users = JSON.parse(data);

      // Find the user with the matching ID
      const user = users.find(u => u.userId === userId);

      if (!user) {
        console.error('User not found:', userId);
        res.sendStatus(404);
        return;
      }

      // Retrieve the notification message based on whether the user is a new user or an old user
      let notificationMessage;
      if (session.isNewUser) {
        notificationMessage = `<p><strong>Welcome to Hami Confectionery, ${user.name}!</strong></p> This is your first login, go and complete your KYC in the Profile section. <p>We are here to serve you better.</p>`;
      } else {
        notificationMessage = `<p><strong>Welcome back, ${user.name}!</strong></p> Our services runs from 08:00 - 18:00 Mondays - Saturdays. <p>You can reach us via Call/Chat 08145336427.</p>`;
      }

      // Render the dashboard page and pass the user and notification message to the template
      res.render('dashboard', { user, username: user.name, notificationMessage });
    });
  } else {
    // Clear the session cookie and redirect to the login page
    res.clearCookie('sessionId');
    res.redirect('/index.html');
  }
});


// app.post('/login', (req, res) => {
//   const { email, password } = req.body;

//   const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  
//   // Find the user with the matching email in the JSON file
//   const user = users.find((user) => user.email === email);

//   const loginTime = Date.now();
//   req.session.loginTime = loginTime;

//   if (user) {
//     // Check if the user's credentials are correct
//     bcrypt.compare(password, user.password, (err, result) => {
//       if (result) {
//         // Generate a session ID
//         const sessionId = uuidv4();
//         console.log('Generated session ID:', sessionId);

//         // Verify the presence and value of the name property
//         console.log('User object:', user);
//         console.log('Name:', user.name);

//         // Associate the session ID with the user's session data
//         sessions[sessionId] = {
//           userId: user.userId,
//           name: user.name, // Include the name property
//           email: user.email,
//         };

//         // Set the session ID as a cookie
//         res.cookie('sessionId', sessionId, { httpOnly: true });

//         // Set the email as a separate cookie
//         res.cookie('email', user.email, { httpOnly: true });

//         // Set the notification message based on whether the user is new or returning
//         const isFirstLogin = !user.lastLoginTime;
//         const notificationMessage = isFirstLogin ? "Welcome to Hami Confectionery, we are here to serve you better. Our working hours are 08:00 - 15:00" : "Welcome back!";

//         // Redirect the user to the dashboard page and pass the notification message as a query parameter
//         res.redirect(`/dashboard.html?notification=${encodeURIComponent(notificationMessage)}`);
//       } else {
//         // If the credentials are incorrect, show an error message
//         res.send('Invalid email or password');
//       }
//     });
//   } else {
//     // If the user is not found, show an error message
//     res.send('User not found');
//   }
// });

// app.get('/dashboard.html', (req, res) => {
//   // Assuming you have a way to identify the currently logged-in user
//   const sessionId = req.cookies.sessionId;
//   const session = sessions[sessionId];

//   if (session && session.userId) {
//     const userId = session.userId;

//     // Read the contents of the users.json file
//     fs.readFile('users.json', 'utf8', (err, data) => {
//       if (err) {
//         console.error('Error reading users.json:', err);
//         res.sendStatus(500);
//         return;
//       }

//       // Parse the JSON data into an array of user objects
//       const users = JSON.parse(data);

//       // Find the user with the matching ID
//       const user = users.find(u => u.userId === userId);

//       if (!user) {
//         console.error('User not found:', userId);
//         res.sendStatus(404);
//         return;
//       }

//       // Retrieve the notification message from the query parameters
//       const notificationMessage = req.query.notification;

//       res.render('dashboard', { user, username: user.name, notificationMessage });
//     });
//   } else {
//     // Clear the session cookie and redirect to the login page
//     res.clearCookie('sessionId');
//     res.redirect('/index.html');
//   }
// });



app.get('/profile', (req, res) => {
  // Assuming you have a way to identify the currently logged-in user
  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];

  if (session && session.userId) {
    const userId = session.userId;

  // Read the contents of the users.json file
  fs.readFile('users.json', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading users.json:', err);
      res.sendStatus(500);
      return;
    }

    // Parse the JSON data into an array of user objects
    const users = JSON.parse(data);

    // Find the user with the matching ID
    const user = users.find(u => u.userId === userId);

    if (!user) {
      console.error('User not found:', userId);
      res.sendStatus(404);
      return;
    }
  
    res.render('profile', { user });
  });
}});


app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, '/../client/views/about-us.html'));
});

// app.post('/update-profile', (req, res) => {
//   // Assuming you have a way to identify the currently logged-in user
//   const sessionId = req.cookies.sessionId;
//   const session = sessions[sessionId];

//   if (session && session.userId) {
//     const userId = session.userId;

//     // Read the contents of the users.json file
//     fs.readFile('users.json', 'utf8', (err, data) => {
//       if (err) {
//         console.error('Error reading users.json:', err);
//         res.sendStatus(500);
//         return;
//       }

//       // Parse the JSON data into an array of user objects
//       let users = JSON.parse(data);

//       // Find the index of the user with the matching ID
//       const userIndex = users.findIndex(u => u.userId === userId);

//       if (userIndex === -1) {
//         console.error('User not found:', userId);
//         res.sendStatus(404);
//         return;
//       }

//       // Get the updated profile information from the request body
//       const { name, email, phone } = req.body;

//       // Update the user object with the new information
//       users[userIndex].name = name;
//       users[userIndex].email = email;
//       users[userIndex].phone = phone;

//       // Save the updated user data back to the users.json file
//       fs.writeFile('users.json', JSON.stringify(users), 'utf8', (err) => {
//         if (err) {
//           console.error('Error writing to users.json:', err);
//           res.sendStatus(500);
//           return;
//         }

//         // Redirect to the profile page with the success parameter
//         res.redirect('/profile?success=true');
//       });
//     });
//   } else {
//     res.sendStatus(401); // Unauthorized access
//   }
// });


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

    // Read the contents of the users.json file
    fs.readFile('users.json', 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading users.json:', err);
        res.sendStatus(500);
        return;
      }

      // Parse the JSON data into an array of user objects
      let users = JSON.parse(data);

      // Find the index of the user with the matching ID
      const userIndex = users.findIndex(u => u.userId === userId);

      if (userIndex === -1) {
        console.error('User not found:', userId);
        res.sendStatus(404);
        return;
      }

      // Get the updated profile information from the request body
      const { name, email, phone } = req.body;

      // Update the user object with the new information
      users[userIndex].name = name;
      users[userIndex].email = email;
      users[userIndex].phone = phone;
      // If a file was uploaded, update the profile image path
      if (req.file) {
        users[userIndex].profileImage = req.file.filename;
      }

      // Save the updated user data back to the users.json file
      fs.writeFile('users.json', JSON.stringify(users), 'utf8', (err) => {
        if (err) {
          console.error('Error writing to users.json:', err);
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
      });
    });
  } else {
    res.sendStatus(401); // Unauthorized access
  }
});



// 
app.post('/logout', (req, res) => {
  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];

  if (session && session.userId) {
    // Remove the user-specific order file
    const userId = session.userId;
    const orderFilePath = path.join(__dirname, 'orders', `${userId}.json`);
    try {
      fs.unlinkSync(orderFilePath);
    } catch (error) {
      console.error('Error deleting order file:', error);
    }
  }

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


app.get('/', (req, res) => {
  res.send(`
  <style>
  .welcome-container {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: lightblue;
  }
  .welcome-header {
    font-size: 4em;
    margin-bottom: 30px;
    text-align: center;
  }
  .welcome-text {
    font-size: 1.5em;
    text-align: center;
  }
  .welcome-link {
    color: #FFA500;
    text-decoration: none;
    border-bottom: 2px solid #FFA500;
  }
  .welcome-link:hover {
    color: #FF8C00;
    border-bottom: 2px solid #FF8C00;
  }
  .logo {
    width: 300px;
    height: 300px;
    height: auto;
    margin-bottom: 20px;
  }
</style>
    <div class="welcome-container">
      <img class="logo" src="/images/WhatsApp_Image_2023-05-18_at_4.45.03_PM-removebg-preview.png" alt="Hami Confectionery Logo">
      <h1 class="welcome-header">Hello, Welcome To Hami Confectionery!</h1>
      <p class="welcome-text">Thank you for visiting our website. Please <a class="welcome-link" href="/signup.html">sign up</a> to access our exclusive deals and offers.</p>
    </div>
  `);
});


// Parse JSON request bodies
app.use(bodyParser.json());

// app.post('/add-to-cart', (req, res) => {
//   const cartItem = req.body;
//   console.log('Received cart item:', cartItem);
  
//   // Read the existing cart data from the JSON file
//   const cartData = readCartData();
  
//   // Add the new cart item to the existing cart data
//   cartData.push(cartItem);
  
//   // Write the updated cart data to the JSON file
//   const cartFilePath = path.join(__dirname, 'cart.json');
//   try {
//     fs.writeFileSync(cartFilePath, JSON.stringify(cartData), 'utf8');
//   } catch (error) {
//     console.error('Error writing cart data:', error);
//   }
  

//   res.json({ status: 'success', message: 'Item added to cart', data: { itemId: cartItem.itemId } });
// });

app.post('/add-to-cart', (req, res) => {
  const cartItem = req.body;
  console.log('Received cart item:', cartItem);

  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];
  if (session && session.userId) {
    const userId = session.userId;

    // Read the existing order data for the user from the JSON file
    const orderFilePath = path.join(ordersDirectory, `${userId}.json`);
    const orderData = readOrderData(userId);

    // Add the new cart item to the existing order data
    orderData.push(cartItem);

    // Write the updated order data to the user-specific JSON file
    try {
      fs.writeFileSync(orderFilePath, JSON.stringify(orderData), 'utf8');
    } catch (error) {
      console.error('Error writing order data:', error);
    }

    res.json({ status: 'success', message: 'Item added to cart', data: { itemId: cartItem.itemId } });
  } else {
    // Handle the case where the user is not logged in
    res.status(401).json({ status: 'error', message: 'User not authenticated' });
  }
});


function readOrderData(userId) {
  const filePath = path.join(ordersDirectory, `${userId}.json`);

  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []; // Return an empty array if the file doesn't exist
    } else {
      throw error;
    }
  }
}

app.get('/cart-count', (req, res) => {
  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];

  if (session && session.userId) {
    const userId = session.userId;
    const orderData = readOrderData(userId);
    const cartCount = orderData.length; // Assuming each item in the orderData represents one cart item

    res.json({ count: cartCount });
  } else {
    res.json({ count: 0 }); // Return count as 0 if the user is not logged in or has no items in the cart
  }
});


function writeOrderData(userId, orderData) {
  const filePath = path.join(ordersDirectory, `${userId}.json`);

  try {
    fs.writeFileSync(filePath, JSON.stringify(orderData), 'utf8');
  } catch (error) {
    console.error('Error writing order data:', error);
  }
}

function clearCartData(userId) {
  const cartFilePath = path.join(cartDirectory, `${userId}.json`);

  try {
    fs.unlinkSync(cartFilePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error clearing cart data:', error);
    }
  }
}


app.get('/order', (req, res) => {
  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];

  if (session && session.userId) {
    const userId = session.userId;
    const orderData = readOrderData(userId);
    console.log("Order items:", orderData);

    const currentTime = Date.now();
    const updatedOrderData = orderData.filter(item => {
      const itemAddedTime = item.addedTime || 0;
      return currentTime - itemAddedTime <= 3 * 60 * 60 * 1000; // 3 hours in milliseconds
    });

    writeOrderData(userId, updatedOrderData); // Update the order data to remove expired items

    res.render('order', { cartItems: updatedOrderData });
  } else {
    res.redirect('/index.html');
  }
});


app.post('/delete-from-cart', (req, res) => {
  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];

  if (session && session.userId) {
    const userId = session.userId;
    const itemId = req.body.itemId;

    const orderData = readOrderData(userId);

    // Find the index of the item with the specified ID
    const itemIndex = orderData.findIndex(item => item.itemId === itemId);

    if (itemIndex !== -1) {
      // Remove the item from the order data
      orderData.splice(itemIndex, 1);

      // Write the updated order data to the file
      writeOrderData(userId, orderData);

      // Send a response indicating the successful deletion
      res.json({ success: true });
    } else {
      // Send a response indicating that the item was not found in the cart
      res.json({ success: false, message: 'Item not found in cart' });
    }
  } else {
    // Send a response indicating that the user is not logged in
    res.json({ success: false, message: 'User not logged in' });
  }
});



app.get('/payment', (req, res) => {
  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];

  if (session && session.userId) {
    const userId = session.userId;
    const orderData = readOrderData(userId);
    console.log("Order items:", orderData);

    // Calculate the total price based on the order items
    const totalPrice = orderData.reduce((total, item) => total + item.price * item.quantity, 0);

    res.render('payment', { cartItems: orderData, totalPrice }); // Pass order data and total price to the payment page
  } else {
    res.redirect('/index.html');
  }
});


// Handle the form submission from the payment page
app.post('/process-payment', (req, res) => {
  const { cardNumber, cardHolder, expiryDate, cvv } = req.body;
  // Process the payment here

  // Assuming the payment is successful, redirect the user to a success page
  res.redirect('/payment-success');
});

app.post('/submit-payment-proof', upload.single('paymentProof'), (req, res) => {
  const sessionId = req.cookies.sessionId;
  const session = sessions[sessionId];

  if (session && session.userId) {
    const userId = session.userId;
    const userEmail = session.email; // Retrieve the user's email from the session
    const orderData = readOrderData(userId);
    console.log("Order items:", orderData);

    // // Fetch the order items from orderData using the provided itemId values
    // const items = itemId.map(id => orderData.find(item => item.itemId === id));

    // Assuming you have access to the order details and user information
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

    // // Populate itemImage array with absolute image URLs
    // const items = orderData.map(item => ({
    //   ...item,
    //   imageUrl: baseUrl + item.imageUrl
    // }));

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
              ${items.map((item, index) => `
                <li>
                  <h3>${item}</h3>
                  <p>Quantity: ${quantity[index]}</p>
                  <p>ItemId: ${itemId[index]}</p>
                  <img src="${baseUrl}${item.imageUrl}" alt="Item Image" />
                </li>
              `).join('')}
            </ul>
            <p>Total: $${total}</p>
            <p>Delivery Time: ${deliveryTime}</p>
            <p>We will deliver your order as soon as possible. If you have any questions, please contact us.</p>
          </div>
        </body>
      </html>
    `    
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
              ${items.map((item, index) => `
                <li>
                  <h3>${item}</h3>
                  <p>Quantity: ${quantity[index]}</p>
                  <p>ItemId: ${itemId[index]}</p>
                  <img src="${baseUrl}${item.imageUrl}" alt="Item Image" />
                </li>
              `).join('')}
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
          cid: 'paymentProof' // Use the same 'cid' as in the img src attribute
        }
      ]
    };

    transporter.sendMail(adminNotificationMailOptions, (error, info) => {
      if (error) {
        console.error('Error sending order notification email to admin:', error);
      } else {
        console.log('Order notification email sent to admin:', info.response);
      }
    });

// Send a response to the client
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
  }
});



app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});













// const express = require('express');
// const bodyParser = require('body-parser');
// const bcrypt = require('bcrypt');
// const cookieParser = require('cookie-parser');
// const fs = require('fs');
// const cors = require('cors');
// const path = require('path');
// const ejs = require('ejs');
// const session = require('express-session');

// const app = express();
// const port = 8080;

// app.use(express.static(path.join(__dirname, 'client'), {
//   etag: false,
//   maxAge: 0,
//   lastModified: false,
//   cacheControl: false,
//   extensions: ['html', 'css', 'js', 'jpeg', 'png']
// }));

// app.get('/images/:filename', (req, res) => {
//   const filePath = path.join(__dirname, '..', 'client', 'images', req.params.filename);
//   // console.log('filePath:', filePath);
//   const contentType = getContentType(filePath);
//   res.set('Content-Type', contentType);
//   res.sendFile(filePath);
//   // const contentType = getContentType(filePath);
//   // res.set('Content-Type', contentType);
//   // res.sendFile(path.join(__dirname + '/../client/images'));
// });

// function getContentType(filePath) {
//   const ext = path.extname(filePath).toLowerCase();
//   switch (ext) {
//     case '.jpeg':
//       return 'image/jpeg';
//     case '.png':
//       return 'image/png';
//     default:
//       return 'application/octet-stream';
//   }
// }

// app.set('views', path.join(__dirname, '..', 'client', 'views'));
// app.set('view engine', 'ejs');

// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(cookieParser());
// app.use(cors()); // Allow cross-origin requests

// app.use(session({
//   secret: 'mysecretkey',
//   resave: false,
//   saveUninitialized: true,
//   cookie: { secure: false }
// }));

// app.get('/signup.html', (req, res) => {
//   res.setHeader('Content-Type', 'text/html');
//   res.sendFile(path.join(__dirname + '/../client/signup.html'));
// });

// app.post('/signup', (req, res) => {
//   console.log('POST request received');
//   const { name, email, password } = req.body;

//   // Validate the input (e.g., check if email is valid and password is strong enough)

//   // Hash the password for security
//   bcrypt.hash(password, 10, (err, hash) => {
//     // Check if the users.json file exists, and create it if it doesn't
//     if (!fs.existsSync('users.json')) {
//       fs.writeFileSync('users.json', '[]');
//     }

//     // Append the user's information to the JSON file
//     const user = {
//       name: name,
//       email: email,
//       password: hash
//     };
//     const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//     users.push(user);
//     fs.writeFileSync('users.json', JSON.stringify(users));

//     // Redirect the user to the login page
//     res.redirect('/index.html');
//   });
// });

// app.get('/index.html', (req, res) => {
//   res.setHeader('Content-Type', 'text/html');
//   res.sendFile(path.join(__dirname + '/../client/index.html'));
// });

// app.post('/login', (req, res) => {
//   const { email, password } = req.body;

//   // Find the user with the matching email in the JSON file
//   const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//   const user = users.find(user => user.email === email);

//   // Check if the user's credentials are correct
//   bcrypt.compare(password, user.password, (err, result) => {
//     if (result) {
//       // Set a cookie to remember the user's email
//       res.cookie('email', email);

//       // Redirect the user to the dashboard page
//       res.redirect('/dashboard.html');
//     } else {
//       // If the credentials are incorrect, show an error message
//       res.send('Invalid email or password');
//     }
//   });
// });

// app.get('/dashboard.html', (req, res) => {
//   // Get the email from the cookie
//   const email = req.cookies.email;

//   // Redirect to login page if email is not found in the cookie
//   if (!email) {
//     return res.redirect('/index.html');
//   }
  

//   // Find the user with the matching email in the JSON file
//   const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//   const user = users.find(user => user.email === email);

//   // Display the dashboard page with the user's name
//   // res.send(`Welcome to the dashboard, ${user.name}!`);
//   // Send the dashboard HTML file with the user's name
//   // res.sendFile(__dirname + '/public/dashboard.html');

//   // Render the dashboard EJS template with the user's name
//   res.render('dashboard', { user: user });
// });

// // 
// app.post('/logout', (req, res) => {
//   req.session.destroy(err => {
//       if (err) {
//           console.log(err);
//           res.send('Error logging out');
//       } else {
//           res.clearCookie('email');
//           res.redirect('/index.html');
//       }
//   });
// });

// app.get('/', (req, res) => {
//   res.send(`
//     <html>
//       <head>
//         <title>Welcome to Hami Confectionery</title>
//         <style>
//           .welcome-container {
//             width: 100%;
//             height: 100vh;
//             display: flex;
//             flex-direction: column;
//             justify-content: center;
//             align-items: center;
//           }
//           .welcome-header {
//             font-size: 4em;
//             margin-bottom: 30px;
//             text-align: center;
//           }
//           .welcome-text {
//             font-size: 1.5em;
//             text-align: center;
//           }
//           .welcome-link {
//             color: #FFA500;
//             text-decoration: none;
//             border-bottom: 2px solid #FFA500;
//           }
//           .welcome-link:hover {
//             color: #FF8C00;
//             border-bottom: 2px solid #FF8C00;
//           }
//           .logo {
//             width: 100px;
//             height: auto;
//             margin-bottom: 20px;
//           }
//         </style>
//       </head>
//       <body>
//         <div class="welcome-container">
//           <img class="logo" src="https://example.com/logo.png" alt="Hami Confectionery Logo">
//           <h1 class="welcome-header">Hello, Welcome To Hami Confectionery!</h1>
//           <p class="welcome-text">Thank you for visiting our website. Please <a class="welcome-link" href="/signup.html">sign up</a> to access our exclusive deals and offers.</p>
//         </div>
//       </body>
//     </html>
//   `);
// });


// app.post('/add-to-cart', (req, res) => {
//   const cartItem = req.body;
  
//   // Read the existing cart data from the JSON file
//   const cartData = readCartData();
  
//   // Add the new cart item to the existing cart data
//   cartData.push(cartItem);
  
//   // Write the updated cart data to the JSON file
//   const cartFilePath = path.join(__dirname, 'cart.json');
//   try {
//     fs.writeFileSync(cartFilePath, JSON.stringify(cartData), 'utf8');
//   } catch (error) {
//     console.error('Error writing cart data:', error);
//   }
  

//   res.json({ status: 'success', message: 'Item added to cart', data: { itemId: cartItem.itemId } });
// });




// // Helper function to read the cart data from a JSON file
// function readCartData() {
//   const cartFilePath = path.join(__dirname, 'cart.json');
//   try {
//     const cartData = fs.readFileSync(cartFilePath, 'utf8');
//     return JSON.parse(cartData);
//   } catch (error) {
//     console.error('Error reading cart data:', error);
//     return [];
//   }
// }


// app.get('/order', (req, res) => {
//   // Read the cart items from the JSON file
//   const cartItems = readCartData();
//   console.log("Cart items:", cartItems);
//   res.render('order', { cartItems });
// });




// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });







// app.get('/order', (req, res) => {
//   const cartItems = req.session.cart || [];
//   res.render('order', { cartItems });
// });



// const express = require('express');
// const bodyParser = require('body-parser');
// const bcrypt = require('bcrypt');
// const cookieParser = require('cookie-parser');
// const fs = require('fs');
// const cors = require('cors');

// const app = express();
// const port = 5501;

// app.use(express.static('public'));

// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(cookieParser());
// app.use(cors()); // Allow cross-origin requests

// app.get('/', (req, res) => {
//   res.send('Hello, world!');
// });

// app.post('/signup', (req, res) => {
//   console.log('POST request received');
//   const { name, email, password } = req.body;

//   // Validate the input (e.g., check if email is valid and password is strong enough)

//   // Hash the password for security
//   bcrypt.hash(password, 10, (err, hash) => {
//     // Check if the users.json file exists, and create it if it doesn't
//     if (!fs.existsSync('users.json')) {
//       fs.writeFileSync('users.json', '[]');
//     }

//     // Append the user's information to the JSON file
//     const user = {
//       name: name,
//       email: email,
//       password: hash
//     };
//     const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//     users.push(user);
//     fs.writeFileSync('users.json', JSON.stringify(users));

//     // Redirect the user to the login page
//     res.redirect('/login.html');
//   });
// });

// app.post('/login', (req, res) => {
//   const { email, password } = req.body;

//   // Find the user with the matching email in the JSON file
//   const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//   const user = users.find(user => user.email === email);

//   // Check if the user's credentials are correct
//   bcrypt.compare(password, user.password, (err, result) => {
//     if (result) {
//       // Set a cookie to remember the user's email
//       res.cookie('email', email);

//       // Redirect the user to the dashboard page
//       res.redirect('/dashboard');
//     } else {
//       // If the credentials are incorrect, show an error message
//       res.send('Invalid email or password');
//     }
//   });
// });

// app.get('/dashboard', (req, res) => {
//   // Get the email from the cookie
//   const email = req.cookies.email;

//   // Find the user with the matching email in the JSON file
//   const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//   const user = users.find(user => user.email === email);

//   // Display the dashboard page with the user's name
//   res.send(`Welcome to the dashboard, ${user.name}!`);
// });

// // Serve index.html for all routes that aren't already defined
// app.get('*', (req, res) => {
//   res.sendFile(__dirname + '/public/login.html');
// });

// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });







// const express = require('express');
// const bodyParser = require('body-parser');
// const bcrypt = require('bcrypt');
// const cookieParser = require('cookie-parser');
// const fs = require('fs');
// const cors = require('cors');

// const app = express();
// const port = 5501;

// app.use(express.static('public'));

// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(cookieParser());
// app.use(cors()); // Allow cross-origin requests

// app.get('/', (req, res) => {
//   res.send('Hello, world!');
// });

// app.post('/signup', (req, res) => {
//   console.log('POST request received');
//   const { name, email, password } = req.body;

//   // Validate the input (e.g., check if email is valid and password is strong enough)

//   // Hash the password for security
//   bcrypt.hash(password, 10, (err, hash) => {
//     // Check if the users.json file exists, and create it if it doesn't
//     if (!fs.existsSync('users.json')) {
//       fs.writeFileSync('users.json', '[]');
//     }

//     // Append the user's information to the JSON file
//     const user = {
//       name: name,
//       email: email,
//       password: hash
//     };
//     const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//     users.push(user);
//     fs.writeFileSync('users.json', JSON.stringify(users));

//     // Redirect the user to the login page
//     res.redirect('/login.html');
//   });
// });

// app.post('/login', (req, res) => {
//   const { email, password } = req.body;

//   // Find the user with the matching email in the JSON file
//   const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//   const user = users.find(user => user.email === email);

//   // Check if the user's credentials are correct
//   bcrypt.compare(password, user.password, (err, result) => {
//     if (result) {
//       // Set a cookie to remember the user's email
//       res.cookie('email', email);

//       // Redirect the user to the dashboard page
//       res.redirect('/dashboard');
//     } else {
//       // If the credentials are incorrect, show an error message
//       res.send('Invalid email or password');
//     }
//   });
// });

// app.get('/dashboard', (req, res) => {
//   // Get the email from the cookie
//   const email = req.cookies.email;

//   // Find the user with the matching email in the JSON file
//   const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//   const user = users.find(user => user.email === email);

//   // Display the dashboard page with the user's name
//   res.send(`Welcome to the dashboard, ${user.name}!`);
// });

// app.get('/login.html', (req, res) => {
//   res.sendFile(__dirname + '/public/login.html');
// });

// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });





// const express = require('express');
// const bodyParser = require('body-parser');
// const bcrypt = require('bcrypt');
// const cookieParser = require('cookie-parser');
// const fs = require('fs');
// const cors = require('cors');

// const app = express();
// const port = 3000;

// app.use(express.static('public'));

// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(cookieParser());
// app.use(cors()); // Allow cross-origin requests

// app.get('/', (req, res) => {
//   res.send('Hello, world!');
// });

// app.post('/signup', (req, res) => {
//   console.log('POST request received');
//   const { name, email, password } = req.body;

//   // Validate the input (e.g., check if email is valid and password is strong enough)

//   // Hash the password for security
//   bcrypt.hash(password, 10, (err, hash) => {
//     // Check if the users.json file exists, and create it if it doesn't
//     if (!fs.existsSync('users.json')) {
//       fs.writeFileSync('users.json', '[]');
//     }

//     // Append the user's information to the JSON file
//     const user = {
//       name: name,
//       email: email,
//       password: hash
//     };
//     const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//     users.push(user);
//     fs.writeFileSync('users.json', JSON.stringify(users));

//     // Redirect the user to the dashboard page
//     res.redirect('/dashboard');
//   });
// });

// app.post('/login', (req, res) => {
//   const { email, password } = req.body;

//   // Find the user with the matching email in the JSON file
//   const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//   const user = users.find(user => user.email === email);

//   // Check if the user's credentials are correct
//   bcrypt.compare(password, user.password, (err, result) => {
//     if (result) {
//       // Set a cookie to remember the user's email
//       res.cookie('email', email);

//       // Redirect the user to the dashboard page
//       res.redirect('/dashboard');
//     } else {
//       // If the credentials are incorrect, show an error message
//       res.send('Invalid email or password');
//     }
//   });
// });

// app.get('/dashboard', (req, res) => {
//   // Get the email from the cookie
//   const email = req.cookies.email;

//   // Find the user with the matching email in the JSON file
//   const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//   const user = users.find(user => user.email === email);

//   // Display the dashboard page with the user's name
//   res.send(`Welcome to the dashboard, ${user.name}!`);
// });

// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });







// const express = require('express');
// const bodyParser = require('body-parser');
// const bcrypt = require('bcrypt');
// const cookieParser = require('cookie-parser');
// const fs = require('fs');

// const app = express();
// const port = 3000;

// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(cookieParser());

// app.get('/', (req, res) => {
//   res.send('Hello, world!');
// });

// app.post('/signup', (req, res) => {
//   const { name, email, password } = req.body;

//   // Validate the input (e.g., check if email is valid and password is strong enough)

//   // Hash the password for security
//   bcrypt.hash(password, 10, (err, hash) => {
//     // Check if the users.json file exists, and create it if it doesn't
//     if (!fs.existsSync('users.json')) {
//       fs.writeFileSync('users.json', '[]');
//     }

//     // Append the user's information to the JSON file
//     const user = {
//       name: name,
//       email: email,
//       password: hash
//     };
//     const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//     users.push(user);
//     fs.writeFileSync('users.json', JSON.stringify(users));

//     // Redirect the user to the dashboard page
//     res.redirect('/dashboard');
//   });
// });

// app.post('/login', (req, res) => {
//   const { email, password } = req.body;

//   // Find the user with the matching email in the JSON file
//   const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//   const user = users.find(user => user.email === email);

//   // Check if the user's credentials are correct
//   bcrypt.compare(password, user.password, (err, result) => {
//     if (result) {
//       // Set a cookie to remember the user's email
//       res.cookie('email', email);

//       // Redirect the user to the dashboard page
//       res.redirect('/dashboard');
//     } else {
//       // If the credentials are incorrect, show an error message
//       res.send('Invalid email or password');
//     }
//   });
// });

// app.get('/dashboard', (req, res) => {
//   // Get the email from the cookie
//   const email = req.cookies.email;

//   // Find the user with the matching email in the JSON file
//   const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//   const user = users.find(user => user.email === email);

//   // Display the dashboard page with the user's name
//   res.send(`Welcome to the dashboard, ${user.name}!`);
// });

// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });









// const express = require('express');
// const bodyParser = require('body-parser');
// const bcrypt = require('bcrypt');
// const cookieParser = require('cookie-parser');
// const fs = require('fs');

// const app = express();
// const port = 3000;

// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(cookieParser());

// app.get('/', (req, res) => {
//   res.send('Hello, world!');
// });

// app.post('/signup', (req, res) => {
//   const { name, email, password } = req.body;

//   // Validate the input (e.g., check if email is valid and password is strong enough)

//   // Hash the password for security
//   bcrypt.hash(password, 10, (err, hash) => {
//     // Append the user's information to the JSON file
//     const user = {
//       name: name,
//       email: email,
//       password: hash
//     };
//     const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//     users.push(user);
//     fs.writeFileSync('users.json', JSON.stringify(users));

//     // Redirect the user to the dashboard page
//     res.redirect('/dashboard');
//   });
// });

// app.post('/login', (req, res) => {
//   const { email, password } = req.body;

//   // Find the user with the matching email in the JSON file
//   const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//   const user = users.find(user => user.email === email);

//   // Check if the user's credentials are correct
//   bcrypt.compare(password, user.password, (err, result) => {
//     if (result) {
//       // Set a cookie to remember the user's email
//       res.cookie('email', email);

//       // Redirect the user to the dashboard page
//       res.redirect('/dashboard');
//     } else {
//       // If the credentials are incorrect, show an error message
//       res.send('Invalid email or password');
//     }
//   });
// });

// app.get('/dashboard', (req, res) => {
//   // Get the email from the cookie
//   const email = req.cookies.email;

//   // Find the user with the matching email in the JSON file
//   const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
//   const user = users.find(user => user.email === email);

//   // Display the dashboard page with the user's name
//   res.send(`Welcome to the dashboard, ${user.name}!`);
// });

// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });
