/** Compact inline SVG icons for composition and lyrics-mode chips. */

type IconProps = { className?: string };

function svgProps(className?: string) {
  return {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
}

export function SongKindIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M9 18a2.5 2.5 0 1 1-2.5-2.5" />
      <path d="M16.5 15.5a2.5 2.5 0 1 1-2.5-2.5" />
      <path d="M9 18V6.8l7.5-1.8V15.5" />
      <path d="M9 10.2l7.5-1.8" />
    </svg>
  );
}

export function MusicKindIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 14v-1.5a2.5 2.5 0 0 1 2.5-2.5H9" />
      <path d="M20 10v1.5a2.5 2.5 0 0 1-2.5 2.5H15" />
      <path d="M8 8.5v7M11 6v12M14 9v6M17 7.5v9" />
    </svg>
  );
}

export function PodcastKindIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 3.8a3.2 3.2 0 0 0-3.2 3.2v4.2a3.2 3.2 0 1 0 6.4 0V7A3.2 3.2 0 0 0 12 3.8Z" />
      <path d="M7.2 11.2a4.8 4.8 0 0 0 9.6 0" />
      <path d="M12 16v4.2M9.2 20.2h5.6" />
      <path d="M5.4 10.4a6.8 6.8 0 0 0 13.2 0" opacity="0.55" />
    </svg>
  );
}

export function DialogueKindIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4.5 6.2h9.2a2 2 0 0 1 2 2v4.1a2 2 0 0 1-2 2H9.1L6.2 17v-2.7H4.5a2 2 0 0 1-2-2V8.2a2 2 0 0 1 2-2Z" />
      <path d="M10.8 9.5h8.7a2 2 0 0 1 2 2v3.8a2 2 0 0 1-2 2h-1.3V20l-2.6-2.7h-1.8" opacity="0.7" />
    </svg>
  );
}

export function CustomLyricsIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M5.5 19.5 14.8 4.8l4.4 2.5L9.9 22.1Z" />
      <path d="M13.6 6.9 18 9.4" />
      <path d="M5.5 19.5l3.1.8.8-3.1" />
      <path d="M4.2 22h6.2" opacity="0.55" />
    </svg>
  );
}

export function GenerateLyricsIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 3.5v3.2M12 17.3v3.2M4.8 12H8M16 12h3.2" />
      <path d="M6.8 6.8l2.2 2.2M15 15l2.2 2.2M17.2 6.8 15 9M9 15l-2.2 2.2" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 8.4c2 0 3.6 1.6 3.6 3.6" opacity="0.55" />
    </svg>
  );
}

export function ImageLyricsIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
      <circle cx="9" cy="10.2" r="1.5" />
      <path d="m7.2 16.2 3.4-3.5 2.4 2.3 2.7-3.2 3.3 4.4" />
    </svg>
  );
}

export function RecordLyricsIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="12" cy="12" r="3.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="6.2" opacity="0.55" />
      <circle cx="12" cy="12" r="9" opacity="0.3" />
    </svg>
  );
}

export function InstrumentalLyricsIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 8.5h16M4 12h16M4 15.5h10" />
      <path d="M15.2 14.2 20 19M20 14.2l-4.8 4.8" />
    </svg>
  );
}

export function VariationLyricsIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M7 6.5v11" />
      <path d="M7 12h4.5a3 3 0 0 1 3 3v2.5" />
      <path d="M7 12h3a3.5 3.5 0 0 0 3.5-3.5V6.5" />
      <path d="m15.5 7.8 1.7-1.7L19 7.8" />
      <path d="m15.5 16.2 1.7 1.7L19 16.2" />
    </svg>
  );
}
