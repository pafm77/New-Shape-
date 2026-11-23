function sanitizeParam(val, maxLen = 128) {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim().slice(0, maxLen);
  return /^[a-zA-Z0-9_-]+$/.test(trimmed) ? trimmed : '';
}

export default function handler(req, res) {
  const query = req.query || {};
  const mode = typeof query.mode === 'string' ? query.mode.trim().toLowerCase() : '';
  const pt = sanitizeParam(Array.isArray(query.pt) ? query.pt[0] : query.pt);
  const code = sanitizeParam(Array.isArray(query.code) ? query.code[0] : query.code);
  const cid = sanitizeParam(Array.isArray(query.cid) ? query.cid[0] : query.cid);

  let id = '/';
  let name = 'New Shape · Treinos, Nutrição & Marcações';
  let shortName = 'New Shape';
  let startUrl = '/';

  if (mode === 'student' && pt && code) {
    const params = new URLSearchParams({ pt, code });
    if (cid) params.set('cid', cid);
    id = `/aluno?pt=${encodeURIComponent(pt)}`;
    name = 'New Shape · Aluno';
    shortName = 'New Shape';
    startUrl = `/aluno?${params.toString()}`;
  } else if (mode === 'pt') {
    id = '/painel';
    name = 'New Shape · Painel PT';
    shortName = 'New Shape PT';
    startUrl = '/painel';
  }

  const manifest = {
    id,
    name,
    short_name: shortName,
    description: 'Treinos, marcações, nutrição, avaliações físicas e chat — New Shape.',
    start_url: startUrl,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#121214',
    theme_color: '#121214',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/app-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(200).send(JSON.stringify(manifest, null, 2));
}
