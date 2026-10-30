package io.github.manpreetgugga.boatify

import android.app.Activity
import android.content.ActivityNotFoundException
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import com.google.android.gms.games.SnapshotsClient
import com.google.android.gms.games.snapshot.Snapshot
import com.google.android.gms.games.snapshot.SnapshotMetadataChange
import org.json.JSONObject

// Google Play Games: sign-in, the leaderboards, and the progress (as a backup
// code) kept in a saved game. MainActivity only makes one when the build has
// a Play Games app id (app/build.gradle.kts); without one nothing here runs,
// the page never sees the BoatifyGames bridge and hides Play Games.
// Answers go to the page through window.BoatifyNative.onGames(event).
class GamesBridge(private val activity: Activity, private val webView: WebView) {
    private var signedIn = false
    private var player = ""
    // One saved-game open at a time: Play Games refuses a second.
    private var busy = false

    // Leaderboard ids from the build, by the names the page uses.
    private val boards = mapOf(
        "stars" to BuildConfig.PLAY_GAMES_BOARD_STARS,
        "sea" to BuildConfig.PLAY_GAMES_BOARD_SEA,
        "streak" to BuildConfig.PLAY_GAMES_BOARD_STREAK,
        "wins" to BuildConfig.PLAY_GAMES_BOARD_WINS,
    ).filterValues { it.isNotEmpty() }

    fun start() {
        PlayGamesSdk.initialize(activity)
        // Play Games tries to sign the player in by itself at launch.
        PlayGames.getGamesSignInClient(activity).isAuthenticated().addOnCompleteListener { task ->
            signedInNow(task.isSuccessful && task.result.isAuthenticated())
        }
    }

    private fun signedInNow(ok: Boolean) {
        signedIn = ok
        if (!ok) {
            player = ""
            send(JSONObject().put("kind", "signin").put("ok", false))
            return
        }
        PlayGames.getPlayersClient(activity).getCurrentPlayer().addOnCompleteListener { task ->
            player = if (task.isSuccessful) task.result?.getDisplayName().orEmpty() else ""
            send(JSONObject().put("kind", "signin").put("ok", true).put("name", player))
        }
    }

    private fun signIn() {
        PlayGames.getGamesSignInClient(activity).signIn().addOnCompleteListener { task ->
            signedInNow(task.isSuccessful && task.result.isAuthenticated())
        }
    }

    private fun showBoards() {
        if (!signedIn) return signIn()
        PlayGames.getLeaderboardsClient(activity).getAllLeaderboardsIntent().addOnSuccessListener { intent ->
            try {
                if (!activity.isFinishing) activity.startActivityForResult(intent, SHOW_BOARDS)
            } catch (e: ActivityNotFoundException) {
                // No Play Games app to show them.
            }
        }
    }

    private fun saveCode(code: String, about: String) {
        if (!signedIn || busy) return send(JSONObject().put("kind", "saved").put("ok", false))
        busy = true
        val snapshots = PlayGames.getSnapshotsClient(activity)
        snapshots.open(SAVE_NAME, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED).addOnCompleteListener { task ->
            val snapshot: Snapshot? = if (task.isSuccessful) task.result.getData() else null
            if (snapshot == null) {
                busy = false
                return@addOnCompleteListener send(JSONObject().put("kind", "saved").put("ok", false))
            }
            snapshot.getSnapshotContents().writeBytes(code.toByteArray(Charsets.UTF_8))
            val change = SnapshotMetadataChange.Builder().setDescription(about.take(100)).build()
            snapshots.commitAndClose(snapshot, change).addOnCompleteListener { done ->
                busy = false
                send(JSONObject().put("kind", "saved").put("ok", done.isSuccessful))
            }
        }
    }

    // The code in the cloud, "" when there is none. A list read from the
    // phone's cache (offline) can't say there's none, so that's a failure:
    // the page then never writes over a save it couldn't see.
    private fun loadCode() {
        val failed = JSONObject().put("kind", "loaded").put("ok", false)
        if (!signedIn || busy) return send(failed)
        busy = true
        val snapshots = PlayGames.getSnapshotsClient(activity)
        snapshots.load(true).addOnCompleteListener { listed ->
            val data = if (listed.isSuccessful) listed.result else null
            val list = data?.get()
            if (data == null || list == null || data.isStale()) {
                list?.release()
                busy = false
                return@addOnCompleteListener send(failed)
            }
            val found = list.any { it.getUniqueName() == SAVE_NAME }
            list.release()
            if (!found) {
                busy = false
                return@addOnCompleteListener send(JSONObject().put("kind", "loaded").put("ok", true).put("code", ""))
            }
            snapshots.open(SAVE_NAME, false, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED).addOnCompleteListener { task ->
                val snapshot: Snapshot? = if (task.isSuccessful) task.result.getData() else null
                val code = try {
                    snapshot?.getSnapshotContents()?.readFully()?.toString(Charsets.UTF_8)
                } catch (e: Exception) {
                    null
                }
                if (snapshot != null) snapshots.discardAndClose(snapshot)
                busy = false
                send(if (code == null) failed else JSONObject().put("kind", "loaded").put("ok", true).put("code", code.take(200_000)))
            }
        }
    }

    private fun send(event: JSONObject) {
        val json = event.toString()
        activity.runOnUiThread {
            webView.evaluateJavascript("window.BoatifyNative && window.BoatifyNative.onGames && window.BoatifyNative.onGames($json)", null)
        }
    }

    @JavascriptInterface
    fun state(): String = JSONObject().put("signedIn", signedIn).put("name", player).put("boards", boards.keys.joinToString(",")).toString()

    @JavascriptInterface
    fun signInNow() {
        activity.runOnUiThread { signIn() }
    }

    @JavascriptInterface
    fun showLeaderboards() {
        activity.runOnUiThread { showBoards() }
    }

    @JavascriptInterface
    fun submitScore(board: String, score: Double) {
        val id = boards[board] ?: return
        if (score < 1 || score.isNaN()) return
        activity.runOnUiThread {
            if (signedIn) PlayGames.getLeaderboardsClient(activity).submitScore(id, score.toLong())
        }
    }

    @JavascriptInterface
    fun cloudSave(code: String, about: String) {
        val text = code.take(200_000)
        activity.runOnUiThread { saveCode(text, about) }
    }

    @JavascriptInterface
    fun cloudLoad() {
        activity.runOnUiThread { loadCode() }
    }

    private companion object {
        const val SAVE_NAME = "no-paddle-progress"
        const val SHOW_BOARDS = 9001
    }
}
