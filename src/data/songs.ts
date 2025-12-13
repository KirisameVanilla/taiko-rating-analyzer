import type { SongsDatabase } from '../types'
import { useModal } from '../composables/useModal'

export const songsData: SongsDatabase = []

const { showModal } = useModal()

export async function loadSongsData(): Promise<SongsDatabase> {
  try {
    const response = await fetch('/songs.json')
    return await response.json()
  } catch {
    showModal('歌曲数据加载失败，请检查网络连接后刷新页面', '网络错误')
    return []
  }
}
