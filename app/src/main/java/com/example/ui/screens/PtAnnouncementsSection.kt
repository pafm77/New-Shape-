package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.model.AnnouncementReadRecord
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.BrandCard
import com.example.ui.components.EmptyStateBox
import com.example.ui.components.StatusPill
import com.example.ui.components.formatShortDate
import com.example.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val ANNOUNCEMENT_DURATION_PRESETS = listOf(1, 3, 7, 14, 30)

private fun formatReadTimestamp(millis: Long): String {
    if (millis <= 0L) return "—"
    val fmt = SimpleDateFormat("dd/MM 'às' HH:mm", Locale("pt", "PT"))
    return fmt.format(Date(millis))
}

@Composable
fun PtAnnouncementsSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    var title by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var durationDays by remember { mutableIntStateOf(7) }
    var customDaysText by remember { mutableStateOf("7") }
    var expandedId by remember { mutableStateOf<String?>(null) }

    val activeClients = remember(state.clients) {
        state.clients.filter { it.active }.sortedBy { it.name.lowercase() }
    }
    val readsByAnnouncement = remember(state.announcementReads) {
        state.announcementReads.groupBy { it.announcementId }
    }
    val now = System.currentTimeMillis()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Publish new announcement form
        item(key = "publish_announcement_card") {
            BrandCard(highlightBorder = true) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = NewShapeGoldMuted,
                        modifier = Modifier.size(40.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                Icons.Default.Campaign,
                                contentDescription = "Avisos do estúdio",
                                tint = NewShapeGold,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                    Column {
                        Text(
                            "Publicar Aviso no Portal",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimaryDark
                        )
                        Text(
                            "Só aparece aos alunos enquanto estiver ativo e até clicarem em Lido.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    }
                }

                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it.take(120) },
                    label = { Text("Título do aviso") },
                    placeholder = { Text("Ex.: Horário especial de feriado") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("announcement_title_input")
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = message,
                    onValueChange = { message = it.take(1200) },
                    label = { Text("Mensagem") },
                    placeholder = { Text("Escreve o aviso para os alunos...") },
                    minLines = 2,
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth().testTag("announcement_message_input")
                )

                Spacer(Modifier.height(10.dp))
                Text(
                    "Duração do aviso (dias)",
                    style = MaterialTheme.typography.labelMedium,
                    color = TextSecondaryDark
                )
                Spacer(Modifier.height(6.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(ANNOUNCEMENT_DURATION_PRESETS) { days ->
                        FilterChip(
                            selected = durationDays == days && customDaysText == days.toString(),
                            onClick = {
                                durationDays = days
                                customDaysText = days.toString()
                            },
                            label = { Text("${days}d", fontWeight = FontWeight.Bold) },
                            modifier = Modifier.testTag("announcement_duration_${days}d")
                        )
                    }
                }
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = customDaysText,
                    onValueChange = { raw ->
                        val digits = raw.filter(Char::isDigit).take(2)
                        customDaysText = digits
                        digits.toIntOrNull()?.takeIf { it in 1..90 }?.let { durationDays = it }
                    },
                    label = { Text("Dias personalizados (1–90)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth().testTag("announcement_custom_days_input")
                )

                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = {
                        val days = customDaysText.toIntOrNull()?.coerceIn(1, 90) ?: durationDays
                        viewModel.createStudioAnnouncement(title, message, days)
                        title = ""
                        message = ""
                        durationDays = 7
                        customDaysText = "7"
                    },
                    enabled = title.isNotBlank() && message.isNotBlank(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .testTag("publish_announcement_button"),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = NewShapeGold,
                        contentColor = TextOnGold
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Publicar aviso agora", fontWeight = FontWeight.Bold)
                }
            }
        }

        if (state.studioAnnouncements.isEmpty()) {
            item(key = "empty_announcements") {
                EmptyStateBox(
                    icon = Icons.Default.Campaign,
                    title = "Sem avisos publicados",
                    subtitle = "Publica um aviso acima para aparecer no portal dos alunos com o botão Lido e acompanha aqui quem leu."
                )
            }
        } else {
            items(state.studioAnnouncements, key = { it.id }) { ann ->
                val isActive = ann.active && ann.expiresAtMillis > now
                val reads: List<AnnouncementReadRecord> =
                    (readsByAnnouncement[ann.id].orEmpty()).sortedByDescending { it.readAtMillis }
                val readIds = reads.map { it.clientId }.toSet()
                val unreadClients = activeClients.filter { it.id !in readIds }
                val totalActive = maxOf(activeClients.size, reads.size)
                val pct = if (totalActive > 0) ((reads.size * 100) / totalActive).coerceIn(0, 100) else 0
                val isExpanded = expandedId == ann.id

                BrandCard(highlightBorder = isActive) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            StatusPill(
                                text = if (isActive) "Ativo" else "Encerrado",
                                textColor = if (isActive) ConfirmedGreen else TextSecondaryDark,
                                containerColor = if (isActive) ConfirmedGreenContainer else ElevatedCharcoal
                            )
                            Text(
                                "${ann.durationDays}d · até ${formatShortDate(ann.expiresAtMillis)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextSecondaryDark
                            )
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (isActive) {
                                TextButton(
                                    onClick = { viewModel.closeStudioAnnouncement(ann.id) },
                                    modifier = Modifier.testTag("close_announcement_${ann.id}")
                                ) {
                                    Text("Encerrar", color = PendingAmber, fontWeight = FontWeight.Bold)
                                }
                            }
                            IconButton(
                                onClick = { viewModel.deleteStudioAnnouncement(ann.id) },
                                modifier = Modifier.testTag("delete_announcement_${ann.id}")
                            ) {
                                Icon(
                                    Icons.Default.DeleteOutline,
                                    contentDescription = "Apagar aviso",
                                    tint = DangerRed
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(4.dp))
                    Text(
                        ann.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextPrimaryDark
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        ann.message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextPrimaryDark.copy(alpha = 0.9f)
                    )

                    Spacer(Modifier.height(10.dp))
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = ElevatedCharcoal,
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    "Lido por ${reads.size} / $totalActive alunos ($pct%)",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimaryDark
                                )
                                TextButton(
                                    onClick = { expandedId = if (isExpanded) null else ann.id },
                                    modifier = Modifier.testTag("toggle_reads_${ann.id}")
                                ) {
                                    Text(
                                        if (isExpanded) "Ocultar" else "Ver quem leu",
                                        color = NewShapeGoldBright,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }

                            LinearProgressIndicator(
                                progress = { pct / 100f },
                                modifier = Modifier.fillMaxWidth().height(6.dp),
                                color = ConfirmedGreen,
                                trackColor = ObsidianBg
                            )

                            if (isExpanded) {
                                HorizontalDivider(color = HairlineBorder)
                                Text(
                                    "LERAM (${reads.size})",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = ConfirmedGreen
                                )
                                if (reads.isEmpty()) {
                                    Text(
                                        "Nenhum aluno clicou em Lido ainda.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondaryDark
                                    )
                                } else {
                                    reads.forEach { r ->
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(
                                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Icon(
                                                    Icons.Default.CheckCircle,
                                                    contentDescription = null,
                                                    tint = ConfirmedGreen,
                                                    modifier = Modifier.size(14.dp)
                                                )
                                                Text(
                                                    r.clientName,
                                                    style = MaterialTheme.typography.bodySmall,
                                                    fontWeight = FontWeight.SemiBold,
                                                    color = TextPrimaryDark
                                                )
                                            }
                                            Text(
                                                formatReadTimestamp(r.readAtMillis),
                                                style = MaterialTheme.typography.labelSmall,
                                                color = TextSecondaryDark
                                            )
                                        }
                                    }
                                }

                                Spacer(Modifier.height(4.dp))
                                Text(
                                    "POR LER (${unreadClients.size})",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = PendingAmber
                                )
                                if (unreadClients.isEmpty()) {
                                    Text(
                                        "Todos os alunos ativos já leram! 🎉",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = ConfirmedGreen,
                                        fontWeight = FontWeight.Bold
                                    )
                                } else {
                                    unreadClients.forEach { c ->
                                        Text(
                                            "• ${c.name}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = TextSecondaryDark
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
