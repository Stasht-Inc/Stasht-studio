import StepCard from '../StepCard';
import Field from './Field';
import { LIMITS } from '../lib/rules';
import { inputClass } from '../lib/ui';

export default function FromStep({ fromName, replyTo, onChange, errors, stepError, readOnly }: {
  fromName: string;
  replyTo: string;
  onChange(patch: { from_name?: string; reply_to_email?: string }): void;
  errors: { from_name?: string; reply_to_email?: string };
  stepError?: string;
  readOnly: boolean;
}) {
  return (
    <StepCard number={3} title="From" id="nl-step-from" error={stepError}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="nl-from-name" label="From name" error={errors.from_name}>
          <input id="nl-from-name" type="text" value={fromName} maxLength={LIMITS.from_name} disabled={readOnly}
            aria-invalid={Boolean(errors.from_name)} aria-describedby="nl-from-name-help" placeholder="Your name or brand"
            onChange={(e) => onChange({ from_name: e.target.value })} className={inputClass(Boolean(errors.from_name))} />
        </Field>
        <Field id="nl-reply-to" label="Reply-to email" hint="Replies to your newsletter come here." error={errors.reply_to_email}>
          <input id="nl-reply-to" type="email" inputMode="email" autoComplete="email" value={replyTo} disabled={readOnly}
            aria-invalid={Boolean(errors.reply_to_email)} aria-describedby="nl-reply-to-help" placeholder="hello@yourbrand.com"
            onChange={(e) => onChange({ reply_to_email: e.target.value })} className={inputClass(Boolean(errors.reply_to_email))} />
        </Field>
      </div>
    </StepCard>
  );
}
