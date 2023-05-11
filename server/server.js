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
  extensions: ['html', 'css', 'js']
}));
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
  res.send('Hello, world!');
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
