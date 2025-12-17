import { ref, computed } from 'vue'
import type { SongStats, SongsDatabase } from '@/types'
import { loadSongsData } from '@data/songs'
import {
  calcMaxRatings,
  calculateSongStats,
  filterDuplicateSongs,
  getTop20Median,
  getTop20WeightedAverage,
  parsePastedScores,
  topValueCompensate
} from '@utils/calculator'
import { expandSongsDatabase, findSongByIdLevel } from '@utils/songHelpers'
import { difficultyMap } from '@utils/difficulty'
import { setSongsDatabase } from '@utils/recommend'
import duplicateSongs from '@data/duplicateSongs'

// Global state
const songsDB = ref<SongsDatabase | null>(null)
const allSongStats = ref<SongStats[]>([])
const lastSongStats = ref<SongStats[]>([])
const filteredSongStats = ref<SongStats[]>([])
const onlyCnSongs = ref(false)
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
  
  return {
    rating: enhanceSongStats([...filtered].sort((a, b) => b.rating - a.rating).slice(0, 20), filtered),
    daigouryoku: enhanceSongStats([...filtered].sort((a, b) => b.daigouryoku - a.daigouryoku).slice(0, 20), filtered),
    stamina: enhanceSongStats([...filtered].sort((a, b) => b.stamina - a.stamina).slice(0, 20), filtered),
    speed: enhanceSongStats([...filtered].sort((a, b) => b.speed - a.speed).slice(0, 20), filtered),
    accuracy_power: enhanceSongStats([...filtered].sort((a, b) => b.accuracy_power - a.accuracy_power).slice(0, 20), filtered),
    rhythm: enhanceSongStats([...filtered].sort((a, b) => b.rhythm - a.rhythm).slice(0, 20), filtered),
    complex: enhanceSongStats([...filtered].sort((a, b) => b.complex - a.complex).slice(0, 20), filtered)
  }
})

function enhanceSongStats(songs: SongStats[], allFilteredSongs: SongStats[]): SongStats[] {
  if (!songsDB.value) return songs

  const dimensionKeys: (keyof SongStats)[] = ['rating', 'daigouryoku', 'stamina', 'speed', 'accuracy_power', 'rhythm', 'complex']
  const dimensionRankMaps: Record<string, Map<string, number>> = {}

  for (const key of dimensionKeys) {
    const sorted = [...allFilteredSongs].sort((a, b) => (b[key] as number) - (a[key] as number))
    const map = new Map<string, number>()
    sorted.forEach((s, idx) => {
      map.set(s.title, idx + 1)
    })
    dimensionRankMaps[key] = map
  }

  return songs.map(song => {
    const result = findSongByIdLevel(songsDB.value!, song.id, song.level as 4 | 5)
    if (!result) return song

    const levelData = result.levelData
    const maxRatings = calcMaxRatings(levelData)

    const dimensionRanks: Record<string, number> = {}
    for (const key of dimensionKeys) {
      dimensionRanks[key] = dimensionRankMaps[key].get(song.title) ?? 0
    }

    // Calculate diff with last stats
    const lastSong = lastSongStats.value.find(s => s.id === song.id && s.level === song.level)
    const isNew = !lastSong
    const ratingDiff = lastSong ? song.rating - lastSong.rating : 0

    return {
      ...song,
      _constant: levelData.constant,
      _maxRatings: maxRatings,
      _dimensionRanks: dimensionRanks,
      _isUnplayed: song.great === 0 && song.good === 0 && song.bad === 0,
      _isNew: isNew,
      _ratingDiff: ratingDiff
    }
  })
}

function calculateOverallStats(data: SongStats[]) {
  const filtered = filterDuplicateSongs(data, duplicateSongs)
  
  const ratingMid = getTop20Median(filtered, 'rating')
  const daigouryokuMid = getTop20Median(filtered, 'daigouryoku')
  const staminaMid = getTop20Median(filtered, 'stamina')
  const speedMid = getTop20Median(filtered, 'speed')
  const accuracyMid = getTop20Median(filtered, 'accuracy_power')
  const rhythmMid = getTop20Median(filtered, 'rhythm')
  const complexMid = getTop20Median(filtered, 'complex')

  const ratingAve = getTop20WeightedAverage(filtered, 'rating')
  const daigouryokuAve = getTop20WeightedAverage(filtered, 'daigouryoku')
  const staminaAve = getTop20WeightedAverage(filtered, 'stamina')
  const speedAve = getTop20WeightedAverage(filtered, 'speed')
  const accuracyAve = getTop20WeightedAverage(filtered, 'accuracy_power')
  const rhythmAve = getTop20WeightedAverage(filtered, 'rhythm')
  const complexAve = getTop20WeightedAverage(filtered, 'complex')

  overallRating.value = topValueCompensate(ratingMid, 15.28, ratingAve, 15.31, 14.59)
  radarData.value = {
    daigouryoku: topValueCompensate(daigouryokuMid, 15.26, daigouryokuAve, 15.29, 14.54),
    stamina: topValueCompensate(staminaMid, 14.68, staminaAve, 14.92, 13.36),
    speed: topValueCompensate(speedMid, 14.25, speedAve, 14.59, 14.00),
    accuracy: topValueCompensate(accuracyMid, 15.44, accuracyAve, 15.45, 15.08),
    rhythm: topValueCompensate(rhythmMid, 14.52, rhythmAve, 14.83, 14.02),
    complex: topValueCompensate(complexMid, 13.77, complexAve, 14.26, 13.45)
  }
}

function calculateLastOverallStats(data: SongStats[]) {
  const filtered = filterDuplicateSongs(data, duplicateSongs)
  const ratingMid = getTop20Median(filtered, 'rating')
  const ratingAve = getTop20WeightedAverage(filtered, 'rating')
  lastOverallRating.value = topValueCompensate(ratingMid, 15.28, ratingAve, 15.31, 14.59)
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

  calculateOverallStats(filteredSongStats.value)
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

        const stats = calculateSongStats(entry.data, s, entry.title)
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

            const stats = calculateSongStats(entry.data, s, entry.title)
            if (stats) lastTempResults.push(stats)
          })
          
          lastSongStats.value = lastTempResults
          calculateLastOverallStats(lastTempResults)
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

  return {
    songsDB,
    allSongStats,
    filteredSongStats,
    lastSongStats,
    onlyCnSongs,
    isLoading,
    error,
    overallRating,
    lastOverallRating,
    radarData,
    topLists,
    init,
    setCnFilter
  }
}
