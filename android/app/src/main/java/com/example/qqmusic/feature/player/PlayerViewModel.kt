package com.example.qqmusic.feature.player

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.qqmusic.core.model.Song
import com.example.qqmusic.data.MusicRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

data class PlayerUiState(
    val queue: List<Song> = emptyList(),
    val currentIndex: Int = -1,
    val currentSong: Song? = null,
    val quality: String? = null,
    val lyric: String = "",
    val lyricPreview: String = "",
    val isResolving: Boolean = false,
    val isPlaying: Boolean = false,
    val durationMs: Long = 0L,
    val positionMs: Long = 0L,
    val bufferedPositionMs: Long = 0L,
    val playbackError: String? = null,
) {
    val hasSong: Boolean get() = currentSong != null
    val hasNext: Boolean get() = queue.isNotEmpty() && currentIndex >= 0
    val hasPrevious: Boolean get() = queue.isNotEmpty() && currentIndex >= 0
}

class PlayerViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = MusicRepository()
    private val controller = PlayerController(app.applicationContext)

    private val _uiState = MutableStateFlow(PlayerUiState())
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    private var playJob: Job? = null

    init {
        viewModelScope.launch {
            controller.state.collectLatest { ps ->
                _uiState.value = _uiState.value.copy(
                    isPlaying = ps.isPlaying,
                    durationMs = ps.durationMs,
                    positionMs = ps.positionMs,
                    bufferedPositionMs = ps.bufferedPositionMs,
                    playbackError = ps.errorMessage ?: _uiState.value.playbackError,
                )
            }
        }
    }

    fun playSong(song: Song, queue: List<Song> = emptyList()) {
        val finalQueue = queue.ifEmpty { listOf(song) }
        val index = finalQueue.indexOfFirst { it.id == song.id || (it.mid.isNotBlank() && it.mid == song.mid) }.let { if (it >= 0) it else 0 }
        setQueueAndPlay(finalQueue, index)
    }

    fun setQueue(songs: List<Song>, startIndex: Int = 0) {
        if (songs.isEmpty()) return
        setQueueAndPlay(songs, startIndex.coerceIn(songs.indices))
    }

    fun togglePlayPause() = controller.toggle()
    fun pause() = controller.pause()
    fun resume() = controller.resume()
    fun seekTo(positionMs: Long) = controller.seekTo(positionMs)

    fun playNext() {
        val s = _uiState.value
        if (s.queue.isEmpty()) return
        val next = if (s.currentIndex + 1 < s.queue.size) s.currentIndex + 1 else 0
        setQueueAndPlay(s.queue, next)
    }

    fun playPrevious() {
        val s = _uiState.value
        if (s.queue.isEmpty()) return
        if (s.positionMs > 3000) {
            controller.seekTo(0)
            return
        }
        val prev = if (s.currentIndex - 1 >= 0) s.currentIndex - 1 else s.queue.lastIndex
        setQueueAndPlay(s.queue, prev)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(playbackError = null)
    }

    private fun setQueueAndPlay(queue: List<Song>, index: Int) {
        val song = queue[index]
        playJob?.cancel()
        playJob = viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                queue = queue,
                currentIndex = index,
                currentSong = song,
                quality = null,
                lyric = "",
                lyricPreview = "",
                isResolving = true,
                playbackError = null,
            )
            try {
                val play = repo.resolvePlayable(song.mid, song.id)
                if (play.url.isBlank()) {
                    _uiState.value = _uiState.value.copy(
                        isResolving = false,
                        playbackError = "无可播地址: ${play.reason ?: "需更高权限"}",
                    )
                    return@launch
                }
                controller.play(play.url)
                val lyric = runCatching { repo.getLyric(song.mid, song.id) }.getOrDefault("")
                _uiState.value = _uiState.value.copy(
                    quality = play.quality,
                    lyric = cleanLyric(lyric),
                    lyricPreview = previewLyric(lyric),
                    isResolving = false,
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isResolving = false, playbackError = e.message ?: "播放失败")
            }
        }
    }

    private fun cleanLyric(raw: String): String = raw.lineSequence()
        .map { it.trim() }
        .filter { it.isNotBlank() }
        .filterNot { it.startsWith("[ti:") || it.startsWith("[ar:") || it.startsWith("[al:") || it.startsWith("[by:") || it.startsWith("[offset:") }
        .joinToString("\n")

    private fun previewLyric(raw: String): String = cleanLyric(raw)
        .lineSequence()
        .take(3)
        .joinToString("\n")

    override fun onCleared() {
        super.onCleared()
        controller.release()
    }
}
