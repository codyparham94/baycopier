const test = require("node:test");
const assert = require("node:assert/strict");
const { BC } = require("./helpers");
require("../extension/lib/updates.js");

test("compareVersions orders numerically, ignoring a leading v", () => {
  assert.ok(BC.compareVersions("0.10.0", "0.9.9") > 0);
  assert.ok(BC.compareVersions("v1.0", "1.0.1") < 0);
  assert.equal(BC.compareVersions("v0.2.0", "0.2"), 0);
});

test("updateInfoFromRelease prefers the zip asset", () => {
  const info = BC.updateInfoFromRelease(
    {
      tag_name: "v0.3.0",
      html_url: "https://github.com/codyparham94/baycopier/releases/tag/v0.3.0",
      assets: [
        { name: "checksums.txt", browser_download_url: "https://x/checksums.txt" },
        { name: "baycopier-v0.3.0.zip", browser_download_url: "https://x/baycopier-v0.3.0.zip" },
      ],
    },
    "0.2.0"
  );
  assert.equal(info.latest, "0.3.0");
  assert.equal(info.newer, true);
  assert.equal(info.downloadUrl, "https://x/baycopier-v0.3.0.zip");
});

test("updateInfoFromRelease prefers the signed xpi over the zip", () => {
  const info = BC.updateInfoFromRelease(
    {
      tag_name: "v0.4.0",
      assets: [
        { name: "baycopier-v0.4.0.zip", browser_download_url: "https://x/a.zip" },
        { name: "baycopier-v0.4.0.xpi", browser_download_url: "https://x/a.xpi" },
      ],
    },
    "0.3.0"
  );
  assert.equal(info.downloadUrl, "https://x/a.xpi");
});

test("updateInfoFromRelease is not newer for the same or older tag", () => {
  assert.equal(BC.updateInfoFromRelease({ tag_name: "v0.2.0", assets: [] }, "0.2.0").newer, false);
  assert.equal(BC.updateInfoFromRelease({ tag_name: "v0.1.0", html_url: "p", assets: [] }, "0.2.0").newer, false);
});
