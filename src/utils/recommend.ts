import type { SongStats, SongData, SongsDatabase } from '../types'
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
let cachedSongsDatabase: SongsDatabase = {}

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
 * @param songData - 歌曲原始数据
 * @param dimension - 维度名称
 * @returns 该维度的原始指标值
 */
function getSongIndicatorValue(songData: SongData, dimension: keyof SongStats): number {
  switch (dimension) {
    case 'rating':
      return calcRatingIndicator(songData.constant)
    case 'daigouryoku':
      return calcDaigouryokuIndicator(songData.constant)
    case 'stamina':
      return calcStaminaIndicator(songData.avgDensity, songData.instDensity)
    case 'speed':
      return calcSpeedIndicator(songData.instDensity, songData.avgDensity)
    case 'accuracy_power':
      return calcAccuracyPowerIndicator(songData.constant)
    case 'rhythm':
      return calcRhythmIndicator(songData.separation, songData.bpmChange)
    case 'complex':
      return calcComplexityIndicator(songData.composite)
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
  limit: number = 20
): SongStats[] {
  if (allStats.length === 0) return []
  
  // 使用缓存的歌曲数据库
  const songsDatabase = cachedSongsDatabase
  
  // 1. 找出指定维度的 Best 20
  const best20 = [...allStats]
    .sort((a, b) => (b[bestKey] as number) - (a[bestKey] as number))
    .slice(0, 20)
  
  if (best20.length === 0) return []
  
  // 2. 计算 Best 20 歌曲在指定维度的原始指标值，并取中位数
  const best20IndicatorValues = best20
    .map(s => {
      const songData = Object.values(songsDatabase).find(sd => sd.title === s.title)
      return songData ? getSongIndicatorValue(songData, bestKey) : 0
    })
    .filter(v => v > 0)
  
  if (best20IndicatorValues.length === 0) return []
  
  const best20IndicatorMedian = calculateMedian(best20IndicatorValues)
  
  // 3. 计算 Best 20 在指定维度的用户评分中位数（用于显示）
  const best20UserScoreValues = best20.map(s => s[bestKey] as number)
  const best20UserScoreMedian = calculateMedian(best20UserScoreValues)
  
  // 4. 过滤掉 Best 20 里的歌曲
  const best20Titles = new Set(best20.map(s => s.title))
  const candidates = allStats.filter(s => !best20Titles.has(s.title))
  
  if (candidates.length === 0) return []
  
  // 5. 计算 Best20 的综合难度指标（rating）中位数
  const best20RatingValues = best20
    .map(s => {
      const songData = Object.values(songsDatabase).find(sd => sd.title === s.title)
      return songData ? calcRatingIndicator(songData.constant) : 0
    })
    .filter(v => v > 0)
  
  const best20RatingMedian = best20RatingValues.length > 0 
    ? calculateMedian(best20RatingValues) 
    : 0
  
  // 6. 计算推荐分数，分两轮筛选
  const scored = candidates.map(song => {
    // 查找歌曲的原始数据
    const songData = Object.values(songsDatabase).find(sd => sd.title === song.title)
    
    if (!songData) {
      return null // 找不到歌曲数据，直接排除
    }
    
    // 获取歌曲在指定维度的原始指标值（难度定数）
    const songIndicatorValue = getSongIndicatorValue(songData, bestKey)
    
    // 获取歌曲的综合难度指标（rating）
    const songRatingValue = calcRatingIndicator(songData.constant)
    
    // 获取用户在该歌曲的评分
    const userScoreValue = song[bestKey] as number
    
    // 条件1：歌曲综合难度定数指标（rating）不应超过 Best20 综合难度中位数 + 0.2
    if (songRatingValue > best20RatingMedian + 0.2) {
      return null
    }
    
    // 判断是否为未游玩的歌曲（所有判定数都为0）
    const isUnplayed = song.great === 0 && song.good === 0 && song.bad === 0
    
    // 计算用户精度（准确率）
    // 使用 calcAccuracy 函数的逻辑：准确率 = (良判数 * 权重) / 总音符数
    // 注意：当前可判的权重为0，所以只计算良判
    const ACCURACY_WEIGHT_GREAT = 1
    const ACCURACY_WEIGHT_GOOD = 0
    const userAccuracy = (song.great * ACCURACY_WEIGHT_GREAT + song.good * ACCURACY_WEIGHT_GOOD) / songData.totalNotes
    
    // 计算精度因子：1 - 准确率，值越大表示精度越低，越需要练习
    // 如果准确率低于50%或为0，设置精度因子为1（最高惩罚）
    // 未游玩的歌曲设置精度因子为0.5（中等优先级）
    const accuracyFactor = isUnplayed ? 0.5 : ((userAccuracy >= 0.5 && userAccuracy > 0) ? (1 - userAccuracy) : 1)
    
    // 计算偏差值
    // 偏差1：歌曲指标偏差（歌曲难度定数 vs Best20中位数难度定数）
    const indicatorDeviationAbs = Math.abs(songIndicatorValue - best20IndicatorMedian)
    const indicatorDeviationPercent = indicatorDeviationAbs / best20IndicatorMedian
    
    // 偏差2：用户评分偏差（用户评分 vs Best20指标中位数）
    // 使用指标中位数作为评分基准，而不是用户得分中位数
    const scoreDeviationAbs = Math.abs(userScoreValue - best20IndicatorMedian)
    const scoreDeviationPercent = scoreDeviationAbs / best20IndicatorMedian
    
    // 使用平衡算法计算综合分数（值越小越推荐）
    const balanceScore = calculateBalanceScore(indicatorDeviationPercent, scoreDeviationPercent, accuracyFactor)
    
    // 判断是否在严格范围内（第一优先级）
    const isInStrictRange = 
      songIndicatorValue <= best20IndicatorMedian * 1.05 // 上浮不超过 5%
      && songIndicatorValue >= best20IndicatorMedian * 0.85      // 下浮不超过 15%
    
    return { 
      ...song,
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
      _scoreBaseline: best20UserScoreMedian  // 评分基准值是 Best20 用户得分中位数
    }
  }).filter((song): song is NonNullable<typeof song> => song !== null)
  
  // 7. 分三层排序
  // 第一层：优先推荐在严格范围内的歌曲（指标偏差 +5%/-20%）
  // 在严格范围内，未游玩的歌曲优先于已游玩的歌曲
  const strictRangeSongs = scored
    .filter(s => s._isInStrictRange)
    .sort((a, b) => {
      // 先按是否未游玩排序（未游玩的优先）
      if (a._isUnplayed !== b._isUnplayed) {
        return a._isUnplayed ? -1 : 1
      }
      // 再按推荐分数排序
      return a._recommendScore - b._recommendScore
    })
  
  // 第二层：如果数量不足，继续从严格范围外的歌曲中补足
  // 严格范围外的歌曲按难度偏差排序，优先选择难度偏差最小的
  // 在相同难度偏差下，未游玩的歌曲优先
  const remainingSongs = scored
    .filter(s => !s._isInStrictRange)
    .sort((a, b) => {
      // 先按难度偏差排序
      const deviationDiff = a._indicatorDeviationPercent - b._indicatorDeviationPercent
      if (Math.abs(deviationDiff) > 0.01) { // 如果难度偏差差异超过1%，按偏差排序
        return deviationDiff
      }
      // 难度偏差接近时，未游玩的歌曲优先
      if (a._isUnplayed !== b._isUnplayed) {
        return a._isUnplayed ? -1 : 1
      }
      return 0
    })
  
  // 合并结果：先严格范围内的，再补充范围外的
  const result = [...strictRangeSongs, ...remainingSongs]
  
  return result.slice(0, limit)
}