const test = require("node:test");
const assert = require("node:assert/strict");
const { BC, fixture, htmlDoc } = require("./helpers");

test("isSoldSearch detects the sold filter", () => {
  assert.equal(BC.isSoldSearch("https://www.ebay.com/sch/i.html?_nkw=x&LH_Sold=1"), true);
  assert.equal(BC.isSoldSearch("https://www.ebay.com/sch/i.html?_nkw=x"), false);
});

test("findResultItems handles both layouts and skips the placeholder", () => {
  const items = BC.findResultItems(fixture("search.html", "https://www.ebay.com/sch/i.html?LH_Sold=1"));
  assert.deepEqual(
    items.map((i) => [i.itemId, i.url]),
    [
      ["111111111111", "https://www.ebay.com/itm/111111111111"],
      ["222222222222", "https://www.ebay.com/itm/vintage-lens/222222222222"],
    ]
  );
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
