import React, { useMemo } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  FileText,
  Send,
  Smartphone,
} from 'lucide-react';
import { StudioSettingsRecord } from '../types/studio';
import { buildStudentPortalLink } from '../data/seedCatalog';
import {
  downloadHomeScreenGuidePdf,
  openHomeScreenGuidePdf,
} from '../services/homeScreenGuidePdf';
import {
  BrandCard,
  GoldButton,
  SecondaryButton,
  StatusPill,
} from './UiPrimitives';

interface AppInstallGuideSubTabProps {
  uid: string;
  settings: StudioSettingsRecord;
  onOpenWhatsApp: (phone: string | null, msg: string) => void;
  onBanner: (msg: string) => void;
}

const IPHONE_STEPS = [
  {
    title: 'Abre o link no Safari',
    desc: 'Usa sempre o Safari (navegador oficial do iPhone). Se abriste pelo WhatsApp, toca na bússola em baixo à direita para abrir no Safari.',
  },
  {
    title: 'Toca no botão Partilhar',
    desc: 'Na barra inferior do Safari, toca no ícone de quadrado com seta para cima (Partilhar).',
  },
  {
    title: 'Escolhe "Adicionar ao ecrã principal"',
    desc: 'Desliza o menu para baixo até encontrares "Adicionar ao ecrã principal" (símbolo +) e toca nela.',
  },
  {
    title: 'Confirma em "Adicionar"',
    desc: 'Mantém o nome "New Shape" e toca em "Adicionar" no canto superior direito. A app fica logo no ecrã principal!',
  },
];

const ANDROID_STEPS = [
  {
    title: 'Abre o link no Google Chrome',
    desc: 'Toca no link do estúdio. Se abrir dentro do WhatsApp, toca nos 3 pontinhos em cima e escolhe "Abrir no Chrome".',
  },
  {
    title: 'Abre o menu do Chrome (3 pontos)',
    desc: 'Toca nos 3 pontinhos verticais no canto superior direito do ecrã do Chrome.',
  },
  {
    title: 'Toca em "Instalar aplicação" ou "Adicionar ao ecrã principal"',
    desc: 'Seleciona "Instalar aplicação" (ou "Adicionar ao ecrã principal", consoante o modelo do telemóvel).',
  },
  {
    title: 'Confirma em "Instalar" / "Adicionar"',
    desc: 'Confirma na janela que aparece. O ícone dourado da New Shape surge no ecrã principal como uma app normal!',
  },
];

export const AppInstallGuideSubTab: React.FC<AppInstallGuideSubTabProps> = ({
  uid,
  settings,
  onOpenWhatsApp,
  onBanner,
}) => {
  const studentPortalUrl = useMemo(
    () =>
      buildStudentPortalLink(
        settings.siteBaseUrl,
        uid,
        settings.studentPortalCode
      ),
    [settings.siteBaseUrl, uid, settings.studentPortalCode]
  );

  const whatsappGuideMsg = useMemo(() => {
    return [
      'Olá! 📲 Aqui tens o link para colocares a App *New Shape* no ecrã principal do teu telemóvel:',
      studentPortalUrl,
      '',
      '🍏 *iPhone (Safari):*',
      '1. Abre o link no *Safari*',
      '2. Toca no botão *Partilhar* (quadrado com seta para cima)',
      '3. Escolhe *"Adicionar ao ecrã principal"* e toca em *Adicionar*',
      '',
      '🤖 *Android (Chrome):*',
      '1. Abre o link no *Google Chrome*',
      '2. Toca nos *3 pontinhos* no canto superior direito',
      '3. Escolhe *"Instalar aplicação"* (ou *"Adicionar ao ecrã principal"*)' ,
      '',
      'Depois entra só com o teu número de telemóvel! 💪 New Shape',
    ].join('\n');
  }, [studentPortalUrl]);

  return (
    <div className="space-y-4">
      {/* Hero PDF Card */}
      <BrandCard highlight>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#EAB308]/50 bg-[#3D3314] text-[#FACC15]">
              <FileText className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-[#F4F4F5]">
                  PDF: Colocar a App no Ecrã Principal
                </h2>
                <StatusPill tone="gold">iPhone & Android</StatusPill>
              </div>
              <p className="mt-1 text-xs text-[#D4D4D8]">
                Guia visual em PDF A4 pronto a enviar aos teus alunos pelo WhatsApp. Inclui o passo a
                passo para <strong>iPhone (Safari)</strong> e <strong>Android (Chrome)</strong> e o
                link clicável do teu estúdio.
              </p>
            </div>
          </div>
        </div>

        {/* Embedded Link Preview */}
        <div className="mt-3 rounded-xl border border-[#323238] bg-[#242429]/80 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#FACC15]">
            Link clicável incluído dentro do PDF
          </p>
          <p className="mt-1 break-all font-mono text-xs text-[#F4F4F5]">
            {studentPortalUrl}
          </p>
        </div>

        {/* Primary & Secondary Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <GoldButton
            onClick={() => {
              downloadHomeScreenGuidePdf(studentPortalUrl);
              onBanner('PDF "Colocar App no Ecrã Principal" descarregado!');
            }}
          >
            <Download className="h-4 w-4" />
            Descarregar PDF (iPhone & Android)
          </GoldButton>

          <SecondaryButton
            onClick={() => {
              const ok = openHomeScreenGuidePdf(studentPortalUrl);
              if (!ok) {
                downloadHomeScreenGuidePdf(studentPortalUrl);
                onBanner('PDF descarregado (ativa pop-ups para pré-visualizar).');
              }
            }}
          >
            <ExternalLink className="h-4 w-4 text-[#EAB308]" />
            Abrir / Pré-visualizar PDF
          </SecondaryButton>

          <SecondaryButton
            onClick={() => {
              onOpenWhatsApp(null, whatsappGuideMsg);
              onBanner('WhatsApp aberto com as instruções e link do aluno!');
            }}
          >
            <Send className="h-4 w-4 text-[#22C55E]" />
            Enviar instruções no WhatsApp
          </SecondaryButton>

          <SecondaryButton
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(studentPortalUrl);
                onBanner('Link direto do aluno copiado!');
              } catch {
                onBanner('Não foi possível copiar automaticamente.');
              }
            }}
          >
            <Copy className="h-4 w-4" />
            Copiar Link
          </SecondaryButton>
        </div>
      </BrandCard>

      {/* Visual Step Preview: iPhone & Android side-by-side */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* iPhone Card */}
        <BrandCard>
          <div className="flex items-center justify-between gap-2 border-b border-[#323238] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3D3314] text-[#FACC15]">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#F4F4F5]">iPhone (iOS)</h3>
                <p className="text-[11px] font-semibold text-[#FACC15]">Navegador Safari</p>
              </div>
            </div>
            <StatusPill tone="gold">4 passos</StatusPill>
          </div>
          <ol className="mt-3 space-y-3">
            {IPHONE_STEPS.map((s, idx) => (
              <li key={s.title} className="flex items-start gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EAB308] text-xs font-extrabold text-[#121214]">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#F4F4F5]">{s.title}</p>
                  <p className="mt-0.5 text-xs text-[#A1A1AA]">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </BrandCard>

        {/* Android Card */}
        <BrandCard>
          <div className="flex items-center justify-between gap-2 border-b border-[#323238] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#143524] text-[#22C55E]">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#F4F4F5]">Android</h3>
                <p className="text-[11px] font-semibold text-[#22C55E]">Google Chrome</p>
              </div>
            </div>
            <StatusPill tone="green">4 passos</StatusPill>
          </div>
          <ol className="mt-3 space-y-3">
            {ANDROID_STEPS.map((s, idx) => (
              <li key={s.title} className="flex items-start gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C55E] text-xs font-extrabold text-[#0B1F14]">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#F4F4F5]">{s.title}</p>
                  <p className="mt-0.5 text-xs text-[#A1A1AA]">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </BrandCard>
      </div>
    </div>
  );
};
