const test = require("node:test");
const assert = require("node:assert/strict");
const { BC, fixture, htmlDoc } = require("./helpers");

const URL = "https://www.ebay.com/itm/123456789012";

test("parseItemPage extracts carousel photos, description URL and sell-like URL", () => {
  const info = BC.parseItemPage(fixture("item-page.html", URL), URL);
  assert.equal(info.itemId, "123456789012");
  assert.deepEqual(info.photoUrls, [
    "https://i.ebayimg.com/images/g/AAAAbbbbCCCC/s-l1600.jpg",
    "https://i.ebayimg.com/images/g/DDDD~eeeFFFF/s-l1600.jpg",
    "https://i.ebayimg.com/images/g/GGGG-hhhh/s-l1600.jpg",
  ]);
  assert.equal(info.descriptionUrl, "https://itm.ebaydesc.com/itmdesc/123456789012?t=0&category=1");
  assert.equal(info.sellLikeUrl, "https://www.ebay.com/sl/prelist/suggest?sellLikeItem=123456789012&mode=SellLikeItem");
});

test("photos fall back to og:image when no carousel exists", () => {
  const doc = htmlDoc('<head><meta property="og:image" content="https://i.ebayimg.com/images/g/OG1/s-l400.jpg"></head>', URL);
  assert.deepEqual(BC.extractPhotoUrls(doc), ["https://i.ebayimg.com/images/g/OG1/s-l1600.jpg"]);
});

test("findSellLikeElement returns the enclosing link", () => {
  const el = BC.findSellLikeElement(fixture("item-page.html", URL));
  assert.equal(el.tagName, "A");
});

test("sell-like and description URLs fall back when the page has neither", () => {
  const doc = htmlDoc('<button type="button">Sell one like this</button>', URL);
  assert.equal(BC.sellLikeUrl(doc, URL, "123456789012"), "https://www.ebay.com/sl/list?mode=SellLikeItem&itemId=123456789012");
  assert.equal(BC.descriptionUrl(doc, URL, "123456789012"), "https://itm.ebaydesc.com/itmdesc/123456789012");
});

test("extractDescriptionHtml takes the seller's block and sanitizes cleanly", () => {
  const html = BC.sanitizeDescription(BC.extractDescriptionHtml(fixture("description.html", "https://itm.ebaydesc.com/itmdesc/1")));
  assert.match(html, /Vintage Camera/);
  assert.match(html, /50mm/);
  assert.match(html, /DESCIMG/);
  assert.doesNotMatch(html, /tracker|alert|steal|evil|onerror|javascript:/);
});
