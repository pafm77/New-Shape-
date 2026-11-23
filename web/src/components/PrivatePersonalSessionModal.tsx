import React, { useEffect, useMemo, useState } from 'react';
import { EyeOff, Plus, Search } from 'lucide-react';
import { ClientRecord } from '../types/studio';
import { FieldLabel, GoldButton, Input, Modal, SecondaryButton } from './UiPrimitives';

interface PrivatePersonalSessionModalProps {
  open: boolean;
  clients: ClientRecord[];
  initialClientId?: string;
  initialDateMs: number;
  onClose: () => void;
  onSubmit: (payload: {
    clientId: string;
    clientName: string;
    dateMs: number;
    hour: number;
    minute: number;
    durationMinutes: number;
    note: string;
  }) => Promise<void>;
}

const DURATION_OPTIONS = [30, 45, 60, 90];

function toDateInputValue(ms: number): string {
  const d = new Date(ms || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateInputValue(val: string): number {
  const parts = val.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0).getTime();
}

export const PrivatePersonalSessionModal: React.FC<PrivatePersonalSessionModalProps> = ({
  open,
  clients,
  initialClientId,
  initialDateMs,
  onClose,
  onSubmit,
}) => {
  const sortedActiveClients = useMemo(() => {
    return clients
      .filter((c) => c.active)
      .slice()
      .sort((a, b) => {
        const aPers = a.trainingType === 'PERSONALIZADO' ? 0 : 1;
        const bPers = b.trainingType === 'PERSONALIZADO' ? 0 : 1;
        if (aPers !== bPers) return aPers - bPers;
        return a.name.localeCompare(b.name);
      });
  }, [clients]);

  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [dateStr, setDateStr] = useState(() => toDateInputValue(initialDateMs));
  const [timeStr, setTimeStr] = useState('18:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setDateStr(toDateInputValue(initialDateMs));
    setTimeStr('18:00');
    setDurationMinutes(60);
    setNote('');
    const preferred =
      (initialClientId && sortedActiveClients.find((c) => c.id === initialClientId)?.id) ||
      sortedActiveClients[0]?.id ||
      '';
    setClientId(preferred);
  }, [open, initialClientId, initialDateMs, sortedActiveClients]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedActiveClients;
    return sortedActiveClients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
    );
  }, [sortedActiveClients, search]);

  const selectedClient =
    filteredClients.find((c) => c.id === clientId) ||
    sortedActiveClients.find((c) => c.id === clientId) ||
    filteredClients[0] ||
    null;

  const handleSave = async () => {
    if (!selectedClient) return;
    const [hStr, mStr] = timeStr.split(':');
    const hour = Number.isFinite(Number(hStr)) ? Number(hStr) : 18;
    const minute = Number.isFinite(Number(mStr)) ? Number(mStr) : 0;
    setSaving(true);
    try {
      await onSubmit({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        dateMs: parseDateInputValue(dateStr),
        hour,
        minute,
        durationMinutes,
        note: note.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Marcar Treino Personalizado (Oculto)"
      subtitle="Só visível no Portal PT · Não aparece para os alunos"
      onClose={onClose}
    >
      <div className="space-y-3.5">
        <div className="flex items-start gap-2.5 rounded-xl border border-[#EAB308]/45 bg-[#3D3314]/40 px-3 py-2.5 text-xs text-[#FDE68A]">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-[#FACC15]" />
          <p>
            Este treino fica <strong>oculto no Portal do Aluno</strong> e permite marcar{' '}
            <strong>Presença (✓)</strong> ou <strong>Falta (✕)</strong> para contabilizar os
            treinos personalizados dados.
          </p>
        </div>

        <div>
          <FieldLabel>Pesquisar Aluno</FieldLabel>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome ou telemóvel..."
              className="pl-9"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Aluno ({filteredClients.length})</FieldLabel>
          <select
            value={selectedClient?.id || ''}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-xl border border-[#323238] bg-[#242429] px-3.5 py-2.5 text-sm font-semibold text-[#F4F4F5] outline-none focus:border-[#EAB308]"
          >
            {filteredClients.length === 0 ? (
              <option value="">Nenhum aluno ativo encontrado</option>
            ) : (
              filteredClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.trainingType === 'PERSONALIZADO' ? ' · Personalizado' : ' · Grupo'}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <FieldLabel>Data</FieldLabel>
            <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Hora</FieldLabel>
            <Input type="time" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} />
          </div>
        </div>

        <div>
          <FieldLabel>Duração</FieldLabel>
          <div className="grid grid-cols-4 gap-2">
            {DURATION_OPTIONS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setDurationMinutes(mins)}
                className={`min-h-[40px] rounded-xl border text-xs font-bold transition ${
                  durationMinutes === mins
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA] hover:text-white'
                }`}
              >
                {mins} min
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Nota (opcional)</FieldLabel>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: Treino personalizado · Membros inferiores"
            maxLength={200}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose} disabled={saving}>
            Cancelar
          </SecondaryButton>
          <GoldButton onClick={handleSave} disabled={saving || !selectedClient}>
            <Plus className="h-4 w-4" />
            {saving ? 'A guardar...' : 'Marcar Personalizado'}
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};
