import {describe, expect, it} from 'vitest';
import {malaysiaDate, visitorDateRange, visitorRecordsCsv, type VisitorRecord} from '../packages/contracts/visitor-records';

describe('visitor calendar filters', () => {
  it('converts inclusive Malaysia days across UTC boundaries', () => {
    expect(visitorDateRange('2026-10-20', '2026-10-20')).toEqual({p_from: '2026-10-19T16:00:00.000Z', p_until: '2026-10-20T16:00:00.000Z'});
    expect(malaysiaDate(Date.parse('2026-10-19T16:00:00Z'))).toBe('2026-10-20');
  });
  it('accepts 31 days and a valid leap day', () => {
    expect(visitorDateRange('2026-10-01', '2026-10-31').p_until).toBe('2026-10-31T16:00:00.000Z');
    expect(visitorDateRange('2028-02-29', '2028-02-29').p_from).toBe('2028-02-28T16:00:00.000Z');
  });
  it.each([['2026-10-01', '2026-11-01'], ['2026-10-20', '2026-10-19'], ['2026-02-29', '2026-03-01'], ['', '2026-10-20'], ['2026-10-20T00:00:00Z', '2026-10-20']])('rejects invalid range %s to %s', (start, end) => {
    expect(() => visitorDateRange(start, end)).toThrow();
  });
});

const record: VisitorRecord = {id: 'fictional-reference', masked_name: 'F***', status: 'onsite', created_at: '2026-10-20T00:00:00Z', entered_at: null, exited_at: null};
describe('visitor CSV export', () => {
  it.each(['=SUM(1,2)', '+SUM(1,2)', '-1+2', '@SUM(1,2)', ' \t=1+2', '\u0000=1+2', '\tguest', '\rguest', '\nguest'])('neutralizes spreadsheet formula/control prefix %j', name => {
    expect(visitorRecordsCsv([{...record, masked_name: name}])).toContain(`"'${name}"`);
  });
  it('quotes commas, newlines, and quotes; serializes only allowed fields', () => {
    const csv = visitorRecordsCsv([{...record, masked_name: 'A,"B"\nC', guest_name: 'PRIVATE NAME', token: 'PRIVATE TOKEN'} as VisitorRecord]);
    expect(csv).toContain('"A,""B""\nC"');
    expect(csv).toContain('"2026-10-20T00:00:00Z","",""\r\n');
    expect(csv).not.toContain('PRIVATE');
    expect(csv.startsWith('\uFEFF"Visit reference"')).toBe(true);
  });
  it('exports an honest header-only file for an empty result', () => {
    expect(visitorRecordsCsv([]).split('\r\n')).toHaveLength(2);
  });
});
