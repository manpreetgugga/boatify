package io.github.manpreetgugga.boatify

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.window.OnBackInvokedDispatcher
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import com.google.android.play.core.review.ReviewManagerFactory

// Hosts the bundled web game full screen. The game is served from the APK's
// assets through WebViewAssetLoader, so it runs offline; only the ads
// (AdsBridge) use the network. Reminders (Reminders.kt) are set from here,
// and the share sheet, the clipboard (for backup codes) and Google Play's
// rating box are reached from here. Google Play Games (GamesBridge) only
// starts when the build has a Play Games app id.
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var ads: AdsBridge
    private var games: GamesBridge? = null
    private var clipboard: ClipboardManager? = null
    private var insets = intArrayOf(0, 0, 0, 0)
    private var pageReady = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        WindowCompat.setDecorFitsSystemWindows(window, false)
        clipboard = getSystemService(ClipboardManager::class.java)

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(11, 42, 60))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.setSupportZoom(false)
            isHapticFeedbackEnabled = false
            overScrollMode = WebView.OVER_SCROLL_NEVER
            addJavascriptInterface(Bridge(), "BoatifyAndroid")
            ads = AdsBridge(this@MainActivity, this)
            addJavascriptInterface(ads, "BoatifyAds")
            if (BuildConfig.PLAY_GAMES_APP_ID.isNotEmpty()) {
                games = GamesBridge(this@MainActivity, this).also { addJavascriptInterface(it, "BoatifyGames") }
            }
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    loader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    request.url.host != WebViewAssetLoader.DEFAULT_DOMAIN

                override fun onPageFinished(view: WebView, url: String) {
                    pageReady = true
                    sendInsets()
                }
            }
        }
        setContentView(webView)

        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, windowInsets ->
            val cutout = windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout())
            val gestures = windowInsets.getInsets(WindowInsetsCompat.Type.systemGestures())
            // Cutouts must be avoided; gesture areas only nudge the controls a little.
            insets = intArrayOf(
                cutout.top,
                maxOf(cutout.right, gestures.right / 3),
                maxOf(cutout.bottom, gestures.bottom / 3),
                maxOf(cutout.left, gestures.left / 3),
            )
            sendInsets()
            windowInsets
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) {
                handleBack()
            }
        }

        hideSystemBars()
        webView.loadUrl("https://${WebViewAssetLoader.DEFAULT_DOMAIN}/assets/www/index.html")
        ads.start()
        try {
            games?.start()
        } catch (e: RuntimeException) {
            // A Play Games set-up problem leaves the game playable without it.
        }
    }

    private fun hideSystemBars() {
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
    }

    private fun sendInsets() {
        if (!pageReady) return
        val d = resources.displayMetrics.density
        val (t, r, b, l) = insets.map { it / d }
        webView.evaluateJavascript(
            "window.BoatifyNative && window.BoatifyNative.setInsets($t, $r, $b, $l)",
            null,
        )
    }

    // The game decides: pause, close a menu, or (on the title screen) let the app close.
    private fun handleBack() {
        if (!pageReady) {
            finish()
            return
        }
        webView.evaluateJavascript("window.BoatifyNative ? window.BoatifyNative.onBack() : false") { handled ->
            if (handled != "true") finish()
        }
    }

    @Deprecated("Used below Android 13; newer versions use OnBackInvokedCallback.")
    override fun onBackPressed() {
        handleBack()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    // Ask for notifications: the phone's own question while it will still ask,
    // else, when the player turned reminders on in Settings, the app's
    // notification settings.
    private fun askForReminders(withSettings: Boolean) {
        if (Reminders.allowed(this)) {
            reportReminders()
            return
        }
        val permission = Manifest.permission.POST_NOTIFICATIONS
        val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
        if (!granted && (!Reminders.askedBefore(this) || shouldShowRequestPermissionRationale(permission))) {
            Reminders.markAsked(this)
            requestPermissions(arrayOf(permission), ASK_REMINDERS)
        } else if (withSettings) {
            openNotificationSettings()
        } else {
            reportReminders()
        }
    }

    private fun openNotificationSettings() {
        try {
            startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
        } catch (e: ActivityNotFoundException) {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null)))
        }
    }

    private fun reportReminders() {
        val allowed = Reminders.allowed(this)
        if (allowed) Reminders.schedule(this)
        if (pageReady) {
            webView.evaluateJavascript(
                "window.BoatifyNative && window.BoatifyNative.onReminders && window.BoatifyNative.onReminders($allowed)",
                null,
            )
        }
    }

    // Android's share sheet, for a result or a link to the game.
    private fun shareText(text: String) {
        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
        try {
            startActivity(Intent.createChooser(send, null))
        } catch (e: ActivityNotFoundException) {
            // Nothing on the phone can share text.
        }
    }

    // Google Play's own rating box. Play decides whether it shows (it won't
    // for a sideloaded APK, or too often), and never says.
    private fun askForReview() {
        val manager = ReviewManagerFactory.create(this)
        manager.requestReviewFlow().addOnCompleteListener { request ->
            if (request.isSuccessful && !isFinishing) manager.launchReviewFlow(this, request.result)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == ASK_REMINDERS) reportReminders()
    }

    override fun onPause() {
        Reminders.setOpen(this, false)
        if (pageReady) webView.evaluateJavascript("window.BoatifyNative && window.BoatifyNative.onPause()", null)
        webView.onPause()
        ads.onHostPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        Reminders.setOpen(this, true)
        webView.onResume()
        if (pageReady) webView.evaluateJavascript("window.BoatifyNative && window.BoatifyNative.onResume()", null)
        ads.onHostResume()
    }

    override fun onDestroy() {
        ads.destroy()
        webView.destroy()
        super.onDestroy()
    }

    private inner class Bridge {
        @JavascriptInterface
        fun vibrate(ms: Int) {
            val duration = ms.coerceIn(1, 1000).toLong()
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            if (vibrator.hasVibrator()) {
                vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
            }
        }

        @JavascriptInterface
        fun exitApp() {
            runOnUiThread { finish() }
        }

        @JavascriptInterface
        fun version(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface
        fun setReminders(json: String) {
            Reminders.configure(applicationContext, json)
        }

        @JavascriptInterface
        fun remindersAllowed(): Boolean = Reminders.allowed(applicationContext)

        @JavascriptInterface
        fun askReminders(withSettings: Boolean) {
            runOnUiThread { askForReminders(withSettings) }
        }

        @JavascriptInterface
        fun share(text: String) {
            runOnUiThread { shareText(text.take(2000)) }
        }

        @JavascriptInterface
        fun askReview() {
            runOnUiThread { askForReview() }
        }

        // Backup codes go out through the clipboard and come back the same way.
        @JavascriptInterface
        fun copyText(text: String) {
            runOnUiThread { clipboard?.setPrimaryClip(ClipData.newPlainText("No Paddle backup code", text.take(200_000))) }
        }

        @JavascriptInterface
        fun pasteText(): String {
            val clip = clipboard?.primaryClip ?: return ""
            if (clip.itemCount == 0) return ""
            return clip.getItemAt(0).text?.toString()?.take(200_000) ?: ""
        }
    }

    private companion object {
        const val ASK_REMINDERS = 1
    }
}
