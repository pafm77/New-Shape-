package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.SeedCatalog
import com.example.data.model.ClientRecord
import com.example.ui.components.BrandCard
import com.example.ui.components.GoldPrimaryButton
import com.example.ui.components.NewShapeLogo
import com.example.ui.theme.*

@Composable
fun AuthRoleScreen(
    clients: List<ClientRecord>,
    userEmail: String,
    onSignOut: () -> Unit,
    onEnterPt: () -> Unit,
    onEnterStudent: (String) -> Unit,
    onRegisterNewStudent: (String, String, String) -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) } // 0 = PT, 1 = Aluno
    var isRegisterMode by remember { mutableStateOf(false) }
    var studentPhone by remember { mutableStateOf("") }
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var rgpdAccepted by remember { mutableStateOf(false) }
    var studentError by remember { mutableStateOf<String?>(null) }
    var studentInfo by remember { mutableStateOf<String?>(null) }

    fun normalizePhone(raw: String): String {
        var digits = raw.filter { it.isDigit() }
        if (digits.startsWith("00351")) digits = digits.drop(5)
        else if (digits.startsWith("351") && digits.length > 9) digits = digits.drop(3)
        return digits.take(9)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF1A1811), ObsidianBg, ObsidianBg)
                )
            )
            .windowInsetsPadding(WindowInsets.safeDrawing)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 20.dp)
                .widthIn(max = 520.dp)
                .align(Alignment.TopCenter),
            horizontalAlignment = Alignment.Start
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .width(96.dp)
                        .height(6.dp)
                        .background(NewShapeGold, RoundedCornerShape(999.dp))
                )
                TextButton(
                    onClick = onSignOut,
                    modifier = Modifier.testTag("role_selector_sign_out")
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.Logout,
                        contentDescription = "Terminar sessão Google",
                        tint = TextSecondaryDark,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text("Sair", color = TextSecondaryDark)
                }
            }

            Spacer(Modifier.height(12.dp))
            NewShapeLogo()
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Gestão de Treinos, Nutrição & Marcações",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondaryDark
            )
            if (userEmail.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "Conta Google: $userEmail",
                    style = MaterialTheme.typography.labelMedium,
                    color = NewShapeGoldBright
                )
            }
            Spacer(Modifier.height(22.dp))

            // Role Switcher
            Surface(
                color = CharcoalSurface,
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, HairlineBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(modifier = Modifier.padding(4.dp)) {
                    RoleTabChip(
                        label = "Área do PT",
                        icon = Icons.Default.FitnessCenter,
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        modifier = Modifier.weight(1f).testTag("tab_role_pt")
                    )
                    Spacer(Modifier.width(6.dp))
                    RoleTabChip(
                        label = "Área do Aluno",
                        icon = Icons.Default.Person,
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        modifier = Modifier.weight(1f).testTag("tab_role_student")
                    )
                }
            }

            Spacer(Modifier.height(20.dp))

            if (selectedTab == 0) {
                BrandCard(highlightBorder = true) {
                    Text(
                        text = "Painel do Personal Trainer",
                        style = MaterialTheme.typography.headlineMedium,
                        color = TextPrimaryDark
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "Gere a fila de marcações por confirmar, horários semanais, perfis de alunos, planos de treino, nutrição, avaliações físicas, finanças, fidelizações e chat privado.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark
                    )
                    Spacer(Modifier.height(20.dp))

                    GoldPrimaryButton(
                        text = "Entrar no Painel PT",
                        icon = Icons.Default.FitnessCenter,
                        onClick = onEnterPt,
                        modifier = Modifier.fillMaxWidth(),
                        testTag = "enter_pt_button"
                    )
                }
            } else {
                BrandCard(highlightBorder = true) {
                    Text(
                        text = if (isRegisterMode) "Criar Registo de Aluno" else "Entrar como Aluno",
                        style = MaterialTheme.typography.headlineMedium,
                        color = TextPrimaryDark
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = if (isRegisterMode) {
                            "Preenche apenas o teu primeiro nome, último nome e número de telemóvel."
                        } else {
                            "Introduz apenas o teu número de telemóvel para acederes ao teu perfil."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark
                    )
                    Spacer(Modifier.height(16.dp))

                    if (studentInfo != null) {
                        Surface(
                            color = NewShapeGoldMuted,
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, NewShapeGold),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = studentInfo!!,
                                style = MaterialTheme.typography.bodySmall,
                                color = NewShapeGoldBright,
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                        Spacer(Modifier.height(12.dp))
                    }

                    if (isRegisterMode) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedTextField(
                                value = firstName,
                                onValueChange = {
                                    firstName = it
                                    studentError = null
                                },
                                label = { Text("Primeiro Nome") },
                                singleLine = true,
                                modifier = Modifier.weight(1f).testTag("student_first_name_input"),
                                colors = darkFieldColors()
                            )
                            OutlinedTextField(
                                value = lastName,
                                onValueChange = {
                                    lastName = it
                                    studentError = null
                                },
                                label = { Text("Último Nome") },
                                singleLine = true,
                                modifier = Modifier.weight(1f).testTag("student_last_name_input"),
                                colors = darkFieldColors()
                            )
                        }
                        Spacer(Modifier.height(10.dp))
                    }

                    OutlinedTextField(
                        value = studentPhone,
                        onValueChange = {
                            studentPhone = it.filter { ch -> ch.isDigit() || ch == '+' }.take(13)
                            studentError = null
                        },
                        label = { Text("Número de telemóvel") },
                        placeholder = { Text("912345678") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        modifier = Modifier.fillMaxWidth().testTag("student_phone_input"),
                        colors = darkFieldColors()
                    )

                    if (isRegisterMode) {
                        Spacer(Modifier.height(12.dp))
                        Surface(
                            color = ElevatedCharcoal,
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, if (rgpdAccepted) NewShapeGold else HairlineBorder),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .clickable {
                                    rgpdAccepted = !rgpdAccepted
                                    studentError = null
                                }
                                .testTag("student_rgpd_card")
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Checkbox(
                                    checked = rgpdAccepted,
                                    onCheckedChange = {
                                        rgpdAccepted = it
                                        studentError = null
                                    },
                                    modifier = Modifier.testTag("student_rgpd_checkbox"),
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = NewShapeGold,
                                        checkmarkColor = TextOnGold,
                                        uncheckedColor = TextSecondaryDark
                                    )
                                )
                                Spacer(Modifier.width(8.dp))
                                Column {
                                    Text(
                                        text = "Consentimento RGPD (Obrigatório)",
                                        style = MaterialTheme.typography.labelLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimaryDark
                                    )
                                    Spacer(Modifier.height(2.dp))
                                    Text(
                                        text = "Autorizo o tratamento dos meus dados pessoais (nome, telemóvel, marcações, treinos, nutrição e avaliações físicas) pelo estúdio New Shape, nos termos do RGPD.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondaryDark
                                    )
                                }
                            }
                        }
                    }

                    if (studentError != null) {
                        Spacer(Modifier.height(8.dp))
                        Text(studentError!!, color = DangerRed, style = MaterialTheme.typography.bodySmall)
                    }

                    Spacer(Modifier.height(16.dp))

                    if (!isRegisterMode) {
                        GoldPrimaryButton(
                            text = "Entrar",
                            icon = Icons.Default.Person,
                            onClick = {
                                val clean = normalizePhone(studentPhone)
                                if (clean.length != 9 || (!clean.startsWith("9") && !clean.startsWith("2"))) {
                                    studentError = "Indica um número de telemóvel válido (9 dígitos)."
                                    return@GoldPrimaryButton
                                }
                                val existing = clients.find { it.phone == clean }
                                if (existing != null) {
                                    onEnterStudent(existing.id)
                                } else {
                                    studentInfo = "Número ainda não registado. Completa o teu primeiro e último nome para entrar."
                                    isRegisterMode = true
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            testTag = "enter_student_button"
                        )
                        Spacer(Modifier.height(8.dp))
                        TextButton(
                            onClick = {
                                isRegisterMode = true
                                studentError = null
                                studentInfo = null
                            },
                            modifier = Modifier.align(Alignment.CenterHorizontally).testTag("toggle_student_register")
                        ) {
                            Text("Primeiro acesso? Registar aluno", color = NewShapeGold)
                        }
                    } else {
                        GoldPrimaryButton(
                            text = "Registar e Entrar",
                            icon = Icons.Default.PersonAdd,
                            onClick = {
                                val clean = normalizePhone(studentPhone)
                                val fName = firstName.trim()
                                val lName = lastName.trim()
                                if (fName.isEmpty() || lName.isEmpty()) {
                                    studentError = "Preenche o teu primeiro e último nome."
                                    return@GoldPrimaryButton
                                }
                                if (clean.length != 9 || (!clean.startsWith("9") && !clean.startsWith("2"))) {
                                    studentError = "Indica um número de telemóvel válido (9 dígitos)."
                                    return@GoldPrimaryButton
                                }
                                val existing = clients.find { it.phone == clean }
                                if (existing != null) {
                                    onEnterStudent(existing.id)
                                } else if (!rgpdAccepted) {
                                    studentError = "Tens de aceitar o consentimento RGPD para concluir o registo."
                                } else {
                                    onRegisterNewStudent(
                                        "$fName $lName",
                                        clean,
                                        SeedCatalog.formatRgpdConsentStamp()
                                    )
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            testTag = "register_student_button"
                        )
                        Spacer(Modifier.height(8.dp))
                        TextButton(
                            onClick = {
                                isRegisterMode = false
                                studentError = null
                                studentInfo = null
                            },
                            modifier = Modifier.align(Alignment.CenterHorizontally)
                        ) {
                            Text("Já tenho conta · Entrar só com telemóvel", color = TextSecondaryDark)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RoleTabChip(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = if (selected) NewShapeGold else CharcoalSurface,
        shape = RoundedCornerShape(10.dp),
        modifier = modifier
            .defaultMinSize(minHeight = 48.dp)
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 12.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (selected) TextOnGold else TextSecondaryDark,
                modifier = Modifier.size(18.dp)
            )
            Spacer(Modifier.width(6.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = if (selected) TextOnGold else TextSecondaryDark
            )
        }
    }
}

@Composable
fun darkFieldColors(): TextFieldColors = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = NewShapeGold,
    unfocusedBorderColor = HairlineBorder,
    focusedLabelColor = NewShapeGold,
    unfocusedLabelColor = TextSecondaryDark,
    focusedTextColor = TextPrimaryDark,
    unfocusedTextColor = TextPrimaryDark,
    cursorColor = NewShapeGold,
    focusedContainerColor = ElevatedCharcoal,
    unfocusedContainerColor = ElevatedCharcoal
)
