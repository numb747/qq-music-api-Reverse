package com.example.qqmusic.feature.player

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Media3 播放状态(供 Compose 渲染) */
data class PlaybackState(
    val isPlaying: Boolean = false,
    val durationMs: Long = 0L,
    val positionMs: Long = 0L,
    val bufferedPositionMs: Long = 0L,
    val errorMessage: String? = null,
)

/**
 * Media3 播放控制器。
 * 只接收网关解析出的 sip + purl 播放地址,不做任何破解/绕过权限。
 */
class PlayerController(context: Context) {
    private val player: ExoPlayer = ExoPlayer.Builder(context).build()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var progressJob: Job? = null

    private val _state = MutableStateFlow(PlaybackState())
    val state: StateFlow<PlaybackState> = _state.asStateFlow()

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            publishState(isPlaying = isPlaying)
            if (isPlaying) startProgressTicker() else stopProgressTicker()
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            publishState(isPlaying = player.isPlaying)
            if (playbackState == Player.STATE_ENDED) stopProgressTicker()
        }

        override fun onPlayerError(error: PlaybackException) {
            _state.value = _state.value.copy(errorMessage = error.message ?: "播放错误")
        }
    }

    init {
        player.addListener(listener)
    }

    fun play(url: String) {
        if (url.isBlank()) return
        _state.value = _state.value.copy(errorMessage = null)
        player.setMediaItem(MediaItem.fromUri(url))
        player.prepare()
        player.playWhenReady = true
        publishState(isPlaying = true)
        startProgressTicker()
    }

    fun pause() = player.pause()

    fun resume() {
        player.playWhenReady = true
        startProgressTicker()
    }

    fun toggle() {
        if (player.isPlaying) pause() else resume()
    }

    fun seekTo(positionMs: Long) {
        player.seekTo(positionMs.coerceAtLeast(0L))
        publishState(isPlaying = player.isPlaying)
    }

    fun release() {
        stopProgressTicker()
        player.removeListener(listener)
        player.release()
    }

    private fun startProgressTicker() {
        if (progressJob?.isActive == true) return
        progressJob = scope.launch {
            while (true) {
                publishState(isPlaying = player.isPlaying)
                delay(500)
            }
        }
    }

    private fun stopProgressTicker() {
        progressJob?.cancel()
        progressJob = null
        publishState(isPlaying = player.isPlaying)
    }

    private fun publishState(isPlaying: Boolean) {
        val duration = if (player.duration == C.TIME_UNSET) 0L else player.duration.coerceAtLeast(0L)
        val position = if (player.currentPosition == C.TIME_UNSET) 0L else player.currentPosition.coerceAtLeast(0L)
        val buffered = if (player.bufferedPosition == C.TIME_UNSET) 0L else player.bufferedPosition.coerceAtLeast(0L)
        _state.value = _state.value.copy(
            isPlaying = isPlaying,
            durationMs = duration,
            positionMs = position,
            bufferedPositionMs = buffered,
        )
    }
}
