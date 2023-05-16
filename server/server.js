const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const ejs = require('ejs');
const session = require('express-session');

const app = express();
const port = 8080;

app.use(express.static(path.join(__dirname, 'client'), {
  etag: false,
  maxAge: 0,
  lastModified: false,
  cacheControl: false,
  extensions: ['html', 'css', 'js', 'jpeg', 'png']
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

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

app.set('views', path.join(__dirname, '..', 'client', 'views'));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors()); // Allow cross-origin requests

app.use(session({
  secret: 'mysecretkey',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.get('/signup.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname + '/../client/signup.html'));
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

    // Append the user's information to the JSON file
    const user = {
      name: name,
      email: email,
      password: hash
    };
    const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
    users.push(user);
    fs.writeFileSync('users.json', JSON.stringify(users));

    // Redirect the user to the login page
    res.redirect('/index.html');
  });
});

app.get('/index.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname + '/../client/index.html'));
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Find the user with the matching email in the JSON file
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  const user = users.find(user => user.email === email);

  // Check if the user's credentials are correct
  bcrypt.compare(password, user.password, (err, result) => {
    if (result) {
      // Set a cookie to remember the user's email
      res.cookie('email', email);

      // Redirect the user to the dashboard page
      res.redirect('/dashboard.html');
    } else {
      // If the credentials are incorrect, show an error message
      res.send('Invalid email or password');
    }
  });
});

app.get('/dashboard.html', (req, res) => {
  // Get the email from the cookie
  const email = req.cookies.email;

  // Redirect to login page if email is not found in the cookie
  if (!email) {
    return res.redirect('/index.html');
  }
  

  // Find the user with the matching email in the JSON file
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  const user = users.find(user => user.email === email);

  // Display the dashboard page with the user's name
  // res.send(`Welcome to the dashboard, ${user.name}!`);
  // Send the dashboard HTML file with the user's name
  // res.sendFile(__dirname + '/public/dashboard.html');

  // Render the dashboard EJS template with the user's name
  res.render('dashboard', { user: user });
});

// 
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          console.log(err);
          res.send('Error logging out');
      } else {
          res.clearCookie('email');
          res.redirect('/index.html');
      }
  });
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Welcome to Hami Confectionery</title>
        <style>
          .welcome-container {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
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
            width: 100px;
            height: auto;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="welcome-container">
          <img class="logo" src="https://example.com/logo.png" alt="Hami Confectionery Logo">
          <h1 class="welcome-header">Hello, Welcome To Hami Confectionery!</h1>
          <p class="welcome-text">Thank you for visiting our website. Please <a class="welcome-link" href="/signup.html">sign up</a> to access our exclusive deals and offers.</p>
        </div>
      </body>
    </html>
  `);
});


app.post('/add-to-cart', (req, res) => {
  const cartItem = req.body;
  
  // Read the existing cart data from the JSON file
  const cartData = readCartData();
  
  // Add the new cart item to the existing cart data
  cartData.push(cartItem);
  
  // Write the updated cart data to the JSON file
  const cartFilePath = path.join(__dirname, 'cart.json');
  try {
    fs.writeFileSync(cartFilePath, JSON.stringify(cartData), 'utf8');
  } catch (error) {
    console.error('Error writing cart data:', error);
  }
  

  res.json({ status: 'success', message: 'Item added to cart', data: { itemId: cartItem.itemId } });
});




// Helper function to read the cart data from a JSON file
function readCartData() {
  const cartFilePath = path.join(__dirname, 'cart.json');
  try {
    const cartData = fs.readFileSync(cartFilePath, 'utf8');
    return JSON.parse(cartData);
  } catch (error) {
    console.error('Error reading cart data:', error);
    return [];
  }
}


app.get('/order', (req, res) => {
  // Read the cart items from the JSON file
  const cartItems = readCartData();
  console.log("Cart items:", cartItems);
  res.render('order', { cartItems });
});




app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});







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
