const test = require("node:test");
const assert = require("node:assert/strict");
const { BC, fixture } = require("./helpers");
require("../extension/lib/cart.js");

const a = { itemId: "1", url: "u1", title: "A", price: "$1", image: "" };
const b = { itemId: "2", url: "u2", title: "B", price: "$2", image: "" };

test("cartToggle adds then removes, without mutating", () => {
  const empty = [];
  const one = BC.cartToggle(empty, a);
  assert.equal(empty.length, 0);
  assert.equal(one.length, 1);
  assert.ok(one[0].addedAt);
  const two = BC.cartToggle(one, b);
  assert.deepEqual(two.map((i) => i.itemId), ["1", "2"]);
  assert.deepEqual(BC.cartToggle(two, a).map((i) => i.itemId), ["2"]);
});

test("cartHas and cartRemove", () => {
  const cart = [a, b];
  assert.equal(BC.cartHas(cart, "2"), true);
  assert.equal(BC.cartHas(cart, "3"), false);
  assert.deepEqual(BC.cartRemove(cart, "1"), [b]);
});

test("summarizeResult reads title, price and thumbnail", () => {
  const [first, second] = BC.findResultItems(fixture("search.html", "https://www.ebay.com/sch/i.html?LH_Sold=1"));
  assert.deepEqual(BC.summarizeResult(first), {
    itemId: "111111111111",
    url: "https://www.ebay.com/itm/111111111111",
    title: "Old camera",
    price: "$120.00",
    image: "https://i.ebayimg.com/images/g/THUMB1/s-l140.jpg",
  });
  assert.equal(BC.summarizeResult(second).title, "Item 222222222222");
});
