package com.example.qqmusic

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.weight
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import com.example.qqmusic.core.model.Song
import com.example.qqmusic.data.MusicRepository
import com.example.qqmusic.feature.player.NowPlayingBar
import com.example.qqmusic.feature.player.PlayerController
import com.example.qqmusic.feature.search.SearchScreen
import com.example.qqmusic.feature.vip.VipLauncher
import kotlinx.coroutines.launch

/**
 * 最小 MVP 入口: 搜索/歌单 -> 点歌 -> 网关解析可播地址 -> Media3 播放 -> 显示歌词预览。
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
                    var nowPlaying by remember { mutableStateOf<Song?>(null) }
                    var quality by remember { mutableStateOf<String?>(null) }
                    var lyricPreview by remember { mutableStateOf("") }

                    Column(modifier = Modifier.fillMaxSize()) {
                        SearchScreen(
                            modifier = Modifier.weight(1f),
                            onSongClick = { song ->
                                lifecycleScope.launch {
                                    try {
                                        val res = repo.resolvePlayable(song.mid, song.id)
                                        if (res.url.isNotBlank()) {
                                            player.play(res.url)
                                            nowPlaying = song
                                            quality = res.quality
                                            lyricPreview = runCatching { repo.getLyric(song.mid, song.id) }
                                                .getOrDefault("")
                                                .lineSequence()
                                                .filter { it.isNotBlank() && !it.startsWith("[ti:") && !it.startsWith("[ar:") && !it.startsWith("[al:") }
                                                .take(3)
                                                .joinToString("\n")
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
                        NowPlayingBar(
                            song = nowPlaying,
                            quality = quality,
                            lyricPreview = lyricPreview,
                            onPause = { player.pause() },
                            onResume = { player.resume() },
                        )
                    }
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
