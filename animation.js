console.log("The script is running!");

const gallery = document.querySelector('.gallery');
const images = document.querySelectorAll('.gallery img');
const texts = document.querySelectorAll('.minor-splash-1-quote,.minor-splash-2-quote');
const navLinks = document.querySelector('.nav-links');
const menuToggle = document.querySelector('.menu-toggle');
const overlay = document.querySelector('.overlay');

// Mobile menu - check elements exist first
if (menuToggle && navLinks && overlay) {
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      menuToggle.classList.remove('active');
      overlay.classList.remove('active');
    });
  });

  menuToggle.addEventListener('click', () => {
    menuToggle.classList.toggle('active');
    navLinks.classList.toggle('active');
    overlay.classList.toggle('active');
  });
  
  overlay.addEventListener('click', () => {
    navLinks.classList.remove('active');
    overlay.classList.remove('active');
  });
}

// Show everything instantly on load (prevents flicker)
if (images.length > 0) {
  images.forEach(img => img.classList.add('visible'));
}
if (texts.length > 0) {
  texts.forEach(el => el.classList.add('visible'));
}

// Helper function
function isInView(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.top <= window.innerHeight && rect.bottom >= 0;
}

// Scroll animations only if gallery exists
if (gallery && images.length > 0) {
  function revealImages() {
    if (isInView(gallery)) {
      images.forEach(img => {
        img.classList.add('visible');
      });
    }
  }

  function revealText() {
    texts.forEach(el => {
      if (isInView(el)) {
        el.classList.add('visible');
      }
    });
  }

  window.addEventListener('scroll', () => {
    revealImages();
    revealText();
  });
}