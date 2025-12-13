/**
 * 辅助函数：从新格式的 SongData 中获取特定难度的数据
 */

import type { SongData, SongLevelData } from '../types'

/**
 * 从SongData中获取指定难度的数据
 * @param song - 歌曲数据
 * @param level - 难度级别 (4 或 5)
 * @returns 难度数据，如果不存在返回 undefined
 */
export function getLevelData(song: SongData, level: 4 | 5): SongLevelData | undefined {
  return song.level[level.toString() as '4' | '5']
}

/**
 * 根据id和difficulty查找歌曲数据
 * @param songsDB - 歌曲数据库
 * @param id - 歌曲ID
 * @param level - 难度级别 (4 或 5)
 * @returns 包含歌曲数据和难度数据的对象，如果不存在返回 undefined
 */
export function findSongByIdLevel(songsDB: SongData[], id: number, level: 4 | 5): { song: SongData, levelData: SongLevelData } | undefined {
  const song = songsDB.find(s => s.id === id)
  if (!song) return undefined
  
  const levelData = getLevelData(song, level)
  if (!levelData) return undefined
  
  return { song, levelData }
}

/**
 * 根据title查找歌曲
 * @param songsDB - 歌曲数据库
 * @param title - 歌曲标题
 * @returns 歌曲数据，如果不存在返回 undefined
 */
export function findSongByTitle(songsDB: SongData[], title: string): SongData | undefined {
  return songsDB.find(s => s.title === title)
}

/**
 * 将歌曲数据库展开为包含所有难度的条目
 * @param songsDB - 歌曲数据库
 * @returns 展开后的数组，每个元素包含 id, title, level, 和对应的难度数据
 */
export interface ExpandedSongEntry {
  id: number
  title: string
  level: 4 | 5
  data: SongLevelData
}

export function expandSongsDatabase(songsDB: SongData[]): ExpandedSongEntry[] {
  const result: ExpandedSongEntry[] = []
  
  for (const song of songsDB) {
    if (song.level['4']) {
      result.push({
        id: song.id,
        title: song.title,
        level: 4,
        data: song.level['4']
      })
    }
    if (song.level['5']) {
      result.push({
        id: song.id,
        title: song.title,
        level: 5,
        data: song.level['5']
      })
    }
  }
  
  return result
}
