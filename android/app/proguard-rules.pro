# The web game calls these through the BoatifyAndroid bridge.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
