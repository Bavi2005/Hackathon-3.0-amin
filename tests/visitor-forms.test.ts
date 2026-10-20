import {describe, it, expect} from 'vitest';
import {parseVisitorFields, validateVisitorAnswers, collectVisitorAnswers, visitorTemplates, type VisitorField} from '../packages/contracts/visitor-forms';

describe('controlled visitor schemas', () => {
  it.each(Object.keys(visitorTemplates))('accepts the %s template', template => {
    const fields = visitorTemplates[template as keyof typeof visitorTemplates];
    expect(parseVisitorFields(fields)).toEqual(fields);
  });
  it.each([null, {}, [{key: 'passport', required: true}], [{key: 'contact_phone', required: false}], [{key: 'vehicle_plate', required: false}],
    [{key: 'purpose', required: 'true'}], [{key: 'purpose', required: true, label: 'National ID'}],
    [{key: 'company', required: false}, {key: 'company', required: true}], [{key: '__proto__', required: false}],
    ['purpose'], [{key: 'purpose'}]])('rejects unsupported, risky or malformed field schema %j', fields => {
    expect(() => parseVisitorFields(fields)).toThrow('Invalid visitor form');
  });
});

const all: VisitorField[] = ['purpose', 'party_size', 'arrival_date', 'company', 'safety_ack'].map(key => ({key: key as VisitorField['key'], required: true}));
const valid = {purpose: 'Meeting', party_size: 2, arrival_date: '2028-02-29', company: 'Fictional company', safety_ack: true};
describe('visitor answer validation', () => {
  it('accepts bounded typed answers and valid leap dates', () => expect(validateVisitorAnswers(all, valid)).toEqual(valid));
  it.each([
    {...valid, passport: 'fictional'}, {...valid, purpose: 'Unlisted'}, {...valid, purpose: null},
    {...valid, party_size: '2'}, {...valid, party_size: 0}, {...valid, party_size: 21}, {...valid, party_size: 1.5}, {...valid, party_size: Infinity},
    {...valid, arrival_date: '2026-02-29'}, {...valid, arrival_date: '2026-04-31'}, {...valid, arrival_date: '2100-01-01'},
    {...valid, company: ' '.repeat(5)}, {...valid, company: 'x'.repeat(81)}, {...valid, safety_ack: false}, {...valid, safety_ack: 'true'},
    {}, null, [],
  ])('rejects invalid answers without coercion %j', answers => expect(() => validateVisitorAnswers(all, answers)).toThrow());
  it('permits omitted optional fields and optional unchecked checkboxes', () => {
    expect(validateVisitorAnswers(all.map(field => ({...field, required: false})), {safety_ack: false})).toEqual({safety_ack: false});
  });
  it('name-only schemas do not accept extra answers', () => {
    expect(validateVisitorAnswers([], {})).toEqual({});
    expect(() => validateVisitorAnswers([], {company: 'Fictional'})).toThrow();
  });
  it('handles Unicode using database-compatible character counts', () => {
    expect(validateVisitorAnswers([{key: 'company', required: true}], {company: '🌳'.repeat(80)})).toEqual({company: '🌳'.repeat(80)});
  });
  it('collects only configured fields and preserves typed values', () => {
    const data = new FormData();
    data.set('name', 'Fictional guest');data.set('answer_party_size', '3');data.set('answer_purpose', 'Delivery');data.set('answer_company', ' ');data.set('answer_passport', 'not submitted');
    expect(collectVisitorAnswers(visitorTemplates.residential, data)).toEqual({purpose: 'Delivery', party_size: 3});
  });
  it('requires checkbox acknowledgment even when the browser is bypassed', () => {
    const data = new FormData();data.set('answer_company', 'Fictional contractor');data.set('answer_arrival_date', '2026-10-20');
    expect(() => collectVisitorAnswers(visitorTemplates.contractor, data)).toThrow();
    data.set('answer_safety_ack', 'on');expect(collectVisitorAnswers(visitorTemplates.contractor, data).safety_ack).toBe(true);
  });
});
