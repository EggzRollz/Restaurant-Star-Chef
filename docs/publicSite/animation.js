// =========================================================================
//  IMMEDIATE SETUP (Mobile Menu, etc.)
// =========================================================================
console.log("Final animation script running!");

// [DEBUG] Selecting elements for mobile menu
const navLinks = document.querySelector('.nav-links');
const menuToggle = document.querySelector('.menu-toggle');
const overlay = document.querySelector('.overlay');
console.log('[DEBUG] Mobile Menu Elements:', { navLinks, menuToggle, overlay });

if (menuToggle && navLinks && overlay) {
  console.log('[DEBUG] Mobile menu elements found. Attaching event listeners.');

  const closeMenu = () => {
    console.log('[DEBUG] closeMenu() called. Removing active classes.');
    navLinks.classList.remove('active');
    menuToggle.classList.remove('active');
    overlay.classList.remove('active');
    document.body.classList.remove('no-scroll');
  };

  document.querySelectorAll('.nav-links a').forEach(link => {
    console.log('[DEBUG] Attaching closeMenu listener to nav link:', link);
    link.addEventListener('click', closeMenu);
  });

  menuToggle.addEventListener('click', () => {
    console.log('[DEBUG] Menu toggle clicked. Toggling active classes.');
    navLinks.classList.toggle('active');
    menuToggle.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.classList.toggle('no-scroll');
    console.log('[DEBUG] `nav-links` active state is now:', navLinks.classList.contains('active'));
  });

  overlay.addEventListener('click', () => {
    console.log('[DEBUG] Overlay clicked. Calling closeMenu().');
    closeMenu();
  });

} else {
  console.warn('[DEBUG] WARNING: One or more mobile menu elements (.nav-links, .menu-toggle, .overlay) were not found. Mobile menu will not function.');
}

// =========================================================================
//  MAIN SCRIPT (RUNS ON DOMCONTENTLOADED)
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log("--- DOMContentLoaded: SCRIPT START ---");

  // --- 1. ELEMENT SELECTIONS ---
  console.log('[DEBUG] Step 1: Selecting main page elements...');
  const mainHeader = document.querySelector('.main-header');
  const menuNav = document.querySelector('.menu-nav');
  const menuNavWrapper = document.querySelector('.menu-nav-wrapper');
  const menuNavLinks = document.querySelectorAll('.menu-nav a');
  const scrollIndicator = document.querySelector('.scroll-down-indicator');
  const scroller = document.querySelector('.parallax-container');
  const parallaxHero = document.querySelector('.fixed-background'); // The element pushing content down
  const gallery = document.querySelector('.gallery');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

// Check if all necessary gallery elements exist on the page
if (gallery && prevBtn && nextBtn) {
  const images = gallery.querySelectorAll('img');

  // This function will only run if there are images to scroll through
  if (images.length > 0) {
    nextBtn.addEventListener('click', () => {
      // Get the width of the first image (they should all be the same)
      const imageWidth = images[0].offsetWidth;
      // Get the gap value from your CSS (it's 30px)
      const gap = 30;
      
      // Use scrollBy for a smooth, relative scroll
      gallery.scrollBy({
        left: imageWidth + gap,
        behavior: 'smooth'
      });
    });

    prevBtn.addEventListener('click', () => {
      // Get the width of the first image
      const imageWidth = images[0].offsetWidth;
      // Get the gap value
      const gap = 30;

      // Scroll left by the same amount
      gallery.scrollBy({
        left: -(imageWidth + gap),
        behavior: 'smooth'
      });
    });
  }
}
  console.log('[DEBUG] Element Selection Results:', { mainHeader, menuNav, menuNavWrapper, menuNavLinks, scrollIndicator, scroller, parallaxHero });

  if (!scroller) {
    console.error("[DEBUG] CRITICAL ERROR: The .parallax-container was not found. All scroll-based animations and logic will be disabled.");
    return;
  }

  // --- 2. DEFINE ALL SCROLL-RELATED FUNCTIONS ---
  let stickyTriggerPoint = 0;
  let headerHeight = 0;

const setupStickyNav = () => {
    console.log('[DEBUG] Running setupStickyNav() for CSS position:sticky...');
    if (!mainHeader || !menuNav) {
        console.warn("[DEBUG] WARNING: setupStickyNav() is missing .main-header or .menu-nav.");
        return;
    }
    
    const headerHeight = mainHeader.offsetHeight;
    console.log(`[DEBUG] Measured mainHeader.offsetHeight: ${headerHeight}px`);

    // We directly tell the .menu-nav element where its 'sticking' point is from the top.
    // The CSS will handle the rest.
    menuNav.style.top = `${headerHeight}px`;
    console.log(`%c[DEBUG] CSS 'top' property of .menu-nav set to ${headerHeight}px. CSS will now handle the sticky behavior.`, 'color: lightgreen; font-weight: bold;');

    // We still set the wrapper height to prevent a layout jump when smooth-scrolling calculates positions.
    const menuNavHeight = menuNav.offsetHeight;
    //menuNavWrapper.style.height = `${menuNavHeight}px`;
    console.log(`[DEBUG] Set .menu-nav-wrapper height to: ${menuNavHeight}px`);
  };

  const handleHeaderScroll = (scrollY) => {
    if (!mainHeader) return;
    if (scrollY > window.innerHeight * 1) {
        if (!mainHeader.classList.contains('scrolled')) console.log('[DEBUG] Header passed 600px scroll. Adding .scrolled class.');
        mainHeader.classList.add('scrolled');
    } else {
        if (mainHeader.classList.contains('scrolled')) console.log('[DEBUG] Header is above 600px scroll. Removing .scrolled class.');
        mainHeader.classList.remove('scrolled');
    }
  };
  
  const handleScrollIndicator = (scrollY) => {
    if (!scrollIndicator) return;
    if (scrollY > 50) {
        if (!scrollIndicator.classList.contains('fade-out')) console.log('[DEBUG] Scroll indicator passed 50px. Fading out.');
        scrollIndicator.classList.add('fade-out');
    } else {
        if (scrollIndicator.classList.contains('fade-out')) console.log('[DEBUG] Scroll indicator is above 50px. Fading in.');
        scrollIndicator.classList.remove('fade-out');
    }
  };
  const handleWhiteLineBorder = (scrollY) => {
    // Safety check in case the element doesn't exist
    if (!menuNavWrapper) return;
    
    // Check if the user has scrolled past the trigger point
    if (scrollY > 500) {
      // Add the .scrolled class to trigger the white border in CSS
      if (!menuNavWrapper.classList.contains('scrolled')) console.log('[DEBUG] Sticky nav active. Adding .scrolled class for white border.');
      menuNavWrapper.classList.add('scrolled');
    } else {
      // Remove the class if the user scrolls back to the top
      if (menuNavWrapper.classList.contains('scrolled')) console.log('[DEBUG] Sticky nav inactive. Removing .scrolled class.');
      menuNavWrapper.classList.remove('scrolled');
    }
  };

  // --- 3. CREATE MASTER SCROLL LISTENER ---
  const onScroll = () => {
    const scrollY = scroller.scrollTop;
    // console.log(`[DEBUG] Scroll event fired. Y: ${Math.round(scrollY)}`); // This can be very noisy, uncomment if needed.
    //handleStickyNavScroll(scrollY);
    handleHeaderScroll(scrollY);
    handleScrollIndicator(scrollY);
    handleWhiteLineBorder(scrollY)
  };

  // --- 4. INITIALIZE EVERYTHING ---
  console.log('[DEBUG] Step 4: Initializing listeners and setup functions.');
  scroller.addEventListener('scroll', onScroll, { passive: true });
  console.log('[DEBUG] Master scroll listener attached to .parallax-container.');
  
  // A small timeout ensures elements have their final dimensions before we measure them.
  console.log('[DEBUG] Scheduling setupStickyNav() to run in 100ms.');
  setTimeout(setupStickyNav, 100);

  window.addEventListener('resize', setupStickyNav);
  console.log('[DEBUG] Resize listener attached to window.');


  // --- 5. SMOOTH SCROLLING FOR MENU LINKS ---
  if (menuNavLinks.length > 0 && mainHeader && menuNav) {
    menuNavLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        
        if (targetElement) {
          // Calculation needs a slight adjustment for sticky positioning
          const headerHeight = mainHeader.offsetHeight;
          const menuNavHeight = menuNav.offsetHeight;
          // The total space taken up by the fixed/sticky elements at the top
          const totalOffset = headerHeight + menuNavHeight;
          
          // The target's position from the top of the scroller, minus the offset
          const scrollTarget = targetElement.offsetTop - totalOffset;
          
          scroller.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        } else {
            console.error(`[DEBUG] ERROR: Smooth scroll target element '${targetId}' not found.`);
        }
      });
    });
  }

  // --- 6. FADE-IN ELEMENTS ON SCROLL (INTERSECTION OBSERVER) ---
  const elementsToWatch = document.querySelectorAll('.splash-text, .minor-splash-text, .opening-hours-text, .location-text, .awards, .gallery img, .awards-plaque');
  console.log(`[DEBUG] Step 6: Setting up Intersection Observer for ${elementsToWatch.length} elements.`);

  if (elementsToWatch.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          console.log('[DEBUG] Element is intersecting (visible):', entry.target);
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
          console.log('[DEBUG] Unobserving element to save performance.');
        }
      });
    }, {
      root: scroller,
      rootMargin: '0px 0px -50px 0px',
      threshold: 0.1
    });
    elementsToWatch.forEach(el => observer.observe(el));
    console.log('[DEBUG] All elements are now being observed.');
  } else {
      console.log('[DEBUG] No elements found to attach to the Intersection Observer.');
  }
});