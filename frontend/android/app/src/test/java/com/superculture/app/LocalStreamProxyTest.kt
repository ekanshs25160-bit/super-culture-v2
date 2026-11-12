package com.superculture.app

import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.net.URLEncoder
import java.util.Collections
import java.util.Random
import kotlin.concurrent.thread

class LocalStreamProxyTest {

    private val payload = ByteArray(2_621_440).also { Random(42).nextBytes(it) } // 2.5 MiB
    private val upstreamRanges = Collections.synchronizedList(mutableListOf<Pair<Long, Long>>())
    private lateinit var upstream: ServerSocket
    private var upstreamPort = 0
    private var proxyPort = 0
    private var secret = ""

    @Before
    fun setUp() {
        // Minimal Range-aware HTTP/1.1 mock built on ServerSocket (java.base only).
        upstream = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        upstreamPort = upstream.localPort
        thread(isDaemon = true) {
            while (!upstream.isClosed) {
                val sock = try { upstream.accept() } catch (_: Exception) { break }
                thread(isDaemon = true) { serve(sock) }
            }
        }

        proxyPort = LocalStreamProxy.start(null)
        secret = LocalStreamProxy.secret
        assertTrue(proxyPort > 0)
        LocalStreamProxy.testUpstreamAllowance = { uri ->
            uri.scheme == "http" && uri.host == "127.0.0.1" && uri.port == upstreamPort
        }
    }

    private fun serve(sock: Socket) {
        sock.use {
            val reader = BufferedReader(InputStreamReader(it.getInputStream(), Charsets.ISO_8859_1))
            reader.readLine() ?: return
            var rangeHeader: String? = null
            while (true) {
                val line = reader.readLine() ?: break
                if (line.isEmpty()) break
                if (line.startsWith("Range:", ignoreCase = true)) rangeHeader = line.substring(6).trim()
            }
            val total = payload.size.toLong()
            val m = rangeHeader?.let { r -> Regex("bytes=(\\d+)-(\\d*)").matchEntire(r) }
            val out = it.getOutputStream()
            if (m == null) {
                out.write("HTTP/1.1 200 OK\r\nContent-Type: audio/mp4\r\nContent-Length: $total\r\nConnection: close\r\n\r\n".toByteArray())
                out.write(payload)
            } else {
                val start = m.groupValues[1].toLong()
                val end = m.groupValues[2].ifEmpty { null }?.toLong()?.coerceAtMost(total - 1) ?: (total - 1)
                upstreamRanges.add(start to end)
                val len = (end - start + 1).toInt()
                out.write(
                    ("HTTP/1.1 206 Partial Content\r\nContent-Type: audio/mp4\r\n" +
                        "Content-Range: bytes $start-$end/$total\r\nContent-Length: $len\r\nConnection: close\r\n\r\n").toByteArray()
                )
                out.write(payload, start.toInt(), len)
            }
            out.flush()
        }
    }

    @After
    fun tearDown() {
        LocalStreamProxy.testUpstreamAllowance = null
        LocalStreamProxy.stop()
        upstream.close()
    }

    private fun open(target: String, key: String? = secret, range: String? = null): HttpURLConnection {
        val enc = URLEncoder.encode(target, "UTF-8")
        val k = if (key != null) "&k=${URLEncoder.encode(key, "UTF-8")}" else ""
        val conn = URL("http://127.0.0.1:$proxyPort/stream?url=$enc$k").openConnection() as HttpURLConnection
        conn.instanceFollowRedirects = false
        conn.connectTimeout = 5000
        conn.readTimeout = 15000
        if (range != null) conn.setRequestProperty("Range", range)
        return conn
    }

    private fun mediaUrl() = "http://127.0.0.1:$upstreamPort/media"

    @Test
    fun `rejects missing or wrong secret token with 403`() {
        assertEquals(403, open(mediaUrl(), key = null).responseCode)
        assertEquals(403, open(mediaUrl(), key = "wrong-secret").responseCode)
    }

    @Test
    fun `rejects non-https and non-googlevideo upstream URLs with 403`() {
        LocalStreamProxy.testUpstreamAllowance = null // exercise the real production allowlist
        assertEquals(403, open("http://192.168.1.1/admin").responseCode)
        assertEquals(403, open("https://evil.com/video.mp4").responseCode)
        assertEquals(403, open("http://rr1---sn-x.googlevideo.com/videoplayback").responseCode)
    }

    @Test
    fun `open-ended range across multiple chunks is byte-exact and fetched in bounded 1 MiB chunks`() {
        val conn = open(mediaUrl(), range = "bytes=0-")
        assertEquals(206, conn.responseCode)
        assertEquals(payload.size.toLong(), conn.getHeaderField("Content-Length").toLong())
        assertEquals("bytes 0-${payload.size - 1}/${payload.size}", conn.getHeaderField("Content-Range"))
        val body = conn.inputStream.readBytes()
        assertArrayEquals(payload, body)

        // Probe (bytes=0-1) plus 3 bounded chunk requests (1 MiB, 1 MiB, 0.5 MiB)
        val chunks = upstreamRanges.filter { it.second - it.first + 1 > 2 }
        assertEquals(3, chunks.size)
        assertTrue(chunks.all { it.second - it.first + 1 <= 1_048_576L })
    }

    @Test
    fun `mid-stream seek returns exact slice and Content-Range`() {
        val conn = open(mediaUrl(), range = "bytes=1500000-2000000")
        assertEquals(206, conn.responseCode)
        assertEquals("bytes 1500000-2000000/${payload.size}", conn.getHeaderField("Content-Range"))
        assertEquals(500_001L, conn.getHeaderField("Content-Length").toLong())
        assertNotNull(conn.getHeaderField("Content-Type"))
        assertArrayEquals(payload.copyOfRange(1_500_000, 2_000_001), conn.inputStream.readBytes())
    }

    @Test
    fun `out-of-bounds range returns 416`() {
        val conn = open(mediaUrl(), range = "bytes=9999999-")
        assertEquals(416, conn.responseCode)
    }
}
