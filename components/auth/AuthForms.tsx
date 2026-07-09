'use client'

import { useActionState, useState } from 'react'
import { signIn, signUp } from '@/app/login/actions'
import styles from './AuthForms.module.css'

type Mode = 'signin' | 'signup'

type SignInState = { error: string } | undefined
type SignUpState =
  | { error: string }
  | { success: true; needsEmailConfirmation: boolean }
  | undefined

export default function AuthForms() {
  const [mode, setMode] = useState<Mode>('signin')
  // Shared so an email typed on one tab (or captured after signup) carries over.
  const [email, setEmail] = useState('')

  const [signInState, signInAction, signInPending] = useActionState<SignInState, FormData>(
    async (_prev, formData) => signIn(formData),
    undefined,
  )

  const [signUpState, signUpAction, signUpPending] = useActionState<SignUpState, FormData>(
    async (_prev, formData) => signUp(formData),
    undefined,
  )

  const signedUp = signUpState !== undefined && 'success' in signUpState

  // After a successful signup show the confirmation panel instead of the form.
  if (mode === 'signup' && signedUp) {
    const needsConfirm =
      signUpState !== undefined && 'success' in signUpState && signUpState.needsEmailConfirmation

    return (
      <div className={styles.wrap}>
        <div className={styles.success}>
          <span className={styles.successIcon} aria-hidden="true">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <p className={styles.successMsg}>
            {needsConfirm
              ? 'Check your email to confirm your account, then sign in below.'
              : 'Account created — you can sign in now.'}
          </p>
          <button
            type="button"
            className={styles.submit}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
        </div>
        <Footer />
      </div>
    )
  }

  const signInError = signInState !== undefined && 'error' in signInState ? signInState.error : null
  const signUpError = signUpState !== undefined && 'error' in signUpState ? signUpState.error : null

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs} role="tablist" aria-label="Authentication">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className={`${styles.tab} ${mode === 'signin' ? styles.tabActive : ''}`}
          onClick={() => setMode('signin')}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
          onClick={() => setMode('signup')}
        >
          Create Account
        </button>
      </div>

      {mode === 'signin' ? (
        <form className={styles.form} action={signInAction} key="signin">
          {signInError && (
            <p className={styles.error} role="alert">
              {signInError}
            </p>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="signin-email">
              Email
            </label>
            <input
              id="signin-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={styles.input}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="signin-password">
              Password
            </label>
            <input
              id="signin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={styles.input}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className={styles.submit} disabled={signInPending}>
            {signInPending ? <span className={styles.spinner} aria-hidden="true" /> : null}
            {signInPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <form className={styles.form} action={signUpAction} key="signup">
          {signUpError && (
            <p className={styles.error} role="alert">
              {signUpError}
            </p>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="signup-name">
              Name
            </label>
            <input
              id="signup-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              className={styles.input}
              placeholder="Jane Manager"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="signup-email">
              Email
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={styles.input}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="signup-password">
              Password
            </label>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className={styles.input}
              placeholder="Create a password"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="signup-joinCode">
              Join code
            </label>
            <input
              id="signup-joinCode"
              name="joinCode"
              type="text"
              required
              className={styles.input}
              placeholder="Provided by your admin"
            />
          </div>

          <button type="submit" className={styles.submit} disabled={signUpPending}>
            {signUpPending ? <span className={styles.spinner} aria-hidden="true" /> : null}
            {signUpPending ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      )}

      <Footer />
    </div>
  )
}

function Footer() {
  return (
    <p className={styles.footer}>
      Don&rsquo;t have a join code, or aren&rsquo;t a client yet?{' '}
      <a href="mailto:lukas.verdancysolutions@gmail.com">lukas.verdancysolutions@gmail.com</a>
    </p>
  )
}
