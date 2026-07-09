import AuthForms from '@/components/auth/AuthForms'

export default function Home() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e3f0ff 0%, #f0f4f8 60%, #e8f0fe 100%)',
        fontFamily: 'var(--font-geist-sans), -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '3rem 2rem',
          background: '#ffffff',
          borderRadius: '1.5rem',
          boxShadow: '0 8px 40px rgba(52, 71, 103, 0.12)',
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
            background: 'linear-gradient(135deg, #42a5f5 0%, #1565c0 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
            fontSize: '2.5rem',
          }}
        >
          <img src="/tenatimmy_solo.png" alt="logo" width={60} height={60}/>
        </div>

        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: '#344767',
            margin: '0 0 0.375rem',
            letterSpacing: '-0.01em',
          }}
        >
          Tena<span style={{ color: '#1976d2' }}>Timmy</span>
        </h1>

        <p
          style={{
            fontSize: '0.9375rem',
            color: '#7b809a',
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
