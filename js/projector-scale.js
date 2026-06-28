(function () {
  const TARGET_WIDTH = 1024;
  const TARGET_HEIGHT = 768;
  const SCALE = 0.67;
  const CLASS_NAME = "projector-scale-67";
  const STYLE_ID = "projector-scale-67-style";

  function getViewportSize() {
    const doc = document.documentElement;
    const visual = window.visualViewport;
    return {
      width: Math.max(
        window.innerWidth || 0,
        doc ? doc.clientWidth || 0 : 0,
        visual ? Math.round(visual.width) : 0
      ),
      height: Math.max(
        window.innerHeight || 0,
        doc ? doc.clientHeight || 0 : 0,
        visual ? Math.round(visual.height) : 0
      ),
    };
  }

  function isProjectorSize() {
    const { width, height } = getViewportSize();
    const ratio = width / Math.max(height, 1);
    const targetRatio = TARGET_WIDTH / TARGET_HEIGHT;

    return (
      width >= 960 &&
      width <= 1100 &&
      height >= 680 &&
      height <= 820 &&
      Math.abs(ratio - targetRatio) <= 0.18
    );
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html.${CLASS_NAME} {
        overflow: hidden;
        background: #020617;
      }

      html.${CLASS_NAME} body {
        width: calc(100vw / ${SCALE}) !important;
        height: calc(100vh / ${SCALE}) !important;
        min-height: calc(100vh / ${SCALE}) !important;
        max-width: none !important;
        transform: scale(${SCALE});
        transform-origin: top left;
        overflow: auto !important;
      }

      @supports (zoom: 1) {
        html.${CLASS_NAME} body {
          transform: none;
          zoom: ${SCALE};
        }
      }

      html.${CLASS_NAME} .screen,
      html.${CLASS_NAME} .winner-overlay,
      html.${CLASS_NAME} .sync-overlay,
      html.${CLASS_NAME} .quiz-overlay,
      html.${CLASS_NAME} .maze-quiz-overlay,
      html.${CLASS_NAME} .maze-winner-overlay,
      html.${CLASS_NAME} .reading-modal,
      html.${CLASS_NAME} #qbankSceneBackdrop {
        width: calc(100vw / ${SCALE}) !important;
        height: calc(100vh / ${SCALE}) !important;
      }

      html.${CLASS_NAME} #screensaverOverlay {
        width: 100vw !important;
        height: 100vh !important;
        transform: scale(${1 / SCALE});
        transform-origin: top left;
      }

      @supports (zoom: 1) {
        html.${CLASS_NAME} #screensaverOverlay {
          transform: none;
          zoom: ${1 / SCALE};
        }
      }

      html.${CLASS_NAME} .top-bar {
        position: absolute !important;
        justify-content: flex-end !important;
      }

      html.${CLASS_NAME} .main-content {
        padding: 0 clamp(20px, 4vw, 50px) !important;
      }

      html.${CLASS_NAME} .game-grid {
        grid-template-columns: repeat(4, 1fr) !important;
        perspective: 1200px !important;
        max-width: 1700px !important;
      }

      html.${CLASS_NAME} .game-card:nth-child(5) {
        grid-column: 1 / 3 !important;
        flex-direction: row !important;
        text-align: left !important;
      }

      html.${CLASS_NAME} .game-card:nth-child(5) .game-icon {
        margin-right: clamp(15px, 2vw, 35px) !important;
        margin-bottom: 0 !important;
      }

      html.${CLASS_NAME} .game-card:nth-child(5) .btn-launch {
        width: auto !important;
      }

      html.${CLASS_NAME} .teacher-central-wrap {
        justify-content: flex-end !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applyProjectorScale() {
    ensureStyle();
    const active = isProjectorSize();
    document.documentElement.classList.toggle(CLASS_NAME, active);
    document.documentElement.dataset.projectorScale = active ? "67" : "off";
  }

  applyProjectorScale();
  window.addEventListener("resize", applyProjectorScale);
  window.addEventListener("orientationchange", applyProjectorScale);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", applyProjectorScale);
  }
})();
