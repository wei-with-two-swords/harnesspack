import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CommunityAuth } from '../components/CommunityAuth';
import { PostCard } from '../components/PostCard';
import { EmptyState, Loading } from '../components/States';
import { api, ApiError } from '../lib/api';
import { formatDate } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/useAuth';

import { useTitle } from '../lib/useTitle';
import type { CommunityProfile } from '../types';

const PAGE_SIZE = 20;

export default function CommunityUser() {
  const { login = '' } = useParams();
  const { t } = useI18n();
  const auth = useAuth();
  const { user } = auth;
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [posts, setPosts] = useState<CommunityProfile['items']>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useTitle(`${login} · ${t('community.discussion')}`, t('community.subtitle'));

  const load = useCallback(
    async (offset: number, append = false) => {
      try {
        const data = await api.community.user(login, PAGE_SIZE, offset);
        setProfile(data);
        setPosts((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotal(data.total);
        setError('');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [login],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  const refresh = () => void load(0);

  return (
    <section style={{ maxWidth: 'var(--measure-mid)' }}>
      <Link to="/community" className="fs-sm fg-secondary text-decoration-none d-inline-block mb-3">
        <><ArrowLeft className="icon-leading" aria-hidden="true" />{t('community.backToFeed')}</>
      </Link>
      <CommunityAuth {...auth} />
      {error ? (
        <div className="card">
          <div className="card-body fs-sm fg-danger">{t('community.userNotFound')}</div>
        </div>
      ) : null}
      {loading ? <Loading /> : null}
      {profile ? (
        <>
          <div className="card mb-4">
            <div className="card-body d-flex align-items-center gap-3 flex-wrap">
              {profile.user.avatar_url ? (
                <img
                  src={profile.user.avatar_url}
                  alt=""
                  width="48"
                  height="48"
                  style={{ borderRadius: 'var(--radius-round)' }}
                />
              ) : null}
              <div>
                <div className="fw-semibold">{profile.user.name || profile.user.login}</div>
                <div className="fs-sm fg-secondary">
                  @{profile.user.login}
                  {profile.user.created_at
                    ? ` · ${t('community.joined')} ${formatDate(profile.user.created_at)}`
                    : ''}
                </div>
                <div className="fs-xs fg-secondary">
                  {t('community.posts')} {total}
                </div>
              </div>
            </div>
          </div>
          {posts.length === 0 ? (
            <EmptyState title={t('community.noPosts')}>{t('community.noPostsHint')}</EmptyState>
          ) : null}
          {posts.map((post) => (
            <PostCard key={post.id} post={post} user={user} onDelete={refresh} />
          ))}
          {posts.length < total ? (
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => void load(posts.length, true)}
            >
              {t('common.loadMore')}
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
