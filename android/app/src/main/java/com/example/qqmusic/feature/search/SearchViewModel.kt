package com.example.qqmusic.feature.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.qqmusic.core.model.Song
import com.example.qqmusic.data.MusicRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SearchUiState(
    val query: String = "",
    val loading: Boolean = false,
    val songs: List<Song> = emptyList(),
    val error: String? = null,
)

class SearchViewModel(
    private val repo: MusicRepository = MusicRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    fun onQueryChange(q: String) {
        _state.value = _state.value.copy(query = q)
    }

    fun search() {
        val q = _state.value.query.trim()
        if (q.isEmpty()) return
        _state.value = _state.value.copy(loading = true, error = null)
        viewModelScope.launch {
            try {
                val songs = repo.searchSongs(q)
                _state.value = _state.value.copy(loading = false, songs = songs)
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = e.message ?: "搜索失败")
            }
        }
    }

    fun loadPlaylist(disstid: Long = 2130981100L) {
        _state.value = _state.value.copy(loading = true, error = null)
        viewModelScope.launch {
            try {
                val songs = repo.getPlaylist(disstid)
                _state.value = _state.value.copy(loading = false, songs = songs, query = "歌单:$disstid")
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = e.message ?: "加载歌单失败")
            }
        }
    }
}
