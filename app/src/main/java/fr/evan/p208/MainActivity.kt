package fr.evan.p208

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader

/** Écran d'accueil du poste : un WebView plein écran qui affiche le launcher (dossier assets). */
class MainActivity : Activity() {

    lateinit var web: WebView
    private var fileCb: ValueCallback<Array<Uri>>? = null
    lateinit var media: MediaBridge
    lateinit var phone: PhoneBridge
    private val errs = mutableListOf<String>()
    private var diag: android.widget.TextView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        Hub.activity = this

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()

        web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = false
                allowContentAccess = false
                cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
                textZoom = 100
                setSupportZoom(false)
            }
            webViewClient = object : WebViewClient() {
                override fun onReceivedError(v: WebView, r: WebResourceRequest, e: android.webkit.WebResourceError) {
                    if (r.url.path?.endsWith("favicon.ico") != true) errs.add("Chargement : ${r.url.path} (${e.errorCode} ${e.description})")
                }
                override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest): WebResourceResponse? =
                    loader.shouldInterceptRequest(r.url)
                override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest) = true   // jamais de navigation externe
            }
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(m: android.webkit.ConsoleMessage): Boolean {
                    if (m.messageLevel() == android.webkit.ConsoleMessage.MessageLevel.ERROR)
                        errs.add("JS : ${m.message()} (${m.sourceId().substringAfterLast('/')}:${m.lineNumber()})")
                    return true
                }
                override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                    fileCb?.onReceiveValue(null); fileCb = cb
                    // Sélecteur système Android (Documents/Téléchargements) d'abord ; sinon le sélecteur par défaut
                    val types = p.acceptTypes.filter { it.isNotBlank() }.ifEmpty { listOf("*/*") }
                    val doc = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE); type = if (types.size == 1) types[0] else "*/*"
                        if (types.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, types.toTypedArray())
                    }
                    return try {
                        startActivityForResult(doc, REQ_FILE); true
                    } catch (e: Exception) {
                        try { startActivityForResult(p.createIntent(), REQ_FILE); true }
                        catch (e2: Exception) { fileCb = null; false }
                    }
                }
            }
            addJavascriptInterface(Bridge(this@MainActivity), "Android")
        }
        setContentView(web)
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html")

        // Diagnostic : si l'écran reste noir ou s'il y a une erreur, on l'affiche au lieu du noir
        diag = android.widget.TextView(this).apply {
            setTextColor(Color.WHITE); setBackgroundColor(0xEE000000.toInt()); textSize = 18f; setPadding(40, 40, 40, 40)
            visibility = View.GONE; setOnClickListener { visibility = View.GONE }
        }
        addContentView(diag, android.view.ViewGroup.LayoutParams(-1, -1))
        web.postDelayed({ checkDiag(1) }, 4000)   // au démarrage de la voiture le poste est lent : on laisse du temps avant d'alerter

        media = MediaBridge(this)
        phone = PhoneBridge(this)
        registerReceivers()
        askNotificationAccessOnce()
    }

    // --- données voiture envoyées par une autre appli (boîtier CAN, Tasker…) ---
    // adb shell am broadcast -a fr.evan.p208.CAR_STATE --es json '{"speed":50,"rpm":2100}'
    private val carRx = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            when (i.action) {
                "fr.evan.p208.CAR_STATE" -> i.getStringExtra("json")?.let { js("window.onCarState && window.onCarState(${org.json.JSONObject.quote(it)})") }
                "fr.evan.p208.CAR_RAW" -> {
                    val n = i.getStringExtra("name") ?: return
                    val v = i.extras?.get("value")
                    js("window.onRawEvent && window.onRawEvent(${org.json.JSONObject.quote(n)}, ${if (v is Number || v is Boolean) v.toString() else org.json.JSONObject.quote(v?.toString() ?: "")})")
                }
                "android.bluetooth.device.action.ACL_CONNECTED", "android.bluetooth.device.action.ACL_DISCONNECTED" -> web.postDelayed({ phone.refresh() }, 2000)
                Intent.ACTION_PACKAGE_ADDED, Intent.ACTION_PACKAGE_REMOVED, Intent.ACTION_PACKAGE_REPLACED -> Apps.push(this@MainActivity)
            }
        }
    }

    private fun registerReceivers() {
        val f = IntentFilter().apply { addAction("fr.evan.p208.CAR_STATE"); addAction("fr.evan.p208.CAR_RAW")
            addAction("android.bluetooth.device.action.ACL_CONNECTED"); addAction("android.bluetooth.device.action.ACL_DISCONNECTED") }
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(carRx, f, Context.RECEIVER_EXPORTED) else registerReceiver(carRx, f)
        val p = IntentFilter().apply {
            addAction(Intent.ACTION_PACKAGE_ADDED); addAction(Intent.ACTION_PACKAGE_REMOVED); addAction(Intent.ACTION_PACKAGE_REPLACED)
            addDataScheme("package")
        }
        registerReceiver(carRx, p)
    }

    private fun askNotificationAccessOnce() {
        val sp = getSharedPreferences("p208", MODE_PRIVATE)
        if (NotifService.enabled(this) || sp.getBoolean("askedNotif", false)) return
        sp.edit().putBoolean("askedNotif", true).apply()
        Toast.makeText(this, "Autorise « Peugeot 208 – notifications » pour afficher la musique et les notifications", Toast.LENGTH_LONG).show()
        try { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) } catch (e: Exception) { }
    }

    /** Surveille le chargement : le diagnostic ne s'affiche que si la page n'est toujours pas prête après ~30 s, et disparaît dès qu'elle l'est. */
    private fun checkDiag(n: Int) {
        if (!::web.isInitialized) return
        web.evaluateJavascript("(document.body?document.body.innerText.length:0)+'|'+!!window.M6") { r ->
            val ok = r?.contains("true") == true
            if (ok) { diag?.visibility = View.GONE; return@evaluateJavascript }   // page prête : plus rien à afficher
            if (n >= 10) {
                val wv = try { android.webkit.WebView.getCurrentWebViewPackage()?.versionName } catch (e: Exception) { null }
                diag?.text = "DIAGNOSTIC (touche pour fermer)\n\nAndroid ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})\nWebView : ${wv ?: "inconnu"}\nPage prête : ${if (ok) "oui" else "NON"}\n\n" +
                    (if (errs.isEmpty()) "Aucune erreur remontée." else errs.take(8).joinToString("\n\n"))
                diag?.visibility = View.VISIBLE
            }
            if (n < 30) web.postDelayed({ checkDiag(n + 1) }, 3000)
        }
    }

    fun js(code: String) { runOnUiThread { if (::web.isInitialized) web.evaluateJavascript(code, null) } }

    override fun onNewIntent(intent: Intent) {   // bouton HOME : retour à l'accueil du launcher
        super.onNewIntent(intent)
        js("window.M6 && window.M6.go && window.M6.go('home')")
    }

    override fun onResume() {
        super.onResume(); web.onResume(); media.start(); Hub.pushNotifications(); web.postDelayed({ phone.refresh() }, 2500)
    }
    override fun onPause() { media.stop(); web.onPause(); super.onPause() }
    override fun onDestroy() {
        try { unregisterReceiver(carRx) } catch (e: Exception) { }
        if (Hub.activity === this) Hub.activity = null
        web.destroy(); super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { /* un launcher ne se ferme pas */ }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(req: Int, res: Int, data: Intent?) {
        if (req == REQ_FILE) {
            fileCb?.onReceiveValue(android.webkit.WebChromeClient.FileChooserParams.parseResult(res, data)); fileCb = null
        } else super.onActivityResult(req, res, data)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) @Suppress("DEPRECATION") window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
    }

    companion object { const val REQ_FILE = 41 }
}
