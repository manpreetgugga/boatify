package io.github.manpreetgugga.boatify

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import kotlin.random.Random

// Reminders at set times of day (9 am, 6 pm and 9 pm), each a line drawn at
// random from the list the game hands over on every launch
// (web/src/data/reminders.js). One alarm is set at a time, for the next of
// those times; when it goes off ReminderReceiver shows a reminder and sets the
// next one. A reboot, a clock change or an app update sets it again.
object Reminders {
    const val ACTION_REMIND = "io.github.manpreetgugga.boatify.REMIND"
    private const val EXTRA_AT = "at"
    private const val PREFS = "reminders"
    private const val CHANNEL = "reminders"
    private const val NOTIFICATION_ID = 1

    // No reminder while the game is open, or this soon after it was.
    private const val QUIET_MS = 45 * 60 * 1000L

    // An "open" mark older than this is a game that never got to say it closed.
    private const val OPEN_STALE_MS = 6 * 60 * 60 * 1000L

    // A time this close is skipped, so an alarm that goes off a little early
    // doesn't set itself again for the same time.
    private const val SOON_MS = 5 * 60 * 1000L

    // How many recent lines to keep out of the draw (up to half the list).
    private const val RECENT = 40

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun config(context: Context): JSONObject? =
        prefs(context).getString("config", null)?.let { runCatching { JSONObject(it) }.getOrNull() }

    // { on, times: [{ hour, minute, at }], messages: [{ title, text, at }] }
    fun configure(context: Context, json: String) {
        if (runCatching { JSONObject(json) }.isFailure) return
        prefs(context).edit().putString("config", json).apply()
        createChannel(context)
        schedule(context)
    }

    fun allowed(context: Context): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

    // Android asks for notifications twice at most; after a second "no" only
    // the app's settings can turn them on.
    fun askedBefore(context: Context): Boolean = prefs(context).getBoolean("asked", false)

    fun markAsked(context: Context) {
        prefs(context).edit().putBoolean("asked", true).apply()
    }

    // The game is on screen (or just left it).
    fun setOpen(context: Context, open: Boolean) {
        prefs(context).edit().putBoolean("open", open).putLong("seen", System.currentTimeMillis()).apply()
    }

    fun schedule(context: Context) {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        alarms.cancel(alarmIntent(context, ""))
        val config = config(context) ?: return
        if (!config.optBoolean("on", true)) return
        val times = config.optJSONArray("times") ?: return
        val (at, millis) = nextTime(times, System.currentTimeMillis()) ?: return
        // Inexact, so it needs no special permission; Android may hold it a few
        // minutes to save battery.
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, millis, alarmIntent(context, at))
    }

    private fun nextTime(times: JSONArray, now: Long): Pair<String, Long>? {
        var best: Pair<String, Long>? = null
        for (i in 0 until times.length()) {
            val t = times.optJSONObject(i) ?: continue
            val c = Calendar.getInstance().apply {
                timeInMillis = now
                set(Calendar.HOUR_OF_DAY, t.optInt("hour").coerceIn(0, 23))
                set(Calendar.MINUTE, t.optInt("minute").coerceIn(0, 59))
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            if (c.timeInMillis <= now + SOON_MS) c.add(Calendar.DAY_OF_YEAR, 1)
            if (best == null || c.timeInMillis < best.second) best = t.optString("at") to c.timeInMillis
        }
        return best
    }

    private fun alarmIntent(context: Context, at: String): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).setAction(ACTION_REMIND).putExtra(EXTRA_AT, at)
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun atOf(intent: Intent): String = intent.getStringExtra(EXTRA_AT).orEmpty()

    // Show one reminder for this time of day ("morning", "evening", "night").
    fun show(context: Context, at: String) {
        val p = prefs(context)
        val config = config(context) ?: return
        if (!config.optBoolean("on", true) || !allowed(context)) return
        val now = System.currentTimeMillis()
        val seen = p.getLong("seen", 0L)
        if (p.getBoolean("open", false) && now - seen < OPEN_STALE_MS) return
        if (now - seen < QUIET_MS) return

        val lines = config.optJSONArray("messages") ?: return
        val fits = (0 until lines.length()).mapNotNull { lines.optJSONObject(it) }.filter {
            val slot = it.optString("at")
            (slot.isEmpty() || slot == at) && it.optString("text").isNotBlank()
        }
        if (fits.isEmpty()) return
        val recent = p.getString("recent", "").orEmpty().split(",").mapNotNull { it.toIntOrNull() }
        val fresh = fits.filter { key(it) !in recent }.ifEmpty { fits }
        val line = fresh[Random.nextInt(fresh.size)]
        val keep = minOf(RECENT, fits.size / 2)
        p.edit().putString("recent", (recent + key(line)).takeLast(keep).joinToString(",")).apply()
        notify(context, line.optString("title"), line.optString("text"))
    }

    private fun key(line: JSONObject): Int = (line.optString("title") + "\n" + line.optString("text")).hashCode()

    private fun createChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        // Created again each time, so the name follows the phone's language.
        val channel = NotificationChannel(CHANNEL, context.getString(R.string.reminders_channel), NotificationManager.IMPORTANCE_DEFAULT)
        channel.description = context.getString(R.string.reminders_channel_about)
        manager.createNotificationChannel(channel)
    }

    private fun notify(context: Context, title: String, text: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        createChannel(context)
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_sail)
            .setColor(ContextCompat.getColor(context, R.color.brass))
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        try {
            // One at a time: a new reminder replaces one still unread.
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
        } catch (e: SecurityException) {
            // Notifications were turned off in between.
        }
    }
}

// The alarm going off, or the phone having rebooted, changed its clock or
// updated the app (which all forget or skew the alarm).
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Reminders.ACTION_REMIND) Reminders.show(context, Reminders.atOf(intent))
        Reminders.schedule(context)
    }
}
