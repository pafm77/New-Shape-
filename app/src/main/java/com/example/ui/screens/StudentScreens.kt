package com.example.ui.screens

import android.Manifest
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.ReportExporter
import com.example.data.model.*
import com.example.notifications.WorkoutNotificationHelper
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*
import kotlinx.coroutines.delay
import java.util.Calendar

@Composable
fun StudentMainScaffold(
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    onSignOut: () -> Unit
) {
    val student = state.activeStudent
    if (student == null) {
        Box(
            modifier = Modifier.fillMaxSize().background(ObsidianBg),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                Text("Nenhum perfil de aluno selecionado", style = MaterialTheme.typography.titleLarge, color = TextPrimaryDark)
                Spacer(Modifier.height(12.dp))
                GoldPrimaryButton(text = "Escolher Perfil", onClick = { viewModel.backToRoleSelector() })
            }
        }
        return
    }

    var selectedTab by remember { mutableIntStateOf(0) }
    val firstName = student.name.trim().split(" ").firstOrNull().orEmpty()
    val unreadChatCount = remember(state.chatMessages, student.id) {
        state.unreadStudentChatCount(student.id)
    }

    LaunchedEffect(state.chatMessages, student.id) {
        val undeliveredIds = state.chatMessages
            .filter {
                it.clientId == student.id &&
                    it.senderRole == "PT" &&
                    it.deliveredAtMillis == 0L &&
                    it.readAtMillis == 0L
            }
            .map { it.id }
        if (undeliveredIds.isNotEmpty()) {
            viewModel.markChatMessagesDelivered(undeliveredIds)
        }
    }

    val navItems = listOf(
        Triple("Agenda", Icons.Default.CalendarMonth, "student_nav_agenda"),
        Triple("Treino", Icons.Default.FitnessCenter, "student_nav_workout"),
        Triple("Nutrição", Icons.Default.Restaurant, "student_nav_nutrition"),
        Triple("Avaliação", Icons.Default.MonitorWeight, "student_nav_assessment"),
        Triple("Mensal.", Icons.Default.Payments, "student_nav_billing"),
        Triple("Chat", Icons.AutoMirrored.Filled.Chat, "student_nav_chat")
    )

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBg)
    ) {
        val isWide = maxWidth >= 600.dp

        Scaffold(
            containerColor = ObsidianBg,
            contentWindowInsets = WindowInsets.safeDrawing,
            topBar = {
                Surface(color = CharcoalSurface, tonalElevation = 2.dp) {
                    Column {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            NewShapeLogo(compact = true)
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                TextButton(
                                    onClick = { viewModel.enterPtMode() },
                                    modifier = Modifier.testTag("switch_to_pt_btn")
                                ) {
                                    Icon(
                                        Icons.Default.SwapHoriz,
                                        contentDescription = "Vista PT",
                                        tint = NewShapeGold,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(Modifier.width(4.dp))
                                    Text("PT", color = NewShapeGold, fontWeight = FontWeight.Bold)
                                }
                                IconButton(
                                    onClick = { viewModel.backToRoleSelector() },
                                    modifier = Modifier.testTag("student_role_selector_btn")
                                ) {
                                    Icon(Icons.Default.SwitchAccount, contentDescription = "Trocar perfil", tint = TextSecondaryDark)
                                }
                                IconButton(
                                    onClick = onSignOut,
                                    modifier = Modifier.testTag("student_sign_out_btn")
                                ) {
                                    Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Terminar sessão Google", tint = TextSecondaryDark)
                                }
                            }
                        }

                        state.statusBannerMessage?.let { msg ->
                            Surface(
                                color = ElevatedCharcoal,
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(msg, style = MaterialTheme.typography.bodySmall, color = NewShapeGoldBright, modifier = Modifier.weight(1f))
                                    IconButton(onClick = { viewModel.clearBanner() }, modifier = Modifier.size(32.dp)) {
                                        Icon(Icons.Default.Close, contentDescription = "Fechar aviso", tint = TextSecondaryDark, modifier = Modifier.size(16.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            },
            bottomBar = {
                if (!isWide) {
                    NavigationBar(containerColor = CharcoalSurface, tonalElevation = 4.dp) {
                        navItems.forEachIndexed { idx, (label, icon, tag) ->
                            val badgeCount = if (idx == 5) unreadChatCount else 0
                            NavigationBarItem(
                                selected = selectedTab == idx,
                                onClick = { selectedTab = idx },
                                modifier = Modifier.testTag(tag),
                                icon = {
                                    BadgedBox(
                                        badge = {
                                            if (badgeCount > 0) {
                                                Badge(containerColor = DangerRed, contentColor = TextPrimaryDark) {
                                                    Text(badgeCount.toString())
                                                }
                                            }
                                        }
                                    ) {
                                        Icon(icon, contentDescription = label)
                                    }
                                },
                                label = { Text(label, fontSize = 10.sp, maxLines = 1, softWrap = false) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = NewShapeGold,
                                    selectedTextColor = NewShapeGold,
                                    indicatorColor = NewShapeGoldMuted,
                                    unselectedIconColor = TextSecondaryDark,
                                    unselectedTextColor = TextSecondaryDark
                                )
                            )
                        }
                    }
                }
            }
        ) { innerPadding ->
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                if (isWide) {
                    NavigationRail(containerColor = CharcoalSurface) {
                        Spacer(Modifier.height(12.dp))
                        navItems.forEachIndexed { idx, (label, icon, tag) ->
                            val badgeCount = if (idx == 5) unreadChatCount else 0
                            NavigationRailItem(
                                selected = selectedTab == idx,
                                onClick = { selectedTab = idx },
                                modifier = Modifier.testTag(tag),
                                icon = {
                                    BadgedBox(
                                        badge = {
                                            if (badgeCount > 0) {
                                                Badge(containerColor = DangerRed, contentColor = TextPrimaryDark) {
                                                    Text(badgeCount.toString())
                                                }
                                            }
                                        }
                                    ) {
                                        Icon(icon, contentDescription = label)
                                    }
                                },
                                label = { Text(label) },
                                colors = NavigationRailItemDefaults.colors(
                                    selectedIconColor = NewShapeGold,
                                    selectedTextColor = NewShapeGold,
                                    indicatorColor = NewShapeGoldMuted,
                                    unselectedIconColor = TextSecondaryDark,
                                    unselectedTextColor = TextSecondaryDark
                                )
                            )
                        }
                    }
                }

                Box(
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                    contentAlignment = Alignment.TopCenter
                ) {
                    Box(modifier = Modifier.fillMaxSize().widthIn(max = 840.dp)) {
                        when (selectedTab) {
                            0 -> StudentBookingScreen(student = student, state = state, viewModel = viewModel)
                            1 -> StudentWorkoutScreen(student = student, state = state, viewModel = viewModel)
                            2 -> StudentNutritionScreen(student = student, state = state, viewModel = viewModel)
                            3 -> StudentAssessmentScreen(student = student, state = state, viewModel = viewModel)
                            4 -> StudentBillingScreen(student = student, state = state)
                            5 -> PrivateChatScreen(
                                client = student,
                                messages = state.chatMessages.filter { it.clientId == student.id },
                                viewerRole = "STUDENT",
                                onSendMessage = { text -> viewModel.sendChatMessage(student.id, "STUDENT", text) },
                                onMarkRead = { viewModel.markChatThreadRead(student.id, "STUDENT") },
                                onBack = null
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StudentBookingScreen(
    student: ClientRecord,
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val context = LocalContext.current

    StudentAgendaSection(
        student = student,
        state = state,
        viewModel = viewModel
    )

    // Mandatory WhatsApp Handoff Modal when Student Cancels or Modifies Schedule
    state.pendingWhatsAppPrompt?.let { prompt ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissWhatsAppPrompt() },
            containerColor = CharcoalSurface,
            icon = {
                Icon(
                    Icons.Default.WarningAmber,
                    contentDescription = "Avisar o PT pelo WhatsApp",
                    tint = NewShapeGoldBright,
                    modifier = Modifier.size(32.dp)
                )
            },
            title = {
                Text(prompt.title, color = TextPrimaryDark, fontWeight = FontWeight.Bold)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(prompt.detail, style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                    Surface(
                        color = ElevatedCharcoal,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, HairlineBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = prompt.whatsappMessage,
                            style = MaterialTheme.typography.bodySmall,
                            color = TextPrimaryDark,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                    if (state.settings.ptWhatsappPhone.isBlank()) {
                        Text(
                            text = "Dica: ao abrir o WhatsApp, escolhe o contacto do teu PT na lista para enviar esta mensagem.",
                            style = MaterialTheme.typography.labelSmall,
                            color = NewShapeGold
                        )
                    }
                }
            },
            confirmButton = {
                GoldPrimaryButton(
                    text = "Enviar pelo WhatsApp",
                    icon = Icons.AutoMirrored.Filled.Chat,
                    onClick = {
                        openWhatsApp(
                            context = context,
                            phone9Digits = state.settings.ptWhatsappPhone.ifBlank { null },
                            message = prompt.whatsappMessage,
                            useWeb = state.settings.whatsappWebMode
                        )
                        viewModel.dismissWhatsAppPrompt()
                    },
                    testTag = "student_whatsapp_notify_pt_btn"
                )
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissWhatsAppPrompt() }) {
                    Text("Fechar", color = TextSecondaryDark)
                }
            }
        )
    }
}

@Composable
private fun StudentWorkoutScreen(
    student: ClientRecord,
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val plans = remember(state.workoutPlans, student.id) {
        state.workoutPlans.filter { it.clientId == student.id }
    }
    var executingPlanId by remember { mutableStateOf<String?>(null) }
    var completedExerciseIds by remember(executingPlanId) { mutableStateOf<Set<String>>(emptySet()) }
    var restSecondsLeft by remember { mutableIntStateOf(0) }
    var restExerciseName by remember { mutableStateOf("") }
    var historyTargetItem by remember { mutableStateOf<WorkoutPlanItemRecord?>(null) }

    LaunchedEffect(restSecondsLeft) {
        if (restSecondsLeft > 0) {
            delay(1000L)
            restSecondsLeft -= 1
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Os Meus Planos de Treino", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
            Text(
                "Inicia o treino para ver a carga do último treino, cronómetro de descanso e registar novas cargas (kg)",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondaryDark
            )
        }

        if (restSecondsLeft > 0) {
            item {
                Surface(
                    color = NewShapeGoldMuted,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.5.dp, NewShapeGold),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Descanso em curso", style = MaterialTheme.typography.labelMedium, color = NewShapeGoldBright)
                            Text(
                                text = "${restSecondsLeft}s · $restExerciseName",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimaryDark
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            TextButton(onClick = { restSecondsLeft += 15 }) {
                                Text("+15s", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                            }
                            TextButton(onClick = { restSecondsLeft = 0 }) {
                                Text("Parar", color = DangerRed)
                            }
                        }
                    }
                }
            }
        }

        if (plans.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.Default.FitnessCenter,
                    title = "Sem plano de treino ainda",
                    subtitle = "Assim que o teu PT adicionar um plano, vai aparecer aqui."
                )
            }
        } else {
            items(plans, key = { it.id }) { plan ->
                val items = state.workoutPlanItems.filter { it.planId == plan.id }.sortedBy { it.orderIndex }
                val isExecuting = executingPlanId == plan.id
                val doneCount = items.count { it.id in completedExerciseIds }

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
                        if (items.isNotEmpty()) {
                            if (isExecuting) {
                                StatusPill(
                                    text = "$doneCount/${items.size} feitos",
                                    textColor = ConfirmedGreen,
                                    containerColor = ConfirmedGreenContainer
                                )
                            } else {
                                GoldPrimaryButton(
                                    text = "Executar",
                                    icon = Icons.Default.PlayArrow,
                                    onClick = {
                                        executingPlanId = plan.id
                                        completedExerciseIds = emptySet()
                                    },
                                    testTag = "student_start_workout_${plan.id}"
                                )
                            }
                        }
                    }

                    if (isExecuting) {
                        Spacer(Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Modo Execução ativo · Carga do último treino visível em cada exercício",
                                style = MaterialTheme.typography.labelSmall,
                                color = ConfirmedGreen,
                                modifier = Modifier.weight(1f)
                            )
                            TextButton(
                                onClick = {
                                    executingPlanId = null
                                    restSecondsLeft = 0
                                },
                                modifier = Modifier.testTag("student_finish_workout_${plan.id}")
                            ) {
                                Text("Terminar", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Spacer(Modifier.height(8.dp))
                    HorizontalDivider(color = HairlineBorder)
                    if (items.isEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Text("Plano sem exercícios ainda.", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                    } else {
                        items.forEachIndexed { idx, exItem ->
                            StudentExerciseLoadRow(
                                index = idx + 1,
                                item = exItem,
                                clientId = student.id,
                                workoutPlans = state.workoutPlans,
                                workoutPlanItems = state.workoutPlanItems,
                                workoutLoadLogs = state.workoutLoadLogs,
                                isExecuting = isExecuting,
                                isCompleted = exItem.id in completedExerciseIds,
                                onToggleComplete = {
                                    completedExerciseIds = if (exItem.id in completedExerciseIds) {
                                        completedExerciseIds - exItem.id
                                    } else {
                                        completedExerciseIds + exItem.id
                                    }
                                },
                                onStartRest = {
                                    restSecondsLeft = exItem.restSeconds.coerceAtLeast(15)
                                    restExerciseName = exItem.exerciseName
                                },
                                onOpenHistory = { historyTargetItem = exItem },
                                onSaveLoad = { newLoad ->
                                    viewModel.updateWorkoutPlanItemLoad(
                                        itemId = exItem.id,
                                        loadKg = newLoad,
                                        previousLoadKg = exItem.loadKg
                                    )
                                }
                            )
                            if (idx < items.lastIndex) HorizontalDivider(color = HairlineBorder.copy(alpha = 0.5f))
                        }
                    }
                }
            }
        }
    }

    historyTargetItem?.let { exItem ->
        ExerciseProgressDialog(
            clientId = student.id,
            clientName = student.name,
            exerciseId = exItem.exerciseId,
            exerciseName = exItem.exerciseName,
            workoutLoadLogs = state.workoutLoadLogs,
            currentLoadKg = exItem.loadKg,
            onDismiss = { historyTargetItem = null }
        )
    }
}

@Composable
private fun StudentExerciseLoadRow(
    index: Int,
    item: WorkoutPlanItemRecord,
    clientId: String,
    workoutPlans: List<WorkoutPlanRecord>,
    workoutPlanItems: List<WorkoutPlanItemRecord>,
    workoutLoadLogs: List<WorkoutLoadLogRecord>,
    isExecuting: Boolean,
    isCompleted: Boolean,
    onToggleComplete: () -> Unit,
    onStartRest: () -> Unit,
    onOpenHistory: () -> Unit,
    onSaveLoad: (String) -> Unit
) {
    var loadInput by remember(item.id, item.loadKg) { mutableStateOf(item.loadKg) }
    val normalizedTrim = loadInput.trim()
    val hasChanges = normalizedTrim != item.loadKg.trim()

    val resolvedHistory = remember(item, clientId, workoutPlans, workoutPlanItems) {
        resolveLastExerciseLoad(
            item = item,
            clientId = clientId,
            workoutPlans = workoutPlans,
            workoutPlanItems = workoutPlanItems
        )
    }
    val lastWorkoutLoad = resolvedHistory.load

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "$index. ${item.exerciseName}",
                    style = MaterialTheme.typography.titleSmall,
                    color = if (isCompleted) ConfirmedGreen else TextPrimaryDark
                )
                Text(
                    text = "${item.sets} séries × ${item.reps} · Descanso ${item.restSeconds}s",
                    style = MaterialTheme.typography.bodySmall,
                    color = NewShapeGold
                )
            }
            if (isExecuting) {
                IconButton(
                    onClick = onToggleComplete,
                    modifier = Modifier.testTag("student_done_ex_${item.id}")
                ) {
                    Icon(
                        imageVector = if (isCompleted) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                        contentDescription = if (isCompleted) "Exercício concluído" else "Marcar exercício concluído",
                        tint = if (isCompleted) ConfirmedGreen else TextSecondaryDark
                    )
                }
            }
        }

        // Interactive Last-Workout Historical Load Badge & Expandable Tooltip + PR
        ExerciseLastLoadBadge(
            item = item,
            clientId = clientId,
            workoutPlans = workoutPlans,
            workoutPlanItems = workoutPlanItems,
            workoutLoadLogs = workoutLoadLogs,
            emphasize = isExecuting,
            onOpenHistory = onOpenHistory,
            modifier = Modifier.fillMaxWidth()
        )

        if (isExecuting) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = NewShapeGoldMuted,
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.6f)),
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable {
                            val numeric = parseNumericLoadKg(loadInput.ifBlank { lastWorkoutLoad })
                            if (numeric != null) {
                                val next = numeric + 2.5
                                loadInput = if (next % 1.0 == 0.0) "${next.toInt()} kg" else "${String.format("%.1f", next)} kg"
                            } else {
                                loadInput = "2.5 kg"
                            }
                        }
                        .testTag("student_inc_load_${item.id}")
                ) {
                    Text(
                        text = "+2.5 kg",
                        color = NewShapeGoldBright,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                    )
                }
                if (item.restSeconds > 0) {
                    Surface(
                        color = InfoBlueContainer,
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, InfoBlue.copy(alpha = 0.6f)),
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable(onClick = onStartRest)
                            .testTag("student_rest_timer_${item.id}")
                    ) {
                        Text(
                            text = "⏱ Descanso ${item.restSeconds}s",
                            color = InfoBlue,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                        )
                    }
                }
            }
        }

        if (item.notes.isNotBlank()) {
            Text(item.notes, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = loadInput,
                onValueChange = { loadInput = it.take(40) },
                label = { Text(if (isExecuting) "Carga de hoje (kg)" else "Carga (kg)") },
                placeholder = { Text("ex: 50 kg") },
                singleLine = true,
                modifier = Modifier
                    .weight(1f)
                    .testTag("student_load_input_${item.id}"),
                colors = darkFieldColors()
            )
            GoldPrimaryButton(
                text = "Guardar",
                enabled = hasChanges && normalizedTrim.isNotEmpty(),
                onClick = {
                    val formatted = if (normalizedTrim.matches(Regex("^\\d+([.,]\\d+)?$"))) {
                        "$normalizedTrim kg"
                    } else {
                        normalizedTrim
                    }
                    onSaveLoad(formatted)
                },
                testTag = "student_save_load_${item.id}"
            )
        }
    }
}

@Composable
private fun StudentNutritionScreen(
    student: ClientRecord,
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val entries = remember(state.nutritionEntries, student.id) {
        state.nutritionEntries.filter { it.clientId == student.id }
    }
    var addMealTarget by remember { mutableStateOf<MealType?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("As Minhas Refeições", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
            Text("Adiciona os teus alimentos em cada refeição", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
        }
        item {
            DailyMacrosSummaryCard(entries = entries)
        }
        items(MealType.entries.toList(), key = { it.name }) { meal ->
            MealCard(
                meal = meal,
                entries = entries.filter { it.mealType == meal.name },
                onAddFood = { addMealTarget = meal },
                onRemoveEntry = { entryId -> viewModel.removeNutritionEntry(entryId) }
            )
        }
    }

    addMealTarget?.let { meal ->
        AddFoodToMealDialog(
            mealLabel = meal.label,
            foods = state.foodItems,
            onDismiss = { addMealTarget = null },
            onAdd = { food, grams ->
                viewModel.addNutritionEntry(student.id, meal, food, grams)
                addMealTarget = null
            }
        )
    }
}

@Composable
private fun StudentAssessmentScreen(
    student: ClientRecord,
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val context = LocalContext.current
    val assessments = remember(state.physicalAssessments, student.id) {
        state.physicalAssessments
            .filter { it.clientId == student.id }
            .sortedBy { it.dateMillis }
    }
    var showNewDialog by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("A Minha Avaliação Física", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
                        Text("Regista peso, IMC, TMB e evolução", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                    }
                    GoldPrimaryButton(
                        text = "+ Nova",
                        icon = Icons.Default.Add,
                        onClick = { showNewDialog = true },
                        testTag = "student_add_assessment_button"
                    )
                }
                DarkSecondaryButton(
                    text = "Exportar Relatório PDF de Evolução",
                    icon = Icons.Default.PictureAsPdf,
                    onClick = {
                        val ok = ReportExporter.shareStudentEvolutionPdf(
                            context = context,
                            client = student,
                            assessments = state.physicalAssessments,
                            bookings = state.bookings,
                            workoutPlans = state.workoutPlans,
                            workoutPlanItems = state.workoutPlanItems,
                            workoutLoadLogs = state.workoutLoadLogs
                        )
                        if (!ok) {
                            Toast.makeText(context, "Erro ao gerar relatório PDF.", Toast.LENGTH_SHORT).show()
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("student_export_pdf_btn")
                )
            }
        }
        assessmentDashboardItems(
            assessments = assessments,
            onDelete = { id -> viewModel.deletePhysicalAssessment(id) }
        )
    }

    if (showNewDialog) {
        NewAssessmentDialog(
            clientName = student.name,
            latest = assessments.lastOrNull(),
            onDismiss = { showNewDialog = false },
            onSave = { weight, age, height, sex, fat, muscle, visceral, notes ->
                viewModel.addPhysicalAssessment(
                    clientId = student.id,
                    dateMillis = System.currentTimeMillis(),
                    weightKg = weight,
                    ageYears = age,
                    heightCm = height,
                    sex = sex,
                    bodyFatPct = fat,
                    muscleMassKg = muscle,
                    visceralFat = visceral,
                    notes = notes,
                    notifyPt = true
                )
                showNewDialog = false
            }
        )
    }
}

@Composable
private fun StudentBillingScreen(
    student: ClientRecord,
    state: StudioUiState
) {
    val payments = remember(state.payments, student.id) {
        state.payments.filter { it.clientId == student.id }
    }
    val fids = remember(state.fidelizacoes, student.id) {
        state.fidelizacoes.filter { it.clientId == student.id }
    }
    val currentPayment = payments.find { it.monthYear == state.currentMonthYear && it.paid }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Mensalidade & Fidelização", style = MaterialTheme.typography.headlineMedium, color = TextPrimaryDark)
        }

        if (student.monthlyFeeEur > 0.0 || student.fidelizacaoMonths > 0) {
            item {
                BrandCard {
                    Text("Plano Contratado", style = MaterialTheme.typography.titleSmall, color = NewShapeGoldBright)
                    Spacer(Modifier.height(4.dp))
                    if (student.monthlyFeeEur > 0.0) {
                        Text(
                            text = "Valor da mensalidade: €${String.format("%.2f", student.monthlyFeeEur)} / mês",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextPrimaryDark
                        )
                    }
                    if (student.fidelizacaoMonths > 0 && student.fidelizacaoStartMillis > 0L) {
                        val endCal = Calendar.getInstance().apply {
                            timeInMillis = student.fidelizacaoStartMillis
                            add(Calendar.MONTH, student.fidelizacaoMonths)
                        }
                        Text(
                            text = "Fidelização ${student.fidelizacaoMonths} meses: ${formatShortDate(student.fidelizacaoStartMillis)} → ${formatShortDate(endCal.timeInMillis)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    }
                }
            }
        }

        item {
            BrandCard(highlightBorder = currentPayment != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Estado (${state.currentMonthLabel})", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                        Text(
                            text = if (currentPayment != null) {
                                "Mensalidade paga (€${String.format("%.2f", currentPayment.amountEur)}) em ${formatShortDate(currentPayment.paidAtMillis)}"
                            } else {
                                "Pagamento ainda não registado este mês"
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = if (currentPayment != null) ConfirmedGreen else PendingAmber
                        )
                    }
                    StatusPill(
                        text = if (currentPayment != null) "Pago ✓" else "Pendente",
                        textColor = if (currentPayment != null) ConfirmedGreen else PendingAmber,
                        containerColor = if (currentPayment != null) ConfirmedGreenContainer else PendingAmberContainer
                    )
                }
            }
        }

        if (fids.isNotEmpty()) {
            item {
                Text("Fidelização Ativa", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
            }
            items(fids, key = { it.id }) { fid ->
                val daysLeft = ((fid.endDateMillis - System.currentTimeMillis()) / 86_400_000L).toInt()
                BrandCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Plano ${fid.durationMonths} Meses", style = MaterialTheme.typography.titleSmall, color = NewShapeGoldBright)
                        StatusPill(
                            text = if (daysLeft < 0) "Expirada" else "$daysLeft dias rest.",
                            textColor = if (daysLeft < 0) DangerRed else ConfirmedGreen,
                            containerColor = if (daysLeft < 0) DangerRedContainer else ConfirmedGreenContainer
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "Início: ${formatShortDate(fid.startDateMillis)}  ·  Fim: ${formatShortDate(fid.endDateMillis)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextPrimaryDark
                    )
                    if (fid.notes.isNotBlank()) {
                        Text(fid.notes, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                    }
                }
            }
        }

        item {
            Text("Histórico de Mensalidades", style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
        }

        if (payments.isEmpty()) {
            item {
                EmptyStateBox(
                    icon = Icons.AutoMirrored.Filled.ReceiptLong,
                    title = "Sem recibos ainda",
                    subtitle = "Quando o PT registar os teus pagamentos, ficam listados aqui."
                )
            }
        } else {
            items(payments, key = { it.id }) { p ->
                Surface(
                    color = CharcoalSurface,
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(p.monthLabel, style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                            Text(
                                text = "${formatShortDate(p.paidAtMillis)}${if (p.note.isNotBlank()) " · ${p.note}" else ""}",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                        }
                        StatusPill(
                            text = "Pago €${String.format("%.2f", p.amountEur)}",
                            textColor = ConfirmedGreen,
                            containerColor = ConfirmedGreenContainer
                        )
                    }
                }
            }
        }
    }
}
