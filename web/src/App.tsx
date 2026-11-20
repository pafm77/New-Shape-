import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  Briefcase,
  Dumbbell,
  Home,
  LogOut,
  RotateCcw,
  Scale,
  UserCheck,
  Users,
  Utensils,
} from 'lucide-react';
import { auth, googleProvider } from './firebase';
import {
  BookingRecord,
  BookingWithSession,
  ChatMessageRecord,
  ClientRecord,
  ExerciseRecord,
  FidelizacaoRecord,
  FoodItemRecord,
  MessageTemplateRecord,
  NutritionEntryRecord,
  PaymentRecord,
  PendingConfirmationCard,
  PhysicalAssessmentRecord,
  StudioSettingsRecord,
  TrainingSessionRecord,
  TrainingWeekRecord,
  WeekResponseRecord,
  WorkoutPlanItemRecord,
  WorkoutPlanRecord,
} from './types/studio';
import {
  DEFAULT_TEMPLATES,
  getMondayOfWeek,
  formatWeekKey,
} from './data/seedCatalog';
import * as repo from './services/firestoreRepository';
import { NewShapeLogo } from './components/NewShapeLogo';
import { AuthRoleScreen, GoogleSignInScreen } from './components/AuthScreens';
import { PtHomeSection } from './components/PtHomeSection';
import { PtClientsSection } from './components/PtClientsSection';
import { PtTrainingSection } from './components/PtTrainingSection';
import { PtNutritionSection } from './components/PtNutritionSection';
import { PtAssessmentSection } from './components/PtAssessmentSection';
import { PtManagementSection } from './components/PtManagementSection';
import { StudentPortal } from './components/StudentPortal';

type PtMainTab = 'home' | 'clients' | 'training' | 'nutrition' | 'assessment' | 'management';

export function App() {
  const pathInfo = useMemo(() => {
    const p = window.location.pathname.toLowerCase();
    if (p.startsWith('/s/')) {
      return {
        routeType: 'STUDENT_WEEK' as const,
        weekSlug: p.slice(3).split('/')[0] || undefined,
      };
    }
    if (p.startsWith('/aluno')) {
      return { routeType: 'STUDENT' as const, weekSlug: undefined };
    }
    if (p.startsWith('/painel')) {
      return { routeType: 'PT' as const, weekSlug: undefined };
    }
    return { routeType: 'ROLE' as const, weekSlug: undefined };
  }, []);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [role, setRole] = useState<'NONE' | 'PT' | 'STUDENT'>(() => {
    if (pathInfo.routeType === 'PT') return 'PT';
    const savedStudent = localStorage.getItem('newshape_student_id');
    if (
      (pathInfo.routeType === 'STUDENT' || pathInfo.routeType === 'STUDENT_WEEK') &&
      savedStudent
    ) {
      return 'STUDENT';
    }
    return 'NONE';
  });
  const [studentId, setStudentId] = useState<string | null>(() =>
    localStorage.getItem('newshape_student_id')
  );

  // Firestore synced collections
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [weeks, setWeeks] = useState<TrainingWeekRecord[]>([]);
  const [sessions, setSessions] = useState<TrainingSessionRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [weekResponses, setWeekResponses] = useState<WeekResponseRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [fidelizacoes, setFidelizacoes] = useState<FidelizacaoRecord[]>([]);
  const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlanRecord[]>([]);
  const [workoutPlanItems, setWorkoutPlanItems] = useState<WorkoutPlanItemRecord[]>([]);
  const [foods, setFoods] = useState<FoodItemRecord[]>([]);
  const [nutritionEntries, setNutritionEntries] = useState<NutritionEntryRecord[]>([]);
  const [assessments, setAssessments] = useState<PhysicalAssessmentRecord[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessageRecord[]>([]);
  const [templates, setTemplates] = useState<MessageTemplateRecord[]>([]);
  const [settingsState, setSettingsState] = useState<StudioSettingsRecord | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // UI state
  const [ptTab, setPtTab] = useState<PtMainTab>('home');
  const [jumpClientId, setJumpClientId] = useState<string | undefined>(undefined);
  const [mgmtSubTab, setMgmtSubTab] = useState<'finance' | 'fidelizacao' | 'chat'>('finance');
  const [activeMondayMs, setActiveMondayMs] = useState<number>(() =>
    getMondayOfWeek(new Date()).getTime()
  );
  const [lockedByWhatsApp, setLockedByWhatsApp] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<{
    clientName: string;
    bookings: BookingRecord[];
  } | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const bannerTimerRef = useRef<number | null>(null);

  const showBanner = (msg: string) => {
    setBannerMsg(msg);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setBannerMsg(null), 4000);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!authUser) {
      setDataLoaded(false);
      return;
    }

    const uid = authUser.uid;
    repo.ensureSeeded(uid).catch((e) => {
      showBanner(e?.message || 'Erro ao inicializar base de dados.');
    });

    const unsub = repo.subscribeStudioData(uid, {
      clients: (list) => {
        setClients(list);
        setDataLoaded(true);
      },
      weeks: setWeeks,
      sessions: setSessions,
      bookings: setBookings,
      weekResponses: setWeekResponses,
      payments: setPayments,
      fidelizacoes: setFidelizacoes,
      exercises: setExercises,
      workoutPlans: setWorkoutPlans,
      workoutPlanItems: setWorkoutPlanItems,
      foods: setFoods,
      nutritionEntries: setNutritionEntries,
      physicalAssessments: setAssessments,
      chatMessages: setChatMessages,
      templates: setTemplates,
      settings: setSettingsState,
      onError: (err) => showBanner(err.message),
    });

    return unsub;
  }, [authUser]);

  const effectiveSettings: StudioSettingsRecord = useMemo(
    () =>
      settingsState || {
        id: 'studio',
        userId: authUser?.uid || '',
        clientsCanEdit: true,
        cutoffHours: 12,
        whatsappWebMode: false,
        siteBaseUrl: window.location.origin,
        seeded: true,
      },
    [settingsState, authUser?.uid]
  );

  const effectiveTemplates: MessageTemplateRecord[] = useMemo(() => {
    if (templates.length > 0) return templates;
    return DEFAULT_TEMPLATES.map((t) => ({ ...t, userId: authUser?.uid || '' }));
  }, [templates, authUser?.uid]);

  const activeWeekKey = useMemo(
    () => formatWeekKey(new Date(activeMondayMs)),
    [activeMondayMs]
  );

  const activeWeek: TrainingWeekRecord | null = useMemo(
    () =>
      weeks.find((w) => w.weekKey === activeWeekKey) ||
      weeks[0] ||
      null,
    [weeks, activeWeekKey]
  );

  useEffect(() => {
    if (!authUser) return;
    if (!weeks.some((w) => w.weekKey === activeWeekKey)) {
      repo.ensureWeekExists(authUser.uid, activeMondayMs).catch(() => {});
    }
  }, [authUser, activeWeekKey, activeMondayMs, weeks]);

  const pendingQueue: PendingConfirmationCard[] = useMemo(() => {
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const weekMap = new Map(weeks.map((w) => [w.weekKey, w]));
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    const pendingBookings = bookings.filter(
      (b) => b.status === 'PENDING' || b.status === 'ALTERED' || b.status === 'CANCELLED'
    );

    const grouped = new Map<string, BookingRecord[]>();
    pendingBookings.forEach((b) => {
      const k = `${b.clientId}__${b.weekKey}`;
      const arr = grouped.get(k) || [];
      arr.push(b);
      grouped.set(k, arr);
    });

    const cards: PendingConfirmationCard[] = [];
    grouped.forEach((list) => {
      const first = list[0];
      const client = clientMap.get(first.clientId);
      const week = weekMap.get(first.weekKey);
      if (!client || !week) return;
      const items: BookingWithSession[] = list
        .map((b) => {
          const s = sessionMap.get(b.sessionId);
          return s ? { booking: b, session: s } : null;
        })
        .filter((x): x is BookingWithSession => x !== null)
        .sort((a, b) => a.session.startMillis - b.session.startMillis);
      if (items.length === 0) return;

      const minReq = Math.min(...list.map((b) => b.requestedAtMillis));
      cards.push({
        client,
        week,
        items,
        requestedAtMillis: minReq,
        isCancelledAll: list.every((b) => b.status === 'CANCELLED'),
        isAltered: list.some((b) => b.status === 'ALTERED'),
      });
    });

    return cards.sort((a, b) => a.requestedAtMillis - b.requestedAtMillis);
  }, [bookings, clients, weeks, sessions]);

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Não foi possível iniciar sessão com Google.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    localStorage.removeItem('newshape_student_id');
    setRole('NONE');
    setStudentId(null);
  };

  const handleConfirmCard = async (card: PendingConfirmationCard) => {
    if (!authUser) return;
    const snapshots = card.items.map((i) => ({ ...i.booking }));
    await repo.confirmClientBookings(authUser.uid, snapshots);
    setUndoSnapshot({ clientName: card.client.name, bookings: snapshots });
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => setUndoSnapshot(null), 10000);
  };

  const handleUndoConfirmation = async () => {
    if (!authUser || !undoSnapshot) return;
    await repo.restoreBookings(authUser.uid, undoSnapshot.bookings);
    setUndoSnapshot(null);
    showBanner('Confirmação desfeita.');
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#121214] flex items-center justify-center text-sm text-[#A1A1AA]">
        A carregar New Shape...
      </div>
    );
  }

  if (!authUser) {
    return (
      <GoogleSignInScreen
        loading={authBusy}
        error={authError}
        onSignIn={handleGoogleSignIn}
      />
    );
  }

  const activeStudent = studentId ? clients.find((c) => c.id === studentId) || null : null;

  if (role === 'NONE' || (role === 'STUDENT' && !activeStudent && dataLoaded)) {
    return (
      <AuthRoleScreen
        clients={clients}
        userEmail={authUser.email || ''}
        initialRoleTab={
          pathInfo.routeType === 'STUDENT' || pathInfo.routeType === 'STUDENT_WEEK'
            ? 'STUDENT'
            : 'PT'
        }
        weekSlugLabel={pathInfo.weekSlug}
        onSignOut={handleSignOut}
        onEnterPt={() => setRole('PT')}
        onEnterStudent={(cid) => {
          localStorage.setItem('newshape_student_id', cid);
          setStudentId(cid);
          setRole('STUDENT');
        }}
        onRegisterNewStudent={async (fullName, cleanPhone, rgpdConsentNote) => {
          const newId = await repo.addClient(authUser.uid, {
            name: fullName,
            phone: cleanPhone,
            notes: rgpdConsentNote,
            newClient: true,
          });
          localStorage.setItem('newshape_student_id', newId);
          setStudentId(newId);
          setRole('STUDENT');
          showBanner('Conta criada com consentimento RGPD! Bem-vindo ao New Shape.');
        }}
      />
    );
  }

  if (role === 'STUDENT' && activeStudent) {
    return (
      <>
        <StudentPortal
          uid={authUser.uid}
          client={activeStudent}
          weeks={weeks}
          sessions={sessions}
          bookings={bookings}
          weekResponses={weekResponses}
          payments={payments}
          fidelizacoes={fidelizacoes}
          workoutPlans={workoutPlans}
          workoutPlanItems={workoutPlanItems}
          foodItems={foods}
          nutritionEntries={nutritionEntries}
          assessments={assessments}
          chatMessages={chatMessages}
          settings={effectiveSettings}
          initialWeekSlug={pathInfo.weekSlug}
          onSwitchStudent={() => {
            localStorage.removeItem('newshape_student_id');
            setStudentId(null);
            setRole('NONE');
          }}
          onSwitchToPt={() => setRole('PT')}
          onSignOut={handleSignOut}
          onBanner={showBanner}
        />
        {bannerMsg && <FloatingToast message={bannerMsg} />}
      </>
    );
  }

  const navItems: {
    id: PtMainTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'home',
      label: 'Início',
      icon: <Home className="h-4 w-4" />,
      badge: pendingQueue.length,
    },
    { id: 'clients', label: 'Alunos', icon: <Users className="h-4 w-4" /> },
    { id: 'training', label: 'Treino', icon: <Dumbbell className="h-4 w-4" /> },
    { id: 'nutrition', label: 'Nutrição', icon: <Utensils className="h-4 w-4" /> },
    { id: 'assessment', label: 'Avaliação', icon: <Scale className="h-4 w-4" /> },
    { id: 'management', label: 'Gestão', icon: <Briefcase className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#121214] text-[#F4F4F5] pb-20 lg:pb-0 lg:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-[#323238] bg-[#18181B] p-4">
        <div className="mb-6">
          <NewShapeLogo compact />
          <p className="mt-2 truncate text-xs text-[#A1A1AA]">{authUser.email}</p>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPtTab(item.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                ptTab === item.id
                  ? 'bg-[#EAB308] text-[#121214]'
                  : 'text-[#A1A1AA] hover:bg-[#242429] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                {item.icon}
                {item.label}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                    ptTab === item.id
                      ? 'bg-[#121214] text-[#FACC15]'
                      : 'bg-[#EAB308] text-[#121214]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-4 space-y-2 border-t border-[#323238] pt-4">
          <button
            type="button"
            onClick={() => setRole('NONE')}
            className="flex w-full items-center gap-2 rounded-xl border border-[#323238] bg-[#242429] px-3 py-2 text-xs font-bold text-[#F4F4F5] hover:border-[#EAB308]"
          >
            <UserCheck className="h-4 w-4 text-[#EAB308]" />
            Vista Aluno
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#A1A1AA] hover:bg-[#242429] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Terminar sessão
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:pl-64">
        {/* Mobile Top Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#323238] bg-[#121214]/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <NewShapeLogo compact />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRole('NONE')}
              className="rounded-xl border border-[#323238] bg-[#1B1B1E] px-2.5 py-1.5 text-xs font-bold text-[#FACC15]"
            >
              Vista Aluno
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sair"
              className="rounded-xl border border-[#323238] bg-[#1B1B1E] p-1.5 text-[#A1A1AA]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-5 space-y-4">
          {lockedByWhatsApp && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#EAB308] bg-[#3D3314] px-4 py-3 text-xs text-[#FACC15]">
              <span>
                <strong>WhatsApp aberto</strong> — quando regressares, confirma abaixo para
                desbloquear o próximo aluno da fila.
              </span>
              <button
                type="button"
                onClick={() => setLockedByWhatsApp(false)}
                className="rounded-lg bg-[#EAB308] px-3 py-1.5 font-bold text-[#121214]"
              >
                Já voltei
              </button>
            </div>
          )}

          {undoSnapshot && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#22C55E]/50 bg-[#143521] px-4 py-3 text-xs text-[#86EFAC]">
              <span>
                Confirmado para <strong>{undoSnapshot.clientName}</strong>.
              </span>
              <button
                type="button"
                onClick={handleUndoConfirmation}
                className="inline-flex items-center gap-1 rounded-lg bg-[#22C55E] px-3 py-1 font-bold text-[#121214]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Desfazer
              </button>
            </div>
          )}

          {ptTab === 'home' && (
            <PtHomeSection
              uid={authUser.uid}
              clients={clients}
              weeks={weeks}
              activeWeek={activeWeek}
              sessions={sessions}
              bookings={bookings}
              weekResponses={weekResponses}
              templates={effectiveTemplates}
              settings={effectiveSettings}
              pendingQueue={pendingQueue}
              lockedByWhatsApp={lockedByWhatsApp}
              onShiftWeek={(delta) => {
                const d = new Date(activeMondayMs);
                d.setDate(d.getDate() + delta * 7);
                setActiveMondayMs(d.getTime());
              }}
              onWhatsAppOpened={() => setLockedByWhatsApp(true)}
              onConfirmCard={handleConfirmCard}
              onBanner={showBanner}
            />
          )}

          {ptTab === 'clients' && (
            <PtClientsSection
              uid={authUser.uid}
              clients={clients}
              payments={payments}
              fidelizacoes={fidelizacoes}
              onJumpToWorkout={(cid) => {
                setJumpClientId(cid);
                setPtTab('training');
              }}
              onJumpToNutrition={(cid) => {
                setJumpClientId(cid);
                setPtTab('nutrition');
              }}
              onJumpToChat={(cid) => {
                setJumpClientId(cid);
                setMgmtSubTab('chat');
                setPtTab('management');
              }}
              onBanner={showBanner}
            />
          )}

          {ptTab === 'training' && (
            <PtTrainingSection
              uid={authUser.uid}
              clients={clients}
              exercises={exercises}
              workoutPlans={workoutPlans}
              workoutPlanItems={workoutPlanItems}
              initialClientId={jumpClientId}
              onBanner={showBanner}
            />
          )}

          {ptTab === 'nutrition' && (
            <PtNutritionSection
              uid={authUser.uid}
              clients={clients}
              foodItems={foods}
              nutritionEntries={nutritionEntries}
              initialClientId={jumpClientId}
              onBanner={showBanner}
            />
          )}

          {ptTab === 'assessment' && (
            <PtAssessmentSection
              clients={clients}
              assessments={assessments}
            />
          )}

          {ptTab === 'management' && (
            <PtManagementSection
              uid={authUser.uid}
              clients={clients}
              payments={payments}
              fidelizacoes={fidelizacoes}
              chatMessages={chatMessages}
              initialSubTab={mgmtSubTab}
              initialChatClientId={jumpClientId}
              onBanner={showBanner}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-[#323238] bg-[#18181B]/95 backdrop-blur-md lg:hidden">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPtTab(item.id)}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold ${
              ptTab === item.id ? 'text-[#FACC15]' : 'text-[#A1A1AA]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute right-2 top-1 rounded-full bg-[#EAB308] px-1.5 text-[9px] font-extrabold text-[#121214]">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {bannerMsg && <FloatingToast message={bannerMsg} />}
    </div>
  );
}

const FloatingToast: React.FC<{ message: string }> = ({ message }) => (
  <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 lg:bottom-6 rounded-xl border border-[#EAB308] bg-[#1B1B1E] px-4 py-2.5 text-xs font-bold text-[#FACC15] shadow-2xl">
    {message}
  </div>
);

export default App;
