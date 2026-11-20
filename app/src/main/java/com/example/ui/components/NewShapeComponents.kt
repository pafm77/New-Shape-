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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.ceil
import kotlin.math.max

/**
 * Recreates the official New Shape stacked serif wordmark ("new" over "shape")
 * where "shape" is sliced by a tilted gold line — solid gold above the cut and outlined gold below.
 */
@Composable
fun NewShapeLogo(
    modifier: Modifier = Modifier,
    compact: Boolean = false
) {
    val textMeasurer = rememberTextMeasurer()
    val density = LocalDensity.current

    val newSize: TextUnit = if (compact) 11.sp else 17.sp
    val shapeSize: TextUnit = if (compact) 23.sp else 38.sp

    val newStyle = remember(newSize) {
        TextStyle(
            fontFamily = PlayfairDisplayFamily,
            fontWeight = FontWeight.Bold,
            fontSize = newSize,
            letterSpacing = (-0.2).sp
        )
    }
    val shapeStyle = remember(shapeSize) {
        TextStyle(
            fontFamily = PlayfairDisplayFamily,
            fontWeight = FontWeight.Bold,
            fontSize = shapeSize,
            letterSpacing = (-1.1).sp
        )
    }

    val newLayout = remember(textMeasurer, newStyle) {
        textMeasurer.measure(text = "new", style = newStyle)
    }
    val shapeLayout = remember(textMeasurer, shapeStyle) {
        textMeasurer.measure(text = "shape", style = shapeStyle)
    }

    val (widthDp, heightDp, shapeTopPx) = remember(newLayout, shapeLayout, compact, density) {
        with(density) {
            val gapPx = if (compact) 1.5.dp.toPx() else 2.5.dp.toPx()
            val shapeSizePx = shapeSize.toPx()
            val ascenderOffset = shapeLayout.firstBaseline - shapeSizePx * 0.72f
            val topOffset = max(0f, newLayout.firstBaseline + gapPx - ascenderOffset)
            val totalW = max(shapeLayout.size.width, newLayout.size.width) + 6.dp.toPx()
            val totalH = topOffset + shapeLayout.size.height + 2.dp.toPx()
            Triple(ceil(totalW).toInt().toDp(), ceil(totalH).toInt().toDp(), topOffset)
        }
    }

    Canvas(
        modifier = modifier
            .size(widthDp, heightDp)
            .semantics { contentDescription = "New Shape" }
    ) {
        val shapeSizePx = shapeSize.toPx()
        val xHeightPx = shapeSizePx * 0.48f
        val baselineY = shapeTopPx + shapeLayout.firstBaseline

        val cutYLeft = baselineY - xHeightPx * 0.28f
        val cutYRight = baselineY - xHeightPx * 0.46f

        val outlineStroke = if (compact) 0.9.dp.toPx() else 1.4.dp.toPx()
        val slashStroke = if (compact) 1.1.dp.toPx() else 1.7.dp.toPx()
        val slope = (cutYRight - cutYLeft) / max(1f, size.width)
        val yAtZero = cutYLeft - slope * 0f
        val yAtFarLeft = cutYLeft + slope * (-8f)
        val yAtFarRight = cutYLeft + slope * (size.width + 8f)

        // 1. "new" wordmark
        drawText(
            textLayoutResult = newLayout,
            color = NewShapeGoldBright,
            topLeft = Offset(1.dp.toPx(), 0f)
        )

        // 2. Top half of "shape": solid gold fill above diagonal cut
        val abovePath = Path().apply {
            moveTo(-8f, -8f)
            lineTo(size.width + 8f, -8f)
            lineTo(size.width + 8f, yAtFarRight)
            lineTo(-8f, yAtFarLeft)
            close()
        }
        clipPath(abovePath) {
            drawText(
                textLayoutResult = shapeLayout,
                color = NewShapeGoldBright,
                topLeft = Offset(0f, shapeTopPx),
                drawStyle = Fill
            )
        }

        // 3. Bottom half of "shape": hollow gold outline below diagonal cut
        val belowPath = Path().apply {
            moveTo(-8f, yAtFarLeft)
            lineTo(size.width + 8f, yAtFarRight)
            lineTo(size.width + 8f, size.height + 8f)
            lineTo(-8f, size.height + 8f)
            close()
        }
        clipPath(belowPath) {
            drawText(
                textLayoutResult = shapeLayout,
                color = NewShapeGoldBright,
                topLeft = Offset(0f, shapeTopPx),
                drawStyle = Stroke(
                    width = outlineStroke,
                    join = StrokeJoin.Round
                )
            )
        }

        // 4. Diagonal gold slash line along the cut seam
        drawLine(
            color = NewShapeGoldBright,
            start = Offset(-1.dp.toPx(), yAtZero - slope * 1.dp.toPx()),
            end = Offset(size.width - 1.dp.toPx(), cutYRight),
            strokeWidth = slashStroke,
            cap = StrokeCap.Round
        )
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
