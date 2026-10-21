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
  await browser.storage.local.set({ job });
  return job;
}

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
  async prepareJob({ info }) {
    const job = await buildJob(info);
    return { photos: job.photoUrls.length, description: !!job.descriptionHtml, notes: job.notes };
  },

  async copyFromSearch({ url }) {
    const info = BC.parseItemPage(parseHtml(await fetchText(url)), url);
    const job = await buildJob(info);
    await browser.tabs.create({ url: info.sellLikeUrl });
    return { photos: job.photoUrls.length, description: !!job.descriptionHtml, notes: job.notes };
  },

  async getJob() {
    const { job } = await browser.storage.local.get("job");
    return job && Date.now() - job.createdAt < BC.JOB_TTL_MS ? job : null;
  },

  async clearJob() {
    await browser.storage.local.remove("job");
  },

  fetchPhotos: ({ urls }) => fetchPhotos(urls),

  async downloadPhotos({ urls, itemId }) {
    for (const [i, url] of urls.entries()) {
      await browser.downloads.download({ url, filename: `baycopier/${itemId}/photo-${String(i + 1).padStart(2, "0")}.jpg` });
    }
  },

  testApi: ({ clientId, clientSecret }) => BC.EbayApi.test({ clientId, clientSecret }),
};

browser.runtime.onMessage.addListener((msg) => {
  const handler = handlers[msg && msg.type];
  return handler ? handler(msg) : undefined;
});

browser.action.onClicked.addListener(() => browser.runtime.openOptionsPage());
