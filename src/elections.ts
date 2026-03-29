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
    if (!['de','do','da','das','dos'].includes(monthStr)) {
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
      if (['de','do','da','das','dos'].includes(p)) continue;
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

export async function scrapeElections(): Promise<Election[]> {
  const url = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.cne.pt/content/calendario');
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const json = await res.json();
  const html: string = json.contents;

  // Parse table rows with regex
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim();

  const elections: Election[] = [];
  let rowMatch;
  let firstRow = true;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    if (firstRow) { firstRow = false; continue; } // skip header
    const cells: string[] = [];
    let cellMatch;
    const cellRe = new RegExp(cellRegex.source, 'gi');
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length < 3) continue;

    const yearStr = cells[0];
    const rawDate = cells[1];
    const etype = cells[2];
    const year = parseInt(yearStr);
    if (isNaN(year)) continue;

    const { date, isApprox } = parseDate(rawDate, year);
    if (date) {
      elections.push({ date, isApprox, originalStr: rawDate, etype });
    }
  }

  return elections;
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
      const inMonth = el.date.getFullYear() === today.getFullYear() && el.date.getMonth() === today.getMonth();
      const inRange = el.originalStr.includes('/') && (() => {
        for (const [name, num] of Object.entries(MONTHS)) {
          if (el.originalStr.toLowerCase().includes(name) && num === today.getMonth() + 1 && el.date.getFullYear() === today.getFullYear()) return true;
        }
        return false;
      })();

      if (inMonth || inRange) {
        notes.push({
          title: 'Eleição Este Mês',
          body: `ATENÇÃO: Eleição este mês (data exata desconhecida):\n${el.originalStr} ${el.date.getFullYear()} - ${el.etype}\nVerifica: https://www.cne.pt/content/calendario`,
        });
      }
    }

    const offsets = el.isApprox ? [...standardOffsets, ...approxExtraOffsets] : standardOffsets;
    if (offsets.includes(diff)) {
      (genericByOffset[diff] = genericByOffset[diff] || []).push(el);
    }
  }

  for (const [, elems] of Object.entries(genericByOffset)) {
    const lines = elems.map(e => `${formatDate(e.date, e.isApprox, e.originalStr)} ${e.date.getFullYear()} - ${e.etype}`);
    notes.push({
      title: 'Alerta de Eleições',
      body: `Eleições próximas detectadas:\n${lines.join('\n')}\nVerifica se precisas de votar antecipadamente.\nhttps://www.cne.pt/content/calendario`,
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
        notes.push({ title: 'Voto Antecipado', body: `Inscreve-te AMANHÃ para voto antecipado se ${cat}:\nEleição ${el.date.toLocaleDateString('pt-PT')} - ${el.etype}` });
      } else if (diff >= period.end && diff <= period.start) {
        notes.push({ title: 'Voto Antecipado', body: `Inscreve-te HOJE para voto antecipado se ${cat}:\nEleição ${el.date.toLocaleDateString('pt-PT')} - ${el.etype}` });
      }
    }

    if (diff === 0) notes.push({ title: 'Dia de Eleições', body: `É hoje! Eleição: ${el.date.toLocaleDateString('pt-PT')} - ${el.etype}` });
    if (diff === 1) notes.push({ title: 'Eleição Amanhã', body: `Eleição AMANHÃ: ${el.date.toLocaleDateString('pt-PT')} - ${el.etype}` });
  }

  return notes;
}