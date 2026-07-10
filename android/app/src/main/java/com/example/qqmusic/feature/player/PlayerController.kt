package com.example.qqmusic.feature.player

import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer

/**
 * Media3 播放控制器骨架。
 * 只接收网关解析出的 sip + purl 播放地址,不做任何破解/绕过权限。
 */
class PlayerController(context: Context) {
    private val player: ExoPlayer = ExoPlayer.Builder(context).build()

    fun play(url: String) {
        if (url.isBlank()) return
        player.setMediaItem(MediaItem.fromUri(url))
        player.prepare()
        player.playWhenReady = true
    }

    fun pause() = player.pause()
    fun resume() { player.playWhenReady = true }
    fun release() = player.release()

    val isPlaying: Boolean get() = player.isPlaying
}
