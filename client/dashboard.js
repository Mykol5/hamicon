const hamburger = document.querySelector('.hamburger');
const body = document.querySelector('body');
const sidebar = document.querySelector('.sidebar');
const overlay = document.querySelector('.overlay');

hamburger.addEventListener('click', function() {
  body.classList.toggle('active');
  sidebar.classList.toggle('active');
  overlay.classList.toggle('active');
  hamburger.classList.toggle('active');
});


const slideshow = document.querySelector('.slideshow');
const dotsContainer = document.querySelector('.dots-container');
const images = slideshow.querySelectorAll('img');
const numImages = images.length;
let currentImage = 1;

// create dots
for (let i = 0; i < numImages; i++) {
  const dot = document.createElement('span');
  dot.classList.add('dot');
  dotsContainer.appendChild(dot);
}

const dots = dotsContainer.querySelectorAll('.dot');
dots[0].classList.add('active');

function showImage(n) {
  slideshow.style.transform = `translateX(-${150 * (n - 1)}px)`;
  dots.forEach(dot => dot.classList.remove('active'));
  dots[n - 1].classList.add('active');
  currentImage = n;
}

function nextImage() {
  if (currentImage === numImages) {
    showImage(1);
  } else {
    showImage(currentImage + 1);
  }
}

setInterval(nextImage, 3000);
