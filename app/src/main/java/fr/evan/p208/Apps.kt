package fr.evan.p208

import android.content.Context
import android.content.Intent
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import kotlin.concurrent.thread

/** Liste des applis installées (envoyée au launcher) + recherche d'une appli par nom. */
object Apps {
    private fun launchables(c: Context): List<ResolveInfo> {
        val i = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return c.packageManager.queryIntentActivities(i, 0).filter { it.activityInfo.packageName != c.packageName }
    }

    fun label(c: Context, pkg: String): String = try {
        c.packageManager.getApplicationLabel(c.packageManager.getApplicationInfo(pkg, 0)).toString()
    } catch (e: Exception) { pkg }

    /** Premier paquet dont le nom contient un des mots (insensible à la casse). */
    fun findByLabel(c: Context, vararg words: String): String? =
        launchables(c).firstOrNull { r ->
            val l = r.loadLabel(c.packageManager).toString().lowercase()
            words.any { l.contains(it) }
        }?.activityInfo?.packageName

    fun push(a: MainActivity) = thread(isDaemon = true) {
        try {
            val pm = a.packageManager
            val arr = JSONArray()
            for (r in launchables(a).sortedBy { it.loadLabel(pm).toString().lowercase() }) {
                arr.put(JSONObject().put("id", r.activityInfo.packageName).put("n", r.loadLabel(pm).toString())
                    .put("icon", "data:image/png;base64," + png(r.loadIcon(pm))))
            }
            a.js("window.onApps && window.onApps($arr)")
        } catch (e: Exception) { }
    }

    private fun png(d: Drawable, size: Int = 96): String {
        val b = if (d is BitmapDrawable && d.bitmap.width <= size * 2) Bitmap.createScaledBitmap(d.bitmap, size, size, true)
        else Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).also { d.setBounds(0, 0, size, size); d.draw(Canvas(it)) }
        val o = ByteArrayOutputStream(); b.compress(Bitmap.CompressFormat.PNG, 100, o)
        return Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP)
    }
}
