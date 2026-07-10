package com.example.qqmusic

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.example.qqmusic.core.model.Song
import com.example.qqmusic.feature.search.SearchScreen
import com.example.qqmusic.feature.vip.VipLauncher

/**
 * 最小 MVP 入口: 搜索 -> 点歌(占位提示,后续接播放页/vkey 解析)。
 * 播放地址解析走本地网关 /api/playback/resolve,需要服务端返回的真实 filename。
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface {
                    var selected by remember { mutableStateOf<Song?>(null) }
                    SearchScreen(
                        onSongClick = { selected = it },
                        onOpenVip = {
                            // Demo: 直接用已知官方入口; 也可先调 repo.getVipEntry() 拿 url
                            VipLauncher.openOfficialVip(this, "https://y.qq.com/portal/vipportal/index.html")
                        },
                    )
                    selected?.let { Text("已选: ${it.name} (mid=${it.mid})") }
                }
            }
        }
    }
}
