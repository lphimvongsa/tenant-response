// Presentational placeholder shown when a property has no photo_url.
// No hooks / no client APIs, so it is safe to render inside both the
// server list page and the client PropertyProfile component.
// Sizing is controlled by the parent via `className`.

type Props = {
  className?: string
}

export default function PropertyPhotoPlaceholder({ className }: Props) {
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e8f0fe 0%, #d7e5fb 100%)',
      }}
    >
      <svg
        width="44"
        height="44"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7ba7dd"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
        <path d="M9 9h.01M9 12h.01M9 15h.01M9 18h.01" />
      </svg>
    </div>
  )
}
