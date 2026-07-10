package com.example.qqmusic.feature.search

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.qqmusic.core.model.Song

@Composable
fun SearchScreen(
    onSongClick: (Song, List<Song>) -> Unit,
    onOpenVip: () -> Unit,
    modifier: Modifier = Modifier,
    vm: SearchViewModel = viewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()

    Column(modifier = modifier.fillMaxWidth().padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedTextField(
                value = state.query,
                onValueChange = vm::onQueryChange,
                label = { Text("搜索歌曲") },
                modifier = Modifier.weight(1f),
                singleLine = true,
            )
            Button(enabled = !state.loading, onClick = vm::search) { Text("搜索") }
        }

        Row(
            modifier = Modifier.padding(top = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Button(enabled = !state.loading, onClick = { vm.loadPlaylist() }) { Text("加载示例歌单") }
            Button(onClick = onOpenVip) { Text("开通VIP") }
        }

        when {
            state.loading -> Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            state.error != null -> Text("出错: ${state.error}", modifier = Modifier.padding(top = 16.dp), color = MaterialTheme.colorScheme.error)
            state.songs.isEmpty() -> Text("搜索或加载歌单后,歌曲会显示在这里。", modifier = Modifier.padding(top = 24.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
            else -> LazyColumn(modifier = Modifier.padding(top = 12.dp)) {
                itemsIndexed(state.songs) { index, song ->
                    SongRow(index = index + 1, song = song, onClick = { onSongClick(song, state.songs) })
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun SongRow(index: Int, song: Song, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Surface(
            modifier = Modifier.size(42.dp),
            shape = RoundedCornerShape(10.dp),
            color = MaterialTheme.colorScheme.secondaryContainer,
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(index.toString(), color = MaterialTheme.colorScheme.onSecondaryContainer)
            }
        }
        Column(modifier = Modifier.padding(start = 12.dp).weight(1f)) {
            Text(song.name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleMedium)
            Text(
                song.singers.joinToString("/") { it.name } + " · " + song.album.name,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (song.interval > 0) {
            Text(formatDuration(song.interval), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private fun formatDuration(seconds: Int): String {
    val m = seconds / 60
    val s = seconds % 60
    return "%d:%02d".format(m, s)
}
