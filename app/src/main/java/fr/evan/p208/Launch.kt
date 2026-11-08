package fr.evan.p208

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.provider.AlarmClock
import android.provider.MediaStore
import android.provider.Settings
import android.widget.Toast

/**
 * Ouvre une appli à partir de l'identifiant du launcher.
 *  - un nom de paquet (« com.waze ») s'ouvre directement ;
 *  - les identifiants du launcher (« android_auto », « carplay »…) sont traduits ci-dessous.
 * CarPlay / Android Auto sans fil : le nom du paquet dépend du poste, donc on cherche l'appli par son NOM.
 * Si ça ne trouve pas la tienne, ajoute son nom (en minuscules) dans la liste « carplay » / « android_auto ».
 */
object Launch {
    private val NAMES = mapOf(
        "android_auto" to arrayOf("android auto", "androidauto", "zlink", "carlink", "ewtoyou"),
        "carplay" to arrayOf("carplay", "car play", "carlink", "zlink", "ewtoyou", "phone link", "phonelink"),
        "rear_camera" to arrayOf("avm", "360", "caméra arrière", "camera arrière", "rear", "backcam", "reverse"),
        "radio" to arrayOf("radio", "fm"),
        "btapp" to arrayOf("bluetooth"),   // appli Bluetooth du poste (musique + téléphone)
        "camera" to arrayOf("caméra", "camera", "avm", "360"),
    )
    private val PKG = mapOf(
        "gmaps" to "com.google.android.apps.maps", "maps" to "com.google.android.apps.maps", "waze" to "com.waze",
        "spotify" to "com.spotify.music", "ytmusic" to "com.google.android.apps.youtube.music",
        "youtube" to "com.google.android.youtube", "files" to "com.google.android.apps.nbu.files",
        "weather" to "com.google.android.googlequicksearchbox",
    )
    private val CAT = mapOf(
        "messages" to Intent.CATEGORY_APP_MESSAGING, "gallery" to Intent.CATEGORY_APP_GALLERY, "contacts" to Intent.CATEGORY_APP_CONTACTS,
        "calendar" to Intent.CATEGORY_APP_CALENDAR, "calculator" to Intent.CATEGORY_APP_CALCULATOR, "music" to Intent.CATEGORY_APP_MUSIC,
    )

    fun open(a: Activity, id: String) {
        try {
            val pm = a.packageManager
            fun pkg(p: String?) = p?.let { pm.getLaunchIntentForPackage(it) }
            val i: Intent? = when {
                id.contains('.') -> pkg(id)
                id == "settings" -> Intent(Settings.ACTION_SETTINGS)
                id == "bluetooth" -> Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
                id == "phone" -> Intent(Intent.ACTION_DIAL)
                id == "clock" -> Intent(AlarmClock.ACTION_SHOW_ALARMS)
                id in CAT -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, CAT[id]!!)
                else -> pkg(Apps.findByLabel(a, *(NAMES[id] ?: emptyArray())))
                    ?: pkg(PKG[id])
                    ?: if (id == "camera" || id == "rear_camera") Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)
                    else if (id == "btapp") Intent(Settings.ACTION_BLUETOOTH_SETTINGS) else null
            }
            if (i == null) { Toast.makeText(a, "Application introuvable : $id", Toast.LENGTH_SHORT).show(); return }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
            a.startActivity(i)
        } catch (e: Exception) {
            Toast.makeText(a, "Impossible d'ouvrir : $id", Toast.LENGTH_SHORT).show()
        }
    }

    fun settings(a: Activity, w: String) {
        val act = when (w) { "wifi" -> Settings.ACTION_WIFI_SETTINGS; "bluetooth" -> Settings.ACTION_BLUETOOTH_SETTINGS; else -> Settings.ACTION_SETTINGS }
        try { a.startActivity(Intent(act).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) { }
    }

    fun volume(a: Activity, pct: Int) {
        val am = a.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.setStreamVolume(AudioManager.STREAM_MUSIC, (pct.coerceIn(0, 100) * am.getStreamMaxVolume(AudioManager.STREAM_MUSIC) / 100), 0)
    }
}
