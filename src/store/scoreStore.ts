import { ref, computed } from 'vue'
import type { SongStats, SongsDatabase, UserScore, LockedScores, RatingAlgorithm } from '@/types'
import { loadSongsData } from '@data/songs'
import {
  calculateSongStats,
  filterDuplicateSongs,
  parsePastedScores,
  enhanceSongStats,
  calculateOverallStats,
  calculateLastOverallStats
} from '@utils/calculator'
import { expandSongsDatabase } from '@utils/songHelpers'
import { difficultyMap } from '@utils/difficulty'
import { setSongsDatabase } from '@utils/recommend'
import duplicateSongs from '@data/duplicateSongs'

// Global state
const songsDB = ref<SongsDatabase | null>(null)
const allSongStats = ref<SongStats[]>([])
const lastSongStats = ref<SongStats[]>([])
const filteredSongStats = ref<SongStats[]>([])
const onlyCnSongs = ref(false)
const ratingAlgorithm = ref<RatingAlgorithm>('great-only')
const blacklistedSongs = ref<string[]>([])
const lockedScores = ref<LockedScores>({})
const isLoading = ref(false)
const error = ref<string | null>(null)

// Computed stats
const overallRating = ref(0)
const lastOverallRating = ref(0)
const radarData = ref({
  daigouryoku: 0,
  stamina: 0,
  speed: 0,
  accuracy: 0,
  rhythm: 0,
  complex: 0
})

// Top 20 lists
const topLists = computed(() => {
  const filtered = filterDuplicateSongs(filteredSongStats.value, duplicateSongs)
  
  const args = [filtered, songsDB.value, ratingAlgorithm.value, lastSongStats.value] as const

  return {
    rating: enhanceSongStats([...filtered].sort((a, b) => b.rating - a.rating).slice(0, 20), ...args),
    daigouryoku: enhanceSongStats([...filtered].sort((a, b) => b.daigouryoku - a.daigouryoku).slice(0, 20), ...args),
    stamina: enhanceSongStats([...filtered].sort((a, b) => b.stamina - a.stamina).slice(0, 20), ...args),
    speed: enhanceSongStats([...filtered].sort((a, b) => b.speed - a.speed).slice(0, 20), ...args),
    accuracy_power: enhanceSongStats([...filtered].sort((a, b) => b.accuracy_power - a.accuracy_power).slice(0, 20), ...args),
    rhythm: enhanceSongStats([...filtered].sort((a, b) => b.rhythm - a.rhythm).slice(0, 20), ...args),
    complex: enhanceSongStats([...filtered].sort((a, b) => b.complex - a.complex).slice(0, 20), ...args)
  }
})

function updateOverallStats(data: SongStats[]) {
  const result = calculateOverallStats(data, duplicateSongs)
  overallRating.value = result.overallRating
  radarData.value = result.radarData
}

function updateLastOverallStats(data: SongStats[]) {
  lastOverallRating.value = calculateLastOverallStats(data, duplicateSongs)
}

function applyCnFilter() {
  if (!songsDB.value) return

  if (onlyCnSongs.value) {
    const cnSongIds = new Set(
      songsDB.value.filter(song => song.is_cn === true).map(song => song.id)
    )

    const idToTitleCn = new Map<number, string>()
    songsDB.value.forEach(song => {
      if (song.title_cn) {
        idToTitleCn.set(song.id, song.title_cn)
      }
    })

    filteredSongStats.value = allSongStats.value
      .filter(stat => cnSongIds.has(stat.id))
      .map(stat => {
        const titleCn = idToTitleCn.get(stat.id)
        const difficulty = difficultyMap[stat.level] || ''
        if (titleCn) {
          return { ...stat, title: `${titleCn}${difficulty}` }
        }
        return { ...stat, title: `${stat.title}${difficulty}` }
      })
  } else {
    filteredSongStats.value = allSongStats.value.map(stat => {
      const difficulty = difficultyMap[stat.level] || ''
      return { ...stat, title: `${stat.title}${difficulty}` }
    })
  }

  updateOverallStats(filteredSongStats.value)
}

export function useScoreStore() {
  const init = async () => {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null

    try {
      // Load settings
      const savedSetting = localStorage.getItem('onlyCnSongs')
      if (savedSetting !== null) {
        onlyCnSongs.value = savedSetting === 'true'
      }

      const savedAlgorithm = localStorage.getItem('ratingAlgorithm') as RatingAlgorithm
      if (savedAlgorithm === 'great-only' || savedAlgorithm === 'comprehensive') {
        ratingAlgorithm.value = savedAlgorithm
      }

      const savedBlacklist = localStorage.getItem('taiko-blacklisted-songs')
      if (savedBlacklist) {
        try {
          blacklistedSongs.value = JSON.parse(savedBlacklist)
        } catch (e) {
          console.error('Failed to parse blacklist', e)
          blacklistedSongs.value = []
        }
      }

      const savedLocked = localStorage.getItem('taiko-locked-songs')
      if (savedLocked) {
        try {
          lockedScores.value = JSON.parse(savedLocked)
        } catch (e) {
          console.error('Failed to parse locked scores', e)
          lockedScores.value = {}
        }
      }

      // Load DB if needed
      if (!songsDB.value) {
        songsDB.value = await loadSongsData()
      }

      if (songsDB.value.length === 0) {
        error.value = '歌曲数据加载失败'
        return
      }
      
      // Initialize recommend module with songs database
      setSongsDatabase(songsDB.value)

      // Load scores
      const scoreInput = localStorage.getItem('taikoScoreData') || ''
      if (!scoreInput) {
        error.value = '未找到数据'
        allSongStats.value = []
        return
      }

      const scores = parsePastedScores(scoreInput)
      const tempResults: SongStats[] = []

      const expandedEntries = expandSongsDatabase(songsDB.value)
      const entryMap = new Map()
      expandedEntries.forEach(entry => {
        const key = `${entry.id}-${entry.level}`
        entryMap.set(key, entry)
      })

      scores.forEach(s => {
        const key = `${s.id}-${s.level}`
        const entry = entryMap.get(key)
        if (!entry) return

        const stats = calculateSongStats(entry.data, s, entry.title, ratingAlgorithm.value)
        if (stats) tempResults.push(stats)
      })

      allSongStats.value = tempResults

      // Load last scores
      const lastScoreInput = localStorage.getItem('lastTaikoScore')
      if (lastScoreInput) {
        try {
          const lastScores = parsePastedScores(lastScoreInput)
          const lastTempResults: SongStats[] = []
          
          lastScores.forEach(s => {
            const key = `${s.id}-${s.level}`
            const entry = entryMap.get(key)
            if (!entry) return

            const stats = calculateSongStats(entry.data, s, entry.title, ratingAlgorithm.value)
            if (stats) lastTempResults.push(stats)
          })
          
          lastSongStats.value = lastTempResults
          updateLastOverallStats(lastTempResults)
        } catch (e) {
          console.error('Failed to process last score data', e)
        }
      }

      applyCnFilter()

    } catch (e) {
      console.error(e)
      error.value = '数据处理失败'
    } finally {
      isLoading.value = false
    }
  }

  const setCnFilter = (value: boolean) => {
    onlyCnSongs.value = value
    localStorage.setItem('onlyCnSongs', String(value))
    applyCnFilter()
  }

  const setRatingAlgorithm = (value: RatingAlgorithm) => {
    ratingAlgorithm.value = value
    localStorage.setItem('ratingAlgorithm', value)
    init()
  }

  const toggleBlacklist = (id: number, level: number) => {
    const key = `${id}-${level}`
    const index = blacklistedSongs.value.indexOf(key)
    if (index > -1) {
      blacklistedSongs.value.splice(index, 1)
    } else {
      blacklistedSongs.value.push(key)
    }
    localStorage.setItem('taiko-blacklisted-songs', JSON.stringify(blacklistedSongs.value))
  }

  const toggleLock = (id: number, level: number, scoreData?: Partial<UserScore>) => {
    const key = `${id}-${level}`
    if (lockedScores.value[key]) {
      delete lockedScores.value[key]
    } else if (scoreData) {
      lockedScores.value[key] = {
        id,
        level,
        score: scoreData.score || 0,
        scoreRank: scoreData.scoreRank || 0,
        great: scoreData.great || 0,
        good: scoreData.good || 0,
        bad: scoreData.bad || 0,
        drumroll: scoreData.drumroll || 0,
        combo: scoreData.combo || 0,
        playCount: scoreData.playCount || 0,
        clearCount: scoreData.clearCount || 0,
        fullcomboCount: scoreData.fullcomboCount || 0,
        perfectCount: scoreData.perfectCount || 0,
        updatedAt: new Date().toISOString()
      }
    }
    localStorage.setItem('taiko-locked-songs', JSON.stringify(lockedScores.value))
  }

  const updateLockedScore = (id: number, level: number, scoreData: Partial<UserScore>) => {
    const key = `${id}-${level}`
    if (lockedScores.value[key]) {
      lockedScores.value[key] = {
        ...lockedScores.value[key],
        ...scoreData,
        updatedAt: new Date().toISOString()
      }
      localStorage.setItem('taiko-locked-songs', JSON.stringify(lockedScores.value))
    }
  }

  return {
    songsDB,
    allSongStats,
    filteredSongStats,
    lastSongStats,
    onlyCnSongs,
    ratingAlgorithm,
    blacklistedSongs,
    lockedScores,
    isLoading,
    error,
    overallRating,
    lastOverallRating,
    radarData,
    topLists,
    init,
    setCnFilter,
    setRatingAlgorithm,
    toggleBlacklist,
    toggleLock,
    updateLockedScore
  }
}
