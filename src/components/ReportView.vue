<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import html2canvas from 'html2canvas'
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
const contentRef = ref<HTMLElement | null>(null)
const isSaving = ref(false)

const activeSection = ref('overview')

const menuItems = [
  { id: 'overview', label: '概览' },
  { id: 'rating', label: 'Rating' },
  { id: 'daigouryoku', label: '大歌力' },
  { id: 'stamina', label: '体力' },
  { id: 'speed', label: '高速力' },
  { id: 'accuracy_power', label: '精度力' },
  { id: 'rhythm', label: '节奏处理' },
  { id: 'complex', label: '复合处理' }
]

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
    daigouryoku: topValueCompensate(daigouryokuMid, 15.26, daigouryokuAve, 15.29, 14.54),
    stamina: topValueCompensate(staminaMid, 14.68, staminaAve, 14.92, 13.36),
    speed: topValueCompensate(speedMid, 14.25, speedAve, 14.59, 14.00),
    accuracy: topValueCompensate(accuracyMid, 15.44, accuracyAve, 15.45, 15.08),
    rhythm: topValueCompensate(rhythmMid, 14.52, rhythmAve, 14.83, 14.02),
    complex: topValueCompensate(complexMid, 13.77, complexAve, 14.26, 13.45)
  }
}

// 取前 20 名列表
const topLists = computed(() => ({
  rating: [...results.value].sort((a, b) => b.rating - a.rating).slice(0, 20),
  daigouryoku: [...results.value].sort((a, b) => b.daigouryoku - a.daigouryoku).slice(0, 20),
  stamina: [...results.value].sort((a, b) => b.stamina - a.stamina).slice(0, 20),
  speed: [...results.value].sort((a, b) => b.speed - a.speed).slice(0, 20),
  accuracy_power: [...results.value].sort((a, b) => b.accuracy_power - a.accuracy_power).slice(0, 20),
  rhythm: [...results.value].sort((a, b) => b.rhythm - a.rhythm).slice(0, 20),
  complex: [...results.value].sort((a, b) => b.complex - a.complex).slice(0, 20)
}))

const currentTableData = computed(() => {
  if (activeSection.value === 'overview') return null
  const item = menuItems.find(i => i.id === activeSection.value)
  if (!item) return null
  return {
    title: item.label,
    data: topLists.value[activeSection.value as keyof typeof topLists.value],
    valueKey: activeSection.value as keyof SongStats
  }
})

async function saveElementAsImage(element: HTMLElement | null, fileName: string) {
  if (!element || isSaving.value) return
  isSaving.value = true
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      ignoreElements: (el: Element) => el.classList.contains('no-capture')
    })
    const link = document.createElement('a')
    link.download = `${fileName}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch (e) {
    console.error(e)
    alert('保存失败')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="container">
    <div v-if="notice" class="notice">{{ notice }}</div>
    
    <template v-else>
      <div class="report-layout">
        <!-- Sidebar -->
        <div class="sidebar no-capture">
          <div class="sidebar-menu">
            <div 
              v-for="item in menuItems" 
              :key="item.id"
              class="sidebar-item"
              :class="{ active: activeSection === item.id }"
              @click="activeSection = item.id"
            >
              {{ item.label }}
            </div>
          </div>
        </div>

        <!-- Content Area -->
        <div class="content-area" ref="contentRef">
          <!-- Overview Section -->
          <div v-if="activeSection === 'overview'" class="overview-section">
            <div class="section-header">
              <h1>玩家 Rating 及六维雷达图</h1>
            </div>
            
            <div class="summary">
              <div class="stat-box">
                <div class="stat-value">{{ overallRating.toFixed(2) }}</div>
                <div class="stat-label">Rating</div>
              </div>
            </div>

            <div class="chart-container">
              <RadarChart :data="radarData" />
            </div>
          </div>

          <!-- Top Tables -->
          <div v-else-if="currentTableData" class="table-section">
            <TopTable 
              :title="currentTableData.title" 
              :data="currentTableData.data" 
              :valueKey="currentTableData.valueKey" 
            />
          </div>
        </div>
      </div>

      <!-- Floating Action Button -->
      <div class="floating-actions no-capture">
        <button @click="saveElementAsImage(contentRef, `taiko-${activeSection}`)" class="floating-btn save-btn" title="保存当前页面">
          <span class="icon">📷</span>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.container {
  max-width: 1000px;
  margin: 0 auto;
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  min-height: 600px;
}

.report-layout {
  display: flex;
  gap: 20px;
  min-height: 500px;
}

.sidebar {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #eee;
  padding-right: 20px;
}

.sidebar-menu {
  flex: 1;
}

.sidebar-item {
  padding: 12px 15px;
  cursor: pointer;
  border-radius: 6px;
  margin-bottom: 5px;
  color: #666;
  transition: all 0.3s;
}

.sidebar-item:hover {
  background-color: #f5f5f5;
  color: #333;
}

.sidebar-item.active {
  background-color: #e91e63;
  color: white;
}

.content-area {
  flex: 1;
  padding-left: 10px;
  position: relative;
}

.overview-section {
  padding: 0 10px 10px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.section-header {
  text-align: center;
  margin-bottom: 20px;
  width: 100%;
}

.section-header h1 {
  margin: 0;
  font-size: 24px; /* Match h2 size usually, or keep it larger but remove margin */
  color: #333;
}

.summary {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
  width: 100%;
}

.stat-box {
  text-align: center;
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  min-width: 120px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #e91e63;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.chart-container {
  height: 400px;
  width: 100%;
  max-width: 700px;
}

.content-actions {
  margin-top: 30px;
  display: flex;
  justify-content: center;
}

.action-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  color: white;
  text-align: center;
}

.save-btn {
  background: #2196f3;
}
.save-btn:hover {
  background: #1976d2;
}

.copy-btn {
  background: #e91e63;
}
.copy-btn:hover {
  background: #c2185b;
}
.copy-btn.success {
  background: #4caf50;
}

.notice {
  text-align: center;
  color: #888;
  margin: 20px 0;
}

.floating-actions {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 1000;
}

.floating-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.floating-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0,0,0,0.4);
}

.floating-btn:active {
  transform: scale(0.95);
}

.icon {
  line-height: 1;
}

@media (max-width: 768px) {
  .report-layout {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #eee;
    padding-right: 0;
    padding-bottom: 10px;
    margin-bottom: 20px;
  }

  .sidebar-menu {
    display: flex;
    overflow-x: auto;
    gap: 10px;
    padding-bottom: 5px;
  }

  .sidebar-item {
    white-space: nowrap;
    margin-bottom: 0;
  }

  .content-area {
    padding-left: 0;
  }
  
  .container {
    padding: 10px;
  }
}
</style>
