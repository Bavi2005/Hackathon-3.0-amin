export const visitorFieldCatalog = {
  purpose: {label: 'Purpose of visit', type: 'select', options: ['Social visit', 'Delivery', 'Meeting', 'Maintenance', 'Event']},
  party_size: {label: 'Number of visitors', type: 'number', min: 1, max: 20},
  arrival_date: {label: 'Planned arrival date', type: 'date'},
  company: {label: 'Company or organization', type: 'text', maxLength: 80},
  safety_ack: {label: 'I acknowledge the site safety instructions', type: 'checkbox'},
} as const;
export type VisitorFieldKey = keyof typeof visitorFieldCatalog;
export type VisitorField = {key: VisitorFieldKey; required: boolean};
export type VisitorAnswers = Partial<Record<VisitorFieldKey, string | number | boolean>>;
export const visitorTemplates = {
  residential: [{key: 'purpose', required: true}, {key: 'party_size', required: false}],
  office: [{key: 'purpose', required: true}, {key: 'company', required: false}],
  contractor: [{key: 'company', required: true}, {key: 'arrival_date', required: true}, {key: 'safety_ack', required: true}],
  event: [{key: 'party_size', required: true}, {key: 'arrival_date', required: true}],
  custom: [],
} satisfies Record<string, VisitorField[]>;
export type VisitorTemplate = keyof typeof visitorTemplates;
export type VisitorFormVersion = {id: string; version: number; title: string; template: VisitorTemplate; fields: VisitorField[]; created_at: string};
export type SiteVisitorForms = {active: VisitorFormVersion | null; history: VisitorFormVersion[]};
export type VisitorOtp = {id: string; expires_at: string; verified: boolean; attempts_remaining: number};
export type OtpDelivery = {id: string; expires_at: string; provider: 'simulator'; demo_code: string | null; replayed: boolean};
export type VisitorInvitation = {site_name: string; expires_at: string; form: VisitorFormVersion | null; notice_version: 'demo-notice-v1'; demo: boolean; otp_provider?: 'simulator' | 'unavailable'; otp?: VisitorOtp | null};
export type VisitFormResponse = {form: VisitorFormVersion | null; answers: VisitorAnswers; acknowledged_at: string | null; anonymized_at: string | null};

export function parseVisitorFields(value: unknown): VisitorField[] {
  if (!Array.isArray(value) || value.length > 5) throw Error('Invalid visitor form');
  const seen = new Set<string>();
  return value.map(field => {
    if (!field || typeof field !== 'object' || Array.isArray(field) || Object.keys(field).length !== 2 ||
      !Object.hasOwn(field, 'key') || !Object.hasOwn(field, 'required') || typeof field.key !== 'string' ||
      !Object.hasOwn(visitorFieldCatalog, field.key) || typeof field.required !== 'boolean' || seen.has(field.key)) throw Error('Invalid visitor form');
    seen.add(field.key);
    return {key: field.key as VisitorFieldKey, required: field.required};
  });
}

/** Strict client validation mirrors migration 007; the database remains authoritative. */
export function validateVisitorAnswers(fields: VisitorField[], value: unknown): VisitorAnswers {
  const schema = parseVisitorFields(fields);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid visitor answers');
  const answers = value as Record<string, unknown>;
  if (Object.keys(answers).some(key => !schema.some(field => field.key === key))) throw Error('Unexpected visitor field');
  for (const {key, required} of schema) {
    const answer = answers[key], label = visitorFieldCatalog[key].label;
    if (!Object.hasOwn(answers, key)) { if (required) throw Error(`${label} is required`); continue; }
    if (key === 'party_size') {
      if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 1 || answer > 20) throw Error(`${label} must be a whole number from 1 to 20`);
    } else if (key === 'safety_ack') {
      if (typeof answer !== 'boolean' || (required && !answer)) throw Error(`${label} is required`);
    } else {
      if (typeof answer !== 'string') throw Error(`Invalid ${label.toLowerCase()}`);
      if (key === 'purpose' && !(visitorFieldCatalog.purpose.options as readonly string[]).includes(answer)) throw Error('Choose a listed visit purpose');
      if (key === 'company' && (!answer.trim() || [...answer].length > 80)) throw Error('Company or organization must be 1–80 characters');
      if (key === 'arrival_date') {
        const time = Date.parse(`${answer}T00:00:00Z`);
        if (!/^20\d{2}-\d{2}-\d{2}$/.test(answer) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== answer) throw Error('Choose a valid arrival date from 2000–2099');
      }
    }
  }
  return Object.fromEntries(schema.filter(field => Object.hasOwn(answers, field.key)).map(field => [field.key, answers[field.key]])) as VisitorAnswers;
}

export function collectVisitorAnswers(fields: VisitorField[], data: FormData): VisitorAnswers {
  const answers: VisitorAnswers = {};
  for (const field of parseVisitorFields(fields)) {
    const raw = data.get(`answer_${field.key}`);
    if (field.key === 'safety_ack') answers[field.key] = raw === 'on';
    else if (typeof raw === 'string' && raw.trim() !== '') answers[field.key] = field.key === 'party_size' ? Number(raw) : raw.trim();
  }
  return validateVisitorAnswers(fields, answers);
}
