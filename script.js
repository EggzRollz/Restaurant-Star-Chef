console.log("The script is running!");
/*https://www.youtube.com/watch?v=QRrPE9aj3wI*/
/*
let lastScrollTop = 0;
const header = document.querySelector('.gallery');

if (window.pageYOffset <= 100) {
    header.style.opacity = '0';
} else {
    header.style.opacity = '1';
}
window.addEventListener('scroll', function() {
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop <= 100) {
        
        header.style.opacity  = '0';
    } else if (scrollTop > lastScrollTop) {
        header.style.opacity  = '1';
       
    } else {
        
        header.style.opacity  = '1';
        
    }
    
    lastScrollTop = scrollTop;
});
*/
const gallery = document.querySelector('.gallery');
const images = document.querySelectorAll('.gallery img');
const texts = document.querySelectorAll('.minor-splash-1-quote,.minor-splash-2-quote'); 


function isInView(el) {
  const rect = el.getBoundingClientRect();
  return rect.top <= window.innerHeight && rect.bottom >= 0;
}

function revealImages() {
  if (isInView(gallery)) {
    images.forEach((img, index) => {
      setTimeout(() => {
        img.classList.add('visible');
      }, index * 250);
    });
  } else {
    images.forEach(img => {
      img.classList.remove('visible');
    });
  }
}

function revealText() {
  texts.forEach(el => {
    if (isInView(el)) {
      el.classList.add('visible');
    } else {
      el.classList.remove('visible');
    }
  });
}

window.addEventListener('scroll', () => {
  revealImages();
  revealText();
});
window.addEventListener('load', () => {
  revealImages();
  revealText();
});
