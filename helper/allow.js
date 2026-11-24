// Asks Chrome for permission to read www.reddit.com (Chrome shows its own "Allow" box).
const REDDIT = { origins: ["https://www.reddit.com/*"] };
const msg = document.getElementById("msg");
function done() {
  msg.className = "ok";
  msg.textContent = "✓ Done. Go back to Post Finder and click the button again. You can close this tab.";
  document.getElementById("allow").disabled = true;
}
chrome.permissions.contains(REDDIT, yes => { if (yes) done(); });
document.getElementById("allow").addEventListener("click", () => {
  chrome.permissions.request(REDDIT, granted => {
    if (granted) done();
    else { msg.className = "bad"; msg.textContent = "Not allowed. Click the button again and choose Allow."; }
  });
});
