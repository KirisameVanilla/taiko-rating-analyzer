<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { SongStats } from '../types'
import { recommendSongs, setSongsDatabase } from '../utils/recommend'
import { parsePastedScores, calculateSongStats } from '../utils/calculator'
import { loadSongsData } from '../data/songs'

interface Props {
  title: string
  data: SongStats[]
  valueKey: keyof SongStats
}

const props = defineProps<Props>()

const formatValue = (item: SongStats, key: keyof SongStats): string => {
  const value = item[key]
  if (typeof value === 'number') {
    return value.toFixed(2)
  }
  return String(value)
}

// 仿照 SongsView 组件，合成全曲 SongStats
const allStats = ref<SongStats[]>([])

onMounted(async () => {
  try {
    const songsDB = await loadSongsData()
    // 设置推荐算法使用的歌曲数据库
    setSongsDatabase(songsDB)
    
    const scoreInput = localStorage.getItem('taikoScoreData') || ''
    const userScores = scoreInput ? parsePastedScores(scoreInput) : []
    const scoreMap = new Map<string, any>()
    userScores.forEach(s => {
      scoreMap.set(`${s.id}-${s.level}`, s)
    })
    const result: SongStats[] = []
    for (const [key, data] of Object.entries(songsDB)) {
      const score = scoreMap.get(key)
      if (score) {
        const stats = calculateSongStats(data, score)
        if (stats) result.push(stats)
      }
    }
    allStats.value = result
  } catch (e) {
    allStats.value = []
  }
})

// 推荐列表，取前10首，基于全曲数据
const recommendedSongs = computed(() => {
  return recommendSongs(allStats.value.length ? allStats.value : props.data, props.valueKey)
})
</script>

<template>
  <div class="table-section">
    <div class="section-header">
      <h2>{{ title }}</h2>
    </div>
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>曲名</th>
            <th>良</th>
            <th>可</th>
            <th>不可</th>
            <th>{{ title.split(' ')[0] }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in data" :key="index">
            <td>{{ index + 1 }}</td>
            <td>{{ item.title }}</td>
            <td>{{ item.great }}</td>
            <td>{{ item.good }}</td>
            <td>{{ item.bad }}</td>
            <td>{{ formatValue(item, valueKey) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- 推荐歌曲列表 -->
    <div class="recommend-section">
      <h3>推荐游玩的歌曲</h3>
      <!-- 基准值信息 -->
      <div v-if="recommendedSongs.length > 0" class="baseline-info">
        <span class="baseline-item">
          <strong>难度基准值：</strong>{{ (recommendedSongs[0] as any)._best20IndicatorMedian?.toFixed(2) || '-' }}
        </span>
        <span class="baseline-item">
          <strong>评分基准值：</strong>{{ (recommendedSongs[0] as any)._scoreBaseline?.toFixed(2) || '-' }}
        </span>
      </div>
      <div class="recommend-table-wrapper">
        <table class="recommend-table">
          <thead>
            <tr>
              <th>曲名</th>
              <th>歌曲难度指标</th>
              <th>难度偏差</th>
              <th>用户评分</th>
              <th>评分偏差</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="song in recommendedSongs" :key="song.title">
              <td class="song-title">{{ song.title }}</td>
              <td>{{ (song as any)._songIndicatorValue?.toFixed(2) || '-' }}</td>
              <td :class="{'deviation-good': (song as any)._songIndicatorValue < (song as any)._best20IndicatorMedian, 'deviation-bad': (song as any)._songIndicatorValue >= (song as any)._best20IndicatorMedian}">
                {{ ((song as any)._songIndicatorValue - (song as any)._best20IndicatorMedian)?.toFixed(2) || '-' }}
              </td>
              <td>{{ formatValue(song, valueKey) }}</td>
              <td :class="{'deviation-good': ((song as any)._userScoreValue - (song as any)._scoreBaseline) < 0, 'deviation-bad': ((song as any)._userScoreValue - (song as any)._scoreBaseline) >= 0}">
                {{ ((song as any)._userScoreValue - (song as any)._scoreBaseline)?.toFixed(2) || '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-section {
  margin-top: 0;
  background: white;
  padding: 10px;
  border-radius: 8px;
}

.table-responsive {
  overflow-x: auto;
}

.section-header {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
}

.save-btn {
  padding: 6px 12px;
  background-color: #e91e63;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.save-btn:hover {
  background-color: #c2185b;
}

.save-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

h2 {
  color: #333;
  margin: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th, td {
  padding: 10px;
  border-bottom: 1px solid #ddd;
  text-align: left;
}

th {
  background-color: #e91e63;
  color: white;
}

tr:nth-child(even) {
  background-color: #f2f2f2;
}

.recommend-section {
  margin-top: 32px;
  text-align: left;
}
.recommend-section h3 {
  font-size: 16px;
  margin-bottom: 10px;
  color: #e91e63;
}
.baseline-info {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background-color: #f9f9f9;
  border-radius: 4px;
  border-left: 3px solid #e91e63;
}
.baseline-item {
  font-size: 14px;
  color: #666;
}
.baseline-item strong {
  color: #333;
  margin-right: 4px;
}
.recommend-table-wrapper {
  overflow-x: auto;
}
.recommend-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.recommend-table th {
  background-color: #e91e63;
  color: white;
  padding: 10px;
  border-bottom: 1px solid #ddd;
  text-align: left;
}
.recommend-table td {
  padding: 10px;
  border-bottom: 1px solid #ddd;
  text-align: left;
}
.recommend-table tbody tr:nth-child(even) {
  background-color: #f2f2f2;
}
.recommend-table .song-title {
  font-weight: bold;
  color: #333;
  text-align: left;
}
.deviation-good {
  color: #4caf50;
  font-weight: 600;
}
.deviation-bad {
  color: #ff9800;
  font-weight: 600;
}
</style>
