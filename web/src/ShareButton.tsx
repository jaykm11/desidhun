import { useEffect, useState } from 'react';
import {
  canUseSystemShare,
  copyShareableLink,
  emailShareUrl,
  shareDesiDhunLink,
  whatsAppShareUrl,
} from './lib/share';

export function ShareMenu({
  songId,
  title,
  className,
  onBeforeShare,
}: {
  songId: string;
  title: string;
  className?: string;
  onBeforeShare?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('Share');

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) {
        setOpen(false);
        return;
      }
      if (!event.target.closest('.share-menu')) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const flash = (next: string) => {
    setLabel(next);
    window.setTimeout(() => {
      setLabel('Share');
      setOpen(false);
    }, 1_200);
  };

  const run = async (action: () => Promise<'copied' | 'shared' | 'opened' | 'cancelled'>) => {
    if (busy) return;
    setBusy(true);
    try {
      await onBeforeShare?.();
      const result = await action();
      if (result === 'cancelled') return;
      flash(result === 'shared' ? 'Shared' : result === 'opened' ? 'Opened' : 'Link copied');
    } catch {
      flash('Could not share');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`share-menu${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="share-menu-trigger"
        onClick={() => setOpen((current) => !current)}
        disabled={busy}
        aria-expanded={open}
      >
        {busy && label === 'Share' ? 'Preparing…' : label}
      </button>
      {open && (
        <div className="share-menu-options" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => void run(async () => {
              await copyShareableLink(songId);
              return 'copied';
            })}
          >
            Copy shareable link
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void run(async () => {
              window.open(whatsAppShareUrl(songId, title), '_blank', 'noopener,noreferrer');
              return 'opened';
            })}
          >
            WhatsApp
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void run(async () => {
              window.location.assign(emailShareUrl(songId, title));
              return 'opened';
            })}
          >
            Email
          </button>
          {canUseSystemShare() && (
            <button
              type="button"
              role="menuitem"
              onClick={() => void run(async () => {
                const result = await shareDesiDhunLink({ id: songId, title });
                return result;
              })}
            >
              More apps…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** @deprecated Prefer ShareMenu for explicit copy / WhatsApp / email options. */
export function ShareButton(props: {
  songId: string;
  title: string;
  className?: string;
  onBeforeShare?: () => Promise<void>;
}) {
  return <ShareMenu {...props} />;
}
