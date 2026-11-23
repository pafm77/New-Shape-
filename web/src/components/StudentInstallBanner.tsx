import React, { useEffect, useState } from 'react';
import { Download, MoreVertical, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import {
  getDeferredInstallPrompt,
  isAndroidDevice,
  isIosDevice,
  isStandalonePwa,
  subscribeInstallPrompt,
  triggerNativeInstallPrompt,
} from '../services/pwaInstall';
import { GoldButton, Modal, SecondaryButton } from './UiPrimitives';

const LS_INSTALL_BANNER_DISMISSED = 'newshape_student_install_dismissed_v2';

export const StudentInstallBanner: React.FC<{
  compact?: boolean;
  onInstalled?: () => void;
}> = ({ compact = false, onInstalled }) => {
  const [standalone, setStandalone] = useState(() => isStandalonePwa());
  const [hasNativePrompt, setHasNativePrompt] = useState(() => Boolean(getDeferredInstallPrompt()));
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(LS_INSTALL_BANNER_DISMISSED) === '1';
    } catch {
      return false;
    }
  });
  const [showGuideModal, setShowGuideModal] = useState(false);

  const ios = isIosDevice();
  const android = isAndroidDevice();

  useEffect(() => {
    const sync = () => {
      setStandalone(isStandalonePwa());
      setHasNativePrompt(Boolean(getDeferredInstallPrompt()));
    };
    const unsub = subscribeInstallPrompt(sync);
    const mq = window.matchMedia('(display-mode: standalone)');
    const onMqChange = () => setStandalone(isStandalonePwa());
    mq.addEventListener?.('change', onMqChange);
    return () => {
      unsub();
      mq.removeEventListener?.('change', onMqChange);
    };
  }, []);

  if (standalone) return null;

  const handleInstallClick = async () => {
    if (hasNativePrompt) {
      const outcome = await triggerNativeInstallPrompt();
      if (outcome === 'accepted') {
        setDismissed(true);
        onInstalled?.();
        return;
      }
      if (outcome === 'dismissed') return;
    }
    setShowGuideModal(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(LS_INSTALL_BANNER_DISMISSED, '1');
    } catch {
      // ignore storage errors
    }
  };

  return (
    <>
      {!dismissed && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl border border-[#EAB308]/40 bg-gradient-to-r from-[#2A2411] via-[#1D1B14] to-[#1B1B1E] ${
            compact ? 'px-3.5 py-2.5' : 'px-4 py-3'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#EAB308]/40 bg-[#3D3314] text-[#FACC15]">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#F4F4F5] truncate">
                Adicionar App do Aluno ao ecrã principal
              </p>
              <p className="text-[11px] text-[#A1A1AA] leading-snug">
                Entra direto na tua conta de aluno com 1 toque.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#EAB308] px-3 py-1.5 text-xs font-extrabold text-[#121214] transition hover:bg-[#FACC15] active:scale-[0.98]"
            >
              <Download className="h-3.5 w-3.5" />
              Adicionar
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Fechar aviso de instalação"
              className="rounded-lg p-1 text-[#A1A1AA] hover:bg-[#242429] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Modal
        open={showGuideModal}
        title="Adicionar ao Ecrã Principal"
        onClose={() => setShowGuideModal(false)}
      >
        <div className="space-y-4 text-xs text-[#E4E4E7]">
          <p className="leading-relaxed text-[#A1A1AA]">
            Segue estes passos para criar o atalho da <strong className="text-[#FACC15]">New Shape · Aluno</strong> no teu telemóvel e entrar sempre diretamente na tua conta:
          </p>

          {ios ? (
            <ol className="space-y-2.5">
              <li className="flex items-start gap-2.5 rounded-xl border border-[#323238] bg-[#242429] p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EAB308] text-[11px] font-extrabold text-[#121214]">
                  1
                </span>
                <div className="space-y-0.5">
                  <p className="font-bold text-[#F4F4F5] flex items-center gap-1.5">
                    Toca em Partilhar <Share className="h-3.5 w-3.5 text-[#FACC15]" />
                  </p>
                  <p className="text-[#A1A1AA]">
                    No menu inferior do Safari (o quadrado com uma seta para cima). Se abriste no WhatsApp/Instagram, escolhe primeiro <strong>Abrir no Safari</strong>.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 rounded-xl border border-[#323238] bg-[#242429] p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EAB308] text-[11px] font-extrabold text-[#121214]">
                  2
                </span>
                <div className="space-y-0.5">
                  <p className="font-bold text-[#F4F4F5] flex items-center gap-1.5">
                    Escolhe &ldquo;Adicionar ao ecrã principal&rdquo;{' '}
                    <PlusSquare className="h-3.5 w-3.5 text-[#FACC15]" />
                  </p>
                  <p className="text-[#A1A1AA]">
                    Desliza a lista para baixo até encontrares esta opção.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 rounded-xl border border-[#323238] bg-[#242429] p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EAB308] text-[11px] font-extrabold text-[#121214]">
                  3
                </span>
                <div className="space-y-0.5">
                  <p className="font-bold text-[#F4F4F5]">Toca em &ldquo;Adicionar&rdquo;</p>
                  <p className="text-[#A1A1AA]">
                    O ícone da New Shape fica no teu ecrã e abre direto na tua conta de aluno!
                  </p>
                </div>
              </li>
            </ol>
          ) : (
            <ol className="space-y-2.5">
              <li className="flex items-start gap-2.5 rounded-xl border border-[#323238] bg-[#242429] p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EAB308] text-[11px] font-extrabold text-[#121214]">
                  1
                </span>
                <div className="space-y-0.5">
                  <p className="font-bold text-[#F4F4F5] flex items-center gap-1.5">
                    Abre o menu do browser <MoreVertical className="h-3.5 w-3.5 text-[#FACC15]" />
                  </p>
                  <p className="text-[#A1A1AA]">
                    {android
                      ? 'Toca nos 3 pontinhos no canto superior direito do Chrome (se abriste no WhatsApp, toca primeiro em "Abrir no Chrome").'
                      : 'Abre o menu do navegador no canto superior direito.'}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 rounded-xl border border-[#323238] bg-[#242429] p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EAB308] text-[11px] font-extrabold text-[#121214]">
                  2
                </span>
                <div className="space-y-0.5">
                  <p className="font-bold text-[#F4F4F5]">
                    Toca em &ldquo;Adicionar ao ecrã principal&rdquo; ou &ldquo;Instalar app&rdquo;
                  </p>
                  <p className="text-[#A1A1AA]">
                    Confirma em <strong>Instalar / Adicionar</strong> para guardar o atalho direto da tua conta de aluno.
                  </p>
                </div>
              </li>
            </ol>
          )}

          <div className="rounded-xl border border-[#EAB308]/30 bg-[#3D3314]/50 p-3 text-[11px] text-[#FDE68A] leading-relaxed">
            <strong>Já tinhas um atalho antigo que abria a área de PT?</strong> Apaga o ícone antigo do ecrã principal e adiciona novamente a partir deste link.
          </div>

          <div className="space-y-2 pt-1">
            {hasNativePrompt && (
              <SecondaryButton fullWidth onClick={handleInstallClick}>
                <Download className="h-4 w-4 text-[#EAB308]" />
                Instalar agora automaticamente
              </SecondaryButton>
            )}
            <GoldButton fullWidth onClick={() => setShowGuideModal(false)}>
              Entendi
            </GoldButton>
          </div>
        </div>
      </Modal>
    </>
  );
};
