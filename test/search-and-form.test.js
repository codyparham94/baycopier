const test = require("node:test");
const assert = require("node:assert/strict");
const { BC, fixture, htmlDoc } = require("./helpers");

test("findResultItems handles both layouts and skips the placeholder", () => {
  const items = BC.findResultItems(fixture("search.html", "https://www.ebay.com/sch/i.html?LH_Sold=1"));
  assert.deepEqual(
    items.map((i) => [i.itemId, i.url]),
    [
      ["111111111111", "https://www.ebay.com/itm/111111111111"],
      ["222222222222", "https://www.ebay.com/itm/vintage-lens/222222222222"],
      ["377572455842", "https://www.ebay.com/itm/377572455842"],
    ]
  );
});

test("2026 sold card: sell link is not mistaken for the item link, title and price are clean", () => {
  const items = BC.findResultItems(fixture("search.html", "https://www.ebay.com/sch/i.html?LH_Sold=1"));
  const card = items.find((i) => i.itemId === "377572455842");
  const sell = [...card.el.querySelectorAll("a")].find((a) => BC.isSellLikeElement(a));
  assert.ok(sell, "card has a Sell one like this link");
  const s = BC.summarizeResult(card);
  assert.equal(s.title, "PAUL SKENES 2026 TOPPS X KAWS BASEBALL #44");
  assert.equal(s.price, "$1.25");
});

test("isSellLikeElement matches every sell button but not big wrappers", () => {
  const doc = htmlDoc(
    '<a id="a" href="/sl/list?mode=SellLikeItem&itemId=1">Sell one like this</a>' +
      '<button id="b">Sell one like this</button>' +
      '<a id="c" href="/x">A long promo block that says sell one like this somewhere in a big paragraph of text</a><div id="d">Sell one like this</div>'
  );
  assert.equal(BC.isSellLikeElement(doc.getElementById("a")), true);
  assert.equal(BC.isSellLikeElement(doc.getElementById("b")), true);
  assert.equal(BC.isSellLikeElement(doc.getElementById("c")), false);
  assert.equal(BC.isSellLikeElement(doc.getElementById("d")), false);
});

test("findPhotoInput prefers the image file input", () => {
  const doc = htmlDoc('<input type="file" accept=".csv"><input type="file" accept="image/*" multiple>');
  assert.equal(BC.findPhotoInput(doc).accept, "image/*");
});

test("fillDescription switches to HTML mode and fills the textarea", async () => {
  const doc = htmlDoc(`
    <label><input type="checkbox" id="html-toggle"> Show HTML code</label>
    <textarea name="description"></textarea>`);
  const textarea = doc.querySelector("textarea");
  let inputEvents = 0;
  textarea.addEventListener("input", () => inputEvents++);

  assert.equal(await BC.fillDescription(doc, "<p>Hello</p>"), true);
  assert.equal(doc.getElementById("html-toggle").checked, true);
  assert.equal(textarea.value, "<p>Hello</p>");
  assert.equal(inputEvents, 1);
});

test("fillDescription reports failure when there is no editor", async () => {
  assert.equal(await BC.fillDescription(htmlDoc("<div>nothing</div>"), "<p>x</p>"), false);
});
