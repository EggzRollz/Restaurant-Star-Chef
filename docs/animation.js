console.log("The script is running!");

const gallery = document.querySelector('.gallery');
const images = document.querySelectorAll('.gallery img');
const animatedTexts = document.querySelectorAll('.splash-text, .minor-splash-text, .opening-hours-text, .location-text');
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
  if (gallery) {
    gallery.querySelectorAll('img').forEach((img) => {
      if (isInView(img) && !img.classList.contains('visible')) {
        img.classList.add('visible');
      }
    });
  }
  animatedTexts.forEach((el, index) => {
    if (isInView(el) && !el.classList.contains('visible')) {
      setTimeout(() => { el.classList.add('visible'); }, index * 150);
    }
  });
}
function setupMobileGalleryLoop() {
  const gallery = document.querySelector('.gallery'); // Assuming gallery is defined here
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  
  if (!gallery || !isMobile) return;

  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  if (!prevBtn || !nextBtn) return;

  // --- 1. CLONE IMAGES FOR THE LOOP ---
  const originalItems = Array.from(gallery.children);
  if (originalItems.length === 0) return;
  
  // Clone images for the infinite effect
  originalItems.forEach(item => {
    const clone = item.cloneNode(true);
    // Ensure cloned items don't have the 'visible' class if you are using it
    clone.classList.remove('visible'); 
    gallery.appendChild(clone);
  });

  // This function will contain the logic that depends on element dimensions
  function initializeGalleryLogic() {
    let loopPoint = 0;
    const gap = parseInt(window.getComputedStyle(gallery).gap) || 30;

    // Calculate the exact width of the original set of images
    originalItems.forEach(item => {
      loopPoint += item.offsetWidth + gap;
    });

    // --- 2. THE LOOPING LOGIC ---
    const handleLoop = () => {
      if (loopPoint === 0) return; // Guard clause
      
      // If scrolled past the end of the original set, jump back silently
      if (gallery.scrollLeft >= loopPoint) {
        gallery.style.scrollBehavior = 'auto';
        gallery.scrollLeft -= loopPoint;
        gallery.style.scrollBehavior = 'smooth';
      }
      // Note: A backward loop is more complex and often not needed with this setup.
      // The user can just scroll back normally.
    };

    // --- 3. BUTTON CLICK EVENTS ---
    nextBtn.addEventListener('click', () => {
      // It's safer to calculate scrollAmount here in case of resize
      const scrollAmount = originalItems[0].offsetWidth + gap;
      gallery.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });

    prevBtn.addEventListener('click', () => {
      const scrollAmount = originalItems[0].offsetWidth + gap;
      gallery.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });

    // --- 4. SCROLL EVENT LISTENER ---
    // Use a timeout to check for the loop condition after the scroll has finished
    let scrollTimer;
    gallery.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(handleLoop, 150); // A shorter timeout is fine
    });
  }

  // --- ROBUST INITIALIZATION ---
  // Check if the document is already loaded. If so, run the logic immediately.
  // Otherwise, wait for it to load.
  if (document.readyState === 'complete') {
    initializeGalleryLogic();
  } else {
    window.addEventListener('load', initializeGalleryLogic);
  }
}


// Run the function on load and on scroll

document.addEventListener('DOMContentLoaded', () => {

  const mainHeader = document.querySelector('.main-header');
  const menuNav = document.querySelector('.menu-nav');
  const menuNavWrapper = document.querySelector('.menu-nav-wrapper');
  const menuNavLinks = document.querySelectorAll('.menu-nav a');
  
  if (mainHeader) {
    const scrollThreshold = 600; // Pixels to scroll before the header changes

    function handleHeaderScroll() {
      if (window.scrollY > scrollThreshold) {
        mainHeader.classList.add('scrolled');
      } else {
        mainHeader.classList.remove('scrolled');
      }
    }
    
    window.addEventListener('scroll', handleHeaderScroll);
    handleHeaderScroll(); 
  }
  setupMobileGalleryLoop();
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
              scrollIndicator.classList.add('fade-out');
          } else {
              scrollIndicator.classList.remove('fade-out');
          }
      });
  }
  revealElementsOnScroll(); 
  window.addEventListener('scroll', revealElementsOnScroll)
});

