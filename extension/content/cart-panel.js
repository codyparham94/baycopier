// The copy cart panel shown top-right on sold search pages. Reads and writes
// the cart in storage.local, so every open search tab shows the same cart.
(() => {
  const BC = globalThis.BayCopier;

  const SPRING =
    "linear(0, 0.0571, 0.1793, 0.3192, 0.4533, 0.571, 0.6691, 0.7483, 0.8106, 0.8587, 0.8954, 0.9231, 0.9437, 0.959, 0.9703, 0.9785, 0.9845, 0.9889, 0.992, 0.9943, 0.9959, 0.9971, 0.9979, 0.9985, 1)";

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .panel {
      position: fixed; top: 16px; right: 16px; z-index: 2147483646;
      width: 340px; max-height: calc(100vh - 32px);
      display: flex; flex-direction: column;
      font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #111820;
      background: rgba(255,255,255,0.88);
      backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(0,0,0,0.08); border-radius: 18px;
      box-shadow: 0 18px 50px -12px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.06);
      transform-origin: top right;
      animation: enter 420ms ${SPRING} both;
      overflow: hidden;
    }
    .panel.collapsed { width: auto; }
    @keyframes enter { from { opacity: 0; transform: scale(0.9) translateY(-6px); filter: blur(6px); } }
    header { display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 16px; cursor: pointer; user-select: none; }
    .panel:not(.collapsed) header { border-bottom: 1px solid rgba(0,0,0,0.07); }
    .title { font-weight: 700; letter-spacing: -0.01em; flex: 1; white-space: nowrap; }
    .count {
      min-width: 24px; height: 24px; padding: 0 7px; border-radius: 12px;
      display: inline-grid; place-items: center;
      background: #1b8a3a; color: #fff; font-weight: 700; font-size: 12px;
    }
    .count.bump { animation: bump 380ms ${SPRING}; }
    @keyframes bump { 40% { transform: scale(1.3); } }
    .chev { width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: #555; font-size: 14px; cursor: pointer; transition: background 200ms, transform 300ms ${SPRING}; }
    .chev:hover { background: rgba(0,0,0,0.06); }
    .collapsed .chev { transform: rotate(180deg); }
    .collapsed .body { display: none; }
    .body { display: flex; flex-direction: column; min-height: 0; }
    ul { list-style: none; margin: 0; padding: 6px; overflow: auto; }
    li {
      display: grid; grid-template-columns: 44px 1fr auto; gap: 10px; align-items: center;
      padding: 8px; border-radius: 12px;
      transition: background 200ms, opacity 300ms;
    }
    li.enter { animation: row-in 360ms ${SPRING} both; }
    li:hover { background: rgba(0,0,0,0.04); }
    li.done { opacity: 0.55; }
    @keyframes row-in { from { opacity: 0; transform: translateX(12px); } }
    .thumb { width: 44px; height: 44px; border-radius: 9px; object-fit: cover; background: #eef0f3; display: block; }
    .info { min-width: 0; }
    .name { font-size: 13px; font-weight: 560; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .price { font-size: 12px; color: #1b8a3a; font-weight: 650; margin-top: 2px; }
    .err { font-size: 12px; color: #c0262d; margin-top: 2px; }
    .state { width: 28px; height: 28px; display: grid; place-items: center; }
    .x { width: 28px; height: 28px; border: 0; border-radius: 50%; background: transparent; color: #777; font-size: 18px; line-height: 1; cursor: pointer; transition: background 200ms, color 200ms, transform 100ms ease-out; }
    .x:hover { background: rgba(192,38,45,0.1); color: #c0262d; }
    .x:active { transform: scale(0.9); }
    .ok { color: #1b8a3a; font-weight: 800; font-size: 16px; animation: bump 380ms ${SPRING}; }
    .bad { color: #c0262d; font-weight: 800; font-size: 16px; }
    .spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(27,138,58,0.25); border-top-color: #1b8a3a; animation: spin 700ms linear infinite; }
    @keyframes spin { to { rotate: 360deg; } }
    footer { display: flex; gap: 8px; align-items: center; padding: 10px 12px 12px; border-top: 1px solid rgba(0,0,0,0.07); }
    .summary { flex: 1; font-size: 12px; color: #555; }
    button.btn {
      border: 0; border-radius: 999px; padding: 9px 16px; cursor: pointer;
      font: 650 13px system-ui, sans-serif;
      transition: transform 380ms ${SPRING}, box-shadow 380ms ${SPRING}, background 200ms, opacity 200ms;
    }
    button.btn:hover { transform: translateY(-1px); }
    button.btn:active { transform: scale(0.97); transition-duration: 100ms; transition-timing-function: ease-out; }
    button.btn:disabled { opacity: 0.6; cursor: default; transform: none; }
    .go { background: linear-gradient(135deg, #1f9d45, #18b85a); color: #fff; box-shadow: 0 6px 16px -6px rgba(24,150,70,0.8); }
    .go:hover { box-shadow: 0 10px 22px -8px rgba(24,150,70,0.9); }
    .clear { background: transparent; color: #555; }
    .clear:hover { background: rgba(0,0,0,0.06); }
    @media (prefers-reduced-motion: reduce) {
      .panel, li, .count.bump, .ok { animation: none; }
      button.btn:hover, button.btn:active { transform: none; }
    }`;

  let cart = [];
  let collapsed = false;
  let running = false;
  const status = new Map(); // itemId -> { state: "busy" | "done" | "failed", error }
  const shown = new Set(); // rows already rendered, so only new ones animate in

  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  const panel = document.createElement("div");
  panel.className = "panel";
  root.append(style, panel);

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children.filter((c) => c != null));
    return node;
  }

  function stateCell(item) {
    const s = status.get(item.itemId);
    if (s && s.state === "busy") return el("div", { className: "state" }, el("div", { className: "spin" }));
    if (s && s.state === "done") return el("div", { className: "state ok", textContent: "✓" });
    const x = el("button", { className: "x", textContent: "×", title: "Remove from cart" });
    x.addEventListener("click", () => saveCart(BC.cartRemove(cart, item.itemId)));
    x.disabled = running;
    return x;
  }

  function render(bump) {
    if (!cart.length && !status.size) {
      host.remove();
      return;
    }
    if (!host.isConnected) document.documentElement.appendChild(host);
    panel.classList.toggle("collapsed", collapsed);

    const count = el("span", { className: "count" + (bump ? " bump" : ""), textContent: String(cart.length) });
    const chev = el("button", { className: "chev", textContent: "▴", title: collapsed ? "Expand" : "Collapse" });
    const header = el("header", {}, el("span", { className: "title", textContent: "BayCopier cart" }), count, chev);
    header.addEventListener("click", () => {
      collapsed = !collapsed;
      browser.storage.local.set({ cartCollapsed: collapsed });
      render();
    });

    const rows = cart.map((item) => {
      const s = status.get(item.itemId);
      const thumb = item.image ? el("img", { className: "thumb", src: item.image, alt: "" }) : el("div", { className: "thumb" });
      const info = el(
        "div",
        { className: "info" },
        el("div", { className: "name", textContent: item.title, title: item.title }),
        s && s.state === "failed"
          ? el("div", { className: "err", textContent: `Failed: ${s.error}` })
          : el("div", { className: "price", textContent: item.price })
      );
      const cls = [s && s.state === "done" ? "done" : "", shown.has(item.itemId) ? "" : "enter"].join(" ").trim();
      return el("li", { className: cls }, thumb, info, stateCell(item));
    });
    shown.clear();
    for (const item of cart) shown.add(item.itemId);

    const done = [...status.values()].filter((s) => s.state === "done").length;
    const failed = [...status.values()].filter((s) => s.state === "failed").length;
    const summaryText = running
      ? `Copying ${Math.min(done + failed + 1, cart.length)} of ${cart.length}…`
      : failed
        ? `${failed} failed — try again or remove`
        : `${cart.length} listing${cart.length === 1 ? "" : "s"} ready`;

    const go = el("button", { className: "btn go", textContent: running ? "Copying…" : `Copy all ${cart.length}` });
    go.disabled = running || !cart.length;
    go.addEventListener("click", copyAll);
    const clear = el("button", { className: "btn clear", textContent: "Clear" });
    clear.disabled = running;
    clear.addEventListener("click", () => saveCart([]));

    const body = el(
      "div",
      { className: "body" },
      el("ul", {}, ...rows),
      el("footer", {}, el("span", { className: "summary", textContent: summaryText }), clear, go)
    );
    panel.replaceChildren(header, body);
  }

  function saveCart(next) {
    return browser.storage.local.set({ cart: next });
  }

  async function copyAll() {
    const items = [...cart];
    if (items.length > BC.BATCH_CONFIRM_OVER && !confirm(`Open ${items.length} listing tabs?`)) return;
    running = true;
    status.clear();
    for (const [i, item] of items.entries()) {
      if (i) await new Promise((r) => setTimeout(r, 800)); // be gentle with eBay
      status.set(item.itemId, { state: "busy" });
      render();
      try {
        await browser.runtime.sendMessage({ type: "copyFromSearch", url: item.url, active: false });
        status.set(item.itemId, { state: "done" });
      } catch (err) {
        status.set(item.itemId, { state: "failed", error: err.message || String(err) });
      }
      render();
    }
    running = false;
    render();
    // Copied items leave the cart; failed ones stay for a retry.
    setTimeout(async () => {
      const copied = [...status].filter(([, s]) => s.state === "done").map(([id]) => id);
      for (const id of copied) status.delete(id);
      const { cart: latest = [] } = await browser.storage.local.get("cart");
      await saveCart(latest.filter((i) => !copied.includes(i.itemId)));
    }, 1500);
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.cart) {
      const before = cart.length;
      cart = changes.cart.newValue || [];
      for (const id of status.keys()) if (!BC.cartHas(cart, id)) status.delete(id);
      render(cart.length !== before);
    }
    if (changes.cartCollapsed) {
      collapsed = !!changes.cartCollapsed.newValue;
      render();
    }
  });

  browser.storage.local.get(["cart", "cartCollapsed"]).then((s) => {
    cart = s.cart || [];
    collapsed = !!s.cartCollapsed;
    render();
  });

  BC.CartPanel = {
    toggle: async (item) => {
      const { cart: latest = [] } = await browser.storage.local.get("cart");
      await saveCart(BC.cartToggle(latest, item));
    },
    has: (itemId) => BC.cartHas(cart, itemId),
    onChange(fn) {
      browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.cart) fn(changes.cart.newValue || []);
      });
    },
  };
})();
