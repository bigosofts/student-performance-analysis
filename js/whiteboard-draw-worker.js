/* OffscreenCanvas freehand preview renderer. All coordinates use the 1920×1080 board space. */
let canvas = null;
let frameCanvas = null;
let ctx = null;
let frameCtx = null;
const strokes = new Map();

function renderStroke(stroke) {
  if (!ctx || !stroke || stroke.points.length === 0) return;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const pts = stroke.points;
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, Math.max(0.5, stroke.width / 2), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function publishFrame() {
  if (!ctx || !frameCtx) return;
  frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
  frameCtx.drawImage(canvas, 0, 0);
  const bitmap = frameCanvas.transferToImageBitmap();
  self.postMessage({ type: "frame", bitmap }, [bitmap]);
}

function redraw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes.values()) renderStroke(stroke);
  publishFrame();
}

self.onmessage = ({ data }) => {
  if (!data) return;
  if (data.type === "init") {
    canvas = new OffscreenCanvas(data.width || 1920, data.height || 1080);
    ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    frameCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    frameCtx = frameCanvas.getContext("2d", { alpha: true, desynchronized: true });
    if (ctx) ctx.lineCap = "round";
    self.postMessage({ type: "ready" });
    return;
  }
  if (!ctx) return;
  if (data.type === "start") {
    strokes.set(data.id, {
      color: data.color || "#000000",
      width: Math.max(0.5, Number(data.width) || 5),
      points: [{ x: data.x, y: data.y }],
    });
    redraw();
  } else if (data.type === "points") {
    const stroke = strokes.get(data.id);
    if (!stroke || !Array.isArray(data.points) || !data.points.length) return;
    const oldLength = stroke.points.length;
    for (const pt of data.points) {
      if (Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
        stroke.points.push({ x: pt[0], y: pt[1] });
      }
    }
    if (stroke.points.length === oldLength) return;
    // Draw only newly received segments on the worker-owned persistent surface.
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    let prev = stroke.points[oldLength - 1];
    for (let i = oldLength; i < stroke.points.length; i++) {
      const pt = stroke.points[i];
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      prev = pt;
    }
    publishFrame();
  } else if (data.type === "end" || data.type === "cancel") {
    strokes.delete(data.id);
    redraw();
  } else if (data.type === "clear") {
    strokes.clear();
    redraw();
  }
};
