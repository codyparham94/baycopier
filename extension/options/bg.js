// Settings page background: bg.webp rendered as posterized pixel art with a
// luminance-sized dot matrix on top. The static layers are rendered once per
// resize; each frame only adds a pointer spotlight and a light twinkle.
(() => {
  const canvas = document.getElementById("bg");
  const ctx = canvas.getContext("2d");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const PIXEL = 4; // pixel-art cell, CSS px
  const DOT = 10; // dot-matrix pitch, CSS px
  const SPOT_RADIUS = 170;
  const LEVELS = 5; // colour levels per channel for the pixel-art layer

  let W = 0, H = 0, dpr = 1;
  let base = null; // pre-rendered static layers
  let dots = []; // [row][col] -> { x, y, r, rgb, lum } | null
  let twinklers = [];
  const spot = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, strength: 0, target: 0 };

  const img = new Image();
  img.src = "bg.webp";
  img.decode().then(() => {
    build();
    if (!reducedMotion.matches) requestAnimationFrame(frame);
  });

  // object-fit: cover crop of the source image for a w x h target.
  function coverRect(w, h) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / scale, sh = h / scale;
    return [(img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh];
  }

  function sample(w, h) {
    const c = new OffscreenCanvas(w, h);
    const cx = c.getContext("2d", { willReadFrequently: true });
    cx.drawImage(img, ...coverRect(w, h), 0, 0, w, h);
    return cx.getImageData(0, 0, w, h);
  }

  const posterize = (v) => Math.round((v / 255) * (LEVELS - 1)) * (255 / (LEVELS - 1));

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    base = new OffscreenCanvas(canvas.width, canvas.height);
    const b = base.getContext("2d");
    b.scale(dpr, dpr);
    b.fillStyle = "#05070f";
    b.fillRect(0, 0, W, H);

    // Layer 1: high-resolution pixel art — posterized, dimmed, hard edges.
    const pCols = Math.ceil(W / PIXEL), pRows = Math.ceil(H / PIXEL);
    const px = sample(pCols, pRows);
    for (let i = 0; i < px.data.length; i += 4) {
      px.data[i] = posterize(px.data[i]) * 0.38;
      px.data[i + 1] = posterize(px.data[i + 1]) * 0.38;
      px.data[i + 2] = posterize(px.data[i + 2]) * 0.42;
    }
    const small = new OffscreenCanvas(pCols, pRows);
    small.getContext("2d").putImageData(px, 0, 0);
    b.imageSmoothingEnabled = false;
    b.drawImage(small, 0, 0, pCols * PIXEL, pRows * PIXEL);

    // Pixel grid lines so the cells read as pixels, not blur.
    b.fillStyle = "rgba(0,0,0,0.28)";
    for (let x = 0; x < W; x += PIXEL) b.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += PIXEL) b.fillRect(0, y, W, 1);

    // Layer 2: dot matrix, dot radius follows luminance.
    const cols = Math.ceil(W / DOT), rows = Math.ceil(H / DOT);
    const dm = sample(cols, rows);
    dots = [];
    twinklers = [];
    b.globalCompositeOperation = "lighter";
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 4;
        const rgb = [dm.data[i], dm.data[i + 1], dm.data[i + 2]];
        const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
        if (lum < 0.12) {
          row.push(null);
          continue;
        }
        const dot = { x: c * DOT + DOT / 2, y: r * DOT + DOT / 2, r: (DOT / 2) * 0.85 * Math.sqrt(lum), rgb, lum };
        row.push(dot);
        b.fillStyle = `rgba(${rgb.join(",")},${0.35 + lum * 0.5})`;
        b.beginPath();
        b.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        b.fill();
        if (lum > 0.55 && Math.random() < 0.05) {
          twinklers.push({ dot, period: 1800 + Math.random() * 2600, phase: Math.random() * Math.PI * 2 });
        }
      }
      dots.push(row);
    }
    b.globalCompositeOperation = "source-over";

    // Vignette keeps the edges quiet and the centre column readable.
    const v = b.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(3,5,12,0.15)");
    v.addColorStop(1, "rgba(3,5,12,0.75)");
    b.fillStyle = v;
    b.fillRect(0, 0, W, H);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0);
  }

  function glowDot(dot, scale, alpha) {
    ctx.fillStyle = `rgba(${dot.rgb.join(",")},${alpha})`;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, Math.min(dot.r * scale, DOT * 0.62), 0, Math.PI * 2);
    ctx.fill();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(now - last, 64);
    last = now;

    // Critically damped follow: no overshoot, ~0.12s response.
    const k = 1 - Math.exp(-dt / 70);
    spot.x += (spot.tx - spot.x) * k;
    spot.y += (spot.ty - spot.y) * k;
    spot.strength += (spot.target - spot.strength) * (1 - Math.exp(-dt / 160));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "lighter";

    for (const t of twinklers) {
      const a = (Math.sin((now / t.period) * Math.PI * 2 + t.phase) + 1) / 2;
      glowDot(t.dot, 1 + a * 0.35, a * 0.35);
    }

    if (spot.strength > 0.01) {
      const c0 = Math.max(0, Math.floor((spot.x - SPOT_RADIUS) / DOT));
      const c1 = Math.min(dots[0].length - 1, Math.ceil((spot.x + SPOT_RADIUS) / DOT));
      const r0 = Math.max(0, Math.floor((spot.y - SPOT_RADIUS) / DOT));
      const r1 = Math.min(dots.length - 1, Math.ceil((spot.y + SPOT_RADIUS) / DOT));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const dot = dots[r][c];
          if (!dot) continue;
          const d = Math.hypot(dot.x - spot.x, dot.y - spot.y);
          if (d > SPOT_RADIUS) continue;
          const f = (1 - d / SPOT_RADIUS) ** 2 * spot.strength;
          glowDot(dot, 1 + f * 0.9, f * 0.6);
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(frame);
  }

  window.addEventListener("pointermove", (e) => {
    spot.tx = e.clientX;
    spot.ty = e.clientY;
    if (spot.strength < 0.01) {
      spot.x = spot.tx;
      spot.y = spot.ty;
    }
    spot.target = 1;
  });
  document.documentElement.addEventListener("pointerleave", () => (spot.target = 0));

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => img.complete && build(), 120);
  });
})();
