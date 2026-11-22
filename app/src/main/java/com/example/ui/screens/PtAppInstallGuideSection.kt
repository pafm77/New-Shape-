package com.example.ui.screens

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.ReportExporter
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*

private val IPHONE_GUIDE_STEPS = listOf(
    "Abre o link no Safari" to "Usa sempre o Safari (navegador oficial do iPhone). Se abriste pelo WhatsApp, toca na bússola em baixo à direita para abrir no Safari.",
    "Toca no botão Partilhar" to "Na barra inferior do Safari, toca no ícone de quadrado com seta para cima (Partilhar).",
    "Escolhe \"Adicionar ao ecrã principal\"" to "Desliza o menu para baixo até encontrares \"Adicionar ao ecrã principal\" (com o símbolo +) e toca nela.",
    "Confirma em \"Adicionar\"" to "Mantém o nome \"New Shape\" e toca em \"Adicionar\" no canto superior direito. A app fica logo no ecrã principal!"
)

private val ANDROID_GUIDE_STEPS = listOf(
    "Abre o link no Google Chrome" to "Toca no link do estúdio. Se abrir dentro do WhatsApp, toca nos 3 pontinhos em cima e escolhe \"Abrir no Chrome\".",
    "Abre o menu do Chrome (3 pontos)" to "Toca nos 3 pontinhos verticais no canto superior direito do ecrã do Chrome.",
    "Toca em \"Instalar aplicação\" ou \"Adicionar ao ecrã principal\"" to "Seleciona \"Instalar aplicação\" (ou \"Adicionar ao ecrã principal\", consoante o modelo do telemóvel).",
    "Confirma em \"Instalar\" / \"Adicionar\"" to "Confirma na janela que aparece. O ícone dourado da New Shape surge no ecrã principal como uma app normal!"
)

@Composable
internal fun PtAppInstallGuideSection(
    state: StudioUiState
) {
    val context = LocalContext.current
    val cleanBaseUrl = state.settings.siteBaseUrl.trimEnd('/').ifBlank { "https://newshape.vercel.app" }
    val studentLink = remember(state.settings, state.currentUserId) {
        val ptUid = state.settings.userId.ifBlank { state.currentUserId }
        val code = state.settings.studentPortalCode
        when {
            ptUid.isNotBlank() && code.isNotBlank() -> "$cleanBaseUrl/aluno?pt=$ptUid&code=$code"
            ptUid.isNotBlank() -> "$cleanBaseUrl/aluno?pt=$ptUid"
            else -> "$cleanBaseUrl/aluno"
        }
    }

    val whatsappGuideMessage = remember(studentLink) {
        buildString {
            appendLine("Olá! 📲 Aqui tens o link para colocares a App *New Shape* no ecrã principal do teu telemóvel:")
            appendLine(studentLink)
            appendLine()
            appendLine("🍏 *iPhone (Safari):*")
            appendLine("1. Abre o link no *Safari*")
            appendLine("2. Toca no botão *Partilhar* (quadrado com seta para cima)")
            appendLine("3. Escolhe *\"Adicionar ao ecrã principal\"* e toca em *Adicionar*")
            appendLine()
            appendLine("🤖 *Android (Chrome):*")
            appendLine("1. Abre o link no *Google Chrome*")
            appendLine("2. Toca nos *3 pontinhos* no canto superior direito")
            appendLine("3. Escolhe *\"Instalar aplicação\"* (ou *\"Adicionar ao ecrã principal\"*)")
            appendLine()
            append("Depois entra só com o teu número de telemóvel! 💪 New Shape")
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            BrandCard(highlightBorder = true) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(NewShapeGoldMuted)
                    ) {
                        Icon(
                            Icons.Default.PictureAsPdf,
                            contentDescription = "Guia PDF",
                            tint = NewShapeGoldBright,
                            modifier = Modifier.size(26.dp)
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "PDF: App no Ecrã Principal",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimaryDark
                        )
                        Spacer(Modifier.height(2.dp))
                        StatusPill("iPhone & Android", TextOnGold, NewShapeGold)
                    }
                }

                Spacer(Modifier.height(10.dp))

                Text(
                    text = "Gera um guia visual em PDF A4 pronto a enviar aos teus alunos pelo WhatsApp, com o passo a passo para iPhone (Safari) e Android (Chrome) e o link direto do teu estúdio.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )

                Spacer(Modifier.height(10.dp))

                Surface(
                    color = ElevatedCharcoal,
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text(
                            text = "LINK INCLUÍDO NO PDF",
                            style = MaterialTheme.typography.labelSmall,
                            color = NewShapeGoldBright,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(3.dp))
                        Text(
                            text = studentLink,
                            style = MaterialTheme.typography.bodySmall,
                            color = TextPrimaryDark
                        )
                    }
                }

                Spacer(Modifier.height(12.dp))

                GoldPrimaryButton(
                    text = "Gerar e Partilhar PDF (iPhone & Android)",
                    icon = Icons.Default.PictureAsPdf,
                    onClick = {
                        val ok = ReportExporter.shareHomeScreenGuidePdf(context, studentLink)
                        if (!ok) {
                            Toast.makeText(context, "Erro ao gerar o PDF.", Toast.LENGTH_SHORT).show()
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    testTag = "mgmt_share_app_guide_pdf_btn"
                )

                Spacer(Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    DarkSecondaryButton(
                        text = "WhatsApp",
                        icon = Icons.AutoMirrored.Filled.Send,
                        onClick = {
                            openWhatsApp(context, null, whatsappGuideMessage, state.settings.whatsappWebMode)
                        },
                        modifier = Modifier.weight(1f).testTag("mgmt_whatsapp_app_guide_btn")
                    )
                    DarkSecondaryButton(
                        text = "Copiar Link",
                        icon = Icons.Default.ContentCopy,
                        onClick = {
                            copyToClipboard(context, studentLink, "Link do Aluno copiado!")
                        },
                        modifier = Modifier.weight(1f).testTag("mgmt_copy_student_link_btn")
                    )
                }
            }
        }

        // iPhone Steps Preview Card
        item {
            InstallStepsPreviewCard(
                title = "iPhone (iOS)",
                subtitle = "Navegador Safari",
                badgeBg = NewShapeGold,
                badgeText = TextOnGold,
                accentColor = NewShapeGoldBright,
                steps = IPHONE_GUIDE_STEPS
            )
        }

        // Android Steps Preview Card
        item {
            InstallStepsPreviewCard(
                title = "Android",
                subtitle = "Google Chrome",
                badgeBg = ConfirmedGreen,
                badgeText = ObsidianBg,
                accentColor = ConfirmedGreen,
                steps = ANDROID_GUIDE_STEPS
            )
        }
    }
}

@Composable
private fun InstallStepsPreviewCard(
    title: String,
    subtitle: String,
    badgeBg: Color,
    badgeText: Color,
    accentColor: Color,
    steps: List<Pair<String, String>>
) {
    BrandCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(badgeBg.copy(alpha = 0.2f))
                ) {
                    Icon(
                        Icons.Default.PhoneIphone,
                        contentDescription = title,
                        tint = accentColor,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Column {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextPrimaryDark
                    )
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.labelSmall,
                        color = accentColor,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
            StatusPill("${steps.size} passos", badgeText, badgeBg)
        }

        Spacer(Modifier.height(10.dp))
        HorizontalDivider(color = HairlineBorder)
        Spacer(Modifier.height(10.dp))

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            steps.forEachIndexed { idx, (stepTitle, stepDesc) ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(badgeBg)
                    ) {
                        Text(
                            text = "${idx + 1}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = badgeText
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stepTitle,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimaryDark
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = stepDesc,
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    }
                }
            }
        }
    }
}
