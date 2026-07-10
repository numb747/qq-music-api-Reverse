package com.example.qqmusic.feature.search

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.qqmusic.core.model.Song

@Composable
fun SearchScreen(
    onSongClick: (Song) -> Unit,
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
            Button(onClick = vm::search) { Text("搜索") }
        }

        Row(
            modifier = Modifier.padding(top = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Button(onClick = { vm.loadPlaylist() }) { Text("加载示例歌单") }
            Button(onClick = onOpenVip) { Text("开通VIP(官方页面)") }
        }

        when {
            state.loading -> CircularProgressIndicator(modifier = Modifier.padding(24.dp))
            state.error != null -> Text("出错: ${state.error}", modifier = Modifier.padding(top = 16.dp))
            else -> LazyColumn(modifier = Modifier.padding(top = 8.dp)) {
                items(state.songs) { song ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSongClick(song) }
                            .padding(vertical = 10.dp),
                    ) {
                        Text(song.name, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(
                            song.singers.joinToString("/") { it.name } + " · " + song.album.name,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Divider()
                }
            }
        }
    }
}
