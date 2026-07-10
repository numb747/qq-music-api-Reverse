package com.example.qqmusic.feature.vip

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

/**
 * VIP/充值入口: 只用 Custom Tabs 打开官方 Midas/QQ音乐 H5 页面。
 * 不逆向下单参数,不自动确认支付。
 */
object VipLauncher {
    fun openOfficialVip(context: Context, url: String) {
        if (url.isBlank()) return
        CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url))
    }
}
