export interface SongData {
  title: string
  constant: number
  totalNotes: number
  composite: number
  avgDensity: number
  instDensity: number
  separation: number
  bpmChange: number
  hsChange: number
}

export interface UserScore {
  id: number
  level: number
  score: number
  scoreRank: number
  great: number
  good: number
  bad: number
  drumroll: number
  combo: number
  playCount: number
  clearCount: number
  fullcomboCount: number
  perfectCount: number
  updatedAt: string
}

export interface SongStats {
  title: string
  rating: number
  daigouryoku: number
  stamina: number
  speed: number
  accuracy_power: number
  rhythm: number
  complex: number
  great: number
  good: number
  bad: number
}

export interface SongsDatabase {
  [key: string]: SongData
}
