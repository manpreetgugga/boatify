# Privacy policy

_No Paddle (Android app `io.github.manpreetgugga.boatify`). Last updated 31 October 2026._

No Paddle has no accounts of its own, and the developer never collects your name, email address, contacts or anything else that says who you are. The game itself is inside the app and works offline. It shows ads from **Google AdMob**, it can send **anonymous analytics and crash reports** through **Google Firebase** (you can turn this off), and if you choose to you can sign in to **Google Play Games**. These use the internet and are run by Google, as described below.

## Ads

The game shows a short video when you ask for one (for a black pearl, or a second wind on the Open Sea), and every few voyages a short ad between voyages. The ads are served by Google AdMob, which collects:

- your device's **advertising ID** and other device identifiers (such as the app set ID);
- your **IP address**, from which an approximate location can be worked out;
- information about the ads you see and tap, and how the app and ads perform, including crash and diagnostic data;
- basic device information, such as the model, operating system and language.

Google uses this to show ads, to measure them, to prevent fraud and, if you agree, to personalize the ads you see. Google's own policy explains how: <https://policies.google.com/technologies/partner-sites>.

- **Your choice.** Where the law requires it (for example in the European Economic Area, the UK and Switzerland), the game asks for your consent with Google's consent form before any ad loads. You can change your answer at any time in the game's **Settings → Ad privacy**.
- **Advertising ID.** You can reset or delete your advertising ID in your phone's settings (**Settings → Google → Ads** on most Android phones). Without it, ads are not personalized.

## Analytics and crash reports

The Google Play version of the game can send anonymous usage statistics (**Google Analytics for Firebase**) and crash reports (**Firebase Crashlytics**) so the developer can see how far players get, which voyages are too hard, and fix what breaks. It sends:

- **game events**: a voyage started, finished (which voyage and world, the stars, the time and the bumps) or given up; a new world reached; how far an Open Sea run went; your place in a regatta or a cup; a festival voyage sailed; a video watched for a reward; sharing the game; using a backup code; the language you chose;
- **crash reports**: what went wrong and where in the game's code, which voyage you were on, the app version, and the phone's model, Android version and free memory;
- with them, a **random ID** Firebase makes for this installation of the app. Your **advertising ID is never collected** for analytics, and none of this is used for ads or sold. Firebase uses your **IP address** to work out your country, without keeping it.

Google keeps the analytics for 2 months and crash reports for 90 days, on the developer's behalf: <https://firebase.google.com/support/privacy>.

- **Your choice.** Turn it on or off at any time in the game's **Settings → Analytics and crash reports**. Where the law requires consent (for example in the European Economic Area, the UK and Switzerland), it stays off until you agree on Google's consent form or turn it on yourself.
- The APK on the game's GitHub Releases page, and any build without Firebase, sends none of this.

## Updates

The Google Play version asks **Google Play** whether a newer version is out, so it can offer to download it (Play's in-app updates). With Firebase in the build it also fetches one setting from **Firebase Remote Config**, the oldest version that may still be played, using the same random installation ID as above. Nothing about you or your game is sent for this, and it is fetched whether or not analytics is on, because it only decides whether to ask you to update.

## Google Play Games (optional)

The Google Play version of the game can use Google Play Games. Nothing is sent to it unless you sign in, in the game's **Settings → Google Play Games** or through Google Play Games itself. When you are signed in:

- the game shows your **Play Games name** in Settings;
- your **scores** (stars won, the furthest Open Sea run, the longest daily streak and regattas won) go to Google Play Games leaderboards, where other players can see them as your Play Games profile settings allow;
- a **copy of your progress** (the same text as a backup code) is kept as a saved game in your Google account, so you can bring it back on another phone. Only you and the game can read it.

This is handled by Google under your Google account and Google's privacy policy: <https://policies.google.com/privacy>. The developer can't see your saved game. You can sign out, and delete your Play Games data, in the Google Play Games app or your Google account settings.

## What the app keeps, and where

- **Your progress and settings** (best times, stars, medals, coins and black pearls, the boats and gear you've unlocked, your logbook and your settings) are saved on your device, and in Google Play Games only if you sign in to it (above). Nothing about your play is sent to the developer.
- **Device backup.** If you have Android's backup turned on, Android may include the game's save in your device backup to your Google account, as it does for other apps. That backup is handled by Google under your Google account's settings; the developer can't see it.
- Uninstalling the app, or clearing its storage in Android's settings, deletes your progress.

## Permissions

- **Vibration**, for short buzzes when the boat bumps into something or picks something up, or you win a star or a medal (you can turn it off in Settings).
- **Internet and network state**, for the ads, the analytics and crash reports, and Google Play Games.
- **Advertising ID**, for the ads, as described above.

## Children

The game is not directed at children under 13, and the developer does not knowingly collect information from anyone.

## Changes

If this policy changes, the new version will be posted here with a new date.

## Contact

Questions about this policy: open an issue at <https://github.com/manpreetgugga/boatify/issues>.
