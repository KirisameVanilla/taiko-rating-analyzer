import type { UserScore, SongLevelData, SongStats } from '../types'

// 常量定义：P1用于calcP函数的范数计算，AH1暂未使用
const CONSTANTS = { P1: 150, AH1: 3 }
const POWER = Math.pow
const SQRT = Math.sqrt
const MAX = Math.max

/* 准确度权重定义：
 * 官方计分法中，2可 = 1良
 * 但我们希望在计算准确率时，给予良判更高的权重，因此暂时将可的权重设为0，并在需要时进行调整以修正对最终评分的影响
 */
const ACCURACY_WEIGHT = {
  GREAT: 1,
  // GOOD: 0.5
  GOOD: 0
}


// 定数到定数得点x的映射表
const CONSTANT_TO_X_MAP: Record<number, number> = {
  1.0: 0.05,
  1.5: 0.10,
  2.0: 0.15,
  2.5: 0.20,
  3.0: 0.25,
  3.5: 0.30,
  4.0: 0.35,
  4.5: 0.40,
  5.0: 0.45,
  5.5: 0.50,
  6.0: 0.55,
  6.2: 0.65,
  6.4: 0.75,
  6.6: 0.85,
  6.8: 0.95,
  6.9: 1.00,
  7.0: 1.14,
  7.1: 1.29,
  7.2: 1.43,
  7.3: 1.57,
  7.4: 1.71,
  7.5: 1.86,
  7.6: 2.00,
  7.7: 2.25,
  7.8: 2.50,
  7.9: 2.75,
  8.0: 3.00,
  8.1: 3.25,
  8.2: 3.50,
  8.3: 3.75,
  8.4: 4.00,
  8.5: 4.25,
  8.6: 4.50,
  8.7: 4.75,
  8.8: 5.00,
  8.9: 5.333,
  9.0: 5.666,
  9.1: 6.00,
  9.2: 6.333,
  9.3: 6.666,
  9.4: 7.00,
  9.5: 7.50,
  9.6: 8.00,
  9.7: 8.50,
  9.8: 9.00,
  9.9: 9.25,
  10.0: 9.50,
  10.1: 9.75,
  10.2: 10.00,
  10.3: 10.50,
  10.4: 11.00,
  10.5: 11.333,
  10.6: 11.666,
  10.7: 12.00,
  10.8: 12.50,
  10.9: 13.00,
  11.0: 13.333,
  11.1: 13.666,
  11.2: 14.00,
  11.3: 14.50,
  11.4: 15.00,
  11.5: 15.25,
  11.6: 15.50
}

// 最大定数值
export const MAX_CONSTANT_VALUE = 11.6
// 归一化系数
export const NORMALIZATION_FACTOR = CONSTANT_TO_X_MAP[MAX_CONSTANT_VALUE]

/**
 * 根据定数获取对应的x值（定数得点）
 * @param constant - 谱面定数
 * @returns x值，如果定数不在映射表中则返回0.05（最小值）
 */
export function getXFromConstant(constant: number): number {
  return CONSTANT_TO_X_MAP[constant] ?? 0.05
}

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
export function calcStaminaIndicator(avgDensity: number, instDensity: number): number {
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
export function calcSpeedIndicator(instDensity: number, avgDensity: number): number {
  if (instDensity > avgDensity) {
    return instDensity - (1 - avgDensity / instDensity) * (instDensity - avgDensity)
  } else {
    return instDensity + (1 - instDensity / avgDensity) * (avgDensity - instDensity)
  }
}

/** 计算节奏(Rhythm)指标
 * 基于音符分离度和BPM变化，评估谱面对节奏感的要求
 * @param separation - 音符分离度（音符间隔均匀性）
 * @param bpmChange - BPM变化幅度
 * @returns 节奏值
 * 
 * 算法逻辑：
 * - 结合音符分离度和BPM变化，评估节奏的复杂性
 * - BPM变化越大，节奏值越高，反映节奏的多样性
 */
export function calcRhythmIndicator(separation: number, bpmChange: number): number {
  return separation + (separation / 100) * (bpmChange / 100) * (100 - separation)
}

/** 计算复杂度(Complexity)指标
 * 基于谱面的composite值，评估谱面的复杂程度
 * @param composite - 谱面composite值
 * @returns 复杂度值
 * 算法逻辑：
 * - 直接使用谱面的composite值作为复杂度指标
 * - 反映谱面的多样性和技术要求
 */
export function calcComplexityIndicator(composite: number): number {
  return composite
}

/** 计算打鼓力(Daigouryoku)指标
 * 直接根据谱面定数计算打鼓力，使用歌曲难度定数到定数得点的映射
 * @param constant - 谱面定数
 * @returns 打鼓力值
 */
export function calcDaigouryokuIndicator(constant: number): number {
  return getXFromConstant(constant)
}

/** 计算精度力(Accuracy Power)指标
 * 直接根据谱面定数计算精度力，使用歌曲难度定数到定数得点的映射
 * @param constant - 谱面定数
 * @return 精度力值
 */
export function calcAccuracyPowerIndicator(constant: number): number {
  return getXFromConstant(constant)
}

/** 计算综合Rating指标
 * 直接根据谱面定数计算综合Rating，使用歌曲难度定数到定数得点的映射
 * @param constant - 谱面定数
 * @return 综合Rating值
 */
export function calcRatingIndicator(constant: number): number {
  return getXFromConstant(constant)
}

/** 计算准确率
 * 根据用户成绩计算准确率，作为后续评分的基础
 * @param totalNotes - 谱面总音符数
 * @param userScore - 用户游玩成绩（good数、combo等）
 * @returns 准确率，范围 [0, 1]，低于50%返回0
 * 算法逻辑：
 * - 准确率 = (良判数 * 良权重 + 可判数 * 可权重) / 总音符数
 * - 如果计算结果低于50%，则视为无效成绩，返回0
 */
export function calcAccuracy(totalNotes: number, userScore: UserScore): (number) {
  const accuracy = (userScore.great * ACCURACY_WEIGHT.GREAT + userScore.good * ACCURACY_WEIGHT.GOOD) / totalNotes
  if (accuracy < 0.5) return 0
  return accuracy
}

/** 计算单维度能力值
 * 使用几何平均法将综合rating分配到各个维度
 * @param rating - 综合rating值
 * @param raw_value - 维度的原始指标值
 * @returns 该维度的最终能力值
 * 算法逻辑：
 * - 采用几何平均 √(rating × raw_value)，平衡综合能力和维度要求
 * - 乘以MAX_CONSTANT_VALUE / 100进行归一化，确保维度值在合理范围内
 */
export function calcIndividualRating(rating: number, raw_value: number): number {
  return SQRT(rating * raw_value * NORMALIZATION_FACTOR / 100)
}

/**
 * 计算单曲最大可能评分
 * 基于谱面数据，计算在理论最高准确率下的各维度最大评分
 * @param levelData - 谱面基础数据（难度、密度、节奏等）
 * @return 包含各维度最大评分的对象
 * 计算流程：
 * 1. 计算x和理论最高准确率对应的y值
 * 2. 计算综合最大rating
 * 3. 计算各维度的最大指标值
 * 4. 使用几何平均计算各维度的最大能力值
 * 返回值说明：
 * - maxRating: 综合最大rating
 * - maxDaigouryoku: 最大打鼓力
 * - maxStamina: 最大耐力
 * - maxSpeed: 最大速度
 * - maxAccuracyPower: 最大精度力
 * - maxRhythm: 最大节奏
 * - maxComplex: 最大复杂度
 */

export function calcMaxRatings(levelData: SongLevelData): { maxRating: number; maxDaigouryoku: number; maxStamina: number; maxSpeed: number; maxAccuracyPower: number; maxRhythm: number; maxComplex: number } {
  const x = getXFromConstant(levelData.constant)
  const y = calcY(1)  // 理论最高准确率对应的Y值
  const maxRating = calcSingleRating(x, y)
  const maxDaigouryoku = calcDaigouryokuIndicator(levelData.constant)
  const maxAccuracyPower = SQRT(maxRating * y)  // 精度力 = √(maxRating × y)
  const maxStamina = calcIndividualRating(maxRating, calcStaminaIndicator(levelData.avgDensity, levelData.instDensity))
  const maxSpeed = calcIndividualRating(maxRating, calcSpeedIndicator(levelData.instDensity, levelData.avgDensity))
  const maxRhythm = calcIndividualRating(maxRating, calcRhythmIndicator(levelData.separation, levelData.bpmChange))
  const maxComplex = calcIndividualRating(maxRating, calcComplexityIndicator(levelData.composite))
  return {
    maxRating,
    maxDaigouryoku,
    maxStamina,
    maxSpeed,
    maxAccuracyPower,
    maxRhythm,
    maxComplex
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
export function calculateSongStats(levelData: SongLevelData, userScore: UserScore, title: string = ''): SongStats | null {
  // 计算准确率
  const accuracy = calcAccuracy(levelData.totalNotes, userScore)
  if (accuracy === 0) return null  // 准确率过低，不计算统计数据
  
  // 计算x, y和综合rating
  const x = getXFromConstant(levelData.constant)
  const y = calcY(accuracy)
  const rating = calcSingleRating(x, y)
  
  // 计算各原始维度指标
  const raw_complex = calcComplexityIndicator(levelData.composite)
  const raw_stamina = calcStaminaIndicator(levelData.avgDensity, levelData.instDensity)
  const raw_speed = calcSpeedIndicator(levelData.instDensity, levelData.avgDensity)
  const raw_rhythm = calcRhythmIndicator(levelData.separation, levelData.bpmChange)
  
  // 使用几何平均将rating分配到各维度，MAX_CONSTANT_VALUE 是难度最大值的归一化系数
  const daigouryoku = SQRT(rating * x)
  const accuracy_power = SQRT(rating * y)
  const stamina = calcIndividualRating(rating, raw_stamina)
  const speed = calcIndividualRating(rating, raw_speed)
  const rhythm = calcIndividualRating(rating, raw_rhythm)
  const complex = calcIndividualRating(rating, raw_complex)
  
  return {
    id: userScore.id,
    level: userScore.level,
    title: title,
    rating,
    daigouryoku,
    stamina,
    speed,
    accuracy_power,
    rhythm,
    complex,
    great: userScore.great,
    good: userScore.good,
    bad: userScore.bad
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

    return arr.map(r => {
        const isDondafuru = (Number(r[12]) > 0 && !(
            (r[0] === 775  && r[1] === 4) ||    // 表 パン vs ごはん！ 大決戦！
            (r[0] === 775  && r[1] === 5) ||    // 里 パン vs ごはん！ 大決戦！
            (r[0] === 1032 && r[1] === 5) ||    // 里 Emma
            (r[0] === 1037 && r[1] === 4) ||    // 表 BATTLE NO.1
            (r[0] === 1356 && r[1] === 4)       // 表 Soulway
        ));
        return {
            id: Number(r[0]),
            level: Number(r[1]),
            score: Number(r[2]) || 0,
            scoreRank: Number(r[3]) || 0,
            // 判断是否虹冠，但表里面包米饭、里emma、battleno1除外
            great: isDondafuru ? (Number(r[4]) + Number(r[5]) + Number(r[6])) || 0 : Number(r[4]) || 0,
            good: isDondafuru ? 0 : Number(r[5]) || 0,
            bad: isDondafuru ? 0 : Number(r[6]) || 0,
            drumroll: Number(r[7]) || 0,
            combo: Number(r[8]) || 0,
            playCount: Number(r[9]) || 0,
            clearCount: Number(r[10]) || 0,
            fullcomboCount: Number(r[11]) || 0,
            perfectCount: Number(r[12]) || 0,
            updatedAt: r[13]
        };
    })
}

/**
 * 过滤重复/包含关系的曲目
 * 根据shouldFilterList中指定的{id,level}分组，每组只保留rating最高的那个
 * @param data - 所有歌曲的统计数据数组
 * @param shouldFilterList - 二维数组，每个子数组包含一组互相重复的曲目 {id, level} 对象
 * @returns 过滤后的数据数组
 */
export function filterDuplicateSongs(data: SongStats[], shouldFilterList: Array<Array<{id: number, level: number}>> = []): SongStats[] {
  // 如果没有筛选列表，直接返回原数据
  if (shouldFilterList.length === 0) {
    return data
  }

  // 创建 "id-level" 字符串到筛选组索引的映射
  const keyToGroupIndex = new Map<string, number>()
  shouldFilterList.forEach((group, groupIndex) => {
    group.forEach(item => {
      const key = `${item.id}-${item.level}`
      keyToGroupIndex.set(key, groupIndex)
    })
  })

  // 为每个筛选组找到rating最高的曲目key
  const groupBestKeys = new Map<number, string>()
  data.forEach(song => {
    const key = `${song.id}-${song.level}`
    const groupIndex = keyToGroupIndex.get(key)
    if (groupIndex !== undefined) {
      const currentBest = groupBestKeys.get(groupIndex)
      if (currentBest === undefined) {
        groupBestKeys.set(groupIndex, key)
      } else {
        const currentBestSong = data.find(s => `${s.id}-${s.level}` === currentBest)
        if (currentBestSong && song.rating > currentBestSong.rating) {
          groupBestKeys.set(groupIndex, key)
        }
      }
    }
  })

  // 筛选结果：保留不在筛选列表中的曲目，以及每组中rating最高的曲目
  return data.filter(song => {
    const key = `${song.id}-${song.level}`
    const groupIndex = keyToGroupIndex.get(key)
    // 不在任何筛选组中，保留
    if (groupIndex === undefined) {
      return true
    }
    // 在筛选组中，只保留该组rating最高的
    return groupBestKeys.get(groupIndex) === key
  })
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
