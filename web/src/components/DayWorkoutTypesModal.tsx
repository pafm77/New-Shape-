import React, { useEffect, useState } from 'react';
import { Dumbbell, X } from 'lucide-react';
import { DAY_WORKOUT_TYPE_SUGGESTIONS } from '../types/studio';
import { GoldButton, Modal, SecondaryButton } from './UiPrimitives';

interface DayWorkoutTypesModalProps {
  open: boolean;
  weekLabel: string;
  initialEnabled: boolean;
  initialTypes: Record<string, string>;
  initialFocusDay?: number;
  onClose: () => void;
  onSave: (enabled: boolean, dayWorkoutTypes: Record<string, string>) => Promise<void> | void;
}

const WEEK_DAYS: Array<{ key: string; dayNum: number; label: string }> = [
  { key: '1', dayNum: 1, label: 'Segunda-feira' },
  { key: '2', dayNum: 2, label: 'Terça-feira' },
  { key: '3', dayNum: 3, label: 'Quarta-feira' },
  { key: '4', dayNum: 4, label: 'Quinta-feira' },
  { key: '5', dayNum: 5, label: 'Sexta-feira' },
  { key: '6', dayNum: 6, label: 'Sábado' },
  { key: '7', dayNum: 7, label: 'Domingo' },
];

export const DayWorkoutTypesModal: React.FC<DayWorkoutTypesModalProps> = ({
  open,
  weekLabel,
  initialEnabled,
  initialTypes,
  initialFocusDay = 1,
  onClose,
  onSave,
}) => {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [expandedDay, setExpandedDay] = useState<number>(initialFocusDay);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEnabled(initialEnabled);
    const next: Record<string, string> = {};
    WEEK_DAYS.forEach(({ key }) => {
      next[key] = initialTypes[key] ?? '';
    });
    setDraft(next);
    setExpandedDay(initialFocusDay >= 1 && initialFocusDay <= 7 ? initialFocusDay : 1);
  }, [open, initialEnabled, initialTypes, initialFocusDay]);

  if (!open) return null;

  const hasAnyFilled = WEEK_DAYS.some(({ key }) => (draft[key] ?? '').trim().length > 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleaned: Record<string, string> = {};
      WEEK_DAYS.forEach(({ key }) => {
        const v = (draft[key] ?? '').trim().slice(0, 60);
        if (v) cleaned[key] = v;
      });
      await onSave(enabled, cleaned);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tipo de treino por dia"
      subtitle={weekLabel}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">

        {/* Master Optional Toggle */}
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#323238] bg-[#242429] p-3.5 transition hover:border-[#EAB308]/50">
          <div className="flex items-start gap-2.5">
            <Dumbbell
              className={`mt-0.5 h-4 w-4 shrink-0 ${enabled ? 'text-[#FACC15]' : 'text-[#A1A1AA]'}`}
            />
            <div>
              <p className="text-sm font-bold text-[#F4F4F5]">Mostrar tipo de treino nos dias</p>
              <p className="mt-0.5 text-xs text-[#A1A1AA]">
                {enabled
                  ? 'Os dias preenchidos aparecem na tua agenda e aos alunos.'
                  : 'Opcional · Desativado. Nada é mostrado aos alunos nesta semana.'}
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-[#EAB308]"
          />
        </label>

        {enabled && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-[#A1A1AA]">
                Preenche apenas os dias que quiseres (opcional):
              </p>
              {hasAnyFilled && (
                <button
                  type="button"
                  onClick={() => {
                    const empty: Record<string, string> = {};
                    WEEK_DAYS.forEach(({ key }) => {
                      empty[key] = '';
                    });
                    setDraft(empty);
                  }}
                  className="text-xs font-bold text-[#EF4444] hover:underline"
                >
                  Limpar tudo
                </button>
              )}
            </div>

            <div className="max-h-[380px] space-y-2.5 overflow-y-auto pr-1">
              {WEEK_DAYS.map(({ key, dayNum, label }) => {
                const value = draft[key] ?? '';
                const isOpen = expandedDay === dayNum;
                return (
                  <div
                    key={key}
                    className={`rounded-xl border p-3 transition ${
                      value.trim()
                        ? 'border-[#EAB308]/45 bg-[#242429]'
                        : 'border-[#323238] bg-[#242429]/70'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-bold ${
                          value.trim() ? 'text-[#FACC15]' : 'text-[#F4F4F5]'
                        }`}
                      >
                        {label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedDay(isOpen ? 0 : dayNum)}
                        className="text-[11px] font-semibold text-[#EAB308] hover:underline"
                      >
                        {isOpen ? 'Ocultar sugestões' : 'Sugestões'}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        maxLength={60}
                        value={value}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [key]: e.target.value.slice(0, 60),
                          }))
                        }
                        placeholder="Ex: Pernas & Glúteos (deixa vazio se não quiseres)"
                        className="w-full rounded-xl border border-[#323238] bg-[#1B1B1E] px-3 py-2 pr-8 text-xs text-[#F4F4F5] placeholder:text-[#71717A] focus:border-[#EAB308] focus:outline-none"
                      />
                      {value && (
                        <button
                          type="button"
                          onClick={() => setDraft((prev) => ({ ...prev, [key]: '' }))}
                          aria-label={`Limpar ${label}`}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#A1A1AA] hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {isOpen && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {DAY_WORKOUT_TYPE_SUGGESTIONS.map((suggestion) => {
                          const selected =
                            value.trim().toLowerCase() === suggestion.toLowerCase();
                          return (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [key]: selected ? '' : suggestion,
                                }))
                              }
                              className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                                selected
                                  ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                                  : 'border-[#323238] bg-[#1B1B1E] text-[#D4D4D8] hover:border-[#EAB308]/60 hover:text-white'
                              }`}
                            >
                              {suggestion}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-[#323238] pt-3">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton disabled={saving} onClick={handleSave}>
            {saving ? 'A guardar...' : 'Guardar'}
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};
