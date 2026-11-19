package com.example.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

private val NewShapeColorScheme = darkColorScheme(
    primary = NewShapeGold,
    onPrimary = TextOnGold,
    primaryContainer = NewShapeGoldMuted,
    onPrimaryContainer = NewShapeGoldBright,
    secondary = WarmCream,
    onSecondary = TextOnGold,
    secondaryContainer = ElevatedCharcoal,
    onSecondaryContainer = TextPrimaryDark,
    tertiary = ConfirmedGreen,
    onTertiary = TextOnGold,
    tertiaryContainer = ConfirmedGreenContainer,
    onTertiaryContainer = ConfirmedGreen,
    background = ObsidianBg,
    onBackground = TextPrimaryDark,
    surface = CharcoalSurface,
    onSurface = TextPrimaryDark,
    surfaceVariant = ElevatedCharcoal,
    onSurfaceVariant = TextSecondaryDark,
    outline = HairlineBorder,
    outlineVariant = HairlineBorder,
    error = DangerRed,
    onError = TextPrimaryDark,
    errorContainer = DangerRedContainer,
    onErrorContainer = DangerRed
)

val NewShapeShapes = Shapes(
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(26.dp)
)

@Composable
fun NewShapeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = NewShapeColorScheme,
        typography = AppTypography,
        shapes = NewShapeShapes,
        content = content
    )
}
