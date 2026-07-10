package com.example.qqmusic

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.padding
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.qqmusic.data.MusicRepository
import com.example.qqmusic.feature.player.MiniPlayerBar
import com.example.qqmusic.feature.player.PlayerScreen
import com.example.qqmusic.feature.player.PlayerViewModel
import com.example.qqmusic.feature.search.SearchScreen
import com.example.qqmusic.feature.vip.VipLauncher
import kotlinx.coroutines.launch

private object Routes {
    const val Search = "search"
    const val Player = "player"
}

/**
 * 音乐 App 壳: 搜索/歌单 -> 播放队列 -> mini player -> 全屏播放器。
 * 播放地址由 /api/song/playable 返回;客户端不合成 filename、不绕过权限。
 */
class MainActivity : ComponentActivity() {
    private val repo = MusicRepository()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface {
                    val nav = rememberNavController()
                    val backStack by nav.currentBackStackEntryAsState()
                    val route = backStack?.destination?.route
                    val playerVm: PlayerViewModel = viewModel()
                    val playerState by playerVm.uiState.collectAsStateWithLifecycle()

                    Scaffold(
                        bottomBar = {
                            if (route != Routes.Player) {
                                MiniPlayerBar(
                                    state = playerState,
                                    onOpenPlayer = { nav.navigate(Routes.Player) },
                                    onTogglePlayPause = playerVm::togglePlayPause,
                                    onNext = playerVm::playNext,
                                )
                            }
                        },
                    ) { pad ->
                        NavHost(navController = nav, startDestination = Routes.Search) {
                            composable(Routes.Search) {
                                SearchScreen(
                                    modifier = Modifier.padding(pad),
                                    onSongClick = { song, queue -> playerVm.playSong(song, queue) },
                                    onOpenVip = {
                                        lifecycleScope.launch {
                                            val url = runCatching { repo.getVipEntry().url }
                                                .getOrDefault("https://y.qq.com/portal/vipportal/index.html")
                                            VipLauncher.openOfficialVip(this@MainActivity, url)
                                        }
                                    },
                                )
                            }
                            composable(Routes.Player) {
                                PlayerScreen(
                                    state = playerState,
                                    onBack = { nav.popBackStack() },
                                    onTogglePlayPause = playerVm::togglePlayPause,
                                    onSeek = playerVm::seekTo,
                                    onPrevious = playerVm::playPrevious,
                                    onNext = playerVm::playNext,
                                )
                            }
                        }
                        playerState.playbackError?.let { toast(it) }
                    }
                }
            }
        }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}
