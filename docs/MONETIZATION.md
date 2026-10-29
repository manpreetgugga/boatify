# Coins, black pearls, and switching on ads

The game earns from ads only. Nothing is sold for money: there are no
in-app purchases, and none are planned.

The game has two currencies. Neither one needs a network connection.

- **Coins** come only from sailing: voyages, stars, pearls, rescues,
  medals, the daily voyage and its streak, Open Sea distance and gates, and
  regatta places (`PAY` in `web/src/data/economy.js`). They buy gust jars for
  the next voyage and sails and hull paints in the Sail Locker.
- **Black pearls** are rare (the white pearls on every voyage are treasure,
  not currency). A voyage with a whirlpool, a kraken or a pirate brig
  hides one near the danger (`web/src/world/blackpearls.js`). It counts only once
  the voyage is finished, and only once per voyage. On the Open Sea a whirlpool
  sometimes guards one, at most one per run. Once ads are on, a rewarded
  video in the Shop gives one too, a few times a day. Black pearls unlock
  boats before the stars do, buy an Open Sea *second wind* (30 more seconds
  and a patched hull), or trade for 150 coins.

The ads are built but switched off. With no ads SDK in the app the game uses
the `none` provider in `web/src/platform/ads.js`: the Shop's video says
**Coming soon** and no ad ever plays. To switch them on, add an ads SDK
(AdMob) to the Android shell and expose it to the page through the bridge
below. Nothing in the web code needs to change.

## The ads

### Rewarded videos

Only ever played when the player asks for one (`REWARDS` in `ads.js`):

| Placement id         | Reward                                   | Per day |
| -------------------- | ---------------------------------------- | ------- |
| `reward_black_pearl` | 1 black pearl (Shop)                     | 3       |
| `reward_second_wind` | an Open Sea second wind, no black pearls | 3       |

### The ad between voyages

An interstitial (`BREAK` in `ads.js`, placement id `break_voyage`). The
rules are there to keep players coming back, not to wear them out:

- It never interrupts sailing. It plays only as the player moves on from a
  voyage's results (Next, Voyages, Done), never on Retry.
- Home Waters (the first 10 voyages) is free of it. It starts once more than
  10 voyages are home, so the first one comes three voyages into the
  Volcano Isles.
- Then once every 3 voyages finished (any kind: voyages, Open Sea runs,
  regattas, the daily).
- Never within 4 minutes of the last ad of any kind, rewarded videos
  included.
- If none is loaded the game simply moves on, and tries again after the next
  voyage.

## The bridge

The shell adds a JavaScript interface named `BoatifyAds` to the WebView.

```kotlin
webView.addJavascriptInterface(AdsBridge(this, webView), "BoatifyAds")
```

It has three methods, all annotated `@JavascriptInterface`:

| Method                                          | Returns | Meaning                                                       |
| ----------------------------------------------- | ------- | ------------------------------------------------------------- |
| `adsReady()`                                    | boolean | A rewarded video is loaded and can be shown now.              |
| `breakReady()`                                  | boolean | An interstitial is loaded and can be shown now.               |
| `request(id: Int, method: String, arg: String)` | nothing | Start a call. Reply later with `BoatifyAdsReply(id, json)`.   |

Reply from the UI thread:

```kotlin
webView.evaluateJavascript("window.BoatifyAdsReply($id, ${JSONObject.quote(json)})", null)
```

Each reply is a JSON object with `ok` (true or false). When `ok` is false,
add a `reason`: `cancelled` (the player backed out; the game says nothing),
`unavailable`, or anything else (the game shows a gentle message). The game
gives up on a call after two minutes.

| `method`       | `arg`          | Reply when it works                                          |
| -------------- | -------------- | ------------------------------------------------------------ |
| `rewarded`     | a placement id | `{ "ok": true }`, only once the video was watched to the end |
| `interstitial` | a placement id | `{ "ok": true }` once the ad has closed                      |

### Rewarded videos

`rewarded` shows the video. Reply `{ "ok": true }` only from the SDK's
"user earned reward" callback. A video closed early replies
`{ "ok": false, "reason": "cancelled" }`. Load the next video straight away
so `adsReady()` is true again soon.

### The ad between voyages

`interstitial` shows the loaded interstitial. Reply `{ "ok": true }` from
the SDK's "dismissed" callback, or `{ "ok": false, "reason": "…" }` if it
failed to show (the game counts it as not played and tries again after the
next voyage). The game pauses while the ad covers it, since the activity's
`onPause` already tells the page. Load the next one once it closes so
`breakReady()` is true by the next break. Create the ad unit in AdMob as an
*Interstitial* (not *Rewarded interstitial*), and keep the frequency cap in
AdMob no tighter than the game's own rules above.

## Before release

- **Privacy policy.** `PRIVACY.md` says the game has no ads and makes no
  network connections. With an ads SDK it talks to the ad network, which
  collects a device ad identifier. Rewrite the policy to say so and name the
  ad network.
- **Data safety form** in Play Console: declare what the ads SDK collects
  (device or other IDs, app interactions, diagnostics) and that it is shared
  with the ad network for advertising.
- **Ads declaration** in Play Console: "Yes, my app contains ads".
- **Disruptive ads.** Play's ads policy forbids interstitials that appear
  unexpectedly during play or as the app opens. The game shows them only at
  a natural break, after a voyage's results.
- **Consent.** In the EEA, UK and Switzerland, show Google's User Messaging
  Platform (UMP) consent form before loading ads.
- **Families policy.** If the target audience includes children, use only
  Families-certified ad SDKs. The current listing targets 13 and over.
- **Store listing.** The full description ends with "No ads, no in-app
  purchases". Change it to "No in-app purchases", and Play will show
  "Contains ads" itself.
- **Manifest.** Ads need `android.permission.INTERNET` and, on Android 13
  and newer, `com.google.android.gms.permission.AD_ID`.

## Testing without ads

`setAdsProvider()` takes any object with the same methods as the `none`
provider. `tests/economy.test.mjs` uses fake providers and a fake bridge to
check that videos pay only when watched and only a few times a day, and that
the ad between voyages keeps to its rules.
