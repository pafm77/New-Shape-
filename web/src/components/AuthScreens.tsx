import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Dumbbell,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import { ClientRecord } from '../types/studio';
import {
  formatRgpdConsentStamp,
  isValidPortuguesePhone,
  normalizePortuguesePhone,
} from '../data/seedCatalog';
import { NewShapeLogo } from './NewShapeLogo';
import { BrandCard, FieldLabel, GoldButton, Input, SecondaryButton } from './UiPrimitives';

export const PtEmailSignInScreen: React.FC<{
  loading: boolean;
  error: string | null;
  info: string | null;
  isPtRoute?: boolean;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailSignUp: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onGoogleSignIn: () => void;
}> = ({
  loading,
  error,
  info,
  isPtRoute = false,
  onEmailSignIn,
  onEmailSignUp,
  onResetPassword,
  onGoogleSignIn,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLocalError('Indica um endereço de e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setLocalError('A palavra-passe tem de ter pelo menos 6 caracteres.');
      return;
    }
    if (mode === 'register') {
      if (password !== confirmPassword) {
        setLocalError('As palavras-passe não coincidem.');
        return;
      }
      await onEmailSignUp(cleanEmail, password);
    } else {
      await onEmailSignIn(cleanEmail, password);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1811] via-[#121214] to-[#121214] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="h-1.5 w-24 rounded-full bg-[#EAB308]" />
        <NewShapeLogo />
        <p className="text-sm text-[#A1A1AA]">
          {isPtRoute
            ? 'Acesso exclusivo do Personal Trainer · Painel do Estúdio'
            : 'Versão Web · Sincronizada em tempo real com a app New Shape.'}
        </p>

        <BrandCard highlight>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-xl font-bold text-[#F4F4F5]">
                  {mode === 'login' ? 'Entrar no Painel PT' : 'Criar Conta PT'}
                </h1>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  {mode === 'login'
                    ? 'Usa o teu e-mail e palavra-passe — não precisas de conta Google.'
                    : 'Cria a tua conta de Personal Trainer com e-mail e palavra-passe.'}
                </p>
              </div>
              <span className="rounded-xl border border-[#EAB308]/40 bg-[#3D3314] px-2.5 py-1 text-[11px] font-bold text-[#FACC15]">
                Área PT
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-[#323238] bg-[#141417] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setLocalError(null);
                }}
                className={`rounded-lg py-2 text-xs font-bold transition ${
                  mode === 'login'
                    ? 'bg-[#EAB308] text-[#121214]'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                Iniciar sessão
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setLocalError(null);
                }}
                className={`rounded-lg py-2 text-xs font-bold transition ${
                  mode === 'register'
                    ? 'bg-[#EAB308] text-[#121214]'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                Criar conta PT
              </button>
            </div>

            {info && (
              <div className="rounded-xl border border-[#22C55E]/40 bg-[#143521] p-3 text-xs text-[#86EFAC] flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#22C55E]" />
                <span>{info}</span>
              </div>
            )}

            {displayError && (
              <div className="rounded-xl border border-[#EF4444]/50 bg-[#3B1518] p-3 text-xs text-[#FCA5A5] flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#EF4444]" />
                <div>
                  <p className="font-semibold">Não foi possível entrar</p>
                  <p className="mt-0.5">{displayError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <FieldLabel>E-mail do PT</FieldLabel>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setLocalError(null);
                    }}
                    placeholder="pt@newshape.pt"
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Palavra-passe</FieldLabel>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
                  <Input
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setLocalError(null);
                    }}
                    placeholder="Mínimo 6 caracteres"
                    className="pl-9"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <FieldLabel>Confirmar palavra-passe</FieldLabel>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setLocalError(null);
                      }}
                      placeholder="Repete a palavra-passe"
                      className="pl-9"
                    />
                  </div>
                </div>
              )}

              <GoldButton fullWidth type="submit" disabled={loading}>
                <ShieldCheck className="h-4 w-4" />
                {loading
                  ? 'A autenticar...'
                  : mode === 'login'
                  ? 'Entrar com E-mail e Palavra-passe'
                  : 'Criar Conta PT e Entrar'}
              </GoldButton>

              {mode === 'login' && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setLocalError(null);
                    if (!email.trim() || !email.includes('@')) {
                      setLocalError('Escreve primeiro o teu e-mail acima para recuperar a palavra-passe.');
                      return;
                    }
                    onResetPassword(email.trim());
                  }}
                  className="w-full py-1 text-center text-xs font-medium text-[#FACC15] hover:underline"
                >
                  Esqueci-me da palavra-passe
                </button>
              )}
            </form>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-[#323238]" />
              <span className="mx-3 text-[11px] uppercase tracking-wider text-[#A1A1AA]">ou</span>
              <div className="flex-grow border-t border-[#323238]" />
            </div>

            <SecondaryButton fullWidth onClick={onGoogleSignIn} disabled={loading}>
              <ShieldCheck className="h-4 w-4 text-[#EAB308]" />
              Continuar com Google (opcional)
            </SecondaryButton>

            <div className="rounded-xl border border-[#323238] bg-[#242429]/70 p-3 text-xs text-[#A1A1AA] space-y-1">
              <p className="font-semibold text-[#F4F4F5]">És aluno?</p>
              <p>
                Pede ao teu Personal Trainer o <strong className="text-[#FACC15]">Link do Aluno</strong>{' '}
                (começa por <code className="text-[#FACC15]">/aluno?pt=...</code>) — entras só com
                o teu número de telemóvel, sem e-mail nem palavra-passe!
              </p>
            </div>
          </div>
        </BrandCard>
      </div>
    </div>
  );
};

export const AuthRoleScreen: React.FC<{
  clients: ClientRecord[];
  userEmail: string;
  initialRoleTab?: 'PT' | 'STUDENT';
  lockedStudentOnly?: boolean;
  weekSlugLabel?: string;
  onSignOut: () => void;
  onEnterPt: () => void;
  onEnterStudent: (clientId: string) => void;
  onRegisterNewStudent: (
    fullName: string,
    cleanPhone: string,
    rgpdConsentNote: string
  ) => Promise<void>;
}> = ({
  clients,
  userEmail,
  initialRoleTab = 'PT',
  lockedStudentOnly = false,
  weekSlugLabel,
  onSignOut,
  onEnterPt,
  onEnterStudent,
  onRegisterNewStudent,
}) => {
  const [roleTab, setRoleTab] = useState<'PT' | 'STUDENT'>(
    lockedStudentOnly ? 'STUDENT' : initialRoleTab
  );
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [rgpdAccepted, setRgpdAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = normalizePortuguesePhone(phone);
    if (!isValidPortuguesePhone(clean)) {
      setError('Indica um número de telemóvel válido (9 dígitos, começado por 9 ou 2).');
      return;
    }
    const existing = clients.find((c) => c.phone === clean);
    if (existing) {
      onEnterStudent(existing.id);
    } else {
      setInfo('Número ainda não registado. Preenche o teu 1º nome e sobrenome para criar conta.');
      setIsRegisterMode(true);
    }
  };

  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = normalizePortuguesePhone(phone);
    const f = firstName.trim();
    const l = lastName.trim();
    if (!f || !l) {
      setError('Preenche o teu primeiro nome e sobrenome.');
      return;
    }
    if (!isValidPortuguesePhone(clean)) {
      setError('Indica um número de telemóvel válido (9 dígitos, começado por 9 ou 2).');
      return;
    }
    const existing = clients.find((c) => c.phone === clean);
    if (existing) {
      onEnterStudent(existing.id);
      return;
    }
    if (!rgpdAccepted) {
      setError('Tens de aceitar o consentimento RGPD para concluir o registo.');
      return;
    }
    setSubmitting(true);
    try {
      await onRegisterNewStudent(`${f} ${l}`, clean, formatRgpdConsentStamp());
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      const rawMsg = err instanceof Error ? err.message : '';
      if (code === 'permission-denied' || /permission/i.test(rawMsg)) {
        setError(
          'Sem permissão para criar o registo com este link. Recarrega a página ou pede ao teu Personal Trainer o link semanal atualizado.'
        );
      } else {
        setError(rawMsg || 'Erro ao registar aluno.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1811] via-[#121214] to-[#121214] px-4 py-8">
      <div className="mx-auto max-w-lg space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-1.5 w-24 rounded-full bg-[#EAB308]" />
          {!lockedStudentOnly && (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#A1A1AA] hover:bg-[#242429] hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          )}
        </div>

        <div>
          <NewShapeLogo />
          <p className="mt-2 text-sm text-[#A1A1AA]">
            {lockedStudentOnly
              ? 'Portal do Aluno · Treinos, Nutrição, Avaliações & Chat'
              : 'Gestão de Treinos, Nutrição & Marcações'}
          </p>
          {!lockedStudentOnly && userEmail && (
            <p className="mt-1 text-xs font-semibold text-[#FACC15]">
              Sessão PT: {userEmail}
            </p>
          )}
          {weekSlugLabel && (
            <p className="mt-1 text-xs text-[#EAB308]">
              Link semanal detetado: <span className="font-bold">{weekSlugLabel}</span>
            </p>
          )}
        </div>

        {!lockedStudentOnly && (
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#323238] bg-[#1B1B1E] p-1.5">
            <button
              type="button"
              onClick={() => setRoleTab('PT')}
              className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${
                roleTab === 'PT'
                  ? 'bg-[#EAB308] text-[#121214]'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              <Dumbbell className="h-4 w-4" />
              Área do PT
            </button>
            <button
              type="button"
              onClick={() => setRoleTab('STUDENT')}
              className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${
                roleTab === 'STUDENT'
                  ? 'bg-[#EAB308] text-[#121214]'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              <User className="h-4 w-4" />
              Área do Aluno
            </button>
          </div>
        )}

        {!lockedStudentOnly && roleTab === 'PT' ? (
          <BrandCard highlight>
            <h2 className="text-xl font-bold text-[#F4F4F5]">Painel do Personal Trainer</h2>
            <p className="mt-1.5 text-sm text-[#A1A1AA]">
              Gere a fila de marcações por confirmar, semanas e vagas, clientes, planos de treino
              e exercícios, nutrição com macros, avaliação física (IMC/TMB + gráfico), finanças,
              fidelizações e chat privado.
            </p>
            <div className="mt-5">
              <GoldButton fullWidth onClick={onEnterPt}>
                <Dumbbell className="h-4 w-4" />
                Entrar no Painel PT
              </GoldButton>
            </div>
          </BrandCard>
        ) : (
          <BrandCard highlight>
            <h2 className="text-xl font-bold text-[#F4F4F5]">
              {isRegisterMode ? 'Criar Registo de Aluno' : 'Olá! 👋'}
            </h2>
            <p className="mt-1 text-sm text-[#A1A1AA]">
              {isRegisterMode
                ? 'Preenche apenas o teu 1º nome, sobrenome e número de telemóvel.'
                : 'Para escolheres os teus treinos e veres o teu plano, diz-nos o teu telemóvel.'}
            </p>

            {info && (
              <div className="mt-3 rounded-xl border border-[#EAB308] bg-[#3D3314] p-3 text-xs text-[#FACC15]">
                {info}
              </div>
            )}

            <form
              onSubmit={isRegisterMode ? handleStudentRegister : handleStudentLogin}
              className="mt-4 space-y-3"
            >
              {isRegisterMode && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Primeiro Nome</FieldLabel>
                    <Input
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setError(null);
                      }}
                      placeholder="Ex: Ana"
                    />
                  </div>
                  <div>
                    <FieldLabel>Sobrenome</FieldLabel>
                    <Input
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        setError(null);
                      }}
                      placeholder="Ex: Ribeiro"
                    />
                  </div>
                </div>
              )}

              <div>
                <FieldLabel>Telemóvel (WhatsApp)</FieldLabel>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/[^\d+\s]/g, '').slice(0, 15));
                    setError(null);
                  }}
                  placeholder="912 345 678"
                />
              </div>

              {isRegisterMode && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#323238] bg-[#242429]/80 p-3 text-xs transition hover:border-[#EAB308]/60">
                  <input
                    type="checkbox"
                    checked={rgpdAccepted}
                    onChange={(e) => {
                      setRgpdAccepted(e.target.checked);
                      setError(null);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#EAB308]"
                  />
                  <span className="space-y-1">
                    <span className="block font-bold text-[#F4F4F5]">
                      Consentimento RGPD (Obrigatório)
                    </span>
                    <span className="block leading-relaxed text-[#A1A1AA]">
                      Autorizo o tratamento dos meus dados pessoais (nome, telemóvel, marcações,
                      treinos, nutrição e avaliações físicas) pelo estúdio New Shape, nos termos
                      do Regulamento Geral sobre a Proteção de Dados (RGPD).
                    </span>
                  </span>
                </label>
              )}

              {error && <p className="text-xs font-medium text-[#EF4444]">{error}</p>}

              {!isRegisterMode ? (
                <div className="space-y-2 pt-1">
                  <GoldButton fullWidth type="submit">
                    <User className="h-4 w-4" />
                    Continuar
                  </GoldButton>
                  <SecondaryButton
                    fullWidth
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(true);
                      setError(null);
                      setInfo(null);
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                    Primeiro acesso? Registar aluno
                  </SecondaryButton>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <GoldButton fullWidth type="submit" disabled={submitting}>
                    <UserPlus className="h-4 w-4" />
                    {submitting ? 'A registar...' : 'Registar e Entrar'}
                  </GoldButton>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(false);
                      setError(null);
                      setInfo(null);
                    }}
                    className="w-full py-2 text-center text-xs font-medium text-[#A1A1AA] hover:text-white"
                  >
                    Já tenho conta · Entrar só com telemóvel
                  </button>
                </div>
              )}
            </form>
          </BrandCard>
        )}
      </div>
    </div>
  );
};
