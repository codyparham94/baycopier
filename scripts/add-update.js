// Adds a signed release to updates.json, the manifest Firefox polls via the
// extension's update_url.
//   node scripts/add-update.js <path-to-signed.xpi> <download-url>
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const [xpiPath, downloadUrl] = process.argv.slice(2);
if (!xpiPath || !downloadUrl) {
  console.error("usage: node scripts/add-update.js <signed.xpi> <download-url>");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "extension/manifest.json"), "utf8"));
const gecko = manifest.browser_specific_settings.gecko;
const updatesPath = path.join(root, "updates.json");
const updates = JSON.parse(fs.readFileSync(updatesPath, "utf8"));

const entry = updates.addons[gecko.id] || (updates.addons[gecko.id] = { updates: [] });
const hash = crypto.createHash("sha256").update(fs.readFileSync(xpiPath)).digest("hex");

entry.updates = entry.updates.filter((u) => u.version !== manifest.version);
entry.updates.push({
  version: manifest.version,
  update_link: downloadUrl,
  update_hash: `sha256:${hash}`,
  applications: { gecko: { strict_min_version: gecko.strict_min_version } },
});

fs.writeFileSync(updatesPath, JSON.stringify(updates, null, 2) + "\n");
console.log(`updates.json: added ${manifest.version} -> ${downloadUrl}`);
