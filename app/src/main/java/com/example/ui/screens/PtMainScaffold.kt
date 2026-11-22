package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.PtNotificationRecord
import com.example.notifications.WorkoutNotificationHelper
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.GoldPrimaryButton
import com.example.ui.components.NewShapeLogo
import com.example.ui.components.StatusPill
import com.example.ui.components.formatTimeAgo
import com.example.ui.theme.*

@Composable
fun PtMainScaffold(
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    onSignOut: () -> Unit
) {
    val context = LocalContext.current
    var selectedTab by remember { mutableIntStateOf(0) }
    var mgmtInitialSubTab by remember { mutableIntStateOf(0) }
    var mgmtChatClientId by remember { mutableStateOf<String?>(null) }
    var showNotificationsDialog by remember { mutableStateOf(false) }
    var seenNotificationIds by remember { mutableStateOf<Set<String>?>(null) }

    LaunchedEffect(state.ptNotifications) {
        val currentIds = state.ptNotifications.map { it.id }.toSet()
        val prev = seenNotificationIds
        if (prev == null) {
            seenNotificationIds = currentIds
        } else {
            val newlyArrived = state.ptNotifications.filter { !it.read && it.id !in prev }
            if (newlyArrived.isNotEmpty() &&
                WorkoutNotificationHelper.isPtAlertsEnabled(context) &&
                WorkoutNotificationHelper.hasNotificationPermission(context)
            ) {
                newlyArrived.forEach { n ->
                    val title = when (n.type) {
                        "CANCELLED" -> "Treino cancelado · ${n.clientName}"
                        "UNAVAILABLE" -> "Aluno indisponível · ${n.clientName}"
                        "ASSESSMENT" -> "Nova avaliação física · ${n.clientName}"
                        else -> "Horário alterado · ${n.clientName}"
                    }
                    WorkoutNotificationHelper.showImmediateNotification(
                        context = context,
                        channelId = WorkoutNotificationHelper.CHANNEL_PT_ALERTS,
                        title = title,
                        body = n.summary,
                        notificationId = n.id.hashCode() and 0x7FFFFFFF
                    )
                }
            }
            seenNotificationIds = prev + currentIds
        }
    }

    val navItems = listOf(
        Triple("Início", Icons.Default.Home, "pt_nav_home"),
        Triple("Alunos", Icons.Default.People, "pt_nav_clients"),
        Triple("Treino", Icons.Default.FitnessCenter, "pt_nav_training"),
        Triple("Nutrição", Icons.Default.Restaurant, "pt_nav_nutrition"),
        Triple("Avaliação", Icons.Default.MonitorWeight, "pt_nav_assessment"),
        Triple("Gestão", Icons.Default.Dashboard, "pt_nav_management")
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
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                NewShapeLogo(compact = true)
                                if (state.isSuperAdmin) {
                                    StatusPill(
                                        text = "Admin",
                                        textColor = TextOnGold,
                                        containerColor = NewShapeGold
                                    )
                                }
                            }
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                IconButton(
                                    onClick = { showNotificationsDialog = true },
                                    modifier = Modifier.testTag("pt_notifications_bell_btn")
                                ) {
                                    BadgedBox(
                                        badge = {
                                            if (state.unreadPtNotificationsCount > 0) {
                                                Badge(containerColor = DangerRed, contentColor = TextPrimaryDark) {
                                                    Text(state.unreadPtNotificationsCount.toString())
                                                }
                                            }
                                        }
                                    ) {
                                        Icon(
                                            Icons.Default.Notifications,
                                            contentDescription = "Notificações de cancelamentos e alterações",
                                            tint = if (state.unreadPtNotificationsCount > 0) NewShapeGoldBright else TextSecondaryDark
                                        )
                                    }
                                }
                                TextButton(
                                    onClick = { viewModel.enterStudentMode() },
                                    modifier = Modifier.testTag("switch_to_student_btn")
                                ) {
                                    Icon(
                                        Icons.Default.SwapHoriz,
                                        contentDescription = "Mudar para vista do aluno",
                                        tint = NewShapeGold,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(Modifier.width(4.dp))
                                    Text("Aluno", color = NewShapeGold, fontWeight = FontWeight.Bold)
                                }
                                IconButton(
                                    onClick = { viewModel.backToRoleSelector() },
                                    modifier = Modifier.testTag("pt_role_selector_btn")
                                ) {
                                    Icon(Icons.Default.SwitchAccount, contentDescription = "Trocar perfil", tint = TextSecondaryDark)
                                }
                                IconButton(
                                    onClick = onSignOut,
                                    modifier = Modifier.testTag("pt_sign_out_btn")
                                ) {
                                    Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Terminar sessão Google", tint = TextSecondaryDark)
                                }
                            }
                        }

                        // WhatsApp Return Lock Banner (Matches PDF Page 3-4)
                        AnimatedVisibility(visible = state.waitingWhatsAppReturn) {
                            Surface(
                                color = NewShapeGoldMuted,
                                border = BorderStroke(1.dp, NewShapeGold),
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            "WhatsApp aberto",
                                            style = MaterialTheme.typography.titleSmall,
                                            color = NewShapeGoldBright
                                        )
                                        Text(
                                            "Quando terminares de enviar a mensagem, toca em \"Já voltei\".",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = TextPrimaryDark
                                        )
                                    }
                                    Spacer(Modifier.width(8.dp))
                                    GoldPrimaryButton(
                                        text = "Já voltei",
                                        onClick = { viewModel.confirmReturnedFromWhatsApp() },
                                        testTag = "whatsapp_returned_button"
                                    )
                                }
                            }
                        }

                        // 10s Undo Snackbar Banner
                        state.undoSnapshot?.let { undo ->
                            Surface(
                                color = ElevatedCharcoal,
                                border = BorderStroke(1.dp, ConfirmedGreen),
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "${undo.clientName} confirmado ✓",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextPrimaryDark,
                                        modifier = Modifier.weight(1f)
                                    )
                                    TextButton(onClick = { viewModel.undoLastConfirmation() }) {
                                        Text("Desfazer", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }

                        // Status Banner
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
                            val badgeCount = when (idx) {
                                0 -> state.pendingQueue.size
                                5 -> if (state.isSuperAdmin) state.pendingPtApprovalsCount else 0
                                else -> 0
                            }
                            NavigationBarItem(
                                selected = selectedTab == idx,
                                onClick = {
                                    selectedTab = idx
                                    if (idx != 5) {
                                        mgmtInitialSubTab = 0
                                        mgmtChatClientId = null
                                    }
                                },
                                modifier = Modifier.testTag(tag),
                                icon = {
                                    BadgedBox(
                                        badge = {
                                            if (badgeCount > 0) {
                                                Badge(containerColor = NewShapeGold, contentColor = TextOnGold) {
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
                            val badgeCount = when (idx) {
                                0 -> state.pendingQueue.size
                                5 -> if (state.isSuperAdmin) state.pendingPtApprovalsCount else 0
                                else -> 0
                            }
                            NavigationRailItem(
                                selected = selectedTab == idx,
                                onClick = {
                                    selectedTab = idx
                                    if (idx != 5) {
                                        mgmtInitialSubTab = 0
                                        mgmtChatClientId = null
                                    }
                                },
                                modifier = Modifier.testTag(tag),
                                icon = {
                                    BadgedBox(
                                        badge = {
                                            if (badgeCount > 0) {
                                                Badge(containerColor = NewShapeGold, contentColor = TextOnGold) {
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
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight(),
                    contentAlignment = Alignment.TopCenter
                ) {
                    Box(modifier = Modifier.fillMaxSize().widthIn(max = 840.dp)) {
                        when (selectedTab) {
                            0 -> PtHomeTab(
                                state = state,
                                viewModel = viewModel,
                                onJumpToPtApprovals = {
                                    if (state.isSuperAdmin) {
                                        mgmtInitialSubTab = 3
                                        selectedTab = 5
                                    }
                                }
                            )
                            1 -> PtClientsTab(
                                state = state,
                                viewModel = viewModel,
                                onJumpToWorkout = { selectedTab = 2 },
                                onJumpToNutrition = { selectedTab = 3 },
                                onJumpToChat = { cid ->
                                    mgmtInitialSubTab = if (state.isSuperAdmin) 2 else 1
                                    mgmtChatClientId = cid
                                    selectedTab = 5
                                }
                            )
                            2 -> PtTrainingTab(state = state, viewModel = viewModel)
                            3 -> PtNutritionTab(state = state, viewModel = viewModel)
                            4 -> PtAssessmentTab(state = state, viewModel = viewModel)
                            5 -> PtManagementTab(
                                state = state,
                                viewModel = viewModel,
                                initialSubTab = mgmtInitialSubTab,
                                initialChatClientId = mgmtChatClientId
                            )
                        }
                    }
                }
            }
        }
    }

    if (showNotificationsDialog) {
        PtNotificationsDialog(
            notifications = state.ptNotifications,
            onDismiss = { showNotificationsDialog = false },
            onMarkRead = { id -> viewModel.markPtNotificationRead(id) },
            onMarkAllRead = { viewModel.markAllPtNotificationsRead() },
            onDelete = { id -> viewModel.deletePtNotification(id) },
            onOpenAssessment = {
                showNotificationsDialog = false
                selectedTab = 4
            }
        )
    }
}

@Composable
private fun PtNotificationsDialog(
    notifications: List<PtNotificationRecord>,
    onDismiss: () -> Unit,
    onMarkRead: (String) -> Unit,
    onMarkAllRead: () -> Unit,
    onDelete: (String) -> Unit,
    onOpenAssessment: () -> Unit
) {
    val hasUnread = notifications.any { !it.read }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Notificações do PT", color = TextPrimaryDark)
                if (hasUnread) {
                    TextButton(
                        onClick = onMarkAllRead,
                        modifier = Modifier.testTag("pt_mark_all_notifs_read")
                    ) {
                        Text("Marcar lidas", color = NewShapeGoldBright)
                    }
                }
            }
        },
        text = {
            if (notifications.isEmpty()) {
                Text(
                    "Sem notificações de avaliações, cancelamentos ou alterações de horário.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
            } else {
                LazyColumn(
                    modifier = Modifier.heightIn(max = 360.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(notifications, key = { it.id }) { notif ->
                        val isCancel = notif.type == "CANCELLED" || notif.type == "UNAVAILABLE"
                        val isAssessment = notif.type == "ASSESSMENT"
                        Surface(
                            color = if (!notif.read) ElevatedCharcoal else ObsidianBg,
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(
                                1.dp,
                                when {
                                    notif.read -> HairlineBorder
                                    isCancel -> DangerRed
                                    isAssessment -> ConfirmedGreen
                                    else -> PendingAmber
                                }
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = isAssessment) {
                                    if (!notif.read) onMarkRead(notif.id)
                                    onOpenAssessment()
                                }
                        ) {
                            Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
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
                                        Text(
                                            text = notif.clientName,
                                            style = MaterialTheme.typography.titleSmall,
                                            color = TextPrimaryDark
                                        )
                                        StatusPill(
                                            text = when (notif.type) {
                                                "CANCELLED" -> "Cancelou"
                                                "UNAVAILABLE" -> "Indisponível"
                                                "ASSESSMENT" -> "Avaliação física"
                                                else -> "Alterou"
                                            },
                                            textColor = when {
                                                isCancel -> DangerRed
                                                isAssessment -> ConfirmedGreen
                                                else -> PendingAmber
                                            },
                                            containerColor = when {
                                                isCancel -> DangerRedContainer
                                                isAssessment -> ConfirmedGreenContainer
                                                else -> PendingAmberContainer
                                            }
                                        )
                                    }
                                    Text(
                                        text = formatTimeAgo(notif.timestampMillis),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = TextSecondaryDark
                                    )
                                }
                                Text(
                                    text = notif.summary,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextPrimaryDark
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.End
                                ) {
                                    if (!notif.read) {
                                        TextButton(onClick = { onMarkRead(notif.id) }) {
                                            Text("Marcar lida", color = NewShapeGold, style = MaterialTheme.typography.labelSmall)
                                        }
                                    }
                                    TextButton(onClick = { onDelete(notif.id) }) {
                                        Text("Apagar", color = DangerRed, style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Fechar", color = NewShapeGoldBright) }
        }
    )
}
