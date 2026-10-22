// Parsing for an eBay item page (/itm/...) and its description document.
// Pure functions over a Document so they run on the live page, on a page
// fetched by the background script, and on test fixtures.
(function (root) {
  const BC = root.BayCopier || (root.BayCopier = {});

  const SELL_LIKE_TEXT = /sell\s+one\s+like\s+this|sell\s+a\s+similar\s+item|sell\s+it\s+yourself/i;

  // Photo carousel / filmstrip containers, newest layout first.
  const PHOTO_CONTAINERS = [
    '[data-testid="ux-image-carousel-container"]',
    ".ux-image-carousel-container",
    ".ux-image-carousel",
    ".ux-image-filmstrip",
    ".ux-image-grid",
    "#PicturePanel",
    "#vi_main_img_fs",
  ];

  const IMAGE_ATTRS = ["src", "data-src", "data-zoom-src", "data-originalsrc", "srcset", "data-srcset"];

  // True for any "Sell one like this" control. eBay renders several per item
  // page (some hidden until another layout shows them) and one per sold
  // search result.
  BC.isSellLikeElement = function (el) {
    if (!el || !el.matches || !el.matches('a, button, [role="button"]')) return false;
    const text = (el.textContent || "").trim();
    return text.length < 60 && SELL_LIKE_TEXT.test(text);
  };

  // The first "Sell one like this" control on the page, or null.
  BC.findSellLikeElement = function (doc) {
    for (const el of doc.querySelectorAll('a, button, [role="button"]')) {
      if (BC.isSellLikeElement(el)) return el.closest("a") || el;
    }
    return null;
  };

  // The URL eBay itself would open for "Sell one like this".
  BC.sellLikeUrl = function (doc, pageUrl, itemId) {
    const el = BC.findSellLikeElement(doc);
    const href = el && el.getAttribute("href");
    if (href && !href.startsWith("#") && !/^javascript:/i.test(href)) {
      return new URL(href, pageUrl).href;
    }
    // Used only when the page has no usable link (e.g. eBay renders the
    // button as a script-driven <button>). Verify against a live page if
    // eBay changes its listing flow.
    const origin = new URL(pageUrl).origin;
    return `${origin}/sl/list?mode=SellLikeItem&itemId=${itemId}`;
  };

  BC.extractPhotoUrls = function (doc) {
    const raw = [];
    for (const sel of PHOTO_CONTAINERS) {
      for (const container of doc.querySelectorAll(sel)) {
        for (const el of container.querySelectorAll("img, source")) {
          for (const attr of IMAGE_ATTRS) {
            const v = el.getAttribute(attr);
            if (!v) continue;
            // srcset: "url 1x, url 2x"
            for (const part of v.split(",")) raw.push(part.trim().split(/\s+/)[0]);
          }
        }
      }
      if (raw.length) break;
    }
    if (!raw.length) {
      const og = doc.querySelector('meta[property="og:image"]');
      if (og) raw.push(og.getAttribute("content"));
    }
    return BC.uniquePhotoUrls(raw);
  };

  BC.descriptionUrl = function (doc, pageUrl, itemId) {
    const frame = doc.querySelector("iframe#desc_ifr, iframe[src*='ebaydesc.com']");
    const src = frame && frame.getAttribute("src");
    if (src) return new URL(src, pageUrl).href;
    return `https://itm.ebaydesc.com/itmdesc/${itemId}`;
  };

  // Everything the background needs from an item page.
  BC.parseItemPage = function (doc, pageUrl) {
    const itemId = BC.itemIdFromUrl(pageUrl);
    return {
      itemId,
      pageUrl,
      photoUrls: BC.extractPhotoUrls(doc),
      descriptionUrl: BC.descriptionUrl(doc, pageUrl, itemId),
      sellLikeUrl: BC.sellLikeUrl(doc, pageUrl, itemId),
    };
  };

  // The seller's HTML inside the description iframe document.
  BC.extractDescriptionHtml = function (descDoc) {
    const box = descDoc.querySelector("#ds_div, .x-item-description-child, #desc_div") || descDoc.body;
    return box ? box.innerHTML.trim() : "";
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BC;
})(typeof globalThis !== "undefined" ? globalThis : this);
