package com.example.security

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Cross-platform salted PBKDF2-HMAC-SHA256 implementation (RFC 2898, 32-byte single block)
 * compatible with Web Crypto PBKDF2-SHA256 on API 24+.
 * Format: pbkdf2_sha256$<iterations>$<saltHex>$<hashHex>
 */
object StudentPinHasher {
    private const val PREFIX = "pbkdf2_sha256"
    private const val DEFAULT_ITERATIONS = 50_000
    private const val SALT_PREFIX = "newshape-pin:"
    private val PIN_REGEX = Regex("^\\d{4}$")
    private val HEX_SALT_REGEX = Regex("^[0-9a-fA-F]{16,64}$")
    private val HEX_HASH_REGEX = Regex("^[0-9a-fA-F]{64}$")

    fun isValidFourDigitPin(pin: String): Boolean = PIN_REGEX.matches(pin)

    suspend fun hashPin(pin: String): String = withContext(Dispatchers.Default) {
        require(isValidFourDigitPin(pin)) { "O PIN tem de ter exatamente 4 dígitos numéricos." }
        val saltBytes = ByteArray(16)
        SecureRandom().nextBytes(saltBytes)
        val saltHex = bytesToHex(saltBytes)
        val derived = pbkdf2HmacSha256(
            password = pin.toByteArray(Charsets.UTF_8),
            salt = "$SALT_PREFIX$saltHex".toByteArray(Charsets.UTF_8),
            iterations = DEFAULT_ITERATIONS
        )
        "$PREFIX\$$DEFAULT_ITERATIONS\$$saltHex\$${bytesToHex(derived)}"
    }

    suspend fun verifyPin(pin: String, storedHash: String): Boolean = withContext(Dispatchers.Default) {
        if (!isValidFourDigitPin(pin) || storedHash.isBlank()) return@withContext false
        val parts = storedHash.trim().split('$')
        if (parts.size != 4) return@withContext false
        val algo = parts[0]
        val iterations = parts[1].toIntOrNull() ?: return@withContext false
        val saltHex = parts[2]
        val expectedHex = parts[3]

        if (algo != PREFIX) return@withContext false
        if (iterations !in 1_000..200_000) return@withContext false
        if (!HEX_SALT_REGEX.matches(saltHex) || !HEX_HASH_REGEX.matches(expectedHex)) {
            return@withContext false
        }

        val derived = pbkdf2HmacSha256(
            password = pin.toByteArray(Charsets.UTF_8),
            salt = "$SALT_PREFIX${saltHex.lowercase()}".toByteArray(Charsets.UTF_8),
            iterations = iterations
        )
        val computedBytes = bytesToHex(derived).toByteArray(Charsets.US_ASCII)
        val expectedBytes = expectedHex.lowercase().toByteArray(Charsets.US_ASCII)
        MessageDigest.isEqual(computedBytes, expectedBytes)
    }

    private fun pbkdf2HmacSha256(
        password: ByteArray,
        salt: ByteArray,
        iterations: Int
    ): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(password, "HmacSHA256"))

        val saltWithBlock = ByteArray(salt.size + 4)
        System.arraycopy(salt, 0, saltWithBlock, 0, salt.size)
        saltWithBlock[salt.size] = 0
        saltWithBlock[salt.size + 1] = 0
        saltWithBlock[salt.size + 2] = 0
        saltWithBlock[salt.size + 3] = 1

        var u = mac.doFinal(saltWithBlock)
        val result = u.copyOf()
        for (i in 2..iterations) {
            u = mac.doFinal(u)
            for (j in result.indices) {
                result[j] = (result[j].toInt() xor u[j].toInt()).toByte()
            }
        }
        return result
    }

    private fun bytesToHex(bytes: ByteArray): String {
        val hexChars = "0123456789abcdef"
        val out = StringBuilder(bytes.size * 2)
        for (b in bytes) {
            val v = b.toInt() and 0xFF
            out.append(hexChars[v ushr 4])
            out.append(hexChars[v and 0x0F])
        }
        return out.toString()
    }
}
