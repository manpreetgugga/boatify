# Coins, black pearls, and ads

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

The Android app serves the ads from Google AdMob through the bridge below
(`android/app/src/main/java/.../AdsBridge.kt`). Anywhere without the bridge
(a browser, the tests) the game uses the `none` provider in
`web/src/platform/ads.js`: the Shop's video says **Coming soon** and no ad
ever plays.

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

It has four methods, all annotated `@JavascriptInterface` (R8 keeps them by
that annotation, `android/app/proguard-rules.pro`):

| Method                                          | Returns | Meaning                                                       |
| ----------------------------------------------- | ------- | ------------------------------------------------------------- |
| `adsReady()`                                    | boolean | A rewarded video is loaded and can be shown now.              |
| `breakReady()`                                  | boolean | An interstitial is loaded and can be shown now.               |
| `privacyRequired()`                             | boolean | UMP says the player must be able to reopen the consent form.  |
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
| `privacy`      | (empty)        | `{ "ok": true }` once Google's privacy options form closes   |

Every request gets exactly one reply. A request while another ad is on
screen replies `busy`; one with nothing loaded replies `unavailable`.

### Rewarded videos

`rewarded` shows the video. The reply is `{ "ok": true }` only if the SDK's
"user earned reward" callback fired, and it's sent when the video closes, so
the game (a second wind's countdown, say) carries on in front of the player
rather than behind the ad. A video closed early replies
`{ "ok": false, "reason": "cancelled" }` (after a second's wait, since the
reward callback can come just after the close). A video still open close to
the game's two-minute limit with its reward earned replies straight away.
The next video starts loading as soon as one is shown.

### The ad between voyages

`interstitial` shows the loaded interstitial. Reply `{ "ok": true }` from
the SDK's "dismissed" callback, or `{ "ok": false, "reason": "…" }` if it
failed to show (the game counts it as not played and tries again after the
next voyage). The game pauses while the ad covers it, since the activity's
`onPause` already tells the page. Load the next one once it closes so
`breakReady()` is true by the next break. Create the ad unit in AdMob as an
*Interstitial* (not *Rewarded interstitial*), and keep the frequency cap in
AdMob no tighter than the game's own rules above.

### Ad privacy

Where UMP needs it (the EEA, the UK and Switzerland, once the GDPR message is
published in AdMob), `privacyRequired()` is true and Settings shows **Ad
privacy → Options**, which sends `privacy`.

## The Android side

`AdsBridge.kt` runs Google's consent form (UMP) at startup:
`requestConsentInfoUpdate`, then `loadAndShowConsentFormIfRequired`. Only once
`canRequestAds()` is true does it call `MobileAds.initialize` (off the main
thread) and load one rewarded video and one interstitial. A failed load
tries again after 15 s, then 30 s, 1 min and so on up to 10 min; an ad left
unshown for 55 minutes is swapped for a fresh one. The activity's
`onPause`/`onResume` already pause the game while an ad covers it.

### Ids

`android/app/build.gradle.kts` reads `ADMOB_APP_ID`, `ADMOB_REWARDED_ID` and
`ADMOB_INTERSTITIAL_ID` from the environment or Gradle properties (all three
or none, or the build stops). Without them it uses Google's test ids.

- **Debug builds** always use the test ids.
- **The APK on GitHub releases** is built without them, so it serves test ads.
- **The Play bundle** gets them from the repository secrets of the same names
  (CI passes them to the bundle step only, see docs/PLAY_STORE.md).

The app id goes into the manifest (`manifestPlaceholders`); the ad unit ids
into `BuildConfig`.

### Test devices

A phone running a build with the real ids must get test ads, or tapping your
own ads breaks AdMob's rules. Run the app once, then look in logcat for a
line like `Use RequestConfiguration.Builder().setTestDeviceIds(Arrays.asList("33BE2250B43518CCDA7DE426D04EE231"))`.
Put that hash in `ADMOB_TEST_DEVICE_IDS` (comma-separated for several
phones): in `~/.gradle/gradle.properties` for local builds, and as the
repository secret for the Play bundle. Adding the phone in the AdMob console
(**Settings → Test devices**) works too.

On a test device a **debug** build also shows the consent form as if the
phone were in the EEA. Clear the app's storage to see it again.

## Before release

- **Privacy policy.** `PRIVACY.md` names Google AdMob and what it collects.
- **Data safety form** in Play Console: declare what the ads SDK collects
  (device or other IDs, app interactions, diagnostics) and that it is shared
  with the ad network for advertising.
- **Ads declaration** in Play Console: "Yes, my app contains ads".
- **Disruptive ads.** Play's ads policy forbids interstitials that appear
  unexpectedly during play or as the app opens. The game shows them only at
  a natural break, after a voyage's results.
- **Consent.** In AdMob, under **Privacy & messaging**, create and publish a
  GDPR message (and, if wanted, a US states message) for the app. The app
  already shows it through UMP before loading ads.
- **app-ads.txt.** Put the line AdMob gives you (**Apps → View all apps →
  app-ads.txt**) at `https://<your developer website>/app-ads.txt`, the site
  listed in Play Console.
- **Families policy.** If the target audience includes children, use only
  Families-certified ad SDKs. The current listing targets 13 and over.
- **Store listing.** The full description says "No in-app purchases";
  Play shows "Contains ads" itself.

## Testing without ads

`setAdsProvider()` takes any object with the same methods as the `none`
provider. `tests/economy.test.mjs` uses fake providers and a fake bridge to
check that videos pay only when watched and only a few times a day, and that
the ad between voyages keeps to its rules.
