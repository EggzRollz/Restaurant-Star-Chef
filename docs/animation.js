console.log("The script is running!");

const gallery = document.querySelector('.gallery');
const images = document.querySelectorAll('.gallery img');
const animatedTexts = document.querySelectorAll('.splash-text, .minor-splash-text, .opening-hours-text, .about-us-text');
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

function revealElementsOnScroll() {
  
  // Animate images
  images.forEach((img, index) => {
    // Only animate if it's in view AND hasn't been animated yet
    if (isInView(img) && !img.classList.contains('visible')) {
      setTimeout(() => {
        img.classList.add('visible');
      }, index * 200); // Shorter delay for images is often smoother
    }
  });

  // Animate all texts
  animatedTexts.forEach((el, index) => {
    if (isInView(el) && !el.classList.contains('visible')) {
      // Use a small, staggered delay
      setTimeout(() => {
        el.classList.add('visible');
      }, index * 150);
    }
  });
}

// Run the function on load and on scroll
window.addEventListener('load', revealElementsOnScroll);
window.addEventListener('scroll', revealElementsOnScroll);
document.addEventListener('DOMContentLoaded', () => {

  const mainHeader = document.querySelector('.main-header');
  const menuNav = document.querySelector('.menu-nav');
  const menuNavWrapper = document.querySelector('.menu-nav-wrapper');
  const menuNavLinks = document.querySelectorAll('.menu-nav a');
  
  if (menuNavLinks.length > 0) {
    menuNavLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent default anchor behavior
        
        const targetId = link.getAttribute('href');
        
        // If it's the #next-section link (for "ALL" or "FRIED NOODLES")
        if (targetId === '#next-section') {
          const targetElement = document.querySelector(targetId);
          if (targetElement) {
            // Calculate the offset (header + menu nav height)
            const headerHeight = mainHeader ? mainHeader.offsetHeight : 0;
            const menuNavHeight = menuNav ? menuNav.offsetHeight : 0;
            const totalOffset = headerHeight + menuNavHeight;
            
            // Get the element's position
            const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
            const offsetPosition = elementPosition - totalOffset;
            
            // Smooth scroll to the calculated position
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          }
        } else {
          // For other category links, just scroll to the menu section
          const menuSection = document.querySelector('#next-section');
          if (menuSection) {
            const headerHeight = mainHeader ? mainHeader.offsetHeight : 0;
            const menuNavHeight = menuNav ? menuNav.offsetHeight : 0;
            const totalOffset = headerHeight + menuNavHeight;
            
            const elementPosition = menuSection.getBoundingClientRect().top + window.scrollY;
            const offsetPosition = elementPosition - totalOffset;
            
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          }
        }
      });
    });
  }

  if (mainHeader && menuNav && menuNavWrapper) {
    
    let headerHeight = 0;
    let menuNavHeight = 0;
    let originalWrapperTop = 0;
    let isSticky = false;

    function setupStickyNav() {
      // Remove fixed class to get accurate measurements
      const wasFixed = isSticky;
      if (wasFixed) {
        menuNav.classList.remove('fixed');
        isSticky = false;
      }
      
      // Force reflow
      void menuNav.offsetHeight;

      // Get header height
      headerHeight = mainHeader.offsetHeight;
      
      // Get menu nav height BEFORE it becomes fixed
      menuNavHeight = menuNav.offsetHeight;

      // CRITICAL: Set the wrapper height IMMEDIATELY before any calculations
      // This prevents the grid from shifting when nav becomes fixed
      menuNavWrapper.style.height = `${menuNavHeight}px`;

      // Get the wrapper's absolute position from top of document
      const wrapperRect = menuNavWrapper.getBoundingClientRect();
      originalWrapperTop = wrapperRect.top + window.scrollY;

      // Set CSS variable
      document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);

      // Recheck scroll position after setup
      handleScroll();
    }

    function handleScroll() {
      const scrollPosition = window.scrollY;
      const triggerPoint = originalWrapperTop - headerHeight;

      if (scrollPosition >= triggerPoint) {
        if (!isSticky) {
          // Before adding fixed class, ensure wrapper has exact height set
          menuNavWrapper.style.height = `${menuNavHeight}px`;
          menuNav.classList.add('fixed');
          isSticky = true;
        }
      } else {
        if (isSticky) {
          menuNav.classList.remove('fixed');
          isSticky = false;
          // Keep the height to prevent shift
          menuNavWrapper.style.height = `${menuNavHeight}px`;
        }
      }
    }

    // Setup on load
    window.addEventListener('load', () => {
      setTimeout(setupStickyNav, 100);
    });
    
    // Recalculate on resize with debounce
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(setupStickyNav, 150);
    });

    // Initial setup
    setupStickyNav();

    // Handle scroll with requestAnimationFrame
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // Scroll indicator logic
  const scrollIndicator = document.querySelector('.scroll-down-indicator');
  if (scrollIndicator) { 
      window.addEventListener('scroll', () => {
          if (window.scrollY > 50) { 
              scrollIndicator.classList.add('hidden');
          } else {
              scrollIndicator.classList.remove('hidden');
          }
      });
  }
});