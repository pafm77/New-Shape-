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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.VerifiedUser
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.example.data.SeedCatalog
import com.example.data.model.ClientRecord
import com.example.security.StudentPinHasher
import com.example.ui.components.BrandCard
import com.example.ui.components.DarkSecondaryButton
import com.example.ui.components.GoldPrimaryButton
import com.example.ui.components.NewShapeLogo
import com.example.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun AuthRoleScreen(
    clients: List<ClientRecord>,
    userEmail: String,
    onSignOut: () -> Unit,
    onEnterPt: () -> Unit,
    onEnterStudent: (String) -> Unit,
    onSetStudentPin: (String, String, (Boolean) -> Unit) -> Unit,
    onRegisterNewStudent: (String, String, String, String) -> Unit
) {
    val scope = rememberCoroutineScope()
    var selectedTab by remember { mutableIntStateOf(0) } // 0 = PT, 1 = Aluno
    var isRegisterMode by remember { mutableStateOf(false) }
    var studentStep by remember { mutableStateOf("phone") } // phone | verify_pin | setup_pin
    var pendingClientId by remember { mutableStateOf<String?>(null) }
    var studentPhone by remember { mutableStateOf("") }
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var rgpdAccepted by remember { mutableStateOf(false) }
    var pinInput by remember { mutableStateOf("") }
    var pinConfirmInput by remember { mutableStateOf("") }
    var failedAttempts by remember { mutableIntStateOf(0) }
    var lockoutUntilMs by remember { mutableLongStateOf(0L) }
    var lockoutRemainingSec by remember { mutableIntStateOf(0) }
    var isProcessingPin by remember { mutableStateOf(false) }
    var studentError by remember { mutableStateOf<String?>(null) }
    var studentInfo by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(lockoutUntilMs) {
        while (lockoutUntilMs > System.currentTimeMillis()) {
            lockoutRemainingSec = ((lockoutUntilMs - System.currentTimeMillis() + 999L) / 1000L).toInt().coerceAtLeast(1)
            delay(500L)
        }
        lockoutRemainingSec = 0
    }

    val pendingClient = remember(clients, pendingClientId) {
        pendingClientId?.let { id -> clients.find { it.id == id } }
    }
    val pendingFirstName = pendingClient?.name?.trim()?.split(" ")?.firstOrNull().orEmpty()
        .ifBlank { pendingClient?.name.orEmpty() }

    fun resetToPhoneStep() {
        studentStep = "phone"
        pendingClientId = null
        pinInput = ""
        pinConfirmInput = ""
        failedAttempts = 0
        lockoutUntilMs = 0L
        studentError = null
        studentInfo = null
    }

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
            } else if (!isRegisterMode && studentStep == "verify_pin" && pendingClient != null) {
                BrandCard(highlightBorder = true) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = "PIN de acesso",
                            tint = NewShapeGoldBright,
                            modifier = Modifier.size(26.dp)
                        )
                        Column {
                            Text(
                                text = "Olá, $pendingFirstName!",
                                style = MaterialTheme.typography.headlineMedium,
                                color = TextPrimaryDark
                            )
                            Text(
                                text = "Introduz o teu PIN de 4 dígitos para entrar.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                        }
                    }

                    Spacer(Modifier.height(16.dp))

                    OutlinedTextField(
                        value = pinInput,
                        onValueChange = {
                            pinInput = it.filter { ch -> ch.isDigit() }.take(4)
                            studentError = null
                        },
                        label = { Text("PIN de 4 dígitos") },
                        placeholder = { Text("••••") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        modifier = Modifier.fillMaxWidth().testTag("student_verify_pin_input"),
                        colors = darkFieldColors()
                    )

                    if (studentError != null) {
                        Spacer(Modifier.height(8.dp))
                        Text(studentError!!, color = DangerRed, style = MaterialTheme.typography.bodySmall)
                    }

                    Spacer(Modifier.height(16.dp))

                    GoldPrimaryButton(
                        text = when {
                            lockoutRemainingSec > 0 -> "Aguarda ${lockoutRemainingSec}s..."
                            isProcessingPin -> "A verificar..."
                            else -> "Entrar com PIN"
                        },
                        icon = Icons.Default.Key,
                        enabled = !isProcessingPin && lockoutRemainingSec == 0 && pinInput.length == 4,
                        onClick = {
                            val target = pendingClient
                            if (target.loginPinHash.isBlank()) {
                                onEnterStudent(target.id)
                                return@GoldPrimaryButton
                            }
                            if (System.currentTimeMillis() < lockoutUntilMs) {
                                studentError = "Aguarda ${lockoutRemainingSec}s antes de tentar novamente."
                                return@GoldPrimaryButton
                            }
                            isProcessingPin = true
                            studentError = null
                            val attempt = pinInput
                            scope.launch {
                                val ok = withContext(Dispatchers.Default) {
                                    StudentPinHasher.verifyPin(attempt, target.loginPinHash)
                                }
                                isProcessingPin = false
                                if (ok) {
                                    failedAttempts = 0
                                    lockoutUntilMs = 0L
                                    pinInput = ""
                                    onEnterStudent(target.id)
                                } else {
                                    pinInput = ""
                                    val next = failedAttempts + 1
                                    if (next >= 5) {
                                        failedAttempts = 0
                                        lockoutUntilMs = System.currentTimeMillis() + 30_000L
                                        studentError = "PIN incorreto 5 vezes seguidas. Aguarda 30 segundos ou pede ao teu PT para repor o PIN."
                                    } else {
                                        failedAttempts = next
                                        val left = 5 - next
                                        studentError = "PIN incorreto ($left tentativa${if (left == 1) "" else "s"} restante${if (left == 1) "" else "s"})."
                                    }
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        testTag = "student_verify_pin_button"
                    )

                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = "Esqueceste-te do PIN? Pede ao teu Personal Trainer para repor o PIN na tua ficha.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark
                    )
                    Spacer(Modifier.height(6.dp))
                    TextButton(
                        onClick = { resetToPhoneStep() },
                        modifier = Modifier.align(Alignment.CenterHorizontally).testTag("student_pin_back_btn")
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Voltar",
                            tint = TextSecondaryDark,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(6.dp))
                        Text("Usar outro número de telemóvel", color = TextSecondaryDark)
                    }
                }
            } else if (!isRegisterMode && studentStep == "setup_pin" && pendingClient != null) {
                BrandCard(highlightBorder = true) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Key,
                            contentDescription = "Criar PIN",
                            tint = NewShapeGoldBright,
                            modifier = Modifier.size(26.dp)
                        )
                        Column {
                            Text(
                                text = "Protege a tua conta, $pendingFirstName",
                                style = MaterialTheme.typography.titleLarge,
                                color = TextPrimaryDark,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Podes acrescentar um PIN de 4 dígitos (opcional) para proteger o acesso à tua conta.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryDark
                            )
                        }
                    }

                    Spacer(Modifier.height(16.dp))

                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = pinInput,
                            onValueChange = {
                                pinInput = it.filter { ch -> ch.isDigit() }.take(4)
                                studentError = null
                            },
                            label = { Text("Criar PIN") },
                            placeholder = { Text("••••") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            modifier = Modifier.weight(1f).testTag("student_setup_pin_input"),
                            colors = darkFieldColors()
                        )
                        OutlinedTextField(
                            value = pinConfirmInput,
                            onValueChange = {
                                pinConfirmInput = it.filter { ch -> ch.isDigit() }.take(4)
                                studentError = null
                            },
                            label = { Text("Confirmar PIN") },
                            placeholder = { Text("••••") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            modifier = Modifier.weight(1f).testTag("student_setup_pin_confirm_input"),
                            colors = darkFieldColors()
                        )
                    }

                    if (studentError != null) {
                        Spacer(Modifier.height(8.dp))
                        Text(studentError!!, color = DangerRed, style = MaterialTheme.typography.bodySmall)
                    }

                    Spacer(Modifier.height(16.dp))

                    GoldPrimaryButton(
                        text = if (isProcessingPin) "A guardar PIN..." else "Guardar PIN e Entrar",
                        icon = Icons.Default.VerifiedUser,
                        enabled = !isProcessingPin && pinInput.length == 4 && pinConfirmInput.length == 4,
                        onClick = {
                            if (!StudentPinHasher.isValidFourDigitPin(pinInput)) {
                                studentError = "O PIN tem de ter exatamente 4 dígitos."
                                return@GoldPrimaryButton
                            }
                            if (pinInput != pinConfirmInput) {
                                studentError = "Os dois PINs não coincidem."
                                return@GoldPrimaryButton
                            }
                            isProcessingPin = true
                            val rawPin = pinInput
                            val targetId = pendingClient.id
                            scope.launch {
                                val hash = withContext(Dispatchers.Default) {
                                    StudentPinHasher.hashPin(rawPin)
                                }
                                onSetStudentPin(targetId, hash) { ok ->
                                    isProcessingPin = false
                                    if (ok) {
                                        pinInput = ""
                                        pinConfirmInput = ""
                                        onEnterStudent(targetId)
                                    } else {
                                        studentError = "Não foi possível guardar o PIN. Podes entrar sem PIN e tentar em Definições."
                                    }
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        testTag = "student_setup_pin_save_button"
                    )

                    Spacer(Modifier.height(8.dp))
                    DarkSecondaryButton(
                        text = "Agora não · Entrar sem PIN",
                        onClick = { onEnterStudent(pendingClient.id) },
                        modifier = Modifier.fillMaxWidth().testTag("student_setup_pin_skip_button")
                    )

                    Spacer(Modifier.height(6.dp))
                    TextButton(
                        onClick = { resetToPhoneStep() },
                        modifier = Modifier.align(Alignment.CenterHorizontally)
                    ) {
                        Text("Voltar", color = TextSecondaryDark)
                    }
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
                            "Preenche o teu primeiro nome, último nome, telemóvel e (opcionalmente) um PIN de 4 dígitos."
                        } else {
                            "Introduz o teu número de telemóvel para acederes ao teu perfil."
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
                            color = ObsidianBg,
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, HairlineBorder),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(
                                    text = "PIN de 4 dígitos (Opcional)",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = NewShapeGoldBright,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Podes definir agora ou mais tarde em Definições.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondaryDark
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    OutlinedTextField(
                                        value = pinInput,
                                        onValueChange = {
                                            pinInput = it.filter { ch -> ch.isDigit() }.take(4)
                                            studentError = null
                                        },
                                        label = { Text("PIN") },
                                        placeholder = { Text("••••") },
                                        singleLine = true,
                                        visualTransformation = PasswordVisualTransformation(),
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                                        modifier = Modifier.weight(1f).testTag("student_register_pin_input"),
                                        colors = darkFieldColors()
                                    )
                                    OutlinedTextField(
                                        value = pinConfirmInput,
                                        onValueChange = {
                                            pinConfirmInput = it.filter { ch -> ch.isDigit() }.take(4)
                                            studentError = null
                                        },
                                        label = { Text("Confirmar") },
                                        placeholder = { Text("••••") },
                                        singleLine = true,
                                        visualTransformation = PasswordVisualTransformation(),
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                                        modifier = Modifier.weight(1f).testTag("student_register_pin_confirm_input"),
                                        colors = darkFieldColors()
                                    )
                                }
                            }
                        }

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
                            text = "Continuar",
                            icon = Icons.Default.Person,
                            onClick = {
                                val clean = normalizePhone(studentPhone)
                                if (clean.length != 9 || (!clean.startsWith("9") && !clean.startsWith("2"))) {
                                    studentError = "Indica um número de telemóvel válido (9 dígitos)."
                                    return@GoldPrimaryButton
                                }
                                val existing = clients.find { it.phone == clean }
                                if (existing != null) {
                                    pendingClientId = existing.id
                                    pinInput = ""
                                    pinConfirmInput = ""
                                    failedAttempts = 0
                                    lockoutUntilMs = 0L
                                    studentError = null
                                    studentInfo = null
                                    studentStep = if (existing.loginPinHash.isNotBlank()) "verify_pin" else "setup_pin"
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
                                pinInput = ""
                                pinConfirmInput = ""
                                studentError = null
                                studentInfo = null
                            },
                            modifier = Modifier.align(Alignment.CenterHorizontally).testTag("toggle_student_register")
                        ) {
                            Text("Primeiro acesso? Registar aluno", color = NewShapeGold)
                        }
                    } else {
                        GoldPrimaryButton(
                            text = if (isProcessingPin) "A registar..." else "Registar e Entrar",
                            icon = Icons.Default.PersonAdd,
                            enabled = !isProcessingPin,
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
                                    isRegisterMode = false
                                    pendingClientId = existing.id
                                    pinInput = ""
                                    pinConfirmInput = ""
                                    studentStep = if (existing.loginPinHash.isNotBlank()) "verify_pin" else "setup_pin"
                                    return@GoldPrimaryButton
                                }
                                if (pinInput.isNotEmpty() || pinConfirmInput.isNotEmpty()) {
                                    if (!StudentPinHasher.isValidFourDigitPin(pinInput)) {
                                        studentError = "O PIN opcional tem de ter exatamente 4 dígitos."
                                        return@GoldPrimaryButton
                                    }
                                    if (pinInput != pinConfirmInput) {
                                        studentError = "Os dois campos do PIN não coincidem."
                                        return@GoldPrimaryButton
                                    }
                                }
                                if (!rgpdAccepted) {
                                    studentError = "Tens de aceitar o consentimento RGPD para concluir o registo."
                                    return@GoldPrimaryButton
                                }
                                if (pinInput.length == 4) {
                                    isProcessingPin = true
                                    val rawPin = pinInput
                                    scope.launch {
                                        val hash = withContext(Dispatchers.Default) {
                                            StudentPinHasher.hashPin(rawPin)
                                        }
                                        isProcessingPin = false
                                        onRegisterNewStudent(
                                            "$fName $lName",
                                            clean,
                                            SeedCatalog.formatRgpdConsentStamp(),
                                            hash
                                        )
                                    }
                                } else {
                                    onRegisterNewStudent(
                                        "$fName $lName",
                                        clean,
                                        SeedCatalog.formatRgpdConsentStamp(),
                                        ""
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
                                pinInput = ""
                                pinConfirmInput = ""
                                studentError = null
                                studentInfo = null
                            },
                            modifier = Modifier.align(Alignment.CenterHorizontally)
                        ) {
                            Text("Já tenho conta · Entrar com telemóvel", color = TextSecondaryDark)
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
