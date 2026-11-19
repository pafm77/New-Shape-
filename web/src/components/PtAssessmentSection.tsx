import React, { useMemo, useState } from 'react';
import { Plus, Scale, Trash2 } from 'lucide-react';
import { ClientRecord, PhysicalAssessmentRecord } from '../types/studio';
import {
  bmiClassification,
  calculateBmi,
  calculateBmrMifflinStJeor,
  formatShortDate,
} from '../data/seedCatalog';
import * as repo from '../services/firestoreRepository';
import {
  BrandCard,
  EmptyState,
  FieldLabel,
  GoldButton,
  Input,
  Modal,
  SecondaryButton,
  StatusPill,
  Textarea,
} from './UiPrimitives';

type MetricKey = 'weightKg' | 'bmi' | 'bodyFatPct' | 'muscleMassKg' | 'visceralFat' | 'bmrKcal';

const METRICS: { key: MetricKey; label: string; unit: string; decimals: number }[] = [
  { key: 'weightKg', label: 'Peso', unit: 'kg', decimals: 1 },
  { key: 'bmi', label: 'IMC', unit: '', decimals: 1 },
  { key: 'bodyFatPct', label: 'MG', unit: '%', decimals: 1 },
  { key: 'muscleMassKg', label: 'MM', unit: 'kg', decimals: 1 },
  { key: 'visceralFat', label: 'GV', unit: '', decimals: 1 },
  { key: 'bmrKcal', label: 'TMB', unit: 'kcal', decimals: 0 },
];

export const PtAssessmentSection: React.FC<{
  uid: string;
  clients: ClientRecord[];
  assessments: PhysicalAssessmentRecord[];
  onBanner: (msg: string) => void;
}> = ({ uid, clients, assessments, onBanner }) => {
  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);
  const [selectedClientId, setSelectedClientId] = useState(activeClients[0]?.id || '');
  const effectiveClient =
    activeClients.find((c) => c.id === selectedClientId) || activeClients[0] || null;
  const [showNewModal, setShowNewModal] = useState(false);

  const clientAssessments = useMemo(
    () =>
      effectiveClient
        ? assessments
            .filter((a) => a.clientId === effectiveClient.id)
            .sort((a, b) => a.dateMillis - b.dateMillis)
        : [],
    [assessments, effectiveClient]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#F4F4F5]">Avaliação Física</h2>
          <p className="text-xs text-[#A1A1AA]">
            Composição corporal, IMC e TMB automáticos + gráfico de evolução
          </p>
        </div>
        <GoldButton disabled={!effectiveClient} onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4" />
          Nova Avaliação
        </GoldButton>
      </div>

      <BrandCard>
        <FieldLabel>Aluno</FieldLabel>
        <select
          value={effectiveClient?.id || ''}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="w-full rounded-xl border border-[#323238] bg-[#242429] px-3.5 py-2.5 text-sm text-[#F4F4F5] outline-none focus:border-[#EAB308]"
        >
          {activeClients.length === 0 ? (
            <option value="">Sem alunos ativos</option>
          ) : (
            activeClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))
          )}
        </select>
      </BrandCard>

      <AssessmentDashboard
        assessments={clientAssessments}
        onDelete={async (id) => {
          await repo.deletePhysicalAssessment(uid, id);
          onBanner('Avaliação apagada.');
        }}
      />

      {showNewModal && effectiveClient && (
        <NewAssessmentModal
          clientName={effectiveClient.name}
          latest={clientAssessments[clientAssessments.length - 1] || null}
          onClose={() => setShowNewModal(false)}
          onSave={async (payload) => {
            await repo.addPhysicalAssessment(uid, {
              clientId: effectiveClient.id,
              dateMillis: Date.now(),
              ...payload,
            });
            setShowNewModal(false);
            onBanner('Avaliação física guardada!');
          }}
        />
      )}
    </div>
  );
};

export const AssessmentDashboard: React.FC<{
  assessments: PhysicalAssessmentRecord[];
  onDelete?: (id: string) => void;
}> = ({ assessments, onDelete }) => {
  if (assessments.length === 0) {
    return (
      <EmptyState
        icon={<Scale className="h-6 w-6" />}
        title="Sem avaliações físicas ainda"
        subtitle="Regista a primeira avaliação para calcular IMC, TMB e gerar o gráfico de evolução."
      />
    );
  }

  const latest = assessments[assessments.length - 1];
  const prev = assessments.length > 1 ? assessments[assessments.length - 2] : null;

  const delta = (curr: number, old?: number, unit = '', decimals = 1) => {
    if (old === undefined) return null;
    const diff = curr - old;
    if (Math.abs(diff) < 0.05) return '=';
    const sign = diff > 0 ? '+' : '';
    const num = decimals === 0 ? diff.toFixed(0) : diff.toFixed(1);
    return unit ? `${sign}${num} ${unit}` : `${sign}${num}`;
  };

  return (
    <div className="space-y-4">
      <BrandCard highlight>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[#FACC15]">Última Avaliação</h3>
            <p className="text-xs text-[#A1A1AA]">Data: {formatShortDate(latest.dateMillis)}</p>
          </div>
          <StatusPill tone="gold">{bmiClassification(latest.bmi)}</StatusPill>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <MetricTile
            label="Peso"
            value={`${latest.weightKg.toFixed(1)} kg`}
            delta={delta(latest.weightKg, prev?.weightKg, 'kg')}
          />
          <MetricTile label="Idade" value={`${latest.ageYears} anos`} delta={null} />
          <MetricTile label="Altura" value={`${latest.heightCm.toFixed(0)} cm`} delta={null} />
          <MetricTile
            label="Massa Gorda (MG)"
            value={`${latest.bodyFatPct.toFixed(1)}%`}
            delta={delta(latest.bodyFatPct, prev?.bodyFatPct, '%')}
          />
          <MetricTile
            label="Massa Muscular (MM)"
            value={`${latest.muscleMassKg.toFixed(1)} kg`}
            delta={delta(latest.muscleMassKg, prev?.muscleMassKg, 'kg')}
          />
          <MetricTile
            label="Gord. Visceral (GV)"
            value={latest.visceralFat.toFixed(1)}
            delta={delta(latest.visceralFat, prev?.visceralFat, '')}
          />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <MetricTile
            label="IMC (Automático)"
            value={latest.bmi.toFixed(1)}
            delta={delta(latest.bmi, prev?.bmi, '')}
            highlight
          />
          <MetricTile
            label="TMB (Automático)"
            value={`${latest.bmrKcal.toFixed(0)} kcal`}
            delta={delta(latest.bmrKcal, prev?.bmrKcal, 'kcal', 0)}
            highlight
          />
        </div>
      </BrandCard>

      <EvolutionChartCard assessments={assessments} />

      <div className="space-y-2.5">
        <h3 className="text-base font-bold text-[#F4F4F5]">Histórico ({assessments.length})</h3>
        {assessments
          .slice()
          .reverse()
          .map((item) => (
            <BrandCard key={item.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[#FACC15]">
                    {formatShortDate(item.dateMillis)}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-[#F4F4F5]">
                    {item.weightKg.toFixed(1)} kg · IMC {item.bmi.toFixed(1)} · TMB{' '}
                    {item.bmrKcal.toFixed(0)} kcal
                  </p>
                  <p className="mt-1 text-xs text-[#A1A1AA]">
                    MG {item.bodyFatPct.toFixed(1)}% · MM {item.muscleMassKg.toFixed(1)} kg · GV{' '}
                    {item.visceralFat.toFixed(1)} · {item.ageYears}a / {item.heightCm.toFixed(0)} cm
                  </p>
                  {item.notes && <p className="mt-1 text-xs text-[#F4F4F5]">{item.notes}</p>}
                </div>
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="rounded-lg p-1.5 text-[#EF4444] hover:bg-[#3B1518]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </BrandCard>
          ))}
      </div>
    </div>
  );
};

const MetricTile: React.FC<{
  label: string;
  value: string;
  delta: string | null;
  highlight?: boolean;
}> = ({ label, value, delta, highlight = false }) => (
  <div
    className={`rounded-xl border p-2.5 ${
      highlight ? 'border-[#EAB308] bg-[#3D3314]' : 'border-[#323238] bg-[#242429]'
    }`}
  >
    <p className={`text-[11px] ${highlight ? 'text-[#FACC15]' : 'text-[#A1A1AA]'}`}>{label}</p>
    <p className="text-sm font-extrabold text-[#F4F4F5]">{value}</p>
    {delta && <p className="text-[11px] font-semibold text-[#EAB308]">{delta}</p>}
  </div>
);

const EvolutionChartCard: React.FC<{ assessments: PhysicalAssessmentRecord[] }> = ({
  assessments,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('weightKg');
  const metric = METRICS.find((m) => m.key === selectedMetric) || METRICS[0];
  const values = assessments.map((a) => Number(a[metric.key]));

  const firstVal = values[0] ?? 0;
  const lastVal = values[values.length - 1] ?? 0;
  const diff = lastVal - firstVal;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const pad = Math.max((maxVal - minVal) * 0.15, 1);
  const yMin = Math.max(0, minVal - pad);
  const yMax = maxVal + pad;
  const span = Math.max(yMax - yMin, 0.1);

  const fmt = (v: number) => {
    const n = metric.decimals === 0 ? v.toFixed(0) : v.toFixed(1);
    return metric.unit ? `${n} ${metric.unit}` : n;
  };

  const w = 600;
  const h = 160;
  const px = 20;
  const py = 18;
  const plotW = w - px * 2;
  const plotH = h - py * 2;

  const points = values.map((v, idx) => {
    const x = values.length === 1 ? px + plotW / 2 : px + (plotW * idx) / (values.length - 1);
    const norm = Math.max(0, Math.min(1, (v - yMin) / span));
    const y = py + plotH * (1 - norm);
    return { x, y, val: v, date: assessments[idx].dateMillis };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    points.length >= 2
      ? `${linePath} L ${points[points.length - 1].x} ${py + plotH} L ${points[0].x} ${
          py + plotH
        } Z`
      : '';

  return (
    <BrandCard>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-[#F4F4F5]">Gráfico de Evolução</h3>
        {assessments.length >= 2 && (
          <StatusPill tone="gold">
            {diff > 0 ? '+' : ''}
            {metric.decimals === 0 ? diff.toFixed(0) : diff.toFixed(1)} {metric.unit}
          </StatusPill>
        )}
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setSelectedMetric(m.key)}
            className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold ${
              selectedMetric === m.key
                ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex justify-between text-[11px] text-[#A1A1AA]">
        <span>Máx: {fmt(maxVal)}</span>
        <span>Mín: {fmt(minVal)}</span>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-40 w-full overflow-visible">
        <defs>
          <linearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EAB308" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#EAB308" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => {
          const y = py + plotH * t;
          return (
            <line
              key={t}
              x1={px}
              y1={y}
              x2={px + plotW}
              y2={y}
              stroke="#323238"
              strokeWidth="1"
            />
          );
        })}
        {areaPath && <path d={areaPath} fill="url(#goldArea)" />}
        {points.length >= 2 && (
          <path
            d={linePath}
            fill="none"
            stroke="#EAB308"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {points.map((pt, i) => {
          const isLast = i === points.length - 1;
          return (
            <g key={i}>
              <circle cx={pt.x} cy={pt.y} r={isLast ? 7 : 5} fill="#121214" />
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isLast ? 5 : 3.5}
                fill={isLast ? '#FACC15' : '#EAB308'}
              />
              <title>
                {formatShortDate(pt.date)}: {fmt(pt.val)}
              </title>
            </g>
          );
        })}
      </svg>

      <div className="mt-1 flex justify-between text-xs">
        <span className="text-[#A1A1AA]">
          {formatShortDate(assessments[0].dateMillis)}: {fmt(firstVal)}
        </span>
        <span className="font-bold text-[#FACC15]">
          Atual ({formatShortDate(assessments[assessments.length - 1].dateMillis)}): {fmt(lastVal)}
        </span>
      </div>
    </BrandCard>
  );
};

const NewAssessmentModal: React.FC<{
  clientName: string;
  latest: PhysicalAssessmentRecord | null;
  onClose: () => void;
  onSave: (payload: {
    weightKg: number;
    ageYears: number;
    heightCm: number;
    sex: 'M' | 'F';
    bodyFatPct: number;
    muscleMassKg: number;
    visceralFat: number;
    notes: string;
  }) => Promise<void>;
}> = ({ clientName, latest, onClose, onSave }) => {
  const [sex, setSex] = useState<'M' | 'F'>(latest?.sex || 'M');
  const [weight, setWeight] = useState(latest ? String(latest.weightKg) : '70');
  const [age, setAge] = useState(latest ? String(latest.ageYears) : '28');
  const [height, setHeight] = useState(latest ? String(latest.heightCm) : '175');
  const [fat, setFat] = useState(latest ? String(latest.bodyFatPct) : '18');
  const [muscle, setMuscle] = useState(latest ? String(latest.muscleMassKg) : '32');
  const [visceral, setVisceral] = useState(latest ? String(latest.visceralFat) : '5');
  const [notes, setNotes] = useState('');

  const w = Number(weight) || 0;
  const a = Number(age) || 0;
  const h = Number(height) || 0;
  const liveBmi = calculateBmi(w, h);
  const liveBmr = calculateBmrMifflinStJeor(w, h, a, sex);
  const canSave = w >= 20 && w <= 500 && a >= 5 && a <= 120 && h >= 50 && h <= 260;

  return (
    <Modal open title={`Nova Avaliação · ${clientName}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <FieldLabel>Sexo (para cálculo automático do TMB)</FieldLabel>
          <div className="flex gap-2">
            {[
              { code: 'M' as const, label: 'Masculino' },
              { code: 'F' as const, label: 'Feminino' },
            ].map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => setSex(s.code)}
                className={`flex-1 rounded-xl border py-2 text-xs font-bold ${
                  sex === s.code
                    ? 'border-[#EAB308] bg-[#EAB308] text-[#121214]'
                    : 'border-[#323238] bg-[#242429] text-[#A1A1AA]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Peso (kg)</FieldLabel>
            <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Idade</FieldLabel>
            <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Altura (cm)</FieldLabel>
            <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Massa Gorda (%)</FieldLabel>
            <Input type="number" step="0.1" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Massa Muscular (kg)</FieldLabel>
            <Input type="number" step="0.1" value={muscle} onChange={(e) => setMuscle(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Gordura Visceral (GV)</FieldLabel>
            <Input type="number" step="0.1" value={visceral} onChange={(e) => setVisceral(e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl border border-[#EAB308] bg-[#3D3314] p-3">
          <p className="text-[11px] font-semibold text-[#FACC15]">Calculado automaticamente</p>
          <div className="mt-1 flex items-center justify-between text-xs font-bold">
            <span className="text-[#F4F4F5]">
              IMC: {liveBmi > 0 ? liveBmi.toFixed(1) : '—'} ({bmiClassification(liveBmi)})
            </span>
            <span className="text-[#FACC15]">
              TMB: {liveBmr > 0 ? `${liveBmr.toFixed(0)} kcal` : '—'}
            </span>
          </div>
        </div>

        <div>
          <FieldLabel>Notas / Observações (opcional)</FieldLabel>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <GoldButton
            disabled={!canSave}
            onClick={() =>
              onSave({
                weightKg: w,
                ageYears: a,
                heightCm: h,
                sex,
                bodyFatPct: Number(fat) || 0,
                muscleMassKg: Number(muscle) || 0,
                visceralFat: Number(visceral) || 0,
                notes,
              })
            }
          >
            Guardar Avaliação
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};
