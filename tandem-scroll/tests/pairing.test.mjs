import test from "node:test";
import assert from "node:assert/strict";
import {
  createPair,
  findPairForTab,
  isSupportedPageUrl,
  normalizePairs,
  partnerTabId,
  removePairForTab,
  replaceTabId,
  updatePairForTab,
} from "../pairing.js";

const firstPair = {
  id: "first",
  tabs: [11, 22],
  enabled: true,
  axis: "vertical",
  createdAt: 100,
};

test("normalizes valid pair state and rejects malformed entries", () => {
  const pairs = normalizePairs([
    firstPair,
    { id: "defaults", tabs: [33, 44] },
    { id: "duplicate", tabs: [55, 55] },
    { tabs: [66, 77] },
    null,
  ]);

  assert.equal(pairs.length, 2);
  assert.deepEqual(pairs[0], firstPair);
  assert.equal(pairs[1].enabled, true);
  assert.equal(pairs[1].axis, "vertical");
});

test("creates a pair and displaces every previous partner", () => {
  const secondPair = {
    id: "second",
    tabs: [33, 44],
    enabled: false,
    axis: "both",
    createdAt: 200,
  };
  const result = createPair([firstPair, secondPair], {
    id: "replacement",
    tabA: 11,
    tabB: 44,
    now: 300,
  });

  assert.equal(result.displaced.length, 2);
  assert.equal(result.pairs.length, 1);
  assert.deepEqual(result.pair.tabs, [11, 44]);
  assert.equal(result.pair.enabled, true);
  assert.equal(result.pair.axis, "vertical");
});

test("finds, updates, and removes the pair for a tab", () => {
  assert.equal(findPairForTab([firstPair], 22)?.id, "first");
  assert.equal(partnerTabId(firstPair, 22), 11);
  assert.equal(partnerTabId(firstPair, 999), null);

  const updated = updatePairForTab([firstPair], 11, {
    enabled: false,
    axis: "both",
  });
  assert.equal(updated.pair.enabled, false);
  assert.equal(updated.pair.axis, "both");

  const removed = removePairForTab(updated.pairs, 22);
  assert.equal(removed.pairs.length, 0);
  assert.equal(removed.removed[0].id, "first");
});

test("moves pair state when Chrome replaces a tab id", () => {
  const pairs = replaceTabId([firstPair], 22, 77);
  assert.deepEqual(pairs[0].tabs, [11, 77]);
});

test("accepts normal web and file URLs but rejects privileged pages", () => {
  assert.equal(isSupportedPageUrl("https://example.com"), true);
  assert.equal(isSupportedPageUrl("http://localhost:3000"), true);
  assert.equal(isSupportedPageUrl("file:///tmp/page.html"), true);
  assert.equal(isSupportedPageUrl("chrome://extensions"), false);
  assert.equal(isSupportedPageUrl("edge://settings"), false);
  assert.equal(isSupportedPageUrl("about:blank"), false);
});
