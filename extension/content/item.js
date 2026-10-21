// Item page: intercepts "Sell one like this", builds the copy job, then lets
// eBay's own button continue as normal.
(() => {
  const BC = globalThis.BayCopier;
  const PASS = "baycopierPassed";
  let busy = false;

  const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), ms))]);

  function isSellLike(el) {
    return el && el === BC.findSellLikeElement(document);
  }

  document.addEventListener(
    "click",
    async (e) => {
      const el = e.target.closest && e.target.closest('a, button, [role="button"]');
      if (!isSellLike(el) || el.dataset[PASS]) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (busy) return;
      busy = true;
      el.style.opacity = "0.6";
      el.title = "BayCopier: copying description and photos…";

      try {
        const info = BC.parseItemPage(document, location.href);
        await withTimeout(browser.runtime.sendMessage({ type: "prepareJob", info }), 20000);
      } catch (err) {
        console.warn("BayCopier: could not prepare copy, continuing with eBay's flow", err);
      }

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

  // Mark the button so it's clear BayCopier will handle it.
  BC.waitFor(() => BC.findSellLikeElement(document), 15000).then((el) => {
    if (el) el.title = "BayCopier will copy this listing's description and photos";
  });
})();
