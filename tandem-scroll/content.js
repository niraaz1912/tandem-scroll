(function startTandemScroll() {
  if (globalThis.__tandemScrollContentLoaded) {
    return;
  }
  globalThis.__tandemScrollContentLoaded = true;

  const math = globalThis.TandemScrollMath;
  if (!math) {
    console.warn("Tandem Scroll could not initialize its scroll helpers.");
    return;
  }

  const randomPart = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  const sourceId = `${Date.now().toString(36)}-${randomPart}`;
  const lastSequenceBySource = new Map();

  let sequence = 0;
  let animationFrame = null;
  let syncState = {
    connected: false,
    enabled: false,
    axis: "vertical",
    partnerTabId: null,
  };
  let remoteTarget = null;

  function scrollingElement() {
    return document.scrollingElement || document.documentElement;
  }

  function readMetrics() {
    const element = scrollingElement();
    return {
      scrollLeft: element?.scrollLeft ?? window.scrollX ?? 0,
      scrollTop: element?.scrollTop ?? window.scrollY ?? 0,
      scrollWidth: element?.scrollWidth ?? 0,
      scrollHeight: element?.scrollHeight ?? 0,
      clientWidth: element?.clientWidth ?? window.innerWidth ?? 0,
      clientHeight: element?.clientHeight ?? window.innerHeight ?? 0,
    };
  }

  function readPosition() {
    return math.normalizedPosition(readMetrics());
  }

  function isProgrammaticEcho(position) {
    if (!remoteTarget || performance.now() > remoteTarget.until) {
      remoteTarget = null;
      return false;
    }

    const verticalMatch = math.closeEnough(position.y, remoteTarget.y);
    const horizontalMatch = remoteTarget.axis === "vertical"
      || math.closeEnough(position.x, remoteTarget.x);

    if (verticalMatch && horizontalMatch) {
      return true;
    }

    // The user moved away from the remote target during the suppression window.
    remoteTarget = null;
    return false;
  }

  function sendScrollPosition() {
    animationFrame = null;
    if (!syncState.connected || !syncState.enabled) {
      return;
    }

    const position = readPosition();
    if (isProgrammaticEcho(position)) {
      return;
    }

    sequence += 1;
    Promise.resolve(chrome.runtime.sendMessage({
      type: "SCROLL_UPDATE",
      position,
      sourceId,
      sequence,
    })).catch(() => {
      // The background worker can briefly be unavailable during an update.
    });
  }

  function queueScrollPosition() {
    if (!syncState.connected || !syncState.enabled || animationFrame !== null) {
      return;
    }
    animationFrame = requestAnimationFrame(sendScrollPosition);
  }

  function applyRemotePosition(message) {
    if (!syncState.connected || !syncState.enabled) {
      return;
    }

    const incomingSequence = Number.isInteger(message.sequence)
      ? message.sequence
      : 0;
    const previousSequence = lastSequenceBySource.get(message.sourceId) ?? -1;
    if (incomingSequence <= previousSequence) {
      return;
    }
    lastSequenceBySource.set(message.sourceId, incomingSequence);

    const position = {
      x: math.clamp(message.position?.x),
      y: math.clamp(message.position?.y),
    };
    const axis = message.axis === "both" ? "both" : "vertical";
    const metrics = readMetrics();
    const offsets = math.offsetsFromPosition(position, metrics);
    const element = scrollingElement();
    const left = axis === "both"
      ? offsets.left
      : (element?.scrollLeft ?? window.scrollX ?? 0);

    remoteTarget = {
      ...position,
      axis,
      until: performance.now() + 180,
    };

    window.scrollTo({
      left,
      top: offsets.top,
      behavior: "auto",
    });
  }

  function applySyncState(nextState) {
    syncState = {
      connected: Boolean(nextState?.connected),
      enabled: Boolean(nextState?.enabled),
      axis: nextState?.axis === "both" ? "both" : "vertical",
      partnerTabId: Number.isInteger(nextState?.partnerTabId)
        ? nextState.partnerTabId
        : null,
    };

    if (!syncState.connected || !syncState.enabled) {
      remoteTarget = null;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message?.type) {
      case "PING":
        sendResponse({ alive: true });
        break;
      case "GET_SCROLL_POSITION":
        sendResponse({ position: readPosition() });
        break;
      case "APPLY_SCROLL":
        applyRemotePosition(message);
        sendResponse({ applied: true });
        break;
      case "SYNC_STATE":
        applySyncState(message.state);
        sendResponse({ updated: true });
        break;
      default:
        break;
    }
  });

  window.addEventListener("scroll", queueScrollPosition, { passive: true });
  window.addEventListener("resize", queueScrollPosition, { passive: true });
  window.addEventListener("pageshow", queueScrollPosition, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      queueScrollPosition();
    }
  });

  if (typeof ResizeObserver === "function") {
    const resizeObserver = new ResizeObserver(queueScrollPosition);
    resizeObserver.observe(document.documentElement);
    if (document.body) {
      resizeObserver.observe(document.body);
    }
  }

  Promise.resolve(chrome.runtime.sendMessage({ type: "CONTENT_READY" }))
    .then((response) => {
      if (response?.ok) {
        applySyncState(response.state);
      }
    })
    .catch(() => {
      // A later pair action will send the state again.
    });
}());
