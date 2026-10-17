const { workerData } = require("worker_threads");

const port = workerData.port;
let boardOpen = false;
let lastBoardState = null;
let lastGridState = null;
let lastBgState = null;

port.on("message", (message) => {
  if (message.type === "wb-sync-request") {
    const { socketId } = message;
    if (boardOpen) port.postMessage({ type:"emit-to", socketId, event:"wb-open", data:{} });
    if (lastBoardState !== null) port.postMessage({ type:"emit-to", socketId, event:"wb-state", data:lastBoardState });
    if (lastGridState !== null) port.postMessage({ type:"emit-to", socketId, event:"wb-grid", data:lastGridState });
    if (lastBgState !== null) port.postMessage({ type:"emit-to", socketId, event:"wb-bg", data:lastBgState });
    return;
  }

  if (message.type !== "wb-event") return;
  const { event, data } = message;
  const updateObject = (objectData) => {
    if (!objectData || objectData.id == null) return;
    if (!lastBoardState) lastBoardState = { objects:[] };
    if (!Array.isArray(lastBoardState.objects)) lastBoardState.objects = [];
    const index = lastBoardState.objects.findIndex((object) => object.id === objectData.id);
    if (index === -1) lastBoardState.objects.push(objectData);
    else lastBoardState.objects[index] = objectData;
  };
  switch (event) {
    case "wb-open": boardOpen = true; break;
    case "wb-close": boardOpen = false; break;
    case "wb-state": lastBoardState = data ?? null; break;
    case "wb-clear": lastBoardState = null; break;
    case "wb-grid": lastGridState = data ?? null; break;
    case "wb-bg": lastBgState = data ?? null; break;
    case "wb-add": updateObject(data); break;
    case "wb-modify": updateObject(data); break;
    case "wb-modify-batch": if (Array.isArray(data)) data.forEach(updateObject); break;
    case "wb-remove":
      if (lastBoardState && Array.isArray(lastBoardState.objects)) {
        lastBoardState.objects = lastBoardState.objects.filter((object) => object.id !== data);
      }
      break;
  }
});

port.start();
port.postMessage({ type:"ready" });
