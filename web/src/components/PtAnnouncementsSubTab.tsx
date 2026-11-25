import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Megaphone,
  Plus,
  StopCircle,
  Trash2,
  Users,
} from 'lucide-react';
import {
  AnnouncementReadRecord,
  ClientRecord,
  StudioAnnouncementRecord,
} from '../types/studio';
import {
  closeStudioAnnouncement,
  createStudioAnnouncement,
  deleteStudioAnnouncement,
} from '../services/firestoreRepository';
import { formatShortDate } from '../data/seedCatalog';
import {
  BrandCard,
  EmptyState,
  FieldLabel,
  GoldButton,
  Input,
  SecondaryButton,
  StatusPill,
  Textarea,
} from './UiPrimitives';

interface Props {
  uid: string;
  clients: ClientRecord[];
  announcements: StudioAnnouncementRecord[];
  announcementReads: AnnouncementReadRecord[];
  onNotify: (msg: string) => void;
}

const DURATION_PRESETS = [
  { days: 1, label: '1 dia' },
  { days: 3, label: '3 dias' },
  { days: 7, label: '7 dias' },
  { days: 14, label: '14 dias' },
  { days: 30, label: '30 dias' },
];

function formatDateTimePt(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} às ${hh}:${min}`;
}

export const PtAnnouncementsSubTab: React.FC<Props> = ({
  uid,
  clients,
  announcements,
  announcementReads,
  onNotify,
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [customDays, setCustomDays] = useState('7');
  const [publishing, setPublishing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeClients = useMemo(
    () => clients.filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  const readsByAnnouncement = useMemo(() => {
    const map = new Map<string, AnnouncementReadRecord[]>();
    announcementReads.forEach((r) => {
      const list = map.get(r.announcementId) ?? [];
      list.push(r);
      map.set(r.announcementId, list);
    });
    return map;
  }, [announcementReads]);

  const now = Date.now();

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      onNotify('Preenche o título e a mensagem do aviso.');
      return;
    }
    const parsedDays = Math.max(1, Math.min(90, Number(customDays) || durationDays || 7));
    setPublishing(true);
    try {
      await createStudioAnnouncement(uid, {
        title: title.trim(),
        message: message.trim(),
        durationDays: parsedDays,
      });
      setTitle('');
      setMessage('');
      setDurationDays(7);
      setCustomDays('7');
      onNotify(`Aviso publicado para os alunos durante ${parsedDays} dia(s)!`);
    } catch (err) {
      onNotify((err as Error).message || 'Erro ao publicar aviso.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Publish New Announcement */}
      <BrandCard highlight className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3D3314] text-[#EAB308]">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#F4F4F5]">
              Publicar Aviso no Portal dos Alunos
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              O aviso só aparece aos alunos enquanto estiver ativo e até clicarem em “Lido”.
            </p>
          </div>
        </div>

        <form onSubmit={handlePublish} className="space-y-3">
          <div>
            <FieldLabel>Título do aviso</FieldLabel>
            <Input
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Horário especial de feriado · Mudança de sala"
            />
          </div>

          <div>
            <FieldLabel>Mensagem</FieldLabel>
            <Textarea
              rows={3}
              maxLength={1200}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escreve a informação importante que queres comunicar aos alunos..."
            />
          </div>

          <div>
            <FieldLabel>Duração do aviso (dias)</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              {DURATION_PRESETS.map((p) => {
                const selected = durationDays === p.days && Number(customDays) === p.days;
                return (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => {
                      setDurationDays(p.days);
                      setCustomDays(String(p.days));
                    }}
                    className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                        : 'border-[#323238] bg-[#242429] text-[#E4E4E7] hover:border-[#EAB308]/60'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={customDays}
                  onChange={(e) => {
                    setCustomDays(e.target.value);
                    const n = Number(e.target.value);
                    if (n >= 1 && n <= 90) setDurationDays(n);
                  }}
                  className="w-20 py-1.5 text-center"
                  aria-label="Dias personalizados"
                />
                <span className="text-xs text-[#A1A1AA]">dias (1–90)</span>
              </div>
            </div>
          </div>

          <GoldButton
            type="submit"
            fullWidth
            disabled={publishing || !title.trim() || !message.trim()}
          >
            <Plus className="h-4 w-4" />
            {publishing ? 'A publicar...' : 'Publicar aviso agora'}
          </GoldButton>
        </form>
      </BrandCard>

      {/* Announcements List & Read Receipts */}
      {announcements.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-6 w-6" />}
          title="Ainda sem avisos publicados"
          subtitle="Quando publicares um aviso acima, ele aparecerá no topo do portal de cada aluno com o botão Lido e poderás acompanhar aqui quem já leu."
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => {
            const isCurrentlyActive = ann.active && ann.expiresAtMillis > now;
            const reads = (readsByAnnouncement.get(ann.id) ?? []).sort(
              (a, b) => b.readAtMillis - a.readAtMillis
            );
            const readClientIds = new Set(reads.map((r) => r.clientId));
            const unreadClients = activeClients.filter((c) => !readClientIds.has(c.id));
            const totalActive = Math.max(activeClients.length, reads.length);
            const pct =
              totalActive > 0 ? Math.min(100, Math.round((reads.length / totalActive) * 100)) : 0;
            const isExpanded = expandedId === ann.id;

            return (
              <BrandCard key={ann.id} highlight={isCurrentlyActive} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={isCurrentlyActive ? 'green' : 'neutral'}>
                        {isCurrentlyActive ? 'Ativo' : 'Encerrado / Expirado'}
                      </StatusPill>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#A1A1AA]">
                        <Clock className="h-3 w-3" />
                        {ann.durationDays}d · até {formatShortDate(ann.expiresAtMillis)}
                      </span>
                    </div>
                    <h4 className="text-base font-extrabold text-[#F4F4F5]">{ann.title}</h4>
                    <p className="whitespace-pre-wrap text-sm text-[#D4D4D8]">{ann.message}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCurrentlyActive && (
                      <SecondaryButton
                        type="button"
                        disabled={busyId === ann.id}
                        onClick={async () => {
                          setBusyId(ann.id);
                          try {
                            await closeStudioAnnouncement(uid, ann.id);
                            onNotify('Aviso encerrado.');
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        className="min-h-[36px] px-3 py-1.5 text-xs"
                      >
                        <StopCircle className="h-3.5 w-3.5 text-[#F59E0B]" />
                        Encerrar
                      </SecondaryButton>
                    )}
                    <button
                      type="button"
                      disabled={busyId === ann.id}
                      onClick={async () => {
                        setBusyId(ann.id);
                        try {
                          await deleteStudioAnnouncement(uid, ann.id);
                          onNotify('Aviso apagado.');
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      title="Apagar aviso"
                      className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl border border-[#323238] bg-[#242429] text-[#A1A1AA] hover:border-[#EF4444]/60 hover:text-[#EF4444]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Read Progress */}
                <div className="space-y-1.5 rounded-xl border border-[#323238] bg-[#161619] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-bold text-[#F4F4F5]">
                      <Eye className="h-3.5 w-3.5 text-[#EAB308]" />
                      Lido por {reads.length} / {totalActive} alunos ativos ({pct}%)
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : ann.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#242429] px-2.5 py-1 text-xs font-semibold text-[#FACC15] hover:bg-[#2F2F36]"
                    >
                      <Users className="h-3.5 w-3.5" />
                      {isExpanded ? 'Ocultar lista' : 'Ver quem leu'}
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#242429]">
                    <div
                      className="h-full rounded-full bg-[#22C55E] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {isExpanded && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#2A2A30]">
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#22C55E]">
                          Leram ({reads.length})
                        </p>
                        {reads.length === 0 ? (
                          <p className="text-xs text-[#71717A]">Nenhum aluno clicou em “Lido” ainda.</p>
                        ) : (
                          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                            {reads.map((r) => (
                              <div
                                key={r.id}
                                className="flex items-center justify-between gap-2 rounded-lg bg-[#143521]/40 px-2.5 py-1.5 text-xs"
                              >
                                <span className="inline-flex items-center gap-1.5 font-semibold text-[#F4F4F5] truncate">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#22C55E]" />
                                  {r.clientName}
                                </span>
                                <span className="shrink-0 text-[10px] text-[#A1A1AA]">
                                  {formatDateTimePt(r.readAtMillis)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#F59E0B]">
                          Por ler ({unreadClients.length})
                        </p>
                        {unreadClients.length === 0 ? (
                          <p className="text-xs text-[#22C55E] font-semibold">
                            Todos os alunos ativos já leram! 🎉
                          </p>
                        ) : (
                          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                            {unreadClients.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center justify-between gap-2 rounded-lg bg-[#242429]/70 px-2.5 py-1.5 text-xs text-[#D4D4D8]"
                              >
                                <span className="truncate">{c.name}</span>
                                <span className="text-[10px] text-[#71717A]">Pendente</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </BrandCard>
            );
          })}
        </div>
      )}
    </div>
  );
};
