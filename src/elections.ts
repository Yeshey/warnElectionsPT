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

const CNE_URL = 'https://www.cne.pt/content/calendario';

function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

const PROXIES: Array<(url: string) => Promise<string>> = [
  async (url) => {
    const r = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EleicoesApp/1.0)' },
    });
    if (!r.ok) throw new Error(`direct HTTP ${r.status}`);
    return r.text();
  },
  async (url) => {
    const r = await fetchWithTimeout(
      'https://api.allorigins.win/get?url=' + encodeURIComponent(url),
      { headers: { Accept: 'application/json' } },
    );
    if (!r.ok) throw new Error(`allorigins HTTP ${r.status}`);
    const j = await r.json();
    if (!j.contents) throw new Error('allorigins: empty contents');
    return j.contents as string;
  },
  async (url) => {
    const r = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    if (!r.ok) throw new Error(`corsproxy.io HTTP ${r.status}`);
    return r.text();
  },
];

async function fetchCalendarHtml(maxRounds = 1): Promise<string> {
  for (let round = 0; round < maxRounds; round++) {
    for (let i = 0; i < PROXIES.length; i++) {
      try {
        const html = await PROXIES[i](CNE_URL);
        if (html.includes('<tr') && html.toLowerCase().includes('eleição')) {
          console.log(`[elections] OK — proxy ${i}, round ${round}`);
          return html;
        }
      } catch (e) {
        console.warn(`[elections] Proxy ${i} failed:`, e);
      }
    }

    if (round < maxRounds - 1) {
      const backoffMs = Math.min(15_000 * Math.pow(2, round), 5 * 60 * 1000);
      await new Promise((res) => setTimeout(res, backoffMs));
    }
  }
  throw new Error('Could not fetch CNE calendar — all proxies exhausted');
}

function parseHtml(html: string): Election[] {
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const stripTags = (s: string) =>
    s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();

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

export async function scrapeElections(maxRounds = 1): Promise<Election[]> {
  const html = await fetchCalendarHtml(maxRounds);
  return parseHtml(html);
}

// Added baseDate parameter so we can predict notifications for future days
export function computeNotifications(elections: Election[], baseDate: Date = new Date()): { title: string; body: string }[] {
  const today = new Date(baseDate); 
  today.setHours(0, 0, 0, 0);
  const notes: { title: string; body: string }[] = [];

  const standardOffsets = [32, 27, 22];
  const approxExtraOffsets =[21, 15, 14, 13, 12, 10, 8, 6, 5, 4, 3, 2, 1];

  const genericByOffset: Record<number, Election[]> = {};

  for (const el of elections) {
    const elDate = new Date(el.date);
    elDate.setHours(0, 0, 0, 0);
    const diff = Math.round((elDate.getTime() - today.getTime()) / 86400000);

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