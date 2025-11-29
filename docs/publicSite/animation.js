document.addEventListener('DOMContentLoaded', () => {

  // =========================================================================
  //  1. ELEMENT SELECTIONS
  // =========================================================================
  const elements = {
      mainHeader: document.querySelector('.main-header'),
      menuNav: document.querySelector('.menu-nav'),
      menuNavWrapper: document.querySelector('.menu-nav-wrapper'),
      scrollIndicator: document.querySelector('.scroll-down-indicator'),
      scroller: document.querySelector('.parallax-container'), // Main scroll wrapper
      gallery: document.querySelector('.gallery'),
      prevBtn: document.getElementById('prev-btn'),
      nextBtn: document.getElementById('next-btn'),
      ourMenuBttn: document.querySelector('.our-menu-button'),
      
      // Modal Elements
      welcomeModal: document.getElementById('welcome-modal'),
      enterBtn: document.getElementById('enter-site-btn'),
      closeWelcomeBtn: document.getElementById('close-welcome'),
      
      itemsToWatch: document.querySelectorAll('.splash-text, .minor-splash-text, .opening-hours-text, .location-text, .awards, .gallery img, .awards-plaque, .our-menu')
  };

  if (!elements.scroller) return; // Critical fail-safe

  // =========================================================================
  //  3. CACHED VALUES (Scroll Performance)
  // =========================================================================
  let state = {
      windowHeight: window.innerHeight,
      headerHeight: elements.mainHeader ? elements.mainHeader.offsetHeight : 0,
      isTicking: false
  };

  window.addEventListener('resize', () => {
      state.windowHeight = window.innerHeight;
      if (elements.mainHeader) state.headerHeight = elements.mainHeader.offsetHeight;
      setupStickyNav();
  });

  // =========================================================================
  //  4. GALLERY LOGIC
  // =========================================================================
  if (elements.gallery && elements.prevBtn && elements.nextBtn) {
      const images = elements.gallery.querySelectorAll('img');
      const gap = 30;
      let imageWidth = 0;

      const updateGalleryMetrics = () => {
          if (images.length > 0) imageWidth = images[0].offsetWidth;
      };

      const centerGallery = () => {
          if (images.length === 0) return;
          updateGalleryMetrics();
          const middleIndex = Math.floor(images.length / 2);
          const scrollAmount = middleIndex * (imageWidth + gap);
          elements.gallery.scrollTo({ left: scrollAmount, behavior: 'auto' });
      };

      let resizeTimer;
      window.addEventListener('resize', () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(centerGallery, 250);
      });

      elements.nextBtn.addEventListener('click', () => {
          if (imageWidth === 0) updateGalleryMetrics();
          elements.gallery.scrollBy({ left: imageWidth + gap, behavior: 'smooth' });
      });

      elements.prevBtn.addEventListener('click', () => {
          if (imageWidth === 0) updateGalleryMetrics();
          elements.gallery.scrollBy({ left: -(imageWidth + gap), behavior: 'smooth' });
      });

      window.addEventListener('load', centerGallery);
  }

  // =========================================================================
  //  5. SCROLL LOGIC
  // =========================================================================
  const setupStickyNav = () => {
      if (!elements.mainHeader || !elements.menuNav) return;
      const h = state.headerHeight || elements.mainHeader.offsetHeight;
      elements.menuNav.style.top = `${h}px`;
  };

  const onScroll = () => {
      const scrollY = elements.scroller.scrollTop;

      // Header Scroll Logic
      if (elements.mainHeader) {
          const shouldScroll = scrollY > state.windowHeight;
          const isScrolled = elements.mainHeader.classList.contains('scrolled');
          
          if (shouldScroll && !isScrolled) elements.mainHeader.classList.add('scrolled');
          else if (!shouldScroll && isScrolled) elements.mainHeader.classList.remove('scrolled');
      }

      // Fade Elements
      const shouldFadeOut = scrollY > 50;
      if (elements.scrollIndicator) elements.scrollIndicator.classList.toggle('fade-out', shouldFadeOut);
      if (elements.ourMenuBttn) elements.ourMenuBttn.classList.toggle('fade-out', shouldFadeOut);

      // Menu Nav Border
      if (elements.menuNavWrapper) {
          const shouldHaveBorder = scrollY > 500;
          const hasBorder = elements.menuNavWrapper.classList.contains('scrolled');
          
          if (shouldHaveBorder && !hasBorder) elements.menuNavWrapper.classList.add('scrolled');
          else if (!shouldHaveBorder && hasBorder) elements.menuNavWrapper.classList.remove('scrolled');
      }
      
      state.isTicking = false;
  };

  elements.scroller.addEventListener('scroll', () => {
      if (!state.isTicking) {
          window.requestAnimationFrame(onScroll);
          state.isTicking = true;
      }
  }, { passive: true });

  // Init
  setTimeout(setupStickyNav, 100);

  // =========================================================================
  //  6. INTERSECTION OBSERVER
  // =========================================================================
  if (elements.itemsToWatch.length > 0) {
      const observer = new IntersectionObserver((entries, obs) => {
          entries.forEach(entry => {
              if (entry.isIntersecting) {
                  entry.target.classList.add('visible');
                  obs.unobserve(entry.target);
              }
          });
      }, {
          root: elements.scroller,
          rootMargin: '0px 0px -50px 0px',
          threshold: 0.1
      });
      elements.itemsToWatch.forEach(el => observer.observe(el));
  }
});


document.addEventListener("DOMContentLoaded", () => {
    // --- CONFIGURATION ---
    const TESTING_MODE = true; // Set to TRUE to see popup every time (ignore storage)
    const STORAGE_KEY = 'seenWelcome_v1'; // Change name if you want to reset everyone

    const modal = document.getElementById('welcome-modal');
    const enterBtn = document.getElementById('enter-site-btn');
    const closeBtn = document.getElementById('close-welcome');

    // Safety check: if elements don't exist, stop running
    if (!modal) return;

    // --- LOGIC ---
    
    // 1. Check if user has seen it
    const hasSeenIt = sessionStorage.getItem(STORAGE_KEY);
    
    // If not testing AND they have seen it, do nothing
    if (!TESTING_MODE && hasSeenIt) {
        return; 
    }

    // 2. Helper function to close modal and unlock scroll
    const closeModal = () => {
        modal.classList.add('hidden');
        document.body.classList.remove('no-scroll'); // Unlock scroll
        
        // Remember that they saw it
        sessionStorage.setItem(STORAGE_KEY, 'true');
    };

    // 3. Show the modal (with slight delay for effect)
    setTimeout(() => {
        modal.classList.remove('hidden');
        document.body.classList.add('no-scroll'); // Lock scroll
    }, 1000);

    // 4. Click Listeners
    if (enterBtn) enterBtn.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // 5. "Click Outside" Listener (Backdrop)
    modal.addEventListener('click', (e) => {
        // If the click is on the dark background (not the inner content box)
        if (e.target === modal) {
            closeModal();
        }
    });

    // 6. Escape Key Listener
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
});
document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById('welcome-modal');
    const dismissLink = document.getElementById('dismiss-link');

    // We only add the listener IF the element actually exists
    if (dismissLink) {
        dismissLink.addEventListener('click', function(e) {
            e.preventDefault(); 
            if(modal) modal.classList.add('hidden');
        });
    }
    // -----------------------

    // Only run if modal is visible
    if(modal && !modal.classList.contains('hidden')) {
        createGoldLeaves();
    }


    function createGoldLeaves() {
        const particleCount = 60; // Number of flakes
        
        for (let i = 0; i < particleCount; i++) {
            const leaf = document.createElement('div');
            leaf.classList.add('gold-leaf-particle');
            
            // Random horizontal start position
            leaf.style.left = Math.random() * 100 + 'vw';
            
            // Random animation duration (speed)
            const duration = Math.random() * 3 + 4; // Between 4s and 7s
            leaf.style.animationDuration = duration + 's';
            
            // Random animation delay
            leaf.style.animationDelay = Math.random() * 7.5 + 's';
            
            // Random size for depth
            const size = Math.random() * 8 + 4; // 4px to 12px
            leaf.style.width = size + 'px';
            leaf.style.height = size + 'px';
            
            // Random gold variations (lighter/darker)
            const colors = ['#a2956b', '#bfb083', '#8a7d55'];
            leaf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            modal.appendChild(leaf);
        }
    }
});