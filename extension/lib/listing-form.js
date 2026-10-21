// Locating and filling eBay's listing form (/lstng, /sl/...). This is the part
// most likely to need updating when eBay changes its listing tool.
(function (root) {
  const BC = root.BayCopier || (root.BayCopier = {});

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  BC.findPhotoInput = function (doc) {
    const inputs = [...doc.querySelectorAll('input[type="file"]')];
    return inputs.find((i) => /image|jpe?g|png/i.test(i.accept || "")) || inputs[0] || null;
  };

  BC.findDescriptionTextarea = function (doc) {
    return doc.querySelector(
      'textarea[name="description"], textarea[data-testid*="description" i], textarea[aria-label*="description" i], textarea[id*="description" i]'
    );
  };

  // The "Show HTML code" / "HTML" switch of the description editor.
  BC.findHtmlToggle = function (doc) {
    for (const el of doc.querySelectorAll('input[type="checkbox"], [role="switch"], button')) {
      const label = (el.labels && el.labels[0] && el.labels[0].textContent) || el.getAttribute("aria-label") || el.textContent || "";
      if (/\bhtml\b/i.test(label) && label.trim().length < 60) return el;
    }
    return null;
  };

  // The WYSIWYG editor body, either inline or inside a same-origin iframe.
  BC.findRichEditor = function (doc) {
    const inline = doc.querySelector('[contenteditable="true"][aria-label*="description" i], [class*="rte"] [contenteditable="true"]');
    if (inline) return inline;
    for (const frame of doc.querySelectorAll('iframe[id*="rte"], iframe[title*="description" i]')) {
      try {
        const body = frame.contentDocument && frame.contentDocument.body;
        if (body && body.isContentEditable) return body;
      } catch {
        // Cross-origin frame; not the editor.
      }
    }
    return null;
  };

  const fire = (el, type) => el.dispatchEvent(new el.ownerDocument.defaultView.Event(type, { bubbles: true }));

  // Sets a form control's value so framework listeners notice the change.
  BC.setControlValue = function (el, value) {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, "value");
    if (setter && setter.set) setter.set.call(el, value);
    else el.value = value;
    fire(el, "input");
    fire(el, "change");
    fire(el, "blur");
  };

  // Returns true if the description was written somewhere eBay will save it.
  BC.fillDescription = async function (doc, html) {
    let textarea = BC.findDescriptionTextarea(doc);
    const toggle = BC.findHtmlToggle(doc);
    if (toggle && toggle.type === "checkbox" && !toggle.checked) {
      toggle.click();
      await sleep(800);
      textarea = BC.findDescriptionTextarea(doc) || textarea;
    } else if (!textarea && toggle) {
      toggle.click();
      await sleep(800);
      textarea = BC.findDescriptionTextarea(doc);
    }
    let done = false;
    if (textarea) {
      BC.setControlValue(textarea, html);
      done = true;
    }
    const rich = BC.findRichEditor(doc);
    if (rich) {
      const parsed = new DOMParser().parseFromString(html, "text/html");
      rich.replaceChildren(...[...parsed.body.childNodes].map((n) => rich.ownerDocument.importNode(n, true)));
      fire(rich, "input");
      done = true;
    }
    return done;
  };

  // Hands File objects to eBay's photo uploader. Returns true if a target was found.
  BC.attachPhotos = function (doc, files) {
    if (!files.length) return false;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    const input = BC.findPhotoInput(doc);
    if (input) {
      input.files = dt.files;
      fire(input, "input");
      fire(input, "change");
      return true;
    }
    const zone = doc.querySelector('[class*="uploader" i], [data-testid*="photo" i], [class*="photo-upload" i]');
    if (!zone) return false;
    for (const type of ["dragenter", "dragover", "drop"]) {
      zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    }
    return true;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BC;
})(typeof globalThis !== "undefined" ? globalThis : this);
