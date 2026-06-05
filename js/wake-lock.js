(function () {
  "use strict";

  let wakeLock = null;
  const canWakeLock = "wakeLock" in navigator;

  async function requestWakeLock() {
    if (!canWakeLock || wakeLock || document.visibilityState !== "visible") {
      return;
    }

    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", function () {
        wakeLock = null;
      });
    } catch (error) {
      wakeLock = null;
    }
  }

  function scheduleWakeLock() {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(requestWakeLock, { timeout: 1000 });
    } else {
      window.setTimeout(requestWakeLock, 0);
    }
  }

  document.addEventListener("DOMContentLoaded", scheduleWakeLock, { once: true });
  window.addEventListener("load", scheduleWakeLock, { once: true });
  window.addEventListener("pageshow", scheduleWakeLock);

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      scheduleWakeLock();
    } else {
      wakeLock = null;
    }
  });

  ["pointerdown", "keydown", "touchstart"].forEach(function (eventName) {
    window.addEventListener(eventName, scheduleWakeLock, {
      once: true,
      passive: true,
    });
  });
})();
