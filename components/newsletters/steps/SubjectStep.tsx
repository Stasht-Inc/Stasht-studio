import StepCard from '../StepCard';
import Field from './Field';
import { LIMITS } from '../lib/rules';
import { inputClass } from '../lib/ui';

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
            aria-invalid={Boolean(errors.subject)} aria-describedby="nl-subject-help" placeholder="What's this email about?"
            onChange={(e) => onChange({ subject: e.target.value })} className={inputClass(Boolean(errors.subject))} />
        </Field>
        <Field id="nl-preview-text" label="Preview text" optional hint="Appears after the subject line in most email clients." error={errors.preview_text}>
          <input id="nl-preview-text" type="text" value={previewText} maxLength={LIMITS.preview_text} disabled={readOnly}
            aria-invalid={Boolean(errors.preview_text)} aria-describedby="nl-preview-text-help" placeholder="A short teaser shown in the inbox…"
            onChange={(e) => onChange({ preview_text: e.target.value })} className={inputClass(Boolean(errors.preview_text))} />
        </Field>
      </div>
    </StepCard>
  );
}
