import React, { useState } from 'react';
import { Check, Share2, Star, Trophy, Zap } from 'lucide-react';
import { BrandCard, GoldButton, Modal, SecondaryButton, StatusPill } from './UiPrimitives';

export interface BrokenPrRecord {
  exerciseName: string;
  previousKg: number | null;
  newKg: number;
}

export interface ActiveWorkoutSummaryData {
  planId: string;
  planTitle: string;
  durationSeconds: number;
  completedSets: number;
  totalSets: number;
  completedExercises: number;
  totalExercises: number;
  totalVolumeKg: number;
  brokenPrs: BrokenPrRecord[];
}

export function formatWorkoutDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function parseRepAverage(reps: string): number {
  const matches = reps.match(/\d+/g);
  if (!matches || matches.length === 0) return 10;
  const nums = matches.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return 10;
  if (nums.length >= 2) return (nums[0] + nums[1]) / 2;
  return nums[0];
}

export function formatKgCompact(kg: number): string {
  return Math.abs(kg - Math.round(kg)) < 0.05 ? `${Math.round(kg)} kg` : `${kg.toFixed(1)} kg`;
}

export function buildWorkoutSummaryShareText(
  studentName: string,
  summary: ActiveWorkoutSummaryData
): string {
  const lines = [
    '💪 Treino Concluído — New Shape',
    `🏋️ ${summary.planTitle}`,
    `⏱ Duração: ${formatWorkoutDuration(summary.durationSeconds)}`,
    `✅ Séries: ${summary.completedSets}/${summary.totalSets} (${summary.completedExercises}/${summary.totalExercises} exercícios)`,
  ];
  if (summary.totalVolumeKg > 0) {
    lines.push(`🔥 Volume total: ${Math.round(summary.totalVolumeKg)} kg`);
  }
  if (summary.brokenPrs.length > 0) {
    lines.push('🏆 Novos Recordes (PR):');
    summary.brokenPrs.forEach((pr) => {
      const prev = pr.previousKg !== null ? ` (antes ${formatKgCompact(pr.previousKg)})` : '';
      lines.push(`  • ${pr.exerciseName}: ${formatKgCompact(pr.newKg)}${prev}`);
    });
  }
  lines.push(`Atleta: ${studentName} · #NewShape`);
  return lines.join('\n');
}

export const ActiveWorkoutHudCard: React.FC<{
  planTitle: string;
  elapsedSeconds: number;
  completedSets: number;
  totalSets: number;
  completedExercises: number;
  totalExercises: number;
  totalVolumeKg: number;
  brokenPrCount: number;
  onFinish: () => void;
}> = ({
  planTitle,
  elapsedSeconds,
  completedSets,
  totalSets,
  completedExercises,
  totalExercises,
  totalVolumeKg,
  brokenPrCount,
  onFinish,
}) => {
  const pct = totalSets > 0 ? Math.min(100, Math.round((completedSets / totalSets) * 100)) : 0;

  return (
    <BrandCard
      highlight
      className="bg-gradient-to-br from-[#272213] via-[#1B1B1E] to-[#1B1B1E] border-[#EAB308]/80 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3D3314] text-[#FACC15]">
            <Zap className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-[#FACC15]">
              Treino Ativo · {formatWorkoutDuration(elapsedSeconds)}
            </p>
            <p className="truncate text-xs text-[#A1A1AA]">{planTitle}</p>
          </div>
        </div>
        {brokenPrCount > 0 ? (
          <StatusPill tone="gold">🏆 {brokenPrCount} PR</StatusPill>
        ) : (
          <StatusPill tone="green">
            {completedSets}/{totalSets} séries
          </StatusPill>
        )}
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-[#242429]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            pct >= 100 ? 'bg-[#22C55E]' : 'bg-[#EAB308]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-[#323238] bg-[#242429] p-2">
          <p className="text-[10px] text-[#A1A1AA]">Exercícios</p>
          <p className="mt-0.5 text-sm font-extrabold text-[#F4F4F5]">
            {completedExercises}/{totalExercises}
          </p>
        </div>
        <div className="rounded-xl border border-[#323238] bg-[#242429] p-2">
          <p className="text-[10px] text-[#A1A1AA]">Séries</p>
          <p className="mt-0.5 text-sm font-extrabold text-[#22C55E]">
            {completedSets}/{totalSets}
          </p>
        </div>
        <div className="rounded-xl border border-[#323238] bg-[#242429] p-2">
          <p className="text-[10px] text-[#A1A1AA]">Volume</p>
          <p className="mt-0.5 text-sm font-extrabold text-[#FACC15]">
            {totalVolumeKg > 0 ? `${Math.round(totalVolumeKg)} kg` : '—'}
          </p>
        </div>
      </div>

      <GoldButton type="button" onClick={onFinish} className="w-full">
        <Trophy className="h-4 w-4" />
        Terminar & Ver Resumo
      </GoldButton>
    </BrandCard>
  );
};

export const ActiveWorkoutSummaryModal: React.FC<{
  summary: ActiveWorkoutSummaryData | null;
  studentName: string;
  onSendFeedback: () => void;
  onClose: () => void;
  onBanner: (msg: string) => void;
}> = ({ summary, studentName, onSendFeedback, onClose, onBanner }) => {
  const [copied, setCopied] = useState(false);

  if (!summary) return null;

  const handleShare = async () => {
    const text = buildWorkoutSummaryShareText(studentName, summary);
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'New Shape · Resumo do Treino',
          text,
        });
        return;
      }
    } catch {
      // Fall back to clipboard if user cancels or share unsupported
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onBanner('Resumo do treino copiado!');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      onBanner('Não foi possível copiar o resumo neste browser.');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Treino Concluído! 💪"
      subtitle={summary.planTitle}
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-2.5 text-center">
          <div className="rounded-xl border border-[#323238] bg-[#242429] p-3">
            <p className="text-[11px] text-[#A1A1AA]">Duração</p>
            <p className="mt-0.5 text-lg font-extrabold text-[#FACC15]">
              {formatWorkoutDuration(summary.durationSeconds)}
            </p>
          </div>
          <div className="rounded-xl border border-[#323238] bg-[#242429] p-3">
            <p className="text-[11px] text-[#A1A1AA]">Séries</p>
            <p className="mt-0.5 text-lg font-extrabold text-[#22C55E]">
              {summary.completedSets}/{summary.totalSets}
            </p>
          </div>
          <div className="rounded-xl border border-[#323238] bg-[#242429] p-3">
            <p className="text-[11px] text-[#A1A1AA]">Exercícios</p>
            <p className="mt-0.5 text-lg font-extrabold text-[#F4F4F5]">
              {summary.completedExercises}/{summary.totalExercises}
            </p>
          </div>
          <div className="rounded-xl border border-[#323238] bg-[#242429] p-3">
            <p className="text-[11px] text-[#A1A1AA]">Volume Total</p>
            <p className="mt-0.5 text-lg font-extrabold text-[#FACC15]">
              {summary.totalVolumeKg > 0
                ? `${Math.round(summary.totalVolumeKg)} kg`
                : 'Peso corporal'}
            </p>
          </div>
        </div>

        {summary.brokenPrs.length > 0 ? (
          <div className="rounded-xl border border-[#EAB308]/75 bg-[#3D3314]/45 p-3 space-y-1.5">
            <p className="text-xs font-extrabold text-[#FACC15]">
              🏆 {summary.brokenPrs.length} Novo(s) Recorde(s) Pessoal(is)!
            </p>
            {summary.brokenPrs.map((pr) => {
              const delta =
                pr.previousKg !== null && pr.newKg - pr.previousKg > 0.05
                  ? ` (+${formatKgCompact(pr.newKg - pr.previousKg)})`
                  : '';
              return (
                <p key={pr.exerciseName} className="text-xs font-bold text-[#F4F4F5]">
                  • {pr.exerciseName}: {formatKgCompact(pr.newKg)}
                  <span className="text-[#22C55E]">{delta}</span>
                </p>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-[#323238] bg-[#242429] p-3 text-xs text-[#A1A1AA]">
            Excelente consistência! Cada treino conta para a tua sequência e evolução.
          </div>
        )}

        <SecondaryButton type="button" onClick={handleShare} className="w-full">
          {copied ? <Check className="h-4 w-4 text-[#22C55E]" /> : <Share2 className="h-4 w-4" />}
          {copied ? 'Resumo copiado!' : 'Partilhar / Copiar Resumo'}
        </SecondaryButton>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <SecondaryButton type="button" onClick={onClose} className="flex-1">
            Fechar
          </SecondaryButton>
          <GoldButton type="button" onClick={onSendFeedback} className="flex-1">
            <Star className="h-4 w-4" />
            Enviar Feedback ao PT
          </GoldButton>
        </div>
      </div>
    </Modal>
  );
};
