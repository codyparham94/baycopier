// Item page (live or sold): intercepts every "Sell one like this", builds the
// copy job, then lets eBay's own button continue as normal. If eBay shows no
// such button, adds a "Copy with BayCopier" button under the title instead.
(() => {
  const BC = globalThis.BayCopier;
  const PASS = "baycopierPassed";
  let busy = false;

  const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), ms))]);

  async function prepare() {
    try {
      const info = BC.parseItemPage(document, location.href);
      await withTimeout(browser.runtime.sendMessage({ type: "prepareJob", info }), 20000);
      return info;
    } catch (err) {
      console.warn("BayCopier: could not prepare copy, continuing with eBay's flow", err);
      return null;
    }
  }

  document.addEventListener(
    "click",
    async (e) => {
      const target = e.target.closest && e.target.closest('a, button, [role="button"]');
      if (!BC.isSellLikeElement(target)) return;
      const el = target.closest("a") || target;
      if (el.dataset[PASS]) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (busy) return;
      busy = true;
      el.style.opacity = "0.6";
      el.title = "BayCopier: copying description and photos…";

      await prepare();

      // Re-run the original click so eBay navigates exactly as it would have.
      el.dataset[PASS] = "1";
      el.style.opacity = "";
      el.click();
      setTimeout(() => {
        delete el.dataset[PASS];
        busy = false;
      }, 3000);
    },
    true
  );

  BC.waitFor(() => BC.findSellLikeElement(document), 8000).then((el) => {
    if (el) {
      el.title = "BayCopier will copy this listing's description and photos";
      return;
    }
    // No eBay button (layout change or a listing type without one): add ours.
    const title = document.querySelector("h1.x-item-title__mainTitle, .x-item-title, h1");
    if (!title) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Copy with BayCopier";
    btn.style.cssText =
      "display:block;margin:8px 0;padding:6px 14px;border:1px solid #3665f3;border-radius:16px;background:#fff;color:#3665f3;font:600 13px/1.4 sans-serif;cursor:pointer";
    btn.addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      btn.textContent = "Copying…";
      const info = await prepare();
      location.assign(info ? info.sellLikeUrl : BC.sellLikeUrl(document, location.href, BC.itemIdFromUrl(location.href)));
    });
    title.insertAdjacentElement("afterend", btn);
  });
})();
