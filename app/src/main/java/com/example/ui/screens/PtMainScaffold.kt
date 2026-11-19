package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.GoldPrimaryButton
import com.example.ui.components.NewShapeLogo
import com.example.ui.theme.*

@Composable
fun PtMainScaffold(
    state: StudioUiState,
    viewModel: NewShapeViewModel,
    onSignOut: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var mgmtInitialSubTab by remember { mutableIntStateOf(0) }
    var mgmtChatClientId by remember { mutableStateOf<String?>(null) }

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
                            NewShapeLogo(compact = true)
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
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
                            val badgeCount = if (idx == 0) state.pendingQueue.size else 0
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
                            val badgeCount = if (idx == 0) state.pendingQueue.size else 0
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
                            0 -> PtHomeTab(state = state, viewModel = viewModel)
                            1 -> PtClientsTab(
                                state = state,
                                viewModel = viewModel,
                                onJumpToWorkout = { selectedTab = 2 },
                                onJumpToNutrition = { selectedTab = 3 },
                                onJumpToChat = { cid ->
                                    mgmtInitialSubTab = 2
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
}
