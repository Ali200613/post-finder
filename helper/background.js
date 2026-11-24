// Post Finder helper. (1) The Post Finder page sends it a search link; it opens it in the right tab:
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

// ---- Reddit flairs (2.1). Only two read-only Reddit addresses, only when the page asks, only after you allow it.
const REDDIT = { origins: ["https://www.reddit.com/*"] };
const SUB_NAME = /^[A-Za-z0-9_]{2,21}$/;
async function redditJson(path) {
  if (!(await chrome.permissions.contains(REDDIT))) return { need: "allow" };
  const r = await fetch("https://www.reddit.com" + path, { credentials: "include", headers: { Accept: "application/json" } });
  let body = null;
  try { body = await r.json(); } catch { /* not JSON */ }
  if (!r.ok || !body) return { error: r.status, reason: body && body.reason || "" };
  return { body };
}
// The newest 100 posts of one community: just each post's flair, title start and time.
async function subFlairs(sub) {
  const res = await redditJson(`/r/${sub}/new.json?limit=100&raw_json=1`);
  if (!res.body) return res;
  const kids = (res.body.data && res.body.data.children) || [];
  const first = kids[0] && kids[0].data;
  return {
    name: first ? first.subreddit : sub,
    members: first ? first.subreddit_subscribers : null,
    posts: kids.map(k => ({ f: k.data.link_flair_text || "", t: String(k.data.title || "").slice(0, 80), c: k.data.created_utc })),
  };
}
// Reddit's community search: name, members, short description.
async function findSubs(q) {
  const res = await redditJson(`/subreddits/search.json?q=${encodeURIComponent(q)}&limit=25&include_over_18=0&raw_json=1`);
  if (!res.body) return res;
  const kids = (res.body.data && res.body.data.children) || [];
  return { subs: kids.map(k => ({ name: k.data.display_name, members: k.data.subscribers, about: String(k.data.public_description || "").slice(0, 140) })) };
}

chrome.runtime.onMessageExternal.addListener((msg, sender, reply) => {
  if (!PAGES.includes(sender.origin)) return;
  if (msg && msg.ping) { reply({ ok: true, version: chrome.runtime.getManifest().version }); return; }
  if (msg && msg.allowReddit) {
    chrome.permissions.contains(REDDIT).then(yes => {
      if (!yes) chrome.tabs.create({ url: chrome.runtime.getURL("allow.html"), index: sender.tab ? sender.tab.index + 1 : undefined });
      reply({ allowed: yes });
    });
    return true;
  }
  if (msg && typeof msg.flairs === "string") {
    if (!SUB_NAME.test(msg.flairs)) { reply({ error: "name" }); return; }
    subFlairs(msg.flairs).then(reply, e => reply({ error: "network", reason: String(e && e.message || e) }));
    return true;
  }
  if (msg && typeof msg.findSubs === "string") {
    const q = msg.findSubs.trim().slice(0, 60);
    if (!q) { reply({ subs: [] }); return; }
    findSubs(q).then(reply, e => reply({ error: "network", reason: String(e && e.message || e) }));
    return true;
  }
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
