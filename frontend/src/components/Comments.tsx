import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { AuthUser } from '../lib/useAuth';
import type { CommunityComment } from '../types';
import { Composer } from './Composer';
import { PluginCard } from './PluginCard';
import { PostBody } from './PostBody';

const PAGE_SIZE = 50;

type Props = {
  postId: number;
  user: AuthUser | null;
  onChanged: () => void;
};

export function Comments({ postId, user, onChanged }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<CommunityComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (offset: number, append = false) => {
      try {
        const data = await api.community.comments(postId, PAGE_SIZE, offset);
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [postId],
  );

  useEffect(() => {
    setLoading(true);
    void load(0);
  }, [load]);

  const add = async (body: string) => {
    const created = await api.community.createComment(postId, body);
    setItems((prev) => [...prev, created]);
    setTotal((value) => value + 1);
    onChanged();
  };

  const remove = async (id: number) => {
    try {
      await api.community.deleteComment(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((value) => Math.max(0, value - 1));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className="mt-4">
      <h2 className="fs-lg fw-semibold mb-3">
        {t('community.comments')}
        {total > 0 ? <span className="fg-secondary fw-normal"> ({total})</span> : ''}
      </h2>
      <Composer
        user={user}
        onSubmit={add}
        placeholder={t('community.commentPlaceholder')}
        buttonLabel={t('community.reply')}
        maxLength={1000}
        rows={2}
      />
      {error ? <div className="fs-xs mb-2 fg-danger">{error}</div> : null}
      {loading ? <div className="fs-sm fg-secondary">{t('common.loading')}</div> : null}
      {items.map((item) => {
        const owned = user?.login.toLowerCase() === item.author.login.toLowerCase();
        return (
          <div key={item.id} className="card mb-2">
            <div className="card-body">
              <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                {item.author.avatar_url ? (
                  <img
                    src={item.author.avatar_url}
                    alt=""
                    width="20"
                    height="20"
                    style={{ borderRadius: 'var(--radius-round)' }}
                  />
                ) : null}
                <Link
                  to={`/community/u/${encodeURIComponent(item.author.login)}`}
                  className="text-decoration-none fw-medium fs-sm"
                >
                  {item.author.name || item.author.login}
                </Link>
                <span className="fs-xs fg-secondary">@{item.author.login}</span>
                <span className="fs-xs fg-secondary">·</span>
                <span className="fs-xs fg-secondary">{formatDateTime(item.created_at)}</span>
                {owned ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-text p-0 ms-auto fg-danger"
                    onClick={() => void remove(item.id)}
                  >
                    {t('community.delete')}
                  </button>
                ) : null}
              </div>
              <PostBody body={item.body} />
              {item.plugins.map((card) => (
                <PluginCard key={card.slug} card={card} />
              ))}
            </div>
          </div>
        );
      })}
      {items.length < total ? (
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => void load(items.length, true)}
        >
          {t('common.loadMore')}
        </button>
      ) : null}
    </section>
  );
}
