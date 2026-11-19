import React, { useState } from 'react';
import { Dumbbell, LogOut, User, UserPlus, AlertCircle, ShieldCheck } from 'lucide-react';
import { ClientRecord } from '../types/studio';
import { isValidPortuguesePhone, normalizePortuguesePhone } from '../data/seedCatalog';
import { NewShapeLogo } from './NewShapeLogo';
import { BrandCard, FieldLabel, GoldButton, Input, SecondaryButton } from './UiPrimitives';

export const GoogleSignInScreen: React.FC<{
  loading: boolean;
  error: string | null;
  onSignIn: () => void;
}> = ({ loading, error, onSignIn }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1811] via-[#121214] to-[#121214] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="h-1.5 w-24 rounded-full bg-[#EAB308]" />
        <NewShapeLogo />
        <p className="text-sm text-[#A1A1AA]">
          Versão Web · Ligada em tempo real ao mesmo Firebase da app Android New Shape.
        </p>

        <BrandCard highlight>
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-[#F4F4F5]">Entrar no Estúdio</h1>
              <p className="mt-1 text-sm text-[#A1A1AA]">
                Inicia sessão com a tua conta Google do estúdio para sincronizar marcações, alunos,
                treinos, nutrição, avaliações físicas, finanças e chat.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-[#EF4444]/50 bg-[#3B1518] p-3 text-xs text-[#FCA5A5] flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#EF4444]" />
                <div>
                  <p className="font-semibold">Erro ao autenticar</p>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <GoldButton fullWidth onClick={onSignIn} disabled={loading}>
              <ShieldCheck className="h-4 w-4" />
              {loading ? 'A ligar ao Google...' : 'Continuar com Google'}
            </GoldButton>

            <div className="rounded-xl border border-[#323238] bg-[#242429]/70 p-3 text-xs text-[#A1A1AA] space-y-1">
              <p className="font-semibold text-[#F4F4F5]">Nota para deploy na Vercel:</p>
              <p>
                Adiciona o teu domínio <code className="text-[#FACC15]">*.vercel.app</code> em{' '}
                Firebase Console → Authentication → Settings → Authorized domains.
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
  weekSlugLabel?: string;
  onSignOut: () => void;
  onEnterPt: () => void;
  onEnterStudent: (clientId: string) => void;
  onRegisterNewStudent: (fullName: string, cleanPhone: string) => Promise<void>;
}> = ({
  clients,
  userEmail,
  initialRoleTab = 'PT',
  weekSlugLabel,
  onSignOut,
  onEnterPt,
  onEnterStudent,
  onRegisterNewStudent,
}) => {
  const [roleTab, setRoleTab] = useState<'PT' | 'STUDENT'>(initialRoleTab);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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
    setSubmitting(true);
    try {
      await onRegisterNewStudent(`${f} ${l}`, clean);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registar aluno.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1811] via-[#121214] to-[#121214] px-4 py-8">
      <div className="mx-auto max-w-lg space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-1.5 w-24 rounded-full bg-[#EAB308]" />
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#A1A1AA] hover:bg-[#242429] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>

        <div>
          <NewShapeLogo />
          <p className="mt-2 text-sm text-[#A1A1AA]">
            Gestão de Treinos, Nutrição & Marcações
          </p>
          {userEmail && (
            <p className="mt-1 text-xs font-semibold text-[#FACC15]">
              Conta Google: {userEmail}
            </p>
          )}
          {weekSlugLabel && (
            <p className="mt-1 text-xs text-[#EAB308]">
              Link semanal detetado: <span className="font-bold">{weekSlugLabel}</span>
            </p>
          )}
        </div>

        {/* Role Switcher */}
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

        {roleTab === 'PT' ? (
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
