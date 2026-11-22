package com.example.data

import com.example.data.model.*
import java.util.Calendar

object SeedCatalog {

    val defaultMuscleGroups: List<String> = ExerciseTableCatalog.defaultMuscleGroups

    val defaultExercises: List<ExerciseRecord>
        get() = ExerciseTableCatalog.csvTableExercises

    private val coreFoods: List<FoodItemRecord> = listOf(
        // Proteína Animal & Vegetal
        FoodItemRecord(id = "fd_1", name = "Peito de Frango Grelhado", category = "Proteína", kcalPer100g = 165.0, proteinPer100g = 31.0, carbsPer100g = 0.0, fatPer100g = 3.6),
        FoodItemRecord(id = "fd_2", name = "Peito de Peru", category = "Proteína", kcalPer100g = 135.0, proteinPer100g = 29.0, carbsPer100g = 0.0, fatPer100g = 1.5),
        FoodItemRecord(id = "fd_3", name = "Carne Picada Magra (5% MG)", category = "Proteína", kcalPer100g = 137.0, proteinPer100g = 21.0, carbsPer100g = 0.0, fatPer100g = 5.0),
        FoodItemRecord(id = "fd_4", name = "Bife da Vazia / Alcatra", category = "Proteína", kcalPer100g = 180.0, proteinPer100g = 26.0, carbsPer100g = 0.0, fatPer100g = 8.0),
        FoodItemRecord(id = "fd_5", name = "Salmão Grelhado", category = "Proteína", kcalPer100g = 208.0, proteinPer100g = 20.0, carbsPer100g = 0.0, fatPer100g = 13.0),
        FoodItemRecord(id = "fd_6", name = "Atum em Água (Escorrido)", category = "Proteína", kcalPer100g = 116.0, proteinPer100g = 26.0, carbsPer100g = 0.0, fatPer100g = 1.0),
        FoodItemRecord(id = "fd_7", name = "Pescada / Bacalhau Cozido", category = "Proteína", kcalPer100g = 90.0, proteinPer100g = 20.0, carbsPer100g = 0.0, fatPer100g = 0.8),
        FoodItemRecord(id = "fd_8", name = "Ovo Inteiro Cozido", category = "Proteína", kcalPer100g = 155.0, proteinPer100g = 13.0, carbsPer100g = 1.1, fatPer100g = 11.0),
        FoodItemRecord(id = "fd_9", name = "Claras de Ovo Líquidas", category = "Proteína", kcalPer100g = 52.0, proteinPer100g = 11.0, carbsPer100g = 0.7, fatPer100g = 0.2),
        FoodItemRecord(id = "fd_14", name = "Tofu Firme", category = "Proteína", kcalPer100g = 144.0, proteinPer100g = 15.8, carbsPer100g = 2.8, fatPer100g = 8.7),
        FoodItemRecord(id = "fd_39", name = "Lombo de Porco Magro", category = "Proteína", kcalPer100g = 143.0, proteinPer100g = 26.0, carbsPer100g = 0.0, fatPer100g = 3.5),
        FoodItemRecord(id = "fd_40", name = "Dourada / Robalo Grelhado", category = "Proteína", kcalPer100g = 115.0, proteinPer100g = 21.5, carbsPer100g = 0.0, fatPer100g = 2.8),
        FoodItemRecord(id = "fd_41", name = "Cavala / Sardinha Assada", category = "Proteína", kcalPer100g = 205.0, proteinPer100g = 24.0, carbsPer100g = 0.0, fatPer100g = 11.5),
        FoodItemRecord(id = "fd_42", name = "Camarão Cozido (Miolo)", category = "Proteína", kcalPer100g = 99.0, proteinPer100g = 24.0, carbsPer100g = 0.2, fatPer100g = 0.3),
        FoodItemRecord(id = "fd_43", name = "Polvo / Lulas Grelhadas", category = "Proteína", kcalPer100g = 92.0, proteinPer100g = 18.0, carbsPer100g = 2.2, fatPer100g = 1.2),
        FoodItemRecord(id = "fd_44", name = "Fiambre de Peru / Frango Extra Magro", category = "Proteína", kcalPer100g = 98.0, proteinPer100g = 19.0, carbsPer100g = 1.5, fatPer100g = 1.8),
        FoodItemRecord(id = "fd_45", name = "Seitan", category = "Proteína", kcalPer100g = 120.0, proteinPer100g = 24.0, carbsPer100g = 4.0, fatPer100g = 1.0),
        FoodItemRecord(id = "fd_46", name = "Tempeh", category = "Proteína", kcalPer100g = 193.0, proteinPer100g = 20.0, carbsPer100g = 7.6, fatPer100g = 10.8),

        // Laticínios & Bebidas Vegetais
        FoodItemRecord(id = "fd_10", name = "Queijo Quark 0% MG", category = "Laticínios", kcalPer100g = 62.0, proteinPer100g = 12.0, carbsPer100g = 3.5, fatPer100g = 0.2),
        FoodItemRecord(id = "fd_11", name = "Iogurte Grego Natural Ligeiro", category = "Laticínios", kcalPer100g = 59.0, proteinPer100g = 10.0, carbsPer100g = 3.6, fatPer100g = 0.4),
        FoodItemRecord(id = "fd_12", name = "Queijo Fresco Magro", category = "Laticínios", kcalPer100g = 75.0, proteinPer100g = 12.0, carbsPer100g = 3.0, fatPer100g = 1.5),
        FoodItemRecord(id = "fd_47", name = "Skyr Natural", category = "Laticínios", kcalPer100g = 63.0, proteinPer100g = 11.0, carbsPer100g = 4.0, fatPer100g = 0.2),
        FoodItemRecord(id = "fd_48", name = "Queijo Cottage", category = "Laticínios", kcalPer100g = 98.0, proteinPer100g = 11.1, carbsPer100g = 3.4, fatPer100g = 4.3),
        FoodItemRecord(id = "fd_49", name = "Queijo Mozzarella Light", category = "Laticínios", kcalPer100g = 165.0, proteinPer100g = 20.0, carbsPer100g = 1.5, fatPer100g = 8.5),
        FoodItemRecord(id = "fd_50", name = "Leite Magro", category = "Laticínios", kcalPer100g = 34.0, proteinPer100g = 3.4, carbsPer100g = 4.9, fatPer100g = 0.1),
        FoodItemRecord(id = "fd_51", name = "Leite Meio-Gordo", category = "Laticínios", kcalPer100g = 46.0, proteinPer100g = 3.3, carbsPer100g = 4.8, fatPer100g = 1.6),
        FoodItemRecord(id = "fd_52", name = "Bebida de Soja Sem Açúcar", category = "Laticínios", kcalPer100g = 33.0, proteinPer100g = 3.3, carbsPer100g = 0.8, fatPer100g = 1.8),
        FoodItemRecord(id = "fd_53", name = "Bebida de Amêndoa Sem Açúcar", category = "Laticínios", kcalPer100g = 15.0, proteinPer100g = 0.5, carbsPer100g = 0.2, fatPer100g = 1.2),

        // Suplementos
        FoodItemRecord(id = "fd_13", name = "Whey Protein Concentrada", category = "Suplemento", kcalPer100g = 400.0, proteinPer100g = 78.0, carbsPer100g = 8.0, fatPer100g = 6.0),
        FoodItemRecord(id = "fd_54", name = "Whey Protein Isolada", category = "Suplemento", kcalPer100g = 370.0, proteinPer100g = 88.0, carbsPer100g = 2.0, fatPer100g = 1.0),
        FoodItemRecord(id = "fd_55", name = "Caseína Micelar", category = "Suplemento", kcalPer100g = 360.0, proteinPer100g = 80.0, carbsPer100g = 4.0, fatPer100g = 2.0),
        FoodItemRecord(id = "fd_56", name = "Proteína Vegetal (Ervilha/Arroz)", category = "Suplemento", kcalPer100g = 385.0, proteinPer100g = 76.0, carbsPer100g = 7.0, fatPer100g = 5.5),

        // Hidratos de Carbono & Leguminosas
        FoodItemRecord(id = "fd_15", name = "Arroz Basmati Cozido", category = "Hidratos", kcalPer100g = 130.0, proteinPer100g = 2.7, carbsPer100g = 28.0, fatPer100g = 0.3),
        FoodItemRecord(id = "fd_16", name = "Arroz Integral Cozido", category = "Hidratos", kcalPer100g = 123.0, proteinPer100g = 2.7, carbsPer100g = 25.6, fatPer100g = 1.0),
        FoodItemRecord(id = "fd_17", name = "Batata Doce Cozida/Assada", category = "Hidratos", kcalPer100g = 90.0, proteinPer100g = 2.0, carbsPer100g = 21.0, fatPer100g = 0.1),
        FoodItemRecord(id = "fd_18", name = "Batata Branca Cozida", category = "Hidratos", kcalPer100g = 87.0, proteinPer100g = 1.9, carbsPer100g = 20.0, fatPer100g = 0.1),
        FoodItemRecord(id = "fd_19", name = "Massa Integral Cozida", category = "Hidratos", kcalPer100g = 124.0, proteinPer100g = 5.3, carbsPer100g = 26.5, fatPer100g = 0.5),
        FoodItemRecord(id = "fd_20", name = "Flocos de Aveia", category = "Hidratos", kcalPer100g = 375.0, proteinPer100g = 13.5, carbsPer100g = 60.0, fatPer100g = 7.0),
        FoodItemRecord(id = "fd_21", name = "Pão Integral / Centeio", category = "Hidratos", kcalPer100g = 247.0, proteinPer100g = 9.0, carbsPer100g = 43.0, fatPer100g = 3.2),
        FoodItemRecord(id = "fd_22", name = "Quinoa Cozida", category = "Hidratos", kcalPer100g = 120.0, proteinPer100g = 4.4, carbsPer100g = 21.3, fatPer100g = 1.9),
        FoodItemRecord(id = "fd_23", name = "Grão-de-Bico Cozido", category = "Hidratos", kcalPer100g = 164.0, proteinPer100g = 8.9, carbsPer100g = 27.4, fatPer100g = 2.6),
        FoodItemRecord(id = "fd_24", name = "Feijão Preto Cozido", category = "Hidratos", kcalPer100g = 132.0, proteinPer100g = 8.9, carbsPer100g = 23.7, fatPer100g = 0.5),
        FoodItemRecord(id = "fd_57", name = "Lentilhas Cozidas", category = "Hidratos", kcalPer100g = 116.0, proteinPer100g = 9.0, carbsPer100g = 20.1, fatPer100g = 0.4),
        FoodItemRecord(id = "fd_58", name = "Tortitas de Arroz / Milho", category = "Hidratos", kcalPer100g = 387.0, proteinPer100g = 8.0, carbsPer100g = 81.0, fatPer100g = 2.8),
        FoodItemRecord(id = "fd_59", name = "Cuscuz Cozido", category = "Hidratos", kcalPer100g = 112.0, proteinPer100g = 3.8, carbsPer100g = 23.2, fatPer100g = 0.2),
        FoodItemRecord(id = "fd_60", name = "Arroz Branco / Carolino (Cru)", category = "Hidratos", kcalPer100g = 358.0, proteinPer100g = 7.0, carbsPer100g = 79.0, fatPer100g = 0.6),
        FoodItemRecord(id = "fd_61", name = "Farinha de Aveia", category = "Hidratos", kcalPer100g = 380.0, proteinPer100g = 14.0, carbsPer100g = 62.0, fatPer100g = 7.0),
        FoodItemRecord(id = "fd_62", name = "Mel", category = "Hidratos", kcalPer100g = 304.0, proteinPer100g = 0.3, carbsPer100g = 82.4, fatPer100g = 0.0),

        // Frutas
        FoodItemRecord(id = "fd_25", name = "Banana", category = "Fruta", kcalPer100g = 89.0, proteinPer100g = 1.1, carbsPer100g = 23.0, fatPer100g = 0.3),
        FoodItemRecord(id = "fd_26", name = "Maçã", category = "Fruta", kcalPer100g = 52.0, proteinPer100g = 0.3, carbsPer100g = 14.0, fatPer100g = 0.2),
        FoodItemRecord(id = "fd_27", name = "Mirtilos / Frutos Vermelhos", category = "Fruta", kcalPer100g = 57.0, proteinPer100g = 0.7, carbsPer100g = 14.5, fatPer100g = 0.3),
        FoodItemRecord(id = "fd_28", name = "Kiwi", category = "Fruta", kcalPer100g = 61.0, proteinPer100g = 1.1, carbsPer100g = 15.0, fatPer100g = 0.5),
        FoodItemRecord(id = "fd_63", name = "Morangos", category = "Fruta", kcalPer100g = 32.0, proteinPer100g = 0.7, carbsPer100g = 7.7, fatPer100g = 0.3),
        FoodItemRecord(id = "fd_64", name = "Laranja", category = "Fruta", kcalPer100g = 47.0, proteinPer100g = 0.9, carbsPer100g = 11.8, fatPer100g = 0.1),
        FoodItemRecord(id = "fd_65", name = "Pera", category = "Fruta", kcalPer100g = 57.0, proteinPer100g = 0.4, carbsPer100g = 15.2, fatPer100g = 0.1),
        FoodItemRecord(id = "fd_66", name = "Ananás / Abacaxi", category = "Fruta", kcalPer100g = 50.0, proteinPer100g = 0.5, carbsPer100g = 13.1, fatPer100g = 0.1),
        FoodItemRecord(id = "fd_67", name = "Melancia", category = "Fruta", kcalPer100g = 30.0, proteinPer100g = 0.6, carbsPer100g = 7.6, fatPer100g = 0.2),

        // Legumes & Verduras
        FoodItemRecord(id = "fd_29", name = "Brócolos Cozidos", category = "Legumes", kcalPer100g = 35.0, proteinPer100g = 2.4, carbsPer100g = 7.2, fatPer100g = 0.4),
        FoodItemRecord(id = "fd_30", name = "Espinafres", category = "Legumes", kcalPer100g = 23.0, proteinPer100g = 2.9, carbsPer100g = 3.6, fatPer100g = 0.4),
        FoodItemRecord(id = "fd_31", name = "Curgete / Legumes Salteados", category = "Legumes", kcalPer100g = 25.0, proteinPer100g = 1.5, carbsPer100g = 4.5, fatPer100g = 0.3),
        FoodItemRecord(id = "fd_32", name = "Tomate / Salada Mista", category = "Legumes", kcalPer100g = 18.0, proteinPer100g = 0.9, carbsPer100g = 3.9, fatPer100g = 0.2),
        FoodItemRecord(id = "fd_68", name = "Feijão Verde Cozido", category = "Legumes", kcalPer100g = 31.0, proteinPer100g = 1.8, carbsPer100g = 7.0, fatPer100g = 0.2),
        FoodItemRecord(id = "fd_69", name = "Cenoura Cozida/Crua", category = "Legumes", kcalPer100g = 41.0, proteinPer100g = 0.9, carbsPer100g = 9.6, fatPer100g = 0.2),
        FoodItemRecord(id = "fd_70", name = "Cogumelos Frescos", category = "Legumes", kcalPer100g = 22.0, proteinPer100g = 3.1, carbsPer100g = 3.3, fatPer100g = 0.3),
        FoodItemRecord(id = "fd_71", name = "Alface / Rúcula", category = "Legumes", kcalPer100g = 15.0, proteinPer100g = 1.4, carbsPer100g = 2.9, fatPer100g = 0.2),

        // Gorduras Saudáveis & Frutos Secos
        FoodItemRecord(id = "fd_33", name = "Azeite Virgem Extra", category = "Gordura", kcalPer100g = 884.0, proteinPer100g = 0.0, carbsPer100g = 0.0, fatPer100g = 100.0),
        FoodItemRecord(id = "fd_34", name = "Manteiga de Amendoim 100%", category = "Gordura", kcalPer100g = 588.0, proteinPer100g = 25.0, carbsPer100g = 20.0, fatPer100g = 50.0),
        FoodItemRecord(id = "fd_35", name = "Amêndoas", category = "Gordura", kcalPer100g = 579.0, proteinPer100g = 21.0, carbsPer100g = 22.0, fatPer100g = 50.0),
        FoodItemRecord(id = "fd_36", name = "Nozes", category = "Gordura", kcalPer100g = 654.0, proteinPer100g = 15.0, carbsPer100g = 14.0, fatPer100g = 65.0),
        FoodItemRecord(id = "fd_37", name = "Abacate", category = "Gordura", kcalPer100g = 160.0, proteinPer100g = 2.0, carbsPer100g = 9.0, fatPer100g = 15.0),
        FoodItemRecord(id = "fd_38", name = "Sementes de Chia", category = "Gordura", kcalPer100g = 486.0, proteinPer100g = 17.0, carbsPer100g = 42.0, fatPer100g = 31.0),
        FoodItemRecord(id = "fd_72", name = "Caju / Castanha do Pará", category = "Gordura", kcalPer100g = 553.0, proteinPer100g = 18.2, carbsPer100g = 30.2, fatPer100g = 43.8),
        FoodItemRecord(id = "fd_73", name = "Sementes de Linhaça Moídas", category = "Gordura", kcalPer100g = 534.0, proteinPer100g = 18.3, carbsPer100g = 28.9, fatPer100g = 42.2),
        FoodItemRecord(id = "fd_74", name = "Chocolate Negro >85% Cacau", category = "Gordura", kcalPer100g = 598.0, proteinPer100g = 10.0, carbsPer100g = 24.0, fatPer100g = 48.0)
    )

    val defaultFoods: List<FoodItemRecord> = coreFoods + FoodTableCatalog.csvTableFoods

    val defaultTemplates: List<MessageTemplateRecord> = listOf(
        MessageTemplateRecord(
            id = "CONVITE",
            templateKey = "CONVITE",
            title = "Convite da semana",
            description = "Enviado para a lista de transmissão ao publicar a semana.",
            body = "Olá! Já estão disponíveis os treinos da semana ({semana}) 👇\n{link}\nEscolhe os teus horários! 💪 New Shape",
            defaultBody = "Olá! Já estão disponíveis os treinos da semana ({semana}) 👇\n{link}\nEscolhe os teus horários! 💪 New Shape"
        ),
        MessageTemplateRecord(
            id = "LEMBRETE",
            templateKey = "LEMBRETE",
            title = "Lembrete",
            description = "Enviado a quem ainda não respondeu na semana.",
            body = "Olá {nome}! Ainda não vimos a tua resposta para a semana {semana}. Podes marcar aqui: {link} 💪 New Shape",
            defaultBody = "Olá {nome}! Ainda não vimos a tua resposta para a semana {semana}. Podes marcar aqui: {link} 💪 New Shape"
        ),
        MessageTemplateRecord(
            id = "CONFIRMACAO",
            templateKey = "CONFIRMACAO",
            title = "Confirmação",
            description = "Ao confirmar o pedido de um cliente.",
            body = "Olá {nome}! ✅ Treino confirmado:\n{treinos}\nAté já! 💪 New Shape",
            defaultBody = "Olá {nome}! ✅ Treino confirmado:\n{treinos}\nAté já! 💪 New Shape"
        ),
        MessageTemplateRecord(
            id = "RECUSA",
            templateKey = "RECUSA",
            title = "Recusa de horário",
            description = "Quando um horário pedido não está disponível.",
            body = "Olá {nome}, infelizmente não deu para o horário:\n{treinos}\nPodes escolher outro horário aqui: {link} 💪 New Shape",
            defaultBody = "Olá {nome}, infelizmente não deu para o horário:\n{treinos}\nPodes escolher outro horário aqui: {link} 💪 New Shape"
        ),
        MessageTemplateRecord(
            id = "ALTERACAO",
            templateKey = "ALTERACAO",
            title = "Alteração de horário",
            description = "Quando moves um cliente para outro treino com vaga.",
            body = "Olá {nome}! 🔄 Atualizámos o teu treino:\n{treinos}\nConfirmado! 💪 New Shape",
            defaultBody = "Olá {nome}! 🔄 Atualizámos o teu treino:\n{treinos}\nConfirmado! 💪 New Shape"
        ),
        MessageTemplateRecord(
            id = "CANCELAMENTO",
            templateKey = "CANCELAMENTO",
            title = "Cancelamento",
            description = "Resposta quando o cliente desmarca todos os treinos.",
            body = "Olá {nome}, recebemos o teu cancelamento para a semana {semana}. Quando quiseres reagendar usa o link: {link} 💪 New Shape",
            defaultBody = "Olá {nome}, recebemos o teu cancelamento para a semana {semana}. Quando quiseres reagendar usa o link: {link} 💪 New Shape"
        )
    )

    fun createSession(
        userId: String,
        weekKey: String,
        mondayMillis: Long,
        dayOfWeek: Int,
        hour: Int,
        minute: Int,
        durationMinutes: Int,
        capacity: Int,
        note: String
    ): TrainingSessionRecord {
        val c = Calendar.getInstance().apply {
            timeInMillis = mondayMillis
            add(Calendar.DAY_OF_YEAR, dayOfWeek - 1)
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        return TrainingSessionRecord(
            userId = userId,
            weekKey = weekKey,
            dayOfWeek = dayOfWeek,
            dateLabel = formatDayDate(c),
            timeLabel = String.format("%02d:%02d", hour, minute),
            durationMinutes = durationMinutes,
            capacity = capacity,
            note = note,
            startMillis = c.timeInMillis
        )
    }

    fun formatWeekKey(mondayCal: Calendar): String {
        val year = mondayCal.get(Calendar.YEAR)
        val week = mondayCal.get(Calendar.WEEK_OF_YEAR)
        return String.format("%d-W%02d", year, week)
    }

    fun formatWeekRangeLabel(mondayCal: Calendar): String {
        val start = mondayCal.clone() as Calendar
        val end = (mondayCal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, 6) }
        val months = arrayOf("Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez")
        val sDay = start.get(Calendar.DAY_OF_MONTH)
        val eDay = end.get(Calendar.DAY_OF_MONTH)
        val sMonth = months[start.get(Calendar.MONTH)]
        val eMonth = months[end.get(Calendar.MONTH)]
        return if (sMonth == eMonth) "$sDay–$eDay $eMonth" else "$sDay $sMonth–$eDay $eMonth"
    }

    fun formatDayDate(cal: Calendar): String {
        val days = mapOf(
            Calendar.MONDAY to "Segunda",
            Calendar.TUESDAY to "Terça",
            Calendar.WEDNESDAY to "Quarta",
            Calendar.THURSDAY to "Quinta",
            Calendar.FRIDAY to "Sexta",
            Calendar.SATURDAY to "Sábado",
            Calendar.SUNDAY to "Domingo"
        )
        val months = arrayOf("Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez")
        val dayName = days[cal.get(Calendar.DAY_OF_WEEK)] ?: "Dia"
        return "$dayName, ${cal.get(Calendar.DAY_OF_MONTH)} ${months[cal.get(Calendar.MONTH)]}"
    }

    val PAYMENT_METHODS: List<String> = listOf("MbWay", "Dinheiro", "João")

    fun normalizePaymentMethod(raw: String): String? {
        val clean = raw.trim().lowercase()
        return when {
            clean == "mbway" || clean == "mb way" || clean.contains("mbway") || clean.contains("mb way") -> "MbWay"
            clean == "dinheiro" || clean.contains("dinheiro") -> "Dinheiro"
            clean == "joão" || clean == "joao" || clean.contains("joão") || clean.contains("joao") -> "João"
            else -> null
        }
    }

    const val DEFAULT_JOIA_EUR: Double = 30.0

    fun getPaymentCategory(note: String): String {
        val clean = note.trim().lowercase()
        return when {
            clean.contains("seguro") -> "SEGURO"
            clean.contains("jóia") || clean.contains("joia") || clean.contains("inscri") -> "JOIA"
            else -> "MENSALIDADE"
        }
    }

    fun isExtraFeePayment(note: String): Boolean = getPaymentCategory(note) != "MENSALIDADE"

    fun formatRgpdConsentStamp(ts: Long = System.currentTimeMillis()): String {
        val c = Calendar.getInstance().apply { timeInMillis = ts }
        return String.format(
            "RGPD aceite em %02d/%02d/%04d às %02d:%02d",
            c.get(Calendar.DAY_OF_MONTH),
            c.get(Calendar.MONTH) + 1,
            c.get(Calendar.YEAR),
            c.get(Calendar.HOUR_OF_DAY),
            c.get(Calendar.MINUTE)
        )
    }

    fun buildConsecutiveMonths(startMonthYear: String, count: Int): List<Pair<String, String>> {
        val months = arrayOf("Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez")
        val parts = startMonthYear.split("-")
        val now = Calendar.getInstance()
        val startYear = parts.getOrNull(0)?.toIntOrNull() ?: now.get(Calendar.YEAR)
        val startMonthIdx = ((parts.getOrNull(1)?.toIntOrNull() ?: (now.get(Calendar.MONTH) + 1)) - 1).coerceIn(0, 11)
        val total = count.coerceAtLeast(1)
        return (0 until total).map { offset ->
            val cal = Calendar.getInstance().apply {
                set(Calendar.YEAR, startYear)
                set(Calendar.MONTH, startMonthIdx)
                set(Calendar.DAY_OF_MONTH, 1)
                add(Calendar.MONTH, offset)
            }
            val key = String.format("%04d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1)
            val lbl = "${months[cal.get(Calendar.MONTH)]} ${cal.get(Calendar.YEAR)}"
            key to lbl
        }
    }

    fun splitAmountAcrossMonths(totalAmount: Double, months: Int): List<Double> {
        val count = months.coerceAtLeast(1)
        val clamped = totalAmount.coerceIn(0.0, 100000.0)
        val totalCents = kotlin.math.round(clamped * 100.0).toLong()
        val baseCents = totalCents / count
        val remainder = (totalCents - baseCents * count).toInt()
        return (0 until count).map { idx ->
            val cents = if (idx < remainder) baseCents + 1 else baseCents
            cents / 100.0
        }
    }

    fun getEffectiveClientFidelizacaoMonths(
        client: ClientRecord?,
        fidelizacoes: List<FidelizacaoRecord>
    ): Int {
        if (client == null) return 1
        val now = System.currentTimeMillis()
        val activeContract = fidelizacoes
            .filter { it.clientId == client.id && it.endDateMillis >= now }
            .maxByOrNull { it.endDateMillis }
        val contractMonths = activeContract?.durationMonths
        if (contractMonths == 6 || contractMonths == 12) return contractMonths
        if (client.fidelizacaoMonths == 6 || client.fidelizacaoMonths == 12) return client.fidelizacaoMonths
        return 1
    }
}
