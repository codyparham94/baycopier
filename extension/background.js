// Background event page: cross-origin fetching, copy-job storage, downloads.
const BC = globalThis.BayCopier;

const parseHtml = (html) => new DOMParser().parseFromString(html, "text/html");

async function fetchText(url) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return res.text();
}

async function getCreds() {
  const { apiClientId, apiClientSecret } = await browser.storage.local.get(["apiClientId", "apiClientSecret"]);
  return apiClientId && apiClientSecret ? { clientId: apiClientId, clientSecret: apiClientSecret } : null;
}

// info: the result of BayCopier.parseItemPage().
async function buildJob(info) {
  const job = {
    itemId: info.itemId,
    sourceUrl: info.pageUrl,
    createdAt: Date.now(),
    descriptionHtml: "",
    photoUrls: info.photoUrls || [],
    notes: [],
  };

  const creds = await getCreds();
  if (creds) {
    try {
      const item = await BC.EbayApi.getItem(creds, info.itemId, BC.marketplaceFor(info.pageUrl));
      if (item) {
        job.descriptionHtml = item.descriptionHtml;
        if (item.photoUrls.length) job.photoUrls = item.photoUrls;
      }
    } catch (e) {
      job.notes.push(`eBay API: ${e.message}`);
    }
  }

  if (!job.descriptionHtml) {
    try {
      job.descriptionHtml = BC.extractDescriptionHtml(parseHtml(await fetchText(info.descriptionUrl)));
    } catch (e) {
      job.notes.push(`Description: ${e.message}`);
    }
  }

  job.descriptionHtml = BC.sanitizeDescription(job.descriptionHtml);
  job.photoUrls = BC.uniquePhotoUrls(job.photoUrls);
  return job;
}

// Copy jobs are kept per tab so several listing forms can fill at once.
async function loadJobs() {
  const { jobs = {} } = await browser.storage.local.get("jobs");
  for (const [tabId, job] of Object.entries(jobs)) {
    if (Date.now() - job.createdAt > BC.JOB_TTL_MS) delete jobs[tabId];
  }
  return jobs;
}

async function storeJob(tabId, job) {
  const jobs = await loadJobs();
  if (!job && !jobs[tabId]) return;
  if (job) jobs[tabId] = job;
  else delete jobs[tabId];
  await browser.storage.local.set({ jobs });
}

const jobSummary = (job) => ({ photos: job.photoUrls.length, description: !!job.descriptionHtml, notes: job.notes });

async function fetchPhotos(urls) {
  return Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        return { url, ok: true, type: res.headers.get("content-type") || "image/jpeg", data: await res.arrayBuffer() };
      } catch (e) {
        return { url, ok: false, error: e.message };
      }
    })
  );
}

const handlers = {
  // Item page: the job belongs to the tab that clicked "Sell one like this".
  async prepareJob({ info }, sender) {
    const job = await buildJob(info);
    await storeJob(sender.tab.id, job);
    return jobSummary(job);
  },

  // Search card "Sell one like this": the job belongs to the clicking tab,
  // which then follows eBay's own link.
  async prepareFromItemUrl({ url }, sender) {
    const info = BC.parseItemPage(parseHtml(await fetchText(url)), url);
    const job = await buildJob(info);
    await storeJob(sender.tab.id, job);
    return jobSummary(job);
  },

  // Search results (single or batch): fetch the item page, then open the
  // listing form in a new tab whose job is stored before it starts loading.
  async copyFromSearch({ url, active = true }, sender) {
    const info = BC.parseItemPage(parseHtml(await fetchText(url)), url);
    const job = await buildJob(info);
    const tab = await browser.tabs.create({ url: "about:blank", active, openerTabId: sender.tab.id, index: sender.tab.index + 1 });
    await storeJob(tab.id, job);
    await browser.tabs.update(tab.id, { url: info.sellLikeUrl });
    return jobSummary(job);
  },

  // A tab's own job, or its opener's if eBay opened the form in a new tab.
  async getJob(_msg, sender) {
    const jobs = await loadJobs();
    const own = jobs[sender.tab.id];
    if (own) return own;
    const opener = sender.tab.openerTabId != null && jobs[sender.tab.openerTabId];
    if (!opener) return null;
    await storeJob(sender.tab.openerTabId, null);
    await storeJob(sender.tab.id, opener);
    return opener;
  },

  clearJob: (_msg, sender) => storeJob(sender.tab.id, null),

  fetchPhotos: ({ urls }) => fetchPhotos(urls),

  async downloadPhotos({ urls, itemId }) {
    for (const [i, url] of urls.entries()) {
      await browser.downloads.download({ url, filename: `baycopier/${itemId}/photo-${String(i + 1).padStart(2, "0")}.jpg` });
    }
  },

  testApi: ({ clientId, clientSecret }) => BC.EbayApi.test({ clientId, clientSecret }),

  checkUpdates: () => BC.Updates.check(),
};

browser.runtime.onMessage.addListener((msg, sender) => {
  const handler = handlers[msg && msg.type];
  return handler ? handler(msg, sender) : undefined;
});

browser.tabs.onRemoved.addListener((tabId) => storeJob(tabId, null));

browser.action.onClicked.addListener(() => browser.runtime.openOptionsPage());

// Update checks: shortly after startup, then every 12 hours.
const UPDATE_ALARM = "update-check";
const checkUpdatesQuietly = () => BC.Updates.check().catch((e) => console.warn("BayCopier update check failed:", e));

browser.alarms.get(UPDATE_ALARM).then((alarm) => {
  if (!alarm) browser.alarms.create(UPDATE_ALARM, { delayInMinutes: 1, periodInMinutes: 12 * 60 });
});
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM) checkUpdatesQuietly();
});
browser.runtime.onStartup.addListener(checkUpdatesQuietly);
browser.notifications.onClicked.addListener((id) => {
  if (id === BC.Updates.NOTIFICATION_ID) browser.runtime.openOptionsPage();
});
