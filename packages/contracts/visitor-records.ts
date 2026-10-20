export type VisitorRecord = {
  id: string;
  masked_name: string;
  status: 'pending_entry' | 'onsite' | 'departed';
  created_at: string;
  entered_at: string | null;
  exited_at: string | null;
};
export type VisitorRecordsPage = {records: VisitorRecord[]; has_more: boolean; offset: number};
export type VisitorRecordsExport = {records: VisitorRecord[]; count: number; generated_at: string};

const day = 86400000;
export function malaysiaDate(now = Date.now()): string {
  return new Date(now + 8 * 3600000).toISOString().slice(0, 10);
}

/** Inclusive Malaysia calendar dates -> half-open UTC timestamps. */
export function visitorDateRange(start: string, end: string): {p_from: string; p_until: string} {
  function parse(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Choose valid dates');
    const time = Date.parse(`${value}T00:00:00+08:00`);
    if (!Number.isFinite(time) || malaysiaDate(time) !== value) throw Error('Choose valid dates');
    return time;
  }
  const from = parse(start), until = parse(end) + day;
  if (until <= from || until - from > 31 * day) throw Error('Choose an ordered date range of at most 31 days');
  return {p_from: new Date(from).toISOString(), p_until: new Date(until).toISOString()};
}

function csvCell(value: string | null): string {
  let text = value ?? '';
  // Quoting alone does not stop spreadsheet formulas, including whitespace-prefixed ones.
  // eslint-disable-next-line no-control-regex -- Strip the formula meaning after attacker-controlled control characters too.
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function visitorRecordsCsv(records: VisitorRecord[]): string {
  const header = ['Visit reference', 'Masked guest name', 'Status', 'Registered (UTC)', 'Entered (UTC)', 'Exited (UTC)'];
  // Explicit allowlist: never serialize arbitrary fields returned by a service.
  const rows = records.map(r => [r.id, r.masked_name, r.status, r.created_at, r.entered_at, r.exited_at]);
  return '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
