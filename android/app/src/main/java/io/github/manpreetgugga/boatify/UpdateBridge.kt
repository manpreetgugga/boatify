package io.github.manpreetgugga.boatify

import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import com.google.firebase.FirebaseApp
import com.google.firebase.remoteconfig.FirebaseRemoteConfig
import com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings
import org.json.JSONObject

// Google Play in-app updates behind the page's BoatifyUpdates interface
// (web/src/platform/updates.js). The page decides when to ask: only on the
// title screen, a normal update at most once a day. This side asks Play and
// reports back through window.BoatifyNative.onUpdate(info). MainActivity
// only makes one for a copy Google Play installed (fromPlay), so the GitHub
// APK never asks.
// With Firebase in the build, Remote Config's min_version_code marks every
// older version as one that must update.
class UpdateBridge(private val activity: Activity, private val webView: WebView) {
    private val manager = AppUpdateManagerFactory.create(activity)
    private var info: AppUpdateInfo? = null
    private var downloading = false
    private var downloaded = false
    private var immediateStarted = false
    private var minVersion = 0L

    private val listener = InstallStateUpdatedListener { state ->
        when (state.installStatus()) {
            InstallStatus.DOWNLOADING, InstallStatus.PENDING -> if (!downloading) {
                downloading = true
                report()
            }
            InstallStatus.DOWNLOADED -> {
                downloading = false
                downloaded = true
                report()
            }
            InstallStatus.FAILED, InstallStatus.CANCELED -> {
                downloading = false
                refresh()
            }
            else -> Unit
        }
    }

    init {
        manager.registerListener(listener)
        fetchRemoteConfig()
    }

    fun destroy() {
        manager.unregisterListener(listener)
    }

    // Asks Play again; the page hears the answer. Also picks up an immediate
    // update the player left half done (Play wants it resumed).
    @JavascriptInterface
    fun check() {
        activity.runOnUiThread { refresh() }
    }

    @JavascriptInterface
    fun start(immediate: Boolean) {
        activity.runOnUiThread {
            val current = info ?: return@runOnUiThread
            val type = if (immediate) AppUpdateType.IMMEDIATE else AppUpdateType.FLEXIBLE
            if (!current.isUpdateTypeAllowed(type)) return@runOnUiThread
            try {
                immediateStarted = immediate
                manager.startUpdateFlowForResult(current, activity, AppUpdateOptions.defaultOptions(type), REQUEST)
            } catch (e: Exception) {
                // Play couldn't show it; the page asks again another time.
            }
        }
    }

    // The flexible update is down: install it and restart into the new version.
    @JavascriptInterface
    fun restart() {
        activity.runOnUiThread { manager.completeUpdate() }
    }

    // MainActivity's onActivityResult for REQUEST: the player said yes or no.
    fun onResult(resultCode: Int) {
        if (resultCode != Activity.RESULT_OK) immediateStarted = false
        refresh()
    }

    private fun refresh() {
        manager.appUpdateInfo
            .addOnSuccessListener { i ->
                info = i
                downloaded = i.installStatus() == InstallStatus.DOWNLOADED
                downloading = i.installStatus() == InstallStatus.DOWNLOADING || i.installStatus() == InstallStatus.PENDING
                if (immediateStarted && i.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS && !downloaded) {
                    try {
                        manager.startUpdateFlowForResult(i, activity, AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE), REQUEST)
                    } catch (e: Exception) {
                        // Leave it for the next check.
                    }
                }
                report()
            }
            .addOnFailureListener {
                info = null
                report()
            }
    }

    private fun fetchRemoteConfig() {
        if (!BuildConfig.FIREBASE || FirebaseApp.getApps(activity).isEmpty()) return
        try {
            val config = FirebaseRemoteConfig.getInstance()
            config.setConfigSettingsAsync(FirebaseRemoteConfigSettings.Builder().setMinimumFetchIntervalInSeconds(3600).build())
            config.setDefaultsAsync(mapOf(MIN_VERSION to 0L))
            minVersion = config.getLong(MIN_VERSION)
            config.fetchAndActivate().addOnCompleteListener {
                minVersion = config.getLong(MIN_VERSION)
                report()
            }
        } catch (e: RuntimeException) {
            // No Remote Config: Play's own priority still works.
        }
    }

    private fun report() {
        val i = info
        val json = JSONObject()
            .put("available", i?.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE)
            .put("downloading", downloading)
            .put("downloaded", downloaded)
            .put("immediate", i?.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE) == true)
            .put("flexible", i?.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) == true)
            .put("priority", i?.updatePriority() ?: 0)
            .put("staleDays", i?.clientVersionStalenessDays() ?: -1)
            .put("version", i?.availableVersionCode() ?: 0)
            .put("current", BuildConfig.VERSION_CODE)
            .put("minVersion", minVersion)
        webView.post {
            webView.evaluateJavascript("window.BoatifyNative && window.BoatifyNative.onUpdate && window.BoatifyNative.onUpdate($json)", null)
        }
    }

    companion object {
        const val REQUEST = 7
        private const val MIN_VERSION = "min_version_code"
        private const val PLAY_STORE = "com.android.vending"

        // Installed by Google Play (internal app sharing and test tracks too)?
        fun fromPlay(activity: Activity): Boolean = try {
            val pm = activity.packageManager
            val installer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                pm.getInstallSourceInfo(activity.packageName).installingPackageName
            } else {
                @Suppress("DEPRECATION")
                pm.getInstallerPackageName(activity.packageName)
            }
            installer == PLAY_STORE
        } catch (e: PackageManager.NameNotFoundException) {
            false
        } catch (e: RuntimeException) {
            false
        }
    }
}
