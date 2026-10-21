const $ = (id) => document.getElementById(id);
const status = $("status");

function show(text, kind) {
  status.className = kind || "";
  status.textContent = text;
  void status.offsetWidth; // restart the entrance transition for each message
  status.classList.add("show");
}

function setBusy(btn, busy) {
  btn.disabled = busy;
  btn.classList.toggle("busy", busy);
}

function readForm() {
  return { clientId: $("clientId").value.trim(), clientSecret: $("clientSecret").value.trim() };
}

async function load() {
  const { apiClientId = "", apiClientSecret = "" } = await browser.storage.local.get(["apiClientId", "apiClientSecret"]);
  $("clientId").value = apiClientId;
  $("clientSecret").value = apiClientSecret;

  const origins = browser.runtime.getManifest().host_permissions;
  if (!(await browser.permissions.contains({ origins }))) {
    $("perm-section").hidden = false;
    $("grant").onclick = async () => {
      if (await browser.permissions.request({ origins })) $("perm-section").hidden = true;
    };
  }
}

$("api-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { clientId, clientSecret } = readForm();
  if (!clientId || !clientSecret) return show("Enter both the App ID and the Cert ID.", "err");
  await browser.storage.local.set({ apiClientId: clientId, apiClientSecret: clientSecret });
  show("Saved.", "ok");
});

$("test").addEventListener("click", async () => {
  const creds = readForm();
  if (!creds.clientId || !creds.clientSecret) return show("Enter both the App ID and the Cert ID.", "err");
  setBusy($("test"), true);
  show("Testing…");
  try {
    await browser.runtime.sendMessage({ type: "testApi", ...creds });
    show("Connected to eBay ✓", "ok");
  } catch (err) {
    show(`eBay rejected the keys: ${err.message}`, "err");
  } finally {
    setBusy($("test"), false);
  }
});

$("clear").addEventListener("click", async () => {
  await browser.storage.local.remove(["apiClientId", "apiClientSecret"]);
  $("clientId").value = "";
  $("clientSecret").value = "";
  show("Keys removed.", "ok");
});

function renderUpdate(info) {
  const current = browser.runtime.getManifest().version;
  $("current-version").textContent = current;
  const text = $("update-text");
  const newer = info && info.newer && info.current === current;
  $("updates").classList.toggle("available", !!newer);
  $("update-badge").hidden = !newer;
  $("download").hidden = !newer;
  $("update-help").hidden = !newer;
  if (newer) {
    text.textContent = `BayCopier ${info.latest} is available (you have ${current}).`;
    $("download").href = info.downloadUrl;
  } else if (info) {
    text.textContent = `Version ${current} — up to date (checked ${new Date(info.checkedAt).toLocaleString()}).`;
  }
}

$("check").addEventListener("click", async () => {
  setBusy($("check"), true);
  try {
    const info = await browser.runtime.sendMessage({ type: "checkUpdates" });
    if (info) renderUpdate(info);
    else $("update-text").textContent = `Version ${browser.runtime.getManifest().version} — no releases published yet.`;
  } catch (err) {
    $("update-text").textContent = `Couldn't reach GitHub: ${err.message}`;
  } finally {
    setBusy($("check"), false);
  }
});

browser.storage.local.get("update").then(({ update }) => renderUpdate(update));
load();
