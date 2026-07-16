import { revalidateTag } from 'next/cache'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { PROPERTIES_TAG } from '@/lib/cache-tags'
import { randomUUID } from 'crypto'
import type { NextRequest } from 'next/server'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const manager = await getCurrentManager()
  if (!manager) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const file = formData.get('file')

  if (!file || !(file instanceof Blob)) {
    return new Response(JSON.stringify({ error: 'file is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return new Response(
      JSON.stringify({
        error: 'file must be one of image/jpeg, image/png, image/webp, image/gif',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const path = `${id}/${randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('property-photos')
    .upload(path, file, { contentType: file.type })

  if (uploadError) {
    return new Response(JSON.stringify({ error: uploadError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('property-photos').getPublicUrl(path)

  const { data, error } = await supabase
    .from('properties')
    .update({ photo_url: publicUrl })
    .eq('id', id)
    .eq('client_id', manager.clientId)
    .select()
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  revalidateTag(PROPERTIES_TAG, { expire: 0 })

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
