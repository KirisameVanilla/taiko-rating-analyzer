<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { SongStats } from '../types'
import { 
  parsePastedScores, 
  calculateSongStats,
  getTop20Median,
  getTop20WeightedAverage,
  topValueCompensate
} from '../utils/calculator'
import { loadSongsData } from '../data/songs'
import RadarChart from './RadarChart.vue'
import TopTable from './TopTable.vue'

const router = useRouter()
const notice = ref('正在加载数据…')
const results = ref<SongStats[]>([])
const overallRating = ref(0)
const radarData = ref({
  daigouryoku: 0,
  stamina: 0,
  speed: 0,
  accuracy: 0,
  rhythm: 0,
  complex: 0
})

onMounted(async () => {
  try {
    // 从 localStorage 读取数据
    const scoreInput = localStorage.getItem('taikoScoreData') || ''
    if (!scoreInput) {
      notice.value = '未找到数据,请先在首页输入数据'
      return
    }
    
    const songsDB = await loadSongsData()
    const scores = parsePastedScores(scoreInput)
    const tempResults: SongStats[] = []
    
    scores.forEach(s => {
      const key = `${s.id}-${s.level}`
      const songData = songsDB[key]
      if (!songData) return
      
      const stats = calculateSongStats(songData, s)
      if (stats) tempResults.push(stats)
    })
    
    results.value = tempResults
    calculateOverallStats(tempResults)
    
    if (tempResults.length === 0) {
      notice.value = '未获取到成绩数据或无法计算'
    } else {
      notice.value = ''
    }
  } catch (e) {
    console.error(e)
    notice.value = '数据加载失败,请检查输入格式'
  }
})

function calculateOverallStats(data: SongStats[]) {
  const ratingMid = getTop20Median(data, 'rating')
  const daigouryokuMid = getTop20Median(data, 'daigouryoku')
  const staminaMid = getTop20Median(data, 'stamina')
  const speedMid = getTop20Median(data, 'speed')
  const accuracyMid = getTop20Median(data, 'accuracy_power')
  const rhythmMid = getTop20Median(data, 'rhythm')
  const complexMid = getTop20Median(data, 'complex')

  const ratingAve = getTop20WeightedAverage(data, 'rating')
  const daigouryokuAve = getTop20WeightedAverage(data, 'daigouryoku')
  const staminaAve = getTop20WeightedAverage(data, 'stamina')
  const speedAve = getTop20WeightedAverage(data, 'speed')
  const accuracyAve = getTop20WeightedAverage(data, 'accuracy_power')
  const rhythmAve = getTop20WeightedAverage(data, 'rhythm')
  const complexAve = getTop20WeightedAverage(data, 'complex')

  overallRating.value = topValueCompensate(ratingMid, 15.28, ratingAve, 15.31, 14.59)
  radarData.value = {
    daigouryoku: topValueCompensate(daigouryokuMid, 15.26, daigouryokuAve, 15.29, 13.81),
    stamina: topValueCompensate(staminaMid, 14.68, staminaAve, 14.92, 13.54),
    speed: topValueCompensate(speedMid, 14.25, speedAve, 14.59, 14.14),
    accuracy: topValueCompensate(accuracyMid, 15.44, accuracyAve, 15.45, 14.59),
    rhythm: topValueCompensate(rhythmMid, 14.52, rhythmAve, 14.83, 13.84),
    complex: topValueCompensate(complexMid, 13.77, complexAve, 14.26, 12.83)
  }
}

const topLists = computed(() => ({
  rating: [...results.value].sort((a, b) => b.rating - a.rating).slice(0, 20),
  daigouryoku: [...results.value].sort((a, b) => b.daigouryoku - a.daigouryoku).slice(0, 20),
  stamina: [...results.value].sort((a, b) => b.stamina - a.stamina).slice(0, 20),
  speed: [...results.value].sort((a, b) => b.speed - a.speed).slice(0, 20),
  accuracy_power: [...results.value].sort((a, b) => b.accuracy_power - a.accuracy_power).slice(0, 20),
  rhythm: [...results.value].sort((a, b) => b.rhythm - a.rhythm).slice(0, 20),
  complex: [...results.value].sort((a, b) => b.complex - a.complex).slice(0, 20)
}))
</script>

<template>
  <div class="container">
    <h1>玩家Rating及六维雷达图</h1>
    <div v-if="notice" class="notice">{{ notice }}</div>
    
    <div class="summary">
      <div class="stat-box">
        <div class="stat-value">{{ overallRating.toFixed(2) }}</div>
        <div class="stat-label">Rating</div>
      </div>
    </div>

    <div class="chart-container">
      <RadarChart :data="radarData" />
    </div>

    <TopTable title="Rating Top 20" :data="topLists.rating" valueKey="rating" />
    <TopTable title="大歌力 Top 20" :data="topLists.daigouryoku" valueKey="daigouryoku" />
    <TopTable title="体力 Top 20" :data="topLists.stamina" valueKey="stamina" />
    <TopTable title="高速处理 Top 20" :data="topLists.speed" valueKey="speed" />
    <TopTable title="精度力 Top 20" :data="topLists.accuracy_power" valueKey="accuracy_power" />
    <TopTable title="节奏处理 Top 20" :data="topLists.rhythm" valueKey="rhythm" />
    <TopTable title="复合处理 Top 20" :data="topLists.complex" valueKey="complex" />

    <button @click="router.push('/')" class="back-btn">返回</button>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

h1 {
  text-align: center;
  color: #333;
}

.notice {
  text-align: center;
  color: #888;
  margin: 10px 0;
}

.summary {
  display: flex;
  justify-content: space-around;
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.stat-box {
  text-align: center;
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin: 5px;
  min-width: 100px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #e91e63;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.chart-container {
  position: relative;
  height: 400px;
  width: 100%;
  margin-bottom: 40px;
}

.back-btn {
  width: 100%;
  padding: 12px;
  background: #666;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 20px;
  transition: background 0.3s;
}

.back-btn:hover {
  background: #555;
}
</style>
