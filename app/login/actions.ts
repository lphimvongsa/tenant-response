'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/integrations/supabase-auth'
import { supabase as supabaseAdmin } from '@/lib/integrations/supabase'

export async function signIn(formData: FormData): Promise<{ error: string } | undefined> {
  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { error: 'Email and password are required' }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signUp(
  formData: FormData,
): Promise<{ error: string } | { success: true; needsEmailConfirmation: boolean }> {
  const name = formData.get('name')
  const email = formData.get('email')
  const password = formData.get('password')
  const joinCode = formData.get('joinCode')

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof joinCode !== 'string' ||
    !name.trim() ||
    !email ||
    !password ||
    !joinCode.trim()
  ) {
    return { error: 'Name, email, password, and join code are required' }
  }

  // Anon/session client can't read `clients` pre-auth (RLS) — use the
  // service-role client for the join-code lookup, same as elsewhere.
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('join_code', joinCode.trim())
    .single()

  if (clientError || !client) {
    return {
      error:
        "That code isn't recognized. Email lukas.verdancysolutions@gmail.com if you don't have one yet or aren't a client.",
    }
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: name.trim() } },
  })

  if (error) {
    return { error: error.message }
  }

  if (!data.user) {
    console.error('supabase.auth.signUp returned no error but no user')
    return { error: 'Something went wrong creating your account. Please try again.' }
  }

  // Bypassing RLS here is correct: we already validated the join code
  // ourselves above, and we're inserting a row tied to the user we just
  // created in this same request.
  const { error: managerError } = await supabaseAdmin.from('managers').insert({
    client_id: client.id,
    supabase_user_id: data.user.id,
  })

  if (managerError) {
    console.error('Failed to create manager row after signUp:', managerError)
    return { error: 'Something went wrong creating your account. Please try again.' }
  }

  // Supabase sets `session` to null when email confirmation is required for
  // the project, and non-null when it's disabled — the UI branches on this
  // rather than us redirecting directly, since we don't know that setting.
  return { success: true, needsEmailConfirmation: !data.session }
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/')
}
