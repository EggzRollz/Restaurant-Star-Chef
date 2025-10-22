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


function isInView(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const inView = rect.top <= window.innerHeight && rect.bottom >= 0;
  return inView;
}


function revealImages() {
  images.forEach((img, index) => {
    if (isInView(img)) {
      if (!img.classList.contains('visible')) {
        setTimeout(() => {
          img.classList.add('visible');
        }, index * 300);
      }
    } else {
      
      img.classList.remove('visible');
    }
  });
}

function revealText() {
  texts.forEach((el, index) => {
    if (isInView(el)) {
      if (!el.classList.contains('visible')) {
        
        setTimeout(() => {
          el.classList.add('visible');
        }, index * 300);
      }
    } else {
      el.classList.remove('visible');
    }
  });
}

window.addEventListener('load', () => {
  revealImages();
  revealText();
});

window.addEventListener('scroll', () => {
  revealImages();
  revealText();
});

const menuNav = document.querySelector('.menu-nav');
const wrapper = document.querySelector('.menu-nav-wrapper');
const placeholder = document.querySelector('.menu-placeholder');

if (menuNav && wrapper && placeholder) {
  let stickyOffset;
  
  function updateOffset() {
    const isMobile = window.innerWidth <= 480;
    const headerHeight = isMobile ? 40 : 80;
    const menuTop = menuNav.getBoundingClientRect().top + window.scrollY;
    stickyOffset = menuTop - headerHeight;
    console.log('Menu top:', menuTop, 'Header:', headerHeight, 'Offset:', stickyOffset);
  }
  
  window.addEventListener('load', updateOffset);
  window.addEventListener('resize', updateOffset);
  updateOffset();

  window.addEventListener('scroll', () => {
    if (window.scrollY >= stickyOffset) {
      menuNav.classList.add('fixed');
      placeholder.classList.add('active');
    } else {
      menuNav.classList.remove('fixed');
      placeholder.classList.remove('active');
    }
  });
}