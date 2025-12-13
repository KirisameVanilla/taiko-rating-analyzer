// 难度映射 - 用于在曲名后显示难度标识
// 只有裏(level 5)显示标识
export const difficultyMap: Record<number, string> = {
  5: '(裏)'
}

// 难度徽章映射 - 用于显示难度徽章文本
export const difficultyBadgeMap: Record<number, string> = {
  1: '简单',
  2: '普通',
  3: '困难',
  4: '鬼',
  5: '裏'
}
