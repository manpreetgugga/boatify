// Bridge to the Android shell. In a browser the same calls fall back to web
// APIs or do nothing. The shell calls back into window.BoatifyNative.

const bridge = typeof window !== 'undefined' ? window.BoatifyAndroid : undefined;

export const isAndroidApp = !!bridge;

export function vibrate(ms) {
  try {
    if (bridge && bridge.vibrate) bridge.vibrate(Math.round(ms));
    else if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    // Haptics are optional.
  }
}

export function exitApp() {
  try {
    if (bridge && bridge.exitApp) bridge.exitApp();
  } catch {
    // Nothing to do in a browser.
  }
}

export function appVersion() {
  try {
    if (bridge && bridge.version) return bridge.version();
  } catch {
    // Fall through.
  }
  return null;
}

// Reminders on the phone (Android only). The shell keeps the config
// ({ on, times, messages }, data/reminders.js) and draws from it itself.
export const canRemind = !!(bridge && bridge.setReminders);

export function setReminders(config) {
  try {
    if (canRemind) bridge.setReminders(JSON.stringify(config));
  } catch {
    // No reminders, then.
  }
}

// Whether the phone lets the app show notifications at all.
export function remindersAllowed() {
  try {
    return canRemind && !!bridge.remindersAllowed();
  } catch {
    return false;
  }
}

// Asks the phone to allow notifications; the answer comes back through
// handlers.reminders(allowed). Once the phone has stopped asking, withSettings
// opens the app's notification settings instead.
export function askReminders(withSettings = false) {
  try {
    if (canRemind) bridge.askReminders(!!withSettings);
  } catch {
    // Nothing to ask.
  }
}

// handlers: { back(): boolean, pause(), resume(), insets({top,right,bottom,left}), reminders(allowed) }
export function installNativeHooks(handlers) {
  window.BoatifyNative = {
    onBack() {
      // Return true when the game handled it; false lets the app close.
      try {
        return !!handlers.back();
      } catch {
        return true;
      }
    },
    onPause() {
      handlers.pause();
    },
    onResume() {
      handlers.resume();
    },
    setInsets(top, right, bottom, left) {
      handlers.insets({ top, right, bottom, left });
    },
    onReminders(allowed) {
      if (handlers.reminders) handlers.reminders(!!allowed);
    },
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handlers.pause();
    else handlers.resume();
  });
}
