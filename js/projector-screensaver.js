import * as screensaver from "./screensaver.js";

const overlay = ensureScreensaverOverlay();
if (overlay && typeof window.io === "function") {
  screensaver.initScreensaver("screensaverCanvasContainer");

  const socket = window.io();
  socket.on("class-session-start", (data = {}) => {
    const subject = data.subject || "Agriculture";
    const paper = data.paper || "";
    const chapter = data.chapter || "";
    const chapterName = data.chapterName || "";

    screensaver.updateScreensaverTitle(subject, paper, chapter, chapterName);
    screensaver.startScreensaver();
  });

  [
    "classroom-navigate",
    "pres-open",
    "pres-share-image",
    "pres-share-tree",
    "pres-share-note",
    "pres-share-video",
    "pres-share-webpage",
    "pres-share-pdf",
  ].forEach((eventName) => {
    socket.on(eventName, screensaver.stopScreensaver);
  });
}

function ensureScreensaverOverlay() {
  let overlay = document.getElementById("screensaverOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "screensaverOverlay";
    overlay.innerHTML = `
      <div id="screensaverCanvasContainer"></div>
      <div id="screensaverText" role="status" aria-live="polite">
        <div id="ssSubject">Agriculture</div>
        <div id="ssPaper"></div>
        <div class="ss-divider"></div>
        <div id="ssChapterNum"></div>
        <h1 id="ssChapterTitle"></h1>
      </div>`;
    document.body.appendChild(overlay);
  }
  overlay.style.zIndex = "2147483000";

  if (!document.getElementById("screensaverCanvasContainer")) {
    const canvas = document.createElement("div");
    canvas.id = "screensaverCanvasContainer";
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
    overlay.prepend(canvas);
  }

  if (!document.getElementById("screensaverText")) {
    const text = document.createElement("div");
    text.id = "screensaverText";
    text.innerHTML = `
      <div id="ssSubject">Agriculture</div><div id="ssPaper"></div>
      <div class="ss-divider"></div><div id="ssChapterNum"></div><h1 id="ssChapterTitle"></h1>`;
    overlay.appendChild(text);
  }

  const style = document.createElement("style");
  style.textContent = `
    #screensaverOverlay{display:none;position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#75c9ed;font-family:Inter,Arial,sans-serif}
    #screensaverCanvasContainer{position:absolute;inset:0;width:100%;height:100%}
    #screensaverCanvasContainer canvas{display:block;width:100%;height:100%}
    #screensaverText{position:absolute;top:50%;left:50%;width:min(680px,calc(100% - 36px));padding:clamp(22px,4vw,48px);transform:translate(-50%,-50%);border:1px solid #e8fbffb0;border-radius:28px;background:linear-gradient(145deg,#d9f7ff35,#e8fff224);backdrop-filter:blur(9px) saturate(135%);-webkit-backdrop-filter:blur(9px) saturate(135%);box-shadow:0 22px 70px #09202d55,inset 0 1px #ffffff80;color:#fff;text-align:center;text-shadow:0 2px 12px #082b3bb3;opacity:0;transition:opacity 1.2s ease}
    #ssSubject{font-size:clamp(24px,4vw,48px);font-weight:900;letter-spacing:.02em}
    #ssPaper{margin-top:8px;font-size:clamp(16px,2vw,24px);font-weight:750;letter-spacing:.12em;text-transform:uppercase}
    #screensaverText .ss-divider{width:72px;height:3px;margin:18px auto;border-radius:4px;background:#fff;opacity:.8}
    #ssChapterNum{font-size:clamp(13px,1.5vw,18px);font-weight:850;letter-spacing:.16em;text-transform:uppercase}
    #ssChapterTitle{margin:10px 0 0;font-size:clamp(24px,4.5vw,54px);line-height:1.3}
    @media(prefers-reduced-motion:reduce){#screensaverText{transition:none}}
  `;
  document.head.appendChild(style);
  return overlay;
}
