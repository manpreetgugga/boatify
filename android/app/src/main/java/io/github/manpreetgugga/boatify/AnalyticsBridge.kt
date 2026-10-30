package io.github.manpreetgugga.boatify

import android.app.Activity
import android.content.Context
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.google.android.ump.ConsentInformation.ConsentStatus
import com.google.android.ump.UserMessagingPlatform
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.FirebaseAnalytics.ConsentStatus.DENIED
import com.google.firebase.analytics.FirebaseAnalytics.ConsentStatus.GRANTED
import com.google.firebase.analytics.FirebaseAnalytics.ConsentType
import com.google.firebase.crashlytics.FirebaseCrashlytics
import org.json.JSONException
import org.json.JSONObject

// Anonymous analytics and crash reports (Firebase) behind the page's
// BoatifyAnalytics interface (web/src/platform/analytics.js). MainActivity only
// makes one when the build has Firebase (app/build.gradle.kts) and it started;
// without one the page sees no bridge and Settings shows no switch.
// The manifest starts Analytics and Crashlytics off, without the advertising id
// and never for ads. Nothing is collected until the page says the player allows
// it (setEnabled); that answer is kept so the next launch reports a crash from
// its first second.
class AnalyticsBridge(private val activity: Activity, private val webView: WebView) {
    private val analytics = FirebaseAnalytics.getInstance(activity)
    private val crashlytics = FirebaseCrashlytics.getInstance()
    private val prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    init {
        if (prefs.contains(ON)) collect(prefs.getBoolean(ON, false))
    }

    // The consent form was answered (AdsBridge): the page may change its default.
    fun consentChanged() {
        webView.post {
            webView.evaluateJavascript("window.BoatifyNative && window.BoatifyNative.onAnalytics && window.BoatifyNative.onAnalytics()", null)
        }
    }

    private fun collect(on: Boolean) {
        analytics.setConsent(
            mapOf(
                ConsentType.ANALYTICS_STORAGE to if (on) GRANTED else DENIED,
                ConsentType.AD_STORAGE to DENIED,
                ConsentType.AD_USER_DATA to DENIED,
                ConsentType.AD_PERSONALIZATION to DENIED,
            ),
        )
        analytics.setAnalyticsCollectionEnabled(on)
        crashlytics.isCrashlyticsCollectionEnabled = on
    }

    // On by default only where the law allows: once Google's consent form has
    // had its say, and where consent applies only with consent to storing on
    // the device (TCF purpose 1) and to measuring (purpose 8).
    @JavascriptInterface
    fun defaultOn(): Boolean = try {
        when (UserMessagingPlatform.getConsentInformation(activity).consentStatus) {
            ConsentStatus.NOT_REQUIRED, ConsentStatus.OBTAINED -> tcfAllows()
            else -> false
        }
    } catch (e: RuntimeException) {
        false
    }

    private fun tcfAllows(): Boolean {
        val tcf = activity.getSharedPreferences(activity.packageName + "_preferences", Context.MODE_PRIVATE)
        val applies = tcf.all["IABTCF_gdprApplies"]?.toString() == "1"
        if (!applies) return true
        val purposes = tcf.getString("IABTCF_PurposeConsents", "").orEmpty()
        return purposes.getOrNull(0) == '1' && purposes.getOrNull(7) == '1'
    }

    @JavascriptInterface
    fun setEnabled(on: Boolean) {
        prefs.edit().putBoolean(ON, on).apply()
        collect(on)
    }

    // The page has already kept only the listed events and fields; this checks
    // their shape again before anything reaches Firebase.
    @JavascriptInterface
    fun log(name: String, json: String) {
        if (!KEY.matches(name)) return
        val params = Bundle()
        try {
            val fields = JSONObject(json)
            for (k in fields.keys()) {
                if (!KEY.matches(k)) continue
                when (val v = fields.get(k)) {
                    is Int, is Long -> params.putLong(k, (v as Number).toLong())
                    is Number -> params.putDouble(k, v.toDouble())
                    is String -> params.putString(k, v.take(40))
                }
            }
        } catch (e: JSONException) {
            return
        }
        analytics.logEvent(name, params)
    }

    // A script error on the page, as a non-fatal crash report.
    @JavascriptInterface
    fun error(message: String, stack: String, voyage: String) {
        crashlytics.setCustomKey("voyage", voyage.take(60))
        if (stack.isNotEmpty()) crashlytics.log(stack.take(2000))
        crashlytics.recordException(PageError(message.take(300)))
    }

    private class PageError(message: String) : RuntimeException(message)

    private companion object {
        const val PREFS = "analytics"
        const val ON = "on"
        val KEY = Regex("[a-z][a-z_]{0,39}")
    }
}
