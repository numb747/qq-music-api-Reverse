package com.example.qqmusic.core.network

import com.example.qqmusic.BuildConfig
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * 本地协议网关客户端。
 * 网关端点见仓库 src/server/protocolServer.js。
 * 这里返回原始 JsonElement,由 Repository 负责映射领域模型,
 * 避免和 QQ 音乐 web 返回结构强耦合。
 */
class GatewayApi(
    private val baseUrl: String = BuildConfig.GATEWAY_BASE_URL,
    private val client: OkHttpClient = defaultClient(),
) {
    val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    suspend fun post(path: String, body: JsonObject): JsonElement = execute(
        Request.Builder().url(baseUrl + path)
            .post(body.toString().toRequestBody(jsonMedia))
            .build()
    )

    suspend fun get(path: String): JsonElement = execute(
        Request.Builder().url(baseUrl + path).get().build()
    )

    private fun execute(req: Request): JsonElement {
        client.newCall(req).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful && text.isEmpty()) {
                throw GatewayException("HTTP_${resp.code}", "网关请求失败: ${resp.code}")
            }
            val root = json.parseToJsonElement(text) as JsonObject
            val ok = (root["ok"]?.toString() == "true")
            if (!ok) {
                val err = root["error"]?.toString()?.trim('"') ?: "ERROR"
                val msg = root["message"]?.toString()?.trim('"') ?: "网关返回失败"
                throw GatewayException(err, msg)
            }
            return root["data"] ?: buildJsonObject { }
        }
    }

    companion object {
        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()

        fun searchBody(query: String, page: Int, pageSize: Int): JsonObject = buildJsonObject {
            put("query", query)
            put("page", page)
            put("pageSize", pageSize)
        }
    }
}

class GatewayException(val code: String, override val message: String) : Exception(message)
