# Putting No Paddle on Google Play

Everything the store needs is in this repository: the store text and pictures
in `fastlane/metadata/android/en-US/`, the privacy policy in `PRIVACY.md`, and
CI builds the bundle (`.aab`) Play wants. What's left can only be done by you,
signed in to your own Google account. Never give anyone your password.

Plan on about three weeks: a few days for Google to check your identity, then
14 days of closed testing before you can publish to everyone.

## What you need

- A Google account (a new one just for publishing is a good idea).
- A card to pay the one-time $25 fee.
- A government ID, for Google's identity check.
- An Android phone.
- At least 12 people with Android phones who will install the test version and
  keep it for 14 days (friends, family, a forum).
- A computer with Java (for `keytool`), e.g. [Temurin](https://adoptium.net/).

## 1. Sign up for Play Console

1. Go to <https://play.google.com/console/signup> and sign in.
2. Choose **Yourself** (a personal account). An organization account needs a
   D-U-N-S number for your company; skip that unless you have one.
3. Fill in your developer name (shown on the store), contact details and phone.
4. Pay the $25 fee.
5. Verify your identity with your ID, then your email and phone number when
   asked. If Play Console asks you to verify an Android device, install the
   **Google Play Console** app on your phone and follow it.
6. Wait for the email saying your identity is verified (usually a few days).

## 2. Make an upload key

Google signs the app for the store with its own key. You sign each bundle you
upload with your **upload key**, which you make once, on your computer:

```sh
keytool -genkeypair -v -keystore boatify-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password and your name; remember the password. Back up
`boatify-upload.jks` and the password somewhere safe (a password manager).
Never commit it to the repository.

Then copy the key as text:

- macOS: `base64 -i boatify-upload.jks | pbcopy`
- Linux: `base64 -w0 boatify-upload.jks` (copy what it prints)
- Windows PowerShell:
  `[Convert]::ToBase64String([IO.File]::ReadAllBytes("boatify-upload.jks")) | Set-Clipboard`

## 3. Give the key to GitHub

On GitHub: the repository's **Settings → Secrets and variables → Actions →
New repository secret**. Add four secrets:

| Name | Value |
| --- | --- |
| `BOATIFY_UPLOAD_KEYSTORE` | the text you copied |
| `BOATIFY_KEYSTORE_PASSWORD` | the keystore password |
| `BOATIFY_KEY_ALIAS` | `upload` |
| `BOATIFY_KEY_PASSWORD` | the key password (the same as the keystore password unless keytool asked for a second one) |

Then the AdMob ids, from the AdMob console (**Apps → No Paddle → App
settings** and **Ad units**). Only the `.aab` gets them; without them it, like
the APK, serves Google's test ads. Set all three or none:

| Name | Value |
| --- | --- |
| `ADMOB_APP_ID` | the app id, `ca-app-pub-…~…` |
| `ADMOB_REWARDED_ID` | the *Rewarded* ad unit, `ca-app-pub-…/…` |
| `ADMOB_INTERSTITIAL_ID` | the *Interstitial* ad unit, `ca-app-pub-…/…` |
| `ADMOB_TEST_DEVICE_IDS` | optional: your phones' hashed ids, comma-separated, so they get test ads (see docs/MONETIZATION.md) |

## 4. Build the bundle

On GitHub: **Actions → Build → Run workflow** (on `main`). When it finishes,
open the run and download the artifact `no-paddle-vX.Y.Z-android`. Inside is
`no-paddle-vX.Y.Z.aab`. From now on each new version's release on the Releases
page has the `.aab` too.

## 5. Create the app

In Play Console: **Create app**.

- App name: `No Paddle: Sail by the Wind` (from `title.txt`)
- Default language: English (United States)
- App or game: **Game**
- Free or paid: **Free**
- Tick the declarations and create it.

## 6. App content

**Policy and programs → App content** (or the dashboard's "Set up your app"
list). Answers for this game:

- **Privacy policy:** `https://github.com/manpreetgugga/boatify/blob/main/PRIVACY.md`
- **App access:** all functionality is available without special access.
- **Ads:** Yes, the app contains ads (Google AdMob).
- **Content rating:** start the questionnaire, category **Game**. The only
  violence is fantasy: pirate cannonballs and a kraken, no blood, no people
  hurt. No sex, bad language, drugs, gambling or chat between users, and no
  purchases.
- **Target audience:** 13 and over (13–15, 16–17, 18+). Choosing under 13
  brings the Families policy's extra rules.
- **Data safety:** the ads SDK (Google AdMob) collects and shares data. Answer
  **Yes** to "Does your app collect or share any of the required user data
  types?", **Yes** to encrypted in transit, and declare:
  - **Device or other IDs**: collected and shared, for **Advertising or
    marketing**, **Analytics** and **Fraud prevention, security, and
    compliance**.
  - **Approximate location** (from the IP address): collected and shared, for
    the same purposes.
  - **App interactions** and **Diagnostics**: collected and shared, for the
    same purposes.
  - Not processed ephemerally, and collection is required (consent is asked
    separately, where the law needs it). No accounts, no outside logins.
  Google keeps its current list at
  <https://developers.google.com/admob/android/privacy/play-data-disclosure>
  (for SDK 25.5.0: IP address, app interactions, diagnostics, device IDs).
- **Advertising ID:** Yes, for **Analytics**, **Advertising or marketing**
  and **Fraud prevention, security, and compliance**.
- **Health apps:** the app has no health features.
- **Closed testing:** the Google Group `testers-community@googlegroups.com`
  (as for the other MSG Studios apps), all countries.
- **Government, financial, health and news apps:** No / none.

## 7. Store listing

**Grow users → Store presence → Main store listing**. Copy from
`fastlane/metadata/android/en-US/`:

| Field | File |
| --- | --- |
| App name | `title.txt` |
| Short description | `short_description.txt` |
| Full description | `full_description.txt` |
| App icon | `images/icon.png` |
| Feature graphic | `images/featureGraphic.jpg` |
| Phone screenshots | `images/phoneScreenshots/` (all 8) |
| 7-inch tablet screenshots | `images/sevenInchScreenshots/` |
| 10-inch tablet screenshots | `images/tenInchScreenshots/` |

In **Store settings**: category **Simulation**, and your contact email.

## 8. Closed test (14 days, 12 testers)

New personal accounts have to run a closed test before they can publish to
everyone.

1. **Test and release → Testing → Closed testing → Create track** (or use
   "Alpha").
2. **Testers:** create an email list with at least 12 testers' Google account
   emails.
3. **Create new release**, accept Play App Signing (let Google manage the app
   signing key), upload the `.aab`, and paste the release notes from
   `changelogs/<versionCode>.txt` (1800 for v0.18.0).
4. Send the release for review. Once it's approved, copy the opt-in link from
   the track and send it to your testers. Each one opens it, joins, and
   installs from Play.
5. Keep at least 12 testers opted in for 14 days in a row.
6. Then **Dashboard → Apply for production**, answer the questions about the
   test, and wait for Google's reply. After that, create a release on the
   **Production** track with the same bundle.

## Each new version

1. Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
2. Add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` (under 500
   characters). The version code is `major*10000 + minor*100 + patch`, so
   1.2.3 is 10203.
3. Push. CI publishes the release with the APK and the `.aab`.
4. In Play Console, create a release on your track and upload the `.aab`, or
   let GitHub do it (below).

## Let GitHub upload to Play

Once the first bundle is on Play (done by hand, step 8), CI can upload each new
version itself: to the closed testing track, with the changelog as its release
notes, sent for Google's review. Set it up once:

1. **Turn on the API.** In <https://console.cloud.google.com>, signed in with
   your Play Console account, create a project (any name), then **APIs &
   Services → Library**, find **Google Play Android Developer API** and
   **Enable** it.
2. **Make a service account.** **IAM & Admin → Service accounts → Create
   service account**, name it e.g. `github-play`, skip the optional roles and
   finish. Open it, **Keys → Add key → Create new key → JSON**. A `.json` file
   downloads: it is a password, keep it safe and never commit or share it.
3. **Let it release.** Copy the account's email (`…@….iam.gserviceaccount.com`).
   In Play Console: **Users and permissions → Invite new users**, paste the
   email, **App permissions → Add app → No Paddle**, tick **Release apps to
   testing tracks** (add **Release to production…** later, when you want CI to
   publish there too), then **Invite user**.
4. **Give it to GitHub.** Repository **Settings → Secrets and variables →
   Actions → New repository secret**: name `PLAY_SERVICE_ACCOUNT_JSON`, value
   the whole contents of the `.json` file. Then delete the downloaded file, or
   keep it only in your password manager.
5. **Pick the track** (optional). CI uploads to `alpha`, the id of Play's
   built-in closed testing track. For another track, add a repository
   *variable* (the **Variables** tab) `PLAY_TRACK` with its id: `beta`,
   `production`, or the name of a closed track you created.

From then on every push to `main` with a new version uploads its bundle. To
upload the version already released (if it isn't on Play yet): **Actions →
Build → Run workflow** on `main`, tick **Also upload this version's bundle to
Google Play**. Play refuses a version code it already has, so that run fails if
the version is up there already.

If the upload fails with "The caller does not have permission", check that the
service account was invited with No Paddle in step 3; new permissions can take
a while to apply.

Store pictures come from the game itself: `npm run store-art` redraws them
(needs Playwright).

## Google Play Games (optional)

The game can sign players in to Google Play Games, put their scores on four
leaderboards and keep their progress in the cloud, so it comes back on a new
phone. It is off until you give CI a Play Games project id: without one the
build is the same as before and Settings shows nothing about Play Games. Only
the Play bundle (`.aab`) gets the id, because Play Games only knows the key
Google signs Play installs with; the APKs on the Releases page never have it.

1. **Make the project.** In Play Console, open No Paddle, then **Grow users →
   Play Games Services → Setup and management → Configuration**. Choose **No,
   my game doesn't use Google APIs**, enter `No Paddle` and **Create**.
2. **Properties.** **Edit properties**: the display name `No Paddle` and the
   store description; turn **Saved games** on (cloud save needs it). Save.
3. **Consent screen.** In **Credentials**, Play Console asks you to configure
   the OAuth consent screen in Google Cloud and links there. Follow it, make it
   available to everyone, with the scopes `games`, `games_lite` and
   `drive.appdata`, and publish it.
4. **Credential.** **Add credential → Android**, name `No Paddle`, then
   **Create OAuth client**, which opens Google Cloud: type **Android**, package
   `io.github.manpreetgugga.boatify`, and the **SHA-1** of the *app signing key
   certificate* from Play Console's **Test and release → App integrity → App
   signing**. Create it, pick it back in Play Console and **Save changes**.
5. **Leaderboards** (optional). **Leaderboards → Create leaderboard**, four
   times, each **Numeric**, larger is better:
   - `Stars`: all stars won.
   - `Open Sea`: the furthest run, in metres.
   - `Daily streak`: the longest run of daily voyages, in days.
   - `Regatta wins`: regattas won.
   Copy each one's id (it starts `CgkI`).
6. **Testers, then publish.** Until the Play Games project is published only
   its **Testers** can sign in: add your own Google account there. When it
   works, **Review and publish → Publish**.
7. **Give it to GitHub.** Repository **Settings → Secrets and variables →
   Actions**, as a secret (or, since it isn't a password, a variable):

   | Name | Value |
   | --- | --- |
   | `PLAY_GAMES_APP_ID` | the project id at the top of the Configuration page, all digits (e.g. `123456789012`) |
   | `PLAY_GAMES_LEADERBOARD_STARS` | optional: the `Stars` leaderboard id |
   | `PLAY_GAMES_LEADERBOARD_SEA` | optional: the `Open Sea` leaderboard id |
   | `PLAY_GAMES_LEADERBOARD_STREAK` | optional: the `Daily streak` leaderboard id |
   | `PLAY_GAMES_LEADERBOARD_WINS` | optional: the `Regatta wins` leaderboard id |

The next version's bundle has Play Games. A leaderboard left out is simply not
sent to. A bad app id stops the build with a message, rather than shipping an
app whose sign-in fails. In the game, **Settings → Google Play Games** signs in,
shows the leaderboards, and saves or loads the cloud copy by hand; it is also
saved after voyages and when the app is put away. A phone only writes to the
cloud after it has looked at what is there, and asks before replacing its own
progress with the cloud's. If players can't sign in, the SHA-1 in step 4 is the
usual culprit: it must be the *app signing* key's, not the upload key's.

Also update **Data safety** (step 6): with Play Games on, Google Play Games
collects the player's Play Games profile and game activity when they sign in.
Answer per Google's current notes for Play Games Services, and keep "no
accounts" true: the game has none of its own.

## Firebase Analytics and Crashlytics (optional)

The game can send anonymous events and crash reports to Firebase, so you can
see how far players get and fix crashes. It is off until CI has your
`google-services.json`: without it the Firebase plugins aren't applied,
Firebase never starts, the game sends nothing and Settings shows no switch.
Only the Play bundle (`.aab`) gets it; the APK on GitHub Releases never does.
The file is written at build time and never committed (`.gitignore`).

1. **Create the Firebase project.** <https://console.firebase.google.com> →
   **Add project**, name it No Paddle. Google Analytics: **on**, with a new
   Analytics account (data sharing settings: leave Google's "Benchmarking" and
   the like off if you prefer).
2. **Add the Android app.** In the project: **Add app → Android**, package name
   `io.github.manpreetgugga.boatify`, nickname No Paddle. Skip the SHA-1.
3. **Download `google-services.json`** from that screen (or later from
   **Project settings → Your apps**). Keep it out of the repository.
4. **Give it to GitHub as a secret**, base64-encoded. PowerShell:
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("google-services.json")) | Set-Clipboard`,
   then **Settings → Secrets and variables → Actions → New repository secret**,
   name `GOOGLE_SERVICES_JSON`, paste.
5. **Turn on Crashlytics.** Firebase console → **Crashlytics → Enable**. Do
   this before the next version: the Play bundle's build uploads its R8 mapping
   file to Crashlytics so crash stacks read as the real code.
6. **The next version's bundle has Firebase.** Install it from your closed
   test, sail a voyage, and within a few minutes you'll see events in
   **Analytics → Realtime** (it takes up to a day for the reports).
7. **Update Data safety** in Play Console (step 6 above). Add **Crash logs**
   (App info and performance): *collected*, not shared (Firebase works for
   you, as a service provider), for **Analytics** and **App functionality**,
   not ephemeral, and **optional** (the Settings switch). **App
   interactions**, **Diagnostics** and **Device or other IDs** are already
   there for AdMob and already list Analytics, so they stay as they are
   (required, because AdMob needs them).

**How far players get.** Firebase console → **Analytics → Events →
`voyage_complete`**, add `world` and `level` as custom dimensions (**Custom
definitions → Create custom dimension**, event scope, for `level`, `world`,
`stars`, `mode`), then **Explore → Funnel exploration** with steps
`voyage_start` → `voyage_complete`, broken down by `world`, and a free-form
table of `voyage_complete` by `level`. `world_reached` shows how many players
make it to each world; `voyage_quit` by `level` shows where they give up.

The events (all in `web/src/platform/analytics.js`, with only these fields):
`voyage_start` (level, world, mode), `voyage_complete` (level, world, stars,
time, bumps), `voyage_quit` (level, world, mode, time), `world_reached`
(world), `open_sea_end` (distance in metres, gates), `regatta_finish` (place,
fleet), `cup_finish` (place, fleet), `festival_voyage` (festival),
`rewarded_ad_watched` (reward), `share` (what), `backup_used` (how) and
`language` (lang). Script errors in the game go to Crashlytics as non-fatal
reports with the voyage they happened on.

**Consent.** Analytics never collects the advertising id and never works
for ads (`AndroidManifest.xml`). Where Google's consent form applies, it stays
off until the player agrees (storing on the device and measuring, TCF purposes
1 and 8) or turns on **Settings → Analytics and crash reports**; elsewhere it
is on until they turn it off.

## Play and the APK don't mix

The APKs on the Releases page are signed with the public development key, the
Play version with Google's key. Android won't install one over the other: to
switch, uninstall first, which deletes your progress.
