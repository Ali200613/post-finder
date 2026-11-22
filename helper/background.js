// Post Finder helper. The Post Finder page sends it a search link; it opens it in the right tab:
//   1. your PINNED tab for that site (Reddit, X, Facebook, Bluesky), if you have one
//   2. else the tab this helper opened for that site last time, if it's still on that site
//   3. else one new tab next to Post Finder
// It answers with where it opened, and the page shows that in a small note.
// Only the Post Finder website can talk to it (see "externally_connectable" in manifest.json).
const PAGES = ["https://ali200613.github.io", "http://localhost:8767"];
const SITES = [
  { key: "reddit", name: "Reddit", host: /(^|\.)reddit\.com$/ },
  { key: "x", name: "X", host: /(^|\.)(x|twitter)\.com$/ },
  { key: "fb", name: "Facebook", host: /(^|\.)facebook\.com$/ },
  { key: "bsky", name: "Bluesky", host: /(^|\.)bsky\.app$/ },
];

chrome.runtime.onMessageExternal.addListener((msg, sender, reply) => {
  if (!PAGES.includes(sender.origin)) return;
  if (msg && msg.ping) { reply({ ok: true, version: chrome.runtime.getManifest().version }); return; }
  if (!msg || typeof msg.open !== "string") return;
  let u;
  try { u = new URL(msg.open); } catch { return; }
  if (u.protocol !== "https:") return;
  const site = SITES.find(s => s.host.test(u.hostname));
  if (!site) return;
  openIn(site, u.href, sender.tab)
    .then(reply)
    .catch(err => {
      chrome.tabs.create({ url: u.href });
      reply({ where: "error", text: `something went wrong (${err && err.message || err}), so it opened a new tab.` });
    });
  return true; // the answer comes later
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
  const pinned = (await chrome.tabs.query({ pinned: true })).filter(t => onSite(site, t));
  if (pinned.length) {
    const t = pinned.find(t => from && t.windowId === from.windowId) || pinned[0];
    await show(t, url);
    return { where: "pinned", text: `opened in your pinned ${site.name} tab.` };
  }
  // 2. The tab we opened for this site last time.
  const k = "tab-" + site.key;
  const saved = (await chrome.storage.session.get(k))[k];
  if (saved) {
    try {
      const t = await chrome.tabs.get(saved);
      if (t && onSite(site, t)) {
        await show(t, url);
        return { where: "reused", text: `no pinned ${site.name} tab, so it reused your ${site.name} tab. Pin a ${site.name} tab to use that one.` };
      }
    } catch { /* that tab was closed */ }
  }
  // 3. A new tab next to Post Finder.
  const opts = { url, active: true };
  if (from) { opts.windowId = from.windowId; opts.index = from.index + 1; }
  const t = await chrome.tabs.create(opts);
  await chrome.storage.session.set({ [k]: t.id });
  return { where: "new", text: `no pinned ${site.name} tab found, so it opened one ${site.name} tab (next clicks reuse it).` };
}
