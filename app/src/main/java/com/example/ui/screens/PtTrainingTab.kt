package com.example.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.MakeupCreditCalculator
import com.example.data.SeedCatalog
import com.example.data.model.ClientRecord
import com.example.data.model.ExerciseRecord
import com.example.data.model.WorkoutLoadLogRecord
import com.example.data.model.WorkoutPlanItemRecord
import com.example.data.model.WorkoutPlanRecord
import com.example.data.model.currentLocalIsoDate
import com.example.data.model.formatIsoDatePt
import com.example.data.model.groupWorkoutPlanItems
import com.example.data.model.isScheduledForFuture
import com.example.data.model.isUnassignedDraft
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

@Composable
fun PtTrainingTab(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    var selectedSubTab by remember { mutableIntStateOf(0) }
    val activeClients = remember(state.clients) { state.clients.filter { it.active } }
    var selectedClientId by remember(activeClients) {
        mutableStateOf(activeClients.firstOrNull()?.id.orEmpty())
    }
    val eligibleMakeupCount = remember(
        activeClients,
        state.weeks,
        state.sessions,
        state.bookings,
        state.weekResponses,
        state.makeupCredits
    ) {
        MakeupCreditCalculator.computeAllClients(
            clients = activeClients,
            weeks = state.weeks,
            sessions = state.sessions,
            bookings = state.bookings,
            weekResponses = state.weekResponses,
            makeupCredits = state.makeupCredits
        ).values.count { it.availableCount > 0 }
    }
    val subTabs = listOf(
        "Planos",
        "Marcações",
        "Agenda",
        if (eligibleMakeupCount > 0) "Compensações ($eligibleMakeupCount)" else "Compensações",
        "Exercícios (${state.exercises.size})"
    )

    Column(modifier = Modifier.fillMaxSize()) {
        ScrollableTabRow(
            selectedTabIndex = selectedSubTab,
            containerColor = CharcoalSurface,
            contentColor = NewShapeGold,
            edgePadding = 8.dp,
            divider = { HorizontalDivider(color = HairlineBorder) }
        ) {
            subTabs.forEachIndexed { idx, title ->
                val isCompTab = idx == 3
                Tab(
                    selected = selectedSubTab == idx,
                    onClick = { selectedSubTab = idx },
                    modifier = Modifier.testTag("pt_training_subtab_$idx"),
                    text = {
                        Text(
                            text = title,
                            maxLines = 1,
                            fontWeight = if (selectedSubTab == idx) FontWeight.Bold else FontWeight.Medium,
                            color = when {
                                selectedSubTab == idx && isCompTab -> MakeupPurpleBright
                                selectedSubTab == idx -> NewShapeGold
                                isCompTab && eligibleMakeupCount > 0 -> MakeupPurpleBright.copy(alpha = 0.85f)
                                else -> TextSecondaryDark
                            }
                        )
                    }
                )
            }
        }

        when (selectedSubTab) {
            0 -> WorkoutPlansBuilderSection(
                state = state,
                viewModel = viewModel,
                selectedClientId = selectedClientId,
                onSelectClient = { selectedClientId = it }
            )
            1 -> PtTrainingMarcacoesSection(
                state = state,
                viewModel = viewModel,
                selectedClientId = selectedClientId,
                onSelectClient = { selectedClientId = it }
            )
            2 -> PtTrainingAgendaSection(
                state = state,
                viewModel = viewModel,
                onOpenClientPlan = { cid ->
                    selectedClientId = cid
                    selectedSubTab = 0
                }
            )
            3 -> PtCompensacoesSection(
                state = state,
                viewModel = viewModel
            )
            else -> ExerciseLibrarySection(state = state, viewModel = viewModel)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WorkoutPlansBuilderSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    selectedClientId: String,
    onSelectClient: (String) -> Unit
) {
    val activeClients = remember(state.clients) { state.clients.filter { it.active } }
    val selectedClient = activeClients.find { it.id == selectedClientId } ?: activeClients.firstOrNull()
    var clientMenuExpanded by remember { mutableStateOf(false) }
    var viewMode by remember { mutableStateOf("CLIENT") } // "CLIENT" | "DRAFTS"

    var showNewPlanDialog by remember { mutableStateOf(false) }
    var targetPlanForExercise by remember { mutableStateOf<WorkoutPlanRecord?>(null) }
    var targetPlanToAssign by remember { mutableStateOf<WorkoutPlanRecord?>(null) }
    var targetPlanToSchedule by remember { mutableStateOf<WorkoutPlanRecord?>(null) }
    var historyTargetItem by remember { mutableStateOf<WorkoutPlanItemRecord?>(null) }
    var collapsedPlanIds by remember { mutableStateOf<Set<String>>(emptySet()) }

    val todayIso = remember { currentLocalIsoDate() }
    val unassignedPlans = remember(state.workoutPlans) {
        state.workoutPlans.filter { it.isUnassignedDraft() }
    }
    val clientPlans = remember(state.workoutPlans, selectedClient?.id) {
        if (selectedClient == null) emptyList()
        else state.workoutPlans.filter { it.clientId == selectedClient.id }
    }
    val displayedPlans = if (viewMode == "DRAFTS") unassignedPlans else clientPlans
    val clientFeedback = remember(state.workoutFeedback, selectedClient?.id) {
        if (selectedClient == null) emptyList()
        else state.workoutFeedback.filter { it.clientId == selectedClient.id }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            BrandCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = viewMode == "CLIENT",
                        onClick = { viewMode = "CLIENT" },
                        modifier = Modifier
                            .weight(1f)
                            .testTag("plans_mode_client"),
                        label = {
                            Text(
                                "Por Aluno",
                                maxLines = 1,
                                fontWeight = FontWeight.Bold
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NewShapeGold,
                            selectedLabelColor = TextOnGold,
                            containerColor = ElevatedCharcoal,
                            labelColor = TextSecondaryDark
                        )
                    )
                    FilterChip(
                        selected = viewMode == "DRAFTS",
                        onClick = { viewMode = "DRAFTS" },
                        modifier = Modifier
                            .weight(1f)
                            .testTag("plans_mode_drafts"),
                        label = {
                            Text(
                                "Sem Aluno (${unassignedPlans.size})",
                                maxLines = 1,
                                fontWeight = FontWeight.Bold
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NewShapeGold,
                            selectedLabelColor = TextOnGold,
                            containerColor = ElevatedCharcoal,
                            labelColor = TextSecondaryDark
                        )
                    )
                }

                Spacer(Modifier.height(10.dp))

                if (viewMode == "CLIENT") {
                    Text("Selecionar Aluno", style = MaterialTheme.typography.labelMedium, color = NewShapeGold)
                    Spacer(Modifier.height(6.dp))
                    ExposedDropdownMenuBox(
                        expanded = clientMenuExpanded,
                        onExpandedChange = { clientMenuExpanded = !clientMenuExpanded }
                    ) {
                        OutlinedTextField(
                            value = selectedClient?.name ?: "Sem alunos ativos",
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = clientMenuExpanded) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            colors = darkFieldColors()
                        )
                        ExposedDropdownMenu(
                            expanded = clientMenuExpanded,
                            onDismissRequest = { clientMenuExpanded = false }
                        ) {
                            activeClients.forEach { client ->
                                DropdownMenuItem(
                                    text = { Text(client.name) },
                                    onClick = {
                                        onSelectClient(client.id)
                                        clientMenuExpanded = false
                                    }
                                )
                            }
                        }
                    }
                } else {
                    Text(
                        "Cria planos e modelos de treino sem aluno associado. Quando estiverem prontos, atribui-os aos alunos e escolhe o dia em que ficam visíveis.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark
                    )
                }

                Spacer(Modifier.height(12.dp))
                GoldPrimaryButton(
                    text = "+ Novo Plano de Treino",
                    icon = Icons.Default.Add,
                    enabled = true,
                    onClick = { showNewPlanDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                    testTag = "create_workout_plan_btn"
                )
            }
        }

        if (displayedPlans.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.FitnessCenter,
                    title = if (viewMode == "DRAFTS") "Sem planos por atribuir" else "Sem planos atribuídos",
                    subtitle = if (viewMode == "DRAFTS") {
                        "Cria um plano sem aluno para montar os exercícios primeiro e atribuí-lo mais tarde."
                    } else {
                        "Cria um plano para ${selectedClient?.name ?: "este aluno"} e escolhe exercícios da biblioteca."
                    }
                )
            }
        } else {
            if (displayedPlans.size > 1) {
                item(key = "plans_collapse_controls") {
                    val allCollapsed = displayedPlans.all { it.id in collapsedPlanIds }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${displayedPlans.size} planos de treino",
                            style = MaterialTheme.typography.labelMedium,
                            color = TextSecondaryDark
                        )
                        TextButton(
                            onClick = {
                                collapsedPlanIds = if (allCollapsed) {
                                    collapsedPlanIds - displayedPlans.map { it.id }.toSet()
                                } else {
                                    collapsedPlanIds + displayedPlans.map { it.id }.toSet()
                                }
                            },
                            modifier = Modifier.testTag("pt_toggle_all_plans_collapse")
                        ) {
                            Icon(
                                imageVector = if (allCollapsed) Icons.Default.UnfoldMore else Icons.Default.UnfoldLess,
                                contentDescription = if (allCollapsed) "Maximizar todos os planos" else "Minimizar todos os planos",
                                tint = NewShapeGoldBright,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                text = if (allCollapsed) "Maximizar todos" else "Minimizar todos",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = NewShapeGoldBright
                            )
                        }
                    }
                }
            }

            items(displayedPlans, key = { it.id }) { plan ->
                val items = state.workoutPlanItems.filter { it.planId == plan.id }.sortedBy { it.orderIndex }
                val isDraft = plan.isUnassignedDraft()
                val isScheduledFuture = !isDraft && plan.isScheduledForFuture(todayIso)
                val isExpanded = plan.id !in collapsedPlanIds
                val togglePlanExpanded = {
                    collapsedPlanIds = if (isExpanded) collapsedPlanIds + plan.id else collapsedPlanIds - plan.id
                }
                BrandCard(highlightBorder = true) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .clickable(onClick = togglePlanExpanded),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(plan.title, style = MaterialTheme.typography.titleLarge, color = TextPrimaryDark)
                            val subtitleParts = buildList {
                                if (plan.splitLabel.isNotBlank()) add(plan.splitLabel)
                                if (!isExpanded) add("${items.size} exercício(s)")
                            }
                            if (subtitleParts.isNotEmpty()) {
                                Text(
                                    subtitleParts.joinToString(" · "),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = NewShapeGoldBright
                                )
                            }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(
                                onClick = togglePlanExpanded,
                                modifier = Modifier.testTag("pt_toggle_plan_${plan.id}")
                            ) {
                                Icon(
                                    imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                    contentDescription = if (isExpanded) "Minimizar plano" else "Maximizar plano",
                                    tint = NewShapeGoldBright
                                )
                            }
                            IconButton(onClick = { viewModel.deleteWorkoutPlan(plan.id) }) {
                                Icon(Icons.Default.DeleteOutline, contentDescription = "Apagar plano", tint = DangerRed)
                            }
                        }
                    }

                    Spacer(Modifier.height(8.dp))
                    if (isDraft) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            StatusPill("Sem aluno · Modelo", NewShapeGoldBright, NewShapeGoldMuted)
                            Text(
                                "${items.size} exercício(s)",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextSecondaryDark
                            )
                        }
                    } else if (isScheduledFuture) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            StatusPill(
                                "Agendado · ${formatIsoDatePt(plan.availableFromDate)}",
                                PendingAmber,
                                PendingAmberContainer
                            )
                            Text(
                                "Oculto para o aluno até ${formatIsoDatePt(plan.availableFromDate)}.",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextSecondaryDark
                            )
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                TextButton(
                                    onClick = { targetPlanToSchedule = plan },
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                    modifier = Modifier.testTag("reschedule_plan_${plan.id}")
                                ) {
                                    Icon(
                                        Icons.Default.CalendarMonth,
                                        contentDescription = null,
                                        tint = NewShapeGoldBright,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(Modifier.width(4.dp))
                                    Text("Alterar data", color = NewShapeGoldBright, style = MaterialTheme.typography.labelMedium)
                                }
                                TextButton(
                                    onClick = { viewModel.updateWorkoutPlanSchedule(plan.id, "") },
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                    modifier = Modifier.testTag("release_plan_now_${plan.id}")
                                ) {
                                    Icon(
                                        Icons.Default.Visibility,
                                        contentDescription = null,
                                        tint = ConfirmedGreen,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(Modifier.width(4.dp))
                                    Text("Libertar agora", color = ConfirmedGreen, style = MaterialTheme.typography.labelMedium)
                                }
                            }
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            StatusPill("Visível para o aluno", ConfirmedGreen, ConfirmedGreenContainer)
                            TextButton(
                                onClick = { targetPlanToSchedule = plan },
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                modifier = Modifier.testTag("schedule_plan_${plan.id}")
                            ) {
                                Icon(
                                    Icons.Default.CalendarMonth,
                                    contentDescription = null,
                                    tint = TextSecondaryDark,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(Modifier.width(4.dp))
                                Text("Agendar dia", color = TextSecondaryDark, style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }

                    AnimatedVisibility(visible = isExpanded) {
                        Column(modifier = Modifier.fillMaxWidth()) {
                    Spacer(Modifier.height(10.dp))
                    HorizontalDivider(color = HairlineBorder)
                    Spacer(Modifier.height(8.dp))

                    if (items.isEmpty()) {
                        Text(
                            "Ainda sem exercícios neste plano.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    } else {
                        val blocks = groupWorkoutPlanItems(items)
                        var flatIdx = 0
                        blocks.forEachIndexed { blockIdx, block ->
                            if (block.isGrouped) {
                                Surface(
                                    color = ElevatedCharcoal,
                                    shape = RoundedCornerShape(12.dp),
                                    border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.65f)),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp)
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(10.dp),
                                        verticalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            StatusPill(
                                                text = block.groupLabel,
                                                textColor = NewShapeGoldBright,
                                                containerColor = NewShapeGoldMuted
                                            )
                                            TextButton(
                                                onClick = { viewModel.ungroupSupersetBlock(block.items) },
                                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                                modifier = Modifier.testTag("ungroup_superset_${block.supersetGroup}")
                                            ) {
                                                Icon(
                                                    Icons.Default.LinkOff,
                                                    contentDescription = "Desagrupar exercícios",
                                                    tint = TextSecondaryDark,
                                                    modifier = Modifier.size(16.dp)
                                                )
                                                Spacer(Modifier.width(4.dp))
                                                Text(
                                                    "Desagrupar",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = TextSecondaryDark
                                                )
                                            }
                                        }
                                        block.items.forEachIndexed { inIdx, exItem ->
                                            val isNonLast = inIdx < block.items.lastIndex
                                            val isLast = inIdx == block.items.lastIndex
                                            WorkoutPlanExerciseRow(
                                                index = flatIdx + inIdx + 1,
                                                item = exItem,
                                                clientId = plan.clientId,
                                                workoutPlans = state.workoutPlans,
                                                workoutPlanItems = state.workoutPlanItems,
                                                workoutLoadLogs = state.workoutLoadLogs,
                                                labelPrefix = block.itemLabel(inIdx),
                                                isSupersetNonLast = isNonLast,
                                                isSupersetLast = isLast,
                                                onOpenHistory = if (isDraft) null else ({ historyTargetItem = exItem }),
                                                onRemove = { viewModel.removeExerciseFromPlan(exItem.id) }
                                            )
                                            if (isNonLast) {
                                                Surface(
                                                    color = NewShapeGoldMuted.copy(alpha = 0.75f),
                                                    shape = RoundedCornerShape(6.dp),
                                                    modifier = Modifier.padding(vertical = 2.dp)
                                                ) {
                                                    Row(
                                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                                        verticalAlignment = Alignment.CenterVertically,
                                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                                    ) {
                                                        Icon(
                                                            Icons.Default.Bolt,
                                                            contentDescription = null,
                                                            tint = NewShapeGoldBright,
                                                            modifier = Modifier.size(14.dp)
                                                        )
                                                        Text(
                                                            "Sem descanso · passa logo ao seguinte",
                                                            style = MaterialTheme.typography.labelSmall,
                                                            fontWeight = FontWeight.SemiBold,
                                                            color = NewShapeGoldBright
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                flatIdx += block.items.size
                            } else {
                                val exItem = block.items.first()
                                val prevItem = if (flatIdx > 0) items[flatIdx - 1] else null
                                if (prevItem != null) {
                                    TextButton(
                                        onClick = { viewModel.linkExerciseWithPrevious(prevItem, exItem) },
                                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp),
                                        modifier = Modifier.testTag("link_prev_ex_${exItem.id}")
                                    ) {
                                        Icon(
                                            Icons.Default.Link,
                                            contentDescription = "Agrupar com o exercício anterior",
                                            tint = NewShapeGoldBright,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(Modifier.width(4.dp))
                                        Text(
                                            "Agrupar com anterior (sem descanso)",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = NewShapeGoldBright
                                        )
                                    }
                                }
                                WorkoutPlanExerciseRow(
                                    index = flatIdx + 1,
                                    item = exItem,
                                    clientId = plan.clientId,
                                    workoutPlans = state.workoutPlans,
                                    workoutPlanItems = state.workoutPlanItems,
                                    workoutLoadLogs = state.workoutLoadLogs,
                                    labelPrefix = block.itemLabel(0),
                                    onOpenHistory = if (isDraft) null else ({ historyTargetItem = exItem }),
                                    onRemove = { viewModel.removeExerciseFromPlan(exItem.id) }
                                )
                                flatIdx += 1
                            }
                            if (blockIdx < blocks.lastIndex) {
                                HorizontalDivider(color = HairlineBorder.copy(alpha = 0.5f))
                            }
                        }
                    }

                    Spacer(Modifier.height(10.dp))
                    DarkSecondaryButton(
                        text = "+ Adicionar Exercício da Biblioteca",
                        icon = Icons.Default.AddCircleOutline,
                        onClick = { targetPlanForExercise = plan },
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (isDraft) {
                        Spacer(Modifier.height(8.dp))
                        GoldPrimaryButton(
                            text = "Atribuir a alunos...",
                            icon = Icons.Default.GroupAdd,
                            enabled = activeClients.isNotEmpty(),
                            onClick = { targetPlanToAssign = plan },
                            modifier = Modifier.fillMaxWidth(),
                            testTag = "assign_draft_plan_${plan.id}"
                        )
                    } else if (activeClients.size > 1) {
                        Spacer(Modifier.height(8.dp))
                        DarkSecondaryButton(
                            text = "Adicionar a mais alunos",
                            icon = Icons.Default.GroupAdd,
                            onClick = { targetPlanToAssign = plan },
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("assign_plan_more_clients_${plan.id}")
                        )
                    }
                        }
                    }
                }
            }
        }

        if (viewMode == "CLIENT" && selectedClient != null && clientFeedback.isNotEmpty()) {
            item(key = "client_recent_feedback") {
                PtRecentFeedbackCard(
                    clientName = selectedClient.name,
                    feedbackItems = clientFeedback,
                    onDelete = { viewModel.deleteWorkoutFeedback(it) }
                )
            }
        }
    }

    if (showNewPlanDialog) {
        NewWorkoutPlanDialog(
            clients = activeClients,
            initialClientId = if (viewMode == "CLIENT") selectedClient?.id.orEmpty() else "",
            defaultUnassigned = viewMode == "DRAFTS" || activeClients.isEmpty(),
            onDismiss = { showNewPlanDialog = false },
            onCreate = { selectedIds, title, split, availableFromDate ->
                viewModel.createWorkoutPlansForClients(selectedIds, title, split, availableFromDate)
                if (selectedIds.isEmpty()) {
                    viewMode = "DRAFTS"
                } else {
                    viewMode = "CLIENT"
                    if (selectedClient == null || selectedClient.id !in selectedIds) {
                        onSelectClient(selectedIds.first())
                    }
                }
                showNewPlanDialog = false
            }
        )
    }

    targetPlanToAssign?.let { plan ->
        val candidates = if (plan.isUnassignedDraft()) {
            activeClients
        } else {
            activeClients.filter { it.id != plan.clientId }
        }
        AssignWorkoutPlanDialog(
            plan = plan,
            exerciseCount = state.workoutPlanItems.count { it.planId == plan.id },
            candidates = candidates,
            onDismiss = { targetPlanToAssign = null },
            onAssign = { targetIds, availableFromDate ->
                viewModel.assignWorkoutPlanToClients(plan, targetIds, availableFromDate)
                targetPlanToAssign = null
            }
        )
    }

    targetPlanToSchedule?.let { plan ->
        SchedulePlanAccessDialog(
            plan = plan,
            todayIso = todayIso,
            onDismiss = { targetPlanToSchedule = null },
            onSave = { availableFromDate ->
                viewModel.updateWorkoutPlanSchedule(plan.id, availableFromDate)
                targetPlanToSchedule = null
            }
        )
    }

    targetPlanForExercise?.let { plan ->
        val previousExercise = state.workoutPlanItems
            .filter { it.planId == plan.id }
            .maxByOrNull { it.orderIndex }
        AddExerciseToPlanDialog(
            planTitle = plan.title,
            exercises = state.exercises,
            previousExercise = previousExercise,
            onDismiss = { targetPlanForExercise = null },
            onAdd = { exercise, sets, reps, load, rest, notes, groupWithPrevious ->
                viewModel.addExerciseToPlan(
                    planId = plan.id,
                    exercise = exercise,
                    sets = sets,
                    reps = reps,
                    loadKg = load,
                    restSeconds = rest,
                    notes = notes,
                    groupWithPrevious = groupWithPrevious
                )
                targetPlanForExercise = null
            }
        )
    }

    historyTargetItem?.let { exItem ->
        if (selectedClient != null) {
            ExerciseProgressDialog(
                clientId = selectedClient.id,
                clientName = selectedClient.name,
                exerciseId = exItem.exerciseId,
                exerciseName = exItem.exerciseName,
                workoutLoadLogs = state.workoutLoadLogs,
                currentLoadKg = exItem.loadKg,
                onDismiss = { historyTargetItem = null }
            )
        }
    }
}

@Composable
fun WorkoutPlanExerciseRow(
    index: Int,
    item: WorkoutPlanItemRecord,
    clientId: String = "",
    workoutPlans: List<WorkoutPlanRecord> = emptyList(),
    workoutPlanItems: List<WorkoutPlanItemRecord> = emptyList(),
    workoutLoadLogs: List<WorkoutLoadLogRecord> = emptyList(),
    labelPrefix: String? = null,
    isSupersetNonLast: Boolean = false,
    isSupersetLast: Boolean = false,
    onOpenHistory: (() -> Unit)? = null,
    onRemove: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = "${labelPrefix ?: index.toString()}. ${item.exerciseName}",
                style = MaterialTheme.typography.titleSmall,
                color = TextPrimaryDark
            )
            val loadPart = if (item.loadKg.isNotBlank()) " · ${item.loadKg}" else ""
            val restPart = when {
                isSupersetNonLast -> "Sem descanso → passa ao seguinte"
                isSupersetLast -> "Descanso após bloco: ${item.restSeconds}s"
                else -> "Descanso ${item.restSeconds}s"
            }
            Text(
                text = "${item.sets} séries × ${item.reps}$loadPart · $restPart",
                style = MaterialTheme.typography.bodySmall,
                color = NewShapeGold
            )
            if (clientId.isNotBlank()) {
                ExerciseLastLoadBadge(
                    item = item,
                    clientId = clientId,
                    workoutPlans = workoutPlans,
                    workoutPlanItems = workoutPlanItems,
                    workoutLoadLogs = workoutLoadLogs,
                    onOpenHistory = onOpenHistory
                )
            }
            if (item.notes.isNotBlank()) {
                Text(item.notes, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
            }
        }
        if (onRemove != null) {
            IconButton(onClick = onRemove) {
                Icon(Icons.Default.Close, contentDescription = "Remover exercício", tint = DangerRed, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun ExerciseLibrarySection(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val context = LocalContext.current
    var search by remember { mutableStateOf("") }
    var selectedGroup by remember { mutableStateOf("Todos") }
    var showAddExerciseDialog by remember { mutableStateOf(false) }

    val groups = remember(state.exercises) {
        listOf("Todos") + state.exercises.map { it.muscleGroup }.distinct().sorted()
    }

    val filtered = remember(state.exercises, search, selectedGroup) {
        val q = search.trim()
        state.exercises.filter { ex ->
            (selectedGroup == "Todos" || ex.muscleGroup == selectedGroup) &&
                (q.isBlank() ||
                    ex.name.contains(q, ignoreCase = true) ||
                    ex.equipment.contains(q, ignoreCase = true) ||
                    ex.muscleGroup.contains(q, ignoreCase = true) ||
                    ex.instructions.contains(q, ignoreCase = true))
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Biblioteca de Exercícios", style = MaterialTheme.typography.titleLarge, color = TextPrimaryDark)
                    Text(
                        "${filtered.size} de ${state.exercises.size} exercício(s)",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondaryDark
                    )
                }
                GoldPrimaryButton(
                    text = "+ Acrescentar",
                    onClick = { showAddExerciseDialog = true },
                    testTag = "add_exercise_button"
                )
            }
        }

        item {
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                placeholder = { Text("Procurar exercício, nome EN ou equipamento...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondaryDark) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = darkFieldColors()
            )
        }

        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(groups) { grp ->
                    FilterChip(
                        selected = selectedGroup == grp,
                        onClick = { selectedGroup = grp },
                        label = { Text(grp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NewShapeGold,
                            selectedLabelColor = TextOnGold
                        )
                    )
                }
            }
        }

        items(filtered, key = { it.id }) { ex ->
            val videoUrl = remember(ex.instructions) {
                Regex("https://\\S+").find(ex.instructions)?.value.orEmpty()
            }
            val cleanInstructions = remember(ex.instructions) {
                ex.instructions
                    .replace(Regex("\\s*·?\\s*Vídeo:\\s*https://\\S+", RegexOption.IGNORE_CASE), "")
                    .replace(Regex("https://\\S+"), "")
                    .trim()
            }
            Surface(
                color = CharcoalSurface,
                shape = MaterialTheme.shapes.medium,
                border = BorderStroke(1.dp, HairlineBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(ex.name, style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                        Spacer(Modifier.height(4.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            StatusPill(ex.muscleGroup, NewShapeGoldBright, NewShapeGoldMuted)
                            if (ex.equipment.isNotBlank()) {
                                StatusPill(ex.equipment, TextSecondaryDark, ElevatedCharcoal)
                            }
                            if (ex.custom) {
                                StatusPill("Personalizado", InfoBlue, InfoBlueContainer)
                            }
                        }
                        if (cleanInstructions.isNotBlank()) {
                            Spacer(Modifier.height(6.dp))
                            Text(cleanInstructions, style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                        }
                        if (videoUrl.isNotBlank()) {
                            Spacer(Modifier.height(6.dp))
                            TextButton(
                                onClick = {
                                    runCatching {
                                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(videoUrl)))
                                    }
                                },
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.PlayCircleOutline,
                                    contentDescription = "Ver vídeo de execução",
                                    tint = NewShapeGoldBright,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(Modifier.width(4.dp))
                                Text("Ver vídeo", color = NewShapeGoldBright, style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }
                    if (ex.custom) {
                        IconButton(onClick = { viewModel.deleteExercise(ex.id) }) {
                            Icon(Icons.Default.DeleteOutline, contentDescription = "Apagar exercício", tint = DangerRed)
                        }
                    }
                }
            }
        }
    }

    if (showAddExerciseDialog) {
        AddCustomExerciseDialog(
            onDismiss = { showAddExerciseDialog = false },
            onSave = { name, group, equip, instructions ->
                viewModel.addCustomExercise(name, group, equip, instructions)
                showAddExerciseDialog = false
            }
        )
    }
}

private fun addDaysLocalIso(days: Int): String {
    val cal = Calendar.getInstance()
    cal.add(Calendar.DAY_OF_MONTH, days)
    return String.format(
        Locale.US,
        "%04d-%02d-%02d",
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH) + 1,
        cal.get(Calendar.DAY_OF_MONTH)
    )
}

private fun nextMondayLocalIso(): String {
    val cal = Calendar.getInstance()
    val dow = cal.get(Calendar.DAY_OF_WEEK)
    val daysUntilMonday = when (dow) {
        Calendar.MONDAY -> 7
        Calendar.SUNDAY -> 1
        else -> (Calendar.SATURDAY - dow) + 2
    }
    cal.add(Calendar.DAY_OF_MONTH, daysUntilMonday)
    return String.format(
        Locale.US,
        "%04d-%02d-%02d",
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH) + 1,
        cal.get(Calendar.DAY_OF_MONTH)
    )
}

private fun isoDateToUtcMillis(iso: String): Long? {
    val m = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").matchEntire(iso.trim()) ?: return null
    val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
    cal.clear()
    cal.set(
        m.groupValues[1].toInt(),
        m.groupValues[2].toInt() - 1,
        m.groupValues[3].toInt(),
        12,
        0,
        0
    )
    return cal.timeInMillis
}

private fun utcMillisToIsoDate(millis: Long): String {
    val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
    cal.timeInMillis = millis
    return String.format(
        Locale.US,
        "%04d-%02d-%02d",
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH) + 1,
        cal.get(Calendar.DAY_OF_MONTH)
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlanAccessScheduleSelector(
    isScheduled: Boolean,
    onIsScheduledChange: (Boolean) -> Unit,
    selectedIsoDate: String,
    onSelectedIsoDateChange: (String) -> Unit
) {
    var showDatePicker by remember { mutableStateOf(false) }
    val tomorrowIso = remember { addDaysLocalIso(1) }
    val nextMonIso = remember { nextMondayLocalIso() }
    val plus7Iso = remember { addDaysLocalIso(7) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            "Acesso do aluno",
            style = MaterialTheme.typography.labelMedium,
            color = NewShapeGoldBright
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = !isScheduled,
                onClick = { onIsScheduledChange(false) },
                modifier = Modifier
                    .weight(1f)
                    .testTag("plan_access_immediate_chip"),
                label = { Text("Imediato", maxLines = 1) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = NewShapeGold,
                    selectedLabelColor = TextOnGold,
                    containerColor = ElevatedCharcoal,
                    labelColor = TextSecondaryDark
                )
            )
            FilterChip(
                selected = isScheduled,
                onClick = {
                    if (selectedIsoDate.isBlank()) {
                        onSelectedIsoDateChange(tomorrowIso)
                    }
                    onIsScheduledChange(true)
                },
                modifier = Modifier
                    .weight(1f)
                    .testTag("plan_access_scheduled_chip"),
                label = { Text("Agendar dia", maxLines = 1) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = NewShapeGold,
                    selectedLabelColor = TextOnGold,
                    containerColor = ElevatedCharcoal,
                    labelColor = TextSecondaryDark
                )
            )
        }

        if (isScheduled) {
            val activeDate = selectedIsoDate.ifBlank { tomorrowIso }
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                item {
                    FilterChip(
                        selected = activeDate == tomorrowIso,
                        onClick = { onSelectedIsoDateChange(tomorrowIso) },
                        label = { Text("Amanhã") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = PendingAmber,
                            selectedLabelColor = TextOnGold,
                            containerColor = ElevatedCharcoal,
                            labelColor = TextSecondaryDark
                        )
                    )
                }
                item {
                    FilterChip(
                        selected = activeDate == nextMonIso,
                        onClick = { onSelectedIsoDateChange(nextMonIso) },
                        label = { Text("Próx. Segunda") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = PendingAmber,
                            selectedLabelColor = TextOnGold,
                            containerColor = ElevatedCharcoal,
                            labelColor = TextSecondaryDark
                        )
                    )
                }
                item {
                    FilterChip(
                        selected = activeDate == plus7Iso,
                        onClick = { onSelectedIsoDateChange(plus7Iso) },
                        label = { Text("+7 dias") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = PendingAmber,
                            selectedLabelColor = TextOnGold,
                            containerColor = ElevatedCharcoal,
                            labelColor = TextSecondaryDark
                        )
                    )
                }
            }

            Surface(
                color = ElevatedCharcoal,
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, PendingAmber.copy(alpha = 0.5f)),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { showDatePicker = true }
                    .testTag("plan_access_date_picker_btn")
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.CalendarMonth,
                            contentDescription = "Escolher data de acesso",
                            tint = PendingAmber,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            "Disponível em ${formatIsoDatePt(activeDate)}",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimaryDark
                        )
                    }
                    Text(
                        "Alterar",
                        style = MaterialTheme.typography.labelSmall,
                        color = NewShapeGoldBright,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            Text(
                "O aluno só terá acesso a este plano a partir do dia ${formatIsoDatePt(activeDate)}.",
                style = MaterialTheme.typography.labelSmall,
                color = TextSecondaryDark
            )

            if (showDatePicker) {
                val datePickerState = rememberDatePickerState(
                    initialSelectedDateMillis = isoDateToUtcMillis(activeDate)
                )
                DatePickerDialog(
                    onDismissRequest = { showDatePicker = false },
                    confirmButton = {
                        TextButton(
                            onClick = {
                                datePickerState.selectedDateMillis?.let { millis ->
                                    onSelectedIsoDateChange(utcMillisToIsoDate(millis))
                                }
                                showDatePicker = false
                            }
                        ) {
                            Text("Confirmar", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { showDatePicker = false }) {
                            Text("Cancelar", color = TextSecondaryDark)
                        }
                    }
                ) {
                    DatePicker(state = datePickerState)
                }
            }
        }
    }
}

@Composable
private fun NewWorkoutPlanDialog(
    clients: List<ClientRecord>,
    initialClientId: String,
    defaultUnassigned: Boolean = false,
    onDismiss: () -> Unit,
    onCreate: (List<String>, String, String, String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var splitLabel by remember { mutableStateOf("Treino A · Corpo Inteiro") }
    var assignNow by remember(defaultUnassigned, clients.isEmpty()) {
        mutableStateOf(!defaultUnassigned && clients.isNotEmpty())
    }
    var selectedIds by remember(initialClientId) {
        mutableStateOf(if (initialClientId.isNotBlank()) setOf(initialClientId) else emptySet())
    }
    var isScheduled by remember { mutableStateOf(false) }
    var scheduledDate by remember { mutableStateOf(addDaysLocalIso(1)) }
    val allSelected = clients.isNotEmpty() && selectedIds.size == clients.size

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Novo Plano de Treino", color = TextPrimaryDark) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Nome do Plano (ex: Hipertrofia 3x)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = darkFieldColors()
                )
                OutlinedTextField(
                    value = splitLabel,
                    onValueChange = { splitLabel = it },
                    label = { Text("Divisão / Dia (ex: Treino A · Membros Superiores)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = darkFieldColors()
                )

                Text(
                    "Destino do plano",
                    style = MaterialTheme.typography.labelMedium,
                    color = NewShapeGoldBright
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = !assignNow,
                        onClick = { assignNow = false },
                        modifier = Modifier
                            .weight(1f)
                            .testTag("new_plan_unassigned_chip"),
                        label = { Text("Sem aluno", maxLines = 1) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NewShapeGold,
                            selectedLabelColor = TextOnGold,
                            containerColor = ElevatedCharcoal,
                            labelColor = TextSecondaryDark
                        )
                    )
                    FilterChip(
                        selected = assignNow,
                        enabled = clients.isNotEmpty(),
                        onClick = {
                            assignNow = true
                            if (selectedIds.isEmpty() && initialClientId.isNotBlank()) {
                                selectedIds = setOf(initialClientId)
                            }
                        },
                        modifier = Modifier
                            .weight(1f)
                            .testTag("new_plan_assign_now_chip"),
                        label = { Text("Atribuir já", maxLines = 1) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NewShapeGold,
                            selectedLabelColor = TextOnGold,
                            containerColor = ElevatedCharcoal,
                            labelColor = TextSecondaryDark
                        )
                    )
                }

                if (!assignNow) {
                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            "O plano fica guardado em \"Sem Aluno\" para poderes montar os exercícios com calma e atribuir depois aos alunos (com data agendada se quiseres).",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Atribuir a alunos (${selectedIds.size})",
                            style = MaterialTheme.typography.labelMedium,
                            color = NewShapeGoldBright
                        )
                        TextButton(
                            onClick = {
                                selectedIds = if (allSelected) emptySet() else clients.map { it.id }.toSet()
                            }
                        ) {
                            Text(
                                if (allSelected) "Limpar" else "Selecionar todos",
                                color = NewShapeGold,
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth().heightIn(max = 160.dp)
                    ) {
                        LazyColumn {
                            items(clients, key = { it.id }) { c ->
                                val checked = c.id in selectedIds
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            selectedIds = if (checked) selectedIds - c.id else selectedIds + c.id
                                        }
                                        .padding(horizontal = 8.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Checkbox(
                                        checked = checked,
                                        onCheckedChange = {
                                            selectedIds = if (checked) selectedIds - c.id else selectedIds + c.id
                                        },
                                        colors = CheckboxDefaults.colors(
                                            checkedColor = NewShapeGold,
                                            checkmarkColor = TextOnGold,
                                            uncheckedColor = TextSecondaryDark
                                        )
                                    )
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(c.name, style = MaterialTheme.typography.bodySmall, color = TextPrimaryDark)
                                        Text(
                                            if (c.trainingType == "PERSONALIZADO") "Personalizado" else "Grupo",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = if (c.trainingType == "PERSONALIZADO") NewShapeGold else TextSecondaryDark
                                        )
                                    }
                                }
                            }
                        }
                    }

                    PlanAccessScheduleSelector(
                        isScheduled = isScheduled,
                        onIsScheduledChange = { isScheduled = it },
                        selectedIsoDate = scheduledDate,
                        onSelectedIsoDateChange = { scheduledDate = it }
                    )
                }
            }
        },
        confirmButton = {
            val canSubmit = title.isNotBlank() && (!assignNow || selectedIds.isNotEmpty())
            GoldPrimaryButton(
                text = when {
                    !assignNow -> "Guardar sem aluno"
                    selectedIds.size > 1 -> "Criar (${selectedIds.size} alunos)"
                    else -> "Criar Plano"
                },
                enabled = canSubmit,
                onClick = {
                    val targetIds = if (assignNow) selectedIds.toList() else emptyList()
                    val dateToSave = if (assignNow && isScheduled) scheduledDate else ""
                    onCreate(targetIds, title, splitLabel, dateToSave)
                },
                testTag = "confirm_create_plan_btn"
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
}

@Composable
private fun AssignWorkoutPlanDialog(
    plan: WorkoutPlanRecord,
    exerciseCount: Int,
    candidates: List<ClientRecord>,
    onDismiss: () -> Unit,
    onAssign: (List<String>, String) -> Unit
) {
    var selectedIds by remember(plan.id) { mutableStateOf(emptySet<String>()) }
    var isScheduled by remember(plan.id) { mutableStateOf(false) }
    var scheduledDate by remember(plan.id) { mutableStateOf(addDaysLocalIso(1)) }
    val allSelected = candidates.isNotEmpty() && selectedIds.size == candidates.size
    val isDraft = plan.isUnassignedDraft()

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = {
            Text(
                if (isDraft) "Atribuir plano a alunos" else "Adicionar a mais alunos",
                color = TextPrimaryDark
            )
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    "Copia o plano \"${plan.title}\" ($exerciseCount exercício(s)) para os alunos selecionados. Cada aluno recebe uma cópia independente para registar cargas em kg.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Selecionados: ${selectedIds.size}",
                        style = MaterialTheme.typography.labelMedium,
                        color = NewShapeGoldBright
                    )
                    TextButton(
                        onClick = {
                            selectedIds = if (allSelected) emptySet() else candidates.map { it.id }.toSet()
                        }
                    ) {
                        Text(
                            if (allSelected) "Limpar" else "Selecionar todos",
                            color = NewShapeGold,
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }
                Surface(
                    color = ElevatedCharcoal,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth().heightIn(max = 180.dp)
                ) {
                    LazyColumn {
                        items(candidates, key = { it.id }) { c ->
                            val checked = c.id in selectedIds
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        selectedIds = if (checked) selectedIds - c.id else selectedIds + c.id
                                    }
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Checkbox(
                                    checked = checked,
                                    onCheckedChange = {
                                        selectedIds = if (checked) selectedIds - c.id else selectedIds + c.id
                                    },
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = NewShapeGold,
                                        checkmarkColor = TextOnGold,
                                        uncheckedColor = TextSecondaryDark
                                    )
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(c.name, style = MaterialTheme.typography.bodySmall, color = TextPrimaryDark)
                                    Text(
                                        if (c.trainingType == "PERSONALIZADO") "Personalizado" else "Grupo",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (c.trainingType == "PERSONALIZADO") NewShapeGold else TextSecondaryDark
                                    )
                                }
                            }
                        }
                    }
                }

                PlanAccessScheduleSelector(
                    isScheduled = isScheduled,
                    onIsScheduledChange = { isScheduled = it },
                    selectedIsoDate = scheduledDate,
                    onSelectedIsoDateChange = { scheduledDate = it }
                )
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = if (isDraft) "Atribuir (${selectedIds.size})" else "Adicionar (${selectedIds.size})",
                enabled = selectedIds.isNotEmpty(),
                onClick = {
                    val dateToSave = if (isScheduled) scheduledDate else ""
                    onAssign(selectedIds.toList(), dateToSave)
                },
                testTag = "confirm_assign_plan_btn"
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
}

@Composable
private fun SchedulePlanAccessDialog(
    plan: WorkoutPlanRecord,
    todayIso: String,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit
) {
    val initialScheduled = plan.isScheduledForFuture(todayIso)
    var isScheduled by remember(plan.id) { mutableStateOf(initialScheduled) }
    var scheduledDate by remember(plan.id) {
        mutableStateOf(if (initialScheduled) plan.availableFromDate else addDaysLocalIso(1))
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Agendar acesso do aluno", color = TextPrimaryDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Define quando o plano \"${plan.title}\" fica disponível no portal do aluno.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
                PlanAccessScheduleSelector(
                    isScheduled = isScheduled,
                    onIsScheduledChange = { isScheduled = it },
                    selectedIsoDate = scheduledDate,
                    onSelectedIsoDateChange = { scheduledDate = it }
                )
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = if (isScheduled) "Guardar data" else "Libertar agora",
                onClick = { onSave(if (isScheduled) scheduledDate else "") },
                testTag = "confirm_schedule_plan_btn"
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
}

@Composable
private fun AddExerciseToPlanDialog(
    planTitle: String,
    exercises: List<ExerciseRecord>,
    previousExercise: WorkoutPlanItemRecord? = null,
    onDismiss: () -> Unit,
    onAdd: (ExerciseRecord, Int, String, String, Int, String, Boolean) -> Unit
) {
    var search by remember { mutableStateOf("") }
    var groupFilter by remember { mutableStateOf("Todos") }
    val groups = remember(exercises) {
        listOf("Todos") + exercises.map { it.muscleGroup }.distinct().sorted()
    }
    val filtered = remember(exercises, search, groupFilter) {
        val q = search.trim()
        exercises.filter {
            (groupFilter == "Todos" || it.muscleGroup == groupFilter) &&
                (q.isBlank() ||
                    it.name.contains(q, ignoreCase = true) ||
                    it.muscleGroup.contains(q, ignoreCase = true) ||
                    it.equipment.contains(q, ignoreCase = true) ||
                    it.instructions.contains(q, ignoreCase = true))
        }
    }
    var selectedExercise by remember { mutableStateOf(exercises.firstOrNull()) }
    var setsText by remember { mutableStateOf("3") }
    var repsText by remember { mutableStateOf("10-12") }
    var loadText by remember { mutableStateOf("") }
    var restText by remember { mutableStateOf("90") }
    var notesText by remember { mutableStateOf("") }
    var groupWithPrevious by remember(planTitle, previousExercise?.id) { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Adicionar a $planTitle", color = TextPrimaryDark) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it },
                    label = { Text("Filtrar exercício, músculo ou equipamento...") },
                    singleLine = true,
                    colors = darkFieldColors()
                )
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(groups) { g ->
                        FilterChip(
                            selected = groupFilter == g,
                            onClick = { groupFilter = g },
                            label = { Text(g) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
                Surface(
                    color = ElevatedCharcoal,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth().heightIn(max = 175.dp)
                ) {
                    LazyColumn {
                        items(filtered, key = { it.id }) { ex ->
                            val isSel = selectedExercise?.id == ex.id
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedExercise = ex }
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = isSel,
                                    onClick = { selectedExercise = ex },
                                    colors = RadioButtonDefaults.colors(selectedColor = NewShapeGold)
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(ex.name, style = MaterialTheme.typography.bodySmall, color = TextPrimaryDark)
                                    Text(
                                        "${ex.muscleGroup}${if (ex.equipment.isNotBlank()) " · ${ex.equipment}" else ""}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = NewShapeGold
                                    )
                                }
                            }
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = setsText,
                        onValueChange = { setsText = it.filter { c -> c.isDigit() } },
                        label = { Text("Séries") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
                    OutlinedTextField(
                        value = repsText,
                        onValueChange = { repsText = it },
                        label = { Text("Reps") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = loadText,
                        onValueChange = { loadText = it },
                        label = { Text("Carga (ex: 40 kg)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
                    OutlinedTextField(
                        value = restText,
                        onValueChange = { restText = it.filter { c -> c.isDigit() } },
                        label = { Text(if (groupWithPrevious) "Descanso após bloco (s)" else "Descanso (s)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
                }
                if (previousExercise != null) {
                    Surface(
                        color = if (groupWithPrevious) NewShapeGoldMuted else ElevatedCharcoal,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(
                            1.dp,
                            if (groupWithPrevious) NewShapeGold else HairlineBorder
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { groupWithPrevious = !groupWithPrevious }
                            .testTag("toggle_group_with_previous")
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 8.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = groupWithPrevious,
                                onCheckedChange = { groupWithPrevious = it },
                                colors = CheckboxDefaults.colors(
                                    checkedColor = NewShapeGold,
                                    checkmarkColor = TextOnGold,
                                    uncheckedColor = TextSecondaryDark
                                )
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Agrupar com o anterior (${previousExercise.exerciseName})",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (groupWithPrevious) NewShapeGoldBright else TextPrimaryDark
                                )
                                Text(
                                    text = "Executar os 2 seguidos sem descanso entre eles",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = TextSecondaryDark
                                )
                            }
                        }
                    }
                }
                OutlinedTextField(
                    value = notesText,
                    onValueChange = { notesText = it },
                    label = { Text("Observações técnicas") },
                    singleLine = true,
                    colors = darkFieldColors()
                )
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = if (groupWithPrevious) "Adicionar em Bi-set" else "Adicionar",
                enabled = selectedExercise != null,
                onClick = {
                    selectedExercise?.let { ex ->
                        onAdd(
                            ex,
                            setsText.toIntOrNull()?.coerceIn(1, 30) ?: 3,
                            repsText.ifBlank { "10-12" },
                            loadText,
                            restText.toIntOrNull()?.coerceIn(0, 600) ?: 90,
                            notesText,
                            groupWithPrevious
                        )
                    }
                },
                testTag = "confirm_add_exercise_to_plan_btn"
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
}

@Composable
private fun AddCustomExerciseDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, String, String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var group by remember { mutableStateOf("Peito") }
    var equipment by remember { mutableStateOf("Halteres") }
    var instructions by remember { mutableStateOf("") }

    val groups = SeedCatalog.defaultMuscleGroups

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Acrescentar Exercício", color = TextPrimaryDark) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nome do exercício") },
                    singleLine = true,
                    colors = darkFieldColors()
                )
                Text("Grupo muscular", style = MaterialTheme.typography.labelMedium, color = TextSecondaryDark)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(groups) { g ->
                        FilterChip(
                            selected = group == g,
                            onClick = { group = g },
                            label = { Text(g) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
                OutlinedTextField(
                    value = equipment,
                    onValueChange = { equipment = it },
                    label = { Text("Equipamento (Barra, Halteres, Máquina...)") },
                    singleLine = true,
                    colors = darkFieldColors()
                )
                OutlinedTextField(
                    value = instructions,
                    onValueChange = { instructions = it },
                    label = { Text("Notas / Execução") },
                    minLines = 2,
                    colors = darkFieldColors()
                )
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Guardar Exercício",
                enabled = name.isNotBlank(),
                onClick = { onSave(name, group, equipment, instructions) }
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
}
