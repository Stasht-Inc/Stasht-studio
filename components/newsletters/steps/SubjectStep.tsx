import StepCard from '../StepCard';
import Field, { helpId } from './Field';
import { LIMITS } from '../lib/rules';
import { inputClass } from '../lib/ui';

const PREVIEW_HINT = 'Appears after the subject line in most email clients.';

export default function SubjectStep({ subject, previewText, onChange, errors, stepError, readOnly }: {
  subject: string;
  previewText: string;
  onChange(patch: { subject?: string; preview_text?: string }): void;
  errors: { subject?: string; preview_text?: string };
  stepError?: string;
  readOnly: boolean;
}) {
  return (
    <StepCard number={4} title="Subject" id="nl-step-subject" error={stepError}>
      <div className="space-y-4">
        <Field id="nl-subject" label="Subject line" required error={errors.subject}>
          <input id="nl-subject" type="text" value={subject} maxLength={LIMITS.subject} disabled={readOnly} aria-required="true"
            aria-invalid={Boolean(errors.subject)} aria-describedby={helpId('nl-subject', null, errors.subject)} placeholder="What's this email about?"
            onChange={(e) => onChange({ subject: e.target.value })} className={inputClass(Boolean(errors.subject))} />
        </Field>
        <Field id="nl-preview-text" label="Preview text" optional hint={PREVIEW_HINT} error={errors.preview_text}>
          <input id="nl-preview-text" type="text" value={previewText} maxLength={LIMITS.preview_text} disabled={readOnly}
            aria-invalid={Boolean(errors.preview_text)} aria-describedby={helpId('nl-preview-text', PREVIEW_HINT, errors.preview_text)} placeholder="A short teaser shown in the inbox…"
            onChange={(e) => onChange({ preview_text: e.target.value })} className={inputClass(Boolean(errors.preview_text))} />
        </Field>
      </div>
    </StepCard>
  );
}
