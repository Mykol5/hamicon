const form = document.getElementById('signup-form');
const nameInput = document.getElementById('name-input');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const submitBtn = document.getElementById('submit-btn');

if (submitBtn) {
  submitBtn.addEventListener('click', () => {
    const name = nameInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;

    // Create a new user object
    const user = {
      name: name,
      email: email,
      password: password
    };

    // Send a POST request to the server to create the new user
    fetch('http://localhost:3000/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(user)
    })
      .then(response => {
        if (response.ok) {
          // If the response is ok, redirect the user to the dashboard page
          window.location.href = 'http://localhost:3000/index.html';
        } else {
          // If the response is not ok, display an error message
          throw new Error('Network response was not ok');
        }
      })
      .catch(error => console.error(error));
  });
}



//https://pastryhamisrvcs.netlify.app/



// const form = document.querySelector('form');

// form.addEventListener('submit', async (e) => {
//   e.preventDefault();

//   const name = document.querySelector('#name').value;
//   const email = document.querySelector('#email').value;
//   const password = document.querySelector('#password').value;

//   const response = await fetch('http://localhost:3000/signup', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify({ name, email, password })
//   });

//   if (response.ok) {
//     console.log('User created successfully!');
//   } else {
//     console.error('Error creating user:', response.status);
//   }
// });





// const createUser = (name, email, password) => {
//     const requestOptions = {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ name, email, password })
//     };
  
//     fetch('/signup', requestOptions)
//       .then(response => {
//         if (response.ok) {
//           return response.json();
//         }
//         throw new Error('Network response was not ok.');
//       })
//       .then(data => {
//         console.log(data);
//       })
//       .catch(error => {
//         console.error('Error:', error);
//       });
//   };
  
  // Example usage:
//   createUser('John Doe', 'john.doe@example.com', 'password123');



//User ID: 9e89cebf-5060-4d19-b252-87c38fbe7597