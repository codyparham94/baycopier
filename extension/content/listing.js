// Listing form: applies a pending copy job (description + photos).
(async () => {
  const BC = globalThis.BayCopier;
  if (window.top !== window) return;

  const job = await browser.runtime.sendMessage({ type: "getJob" });
  if (!job) return;

  // eBay may show a pre-listing step first and reach the form client-side,
  // so keep waiting quietly while this page is open.
  const form = await BC.waitFor(
    () => BC.findPhotoInput(document) || BC.findDescriptionTextarea(document) || BC.findRichEditor(document),
    10 * 60 * 1000
  );
  if (!form) return;
  await new Promise((r) => setTimeout(r, 1500)); // let the form finish rendering

  const banner = createBanner();
  banner.set(`Copying item ${job.itemId}…`);
  const lines = [];

  if (job.descriptionHtml) {
    const ok = await BC.fillDescription(document, job.descriptionHtml);
    lines.push(ok ? "✓ Description copied" : "✗ Description editor not found");
  } else {
    lines.push("✗ No description found on the sold listing");
  }

  let photoFailed = job.photoUrls.length === 0;
  if (job.photoUrls.length) {
    const results = await browser.runtime.sendMessage({ type: "fetchPhotos", urls: job.photoUrls });
    const files = results
      .filter((r) => r.ok)
      .map((r, i) => new File([r.data], `photo-${String(i + 1).padStart(2, "0")}.jpg`, { type: r.type }));
    const attached = BC.attachPhotos(document, files);
    photoFailed = !attached || files.length < job.photoUrls.length;
    lines.push(
      attached ? `${photoFailed ? "✗" : "✓"} ${files.length}/${job.photoUrls.length} photos added` : "✗ Photo uploader not found"
    );
  } else {
    lines.push("✗ No photos found on the sold listing");
  }

  for (const note of job.notes || []) lines.push(`ℹ ${note}`);
  await browser.runtime.sendMessage({ type: "clearJob" });

  banner.set(lines.join("\n"));
  if (photoFailed && job.photoUrls.length) {
    banner.action("Download photos", () =>
      browser.runtime.sendMessage({ type: "downloadPhotos", urls: job.photoUrls, itemId: job.itemId })
    );
  }

  function createBanner() {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .box{font:13px/1.5 system-ui,sans-serif;background:#fff;color:#111;border:1px solid #ccc;border-left:4px solid #3665f3;
             border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:12px 14px;max-width:320px}
        .title{font-weight:700;margin-bottom:4px;display:flex;justify-content:space-between;gap:12px}
        .msg{white-space:pre-line}
        button{font:inherit;cursor:pointer}
        .close{border:0;background:none;font-size:16px;line-height:1}
        .act{margin-top:8px;padding:4px 12px;border:1px solid #3665f3;border-radius:16px;background:#3665f3;color:#fff}
      </style>
      <div class="box"><div class="title">BayCopier<button class="close" title="Close">×</button></div><div class="msg"></div></div>`;
    root.querySelector(".close").onclick = () => host.remove();
    document.body.appendChild(host);
    return {
      set: (text) => (root.querySelector(".msg").textContent = text),
      action(label, fn) {
        const b = document.createElement("button");
        b.className = "act";
        b.textContent = label;
        b.onclick = fn;
        root.querySelector(".box").appendChild(b);
      },
    };
  }
})();
