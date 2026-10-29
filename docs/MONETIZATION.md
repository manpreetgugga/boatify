# Coins, black pearls, and switching on the store

The game has two currencies. Neither one needs a network connection or a
store yet.

- **Coins** come only from sailing: voyages, stars, pearls, rescues,
  medals, the daily voyage and its streak, Open Sea distance and gates, and
  regatta places (`PAY` in `web/src/data/economy.js`). They buy gust jars for
  the next voyage and sails and hull paints in the Sail Locker.
- **Black pearls** are rare (the white pearls on every voyage are treasure,
  not currency). A voyage with a whirlpool, a kraken or a pirate brig
  hides one near the danger (`web/src/world/blackpearls.js`). It counts only once
  the voyage is finished, and only once per voyage. On the Open Sea a whirlpool
  sometimes guards one, at most one per run. Black pearls unlock boats before the
  stars do, buy an Open Sea *second wind* (30 more seconds and a patched hull),
  or trade for 150 coins.

Buying black pearls and watching rewarded videos for them are built but switched
off. With no store in the app the game uses the `none` provider in
`web/src/platform/commerce.js`, and the Shop says **Coming soon**. To switch
them on, add Google Play Billing and a rewarded-video SDK to the Android
shell, then expose them to the page through the bridge below. Nothing in the
web code needs to change.

## What is for sale

| Product id        | Black pearls | Suggested price |
| ----------------- | ------------ | --------------- |
| `black_pearls_10` | 10           | lowest tier     |
| `black_pearls_35` | 30 + 5       | middle tier     |
| `black_pearls_90` | 70 + 20      | top tier        |

These are **consumable** in-app products. Create them in Play Console under
*Monetize → In-app products* with exactly these ids. The Shop shows the price
the store returns, in the player's own currency, so prices are only set in
Play Console.

Rewarded video placements (`REWARDS` in `commerce.js`):

| Placement id         | Reward                                   | Per day |
| -------------------- | ---------------------------------------- | ------- |
| `reward_black_pearl` | 1 black pearl (Shop)                     | 3       |
| `reward_second_wind` | an Open Sea second wind, no black pearls | 3       |

## The bridge

The shell adds a JavaScript interface named `BoatifyStore` to the WebView.

```kotlin
webView.addJavascriptInterface(StoreBridge(this, webView), "BoatifyStore")
```

It has three methods, all annotated `@JavascriptInterface`:

| Method                                         | Returns  | Meaning                                                                |
| ---------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `storeReady()`                                 | boolean  | Billing is connected and the products were found.                      |
| `adsReady()`                                   | boolean  | A rewarded video is loaded and can be shown now.                       |
| `request(id: Int, method: String, arg: String)` | nothing  | Start a call. Reply later with `BoatifyStoreReply(id, json)`.          |

Reply from the UI thread:

```kotlin
webView.evaluateJavascript("window.BoatifyStoreReply($id, ${JSONObject.quote(json)})", null)
```

Each reply is a JSON object with `ok` (true or false). When `ok` is false,
add a `reason`: `cancelled` (the player backed out; the game says nothing),
`unavailable`, or anything else (the game shows a gentle error). The game
gives up on a call after two minutes.

| `method`   | `arg`                                   | Reply when it works                                               |
| ---------- | --------------------------------------- | ----------------------------------------------------------------- |
| `prices`   | product ids, comma separated            | `{ "ok": true, "prices": { "black_pearls_10": "$0.99", … } }`         |
| `purchase` | a product id                            | `{ "ok": true, "order": { "id": "<purchase token>", "product": "black_pearls_10" } }` |
| `pending`  | empty                                   | `{ "ok": true, "orders": [ { "id": "…", "product": "…" } ] }`     |
| `finish`   | an order id                             | `{ "ok": true }`                                                  |
| `rewarded` | a placement id                          | `{ "ok": true }`, only once the video was watched to the end       |

### Purchases: credit first, then consume

1. `purchase` runs the Play Billing flow. Reply once the purchase is
   `PURCHASED` (not `PENDING`). Use the purchase token as the order id.
2. The game credits the black pearls, writes the save, then calls `finish`
   with that order id.
3. On `finish`, **consume** the purchase (`consumeAsync`) so it can be bought
   again and Play doesn't refund it after three days.
4. At every launch the game calls `pending`. Reply with every purchase that
   is `PURCHASED` but not yet consumed (from `queryPurchasesAsync`). The game
   credits each one it hasn't seen before and calls `finish` again.

The wallet remembers the order ids it has credited, so an order is never
paid twice even if `finish` fails and the order comes back from `pending`.

For a larger audience, verify purchase tokens on a server before replying
(Play Developer API, `purchases.products.get`). The game has no server
today, so this is the step that would add one.

### Rewarded videos

`rewarded` shows the video. Reply `{ "ok": true }` only from the SDK's
"user earned reward" callback. A video closed early replies
`{ "ok": false, "reason": "cancelled" }`. Load the next video straight away
so `adsReady()` is true again soon.

## Before release

- **Privacy policy.** `PRIVACY.md` says the game has no ads and makes no
  network connections. With Billing it talks to Google Play, and with an ads
  SDK it talks to the ad network, which collects a device ad identifier.
  Rewrite the policy to say so and name the ad network.
- **Data safety form** in Play Console: declare what the ads SDK collects
  (device or other IDs, app interactions, diagnostics) and that it is shared
  with the ad network for advertising.
- **Ads declaration** in Play Console: "Yes, my app contains ads".
- **Consent.** In the EEA, UK and Switzerland, show Google's User Messaging
  Platform (UMP) consent form before loading ads.
- **Families policy.** If the target audience includes children, use only
  Families-certified ad SDKs. The current listing targets 13 and over.
- **Store listing.** The full description ends with "No ads, no in-app
  purchases". Remove that line, and Play will show "Contains ads · In-app
  purchases" itself.
- **Manifest.** Billing adds `com.android.vending.BILLING` on its own (through
  the library). Ads need `android.permission.INTERNET` and, on Android 13 and
  newer, `com.google.android.gms.permission.AD_ID`.

## Testing without the store

`setCommerceProvider()` takes any object with the same methods as the `none`
provider. `tests/economy.test.mjs` uses fake providers and a fake bridge to
check that orders are credited once, saved before `finish`, and that videos
pay only when watched and only a few times a day.
