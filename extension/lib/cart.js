// The copy cart: sold items queued to be copied together. Pure helpers over
// the array stored in storage.local under "cart".
(function (root) {
  const BC = root.BayCopier || (root.BayCopier = {});

  BC.BATCH_CONFIRM_OVER = 10;

  BC.cartHas = (cart, itemId) => cart.some((i) => i.itemId === itemId);

  // Adds the item, or removes it if it's already there. Returns a new array.
  BC.cartToggle = (cart, item) =>
    BC.cartHas(cart, item.itemId) ? BC.cartRemove(cart, item.itemId) : [...cart, { ...item, addedAt: Date.now() }];

  BC.cartRemove = (cart, itemId) => cart.filter((i) => i.itemId !== itemId);

  if (typeof module !== "undefined" && module.exports) module.exports = BC;
})(typeof globalThis !== "undefined" ? globalThis : this);
