package com.example.ui.screens

import android.Manifest
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.ReportExporter
import com.example.data.SeedCatalog
import com.example.data.model.*
import com.example.notifications.WorkoutNotificationHelper
import com.example.security.StudentPinHasher
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
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
    var showSettingsDialog by remember { mutableStateOf(false) }
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
                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                IconButton(
                                    onClick = { showSettingsDialog = true },
                                    modifier = Modifier.testTag("student_settings_btn")
                                ) {
                                    Icon(
                                        Icons.Default.Settings,
                                        contentDescription = "Definições e notificações",
                                        tint = NewShapeGoldBright
                                    )
                                }
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

    if (showSettingsDialog) {
        StudentSettingsDialog(
            student = student,
            state = state,
            viewModel = viewModel,
            onDismiss = { showSettingsDialog = false }
        )
    }
}

@Composable
private fun StudentSettingsDialog(
    student: ClientRecord,
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val firstName = student.name.trim().split(" ").firstOrNull().orEmpty().ifBlank { student.name }
    val studioDefaultLead = state.settings.effectiveReminderLeadMinutes()
    val visibleSessions = remember(state.sessions) { state.sessions.filter { !it.ptPrivatePersonal } }

    var hasNotifPermission by remember { mutableStateOf(WorkoutNotificationHelper.hasNotificationPermission(context)) }
    var remindersEnabled by remember { mutableStateOf(WorkoutNotificationHelper.isStudentRemindersEnabled(context)) }
    var hasCustomLead by remember { mutableStateOf(WorkoutNotificationHelper.hasStudentCustomReminderLead(context)) }
    var reminderLeadMins by remember(studioDefaultLead) {
        mutableIntStateOf(WorkoutNotificationHelper.getStudentReminderLeadMinutes(context, studioDefaultLead))
    }

    var pinMode by remember { mutableStateOf("idle") } // idle | create | change | remove
    var pinCurrent by remember { mutableStateOf("") }
    var pinNew by remember { mutableStateOf("") }
    var pinConfirm by remember { mutableStateOf("") }
    var pinError by remember { mutableStateOf<String?>(null) }
    var pinSaving by remember { mutableStateOf(false) }

    val rescheduleReminders = { enabled: Boolean, lead: Int ->
        if (enabled && WorkoutNotificationHelper.hasNotificationPermission(context)) {
            WorkoutNotificationHelper.scheduleConfirmedWorkoutReminders(
                context = context,
                clientId = student.id,
                bookings = state.bookings,
                sessions = visibleSessions,
                leadMinutes = lead
            )
        } else {
            WorkoutNotificationHelper.cancelScheduledReminders(context)
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasNotifPermission = granted
        if (granted) {
            remindersEnabled = true
            WorkoutNotificationHelper.setStudentRemindersEnabled(context, true)
            rescheduleReminders(true, reminderLeadMins)
            Toast.makeText(context, "Notificações na barra do telemóvel ativadas!", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(context, "Permissão de notificações recusada.", Toast.LENGTH_SHORT).show()
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Settings, contentDescription = null, tint = NewShapeGoldBright)
                Text("Definições", color = TextPrimaryDark, fontWeight = FontWeight.Bold)
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
                    color = ElevatedCharcoal,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, NewShapeGold.copy(alpha = 0.5f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    "Notificações na barra do telemóvel",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = NewShapeGoldBright,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    "Recebe lembretes antes de cada treino confirmado.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondaryDark
                                )
                            }
                            Switch(
                                checked = remindersEnabled && hasNotifPermission,
                                onCheckedChange = { enable ->
                                    if (enable && !hasNotifPermission && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                        permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                    } else {
                                        remindersEnabled = enable
                                        WorkoutNotificationHelper.setStudentRemindersEnabled(context, enable)
                                        rescheduleReminders(enable, reminderLeadMins)
                                    }
                                },
                                modifier = Modifier.testTag("student_settings_notif_switch"),
                                colors = SwitchDefaults.colors(checkedThumbColor = TextOnGold, checkedTrackColor = NewShapeGold)
                            )
                        }

                        if (!hasNotifPermission && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            GoldPrimaryButton(
                                text = "Ativar notificações no telemóvel",
                                icon = Icons.Default.NotificationsActive,
                                onClick = { permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) },
                                modifier = Modifier.fillMaxWidth(),
                                testTag = "student_settings_enable_notif_btn"
                            )
                        } else {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                StatusPill(
                                    text = if (remindersEnabled) "Ativas ✓" else "Desativadas",
                                    textColor = if (remindersEnabled) ConfirmedGreen else PendingAmber,
                                    containerColor = if (remindersEnabled) ConfirmedGreenContainer else PendingAmberContainer
                                )
                                Spacer(Modifier.weight(1f))
                                DarkSecondaryButton(
                                    text = "Testar",
                                    icon = Icons.Default.NotificationsActive,
                                    onClick = {
                                        WorkoutNotificationHelper.showImmediateNotification(
                                            context = context,
                                            channelId = WorkoutNotificationHelper.CHANNEL_REMINDERS,
                                            title = "New Shape · Lembrete de Treino",
                                            body = "Tudo pronto, $firstName! Vais receber avisos ${formatReminderLeadLabel(reminderLeadMins)} antes do treino.",
                                            notificationId = 9010
                                        )
                                    },
                                    modifier = Modifier.testTag("student_settings_test_notif_btn")
                                )
                            }
                        }

                        HorizontalDivider(color = HairlineBorder)
                        Text(
                            "Avisar antes do treino: ${formatReminderLeadLabel(reminderLeadMins)}",
                            style = MaterialTheme.typography.labelMedium,
                            color = TextPrimaryDark,
                            fontWeight = FontWeight.SemiBold
                        )
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            FilterChip(
                                selected = !hasCustomLead,
                                onClick = {
                                    hasCustomLead = false
                                    reminderLeadMins = studioDefaultLead
                                    WorkoutNotificationHelper.clearStudentCustomReminderLead(context)
                                    rescheduleReminders(remindersEnabled, studioDefaultLead)
                                },
                                label = { Text("Padrão PT (${formatReminderLeadLabel(studioDefaultLead)})") },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = NewShapeGold,
                                    selectedLabelColor = TextOnGold
                                )
                            )
                            listOf(
                                15 to "15 min",
                                30 to "30 min",
                                45 to "45 min",
                                60 to "1h",
                                120 to "2h"
                            ).forEach { (mins, label) ->
                                FilterChip(
                                    selected = hasCustomLead && reminderLeadMins == mins,
                                    onClick = {
                                        hasCustomLead = true
                                        reminderLeadMins = mins
                                        WorkoutNotificationHelper.setStudentReminderLeadMinutes(context, mins)
                                        rescheduleReminders(remindersEnabled, mins)
                                    },
                                    label = { Text(label) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = NewShapeGold,
                                        selectedLabelColor = TextOnGold
                                    )
                                )
                            }
                        }
                    }
                }

                // PIN de 4 Dígitos
                Surface(
                    color = ElevatedCharcoal,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        val hasPin = student.loginPinHash.isNotBlank()
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    imageVector = if (hasPin) Icons.Default.Lock else Icons.Default.Key,
                                    contentDescription = "PIN de 4 dígitos",
                                    tint = NewShapeGoldBright,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    "PIN de 4 Dígitos",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = NewShapeGoldBright,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            StatusPill(
                                text = if (hasPin) "PIN ativo 🔒" else "Sem PIN",
                                textColor = if (hasPin) ConfirmedGreen else TextSecondaryDark,
                                containerColor = if (hasPin) ConfirmedGreenContainer else ObsidianBg
                            )
                        }
                        Text(
                            text = if (hasPin) {
                                "A tua conta está protegida com PIN ao iniciar sessão."
                            } else {
                                "Adiciona um PIN de 4 dígitos para proteger o acesso à tua conta."
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )

                        if (pinMode == "idle") {
                            if (!hasPin) {
                                GoldPrimaryButton(
                                    text = "Criar PIN de 4 dígitos",
                                    icon = Icons.Default.Key,
                                    onClick = {
                                        pinCurrent = ""
                                        pinNew = ""
                                        pinConfirm = ""
                                        pinError = null
                                        pinMode = "create"
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    testTag = "student_settings_create_pin_btn"
                                )
                            } else {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                    DarkSecondaryButton(
                                        text = "Alterar PIN",
                                        onClick = {
                                            pinCurrent = ""
                                            pinNew = ""
                                            pinConfirm = ""
                                            pinError = null
                                            pinMode = "change"
                                        },
                                        modifier = Modifier.weight(1f).testTag("student_settings_change_pin_btn")
                                    )
                                    OutlinedButton(
                                        onClick = {
                                            pinCurrent = ""
                                            pinNew = ""
                                            pinConfirm = ""
                                            pinError = null
                                            pinMode = "remove"
                                        },
                                        border = BorderStroke(1.dp, DangerRed.copy(alpha = 0.6f)),
                                        modifier = Modifier.weight(1f).testTag("student_settings_remove_pin_btn")
                                    ) {
                                        Text("Remover PIN", color = DangerRed, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        } else {
                            if (pinMode == "change" || pinMode == "remove") {
                                OutlinedTextField(
                                    value = pinCurrent,
                                    onValueChange = {
                                        pinCurrent = it.filter { ch -> ch.isDigit() }.take(4)
                                        pinError = null
                                    },
                                    label = { Text("PIN atual (4 dígitos)") },
                                    placeholder = { Text("••••") },
                                    singleLine = true,
                                    visualTransformation = PasswordVisualTransformation(),
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                                    modifier = Modifier.fillMaxWidth().testTag("student_settings_pin_current_input"),
                                    colors = darkFieldColors()
                                )
                            }
                            if (pinMode == "create" || pinMode == "change") {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedTextField(
                                        value = pinNew,
                                        onValueChange = {
                                            pinNew = it.filter { ch -> ch.isDigit() }.take(4)
                                            pinError = null
                                        },
                                        label = { Text("Novo PIN") },
                                        placeholder = { Text("••••") },
                                        singleLine = true,
                                        visualTransformation = PasswordVisualTransformation(),
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                                        modifier = Modifier.weight(1f).testTag("student_settings_pin_new_input"),
                                        colors = darkFieldColors()
                                    )
                                    OutlinedTextField(
                                        value = pinConfirm,
                                        onValueChange = {
                                            pinConfirm = it.filter { ch -> ch.isDigit() }.take(4)
                                            pinError = null
                                        },
                                        label = { Text("Confirmar") },
                                        placeholder = { Text("••••") },
                                        singleLine = true,
                                        visualTransformation = PasswordVisualTransformation(),
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                                        modifier = Modifier.weight(1f).testTag("student_settings_pin_confirm_input"),
                                        colors = darkFieldColors()
                                    )
                                }
                            }
                            if (pinError != null) {
                                Text(pinError!!, color = DangerRed, style = MaterialTheme.typography.bodySmall)
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                GoldPrimaryButton(
                                    text = when {
                                        pinSaving -> "A guardar..."
                                        pinMode == "remove" -> "Remover"
                                        else -> "Guardar PIN"
                                    },
                                    enabled = !pinSaving,
                                    onClick = {
                                        pinError = null
                                        if (pinMode == "change" || pinMode == "remove") {
                                            if (!StudentPinHasher.isValidFourDigitPin(pinCurrent)) {
                                                pinError = "Introduz o teu PIN atual de 4 dígitos."
                                                return@GoldPrimaryButton
                                            }
                                        }
                                        if (pinMode == "create" || pinMode == "change") {
                                            if (!StudentPinHasher.isValidFourDigitPin(pinNew)) {
                                                pinError = "O novo PIN tem de ter exatamente 4 dígitos."
                                                return@GoldPrimaryButton
                                            }
                                            if (pinNew != pinConfirm) {
                                                pinError = "Os dois PINs não coincidem."
                                                return@GoldPrimaryButton
                                            }
                                        }
                                        pinSaving = true
                                        val modeSnapshot = pinMode
                                        val curSnapshot = pinCurrent
                                        val newSnapshot = pinNew
                                        scope.launch {
                                            if (modeSnapshot == "change" || modeSnapshot == "remove") {
                                                val ok = withContext(Dispatchers.Default) {
                                                    StudentPinHasher.verifyPin(curSnapshot, student.loginPinHash)
                                                }
                                                if (!ok) {
                                                    pinSaving = false
                                                    pinError = "O PIN atual está incorreto."
                                                    return@launch
                                                }
                                            }
                                            val nextHash = if (modeSnapshot == "remove") {
                                                ""
                                            } else {
                                                withContext(Dispatchers.Default) {
                                                    StudentPinHasher.hashPin(newSnapshot)
                                                }
                                            }
                                            val msg = when (modeSnapshot) {
                                                "remove" -> "PIN removido da tua conta."
                                                "change" -> "PIN de 4 dígitos alterado com sucesso!"
                                                else -> "PIN de 4 dígitos ativado com sucesso!"
                                            }
                                            viewModel.updateClientPinHash(student.id, nextHash, msg) { ok ->
                                                pinSaving = false
                                                if (ok) {
                                                    pinMode = "idle"
                                                    pinCurrent = ""
                                                    pinNew = ""
                                                    pinConfirm = ""
                                                } else {
                                                    pinError = "Não foi possível atualizar o PIN."
                                                }
                                            }
                                        }
                                    },
                                    modifier = Modifier.weight(1f),
                                    testTag = "student_settings_pin_submit_btn"
                                )
                                DarkSecondaryButton(
                                    text = "Cancelar",
                                    onClick = {
                                        pinMode = "idle"
                                        pinError = null
                                    },
                                    modifier = Modifier.weight(1f).testTag("student_settings_pin_cancel_btn")
                                )
                            }
                        }
                    }
                }

                // Data de Nascimento
                val existingBirth = remember(student.birthDate) { parseBirthDate(student.birthDate) }
                var settingsBirthDay by remember(student.id, student.birthDate) {
                    mutableStateOf(existingBirth?.day?.toString()?.padStart(2, '0').orEmpty())
                }
                var settingsBirthMonth by remember(student.id, student.birthDate) {
                    mutableStateOf(existingBirth?.month?.toString()?.padStart(2, '0').orEmpty())
                }
                var settingsBirthYear by remember(student.id, student.birthDate) {
                    mutableStateOf(existingBirth?.year?.toString().orEmpty())
                }
                var settingsBirthError by remember { mutableStateOf<String?>(null) }

                Surface(
                    color = ElevatedCharcoal,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "Data de Nascimento",
                                style = MaterialTheme.typography.labelLarge,
                                color = NewShapeGoldBright,
                                fontWeight = FontWeight.Bold
                            )
                            StatusPill(
                                text = if (existingBirth != null) "Preenchida ✓" else "Por preencher",
                                textColor = if (existingBirth != null) ConfirmedGreen else PendingAmber,
                                containerColor = if (existingBirth != null) ConfirmedGreenContainer else PendingAmberContainer
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            OutlinedTextField(
                                value = settingsBirthDay,
                                onValueChange = {
                                    settingsBirthDay = it.filter(Char::isDigit).take(2)
                                    settingsBirthError = null
                                },
                                label = { Text("Dia") },
                                placeholder = { Text("DD") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.weight(1f).testTag("settings_birth_day_input")
                            )
                            OutlinedTextField(
                                value = settingsBirthMonth,
                                onValueChange = {
                                    settingsBirthMonth = it.filter(Char::isDigit).take(2)
                                    settingsBirthError = null
                                },
                                label = { Text("Mês") },
                                placeholder = { Text("MM") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.weight(1f).testTag("settings_birth_month_input")
                            )
                            OutlinedTextField(
                                value = settingsBirthYear,
                                onValueChange = {
                                    settingsBirthYear = it.filter(Char::isDigit).take(4)
                                    settingsBirthError = null
                                },
                                label = { Text("Ano") },
                                placeholder = { Text("AAAA") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.weight(1.3f).testTag("settings_birth_year_input")
                            )
                        }
                        if (settingsBirthError != null) {
                            Text(
                                text = settingsBirthError!!,
                                style = MaterialTheme.typography.labelSmall,
                                color = DangerRed
                            )
                        }
                        GoldPrimaryButton(
                            text = "Guardar data de nascimento",
                            onClick = {
                                val d = settingsBirthDay.toIntOrNull()
                                val m = settingsBirthMonth.toIntOrNull()
                                val y = settingsBirthYear.toIntOrNull()
                                val formatted = if (d != null && m != null && y != null) {
                                    String.format("%04d-%02d-%02d", y, m, d)
                                } else ""
                                if (parseBirthDate(formatted) == null) {
                                    settingsBirthError = "Insere uma data válida (DD / MM / AAAA)."
                                } else {
                                    viewModel.updateClientBirthDate(student.id, formatted)
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            testTag = "settings_save_birthdate_btn"
                        )
                    }
                }

                Surface(
                    color = ObsidianBg,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, HairlineBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            "A Tua Conta",
                            style = MaterialTheme.typography.labelLarge,
                            color = NewShapeGoldBright,
                            fontWeight = FontWeight.Bold
                        )
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Nome", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                            Text(student.name, style = MaterialTheme.typography.bodySmall, color = TextPrimaryDark, fontWeight = FontWeight.SemiBold)
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Telemóvel", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                            Text(
                                student.phone.ifBlank { "Não registado" },
                                style = MaterialTheme.typography.bodySmall,
                                color = TextPrimaryDark,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        if (existingBirth != null) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Nascimento", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                                Text(
                                    formatBirthDatePt(student.birthDate),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextPrimaryDark,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Plano semanal", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                            Text(
                                if (student.weeklySessionLimit > 0) "${student.weeklySessionLimit} treinos / semana" else "Sem limite semanal",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextPrimaryDark,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        if (student.fixedSlots.isNotEmpty()) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Dias fixos", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
                                Text(
                                    SeedCatalog.formatFixedSlotsSummary(student.fixedSlots),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = NewShapeGoldBright,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fechar", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
            }
        }
    )
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
    val todayIso = currentLocalIsoDate()
    val plans = remember(state.workoutPlans, student.id, todayIso) {
        state.workoutPlans.filter { it.clientId == student.id && it.isAvailableToStudent(todayIso) }
    }
    var executingPlanId by remember { mutableStateOf<String?>(null) }
    var completedExerciseIds by remember(executingPlanId) { mutableStateOf<Set<String>>(emptySet()) }
    var restSecondsLeft by remember { mutableIntStateOf(0) }
    var restExerciseName by remember { mutableStateOf("") }
    var historyTargetItem by remember { mutableStateOf<WorkoutPlanItemRecord?>(null) }
    var feedbackTargetPlan by remember { mutableStateOf<WorkoutPlanRecord?>(null) }
    var collapsedPlanIds by remember { mutableStateOf<Set<String>>(emptySet()) }

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

        item(key = "workout_announcements_banner") {
            StudioAnnouncementsBanner(
                announcements = state.studioAnnouncements,
                reads = state.announcementReads,
                client = student,
                onMarkRead = { annId -> viewModel.markAnnouncementRead(annId, student) }
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
            if (plans.size > 1) {
                item(key = "student_plans_collapse_controls") {
                    val allCollapsed = plans.all { it.id in collapsedPlanIds }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${plans.size} planos de treino",
                            style = MaterialTheme.typography.labelMedium,
                            color = TextSecondaryDark
                        )
                        TextButton(
                            onClick = {
                                collapsedPlanIds = if (allCollapsed) {
                                    emptySet()
                                } else {
                                    plans.map { it.id }.toSet()
                                }
                            },
                            modifier = Modifier.testTag("student_toggle_all_plans_collapse")
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

            items(plans, key = { it.id }) { plan ->
                val items = state.workoutPlanItems.filter { it.planId == plan.id }.sortedBy { it.orderIndex }
                val isExecuting = executingPlanId == plan.id
                val doneCount = items.count { it.id in completedExerciseIds }
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
                        IconButton(
                            onClick = togglePlanExpanded,
                            modifier = Modifier.testTag("student_toggle_plan_${plan.id}")
                        ) {
                            Icon(
                                imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                contentDescription = if (isExpanded) "Minimizar plano" else "Maximizar plano",
                                tint = NewShapeGoldBright
                            )
                        }
                    }

                    if (items.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        if (isExecuting) {
                            StatusPill(
                                text = "$doneCount/${items.size} feitos",
                                textColor = ConfirmedGreen,
                                containerColor = ConfirmedGreenContainer
                            )
                        } else {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                TextButton(
                                    onClick = { feedbackTargetPlan = plan },
                                    modifier = Modifier.testTag("student_feedback_btn_${plan.id}")
                                ) {
                                    Text("Feedback", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                                }
                                Spacer(Modifier.width(6.dp))
                                GoldPrimaryButton(
                                    text = "Executar",
                                    icon = Icons.Default.PlayArrow,
                                    onClick = {
                                        collapsedPlanIds = collapsedPlanIds - plan.id
                                        executingPlanId = plan.id
                                        completedExerciseIds = emptySet()
                                    },
                                    testTag = "student_start_workout_${plan.id}"
                                )
                            }
                        }
                    }

                    AnimatedVisibility(visible = isExpanded) {
                        Column(modifier = Modifier.fillMaxWidth()) {
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
                                    feedbackTargetPlan = plan
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
                                        .padding(vertical = 8.dp)
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(10.dp),
                                        verticalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        StatusPill(
                                            text = block.groupLabel,
                                            textColor = NewShapeGoldBright,
                                            containerColor = NewShapeGoldMuted
                                        )
                                        block.items.forEachIndexed { inIdx, exItem ->
                                            val isNonLast = inIdx < block.items.lastIndex
                                            val isLast = inIdx == block.items.lastIndex
                                            StudentExerciseLoadRow(
                                                index = flatIdx + inIdx + 1,
                                                item = exItem,
                                                clientId = student.id,
                                                workoutPlans = state.workoutPlans,
                                                workoutPlanItems = state.workoutPlanItems,
                                                workoutLoadLogs = state.workoutLoadLogs,
                                                isExecuting = isExecuting,
                                                isCompleted = exItem.id in completedExerciseIds,
                                                labelPrefix = block.itemLabel(inIdx),
                                                isSupersetNonLast = isNonLast,
                                                isSupersetLast = isLast,
                                                onToggleComplete = {
                                                    completedExerciseIds = if (exItem.id in completedExerciseIds) {
                                                        completedExerciseIds - exItem.id
                                                    } else {
                                                        completedExerciseIds + exItem.id
                                                    }
                                                },
                                                onStartRest = {
                                                    restSecondsLeft = exItem.restSeconds.coerceAtLeast(15)
                                                    restExerciseName = "Bloco ${block.blockNumber} (${exItem.exerciseName})"
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
                                StudentExerciseLoadRow(
                                    index = flatIdx + 1,
                                    item = exItem,
                                    clientId = student.id,
                                    workoutPlans = state.workoutPlans,
                                    workoutPlanItems = state.workoutPlanItems,
                                    workoutLoadLogs = state.workoutLoadLogs,
                                    isExecuting = isExecuting,
                                    isCompleted = exItem.id in completedExerciseIds,
                                    labelPrefix = block.itemLabel(0),
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
                                flatIdx += 1
                            }
                            if (blockIdx < blocks.lastIndex) {
                                HorizontalDivider(color = HairlineBorder.copy(alpha = 0.5f))
                            }
                        }
                    }
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

    feedbackTargetPlan?.let { plan ->
        PostWorkoutFeedbackDialog(
            planTitle = plan.title,
            onDismiss = { feedbackTargetPlan = null },
            onSubmit = { rpe, feeling, note ->
                viewModel.submitWorkoutFeedback(
                    client = student,
                    planId = plan.id,
                    planTitle = plan.title,
                    rpe = rpe,
                    feeling = feeling,
                    note = note
                )
                feedbackTargetPlan = null
            }
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
    labelPrefix: String? = null,
    isSupersetNonLast: Boolean = false,
    isSupersetLast: Boolean = false,
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
                    text = "${labelPrefix ?: index.toString()}. ${item.exerciseName}",
                    style = MaterialTheme.typography.titleSmall,
                    color = if (isCompleted) ConfirmedGreen else TextPrimaryDark
                )
                val restSummary = when {
                    isSupersetNonLast -> "Sem descanso → próximo exercício"
                    isSupersetLast -> "Descanso após bloco: ${item.restSeconds}s"
                    else -> "Descanso ${item.restSeconds}s"
                }
                Text(
                    text = "${item.sets} séries × ${item.reps} · $restSummary",
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
                if (!isSupersetNonLast && item.restSeconds > 0) {
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
                            text = if (isSupersetLast) "⏱ Descanso bloco ${item.restSeconds}s" else "⏱ Descanso ${item.restSeconds}s",
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
        item {
            StudentConsistencyCard(
                clientId = student.id,
                bookings = state.bookings,
                sessions = state.sessions
            )
        }
        assessmentDashboardItems(
            assessments = assessments,
            onDelete = { id -> viewModel.deletePhysicalAssessment(id) }
        )
        item {
            StrengthEvolutionChartCard(
                clientId = student.id,
                workoutLoadLogs = state.workoutLoadLogs,
                workoutPlans = state.workoutPlans,
                workoutPlanItems = state.workoutPlanItems
            )
        }
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
