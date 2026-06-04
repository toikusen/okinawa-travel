import { supabase } from '../supabase'

export async function uploadEventImage(
  tripId: string,
  eventId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${tripId}/${eventId}.${ext}`

  const { error } = await supabase.storage
    .from('event-images')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from('event-images').getPublicUrl(path)
  return data.publicUrl
}
