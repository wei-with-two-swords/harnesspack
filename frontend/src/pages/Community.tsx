import { useCallback, useEffect, useState } from 'react';
import { CommunityAuth } from '../components/CommunityAuth';
import { Composer } from '../components/Composer';
import { Pager } from '../components/Pager';
import { PostCard } from '../components/PostCard';
import { EmptyState, Loading } from '../components/States';
import { api, ApiError } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/useAuth';
import { useTitle } from '../lib/useTitle';
import type { CommunityPost } from '../types';

const PAGE_SIZE = 10;

export default function Community() {
  const { t } = useI18n();
  useTitle(t('community.discussion'), t('community.subtitle'));
  const auth = useAuth();
  const { user } = auth;
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (nextPage: number) => {
    try {
      const data = await api.community.posts(PAGE_SIZE, nextPage * PAGE_SIZE);
      setPosts(data.items);
      setTotal(data.total);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const publish = async (body: string) => {
    await api.community.createPost(body);
    if (page === 0) void load(0);
    else setPage(0);
  };

  return (
    <section>
      <div className="mb-4">
        <h1 className="fs-3xl fw-semibold mb-1">{t('community.discussion')}</h1>
        <p className="fs-sm fg-secondary mb-0">{t('community.subtitle')}</p>
      </div>

      <div className="community-grid">
        <div>
          <Composer
            user={user}
            onSubmit={publish}
            placeholder={t('community.postPlaceholder')}
            buttonLabel={t('community.publish')}
          />

          {error ? <div className="fs-sm mb-3 fg-danger">{error}</div> : null}
          {loading ? <Loading /> : null}
          {!loading && posts.length === 0 ? (
            <EmptyState title={t('community.noPosts')}>{t('community.noPostsHint')}</EmptyState>
          ) : null}
          {posts.map((post) => (
            <PostCard key={post.id} post={post} user={user} onDelete={() => void load(page)} />
          ))}
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
        </div>

        <div>
          <div className="card">
            <div className="card-body">
              <CommunityAuth {...auth} />
              <div className="fw-semibold mb-2">{t('community.rulesTitle')}</div>
              <ul className="fs-sm fg-secondary mb-0 ps-3">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <li key={n} className="mb-1">
                    {t(`community.rule${n}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
