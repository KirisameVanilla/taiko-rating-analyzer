export interface RatingDimensions {
  rating: number
  daigouryoku: number
  stamina: number
  speed: number
  accuracy_power: number
  rhythm: number
  complex: number
}

export interface ScoreCounts {
  great: number
  good: number
  bad: number
}

export interface SongLevelData {
  constant: number
  totalNotes: number
  composite: number
  avgDensity: number
  instDensity: number
  separation: number
  bpmChange: number
  hsChange: number
}

export interface SongData {
  id: number
  title: string
  is_cn?: boolean
  title_cn?: string
  level: {
    '4'?: SongLevelData
    '5'?: SongLevelData
  }
}

export interface UserScore extends ScoreCounts {
  id: number
  level: number
  score: number
  scoreRank: number
  drumroll: number
  combo: number
  playCount: number
  clearCount: number
  fullcomboCount: number
  perfectCount: number
  updatedAt: string
}

export interface SongStats extends RatingDimensions, ScoreCounts {
  id: number
  level: number
  title: string
  _constant?: number
  _maxRatings?: RatingDimensions
  _dimensionRanks?: Record<keyof RatingDimensions, number>
  _isUnplayed?: boolean
  _isNew?: boolean
  _ratingDiff?: number
}

export interface Announcement {
  id: number
  text: string
  type?: 'info' | 'warning' | 'success'
  date?: string
}

export type SongsDatabase = SongData[]

export type LockedScores = Record<string, UserScore>
