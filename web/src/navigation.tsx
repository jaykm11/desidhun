import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface LocationState {
  pathname: string;
  search: string;
}

const LocationContext = createContext<LocationState>({ pathname: '/', search: '' });

export function useLocation(): LocationState {
  return useContext(LocationContext);
}

/** Same-origin navigations stay in the page so playback is not torn down. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<LocationState>(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
  }));

  useEffect(() => {
    const sync = () => setLocation({
      pathname: window.location.pathname,
      search: window.location.search,
    });
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest('a');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next === current) return;
      window.history.pushState({}, '', next);
      sync();
    };
    window.addEventListener('popstate', sync);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('popstate', sync);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return <LocationContext.Provider value={location}>{children}</LocationContext.Provider>;
}
