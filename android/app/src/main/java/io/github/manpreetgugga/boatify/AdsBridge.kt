package io.github.manpreetgugga.boatify

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.ump.ConsentDebugSettings
import com.google.android.ump.ConsentInformation.PrivacyOptionsRequirementStatus
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import org.json.JSONObject

// AdMob behind the page's `BoatifyAds` interface: rewarded videos and the ad
// between voyages (docs/MONETIZATION.md has the contract). Nothing loads until
// Google's consent form (UMP) has had its say. The interface is called on a
// background thread; everything else here runs on the UI thread.
class AdsBridge(private val activity: Activity, private val webView: WebView) {
    private val main = Handler(Looper.getMainLooper())
    private val consent = UserMessagingPlatform.getConsentInformation(activity)
    private val testDevices = BuildConfig.ADMOB_TEST_DEVICES.split(",").filter { it.isNotBlank() }
    private var started = false

    // Told each time the consent answer may have changed (analytics follows it).
    var onConsent: (() -> Unit)? = null
    private var destroyed = false
    private var showing: Showing? = null

    @Volatile
    private var privacyRequired = false

    private val rewarded = Slot<RewardedAd>("rewarded") { loaded, failed ->
        RewardedAd.load(
            activity,
            BuildConfig.ADMOB_REWARDED_ID,
            AdRequest.Builder().build(),
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) = loaded(ad)
                override fun onAdFailedToLoad(error: LoadAdError) = failed(error)
            },
        )
    }

    private val interstitial = Slot<InterstitialAd>("interstitial") { loaded, failed ->
        InterstitialAd.load(
            activity,
            BuildConfig.ADMOB_INTERSTITIAL_ID,
            AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) = loaded(ad)
                override fun onAdFailedToLoad(error: LoadAdError) = failed(error)
            },
        )
    }

    // Asks for consent where the law needs it, then starts the ads SDK.
    fun start() {
        val params = ConsentRequestParameters.Builder()
        if (testDevices.isNotEmpty() || BuildConfig.DEBUG) {
            val debug = ConsentDebugSettings.Builder(activity)
            testDevices.forEach { debug.addTestDeviceHashedId(it) }
            // Debug builds on a test device see the form as if in the EEA.
            if (BuildConfig.DEBUG) debug.setDebugGeography(ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_EEA)
            params.setConsentDebugSettings(debug.build())
        }
        consent.requestConsentInfoUpdate(
            activity,
            params.build(),
            {
                if (!destroyed) {
                    UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { error ->
                        if (error != null) Log.w(TAG, "Consent form: ${error.message}")
                        consentChanged()
                    }
                }
            },
            { error ->
                Log.w(TAG, "Consent info: ${error.message}")
                consentChanged()
            },
        )
        // Consent given on an earlier run lets the ads start while that check runs.
        consentChanged()
    }

    // Called from the activity: the ad covers it, then it's back.
    fun onHostPause() {
        showing?.let { it.away = true }
    }

    fun onHostResume() {
        val shown = showing ?: return
        // Back in front with no word from the SDK (say the launcher brought
        // the app back and the ad was cleared): call the ad closed.
        if (shown.away) main.postDelayed({ closed(shown) }, LOST_AD_MS)
    }

    fun destroy() {
        destroyed = true
        main.removeCallbacksAndMessages(null)
    }

    @JavascriptInterface
    fun adsReady(): Boolean = rewarded.ready

    @JavascriptInterface
    fun breakReady(): Boolean = interstitial.ready

    @JavascriptInterface
    fun privacyRequired(): Boolean = privacyRequired

    @JavascriptInterface
    fun request(id: Int, method: String, arg: String) {
        main.post {
            if (destroyed) return@post
            when (method) {
                "rewarded" -> showRewarded(id, arg)
                "interstitial" -> showInterstitial(id, arg)
                "privacy" -> showPrivacy(id)
                else -> reply(id, false, "unknown-method")
            }
        }
    }

    private fun consentChanged() {
        if (destroyed) return
        privacyRequired = consent.privacyOptionsRequirementStatus == PrivacyOptionsRequirementStatus.REQUIRED
        onConsent?.invoke()
        if (started || !consent.canRequestAds()) return
        started = true
        MobileAds.setRequestConfiguration(RequestConfiguration.Builder().setTestDeviceIds(testDevices).build())
        // Google asks for initialize() off the main thread.
        Thread {
            MobileAds.initialize(activity) {
                main.post {
                    rewarded.fill()
                    interstitial.fill()
                }
            }
        }.start()
    }

    private fun showRewarded(id: Int, placement: String) {
        if (showing != null) return reply(id, false, "busy")
        val ad = rewarded.take() ?: return reply(id, false, "unavailable")
        Log.i(TAG, "Rewarded video for $placement")
        val shown = Showing(id, rewarded = true)
        showing = shown
        ad.fullScreenContentCallback = callbacks(shown, rewarded)
        // A video that runs right up to the game's two-minute limit still pays.
        main.postDelayed({ if (shown.earned) settle(shown, true) }, REWARD_DEADLINE_MS)
        ad.show(activity) {
            shown.earned = true
            if (shown.closed) settle(shown, true)
        }
    }

    private fun showInterstitial(id: Int, placement: String) {
        if (showing != null) return reply(id, false, "busy")
        val ad = interstitial.take() ?: return reply(id, false, "unavailable")
        Log.i(TAG, "Interstitial for $placement")
        val shown = Showing(id, rewarded = false)
        showing = shown
        ad.fullScreenContentCallback = callbacks(shown, interstitial)
        ad.show(activity)
    }

    private fun showPrivacy(id: Int) {
        UserMessagingPlatform.showPrivacyOptionsForm(activity) { error ->
            if (error != null) reply(id, false, "form-${error.errorCode}") else reply(id, true)
            consentChanged()
        }
    }

    private fun callbacks(shown: Showing, slot: Slot<*>) = object : FullScreenContentCallback() {
        override fun onAdShowedFullScreenContent() = slot.fill()

        override fun onAdDismissedFullScreenContent() = closed(shown)

        override fun onAdFailedToShowFullScreenContent(error: AdError) {
            Log.w(TAG, "Couldn't show the ad (${error.code}: ${error.message})")
            settle(shown, false, "show-failed-${error.code}")
            slot.fill()
        }
    }

    // A video pays only once the SDK says the reward was earned. That can
    // come just after the video closes, so a closed unpaid video waits a moment.
    private fun closed(shown: Showing) {
        if (shown.closed) return
        shown.closed = true
        when {
            !shown.rewarded -> settle(shown, true)
            shown.earned -> settle(shown, true)
            else -> main.postDelayed({ settle(shown, shown.earned, "cancelled") }, LATE_REWARD_MS)
        }
    }

    // Every request gets exactly one reply.
    private fun settle(shown: Showing, ok: Boolean, reason: String? = null) {
        if (shown.replied) return
        shown.replied = true
        if (showing === shown) showing = null
        reply(shown.id, ok, reason)
    }

    private fun reply(id: Int, ok: Boolean, reason: String? = null) {
        if (destroyed) return
        val json = JSONObject().put("ok", ok)
        if (!ok && reason != null) json.put("reason", reason)
        webView.evaluateJavascript("window.BoatifyAdsReply($id, ${JSONObject.quote(json.toString())})", null)
    }

    private class Showing(val id: Int, val rewarded: Boolean) {
        var earned = false
        var closed = false
        var replied = false
        var away = false
    }

    // One preloaded ad of a kind. A failed load tries again later and later;
    // an ad left unshown for nearly an hour is swapped for a fresh one.
    private inner class Slot<T : Any>(
        private val kind: String,
        private val load: (loaded: (T) -> Unit, failed: (LoadAdError) -> Unit) -> Unit,
    ) {
        @Volatile
        private var ad: T? = null
        private var loading = false
        private var failures = 0
        private val retry = Runnable { fill() }
        private val expire = Runnable {
            ad = null
            fill()
        }

        val ready: Boolean get() = ad != null

        fun fill() {
            if (!started || destroyed || loading || ad != null) return
            main.removeCallbacks(retry)
            loading = true
            load(
                { loaded ->
                    loading = false
                    failures = 0
                    if (!destroyed) {
                        ad = loaded
                        main.postDelayed(expire, AD_LIFETIME_MS)
                    }
                },
                { error ->
                    loading = false
                    failures += 1
                    val wait = minOf(RETRY_MS shl minOf(failures - 1, 6), MAX_RETRY_MS)
                    Log.w(TAG, "No $kind ad (${error.code}: ${error.message}); trying again in ${wait / 1000}s")
                    if (!destroyed) main.postDelayed(retry, wait)
                },
            )
        }

        fun take(): T? {
            val taken = ad ?: return null
            ad = null
            main.removeCallbacks(expire)
            return taken
        }
    }

    private companion object {
        const val TAG = "BoatifyAds"
        const val RETRY_MS = 15_000L
        const val MAX_RETRY_MS = 10 * 60_000L
        const val AD_LIFETIME_MS = 55 * 60_000L
        const val LATE_REWARD_MS = 1_000L
        const val LOST_AD_MS = 1_500L
        const val REWARD_DEADLINE_MS = 110_000L
    }
}
