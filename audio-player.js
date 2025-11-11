// Audio Player Module
(function() {
  'use strict';

  let albumData = null;
  let currentTrackIndex = 0;
  let audio = null;
  let isPlaying = false;
  let updateInterval = null;
  let progressBarListenersAttached = false;
  let isLoadingTrack = false;
  let loadingTimeout = null;

  // Initialize audio player
  function initAudioPlayer(jsonPath) {
    const playerContainer = document.getElementById('audio-player');
    if (!playerContainer) {
      console.error('Audio player container not found');
      return;
    }

    // Show loading state
    playerContainer.innerHTML = '<div class="audio-player__loading">Loading album...</div>';

    // Load album data
    fetch(jsonPath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load album data: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        albumData = data;
        renderPlayer();
        initializeAudio();
        setupMediaSession();
      })
      .catch(error => {
        console.error('Error loading album:', error);
        playerContainer.innerHTML = `<div class="audio-player__error">Error loading album: ${error.message}</div>`;
      });
  }

  // Render player UI
  function renderPlayer() {
    const playerContainer = document.getElementById('audio-player');
    if (!playerContainer || !albumData) return;

    const audioPath = albumData.audioPath || 'assets/audio/';
    const artwork = albumData.artwork || 'assets/hero.jpg';

    playerContainer.innerHTML = `
      <div class="audio-player__container">
        <div class="audio-player__player-section">
          <div class="audio-player__artwork">
            <img src="${artwork}" alt="${albumData.title}" />
          </div>

          <div class="audio-player__progress-container">
            <div class="audio-player__progress-bar" id="progress-bar">
              <div class="audio-player__progress-fill" id="progress-fill"></div>
            </div>
            <div class="audio-player__time">
              <span id="current-time">0:00</span>
              <span id="total-time">0:00</span>
            </div>
          </div>

          <div class="audio-player__controls">
            <button class="audio-player__control-btn" id="prev-btn" aria-label="Previous track">
              <i class="fas fa-backward-step" aria-hidden="true"></i>
            </button>
            <button class="audio-player__control-btn audio-player__control-btn--play" id="play-pause-btn" aria-label="Play">
              <i class="fas fa-play" id="play-pause-icon" aria-hidden="true"></i>
            </button>
            <button class="audio-player__control-btn" id="next-btn" aria-label="Next track">
              <i class="fas fa-forward-step" aria-hidden="true"></i>
            </button>
          </div>

          <div class="audio-player__track-info">
            <div class="audio-player__track-info-item" id="current-track-title">${albumData.tracks[0].title}</div>
            <div class="audio-player__track-info-item" id="current-artist">${albumData.artist || ''}</div>
            <div class="audio-player__track-info-item" id="current-album">${albumData.title}</div>
          </div>
        </div>

        <div class="audio-player__track-list">
          <h3 class="audio-player__track-list-title">Track List</h3>
          <div id="track-list-container"></div>
        </div>

        <div class="audio-player__credits" id="credits-container" style="display: none;">
        </div>
      </div>
    `;

    // Render track list
    renderTrackList();

    // Update credits display
    updateCredits();

    // Attach event listeners
    attachEventListeners();
  }

  // Render track list
  function renderTrackList() {
    const trackListContainer = document.getElementById('track-list-container');
    if (!trackListContainer || !albumData) return;

    trackListContainer.innerHTML = albumData.tracks.map((track, index) => {
      const isActive = index === currentTrackIndex;
      const activeClass = isActive ? (isPlaying ? 'audio-player__track-item--playing' : 'audio-player__track-item--active') : '';
      return `
        <div class="audio-player__track-item ${activeClass}" data-track-index="${index}">
          <span class="audio-player__track-number">${index + 1}</span>
          <span class="audio-player__track-title">${track.title}</span>
          <span class="audio-player__track-duration" id="track-duration-${index}">-:--</span>
        </div>
      `;
    }).join('');

    // Attach click handlers to track items
    trackListContainer.querySelectorAll('.audio-player__track-item').forEach(item => {
      item.addEventListener('click', () => {
        const trackIndex = parseInt(item.dataset.trackIndex);
        playTrack(trackIndex);
      });
    });
  }

  // Render credits section
  function renderCredits() {
    if (!albumData) return '';

    const track = albumData.tracks[currentTrackIndex];
    const hasSongCredits = track && track.credits && track.credits.trim() !== '';
    const hasAlbumCredits = albumData.albumCredits && albumData.albumCredits.trim() !== '';

    if (!hasSongCredits && !hasAlbumCredits) {
      return '';
    }

    let html = '';

    if (hasSongCredits) {
      html += `
        <div class="audio-player__credits-section">
          <h3 class="audio-player__credits-title">Song Credits</h3>
          <div class="audio-player__track-credits" id="song-credits">${track.credits}</div>
        </div>
      `;
    }

    if (hasAlbumCredits) {
      html += `
        <div class="audio-player__credits-section">
          <h3 class="audio-player__credits-title">Album Credits</h3>
          <div class="audio-player__album-credits">${albumData.albumCredits}</div>
        </div>
      `;
    }

    return html;
  }

  // Update credits display
  function updateCredits() {
    const creditsContainer = document.getElementById('credits-container');
    if (!creditsContainer || !albumData) return;

    const creditsHtml = renderCredits();
    
    if (creditsHtml === '') {
      creditsContainer.style.display = 'none';
    } else {
      creditsContainer.style.display = 'block';
      creditsContainer.innerHTML = creditsHtml;
    }
  }

  // Initialize audio element
  function initializeAudio() {
    if (!albumData) return;

    // Create audio element if it doesn't exist
    if (!audio) {
      audio = new Audio();
      
      // Enable preload for better mobile support
      audio.preload = 'metadata';
      
      // Handle track end
      audio.addEventListener('ended', () => {
        if (currentTrackIndex < albumData.tracks.length - 1) {
          playTrack(currentTrackIndex + 1);
        } else {
          // Reached end of album
          isPlaying = false;
          updatePlayPauseButton();
          stopProgressUpdate();
        }
      });

      // Handle loaded metadata
      audio.addEventListener('loadedmetadata', () => {
        isLoadingTrack = false;
        updateTotalTime();
        updateTrackDuration(currentTrackIndex);
      });

      // Handle duration change (duration might not be available immediately)
      audio.addEventListener('durationchange', () => {
        if (audio.duration && isFinite(audio.duration)) {
          isLoadingTrack = false;
          updateTotalTime();
          updateTrackDuration(currentTrackIndex);
        }
      });

      // Handle time updates
      audio.addEventListener('timeupdate', updateProgress);

      // Handle errors
      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        const errorMsg = audio.error ? `Error loading audio: ${audio.error.message}` : 'Error loading audio file';
        showError(errorMsg);
      });

      // Handle canplay
      audio.addEventListener('canplay', () => {
        // Update duration when available
        if (audio.duration) {
          updateTrackDuration(currentTrackIndex);
        }
      });
    }

    // Load first track
    loadTrack(0);
  }

  // Load a track
  function loadTrack(index) {
    if (!albumData || !audio) return;

    if (index < 0 || index >= albumData.tracks.length) {
      console.error('Invalid track index:', index);
      return;
    }

    // Clear any existing loading timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      loadingTimeout = null;
    }
    
    isLoadingTrack = true;
    currentTrackIndex = index;
    const track = albumData.tracks[index];
    const audioPath = albumData.audioPath || 'assets/audio/';
    const fullPath = audioPath + track.file;

    // Stop current playback and reset progress
    audio.pause();
    isPlaying = false;
    stopProgressUpdate();
    
    // Reset progress bar visually
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
      progressFill.style.width = '0%';
    }
    const currentTimeEl = document.getElementById('current-time');
    if (currentTimeEl) {
      currentTimeEl.textContent = '0:00';
    }

    // Load new track
    audio.src = fullPath;
    audio.currentTime = 0;
    
    // Fallback: clear loading flag after a timeout (in case metadata never loads)
    loadingTimeout = setTimeout(() => {
      isLoadingTrack = false;
      loadingTimeout = null;
    }, 5000);
    
    // Set up one-time listener to clear loading flag when metadata is loaded
    const onLoadedMetadata = () => {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
      }
      isLoadingTrack = false;
    };
    audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    
    audio.load();

    // Update UI
    updateTrackInfo();
    updatePlayPauseButton();
    updateTrackList();
    updateCredits();
    updateMediaSession();
  }

  // Play a specific track
  function playTrack(index) {
    if (index === currentTrackIndex && audio) {
      // Same track - toggle play/pause
      togglePlayPause();
    } else {
      // Different track - load and play
      loadTrack(index);
      play();
    }
  }

  // Play audio
  function play() {
    if (!audio) return;

    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isPlaying = true;
          updatePlayPauseButton();
          startProgressUpdate();
          updateTrackList();
          updateMediaSessionPlaybackState();
        })
        .catch(error => {
          console.error('Playback failed:', error);
          // User interaction may be required on mobile
          showError('Playback requires user interaction. Please click play.');
        });
    }
  }

  // Pause audio
  function pause() {
    if (!audio) return;
    
    audio.pause();
    isPlaying = false;
    updatePlayPauseButton();
    stopProgressUpdate();
    updateTrackList();
    updateMediaSessionPlaybackState();
  }

  // Toggle play/pause
  function togglePlayPause() {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  // Play next track
  function playNext() {
    if (!albumData) return;
    
    if (currentTrackIndex < albumData.tracks.length - 1) {
      playTrack(currentTrackIndex + 1);
    }
  }

  // Play previous track
  function playPrevious() {
    if (!albumData) return;
    
    if (currentTrackIndex > 0) {
      playTrack(currentTrackIndex - 1);
    } else if (audio && audio.currentTime > 3) {
      // If more than 3 seconds into track, restart from beginning
      audio.currentTime = 0;
    } else {
      // Go to previous track (wrap to end if at start)
      playTrack(albumData.tracks.length - 1);
    }
  }

  // Update progress bar
  function updateProgress() {
    if (!audio) return;

    const progress = (audio.currentTime / audio.duration) * 100;
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
      progressFill.style.width = progress + '%';
    }

    updateCurrentTime();
  }

  // Update current time display
  function updateCurrentTime() {
    if (!audio) return;

    const currentTimeEl = document.getElementById('current-time');
    if (currentTimeEl) {
      currentTimeEl.textContent = formatTime(audio.currentTime);
    }
  }

  // Update total time display
  function updateTotalTime() {
    if (!audio) return;

    const totalTimeEl = document.getElementById('total-time');
    if (totalTimeEl && audio.duration) {
      totalTimeEl.textContent = formatTime(audio.duration);
    }
  }

  // Update track duration in track list
  function updateTrackDuration(index) {
    if (!audio || !audio.duration) return;

    const durationEl = document.getElementById(`track-duration-${index}`);
    if (durationEl) {
      durationEl.textContent = formatTime(audio.duration);
    }
  }

  // Format time (seconds to MM:SS)
  function formatTime(seconds) {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Start progress update interval
  function startProgressUpdate() {
    stopProgressUpdate();
    updateInterval = setInterval(() => {
      if (audio && isPlaying) {
        updateProgress();
      }
    }, 100);
  }

  // Stop progress update interval
  function stopProgressUpdate() {
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  }

  // Update track info display
  function updateTrackInfo() {
    if (!albumData) return;

    const track = albumData.tracks[currentTrackIndex];
    const trackTitleEl = document.getElementById('current-track-title');

    if (trackTitleEl) {
      trackTitleEl.textContent = track.title;
    }
  }

  // Update play/pause button
  function updatePlayPauseButton() {
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playPauseIcon = document.getElementById('play-pause-icon');

    if (playPauseBtn && playPauseIcon) {
      if (isPlaying) {
        playPauseIcon.className = 'fas fa-pause';
        playPauseBtn.setAttribute('aria-label', 'Pause');
      } else {
        playPauseIcon.className = 'fas fa-play';
        playPauseBtn.setAttribute('aria-label', 'Play');
      }
    }

    // Update prev/next button states
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (prevBtn) {
      prevBtn.disabled = currentTrackIndex === 0 && (!audio || audio.currentTime <= 3);
    }

    if (nextBtn && albumData) {
      nextBtn.disabled = currentTrackIndex >= albumData.tracks.length - 1;
    }
  }

  // Update track list highlighting
  function updateTrackList() {
    const trackItems = document.querySelectorAll('.audio-player__track-item');
    trackItems.forEach((item, index) => {
      item.classList.remove('audio-player__track-item--active', 'audio-player__track-item--playing');
      if (index === currentTrackIndex) {
        if (isPlaying) {
          item.classList.add('audio-player__track-item--playing');
        } else {
          item.classList.add('audio-player__track-item--active');
        }
      }
    });
  }

  // Attach event listeners
  function attachEventListeners() {
    // Play/pause button
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', togglePlayPause);
    }

    // Previous button
    const prevBtn = document.getElementById('prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', playPrevious);
    }

    // Next button
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', playNext);
    }

    // Progress bar scrubbing - only attach listeners once
    const progressBar = document.getElementById('progress-bar');
    if (progressBar && !progressBarListenersAttached) {
      let isDragging = false;

      const getProgressFromEvent = (e) => {
        const rect = progressBar.getBoundingClientRect();
        const clientX = e.clientX || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0);
        if (clientX === undefined || clientX === null) return null;

        const x = clientX - rect.left;
        return Math.max(0, Math.min(1, x / rect.width));
      };

      const handleProgressSeek = (e) => {
        if (!audio) return;
        
        // Don't allow seeking while a track is loading
        if (isLoadingTrack) {
          return;
        }
        
        // Wait for audio to be ready and have a valid duration
        // readyState: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
        if (audio.readyState < 1) {
          // Metadata not loaded yet - wait for it
          return;
        }
        
        if (!audio.duration || !isFinite(audio.duration) || audio.duration <= 0 || isNaN(audio.duration)) {
          return;
        }

        const percent = getProgressFromEvent(e);
        if (percent === null || percent < 0 || percent > 1) return;

        const newTime = percent * audio.duration;
        if (isFinite(newTime) && !isNaN(newTime) && newTime >= 0 && newTime <= audio.duration) {
          try {
            // Only seek if audio is in a valid state
            if (audio.readyState >= 1 && !isLoadingTrack) {
              audio.currentTime = newTime;
              updateProgress();
            }
          } catch (err) {
            console.error('Error seeking audio:', err);
          }
        }
      };

      // Click handling - use capture phase to ensure we handle it first
      progressBar.addEventListener('click', (e) => {
        e.stopPropagation();
        handleProgressSeek(e);
      }, true);
      
      const handleTouchEnd = (e) => {
        e.stopPropagation();
        if (!isDragging) {
          handleProgressSeek(e);
        }
        isDragging = false;
      };
      progressBar.addEventListener('touchend', handleTouchEnd, { passive: false });

      // Drag handling for smooth scrubbing
      const handleMouseDown = (e) => {
        isDragging = true;
        handleProgressSeek(e);
      };
      progressBar.addEventListener('mousedown', handleMouseDown);

      const handleMouseMove = (e) => {
        progressBar.style.cursor = 'pointer';
        if (isDragging && e.buttons === 1) {
          handleProgressSeek(e);
        }
      };
      progressBar.addEventListener('mousemove', handleMouseMove);

      const handleMouseUp = () => {
        isDragging = false;
      };
      progressBar.addEventListener('mouseup', handleMouseUp);
      progressBar.addEventListener('mouseleave', handleMouseUp);

      // Touch drag handling
      const handleTouchStart = (e) => {
        isDragging = true;
        e.preventDefault();
        handleProgressSeek(e);
      };
      progressBar.addEventListener('touchstart', handleTouchStart, { passive: false });

      const handleTouchMove = (e) => {
        if (isDragging) {
          e.preventDefault();
          handleProgressSeek(e);
        }
      };
      progressBar.addEventListener('touchmove', handleTouchMove, { passive: false });

      progressBar.addEventListener('touchcancel', () => {
        isDragging = false;
      });

      progressBarListenersAttached = true;
    }
  }

  // Setup Media Session API for mobile lock screen controls
  function setupMediaSession() {
    if (!('mediaSession' in navigator) || !albumData) return;

    const track = albumData.tracks[currentTrackIndex];
    const artwork = albumData.artwork || 'assets/hero.jpg';

    // Set initial metadata
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: albumData.artist || 'good carver',
      album: albumData.title,
      artwork: [
        { src: artwork, sizes: '512x512', type: 'image/jpeg' }
      ]
    });

    // Set action handlers
    navigator.mediaSession.setActionHandler('play', () => {
      play();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      pause();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      playPrevious();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playNext();
    });

    // Update playback state
    updateMediaSessionPlaybackState();
  }

  // Update Media Session metadata
  function updateMediaSession() {
    if (!('mediaSession' in navigator) || !albumData) return;

    const track = albumData.tracks[currentTrackIndex];
    const artwork = albumData.artwork || 'assets/hero.jpg';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: albumData.artist || 'good carver',
      album: albumData.title,
      artwork: [
        { src: artwork, sizes: '512x512', type: 'image/jpeg' }
      ]
    });

    updateMediaSessionPlaybackState();
  }

  // Update Media Session playback state
  function updateMediaSessionPlaybackState() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }

  // Show error message
  function showError(message) {
    const playerContainer = document.getElementById('audio-player');
    if (playerContainer) {
      const errorEl = document.createElement('div');
      errorEl.className = 'audio-player__error';
      errorEl.textContent = message;
      playerContainer.appendChild(errorEl);

      // Remove error after 5 seconds
      setTimeout(() => {
        if (errorEl.parentNode) {
          errorEl.parentNode.removeChild(errorEl);
        }
      }, 5000);
    }
  }

  // Expose init function globally
  window.initAudioPlayer = initAudioPlayer;
})();

