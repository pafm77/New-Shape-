/**
 * Generates a crisp, branded A4 PDF 1.4 guide ("Como colocar a App New Shape no Ecrã Principal")
 * for iPhone (Safari) and Android (Chrome), embedding the studio's direct Student Portal URL
 * as a clickable PDF Link Annotation (/Subtype /Link) with full Portuguese WinAnsiEncoding.
 */

const PAGE_W = 595.28; // A4 width in points
const PAGE_H = 841.89; // A4 height in points

/** Encode a UTF-8 string into a PDF WinAnsiEncoding literal string `(...)`. */
function pdfStr(text: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x2013) {
      bytes.push(0x96); // en-dash –
    } else if (code === 0x2014) {
      bytes.push(0x97); // em-dash —
    } else if (code === 0x2022) {
      bytes.push(0x95); // bullet •
    } else if (code === 0x201c) {
      bytes.push(0x93);
    } else if (code === 0x201d) {
      bytes.push(0x94);
    } else if (code === 0x2018) {
      bytes.push(0x91);
    } else if (code === 0x2019) {
      bytes.push(0x92);
    } else if (code === 0x2026) {
      bytes.push(0x85); // ellipsis …
    } else if (code >= 32 && code <= 255) {
      bytes.push(code);
    } else {
      bytes.push(0x3f); // '?'
    }
  }

  let out = '(';
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) {
      out += '\\' + String.fromCharCode(b);
    } else if (b < 32 || b > 126) {
      out += '\\' + b.toString(8).padStart(3, '0');
    } else {
      out += String.fromCharCode(b);
    }
  }
  out += ')';
  return out;
}

function rgbFill(r: number, g: number, b: number): string {
  return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`;
}

function rgbStroke(r: number, g: number, b: number): string {
  return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} RG`;
}

/** Convert top-down Y (from top of page) to PDF bottom-up Y. */
function py(topY: number): number {
  return PAGE_H - topY;
}

/** Draw a rounded rectangle path in PDF coordinates (top-down x, y, w, h). */
function roundedRectPath(x: number, topY: number, w: number, h: number, r: number): string {
  const rad = Math.min(r, w / 2, h / 2);
  const k = rad * 0.55228475;
  const x0 = x;
  const x1 = x + w;
  const yBottom = py(topY + h);
  const yTop = py(topY);
  return [
    `${(x0 + rad).toFixed(2)} ${yBottom.toFixed(2)} m`,
    `${(x1 - rad).toFixed(2)} ${yBottom.toFixed(2)} l`,
    `${(x1 - rad + k).toFixed(2)} ${yBottom.toFixed(2)} ${x1.toFixed(2)} ${(yBottom + rad - k).toFixed(2)} ${x1.toFixed(2)} ${(yBottom + rad).toFixed(2)} c`,
    `${x1.toFixed(2)} ${(yTop - rad).toFixed(2)} l`,
    `${x1.toFixed(2)} ${(yTop - rad + k).toFixed(2)} ${(x1 - rad + k).toFixed(2)} ${yTop.toFixed(2)} ${(x1 - rad).toFixed(2)} ${yTop.toFixed(2)} c`,
    `${(x0 + rad).toFixed(2)} ${yTop.toFixed(2)} l`,
    `${(x0 + rad - k).toFixed(2)} ${yTop.toFixed(2)} ${x0.toFixed(2)} ${(yTop - rad + k).toFixed(2)} ${x0.toFixed(2)} ${(yTop - rad).toFixed(2)} c`,
    `${x0.toFixed(2)} ${(yBottom + rad).toFixed(2)} l`,
    `${x0.toFixed(2)} ${(yBottom + rad - k).toFixed(2)} ${(x0 + rad - k).toFixed(2)} ${yBottom.toFixed(2)} ${(x0 + rad).toFixed(2)} ${yBottom.toFixed(2)} c`,
    'h',
  ].join('\n');
}

function drawText(
  ops: string[],
  text: string,
  x: number,
  topY: number,
  size: number,
  font: 'F1' | 'F2' = 'F1',
  color: [number, number, number] = [24, 24, 27]
): void {
  ops.push(
    'BT',
    rgbFill(color[0], color[1], color[2]),
    `/${font} ${size.toFixed(1)} Tf`,
    `1 0 0 1 ${x.toFixed(2)} ${py(topY).toFixed(2)} Tm`,
    `${pdfStr(text)} Tj`,
    'ET'
  );
}

/** Word-wrap helper using approximate Helvetica character widths. */
function wrapText(text: string, maxWidthPt: number, fontSize: number, bold = false): string[] {
  const avgChar = fontSize * (bold ? 0.54 : 0.49);
  const maxChars = Math.max(14, Math.floor(maxWidthPt / avgChar));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      if (word.length <= maxChars) {
        current = word;
      } else {
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
      }
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      if (word.length <= maxChars) {
        current = word;
      } else {
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
        current = '';
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCircleBadge(
  ops: string[],
  cx: number,
  cyTop: number,
  radius: number,
  fill: [number, number, number],
  label: string,
  textColor: [number, number, number]
): void {
  const k = radius * 0.55228475;
  const cy = py(cyTop);
  ops.push(
    rgbFill(fill[0], fill[1], fill[2]),
    `${(cx + radius).toFixed(2)} ${cy.toFixed(2)} m`,
    `${(cx + radius).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx + k).toFixed(2)} ${(cy + radius).toFixed(2)} ${cx.toFixed(2)} ${(cy + radius).toFixed(2)} c`,
    `${(cx - k).toFixed(2)} ${(cy + radius).toFixed(2)} ${(cx - radius).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx - radius).toFixed(2)} ${cy.toFixed(2)} c`,
    `${(cx - radius).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx - k).toFixed(2)} ${(cy - radius).toFixed(2)} ${cx.toFixed(2)} ${(cy - radius).toFixed(2)} c`,
    `${(cx + k).toFixed(2)} ${(cy - radius).toFixed(2)} ${(cx + radius).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx + radius).toFixed(2)} ${cy.toFixed(2)} c`,
    'f'
  );
  drawText(ops, label, cx - 3.2, cyTop + 3.6, 10.5, 'F2', textColor);
}

/** Vector icon: iOS Safari Share icon (box with upward arrow). */
function drawSafariShareIcon(ops: string[], x: number, topY: number, size: number): void {
  const s = size;
  ops.push('q', rgbStroke(234, 179, 8), '1.5 w', '1 J', '1 j');
  // Open-top box
  const bx0 = x + s * 0.16;
  const bx1 = x + s * 0.84;
  const byTop = py(topY + s * 0.42);
  const byBot = py(topY + s * 0.92);
  ops.push(
    `${(x + s * 0.34).toFixed(2)} ${byTop.toFixed(2)} m`,
    `${bx0.toFixed(2)} ${byTop.toFixed(2)} l`,
    `${bx0.toFixed(2)} ${byBot.toFixed(2)} l`,
    `${bx1.toFixed(2)} ${byBot.toFixed(2)} l`,
    `${bx1.toFixed(2)} ${byTop.toFixed(2)} l`,
    `${(x + s * 0.66).toFixed(2)} ${byTop.toFixed(2)} l`,
    'S'
  );
  // Upward arrow
  const mx = x + s * 0.5;
  const ayTop = py(topY + s * 0.1);
  const ayBot = py(topY + s * 0.62);
  ops.push(
    `${mx.toFixed(2)} ${ayBot.toFixed(2)} m`,
    `${mx.toFixed(2)} ${ayTop.toFixed(2)} l`,
    `${(mx - s * 0.18).toFixed(2)} ${(ayTop - s * 0.18).toFixed(2)} m`,
    `${mx.toFixed(2)} ${ayTop.toFixed(2)} l`,
    `${(mx + s * 0.18).toFixed(2)} ${(ayTop - s * 0.18).toFixed(2)} l`,
    'S',
    'Q'
  );
}

/** Vector icon: Android Chrome 3 vertical dots menu. */
function drawChromeDotsIcon(ops: string[], x: number, topY: number, size: number): void {
  const cx = x + size * 0.5;
  const r = size * 0.1;
  const ys = [topY + size * 0.22, topY + size * 0.5, topY + size * 0.78];
  for (const cyTop of ys) {
    const cy = py(cyTop);
    const k = r * 0.552;
    ops.push(
      rgbFill(34, 197, 94),
      `${(cx + r).toFixed(2)} ${cy.toFixed(2)} m`,
      `${(cx + r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx + k).toFixed(2)} ${(cy + r).toFixed(2)} ${cx.toFixed(2)} ${(cy + r).toFixed(2)} c`,
      `${(cx - k).toFixed(2)} ${(cy + r).toFixed(2)} ${(cx - r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx - r).toFixed(2)} ${cy.toFixed(2)} c`,
      `${(cx - r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx - k).toFixed(2)} ${(cy - r).toFixed(2)} ${cx.toFixed(2)} ${(cy - r).toFixed(2)} c`,
      `${(cx + k).toFixed(2)} ${(cy - r).toFixed(2)} ${(cx + r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx + r).toFixed(2)} ${cy.toFixed(2)} c`,
      'f'
    );
  }
}

/** Build the complete PDF binary bytes for the Home Screen Install Guide. */
export function buildHomeScreenGuidePdfBytes(portalUrl: string): Uint8Array {
  const cleanUrl = (portalUrl || 'https://newshape.vercel.app').trim();
  const ops: string[] = [];

  // Subtle light-warm page background
  ops.push(rgbFill(248, 248, 250), `0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)} re f`);

  // --- TOP BRANDED DARK HEADER BANNER ---
  const headerH = 126;
  ops.push(
    rgbFill(18, 18, 20),
    `0 ${py(headerH).toFixed(2)} ${PAGE_W.toFixed(2)} ${headerH.toFixed(2)} re f`
  );
  // Gold accent bar along bottom of header
  ops.push(
    rgbFill(234, 179, 8),
    `0 ${py(headerH + 4).toFixed(2)} ${PAGE_W.toFixed(2)} 4 re f`
  );

  // Badge "NEW SHAPE · GUIA DO ALUNO"
  ops.push(rgbFill(61, 51, 20), roundedRectPath(36, 22, 176, 20, 10), 'f');
  drawText(ops, 'NEW SHAPE  •  GUIA RÁPIDO', 48, 35.5, 9.5, 'F2', [250, 204, 21]);

  // Title & Subtitle
  drawText(ops, 'Colocar a App no Ecrã Principal', 36, 68, 23, 'F2', [255, 255, 255]);
  drawText(
    ops,
    'Acede aos teus treinos, agenda, nutrição e avaliações com 1 toque — no iPhone e Android.',
    36,
    92,
    10.5,
    'F1',
    [212, 212, 216]
  );
  drawText(
    ops,
    'Sem precisar de App Store nem Play Store  •  Demora menos de 30 segundos',
    36,
    110,
    9.5,
    'F2',
    [250, 204, 21]
  );

  // --- DIRECT LINK CARD (CLICKABLE) ---
  const linkCardX = 36;
  const linkCardY = 148;
  const linkCardW = PAGE_W - 72;
  const linkCardH = 74;

  ops.push(
    rgbFill(255, 251, 235),
    rgbStroke(234, 179, 8),
    '1.4 w',
    roundedRectPath(linkCardX, linkCardY, linkCardW, linkCardH, 12),
    'B'
  );

  drawText(
    ops,
    'PASSO 0 — ABRE O LINK DIRETO DO ESTÚDIO NO TELEMÓVEL',
    linkCardX + 16,
    linkCardY + 21,
    9.5,
    'F2',
    [161, 98, 7]
  );
  drawText(
    ops,
    'Toca no link abaixo (ou abre-o no Safari no iPhone / Chrome no Android):',
    linkCardX + 16,
    linkCardY + 37,
    9.5,
    'F1',
    [63, 63, 70]
  );

  // Link pill box
  const urlBoxX = linkCardX + 16;
  const urlBoxY = linkCardY + 44;
  const urlBoxW = linkCardW - 32;
  const urlBoxH = 22;
  ops.push(
    rgbFill(24, 24, 27),
    roundedRectPath(urlBoxX, urlBoxY, urlBoxW, urlBoxH, 7),
    'f'
  );
  const displayUrl = cleanUrl.length > 74 ? cleanUrl.slice(0, 71) + '...' : cleanUrl;
  drawText(ops, displayUrl, urlBoxX + 10, urlBoxY + 14.5, 9.2, 'F2', [250, 204, 21]);

  // --- TWO COLUMNS: IPHONE (LEFT) & ANDROID (RIGHT) ---
  const colGap = 16;
  const colW = (PAGE_W - 72 - colGap) / 2;
  const leftX = 36;
  const rightX = 36 + colW + colGap;
  const cardsY = 238;
  const cardsH = 446;

  // LEFT CARD: iPhone (Safari)
  ops.push(
    rgbFill(255, 255, 255),
    rgbStroke(228, 228, 231),
    '1 w',
    roundedRectPath(leftX, cardsY, colW, cardsH, 14),
    'B'
  );
  // Card header strip
  ops.push(
    rgbFill(24, 24, 27),
    roundedRectPath(leftX, cardsY, colW, 56, 14),
    'f',
    // Square off bottom corners of header strip
    `${leftX.toFixed(2)} ${py(cardsY + 56).toFixed(2)} ${colW.toFixed(2)} 14 re f`
  );
  drawSafariShareIcon(ops, leftX + colW - 42, cardsY + 14, 26);
  drawText(ops, 'iPhone (iOS)', leftX + 16, cardsY + 26, 14, 'F2', [255, 255, 255]);
  drawText(ops, 'Usar o navegador Safari', leftX + 16, cardsY + 44, 9.5, 'F2', [250, 204, 21]);

  const iphoneSteps: Array<{ title: string; desc: string }> = [
    {
      title: 'Abre o link no Safari',
      desc: 'Usa sempre o Safari (navegador oficial do iPhone). Se abriste pelo WhatsApp, toca no ícone da bússola em baixo à direita para abrir no Safari.',
    },
    {
      title: 'Toca no botão Partilhar',
      desc: 'Na barra inferior do Safari, toca no ícone de quadrado com seta para cima (Partilhar).',
    },
    {
      title: 'Escolhe "Adicionar ao ecrã principal"',
      desc: 'Desliza o menu para baixo até encontrares a opção "Adicionar ao ecrã principal" (com o símbolo +) e toca nela.',
    },
    {
      title: 'Confirma em "Adicionar"',
      desc: 'Mantém o nome "New Shape" e toca em "Adicionar" no canto superior direito. A app fica logo no teu ecrã principal!',
    },
  ];

  let curY = cardsY + 78;
  iphoneSteps.forEach((step, idx) => {
    drawCircleBadge(ops, leftX + 24, curY + 2, 11, [234, 179, 8], String(idx + 1), [18, 18, 20]);
    const titleLines = wrapText(step.title, colW - 56, 10.5, true);
    titleLines.forEach((line, li) => {
      drawText(ops, line, leftX + 44, curY + 5 + li * 13, 10.5, 'F2', [24, 24, 27]);
    });
    const descStart = curY + 5 + titleLines.length * 13 + 3;
    const descLines = wrapText(step.desc, colW - 56, 9.2, false);
    descLines.forEach((line, li) => {
      drawText(ops, line, leftX + 44, descStart + li * 12.2, 9.2, 'F1', [82, 82, 91]);
    });
    curY = descStart + descLines.length * 12.2 + 16;
    if (idx < iphoneSteps.length - 1) {
      ops.push(
        rgbStroke(244, 244, 245),
        '0.8 w',
        `${(leftX + 16).toFixed(2)} ${py(curY - 8).toFixed(2)} m`,
        `${(leftX + colW - 16).toFixed(2)} ${py(curY - 8).toFixed(2)} l S`
      );
    }
  });

  // RIGHT CARD: Android (Chrome)
  ops.push(
    rgbFill(255, 255, 255),
    rgbStroke(228, 228, 231),
    '1 w',
    roundedRectPath(rightX, cardsY, colW, cardsH, 14),
    'B'
  );
  ops.push(
    rgbFill(20, 42, 30),
    roundedRectPath(rightX, cardsY, colW, 56, 14),
    'f',
    `${rightX.toFixed(2)} ${py(cardsY + 56).toFixed(2)} ${colW.toFixed(2)} 14 re f`
  );
  drawChromeDotsIcon(ops, rightX + colW - 38, cardsY + 14, 26);
  drawText(ops, 'Android', rightX + 16, cardsY + 26, 14, 'F2', [255, 255, 255]);
  drawText(ops, 'Usar o Google Chrome', rightX + 16, cardsY + 44, 9.5, 'F2', [74, 222, 128]);

  const androidSteps: Array<{ title: string; desc: string }> = [
    {
      title: 'Abre o link no Google Chrome',
      desc: 'Toca no link do estúdio acima. Se abrir dentro do WhatsApp, toca nos 3 pontinhos em cima e escolhe "Abrir no Chrome".',
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
      desc: 'Confirma na janela que aparece. O ícone dourado da New Shape vai surgir no ecrã principal como uma app normal!',
    },
  ];

  curY = cardsY + 78;
  androidSteps.forEach((step, idx) => {
    drawCircleBadge(ops, rightX + 24, curY + 2, 11, [34, 197, 94], String(idx + 1), [255, 255, 255]);
    const titleLines = wrapText(step.title, colW - 56, 10.5, true);
    titleLines.forEach((line, li) => {
      drawText(ops, line, rightX + 44, curY + 5 + li * 13, 10.5, 'F2', [24, 24, 27]);
    });
    const descStart = curY + 5 + titleLines.length * 13 + 3;
    const descLines = wrapText(step.desc, colW - 56, 9.2, false);
    descLines.forEach((line, li) => {
      drawText(ops, line, rightX + 44, descStart + li * 12.2, 9.2, 'F1', [82, 82, 91]);
    });
    curY = descStart + descLines.length * 12.2 + 16;
    if (idx < androidSteps.length - 1) {
      ops.push(
        rgbStroke(244, 244, 245),
        '0.8 w',
        `${(rightX + 16).toFixed(2)} ${py(curY - 8).toFixed(2)} m`,
        `${(rightX + colW - 16).toFixed(2)} ${py(curY - 8).toFixed(2)} l S`
      );
    }
  });

  // --- BOTTOM TIPS BOX ---
  const tipsY = 700;
  const tipsH = 98;
  ops.push(
    rgbFill(24, 24, 27),
    roundedRectPath(36, tipsY, PAGE_W - 72, tipsH, 12),
    'f'
  );
  drawText(ops, 'DICAS IMPORTANTES DEPOIS DE INSTALAR', 52, tipsY + 22, 10, 'F2', [250, 204, 21]);
  const tips = [
    '• Entra apenas com o teu número de telemóvel (9 dígitos) — sem precisar de palavra-passe.',
    '• Na 1.ª vez, aceita as notificações para receberes lembretes antes dos teus treinos confirmados.',
    '• Em Agenda podes marcar treinos dia a dia e consultar os confirmados na subaba Marcações.',
    '• Qualquer dúvida, fala diretamente com o teu Personal Trainer pelo Chat da App ou WhatsApp.',
  ];
  tips.forEach((tip, i) => {
    drawText(ops, tip, 52, tipsY + 41 + i * 14.5, 9.1, 'F1', [228, 228, 231]);
  });

  // Footer
  drawText(
    ops,
    'New Shape Studio  •  Portal do Aluno (iPhone & Android)',
    36,
    822,
    8.5,
    'F1',
    [113, 113, 122]
  );
  drawText(ops, 'newshape.vercel.app', PAGE_W - 128, 822, 8.5, 'F2', [161, 98, 7]);

  const streamContent = ops.join('\n');

  // --- ASSEMBLE VALID PDF 1.4 DOCUMENT ---
  // Clickable Link Annotation rect over the entire URL box
  const annotRect = `${urlBoxX.toFixed(2)} ${py(urlBoxY + urlBoxH).toFixed(2)} ${(urlBoxX + urlBoxW).toFixed(2)} ${py(urlBoxY).toFixed(2)}`;
  const safeUri = cleanUrl.replace(/[()\\]/g, '');

  const objects: string[] = [
    // 1: Catalog
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    // 2: Pages
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    // 3: Page
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R /Annots [7 0 R] >>\nendobj\n`,
    // 4: Helvetica Regular (WinAnsiEncoding)
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
    // 5: Helvetica Bold (WinAnsiEncoding)
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
    // 6: Content Stream
    `6 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    // 7: Clickable Link Annotation for the Student Portal URL
    `7 0 obj\n<< /Type /Annot /Subtype /Link /Rect [${annotRect}] /Border [0 0 0] /A << /Type /Action /S /URI /URI (${safeUri}) >> >>\nendobj\n`,
  ];

  const header = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';
  const parts: string[] = [header];
  const offsets: number[] = [0];
  let byteLen = header.length;

  for (const obj of objects) {
    offsets.push(byteLen);
    parts.push(obj);
    byteLen += obj.length;
  }

  const xrefOffset = byteLen;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(xref, trailer);

  const fullString = parts.join('');
  const out = new Uint8Array(fullString.length);
  for (let i = 0; i < fullString.length; i++) {
    out[i] = fullString.charCodeAt(i) & 0xff;
  }
  return out;
}

/** Triggers direct download of the personalized Home Screen Guide PDF in the browser. */
export function downloadHomeScreenGuidePdf(portalUrl: string): void {
  const bytes = buildHomeScreenGuidePdfBytes(portalUrl);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Colocar-App-New-Shape-Ecra-Principal.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Opens the personalized PDF in a new browser tab so the PT can preview or share it. */
export function openHomeScreenGuidePdf(portalUrl: string): boolean {
  const bytes = buildHomeScreenGuidePdfBytes(portalUrl);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return Boolean(win);
}
