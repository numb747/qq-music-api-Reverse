package com.example.qqmusic.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** 网关统一响应包装: { ok, data } 或 { ok:false, error, message } */
@Serializable
data class GatewayEnvelope<T>(
    val ok: Boolean,
    val data: T? = null,
    val error: String? = null,
    val message: String? = null,
)

/** 领域层歌曲模型(从搜索结果裁剪) */
@Serializable
data class Song(
    val id: Long = 0,
    val mid: String = "",
    val name: String = "",
    @SerialName("singer") val singers: List<Singer> = emptyList(),
    val album: Album = Album(),
    val interval: Int = 0, // 秒
)

@Serializable
data class Singer(val id: Long = 0, val mid: String = "", val name: String = "")

@Serializable
data class Album(val id: Long = 0, val mid: String = "", val name: String = "")

/** 播放地址解析结果(对应 src/domain/playback.js 的返回) */
@Serializable
data class PlaybackResult(
    val code: Int = 0,
    val sip: List<String> = emptyList(),
    val purl: String = "",
    val url: String = "",
    val quality: String? = null,
    val filename: String? = null,
    val reason: String? = null,
)

/** VIP 官方入口(对应 src/domain/payment.js) */
@Serializable
data class VipEntry(
    val type: String = "",
    val provider: String = "",
    val url: String = "",
    val note: String = "",
)
