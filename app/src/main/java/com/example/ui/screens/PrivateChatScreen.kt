package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.example.data.model.ChatMessageRecord
import com.example.data.model.ClientRecord
import com.example.ui.components.EmptyStateBox
import com.example.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val ReadReceiptBlueOnGold = Color(0xFF1E40AF)
private val ReadReceiptBlueOnDark = Color(0xFF38BDF8)

@Composable
internal fun ChatReceiptStatusIcon(
    message: ChatMessageRecord,
    onGoldBubble: Boolean = true,
    modifier: Modifier = Modifier
) {
    val isRead = message.readAtMillis > 0L
    val isDelivered = message.deliveredAtMillis > 0L

    when {
        isRead -> Icon(
            imageVector = Icons.Default.DoneAll,
            contentDescription = "Mensagem lida",
            tint = if (onGoldBubble) ReadReceiptBlueOnGold else ReadReceiptBlueOnDark,
            modifier = modifier.size(15.dp)
        )
        isDelivered -> Icon(
            imageVector = Icons.Default.DoneAll,
            contentDescription = "Mensagem entregue",
            tint = if (onGoldBubble) TextOnGold.copy(alpha = 0.72f) else TextSecondaryDark,
            modifier = modifier.size(15.dp)
        )
        else -> Icon(
            imageVector = Icons.Default.Done,
            contentDescription = "Mensagem enviada",
            tint = if (onGoldBubble) TextOnGold.copy(alpha = 0.56f) else TextSecondaryDark.copy(alpha = 0.7f),
            modifier = modifier.size(15.dp)
        )
    }
}

@Composable
fun PrivateChatScreen(
    client: ClientRecord,
    messages: List<ChatMessageRecord>,
    viewerRole: String, // "PT" or "STUDENT"
    onSendMessage: (String) -> Unit,
    onMarkRead: (() -> Unit)? = null,
    onBack: (() -> Unit)? = null
) {
    if (onBack != null) {
        BackHandler(onBack = onBack)
    }

    var inputText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

    val hasUnreadIncoming = remember(messages, viewerRole) {
        messages.any { it.senderRole != viewerRole && it.readAtMillis == 0L }
    }

    LaunchedEffect(client.id, hasUnreadIncoming, messages.size) {
        onMarkRead?.invoke()
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBg)
    ) {
        Surface(color = CharcoalSurface, tonalElevation = 2.dp) {
            Column {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (onBack != null) {
                        IconButton(onClick = onBack, modifier = Modifier.testTag("chat_back_button")) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar", tint = TextPrimaryDark)
                        }
                    }
                    Column(modifier = Modifier.weight(1f).padding(start = if (onBack == null) 8.dp else 4.dp)) {
                        Text(
                            text = if (viewerRole == "PT") client.name else "Personal Trainer · New Shape",
                            style = MaterialTheme.typography.titleMedium,
                            color = TextPrimaryDark
                        )
                        val subtitle = if (viewerRole == "PT") {
                            "Chat privado · ${client.phone.ifBlank { "Sem telemóvel" }}"
                        } else {
                            "Conversa privada direta com o teu PT"
                        }
                        Text(
                            text = subtitle,
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    }
                }
                HorizontalDivider(color = HairlineBorder)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Done,
                        contentDescription = null,
                        tint = TextSecondaryDark.copy(alpha = 0.7f),
                        modifier = Modifier.size(13.dp)
                    )
                    Spacer(Modifier.width(3.dp))
                    Text("Enviada", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                    Spacer(Modifier.width(10.dp))
                    Icon(
                        Icons.Default.DoneAll,
                        contentDescription = null,
                        tint = TextSecondaryDark,
                        modifier = Modifier.size(13.dp)
                    )
                    Spacer(Modifier.width(3.dp))
                    Text("Entregue", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                    Spacer(Modifier.width(10.dp))
                    Icon(
                        Icons.Default.DoneAll,
                        contentDescription = null,
                        tint = ReadReceiptBlueOnDark,
                        modifier = Modifier.size(13.dp)
                    )
                    Spacer(Modifier.width(3.dp))
                    Text("Lida", style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
                }
            }
        }

        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            contentPadding = PaddingValues(vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (messages.isEmpty()) {
                item {
                    EmptyStateBox(
                        icon = Icons.Default.ChatBubbleOutline,
                        title = "Sem mensagens ainda",
                        subtitle = "Envia uma mensagem para iniciar a conversa privada."
                    )
                }
            } else {
                items(messages, key = { it.id }) { msg ->
                    val isMine = msg.senderRole == viewerRole
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = if (isMine) Alignment.End else Alignment.Start
                    ) {
                        Surface(
                            color = if (isMine) NewShapeGold else ElevatedCharcoal,
                            shape = RoundedCornerShape(
                                topStart = 16.dp,
                                topEnd = 16.dp,
                                bottomStart = if (isMine) 16.dp else 4.dp,
                                bottomEnd = if (isMine) 4.dp else 16.dp
                            ),
                            modifier = Modifier.widthIn(max = 300.dp)
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                                Text(
                                    text = msg.text,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = if (isMine) TextOnGold else TextPrimaryDark
                                )
                                Spacer(Modifier.height(4.dp))
                                Row(
                                    modifier = Modifier.align(Alignment.End),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Text(
                                        text = timeFormat.format(Date(msg.timestampMillis)),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (isMine) TextOnGold.copy(alpha = 0.72f) else TextSecondaryDark
                                    )
                                    if (isMine) {
                                        ChatReceiptStatusIcon(message = msg, onGoldBubble = true)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Surface(color = CharcoalSurface, tonalElevation = 4.dp) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    placeholder = { Text("Escreve uma mensagem...") },
                    maxLines = 3,
                    modifier = Modifier
                        .weight(1f)
                        .testTag("chat_input_field"),
                    colors = darkFieldColors()
                )
                Spacer(Modifier.width(8.dp))
                FilledIconButton(
                    onClick = {
                        if (inputText.isNotBlank()) {
                            onSendMessage(inputText)
                            inputText = ""
                        }
                    },
                    colors = IconButtonDefaults.filledIconButtonColors(
                        containerColor = NewShapeGold,
                        contentColor = TextOnGold
                    ),
                    modifier = Modifier
                        .size(48.dp)
                        .testTag("chat_send_button")
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Enviar mensagem")
                }
            }
        }
    }
}
