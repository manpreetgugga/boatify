# The web game calls these through the BoatifyAndroid and BoatifyAds bridges.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
