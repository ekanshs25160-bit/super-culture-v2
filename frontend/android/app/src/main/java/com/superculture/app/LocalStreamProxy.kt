package com.superculture.app

import android.content.Context
import android.util.Log
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.net.URLDecoder
import java.util.concurrent.Executors
import java.util.regex.Pattern

/**
 * Lightweight local HTTP loopback proxy listening on 127.0.0.1.
 * Bypasses Google CDN 403 blocks on WebView <audio> by:
 * 1. Probing bytes=0-1 with VISIONOS_USER_AGENT to extract total file size.
 * 2. Translating open-ended/large Range requests into sequential bounded 1 MiB chunks.
 * 3. Streaming 206 Partial Content back to the WebView with CORS & Accept-Ranges headers.
 */
object LocalStreamProxy {
    private const val TAG = "LocalStreamProxy"
    private const val CHUNK_SIZE = 1048576L // 1 MiB bounded chunk size
    const val DEFAULT_USER_AGENT =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15"

    @Volatile
    var port: Int = 0
        private set

    @Volatile
    private var isRunning = false
    private var serverSocket: ServerSocket? = null
    private val executor = Executors.newCachedThreadPool()
    private val totalLengthPattern = Pattern.compile("/(\\d+)\\s*$")

    @JvmStatic
    @JvmOverloads
    @Synchronized
    fun start(context: Context? = null): Int {
        if (isRunning && port > 0) return port
        try {
            // Bind to loopback interface on an ephemeral port
            val socket = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
            serverSocket = socket
            port = socket.localPort
            isRunning = true
            Log.i(TAG, "LocalStreamProxy started on 127.0.0.1:$port")

            executor.execute {
                while (isRunning && !socket.isClosed) {
                    try {
                        val client = socket.accept()
                        executor.execute { handleClient(client) }
                    } catch (e: Exception) {
                        if (isRunning) {
                            Log.w(TAG, "ServerSocket accept exception: ${e.message}")
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start LocalStreamProxy: ${e.message}", e)
        }
        return port
    }

    @JvmStatic
    fun stop() {
        isRunning = false
        try {
            serverSocket?.close()
        } catch (e: Exception) {
            Log.w(TAG, "Error closing server socket: ${e.message}")
        }
        serverSocket = null
        port = 0
        Log.i(TAG, "LocalStreamProxy stopped")
    }

    private fun handleClient(client: Socket) {
        try {
            client.soTimeout = 15000
            val reader = BufferedReader(InputStreamReader(client.getInputStream(), Charsets.ISO_8859_1))
            val requestLine = reader.readLine() ?: return
            val parts = requestLine.split(" ")
            if (parts.size < 2) return

            val method = parts[0].uppercase()
            val fullPath = parts[1]

            // Parse headers
            val headers = mutableMapOf<String, String>()
            var line: String? = reader.readLine()
            while (!line.isNullOrEmpty()) {
                val colon = line.indexOf(':')
                if (colon > 0) {
                    val key = line.substring(0, colon).trim().lowercase()
                    val value = line.substring(colon + 1).trim()
                    headers[key] = value
                }
                line = reader.readLine()
            }

            // Handle CORS preflight
            if (method == "OPTIONS") {
                val out = client.getOutputStream()
                val response = "HTTP/1.1 200 OK\r\n" +
                        "Access-Control-Allow-Origin: *\r\n" +
                        "Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n" +
                        "Access-Control-Allow-Headers: *\r\n" +
                        "Content-Length: 0\r\n\r\n"
                out.write(response.toByteArray(Charsets.ISO_8859_1))
                out.flush()
                return
            }

            if (!fullPath.startsWith("/stream")) {
                val out = client.getOutputStream()
                val response = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n"
                out.write(response.toByteArray(Charsets.ISO_8859_1))
                out.flush()
                return
            }

            // Extract query parameters
            val queryIdx = fullPath.indexOf('?')
            val queryString = if (queryIdx >= 0) fullPath.substring(queryIdx + 1) else ""
            var upstreamUrl: String? = null
            var userAgent = DEFAULT_USER_AGENT

            for (param in queryString.split("&")) {
                val kv = param.split("=", limit = 2)
                if (kv.size == 2) {
                    val k = URLDecoder.decode(kv[0], "UTF-8")
                    val v = URLDecoder.decode(kv[1], "UTF-8")
                    if (k == "url") upstreamUrl = v
                    if (k == "ua") userAgent = v
                }
            }

            if (upstreamUrl.isNullOrEmpty()) {
                val out = client.getOutputStream()
                val response = "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n"
                out.write(response.toByteArray(Charsets.ISO_8859_1))
                out.flush()
                return
            }

            serveChunkedStream(client, method, upstreamUrl, userAgent, headers["range"])
        } catch (e: Exception) {
            // Broken pipe or socket timeout is normal when seeking or pausing
            Log.d(TAG, "Client handle ended: ${e.message}")
        } finally {
            try {
                client.close()
            } catch (_: Exception) {}
        }
    }

    private fun serveChunkedStream(
        client: Socket,
        method: String,
        upstreamUrl: String,
        userAgent: String,
        clientRange: String?
    ) {
        val out = client.getOutputStream()

        // 1. Probe bytes=0-1 to get total length and MIME type
        val probeConn = URL(upstreamUrl).openConnection() as HttpURLConnection
        probeConn.requestMethod = "GET"
        probeConn.setRequestProperty("User-Agent", userAgent)
        probeConn.setRequestProperty("Range", "bytes=0-1")
        probeConn.connectTimeout = 8000
        probeConn.readTimeout = 8000
        probeConn.connect()

        val probeStatus = probeConn.responseCode
        if (probeStatus != 200 && probeStatus != 206) {
            Log.w(TAG, "Upstream probe failed with status $probeStatus")
            probeConn.disconnect()
            val response = "HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n"
            out.write(response.toByteArray(Charsets.ISO_8859_1))
            out.flush()
            return
        }

        val contentRangeHeader = probeConn.getHeaderField("Content-Range")
        val contentTypeHeader = probeConn.getHeaderField("Content-Type") ?: "audio/mp4"
        val total = parseTotal(contentRangeHeader) ?: probeConn.contentLengthLong

        try {
            probeConn.inputStream.close()
        } catch (_: Exception) {}
        probeConn.disconnect()

        if (total <= 0) {
            Log.w(TAG, "Unable to determine total stream length")
            val response = "HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n"
            out.write(response.toByteArray(Charsets.ISO_8859_1))
            out.flush()
            return
        }

        // 2. Parse client range
        val range = parseRange(clientRange)
        var start = 0L
        var reqEnd = total - 1

        if (range != null) {
            if (range.first == null && range.second != null) {
                start = maxOf(0L, total - range.second!!)
            } else if (range.first != null) {
                start = range.first!!
                if (range.second != null) {
                    reqEnd = minOf(range.second!!, total - 1)
                }
            }
        }

        if (start > total - 1) {
            val response = "HTTP/1.1 416 Range Not Satisfiable\r\n" +
                    "Content-Range: bytes */$total\r\n" +
                    "Content-Length: 0\r\n\r\n"
            out.write(response.toByteArray(Charsets.ISO_8859_1))
            out.flush()
            return
        }

        val finalEnd = reqEnd
        val contentLength = finalEnd - start + 1
        val isRange = clientRange != null && clientRange.startsWith("bytes=")
        val statusLine = if (isRange) "HTTP/1.1 206 Partial Content" else "HTTP/1.1 200 OK"

        val headerBuilder = StringBuilder()
        headerBuilder.append(statusLine).append("\r\n")
        headerBuilder.append("Content-Type: ").append(contentTypeHeader).append("\r\n")
        headerBuilder.append("Accept-Ranges: bytes\r\n")
        headerBuilder.append("Content-Length: ").append(contentLength).append("\r\n")
        if (isRange) {
            headerBuilder.append("Content-Range: bytes ")
                .append(start).append("-").append(finalEnd).append("/").append(total).append("\r\n")
        }
        headerBuilder.append("Access-Control-Allow-Origin: *\r\n")
        headerBuilder.append("Cache-Control: private, no-store\r\n")
        headerBuilder.append("Connection: keep-alive\r\n\r\n")

        out.write(headerBuilder.toString().toByteArray(Charsets.ISO_8859_1))
        out.flush()

        if (method == "HEAD") return

        // 3. Sequentially stream 1 MiB bounded chunks to the client socket
        var pos = start
        val buffer = ByteArray(16384)

        while (pos <= finalEnd) {
            val chunkEnd = minOf(pos + CHUNK_SIZE - 1, finalEnd)
            val chunkConn = URL(upstreamUrl).openConnection() as HttpURLConnection
            chunkConn.requestMethod = "GET"
            chunkConn.setRequestProperty("User-Agent", userAgent)
            chunkConn.setRequestProperty("Range", "bytes=$pos-$chunkEnd")
            chunkConn.connectTimeout = 8000
            chunkConn.readTimeout = 8000
            chunkConn.connect()

            val chunkStatus = chunkConn.responseCode
            if (chunkStatus != 200 && chunkStatus != 206) {
                Log.w(TAG, "Chunk fetch failed at bytes=$pos-$chunkEnd: HTTP $chunkStatus")
                chunkConn.disconnect()
                break
            }

            try {
                val input = chunkConn.inputStream
                var bytesRead = input.read(buffer)
                while (bytesRead != -1) {
                    out.write(buffer, 0, bytesRead)
                    bytesRead = input.read(buffer)
                }
                out.flush()
                input.close()
            } catch (e: Exception) {
                // Client cancelled or socket closed
                break
            } finally {
                chunkConn.disconnect()
            }

            pos = chunkEnd + 1
        }
    }

    private fun parseRange(header: String?): Pair<Long?, Long?>? {
        if (header.isNullOrEmpty() || !header.startsWith("bytes=")) return null
        val clean = header.substring(6).trim()
        val m = Pattern.compile("^(\\d*)-(\\d*)$").matcher(clean)
        if (!m.matches()) return null
        val s1 = m.group(1)
        val s2 = m.group(2)
        if (s1.isNullOrEmpty() && s2.isNullOrEmpty()) return null
        val start = if (s1.isNullOrEmpty()) null else s1.toLongOrNull()
        val end = if (s2.isNullOrEmpty()) null else s2.toLongOrNull()
        return Pair(start, end)
    }

    private fun parseTotal(contentRange: String?): Long? {
        if (contentRange.isNullOrEmpty()) return null
        val matcher = totalLengthPattern.matcher(contentRange)
        return if (matcher.find()) matcher.group(1)?.toLongOrNull() else null
    }
}
