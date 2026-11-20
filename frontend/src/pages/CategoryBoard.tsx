import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useTitle } from '../lib/useTitle';
import type { BoardResponse } from '../types';
import { RankTable } from '../components/RankTable';
import { Pager } from '../components/Pager';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { categoryLabel } from '../lib/format';

const PAGE_SIZE = 100;

export default function CategoryBoard() {
  const { category = 'other' } = useParams<{ category: string }>();
  useTitle(`${categoryLabel(category)}榜`, '同一分类内按 star 总量排名。');
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [category]);

  const label = categoryLabel(category);
  const { data, error, loading } = useApi<BoardResponse>(
    () => api.board('total', undefined, category, PAGE_SIZE, page * PAGE_SIZE),
    [category, page],
  );

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs text-muted">
            <Link to="/categories" className="text-teal hover:underline">
              分类榜
            </Link>{' '}
            / {label}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-white">{label}榜</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            分类内按当前 star 总量排序，并列时按名称升序。
            {data?.as_of ? ` 截至 ${data.as_of}。` : ''}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
          该分类共 <span className="num text-body">{data?.total ?? '—'}</span> 个在册插件
        </div>
      </div>

      {error ? <ErrorState error={error} /> : null}
      {loading ? <Loading /> : null}
      {!loading && !error && data ? (
        data.items.length > 0 ? (
          <>
            <RankTable items={data.items} board="total" />
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={data.total ?? data.items.length}
              onChange={setPage}
            />
          </>
        ) : (
          <EmptyState title={`${label}榜暂无数据`}>该分类下还没有已入库的插件。</EmptyState>
        )
      ) : null}

      <div className="mt-6 text-sm">
        <Link to="/rankings/total" className="text-teal hover:underline">
          ← 返回总榜
        </Link>
      </div>
    </section>
  );
}
