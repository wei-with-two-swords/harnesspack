import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { api } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { formatDateTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { AuthUser } from '../lib/useAuth';
import type { CommunityPost } from '../types';
import { PluginCard } from './PluginCard';
import { PostBody } from './PostBody';

type Props = {
  post: CommunityPost;
  user: AuthUser | null;
  onDelete: () => void;
  detail?: boolean;
};

export function PostCard({ post, user, onDelete, detail = false }: Props) {
  const { t } = useI18n();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLiked(post.liked_by_me);
    setLikeCount(post.like_count);
  }, [post.liked_by_me, post.like_count]);

  const owned = user?.login.toLowerCase() === post.author.login.toLowerCase();
  const permalink = `${window.location.origin}/community/p/${post.id}`;

  const toggleLike = async () => {
    if (!user) {
      window.location.href = '/api/auth/github';
      return;
    }
    try {
      const result = await api.community.like(post.id);
      setLiked(result.liked);
      setLikeCount(result.like_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const copy = async () => {
    setCopied(await copyText(permalink));
    window.setTimeout(() => setCopied(false), 1800);
  };

  const remove = async () => {
    try {
      await api.community.deletePost(post.id);
      onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <article className="card mb-3">
      <div className="card-body">
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          {post.author.avatar_url ? (
            <img
              src={post.author.avatar_url}
              alt=""
              width="24"
              height="24"
              style={{ borderRadius: 'var(--radius-round)' }}
            />
          ) : null}
          <Link
            to={`/community/u/${encodeURIComponent(post.author.login)}`}
            className="text-decoration-none fw-medium"
          >
            {post.author.name || post.author.login}
          </Link>
          <span className="fs-xs fg-secondary">@{post.author.login}</span>
          <span className="fs-xs fg-secondary">·</span>
          <span className="fs-xs fg-secondary">{formatDateTime(post.created_at)}</span>
          {detail ? null : (
            <Link
              to={`/community/p/${post.id}`}
              className="fs-xs fg-secondary text-decoration-none ms-auto"
            >
              #{post.id}
            </Link>
          )}
        </div>

        <PostBody body={post.body} />

        {post.plugins.map((card) => (
          <PluginCard key={card.slug} card={card} />
        ))}

        {error ? <div className="fs-xs mt-2 fg-danger">{error}</div> : null}

        <div className="d-flex align-items-center gap-3 mt-3 flex-wrap fs-xs fg-secondary">
          <button
            type="button"
            className="btn btn-sm btn-text p-0"
            onClick={() => void toggleLike()}
            aria-pressed={liked}
            title={t('community.like')}
          >
            <span style={{ color: liked ? 'var(--blue)' : undefined }}>
              <Heart aria-hidden="true" fill={liked ? 'currentColor' : 'none'} /> {likeCount}
            </span>
          </button>
          {detail ? null : (
            <Link
              to={`/community/p/${post.id}`}
              className="text-decoration-none"
            >
              {t('community.comments')} {post.comment_count}
            </Link>
          )}
          <button type="button" className="btn btn-sm btn-text p-0" onClick={() => void copy()}>
            {copied ? t('community.copied') : t('community.copyLink')}
          </button>
          {owned ? (
            <button type="button" className="btn btn-sm btn-text p-0 fg-danger" onClick={() => void remove()}>
              {t('community.delete')}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
