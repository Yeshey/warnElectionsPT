import { computeNotifications } from '../elections';

// Helper to create an election N days from today
function daysFromNow(n: number, isApprox = false, label = 'Test Election', etype = 'Eleição Teste') {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + n);
  return { date, isApprox, originalStr: label, etype };
}

// Helper to create an election in the current month (for "this month" tests)
function thisMonth(isApprox = true, originalStr = 'março') {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return { date, isApprox, originalStr, etype: 'Test: Inside Month' };
}

function hasNotification(notes: { title: string; body: string }[], titleFragment: string) {
  return notes.some(n => n.title.includes(titleFragment) || n.body.includes(titleFragment));
}

// ==================== APPROXIMATE ELECTIONS ====================

describe('Approximate elections - standard generic offsets', () => {
  test('TEST 1: Notifies 32 days before approximate election', () => {
    const notes = computeNotifications([daysFromNow(32, true, 'março')]);
    expect(notes.some(n => n.title.includes('Alerta'))).toBe(true);
  });

  test('TEST 2: Notifies 27 days before approximate election', () => {
    const notes = computeNotifications([daysFromNow(27, true, 'abril')]);
    expect(notes.some(n => n.title.includes('Alerta'))).toBe(true);
  });

  test('TEST 3: Notifies 22 days before approximate election', () => {
    const notes = computeNotifications([daysFromNow(22, true, 'maio')]);
    expect(notes.some(n => n.title.includes('Alerta'))).toBe(true);
  });
});

describe('Approximate elections - extra offsets (not available for exact)', () => {
  const extraOffsets = [21, 15, 14, 13, 12, 10, 8, 6, 5, 4, 3, 2, 1];
  extraOffsets.forEach(days => {
    test(`TEST 4: Notifies ${days} days before approximate election`, () => {
      const notes = computeNotifications([daysFromNow(days, true, 'junho')]);
      expect(notes.some(n => n.title.includes('Alerta'))).toBe(true);
    });
  });
});

describe('Approximate elections - inside the month', () => {
  test('TEST 5: Sends "This Month" alert when inside single approximate month', () => {
    const notes = computeNotifications([thisMonth(true, 'março')]);
    expect(notes.some(n => n.title.includes('Este Mês'))).toBe(true);
  });

  test('TEST 6: Sends "This Month" alert for month range when inside first month', () => {
    const now = new Date();
    // Build "currentMonth/nextMonth" string
    const monthNames = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const cur = monthNames[now.getMonth()];
    const next = monthNames[(now.getMonth() + 1) % 12];
    const notes = computeNotifications([thisMonth(true, `${cur}/${next}`)]);
    expect(notes.some(n => n.title.includes('Este Mês'))).toBe(true);
  });

  test('TEST 7: Sends "This Month" alert when in second month of range', () => {
    const now = new Date();
    const monthNames = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const prev = monthNames[(now.getMonth() - 1 + 12) % 12];
    const cur = monthNames[now.getMonth()];
    // Election date set to first of PREVIOUS month, but range includes current month
    const date = new Date(now.getFullYear(), now.getMonth() - 1 < 0 ? 11 : now.getMonth() - 1, 1);
    const notes = computeNotifications([{ date, isApprox: true, originalStr: `${prev}/${cur}`, etype: 'Test' }]);
    expect(notes.some(n => n.title.includes('Este Mês'))).toBe(true);
  });
});

// ==================== EXACT DATE ELECTIONS ====================

describe('Exact elections - standard generic offsets only', () => {
  test('TEST 9: Notifies 32 days before exact election', () => {
    const notes = computeNotifications([daysFromNow(32, false)]);
    expect(notes.some(n => n.title.includes('Alerta'))).toBe(true);
  });

  test('TEST 10: Notifies 27 days before exact election', () => {
    const notes = computeNotifications([daysFromNow(27, false)]);
    expect(notes.some(n => n.title.includes('Alerta'))).toBe(true);
  });

  test('TEST 11: Notifies 22 days before exact election', () => {
    const notes = computeNotifications([daysFromNow(22, false)]);
    expect(notes.some(n => n.title.includes('Alerta'))).toBe(true);
  });
});

describe('Exact elections - early voting notifications', () => {
  test('TEST 12: ELEITORES DOENTES INTERNADOS - tomorrow warning at 21 days', () => {
    const notes = computeNotifications([daysFromNow(21, false)]);
    expect(notes.some(n => n.body.includes('AMANHÃ') && n.body.includes('DOENTES'))).toBe(true);
  });

  test('TEST 13: ELEITORES DOENTES INTERNADOS - today warning at 20 days', () => {
    const notes = computeNotifications([daysFromNow(20, false)]);
    expect(notes.some(n => n.body.includes('HOJE') && n.body.includes('DOENTES'))).toBe(true);
  });

  test('TEST 14: EM MOBILIDADE - tomorrow warning at 15 days', () => {
    const notes = computeNotifications([daysFromNow(15, false)]);
    expect(notes.some(n => n.body.includes('AMANHÃ') && n.body.includes('MOBILIDADE'))).toBe(true);
  });

  test('TEST 15: EM MOBILIDADE - today warning at 14 days', () => {
    const notes = computeNotifications([daysFromNow(14, false)]);
    expect(notes.some(n => n.body.includes('HOJE') && n.body.includes('MOBILIDADE'))).toBe(true);
  });

  test('TEST 16: ELEITORES DESLOCADOS - tomorrow warning at 13 days', () => {
    const notes = computeNotifications([daysFromNow(13, false)]);
    expect(notes.some(n => n.body.includes('AMANHÃ') && n.body.includes('DESLOCADOS'))).toBe(true);
  });

  test('TEST 17: ELEITORES DESLOCADOS - today warning at 12 days', () => {
    const notes = computeNotifications([daysFromNow(12, false)]);
    expect(notes.some(n => n.body.includes('HOJE') && n.body.includes('DESLOCADOS'))).toBe(true);
  });
});

describe('Exact elections - election day', () => {
  test('TEST 18: Election tomorrow notification at 1 day', () => {
    const notes = computeNotifications([daysFromNow(1, false)]);
    expect(notes.some(n => n.title.includes('Amanhã'))).toBe(true);
  });

  test('TEST 19: Election today notification at 0 days', () => {
    const notes = computeNotifications([daysFromNow(0, false)]);
    expect(notes.some(n => n.title.includes('Dia de Eleições'))).toBe(true);
  });
});

// ==================== BOUNDARY / NEGATIVE TESTS ====================

describe('TEST 20: Approximate vs exact at same offset behave differently', () => {
  test('At 15 days: approximate gets generic alert, exact gets early voting alert', () => {
    const approxNotes = computeNotifications([daysFromNow(15, true, 'março')]);
    const exactNotes = computeNotifications([daysFromNow(15, false)]);

    expect(approxNotes.some(n => n.title.includes('Alerta'))).toBe(true);
    expect(exactNotes.some(n => n.title.includes('Alerta'))).toBe(false); // exact doesn't get generic at 15
    expect(exactNotes.some(n => n.body.includes('MOBILIDADE'))).toBe(true);
  });
});

describe('TEST 21: Exact elections do NOT notify at non-standard offsets', () => {
  const shouldNotNotify = [10, 8, 6, 5, 4, 3, 2];
  shouldNotNotify.forEach(days => {
    test(`Exact election ${days} days away should NOT send generic notification`, () => {
      const notes = computeNotifications([daysFromNow(days, false)]);
      expect(notes.some(n => n.title.includes('Alerta'))).toBe(false);
    });
  });
});