import { Link } from 'react-router-dom';
import { formatNumber } from '../lib/format';
import type { CommunityPluginCard as Card } from '../types';

/** Compact card resolved from an @owner/name mention or a /plugins/... link. */
export function PluginCard({ card }: { card: Card }) {
  return (
    <Link
      to={`/plugins/${card.slug}`}
      className="d-flex align-items-center gap-3 px-3 py-2 rounded text-decoration-none mt-2"
      style={{ background: 'var(--surface-2)', maxWidth: 'var(--measure-card)' }}
    >
      <div className="min-w-0 flex-grow-1">
        <div className="fw-medium text-truncate">{card.name}</div>
        <div className="fs-xs fg-secondary text-truncate">
          {card.owner}/{card.repo}
          {card.description ? ` · ${card.description}` : ''}
        </div>
      </div>
      <div className="flex-shrink-0 text-end">
        <div className="fs-xs fg-secondary">STAR</div>
        <div className="fs-sm fw-medium num">
          {card.stars_latest === null ? '—' : formatNumber(card.stars_latest)}
        </div>
      </div>
    </Link>
  );
}
