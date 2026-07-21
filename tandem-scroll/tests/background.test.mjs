import test from "node:test";
import assert from "node:assert/strict";

test("pairs tabs, routes scroll updates, changes settings, and unpairs", async () => {
  const tabMessages = [];
  const storage = {};
  const tabs = new Map([
    [101, {
      id: 101,
      windowId: 10,
      title: "First page",
      url: "https://one.example.com",
    }],
    [202, {
      id: 202,
      windowId: 20,
      title: "Second page",
      url: "https://two.example.com",
    }],
  ]);

  let messageListener;
  globalThis.chrome = {
    storage: {
      session: {
        async get(key) {
          return { [key]: storage[key] };
        },
        async set(values) {
          Object.assign(storage, values);
        },
      },
    },
    runtime: {
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        },
      },
    },
    tabs: {
      async get(tabId) {
        if (!tabs.has(tabId)) throw new Error("Missing tab");
        return tabs.get(tabId);
      },
      async sendMessage(tabId, message) {
        tabMessages.push({ tabId, message });
        if (message.type === "PING") return { alive: true };
        if (message.type === "GET_SCROLL_POSITION") {
          return { position: { x: 0.1, y: 0.4 } };
        }
        return { received: true };
      },
      async update() {},
      onRemoved: { addListener() {} },
      onReplaced: { addListener() {} },
    },
    scripting: {
      async executeScript() {},
    },
    action: {
      async setBadgeText() {},
      async setBadgeBackgroundColor() {},
      async setTitle() {},
    },
    windows: {
      async update() {},
    },
  };

  await import(`../background.js?test=${Date.now()}`);
  assert.equal(typeof messageListener, "function");

  function dispatch(message, sender = {}) {
    return new Promise((resolve) => {
      const asynchronous = messageListener(message, sender, resolve);
      assert.equal(asynchronous, true);
    });
  }

  const created = await dispatch({
    type: "CREATE_PAIR",
    sourceTabId: 101,
    targetTabId: 202,
  });
  assert.equal(created.ok, true);
  assert.equal(created.state.connected, true);
  assert.equal(created.state.partnerTabId, 202);
  assert.deepEqual(storage.tandemScrollPairs[0].tabs, [101, 202]);
  assert.ok(tabMessages.some(
    ({ tabId, message }) => tabId === 202 && message.type === "APPLY_SCROLL",
  ));

  tabMessages.length = 0;
  const routed = await dispatch({
    type: "SCROLL_UPDATE",
    position: { x: 4, y: 0.72 },
    sourceId: "content-202",
    sequence: 8,
  }, { tab: tabs.get(202) });
  assert.equal(routed.ok, true);
  assert.equal(routed.routed, true);
  const scrollMessage = tabMessages.find(
    ({ tabId, message }) => tabId === 101 && message.type === "APPLY_SCROLL",
  );
  assert.deepEqual(scrollMessage.message.position, { x: 1, y: 0.72 });
  assert.equal(scrollMessage.message.axis, "vertical");

  const axisChanged = await dispatch({
    type: "SET_AXIS",
    tabId: 101,
    axis: "both",
  });
  assert.equal(axisChanged.state.axis, "both");

  const paused = await dispatch({
    type: "SET_ENABLED",
    tabId: 101,
    enabled: false,
  });
  assert.equal(paused.state.enabled, false);

  const notRouted = await dispatch({
    type: "SCROLL_UPDATE",
    position: { x: 0, y: 0.9 },
    sourceId: "content-101",
    sequence: 9,
  }, { tab: tabs.get(101) });
  assert.equal(notRouted.routed, false);

  const removed = await dispatch({ type: "UNPAIR", tabId: 101 });
  assert.equal(removed.state.connected, false);
  assert.deepEqual(storage.tandemScrollPairs, []);
});
