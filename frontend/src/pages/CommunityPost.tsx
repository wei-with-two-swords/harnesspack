import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Comments } from '../components/Comments';
import { CommunityAuth } from '../components/CommunityAuth';
import { PostCard } from '../components/PostCard';
import { Loading } from '../components/States';
import { api, ApiError } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/useAuth';
import { useTitle } from '../lib/useTitle';
import type { CommunityPost } from '../types';

export default function CommunityPost() {
  const { id } = useParams();
  const postId = Number(id);
  const { t } = useI18n();
  const auth = useAuth();
  const { user } = auth;
  const navigate = useNavigate();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useTitle(t('community.discussion'), t('community.subtitle'));

  const load = useCallback(async () => {
    try {
      setPost(await api.community.post(postId));
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!Number.isInteger(postId)) {
      setError(t('community.postNotFound'));
      setLoading(false);
      return;
    }
    void load();
  }, [load, postId, t]);

  return (
    <section style={{ maxWidth: 'var(--measure-mid)' }}>
      <Link to="/community" className="fs-sm fg-secondary text-decoration-none d-inline-block mb-3">
        ← {t('community.backToFeed')}
      </Link>
      <CommunityAuth {...auth} />
      {error ? (
        <div className="card">
          <div className="card-body fs-sm fg-danger">{t('community.postNotFound')}</div>
        </div>
      ) : null}
      {loading ? <Loading /> : null}
      {post ? (
        <>
          <PostCard
            post={post}
            user={user}
            detail
            onDelete={() => navigate('/community')}
          />
          <Comments
            postId={post.id}
            user={user}
            onChanged={() => void load()}
          />
        </>
      ) : null}
    </section>
  );
}
