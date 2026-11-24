import { useEffect } from 'react';

const SUFFIX = 'HarnessPack · DSH 插件榜单';

/** Set document.title (and the description meta) for the current page. */
export function useTitle(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX;
    if (description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', description);
    }
  }, [title, description]);
}
