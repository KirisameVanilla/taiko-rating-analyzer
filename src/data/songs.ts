import type { SongsDatabase, FumenDataItem, SongsCNItem, SongData } from '@/types'
import { useModal } from '@composables/useModal'

export const songsData: SongsDatabase = []

const { showModal } = useModal()

export async function loadSongsData(): Promise<SongsDatabase> {
  try {
    // 并行获取两个数据源
    const [fumenResponse, songsCNResponse] = await Promise.all([
      fetch('https://cdn.ourtaiko.org/api/fumendb_constants'),
      fetch('https://cdn.ourtaiko.org/api/cnsongs')
    ])

    if (!fumenResponse.ok || !songsCNResponse.ok) {
      throw new Error('Failed to fetch data')
    }

    const fumenData: FumenDataItem[] = await fumenResponse.json()
    const songsCNData: SongsCNItem[] = await songsCNResponse.json()

    // 创建 songs_cn 的 id 索引映射
    const songsCNMap = new Map<number, SongsCNItem>()
    songsCNData.forEach(song => {
      if (!songsCNMap.has(song.id)) {
        songsCNMap.set(song.id, song)
      }
    })

    // 合并数据
    const mergedData: SongsDatabase = fumenData.map(fumenSong => {
      const cnSong = songsCNMap.get(fumenSong.id)
      
      const songData: SongData = {
        id: fumenSong.id,
        title: fumenSong.title,
        level: {}
      }

      // 添加中文标题信息
      if (cnSong) {
        songData.title_cn = cnSong.song_name
        songData.is_cn = true
      }

      // 转换难度数据 (oni = level 4, ura = level 5)
      if (fumenSong.constants.oni) {
        songData.level['4'] = fumenSong.constants.oni
      }
      
      if (fumenSong.constants.ura) {
        songData.level['5'] = fumenSong.constants.ura
      }

      return songData
    })

    return mergedData
  } catch (error) {
    console.error('Error loading songs data:', error)
    showModal('歌曲数据加载失败，请检查网络连接后刷新页面', '网络错误')
    return []
  }
}

