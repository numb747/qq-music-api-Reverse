package com.example.qqmusic.data

import com.example.qqmusic.core.model.PlaybackResult
import com.example.qqmusic.core.model.Song
import com.example.qqmusic.core.model.VipEntry
import com.example.qqmusic.core.network.GatewayApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

/**
 * 音乐仓库: 对接本地协议网关。
 * 早期实现直接调网关;未来可替换为内嵌 CryptoEngine 的实现而不动 UI。
 */
class MusicRepository(private val api: GatewayApi = GatewayApi()) {

    suspend fun searchSongs(query: String, page: Int = 1, pageSize: Int = 20): List<Song> =
        withContext(Dispatchers.IO) {
            val data = api.post("/api/search/songs", GatewayApi.searchBody(query, page, pageSize))
            // data 结构: { code, data: { body: { song: { list: [...] } } } }
            val list = data.jsonObject["data"]?.jsonObject
                ?.get("body")?.jsonObject
                ?.get("song")?.jsonObject
                ?.get("list")?.jsonArray
                ?: return@withContext emptyList()
            list.map { api.json.decodeFromJsonElement(Song.serializer(), it) }
        }

    suspend fun resolvePlayback(
        songmid: String,
        filename: String,
        songtype: Int = 0,
    ): PlaybackResult = withContext(Dispatchers.IO) {
        val body: JsonObject = buildJsonObject {
            put("songmid", songmid)
            put("filename", filename)
            put("songtype", songtype)
        }
        val data = api.post("/api/playback/resolve", body)
        api.json.decodeFromJsonElement(PlaybackResult.serializer(), data)
    }

    /** 一步到位: 给 songmid + songId, 网关取 vs 拼 filename 并按音质降级返回可播地址 */
    suspend fun resolvePlayable(
        songmid: String,
        songId: Long,
    ): PlaybackResult = withContext(Dispatchers.IO) {
        val body: JsonObject = buildJsonObject {
            put("songmid", songmid)
            put("songId", songId)
        }
        val data = api.post("/api/song/playable", body)
        api.json.decodeFromJsonElement(PlaybackResult.serializer(), data)
    }

    suspend fun getLyric(songMID: String, songID: Long? = null): String =
        withContext(Dispatchers.IO) {
            val body: JsonObject = buildJsonObject {
                put("songMID", songMID)
                if (songID != null) put("songID", songID)
            }
            val data = api.post("/api/lyric", body)
            // data: { code, data: { lyric: "..." } }
            data.jsonObject["data"]?.jsonObject?.get("lyric")?.toString()?.trim('"') ?: ""
        }

    suspend fun getVipEntry(): VipEntry = withContext(Dispatchers.IO) {
        val data = api.get("/api/payment/vip-entry")
        api.json.decodeFromJsonElement(VipEntry.serializer(), data)
    }
}
