const $ = (id) => document.getElementById(id);
const status = $("status");

function show(text, kind) {
  status.textContent = text;
  status.className = kind || "";
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
  $("test").disabled = true;
  show("Testing…");
  try {
    await browser.runtime.sendMessage({ type: "testApi", ...creds });
    show("Connected to eBay ✓", "ok");
  } catch (err) {
    show(`eBay rejected the keys: ${err.message}`, "err");
  } finally {
    $("test").disabled = false;
  }
});

$("clear").addEventListener("click", async () => {
  await browser.storage.local.remove(["apiClientId", "apiClientSecret"]);
  $("clientId").value = "";
  $("clientSecret").value = "";
  show("Keys removed.", "ok");
});

load();
