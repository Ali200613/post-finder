// Opens a Post Finder search in the right tab:
//   1. your PINNED tab for that site (Reddit, X, Facebook, Bluesky), if you have one
//   2. else the tab this helper opened for that site last time, if it's still on that site
//   3. else one new tab next to Post Finder
const SITES = [
  { key: "reddit", host: /(^|\.)reddit\.com$/, tabs: ["*://*.reddit.com/*"] },
  { key: "x", host: /(^|\.)(x|twitter)\.com$/, tabs: ["*://x.com/*", "*://*.x.com/*", "*://*.twitter.com/*"] },
  { key: "fb", host: /(^|\.)facebook\.com$/, tabs: ["*://*.facebook.com/*"] },
  { key: "bsky", host: /(^|\.)bsky\.app$/, tabs: ["*://bsky.app/*"] },
];

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || typeof msg.open !== "string") return;
  let u;
  try { u = new URL(msg.open); } catch { return; }
  if (u.protocol !== "https:") return;
  const site = SITES.find(s => s.host.test(u.hostname));
  if (site) openIn(site, u.href, sender.tab).catch(() => chrome.tabs.create({ url: u.href }));
});

async function show(tab, url) {
  await chrome.tabs.update(tab.id, { url, active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

const onSite = (site, tab) => {
  try { return site.host.test(new URL(tab.url || tab.pendingUrl || "").hostname); } catch { return false; }
};

async function openIn(site, url, from) {
  // 1. Pinned tab of this site (one in the same window first).
  const pinned = (await chrome.tabs.query({ pinned: true, url: site.tabs })).filter(t => onSite(site, t));
  if (pinned.length) {
    const t = pinned.find(t => from && t.windowId === from.windowId) || pinned[0];
    return show(t, url);
  }
  // 2. The tab we opened for this site last time.
  const k = "tab-" + site.key;
  const saved = (await chrome.storage.session.get(k))[k];
  if (saved) {
    try {
      const t = await chrome.tabs.get(saved);
      if (t && onSite(site, t)) return show(t, url);
    } catch { /* that tab was closed */ }
  }
  // 3. A new tab next to Post Finder.
  const opts = { url, active: true };
  if (from) { opts.windowId = from.windowId; opts.index = from.index + 1; }
  const t = await chrome.tabs.create(opts);
  await chrome.storage.session.set({ [k]: t.id });
}
