// Optional eBay Browse API client. Uses an application token (client
// credentials grant) from the App ID + Cert ID the user enters in settings.
// The Browse API only returns items that are still purchasable, so ended
// (sold) listings come back as not found and the caller falls back to the page.
(function (root) {
  const BC = root.BayCopier || (root.BayCopier = {});

  const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
  const ITEM_URL = "https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id";
  const SCOPE = "https://api.ebay.com/oauth/api_scope";

  let cached = null; // { clientId, token, expiresAt }

  async function token({ clientId, clientSecret }) {
    if (cached && cached.clientId === clientId && cached.expiresAt > Date.now() + 60000) return cached.token;
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}`,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error_description || `token request failed (${res.status})`);
    cached = { clientId, token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return cached.token;
  }

  BC.EbayApi = {
    // Throws with eBay's message if the keys are wrong.
    async test(creds) {
      cached = null;
      await token(creds);
      return true;
    },

    // { descriptionHtml, photoUrls } or null when eBay doesn't return the item.
    async getItem(creds, itemId, marketplaceId) {
      const res = await fetch(`${ITEM_URL}?legacy_item_id=${encodeURIComponent(itemId)}`, {
        headers: {
          Authorization: `Bearer ${await token(creds)}`,
          "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
        },
      });
      if (res.status === 404 || res.status === 400) return null;
      if (!res.ok) throw new Error(`Browse API ${res.status}`);
      const item = await res.json();
      const photoUrls = [item.image, ...(item.additionalImages || [])].filter(Boolean).map((i) => i.imageUrl);
      return { descriptionHtml: item.description || "", photoUrls };
    },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BC;
})(typeof globalThis !== "undefined" ? globalThis : this);
