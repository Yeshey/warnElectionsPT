const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, abril: 4,
  maio: 5, junho: 6, julho: 7, agosto: 8,
  setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

interface Election {
  date: Date;
  isApprox: boolean;
  originalStr: string;
  etype: string;
}

function parseDate(dateStr: string, year: number): { date: Date | null; isApprox: boolean } {
  const s = dateStr.toLowerCase().trim();

  // "X de MONTH"
  const deMatch = s.match(/(\d{1,2})\s+de\s+([a-záéíóúãõâêôç]+)/i);
  if (deMatch) {
    const day = parseInt(deMatch[1]);
    const monthStr = deMatch[2];
    for (const [name, num] of Object.entries(MONTHS)) {
      if (name.startsWith(monthStr)) {
        return { date: new Date(year, num - 1, day), isApprox: false };
      }
    }
  }

  // "23 março"
  const dayMonth = s.match(/(\d{1,2})[\s\-/]*([a-záéíóúãõâêôç]+)/i);
  if (dayMonth) {
    const day = parseInt(dayMonth[1]);
    const monthStr = dayMonth[2];
    if (!['de', 'do', 'da', 'das', 'dos'].includes(monthStr)) {
      for (const [name, num] of Object.entries(MONTHS)) {
        if (name.startsWith(monthStr)) {
          return { date: new Date(year, num - 1, day), isApprox: false };
        }
      }
    }
  }

  // month range "setembro/outubro"
  if (s.includes('/')) {
    for (const part of s.split('/')) {
      const p = part.trim();
      if (['de', 'do', 'da', 'das', 'dos'].includes(p)) continue;
      for (const [name, num] of Object.entries(MONTHS)) {
        if (name.startsWith(p)) {
          return { date: new Date(year, num - 1, 1), isApprox: true };
        }
      }
    }
  }

  // single month name
  for (const [name, num] of Object.entries(MONTHS)) {
    if (s.includes(name)) {
      return { date: new Date(year, num - 1, 1), isApprox: true };
    }
  }

  return { date: null, isApprox: false };
}

function formatDate(date: Date, isApprox: boolean, original: string): string {
  if (isApprox) return original.charAt(0).toUpperCase() + original.slice(1);
  return date.toLocaleDateString('pt-PT');
}

// ---------------------------------------------------------------------------
// Proxy helpers — tried in order until one works
// ---------------------------------------------------------------------------

const CNE_URL = 'https://www.cne.pt/content/calendario';

const PROXIES: Array<(url: string) => Promise<string>> = [
  // 1. allorigins (original)
  async (url) => {
    const r = await fetch(
      'https://api.allorigins.win/get?url=' + encodeURIComponent(url),
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) },
    );
    if (!r.ok) throw new Error(`allorigins HTTP ${r.status}`);
    const j = await r.json();
    if (!j.contents) throw new Error('allorigins: empty contents');
    return j.contents as string;
  },

  // 2. corsproxy.io
  async (url) => {
    const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`corsproxy.io HTTP ${r.status}`);
    return r.text();
  },

  // 3. Direct fetch (works in background tasks on native where CORS doesn't apply)
  async (url) => {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EleicoesApp/1.0)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`direct HTTP ${r.status}`);
    return r.text();
  },
];

/**
 * Fetch the CNE calendar HTML, trying each proxy in sequence.
 * Retries the whole proxy list for up to `retryDurationMs` (default 1 hour).
 */
async function fetchCalendarHtml(retryDurationMs = 60 * 60 * 1000): Promise<string> {
  const deadline = Date.now() + retryDurationMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    for (const proxy of PROXIES) {
      try {
        const html = await proxy(CNE_URL);
        // Sanity-check: the CNE page always has a table
        if (html.includes('<tr') && html.toLowerCase().includes('eleição')) {
          console.log(`[elections] Fetched via proxy ${PROXIES.indexOf(proxy)} on attempt ${attempt}`);
          return html;
        }
        console.warn(`[elections] Proxy ${PROXIES.indexOf(proxy)} returned unexpected content`);
      } catch (e) {
        console.warn(`[elections] Proxy ${PROXIES.indexOf(proxy)} failed:`, e);
      }
    }

    attempt++;
    // Exponential backoff: 15s, 30s, 60s, 120s … capped at 5 min
    const backoffMs = Math.min(15_000 * Math.pow(2, attempt - 1), 5 * 60 * 1000);
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((res) => setTimeout(res, Math.min(backoffMs, remaining)));
  }

  throw new Error(`Could not fetch CNE calendar after ~${retryDurationMs / 60000} minutes`);
}

// ---------------------------------------------------------------------------

function parseHtml(html: string): Election[] {
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const stripTags = (s: string) =>
    s
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .trim();

  const elections: Election[] = [];
  let rowMatch;
  let firstRow = true;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    if (firstRow) {
      firstRow = false;
      continue;
    }
    const cells: string[] = [];
    let cellMatch;
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length < 3) continue;

    const year = parseInt(cells[0]);
    if (isNaN(year)) continue;

    const { date, isApprox } = parseDate(cells[1], year);
    if (date) {
      elections.push({ date, isApprox, originalStr: cells[1], etype: cells[2] });
    }
  }

  return elections;
}

export async function scrapeElections(): Promise<Election[]> {
  const html = await fetchCalendarHtml();
  return parseHtml(html);
}

export function computeNotifications(elections: Election[]): { title: string; body: string }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const notes: { title: string; body: string }[] = [];

  const standardOffsets = [32, 27, 22];
  const approxExtraOffsets = [21, 15, 14, 13, 12, 10, 8, 6, 5, 4, 3, 2, 1];

  const genericByOffset: Record<number, Election[]> = {};

  for (const el of elections) {
    const elDate = new Date(el.date);
    elDate.setHours(0, 0, 0, 0);
    const diff = Math.round((elDate.getTime() - today.getTime()) / 86400000);

    // "This month" alert for approximate
    if (el.isApprox) {
      const inMonth =
        el.date.getFullYear() === today.getFullYear() &&
        el.date.getMonth() === today.getMonth();
      const inRange =
        el.originalStr.includes('/') &&
        (() => {
          for (const [name, num] of Object.entries(MONTHS)) {
            if (
              el.originalStr.toLowerCase().includes(name) &&
              num === today.getMonth() + 1 &&
              el.date.getFullYear() === today.getFullYear()
            )
              return true;
          }
          return false;
        })();

      if (inMonth || inRange) {
        notes.push({
          title: 'Eleição Este Mês',
          body:
            `ATENÇÃO: Eleição este mês (data exata desconhecida):\n${el.originalStr} ${el.date.getFullYear()} - ${el.etype}\n` +
            `Verifica: ${CNE_URL}`,
        });
      }
    }

    const offsets = el.isApprox ? [...standardOffsets, ...approxExtraOffsets] : standardOffsets;
    if (offsets.includes(diff)) {
      (genericByOffset[diff] = genericByOffset[diff] || []).push(el);
    }
  }

  for (const [, elems] of Object.entries(genericByOffset)) {
    const lines = elems.map(
      (e) => `${formatDate(e.date, e.isApprox, e.originalStr)} ${e.date.getFullYear()} - ${e.etype}`,
    );
    notes.push({
      title: 'Alerta de Eleições',
      body:
        `Eleições próximas detectadas:\n${lines.join('\n')}\n` +
        `Verifica se precisas de votar antecipadamente.\n${CNE_URL}`,
    });
  }

  // Early voting + election day (exact only)
  const earlyVoting: Record<string, { start: number; end: number }> = {
    'EM MOBILIDADE': { start: 14, end: 10 },
    'ELEITORES DOENTES INTERNADOS': { start: 20, end: 20 },
    'ELEITORES DESLOCADOS NO ESTRANGEIRO': { start: 12, end: 10 },
  };

  for (const el of elections) {
    if (el.isApprox) continue;
    const elDate = new Date(el.date);
    elDate.setHours(0, 0, 0, 0);
    const diff = Math.round((elDate.getTime() - today.getTime()) / 86400000);

    for (const [cat, period] of Object.entries(earlyVoting)) {
      if (diff === period.start + 1) {
        notes.push({
          title: 'Voto Antecipado',
          body: `Inscreve-te AMANHÃ para voto antecipado se ${cat}:\nEleição ${el.date.toLocaleDateString('pt-PT')} - ${el.etype}`,
        });
      } else if (diff >= period.end && diff <= period.start) {
        notes.push({
          title: 'Voto Antecipado',
          body: `Inscreve-te HOJE para voto antecipado se ${cat}:\nEleição ${el.date.toLocaleDateString('pt-PT')} - ${el.etype}`,
        });
      }
    }

    if (diff === 0)
      notes.push({
        title: 'Dia de Eleições',
        body: `É hoje! Eleição: ${el.date.toLocaleDateString('pt-PT')} - ${el.etype}`,
      });
    if (diff === 1)
      notes.push({
        title: 'Eleição Amanhã',
        body: `Eleição AMANHÃ: ${el.date.toLocaleDateString('pt-PT')} - ${el.etype}`,
      });
  }

  return notes;
}
