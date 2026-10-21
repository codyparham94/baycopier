const test = require("node:test");
const assert = require("node:assert/strict");
const { BC } = require("./helpers");

test("itemIdFromUrl handles plain and slugged item URLs", () => {
  assert.equal(BC.itemIdFromUrl("https://www.ebay.com/itm/123456789012"), "123456789012");
  assert.equal(BC.itemIdFromUrl("https://www.ebay.co.uk/itm/vintage-thing/123456789012?hash=x"), "123456789012");
  assert.equal(BC.itemIdFromUrl("https://www.ebay.com/sch/i.html"), null);
});

test("normalizeImageUrl upgrades to 1600px jpg", () => {
  assert.equal(
    BC.normalizeImageUrl("https://i.ebayimg.com/images/g/AbC~d-E/s-l500.webp"),
    "https://i.ebayimg.com/images/g/AbC~d-E/s-l1600.jpg"
  );
  assert.equal(
    BC.normalizeImageUrl("https://i.ebayimg.com/00/s/MTYwMFgxMjAw/z/XyZ123/$_57.JPG"),
    "https://i.ebayimg.com/images/g/XyZ123/s-l1600.jpg"
  );
  assert.equal(BC.normalizeImageUrl("https://ir.ebaystatic.com/logo.png"), null);
});

test("uniquePhotoUrls dedupes and caps at 24", () => {
  const urls = [];
  for (let i = 0; i < 30; i++) urls.push(`https://i.ebayimg.com/images/g/id${i}/s-l64.jpg`, `https://i.ebayimg.com/images/g/id${i}/s-l500.jpg`);
  const out = BC.uniquePhotoUrls(urls);
  assert.equal(out.length, 24);
  assert.equal(out[0], "https://i.ebayimg.com/images/g/id0/s-l1600.jpg");
  assert.equal(new Set(out).size, 24);
});

test("marketplaceFor maps sites", () => {
  assert.equal(BC.marketplaceFor("https://www.ebay.co.uk/itm/1"), "EBAY_GB");
  assert.equal(BC.marketplaceFor("https://www.ebay.com.au/itm/1"), "EBAY_AU");
  assert.equal(BC.marketplaceFor("not a url"), "EBAY_US");
});

test("sanitizeDescription strips active content but keeps formatting", () => {
  const out = BC.sanitizeDescription(
    '<style>.a{}</style><h2 onclick="x()">Hi</h2><script>bad()</script><iframe src="x"></iframe>' +
      '<a href="javascript:alert(1)">a</a><a href="https://ok.example">b</a><form><input></form><table><tr><td>t</td></tr></table>'
  );
  assert.match(out, /<style>/);
  assert.match(out, /<h2>Hi<\/h2>/);
  assert.match(out, /<table>/);
  assert.match(out, /href="https:\/\/ok\.example"/);
  assert.doesNotMatch(out, /script|iframe|onclick|javascript:|<form|<input/i);
});
