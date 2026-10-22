// Search results (live and sold): adds "Copy with BayCopier" and a green +
// (add to the copy cart) to each result, and makes eBay's per-card
// "Sell one like this" links copy too.
(() => {
  const BC = globalThis.BayCopier;

  const MARK = "baycopierDone";
  const PASS = "baycopierPassed";
  const SPRING =
    "linear(0, 0.0456, 0.1525, 0.2866, 0.4256, 0.5556, 0.6696, 0.7646, 0.8403, 0.8983, 0.9411, 0.9713, 0.9915, 1.0041, 1.0112, 1.0144, 1.0152, 1.0143, 1.0126, 1.0105, 1.0084, 1.0065, 1.0048, 1.0034, 1.0023, 1.0014, 1.0008, 1.0004, 1.0001, 0.9999, 1)";

  const style = document.createElement("style");
  style.textContent = `
    .baycopier-actions { display: flex; align-items: center; gap: 8px; margin: 6px 0; position: relative; z-index: 2; }
    .baycopier-copy {
      padding: 4px 12px; border: 1px solid #3665f3; border-radius: 16px; background: #fff; color: #3665f3;
      font: 600 12px/1.4 sans-serif; cursor: pointer;
      transition: background 200ms, transform 100ms ease-out;
    }
    .baycopier-copy:hover { background: #eef2ff; }
    .baycopier-copy:active { transform: scale(0.97); }
    .baycopier-add {
      width: 28px; height: 28px; flex: none; padding: 0; border-radius: 50%;
      border: 2px solid #fff; outline: 1px solid #1b8a3a;
      background: #1fa64a; color: #fff; cursor: pointer;
      display: grid; place-items: center;
      box-shadow: 0 3px 10px -3px rgba(27,138,58,0.7);
      transition: transform 420ms ${SPRING}, background 200ms, box-shadow 300ms;
    }
    .baycopier-add:hover { transform: scale(1.1); box-shadow: 0 6px 14px -4px rgba(27,138,58,0.8); }
    .baycopier-add:active { transform: scale(0.92); transition-duration: 100ms; transition-timing-function: ease-out; }
    .baycopier-add svg { width: 16px; height: 16px; transition: transform 420ms ${SPRING}; }
    .baycopier-add.in-cart { background: #136c2e; }
    .baycopier-add .check { display: none; }
    .baycopier-add.in-cart .plus { display: none; }
    .baycopier-add.in-cart .check { display: block; }
    @media (prefers-reduced-motion: reduce) {
      .baycopier-add, .baycopier-add svg { transition: background 200ms; }
      .baycopier-add:hover, .baycopier-add:active { transform: none; }
    }`;
  document.head.appendChild(style);

  const SVG = "http://www.w3.org/2000/svg";
  function icon(cls, d) {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", cls);
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG, "path");
    for (const [k, v] of Object.entries({ d, fill: "none", stroke: "currentColor", "stroke-width": "2.6", "stroke-linecap": "round", "stroke-linejoin": "round" })) {
      path.setAttribute(k, v);
    }
    svg.appendChild(path);
    return svg;
  }

  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  function copyButton(result) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "baycopier-copy";
    btn.textContent = "Copy with BayCopier";
    btn.addEventListener("click", async (e) => {
      stop(e);
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

  const addButtons = new Map(); // itemId -> button

  function syncAddButton(btn, inCart) {
    btn.classList.toggle("in-cart", inCart);
    btn.title = inCart ? "In the BayCopier cart — click to remove" : "Add to BayCopier cart";
    btn.setAttribute("aria-pressed", String(inCart));
  }

  function addButton(result) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "baycopier-add";
    btn.append(icon("plus", "M8 2.5v11M2.5 8h11"), icon("check", "M3 8.5l3.2 3.2L13 4.8"));
    btn.setAttribute("aria-label", "Add to BayCopier cart");
    syncAddButton(btn, BC.CartPanel.has(result.itemId));
    btn.addEventListener("click", (e) => {
      stop(e);
      BC.CartPanel.toggle(BC.summarizeResult(result));
    });
    addButtons.set(result.itemId, btn);
    return btn;
  }

  function decorate() {
    for (const result of BC.findResultItems(document)) {
      if (result.el.dataset[MARK]) continue;
      result.el.dataset[MARK] = "1";
      const anchor = result.el.querySelector(".s-item__info, .s-card__attribute-row, .su-card-container__content") || result.el;
      const row = document.createElement("div");
      row.className = "baycopier-actions";
      row.append(copyButton(result), addButton(result));
      anchor.appendChild(row);
    }
  }

  // Sold results carry their own "Sell one like this" link. Build the copy
  // job for that item first, then let eBay's link continue.
  document.addEventListener(
    "click",
    async (e) => {
      const link = e.target.closest && e.target.closest("a");
      if (!BC.isSellLikeElement(link) || link.dataset[PASS]) return;
      const card = BC.findResultItems(document).find((r) => r.el.contains(link));
      if (!card) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      link.style.opacity = "0.6";
      link.textContent = "Copying…";
      try {
        await browser.runtime.sendMessage({ type: "prepareFromItemUrl", url: card.url });
      } catch (err) {
        console.warn("BayCopier: could not prepare copy, continuing with eBay's flow", err);
      }
      link.dataset[PASS] = "1";
      link.click();
    },
    true
  );

  BC.CartPanel.onChange((cart) => {
    for (const [itemId, btn] of addButtons) syncAddButton(btn, BC.cartHas(cart, itemId));
  });

  decorate();
  // The cart loads asynchronously; re-sync once it has.
  browser.storage.local.get("cart").then(({ cart = [] }) => {
    for (const [itemId, btn] of addButtons) syncAddButton(btn, BC.cartHas(cart, itemId));
  });
  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
})();
