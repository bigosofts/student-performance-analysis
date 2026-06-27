// js/whiteboard.js
// Inject styles and fabric.js dynamically
(function initWhiteboardSystem() {
  if (document.getElementById('wb-injected')) return;
  const marker = document.createElement('div');
  marker.id = 'wb-injected';
  marker.style.display = 'none';
  document.body.appendChild(marker);

  // 1. Inject CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/whiteboard.css';
  document.head.appendChild(link);

  // 2. Inject Fabric.js
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js';
  script.onload = () => setupWhiteboard();
  document.head.appendChild(script);

  const isPresenter = !window.location.href.includes('dashboard');

  function setupWhiteboard() {
    // 3. Inject UI
    const uiHTML = `
      <!-- Trigger Button (Dashboard Only) -->
      ${!isPresenter ? `<div id="wb-trigger-btn" title="Open Interactive Board">🖌️</div>` : ''}

      <!-- Overlay -->
      <div id="whiteboard-overlay" class="${isPresenter ? 'is-presenter' : ''}">
        <div id="whiteboard-bg" style="background: rgba(255,255,255,1);"></div>
        <div id="whiteboard-wrapper">
          <canvas id="wb-canvas"></canvas>
          
          <!-- Toolbar -->
          <div id="wb-toolbar">
            <button class="wb-tool-btn active" id="wb-tool-draw" title="Draw">✏️</button>
            <button class="wb-tool-btn" id="wb-tool-erase" title="Eraser">🧹</button>
            <button class="wb-tool-btn" id="wb-tool-select" title="Select/Move Objects">🖐️</button>
            
            <div class="wb-separator"></div>
            
            <button class="wb-tool-btn" id="wb-tool-rect" title="Add Rectangle">🟦</button>
            <button class="wb-tool-btn" id="wb-tool-circle" title="Add Circle">🔵</button>
            <button class="wb-tool-btn" id="wb-tool-triangle" title="Add Triangle">🔺</button>
            <button class="wb-tool-btn" id="wb-tool-star" title="Add Star">⭐</button>
            <button class="wb-tool-btn" id="wb-tool-arrow" title="Add Pointer/Arrow">➡️</button>
            <button class="wb-tool-btn" id="wb-tool-text" title="Add Emoji/Text">😄</button>
            
            <div class="wb-separator"></div>
            
            <div class="wb-control-group">
              <input type="color" id="wb-color" class="wb-color-picker" value="#000000" title="Pen Color">
            </div>
            <div class="wb-control-group">
              <span>Size</span>
              <input type="range" id="wb-size" class="wb-slider" min="1" max="50" value="5">
            </div>
            
            <div class="wb-separator"></div>
            
            <div class="wb-control-group">
              <span>BG Alpha</span>
              <input type="range" id="wb-bg-alpha" class="wb-slider" min="0" max="1" step="0.05" value="1" title="Background Transparency">
            </div>
            
            <div class="wb-separator"></div>
            
            <button class="wb-tool-btn" id="wb-tool-image" title="Add Image">🖼️</button>
            <input type="file" id="wb-image-input" accept="image/*" style="display:none;">
            
            <button class="wb-tool-btn" id="wb-tool-clear" title="Clear Canvas">🗑️</button>
            <button class="wb-tool-btn" id="wb-tool-save" title="Save PNG">💾</button>
            <button class="wb-tool-btn" id="wb-tool-close" title="Close Board">❌</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', uiHTML);

    const overlay = document.getElementById('whiteboard-overlay');
    const bg = document.getElementById('whiteboard-bg');
    const triggerBtn = document.getElementById('wb-trigger-btn');
    // ── FIXED CANVAS DIMENSIONS ──
    const CANVAS_WIDTH = 1920;
    const CANVAS_HEIGHT = 1080;

    // Initialize Fabric Canvas
    const canvas = new fabric.Canvas('wb-canvas', {
      isDrawingMode: true,
      selection: false,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      allowTouchScrolling: true // Let browser scroll if not interacting
    });

    // Make canvas responsive
    function resizeCanvas() {
      if (isPresenter) {
        // Presenter: Scale to fit perfectly in viewport
        const scale = Math.min(window.innerWidth / CANVAS_WIDTH, window.innerHeight / CANVAS_HEIGHT);
        const wrapper = document.querySelector('.canvas-container');
        if (wrapper) {
          wrapper.style.transform = `scale(${scale})`;
          
          // Center it
          const scaledW = CANVAS_WIDTH * scale;
          const scaledH = CANVAS_HEIGHT * scale;
          wrapper.style.marginLeft = `${(window.innerWidth - scaledW) / 2}px`;
          wrapper.style.marginTop = `${(window.innerHeight - scaledH) / 2}px`;
        }
      } else {
        // Dashboard: No CSS scale, allow native scrolling.
        // We will just let the wrapper overflow and native browser handle pinch-zoom.
      }
    }
    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 100); // Initial resize

    // Tools state
    let currentTool = 'draw'; // 'draw', 'erase', 'select'
    
    // Brush setup
    canvas.freeDrawingBrush.color = '#000000';
    canvas.freeDrawingBrush.width = 5;

    // Default Eraser brush (we will use a custom approach or just remove objects on click/swipe)
    // A robust eraser in Fabric is tricky. We'll implement an object eraser: in erase mode, touching an object removes it.
    
    // ── Tool Selection ──
    const btnDraw = document.getElementById('wb-tool-draw');
    const btnErase = document.getElementById('wb-tool-erase');
    const btnSelect = document.getElementById('wb-tool-select');
    
    function setActiveTool(tool) {
      if(isPresenter) return;
      currentTool = tool;
      btnDraw.classList.remove('active');
      btnErase.classList.remove('active');
      btnSelect.classList.remove('active');
      
      canvas.isDrawingMode = (tool === 'draw');
      canvas.selection = (tool === 'select');
      
      // Make objects selectable only in select mode
      canvas.getObjects().forEach(obj => {
        obj.selectable = (tool === 'select');
        obj.evented = (tool === 'select' || tool === 'erase');
      });
      
      if(tool === 'draw') btnDraw.classList.add('active');
      if(tool === 'erase') btnErase.classList.add('active');
      if(tool === 'select') btnSelect.classList.add('active');
    }

    if (!isPresenter) {
      btnDraw.onclick = () => setActiveTool('draw');
      btnErase.onclick = () => setActiveTool('erase');
      btnSelect.onclick = () => setActiveTool('select');
      
      // Properties
      document.getElementById('wb-color').onchange = (e) => {
        canvas.freeDrawingBrush.color = e.target.value;
      };
      document.getElementById('wb-size').oninput = (e) => {
        canvas.freeDrawingBrush.width = parseInt(e.target.value);
      };
      document.getElementById('wb-bg-alpha').oninput = (e) => {
        const val = e.target.value;
        bg.style.background = `rgba(255,255,255,${val})`;
        if (socket) socket.emit('wb-bg', val);
      };
      
      // Shapes
      document.getElementById('wb-tool-rect').onclick = () => {
        const rect = new fabric.Rect({
          left: window.innerWidth / 2 - 50, top: window.innerHeight / 2 - 50, fill: document.getElementById('wb-color').value,
          width: 100, height: 100, id: Date.now().toString()
        });
        canvas.add(rect);
        setActiveTool('select');
        syncAdd(rect);
      };
      
      document.getElementById('wb-tool-circle').onclick = () => {
        const circle = new fabric.Circle({
          left: window.innerWidth / 2 - 50, top: window.innerHeight / 2 - 50, fill: document.getElementById('wb-color').value,
          radius: 50, id: Date.now().toString()
        });
        canvas.add(circle);
        setActiveTool('select');
        syncAdd(circle);
      };

      document.getElementById('wb-tool-triangle').onclick = () => {
        const tri = new fabric.Triangle({
          left: window.innerWidth / 2 - 50, top: window.innerHeight / 2 - 50, fill: document.getElementById('wb-color').value,
          width: 100, height: 100, id: Date.now().toString()
        });
        canvas.add(tri);
        setActiveTool('select');
        syncAdd(tri);
      };

      document.getElementById('wb-tool-star').onclick = () => {
        // Fabric doesn't have a native 'Star' class, we use a Polygon
        const pts = [
            {x: 50, y: 0}, {x: 61, y: 35}, {x: 98, y: 35},
            {x: 68, y: 57}, {x: 79, y: 91}, {x: 50, y: 70},
            {x: 21, y: 91}, {x: 32, y: 57}, {x: 2, y: 35}, {x: 39, y: 35}
        ];
        const star = new fabric.Polygon(pts, {
          left: window.innerWidth / 2 - 50, top: window.innerHeight / 2 - 50, fill: document.getElementById('wb-color').value,
          id: Date.now().toString()
        });
        canvas.add(star);
        setActiveTool('select');
        syncAdd(star);
      };

      document.getElementById('wb-tool-arrow').onclick = () => {
        // Draw an arrow using Path
        const path = "M 0 50 L 100 50 M 70 20 L 100 50 L 70 80";
        const arrow = new fabric.Path(path, {
          left: window.innerWidth / 2 - 50, top: window.innerHeight / 2 - 50,
          fill: '', stroke: document.getElementById('wb-color').value, strokeWidth: 10,
          strokeLineCap: 'round', strokeLineJoin: 'round', id: Date.now().toString()
        });
        canvas.add(arrow);
        setActiveTool('select');
        syncAdd(arrow);
      };

      document.getElementById('wb-tool-text').onclick = () => {
        const text = prompt("Enter text or emoji:", "😄");
        if (text) {
          const t = new fabric.Text(text, {
            left: window.innerWidth / 2 - 50, top: window.innerHeight / 2 - 50,
            fill: document.getElementById('wb-color').value,
            fontSize: 80, fontFamily: 'sans-serif', id: Date.now().toString()
          });
          canvas.add(t);
          setActiveTool('select');
          syncAdd(t);
        }
      };
      
      // Image
      document.getElementById('wb-tool-image').onclick = () => {
        document.getElementById('wb-image-input').click();
      };
      document.getElementById('wb-image-input').onchange = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (f) => {
          fabric.Image.fromURL(f.target.result, (img) => {
            img.set({ left: 100, top: 100, id: Date.now().toString() });
            img.scaleToWidth(300);
            canvas.add(img);
            setActiveTool('select');
            syncAdd(img);
          });
        };
        reader.readAsDataURL(file);
      };
      
      // Clear
      document.getElementById('wb-tool-clear').onclick = () => {
        if(confirm("Clear entire board?")) {
          canvas.clear();
          if (socket) socket.emit('wb-clear');
        }
      };
      
      // Save
      document.getElementById('wb-tool-save').onclick = () => {
        const data = canvas.toDataURL({ format: 'png' });
        const a = document.createElement('a');
        a.href = data;
        a.download = 'whiteboard.png';
        a.click();
      };
      
      // Close
      document.getElementById('wb-tool-close').onclick = () => {
        toggleWhiteboard(false);
        if (socket) socket.emit('wb-close');
      };
      
      // Trigger
      if (triggerBtn) {
        triggerBtn.onclick = () => {
          const isOpen = overlay.classList.contains('active');
          toggleWhiteboard(!isOpen);
          if (socket) socket.emit(!isOpen ? 'wb-open' : 'wb-close');
          
          if (!isOpen) {
             // Sync full state when opening
             if (socket) socket.emit('wb-state', canvas.toJSON(['id']));
          }
        };
      }
    }

    function toggleWhiteboard(show) {
      if (show) {
        overlay.classList.add('active');
        if (triggerBtn) triggerBtn.classList.add('active');
        // Fix fabric offsets when un-hiding
        setTimeout(() => { canvas.calcOffset(); resizeCanvas(); }, 300); 
      } else {
        overlay.classList.remove('active');
        if (triggerBtn) triggerBtn.classList.remove('active');
      }
    }

    // ── Infinite Canvas & Panning (Two Finger / Alt+Drag) ──
    canvas.on('mouse:down', function(opt) {
      const evt = opt.e;
      // Eraser logic
      if (currentTool === 'erase' && opt.target) {
        syncRemove(opt.target);
        canvas.remove(opt.target);
        return;
      }

      // Panning logic: Alt key or 2 touches
      if (evt.altKey || (evt.touches && evt.touches.length >= 2)) {
        this.isDragging = true;
        this.selection = false;
        this.lastPosX = evt.clientX || evt.touches[0].clientX;
        this.lastPosY = evt.clientY || evt.touches[0].clientY;
      }
    });

    canvas.on('mouse:move', function(opt) {
      if (this.isDragging) {
        const e = opt.e;
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
           clientX = e.touches[0].clientX;
           clientY = e.touches[0].clientY;
        }
        
        const vpt = this.viewportTransform;
        vpt[4] += clientX - this.lastPosX;
        vpt[5] += clientY - this.lastPosY;
        this.requestRenderAll();
        
        this.lastPosX = clientX;
        this.lastPosY = clientY;
        
        // Sync Pan
        if (!isPresenter && socket) {
          socket.emit('wb-pan', { x: vpt[4], y: vpt[5] });
        }
      }
    });

    canvas.on('mouse:up', function(opt) {
      this.isDragging = false;
      this.selection = (currentTool === 'select');
    });

    // Support object selection on double tap / double click
    // We already have 'select' mode, so double tap isn't strictly needed if we have the toolbar, 
    // but we can auto-switch to select mode on double click.
    canvas.on('mouse:dblclick', function(opt) {
      if (!isPresenter && opt.target) {
        setActiveTool('select');
        canvas.setActiveObject(opt.target);
      }
    });

    // ── Socket.io Syncing ──
    const socket = window.io ? io() : null;

    if (!isPresenter && socket) {
      // Teacher -> Presenter syncs
      
      // 1. Drawing paths
      canvas.on('path:created', function(opt) {
        opt.path.set({ id: Date.now().toString() });
        socket.emit('wb-add', opt.path.toJSON(['id']));
      });

      // 2. Object modifications (move, scale, rotate)
      canvas.on('object:modified', function(opt) {
        socket.emit('wb-modify', opt.target.toJSON(['id']));
      });
      
    } else if (isPresenter && socket) {
      // Presenter receives syncs
      
      socket.on('wb-open', () => toggleWhiteboard(true));
      socket.on('wb-close', () => toggleWhiteboard(false));
      
      socket.on('wb-state', (data) => {
        canvas.loadFromJSON(data, canvas.renderAll.bind(canvas));
      });
      
      socket.on('wb-pan', (data) => {
        canvas.viewportTransform[4] = data.x;
        canvas.viewportTransform[5] = data.y;
        canvas.requestRenderAll();
      });
      
      socket.on('wb-bg', (alpha) => {
        bg.style.background = `rgba(255,255,255,${alpha})`;
      });
      
      socket.on('wb-add', (objData) => {
        fabric.util.enlivenObjects([objData], function(objects) {
          const origRenderOnAddRemove = canvas.renderOnAddRemove;
          canvas.renderOnAddRemove = false;
          objects.forEach(function(o) {
            o.selectable = false; // Presenter shouldn't interact
            o.evented = false;
            canvas.add(o);
          });
          canvas.renderOnAddRemove = origRenderOnAddRemove;
          canvas.requestRenderAll();
        });
      });
      
      socket.on('wb-modify', (objData) => {
        const obj = canvas.getObjects().find(o => o.id === objData.id);
        if (obj) {
          obj.set(objData);
          canvas.requestRenderAll();
        }
      });
      
      socket.on('wb-remove', (id) => {
        const obj = canvas.getObjects().find(o => o.id === id);
        if (obj) {
          canvas.remove(obj);
        }
      });
      
      socket.on('wb-clear', () => {
        canvas.clear();
      });
    }

    // Helper to sync added objects
    function syncAdd(obj) {
      if (socket && !isPresenter) {
        socket.emit('wb-add', obj.toJSON(['id']));
      }
    }
    function syncRemove(obj) {
      if (socket && !isPresenter && obj.id) {
        socket.emit('wb-remove', obj.id);
      }
    }

  } // end setupWhiteboard
})();
