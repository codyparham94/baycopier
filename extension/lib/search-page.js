// Parsing for eBay search results (/sch/...).
(function (root) {
  const BC = root.BayCopier || (root.BayCopier = {});

  BC.isSoldSearch = function (url) {
    try {
      const p = new URL(url).searchParams;
      return p.get("LH_Sold") === "1" || p.get("LH_Complete") === "1";
    } catch {
      return false;
    }
  };

  // Result cards with their item URL. Handles both the classic `s-item` and
  // the newer `s-card` layout.
  BC.findResultItems = function (doc) {
    const out = [];
    for (const el of doc.querySelectorAll("li.s-item, li.s-card, div.s-card")) {
      const link = el.querySelector("a.s-item__link, a.su-link, a[href*='/itm/']");
      const href = link && link.href;
      const itemId = href && BC.itemIdFromUrl(href);
      // eBay inserts a hidden placeholder card with item 123456.
      if (itemId && itemId !== "123456") out.push({ el, itemId, url: href.split("?")[0] });
    }
    return out;
  };

  const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

  // Title / price / thumbnail of a result card, for the cart summary.
  BC.summarizeResult = function (result) {
    const el = result.el;
    const titleEl = el.querySelector(".s-item__title, .s-card__title, [role='heading']");
    const title = text(titleEl).replace(/^New Listing\s*/i, "") || `Item ${result.itemId}`;
    const price = text(el.querySelector(".s-item__price, .s-card__price"));
    const img = el.querySelector("img");
    const image = img && (img.getAttribute("src") || img.getAttribute("data-src") || "");
    return { itemId: result.itemId, url: result.url, title, price, image: /^https?:/.test(image) ? image : "" };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BC;
})(typeof globalThis !== "undefined" ? globalThis : this);
