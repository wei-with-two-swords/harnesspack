import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useTitle } from '../lib/useTitle';

export default function Subscribe() {
  const { t } = useI18n();
  useTitle(t('subscribe.title'), t('subscribe.subtitle'));
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState('');

  const status = params.get('status');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setDone(null);
    try {
      const result = await api.subscribe(email);
      setDone(
        result.status === 'already'
          ? t('subscribe.already')
          : t('subscribe.confirmSent', { email }),
      );
      setEmail('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 422
            ? t('subscribe.invalidEmail')
            : err.status === 502
              ? t('subscribe.mailFailed')
              : err.message,
        );
      } else {
        setError(String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ maxWidth: 'var(--measure-compact)' }}>
      <div className="mb-4">
        <h1 className="fs-3xl fw-semibold mb-1">{t('subscribe.title')}</h1>
        <p className="fs-sm fg-secondary mb-0">{t('subscribe.subtitle')}</p>
      </div>

      {status === 'confirmed' ? (
        <div className="alert theme-success" role="status">
          {t('subscribe.confirmed')}
        </div>
      ) : null}
      {status === 'unsubscribed' ? (
        <div className="alert theme-success" role="status">
          {t('subscribe.unsubscribed')}
        </div>
      ) : null}
      {status === 'invalid' ? (
        <div className="alert theme-danger bg-subtle-danger" role="alert">
          {t('subscribe.linkInvalid')}
        </div>
      ) : null}

      <div className="card">
        <div className="card-body">
          <p className="fs-sm fg-secondary mb-3">{t('subscribe.howItWorks')}</p>
          <form onSubmit={submit} className="d-flex gap-2 flex-wrap">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('subscribe.emailPlaceholder')}
              aria-label={t('subscribe.emailPlaceholder')}
              className="form-control"
              style={{ maxWidth: '20rem' }}
            />
            <button type="submit" className="btn btn-solid" disabled={busy}>
              {busy ? t('subscribe.subscribing') : t('subscribe.subscribe')}
            </button>
          </form>
          {error ? <div className="fs-sm mt-3 fg-danger">{error}</div> : null}
          {done ? <div className="fs-sm mt-3 fg-success">{done}</div> : null}
          <div className="fs-xs fg-secondary mt-3">{t('subscribe.privacyNote')}</div>
        </div>
      </div>
    </section>
  );
}
