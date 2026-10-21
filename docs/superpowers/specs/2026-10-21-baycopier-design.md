# BayCopier — design

## Goal

One click on an eBay **sold** listing produces a new draft listing for the user
with the source listing's full HTML description and all seller photos already
filled in. The user reviews the draft and clicks List themselves.

eBay's native "Sell one like this" already copies title, category and item
specifics; BayCopier adds what it leaves out: description and photos.

## Scope

- Firefox, Manifest V3, loaded via `about:debugging` (no AMO signing).
- Sites: ebay.com, ebay.co.uk, ebay.ca, ebay.com.au.
- Entry points:
  - Sold item page (`/itm/*`): the "Sell one like this" button is overridden.
  - Sold search results (`/sch/*` with `LH_Sold=1`): a **Copy** button is added
    to each result.
- Max 24 photos (eBay's limit), upgraded to 1600px.
- Description is copied as HTML with active content stripped
  (scripts, iframes, objects, forms, `on*` handlers, `javascript:` URLs).

## Components

| File | Responsibility |
|------|----------------|
| `extension/lib/common.js` | Constants, site table, item-ID and image-URL helpers, HTML sanitizer |
| `extension/lib/item-page.js` | Pure parsing of an item page `Document` (photos, description URL, sell-like link) and of the description document |
| `extension/lib/search-page.js` | Pure parsing of a sold search results page |
| `extension/lib/listing-form.js` | Locating and filling the eBay listing form's description editor and photo uploader |
| `extension/lib/ebay-api.js` | Optional Browse API client (client-credentials token, `get_item_by_legacy_id`) |
| `extension/background.js` | Fetching across origins, building and storing the copy job, downloads |
| `extension/content/*.js` | Thin glue per page type |
| `extension/options/*` | Settings: eBay App ID / Cert ID, connection test, permission check |

All eBay DOM knowledge (selectors, button text, URLs) lives in the `lib/*`
files so a layout change on eBay is fixed in one place.

## Data flow

1. Item page: click on "Sell one like this" is intercepted. The page's photo
   URLs, description iframe URL and the button's own target URL are sent to
   the background.
2. Background builds a **copy job** `{itemId, createdAt, descriptionHtml,
   imageUrls}`:
   - If API keys are set, try the Browse API first (works only for items eBay
     still returns, i.e. not ended ones).
   - Otherwise or on failure, fetch the description document and use the page
     photo URLs.
   - Job is saved to `storage.local`; the tab continues to eBay's own
     sell-like URL.
3. Search results: the **Copy** button asks the background to fetch the item
   page itself, parse it the same way, store the job and open the sell-like URL
   in a new tab.
4. Listing form: the content script loads a job younger than 30 minutes,
   waits for the form, writes the description into the HTML editor, fetches
   the photos via the background and hands them to the photo file input.
   A banner reports results; on photo failure it offers **Download photos**.
   The job is cleared once applied.

## Error handling

Nothing BayCopier does blocks eBay's own flow: missing elements, failed
fetches and timeouts still land the user on the listing form, and the banner
says what did not copy.

## Testing

- `node --test` unit tests over HTML fixtures for parsing and sanitizing.
  Fixtures are hand-built to match eBay's known markup (live pages block
  automated fetches), so the first real run confirms them.
- `web-ext lint`.
- Manual run in Firefox while signed in to eBay.
