package com.superculture.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class MediaPlaybackSecurityAndWakeLockTest {

    @Test
    fun `verifies 10 minute bounded wake lock timeout constant`() {
        assertEquals(
            "WakeLock timeout must be exactly 10 minutes (600,000 ms)",
            10 * 60 * 1000L,
            MediaPlaybackService.WAKELOCK_TIMEOUT_MS
        )
    }

    @Test
    fun `verifies 5 minute pause release timeout constant`() {
        assertEquals(
            "Pause release timeout must be exactly 5 minutes (300,000 ms)",
            5 * 60 * 1000L,
            MediaPlaybackService.PAUSE_RELEASE_TIMEOUT_MS
        )
    }

    @Test
    fun `refreshWakeLock is safe to call without active service or context`() {
        // Must never throw even when called from non-Android background threads
        try {
            MediaPlaybackService.refreshWakeLock(null)
            assertTrue(true)
        } catch (e: Exception) {
            org.junit.Assert.fail("refreshWakeLock should be resilient and never throw: ${e.message}")
        }
    }

    @Test
    fun `verifies AndroidManifest disables cloud backup and full backup content`() {
        val manifestFile = File("src/main/AndroidManifest.xml")
        assertTrue("AndroidManifest.xml should exist", manifestFile.exists())
        val content = manifestFile.readText()

        assertTrue(
            "AndroidManifest.xml must set android:allowBackup=\"false\"",
            content.contains("android:allowBackup=\"false\"")
        )
        assertFalse(
            "AndroidManifest.xml must NOT set android:allowBackup=\"true\"",
            content.contains("android:allowBackup=\"true\"")
        )
        assertTrue(
            "AndroidManifest.xml must set android:fullBackupContent=\"false\"",
            content.contains("android:fullBackupContent=\"false\"")
        )
    }
}
