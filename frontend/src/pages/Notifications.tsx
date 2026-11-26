import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AtSign, Heart, Reply } from 'lucide-react';
import { CommunityAuth } from '../components/CommunityAuth';
import { Pager } from '../components/Pager';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { api, ApiError } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/useAuth';
import { useTitle } from '../lib/useTitle';
import type { CommunityNotification } from '../types';

const PAGE_SIZE = 20;

const ICONS = {
  mention: AtSign,
  reply: Reply,
  like: Heart,
} as const;

export default function Notifications() {
  const { t } = useI18n();
  useTitle(t('notif.title'));
  const auth = useAuth();
  const { user, loading: authLoading, oauthEnabled } = auth;
  const [items, setItems] = useState<CommunityNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (nextPage: number) => {
    try {
      const data = await api.community.notifications(PAGE_SIZE, nextPage * PAGE_SIZE);
      setItems(data.items);
      setTotal(data.total);
      setError('');
      // Opening the inbox counts as reading it.
      if (data.unread > 0) {
        void api.community.markRead().catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void load(page);
  }, [user, load, page]);

  if (!oauthEnabled || authLoading) {
    return loading ? <Loading /> : null;
  }

  if (!user) {
    return (
      <section>
        <h1 className="fs-3xl fw-semibold mb-4">{t('notif.title')}</h1>
        <div className="card">
          <div className="card-body">
            <CommunityAuth {...auth} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4">
        <h1 className="fs-3xl fw-semibold mb-1">{t('notif.title')}</h1>
        <p className="fs-sm fg-secondary mb-0">{t('notif.subtitle')}</p>
      </div>

      {error ? <ErrorState error={new Error(error)} /> : null}
      {loading ? <Loading /> : null}
      {!loading && items.length === 0 && !error ? (
        <EmptyState title={t('notif.empty')}>{t('notif.emptyHint')}</EmptyState>
      ) : null}
      {items.map((item) => {
        const Icon = ICONS[item.kind];
        return (
          <Link
            key={item.id}
            to={`/community/p/${item.post_id}`}
            className={`card mb-2 text-decoration-none notif-row${item.is_read ? '' : ' notif-unread'}`}
          >
            <div className="card-body d-flex align-items-start gap-3 py-3">
              <Icon aria-hidden="true" className="flex-shrink-0 mt-1" size={16} />
              <div className="min-w-0 flex-grow-1">
                <div className="fs-sm">
                  <span className="fw-medium">
                    {item.actor ? item.actor.name || item.actor.login : ''}
                  </span>{' '}
                  {t(`notif.${item.kind}`)}
                </div>
                <div className="fs-xs fg-secondary text-truncate">{item.excerpt}</div>
              </div>
              <span className="fs-xs fg-secondary flex-shrink-0 num">
                {formatDateTime(item.created_at)}
              </span>
            </div>
          </Link>
        );
      })}
      {!loading && items.length > 0 ? (
        <Pager page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
      ) : null}
    </section>
  );
}
