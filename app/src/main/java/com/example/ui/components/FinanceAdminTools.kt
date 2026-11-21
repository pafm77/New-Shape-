package com.example.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.AccountingExportPeriod
import com.example.data.ReportExporter
import com.example.data.model.ClientRecord
import com.example.data.model.FidelizacaoRecord
import com.example.data.model.PaymentRecord
import com.example.ui.theme.*
import java.util.Calendar
import java.util.Locale

/**
 * Admin-only (pafm77pedrinho77@gmail.com) finance tools:
 * - Ponto 2: Overdue monthly payments & expiring fidelizações alerts with 1-tap WhatsApp & Quick Pay.
 * - Ponto 7: Accounting CSV / Excel export (UTF-8 BOM + `;` delimiter).
 */
@Composable
fun FinanceAdminTools(
    isSuperAdmin: Boolean,
    currentMonthYear: String,
    currentMonthLabel: String,
    clients: List<ClientRecord>,
    payments: List<PaymentRecord>,
    fidelizacoes: List<FidelizacaoRecord>,
    whatsappWebMode: Boolean,
    onQuickPayClient: (ClientRecord) -> Unit,
    onBanner: (String) -> Unit
) {
    if (!isSuperAdmin) return

    val context = LocalContext.current
    val activeClients = remember(clients) { clients.filter { it.active } }

    // Ponto 2A: Active clients without paid monthly fee for currentMonthYear
    val overdueClients = remember(activeClients, payments, currentMonthYear) {
        val paidIds = payments
            .filter { it.monthYear == currentMonthYear && it.paid }
            .map { it.clientId }
            .toSet()
        activeClients
            .filter { it.id !in paidIds }
            .sortedBy { it.name.lowercase(Locale.ROOT) }
    }

    // Ponto 2B: Active clients whose latest fidelização expires within 30 days or already expired
    data class ExpiringFidAlert(
        val client: ClientRecord,
        val fid: FidelizacaoRecord,
        val daysLeft: Int
    )

    val expiringFids = remember(activeClients, fidelizacoes) {
        val now = System.currentTimeMillis()
        val activeById = activeClients.associateBy { it.id }
        fidelizacoes
            .groupBy { it.clientId }
            .mapNotNull { (clientId, list) ->
                val client = activeById[clientId] ?: return@mapNotNull null
                val latest = list.maxByOrNull { it.endDateMillis } ?: return@mapNotNull null
                val daysLeft = ((latest.endDateMillis - now) / 86_400_000L).toInt()
                if (daysLeft <= 30) ExpiringFidAlert(client, latest, daysLeft) else null
            }
            .sortedBy { it.daysLeft }
    }

    // Ponto 7: Accounting CSV export period selector
    var selectedPeriod by remember { mutableStateOf(AccountingExportPeriod.CURRENT_MONTH) }
    val periodPreview = remember(payments, selectedPeriod, currentMonthYear) {
        val allowed = when (selectedPeriod) {
            AccountingExportPeriod.CURRENT_MONTH -> setOf(currentMonthYear)
            AccountingExportPeriod.LAST_6_MONTHS -> {
                (0 downTo -5).map { off ->
                    val cal = Calendar.getInstance().apply { add(Calendar.MONTH, off) }
                    String.format(Locale.US, "%04d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1)
                }.toSet()
            }
            AccountingExportPeriod.ALL -> null
        }
        val list = payments.filter { it.paid && (allowed == null || it.monthYear in allowed) }
        list.size to list.sumOf { it.amountEur }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Ponto 2: Alerts Card
        BrandCard(highlightBorder = overdueClients.isNotEmpty() || expiringFids.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Default.NotificationsActive,
                        contentDescription = "Alertas financeiros",
                        tint = NewShapeGoldBright
                    )
                    Column {
                        Text(
                            text = "Alertas de Cobrança & Renovações",
                            style = MaterialTheme.typography.titleMedium,
                            color = TextPrimaryDark
                        )
                        Text(
                            text = "Exclusivo Admin · $currentMonthLabel",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondaryDark
                        )
                    }
                }
                val totalAlerts = overdueClients.size + expiringFids.size
                StatusPill(
                    text = if (totalAlerts > 0) "$totalAlerts alerta(s)" else "Tudo em dia ✓",
                    textColor = if (totalAlerts > 0) PendingAmber else ConfirmedGreen,
                    containerColor = if (totalAlerts > 0) PendingAmberContainer else ConfirmedGreenContainer
                )
            }

            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = HairlineBorder)
            Spacer(Modifier.height(10.dp))

            // Sub-section A: Overdue monthly fees
            Text(
                text = "Mensalidades por pagar ($currentMonthLabel): ${overdueClients.size}",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = if (overdueClients.isNotEmpty()) PendingAmber else ConfirmedGreen
            )
            Spacer(Modifier.height(6.dp))

            if (overdueClients.isEmpty()) {
                Text(
                    text = "Todos os alunos ativos já têm a mensalidade de $currentMonthLabel regularizada.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    overdueClients.take(8).forEach { client ->
                        Surface(
                            color = ElevatedCharcoal,
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, PendingAmber.copy(alpha = 0.45f)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("admin_overdue_client_${client.id}")
                        ) {
                            Column(
                                modifier = Modifier.padding(10.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = client.name,
                                            style = MaterialTheme.typography.titleSmall,
                                            color = TextPrimaryDark
                                        )
                                        val feeLabel = if (client.monthlyFeeEur > 0.0) {
                                            "€${String.format(Locale.US, "%.0f", client.monthlyFeeEur)}/mês"
                                        } else {
                                            "Sem valor definido"
                                        }
                                        val mod = if (client.trainingType == "PERSONALIZADO") "Personalizado" else "Grupo"
                                        Text(
                                            text = "$mod · $feeLabel",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = TextSecondaryDark
                                        )
                                    }
                                    StatusPill("Por pagar", PendingAmber, PendingAmberContainer)
                                }
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    DarkSecondaryButton(
                                        text = "Avisar WhatsApp",
                                        icon = Icons.AutoMirrored.Filled.Chat,
                                        onClick = {
                                            val firstName = client.name.trim().split(" ").firstOrNull().orEmpty()
                                            val feePart = if (client.monthlyFeeEur > 0.0) {
                                                " (€${String.format(Locale.US, "%.0f", client.monthlyFeeEur)})"
                                            } else ""
                                            val msg = "Olá $firstName! 😊 Passando só para lembrar a mensalidade de $currentMonthLabel no estúdio New Shape$feePart. Obrigado e até ao próximo treino! 💪"
                                            openWhatsApp(context, client.phone, msg, whatsappWebMode)
                                        },
                                        modifier = Modifier
                                            .weight(1f)
                                            .testTag("admin_overdue_wa_${client.id}")
                                    )
                                    GoldPrimaryButton(
                                        text = "Registar Pago",
                                        icon = Icons.Default.Payments,
                                        onClick = { onQuickPayClient(client) },
                                        modifier = Modifier.weight(1f),
                                        testTag = "admin_overdue_pay_${client.id}"
                                    )
                                }
                            }
                        }
                    }
                    if (overdueClients.size > 8) {
                        Text(
                            text = "+ ${overdueClients.size - 8} aluno(s) adicional(ais) por pagar.",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondaryDark
                        )
                    }
                }
            }

            Spacer(Modifier.height(14.dp))
            HorizontalDivider(color = HairlineBorder)
            Spacer(Modifier.height(10.dp))

            // Sub-section B: Expiring / Expired Fidelizações
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (expiringFids.isNotEmpty()) {
                    Icon(
                        imageVector = Icons.Default.WarningAmber,
                        contentDescription = "Fidelizações a expirar",
                        tint = DangerRed,
                        modifier = Modifier.size(16.dp)
                    )
                }
                Text(
                    text = "Fidelizações a expirar (≤ 30 dias) ou expiradas: ${expiringFids.size}",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (expiringFids.isNotEmpty()) DangerRed else ConfirmedGreen
                )
            }
            Spacer(Modifier.height(6.dp))

            if (expiringFids.isEmpty()) {
                Text(
                    text = "Nenhuma fidelização expira nos próximos 30 dias.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    expiringFids.forEach { item ->
                        val isExpired = item.daysLeft < 0
                        Surface(
                            color = ElevatedCharcoal,
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, (if (isExpired) DangerRed else PendingAmber).copy(alpha = 0.5f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(item.client.name, style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                                    Text(
                                        text = "Contrato ${item.fid.durationMonths}m · Fim: ${formatShortDate(item.fid.endDateMillis)}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = TextSecondaryDark
                                    )
                                    Spacer(Modifier.height(4.dp))
                                    StatusPill(
                                        text = if (isExpired) "Expirada há ${-item.daysLeft}d" else "Expira em ${item.daysLeft} dias",
                                        textColor = if (isExpired) DangerRed else PendingAmber,
                                        containerColor = if (isExpired) DangerRedContainer else PendingAmberContainer
                                    )
                                }
                                Spacer(Modifier.width(8.dp))
                                DarkSecondaryButton(
                                    text = "Renovar WA",
                                    icon = Icons.AutoMirrored.Filled.Chat,
                                    onClick = {
                                        val firstName = item.client.name.trim().split(" ").firstOrNull().orEmpty()
                                        val msg = if (isExpired) {
                                            "Olá $firstName! 😊 A tua fidelização de ${item.fid.durationMonths} meses no New Shape terminou em ${formatShortDate(item.fid.endDateMillis)}. Queres renovar o teu plano connosco? 💪"
                                        } else {
                                            "Olá $firstName! 😊 A tua fidelização de ${item.fid.durationMonths} meses no New Shape termina em ${formatShortDate(item.fid.endDateMillis)} (faltam ${item.daysLeft} dias). Vamos preparar a tua renovação? 💪"
                                        }
                                        openWhatsApp(context, item.client.phone, msg, whatsappWebMode)
                                    },
                                    modifier = Modifier.testTag("admin_fid_wa_${item.client.id}")
                                )
                            }
                        }
                    }
                }
            }
        }

        // Ponto 7: Accounting CSV / Excel Export Card
        BrandCard {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Download,
                    contentDescription = "Exportação para contabilidade",
                    tint = NewShapeGoldBright
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Exportação para Contabilidade (Excel / CSV)",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimaryDark
                    )
                    Text(
                        text = "Formato Excel PT (UTF-8, separador ';') com totais por modalidade e método",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondaryDark
                    )
                }
            }

            Spacer(Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                AccountingExportPeriod.entries.forEach { period ->
                    FilterChip(
                        selected = selectedPeriod == period,
                        onClick = { selectedPeriod = period },
                        label = { Text(period.label, maxLines = 1) },
                        modifier = Modifier.testTag("admin_csv_period_${period.name}"),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NewShapeGold,
                            selectedLabelColor = TextOnGold
                        )
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            Text(
                text = "${periodPreview.first} pagamento(s) · Total €${String.format(Locale.US, "%.2f", periodPreview.second)}",
                style = MaterialTheme.typography.labelMedium,
                color = NewShapeGoldBright,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(10.dp))

            GoldPrimaryButton(
                text = "Exportar CSV para Contabilidade",
                icon = Icons.Default.Download,
                enabled = periodPreview.first > 0,
                onClick = {
                    val ok = ReportExporter.shareFinanceAccountingCsv(
                        context = context,
                        isSuperAdmin = isSuperAdmin,
                        period = selectedPeriod,
                        currentMonthYear = currentMonthYear,
                        payments = payments,
                        clients = clients
                    )
                    onBanner(
                        if (ok) "CSV de contabilidade pronto para partilhar!"
                        else "Não foi possível gerar o ficheiro CSV."
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                testTag = "admin_export_csv_btn"
            )
        }
    }
}
