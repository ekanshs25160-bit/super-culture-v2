package com.superculture.app

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.Socket
import java.net.URL
import java.net.URLEncoder

class LocalStreamProxySecurityTest {

    private var proxyPort = 0
    private var proxySecret = ""

    @Before
    fun setUp() {
        proxyPort = LocalStreamProxy.start(null)
        proxySecret = LocalStreamProxy.secret
        assertTrue("Proxy port should be > 0", proxyPort > 0)
        assertTrue("Proxy secret should not be empty", proxySecret.isNotEmpty())
    }

    @After
    fun tearDown() {
        LocalStreamProxy.stop()
    }

    @Test
    fun `rejects stream request when secret token is missing`() {
        val target = "https://rr1---sn-test.googlevideo.com/videoplayback?id=123"
        val requestUrl = "http://127.0.0.1:$proxyPort/stream?url=${URLEncoder.encode(target, "UTF-8")}"

        val conn = URL(requestUrl).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.instanceFollowRedirects = false

        assertEquals(403, conn.responseCode)
    }

    @Test
    fun `rejects stream request when secret token is wrong`() {
        val target = "https://rr1---sn-test.googlevideo.com/videoplayback?id=123"
        val requestUrl = "http://127.0.0.1:$proxyPort/stream?url=${URLEncoder.encode(target, "UTF-8")}&k=invalid-secret-token"

        val conn = URL(requestUrl).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.instanceFollowRedirects = false

        assertEquals(403, conn.responseCode)
    }

    @Test
    fun `rejects non-https upstream URL`() {
        val target = "http://rr1---sn-test.googlevideo.com/videoplayback?id=123"
        val requestUrl = "http://127.0.0.1:$proxyPort/stream?url=${URLEncoder.encode(target, "UTF-8")}&k=$proxySecret"

        val conn = URL(requestUrl).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.instanceFollowRedirects = false

        assertEquals(403, conn.responseCode)
    }

    @Test
    fun `rejects upstream URL with explicit non-443 port`() {
        val target = "https://rr1---sn-test.googlevideo.com:8443/videoplayback?id=123"
        val requestUrl = "http://127.0.0.1:$proxyPort/stream?url=${URLEncoder.encode(target, "UTF-8")}&k=$proxySecret"

        val conn = URL(requestUrl).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.instanceFollowRedirects = false

        assertEquals(403, conn.responseCode)
    }

    @Test
    fun `rejects upstream URL with userInfo`() {
        val target = "https://admin:pass@rr1---sn-test.googlevideo.com/videoplayback?id=123"
        val requestUrl = "http://127.0.0.1:$proxyPort/stream?url=${URLEncoder.encode(target, "UTF-8")}&k=$proxySecret"

        val conn = URL(requestUrl).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.instanceFollowRedirects = false

        assertEquals(403, conn.responseCode)
    }

    @Test
    fun `rejects upstream URL not ending in googlevideo dot com`() {
        val target = "https://malicious-domain.com/evil.mp4"
        val requestUrl = "http://127.0.0.1:$proxyPort/stream?url=${URLEncoder.encode(target, "UTF-8")}&k=$proxySecret"

        val conn = URL(requestUrl).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.instanceFollowRedirects = false

        assertEquals(403, conn.responseCode)
    }

    @Test
    fun `rejects SSRF attempt to internal or loopback IP`() {
        // Even if an attacker uses 127.0.0.1 or local hostname
        val target = "https://127.0.0.1/evil.mp4"
        val requestUrl = "http://127.0.0.1:$proxyPort/stream?url=${URLEncoder.encode(target, "UTF-8")}&k=$proxySecret"

        val conn = URL(requestUrl).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.instanceFollowRedirects = false

        assertEquals(403, conn.responseCode)
    }

    @Test
    fun `CORS preflight OPTIONS echoes Origin only for allowed localhost origins`() {
        // 1. Allowed origin: http://localhost
        val socket1 = Socket("127.0.0.1", proxyPort)
        val rawRequest1 = "OPTIONS /stream HTTP/1.1\r\nHost: 127.0.0.1\r\nOrigin: http://localhost\r\n\r\n"
        socket1.getOutputStream().write(rawRequest1.toByteArray(Charsets.ISO_8859_1))
        socket1.getOutputStream().flush()

        val reader1 = BufferedReader(InputStreamReader(socket1.getInputStream(), Charsets.ISO_8859_1))
        val statusLine1 = reader1.readLine()
        assertEquals("HTTP/1.1 200 OK", statusLine1)

        val headers1 = mutableMapOf<String, String>()
        var line1 = reader1.readLine()
        while (!line1.isNullOrEmpty()) {
            val idx = line1.indexOf(':')
            if (idx > 0) headers1[line1.substring(0, idx).trim().lowercase()] = line1.substring(idx + 1).trim()
            line1 = reader1.readLine()
        }
        assertEquals("http://localhost", headers1["access-control-allow-origin"])
        socket1.close()

        // 2. Disallowed origin: https://evil-site.com
        val socket2 = Socket("127.0.0.1", proxyPort)
        val rawRequest2 = "OPTIONS /stream HTTP/1.1\r\nHost: 127.0.0.1\r\nOrigin: https://evil-site.com\r\n\r\n"
        socket2.getOutputStream().write(rawRequest2.toByteArray(Charsets.ISO_8859_1))
        socket2.getOutputStream().flush()

        val reader2 = BufferedReader(InputStreamReader(socket2.getInputStream(), Charsets.ISO_8859_1))
        val statusLine2 = reader2.readLine()
        assertEquals("HTTP/1.1 200 OK", statusLine2)

        val headers2 = mutableMapOf<String, String>()
        var line2 = reader2.readLine()
        while (!line2.isNullOrEmpty()) {
            val idx = line2.indexOf(':')
            if (idx > 0) headers2[line2.substring(0, idx).trim().lowercase()] = line2.substring(idx + 1).trim()
            line2 = reader2.readLine()
        }
        assertFalse("Should NOT have wildcard Access-Control-Allow-Origin: *", headers2["access-control-allow-origin"] == "*")
        assertFalse("Should NOT allow untrusted external origin", headers2.containsKey("access-control-allow-origin"))
        socket2.close()
    }
}
