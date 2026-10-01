import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { getEntitlement } from './api';

const cache = new Map<string, Promise<boolean>>();

function adminStatus(user: User): Promise<boolean> {
  let pending = cache.get(user.uid);
  if (!pending) {
    pending = getEntitlement(user)
      .then(({ entitlement }) => entitlement.isAdmin === true)
      .catch(() => {
        cache.delete(user.uid);
        return false;
      });
    cache.set(user.uid, pending);
  }
  return pending;
}

export function useIsAdmin(user: User | null): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    setIsAdmin(null);
    void adminStatus(user).then((value) => {
      if (!cancelled) setIsAdmin(value);
    });
    return () => { cancelled = true; };
  }, [user]);

  return isAdmin;
}
