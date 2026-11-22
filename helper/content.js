// Runs only on the Post Finder website. When you click a search link for Reddit, X, Facebook or
// Bluesky, it asks the helper to open it in your pinned tab for that site instead of a new tab.
// Ctrl/Shift/middle-click still work as normal. A small note at the bottom says where it opened.
const SITES = /(^|\.)(reddit\.com|x\.com|twitter\.com|facebook\.com|bsky\.app)$/;

// Tells the Post Finder page the helper is on (it shows a green tick).
document.documentElement.dataset.pfHelper = "on";

function note(text, bad) {
  let n = document.getElementById("pf-helper-note");
  if (!n) {
    n = document.createElement("div");
    n.id = "pf-helper-note";
    n.style.cssText = "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483647;" +
      "padding:10px 16px;border-radius:12px;font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);max-width:90vw";
    document.body.appendChild(n);
  }
  n.style.background = bad ? "#ff5a5a" : "#2bd67b";
  n.style.color = "#111";
  n.textContent = "Post Finder helper: " + text;
  clearTimeout(note.t);
  note.t = setTimeout(() => n.remove(), bad ? 9000 : 3500);
}

document.addEventListener("click", e => {
  if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (!a) return;
  let u;
  try { u = new URL(a.href); } catch { return; }
  if (u.protocol !== "https:" || !SITES.test(u.hostname)) return;
  e.preventDefault();
  e.stopPropagation();
  try {
    chrome.runtime.sendMessage({ open: u.href }, res => {
      if (chrome.runtime.lastError || !res) {
        note("couldn't reach the add-on (" + ((chrome.runtime.lastError && chrome.runtime.lastError.message) || "no answer") + "). Reload it in chrome://extensions, then press Ctrl+F5 here.", true);
        window.open(u.href, "_blank");
        return;
      }
      note(res.text, res.where === "error");
    });
  } catch (err) {
    // The add-on was reloaded or removed after this page opened.
    note("the add-on changed since this page opened. Press Ctrl+F5 and try again.", true);
    window.open(u.href, "_blank");
  }
}, true);
