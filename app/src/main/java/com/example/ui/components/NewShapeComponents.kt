package com.example.ui.components

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Recreates the New Shape serif stacked wordmark with the signature diagonal cut line across "shape"
 * matching the official brand guide PDF.
 */
@Composable
fun NewShapeLogo(
    modifier: Modifier = Modifier,
    compact: Boolean = false
) {
    val newSize: TextUnit = if (compact) 11.sp else 17.sp
    val shapeSize: TextUnit = if (compact) 21.sp else 34.sp
    val lineWidth: Dp = if (compact) 84.dp else 134.dp

    Box(modifier = modifier) {
        Column(horizontalAlignment = Alignment.Start) {
            Text(
                text = "new",
                fontFamily = PlayfairDisplayFamily,
                fontWeight = FontWeight.Bold,
                fontSize = newSize,
                lineHeight = newSize,
                color = NewShapeGoldBright,
                modifier = Modifier.padding(start = 2.dp)
            )
            Box(contentAlignment = Alignment.CenterStart) {
                Text(
                    text = "shape",
                    fontFamily = PlayfairDisplayFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = shapeSize,
                    lineHeight = shapeSize,
                    letterSpacing = (-0.8).sp,
                    color = NewShapeGold,
                    modifier = Modifier.offset(y = (-4).dp)
                )
                Canvas(
                    modifier = Modifier
                        .width(lineWidth)
                        .height(if (compact) 20.dp else 32.dp)
                ) {
                    drawLine(
                        color = ObsidianBg,
                        start = Offset(0f, size.height * 0.62f),
                        end = Offset(size.width, size.height * 0.42f),
                        strokeWidth = if (compact) 2.2.dp.toPx() else 3.2.dp.toPx(),
                        cap = StrokeCap.Round
                    )
                    drawLine(
                        color = NewShapeGoldBright,
                        start = Offset(0f, size.height * 0.64f),
                        end = Offset(size.width, size.height * 0.44f),
                        strokeWidth = if (compact) 1.dp.toPx() else 1.4.dp.toPx(),
                        cap = StrokeCap.Round
                    )
                }
            }
        }
    }
}

@Composable
fun StatusPill(
    text: String,
    textColor: Color,
    containerColor: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = containerColor,
        shape = RoundedCornerShape(999.dp),
        modifier = modifier
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = textColor,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}

@Composable
fun GoldPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    testTag: String? = null
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        colors = ButtonDefaults.buttonColors(
            containerColor = NewShapeGold,
            contentColor = TextOnGold,
            disabledContainerColor = ElevatedCharcoal,
            disabledContentColor = TextSecondaryDark
        ),
        shape = RoundedCornerShape(12.dp),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        modifier = (if (testTag != null) modifier.testTag(testTag) else modifier)
            .defaultMinSize(minHeight = 48.dp)
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text = text, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun DarkSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null
) {
    OutlinedButton(
        onClick = onClick,
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = ElevatedCharcoal,
            contentColor = TextPrimaryDark
        ),
        border = BorderStroke(1.dp, HairlineBorder),
        shape = RoundedCornerShape(12.dp),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
        modifier = modifier.defaultMinSize(minHeight = 48.dp)
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(17.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(text = text, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun BrandCard(
    modifier: Modifier = Modifier,
    highlightBorder: Boolean = false,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        color = CharcoalSurface,
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(
            width = if (highlightBorder) 1.5.dp else 1.dp,
            color = if (highlightBorder) NewShapeGold else HairlineBorder
        ),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp), content = content)
    }
}

@Composable
fun EmptyStateBox(
    icon: ImageVector,
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier
) {
    Surface(
        color = CharcoalSurface,
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, HairlineBorder),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(28.dp)
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(52.dp)
                    .background(NewShapeGoldMuted, RoundedCornerShape(16.dp))
            ) {
                Icon(icon, contentDescription = null, tint = NewShapeGold, modifier = Modifier.size(26.dp))
            }
            Spacer(Modifier.height(12.dp))
            Text(title, style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
            Spacer(Modifier.height(4.dp))
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
        }
    }
}

fun openWhatsApp(
    context: Context,
    phone9Digits: String?,
    message: String,
    useWeb: Boolean = false
) {
    val encoded = Uri.encode(message)
    val url = if (!phone9Digits.isNullOrBlank()) {
        val clean = phone9Digits.filter { it.isDigit() }.takeLast(9)
        if (useWeb) "https://web.whatsapp.com/send?phone=351$clean&text=$encoded"
        else "https://wa.me/351$clean?text=$encoded"
    } else {
        if (useWeb) "https://web.whatsapp.com/send?text=$encoded"
        else "https://wa.me/?text=$encoded"
    }
    try {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        context.startActivity(intent)
    } catch (_: Exception) {
        copyToClipboard(context, message, "WhatsApp não encontrado. Mensagem copiada!")
    }
}

fun copyToClipboard(context: Context, text: String, toastMessage: String = "Mensagem copiada!") {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText("New Shape", text))
    Toast.makeText(context, toastMessage, Toast.LENGTH_SHORT).show()
}

fun sharePlainText(context: Context, subject: String, text: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/csv"
        putExtra(Intent.EXTRA_SUBJECT, subject)
        putExtra(Intent.EXTRA_TEXT, text)
    }
    context.startActivity(Intent.createChooser(intent, subject))
}

fun formatShortDate(millis: Long): String {
    val fmt = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
    return fmt.format(Date(millis))
}

fun formatTimeAgo(millis: Long): String {
    val diffHours = ((System.currentTimeMillis() - millis) / 3_600_000L).coerceAtLeast(0)
    return when {
        diffHours < 1 -> "agora"
        diffHours < 24 -> "há ${diffHours} h"
        else -> "há ${diffHours / 24} d"
    }
}
