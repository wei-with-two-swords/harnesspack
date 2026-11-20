import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useTitle } from '../lib/useTitle';
import { formatDate } from '../lib/format';
import { EmptyState, ErrorState, Loading } from '../components/States';
import type { ChangelogEntry, ChangelogResponse } from '../types';

function Chip({ name }: { name: string }) {
  return (
    <span className="rounded-md border border-line bg-raise px-2 py-0.5 text-[11px] text-muted">
      {name}
    </span>
  );
}

function Entry({ entry }: { entry: ChangelogEntry }) {
  const lists: { label: string; count: number; sample: string[]; tone: string }[] = [
    { label: '新增', count: entry.added, sample: entry.added_sample, tone: 'text-rise' },
    { label: '移除', count: entry.removed, sample: entry.removed_sample, tone: 'text-fall' },
    { label: '变更', count: entry.changed, sample: entry.changed_sample, tone: 'text-gold' },
  ];
  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-body">{entry.at ? entry.at.replace('T', ' ').slice(0, 16) : '未知时间'}</span>
        {lists.map((list) =>
          list.count > 0 ? (
            <span key={list.label} className={`text-xs ${list.tone}`}>
              {list.label} {list.count}
            </span>
          ) : null,
        )}
        {entry.added === 0 && entry.removed === 0 && entry.changed === 0 ? (
          <span className="text-xs text-muted">无变化</span>
        ) : null}
      </div>
      {entry.added_sample.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {entry.added_sample.map((name) => (
            <Chip key={name} name={name} />
          ))}
          {entry.added > entry.added_sample.length ? (
            <span className="text-[11px] text-muted">等 {entry.added} 个</span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function Changelog() {
  useTitle('名单变更', 'HarnessPack 收录名单的进入、退出与变更记录，来自 awesome-dsh-plugin 清单同步。');
  const { data, error, loading } = useApi<ChangelogResponse>(() => api.changelog(50), []);

  return (
    <section>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-white">名单变更</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          每次同步上游清单后记录新增、移除与变更的仓库。完整规则见{' '}
          <Link to="/about/rules" className="text-teal hover:underline">
            收录规则
          </Link>
          ，名单源文件与变更日志都在公开仓库里可审计。
        </p>
      </div>

      {error ? <ErrorState error={error} /> : null}
      {loading ? <Loading /> : null}
      {!loading && !error && data ? (
        data.items.length > 0 ? (
          <ul className="card divide-y divide-line/60 overflow-hidden">
            {data.items.map((entry) => (
              <Entry key={`${entry.at}-${entry.added}-${entry.removed}`} entry={entry} />
            ))}
          </ul>
        ) : (
          <EmptyState title="还没有变更记录">下次同步上游清单后会在这里展示。</EmptyState>
        )
      ) : null}

      {data?.as_of ? (
        <p className="mt-4 text-xs text-muted">
          数据截至 {formatDate(data.as_of)} · 来自 awesome-dsh-plugin 清单同步
        </p>
      ) : null}
    </section>
  );
}
