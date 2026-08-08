import React from 'react'

const S = ({ children, size = 18 }) => (
  <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

export const Icon = {
  dashboard: (p) => <S {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></S>,
  games: (p) => <S {...p}><rect x="2" y="6" width="20" height="12" rx="4" /><line x1="7" y1="12" x2="7" y2="12" /><line x1="7" y1="10" x2="7" y2="14" /><line x1="5" y1="12" x2="9" y2="12" /><circle cx="16" cy="11" r="1" /><circle cx="18.5" cy="13.5" r="1" /></S>,
  sync: (p) => <S {...p}><path d="M21 12a9 9 0 0 1-9 9c-2.5 0-4.8-1-6.4-2.7" /><path d="M3 12a9 9 0 0 1 9-9c2.5 0 4.8 1 6.4 2.7" /><polyline points="21 3 21 8 16 8" /><polyline points="3 21 3 16 8 16" /></S>,
  folder: (p) => <S {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></S>,
  settings: (p) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6h.1A1.6 1.6 0 0 0 9 1.1V1a2 2 0 0 1 4 0v.1A1.6 1.6 0 0 0 15 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></S>,
  play: (p) => <S {...p}><polygon points="6 4 20 12 6 20 6 4" /></S>,
  search: (p) => <S {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></S>,
  x: (p) => <S {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></S>,
  check: (p) => <S {...p}><polyline points="20 6 9 17 4 12" /></S>,
  shield: (p) => <S {...p}><path d="M12 2 4 5v6c0 5 3.4 8.4 8 11 4.6-2.6 8-6 8-11V5z" /><polyline points="9 12 11 14 15 10" /></S>,
  drive: (p) => <S {...p}><rect x="3" y="4" width="18" height="8" rx="2" /><rect x="3" y="12" width="18" height="8" rx="2" /><line x1="7" y1="8" x2="7.01" y2="8" /><line x1="7" y1="16" x2="7.01" y2="16" /></S>,
  download: (p) => <S {...p}><path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><path d="M5 21h14" /></S>,
  refresh: (p) => <S {...p}><polyline points="23 4 23 10 17 10" /><path d="M20.5 15a9 9 0 1 1-2-9.7L23 10" /></S>,
  folderOpen: (p) => <S {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2H3z" /><path d="M3 9h18l-2 9a2 2 0 0 1-2 1.6H6.9A2 2 0 0 1 5 18z" /></S>,
  logo: ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="var(--accent)" />
      <path d="M8.5 9.5a4 4 0 1 1 3 6.6c-1 0-1.9-.4-2.6-1" stroke="var(--on-accent)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="15" cy="9" r="2.3" fill="var(--on-accent)" />
    </svg>
  )
}
