package fr.evan.p208

import org.json.JSONArray
import org.json.JSONObject

/** Point de rencontre entre le service de notifications et l'activité. */
object Hub {
    @Volatile var activity: MainActivity? = null

    fun pushNotifications() {
        val a = activity ?: return
        val svc = NotifService.instance
        val arr = JSONArray()
        if (svc != null) try {
            for (n in svc.activeNotifications) {
                if (n.packageName == a.packageName || n.isOngoing) continue
                val e = n.notification.extras
                val title = e.getCharSequence("android.title")?.toString() ?: continue
                arr.put(JSONObject().put("id", n.key).put("title", title)
                    .put("text", e.getCharSequence("android.text")?.toString() ?: "")
                    .put("app", Apps.label(a, n.packageName)).put("time", n.postTime))
            }
        } catch (e: Exception) { }
        a.js("window.onNotifications && window.onNotifications($arr)")
    }
}
