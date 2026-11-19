package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.model.FoodItemRecord
import com.example.data.model.MealType
import com.example.data.model.NutritionEntryRecord
import com.example.ui.NewShapeViewModel
import com.example.ui.StudioUiState
import com.example.ui.components.*
import com.example.ui.theme.*

@Composable
fun PtNutritionTab(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    var selectedSubTab by remember { mutableIntStateOf(0) }
    val subTabs = listOf("Plano por Aluno", "Lista de Alimentos (${state.foodItems.size})")

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(
            selectedTabIndex = selectedSubTab,
            containerColor = CharcoalSurface,
            contentColor = NewShapeGold,
            divider = { HorizontalDivider(color = HairlineBorder) }
        ) {
            subTabs.forEachIndexed { idx, title ->
                Tab(
                    selected = selectedSubTab == idx,
                    onClick = { selectedSubTab = idx },
                    modifier = Modifier.testTag("pt_nutrition_subtab_$idx"),
                    text = {
                        Text(
                            text = title,
                            fontWeight = if (selectedSubTab == idx) FontWeight.Bold else FontWeight.Medium,
                            color = if (selectedSubTab == idx) NewShapeGold else TextSecondaryDark
                        )
                    }
                )
            }
        }

        if (selectedSubTab == 0) {
            NutritionPlanBuilderSection(state = state, viewModel = viewModel)
        } else {
            FoodCatalogSection(state = state, viewModel = viewModel)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NutritionPlanBuilderSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    val activeClients = remember(state.clients) { state.clients.filter { it.active } }
    var selectedClientId by remember(activeClients) { mutableStateOf(activeClients.firstOrNull()?.id.orEmpty()) }
    val selectedClient = activeClients.find { it.id == selectedClientId } ?: activeClients.firstOrNull()
    var dropdownExpanded by remember { mutableStateOf(false) }

    var addMealTarget by remember { mutableStateOf<MealType?>(null) }

    val clientEntries = remember(state.nutritionEntries, selectedClient?.id) {
        if (selectedClient == null) emptyList()
        else state.nutritionEntries.filter { it.clientId == selectedClient.id }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            BrandCard {
                Text("Aluno", style = MaterialTheme.typography.labelMedium, color = NewShapeGold)
                Spacer(Modifier.height(6.dp))
                ExposedDropdownMenuBox(
                    expanded = dropdownExpanded,
                    onExpandedChange = { dropdownExpanded = !dropdownExpanded }
                ) {
                    OutlinedTextField(
                        value = selectedClient?.name ?: "Sem alunos ativos",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                        colors = darkFieldColors()
                    )
                    ExposedDropdownMenu(
                        expanded = dropdownExpanded,
                        onDismissRequest = { dropdownExpanded = false }
                    ) {
                        activeClients.forEach { c ->
                            DropdownMenuItem(
                                text = { Text(c.name) },
                                onClick = {
                                    selectedClientId = c.id
                                    dropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        }

        item {
            DailyMacrosSummaryCard(entries = clientEntries)
        }

        items(MealType.entries.toList(), key = { it.name }) { meal ->
            val mealEntries = clientEntries.filter { it.mealType == meal.name }
            MealCard(
                meal = meal,
                entries = mealEntries,
                onAddFood = if (selectedClient != null) { { addMealTarget = meal } } else null,
                onRemoveEntry = { entryId -> viewModel.removeNutritionEntry(entryId) }
            )
        }
    }

    addMealTarget?.let { meal ->
        selectedClient?.let { client ->
            AddFoodToMealDialog(
                mealLabel = meal.label,
                foods = state.foodItems,
                onDismiss = { addMealTarget = null },
                onAdd = { food, grams ->
                    viewModel.addNutritionEntry(client.id, meal, food, grams)
                    addMealTarget = null
                }
            )
        }
    }
}

@Composable
fun DailyMacrosSummaryCard(entries: List<NutritionEntryRecord>) {
    val totalKcal = entries.sumOf { it.kcal }
    val totalProtein = entries.sumOf { it.protein }
    val totalCarbs = entries.sumOf { it.carbs }
    val totalFat = entries.sumOf { it.fat }

    BrandCard(highlightBorder = true) {
        Text("Resumo Diário de Macros", style = MaterialTheme.typography.titleMedium, color = NewShapeGoldBright)
        Spacer(Modifier.height(10.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            MacroPill(label = "Calorias", value = "${String.format("%.0f", totalKcal)} kcal", color = NewShapeGoldBright)
            MacroPill(label = "Proteína", value = "${String.format("%.1f", totalProtein)} g", color = ConfirmedGreen)
            MacroPill(label = "Hidratos", value = "${String.format("%.1f", totalCarbs)} g", color = InfoBlue)
            MacroPill(label = "Gordura", value = "${String.format("%.1f", totalFat)} g", color = PendingAmber)
        }
    }
}

@Composable
private fun MacroPill(
    label: String,
    value: String,
    color: androidx.compose.ui.graphics.Color
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = color)
        Text(label, style = MaterialTheme.typography.labelSmall, color = TextSecondaryDark)
    }
}

@Composable
fun MealCard(
    meal: MealType,
    entries: List<NutritionEntryRecord>,
    onAddFood: (() -> Unit)? = null,
    onRemoveEntry: ((String) -> Unit)? = null
) {
    val mealKcal = entries.sumOf { it.kcal }
    BrandCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(meal.label, style = MaterialTheme.typography.titleMedium, color = TextPrimaryDark)
                Text(
                    text = "${String.format("%.0f", mealKcal)} kcal · P ${String.format("%.0f", entries.sumOf { it.protein })}g · HC ${String.format("%.0f", entries.sumOf { it.carbs })}g · G ${String.format("%.0f", entries.sumOf { it.fat })}g",
                    style = MaterialTheme.typography.labelSmall,
                    color = NewShapeGold
                )
            }
            if (onAddFood != null) {
                TextButton(onClick = onAddFood) {
                    Text("+ Alimento", color = NewShapeGoldBright, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (entries.isEmpty()) {
            Spacer(Modifier.height(6.dp))
            Text("Sem alimentos registados nesta refeição.", style = MaterialTheme.typography.bodySmall, color = TextSecondaryDark)
        } else {
            Spacer(Modifier.height(8.dp))
            HorizontalDivider(color = HairlineBorder)
            entries.forEach { entry ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "${entry.foodName} (${String.format("%.0f", entry.grams)}g)",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextPrimaryDark
                        )
                        Text(
                            text = "${String.format("%.0f", entry.kcal)} kcal · P ${String.format("%.1f", entry.protein)}g · HC ${String.format("%.1f", entry.carbs)}g · G ${String.format("%.1f", entry.fat)}g",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondaryDark
                        )
                    }
                    if (onRemoveEntry != null) {
                        IconButton(onClick = { onRemoveEntry(entry.id) }) {
                            Icon(Icons.Default.Close, contentDescription = "Remover alimento", tint = DangerRed, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FoodCatalogSection(
    state: StudioUiState,
    viewModel: NewShapeViewModel
) {
    var search by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("Todos") }
    var showAddFoodDialog by remember { mutableStateOf(false) }
    var showImportFoodsDialog by remember { mutableStateOf(false) }

    val categories = remember(state.foodItems) {
        listOf("Todos") + state.foodItems.map { it.category }.distinct().sorted()
    }
    val filtered = remember(state.foodItems, search, selectedCategory) {
        state.foodItems.filter { fd ->
            (selectedCategory == "Todos" || fd.category == selectedCategory) &&
                (search.isBlank() || fd.name.contains(search, ignoreCase = true))
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Alimentos (por 100g)", style = MaterialTheme.typography.titleLarge, color = TextPrimaryDark)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    DarkSecondaryButton(
                        text = "Importar Excel",
                        icon = Icons.Default.UploadFile,
                        onClick = { showImportFoodsDialog = true },
                        modifier = Modifier.weight(1f)
                    )
                    GoldPrimaryButton(
                        text = "+ Novo Alimento",
                        onClick = { showAddFoodDialog = true },
                        modifier = Modifier.weight(1f),
                        testTag = "add_food_button"
                    )
                }
            }
        }
        item {
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                placeholder = { Text("Procurar alimento...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondaryDark) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = darkFieldColors()
            )
        }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(categories) { cat ->
                    FilterChip(
                        selected = selectedCategory == cat,
                        onClick = { selectedCategory = cat },
                        label = { Text(cat) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NewShapeGold,
                            selectedLabelColor = TextOnGold
                        )
                    )
                }
            }
        }

        items(filtered, key = { it.id }) { fd ->
            Surface(
                color = CharcoalSurface,
                shape = MaterialTheme.shapes.medium,
                border = BorderStroke(1.dp, HairlineBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(fd.name, style = MaterialTheme.typography.titleSmall, color = TextPrimaryDark)
                        Text(
                            text = "${String.format("%.0f", fd.kcalPer100g)} kcal · P ${fd.proteinPer100g}g · HC ${fd.carbsPer100g}g · G ${fd.fatPer100g}g",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryDark
                        )
                    }
                    StatusPill(fd.category, NewShapeGoldBright, NewShapeGoldMuted)
                }
            }
        }
    }

    if (showAddFoodDialog) {
        AddCustomFoodDialog(
            onDismiss = { showAddFoodDialog = false },
            onSave = { name, cat, kcal, p, c, f ->
                viewModel.addCustomFood(name, cat, kcal, p, c, f)
                showAddFoodDialog = false
            }
        )
    }

    if (showImportFoodsDialog) {
        ImportFoodsDialog(
            onDismiss = { showImportFoodsDialog = false },
            onImport = { raw, onDone -> viewModel.importFoodsCsv(raw, onDone) }
        )
    }
}

@Composable
private fun AddFoodToMealDialog(
    mealLabel: String,
    foods: List<FoodItemRecord>,
    onDismiss: () -> Unit,
    onAdd: (FoodItemRecord, Double) -> Unit
) {
    var search by remember { mutableStateOf("") }
    val filtered = remember(foods, search) {
        foods.filter { search.isBlank() || it.name.contains(search, ignoreCase = true) }
    }
    var selectedFood by remember { mutableStateOf(foods.firstOrNull()) }
    var gramsText by remember { mutableStateOf("100") }
    val grams = gramsText.toDoubleOrNull() ?: 0.0

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Adicionar a $mealLabel", color = TextPrimaryDark) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it },
                    label = { Text("Procurar alimento...") },
                    singleLine = true,
                    colors = darkFieldColors()
                )
                Surface(
                    color = ElevatedCharcoal,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth().heightIn(max = 170.dp)
                ) {
                    LazyColumn {
                        items(filtered, key = { it.id }) { fd ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = selectedFood?.id == fd.id,
                                    onClick = { selectedFood = fd },
                                    colors = RadioButtonDefaults.colors(selectedColor = NewShapeGold)
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(fd.name, style = MaterialTheme.typography.bodySmall, color = TextPrimaryDark)
                                    Text("${fd.kcalPer100g.toInt()} kcal/100g", style = MaterialTheme.typography.labelSmall, color = NewShapeGold)
                                }
                            }
                        }
                    }
                }
                OutlinedTextField(
                    value = gramsText,
                    onValueChange = { gramsText = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text("Quantidade (gramas)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    colors = darkFieldColors()
                )
                selectedFood?.let { fd ->
                    val factor = grams / 100.0
                    Text(
                        text = "Calculado: ${String.format("%.0f", fd.kcalPer100g * factor)} kcal · P ${String.format("%.1f", fd.proteinPer100g * factor)}g · HC ${String.format("%.1f", fd.carbsPer100g * factor)}g · G ${String.format("%.1f", fd.fatPer100g * factor)}g",
                        style = MaterialTheme.typography.labelMedium,
                        color = NewShapeGoldBright
                    )
                }
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Adicionar",
                enabled = selectedFood != null && grams > 0.0,
                onClick = { selectedFood?.let { onAdd(it, grams) } }
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
}

@Composable
private fun AddCustomFoodDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, Double, Double, Double, Double) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Proteína") }
    var kcal by remember { mutableStateOf("") }
    var protein by remember { mutableStateOf("") }
    var carbs by remember { mutableStateOf("") }
    var fat by remember { mutableStateOf("") }

    val cats = listOf("Proteína", "Hidratos", "Gordura", "Laticínios", "Fruta", "Legumes", "Suplemento")

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Novo Alimento (por 100g)", color = TextPrimaryDark) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nome do alimento") },
                    singleLine = true,
                    colors = darkFieldColors()
                )
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(cats) { c ->
                        FilterChip(
                            selected = category == c,
                            onClick = { category = c },
                            label = { Text(c) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = NewShapeGold,
                                selectedLabelColor = TextOnGold
                            )
                        )
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = kcal,
                        onValueChange = { kcal = it.filter { ch -> ch.isDigit() || ch == '.' } },
                        label = { Text("Kcal") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
                    OutlinedTextField(
                        value = protein,
                        onValueChange = { protein = it.filter { ch -> ch.isDigit() || ch == '.' } },
                        label = { Text("Prot (g)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = carbs,
                        onValueChange = { carbs = it.filter { ch -> ch.isDigit() || ch == '.' } },
                        label = { Text("Hidratos (g)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
                    OutlinedTextField(
                        value = fat,
                        onValueChange = { fat = it.filter { ch -> ch.isDigit() || ch == '.' } },
                        label = { Text("Gordura (g)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f),
                        colors = darkFieldColors()
                    )
                }
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Guardar Alimento",
                enabled = name.isNotBlank(),
                onClick = {
                    onSave(
                        name,
                        category,
                        kcal.toDoubleOrNull() ?: 0.0,
                        protein.toDoubleOrNull() ?: 0.0,
                        carbs.toDoubleOrNull() ?: 0.0,
                        fat.toDoubleOrNull() ?: 0.0
                    )
                }
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = TextSecondaryDark) }
        }
    )
}

@Composable
private fun ImportFoodsDialog(
    onDismiss: () -> Unit,
    onImport: (String, (com.example.data.ImportResult) -> Unit) -> Unit
) {
    var rawText by remember {
        mutableStateOf("Alimento;Categoria;Kcal;Proteina;Hidratos;Gordura\nBife de Peru;Proteína;111;24;0;1.5\nPão de Mistura;Hidratos;255;8.5;50;1.8")
    }
    var resultText by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CharcoalSurface,
        title = { Text("Importar Tabela Excel / CSV", color = TextPrimaryDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Copia linhas diretamente do Excel (Tab) ou cola em CSV (;) por 100g: Nome;Categoria;Kcal;Prot;HC;Gord.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryDark
                )
                OutlinedTextField(
                    value = rawText,
                    onValueChange = { rawText = it },
                    minLines = 5,
                    modifier = Modifier.fillMaxWidth().testTag("import_foods_input"),
                    colors = darkFieldColors()
                )
                if (resultText != null) {
                    Text(resultText!!, style = MaterialTheme.typography.bodySmall, color = NewShapeGoldBright)
                }
            }
        },
        confirmButton = {
            GoldPrimaryButton(
                text = "Importar Alimentos",
                onClick = {
                    onImport(rawText) { res ->
                        resultText = "Adicionados: ${res.added} · Duplicados ignorados: ${res.ignored} · Erros: ${res.errors.size}"
                    }
                },
                testTag = "confirm_import_foods_btn"
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Fechar", color = TextSecondaryDark) }
        }
    )
}
