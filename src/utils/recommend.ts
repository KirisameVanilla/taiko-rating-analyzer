import type { SongStats, SongLevelData, SongsDatabase } from '../types'
import { findSongByTitle } from './songHelpers'
import {
  calcStaminaIndicator,
  calcSpeedIndicator,
  calcRhythmIndicator,
  calcComplexityIndicator,
  calcDaigouryokuIndicator,
  calcAccuracyPowerIndicator,
  calcRatingIndicator
} from './calculator'

// 模块级变量，存储歌曲数据库
let cachedSongsDatabase: SongsDatabase = []

/**
 * 设置歌曲数据库缓存
 * 在使用 recommendSongs 之前需要先调用此函数设置数据库
 * @param database - 歌曲数据库
 */
export function setSongsDatabase(database: SongsDatabase): void {
  cachedSongsDatabase = database
}

/**
 * 计算中位数
 * @param values - 数值数组
 * @returns 中位数
 */
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
 * @param levelData - 歌曲难度数据
 * @param dimension - 维度名称
 * @returns 该维度的原始指标值
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

/**
 * 平衡算法：计算两个偏差值之间的综合推荐分数
 * 该算法结合歌曲难度偏差、用户表现偏差和用户精度来计算推荐优先级
 * 
 * @param indicatorDeviation - 歌曲指标与Best20指标中位数的偏差百分比（歌曲难度偏差）
 * @param scoreDeviation - 用户评分与Best20指标中位数的偏差百分比（用户表现偏差）
 * @param accuracyFactor - 用户精度因子（1 - 准确率），范围[0,1]，值越大表示精度越低
 * @returns 综合分数，值越小越推荐
 * 
 * 算法逻辑：
 * - indicatorDeviation 越小：歌曲难度越接近Best20指标中位数，越适合练习
 * - scoreDeviation 越大：用户在该歌曲的评分与指标中位数差距越大，说明表现越差，越需要练习
 * - accuracyFactor 越大：用户精度越低，越需要练习
 * - 综合分数 = indicatorDeviation - scoreDeviation * 2 - accuracyFactor * 1.5，值越小越推荐
 * 
 * 示例：
 * - indicatorDeviation=0.02, scoreDeviation=0.08, accuracyFactor=0.1 => 分数=-0.29 (高优先级)
 * - indicatorDeviation=0.05, scoreDeviation=0.03, accuracyFactor=0.02 => 分数=-0.04 (低优先级)
 */
function calculateBalanceScore(indicatorDeviation: number, scoreDeviation: number, accuracyFactor: number = 0): number {
  // indicatorDeviation 小 + scoreDeviation 大 + accuracyFactor 大 = 负数更大 = 高优先级
  // 权重调整：难度偏差权重为1，用户表现偏差权重为2，精度因子权重为1.5
  return indicatorDeviation * 1 - scoreDeviation * 2 - accuracyFactor * 1.5
}

/**
 * 推荐歌曲算法
 * 通过横向比较每首歌曲的各维度指标和用户当前评分的偏差值来进行推荐
 * 
 * @param allStats - 用户所有歌曲统计数据
 * @param bestKey - 推荐维度（如 'rating', 'stamina', 'speed', 'accuracy_power', 'rhythm', 'complex'）
 * @param limit - 推荐列表最大数量，默认为20
 * @param filterFn - 可选的歌曲过滤函数，用于筛选特定歌曲
 * @returns 推荐歌曲列表，按推荐度排序（最适合练习的在前）
 * 
 * 推荐条件：
 * 1. 推荐的歌曲不能是Best20
 * 2. 推荐的歌曲综合难度定数指标不应超过Best20中位数难度指标+0.2
 * 3. 推荐的歌曲难度指标与Best20中位数越接近越好
 *    - 指标上浮不超过基准值的5%
 *    - 指标下浮不超过基准值的10%
 * 4. 用户在该歌曲的评分越低（偏差越大）越优先推荐
 * 
 * 注意：使用此函数前需要先调用 setSongsDatabase() 设置歌曲数据库
 */
export function recommendSongs(
  allStats: SongStats[],
  bestKey: keyof SongStats = 'rating',
  limit: number = 20,
  filterFn?: (id: number) => boolean
): SongStats[] {
  if (!cachedSongsDatabase || cachedSongsDatabase.length === 0) return []

  // 应用过滤器到数据库
  const filteredDatabase = filterFn 
    ? cachedSongsDatabase.filter(song => filterFn(song.id))
    : cachedSongsDatabase

  if (filteredDatabase.length === 0) return []

  // 1. 找出指定维度的 Best 20
  const best20 = [...allStats]
    .sort((a, b) => (b[bestKey] as number) - (a[bestKey] as number))
    .slice(0, 20)
  if (best20.length === 0) return []

  // 构建 id -> SongStats 映射
  const statsById = new Map<number, SongStats>()
  allStats.forEach(s => statsById.set(s.id, s))

  // 2. 计算 Best 20 歌曲在指定维度的原始指标值，并取中位数
  const best20IndicatorValues = best20
    .map(s => {
      const song = filteredDatabase.find(sd => sd.id === s.id)
      if (!song) return 0
      // 从 SongStats 中获取 level 信息
      // SongStats.id 对应 song ID，但需要知道是哪个难度
      // 我们需要从 allStats 中获取这个信息 - 但 SongStats 没有 level 字段
      // 需要根据 title 匹配
      const songData = findSongByTitle(filteredDatabase, s.title)
      if (!songData) return 0
      // 这里有个问题：我们不知道用户玩的是哪个难度
      // 需要检查两个难度，选择有数据的那个
      // 但实际上 SongStats 应该包含level信息...让我检查原始数据
      // 先假设优先使用难度5，如果没有则使用难度4
      const levelData = songData.level['5'] || songData.level['4']
      if (!levelData) return 0
      return getSongIndicatorValue(levelData, bestKey)
    })
    .filter(v => v > 0)
  if (best20IndicatorValues.length === 0) return []
  const best20IndicatorMedian = calculateMedian(best20IndicatorValues)

  // 3. 计算 Best 20 在指定维度的用户评分中位数（用于显示）
  const best20UserScoreValues = best20.map(s => s[bestKey] as number)
  const best20UserScoreMedian = calculateMedian(best20UserScoreValues)

  // 4. 过滤掉 Best 20 里的歌曲（用 title 匹配）
  const best20Titles = new Set(best20.map(s => s.title))

  // 5. 构建所有候选歌曲（包含未游玩歌曲）
  // 展开数据库为所有难度的条目
  const allSongEntries: Array<{ id: number; title: string; level: 4 | 5; levelData: SongLevelData }> = []
  for (const song of filteredDatabase) {
    if (song.level['4']) {
      allSongEntries.push({ id: song.id, title: song.title, level: 4, levelData: song.level['4'] })
    }
    if (song.level['5']) {
      allSongEntries.push({ id: song.id, title: song.title, level: 5, levelData: song.level['5'] })
    }
  }

  const statsMap = new Map<string, SongStats>()
  allStats.forEach(s => statsMap.set(s.title, s))

  // 构建 candidates: 有成绩的直接用 SongStats，无成绩的构造一个空 SongStats
  const candidates: SongStats[] = allSongEntries
    .filter(entry => !best20Titles.has(entry.title))
    .map(entry => {
      const stat = statsMap.get(entry.title)
      if (stat) return stat
      // 构造未游玩 SongStats
      return {
        id: entry.id,
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

  if (candidates.length === 0) return []

  // 6. 计算 Best20 的综合难度指标（rating）中位数
  const best20RatingValues = best20
    .map(s => {
      const songData = findSongByTitle(filteredDatabase, s.title)
      if (!songData) return 0
      const levelData = songData.level['5'] || songData.level['4']
      if (!levelData) return 0
      return calcRatingIndicator(levelData.constant)
    })
    .filter(v => v > 0)
  const best20RatingMedian = best20RatingValues.length > 0 
    ? calculateMedian(best20RatingValues) 
    : 0

  // 7. 计算所有维度的玩家表现排序（包含所有歌曲，不排除b20）
  const dimensionKeys: (keyof SongStats)[] = ['rating', 'daigouryoku', 'stamina', 'speed', 'accuracy_power', 'rhythm', 'complex']
  // 生成每个维度的排序Map: { 维度: Map<曲名, 排名> }
  const allStatsMap = new Map<string, SongStats>()
  allStats.forEach(s => allStatsMap.set(s.title, s))
  const allSongStats: SongStats[] = allSongEntries.map(entry => {
    const stat = allStatsMap.get(entry.title)
    if (stat) return stat
    return {
      id: entry.id,
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
    // 降序排序，分数高的排名靠前
    const sorted = [...allSongStats].sort((a, b) => (b[key] as number) - (a[key] as number))
    const map = new Map<string, number>()
    sorted.forEach((s, idx) => {
      map.set(s.title, idx + 1)
    })
    dimensionRankMaps[key] = map
  }

  // 8. 计算推荐分数，并写入每个维度的玩家表现排名
  const scored = candidates.map(song => {
    // 查找歌曲的原始数据
    const songData = findSongByTitle(filteredDatabase, song.title)
    if (!songData) {
      return null // 找不到歌曲数据，直接排除
    }
    // 使用优先级：难度5 > 难度4
    const levelData = songData.level['5'] || songData.level['4']
    if (!levelData) {
      return null
    }
    
    // 获取歌曲在指定维度的原始指标值（难度定数）
    const songIndicatorValue = getSongIndicatorValue(levelData, bestKey)
    // 获取歌曲的综合难度指标（rating）
    const songRatingValue = calcRatingIndicator(levelData.constant)
    // 获取用户在该歌曲的评分
    const userScoreValue = song[bestKey] as number
    // 条件1：歌曲综合难度定数指标（rating）不应超过 Best20 综合难度中位数 + 0.2
    if (songRatingValue > best20RatingMedian + 0.2) {
      return null
    }
    // 判断是否为未游玩的歌曲（所有判定数都为0）
    const isUnplayed = song.great === 0 && song.good === 0 && song.bad === 0
    // 计算用户精度（准确率）
    const ACCURACY_WEIGHT_GREAT = 1
    const ACCURACY_WEIGHT_GOOD = 0
    const userAccuracy = (song.great * ACCURACY_WEIGHT_GREAT + song.good * ACCURACY_WEIGHT_GOOD) / levelData.totalNotes
    // 计算精度因子
    const accuracyFactor = isUnplayed ? 0.5 : ((userAccuracy >= 0.5 && userAccuracy > 0) ? (1 - userAccuracy) : 1)
    // 计算偏差值
    const indicatorDeviationAbs = Math.abs(songIndicatorValue - best20IndicatorMedian)
    const indicatorDeviationPercent = indicatorDeviationAbs / best20IndicatorMedian
    const scoreDeviationAbs = Math.abs(userScoreValue - best20IndicatorMedian)
    const scoreDeviationPercent = scoreDeviationAbs / best20IndicatorMedian
    // 使用平衡算法计算综合分数
    const balanceScore = calculateBalanceScore(indicatorDeviationPercent, scoreDeviationPercent, accuracyFactor)
    // 判断是否在严格范围内
    const isInStrictRange = 
      songIndicatorValue <= best20IndicatorMedian * 1.05
      && songIndicatorValue >= best20IndicatorMedian * 0.9

    // 组装所有维度的排名
    const dimensionRanks: Record<string, number> = {}
    for (const key of dimensionKeys) {
      dimensionRanks[key] = dimensionRankMaps[key].get(song.title) ?? 0
    }

    return { 
      ...song,
      _constant: levelData.constant,
      _recommendScore: balanceScore,
      _indicatorDeviationPercent: indicatorDeviationPercent,
      _scoreDeviationPercent: scoreDeviationPercent,
      _accuracyFactor: accuracyFactor,
      _userAccuracy: userAccuracy,
      _balanceScore: balanceScore,
      _isInStrictRange: isInStrictRange,
      _isUnplayed: isUnplayed,
      // 调试信息
      _songIndicatorValue: songIndicatorValue,
      _best20IndicatorMedian: best20IndicatorMedian,
      _userScoreValue: userScoreValue,
      _scoreBaseline: best20UserScoreMedian,
      _dimensionRanks: dimensionRanks
    }
  }).filter((song): song is NonNullable<typeof song> => song !== null)

  // 9. 分层排序
  const strictRangeSongs = scored
    .filter(s => s._isInStrictRange)
    .sort((a, b) => {
      if (a._isUnplayed !== b._isUnplayed) {
        return a._isUnplayed ? -1 : 1
      }
      return a._recommendScore - b._recommendScore
    })

  const remainingSongs = scored
    .filter(s => !s._isInStrictRange)
    .sort((a, b) => {
      const deviationDiff = a._indicatorDeviationPercent - b._indicatorDeviationPercent
      if (Math.abs(deviationDiff) > 0.01) {
        return deviationDiff
      }
      if (a._isUnplayed !== b._isUnplayed) {
        return a._isUnplayed ? -1 : 1
      }
      return 0
    })

  // 合并排序结果
  const allSorted = [...strictRangeSongs, ...remainingSongs]
  const UNPLAYED_INDICATOR_DEVIATION_THRESHOLD = 0.10
  const unplayed = allSorted.filter(s => s._isUnplayed && s._indicatorDeviationPercent <= UNPLAYED_INDICATOR_DEVIATION_THRESHOLD)
  const played = allSorted.filter(s => !s._isUnplayed)

  const half = Math.floor(limit / 2)
  const unplayedPick = unplayed.slice(0, half)
  const playedPick = played.slice(0, half)
  let result: typeof allSorted = []
  if (unplayedPick.length < half) {
    result = [...unplayedPick, ...played.slice(0, limit - unplayedPick.length)]
  } else if (playedPick.length < half) {
    result = [...playedPick, ...unplayed.slice(0, limit - playedPick.length)]
  } else {
    result = [...unplayedPick, ...playedPick]
  }
  return result.slice(0, limit)
}