import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import type { BoardResponse } from '../types';
import { BoardTabs, BOARD_TABS } from '../components/BoardTabs';
import { RankTable } from '../components/RankTable';
import { Pager } from '../components/Pager';
import { EmptyState, ErrorState, Loading } from '../components/States';

const BOARD_IDS = new Set<string>(BOARD_TABS.map((tab) => tab.id));
const PAGE_SIZE = 100;

const BOARD_TEXT: Record<string, string> = {
  velocity: '按今日新增 star 排序。只有相邻两个快照都存在时才计算增量。',
  growth: '按区间涨幅排序，基准日 star 需 ≥ 50。区间内缺任一快照则不参与计算。',
  total: '按当前 star 总量排序。并列时按名称升序。',
  darkhorse: '按区间内总榜名次跃升排序，正数为上升。',
  rookie: '收录名单内、仓库创建时间在最近 30 天的项目。',
};

export default function Rankings() {
  const { board = 'velocity' } = useParams<{ board: string }>();
  const [window, setWindow] = useState(7);
  const [page, setPage] = useState(0);
  const valid = BOARD_IDS.has(board);

  useEffect(() => {
    setWindow(7);
    setPage(0);
  }, [board]);

  useEffect(() => {
    setPage(0);
  }, [window]);

  const { data, error, loading } = useApi<BoardResponse>(
    () =>
      valid
        ? api.board(board, window, undefined, PAGE_SIZE, page * PAGE_SIZE)
        : Promise.reject(new Error(`未知榜单：${board}`)),
    [board, window, valid, page],
  );

  const label = BOARD_TABS.find((tab) => tab.id === board)?.label ?? board;
  const windowed = board === 'growth' || board === 'darkhorse';

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{label}榜</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {BOARD_TEXT[board] ?? '未知榜单'}
            {data?.as_of ? ` 截至 ${data.as_of}。` : ''}
          </p>
        </div>
        {windowed ? (
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1 text-xs">
            {[7, 30].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setWindow(option)}
                className={`rounded-md px-3 py-1.5 transition ${
                  window === option ? 'bg-raise text-white' : 'text-muted hover:text-body'
                }`}
              >
                近 {option} 天
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <BoardTabs active={board} />

      <div className="mt-4">
        {error ? <ErrorState error={error} /> : null}
        {loading ? <Loading /> : null}
        {!loading && !error && data ? (
          data.items.length > 0 ? (
            <>
              <RankTable items={data.items} board={board} />
              <Pager
                page={page}
                pageSize={PAGE_SIZE}
                total={data.total ?? data.items.length}
                onChange={setPage}
              />
            </>
          ) : (
            <EmptyState title={`${label}榜暂无数据`}>
              {data.reason ?? '首次快照已入库，等下一次快照后榜单开始生长。'}
            </EmptyState>
          )
        ) : null}
      </div>
    </section>
  );
}
