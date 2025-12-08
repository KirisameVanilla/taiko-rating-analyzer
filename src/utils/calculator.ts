import type { UserScore, SongData, SongStats } from '../types'

// 常量定义：P1用于calcP函数的范数计算，AH1暂未使用
const CONSTANTS = { P1: 66, AH1: 3 }
const POWER = Math.pow
const SQRT = Math.sqrt
const MAX = Math.max

/**
 * 计算准确度分数 (Y轴值)
 * 根据玩家的准确率计算对应的Y轴分数，使用分段函数模拟难度曲线
 * @param accuracy - 准确率 (good数/总notes数)，范围 [0, 1]
 * @returns Y轴分数，代表准确度维度的能力值
 * 
 * 分段逻辑：
 * - accuracy ≤ 0.5: 返回0，过低准确率不计分
 * - 0.5 < accuracy ≤ 0.6832: 使用幂函数快速增长曲线
 * - 0.6832 < accuracy ≤ 0.9625: 使用线性函数平稳增长
 * - accuracy > 0.9625: 使用指数函数陡峭增长，奖励高精度
 */
export function calcY(accuracy: number): number {
  const g = accuracy
  if (g <= 0.5) return 0
  if (g <= 0.6832) {
    return 4425 * POWER(g - 0.5, 4.876)
  } else if (g <= 0.9625) {
    return 30.748 * g - 19.88
  } else {
    return 0.228 * POWER(2.718, 3.386 * POWER(g, 24.658)) + 8.862
  }
}

/**
 * 计算自适应范数参数 P
 * 根据难度(x)和准确度分数(y)的差距动态调整范数，用于后续rating的加权计算
 * @param x - 谱面难度值
 * @param y - 准确度分数
 * @returns 范数参数P，范围约为 [0, 66]
 * 
 * 算法逻辑：
 * - 当x和y差距较大时，term变为负数，返回最大值66（使用无穷范数，取最大值）
 * - 当x和y接近时，返回较小的P值（使用较小范数，平衡两个维度）
 * - 这样可以在难度和准确度不平衡时侧重较强的维度
 */
export function calcP(x: number, y: number): number {
  const term = POWER(CONSTANTS.P1, 2) - POWER(x - y, 2) / 2
  if (term < 0) return CONSTANTS.P1
  return CONSTANTS.P1 - SQRT(term)
}

/**
 * 计算加权系数 W
 * 根据难度和准确度在最优区域的位置，动态调整x和y的权重
 * @param x - 谱面难度值
 * @param y - 准确度分数
 * @returns 权重系数W，范围 [0.5, 1]
 * 
 * 算法逻辑：
 * - 定义了一个以(15.5, 23)为中心的椭圆最优区域
 * - 当(x,y)在最优区域内时，返回较大的W值
 * - 当(x,y)偏离最优区域时，返回最小值0.5
 * - W用于后续rating计算中平衡难度和准确度的权重
 */
export function calcW(x: number, y: number): number {
  const term = 25 - POWER(x - 15.5, 2) / 25 - POWER(y - 23, 2) / 69
  if (term < 0) return 0.5
  return MAX(SQRT(term) - 4, 0.5)
}

/**
 * 计算单曲综合Rating
 * 使用广义平均数（幂平均）结合动态权重和范数，综合难度和准确度计算rating
 * @param x - 谱面难度值
 * @param y - 准确度分数
 * @returns 单曲rating值
 * 
 * 核心公式：rating = (w·x^p + (1-w)·y^p)^(1/p)
 * - w是由calcW计算的权重，决定难度和准确度的重要性比例
 * - p是由calcP计算的范数参数，决定取平均的方式
 * - 这种设计使得rating能够自适应不同的难度-准确度组合
 */
export function calcSingleRating(x: number, y: number): number {
  const p = calcP(x, y)
  const w = calcW(x, y)
  return POWER(w * POWER(x, p) + (1 - w) * POWER(y, p), 1 / p)
}

/**
 * 计算Rating边界值
 * 用于图表展示或分析，计算当前x,y点在各个方向上的极限rating值
 * @param x - 谱面难度值
 * @param y - 准确度分数
 * @returns 四个方向的边界rating值
 * 
 * 返回值说明：
 * - r_xmin: 保持当前y不变，难度降到最低(0.05)时的rating
 * - r_xmax: 保持当前y不变，难度达到最高(15.5)时的rating
 * - r_ymin: 保持当前x不变，准确度降到最低(0)时的rating
 * - r_ymax: 保持当前x不变，准确度达到最高(理论最大值)时的rating
 */
export function calcBoundaries(x: number, y: number) {
  const y_max_val = 0.228 * POWER(2.718, 3.386 * POWER(1, 24.658)) + 8.862
  const r_xmin = calcSingleRating(0.05, y)
  const r_xmax = calcSingleRating(15.5, y)
  const r_ymin = calcSingleRating(x, 0)
  const r_ymax = calcSingleRating(x, y_max_val)
  return { r_xmin, r_xmax, r_ymin, r_ymax }
}

/**
 * 计算耐力(Stamina)指标
 * 基于平均密度和瞬时密度的关系，评估谱面对耐力的要求
 * @param avgDensity - 平均密度（整体打击密度）
 * @param instDensity - 瞬时密度（局部最高密度）
 * @returns 耐力值
 * 
 * 算法逻辑：
 * - 当平均密度 > 瞬时密度（持续高密度）：提升耐力值，强调持久战
 * - 当平均密度 < 瞬时密度（间歇性高潮）：降低耐力值，更偏向爆发力
 * - 这样区分了"马拉松型"和"冲刺型"谱面
 */
export function calcStamina(avgDensity: number, instDensity: number): number {
  if (avgDensity > instDensity) {
    return avgDensity + (avgDensity / 100) * (1 - instDensity / avgDensity) * (100 - avgDensity)
  } else {
    return avgDensity - (1 - avgDensity / instDensity) * avgDensity
  }
}

/**
 * 计算速度(Speed)指标
 * 基于瞬时密度和平均密度的关系，评估谱面对手速的要求
 * @param instDensity - 瞬时密度（局部最高密度）
 * @param avgDensity - 平均密度（整体打击密度）
 * @returns 速度值
 * 
 * 算法逻辑：
 * - 当瞬时密度 > 平均密度（有明显爆发段）：降低速度值的增幅，避免过度夸大
 * - 当瞬时密度 < 平均密度（整体均衡）：提升速度值，奖励持续的高速
 * - 与calcStamina形成互补，分别衡量"爆发力"和"持久力"
 */
export function calcSpeed(instDensity: number, avgDensity: number): number {
  if (instDensity > avgDensity) {
    return instDensity - (1 - avgDensity / instDensity) * (instDensity - avgDensity)
  } else {
    return instDensity + (1 - instDensity / avgDensity) * (avgDensity - instDensity)
  }
}

/**
 * 计算单曲的所有统计数据
 * 这是核心函数，将谱面数据和用户成绩综合计算出多维度的能力评估
 * @param songData - 谱面基础数据（难度、密度、节奏等）
 * @param userScore - 用户游玩成绩（good数、combo等）
 * @returns 包含rating和各维度能力值的统计对象，准确率过低时返回null
 * 
 * 计算流程：
 * 1. 计算准确率并验证有效性（≥50%）
 * 2. 计算Y值（准确度分数）和综合rating
 * 3. 计算各原始维度指标（复杂度、耐力、速度、节奏）
 * 4. 使用几何平均（√(rating × 维度值)）计算最终各维度能力
 * 
 * 各维度说明：
 * - daigouryoku(打鼓力): 综合难度能力 = √(rating × x)
 * - stamina(耐力): 持久战能力，基于密度分布
 * - speed(速度): 手速/爆发力，基于瞬时密度
 * - accuracy_power(精度力): 准确度能力 = √(rating × y)
 * - rhythm(节奏): 节奏感要求，基于音符分布和BPM变化
 * - complex(复杂度): 谱面复杂程度，基于composite值
 */
export function calculateSongStats(songData: SongData, userScore: UserScore): SongStats | null {
  const total = songData.totalNotes
  const accuracy = userScore.great / total
  if (accuracy < 0.5) return null
  
  const x = songData.x
  const y = calcY(accuracy)
  const rating = calcSingleRating(x, y)
  
  // 计算各原始维度指标
  const raw_complex = songData.composite
  const raw_stamina = calcStamina(songData.avgDensity, songData.instDensity)
  const raw_speed = calcSpeed(songData.instDensity, songData.avgDensity)
  const raw_rhythm = songData.separation + (songData.separation / 100) * (songData.bpmChange / 100) * (100 - songData.separation)
  
  // 使用几何平均将rating分配到各维度，15.5是难度最大值的归一化系数
  const daigouryoku = SQRT(rating * x)
  const stamina = SQRT(rating * raw_stamina * 15.5 / 100)
  const speed = SQRT(rating * raw_speed * 15.5 / 100)
  const accuracy_power = SQRT(rating * y)
  const rhythm = SQRT(rating * raw_rhythm * 15.5 / 100)
  const complex = SQRT(rating * raw_complex * 15.5 / 100)
  
  return {
    title: songData.title,
    rating,
    daigouryoku,
    stamina,
    speed,
    accuracy_power,
    rhythm,
    complex
  }
}

/**
 * 解析粘贴的成绩数据
 * 将用户粘贴的原始成绩数据（字符串或数组）转换为结构化的UserScore对象数组
 * @param raw - 原始成绩数据，可以是JSON字符串或数组
 * @returns UserScore对象数组
 * 
 * 数据映射：
 * - r[0] → id: 曲目ID
 * - r[1] → level: 难度等级
 * - r[2] → score: 总分数
 * - r[3] → scoreRank: 分数等级（未使用）
 * - r[4] → great: 良(good)判定数
 * - r[5] → good: 可(ok)判定数
 * - r[6] → bad: 不可(bad)判定数
 * - r[7] → drumroll: 连打判定数
 * - r[8] → combo: 最大连击数
 * - r[9] → playCount: 游玩次数（未使用）
 * - r[10] → clearCount: 过关次数（未使用）
 * - r[11] → fullcomboCount: 全连次数
 * - r[12] → perfectCount: 全良次数（未使用）
 * - r[13] → updatedAt: 更新时间
 */
export function parsePastedScores(raw: string | any[]): UserScore[] {
  const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!Array.isArray(arr)) return []
  
  return arr.map(r => ({
    id: Number(r[0]),
    level: Number(r[1]),
    score: Number(r[2]) || 0,
    scoreRank: Number(r[3]) || 0,
    great: Number(r[4]) || 0,
    good: Number(r[5]) || 0,
    bad: Number(r[6]) || 0,
    drumroll: Number(r[7]) || 0,
    combo: Number(r[8]) || 0,
    playCount: Number(r[9]) || 0,
    clearCount: Number(r[10]) || 0,
    fullcomboCount: Number(r[11]) || 0,
    perfectCount: Number(r[12]) || 0,
    updatedAt: r[13]
  }))
}

/**
 * 计算Top20简单平均值
 * 从所有成绩中提取指定维度的Top20，计算算术平均值
 * @param data - 所有歌曲的统计数据数组
 * @param key - 要计算的维度键名（如'rating', 'stamina'等）
 * @returns Top20的算术平均值，保留2位小数
 */
export function getTop20Average(data: SongStats[], key: keyof SongStats): number {
  const sorted = data.map(d => d[key] as number).sort((a, b) => b - a)
  const top20 = sorted.slice(0, 20)
  if (top20.length === 0) return 0
  const sum = top20.reduce((a, b) => a + b, 0)
  return parseFloat((sum / top20.length).toFixed(2))
}

/**
 * 计算Top20加权平均值
 * 使用递减权重计算Top20的加权平均，更重视靠前的高分成绩
 * @param data - 所有歌曲的统计数据数组
 * @param key - 要计算的维度键名
 * @returns Top20的加权平均值，保留2位小数
 * 
 * 权重分配（总和=1.0）：
 * - 第1-5名: 各占8%，共40%
 * - 第6-10名: 各占6%，共30%
 * - 第11-16名: 各占3.33%，共20%
 * - 第17-20名: 各占2.5%，共10%
 * 
 * 这种权重分布鼓励玩家在多首高难度曲目上取得好成绩，
 * 同时避免单曲刷分过度影响总体评价
 */
export function getTop20WeightedAverage(data: SongStats[], key: keyof SongStats): number {
  const sorted = data.map(d => d[key] as number).sort((a, b) => b - a)
  const top20 = sorted.slice(0, 20)
  
  if (top20.length === 0) return 0
  
  const weights = [0.4/5, 0.4/5, 0.4/5, 0.4/5, 0.4/5, 
                   0.3/5, 0.3/5, 0.3/5, 0.3/5, 0.3/5,
                   0.2/6, 0.2/6, 0.2/6, 0.2/6, 0.2/6, 0.2/6,
                   0.1/4, 0.1/4, 0.1/4, 0.1/4]
  
  let weightedSum = 0
  let weightSum = 0
  
  for (let i = 0; i < top20.length; i++) {
    const weight = weights[i]
    weightedSum += top20[i] * weight
    weightSum += weight
  }
  
  if (weightSum === 0) return 0
  
  const weightedAverage = weightedSum / weightSum
  return parseFloat(weightedAverage.toFixed(2))
}

/**
 * 计算Top20中位数
 * 提取Top20成绩的中位数，用于评估稳定性
 * @param data - 所有歌曲的统计数据数组
 * @param key - 要计算的维度键名
 * @returns Top20的中位数，保留2位小数
 * 
 * 中位数的意义：
 * - 相比平均值，中位数更能反映"典型水平"
 * - 不受极端值影响，能看出玩家的稳定发挥能力
 * - 偶数个数据时取中间两个的平均值
 */
export function getTop20Median(data: SongStats[], key: keyof SongStats): number {
  const sorted = data.map(d => d[key] as number).sort((a, b) => b - a)
  const top20 = sorted.slice(0, 20)
  
  if (top20.length === 0) return 0
  
  const mid = Math.floor(top20.length / 2)
  let median: number
  
  if (top20.length % 2 === 0) {
    median = (top20[mid - 1] + top20[mid]) / 2
  } else {
    median = top20[mid]
  }
  
  return parseFloat(median.toFixed(2))
}

/**
 * Top值补偿算法
 * 当玩家的平均水平达到一定阈值时，对中位数进行向上补偿，奖励全面发展
 * @param ratingMid - 当前rating的中位数
 * @param fullMid - 理论满分的中位数
 * @param ratingAve - 当前rating的平均值
 * @param fullAve - 理论满分的平均值
 * @param threshold - 触发补偿的阈值
 * @returns 补偿后的中位数值
 * 
 * 补偿逻辑：
 * - 如果平均值未达阈值，直接返回中位数（无补偿）
 * - 如果平均值超过阈值，计算超出比例 per = (实际-阈值)/(满分-阈值)
 * - 补偿值 = 中位数 + per × (最大难度15.5 - 满分中位数)
 * - 这样奖励那些在多个维度都表现优秀的玩家
 */
export function topValueCompensate(
  ratingMid: number,
  fullMid: number,
  ratingAve: number,
  fullAve: number,
  threshold: number
): number {
  if (ratingAve < threshold) return ratingMid
  const per = (ratingAve - threshold) / (fullAve - threshold)
  return ratingMid + per * (15.5 - fullMid)
}
