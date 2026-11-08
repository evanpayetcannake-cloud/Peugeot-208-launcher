package fr.evan.p208

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.webkit.JavascriptInterface
import android.widget.Toast

/** Fonctions appelables depuis le launcher : window.Android.xxx(...) — voir CAHIER_DES_CHARGES.md §6. */
class Bridge(private val a: MainActivity) {
    private fun ui(f: () -> Unit) = a.runOnUiThread { try { f() } catch (e: Exception) { } }

    @JavascriptInterface fun launch(id: String) = ui { Launch.open(a, id) }
    @JavascriptInterface fun openSettings(w: String) = ui { Launch.settings(a, w) }
    @JavascriptInterface fun listApps() { Apps.push(a) }
    @JavascriptInterface fun mediaInfo(): String = try { a.media.info() } catch (e: Exception) { "Erreur : ${e.message}" }
    /** Mémoire vive du poste : {"total":octets,"free":octets} (lu directement dans Android) */
    @JavascriptInterface fun ram(): String = try {
        val mi = android.app.ActivityManager.MemoryInfo()
        (a.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager).getMemoryInfo(mi)
        "{\"total\":${mi.totalMem},\"free\":${mi.availMem}}"
    } catch (e: Exception) { "{}" }
    @JavascriptInterface fun media(cmd: String) = ui { a.media.command(cmd) }
    @JavascriptInterface fun setVolume(pct: Int) = ui { Launch.volume(a, pct) }
    @JavascriptInterface fun setBrightness(pct: Int) = ui {
        val p = a.window.attributes; p.screenBrightness = pct.coerceIn(5, 100) / 100f; a.window.attributes = p
    }
    @JavascriptInterface fun copy(txt: String) = ui {
        (a.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("p208", txt))
    }
    @JavascriptInterface fun toggle(what: String, on: Boolean) = ui { Launch.settings(a, what) }   // Android 10+ interdit de couper le Wi-Fi/BT par programme

    // Notifications
    @JavascriptInterface fun dismissNotification(id: String) { try { NotifService.instance?.cancelNotification(id) } catch (e: Exception) { } }
    @JavascriptInterface fun clearNotifications() { try { NotifService.instance?.cancelAllNotifications() } catch (e: Exception) { } }
    @JavascriptInterface fun openNotification(id: String) = ui {
        try { NotifService.instance?.activeNotifications?.firstOrNull { it.key == id }?.notification?.contentIntent?.send() } catch (e: Exception) { }
    }

    // Non disponibles sans droits système / tuner du constructeur : sans effet (voir la notice).
    @JavascriptInterface fun radio(cmd: String) = ui { if (cmd == "unmute") Launch.open(a, "radio") }   // la radio FM est celle du poste : on ouvre son appli
    @JavascriptInterface fun source(s: String) { }
    @JavascriptInterface fun call(cmd: String) { }
    @JavascriptInterface fun power(cmd: String) = ui { Toast.makeText(a, "Extinction / redémarrage : à faire depuis le poste", Toast.LENGTH_SHORT).show() }
}
