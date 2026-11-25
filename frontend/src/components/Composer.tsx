import { useState } from 'react';
import type { AuthUser } from '../lib/useAuth';

type Props = {
  user: AuthUser | null;
  onSubmit: (body: string) => Promise<void>;
  placeholder: string;
  buttonLabel: string;
  note?: string;
  maxLength?: number;
  rows?: number;
  autoFocus?: boolean;
};

/** Shared text-only composer for posts and comments. */
export function Composer({
  user,
  onSubmit,
  placeholder,
  buttonLabel,
  note,
  maxLength = 5000,
  rows = 3,
  autoFocus = false,
}: Props) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    return (
      <div className="card mb-3">
        <div className="card-body">
          <span className="fs-sm fg-secondary">{note ?? placeholder}</span>
        </div>
      </div>
    );
  }

  const submit = async () => {
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(text);
      setValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mb-3">
      <div className="card-body">
        <textarea
          className="form-control"
          rows={rows}
          maxLength={maxLength}
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        {error ? <div className="fs-xs mt-2 fg-danger">{error}</div> : null}
        <div className="d-flex align-items-center justify-content-between gap-2 mt-2 flex-wrap">
          <span className="fs-xs fg-secondary">
            {value.length}/{maxLength}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline theme-secondary"
            disabled={busy || value.trim().length === 0}
            onClick={() => void submit()}
          >
            {busy ? '…' : buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
