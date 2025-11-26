

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
  const ourMenuBttn = document.querySelector('.our-menu-button')



// Check if all necessary gallery elements exist on the page
if (gallery && prevBtn && nextBtn) {
  const images = gallery.querySelectorAll('img');

  if (images.length > 0) {
    const gap = 30; // Define the gap once

    // --- NEW: A function to handle the centering logic ---
    const centerGallery = () => {
      const middleIndex = Math.floor(images.length / 2);
      const imageWidth = images[0].offsetWidth;
      const scrollAmount = middleIndex * (imageWidth + gap);
      
      gallery.scrollTo({
        left: scrollAmount,
        behavior: 'auto' 
      });
    };

    // --- NEW: Call the function when the page loads ---
    window.addEventListener('load', centerGallery);

    // --- NEW: Also call it when the window is resized ---
    // We use a "debounce" timer to avoid running the code too often during a resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      // Wait 250ms after the user stops resizing, then run the function
      resizeTimer = setTimeout(centerGallery, 250);
    });

    // --- YOUR EXISTING CLICK LOGIC ---
    nextBtn.addEventListener('click', () => {
      const imageWidth = images[0].offsetWidth;
      gallery.scrollBy({
        left: imageWidth + gap,
        behavior: 'smooth'
      });
    });

    prevBtn.addEventListener('click', () => {
      const imageWidth = images[0].offsetWidth;
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
  
  const handleScrollFadeElements = (scrollY) => {
    // Determine the condition once
    const shouldFadeOut = scrollY > 50;

    // Apply the logic to the scroll indicator if it exists
    if (scrollIndicator) {
        // classList.toggle is perfect for this.
        // It adds the class if shouldFadeOut is true, and removes it if false.
        scrollIndicator.classList.toggle('fade-out', shouldFadeOut);
    }

    // Apply the exact same logic to the menu button if it exists
    if (ourMenuBttn) {
        ourMenuBttn.classList.toggle('fade-out', shouldFadeOut);
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
    handleScrollFadeElements(scrollY);
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



  // --- 6. FADE-IN ELEMENTS ON SCROLL (INTERSECTION OBSERVER) ---
  const elementsToWatch = document.querySelectorAll('.splash-text, .minor-splash-text, .opening-hours-text, .location-text, .awards, .gallery img, .awards-plaque, .our-menu');
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