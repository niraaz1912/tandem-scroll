const VALID_AXES = new Set(["vertical", "both"]);

function isTabId(value) {
  return Number.isInteger(value) && value >= 0;
}

export function normalizePairs(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate) => {
    if (
      !candidate ||
      typeof candidate.id !== "string" ||
      !Array.isArray(candidate.tabs) ||
      candidate.tabs.length !== 2 ||
      !candidate.tabs.every(isTabId) ||
      candidate.tabs[0] === candidate.tabs[1]
    ) {
      return [];
    }

    return [{
      id: candidate.id,
      tabs: [...candidate.tabs],
      enabled: candidate.enabled !== false,
      axis: VALID_AXES.has(candidate.axis) ? candidate.axis : "vertical",
      createdAt: Number.isFinite(candidate.createdAt)
        ? candidate.createdAt
        : Date.now(),
    }];
  });
}

export function findPairForTab(pairs, tabId) {
  return pairs.find((pair) => pair.tabs.includes(tabId)) ?? null;
}

export function partnerTabId(pair, tabId) {
  if (!pair || !pair.tabs.includes(tabId)) {
    return null;
  }

  return pair.tabs[0] === tabId ? pair.tabs[1] : pair.tabs[0];
}

export function createPair(pairs, { id, tabA, tabB, now = Date.now() }) {
  if (typeof id !== "string" || !id || !isTabId(tabA) || !isTabId(tabB)) {
    throw new TypeError("A pair needs an id and two valid tab ids.");
  }

  if (tabA === tabB) {
    throw new TypeError("A tab cannot be paired with itself.");
  }

  const displaced = pairs.filter(
    (pair) => pair.tabs.includes(tabA) || pair.tabs.includes(tabB),
  );
  const untouched = pairs.filter(
    (pair) => !pair.tabs.includes(tabA) && !pair.tabs.includes(tabB),
  );
  const pair = {
    id,
    tabs: [tabA, tabB],
    enabled: true,
    axis: "vertical",
    createdAt: now,
  };

  return {
    pairs: [...untouched, pair],
    pair,
    displaced,
  };
}

export function removePairForTab(pairs, tabId) {
  const removed = pairs.filter((pair) => pair.tabs.includes(tabId));

  return {
    pairs: pairs.filter((pair) => !pair.tabs.includes(tabId)),
    removed,
  };
}

export function updatePairForTab(pairs, tabId, changes) {
  let updatedPair = null;
  const nextPairs = pairs.map((pair) => {
    if (!pair.tabs.includes(tabId)) {
      return pair;
    }

    updatedPair = {
      ...pair,
      ...(typeof changes.enabled === "boolean"
        ? { enabled: changes.enabled }
        : {}),
      ...(VALID_AXES.has(changes.axis) ? { axis: changes.axis } : {}),
    };
    return updatedPair;
  });

  return { pairs: nextPairs, pair: updatedPair };
}

export function replaceTabId(pairs, removedTabId, addedTabId) {
  if (!isTabId(removedTabId) || !isTabId(addedTabId)) {
    return pairs;
  }

  return pairs.map((pair) => ({
    ...pair,
    tabs: pair.tabs.map((tabId) => (
      tabId === removedTabId ? addedTabId : tabId
    )),
  }));
}

export function isSupportedPageUrl(url) {
  return typeof url === "string" && /^(https?|file):/i.test(url);
}
