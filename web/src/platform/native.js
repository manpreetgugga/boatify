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

// Share some text (and the link in it): Android's share sheet in the app, the
// browser's own sharing where there is one, else the clipboard. Resolves to
// 'shared', 'copied' or 'failed'.
export async function share(text) {
  try {
    if (bridge && bridge.share) {
      bridge.share(text);
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    // Cancelled, or not allowed.
  }
  return 'failed';
}

// The clipboard, for backup codes. copyText resolves to true once the text is
// on it. pasteText resolves to the clipboard's text, or null where the game
// can't read it (then the player pastes into the box themselves).
export async function copyText(text) {
  try {
    if (bridge && bridge.copyText) {
      bridge.copyText(text);
      return true;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Not allowed.
  }
  return false;
}

export const canPaste = !!((bridge && bridge.pasteText) || (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText));

export async function pasteText() {
  try {
    if (bridge && bridge.pasteText) return String(bridge.pasteText() || '');
    if (navigator.clipboard && navigator.clipboard.readText) return await navigator.clipboard.readText();
  } catch {
    // Not allowed.
  }
  return null;
}

// Google Play's "Rate this game" box (Android only). Play decides whether it
// actually shows, and says nothing either way.
export const canReview = !!(bridge && bridge.askReview);

export function askReview() {
  try {
    if (canReview) bridge.askReview();
  } catch {
    // No rating box, then.
  }
}

// handlers: { back(): boolean, pause(), resume(), insets({top,right,bottom,left}), reminders(allowed), games(event) }
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
    // Google Play Games' answers (platform/games.js).
    onGames(event) {
      if (handlers.games) handlers.games(event);
    },
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handlers.pause();
    else handlers.resume();
  });
}
