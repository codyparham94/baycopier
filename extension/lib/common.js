// Shared constants and helpers. Loaded as a plain script in every extension
// context (content scripts, background, options) and via require() in tests.
(function (root) {
  const BC = root.BayCopier || (root.BayCopier = {});

  BC.MAX_PHOTOS = 24;
  BC.JOB_TTL_MS = 30 * 60 * 1000;

  // Hostname -> Browse API marketplace ID.
  BC.SITES = {
    "www.ebay.com": "EBAY_US",
    "www.ebay.co.uk": "EBAY_GB",
    "www.ebay.ca": "EBAY_CA",
    "www.ebay.com.au": "EBAY_AU",
  };

  BC.marketplaceFor = function (url) {
    try {
      return BC.SITES[new URL(url).hostname] || "EBAY_US";
    } catch {
      return "EBAY_US";
    }
  };

  // /itm/123456789012 or /itm/some-title/123456789012
  BC.itemIdFromUrl = function (url) {
    const m = String(url).match(/\/itm\/(?:[^/?#]+\/)?(\d{9,15})(?:[/?#]|$)/);
    return m ? m[1] : null;
  };

  // Rewrites any known eBay image URL to the 1600px JPEG of the same photo.
  // Returns null for URLs that are not eBay listing photos.
  BC.normalizeImageUrl = function (url) {
    if (!url) return null;
    const s = String(url).trim();
    let m = s.match(/i\.ebayimg\.com\/images\/g\/([A-Za-z0-9_~-]+)\/s-l\d+\.(?:jpe?g|png|webp|gif)/i);
    if (m) return `https://i.ebayimg.com/images/g/${m[1]}/s-l1600.jpg`;
    // Older form: i.ebayimg.com/00/s/MTYwMFgxMjAw/z/<id>/$_57.JPG
    m = s.match(/i\.ebayimg\.com\/\d+\/s\/[^/]+\/z\/([A-Za-z0-9_~-]+)\//i);
    if (m) return `https://i.ebayimg.com/images/g/${m[1]}/s-l1600.jpg`;
    return null;
  };

  // Normalizes, de-duplicates and caps a list of image URLs, keeping order.
  BC.uniquePhotoUrls = function (urls) {
    const out = [];
    for (const u of urls) {
      const n = BC.normalizeImageUrl(u);
      if (n && !out.includes(n)) out.push(n);
      if (out.length === BC.MAX_PHOTOS) break;
    }
    return out;
  };

  // Polls fn() until it returns something truthy or the timeout passes.
  BC.waitFor = async function (fn, timeoutMs, intervalMs = 1000) {
    const end = Date.now() + timeoutMs;
    for (;;) {
      const result = fn();
      if (result) return result;
      if (Date.now() > end) return null;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  };

  const BLOCKED_TAGS = "script,noscript,iframe,frame,frameset,object,embed,applet,form,input,button,select,textarea,link,meta,base";

  // Strips active content from description HTML. eBay rejects JavaScript and
  // most embedded content in descriptions, so this is also what it accepts.
  BC.sanitizeDescription = function (html, parser) {
    const doc = (parser || new DOMParser()).parseFromString(`<body>${html || ""}</body>`, "text/html");
    doc.querySelectorAll(BLOCKED_TAGS).forEach((el) => el.remove());
    for (const el of doc.body.querySelectorAll("*")) {
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        if (name.startsWith("on")) el.removeAttribute(attr.name);
        else if (["href", "src", "action", "formaction", "xlink:href"].includes(name) && /^(javascript|vbscript|data:text\/html)/.test(value)) {
          el.removeAttribute(attr.name);
        }
      }
    }
    return doc.body.innerHTML.trim();
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BC;
})(typeof globalThis !== "undefined" ? globalThis : this);
