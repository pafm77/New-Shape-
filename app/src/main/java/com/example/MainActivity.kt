package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.example.data.FirestoreStudioRepository
import com.example.data.model.SUPER_ADMIN_EMAIL
import com.example.ui.AppRole
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioStreamState
import com.example.ui.components.BrandCard
import com.example.ui.components.DarkSecondaryButton
import com.example.ui.components.GoldPrimaryButton
import com.example.ui.components.NewShapeLogo
import com.example.ui.components.StatusPill
import com.example.ui.screens.*
import com.example.ui.theme.*
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.callbackFlow

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            NewShapeTheme {
                AppNavigation()
            }
        }
    }
}

@Composable
private fun AppNavigation() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember(context) { CredentialManager.create(context) }

    val authUserFlow = remember {
        callbackFlow {
            val auth = Firebase.auth
            trySend(auth.currentUser)
            val listener = FirebaseAuth.AuthStateListener { firebaseAuth ->
                trySend(firebaseAuth.currentUser)
            }
            auth.addAuthStateListener(listener)
            awaitClose { auth.removeAuthStateListener(listener) }
        }
    }
    val currentUser: FirebaseUser? by authUserFlow.collectAsStateWithLifecycle(initialValue = Firebase.auth.currentUser)

    val user = currentUser
    if (user == null) {
        GoogleSignInScreen(onAuthSuccess = {})
        return
    }

    key(user.uid) {
        val databaseId = remember(context) {
            context.getString(R.string.firestore_database_id)
        }
        val studioViewModel: NewShapeViewModel = viewModel(
            key = user.uid,
            factory = viewModelFactory {
                initializer {
                    val db = FirebaseFirestore.getInstance(databaseId)
                    val repository = FirestoreStudioRepository(db = db, auth = Firebase.auth)
                    NewShapeViewModel(
                        repository = repository,
                        currentUserId = user.uid,
                        currentUserEmail = user.email.orEmpty(),
                        currentUserDisplayName = user.displayName.orEmpty()
                    )
                }
            }
        )

        val streamState by studioViewModel.streamState.collectAsStateWithLifecycle()

        val performSignOut: () -> Unit = {
            signOutFromGoogle(
                credentialManager = credentialManager,
                scope = scope
            )
        }

        when (val current = streamState) {
            is StudioStreamState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(ObsidianBg)
                        .windowInsetsPadding(WindowInsets.safeDrawing),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        NewShapeLogo()
                        Spacer(Modifier.height(24.dp))
                        CircularProgressIndicator(color = NewShapeGold)
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = "A sincronizar New Shape...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondaryDark
                        )
                    }
                }
            }

            is StudioStreamState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(ObsidianBg)
                        .windowInsetsPadding(WindowInsets.safeDrawing)
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.widthIn(max = 420.dp)
                    ) {
                        Icon(
                            Icons.Default.CloudOff,
                            contentDescription = null,
                            tint = DangerRed,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = "Erro ao ligar ao Firestore",
                            style = MaterialTheme.typography.titleLarge,
                            color = TextPrimaryDark
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = current.message,
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(20.dp))
                        GoldPrimaryButton(
                            text = "Terminar sessão",
                            onClick = performSignOut,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            is StudioStreamState.Ready -> {
                val data = current.data
                when (data.role) {
                    AppRole.ROLE_SELECTOR -> AuthRoleScreen(
                        clients = data.clients,
                        userEmail = user.email.orEmpty(),
                        onSignOut = performSignOut,
                        onEnterPt = { studioViewModel.enterPtMode() },
                        onEnterStudent = { id -> studioViewModel.enterStudentMode(id) },
                        onRegisterNewStudent = { name, phone, rgpdNote ->
                            studioViewModel.registerAndEnterStudentMode(name, phone, rgpdNote)
                        }
                    )

                    AppRole.PT -> {
                        if (data.isPtApproved) {
                            PtMainScaffold(
                                state = data,
                                viewModel = studioViewModel,
                                onSignOut = performSignOut
                            )
                        } else {
                            PtApprovalGateScreen(
                                email = data.currentUserEmail,
                                status = data.ownPtAccount?.status ?: "PENDING",
                                onBackToRoleSelector = { studioViewModel.backToRoleSelector() },
                                onSignOut = performSignOut
                            )
                        }
                    }

                    AppRole.STUDENT -> StudentMainScaffold(
                        state = data,
                        viewModel = studioViewModel,
                        onSignOut = performSignOut
                    )
                }
            }
        }
    }
}

@Composable
private fun PtApprovalGateScreen(
    email: String,
    status: String,
    onBackToRoleSelector: () -> Unit,
    onSignOut: () -> Unit
) {
    val isRejected = status == "REJECTED"
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBg)
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.widthIn(max = 440.dp)
        ) {
            NewShapeLogo()
            Spacer(Modifier.height(24.dp))
            BrandCard(highlightBorder = !isRejected) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = if (isRejected) Icons.Default.Lock else Icons.Default.HourglassTop,
                        contentDescription = if (isRejected) "Acesso recusado" else "A aguardar aprovação",
                        tint = if (isRejected) DangerRed else NewShapeGoldBright,
                        modifier = Modifier.size(44.dp)
                    )
                    Spacer(Modifier.height(12.dp))
                    StatusPill(
                        text = if (isRejected) "Registo recusado" else "Pendente de confirmação",
                        textColor = if (isRejected) DangerRed else PendingAmber,
                        containerColor = if (isRejected) DangerRedContainer else PendingAmberContainer
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        text = if (isRejected) "Acesso PT não autorizado" else "A aguardar aprovação do Administrador",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimaryDark,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = if (isRejected) {
                            "O teu pedido de acesso ao Painel PT ($email) foi recusado pelo administrador ($SUPER_ADMIN_EMAIL)."
                        } else {
                            "O teu registo PT ($email) foi enviado ao administrador ($SUPER_ADMIN_EMAIL). Assim que for confirmado, o acesso ao Painel PT desbloqueia automaticamente."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(20.dp))
                    DarkSecondaryButton(
                        text = "Voltar à seleção de perfil",
                        onClick = onBackToRoleSelector,
                        modifier = Modifier.fillMaxWidth().testTag("pt_gate_back_btn")
                    )
                    Spacer(Modifier.height(8.dp))
                    GoldPrimaryButton(
                        text = "Terminar sessão",
                        onClick = onSignOut,
                        modifier = Modifier.fillMaxWidth(),
                        testTag = "pt_gate_sign_out_btn"
                    )
                }
            }
        }
    }
}
