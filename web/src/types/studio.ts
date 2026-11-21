export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'ALTERED' | 'CANCELLED';

export type MealTypeKey =
  | 'PEQUENO_ALMOCO'
  | 'LANCHE_MANHA'
  | 'ALMOCO'
  | 'LANCHE_TARDE'
  | 'JANTAR'
  | 'CEIA';

export type TrainingType = 'PERSONALIZADO' | 'GRUPO';

export type AttendanceStatus = '' | 'PENDING' | 'PRESENT' | 'ABSENT';

export const SUPER_ADMIN_EMAIL = 'pafm77pedrinho77@gmail.com';

export function isSuperAdminEmail(email?: string | null): boolean {
  return (email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

export type PtAccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PtAccountRecord {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  status: PtAccountStatus;
  isAdmin: boolean;
  requestedAtMillis: number;
  reviewedAtMillis: number;
}

export type PtNotificationType = 'CANCELLED' | 'ALTERED' | 'UNAVAILABLE';

export interface PtNotificationRecord {
  id: string;
  userId: string;
  clientId: string;
  clientName: string;
  type: PtNotificationType;
  summary: string;
  weekKey: string;
  read: boolean;
  timestampMillis: number;
}

export interface ClientRecord {
  id: string;
  userId: string;
  name: string;
  phone: string;
  notes: string;
  active: boolean;
  newClient: boolean;
  monthlyFeeEur: number;
  fidelizacaoMonths: number;
  fidelizacaoStartMillis: number;
  trainingType: TrainingType;
}

export interface TrainingWeekRecord {
  id: string;
  userId: string;
  weekKey: string;
  label: string;
  startDateMillis: number;
  published: boolean;
}

export interface TrainingSessionRecord {
  id: string;
  userId: string;
  weekKey: string;
  dayOfWeek: number;
  dateLabel: string;
  timeLabel: string;
  durationMinutes: number;
  capacity: number;
  note: string;
  startMillis: number;
}

export interface BookingRecord {
  id: string;
  userId: string;
  sessionId: string;
  weekKey: string;
  clientId: string;
  status: BookingStatus;
  attendanceStatus: AttendanceStatus;
  requestedAtMillis: number;
}

export interface WeekResponseRecord {
  id: string;
  userId: string;
  weekKey: string;
  clientId: string;
  status: 'UNAVAILABLE' | 'REMINDED';
}

export interface PaymentRecord {
  id: string;
  userId: string;
  clientId: string;
  monthYear: string;
  monthLabel: string;
  amountEur: number;
  paid: boolean;
  paidAtMillis: number;
  note: string;
}

export interface FidelizacaoRecord {
  id: string;
  userId: string;
  clientId: string;
  durationMonths: 6 | 12;
  startDateMillis: number;
  endDateMillis: number;
  notes: string;
}

export interface ExerciseRecord {
  id: string;
  userId: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  instructions: string;
  custom: boolean;
}

export interface WorkoutPlanRecord {
  id: string;
  userId: string;
  clientId: string;
  title: string;
  splitLabel: string;
  createdAtMillis: number;
}

export interface WorkoutPlanItemRecord {
  id: string;
  userId: string;
  planId: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  sets: number;
  reps: string;
  loadKg: string;
  lastLoadKg?: string;
  lastLoggedAtMillis?: number;
  restSeconds: number;
  notes: string;
  orderIndex: number;
}

export interface FoodItemRecord {
  id: string;
  userId: string;
  name: string;
  category: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  custom: boolean;
}

export interface NutritionEntryRecord {
  id: string;
  userId: string;
  clientId: string;
  mealType: MealTypeKey;
  foodId: string;
  foodName: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ChatMessageRecord {
  id: string;
  userId: string;
  clientId: string;
  senderRole: 'PT' | 'STUDENT';
  text: string;
  timestampMillis: number;
}

export interface MessageTemplateRecord {
  id: string;
  userId: string;
  templateKey: string;
  title: string;
  description: string;
  body: string;
  defaultBody: string;
}

export interface StudioSettingsRecord {
  id: string;
  userId: string;
  clientsCanEdit: boolean;
  cutoffHours: number;
  cutoffMinutes?: number;
  whatsappWebMode: boolean;
  siteBaseUrl: string;
  studentPortalCode?: string;
  ptWhatsappPhone?: string;
  seeded: boolean;
}

export interface PhysicalAssessmentRecord {
  id: string;
  userId: string;
  clientId: string;
  dateMillis: number;
  weightKg: number;
  ageYears: number;
  heightCm: number;
  sex: 'M' | 'F';
  bodyFatPct: number;
  muscleMassKg: number;
  visceralFat: number;
  bmi: number;
  bmrKcal: number;
  notes: string;
}

export interface BookingWithSession {
  booking: BookingRecord;
  session: TrainingSessionRecord;
}

export interface PendingConfirmationCard {
  client: ClientRecord;
  week: TrainingWeekRecord;
  items: BookingWithSession[];
  requestedAtMillis: number;
  isCancelledAll: boolean;
  isAltered: boolean;
}

export interface ImportResult {
  added: number;
  ignored: number;
  errors: string[];
}
