const paths: Record<string, string> = {
  files: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  'folder-plus': 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 10v6M9 13h6',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  'file-plus': 'M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14h6',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16 16l4.5 4.5',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  command: 'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  x: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  columns: 'M4 5h16v14H4zM12 5v14',
  'panel-left': 'M4 5h16v14H4zM9 5v14',
  'panel-right': 'M4 5h16v14H4zM15 5v14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v5M12 8h.01',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  book: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10',
  graph: 'M6 6a2 2 0 1 1 0 .1zM18 8a2 2 0 1 1 0 .1zM12 18a2 2 0 1 1 0 .1zM7.5 7l9 1M7 7.5l4.3 9M17 9.8l-4 6.6',
  folderOpen: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H7l-4 9z',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5 9-10',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
}

export function Icon({ name, size = 18, className }: { name: keyof typeof paths | string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={paths[name] ?? paths.file} />
    </svg>
  )
}

/** Wordmark glyph: three nodes joined underneath. Monochrome, follows the text colour. */
export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <path d="M5 7c0 6 7 4 7 11M19 7c0 6-7 4-7 11M12 5v13" />
      <circle cx="5" cy="5" r="2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="4" r="2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="2" fill="currentColor" stroke="none" />
    </svg>
  )
}
