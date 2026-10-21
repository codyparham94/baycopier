// Sold search results: adds a "Copy" button to each result.
(() => {
  const BC = globalThis.BayCopier;
  if (!BC.isSoldSearch(location.href)) return;

  const MARK = "baycopierDone";

  function makeButton(result) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "baycopier-copy";
    btn.textContent = "Copy with BayCopier";
    btn.style.cssText =
      "margin:6px 0;padding:4px 10px;border:1px solid #3665f3;border-radius:16px;background:#fff;color:#3665f3;font:600 12px/1.4 sans-serif;cursor:pointer;position:relative;z-index:2";
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.disabled = true;
      btn.textContent = "Copying…";
      try {
        const r = await browser.runtime.sendMessage({ type: "copyFromSearch", url: result.url });
        btn.textContent = `Opened ✓ (${r.photos} photos${r.description ? ", description" : ""})`;
      } catch (err) {
        console.warn("BayCopier:", err);
        btn.textContent = "Copy failed – open the item instead";
        btn.disabled = false;
      }
    });
    return btn;
  }

  function decorate() {
    for (const result of BC.findResultItems(document)) {
      if (result.el.dataset[MARK]) continue;
      result.el.dataset[MARK] = "1";
      const anchor = result.el.querySelector(".s-item__info, .s-card__attribute-row, .su-card-container__content") || result.el;
      anchor.appendChild(makeButton(result));
    }
  }

  decorate();
  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
})();
