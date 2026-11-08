package fr.evan.p208

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothProfile
import org.json.JSONObject

/**
 * Nom du téléphone connecté en Bluetooth à l'autoradio : envoyé au launcher (carte téléphone, source Bluetooth).
 * Un autoradio est un RÉCEPTEUR audio : on interroge donc aussi les profils « sink » (A2DP_SINK = 11, HEADSET_CLIENT = 16),
 * puis, à défaut, la liste des appareils appairés qui sont connectés.
 */
class PhoneBridge(private val a: MainActivity) {
    private val profiles = intArrayOf(BluetoothProfile.A2DP, BluetoothProfile.HEADSET, 11, 16)

    fun refresh() {
        try {
            val ad = BluetoothAdapter.getDefaultAdapter()
            if (ad == null || !ad.isEnabled) { send(null); return }
            var done = 0
            var name: String? = null
            fun finish() { done++; if (done == profiles.size) send(name ?: bondedConnected(ad)) }
            for (p in profiles) {
                val ok = try {
                    ad.getProfileProxy(a, object : BluetoothProfile.ServiceListener {
                        override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
                            try { if (name == null) name = proxy.connectedDevices.firstOrNull()?.name } catch (e: Exception) { }
                            try { ad.closeProfileProxy(profile, proxy) } catch (e: Exception) { }
                            finish()
                        }
                        override fun onServiceDisconnected(profile: Int) { }
                    }, p)
                } catch (e: Exception) { false }
                if (!ok) finish()
            }
        } catch (e: Exception) { }
    }

    /** Aucun profil connecté : on prend l'appareil appairé qui se dit connecté, sinon le téléphone appairé (CarPlay / ZLink passe hors du Bluetooth Android). */
    private fun bondedConnected(ad: BluetoothAdapter): String? = try {
        val list = ad.bondedDevices.toList()
        list.firstOrNull { d -> try { d.javaClass.getMethod("isConnected").invoke(d) as Boolean } catch (e: Exception) { false } }?.name
            ?: list.firstOrNull { d -> try { d.bluetoothClass?.majorDeviceClass == android.bluetooth.BluetoothClass.Device.Major.PHONE } catch (e: Exception) { false } }?.name
    } catch (e: Exception) { null }

    private fun send(name: String?) {
        val o = JSONObject()
        if (name == null) { o.put("phone", JSONObject.NULL); o.put("phoneName", JSONObject.NULL) }
        else {
            val ios = Regex("iphone|ipad|ios", RegexOption.IGNORE_CASE).containsMatchIn(name)
            o.put("phone", if (ios) "ios" else "android"); o.put("phoneName", name)
        }
        a.js("window.onCarState && window.onCarState(" + JSONObject.quote(o.toString()) + ")")
    }
}
