import {
  createPair,
  findPairForTab,
  isSupportedPageUrl,
  normalizePairs,
  partnerTabId,
  removePairForTab,
  replaceTabId,
  updatePairForTab,
} from "./pairing.js";

const STORAGE_KEY = "tandemScrollPairs";
const ACTIVE_BADGE_COLOR = "#159A7D";
const PAUSED_BADGE_COLOR = "#64748B";

let pairsCache = null;
let mutationQueue = Promise.resolve();

class UserFacingError extends Error {}

function requireTabId(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new UserFacingError("That tab is no longer available.");
  }
  return value;
}

function makePairId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pair-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clampRatio(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

async function getPairs() {
  if (pairsCache) {
    return pairsCache;
  }

  const stored = await chrome.storage.session.get(STORAGE_KEY);
  pairsCache = normalizePairs(stored[STORAGE_KEY]);
  return pairsCache;
}

async function mutatePairs(mutator) {
  const operation = mutationQueue.then(async () => {
    const currentPairs = await getPairs();
    const result = await mutator(currentPairs);
    const nextPairs = normalizePairs(result.pairs);
    await chrome.storage.session.set({ [STORAGE_KEY]: nextPairs });
    pairsCache = nextPairs;
    return { ...result, pairs: nextPairs };
  });

  mutationQueue = operation.catch(() => undefined);
  return operation;
}

function stateForTab(tabId, pairs) {
  const pair = findPairForTab(pairs, tabId);
  if (!pair) {
    return {
      connected: false,
      enabled: false,
      axis: "vertical",
      pairId: null,
      partnerTabId: null,
    };
  }

  return {
    connected: true,
    enabled: pair.enabled,
    axis: pair.axis,
    pairId: pair.id,
    partnerTabId: partnerTabId(pair, tabId),
    createdAt: pair.createdAt,
  };
}

async function updateTabAppearance(tabId, pair) {
  if (!pair) {
    await Promise.all([
      chrome.action.setBadgeText({ tabId, text: "" }),
      chrome.action.setTitle({ tabId, title: "Tandem Scroll" }),
    ]);
    return;
  }

  const badgeText = pair.enabled ? "↕" : "II";
  const badgeColor = pair.enabled ? ACTIVE_BADGE_COLOR : PAUSED_BADGE_COLOR;
  const title = pair.enabled
    ? "Tandem Scroll — scrolling together"
    : "Tandem Scroll — paused";

  await Promise.all([
    chrome.action.setBadgeText({ tabId, text: badgeText }),
    chrome.action.setBadgeBackgroundColor({ tabId, color: badgeColor }),
    chrome.action.setTitle({ tabId, title }),
  ]);
}

async function notifyTabs(tabIds, pairs) {
  const uniqueTabIds = [...new Set(tabIds.filter(Number.isInteger))];
  await Promise.all(uniqueTabIds.map(async (tabId) => {
    const pair = findPairForTab(pairs, tabId);
    const state = stateForTab(tabId, pairs);
    await Promise.allSettled([
      chrome.tabs.sendMessage(tabId, { type: "SYNC_STATE", state }),
      updateTabAppearance(tabId, pair),
    ]);
  }));
}

function affectedTabIds(pairs) {
  return pairs.flatMap((pair) => pair.tabs);
}

function assertSupportedTab(tab) {
  const url = tab.pendingUrl || tab.url || "";
  if (!isSupportedPageUrl(url)) {
    throw new UserFacingError(
      "Tandem Scroll works on regular website tabs, not browser or extension pages.",
    );
  }
}

async function contentScriptIsReady(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return response?.alive === true;
  } catch {
    return false;
  }
}

async function ensureContentScript(tab) {
  const tabId = requireTabId(tab.id);
  if (await contentScriptIsReady(tabId)) {
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["shared/scroll-math.js", "content.js"],
    });
  } catch {
    const url = tab.pendingUrl || tab.url || "";
    if (url.startsWith("file:")) {
      throw new UserFacingError(
        "Enable “Allow access to file URLs” for Tandem Scroll, then try again.",
      );
    }
    throw new UserFacingError(
      "One of these pages blocks extensions. Choose a regular website tab.",
    );
  }

  if (!(await contentScriptIsReady(tabId))) {
    throw new UserFacingError(
      "The page is not ready yet. Wait a moment, then try pairing again.",
    );
  }
}

async function alignPartner(sourceTabId, targetTabId, pair) {
  try {
    const source = await chrome.tabs.sendMessage(sourceTabId, {
      type: "GET_SCROLL_POSITION",
    });
    if (!source?.position) {
      return false;
    }

    await chrome.tabs.sendMessage(targetTabId, {
      type: "APPLY_SCROLL",
      position: source.position,
      axis: pair.axis,
      sourceId: `align-${pair.id}-${Date.now()}`,
      sequence: 0,
    });
    return true;
  } catch {
    return false;
  }
}

async function createNewPair(sourceTabId, targetTabId) {
  const sourceId = requireTabId(sourceTabId);
  const targetId = requireTabId(targetTabId);
  if (sourceId === targetId) {
    throw new UserFacingError("Choose a different tab to pair.");
  }

  let sourceTab;
  let targetTab;
  try {
    [sourceTab, targetTab] = await Promise.all([
      chrome.tabs.get(sourceId),
      chrome.tabs.get(targetId),
    ]);
  } catch {
    throw new UserFacingError("One of the selected tabs was closed.");
  }

  assertSupportedTab(sourceTab);
  assertSupportedTab(targetTab);
  await Promise.all([
    ensureContentScript(sourceTab),
    ensureContentScript(targetTab),
  ]);

  const result = await mutatePairs((pairs) => createPair(pairs, {
    id: makePairId(),
    tabA: sourceId,
    tabB: targetId,
  }));
  const affected = [
    ...affectedTabIds(result.displaced),
    sourceId,
    targetId,
  ];

  await notifyTabs(affected, result.pairs);
  await alignPartner(sourceId, targetId, result.pair);
  return stateForTab(sourceId, result.pairs);
}

async function unpairTab(tabId) {
  const id = requireTabId(tabId);
  const result = await mutatePairs((pairs) => removePairForTab(pairs, id));
  await notifyTabs(affectedTabIds(result.removed), result.pairs);
  return stateForTab(id, result.pairs);
}

async function updatePairSetting(tabId, changes) {
  const id = requireTabId(tabId);
  const result = await mutatePairs(
    (pairs) => updatePairForTab(pairs, id, changes),
  );
  if (!result.pair) {
    throw new UserFacingError("This tab is no longer paired.");
  }

  await notifyTabs(result.pair.tabs, result.pairs);
  const targetId = partnerTabId(result.pair, id);
  if (result.pair.enabled && targetId !== null) {
    await alignPartner(id, targetId, result.pair);
  }
  return stateForTab(id, result.pairs);
}

async function routeScroll(message, sender) {
  const sourceTabId = sender.tab?.id;
  if (!Number.isInteger(sourceTabId)) {
    return { routed: false };
  }

  const pairs = await getPairs();
  const pair = findPairForTab(pairs, sourceTabId);
  if (!pair?.enabled) {
    return { routed: false };
  }

  const targetTabId = partnerTabId(pair, sourceTabId);
  if (targetTabId === null) {
    return { routed: false };
  }

  const position = {
    x: clampRatio(message.position?.x),
    y: clampRatio(message.position?.y),
  };
  try {
    await chrome.tabs.sendMessage(targetTabId, {
      type: "APPLY_SCROLL",
      position,
      axis: pair.axis,
      sourceId: typeof message.sourceId === "string"
        ? message.sourceId
        : `tab-${sourceTabId}`,
      sequence: Number.isInteger(message.sequence) ? message.sequence : 0,
    });
    return { routed: true };
  } catch {
    return { routed: false };
  }
}

async function focusPartner(tabId) {
  const id = requireTabId(tabId);
  const pairs = await getPairs();
  const pair = findPairForTab(pairs, id);
  const targetId = partnerTabId(pair, id);
  if (targetId === null) {
    throw new UserFacingError("This tab is no longer paired.");
  }

  let targetTab;
  try {
    targetTab = await chrome.tabs.get(targetId);
    await chrome.windows.update(targetTab.windowId, { focused: true });
    await chrome.tabs.update(targetId, { active: true });
  } catch {
    throw new UserFacingError("The paired tab is no longer available.");
  }
  return { focused: true };
}

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "CONTENT_READY": {
      const tabId = requireTabId(sender.tab?.id);
      const pairs = await getPairs();
      const pair = findPairForTab(pairs, tabId);
      await updateTabAppearance(tabId, pair).catch(() => undefined);
      return { state: stateForTab(tabId, pairs) };
    }
    case "GET_STATE": {
      const tabId = requireTabId(message.tabId ?? sender.tab?.id);
      const pairs = await getPairs();
      return { state: stateForTab(tabId, pairs) };
    }
    case "CREATE_PAIR":
      return {
        state: await createNewPair(message.sourceTabId, message.targetTabId),
      };
    case "UNPAIR":
      return { state: await unpairTab(message.tabId) };
    case "SET_ENABLED":
      return {
        state: await updatePairSetting(message.tabId, {
          enabled: Boolean(message.enabled),
        }),
      };
    case "SET_AXIS":
      if (message.axis !== "vertical" && message.axis !== "both") {
        throw new UserFacingError("Choose vertical scrolling or both axes.");
      }
      return {
        state: await updatePairSetting(message.tabId, { axis: message.axis }),
      };
    case "FOCUS_PARTNER":
      return focusPartner(message.tabId);
    case "SCROLL_UPDATE":
      return routeScroll(message, sender);
    default:
      throw new UserFacingError("Tandem Scroll did not recognize that action.");
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => {
      console.error("Tandem Scroll:", error);
      const publicMessage = error instanceof UserFacingError
        ? error.message
        : "Something went wrong. Please try again.";
      sendResponse({ ok: false, error: publicMessage });
    });
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void mutatePairs((pairs) => removePairForTab(pairs, tabId))
    .then((result) => notifyTabs(affectedTabIds(result.removed), result.pairs))
    .catch((error) => console.error("Tandem Scroll cleanup:", error));
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  void mutatePairs((pairs) => ({
    pairs: replaceTabId(pairs, removedTabId, addedTabId),
  }))
    .then(async (result) => {
      const pair = findPairForTab(result.pairs, addedTabId);
      await notifyTabs(pair ? pair.tabs : [addedTabId], result.pairs);
    })
    .catch((error) => console.error("Tandem Scroll tab replacement:", error));
});
