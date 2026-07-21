const elements = {
  shell: document.querySelector(".shell"),
  statusPill: document.querySelector("#status-pill"),
  currentTab: document.querySelector("#current-tab"),
  unsupportedView: document.querySelector("#unsupported-view"),
  disconnectedView: document.querySelector("#disconnected-view"),
  connectedView: document.querySelector("#connected-view"),
  tabList: document.querySelector("#tab-list"),
  emptyTabs: document.querySelector("#empty-tabs"),
  pairButton: document.querySelector("#pair-button"),
  partnerHeading: document.querySelector("#partner-heading"),
  partnerTab: document.querySelector("#partner-tab"),
  liveIndicator: document.querySelector("#live-indicator"),
  syncToggle: document.querySelector("#sync-toggle"),
  axisButtons: [...document.querySelectorAll("[data-axis]")],
  focusPartner: document.querySelector("#focus-partner"),
  unpairButton: document.querySelector("#unpair-button"),
  notice: document.querySelector("#notice"),
};

const avatarColors = [
  "#496A98",
  "#6B5C9A",
  "#2D8878",
  "#A56353",
  "#3D7894",
  "#8A657D",
];

let currentTab = null;
let allTabs = [];
let pairState = null;
let selectedTargetId = null;
let busy = false;
let busyLabel = "";

function isSupported(tab) {
  return /^(https?|file):/i.test(tab?.pendingUrl || tab?.url || "");
}

function pageDetails(tab) {
  const rawUrl = tab?.pendingUrl || tab?.url || "";
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "file:") {
      return { label: "Local file", initial: "F", key: "file" };
    }
    if (parsed.protocol === "chrome:" || parsed.protocol === "edge:") {
      return { label: "Browser page", initial: "B", key: "browser" };
    }
    const host = parsed.hostname.replace(/^www\./, "") || parsed.protocol;
    return {
      label: host,
      initial: host.charAt(0) || "T",
      key: host,
    };
  } catch {
    return { label: "Unknown page", initial: "T", key: "unknown" };
  }
}

function colorForKey(key) {
  const hash = [...key].reduce(
    (total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0,
    0,
  );
  return avatarColors[hash % avatarColors.length];
}

function tabTitle(tab) {
  return tab?.title?.trim() || pageDetails(tab).label || "Untitled tab";
}

function createTabContent(tab, metadata) {
  const details = pageDetails(tab);
  const avatar = document.createElement("span");
  avatar.className = "tab-avatar";
  avatar.textContent = details.initial;
  avatar.style.setProperty("--avatar-color", colorForKey(details.key));

  const copy = document.createElement("span");
  copy.className = "tab-copy";
  const title = document.createElement("span");
  title.className = "tab-title";
  title.textContent = tabTitle(tab);
  const meta = document.createElement("span");
  meta.className = "tab-meta";
  meta.textContent = metadata || details.label;
  copy.append(title, meta);

  return { avatar, copy };
}

function renderTabCard(container, tab, metadata) {
  const content = createTabContent(tab, metadata);
  container.replaceChildren(content.avatar, content.copy);
}

function status(label, className) {
  elements.statusPill.textContent = label;
  elements.statusPill.className = `status-pill ${className}`;
}

function showNotice(message = "", kind = "") {
  elements.notice.textContent = message;
  elements.notice.className = `notice${kind ? ` ${kind}` : ""}`;
}

function targetCandidates() {
  if (!currentTab) {
    return [];
  }

  return allTabs
    .filter((tab) => tab.id !== currentTab.id && isSupported(tab))
    .sort((first, second) => {
      const score = (tab) => {
        if (tab.windowId !== currentTab.windowId && tab.active) return 0;
        if (tab.windowId !== currentTab.windowId) return 1;
        return 2;
      };
      return score(first) - score(second)
        || Number(second.active) - Number(first.active)
        || tabTitle(first).localeCompare(tabTitle(second));
    });
}

function targetMetadata(tab) {
  const location = tab.windowId === currentTab.windowId
    ? "This window"
    : "Other window";
  const state = tab.active ? "Active tab" : pageDetails(tab).label;
  return `${location} · ${state}`;
}

function renderTargetList() {
  const candidates = targetCandidates();
  if (!candidates.some((tab) => tab.id === selectedTargetId)) {
    selectedTargetId = candidates[0]?.id ?? null;
  }

  elements.tabList.replaceChildren();
  for (const tab of candidates) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "tab-option";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(tab.id === selectedTargetId));
    option.disabled = busy;
    const content = createTabContent(tab, targetMetadata(tab));
    const check = document.createElement("span");
    check.className = "selection-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";
    option.append(content.avatar, content.copy, check);
    option.addEventListener("click", () => {
      selectedTargetId = tab.id;
      renderTargetList();
      elements.pairButton.disabled = busy || selectedTargetId === null;
    });
    elements.tabList.append(option);
  }

  elements.tabList.hidden = candidates.length === 0;
  elements.emptyTabs.hidden = candidates.length !== 0;
  elements.pairButton.disabled = busy || selectedTargetId === null;
}

function renderDisconnected() {
  elements.unsupportedView.hidden = true;
  elements.connectedView.hidden = true;
  elements.disconnectedView.hidden = false;
  status("Ready", "status-idle");
  renderTargetList();
  const label = busyLabel || "Pair selected tabs";
  elements.pairButton.querySelector("span").textContent = label;
}

function renderUnsupported() {
  elements.unsupportedView.hidden = false;
  elements.disconnectedView.hidden = true;
  elements.connectedView.hidden = true;
  status("Unavailable", "status-error");
}

function renderConnected() {
  elements.unsupportedView.hidden = true;
  elements.disconnectedView.hidden = true;
  elements.connectedView.hidden = false;

  const enabled = Boolean(pairState.enabled);
  const partner = allTabs.find((tab) => tab.id === pairState.partnerTabId);
    
  status(enabled ? "Live" : "Paused", enabled ? "status-live" : "status-paused");
  elements.liveIndicator.classList.toggle("paused", !enabled);
  elements.liveIndicator.lastChild.textContent = enabled ? " Live" : " Paused";
  elements.partnerHeading.textContent = partner ? tabTitle(partner) : "Partner tab";
  renderTabCard(
    elements.partnerTab,
    partner || { title: "Partner tab unavailable", url: "" },
    partner ? targetMetadata(partner) : "The tab may have just closed",
  );

  elements.syncToggle.setAttribute("aria-checked", String(enabled));
  elements.syncToggle.disabled = busy;
  for (const button of elements.axisButtons) {
    button.classList.toggle("active", button.dataset.axis === pairState.axis);
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.axis === pairState.axis),
    );
    button.disabled = busy;
  }
  elements.focusPartner.disabled = busy || !partner;
  elements.unpairButton.disabled = busy;
}

function render() {
  elements.shell.setAttribute("aria-busy", String(busy));
  if (currentTab) {
    renderTabCard(
      elements.currentTab,
      currentTab,
      `${pageDetails(currentTab).label} · Current`,
    );
  }

  if (pairState?.connected) {
    renderConnected();
  } else if (!isSupported(currentTab)) {
    renderUnsupported();
  } else {
    renderDisconnected();
  }
}

async function request(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) {
    throw new Error(response?.error || "Tandem Scroll could not complete the action.");
  }
  return response;
}

async function refresh() {
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = activeTabs[0] ?? null;
  if (!currentTab?.id) {
    throw new Error("The current tab is not available.");
  }

  allTabs = await chrome.tabs.query({});
  const response = await request("GET_STATE", { tabId: currentTab.id });
  pairState = response.state;
  render();
}

async function perform(label, action) {
  if (busy) {
    return;
  }
  busy = true;
  busyLabel = label;
  showNotice();
  render();

  try {
    await action();
  } catch (error) {
    showNotice(error.message || "Something went wrong.", "error");
  } finally {
    busy = false;
    busyLabel = "";
    render();
  }
}

elements.pairButton.addEventListener("click", () => {
  void perform("Pairing tabs…", async () => {
    if (!selectedTargetId) {
      throw new Error("Choose a tab first.");
    }
    await request("CREATE_PAIR", {
      sourceTabId: currentTab.id,
      targetTabId: selectedTargetId,
    });
    await refresh();
    showNotice("Connected. Scroll either page to begin.", "success");
  });
});

elements.syncToggle.addEventListener("click", () => {
  const nextEnabled = !pairState?.enabled;
  void perform(nextEnabled ? "Resuming…" : "Pausing…", async () => {
    const response = await request("SET_ENABLED", {
      tabId: currentTab.id,
      enabled: nextEnabled,
    });
    pairState = response.state;
    showNotice(nextEnabled ? "Scrolling resumed." : "Scrolling paused.", "success");
  });
});

for (const button of elements.axisButtons) {
  button.addEventListener("click", () => {
    if (button.dataset.axis === pairState?.axis) {
      return;
    }
    void perform("Updating…", async () => {
      const response = await request("SET_AXIS", {
        tabId: currentTab.id,
        axis: button.dataset.axis,
      });
      pairState = response.state;
      showNotice(
        button.dataset.axis === "both"
          ? "Vertical and horizontal scrolling are synced."
          : "Only vertical scrolling is synced.",
        "success",
      );
    });
  });
}

elements.focusPartner.addEventListener("click", () => {
  void perform("Opening…", async () => {
    await request("FOCUS_PARTNER", { tabId: currentTab.id });
  });
});

elements.unpairButton.addEventListener("click", () => {
  void perform("Unpairing…", async () => {
    const response = await request("UNPAIR", { tabId: currentTab.id });
    pairState = response.state;
    selectedTargetId = null;
    showNotice("Tabs unpaired.", "success");
  });
});

refresh().catch((error) => {
  status("Error", "status-error");
  showNotice(error.message || "Tandem Scroll could not start.", "error");
});
