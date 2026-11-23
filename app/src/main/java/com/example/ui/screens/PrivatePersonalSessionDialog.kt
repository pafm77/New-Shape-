package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.SeedCatalog
import com.example.data.model.ClientRecord
import com.example.ui.components.GoldPrimaryButton
import com.example.ui.components.StatusPill
import com.example.ui.theme.*
import java.util.Calendar

private val PRIVATE_DURATIONS = listOf(30, 45, 60, 90)
private val PRIVATE_MINUTES = listOf(0, 15, 30, 45)

private fun normalizeDayStart(ts: Long): Long {
    val c = Calendar.getInstance().apply {
        timeInMillis = if (ts > 0L) ts else System.currentTimeMillis()
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }
    return c.timeInMillis
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PrivatePersonalSessionDialog(
    clients: List<ClientRecord>,
    initialClientId: String?,
    initialDateMillis: Long,
    onDismiss: () -> Unit,
    onConfirm: (
        clientId: String,
        clientName: String,
        dateMillis: Long,
        hour: Int,
        minute: Int,
        durationMinutes: Int,
        note: String
    ) -> Unit
) {
    val sortedClients = remember(clients) {
        clients
            .filter { it.active }
            .sortedWith(
                compareBy<ClientRecord> { if (it.trainingType == "PERSONALIZADO") 0 else 1 }
                    .thenBy { it.name.lowercase() }
            )
    }

    var searchQuery by remember { mutableStateOf("") }
    val filteredClients = remember(sortedClients, searchQuery) {
        val q = searchQuery.trim().lowercase()
        if (q.isBlank()) sortedClients
        else sortedClients.filter {
            it.name.lowercase().contains(q) || it.phone.contains(q)
        }
    }

    var selectedClientId by remember(initialClientId, sortedClients) {
        mutableStateOf(
            sortedClients.find { it.id == initialClientId }?.id
                ?: sortedClients.firstOrNull()?.id.orEmpty()
        )
    }
    var clientMenuExpanded by remember { mutableStateOf(false) }

    val selectedClient = filteredClients.find { it.id == selectedClientId }
        ?: sortedClients.find { it.id == selectedClientId }
        ?: filteredClients.firstOrNull()

    var dateMillis by remember(initialDateMillis) { mutableLongStateOf(normalizeDayStart(initialDateMillis)) }
    var hour by remember { mutableIntStateOf(18) }
    var minute by remember { mutableIntStateOf(0) }
    var durationMinutes by remember { mutableIntStateOf(60) }
    var note by remember { mutableStateOf("") }

    val dateCal = remember(dateMillis) {
        Calendar.getInstance().apply { timeInMillis = dateMillis }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        titleContentColor = TextPrimaryDark,
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = "Personalizado (Oculto)",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextPrimaryDark
                )
                Text(
                    text = "Só visível no Portal PT · Oculto dos alunos",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Surface(
                    color = NewShapeGoldMuted.copy(alpha = 0.6f),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.5f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(10.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.VisibilityOff,
                            contentDescription = "Oculto dos alunos",
                            tint = NewShapeGoldBright,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = "Este treino não aparece para os alunos e conta nos Treinos Personalizados Dados ao marcar presença (✓).",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextPrimaryDark
                        )
                    }
                }

                // Search client
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    label = { Text("Pesquisar aluno") },
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("private_personal_search_input")
                )

                // Client dropdown
                ExposedDropdownMenuBox(
                    expanded = clientMenuExpanded,
                    onExpandedChange = { clientMenuExpanded = it }
                ) {
                    OutlinedTextField(
                        value = selectedClient?.let {
                            "${it.name} · ${if (it.trainingType == "PERSONALIZADO") "Personalizado" else "Grupo"}"
                        } ?: "Sem alunos ativos",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Aluno (${filteredClients.size})") },
                        trailingIcon = {
                            ExposedDropdownMenuDefaults.TrailingIcon(expanded = clientMenuExpanded)
                        },
                        modifier = Modifier
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                            .fillMaxWidth()
                            .testTag("private_personal_client_picker")
                    )
                    ExposedDropdownMenu(
                        expanded = clientMenuExpanded,
                        onDismissRequest = { clientMenuExpanded = false },
                        containerColor = ElevatedCharcoal
                    ) {
                        filteredClients.forEach { c ->
                            DropdownMenuItem(
                                text = {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Text(c.name, color = TextPrimaryDark, fontWeight = FontWeight.SemiBold)
                                        StatusPill(
                                            text = if (c.trainingType == "PERSONALIZADO") "Pers." else "Grupo",
                                            textColor = if (c.trainingType == "PERSONALIZADO") NewShapeGoldBright else InfoBlue,
                                            containerColor = if (c.trainingType == "PERSONALIZADO") NewShapeGoldMuted else InfoBlueContainer
                                        )
                                    }
                                },
                                onClick = {
                                    selectedClientId = c.id
                                    clientMenuExpanded = false
                                }
                            )
                        }
                    }
                }

                // Date stepper
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "DATA",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark,
                        fontWeight = FontWeight.Bold
                    )
                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 4.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            IconButton(
                                onClick = {
                                    val c = (dateCal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, -1) }
                                    dateMillis = normalizeDayStart(c.timeInMillis)
                                },
                                modifier = Modifier.testTag("private_personal_prev_day_btn")
                            ) {
                                Icon(
                                    Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                                    contentDescription = "Dia anterior",
                                    tint = NewShapeGold
                                )
                            }
                            Text(
                                text = SeedCatalog.formatDayDate(dateCal),
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimaryDark
                            )
                            IconButton(
                                onClick = {
                                    val c = (dateCal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, 1) }
                                    dateMillis = normalizeDayStart(c.timeInMillis)
                                },
                                modifier = Modifier.testTag("private_personal_next_day_btn")
                            ) {
                                Icon(
                                    Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                    contentDescription = "Dia seguinte",
                                    tint = NewShapeGold
                                )
                            }
                        }
                    }
                }

                // Time selector (Hour stepper + Minute chips)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "HORA (${"%02d:%02d".format(hour, minute)})",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark,
                        fontWeight = FontWeight.Bold
                    )
                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 4.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            IconButton(
                                onClick = { hour = if (hour <= 6) 22 else hour - 1 },
                                modifier = Modifier.testTag("private_personal_prev_hour_btn")
                            ) {
                                Icon(Icons.Default.Remove, contentDescription = "Diminuir hora", tint = NewShapeGold)
                            }
                            Text(
                                text = "%02dh%02d".format(hour, minute),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.ExtraBold,
                                color = NewShapeGoldBright
                            )
                            IconButton(
                                onClick = { hour = if (hour >= 22) 6 else hour + 1 },
                                modifier = Modifier.testTag("private_personal_next_hour_btn")
                            ) {
                                Icon(Icons.Default.Add, contentDescription = "Aumentar hora", tint = NewShapeGold)
                            }
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        PRIVATE_MINUTES.forEach { m ->
                            val selected = minute == m
                            FilterChip(
                                selected = selected,
                                onClick = { minute = m },
                                label = { Text(":%02d".format(m), fontWeight = FontWeight.Bold) },
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("private_personal_min_$m")
                            )
                        }
                    }
                }

                // Duration chips
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "DURAÇÃO",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark,
                        fontWeight = FontWeight.Bold
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        PRIVATE_DURATIONS.forEach { mins ->
                            FilterChip(
                                selected = durationMinutes == mins,
                                onClick = { durationMinutes = mins },
                                label = { Text("${mins}m", fontWeight = FontWeight.Bold) },
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("private_personal_dur_$mins")
                            )
                        }
                    }
                }

                // Optional note
                OutlinedTextField(
                    value = note,
                    onValueChange = { if (it.length <= 200) note = it },
                    label = { Text("Nota (opcional)") },
                    placeholder = { Text("Ex.: Treino personalizado · Força") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("private_personal_note_input")
                )
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Marcar",
                icon = Icons.Default.Add,
                enabled = selectedClient != null,
                onClick = {
                    val c = selectedClient ?: return@GoldPrimaryButton
                    onConfirm(c.id, c.name, dateMillis, hour, minute, durationMinutes, note)
                    onDismiss()
                },
                testTag = "private_personal_confirm_btn"
            )
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.testTag("private_personal_cancel_btn")
            ) {
                Text("Cancelar", color = TextSecondaryDark)
            }
        }
    )
}
