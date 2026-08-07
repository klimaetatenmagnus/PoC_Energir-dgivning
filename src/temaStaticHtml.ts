// Byggtids-hjelpere for prerendrede landingssider (brukes KUN av vite.config.ts).
// Genererer statisk over-folden-innhold og head-metadata per temavariant fra
// samme kilde som React-appen (tema.ts), slik at statisk og hydrert innhold
// alltid er identisk. Importeres aldri av klientkoden.

import {
  GENERIC_SUBTITLE_DESKTOP,
  GENERIC_SUBTITLE_MOBILE,
  type TemaConfig,
} from './tema';

/** Kanonisk opphav for canonical/og:url — ASCII-domenet brukes i annonser */
export const CANONICAL_ORIGIN = 'https://energinokkelen.no';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Kritisk CSS for statisk innhold som tegnes før JS/CSS-bundlene er lastet.
 * Speiler fargene og typografien til den ekte landingssiden (Punkt-tokens).
 */
const CRITICAL_CSS = `
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#D1F9FF;font-family:'Oslo Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A2859}
#root{display:flow-root}
.pr-landing{box-sizing:border-box;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:24px 16px 240px;text-align:center}
.pr-brand{margin:0 0 12px;font-weight:700;font-size:32px;line-height:1.2;letter-spacing:-.5px}
.pr-subtitle{margin:0 0 28px;font-weight:400;font-size:18px;line-height:1.4;letter-spacing:-.2px;opacity:.9;max-width:560px}
.pr-search{box-sizing:border-box;width:100%;max-width:480px;background:#fff;border:2px solid #2A2859;border-radius:8px;padding:14px 16px;text-align:left;color:#595959;font-size:16px}
.pr-sub-desktop{display:none}
@media (min-width:768px){
  .pr-landing{align-items:flex-start;justify-content:flex-start;text-align:left;padding:clamp(80px,20vh,220px) clamp(24px,10vw,200px) 240px}
  .pr-brand{font-size:clamp(32px,5vw,86px);margin-bottom:16px}
  .pr-subtitle{font-size:clamp(14px,1.5vw,26px);max-width:720px}
  .pr-sub-mobile{display:none}
  .pr-sub-desktop{display:inline}
}
.pr-tema{background:#fff;border-top:4px solid #2A2859}
.pr-tema-inner{max-width:720px;margin:0 auto;padding:48px 24px 64px}
.pr-tema h2{margin:32px 0 8px;font-weight:700;font-size:22px;line-height:1.3}
.pr-tema h2:first-child{margin-top:0}
.pr-tema p{margin:0;font-size:17px;line-height:1.6}
`.trim();

/**
 * Statisk over-folden-innhold: tittel, undertittel og et søkefelt-lookalike.
 * Rendres inne i #root og erstattes i sin helhet når React mounter.
 */
const renderStaticLanding = (tema: TemaConfig | null): string => {
  const heading = tema
    ? `<p class="pr-brand">Energinøkkelen</p>
      <h1 class="pr-subtitle">${esc(tema.subtitle)}</h1>`
    : `<h1 class="pr-brand">Energinøkkelen</h1>
      <p class="pr-subtitle"><span class="pr-sub-mobile">${esc(GENERIC_SUBTITLE_MOBILE)}</span><span class="pr-sub-desktop">${esc(GENERIC_SUBTITLE_DESKTOP)}</span></p>`;

  const temaSections = tema
    ? `
    <section class="pr-tema">
      <div class="pr-tema-inner">
        ${tema.sections
          .map((s) => `<h2>${esc(s.heading)}</h2>\n        <p>${esc(s.text)}</p>`)
          .join('\n        ')}
      </div>
    </section>`
    : '';

  return `
    <div class="pr-landing">
      ${heading}
      <div class="pr-search" aria-hidden="true">Skriv inn adresse...</div>
    </div>${temaSections}
  `;
};

/** Erstatt content-attributtet på en <meta>-tagg; feiler høyt hvis taggen mangler. */
const replaceMetaContent = (
  html: string,
  attrSelector: string,
  value: string,
  file: string
): string => {
  const pattern = new RegExp(`(<meta\\s+${attrSelector}\\s+content=")[^"]*(")`);
  if (!pattern.test(html)) {
    throw new Error(`[tema-landing] Fant ikke <meta ${attrSelector}> i ${file}`);
  }
  return html.replace(pattern, `$1${esc(value)}$2`);
};

/**
 * Transformér en HTML-entry: unik head-metadata (for temavarianter), kritisk CSS
 * og statisk over-folden-innhold i #root. Kaster ved manglende ankere slik at
 * feil oppdages i bygget – ikke i produksjon.
 */
export function applyTemaToHtml(html: string, tema: TemaConfig | null, file: string): string {
  if (tema) {
    const canonicalUrl = `${CANONICAL_ORIGIN}${tema.path}`;

    if (!/<title>[^<]*<\/title>/.test(html)) {
      throw new Error(`[tema-landing] Fant ikke <title> i ${file}`);
    }
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(tema.title)}</title>`);
    html = replaceMetaContent(html, 'name="description"', tema.metaDescription, file);
    html = replaceMetaContent(html, 'property="og:title"', tema.title, file);
    html = replaceMetaContent(html, 'property="og:description"', tema.metaDescription, file);
    html = replaceMetaContent(html, 'property="og:url"', canonicalUrl, file);
    html = replaceMetaContent(html, 'name="twitter:title"', tema.title, file);
    html = replaceMetaContent(html, 'name="twitter:description"', tema.metaDescription, file);
    html = html.replace(
      '</title>',
      `</title>\n    <link rel="canonical" href="${canonicalUrl}" />`
    );
  }

  if (!html.includes('</head>')) {
    throw new Error(`[tema-landing] Fant ikke </head> i ${file}`);
  }
  html = html.replace('</head>', `  <style>${CRITICAL_CSS}</style>\n  </head>`);

  const rootTag = '<div id="root"></div>';
  if (!html.includes(rootTag)) {
    throw new Error(`[tema-landing] Fant ikke tom #root i ${file}`);
  }
  return html.replace(rootTag, `<div id="root">${renderStaticLanding(tema)}</div>`);
}

/**
 * Gjør Vite-injiserte stylesheets asynkrone (media="print" til de er lastet),
 * slik at første tegning ikke blokkeres av CSS-bundelen. main.tsx venter på
 * data-app-css-lenkene før React mountes, så appen aldri vises ustylet.
 * Kjøres kun på build-output (etter at Vite har injisert asset-tagger).
 */
export function makeStylesheetsAsync(html: string): string {
  return html.replace(
    /<link rel="stylesheet"([^>]*?)>/g,
    (_match, attrs: string) =>
      `<link rel="stylesheet"${attrs} media="print" data-app-css onload="this.media='all'">` +
      `<noscript><link rel="stylesheet"${attrs}></noscript>`
  );
}
