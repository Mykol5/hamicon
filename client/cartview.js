document.addEventListener("DOMContentLoaded", function() {
  const viewCartBtns = document.querySelectorAll("#view-cart-btn1, #view-cart-btn2, #view-cart-btn8, #view-cart-btn9");
  const closeCartBtns = document.querySelectorAll(".close-cart-btn");

  viewCartBtns.forEach(function(viewCartBtn) {
    const cartDetails = viewCartBtn.nextElementSibling;
  
    const quantityValue = cartDetails.querySelector(".cart-item-quantity-value");
    let priceValue = cartDetails.querySelector(".cart-item-price"); // update to let instead of const
  
    const incrementBtn = cartDetails.querySelector(".cart-item-quantity-btn:nth-of-type(2)");
    const decrementBtn = cartDetails.querySelector(".cart-item-quantity-btn:nth-of-type(1)");
  
    viewCartBtn.addEventListener("click", function() {
      cartDetails.style.display = "block";
    });
  
    closeCartBtns.forEach(function(closeCartBtn) {
      closeCartBtn.addEventListener("click", function() {
        cartDetails.style.display = "none";
      });
    });
  
    incrementBtn.addEventListener("click", function() {
      let currentQuantity = parseInt(quantityValue.textContent);
      currentQuantity++;
      quantityValue.textContent = currentQuantity;
      let price = parseFloat(priceValue.textContent.replace("$", ""));
      priceValue.textContent = "$" + (price + parseFloat(priceValue.dataset.price)).toFixed(2); // update price value using dataset attribute
    });
  
    decrementBtn.addEventListener("click", function() {
      let currentQuantity = parseInt(quantityValue.textContent);
      if (currentQuantity > 1) {
        currentQuantity--;
        quantityValue.textContent = currentQuantity;
        let price = parseFloat(priceValue.textContent.replace("$", ""));
        priceValue.textContent = "$" + (price - parseFloat(priceValue.dataset.price)).toFixed(2); // update price value using dataset attribute
      }
    });
  }); 
});



// viewCartBtns.forEach(function(viewCartBtn) {
  //   const cartDetails = viewCartBtn.nextElementSibling;

  //   const quantityValue = cartDetails.querySelector(".cart-item-quantity-value");
  //   const priceValue = cartDetails.querySelector(".cart-item-price");

  //   const incrementBtn = cartDetails.querySelector(".cart-item-quantity-btn:nth-of-type(2)");
  //   const decrementBtn = cartDetails.querySelector(".cart-item-quantity-btn:nth-of-type(1)");

  //   viewCartBtn.addEventListener("click", function() {
  //     cartDetails.style.display = "block";
  //   });

  //   closeCartBtns.forEach(function(closeCartBtn) {
  //     closeCartBtn.addEventListener("click", function() {
  //       cartDetails.style.display = "none";
  //     });
  //   });

  //   incrementBtn.addEventListener("click", function() {
  //     let currentQuantity = parseInt(quantityValue.textContent);
  //     currentQuantity++;
  //     quantityValue.textContent = currentQuantity;
  //     let price = parseFloat(priceValue.textContent.replace("$", ""));
  //     priceValue.textContent = "$" + (price + 10).toFixed(2);
  //   });

  //   decrementBtn.addEventListener("click", function() {
  //     let currentQuantity = parseInt(quantityValue.textContent);
  //     if (currentQuantity > 1) {
  //       currentQuantity--;
  //       quantityValue.textContent = currentQuantity;
  //       let price = parseFloat(priceValue.textContent.replace("$", ""));
  //       priceValue.textContent = "$" + (price - 10).toFixed(2);
  //     }
  //   });
  // });




// document.addEventListener("DOMContentLoaded", function() {

//     const viewCartBtn = document.querySelector("#view-cart-btn");
//     const cartDetails = document.querySelector("#cart-details");
//     const closeCartBtn = document.querySelector(".close-cart-btn");
//     const quantityValue = document.querySelector(".cart-item-quantity-value");
//     const priceValue = document.querySelector(".cart-item-price");

//     viewCartBtn.addEventListener("click", function() {
//       cartDetails.style.display = "block";
//     });

//     closeCartBtn.addEventListener("click", function() {
//       cartDetails.style.display = "none";
//     });

//     const incrementBtn = document.querySelector(".cart-item-quantity-btn:nth-of-type(2)");
//     const decrementBtn = document.querySelector(".cart-item-quantity-btn:nth-of-type(1)");

//     incrementBtn.addEventListener("click", function() {
//       let currentQuantity = parseInt(quantityValue.textContent);
//       currentQuantity++;
//       quantityValue.textContent = currentQuantity;
//       let price = parseFloat(priceValue.textContent.replace("$", ""));
//       priceValue.textContent = "$" + (price + 10).toFixed(2);
//     });

//     decrementBtn.addEventListener("click", function() {
//       let currentQuantity = parseInt(quantityValue.textContent);
//       if (currentQuantity > 1) {
//         currentQuantity--;
//         quantityValue.textContent = currentQuantity;
//         let price = parseFloat(priceValue.textContent.replace("$", ""));
//         priceValue.textContent = "$" + (price - 10).toFixed(2);
//       }
//     });
// });







// document.addEventListener("DOMContentLoaded", function() {

//     const viewCartBtn = document.querySelector("#view-cart-btn");
//     const cartDetails = document.querySelector("#cart-details");
//     const closeCartBtn = document.querySelector(".close-cart-btn");

//     viewCartBtn.addEventListener("click", function() {
//       cartDetails.style.display = "block";
//     });

//     closeCartBtn.addEventListener("click", function() {
//       cartDetails.style.display = "none";
//     });
// });
  



    // const viewCartBtn = document.querySelector("#view-cart-btn");
    // const cartModal = document.querySelector(".cart-modal");
    // const closeCartBtn = document.querySelector(".close-cart-btn");
  
    // viewCartBtn.addEventListener("click", function() {
    //   cartModal.style.display = "block";
    // });
  
    // closeCartBtn.addEventListener("click", function() {
    //   cartModal.style.display = "none";
    // });



// const viewCartBtn = document.querySelector(".view-cart-btn");
// const cartModal = document.querySelector(".cart-modal");
// const closeCartBtn = document.querySelector(".close-cart-btn");

// viewCartBtn.addEventListener("click", function() {
//   if (cartModal) {
//     cartModal.style.display = "block";
//   }
// });

// closeCartBtn.addEventListener("click", function() {
//   if (cartModal) {
//     cartModal.style.display = "none";
//   }
// });






// const viewCartBtn = document.querySelector(".view-cart-btn");
// const cartModal = document.querySelector(".cart-modal");
// const closeCartBtn = document.querySelector(".close-cart-btn");

// viewCartBtn.addEventListener("click", function() {
//   cartModal.style.display = "block";
// });

// closeCartBtn.addEventListener("click", function() {
//   cartModal.style.display = "none";
// });







// document.addEventListener("DOMContentLoaded", function() {
//     // Your JavaScript code here
//     const viewCartBtn = document.getElementById('view-cart-btn');
//     const cartDetails = document.getElementById('cart-details');
//     // const closeCartBtn = document.getElementById('close-cart-btn');
    
//     viewCartBtn.addEventListener('click', () => {
//       cartDetails.style.display = 'block';
//     });
    
//     // closeCartBtn.addEventListener('click', () => {
//     //   cartDetails.style.display = 'none';
//     // });
//   });
  