import { useCallback, useEffect, useState } from 'react';

export type AuthUser = {
  login: string;
  name: string | null;
  avatar_url: string | null;
};

/** Reads the signed session cookie via /api/auth/me. */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthEnabled, setOauthEnabled] = useState(false);

  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { enabled?: boolean } | null) => setOauthEnabled(Boolean(data?.enabled)))
      .catch(() => setOauthEnabled(false));
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AuthUser | null) => {
        if (alive) setUser(data);
      })
      .catch(() => {
        if (alive) setUser(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout');
    setUser(null);
  }, []);

  return { user, loading, oauthEnabled, signOut };
}
