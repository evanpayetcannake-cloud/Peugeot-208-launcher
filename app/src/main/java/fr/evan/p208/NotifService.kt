package fr.evan.p208

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class NotifService : NotificationListenerService() {
    override fun onListenerConnected() { instance = this; Hub.pushNotifications(); try { Hub.activity?.media?.refresh() } catch (e: Exception) { } }
    override fun onListenerDisconnected() { if (instance === this) instance = null }
    override fun onNotificationPosted(sbn: StatusBarNotification?) = Hub.pushNotifications()
    override fun onNotificationRemoved(sbn: StatusBarNotification?) = Hub.pushNotifications()

    companion object {
        @Volatile var instance: NotifService? = null
        fun component(c: Context) = ComponentName(c, NotifService::class.java)
        fun enabled(c: Context): Boolean {
            val s = Settings.Secure.getString(c.contentResolver, "enabled_notification_listeners") ?: return false
            return s.contains(c.packageName)
        }
    }
}
