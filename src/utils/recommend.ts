import type { SongStats, SongLevelData, SongsDatabase } from '../types'
import { findSongByTitle } from './songHelpers'
import {
  calcRatingIndicator,
  calcMaxRatings,
  calcStaminaIndicator,
  calcSpeedIndicator,
  calcRhythmIndicator,
  calcComplexityIndicator,
  calcDaigouryokuIndicator,
  calcAccuracyPowerIndicator,
  filterDuplicateSongs
} from './calculator'
import duplicateSongs from '../data/duplicateSongs'

// 模块级变量，存储歌曲数据库
let cachedSongsDatabase: SongsDatabase = []

export function setSongsDatabase(database: SongsDatabase): void {
  cachedSongsDatabase = database
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/**
 * 根据维度获取歌曲的原始指标值
 */
function getSongIndicatorValue(levelData: SongLevelData, dimension: keyof SongStats): number {
  switch (dimension) {
    case 'rating':
      return calcRatingIndicator(levelData.constant)
    case 'daigouryoku':
      return calcDaigouryokuIndicator(levelData.constant)
    case 'stamina':
      return calcStaminaIndicator(levelData.avgDensity, levelData.instDensity)
    case 'speed':
      return calcSpeedIndicator(levelData.instDensity, levelData.avgDensity)
    case 'accuracy_power':
      return calcAccuracyPowerIndicator(levelData.constant)
    case 'rhythm':
      return calcRhythmIndicator(levelData.separation, levelData.bpmChange)
    case 'complex':
      return calcComplexityIndicator(levelData.composite)
    default:
      return 0
  }
}

function calculateRecommendScore(improvementPotential: number, difficultyDeviation: number): number {
  // 进步空间权重为100，难度偏差权重为10
  // 难度偏差越小分数越小，越推荐
  return -improvementPotential * 100 + difficultyDeviation * 10
}

function filterAndScoreCandidates(
  candidates: SongStats[],
  filteredDatabase: SongsDatabase,
  bestKey: keyof SongStats,
  best20RatingMedian: number,
  best20MinScore: number,
  best20IndicatorMedian: number,
  best20UserScoreMedian: number,
  dimensionKeys: (keyof SongStats)[],
  dimensionRankMaps: Record<string, Map<string, number>>,
  best20ConstantBase: number,
  difficultyAdjustment: number
) {
  return candidates.map(song => {
    const songData = findSongByTitle(filteredDatabase, song.title)
    if (!songData) return null
    const levelData = songData.level[song.level as 4 | 5]
    if (!levelData) return null

    if (levelData.constant > best20ConstantBase + difficultyAdjustment) return null
    
    const songRatingValue = calcRatingIndicator(levelData.constant)
    const songIndicatorValue = getSongIndicatorValue(levelData, bestKey)
    const userScoreValue = song[bestKey] as number
    const maxRatings = calcMaxRatings(levelData)
    
    let songMaxScore = 0
    switch (bestKey) {
      case 'rating': songMaxScore = maxRatings.maxRating; break
      case 'daigouryoku': songMaxScore = maxRatings.maxDaigouryoku; break
      case 'stamina': songMaxScore = maxRatings.maxStamina; break
      case 'speed': songMaxScore = maxRatings.maxSpeed; break
      case 'accuracy_power': songMaxScore = maxRatings.maxAccuracyPower; break
      case 'rhythm': songMaxScore = maxRatings.maxRhythm; break
      case 'complex': songMaxScore = maxRatings.maxComplex; break
      default: songMaxScore = 0
    }
    
    if (songMaxScore < best20MinScore) return null
    
    const isUnplayed = song.great === 0 && song.good === 0 && song.bad === 0
    const improvementPotential = isUnplayed 
      ? 1.0
      : (songMaxScore > 0 ? Math.max(0, (songMaxScore - userScoreValue) / songMaxScore) : 0)
    
    // 过滤掉已经达到满分的歌曲（进步空间等于0）
    if (!isUnplayed && improvementPotential === 0) return null
    
    const difficultyDeviation = Math.abs(songRatingValue - best20RatingMedian)
    const recommendScore = calculateRecommendScore(improvementPotential, difficultyDeviation)
    
    const dimensionRanks: Record<string, number> = {}
    for (const key of dimensionKeys) {
      dimensionRanks[key] = dimensionRankMaps[key].get(song.title) ?? 0
    }
    
    const userAccuracy = isUnplayed ? 0 : ((song.great) / levelData.totalNotes)

    return { 
      ...song,
      _constant: levelData.constant,
      _recommendScore: recommendScore,
      _isUnplayed: isUnplayed,
      _userScoreValue: userScoreValue,
      _dimensionRanks: dimensionRanks,
      _maxRatings: maxRatings,
      _maxScore: songMaxScore,
      _improvementPotential: improvementPotential,
      _difficultyDeviation: difficultyDeviation,
      _userAccuracy: userAccuracy,
      _songRatingValue: songRatingValue,
      _songIndicatorValue: songIndicatorValue,
      _best20RatingMedian: best20RatingMedian,
      _best20IndicatorMedian: best20IndicatorMedian,
      _best20ConstantBase: best20ConstantBase,
      _scoreBaseline: best20UserScoreMedian
    }
  }).filter((song): song is NonNullable<typeof song> => song !== null)
}

export function recommendSongs(
  allStats: SongStats[],
  bestKey: keyof SongStats = 'rating',
  limit: number = 20,
  filterFn?: (id: number) => boolean,
  difficultyAdjustment: number = 0,
  constantBase?: number
): SongStats[] {
  if (!cachedSongsDatabase || cachedSongsDatabase.length === 0) return []

  const filteredDatabase = filterFn 
    ? cachedSongsDatabase.filter(song => filterFn(song.id))
    : cachedSongsDatabase

  if (filteredDatabase.length === 0) return []

  const best20 = [...allStats]
    .sort((a, b) => (b[bestKey] as number) - (a[bestKey] as number))
    .slice(0, 20)
  if (best20.length === 0) return []
  
  const best10Titles = new Set(best20.slice(0, 10).map(s => s.title))

  // 计算 B20 中的定数中位数
  const best20Constants = best20
    .map(s => {
      const songData = findSongByTitle(filteredDatabase, s.title)
      if (!songData) return 0
      const levelData = songData.level[s.level as 4 | 5]
      return levelData?.constant ?? 0
    })
    .filter(c => c > 0)
  const best20ConstantBase = constantBase !== undefined ? constantBase : (best20Constants.length > 0 ? calculateMedian(best20Constants) : 0)

  const statsById = new Map<number, SongStats>()
  allStats.forEach(s => statsById.set(s.id, s))

  const best20UserScoreValues = best20.map(s => s[bestKey] as number)
  const best20MinScore = best20UserScoreValues.length > 0 
    ? Math.min(...best20UserScoreValues)
    : 0
  
  const best20UserScoreMedian = calculateMedian(best20UserScoreValues)

  const allSongEntries: Array<{ id: number; title: string; level: 4 | 5; levelData: SongLevelData }> = []
  for (const song of filteredDatabase) {
    if (song.level['4']) {
      allSongEntries.push({ id: song.id, title: song.title, level: 4, levelData: song.level['4'] })
    }
    if (song.level['5']) {
      allSongEntries.push({ id: song.id, title: song.title, level: 5, levelData: song.level['5'] })
    }
  }

  const allCandidates: SongStats[] = allSongEntries
    .filter(entry => !best10Titles.has(entry.title))
    .map(entry => {
      const stat = allStats.find(s => s.title === entry.title && s.level === entry.level)
      if (stat) return stat
      return {
        id: entry.id,
        level: entry.level,
        title: entry.title,
        rating: 0,
        daigouryoku: 0,
        stamina: 0,
        speed: 0,
        accuracy_power: 0,
        rhythm: 0,
        complex: 0,
        great: 0,
        good: 0,
        bad: 0
      }
    })

  // 过滤掉重复/同质歌曲
  const candidates = filterDuplicateSongs(allCandidates, duplicateSongs)

  if (candidates.length === 0) return []

  // 计算 Best20 在指定维度的原始指标值中位数（用于UI显示）
  const best20IndicatorValues = best20
    .map(s => {
      const songData = findSongByTitle(filteredDatabase, s.title)
      if (!songData) return 0
      const levelData = songData.level[s.level as 4 | 5]
      if (!levelData) return 0
      return getSongIndicatorValue(levelData, bestKey)
    })
    .filter(v => v > 0)
  const best20IndicatorMedian = best20IndicatorValues.length > 0
    ? calculateMedian(best20IndicatorValues)
    : 0

  // 计算 Best20 的综合难度指标（rating）中位数
  const best20RatingValues = best20
    .map(s => {
      const songData = findSongByTitle(filteredDatabase, s.title)
      if (!songData) return 0
      const levelData = songData.level[s.level as 4 | 5]
      if (!levelData) return 0
      return calcRatingIndicator(levelData.constant)
    })
    .filter(v => v > 0)
  const best20RatingMedian = best20RatingValues.length > 0 
    ? calculateMedian(best20RatingValues) 
    : 0

  const dimensionKeys: (keyof SongStats)[] = ['rating', 'daigouryoku', 'stamina', 'speed', 'accuracy_power', 'rhythm', 'complex']
  const allStatsMap = new Map<string, SongStats>()
  allStats.forEach(s => allStatsMap.set(s.title, s))
  const allSongStats: SongStats[] = allSongEntries.map(entry => {
    const stat = allStatsMap.get(entry.title)
    if (stat) return stat
    return {
      id: entry.id,
      level: entry.level,
      title: entry.title,
      rating: 0,
      daigouryoku: 0,
      stamina: 0,
      speed: 0,
      accuracy_power: 0,
      rhythm: 0,
      complex: 0,
      great: 0,
      good: 0,
      bad: 0
    }
  })
  const dimensionRankMaps: Record<string, Map<string, number>> = {}
  for (const key of dimensionKeys) {
    const sorted = [...allSongStats].sort((a, b) => (b[key] as number) - (a[key] as number))
    const map = new Map<string, number>()
    sorted.forEach((s, idx) => {
      map.set(s.title, idx + 1)
    })
    dimensionRankMaps[key] = map
  }

  const scored = filterAndScoreCandidates(
    candidates,
    filteredDatabase,
    bestKey,
    best20RatingMedian,
    best20MinScore,
    best20IndicatorMedian,
    best20UserScoreMedian,
    dimensionKeys,
    dimensionRankMaps,
    best20ConstantBase,
    difficultyAdjustment
  )

  // 按推荐分数排序
  const sorted = scored.sort((a, b) => a._recommendScore - b._recommendScore)
  
  // 分离未游玩和已游玩的歌曲
  const unplayed = sorted.filter(s => s._isUnplayed)
  const played = sorted.filter(s => !s._isUnplayed)
  
  // 保持1:1比例
  const half = Math.floor(limit / 2)
  const unplayedPick = unplayed.slice(0, half)
  const playedPick = played.slice(0, half)
  
  // 如果一边不足，用另一边补足
  let result: typeof sorted = []
  if (unplayedPick.length < half) {
    // 未游玩不足，用已游玩补足
    result = [...unplayedPick, ...played.slice(0, limit - unplayedPick.length)]
  } else if (playedPick.length < half) {
    // 已游玩不足，用未游玩补足
    result = [...playedPick, ...unplayed.slice(0, limit - playedPick.length)]
  } else {
    // 两边都足够，各取一半
    result = [...unplayedPick, ...playedPick]
  }
  
  // 合并后按推荐权重重新排序
  result.sort((a, b) => a._recommendScore - b._recommendScore)

  return result.slice(0, limit)
}
