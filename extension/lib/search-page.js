// Parsing for eBay search results (/sch/...).
(function (root) {
  const BC = root.BayCopier || (root.BayCopier = {});

  // Result cards with their item URL. Handles both the classic `s-item` and
  // the newer `s-card` layout, live and sold.
  BC.findResultItems = function (doc) {
    const out = [];
    for (const el of doc.querySelectorAll("li.s-item, li.s-card, div.s-card")) {
      // Only item links: sold cards also hold an a.su-link to /sl/list.
      const link = el.querySelector("a.s-item__link, a[href*='/itm/']");
      const href = link && link.href;
      const itemId = href && BC.itemIdFromUrl(href);
      // eBay inserts a hidden placeholder card with item 123456.
      if (itemId && itemId !== "123456") out.push({ el, itemId, url: href.split("?")[0] });
    }
    return out;
  };

  const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

  // Visible text only: drops screen-reader extras like "Opens in a new window or tab".
  function visibleText(el) {
    if (!el) return "";
    const copy = el.cloneNode(true);
    copy.querySelectorAll(".clipped, .s-item__title--tagblock, [aria-hidden='true']").forEach((n) => n.remove());
    return text(copy);
  }

  const PRICE = /(?:[$£€]|AU \$|C \$)\s?\d/;

  // Title / price / thumbnail of a result card, for the cart summary.
  BC.summarizeResult = function (result) {
    const el = result.el;
    const titleEl = el.querySelector(".s-item__title, .s-card__title, [role='heading']");
    const title = visibleText(titleEl).replace(/^New Listing\s*/i, "") || `Item ${result.itemId}`;
    let price = text(el.querySelector(".s-item__price, .s-card__price"));
    if (!price) {
      // Newer cards style the price row without a price class.
      const row = [...el.querySelectorAll(".s-card__attribute-row")].find((r) => PRICE.test(r.textContent));
      price = text(row);
    }
    const img = el.querySelector("img");
    const image = img && (img.getAttribute("src") || img.getAttribute("data-src") || "");
    return { itemId: result.itemId, url: result.url, title, price, image: /^https?:/.test(image) ? image : "" };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BC;
})(typeof globalThis !== "undefined" ? globalThis : this);
