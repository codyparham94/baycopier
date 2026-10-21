const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const window = new JSDOM("").window;
globalThis.DOMParser = window.DOMParser;
globalThis.Event = window.Event;

require("../extension/lib/common.js");
require("../extension/lib/item-page.js");
require("../extension/lib/search-page.js");
require("../extension/lib/listing-form.js");

function fixture(name, url = "https://www.ebay.com/") {
  const html = fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
  return new JSDOM(html, { url }).window.document;
}

function htmlDoc(html, url = "https://www.ebay.com/lstng?draftId=1") {
  return new JSDOM(html, { url }).window.document;
}

module.exports = { BC: globalThis.BayCopier, fixture, htmlDoc };
