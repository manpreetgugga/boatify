# Development signing key

`boatify-dev.keystore` signs the APKs that CI attaches to GitHub releases, so
each release installs over the previous one. Its passwords are public
(`android` / alias `androiddebugkey`), so it proves nothing about who built an
APK. For a store release, set `BOATIFY_KEYSTORE_FILE`,
`BOATIFY_KEYSTORE_PASSWORD`, `BOATIFY_KEY_ALIAS` and `BOATIFY_KEY_PASSWORD`
and the build signs with that key instead.
