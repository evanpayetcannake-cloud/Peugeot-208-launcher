package fr.evan.p208

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import kotlin.concurrent.thread
import android.media.AudioManager
import android.util.Base64
import java.io.ByteArrayOutputStream
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import org.json.JSONObject

/** Musique en cours (Spotify, YouTube Music…) : envoie le titre / la position au launcher et reçoit les commandes. */
class MediaBridge(private val a: MainActivity) {
    private val msm = a.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager
    private val h = Handler(Looper.getMainLooper())
    private var cur: MediaController? = null
    private var running = false
    private val log = mutableListOf<String>()   // dernières commandes (affichées dans Réglages → Système → Diagnostic musique)
    private fun note(s: String) { synchronized(log) { log.add(s); while (log.size > 10) log.removeAt(0) } }
    private fun btPkg(): String? = try { Apps.findByLabel(a, "bluetooth") } catch (e: Exception) { null }
    private var coverSent = "#"   // clé de la dernière pochette envoyée (on ne renvoie l'image que si elle change)

    /** Pochette du morceau en petite image JPEG (data URI), ou null si l'appli n'en fournit pas. */
    private fun coverOf(m: MediaMetadata?): Bitmap? =
        m?.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART) ?: m?.getBitmap(MediaMetadata.METADATA_KEY_ART) ?: m?.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON)

    private fun loadUri(u: String): Bitmap? = try {
        val uri = Uri.parse(u)
        val ins = if (uri.scheme == "http" || uri.scheme == "https") java.net.URL(u).openStream() else a.contentResolver.openInputStream(uri)
        ins?.use { BitmapFactory.decodeStream(it) }
    } catch (e: Exception) { null }

    private fun encode(b: Bitmap): String {
        val k = 360f / maxOf(b.width, b.height)
        val sm = if (k < 1f) Bitmap.createScaledBitmap(b, maxOf(1, (b.width * k).toInt()), maxOf(1, (b.height * k).toInt()), true) else b
        val out = ByteArrayOutputStream()
        sm.compress(Bitmap.CompressFormat.JPEG, 82, out)
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }

    private val sessions = MediaSessionManager.OnActiveSessionsChangedListener { pick(it) }
    private val cb = object : MediaController.Callback() {
        override fun onPlaybackStateChanged(s: PlaybackState?) = push()
        override fun onMetadataChanged(m: MediaMetadata?) = push()
    }
    private val tick = object : Runnable {
        override fun run() { if (running) { if (cur?.playbackState?.state == PlaybackState.STATE_PLAYING) push(); h.postDelayed(this, 1000) } }
    }

    fun start() {
        if (running) return
        running = true; refresh(); h.postDelayed(tick, 1000)
    }
    fun stop() {
        running = false; h.removeCallbacks(tick)
        try { msm.removeOnActiveSessionsChangedListener(sessions) } catch (e: Exception) { }
        cur?.unregisterCallback(cb); cur = null
    }

    fun refresh() {
        if (!NotifService.enabled(a)) return
        try {
            msm.removeOnActiveSessionsChangedListener(sessions)
            msm.addOnActiveSessionsChangedListener(sessions, NotifService.component(a))
            pick(msm.getActiveSessions(NotifService.component(a)))
        } catch (e: SecurityException) { }
    }

    private fun pick(list: List<MediaController>?) {
        val bt = btPkg()
        val c = list?.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING }
            ?: list?.firstOrNull { bt != null && it.packageName == bt }   // sinon : la session de l'appli Bluetooth du poste
            ?: list?.firstOrNull()
        if (c?.sessionToken != cur?.sessionToken) { cur?.unregisterCallback(cb); cur = c; c?.registerCallback(cb) }
        push()
    }

    private fun push() {
        val c = cur
        val o = JSONObject()
        if (c == null) {
            o.put("playing", false).put("title", "Aucune lecture").put("artist", "").put("pos", 0).put("dur", 0)
            if (coverSent != "") { o.put("cover", ""); coverSent = "" }
        } else {
            val m = c.metadata; val s = c.playbackState
            val playing = s?.state == PlaybackState.STATE_PLAYING
            var pos = s?.position ?: 0L
            if (playing && s != null) pos += ((SystemClock.elapsedRealtime() - s.lastPositionUpdateTime) * s.playbackSpeed).toLong()
            o.put("playing", playing)
                .put("title", m?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: "Lecture en cours")
                .put("artist", m?.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: "")
                .put("pos", pos / 1000.0).put("dur", (m?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L) / 1000.0)
            try {
                val title = m?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: ""
                val bmp = coverOf(m)
                val uri = m?.getString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI) ?: m?.getString(MediaMetadata.METADATA_KEY_ART_URI) ?: m?.getString(MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI)
                if (bmp != null) {
                    val key = title + "|" + bmp.generationId
                    if (key != coverSent) { o.put("cover", encode(bmp)); coverSent = key }
                } else if (uri != null) {
                    val key = title + "|" + uri
                    if (key != coverSent) {
                        coverSent = key; o.put("cover", "")
                        thread(isDaemon = true) {   // image distante ou fournie par l'appli : chargée hors du fil principal
                            val b = loadUri(uri)
                            val enc = if (b != null) encode(b) else ""
                            a.runOnUiThread { if ((cur?.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: "") == title) a.js("window.onMedia && window.onMedia(" + JSONObject().put("cover", enc) + ")") }
                        }
                    }
                } else if (coverSent != "") { o.put("cover", ""); coverSent = "" }
            } catch (e: Exception) { }
        }
        a.js("window.onMedia && window.onMedia($o)")
    }

    /** toggle / play / pause / next / prev / seek:<secondes> (shuffle et repeat : selon l'appli, ignorés ici) */
    fun command(cmd: String) {
        val c = cur
        val t = c?.transportControls
        val st0 = c?.playbackState?.state
        val title0 = c?.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE)
        fun stateChanged() = cur?.playbackState?.state != st0
        fun titleChanged() = cur?.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE) != title0
        // 1re méthode : commande directe à l'appli de musique ; 2e méthode (si rien n'a bougé après 0,7 s) : touche média du système, comme les boutons du volant
        fun both(code: Int, changed: () -> Boolean, direct: () -> Unit) {
            if (t == null) { note("$cmd : aucune session, touche média"); key(code); btKey(code); return }
            note("$cmd : commande directe à ${c?.packageName}")
            direct()
            h.postDelayed({
                if (changed()) { note("$cmd : OK (commande directe)"); return@postDelayed }
                note("$cmd : rien n'a bougé, touche média"); key(code)
                h.postDelayed({
                    if (changed()) note("$cmd : OK (touche média)")
                    else { note("$cmd : toujours rien, envoi à l'appli Bluetooth (${btPkg() ?: "introuvable"})"); btKey(code) }
                }, 700)
            }, 700)
        }
        when {
            cmd == "toggle" -> {
                val playing = st0 == PlaybackState.STATE_PLAYING
                both(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, { stateChanged() }) { if (playing) t?.pause() else t?.play() }
            }
            cmd == "play" -> both(KeyEvent.KEYCODE_MEDIA_PLAY, { cur?.playbackState?.state == PlaybackState.STATE_PLAYING }) { t?.play() }
            cmd == "pause" -> both(KeyEvent.KEYCODE_MEDIA_PAUSE, { cur?.playbackState?.state != PlaybackState.STATE_PLAYING }) { t?.pause() }
            cmd == "next" -> both(KeyEvent.KEYCODE_MEDIA_NEXT, { titleChanged() }) { t?.skipToNext() }
            cmd == "prev" || cmd == "previous" -> both(KeyEvent.KEYCODE_MEDIA_PREVIOUS, { titleChanged() }) { t?.skipToPrevious() }
            cmd.startsWith("seek:") -> cmd.substringAfter(':').toDoubleOrNull()?.let { t?.seekTo((it * 1000).toLong()) }
        }
    }

    /** Touche média envoyée directement à l'appli Bluetooth du poste (elle peut ignorer les touches envoyées au système). */
    private fun btKey(code: Int) {
        val p = btPkg() ?: return
        for (act in intArrayOf(KeyEvent.ACTION_DOWN, KeyEvent.ACTION_UP)) {
            val i = android.content.Intent(android.content.Intent.ACTION_MEDIA_BUTTON).setPackage(p)
                .putExtra(android.content.Intent.EXTRA_KEY_EVENT, KeyEvent(act, code))
            try { a.sendBroadcast(i) } catch (e: Exception) { }
        }
    }

    /** Texte de diagnostic : sessions musique vues par Android + dernières commandes. */
    fun info(): String {
        val sb = StringBuilder()
        sb.append("Accès aux notifications : ").append(if (NotifService.enabled(a)) "autorisé" else "NON autorisé").append('\n')
        try {
            val l = msm.getActiveSessions(NotifService.component(a))
            sb.append("Sessions musique : ").append(l.size).append('\n')
            for (c in l) {
                val s = c.playbackState
                sb.append("• ").append(c.packageName).append(" · état ").append(s?.state ?: "?")
                    .append(" · « ").append(c.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: "-").append(" »")
                    .append(if (c.sessionToken == cur?.sessionToken) "  ◀ utilisée" else "").append('\n')
            }
        } catch (e: Exception) { sb.append("Erreur : ").append(e.message).append('\n') }
        sb.append("Appli Bluetooth : ").append(btPkg() ?: "introuvable").append("\n\nDernières commandes :\n")
        synchronized(log) { if (log.isEmpty()) sb.append("(aucune : appuie sur un bouton de la musique, puis reviens ici)\n") else log.forEach { sb.append(it).append('\n') } }
        return sb.toString()
    }

    private fun key(code: Int) {
        val am = a.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code)); am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
    }
}
