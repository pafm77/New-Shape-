import {
  ExerciseRecord,
  FoodItemRecord,
  MealTypeKey,
  MessageTemplateRecord,
  TrainingSessionRecord,
  TrainingWeekRecord,
} from '../types/studio';

export const MEAL_TYPES: { key: MealTypeKey; label: string }[] = [
  { key: 'PEQUENO_ALMOCO', label: 'Pequeno-almoço' },
  { key: 'LANCHE_MANHA', label: 'Lanche da Manhã' },
  { key: 'ALMOCO', label: 'Almoço' },
  { key: 'LANCHE_TARDE', label: 'Lanche da Tarde' },
  { key: 'JANTAR', label: 'Jantar' },
  { key: 'CEIA', label: 'Ceia' },
];

export const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const DAYS_PT: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
  7: 'Domingo',
};

export function normalizePortuguesePhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00351')) digits = digits.slice(5);
  else if (digits.startsWith('351') && digits.length > 9) digits = digits.slice(3);
  return digits.slice(0, 9);
}

export function isValidPortuguesePhone(phone: string): boolean {
  const clean = normalizePortuguesePhone(phone);
  return clean.length === 9 && (clean.startsWith('9') || clean.startsWith('2'));
}

export function formatPhoneDisplay(phone: string): string {
  const d = normalizePortuguesePhone(phone);
  if (d.length === 9) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return phone;
}

export function getMondayOfWeek(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getIsoWeekNumber(date: Date): { year: number; week: number } {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: temp.getUTCFullYear(), week };
}

export function formatWeekKey(monday: Date): string {
  const { year, week } = getIsoWeekNumber(monday);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function formatWeekRangeLabel(monday: Date): string {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  const sDay = monday.getDate();
  const eDay = end.getDate();
  const sMonth = MONTHS_PT[monday.getMonth()];
  const eMonth = MONTHS_PT[end.getMonth()];
  return sMonth === eMonth ? `${sDay}–${eDay} ${eMonth}` : `${sDay} ${sMonth}–${eDay} ${eMonth}`;
}

export function formatDayDate(date: Date): string {
  const jsDay = date.getDay();
  const dayNum = jsDay === 0 ? 7 : jsDay;
  const dayName = DAYS_PT[dayNum] || 'Dia';
  return `${dayName}, ${date.getDate()} ${MONTHS_PT[date.getMonth()]}`;
}

export function formatShortDate(millis: number): string {
  if (!millis) return '—';
  const d = new Date(millis);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTimeAgo(millis: number): string {
  const diffMin = Math.max(1, Math.floor((Date.now() - millis) / 60000));
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `há ${diffD} d`;
}

export function createSessionModel(
  userId: string,
  weekKey: string,
  mondayMillis: number,
  dayOfWeek: number,
  hour: number,
  minute: number,
  durationMinutes: number,
  capacity: number,
  note: string
): Omit<TrainingSessionRecord, 'id'> {
  const d = new Date(mondayMillis);
  d.setDate(d.getDate() + (dayOfWeek - 1));
  d.setHours(hour, minute, 0, 0);
  return {
    userId,
    weekKey,
    dayOfWeek,
    dateLabel: formatDayDate(d),
    timeLabel: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    durationMinutes,
    capacity,
    note,
    startMillis: d.getTime(),
  };
}

export const PAYMENT_METHODS = ['MbWay', 'Dinheiro', 'João'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function normalizePaymentMethod(raw: string): PaymentMethod | null {
  const clean = raw.trim().toLowerCase();
  if (clean === 'mbway' || clean === 'mb way') return 'MbWay';
  if (clean === 'dinheiro') return 'Dinheiro';
  if (clean === 'joão' || clean === 'joao') return 'João';
  return null;
}

export function formatRgpdConsentStamp(ts: number = Date.now()): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `RGPD aceite em ${dd}/${mm}/${yyyy} às ${hh}:${min}`;
}

export function buildRecentMonthOptions(): { monthYear: string; monthLabel: string }[] {
  const out: { monthYear: string; monthLabel: string }[] = [];
  const now = new Date();
  for (let offset = 0; offset >= -5; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    out.push({
      monthYear: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      monthLabel: `${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return out;
}

export function buildConsecutiveMonths(
  startMonthYear: string,
  count: number
): { monthYear: string; monthLabel: string }[] {
  const [yStr, mStr] = startMonthYear.split('-');
  const now = new Date();
  const startYear = Number(yStr) || now.getFullYear();
  const startMonthIdx = Math.max(0, (Number(mStr) || now.getMonth() + 1) - 1);
  const total = Math.max(1, count);
  const out: { monthYear: string; monthLabel: string }[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(startYear, startMonthIdx + i, 1);
    out.push({
      monthYear: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      monthLabel: `${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return out;
}

export function calculateBmi(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) return 0;
  const hM = heightCm / 100;
  return Number((weightKg / (hM * hM)).toFixed(2));
}

export function calculateBmrMifflinStJeor(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: 'M' | 'F'
): number {
  if (weightKg <= 0 || heightCm <= 0 || ageYears <= 0) return 0;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.max(0, Math.round(sex === 'F' ? base - 161 : base + 5));
}

export function bmiClassification(bmi: number): string {
  if (bmi <= 0) return '—';
  if (bmi < 18.5) return 'Abaixo do peso';
  if (bmi < 25) return 'Peso normal';
  if (bmi < 30) return 'Excesso de peso';
  return 'Obesidade';
}

export function buildWhatsAppUrl(
  phone: string | null,
  message: string,
  whatsappWebMode: boolean
): string {
  const encoded = encodeURIComponent(message);
  if (phone) {
    const clean = normalizePortuguesePhone(phone);
    const intl = clean.length === 9 ? `351${clean}` : phone.replace(/\D/g, '');
    return whatsappWebMode
      ? `https://web.whatsapp.com/send?phone=${intl}&text=${encoded}`
      : `https://wa.me/${intl}?text=${encoded}`;
  }
  return whatsappWebMode
    ? `https://web.whatsapp.com/send?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export const DEFAULT_WEB_BASE_URL = 'https://newshape.vercel.app';

export function generatePortalCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = 'ns_';
  for (let i = 0; i < 14; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function buildPtPortalLink(siteBaseUrl: string): string {
  const baseUrl = (siteBaseUrl || window.location.origin || DEFAULT_WEB_BASE_URL).replace(/\/$/, '');
  return `${baseUrl}/painel`;
}

export function buildStudentPortalLink(
  siteBaseUrl: string,
  ptUid: string,
  studentPortalCode?: string,
  weekSlug?: string
): string {
  const baseUrl = (siteBaseUrl || window.location.origin || DEFAULT_WEB_BASE_URL).replace(/\/$/, '');
  const path = weekSlug ? `/s/${weekSlug.toLowerCase()}` : '/aluno';
  if (!ptUid) return `${baseUrl}${path}`;
  const params = new URLSearchParams({ pt: ptUid });
  if (studentPortalCode) params.set('code', studentPortalCode);
  return `${baseUrl}${path}?${params.toString()}`;
}

export function buildMessageFromTemplate(
  templates: MessageTemplateRecord[],
  templateKey: string,
  siteBaseUrl: string,
  opts: {
    clientName?: string;
    sessions?: TrainingSessionRecord[];
    week?: TrainingWeekRecord | null;
    ptUid?: string;
    studentPortalCode?: string;
  }
): string {
  const found =
    templates.find((t) => t.templateKey === templateKey) ||
    DEFAULT_TEMPLATES.find((t) => t.templateKey === templateKey);
  const body = found?.body || '';
  const firstName = (opts.clientName || 'Aluno').trim().split(/\s+/)[0] || 'Aluno';
  const sessionsText = (opts.sessions || [])
    .map((s) => `• ${s.dateLabel} – ${s.timeLabel.replace(':', 'h')}`)
    .join('\n');
  const weekSlug = (opts.week?.weekKey || '2026-w47').toLowerCase();
  const link = buildStudentPortalLink(
    siteBaseUrl,
    opts.ptUid || '',
    opts.studentPortalCode,
    weekSlug
  );
  const weekLabel = opts.week?.label || '';

  return body
    .replaceAll('{nome}', firstName)
    .replaceAll('{treinos}', sessionsText)
    .replaceAll('{link}', link)
    .replaceAll('{semana}', weekLabel);
}

export const DEFAULT_EXERCISES: Omit<ExerciseRecord, 'userId'>[] = [
  { id: 'ex_1', name: 'Supino Plano com Barra', muscleGroup: 'Peito', equipment: 'Barra', instructions: 'Descer a barra controlada até ao meio do peito e empurrar com escápulas retraídas.', custom: false },
  { id: 'ex_2', name: 'Supino Inclinado com Halteres', muscleGroup: 'Peito', equipment: 'Halteres', instructions: 'Banco a 30°, cotovelos ligeiramente a 45° do tronco.', custom: false },
  { id: 'ex_3', name: 'Aberturas com Halteres (Crucifixo)', muscleGroup: 'Peito', equipment: 'Halteres', instructions: 'Ligeira flexão nos cotovelos, abrir até sentir alongamento peitoral.', custom: false },
  { id: 'ex_4', name: 'Crossover na Polia Alta', muscleGroup: 'Peito', equipment: 'Polia / Cabo', instructions: 'Inclinar ligeiramente o tronco à frente e juntar as mãos à frente da linha umbilical.', custom: false },
  { id: 'ex_5', name: 'Chest Press na Máquina', muscleGroup: 'Peito', equipment: 'Máquina', instructions: 'Ajustar o banco ao nível do peito médio e manter controlo na fase excêntrica.', custom: false },
  { id: 'ex_6', name: 'Flexões de Braços (Push-ups)', muscleGroup: 'Peito', equipment: 'Peso Corporal', instructions: 'Corpo alinhado da cabeça aos calcanhares, core ativo.', custom: false },
  { id: 'ex_7', name: 'Fundos em Paralelas (Foco Peito)', muscleGroup: 'Peito', equipment: 'Paralelas', instructions: 'Inclinar o tronco ligeiramente à frente ao descer.', custom: false },
  { id: 'ex_8', name: 'Puxada à Frente (Lat Pulldown)', muscleGroup: 'Costas', equipment: 'Polia / Cabo', instructions: 'Puxar a barra até à parte superior do peito mantendo peito aberto.', custom: false },
  { id: 'ex_9', name: 'Remada Curvada com Barra', muscleGroup: 'Costas', equipment: 'Barra', instructions: 'Coluna neutra, puxar a barra em direção ao umbigo.', custom: false },
  { id: 'ex_10', name: 'Remada Baixa Sentada (Triângulo)', muscleGroup: 'Costas', equipment: 'Polia / Cabo', instructions: 'Puxar com os cotovelos junto ao tronco sem balançar a lombar.', custom: false },
  { id: 'ex_11', name: 'Remada Unilateral com Haltere (Serrote)', muscleGroup: 'Costas', equipment: 'Halteres', instructions: 'Apoiar mão e joelho no banco, puxar haltere em arco até à anca.', custom: false },
  { id: 'ex_12', name: 'Elevações na Barra Fixa (Pull-ups)', muscleGroup: 'Costas', equipment: 'Peso Corporal', instructions: 'Pega pronada ligeiramente mais larga que os ombros.', custom: false },
  { id: 'ex_13', name: 'Pullover na Polia Alta (Corda)', muscleGroup: 'Costas', equipment: 'Polia / Cabo', instructions: 'Braços quase estendidos, focar na contração do grande dorsal.', custom: false },
  { id: 'ex_14', name: 'Face Pull na Polia', muscleGroup: 'Costas', equipment: 'Polia / Cabo', instructions: 'Puxar a corda em direção à testa rodando externamente os ombros.', custom: false },
  { id: 'ex_15', name: 'Agachamento Livre com Barra', muscleGroup: 'Pernas', equipment: 'Barra', instructions: 'Pés à largura dos ombros, descer controlando joelhos alinhados com os pés.', custom: false },
  { id: 'ex_16', name: 'Prensa de Pernas 45° (Leg Press)', muscleGroup: 'Pernas', equipment: 'Máquina', instructions: 'Não bloquear totalmente os joelhos no topo; lombar sempre apoiada.', custom: false },
  { id: 'ex_17', name: 'Peso Morto Romeno (RDL)', muscleGroup: 'Pernas', equipment: 'Barra / Halteres', instructions: 'Anca para trás, joelhos semi-fletidos, sentir alongar os isquiotibiais.', custom: false },
  { id: 'ex_18', name: 'Afundos Búlgaros (Bulgarian Split Squat)', muscleGroup: 'Pernas', equipment: 'Halteres', instructions: 'Pé traseiro apoiado no banco, descer verticalmente.', custom: false },
  { id: 'ex_19', name: 'Cadeira Extensora (Leg Extension)', muscleGroup: 'Pernas', equipment: 'Máquina', instructions: 'Pausa de 1 segundo no topo para máxima contração do quadricípite.', custom: false },
  { id: 'ex_20', name: 'Mesa Flexora (Leg Curl)', muscleGroup: 'Pernas', equipment: 'Máquina', instructions: 'Manter ancas coladas ao banco durante toda a flexão.', custom: false },
  { id: 'ex_21', name: 'Elevação Pélvica com Barra (Hip Thrust)', muscleGroup: 'Pernas', equipment: 'Barra', instructions: 'Queixo recolhido, contrair glúteos no topo mantendo a tíbia vertical.', custom: false },
  { id: 'ex_22', name: 'Passadas / Walking Lunges', muscleGroup: 'Pernas', equipment: 'Halteres', instructions: 'Passos largos e controlados mantendo o tronco estável.', custom: false },
  { id: 'ex_23', name: 'Gémeos em Pé na Máquina', muscleGroup: 'Pernas', equipment: 'Máquina', instructions: 'Amplitude completa: alongar bem em baixo e segurar 1s no topo.', custom: false },
  { id: 'ex_24', name: 'Desenvolvimento Militar com Halteres', muscleGroup: 'Ombros', equipment: 'Halteres', instructions: 'Empurrar acima da cabeça sem hiperextender a lombar.', custom: false },
  { id: 'ex_25', name: 'Press de Ombros com Barra', muscleGroup: 'Ombros', equipment: 'Barra', instructions: 'Core contraído, barra sobe em linha reta junto ao rosto.', custom: false },
  { id: 'ex_26', name: 'Elevações Laterais com Halteres', muscleGroup: 'Ombros', equipment: 'Halteres', instructions: 'Subir até à altura dos ombros com cotovelos ligeiramente fletidos.', custom: false },
  { id: 'ex_27', name: 'Elevações Laterais na Polia', muscleGroup: 'Ombros', equipment: 'Polia / Cabo', instructions: 'Tensão contínua desde o início do movimento.', custom: false },
  { id: 'ex_28', name: 'Elevações Frontais com Disco/Halteres', muscleGroup: 'Ombros', equipment: 'Halteres', instructions: 'Evitar impulso do tronco na subida.', custom: false },
  { id: 'ex_29', name: 'Crucifixo Inverso na Máquina (Posterior)', muscleGroup: 'Ombros', equipment: 'Máquina', instructions: 'Focar no deltoide posterior evitando juntar demasiado as escápulas.', custom: false },
  { id: 'ex_30', name: 'Curl Direto com Barra W', muscleGroup: 'Braços', equipment: 'Barra', instructions: 'Cotovelos fixos junto ao tronco.', custom: false },
  { id: 'ex_31', name: 'Curl Alternado com Halteres', muscleGroup: 'Braços', equipment: 'Halteres', instructions: 'Rodar o punho em supinação durante a subida.', custom: false },
  { id: 'ex_32', name: 'Curl Martelo com Halteres', muscleGroup: 'Braços', equipment: 'Halteres', instructions: 'Pega neutra, ótimo para braquial e antebraço.', custom: false },
  { id: 'ex_33', name: 'Curl na Polia Baixa', muscleGroup: 'Braços', equipment: 'Polia / Cabo', instructions: 'Tensão constante no bíceps.', custom: false },
  { id: 'ex_34', name: 'Extensão de Tríceps na Polia (Corda)', muscleGroup: 'Braços', equipment: 'Polia / Cabo', instructions: 'Abrir a corda no final da extensão mantendo cotovelos imóveis.', custom: false },
  { id: 'ex_35', name: 'Tríceps Testa com Barra W (Skullcrusher)', muscleGroup: 'Braços', equipment: 'Barra', instructions: 'Descer a barra em direção à testa/atrás da cabeça com controlo.', custom: false },
  { id: 'ex_36', name: 'Tríceps Francês com Haltere', muscleGroup: 'Braços', equipment: 'Halteres', instructions: 'Alongamento máximo da cabeça longa do tríceps.', custom: false },
  { id: 'ex_37', name: 'Prancha Abdominal (Plank)', muscleGroup: 'Core', equipment: 'Peso Corporal', instructions: 'Manter bacia neutra e glúteos/abdominais contraídos.', custom: false },
  { id: 'ex_38', name: 'Crunch na Polia Alta', muscleGroup: 'Core', equipment: 'Polia / Cabo', instructions: 'Fletir a coluna enrolando o tronco em direção às ancas.', custom: false },
  { id: 'ex_39', name: 'Elevação de Pernas Suspenso', muscleGroup: 'Core', equipment: 'Peso Corporal', instructions: 'Subir os joelhos ou pernas evitando balanço.', custom: false },
  { id: 'ex_40', name: 'Russian Twist com Disco', muscleGroup: 'Core', equipment: 'Peso Livre', instructions: 'Rodar o tronco de forma controlada.', custom: false },
  { id: 'ex_41', name: 'Dead Bug', muscleGroup: 'Core', equipment: 'Peso Corporal', instructions: 'Lombar sempre em contacto com o solo enquanto estende braço e perna opostos.', custom: false },
  { id: 'ex_42', name: 'Passadeira (Inclinação / Corrida)', muscleGroup: 'Cardio', equipment: 'Cardio', instructions: 'Manter passada fluida e ritmo cardíaco alvo.', custom: false },
  { id: 'ex_43', name: 'Remo Ergómetro (Concept2)', muscleGroup: 'Cardio', equipment: 'Cardio', instructions: 'Sequência: Pernas -> Tronco -> Braços.', custom: false },
  { id: 'ex_44', name: 'Bicicleta Estática / Air Bike', muscleGroup: 'Cardio', equipment: 'Cardio', instructions: 'Ideal para HIIT ou zona 2.', custom: false },
  { id: 'ex_45', name: 'Kettlebell Swing', muscleGroup: 'Cardio', equipment: 'Kettlebell', instructions: 'Movimento explosivo de extensão da anca, não dos braços.', custom: false },
  { id: 'ex_46', name: 'Burpees', muscleGroup: 'Cardio', equipment: 'Peso Corporal', instructions: 'Ritmo constante mantendo qualidade técnica.', custom: false },
  { id: 'ex_47', name: "Farmer's Walk (Caminhada do Fazendeiro)", muscleGroup: 'Cardio', equipment: 'Halteres', instructions: 'Postura ereta, ombros para baixo, passos curtos e firmes.', custom: false },
];

export const DEFAULT_FOODS: Omit<FoodItemRecord, 'userId'>[] = [
  { id: 'fd_1', name: 'Peito de Frango Grelhado', category: 'Proteína', kcalPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, custom: false },
  { id: 'fd_2', name: 'Peito de Peru', category: 'Proteína', kcalPer100g: 135, proteinPer100g: 29, carbsPer100g: 0, fatPer100g: 1.5, custom: false },
  { id: 'fd_3', name: 'Carne Picada Magra (5% MG)', category: 'Proteína', kcalPer100g: 137, proteinPer100g: 21, carbsPer100g: 0, fatPer100g: 5, custom: false },
  { id: 'fd_4', name: 'Bife da Vazia / Alcatra', category: 'Proteína', kcalPer100g: 180, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 8, custom: false },
  { id: 'fd_5', name: 'Salmão Grelhado', category: 'Proteína', kcalPer100g: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13, custom: false },
  { id: 'fd_6', name: 'Atum em Água (Escorrido)', category: 'Proteína', kcalPer100g: 116, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 1, custom: false },
  { id: 'fd_7', name: 'Pescada / Bacalhau Cozido', category: 'Proteína', kcalPer100g: 90, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 0.8, custom: false },
  { id: 'fd_8', name: 'Ovo Inteiro Cozido', category: 'Proteína', kcalPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11, custom: false },
  { id: 'fd_9', name: 'Claras de Ovo Líquidas', category: 'Proteína', kcalPer100g: 52, proteinPer100g: 11, carbsPer100g: 0.7, fatPer100g: 0.2, custom: false },
  { id: 'fd_14', name: 'Tofu Firme', category: 'Proteína', kcalPer100g: 144, proteinPer100g: 15.8, carbsPer100g: 2.8, fatPer100g: 8.7, custom: false },
  { id: 'fd_39', name: 'Lombo de Porco Magro', category: 'Proteína', kcalPer100g: 143, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 3.5, custom: false },
  { id: 'fd_40', name: 'Dourada / Robalo Grelhado', category: 'Proteína', kcalPer100g: 115, proteinPer100g: 21.5, carbsPer100g: 0, fatPer100g: 2.8, custom: false },
  { id: 'fd_41', name: 'Cavala / Sardinha Assada', category: 'Proteína', kcalPer100g: 205, proteinPer100g: 24, carbsPer100g: 0, fatPer100g: 11.5, custom: false },
  { id: 'fd_42', name: 'Camarão Cozido (Miolo)', category: 'Proteína', kcalPer100g: 99, proteinPer100g: 24, carbsPer100g: 0.2, fatPer100g: 0.3, custom: false },
  { id: 'fd_43', name: 'Polvo / Lulas Grelhadas', category: 'Proteína', kcalPer100g: 92, proteinPer100g: 18, carbsPer100g: 2.2, fatPer100g: 1.2, custom: false },
  { id: 'fd_44', name: 'Fiambre de Peru / Frango Extra Magro', category: 'Proteína', kcalPer100g: 98, proteinPer100g: 19, carbsPer100g: 1.5, fatPer100g: 1.8, custom: false },
  { id: 'fd_45', name: 'Seitan', category: 'Proteína', kcalPer100g: 120, proteinPer100g: 24, carbsPer100g: 4, fatPer100g: 1, custom: false },
  { id: 'fd_46', name: 'Tempeh', category: 'Proteína', kcalPer100g: 193, proteinPer100g: 20, carbsPer100g: 7.6, fatPer100g: 10.8, custom: false },
  { id: 'fd_10', name: 'Queijo Quark 0% MG', category: 'Laticínios', kcalPer100g: 62, proteinPer100g: 12, carbsPer100g: 3.5, fatPer100g: 0.2, custom: false },
  { id: 'fd_11', name: 'Iogurte Grego Natural Ligeiro', category: 'Laticínios', kcalPer100g: 59, proteinPer100g: 10, carbsPer100g: 3.6, fatPer100g: 0.4, custom: false },
  { id: 'fd_12', name: 'Queijo Fresco Magro', category: 'Laticínios', kcalPer100g: 75, proteinPer100g: 12, carbsPer100g: 3, fatPer100g: 1.5, custom: false },
  { id: 'fd_47', name: 'Skyr Natural', category: 'Laticínios', kcalPer100g: 63, proteinPer100g: 11, carbsPer100g: 4, fatPer100g: 0.2, custom: false },
  { id: 'fd_48', name: 'Queijo Cottage', category: 'Laticínios', kcalPer100g: 98, proteinPer100g: 11.1, carbsPer100g: 3.4, fatPer100g: 4.3, custom: false },
  { id: 'fd_49', name: 'Queijo Mozzarella Light', category: 'Laticínios', kcalPer100g: 165, proteinPer100g: 20, carbsPer100g: 1.5, fatPer100g: 8.5, custom: false },
  { id: 'fd_50', name: 'Leite Magro', category: 'Laticínios', kcalPer100g: 34, proteinPer100g: 3.4, carbsPer100g: 4.9, fatPer100g: 0.1, custom: false },
  { id: 'fd_51', name: 'Leite Meio-Gordo', category: 'Laticínios', kcalPer100g: 46, proteinPer100g: 3.3, carbsPer100g: 4.8, fatPer100g: 1.6, custom: false },
  { id: 'fd_52', name: 'Bebida de Soja Sem Açúcar', category: 'Laticínios', kcalPer100g: 33, proteinPer100g: 3.3, carbsPer100g: 0.8, fatPer100g: 1.8, custom: false },
  { id: 'fd_53', name: 'Bebida de Amêndoa Sem Açúcar', category: 'Laticínios', kcalPer100g: 15, proteinPer100g: 0.5, carbsPer100g: 0.2, fatPer100g: 1.2, custom: false },
  { id: 'fd_13', name: 'Whey Protein Concentrada', category: 'Suplemento', kcalPer100g: 400, proteinPer100g: 78, carbsPer100g: 8, fatPer100g: 6, custom: false },
  { id: 'fd_54', name: 'Whey Protein Isolada', category: 'Suplemento', kcalPer100g: 370, proteinPer100g: 88, carbsPer100g: 2, fatPer100g: 1, custom: false },
  { id: 'fd_55', name: 'Caseína Micelar', category: 'Suplemento', kcalPer100g: 360, proteinPer100g: 80, carbsPer100g: 4, fatPer100g: 2, custom: false },
  { id: 'fd_56', name: 'Proteína Vegetal (Ervilha/Arroz)', category: 'Suplemento', kcalPer100g: 385, proteinPer100g: 76, carbsPer100g: 7, fatPer100g: 5.5, custom: false },
  { id: 'fd_15', name: 'Arroz Basmati Cozido', category: 'Hidratos', kcalPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, custom: false },
  { id: 'fd_16', name: 'Arroz Integral Cozido', category: 'Hidratos', kcalPer100g: 123, proteinPer100g: 2.7, carbsPer100g: 25.6, fatPer100g: 1, custom: false },
  { id: 'fd_17', name: 'Batata Doce Cozida/Assada', category: 'Hidratos', kcalPer100g: 90, proteinPer100g: 2, carbsPer100g: 21, fatPer100g: 0.1, custom: false },
  { id: 'fd_18', name: 'Batata Branca Cozida', category: 'Hidratos', kcalPer100g: 87, proteinPer100g: 1.9, carbsPer100g: 20, fatPer100g: 0.1, custom: false },
  { id: 'fd_19', name: 'Massa Integral Cozida', category: 'Hidratos', kcalPer100g: 124, proteinPer100g: 5.3, carbsPer100g: 26.5, fatPer100g: 0.5, custom: false },
  { id: 'fd_20', name: 'Flocos de Aveia', category: 'Hidratos', kcalPer100g: 375, proteinPer100g: 13.5, carbsPer100g: 60, fatPer100g: 7, custom: false },
  { id: 'fd_21', name: 'Pão Integral / Centeio', category: 'Hidratos', kcalPer100g: 247, proteinPer100g: 9, carbsPer100g: 43, fatPer100g: 3.2, custom: false },
  { id: 'fd_22', name: 'Quinoa Cozida', category: 'Hidratos', kcalPer100g: 120, proteinPer100g: 4.4, carbsPer100g: 21.3, fatPer100g: 1.9, custom: false },
  { id: 'fd_23', name: 'Grão-de-Bico Cozido', category: 'Hidratos', kcalPer100g: 164, proteinPer100g: 8.9, carbsPer100g: 27.4, fatPer100g: 2.6, custom: false },
  { id: 'fd_24', name: 'Feijão Preto Cozido', category: 'Hidratos', kcalPer100g: 132, proteinPer100g: 8.9, carbsPer100g: 23.7, fatPer100g: 0.5, custom: false },
  { id: 'fd_57', name: 'Lentilhas Cozidas', category: 'Hidratos', kcalPer100g: 116, proteinPer100g: 9, carbsPer100g: 20.1, fatPer100g: 0.4, custom: false },
  { id: 'fd_58', name: 'Tortitas de Arroz / Milho', category: 'Hidratos', kcalPer100g: 387, proteinPer100g: 8, carbsPer100g: 81, fatPer100g: 2.8, custom: false },
  { id: 'fd_59', name: 'Cuscuz Cozido', category: 'Hidratos', kcalPer100g: 112, proteinPer100g: 3.8, carbsPer100g: 23.2, fatPer100g: 0.2, custom: false },
  { id: 'fd_60', name: 'Arroz Branco / Carolino (Cru)', category: 'Hidratos', kcalPer100g: 358, proteinPer100g: 7, carbsPer100g: 79, fatPer100g: 0.6, custom: false },
  { id: 'fd_61', name: 'Farinha de Aveia', category: 'Hidratos', kcalPer100g: 380, proteinPer100g: 14, carbsPer100g: 62, fatPer100g: 7, custom: false },
  { id: 'fd_62', name: 'Mel', category: 'Hidratos', kcalPer100g: 304, proteinPer100g: 0.3, carbsPer100g: 82.4, fatPer100g: 0, custom: false },
  { id: 'fd_25', name: 'Banana', category: 'Fruta', kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3, custom: false },
  { id: 'fd_26', name: 'Maçã', category: 'Fruta', kcalPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2, custom: false },
  { id: 'fd_27', name: 'Mirtilos / Frutos Vermelhos', category: 'Fruta', kcalPer100g: 57, proteinPer100g: 0.7, carbsPer100g: 14.5, fatPer100g: 0.3, custom: false },
  { id: 'fd_28', name: 'Kiwi', category: 'Fruta', kcalPer100g: 61, proteinPer100g: 1.1, carbsPer100g: 15, fatPer100g: 0.5, custom: false },
  { id: 'fd_63', name: 'Morangos', category: 'Fruta', kcalPer100g: 32, proteinPer100g: 0.7, carbsPer100g: 7.7, fatPer100g: 0.3, custom: false },
  { id: 'fd_64', name: 'Laranja', category: 'Fruta', kcalPer100g: 47, proteinPer100g: 0.9, carbsPer100g: 11.8, fatPer100g: 0.1, custom: false },
  { id: 'fd_65', name: 'Pera', category: 'Fruta', kcalPer100g: 57, proteinPer100g: 0.4, carbsPer100g: 15.2, fatPer100g: 0.1, custom: false },
  { id: 'fd_66', name: 'Ananás / Abacaxi', category: 'Fruta', kcalPer100g: 50, proteinPer100g: 0.5, carbsPer100g: 13.1, fatPer100g: 0.1, custom: false },
  { id: 'fd_67', name: 'Melancia', category: 'Fruta', kcalPer100g: 30, proteinPer100g: 0.6, carbsPer100g: 7.6, fatPer100g: 0.2, custom: false },
  { id: 'fd_29', name: 'Brócolos Cozidos', category: 'Legumes', kcalPer100g: 35, proteinPer100g: 2.4, carbsPer100g: 7.2, fatPer100g: 0.4, custom: false },
  { id: 'fd_30', name: 'Espinafres', category: 'Legumes', kcalPer100g: 23, proteinPer100g: 2.9, carbsPer100g: 3.6, fatPer100g: 0.4, custom: false },
  { id: 'fd_31', name: 'Curgete / Legumes Salteados', category: 'Legumes', kcalPer100g: 25, proteinPer100g: 1.5, carbsPer100g: 4.5, fatPer100g: 0.3, custom: false },
  { id: 'fd_32', name: 'Tomate / Salada Mista', category: 'Legumes', kcalPer100g: 18, proteinPer100g: 0.9, carbsPer100g: 3.9, fatPer100g: 0.2, custom: false },
  { id: 'fd_68', name: 'Feijão Verde Cozido', category: 'Legumes', kcalPer100g: 31, proteinPer100g: 1.8, carbsPer100g: 7, fatPer100g: 0.2, custom: false },
  { id: 'fd_69', name: 'Cenoura Cozida/Crua', category: 'Legumes', kcalPer100g: 41, proteinPer100g: 0.9, carbsPer100g: 9.6, fatPer100g: 0.2, custom: false },
  { id: 'fd_70', name: 'Cogumelos Frescos', category: 'Legumes', kcalPer100g: 22, proteinPer100g: 3.1, carbsPer100g: 3.3, fatPer100g: 0.3, custom: false },
  { id: 'fd_71', name: 'Alface / Rúcula', category: 'Legumes', kcalPer100g: 15, proteinPer100g: 1.4, carbsPer100g: 2.9, fatPer100g: 0.2, custom: false },
  { id: 'fd_33', name: 'Azeite Virgem Extra', category: 'Gordura', kcalPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100, custom: false },
  { id: 'fd_34', name: 'Manteiga de Amendoim 100%', category: 'Gordura', kcalPer100g: 588, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50, custom: false },
  { id: 'fd_35', name: 'Amêndoas', category: 'Gordura', kcalPer100g: 579, proteinPer100g: 21, carbsPer100g: 22, fatPer100g: 50, custom: false },
  { id: 'fd_36', name: 'Nozes', category: 'Gordura', kcalPer100g: 654, proteinPer100g: 15, carbsPer100g: 14, fatPer100g: 65, custom: false },
  { id: 'fd_37', name: 'Abacate', category: 'Gordura', kcalPer100g: 160, proteinPer100g: 2, carbsPer100g: 9, fatPer100g: 15, custom: false },
  { id: 'fd_38', name: 'Sementes de Chia', category: 'Gordura', kcalPer100g: 486, proteinPer100g: 17, carbsPer100g: 42, fatPer100g: 31, custom: false },
  { id: 'fd_72', name: 'Caju / Castanha do Pará', category: 'Gordura', kcalPer100g: 553, proteinPer100g: 18.2, carbsPer100g: 30.2, fatPer100g: 43.8, custom: false },
  { id: 'fd_73', name: 'Sementes de Linhaça Moídas', category: 'Gordura', kcalPer100g: 534, proteinPer100g: 18.3, carbsPer100g: 28.9, fatPer100g: 42.2, custom: false },
  { id: 'fd_74', name: 'Chocolate Negro >85% Cacau', category: 'Gordura', kcalPer100g: 598, proteinPer100g: 10, carbsPer100g: 24, fatPer100g: 48, custom: false },
];

export const DEFAULT_TEMPLATES: Omit<MessageTemplateRecord, 'userId'>[] = [
  {
    id: 'CONVITE',
    templateKey: 'CONVITE',
    title: 'Convite da semana',
    description: 'Enviado para a lista de transmissão ao publicar a semana.',
    body: 'Olá! Já estão disponíveis os treinos da semana ({semana}) 👇\n{link}\nEscolhe os teus horários! 💪 New Shape',
    defaultBody: 'Olá! Já estão disponíveis os treinos da semana ({semana}) 👇\n{link}\nEscolhe os teus horários! 💪 New Shape',
  },
  {
    id: 'LEMBRETE',
    templateKey: 'LEMBRETE',
    title: 'Lembrete',
    description: 'Enviado a quem ainda não respondeu na semana.',
    body: 'Olá {nome}! Ainda não vimos a tua resposta para a semana {semana}. Podes marcar aqui: {link} 💪 New Shape',
    defaultBody: 'Olá {nome}! Ainda não vimos a tua resposta para a semana {semana}. Podes marcar aqui: {link} 💪 New Shape',
  },
  {
    id: 'CONFIRMACAO',
    templateKey: 'CONFIRMACAO',
    title: 'Confirmação',
    description: 'Ao confirmar o pedido de um cliente.',
    body: 'Olá {nome}! ✅ Treino confirmado:\n{treinos}\nAté já! 💪 New Shape',
    defaultBody: 'Olá {nome}! ✅ Treino confirmado:\n{treinos}\nAté já! 💪 New Shape',
  },
  {
    id: 'RECUSA',
    templateKey: 'RECUSA',
    title: 'Recusa de horário',
    description: 'Quando um horário pedido não está disponível.',
    body: 'Olá {nome}, infelizmente não deu para o horário:\n{treinos}\nPodes escolher outro horário aqui: {link} 💪 New Shape',
    defaultBody: 'Olá {nome}, infelizmente não deu para o horário:\n{treinos}\nPodes escolher outro horário aqui: {link} 💪 New Shape',
  },
  {
    id: 'ALTERACAO',
    templateKey: 'ALTERACAO',
    title: 'Alteração de horário',
    description: 'Quando moves um cliente para outro treino com vaga.',
    body: 'Olá {nome}! 🔄 Atualizámos o teu treino:\n{treinos}\nConfirmado! 💪 New Shape',
    defaultBody: 'Olá {nome}! 🔄 Atualizámos o teu treino:\n{treinos}\nConfirmado! 💪 New Shape',
  },
  {
    id: 'CANCELAMENTO',
    templateKey: 'CANCELAMENTO',
    title: 'Cancelamento',
    description: 'Resposta quando o cliente desmarca todos os treinos.',
    body: 'Olá {nome}, recebemos o teu cancelamento para a semana {semana}. Quando quiseres reagendar usa o link: {link} 💪 New Shape',
    defaultBody: 'Olá {nome}, recebemos o teu cancelamento para a semana {semana}. Quando quiseres reagendar usa o link: {link} 💪 New Shape',
  },
];
