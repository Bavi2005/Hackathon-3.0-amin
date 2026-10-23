import {visitorFieldCatalog, type VisitorField} from '../../../packages/contracts/visitor-forms';

export function VisitorFields({fields, disabled = false, defaultPurpose}: {fields: VisitorField[]; disabled?: boolean; defaultPurpose?: string}) {
  return <>{fields.map(field => {
    const info = visitorFieldCatalog[field.key], name = `answer_${field.key}`;
    const caption = `${info.label}${field.required ? ' (required)' : ' (optional)'}`;
    if (info.type === 'checkbox') return <label key={field.key} className="check"><input name={name} type="checkbox" required={field.required} disabled={disabled}/>{caption}</label>;
    return <label key={field.key}>{caption}{info.type === 'select' ? <select name={name} required={field.required} disabled={disabled} defaultValue={field.key==='purpose' && defaultPurpose ? defaultPurpose : ''}>
      <option value="">Choose purpose</option>{info.options.map(option => <option key={option}>{option}</option>)}
    </select> : <input name={name} type={info.type} required={field.required} disabled={disabled}
      {...(info.type === 'number' ? {min: info.min, max: info.max, step: 1} : info.type === 'text' ? {maxLength: info.maxLength} : {min: '2000-01-01', max: '2099-12-31'})}/>}</label>;
  })}</>;
}
