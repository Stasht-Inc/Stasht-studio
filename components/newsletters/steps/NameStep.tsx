import type { Ref } from 'react';
import StepCard from '../StepCard';
import Field from './Field';
import { LIMITS } from '../lib/rules';
import { inputClass } from '../lib/ui';

export default function NameStep({ value, onChange, fieldError, stepError, readOnly, inputRef, autoFocus }: {
  value: string;
  onChange(value: string): void;
  fieldError?: string;
  stepError?: string;
  readOnly: boolean;
  inputRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
}) {
  return (
    <StepCard number={1} title="Campaign name" id="nl-step-name" error={stepError}>
      <Field id="nl-name" label="Name" required hint="This is for your reference only — subscribers won't see it." error={fieldError}>
        <input
          ref={inputRef}
          id="nl-name"
          type="text"
          value={value}
          maxLength={LIMITS.name}
          disabled={readOnly}
          autoFocus={autoFocus}
          aria-required="true"
          aria-invalid={Boolean(fieldError)}
          aria-describedby="nl-name-help"
          placeholder="e.g. October Newsletter 2026"
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(Boolean(fieldError))}
        />
      </Field>
    </StepCard>
  );
}
