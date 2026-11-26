import { useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { copyText } from '../lib/clipboard';
import { useI18n } from '../lib/i18n';

type Item = Record<string, string | number | boolean | null>;

type Props = {
  /** Fetch one page of the current view (board or directory). */
  fetchPage: (limit: number, offset: number) => Promise<{ items: unknown[]; total?: number }>;
  /** Short view name used in the filename, e.g. velocity-7. */
  fileHint: string;
};

const PAGE_SIZE = 200;
const EXPORT_CAP = 2000;

const COLUMNS = [
  'rank', 'name', 'owner', 'repo', 'slug', 'stars', 'stars_latest', 'delta',
  'category', 'harness', 'npm_package', 'url', 'added_at', 'repo_created_at',
];

function csvField(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(items: Item[]): string {
  const columns = COLUMNS.filter((key) => items.some((item) => key in item));
  const rows = items.map((item) => columns.map((key) => csvField(item[key])).join(','));
  return `${columns.join(',')}\n${rows.join('\n')}\n`;
}

function download(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Export the current view to CSV/JSON and copy a shareable view link. */
export function BoardToolbar({ fetchPage, fileHint }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const loadAll = async () => {
    const items: Item[] = [];
    const first = await fetchPage(PAGE_SIZE, 0);
    items.push(...(first.items as Item[]));
    const total = Math.min(first.total ?? first.items.length, EXPORT_CAP);
    for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
      const page = await fetchPage(PAGE_SIZE, offset);
      items.push(...(page.items as Item[]));
      if (!page.items.length) break;
    }
    return items;
  };

  const exportAs = async (format: 'csv' | 'json') => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const items = await loadAll();
      if (format === 'csv') {
        download(toCsv(items), 'text/csv;charset=utf-8', `harnesspack-${fileHint}.csv`);
      } else {
        download(JSON.stringify(items, null, 2), 'application/json', `harnesspack-${fileHint}.json`);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (await copyText(window.location.href)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="d-flex align-items-center gap-2 fs-xs fg-secondary flex-wrap">
      <button type="button" className="btn btn-text btn-sm p-0" onClick={() => void share()}>
        <Copy aria-hidden="true" size={13} /> {copied ? t('toolbar.copied') : t('toolbar.share')}
      </button>
      <button type="button" className="btn btn-text btn-sm p-0" onClick={() => void exportAs('csv')} disabled={busy}>
        <Download aria-hidden="true" size={13} /> {t('toolbar.exportCsv')}
      </button>
      <button type="button" className="btn btn-text btn-sm p-0" onClick={() => void exportAs('json')} disabled={busy}>
        <Download aria-hidden="true" size={13} /> {t('toolbar.exportJson')}
      </button>
      {busy ? <span>{t('toolbar.exporting')}</span> : null}
      {error ? <span className="fg-danger">{t('toolbar.exportFailed')}</span> : null}
    </div>
  );
}
