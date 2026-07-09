(function initPcControlSystem() {
  if (document.getElementById('pcc-injected')) return;
  const marker = document.createElement('div');
  marker.id = 'pcc-injected';
  marker.style.display = 'none';
  document.body.appendChild(marker);

  // Note: CSS link is expected to be in dashboard.html or appended here
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/pc-control.css';
  document.head.appendChild(link);

  const isPresenter = !window.location.href.includes('dashboard');
  if (isPresenter) return; // Only dashboard has the controller

  let socket = window.io ? io() : null;
  // If socket is not globally available yet, we try to grab it from window or assume it exists later
  
  function emitCommand(event, data) {
    const targetUuid = document.getElementById('pcc-device-id')?.value.trim();
    if (!targetUuid) return;
    
    const payload = { targetUuid, command: event, data };
    
    if (typeof window.socket !== 'undefined') {
      window.socket.emit('pc-control', payload);
    } else if (socket) {
      socket.emit('pc-control', payload);
    } else {
      console.warn("PC Control: Socket not found.");
    }
  }

  const savedDeviceId = localStorage.getItem('pcc_device_id') || '';

  // Create UI
  const uiHTML = `
    <div id="pc-control-overlay">
      <div class="pc-control-panel">
        <div class="pcc-header">
          <h3>🎮 PC Controller</h3>
          <button type="button" class="pcc-close-btn" id="pcc-close-btn">✕</button>
        </div>
        
        <div class="pcc-device-id-container">
          <input type="text" id="pcc-device-id" placeholder="Enter 6-digit Device ID" value="${savedDeviceId}" maxlength="6" autocomplete="off">
        </div>
        
        <div class="pcc-trackpad-area">
          <div class="pcc-trackpad" id="pcc-trackpad"></div>
          <div class="pcc-scroll" id="pcc-scroll"></div>
        </div>

        <div class="pcc-keyboard">
          <input type="text" id="pcc-keyboard-input" placeholder="Type text here to send..." autocomplete="off">
          <div class="pcc-keyboard-actions">
            <button class="pcc-key-btn" data-key="enter">Enter</button>
            <button class="pcc-key-btn" data-key="backspace">Backspace</button>
            <button class="pcc-key-btn" data-key="space">Space</button>
            <button class="pcc-key-btn" data-key="escape">Esc</button>
            <button class="pcc-key-btn" data-key="f5">F5</button>
            <button class="pcc-key-btn" data-key="f11">F11</button>
            <button class="pcc-key-btn" data-key="up">↑</button>
            <button class="pcc-key-btn" data-key="down">↓</button>
            <button class="pcc-key-btn" data-key="left">←</button>
            <button class="pcc-key-btn" data-key="right">→</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', uiHTML);

  // Setup floating buttons container if it doesn't exist
  let container = document.getElementById('floating-buttons-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'floating-buttons-container';
    document.body.appendChild(container);
  }

  // Add the trigger button
  const triggerBtn = document.createElement('button');
  triggerBtn.type = 'button';
  triggerBtn.id = 'pc-control-trigger-btn';
  triggerBtn.title = 'Open PC Controller';
  triggerBtn.innerHTML = '<span>🖱️</span><span class="pcc-label">Control PC</span>';
  // Insert at top of container (so it sits above the Board button if Board button is appended later)
  container.prepend(triggerBtn);

  // Logic
  const overlay = document.getElementById('pc-control-overlay');
  const closeBtn = document.getElementById('pcc-close-btn');
  const trackpad = document.getElementById('pcc-trackpad');
  const scrollArea = document.getElementById('pcc-scroll');
  const kbInput = document.getElementById('pcc-keyboard-input');
  const deviceIdInput = document.getElementById('pcc-device-id');
  
  deviceIdInput.addEventListener('input', (e) => {
    localStorage.setItem('pcc_device_id', e.target.value.trim());
  });

  triggerBtn.addEventListener('click', () => {
    overlay.classList.add('active');
  });

  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('active');
  });

  // Trackpad Logic
  let lastX = 0, lastY = 0;
  let isTracking = false;
  let trackMoved = false;
  let maxTouches = 0;

  const startTrack = (e) => {
    isTracking = true;
    trackMoved = false;
    maxTouches = e.touches ? e.touches.length : 1;
    const pt = e.touches ? e.touches[0] : e;
    lastX = pt.clientX;
    lastY = pt.clientY;
    e.preventDefault();
  };

  const moveTrack = (e) => {
    if (!isTracking) return;
    if (e.touches && e.touches.length > maxTouches) {
        maxTouches = e.touches.length;
    }
    const pt = e.touches ? e.touches[0] : e;
    const dx = pt.clientX - lastX;
    const dy = pt.clientY - lastY;
    
    // Send movement if significant
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      trackMoved = true;
      // Multiply by a sensitivity factor if desired
      emitCommand('mouse:move', { dx: dx * 1.5, dy: dy * 1.5 });
      lastX = pt.clientX;
      lastY = pt.clientY;
    }
    e.preventDefault();
  };

  const endTrack = (e) => {
    if (isTracking && !trackMoved) {
      if (maxTouches === 1) {
        emitCommand('mouse:leftClick');
      } else if (maxTouches >= 2) {
        emitCommand('mouse:rightClick');
      }
    }
    isTracking = false;
    maxTouches = 0;
  };

  trackpad.addEventListener('touchstart', startTrack, { passive: false });
  trackpad.addEventListener('touchmove', moveTrack, { passive: false });
  trackpad.addEventListener('touchend', endTrack);
  trackpad.addEventListener('touchcancel', endTrack);
  
  trackpad.addEventListener('mousedown', startTrack);
  window.addEventListener('mousemove', moveTrack);
  window.addEventListener('mouseup', endTrack);

  // Scroll Logic
  let lastScrollY = 0;
  let isScrolling = false;

  const startScroll = (e) => {
    isScrolling = true;
    const pt = e.touches ? e.touches[0] : e;
    lastScrollY = pt.clientY;
    e.preventDefault();
  };

  const moveScroll = (e) => {
    if (!isScrolling) return;
    const pt = e.touches ? e.touches[0] : e;
    const dy = pt.clientY - lastScrollY;
    
    if (Math.abs(dy) > 2) {
      // Nut.js scroll positive is usually down, negative is up
      // Swiping up means pushing content up (scrolling down)
      emitCommand('mouse:scroll', { amount: dy * 2 });
      lastScrollY = pt.clientY;
    }
    e.preventDefault();
  };

  const endScroll = () => { isScrolling = false; };

  scrollArea.addEventListener('touchstart', startScroll, { passive: false });
  scrollArea.addEventListener('touchmove', moveScroll, { passive: false });
  scrollArea.addEventListener('touchend', endScroll);
  scrollArea.addEventListener('mousedown', startScroll);
  
  // Need window handlers for mouse scrolling leaving area
  const scrollMouseMove = (e) => { if(isScrolling) moveScroll(e); };
  const scrollMouseUp = () => { if(isScrolling) endScroll(); };
  window.addEventListener('mousemove', scrollMouseMove);
  window.addEventListener('mouseup', scrollMouseUp);


  // Keyboard text input - track delta to avoid duplicate emits on mobile IME
  let lastKbValue = '';
  kbInput.addEventListener('input', () => {
    const newValue = kbInput.value;
    if (newValue.length < lastKbValue.length) {
      // Deletion occurred (e.g., via mobile keyboard backspace)
      const diff = lastKbValue.length - newValue.length;
      for (let i = 0; i < diff; i++) {
        emitCommand('keyboard:keyTap', { key: 'backspace' });
      }
    } else if (newValue.length > lastKbValue.length) {
      // Characters were added — only send the truly new ones
      const newChars = newValue.slice(lastKbValue.length);
      if (newChars) {
        emitCommand('keyboard:type', { text: newChars });
      }
    }
    lastKbValue = newValue;
  });

  // keydown: only handle special keys that don't go through the input event
  kbInput.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
      emitCommand('keyboard:keyTap', { key: 'backspace' });
      lastKbValue = kbInput.value.slice(0, -1); // keep lastKbValue in sync
    } else if (e.key === 'Enter') {
      emitCommand('keyboard:keyTap', { key: 'enter' });
      kbInput.value = '';
      lastKbValue = '';
    }
  });

  // Quick action keys
  document.querySelectorAll('.pcc-key-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.target.getAttribute('data-key');
      emitCommand('keyboard:keyTap', { key });
    });
  });

})();
