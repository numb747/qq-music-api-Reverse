package com.example.qqmusic.feature.player

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.Divider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.qqmusic.core.model.Song

@Composable
fun NowPlayingBar(
    song: Song?,
    quality: String?,
    lyricPreview: String,
    onPause: () -> Unit,
    onResume: () -> Unit,
) {
    if (song == null) return
    Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
        Divider()
        Text(
            text = "正在播放: ${song.name}" + (quality?.let { " · $it" } ?: ""),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 8.dp),
        )
        if (lyricPreview.isNotBlank()) {
            Text(
                text = lyricPreview,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Row(modifier = Modifier.padding(top = 8.dp)) {
            Button(onClick = onPause) { Text("暂停") }
            Spacer(modifier = Modifier.width(8.dp))
            Button(onClick = onResume) { Text("继续") }
        }
    }
}
