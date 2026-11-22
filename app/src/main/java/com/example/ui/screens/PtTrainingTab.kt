package com.example.ui.screens

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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.model.ClientRecord
import com.example.data.model.ExerciseRecord
import com.example.data.model.WorkoutLoadLogRecord
import com.example.data.model.WorkoutPlanItemRecord
import com.example.data.model.WorkoutPlanRecord
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*

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
    val subTabs = listOf("Planos", "Agenda", "Exercícios (${state.exercises.size})")

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(
            selectedTabIndex = selectedSubTab,
            containerColor = CharcoalSurface,
            contentColor = NewShapeGold,
            divider = { HorizontalDivider(color = HairlineBorder) }
        ) {
            subTabs.forEachIndexed { idx, title ->
                Tab(
                    selected = selectedSubTab == idx,
                    onClick = { selectedSubTab = idx },
                    modifier = Modifier.testTag("pt_training_subtab_$idx"),
                    text = {
                        Text(
                            text = title,
                            maxLines = 1,
                            fontWeight = if (selectedSubTab == idx) FontWeight.Bold else FontWeight.Medium,
                            color = if (selectedSubTab == idx) NewShapeGold else TextSecondaryDark
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
            1 -> PtTrainingAgendaSection(
                state = state,
                viewModel = viewModel,
                onOpenClientPlan = { cid ->
                    selectedClientId = cid
                    selectedSubTab = 0
                }
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

    var showNewPlanDialog by remember { mutableStateOf(false) }
    var targetPlanForExercise by remember { mutableStateOf<WorkoutPlanRecord?>(null) }
    var targetPlanToAssign by remember { mutableStateOf<WorkoutPlanRecord?>(null) }
    var historyTargetItem by remember { mutableStateOf<WorkoutPlanItemRecord?>(null) }

    val clientPlans = remember(state.workoutPlans, selectedClient?.id) {
        if (selectedClient == null) emptyList()
        else state.workoutPlans.filter { it.clientId == selectedClient.id }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            BrandCard {
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
                Spacer(Modifier.height(12.dp))
                GoldPrimaryButton(
                    text = "+ Novo Plano de Treino",
                    icon = Icons.Default.Add,
                    enabled = selectedClient != null,
                    onClick = { showNewPlanDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                    testTag = "create_workout_plan_btn"
                )
            }
        }

        if (clientPlans.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.FitnessCenter,
                    title = "Sem planos atribuídos",
                    subtitle = "Cria um plano para ${selectedClient?.name ?: "este aluno"} e escolhe exercícios da biblioteca."
                )
            }
        } else {
            items(clientPlans, key = { it.id }) { plan ->
                val items = state.workoutPlanItems.filter { it.planId == plan.id }.sortedBy { it.orderIndex }
                BrandCard(highlightBorder = true) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(plan.title, style = MaterialTheme.typography.titleLarge, color = TextPrimaryDark)
                            if (plan.splitLabel.isNotBlank()) {
                                Text(plan.splitLabel, style = MaterialTheme.typography.bodySmall, color = NewShapeGoldBright)
                            }
                        }
                        IconButton(onClick = { viewModel.deleteWorkoutPlan(plan.id) }) {
                            Icon(Icons.Default.DeleteOutline, contentDescription = "Apagar plano", tint = DangerRed)
                        }
                    }

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
                        items.forEachIndexed { idx, exItem ->
                            WorkoutPlanExerciseRow(
                                index = idx + 1,
                                item = exItem,
                                clientId = plan.clientId,
                                workoutPlans = state.workoutPlans,
                                workoutPlanItems = state.workoutPlanItems,
                                workoutLoadLogs = state.workoutLoadLogs,
                                onOpenHistory = { historyTargetItem = exItem },
                                onRemove = { viewModel.removeExerciseFromPlan(exItem.id) }
                            )
                            if (idx < items.lastIndex) {
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
                    if (activeClients.size > 1) {
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

    if (showNewPlanDialog && selectedClient != null) {
        NewWorkoutPlanDialog(
            clients = activeClients,
            initialClientId = selectedClient.id,
            onDismiss = { showNewPlanDialog = false },
            onCreate = { selectedIds, title, split ->
                viewModel.createWorkoutPlansForClients(selectedIds, title, split)
                showNewPlanDialog = false
            }
        )
    }

    targetPlanToAssign?.let { plan ->
        val otherClients = activeClients.filter { it.id != plan.clientId }
        AssignWorkoutPlanDialog(
            plan = plan,
            exerciseCount = state.workoutPlanItems.count { it.planId == plan.id },
            candidates = otherClients,
            onDismiss = { targetPlanToAssign = null },
            onAssign = { targetIds ->
                viewModel.assignWorkoutPlanToClients(plan, targetIds)
                targetPlanToAssign = null
            }
        )
    }

    targetPlanForExercise?.let { plan ->
        AddExerciseToPlanDialog(
            planTitle = plan.title,
            exercises = state.exercises,
            onDismiss = { targetPlanForExercise = null },
            onAdd = { exercise, sets, reps, load, rest, notes ->
                viewModel.addExerciseToPlan(plan.id, exercise, sets, reps, load, rest, notes)
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
                text = "$index. ${item.exerciseName}",
                style = MaterialTheme.typography.titleSmall,
                color = TextPrimaryDark
            )
            val loadPart = if (item.loadKg.isNotBlank()) " · ${item.loadKg}" else ""
            Text(
                text = "${item.sets} séries × ${item.reps}$loadPart · Descanso ${item.restSeconds}s",
                style = MaterialTheme.typography.bodySmall,
                color = NewShapeGold
            )
            ExerciseLastLoadBadge(
                item = item,
                clientId = clientId,
                workoutPlans = workoutPlans,
                workoutPlanItems = workoutPlanItems,
                workoutLoadLogs = workoutLoadLogs,
                onOpenHistory = onOpenHistory
            )
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
    var search by remember { mutableStateOf("") }
    var selectedGroup by remember { mutableStateOf("Todos") }
    var showAddExerciseDialog by remember { mutableStateOf(false) }

    val groups = remember(state.exercises) {
        listOf("Todos") + state.exercises.map { it.muscleGroup }.distinct().sorted()
    }

    val filtered = remember(state.exercises, search, selectedGroup) {
        state.exercises.filter { ex ->
            (selectedGroup == "Todos" || ex.muscleGroup == selectedGroup) &&
                (search.isBlank() || ex.name.contains(search, ignoreCase = true) || ex.equipment.contains(search, ignoreCase = true))
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
                Text("Biblioteca de Exercícios", style = MaterialTheme.typography.titleLarge, color = TextPrimaryDark)
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
                placeholder = { Text("Procurar exercício ou equipamento...") },
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
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(ex.name, style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                        }
                        Spacer(Modifier.height(4.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            StatusPill(ex.muscleGroup, NewShapeGoldBright, NewShapeGoldMuted)
                            StatusPill(ex.equipment, TextSecondaryDark, ElevatedCharcoal)
                            if (ex.custom) {
                                StatusPill("Personalizado", InfoBlue, InfoBlueContainer)
                            }
                        }
                        if (ex.instructions.isNotBlank()) {
                            Spacer(Modifier.height(6.dp))
                            Text(ex.instructions, style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
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

@Composable
private fun NewWorkoutPlanDialog(
    clients: List<ClientRecord>,
    initialClientId: String,
    onDismiss: () -> Unit,
    onCreate: (List<String>, String, String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var splitLabel by remember { mutableStateOf("Treino A · Corpo Inteiro") }
    var selectedIds by remember(initialClientId) {
        mutableStateOf(if (initialClientId.isNotBlank()) setOf(initialClientId) else emptySet())
    }
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
                    modifier = Modifier.fillMaxWidth().heightIn(max = 180.dp)
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
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = if (selectedIds.size > 1) "Criar (${selectedIds.size} alunos)" else "Criar Plano",
                enabled = title.isNotBlank() && selectedIds.isNotEmpty(),
                onClick = { onCreate(selectedIds.toList(), title, splitLabel) },
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
    onAssign: (List<String>) -> Unit
) {
    var selectedIds by remember(plan.id) { mutableStateOf(emptySet<String>()) }
    val allSelected = candidates.isNotEmpty() && selectedIds.size == candidates.size

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Adicionar a mais alunos", color = TextPrimaryDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Copia o plano \"${plan.title}\" ($exerciseCount exercício(s)) para os alunos selecionados. Cada aluno pode depois registar as suas cargas em kg.",
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
                    modifier = Modifier.fillMaxWidth().heightIn(max = 220.dp)
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
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Adicionar (${selectedIds.size})",
                enabled = selectedIds.isNotEmpty(),
                onClick = { onAssign(selectedIds.toList()) },
                testTag = "confirm_assign_plan_btn"
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
    onDismiss: () -> Unit,
    onAdd: (ExerciseRecord, Int, String, String, Int, String) -> Unit
) {
    var search by remember { mutableStateOf("") }
    val filtered = remember(exercises, search) {
        exercises.filter {
            search.isBlank() || it.name.contains(search, ignoreCase = true) || it.muscleGroup.contains(search, ignoreCase = true)
        }
    }
    var selectedExercise by remember { mutableStateOf(exercises.firstOrNull()) }
    var setsText by remember { mutableStateOf("3") }
    var repsText by remember { mutableStateOf("10-12") }
    var loadText by remember { mutableStateOf("") }
    var restText by remember { mutableStateOf("90") }
    var notesText by remember { mutableStateOf("") }

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
                    label = { Text("Filtrar exercício...") },
                    singleLine = true,
                    colors = darkFieldColors()
                )
                Surface(
                    color = ElevatedCharcoal,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth().heightIn(max = 170.dp)
                ) {
                    LazyColumn {
                        items(filtered, key = { it.id }) { ex ->
                            val isSel = selectedExercise?.id == ex.id
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = isSel,
                                    onClick = { selectedExercise = ex },
                                    colors = RadioButtonDefaults.colors(selectedColor = NewShapeGold)
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(ex.name, style = MaterialTheme.typography.bodySmall, color = TextPrimaryDark)
                                    Text(ex.muscleGroup, style = MaterialTheme.typography.labelSmall, color = NewShapeGold)
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
                        label = { Text("Descanso (s)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
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
                text = "Adicionar",
                enabled = selectedExercise != null,
                onClick = {
                    selectedExercise?.let { ex ->
                        onAdd(
                            ex,
                            setsText.toIntOrNull()?.coerceIn(1, 30) ?: 3,
                            repsText.ifBlank { "10-12" },
                            loadText,
                            restText.toIntOrNull()?.coerceIn(0, 600) ?: 90,
                            notesText
                        )
                    }
                }
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

    val groups = listOf("Peito", "Costas", "Pernas", "Ombros", "Braços", "Core", "Cardio")

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
