// Checks GitHub Releases for a newer BayCopier. Temporarily loaded add-ons
// can't replace themselves, so this only tells the user and links the download.
(function (root) {
  const BC = root.BayCopier || (root.BayCopier = {});

  const NOTIFICATION_ID = "baycopier-update";

  // Release JSON from the GitHub API -> update info for this version.
  BC.updateInfoFromRelease = function (release, currentVersion) {
    const latest = String(release.tag_name || "").replace(/^v/i, "");
    const zip = (release.assets || []).find((a) => /\.(zip|xpi)$/i.test(a.name));
    return {
      current: currentVersion,
      latest,
      newer: !!latest && BC.compareVersions(latest, currentVersion) > 0,
      pageUrl: release.html_url,
      downloadUrl: zip ? zip.browser_download_url : release.html_url,
      checkedAt: Date.now(),
    };
  };

  async function announce(info) {
    await browser.action.setBadgeText({ text: info.newer ? "NEW" : "" });
    if (info.newer) await browser.action.setBadgeBackgroundColor({ color: "#3665f3" });
    await browser.action.setTitle({ title: info.newer ? `BayCopier ${info.latest} is available` : "BayCopier settings" });

    const { notifiedVersion } = await browser.storage.local.get("notifiedVersion");
    if (info.newer && notifiedVersion !== info.latest) {
      await browser.notifications.create(NOTIFICATION_ID, {
        type: "basic",
        iconUrl: browser.runtime.getURL("icons/icon.svg"),
        title: `BayCopier ${info.latest} is available`,
        message: `You have ${info.current}. Click to open settings and download the new version.`,
      });
      await browser.storage.local.set({ notifiedVersion: info.latest });
    }
  }

  BC.Updates = {
    NOTIFICATION_ID,

    // Fetches the latest release, stores and announces the result.
    // Returns null when the repo has no releases yet.
    async check() {
      const res = await fetch(`https://api.github.com/repos/${BC.REPO}/releases/latest`, {
        headers: { Accept: "application/vnd.github+json" },
        cache: "no-store",
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
      const info = BC.updateInfoFromRelease(await res.json(), browser.runtime.getManifest().version);
      await browser.storage.local.set({ update: info });
      await announce(info);
      return info;
    },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BC;
})(typeof globalThis !== "undefined" ? globalThis : this);
