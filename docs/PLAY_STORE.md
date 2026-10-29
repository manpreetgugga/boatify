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
- **Ads:** No, the app doesn't contain ads.
- **Content rating:** start the questionnaire, category **Game**. The only
  violence is fantasy: pirate cannonballs and a kraken, no blood, no people
  hurt. No sex, bad language, drugs, gambling or chat between users, and no
  purchases.
- **Target audience:** 13 and over (13–15, 16–17, 18+). Choosing under 13
  brings the Families policy's extra rules.
- **Data safety:** the app collects no data and shares none. Answer **No** to
  "Does your app collect or share any of the required user data types?".
- **Advertising ID:** No.
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
4. In Play Console, create a release on your track and upload the `.aab`.

Store pictures come from the game itself: `npm run store-art` redraws them
(needs Playwright).

## Play and the APK don't mix

The APKs on the Releases page are signed with the public development key, the
Play version with Google's key. Android won't install one over the other: to
switch, uninstall first, which deletes your progress.
