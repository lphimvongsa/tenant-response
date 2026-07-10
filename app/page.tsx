import AuthForms from '@/components/auth/AuthForms'

export default function Home() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-base)',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '3rem 2rem',
          background: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card-hover)',
          maxWidth: '420px',
          width: '100%',
          margin: '1rem',
        }}
      >
        {/* Logo area */}
        <div
          style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            background: 'var(--color-ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: 'var(--shadow-button-hover)',
            fontSize: '2.5rem',
          }}
        >
          <img src="/tenatimmy_solo.png" alt="logo" width={60} height={60}/>
        </div>

        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: '0 0 0.375rem',
            letterSpacing: '-0.01em',
          }}
        >
          Tena<span style={{ color: 'var(--color-text-secondary)' }}>Timmy</span>
        </h1>

        <p
          style={{
            fontSize: '0.9375rem',
            color: 'var(--color-text-secondary)',
            margin: '0 0 2rem',
            lineHeight: 1.6,
          }}
        >
          AI-powered tenant communication, simplified.
        </p>

        <AuthForms />
      </div>
    </div>
  )
}
