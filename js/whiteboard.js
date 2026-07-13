// js/whiteboard.js — Interactive Whiteboard (Editor + Presenter sync)
(function initWhiteboardSystem() {
  if (document.getElementById("wb-injected")) return;
  const marker = document.createElement("div");
  marker.id = "wb-injected";
  marker.style.display = "none";
  document.body.appendChild(marker);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "css/whiteboard.css";
  document.head.appendChild(link);

  const script = document.createElement("script");
  script.src = "assets/vendor/fabric.min.js";
  script.onload = () => {
    if (typeof fabric === "undefined") return;
    setupWhiteboard();
  };
  script.onerror = () => console.warn("Whiteboard: Fabric.js failed to load");
  document.head.appendChild(script);

  const isPresenter = !window.location.href.includes("dashboard");
  let _isMobileCached = null;
  const isMobile = () => {
    if (_isMobileCached === null) {
      _isMobileCached = window.matchMedia(
        "(max-width: 768px), (pointer: coarse)",
      ).matches;
    }
    return _isMobileCached;
  };

  const CANVAS_WIDTH = 1920;
  const CANVAS_HEIGHT = 1080;
  const GRID_CELL = 60; /* divides 1920 (32 cols) and 1080 (18 rows) evenly */

  const EMOJIS = [
    "😀",
    "😃",
    "😄",
    "😁",
    "😊",
    "🙂",
    "😉",
    "😍",
    "🥰",
    "😘",
    "🤔",
    "😮",
    "😲",
    "😢",
    "😭",
    "😡",
    "🤯",
    "😴",
    "🤗",
    "👍",
    "👎",
    "👏",
    "🙌",
    "✋",
    "👋",
    "💪",
    "🎉",
    "⭐",
    "❤️",
    "💡",
    "✅",
    "❌",
    "❓",
    "❗",
    "⚠️",
    "🔥",
    "💯",
    "🏆",
    "🎯",
    "📌",
    "📚",
    "✏️",
    "📝",
    "🔬",
    "🌱",
    "🌾",
    "🐄",
    "🐔",
    "🚜",
    "🌍",
    "☀️",
    "🌧️",
    "💧",
    "🌳",
    "🍎",
    "🥕",
    "🌽",
    "🐝",
    "🦋",
    "🐛",
  ];

  function setupWhiteboard() {
    const uiHTML = `
      <div id="whiteboard-overlay" class="${isPresenter ? "is-presenter" : "is-editor"}">
        <div id="whiteboard-bg" style="background:rgba(255,255,255,1);"></div>
        <div id="whiteboard-wrapper">
          <div id="wb-canvas-scroll">
            <div id="wb-scroll-spacer">
              <div id="wb-canvas-stack">
          <canvas id="wb-canvas"></canvas>
                <div id="wb-align-grid" aria-hidden="true"></div>
              </div>
            </div>
          </div>

          <div id="wb-mobile-bar">
            <button type="button" class="wb-mobile-toggle wb-mobile-close" id="wb-mobile-close-btn" aria-label="Close board">✕</button>
            <button type="button" class="wb-mobile-toggle" id="wb-mobile-pan-left" aria-label="Pan left">◀</button>
            <button type="button" class="wb-mobile-toggle" id="wb-mobile-pan-right" aria-label="Pan right">▶</button>
            <button type="button" class="wb-mobile-toggle" id="wb-mobile-undo" aria-label="Undo">↩</button>
            <button type="button" class="wb-mobile-toggle" id="wb-mobile-redo" aria-label="Redo">↪</button>
            <button type="button" class="wb-mobile-toggle" id="wb-mobile-zoom-out" aria-label="Zoom out">−</button>
            <span id="wb-mobile-zoom-label">100%</span>
            <button type="button" class="wb-mobile-toggle" id="wb-mobile-zoom-in" aria-label="Zoom in">+</button>
            <button type="button" class="wb-mobile-toggle" id="wb-mobile-tools-toggle" aria-label="Tools">🛠️</button>
          </div>

          <button type="button" id="wb-mobile-ui-reveal" class="wb-mobile-ui-reveal" hidden aria-label="Show tools">🛠️ Tools</button>

          <div id="wb-toolbar">
            <div class="wb-toolbar-row wb-toolbar-primary">
              <button class="wb-tool-btn active" id="wb-tool-draw" title="Draw" data-tool="draw">✏️</button>
              <button class="wb-tool-btn" id="wb-tool-erase" title="Eraser" data-tool="erase">🧹</button>
              <button class="wb-tool-btn" id="wb-tool-select" title="Select / Move" data-tool="select">🖐️</button>
            <div class="wb-separator"></div>
              <button class="wb-tool-btn" id="wb-tool-shapes" title="Shapes & Arrows">⬡</button>
              <button class="wb-tool-btn" id="wb-tool-bullets" title="Bullets & Markers">●</button>
              <button class="wb-tool-btn" id="wb-tool-emoji" title="Emoji">😄</button>
              <button class="wb-tool-btn" id="wb-tool-image" title="Gallery Image">🖼️</button>
              <button class="wb-tool-btn" id="wb-tool-table" title="Insert Table">🗄️</button>
              <button class="wb-tool-btn active" id="wb-tool-grid" title="Toggle alignment grid">⊞</button>
              <button class="wb-tool-btn" id="wb-tool-theme" title="Toggle Dark/Light Board">🌓</button>
            <div class="wb-separator"></div>
              <div class="wb-paging-controls" style="display:flex; align-items:center; gap: 4px;">
                <button class="wb-tool-btn" id="wb-tool-prev-board" title="Previous Board">◀</button>
                <span id="wb-board-label" style="font-size: 0.85rem; font-weight: bold; color: #fff; min-width: 60px; text-align: center;">1 / 1</span>
                <button class="wb-tool-btn" id="wb-tool-next-board" title="Next Board">▶</button>
                <button class="wb-tool-btn" id="wb-tool-new-board" title="New Board">➕</button>
              </div>
            <div class="wb-separator"></div>
              <button class="wb-tool-btn" id="wb-tool-clear" title="Clear">🗑️</button>
              <button class="wb-tool-btn" id="wb-tool-save" title="Save PNG">💾</button>
              <button class="wb-tool-btn wb-tool-close-main" id="wb-tool-close" title="Close">❌</button>
            </div>

            <div class="wb-toolbar-row wb-quick-colors" style="display: flex; gap: 12px; justify-content: center; padding: 8px 4px; flex-wrap: wrap;">
              <button type="button" class="wb-qc-btn" style="background:#ef4444; width:28px; height:28px; border-radius:50%; border:2px solid rgba(255,255,255,0.8); cursor:pointer; box-shadow:0 2px 6px rgba(239,68,68,0.5); transition:transform 0.1s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'" data-color="#ef4444" title="Red"></button>
              <button type="button" class="wb-qc-btn" style="background:#f97316; width:28px; height:28px; border-radius:50%; border:2px solid rgba(255,255,255,0.8); cursor:pointer; box-shadow:0 2px 6px rgba(249,115,22,0.5); transition:transform 0.1s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'" data-color="#f97316" title="Orange"></button>
              <button type="button" class="wb-qc-btn" style="background:#f59e0b; width:28px; height:28px; border-radius:50%; border:2px solid rgba(255,255,255,0.8); cursor:pointer; box-shadow:0 2px 6px rgba(245,158,11,0.5); transition:transform 0.1s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'" data-color="#f59e0b" title="Yellow"></button>
              <button type="button" class="wb-qc-btn" style="background:#10b981; width:28px; height:28px; border-radius:50%; border:2px solid rgba(255,255,255,0.8); cursor:pointer; box-shadow:0 2px 6px rgba(16,185,129,0.5); transition:transform 0.1s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'" data-color="#10b981" title="Green"></button>
              <button type="button" class="wb-qc-btn" style="background:#3b82f6; width:28px; height:28px; border-radius:50%; border:2px solid rgba(255,255,255,0.8); cursor:pointer; box-shadow:0 2px 6px rgba(59,130,246,0.5); transition:transform 0.1s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'" data-color="#3b82f6" title="Blue"></button>
              <button type="button" class="wb-qc-btn" style="background:#a855f7; width:28px; height:28px; border-radius:50%; border:2px solid rgba(255,255,255,0.8); cursor:pointer; box-shadow:0 2px 6px rgba(168,85,247,0.5); transition:transform 0.1s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'" data-color="#a855f7" title="Purple"></button>
              <button type="button" class="wb-qc-btn" style="background:#000000; width:28px; height:28px; border-radius:50%; border:2px solid rgba(255,255,255,0.8); cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.5); transition:transform 0.1s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'" data-color="#000000" title="Black"></button>
              <button type="button" class="wb-qc-btn" style="background:#ffffff; width:28px; height:28px; border-radius:50%; border:2px solid rgba(200,200,200,0.8); cursor:pointer; box-shadow:0 2px 6px rgba(255,255,255,0.5); transition:transform 0.1s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'" data-color="#ffffff" title="White"></button>
            </div>

            <div class="wb-toolbar-row wb-toolbar-controls">
              <div class="wb-control-group">
                <span>Color</span>
                <input type="color" id="wb-color" class="wb-color-picker" value="#000000" title="Color">
            </div>
            <div class="wb-control-group">
              <span>Size</span>
              <input type="range" id="wb-size" class="wb-slider" min="1" max="50" value="5">
            </div>
              <div class="wb-control-group">
                <span>Ink</span>
                <input type="range" id="wb-ink-depth" class="wb-slider" min="0.1" max="1" step="0.05" value="1" title="Ink depth / opacity">
              </div>
              <div class="wb-control-group">
                <span>Stroke</span>
                <input type="range" id="wb-stroke-width" class="wb-slider" min="1" max="30" value="4" title="Shape stroke width">
              </div>
            <div class="wb-separator"></div>
              <div class="wb-control-group">
                <span>BG</span>
                <input type="range" id="wb-bg-alpha" class="wb-slider" min="0" max="1" step="0.05" value="1" title="Background transparency">
              </div>
              <div class="wb-control-group">
                <span>Grid</span>
                <input type="range" id="wb-grid-opacity" class="wb-slider" min="0" max="1" step="0.05" value="0.25" title="Alignment grid opacity">
              </div>
            </div>
          </div>

          <div id="wb-panel-shapes" class="wb-panel" hidden>
            <div class="wb-panel-header">
              <span>Shapes & Arrows</span>
              <button type="button" class="wb-panel-close" data-panel="wb-panel-shapes">✕</button>
            </div>
            <div class="wb-panel-grid" id="wb-shapes-grid"></div>
            </div>
            
          <div id="wb-panel-bullets" class="wb-panel" hidden>
            <div class="wb-panel-header">
              <span>Bullets & Markers</span>
              <button type="button" class="wb-panel-close" data-panel="wb-panel-bullets">✕</button>
            </div>
            <div class="wb-panel-grid" id="wb-bullets-grid"></div>
          </div>

          <div id="wb-panel-emoji" class="wb-panel wb-panel-wide" hidden>
            <div class="wb-panel-header">
              <span>Emoji</span>
              <button type="button" class="wb-panel-close" data-panel="wb-panel-emoji">✕</button>
            </div>
            <div class="wb-panel-grid wb-emoji-grid" id="wb-emoji-grid"></div>
          </div>

          <div id="wb-panel-table" class="wb-panel" hidden>
            <div class="wb-panel-header">
              <span>Insert Table</span>
              <button type="button" class="wb-panel-close" data-panel="wb-panel-table">✕</button>
            </div>
            <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; color: #fff;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label for="wb-table-rows" style="font-size: 0.9rem;">Rows:</label>
                <input type="number" id="wb-table-rows" value="3" min="1" max="20" style="width: 60px; padding: 4px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 4px;">
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label for="wb-table-cols" style="font-size: 0.9rem;">Columns:</label>
                <input type="number" id="wb-table-cols" value="3" min="1" max="20" style="width: 60px; padding: 4px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 4px;">
              </div>
              <button type="button" id="wb-btn-insert-table" style="margin-top: 8px; padding: 8px; background: #3b82f6; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">Insert Table</button>
            </div>
          </div>

          <div id="wb-panel-gallery" class="wb-panel wb-panel-wide" hidden>
            <div class="wb-panel-header">
              <span>Gallery Images</span>
              <button type="button" class="wb-panel-close" data-panel="wb-panel-gallery">✕</button>
            </div>
            <div class="wb-panel-grid wb-gallery-grid" id="wb-gallery-grid">
              <p class="wb-panel-loading">Loading gallery…</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", uiHTML);

    const overlay = document.getElementById("whiteboard-overlay");
    const bg = document.getElementById("whiteboard-bg");
    const wrapper = document.getElementById("whiteboard-wrapper");
    const scrollEl = document.getElementById("wb-canvas-scroll");
    const scrollSpacer = document.getElementById("wb-scroll-spacer");
    const canvasStack = document.getElementById("wb-canvas-stack");
    const alignGrid = document.getElementById("wb-align-grid");
    const mobileZoomLabel = document.getElementById("wb-mobile-zoom-label");
    const mobileUiReveal = document.getElementById("wb-mobile-ui-reveal");
    let gridVisible = true;
    let gridOpacity = 0.25;
    let isDarkBoard = false;
    let mobileUiHideTimer = null;
    let centerCanvasTimer = null;
    const MOBILE_UI_HIDE_MS = 3000;
    let touchStartDist = 0;
    let suppressDraw = false;
    let lastPathTime = 0;
    let modifyUndoTimer = null;
    const undoHistory = [];
    let undoIndex = -1;
    const WB_JSON_PROPS = ["id", "wbBackground"];

    let boards = [{ json: null, undoHistory: [], undoIndex: -1 }];
    let currentBoardIndex = 0;

    function saveCurrentBoard() {
      boards[currentBoardIndex] = {
        json: captureCanvasState(),
        undoHistory: [...undoHistory],
        undoIndex: undoIndex,
      };
    }

    function loadBoard(index) {
      if (index < 0 || index >= boards.length) return;
      saveCurrentBoard();
      currentBoardIndex = index;

      const b = boards[currentBoardIndex];
      undoHistory.length = 0;
      if (b.undoHistory) {
        undoHistory.push(...b.undoHistory);
      }
      undoIndex = b.undoIndex !== undefined ? b.undoIndex : -1;

      const label = document.getElementById("wb-board-label");
      if (label)
        label.innerText = `${currentBoardIndex + 1} / ${boards.length}`;

      if (b.json) {
        restoreCanvasState(b.json, true);
      } else {
        canvas.clear();
        if (socket && !isPresenter) socket.emit("wb-clear");
      }
    }

    function newBoard() {
      saveCurrentBoard();
      boards.push({ json: null, undoHistory: [], undoIndex: -1 });
      loadBoard(boards.length - 1);
    }

    // Disable offscreen caching for every path (massive memory/CPU saver for freehand drawing)
    fabric.Object.prototype.objectCaching = false;

    const canvas = new fabric.Canvas("wb-canvas", {
      isDrawingMode: true,
      selection: false,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      allowTouchScrolling: false,
      preserveObjectStacking: true,
      enableRetinaScaling: false, // Prevents 18-megapixel backing stores on mobile
    });

    let currentTool = "draw";
    let viewportZoom = 1;
    let pinchStartZoom = 1;
    let galleryCache = null;
    let triggerBtnRef = null;

    canvas.freeDrawingBrush.color = "#000000";
    canvas.freeDrawingBrush.width = 5;
    canvas.freeDrawingBrush.decimate = 0; // Set to 0 to disable simplification completely for maximum touch sensitivity

    if (canvasStack) {
      canvasStack.style.width = CANVAS_WIDTH + "px";
      canvasStack.style.height = CANVAS_HEIGHT + "px";
      if (alignGrid) canvasStack.appendChild(alignGrid);
    }

    function getColor() {
      return document.getElementById("wb-color").value;
    }
    function getInkOpacity() {
      return parseFloat(document.getElementById("wb-ink-depth").value);
    }
    function getStrokeWidth() {
      return parseInt(document.getElementById("wb-stroke-width").value, 10);
    }
    function hexToRgba(hex, alpha) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    function shapeStyle(extra = {}) {
      const color = getColor();
      const opacity = getInkOpacity();
      const strokeW = getStrokeWidth();
      return {
        fill: hexToRgba(color, opacity * 0.35),
        stroke: hexToRgba(color, opacity),
        strokeWidth: strokeW,
        strokeUniform: true,
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        ...extra,
      };
    }
    function centerPos(w = 100, h = 100) {
      return {
        left: CANVAS_WIDTH / 2 - w / 2,
        top: CANVAS_HEIGHT / 2 - h / 2,
      };
    }
    function newId() {
      return Date.now().toString() + Math.random().toString(36).slice(2, 6);
    }

    const SHAPE_DEFS = [
      {
        id: "rect",
        icon: "▭",
        label: "Rectangle",
        create: () =>
          new fabric.Rect({
            ...centerPos(120, 80),
            width: 120,
            height: 80,
            ...shapeStyle(),
          }),
      },
      {
        id: "round-rect",
        icon: "▢",
        label: "Rounded",
        create: () =>
          new fabric.Rect({
            ...centerPos(120, 80),
            width: 120,
            height: 80,
            rx: 16,
            ry: 16,
            ...shapeStyle(),
          }),
      },
      {
        id: "circle",
        icon: "○",
        label: "Circle",
        create: () =>
          new fabric.Circle({
            ...centerPos(100, 100),
            radius: 50,
            ...shapeStyle(),
          }),
      },
      {
        id: "ellipse",
        icon: "⬭",
        label: "Ellipse",
        create: () =>
          new fabric.Ellipse({
            ...centerPos(120, 70),
            rx: 60,
            ry: 35,
            ...shapeStyle(),
          }),
      },
      {
        id: "triangle",
        icon: "△",
        label: "Triangle",
        create: () =>
          new fabric.Triangle({
            ...centerPos(100, 100),
            width: 100,
            height: 100,
            ...shapeStyle(),
          }),
      },
      {
        id: "right-tri",
        icon: "◺",
        label: "Right Tri",
        create: () =>
          new fabric.Polygon(
            [
              { x: 0, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 },
            ],
            { ...centerPos(100, 100), ...shapeStyle() },
          ),
      },
      {
        id: "star",
        icon: "★",
        label: "Star",
        create: () =>
          new fabric.Polygon(
            [
              { x: 50, y: 0 },
              { x: 61, y: 35 },
              { x: 98, y: 35 },
              { x: 68, y: 57 },
              { x: 79, y: 91 },
              { x: 50, y: 70 },
              { x: 21, y: 91 },
              { x: 32, y: 57 },
              { x: 2, y: 35 },
              { x: 39, y: 35 },
            ],
            { ...centerPos(100, 100), ...shapeStyle() },
          ),
      },
      {
        id: "pentagon",
        icon: "⬠",
        label: "Pentagon",
        create: () => {
          const pts = [];
          for (let i = 0; i < 5; i++) {
            const a = ((i * 72 - 90) * Math.PI) / 180;
            pts.push({ x: 50 + 50 * Math.cos(a), y: 50 + 50 * Math.sin(a) });
          }
          return new fabric.Polygon(pts, {
            ...centerPos(100, 100),
            ...shapeStyle(),
          });
        },
      },
      {
        id: "hexagon",
        icon: "⬡",
        label: "Hexagon",
        create: () => {
          const pts = [];
          for (let i = 0; i < 6; i++) {
            const a = ((i * 60 - 30) * Math.PI) / 180;
            pts.push({ x: 50 + 50 * Math.cos(a), y: 50 + 50 * Math.sin(a) });
          }
          return new fabric.Polygon(pts, {
            ...centerPos(100, 100),
            ...shapeStyle(),
          });
        },
      },
      {
        id: "octagon",
        icon: "🛑",
        label: "Octagon",
        create: () => {
          const pts = [];
          for (let i = 0; i < 8; i++) {
            const a = ((i * 45 - 22.5) * Math.PI) / 180;
            pts.push({ x: 50 + 50 * Math.cos(a), y: 50 + 50 * Math.sin(a) });
          }
          return new fabric.Polygon(pts, {
            ...centerPos(100, 100),
            ...shapeStyle(),
          });
        },
      },
      {
        id: "diamond",
        icon: "◆",
        label: "Diamond",
        create: () =>
          new fabric.Polygon(
            [
              { x: 50, y: 0 },
              { x: 100, y: 50 },
              { x: 50, y: 100 },
              { x: 0, y: 50 },
            ],
            { ...centerPos(100, 100), ...shapeStyle() },
          ),
      },
      {
        id: "parallelogram",
        icon: "▱",
        label: "Parallel",
        create: () =>
          new fabric.Polygon(
            [
              { x: 25, y: 0 },
              { x: 125, y: 0 },
              { x: 100, y: 80 },
              { x: 0, y: 80 },
            ],
            { ...centerPos(125, 80), ...shapeStyle() },
          ),
      },
      {
        id: "trapezoid",
        icon: "⏢",
        label: "Trapezoid",
        create: () =>
          new fabric.Polygon(
            [
              { x: 20, y: 0 },
              { x: 100, y: 0 },
              { x: 120, y: 80 },
              { x: 0, y: 80 },
            ],
            { ...centerPos(120, 80), ...shapeStyle() },
          ),
      },
      {
        id: "cross",
        icon: "✚",
        label: "Cross",
        create: () =>
          new fabric.Polygon(
            [
              { x: 35, y: 0 },
              { x: 65, y: 0 },
              { x: 65, y: 35 },
              { x: 100, y: 35 },
              { x: 100, y: 65 },
              { x: 65, y: 65 },
              { x: 65, y: 100 },
              { x: 35, y: 100 },
              { x: 35, y: 65 },
              { x: 0, y: 65 },
              { x: 0, y: 35 },
              { x: 35, y: 35 },
            ],
            { ...centerPos(100, 100), ...shapeStyle() },
          ),
      },
      {
        id: "plus",
        icon: "＋",
        label: "Plus",
        create: () =>
          new fabric.Path(
            "M 45 0 L 55 0 L 55 45 L 100 45 L 100 55 L 55 55 L 55 100 L 45 100 L 45 55 L 0 55 L 0 45 L 45 45 Z",
            { ...centerPos(100, 100), ...shapeStyle() },
          ),
      },
      {
        id: "heart",
        icon: "♥",
        label: "Heart",
        create: () =>
          new fabric.Path(
            "M 50 90 C 20 60 0 40 0 25 C 0 10 12 0 25 0 C 35 0 42 6 50 15 C 58 6 65 0 75 0 C 88 0 100 10 100 25 C 100 40 80 60 50 90 Z",
            { ...centerPos(100, 100), ...shapeStyle() },
          ),
      },
      {
        id: "cloud",
        icon: "☁",
        label: "Cloud",
        create: () =>
          new fabric.Path(
            "M 25 70 C 5 70 0 55 10 45 C 0 35 10 20 25 20 C 30 8 45 0 60 5 C 75 0 95 10 95 30 C 110 30 115 50 100 60 C 105 75 85 80 70 75 C 60 85 40 85 25 70 Z",
            { ...centerPos(110, 80), ...shapeStyle() },
          ),
      },
      {
        id: "speech",
        icon: "💬",
        label: "Speech",
        create: () =>
          new fabric.Path(
            "M 10 10 L 110 10 Q 120 10 120 20 L 120 60 Q 120 70 110 70 L 50 70 L 30 90 L 35 70 L 10 70 Q 0 70 0 60 L 0 20 Q 0 10 10 10 Z",
            { ...centerPos(120, 90), ...shapeStyle() },
          ),
      },
      {
        id: "arrow-r",
        icon: "→",
        label: "Arrow R",
        create: () =>
          new fabric.Path("M 0 40 L 80 40 M 55 15 L 80 40 L 55 65", {
            ...centerPos(90, 80),
            fill: "",
            strokeLineCap: "round",
            strokeLineJoin: "round",
            ...shapeStyle({ fill: "" }),
          }),
      },
      {
        id: "arrow-l",
        icon: "←",
        label: "Arrow L",
        create: () =>
          new fabric.Path("M 80 40 L 0 40 M 25 15 L 0 40 L 25 65", {
            ...centerPos(90, 80),
            fill: "",
            strokeLineCap: "round",
            strokeLineJoin: "round",
            ...shapeStyle({ fill: "" }),
          }),
      },
      {
        id: "arrow-u",
        icon: "↑",
        label: "Arrow U",
        create: () =>
          new fabric.Path("M 40 80 L 40 0 M 15 25 L 40 0 L 65 25", {
            ...centerPos(80, 90),
            fill: "",
            strokeLineCap: "round",
            strokeLineJoin: "round",
            ...shapeStyle({ fill: "" }),
          }),
      },
      {
        id: "arrow-d",
        icon: "↓",
        label: "Arrow D",
        create: () =>
          new fabric.Path("M 40 0 L 40 80 M 15 55 L 40 80 L 65 55", {
            ...centerPos(80, 90),
            fill: "",
            strokeLineCap: "round",
            strokeLineJoin: "round",
            ...shapeStyle({ fill: "" }),
          }),
      },
      {
        id: "arrow-double",
        icon: "⇄",
        label: "Double",
        create: () =>
          new fabric.Path(
            "M 10 30 L 50 30 M 35 15 L 50 30 L 35 45 M 90 50 L 50 50 M 65 35 L 50 50 L 65 65",
            {
              ...centerPos(100, 80),
              fill: "",
              strokeLineCap: "round",
              strokeLineJoin: "round",
              ...shapeStyle({ fill: "" }),
            },
          ),
      },
      {
        id: "arrow-curved",
        icon: "↷",
        label: "Curved",
        create: () =>
          new fabric.Path(
            "M 10 70 Q 10 10 70 10 L 70 10 M 55 0 L 70 10 L 60 25",
            {
              ...centerPos(90, 80),
              fill: "",
              strokeLineCap: "round",
              strokeLineJoin: "round",
              ...shapeStyle({ fill: "" }),
            },
          ),
      },
      {
        id: "line",
        icon: "—",
        label: "Line",
        create: () =>
          new fabric.Line([0, 0, 140, 0], {
            ...centerPos(140, 4),
            ...shapeStyle({ fill: "" }),
          }),
      },
      {
        id: "line-dashed",
        icon: "┄",
        label: "Dashed",
        create: () =>
          new fabric.Line([0, 0, 140, 0], {
            ...centerPos(140, 4),
            strokeDashArray: [12, 8],
            ...shapeStyle({ fill: "" }),
          }),
      },
    ];

    const BULLET_DEFS = [
      {
        id: "bullet-dot",
        icon: "●",
        label: "Dot",
        create: () =>
          new fabric.Circle({
            ...centerPos(24, 24),
            radius: 12,
            fill: hexToRgba(getColor(), getInkOpacity()),
            stroke: "",
            id: newId(),
          }),
      },
      {
        id: "bullet-ring",
        icon: "◯",
        label: "Ring",
        create: () =>
          new fabric.Circle({
            ...centerPos(24, 24),
            radius: 12,
            fill: "",
            stroke: hexToRgba(getColor(), getInkOpacity()),
            strokeWidth: getStrokeWidth(),
            id: newId(),
          }),
      },
      {
        id: "bullet-square",
        icon: "■",
        label: "Square",
        create: () =>
          new fabric.Rect({
            ...centerPos(24, 24),
            width: 24,
            height: 24,
            fill: hexToRgba(getColor(), getInkOpacity()),
            stroke: "",
            id: newId(),
          }),
      },
      {
        id: "bullet-diamond",
        icon: "◆",
        label: "Diamond",
        create: () =>
          new fabric.Polygon(
            [
              { x: 12, y: 0 },
              { x: 24, y: 12 },
              { x: 12, y: 24 },
              { x: 0, y: 12 },
            ],
            {
              ...centerPos(24, 24),
              fill: hexToRgba(getColor(), getInkOpacity()),
              stroke: "",
              id: newId(),
            },
          ),
      },
      {
        id: "bullet-star",
        icon: "★",
        label: "Star",
        create: () =>
          new fabric.Polygon(
            [
              { x: 12, y: 0 },
              { x: 15, y: 8 },
              { x: 24, y: 8 },
              { x: 17, y: 13 },
              { x: 20, y: 22 },
              { x: 12, y: 17 },
              { x: 4, y: 22 },
              { x: 7, y: 13 },
              { x: 0, y: 8 },
              { x: 9, y: 8 },
            ],
            {
              ...centerPos(24, 24),
              fill: hexToRgba(getColor(), getInkOpacity()),
              stroke: "",
              id: newId(),
            },
          ),
      },
      {
        id: "bullet-check",
        icon: "✓",
        label: "Check",
        create: () =>
          new fabric.Path("M 5 14 L 12 22 L 28 4", {
            ...centerPos(32, 28),
            fill: "",
            stroke: hexToRgba(getColor(), getInkOpacity()),
            strokeWidth: getStrokeWidth(),
            strokeLineCap: "round",
            strokeLineJoin: "round",
            id: newId(),
          }),
      },
      {
        id: "bullet-x",
        icon: "✕",
        label: "X",
        create: () =>
          new fabric.Path("M 4 4 L 26 26 M 26 4 L 4 26", {
            ...centerPos(30, 30),
            fill: "",
            stroke: hexToRgba(getColor(), getInkOpacity()),
            strokeWidth: getStrokeWidth(),
            strokeLineCap: "round",
            id: newId(),
          }),
      },
      {
        id: "bullet-arrow",
        icon: "➤",
        label: "Pointer",
        create: () =>
          new fabric.Triangle({
            ...centerPos(30, 30),
            width: 30,
            height: 30,
            angle: 90,
            fill: hexToRgba(getColor(), getInkOpacity()),
            stroke: "",
            id: newId(),
          }),
      },
      {
        id: "bullet-num1",
        icon: "①",
        label: "One",
        create: () =>
          new fabric.Text("①", {
            ...centerPos(40, 40),
            fontSize: 36,
            fill: hexToRgba(getColor(), getInkOpacity()),
            fontFamily: "sans-serif",
            id: newId(),
          }),
      },
      {
        id: "bullet-num2",
        icon: "②",
        label: "Two",
        create: () =>
          new fabric.Text("②", {
            ...centerPos(40, 40),
            fontSize: 36,
            fill: hexToRgba(getColor(), getInkOpacity()),
            fontFamily: "sans-serif",
            id: newId(),
          }),
      },
    ];

    function populateGrid(gridId, defs, onPick) {
      const grid = document.getElementById(gridId);
      grid.innerHTML = defs
        .map(
          (d) => `
        <button type="button" class="wb-pick-btn" title="${d.label}" data-id="${d.id}">
          <span class="wb-pick-icon">${d.icon}</span>
          <span class="wb-pick-label">${d.label}</span>
        </button>
      `,
        )
        .join("");
      grid.querySelectorAll(".wb-pick-btn").forEach((btn) => {
        btn.onclick = () => {
          const def = defs.find((x) => x.id === btn.dataset.id);
          if (def) onPick(def);
        };
      });
    }

    populateGrid("wb-shapes-grid", SHAPE_DEFS, (def) => {
      const obj = def.create();
      canvas.add(obj);
      closeAllPanels();
      setActiveTool("select");
      syncAdd(obj);
      recordUndoState();
    });

    populateGrid("wb-bullets-grid", BULLET_DEFS, (def) => {
      const obj = def.create();
      canvas.add(obj);
      closeAllPanels();
      setActiveTool("select");
      syncAdd(obj);
      recordUndoState();
    });

    const emojiGrid = document.getElementById("wb-emoji-grid");
    emojiGrid.innerHTML = EMOJIS.map(
      (e) =>
        `<button type="button" class="wb-emoji-btn" data-emoji="${e}">${e}</button>`,
    ).join("");
    emojiGrid.querySelectorAll(".wb-emoji-btn").forEach((btn) => {
      btn.onclick = () => {
        const t = new fabric.Text(btn.dataset.emoji, {
          ...centerPos(80, 80),
          fontSize: 72,
          fontFamily: "Segoe UI Emoji, Apple Color Emoji, sans-serif",
          fill: getColor(),
          opacity: getInkOpacity(),
          id: newId(),
        });
        canvas.add(t);
        closeAllPanels();
        setActiveTool("select");
        syncAdd(t);
        recordUndoState();
      };
    });

    function closeAllPanels() {
      document.querySelectorAll(".wb-panel").forEach((p) => {
        p.hidden = true;
      });
    }
    function togglePanel(id) {
      const panel = document.getElementById(id);
      const wasOpen = !panel.hidden;
      closeAllPanels();
      if (!wasOpen) {
        panel.hidden = false;
        if (isMobile())
          document
            .getElementById("wb-toolbar")
            ?.classList.add("wb-toolbar-expanded");
      }
    }

    document.querySelectorAll(".wb-panel-close").forEach((btn) => {
      btn.onclick = () => {
        document.getElementById(btn.dataset.panel).hidden = true;
      };
    });

    const btnDraw = document.getElementById("wb-tool-draw");
    const btnErase = document.getElementById("wb-tool-erase");
    const btnSelect = document.getElementById("wb-tool-select");

    function showMobileUI() {
      if (!isMobile() || isPresenter) return;
      overlay.classList.remove("wb-mobile-ui-hidden");
      if (mobileUiReveal) mobileUiReveal.hidden = true;
      scheduleMobileUIHide();
    }

    let lastMobileUIHideSchedule = 0;
    function scheduleMobileUIHide() {
      if (!isMobile() || isPresenter) return;
      const now = Date.now();
      if (now - lastMobileUIHideSchedule < 500) return;
      lastMobileUIHideSchedule = now;

      clearTimeout(mobileUiHideTimer);
      clearTimeout(centerCanvasTimer);
      mobileUiHideTimer = setTimeout(() => {
        if (!overlay.classList.contains("active")) return;
        overlay.classList.add("wb-mobile-ui-hidden");
        if (mobileUiReveal) mobileUiReveal.hidden = false;
      }, MOBILE_UI_HIDE_MS);
    }

    function updateMobileBarOffset() {
      const bar = document.getElementById("wb-mobile-bar");
      if (bar && isMobile() && !isPresenter) {
        document.documentElement.style.setProperty(
          "--wb-mobile-bar-h",
          `${bar.offsetHeight}px`,
        );
      }
    }

    function updateMobileViewportHeight() {
      if (isPresenter || !isMobile() || !overlay.classList.contains("active"))
        return;
      const vv = window.visualViewport;
      overlay.classList.add("wb-mobile-viewport-fit");
      if (vv) {
        overlay.style.position = "fixed";
        overlay.style.top = `${vv.offsetTop}px`;
        overlay.style.left = `${vv.offsetLeft}px`;
        overlay.style.width = `${vv.width}px`;
        overlay.style.height = `${vv.height}px`;
      } else {
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = `${window.innerHeight}px`;
      }
      updateMobileBarOffset();
    }

    function captureCanvasState() {
      const json = canvas.toJSON(WB_JSON_PROPS);
      // Convert absolute URLs (localhost or IP addresses) to relative paths for LAN sync
      const jsonStr = JSON.stringify(json).replace(
        /"src":"https?:\/\/[^\/]+/g,
        '"src":"',
      );
      return jsonStr;
    }

    function recordUndoStateSync() {
      if (isPresenter) return;
      const snap = captureCanvasState();
      if (undoIndex >= 0 && undoHistory[undoIndex] === snap) return;
      undoHistory.splice(undoIndex + 1);
      undoHistory.push(snap);
      if (undoHistory.length > 20) {
        undoHistory.shift();
      } else {
        undoIndex++;
      }
    }

    let pendingUndoTimer = null;
    function recordUndoState() {
      clearTimeout(pendingUndoTimer);
      pendingUndoTimer = setTimeout(recordUndoStateSync, 500);
    }

    function restoreCanvasState(jsonStr, syncPresenter) {
      canvas.loadFromJSON(JSON.parse(jsonStr), () => {
        canvas.renderAll();
        if (!isPresenter) setActiveTool(currentTool);
        applyCanvasLayout();
        canvas.calcOffset();
        if (syncPresenter && socket) {
          socket.emit("wb-state", canvas.toJSON(WB_JSON_PROPS));
        }
      });
    }

    function undoAction() {
      clearTimeout(pendingUndoTimer);
      if (undoIndex <= 0) return;
      undoIndex--;
      restoreCanvasState(undoHistory[undoIndex], true);
      showMobileUI();
    }

    function redoAction() {
      clearTimeout(pendingUndoTimer);
      if (undoIndex >= undoHistory.length - 1) return;
      undoIndex++;
      restoreCanvasState(undoHistory[undoIndex], true);
      showMobileUI();
    }

    function mobilePanHorizontal(dir) {
      if (!scrollEl || useFitViewport()) return;
      const step = Math.max(scrollEl.clientWidth * 0.4, 80);
      scrollEl.scrollLeft += dir * step;
      showMobileUI();
    }

    function scheduleModifyUndo() {
      clearTimeout(modifyUndoTimer);
      modifyUndoTimer = setTimeout(recordUndoState, 400);
    }

    function removeAccidentalPinchDot() {
      if (Date.now() - lastPathTime > 400) return;
      const objs = canvas.getObjects();
      const last = objs[objs.length - 1];
      if (!last || last.wbBackground) return;
      if (socket && last.id) socket.emit("wb-remove", last.id);
      canvas.remove(last);
      canvas.renderAll();
    }

    function getMobileHeightFitScale() {
      if (!scrollEl) return 1;
      let h = scrollEl.clientHeight;
      if (h <= 0 && wrapper) {
        const bar = document.getElementById("wb-mobile-bar");
        const barH = bar ? bar.offsetHeight : 0;
        h = (overlay.clientHeight || window.innerHeight) - barH;
      }
      if (h <= 0) return 1;
      return h / CANVAS_HEIGHT;
    }

    function getMobileScale() {
      return getMobileHeightFitScale() * viewportZoom;
    }

    function initMobileZoom() {
      if (!isMobile() || isPresenter || !scrollEl) return;
      viewportZoom = 1;
    }

    function mobileZoomBy(factor) {
      if (useFitViewport()) return;
      viewportZoom = Math.min(1, Math.max(0.35, viewportZoom * factor));
      applyCanvasLayout();
      showMobileUI();
    }

    function setActiveTool(tool) {
      if (isPresenter) return;
      currentTool = tool;
      [btnDraw, btnErase, btnSelect].forEach((b) =>
        b.classList.remove("active"),
      );
      canvas.selection = tool === "select";
      canvas.getObjects().forEach((obj) => {
        if (obj.wbBackground) return;
        obj.selectable = tool === "select";
        obj.evented = tool === "select" || tool === "erase";
      });
      if (tool === "draw") btnDraw.classList.add("active");
      if (tool === "erase") btnErase.classList.add("active");
      if (tool === "select") btnSelect.classList.add("active");
      if (!suppressDraw) canvas.isDrawingMode = tool === "draw";
    }

    function getFitScale() {
      if (!scrollEl) return 1;
      const w = scrollEl.clientWidth;
      const h = scrollEl.clientHeight;
      if (w <= 0 || h <= 0) return 1;
      return Math.min(w / CANVAS_WIDTH, h / CANVAS_HEIGHT);
    }

    function useFitViewport() {
      return isPresenter || !isMobile();
    }

    function applyViewportZoom(zoom) {
      if (useFitViewport()) {
        resizeCanvas();
        return;
      }
      viewportZoom = Math.min(1, Math.max(0.35, zoom));
      applyCanvasLayout();
    }

    function updateScrollSpacer() {
      if (!scrollSpacer || useFitViewport()) return;
      const scale = getMobileScale();
      scrollSpacer.style.width = Math.ceil(CANVAS_WIDTH * scale) + "px";
      scrollSpacer.style.height = "100%";
      scrollSpacer.style.minHeight = scrollEl.clientHeight + "px";
    }

    function updateZoomLabel() {
      if (mobileZoomLabel) {
        const pct = useFitViewport()
          ? Math.round(getFitScale() * 100)
          : Math.round(viewportZoom * 100);
        mobileZoomLabel.textContent = pct + "%";
      }
    }

    function applyCanvasLayout() {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      if (!canvasStack) return;

      if (useFitViewport()) {
        overlay.classList.add("wb-fit-viewport");
        overlay.classList.remove("wb-mobile-mode");
        const fitScale = getFitScale();
        canvasStack.style.transform = `scale(${fitScale})`;
        canvasStack.style.transformOrigin = "center center";
        canvasStack.style.marginLeft = "";
        canvasStack.style.marginTop = "";
        if (scrollSpacer) {
          scrollSpacer.style.width = "";
          scrollSpacer.style.height = "";
        }
      } else {
        overlay.classList.remove("wb-fit-viewport");
        overlay.classList.add("wb-mobile-mode");
        const scale = getMobileScale();
        canvasStack.style.transform = `scale(${scale})`;
        canvasStack.style.transformOrigin = "left center";
        canvasStack.style.marginLeft = "";
        canvasStack.style.marginTop = "";
        updateScrollSpacer();
        scrollEl.scrollTop = 0;
        updateMobileBarOffset();
      }

      updateZoomLabel();
      canvas.calcOffset();
    }

    function applyGridStyle() {
      if (!alignGrid) return;
      alignGrid.style.opacity = gridVisible ? gridOpacity : 0;
      alignGrid.style.display = gridVisible ? "block" : "none";
      alignGrid.style.backgroundSize = `${GRID_CELL}px ${GRID_CELL}px`;
    }

    function setGridOpacity(value, sync) {
      gridOpacity = Math.min(1, Math.max(0, parseFloat(value)));
      const slider = document.getElementById("wb-grid-opacity");
      if (slider) slider.value = gridOpacity;
      applyGridStyle();
      if (sync && !isPresenter && socket) {
        socket.emit("wb-grid", { visible: gridVisible, opacity: gridOpacity });
      }
    }

    function toggleGrid(sync) {
      gridVisible = !gridVisible;
      const btn = document.getElementById("wb-tool-grid");
      if (btn) btn.classList.toggle("active", gridVisible);
      applyGridStyle();
      if (sync && !isPresenter && socket) {
        socket.emit("wb-grid", { visible: gridVisible, opacity: gridOpacity });
      }
    }

    function resizeCanvas() {
      _isMobileCached = null;
      updateMobileViewportHeight();
      applyCanvasLayout();
      if (isMobile() && !isPresenter) {
        document
          .getElementById("wb-toolbar")
          ?.classList.add("wb-toolbar-expanded");
      }
    }

    let resizeTimer = null;
    function debouncedResizeCanvas() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeCanvas, 200);
    }

    window.addEventListener("resize", debouncedResizeCanvas);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", debouncedResizeCanvas);
    }
    setTimeout(resizeCanvas, 100);

    function syncModifiedObject(target) {
      if (!socket || isPresenter) return;
      if (target.type === "activeSelection") {
        const items = target.getObjects().slice();
        canvas.discardActiveObject();
        const payloads = [];
        items.forEach((o) => {
          o.setCoords();
          if (o.id) {
            const objData = o.toJSON(["id", "wbBackground"]);
            // Convert absolute URLs (localhost or IP addresses) to relative paths for LAN sync
            if (objData.src) {
              objData.src = objData.src.replace(/^https?:\/\/[^\/]+/i, "");
            }
            payloads.push(objData);
          }
        });
        if (payloads.length) socket.emit("wb-modify-batch", payloads);
        if (items.length > 1) {
          const sel = new fabric.ActiveSelection(items, { canvas });
          canvas.setActiveObject(sel);
        } else if (items.length === 1) {
          canvas.setActiveObject(items[0]);
        }
        canvas.requestRenderAll();
      } else if (target.id && !target.wbBackground) {
        const objData = target.toJSON(["id", "wbBackground"]);
        // Convert absolute URLs (localhost or IP addresses) to relative paths for LAN sync
        if (objData.src) {
          objData.src = objData.src.replace(/^https?:\/\/[^\/]+/i, "");
        }
        socket.emit("wb-modify", objData);
      }
    }

    function syncAdd(obj) {
      if (socket && !isPresenter && obj.id) {
        const objData = obj.toJSON(["id", "wbBackground"]);
        // Convert absolute URLs (localhost or IP addresses) to relative paths for LAN sync
        if (objData.src) {
          objData.src = objData.src.replace(/^https?:\/\/[^\/]+/i, "");
        }
        socket.emit("wb-add", objData);
      }
    }

    function syncRemove(obj) {
      if (socket && !isPresenter && obj.id) {
        socket.emit("wb-remove", obj.id);
      }
    }

    async function loadGalleryImages() {
      const grid = document.getElementById("wb-gallery-grid");
      try {
        const res = await fetch("/api/gallery");
        galleryCache = await res.json();
        const images = galleryCache.filter((i) => i.type === "image" && i.url);
        if (!images.length) {
          grid.innerHTML =
            '<p class="wb-panel-empty">No gallery images yet. Add images in Presentation → Gallery.</p>';
          return;
        }
        grid.innerHTML = images
          .map(
            (img) => `
          <button type="button" class="wb-gallery-item" data-url="${img.url.replace(/"/g, "&quot;")}" title="${(img.itemName || img.name || "Image").replace(/"/g, "&quot;")}">
            <img src="${img.url}" alt="" loading="lazy"/>
            <span>${img.itemName || img.name || "Image"}</span>
          </button>
        `,
          )
          .join("");
        grid.querySelectorAll(".wb-gallery-item").forEach((btn) => {
          btn.onclick = () => {
            fabric.Image.fromURL(
              btn.dataset.url,
              (img) => {
                img.set({ ...centerPos(300, 200), id: newId() });
                img.scaleToWidth(320);
                canvas.add(img);
                closeAllPanels();
                setActiveTool("select");
                syncAdd(img);
                recordUndoState();
              },
              { crossOrigin: "anonymous" },
            );
          };
        });
      } catch (e) {
        grid.innerHTML =
          '<p class="wb-panel-empty">Could not load gallery.</p>';
      }
    }

    function toggleWhiteboard(show) {
      if (show) {
        overlay.classList.add("active");
        if (triggerBtnRef) triggerBtnRef.classList.add("active");
        if (isMobile() && !isPresenter) {
          updateMobileViewportHeight();
          initMobileZoom();
          showMobileUI();
          undoHistory.length = 0;
          undoIndex = -1;
          setTimeout(() => {
            recordUndoState();
          }, 350);
        }
        setTimeout(() => {
          canvas.calcOffset();
          resizeCanvas();
          if (scrollEl) scrollEl.scrollLeft = 0;
        }, 300);
      } else {
        overlay.classList.remove("active");
        overlay.classList.remove("wb-mobile-ui-hidden");
        overlay.classList.remove("wb-mobile-viewport-fit");
        overlay.style.position = "";
        overlay.style.top = "";
        overlay.style.left = "";
        overlay.style.width = "";
        overlay.style.height = "";
        if (mobileUiReveal) mobileUiReveal.hidden = true;
        clearTimeout(mobileUiHideTimer);
        if (triggerBtnRef) triggerBtnRef.classList.remove("active");
      }
    }

    // ── Pointer / pan (desktop: alt+drag) ──
    canvas.on("mouse:down", function (opt) {
      if (!isPresenter) {
        clearTimeout(centerCanvasTimer);
        scheduleMobileUIHide();
      }
      const evt = opt.e;
      if (suppressDraw || (evt.touches && evt.touches.length >= 2)) return;
      if (currentTool === "erase") {
        const pointer = canvas.getPointer(opt.e);
        this.eraserCircle = new fabric.Circle({
          left: pointer.x,
          top: pointer.y,
          originX: "center",
          originY: "center",
          radius: 1,
          fill: "rgba(239, 68, 68, 0.2)",
          stroke: "#ef4444",
          strokeWidth: 2,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          wbBackground: true,
        });
        canvas.add(this.eraserCircle);
        this.eraserStart = pointer;
        this.isErasing = true;
        return;
      }
      // Pan via scrollbars / touch scroll on editor (not fabric viewport)
    });

    canvas.on("mouse:move", function (opt) {
      if (!isPresenter) {
        scheduleMobileUIHide();
      }
      if (this.isErasing && this.eraserCircle) {
        const pointer = canvas.getPointer(opt.e);
        const radius = Math.hypot(
          pointer.x - this.eraserStart.x,
          pointer.y - this.eraserStart.y,
        );
        this.eraserCircle.set({ radius: Math.max(1, radius) });
        this.requestRenderAll();
        return;
      }
      if (this.isDragging) {
        const e = opt.e;
        const vpt = this.viewportTransform;
        vpt[4] += e.clientX - this.lastPosX;
        vpt[5] += e.clientY - this.lastPosY;
        this.requestRenderAll();
        this.lastPosX = e.clientX;
        this.lastPosY = e.clientY;
        if (!isPresenter && socket)
          socket.emit("wb-pan", { x: vpt[4], y: vpt[5] });
      }
    });

    canvas.on("mouse:up", function () {
      if (!isPresenter) scheduleMobileUIHide();
      if (this.isErasing && this.eraserCircle) {
        const radius = this.eraserCircle.radius;
        const center = { x: this.eraserCircle.left, y: this.eraserCircle.top };

        const objectsToRemove = [];
        canvas.getObjects().forEach((obj) => {
          if (obj === this.eraserCircle || obj.wbBackground) return;

          const bounds = obj.getBoundingRect();
          const closestX = Math.max(
            bounds.left,
            Math.min(center.x, bounds.left + bounds.width),
          );
          const closestY = Math.max(
            bounds.top,
            Math.min(center.y, bounds.top + bounds.height),
          );
          const distance = Math.hypot(center.x - closestX, center.y - closestY);

          if (distance <= radius) {
            objectsToRemove.push(obj);
          }
        });

        canvas.remove(this.eraserCircle);
        this.eraserCircle = null;
        this.isErasing = false;

        if (objectsToRemove.length > 0) {
          objectsToRemove.forEach((obj) => {
            if (obj.id && socket && !isPresenter)
              socket.emit("wb-remove", obj.id);
            canvas.remove(obj);
          });
          recordUndoState();
        }

        canvas.requestRenderAll();
        return;
      }
      this.isDragging = false;
      this.selection = currentTool === "select";
    });

    canvas.on("mouse:dblclick", function (opt) {
      if (!isPresenter && opt.target && !opt.target.wbBackground) {
        setActiveTool("select");
        canvas.setActiveObject(opt.target);
      }
    });

    // ── Mobile: two-finger pinch zoom only (no pan, no accidental dots) ──
    if (!isPresenter) {
      const onMobileTouchStart = (e) => {
        clearTimeout(centerCanvasTimer);
        scheduleMobileUIHide();
        if (
          !isMobile() ||
          useFitViewport() ||
          !overlay.classList.contains("active")
        )
          return;
        if (e.touches.length >= 2) {
          suppressDraw = true;
          canvas.isDrawingMode = false;
          removeAccidentalPinchDot();
          touchStartDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY,
          );
          pinchStartZoom = viewportZoom;
          e.preventDefault();
        }
      };

      const onMobileTouchMove = (e) => {
        scheduleMobileUIHide();
        if (
          !isMobile() ||
          useFitViewport() ||
          !overlay.classList.contains("active")
        )
          return;
        if (e.touches.length === 2 && touchStartDist > 0) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY,
          );
          applyViewportZoom(pinchStartZoom * (dist / touchStartDist));
          e.preventDefault();
        }
      };

      const onMobileTouchEnd = (e) => {
        if (e.touches.length < 2) {
          touchStartDist = 0;
          suppressDraw = false;
          if (currentTool === "draw") canvas.isDrawingMode = true;
        }
      };

      scrollEl.addEventListener("touchstart", onMobileTouchStart, {
        passive: false,
      });
      scrollEl.addEventListener("touchmove", onMobileTouchMove, {
        passive: false,
      });
      scrollEl.addEventListener("touchend", onMobileTouchEnd, {
        passive: true,
      });
      scrollEl.addEventListener("touchcancel", onMobileTouchEnd, {
        passive: true,
      });
      if (canvas.upperCanvasEl) {
        canvas.upperCanvasEl.addEventListener(
          "touchstart",
          onMobileTouchStart,
          { passive: false },
        );
        canvas.upperCanvasEl.addEventListener("touchmove", onMobileTouchMove, {
          passive: false,
        });
        canvas.upperCanvasEl.addEventListener("touchend", onMobileTouchEnd, {
          passive: true,
        });
      }
    }

    function closeWhiteboard() {
      toggleWhiteboard(false);
      if (socket) socket.emit("wb-close");
    }

    const socket = window.io ? io() : null;

    if (!isPresenter) {
      btnDraw.onclick = () => setActiveTool("draw");
      btnErase.onclick = () => setActiveTool("erase");
      btnSelect.onclick = () => setActiveTool("select");

      document.getElementById("wb-color").onchange = (e) => {
        canvas.freeDrawingBrush.color = hexToRgba(
          e.target.value,
          getInkOpacity(),
        );
      };
      document.getElementById("wb-size").oninput = (e) => {
        canvas.freeDrawingBrush.width = parseInt(e.target.value, 10);
      };
      document.getElementById("wb-ink-depth").oninput = () => {
        canvas.freeDrawingBrush.color = hexToRgba(getColor(), getInkOpacity());
      };
      function updateBoardBackground(sync = true) {
        const alpha = document.getElementById("wb-bg-alpha").value;
        const rgb = isDarkBoard ? "20,20,20" : "255,255,255";
        const rgbaStr = `rgba(${rgb},${alpha})`;
        bg.style.background = rgbaStr;
        canvas.backgroundColor = rgbaStr;
        canvas.renderAll();
        if (sync && socket) socket.emit("wb-bg", { alpha, dark: isDarkBoard });
      }

      document.getElementById("wb-bg-alpha").oninput = (e) => {
        updateBoardBackground();
      };

      document.getElementById("wb-tool-theme").onclick = () => {
        isDarkBoard = !isDarkBoard;
        updateBoardBackground();

        const colorInput = document.getElementById("wb-color");
        if (isDarkBoard && colorInput.value === "#000000") {
          colorInput.value = "#ffffff";
          canvas.freeDrawingBrush.color = hexToRgba("#ffffff", getInkOpacity());
        } else if (!isDarkBoard && colorInput.value === "#ffffff") {
          colorInput.value = "#000000";
          canvas.freeDrawingBrush.color = hexToRgba("#000000", getInkOpacity());
        }
      };

      document.querySelectorAll(".wb-qc-btn").forEach((btn) => {
        btn.onclick = () => {
          const c = btn.dataset.color;
          const colorInput = document.getElementById("wb-color");
          colorInput.value = c;
          canvas.freeDrawingBrush.color = hexToRgba(c, getInkOpacity());
        };
      });

      document.getElementById("wb-tool-shapes").onclick = () =>
        togglePanel("wb-panel-shapes");
      document.getElementById("wb-tool-bullets").onclick = () =>
        togglePanel("wb-panel-bullets");
      document.getElementById("wb-tool-emoji").onclick = () =>
        togglePanel("wb-panel-emoji");
      document.getElementById("wb-tool-image").onclick = () => {
        togglePanel("wb-panel-gallery");
        if (!galleryCache) loadGalleryImages();
      };

      document.getElementById("wb-tool-table").onclick = () =>
        togglePanel("wb-panel-table");
      document.getElementById("wb-btn-insert-table").onclick = () => {
        const rows = Math.max(
          1,
          parseInt(document.getElementById("wb-table-rows").value, 10) || 3,
        );
        const cols = Math.max(
          1,
          parseInt(document.getElementById("wb-table-cols").value, 10) || 3,
        );

        const cellW = 160;
        const cellH = 100;
        const totalW = cols * cellW;
        const totalH = rows * cellH;

        const lines = [];
        const strokeW = getStrokeWidth();
        const color = hexToRgba(getColor(), getInkOpacity());

        // Horizontal lines
        for (let i = 0; i <= rows; i++) {
          const y = i * cellH;
          lines.push(
            new fabric.Line([0, y, totalW, y], {
              stroke: color,
              strokeWidth: strokeW,
              strokeUniform: true,
            }),
          );
        }

        // Vertical lines
        for (let j = 0; j <= cols; j++) {
          const x = j * cellW;
          lines.push(
            new fabric.Line([x, 0, x, totalH], {
              stroke: color,
              strokeWidth: strokeW,
              strokeUniform: true,
            }),
          );
        }

        const tableGroup = new fabric.Group(lines, {
          ...centerPos(totalW, totalH),
          id: newId(),
        });

        canvas.add(tableGroup);
        closeAllPanels();
        setActiveTool("select");
        syncAdd(tableGroup);
        recordUndoState();
      };

      document.getElementById("wb-tool-grid").onclick = () => toggleGrid(true);
      document.getElementById("wb-grid-opacity").oninput = (e) =>
        setGridOpacity(e.target.value, true);

      document.getElementById("wb-tool-clear").onclick = () => {
        if (confirm("Clear entire board?")) {
          recordUndoStateSync();
          canvas
            .getObjects()
            .slice()
            .forEach((o) => canvas.remove(o));
          canvas.renderAll();
          recordUndoStateSync();
          if (socket) socket.emit("wb-clear");
        }
      };

      document.getElementById("wb-tool-save").onclick = () => {
        const a = document.createElement("a");
        a.href = canvas.toDataURL({ format: "png" });
        a.download = "whiteboard.png";
        a.click();
      };

      document.getElementById("wb-tool-prev-board").onclick = () =>
        loadBoard(currentBoardIndex - 1);
      document.getElementById("wb-tool-next-board").onclick = () =>
        loadBoard(currentBoardIndex + 1);
      document.getElementById("wb-tool-new-board").onclick = newBoard;

      document.getElementById("wb-tool-close").onclick = closeWhiteboard;

      const mobileToggle = document.getElementById("wb-mobile-tools-toggle");
      const toolbar = document.getElementById("wb-toolbar");
      if (mobileToggle) {
        mobileToggle.onclick = () => {
          toolbar.classList.toggle("wb-toolbar-expanded");
          showMobileUI();
        };
      }
      document
        .getElementById("wb-mobile-close-btn")
        ?.addEventListener("click", closeWhiteboard);
      document
        .getElementById("wb-mobile-pan-left")
        ?.addEventListener("click", () => mobilePanHorizontal(-1));
      document
        .getElementById("wb-mobile-pan-right")
        ?.addEventListener("click", () => mobilePanHorizontal(1));
      document
        .getElementById("wb-mobile-undo")
        ?.addEventListener("click", undoAction);
      document
        .getElementById("wb-mobile-redo")
        ?.addEventListener("click", redoAction);
      document
        .getElementById("wb-mobile-zoom-in")
        ?.addEventListener("click", () => mobileZoomBy(1.15));
      document
        .getElementById("wb-mobile-zoom-out")
        ?.addEventListener("click", () => mobileZoomBy(0.87));
      if (mobileUiReveal) {
        mobileUiReveal.addEventListener("click", () => {
          showMobileUI();
          toolbar?.classList.add("wb-toolbar-expanded");
        });
      }

      ["touchstart", "touchmove", "mousedown", "mousemove", "click"].forEach(
        (evt) => {
          toolbar?.addEventListener(evt, () => showMobileUI(), {
            passive: true,
          });
        },
      );

      overlay.addEventListener("click", () => {
        if (!isPresenter) scheduleMobileUIHide();
      });

      if (!isPresenter) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.id = "wb-trigger-btn";
        btn.className = "wb-ready";
        btn.title = "Open Interactive Board";
        btn.innerHTML =
          '<span class="wb-trigger-icon">🖌️</span><span class="wb-trigger-label">Board</span>';

        let container = document.getElementById("floating-buttons-container");
        if (!container) {
          container = document.createElement("div");
          container.id = "floating-buttons-container";
          document.body.appendChild(container);
        }
        container.appendChild(btn);

        triggerBtnRef = btn;
        btn.addEventListener("click", () => {
          const isOpen = overlay.classList.contains("active");
          toggleWhiteboard(!isOpen);
          if (socket) socket.emit(!isOpen ? "wb-open" : "wb-close");
          if (!isOpen) {
            if (socket) {
              socket.emit("wb-state", canvas.toJSON(["id", "wbBackground"]));
              socket.emit("wb-grid", {
                visible: gridVisible,
                opacity: gridOpacity,
              });
              socket.emit("wb-bg", {
                alpha: document.getElementById("wb-bg-alpha").value,
                dark: isDarkBoard,
              });
            }
          }
        });
      }

      canvas.on("path:created", function (opt) {
        opt.path.set({ id: newId() });
        lastPathTime = Date.now();
        if (socket) socket.emit("wb-add", opt.path.toJSON(["id"]));
        recordUndoState();

        if (!isPresenter && isMobile() && scrollEl && !useFitViewport()) {
          clearTimeout(centerCanvasTimer);
          centerCanvasTimer = setTimeout(() => {
            const pathBounds = opt.path.getBoundingRect();
            const scale = getMobileScale();
            const scaledLeftEdge = pathBounds.left * scale;
            // Place the last stroke 10% from the left edge, leaving 90% of screen to the right for more writing
            const targetScrollLeft =
              scaledLeftEdge - scrollEl.clientWidth * 0.1;
            scrollEl.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
          }, 1000);
        }
      });

      canvas.on("object:modified", function (opt) {
        syncModifiedObject(opt.target);
        scheduleModifyUndo();
      });
    } else if (socket) {
      socket.on("wb-open", () => toggleWhiteboard(true));
      socket.on("wb-close", () => toggleWhiteboard(false));

      socket.on("wb-state", (data) => {
        canvas.loadFromJSON(data, () => {
          canvas.getObjects().forEach((o) => {
            o.selectable = false;
            o.evented = false;
          });
          canvas.renderAll();
        });
      });

      socket.on("wb-pan", () => {
        /* fit-viewport mode: pan not used */
      });

      socket.on("wb-zoom", () => {
        /* fit-viewport mode: zoom not used */
      });

      socket.on("wb-bg", (data) => {
        let rgbaStr;
        try {
          if (typeof data === "string" && data.startsWith("{")) {
            data = JSON.parse(data);
          }
        } catch (e) {}

        if (data && typeof data === "object") {
          const rgb = data.dark ? "20,20,20" : "255,255,255";
          rgbaStr = `rgba(${rgb},${data.alpha !== undefined ? data.alpha : 1})`;
        } else {
          rgbaStr = `rgba(255,255,255,${data || 1})`;
        }

        if (bg) bg.style.background = rgbaStr;
        if (canvas) {
          canvas.backgroundColor = rgbaStr;
          canvas.renderAll();
        }
      });

      socket.on("wb-add", (objData) => {
        fabric.util.enlivenObjects([objData], (objects) => {
          const prev = canvas.renderOnAddRemove;
          canvas.renderOnAddRemove = false;
          objects.forEach((o) => {
            o.selectable = false;
            o.evented = false;
            canvas.add(o);
          });
          canvas.renderOnAddRemove = prev;
          canvas.requestRenderAll();
        });
      });

      socket.on("wb-modify", (objData) => {
        const obj = canvas.getObjects().find((o) => o.id === objData.id);
        if (obj) {
          obj.set(objData);
          obj.setCoords();
          canvas.requestRenderAll();
        }
      });

      socket.on("wb-modify-batch", (payloads) => {
        payloads.forEach((objData) => {
          const obj = canvas.getObjects().find((o) => o.id === objData.id);
          if (obj) {
            obj.set(objData);
            obj.setCoords();
          }
        });
        canvas.requestRenderAll();
      });

      socket.on("wb-remove", (id) => {
        const obj = canvas.getObjects().find((o) => o.id === id);
        if (obj) canvas.remove(obj);
      });

      socket.on("wb-clear", () => canvas.clear());

      socket.on("wb-grid", (data) => {
        if (data) {
          gridVisible = data.visible !== false;
          gridOpacity =
            typeof data.opacity === "number" ? data.opacity : gridOpacity;
          applyGridStyle();
        }
      });
    }

    applyGridStyle();
    if (!isPresenter) updateBoardBackground(false);
    resizeCanvas();
  }
})();
