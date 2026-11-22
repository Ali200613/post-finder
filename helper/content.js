// Runs only on the Post Finder website. When you click a search link for Reddit, X, Facebook or
// Bluesky, it asks the helper to open it in your pinned tab for that site instead of a new tab.
// Ctrl/Shift/middle-click still work as normal.
const SITES = /(^|\.)(reddit\.com|x\.com|twitter\.com|facebook\.com|bsky\.app)$/;

// Tells the Post Finder page the helper is on (it shows a green tick).
document.documentElement.dataset.pfHelper = "on";

document.addEventListener("click", e => {
  if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (!a) return;
  let u;
  try { u = new URL(a.href); } catch { return; }
  if (u.protocol !== "https:" || !SITES.test(u.hostname)) return;
  e.preventDefault();
  e.stopPropagation();
  chrome.runtime.sendMessage({ open: u.href });
}, true);
