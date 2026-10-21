# BayCopier

A Firefox extension that turns eBay's **Sell one like this** into a full copy.
eBay's own button pre-fills title, category and item specifics but leaves the
description and photos behind. BayCopier copies those too:

- the full **HTML description** (scripts and embedded content stripped), and
- **every seller photo** (up to eBay's 24), at 1600px.

You land on eBay's normal listing form with everything filled in. Review it
and click List yourself. BayCopier never submits anything.

Supported sites: ebay.com, ebay.co.uk, ebay.ca, ebay.com.au.

> [!WARNING]
> **Copying other sellers' photos and descriptions** without permission breaks
> [eBay's image and text policy](https://www.ebay.com/help/policies/listing-policies/image-text-policy?id=4246)
> and may infringe copyright. eBay can remove the listing or restrict your
> account, and the original seller can report it through VeRO. You are
> responsible for what you list. Use it on your own listings, or with the
> owner's permission, or replace the copied content before listing.

## Install

1. Download `baycopier-vX.Y.Z.xpi` from the
   [latest release](https://github.com/codyparham94/baycopier/releases/latest).
   It is signed by Mozilla (unlisted, so it isn't on the add-ons store).
2. In Firefox, open `about:addons`, click the gear icon and choose
   **Install Add-on From File…**, then pick the `.xpi`.

It stays installed across restarts. Requires Firefox 142 or newer.

For development, load `extension/manifest.json` with **Load Temporary
Add-on…** in `about:debugging#/runtime/this-firefox` instead. That copy is
removed when Firefox restarts.

## Updates

Signed installs **update themselves**. Firefox checks
[`updates.json`](updates.json) (the manifest's `update_url`) about once a day
and installs new versions in the background. To update right away:
`about:addons` → gear → **Check for Updates**.

BayCopier also checks the latest GitHub release when Firefox starts and every
12 hours. When a newer version is out, the toolbar icon shows **NEW**, Firefox
shows a notification once, and the settings page offers a **Download** link.
This also covers temporary installs, which Firefox never updates.

If BayCopier's settings page shows **Grant access to eBay**, click it. Firefox
asks for site access once.

## Use

**From a sold item page:** open any sold or ended listing and click
**Sell one like this**. BayCopier gathers the description and photos, then lets
eBay continue to its listing form.

**From sold search results:** search eBay with the **Sold items** filter on.
Each result gets a **Copy with BayCopier** button that opens the pre-filled
listing form in a new tab without leaving your search.

On the listing form a BayCopier box in the top-right corner reports what was
copied. If photos couldn't be added automatically, it shows a
**Download photos** button that saves them to `Downloads/baycopier/<item id>/`
so you can drag them into eBay's photo area.

A copy is kept for 30 minutes and is used once.

## Settings: eBay API keys (optional)

Click the BayCopier toolbar icon (or **about:addons → BayCopier → Options**) and
enter your **App ID (Client ID)** and **Cert ID (Client Secret)** from the
Production keyset at [developer.ebay.com/my/keys](https://developer.ebay.com/my/keys).
**Test connection** checks the keys against eBay.

With keys set, BayCopier asks eBay's Browse API for the item first. That API
only returns listings that are still live, so **sold listings are always read
from the page**. The keys help when you copy a listing that is still active.
Without keys, everything still works.

Keys are stored only in your Firefox profile (`storage.local`, not encrypted)
and are sent only to `api.ebay.com`.

## How it works

```
item page ──click "Sell one like this"──▶ background: fetch description + photo URLs ──▶ storage
                                              (Browse API first if keys set)
       └── eBay continues to its listing form ──▶ listing script: fill description,
                                                  fetch photos, hand them to the uploader
```

| Path | Role |
|------|------|
| `extension/lib/common.js` | Sites, item-ID and photo-URL helpers, HTML sanitizer |
| `extension/lib/item-page.js` | Reads photos, description URL and the sell-like link from an item page |
| `extension/lib/search-page.js` | Finds results on sold search pages |
| `extension/lib/listing-form.js` | Finds and fills the listing form's description editor and photo uploader |
| `extension/lib/ebay-api.js` | Optional Browse API client |
| `extension/background.js` | Cross-site fetching, copy storage, downloads |
| `extension/content/*.js` | Per-page glue |
| `extension/options/` | Settings page |

All of eBay's page structure lives in `extension/lib/`. When eBay changes a
page and something stops copying, that's where to look.

## Development

```bash
npm install
npm test       # unit tests on HTML fixtures
npm run lint   # web-ext lint
npm start      # launch a fresh Firefox with the extension loaded
```

### Releasing

1. Bump `version` in `extension/manifest.json` and `package.json`.
2. Commit, then tag and push:

   ```bash
   git tag v0.3.0 && git push origin main v0.3.0
   ```

The [Release workflow](.github/workflows/release.yml):

1. checks the tag matches the manifest version, runs the tests and lint,
2. has Mozilla sign the extension on the unlisted channel,
3. publishes a GitHub release with the signed `.xpi` and an unsigned `.zip`,
4. adds the version to [`updates.json`](updates.json) on `main`, which is what
   installed copies poll.

Mozilla signs each version number only once, so every release needs a new
version. Signing needs two repository secrets from
[AMO → Manage API Keys](https://addons.mozilla.org/developers/addon/api/key/):

```bash
gh secret set AMO_JWT_ISSUER --repo codyparham94/baycopier
```

```bash
gh secret set AMO_JWT_SECRET --repo codyparham94/baycopier
```

Each command prompts for the value without echoing it.

The fixtures in `test/fixtures/` are hand-built to match eBay's markup. eBay
blocks automated page fetches, so they are not captured from live pages. If
you hit a page BayCopier misreads, save it (**Ctrl+S**) and add it as a fixture.

## License

MIT
