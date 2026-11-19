package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.example.data.FirestoreStudioRepository
import com.example.ui.AppRole
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioStreamState
import com.example.ui.components.GoldPrimaryButton
import com.example.ui.components.NewShapeLogo
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
                    NewShapeViewModel(repository = repository, currentUserId = user.uid)
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
                        onRegisterNewStudent = { name, phone -> studioViewModel.registerAndEnterStudentMode(name, phone) }
                    )

                    AppRole.PT -> PtMainScaffold(
                        state = data,
                        viewModel = studioViewModel,
                        onSignOut = performSignOut
                    )

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
