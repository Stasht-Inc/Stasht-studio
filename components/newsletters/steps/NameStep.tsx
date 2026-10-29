import type { Ref } from 'react';
import StepCard from '../StepCard';
import Field, { helpId } from './Field';
import { LIMITS } from '../lib/rules';
import { inputClass } from '../lib/ui';

const NAME_HINT = 'Subscribers see the subject line, not the name.';
const PREVIEW_HINT = 'Appears after the subject line in most email clients.';

/** Step 1 (Chris, 29 Oct): the name, then the subject line and preview text people see in their inbox. */
export default function NameStep({ name, subject, previewText, onNameChange, onChange, errors, stepError, readOnly, inputRef, autoFocus }: {
  name: string;
  subject: string;
  previewText: string;
  /** The name changed (the composer lets a subject that still follows the name follow it). */
  onNameChange(value: string): void;
  onChange(patch: { subject?: string; preview_text?: string }): void;
  errors: { name?: string; subject?: string; preview_text?: string };
  stepError?: string;
  readOnly: boolean;
  inputRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
}) {
  return (
    <StepCard number={1} title="Name and subject" id="nl-step-name" error={stepError}>
      <div className="space-y-4">
        <Field id="nl-name" label="Name" required hint={NAME_HINT} error={errors.name}>
          <input
            ref={inputRef}
            id="nl-name"
            type="text"
            value={name}
            maxLength={LIMITS.name}
            disabled={readOnly}
            autoFocus={autoFocus}
            aria-required="true"
            aria-invalid={Boolean(errors.name)}
            aria-describedby="nl-name-help"
            placeholder="e.g. October Newsletter 2026"
            onChange={(e) => onNameChange(e.target.value)}
            className={inputClass(Boolean(errors.name))}
          />
        </Field>
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
