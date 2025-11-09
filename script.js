(function() {
  const root = document.documentElement;
  const supportsReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Year in footer
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  // Title sequence animation
  const titleLines = Array.from(document.querySelectorAll('.title-line'));
  if (titleLines.length > 0) {
    let ticking = false;
    const handleTitleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const viewportY = window.scrollY;
        const scrollProgress = Math.max(0, Math.min(1, viewportY / (window.innerHeight * 0.6))); // Start revealing after 60% of viewport height scrolled
        
        titleLines.forEach((line, index) => {
          const lineDelay = index * 0.08; // Stagger each line by 0.08
          const lineProgress = Math.max(0, Math.min(1, (scrollProgress - lineDelay) / 0.2));
          
          console.log(`${lineProgress}`)
          if (lineProgress > 0) {
            line.classList.add('visible');
          } else {
            line.classList.remove('visible');
          }
        });
        
        ticking = false;
      });
    };

    if (!supportsReducedMotion) {
      window.addEventListener('scroll', handleTitleScroll, { passive: true });
      handleTitleScroll(); // Initial check
    } else {
      // If reduced motion is preferred, show all lines immediately
      titleLines.forEach(line => line.classList.add('visible'));
    }
  }

  // Google Calendar integration for shows
  const calendarId = 'goodcarvermusic@gmail.com';
  const apiKey = 'AIzaSyDs1cRj06Elmmpjmbq_F58djYKCbJdtSDI';
  
  async function loadShows() {
    const showsList = document.getElementById('shows-list');
    if (!showsList) return;
    
    try {
      const now = new Date().toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${now}&singleEvents=true&orderBy=startTime&maxResults=10`;
      
      console.log('Fetching calendar from:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        showsList.innerHTML = `<div class="no-shows">API Error ${response.status}: ${response.statusText}. Check console for details.</div>`;
        return;
      }
      
      const data = await response.json();
      console.log('Calendar data:', data);
      
      if (data.items && data.items.length > 0) {
        showsList.innerHTML = data.items.map(event => {
          const startDate = new Date(event.start.dateTime || event.start.date);
          const dateStr = startDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          });
          
          // Format time if available
          const timeStr = event.start.dateTime 
            ? startDate.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
              })
            : 'All Day';
          
          // Extract venue and location from event summary
          const summary = event.summary || 'TBA';
          const location = event.location || 'TBA';
          const description = event.description || '';
          
          // Create Google Maps link if location is provided
          const locationDisplay = location !== 'TBA' 
            ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}" target="_blank" rel="noopener">${location}</a>`
            : location;
          
          return `
            <div class="show-item">
              <div class="show-date-time">
                <span class="show-date">${dateStr}</span>
                <span class="show-time">${timeStr}</span>
              </div>
              <div class="show-main">
                <span class="show-venue">${summary}</span>
                <span class="show-location">${locationDisplay}</span>
                ${description ? `<div class="show-details">${description}</div>` : ''}
              </div>
            </div>
          `;
        }).join('');
      } else {
        showsList.innerHTML = '<div class="no-shows">No upcoming shows scheduled. Check back soon!</div>';
      }
    } catch (error) {
      console.error('Error loading shows:', error);
      showsList.innerHTML = '<div class="no-shows">Unable to load shows at this time.</div>';
    }
  }
  
  // Load shows when page loads
  loadShows();

  // Smooth scroll for in-page anchors (fallback for browsers not supporting CSS smooth-scroll)
  document.addEventListener('click', function(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.tagName.toLowerCase() !== 'a') return;
    const href = target.getAttribute('href') || '';
    if (!href.startsWith('#') || href.length === 1) return;
    const el = document.querySelector(href);
    if (!el) return;
    event.preventDefault();
    el.scrollIntoView({ behavior: supportsReducedMotion ? 'auto' : 'smooth', block: 'start' });
  });

  // Parallax handling
  const sections = Array.from(document.querySelectorAll('[data-parallax]'));
  if (sections.length === 0) return;

  let ticking = false;
  const handleScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      const viewportY = window.scrollY || window.pageYOffset;
      for (const section of sections) {
        const speedAttr = section.getAttribute('data-speed');
        const speed = speedAttr ? parseFloat(speedAttr) : 0.3;
        const rect = section.getBoundingClientRect();
        const offsetTop = viewportY + rect.top;
        const distance = viewportY - offsetTop;

        const img = section.querySelector('.parallax__img');
        if (!img) continue;

        // Parallax translation: bottom of image at viewport bottom (page top) 
        // to top of image at viewport top (page bottom)
        const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollProgress = Math.max(0, Math.min(1, viewportY / documentHeight));
        
        // Calculate how much the image needs to move down
        // At scrollProgress 0: bottom of image at viewport bottom (translateY = 0)
        // At scrollProgress 1: top of image at viewport top (translateY = imageHeight - viewportHeight)
        const imageHeight = img.offsetHeight;
        const viewportHeight = window.innerHeight;
        const maxTranslate = imageHeight - viewportHeight;
        const translateY = scrollProgress * maxTranslate;
        
        img.style.transform = `translate(-50%, ${translateY}px)`;
      }
      ticking = false;
    });
  };

  if (!supportsReducedMotion) {
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    handleScroll();
  }
})();


