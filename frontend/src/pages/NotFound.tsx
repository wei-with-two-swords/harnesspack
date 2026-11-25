import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="py-5 text-center">
      <div className="num fs-6xl fw-semibold fg-secondary opacity-25">404</div>
      <h1 className="mt-4 fs-2xl fw-semibold">{t('notfound.title')}</h1>
      <p className="mt-2 fs-sm fg-secondary">{t('notfound.desc')}</p>
      <Link to="/" className="btn btn-solid mt-4">
        {t('notfound.home')}
      </Link>
    </div>
  );
}
