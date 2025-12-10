import type { SongsDatabase } from '../types'

export const songsData: SongsDatabase = {}

export async function loadSongsData(): Promise<SongsDatabase> {
  try {
    const response = await fetch('/songs.json')
    return await response.json()
  } catch {
    console.error('无法加载songs.json')
    return {}
  }
}
