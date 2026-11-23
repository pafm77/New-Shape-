export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyListeners();
  });
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export async function triggerNativeInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notifyListeners();
  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    return choice.outcome;
  } catch {
    return 'dismissed';
  }
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  );
}

export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(window.navigator.userAgent || '');
}

/**
 * Keeps the browser URL and <link id="app-manifest"> synced with the active student portal
 * so tapping "Add to Home Screen" (Android Chrome or iOS Safari) always saves a direct
 * Student shortcut (/aluno?pt=...&code=...&cid=...) and never opens the PT login area.
 */
export function syncStudentPwaUrlAndManifest(
  ptUid: string,
  portalCode: string,
  clientId?: string | null
): void {
  if (typeof window === 'undefined' || !ptUid || !portalCode) return;

  const params = new URLSearchParams({ pt: ptUid, code: portalCode });
  if (clientId) params.set('cid', clientId);

  const targetUrl = `/aluno?${params.toString()}`;
  const currentUrl = `${window.location.pathname}${window.location.search}`;
  if (currentUrl !== targetUrl) {
    try {
      window.history.replaceState(null, '', targetUrl);
    } catch {
      // ignore history errors
    }
  }

  document.title = 'New Shape · Aluno';

  const manifestParams = new URLSearchParams({
    mode: 'student',
    pt: ptUid,
    code: portalCode,
  });
  if (clientId) manifestParams.set('cid', clientId);
  const manifestHref = `/api/manifest?${manifestParams.toString()}`;

  let link = document.getElementById('app-manifest') as HTMLLinkElement | null;
  if (!link) {
    link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  }
  if (!link) {
    link = document.createElement('link');
    link.id = 'app-manifest';
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== manifestHref) {
    link.setAttribute('href', manifestHref);
  }
}

export function syncPtPwaManifest(): void {
  if (typeof window === 'undefined') return;
  document.title = 'New Shape · Painel PT';
  const manifestHref = '/api/manifest?mode=pt';
  let link = document.getElementById('app-manifest') as HTMLLinkElement | null;
  if (!link) {
    link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  }
  if (link && link.getAttribute('href') !== manifestHref) {
    link.setAttribute('href', manifestHref);
  }
}
