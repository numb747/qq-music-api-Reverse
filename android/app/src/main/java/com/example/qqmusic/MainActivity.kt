package com.example.qqmusic

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.rememberCoroutineScope
import androidx.lifecycle.lifecycleScope
import com.example.qqmusic.data.MusicRepository
import com.example.qqmusic.feature.player.PlayerController
import com.example.qqmusic.feature.search.SearchScreen
import com.example.qqmusic.feature.vip.VipLauncher
import kotlinx.coroutines.launch

/**
 * 最小 MVP 入口: 搜索 -> 点歌 -> 网关解析可播地址 -> Media3 播放。
 * 播放地址由 /api/song/playable 返回(网关取 vs 拼 filename 并按音质降级);
 * 客户端不合成 filename、不绕过权限。
 */
class MainActivity : ComponentActivity() {
    private val repo = MusicRepository()
    private lateinit var player: PlayerController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        player = PlayerController(this)
        setContent {
            MaterialTheme {
                Surface {
                    SearchScreen(
                        onSongClick = { song ->
                            lifecycleScope.launch {
                                try {
                                    val res = repo.resolvePlayable(song.mid, song.id)
                                    if (res.url.isNotBlank()) {
                                        player.play(res.url)
                                        toast("播放: ${song.name} (${res.quality})")
                                    } else {
                                        toast("无可播地址: ${res.reason ?: "需更高权限"}")
                                    }
                                } catch (e: Exception) {
                                    toast("解析失败: ${e.message}")
                                }
                            }
                        },
                        onOpenVip = {
                            lifecycleScope.launch {
                                val url = runCatching { repo.getVipEntry().url }
                                    .getOrDefault("https://y.qq.com/portal/vipportal/index.html")
                                VipLauncher.openOfficialVip(this@MainActivity, url)
                            }
                        },
                    )
                }
            }
        }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    override fun onDestroy() {
        super.onDestroy()
        player.release()
    }
}
