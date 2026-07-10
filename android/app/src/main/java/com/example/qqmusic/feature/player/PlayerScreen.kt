package com.example.qqmusic.feature.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerScreen(
    state: PlayerUiState,
    onBack: () -> Unit,
    onTogglePlayPause: () -> Unit,
    onSeek: (Long) -> Unit,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
) {
    val song = state.currentSong
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("正在播放") },
                navigationIcon = { IconButton(onClick = onBack) { Text("‹") } },
            )
        },
    ) { pad ->
        if (song == null) {
            Box(Modifier.fillMaxSize().padding(pad), contentAlignment = Alignment.Center) { Text("还没有播放歌曲") }
            return@Scaffold
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(pad).padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            item {
                Spacer(Modifier.height(24.dp))
                Card(
                    modifier = Modifier.size(260.dp),
                    shape = RoundedCornerShape(28.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                    elevation = CardDefaults.cardElevation(defaultElevation = 10.dp),
                ) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("♪", style = MaterialTheme.typography.displayLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    }
                }
                Spacer(Modifier.height(24.dp))
                Text(song.name, style = MaterialTheme.typography.headlineSmall, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
                Text(
                    song.singers.joinToString("/") { it.name } + " · " + song.album.name,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                )
                state.quality?.let { AssistChip(onClick = {}, label = { Text("音质 $it") }, modifier = Modifier.padding(top = 8.dp)) }
                Spacer(Modifier.height(20.dp))
                Slider(
                    value = state.positionMs.toFloat(),
                    onValueChange = { onSeek(it.toLong()) },
                    valueRange = 0f..(state.durationMs.takeIf { it > 0 } ?: 1L).toFloat(),
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(formatMs(state.positionMs), style = MaterialTheme.typography.bodySmall)
                    Text(formatMs(state.durationMs), style = MaterialTheme.typography.bodySmall)
                }
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Button(onClick = onPrevious) { Text("上一首") }
                    Button(onClick = onTogglePlayPause) { Text(if (state.isPlaying) "暂停" else "播放") }
                    Button(onClick = onNext) { Text("下一首") }
                }
                if (state.playbackError != null) {
                    Text(state.playbackError, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(bottom = 12.dp))
                }
                Text("歌词", style = MaterialTheme.typography.titleMedium, modifier = Modifier.fillMaxWidth())
                Text(
                    state.lyric.ifBlank { "暂无歌词" },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
                Spacer(Modifier.height(20.dp))
                if (state.queue.isNotEmpty()) {
                    Text("接下来播放", style = MaterialTheme.typography.titleMedium, modifier = Modifier.fillMaxWidth())
                }
            }
            val nextSongs = if (state.currentIndex >= 0) state.queue.drop(state.currentIndex + 1).take(5) else emptyList()
            items(nextSongs) { next ->
                Text(
                    "• ${next.name} - ${next.singers.joinToString("/") { it.name }}",
                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

private fun formatMs(ms: Long): String {
    val total = (ms / 1000).coerceAtLeast(0L)
    val m = total / 60
    val s = total % 60
    return "%d:%02d".format(m, s)
}
