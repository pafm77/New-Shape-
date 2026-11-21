import {
  BookingRecord,
  ClientRecord,
  PhysicalAssessmentRecord,
  TrainingSessionRecord,
  WorkoutLoadLogRecord,
  WorkoutPlanItemRecord,
  WorkoutPlanRecord,
} from '../types/studio';
import { formatPhoneDisplay, formatShortDate } from '../data/seedCatalog';
import { computeClientExercisePrs } from '../components/ExerciseProgressModal';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDelta(current: number, initial: number, unit: string, invertGood = false): string {
  const diff = Number((current - initial).toFixed(1));
  if (diff === 0) return `<span class="delta neutral">0 ${unit}</span>`;
  const sign = diff > 0 ? '+' : '';
  const good = invertGood ? diff < 0 : diff > 0;
  return `<span class="delta ${good ? 'good' : 'warn'}">${sign}${diff.toFixed(1)} ${unit}</span>`;
}

export interface StudentEvolutionReportInput {
  client: ClientRecord;
  assessments: PhysicalAssessmentRecord[];
  bookings: BookingRecord[];
  sessions: TrainingSessionRecord[];
  workoutPlans: WorkoutPlanRecord[];
  workoutPlanItems: WorkoutPlanItemRecord[];
  workoutLoadLogs: WorkoutLoadLogRecord[];
}

/**
 * Generates a branded New Shape PDF-ready HTML report in a new window and triggers Print/Save as PDF.
 */
export function openStudentEvolutionPdfReport(input: StudentEvolutionReportInput): boolean {
  const {
    client,
    assessments,
    bookings,
    workoutPlans,
    workoutPlanItems,
    workoutLoadLogs,
  } = input;

  const clientAssessments = assessments
    .filter((a) => a.clientId === client.id)
    .sort((a, b) => a.dateMillis - b.dateMillis);

  const firstAssess = clientAssessments[0] || null;
  const latestAssess = clientAssessments[clientAssessments.length - 1] || null;

  const confirmedBookings = bookings.filter(
    (b) => b.clientId === client.id && b.status === 'CONFIRMED'
  );
  const presentCount = confirmedBookings.filter((b) => b.attendanceStatus === 'PRESENT').length;
  const absentCount = confirmedBookings.filter((b) => b.attendanceStatus === 'ABSENT').length;
  const markedCount = presentCount + absentCount;
  const attendancePct = markedCount > 0 ? Math.round((presentCount / markedCount) * 100) : null;

  const prMap = computeClientExercisePrs({
    clientId: client.id,
    workoutLoadLogs,
    workoutPlans,
    workoutPlanItems,
  });
  const prList = Array.from(prMap.values()).sort((a, b) => b.prKg - a.prKg);

  const generatedDate = formatShortDate(Date.now());
  const trainingLabel =
    client.trainingType === 'PERSONALIZADO' ? 'Treino Personalizado' : 'Treino em Grupo';
  const weeklyLimitLabel =
    client.weeklySessionLimit && client.weeklySessionLimit > 0
      ? `${client.weeklySessionLimit}x / semana`
      : 'Sem limite semanal';

  const comparisonHtml = latestAssess
    ? `
    <section class="section">
      <h2>1. Evolução da Avaliação Física</h2>
      <p class="muted">
        ${
          clientAssessments.length >= 2 && firstAssess
            ? `Comparação entre <strong>${formatShortDate(firstAssess.dateMillis)}</strong> e <strong>${formatShortDate(latestAssess.dateMillis)}</strong> (${clientAssessments.length} avaliações)`
            : `Avaliação registada em <strong>${formatShortDate(latestAssess.dateMillis)}</strong>`
        }
      </p>
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-label">Peso Corporal</div>
          <div class="kpi-val">${latestAssess.weightKg.toFixed(1)} kg</div>
          ${firstAssess && clientAssessments.length >= 2 ? fmtDelta(latestAssess.weightKg, firstAssess.weightKg, 'kg', true) : ''}
        </div>
        <div class="kpi">
          <div class="kpi-label">% Massa Gorda</div>
          <div class="kpi-val">${latestAssess.bodyFatPct.toFixed(1)}%</div>
          ${firstAssess && clientAssessments.length >= 2 ? fmtDelta(latestAssess.bodyFatPct, firstAssess.bodyFatPct, '%', true) : ''}
        </div>
        <div class="kpi">
          <div class="kpi-label">% Massa Muscular</div>
          <div class="kpi-val">${latestAssess.muscleMassKg.toFixed(1)}%</div>
          ${firstAssess && clientAssessments.length >= 2 ? fmtDelta(latestAssess.muscleMassKg, firstAssess.muscleMassKg, '%', false) : ''}
        </div>
        <div class="kpi">
          <div class="kpi-label">Gordura Visceral</div>
          <div class="kpi-val">${latestAssess.visceralFat.toFixed(1)}</div>
          ${firstAssess && clientAssessments.length >= 2 ? fmtDelta(latestAssess.visceralFat, firstAssess.visceralFat, 'pts', true) : ''}
        </div>
        <div class="kpi">
          <div class="kpi-label">IMC</div>
          <div class="kpi-val">${latestAssess.bmi.toFixed(1)}</div>
          ${firstAssess && clientAssessments.length >= 2 ? fmtDelta(latestAssess.bmi, firstAssess.bmi, '', true) : ''}
        </div>
        <div class="kpi">
          <div class="kpi-label">TMB (Mifflin-St Jeor)</div>
          <div class="kpi-val">${Math.round(latestAssess.bmrKcal)} kcal</div>
          <span class="delta neutral">Metabolismo basal</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Peso</th>
            <th>% Gordura</th>
            <th>% M. Muscular</th>
            <th>Visceral</th>
            <th>IMC</th>
            <th>TMB</th>
          </tr>
        </thead>
        <tbody>
          ${clientAssessments
            .slice()
            .reverse()
            .map(
              (a) => `
              <tr>
                <td><strong>${escapeHtml(formatShortDate(a.dateMillis))}</strong></td>
                <td>${a.weightKg.toFixed(1)} kg</td>
                <td>${a.bodyFatPct.toFixed(1)}%</td>
                <td>${a.muscleMassKg.toFixed(1)}%</td>
                <td>${a.visceralFat.toFixed(1)}</td>
                <td>${a.bmi.toFixed(1)}</td>
                <td>${Math.round(a.bmrKcal)} kcal</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>`
    : `
    <section class="section">
      <h2>1. Avaliação Física</h2>
      <p class="muted">Ainda não existem avaliações físicas registadas para este aluno.</p>
    </section>`;

  const attendanceHtml = `
    <section class="section">
      <h2>2. Assiduidade & Consistência</h2>
      <div class="kpi-grid kpi-3">
        <div class="kpi">
          <div class="kpi-label">Taxa de Assiduidade</div>
          <div class="kpi-val">${attendancePct !== null ? `${attendancePct}%` : '—'}</div>
          <span class="delta neutral">${markedCount} treino(s) avaliado(s)</span>
        </div>
        <div class="kpi">
          <div class="kpi-label">Treinos Feitos</div>
          <div class="kpi-val good-txt">${presentCount}</div>
          <span class="delta good">Presenças confirmadas</span>
        </div>
        <div class="kpi">
          <div class="kpi-label">Faltas</div>
          <div class="kpi-val warn-txt">${absentCount}</div>
          <span class="delta neutral">Total confirmados: ${confirmedBookings.length}</span>
        </div>
      </div>
    </section>`;

  const prHtml = `
    <section class="section">
      <h2>3. Recordes Pessoais (PR) & Cargas de Treino</h2>
      ${
        prList.length === 0
          ? '<p class="muted">Ainda sem cargas numéricas registadas nos planos de treino.</p>'
          : `
      <table>
        <thead>
          <tr>
            <th>Exercício</th>
            <th>🏆 Recorde Pessoal (PR)</th>
            <th>Última Carga</th>
            <th>Data do PR</th>
          </tr>
        </thead>
        <tbody>
          ${prList
            .slice(0, 20)
            .map(
              (pr) => `
              <tr>
                <td><strong>${escapeHtml(pr.exerciseName)}</strong></td>
                <td><span class="pr-badge">${escapeHtml(pr.prLabel)}</span></td>
                <td>${escapeHtml(pr.latestLabel)}</td>
                <td>${pr.prDateMillis > 0 ? escapeHtml(formatShortDate(pr.prDateMillis)) : '—'}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>`
      }
    </section>`;

  const html = `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Relatório de Evolução · ${escapeHtml(client.name)} · New Shape</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #121214;
      color: #F4F4F5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      max-width: 820px;
      margin: 0 auto;
      background: #18181B;
      border: 1px solid #323238;
      border-radius: 18px;
      padding: 28px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      border-bottom: 2px solid #EAB308;
      padding-bottom: 16px;
      margin-bottom: 22px;
    }
    .brand { font-size: 22px; font-weight: 900; letter-spacing: 0.08em; color: #FACC15; }
    .brand-sub { font-size: 11px; color: #A1A1AA; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.12em; }
    .client-name { font-size: 20px; font-weight: 800; color: #FFFFFF; margin: 10px 0 4px; }
    .meta { font-size: 12px; color: #A1A1AA; }
    .pill {
      display: inline-block;
      background: #3D3314;
      border: 1px solid #EAB308;
      color: #FACC15;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 999px;
      margin-right: 6px;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      justify-content: flex-end;
    }
    .btn {
      background: #EAB308;
      color: #121214;
      border: 0;
      border-radius: 10px;
      padding: 10px 16px;
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
    }
    .section { margin-bottom: 24px; }
    h2 {
      font-size: 15px;
      font-weight: 800;
      color: #FACC15;
      margin: 0 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .muted { font-size: 12px; color: #A1A1AA; margin: 0 0 12px; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .kpi {
      background: #242429;
      border: 1px solid #323238;
      border-radius: 12px;
      padding: 12px;
    }
    .kpi-label { font-size: 11px; color: #A1A1AA; font-weight: 600; }
    .kpi-val { font-size: 20px; font-weight: 900; color: #FFFFFF; margin: 4px 0; }
    .good-txt { color: #4ADE80; }
    .warn-txt { color: #F87171; }
    .delta { font-size: 11px; font-weight: 700; }
    .delta.good { color: #4ADE80; }
    .delta.warn { color: #FBBF24; }
    .delta.neutral { color: #A1A1AA; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      background: #242429;
      border-radius: 10px;
      overflow: hidden;
    }
    th, td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid #323238;
    }
    th {
      background: #1B1B1E;
      color: #FACC15;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
    }
    .pr-badge {
      display: inline-block;
      background: #3D3314;
      color: #FACC15;
      border: 1px solid #EAB308;
      border-radius: 999px;
      padding: 2px 8px;
      font-weight: 800;
      font-size: 11px;
    }
    .footer {
      border-top: 1px solid #323238;
      padding-top: 12px;
      font-size: 11px;
      color: #71717A;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { background: #121214; padding: 0; }
      .actions { display: none !important; }
      .page { border: none; border-radius: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button class="btn" onclick="window.print()">Guardar como PDF / Imprimir</button>
  </div>
  <div class="page">
    <div class="header">
      <div>
        <div class="brand">NEW SHAPE</div>
        <div class="brand-sub">Relatório Oficial de Evolução do Aluno</div>
        <div class="client-name">${escapeHtml(client.name)}</div>
        <div class="meta">
          <span class="pill">${escapeHtml(trainingLabel)}</span>
          <span class="pill">${escapeHtml(weeklyLimitLabel)}</span>
          ${client.phone ? `<span>Tel: ${escapeHtml(formatPhoneDisplay(client.phone))}</span>` : ''}
        </div>
      </div>
      <div class="meta" style="text-align:right">
        <div><strong>Data de emissão</strong></div>
        <div>${escapeHtml(generatedDate)}</div>
      </div>
    </div>

    ${comparisonHtml}
    ${attendanceHtml}
    ${prHtml}

    <div class="footer">
      <span>New Shape · Estúdio de Treino Personalizado & Grupo</span>
      <span>Relatório gerado em ${escapeHtml(generatedDate)}</span>
    </div>
  </div>
  <script>
    setTimeout(function() { window.print(); }, 350);
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=980');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
