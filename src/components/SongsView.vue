<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { loadSongsData } from '../data/songs'
import { parsePastedScores, calculateSongStats } from '../utils/calculator'
import type { UserScore, SongStats } from '../types'

interface SongRow {
  id: string
  title: string
  level: number
  constant: number
  userScore?: UserScore
  stats?: SongStats
}

type SortKey = 'title' | 'constant' | 'score' | 'rating' | 'great' | 'good' | 'bad' | 'drumroll' | 'combo' | 'updatedAt'

const songs = ref<SongRow[]>([])
const loading = ref(true)
const searchTerm = ref('')

// Filter State
const showFilter = ref(false)
const minConstant = ref(1.0)
const maxConstant = ref(11.6)
const limitMin = ref(1.0)
const limitMax = ref(11.6)

const filterPlayed = ref(false)
const filterNotPlayed = ref(false)
const filterCleared = ref(false)
const filterNotCleared = ref(false)
const filterFC = ref(false)
const filterNotFC = ref(false)
const filterAP = ref(false)
const filterNotAP = ref(false)

// Slider Logic
const minPos = computed(() => {
  return ((minConstant.value - limitMin.value) / (limitMax.value - limitMin.value)) * 100
})
const maxPos = computed(() => {
  return ((maxConstant.value - limitMin.value) / (limitMax.value - limitMin.value)) * 100
})

watch(minConstant, (v) => {
  if (v > maxConstant.value) minConstant.value = maxConstant.value
})
watch(maxConstant, (v) => {
  if (v < minConstant.value) maxConstant.value = minConstant.value
})

const difficultyMap: Record<number, string> = {
  1: '简单',
  2: '普通',
  3: '困难',
  4: '鬼',
  5: '裏'
}

onMounted(async () => {
  try {
    const songsDB = await loadSongsData()
    const scoreInput = localStorage.getItem('taikoScoreData') || ''
    const userScores = scoreInput ? parsePastedScores(scoreInput) : []
    
    const scoreMap = new Map<string, UserScore>()
    userScores.forEach(s => {
      scoreMap.set(`${s.id}-${s.level}`, s)
    })

    const rows: SongRow[] = []
    for (const [key, data] of Object.entries(songsDB)) {
      const [, levelStr] = key.split('-')
      const level = parseInt(levelStr)
      
      const score = scoreMap.get(key)
      let stats: SongStats | undefined
      
      if (score) {
        const calculated = calculateSongStats(data, score)
        if (calculated) {
          stats = calculated
        }
      }

      rows.push({
        id: key,
        title: data.title,
        level: level,
        constant: data.constant,
        userScore: score,
        stats: stats
      })
    }
    
    // Sort by default (maybe by title or constant?)
    // Let's sort by constant desc
    rows.sort((a, b) => b.constant - a.constant)
    
    songs.value = rows
    
    // Calculate min/max constant
    if (rows.length > 0) {
      let min = rows[0].constant
      let max = rows[0].constant
      rows.forEach(r => {
        if (r.constant < min) min = r.constant
        if (r.constant > max) max = r.constant
      })
      minConstant.value = Math.floor(min)
      maxConstant.value = Math.ceil(max)
      limitMin.value = Math.floor(min)
      limitMax.value = Math.ceil(max)
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
})

const sortKey = ref<SortKey>('constant')
const sortOrder = ref<'asc' | 'desc'>('desc')

const toggleSort = (key: SortKey) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'desc'
  }
}

const filteredSongs = computed(() => {
  let list = songs.value
  
  // 1. Search Filter
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase()
    list = list.filter(s => s.title.toLowerCase().includes(term))
  }
  
  // 2. Constant Range Filter
  list = list.filter(s => s.constant >= minConstant.value && s.constant <= maxConstant.value)
  
  // 3. Status Filters
  list = list.filter(s => {
    const score = s.userScore
    const isPlayed = !!score && (score.playCount > 0 || score.score > 0) // Fallback to score > 0 if playCount is missing
    const isCleared = !!score && score.clearCount > 0
    const isFC = !!score && score.fullcomboCount > 0
    const isAP = !!score && score.perfectCount > 0
    
    // Played Filter - 如果两个都没勾选，则不筛选（等同于都勾选）
    if (filterPlayed.value || filterNotPlayed.value) {
      if (!((isPlayed && filterPlayed.value) || (!isPlayed && filterNotPlayed.value))) return false
    }
    
    // Cleared Filter - 如果两个都没勾选，则不筛选
    if (filterCleared.value || filterNotCleared.value) {
      if (!((isCleared && filterCleared.value) || (!isCleared && filterNotCleared.value))) return false
    }
    
    // FC Filter - 如果两个都没勾选，则不筛选
    if (filterFC.value || filterNotFC.value) {
      if (!((isFC && filterFC.value) || (!isFC && filterNotFC.value))) return false
    }
    
    // AP Filter - 如果两个都没勾选，则不筛选
    if (filterAP.value || filterNotAP.value) {
      if (!((isAP && filterAP.value) || (!isAP && filterNotAP.value))) return false
    }
    
    return true
  })
  
  return list.sort((a, b) => {
    let valA: number | string = 0
    let valB: number | string = 0
    
    switch (sortKey.value) {
      case 'title':
        return sortOrder.value === 'asc' 
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title)
      case 'constant':
        valA = a.constant
        valB = b.constant
        break
      case 'score':
        valA = a.userScore?.score ?? -1
        valB = b.userScore?.score ?? -1
        break
      case 'rating':
        valA = a.stats?.rating ?? -1
        valB = b.stats?.rating ?? -1
        break
      case 'great':
        valA = a.userScore?.great ?? -1
        valB = b.userScore?.great ?? -1
        break
      case 'good':
        valA = a.userScore?.good ?? -1
        valB = b.userScore?.good ?? -1
        break
      case 'bad':
        valA = a.userScore?.bad ?? -1
        valB = b.userScore?.bad ?? -1
        break
      case 'drumroll':
        valA = a.userScore?.drumroll ?? -1
        valB = b.userScore?.drumroll ?? -1
        break
      case 'combo':
        valA = a.userScore?.combo ?? -1
        valB = b.userScore?.combo ?? -1
        break
      case 'updatedAt':
        // 使用时间戳进行排序，没有记录的排在最后
        const timeA = a.userScore?.updatedAt ? new Date(a.userScore.updatedAt).getTime() : 0
        const timeB = b.userScore?.updatedAt ? new Date(b.userScore.updatedAt).getTime() : 0
        valA = timeA
        valB = timeB
        break
    }
    
    if (valA === valB) return 0
    const result = valA > valB ? 1 : -1
    return sortOrder.value === 'asc' ? result : -result
  })
})
</script>

<template>
  <div class="songs-view">
    <div class="header">
      <h1>所有曲目列表</h1>
      <div class="controls">
        <input v-model="searchTerm" placeholder="搜索曲名..." class="search-input" />
        <div class="filter-container">
          <button @click="showFilter = !showFilter" class="filter-btn">
            筛选 {{ showFilter ? '▲' : '▼' }}
          </button>
          
          <div v-if="showFilter" class="filter-popup">
            <div class="filter-section">
              <h3>定数范围: {{ minConstant.toFixed(1) }} - {{ maxConstant.toFixed(1) }}</h3>
              <div class="slider-container">
                <div class="slider-track"></div>
                <div class="slider-range" :style="{ left: minPos + '%', width: (maxPos - minPos) + '%' }"></div>
                <input 
                  type="range" 
                  v-model.number="minConstant" 
                  :min="limitMin" 
                  :max="limitMax" 
                  step="0.1" 
                  class="thumb-left thumb" 
                />
                <input 
                  type="range" 
                  v-model.number="maxConstant" 
                  :min="limitMin" 
                  :max="limitMax" 
                  step="0.1" 
                  class="thumb-right thumb" 
                />
              </div>
            </div>
            
            <div class="filter-section">
              <h3>状态筛选</h3>
              <div class="checkbox-group">
                <div class="checkbox-row">
                  <label>已游玩</label>
                  <label><input type="checkbox" v-model="filterPlayed"> 是</label>
                  <label><input type="checkbox" v-model="filterNotPlayed"> 否</label>
                </div>
                <div class="checkbox-row">
                  <label>已过关</label>
                  <label><input type="checkbox" v-model="filterCleared"> 是</label>
                  <label><input type="checkbox" v-model="filterNotCleared"> 否</label>
                </div>
                <div class="checkbox-row">
                  <label>已全连</label>
                  <label><input type="checkbox" v-model="filterFC"> 是</label>
                  <label><input type="checkbox" v-model="filterNotFC"> 否</label>
                </div>
                <div class="checkbox-row">
                  <label>已全良</label>
                  <label><input type="checkbox" v-model="filterAP"> 是</label>
                  <label><input type="checkbox" v-model="filterNotAP"> 否</label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <span class="count">共 {{ filteredSongs.length }} 首</span>
      </div>
    </div>
    
    <div v-if="loading" class="loading">加载中...</div>
    
    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th @click="toggleSort('title')" class="sortable">
              曲名 <span v-if="sortKey === 'title'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th>难度</th>
            <th @click="toggleSort('constant')" class="sortable">
              定数 <span v-if="sortKey === 'constant'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('score')" class="sortable">
              分数 <span v-if="sortKey === 'score'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('rating')" class="sortable">
              Rating <span v-if="sortKey === 'rating'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('great')" class="sortable">
              良 <span v-if="sortKey === 'great'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('good')" class="sortable">
              可 <span v-if="sortKey === 'good'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('bad')" class="sortable">
              不可 <span v-if="sortKey === 'bad'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('drumroll')" class="sortable">
              连打 <span v-if="sortKey === 'drumroll'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('combo')" class="sortable">
              连击 <span v-if="sortKey === 'combo'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('updatedAt')" class="sortable">
              上次游玩 <span v-if="sortKey === 'updatedAt'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="song in filteredSongs" :key="song.id">
            <td class="title-cell">{{ song.title }}</td>
            <td>
              <span :class="['difficulty-badge', `diff-${song.level}`]">
                {{ difficultyMap[song.level] || song.level }}
              </span>
            </td>
            <td>{{ song.constant.toFixed(1) }}</td>
            <td>{{ song.userScore?.score ?? '-' }}</td>
            <td :class="{ 'has-rating': song.stats }" class="rating-cell">
              {{ song.stats?.rating.toFixed(2) || '-' }}
              <div v-if="song.stats" class="rating-tooltip">
                <div>大歌力: {{ song.stats.daigouryoku.toFixed(2) }}</div>
                <div>体力: {{ song.stats.stamina.toFixed(2) }}</div>
                <div>高速力: {{ song.stats.speed.toFixed(2) }}</div>
                <div>精度力: {{ song.stats.accuracy_power.toFixed(2) }}</div>
                <div>节奏处理: {{ song.stats.rhythm.toFixed(2) }}</div>
                <div>复合处理: {{ song.stats.complex.toFixed(2) }}</div>
              </div>
            </td>
            <td>{{ song.userScore?.great ?? '-' }}</td>
            <td>{{ song.userScore?.good ?? '-' }}</td>
            <td>{{ song.userScore?.bad ?? '-' }}</td>
            <td>{{ song.userScore?.drumroll ?? '-' }}</td>
            <td>{{ song.userScore?.combo ?? '-' }}</td>
            <td>{{ song.userScore?.updatedAt ? new Date(song.userScore.updatedAt).toLocaleDateString('zh-CN') : '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.songs-view {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  margin-bottom: 20px;
}

.controls {
  display: flex;
  gap: 20px;
  align-items: center;
  position: relative;
}

.filter-container {
  position: relative;
}

.filter-btn {
  padding: 8px 16px;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.filter-btn:hover {
  background-color: #f8f9fa;
}

.filter-popup {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  padding: 16px;
  z-index: 100;
  width: 300px;
}

.filter-section {
  margin-bottom: 16px;
}

.filter-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #666;
}

.slider-container {
  position: relative;
  width: 100%;
  height: 20px;
  margin-bottom: 10px;
}

.slider-track {
  position: absolute;
  width: 100%;
  height: 4px;
  background-color: #ddd;
  top: 50%;
  transform: translateY(-50%);
  border-radius: 2px;
}

.slider-range {
  position: absolute;
  height: 4px;
  background-color: #2196f3;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
}

.thumb {
  position: absolute;
  width: 100%;
  height: 0;
  top: 50%;
  left: 0;
  margin: 0;
  pointer-events: none;
  -webkit-appearance: none;
  appearance: none;
  z-index: 2;
}

.thumb::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #2196f3;
  border-radius: 50%;
  cursor: pointer;
  pointer-events: auto;
  margin-top: -6px; /* Adjust for track height */
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.thumb::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #2196f3;
  border-radius: 50%;
  cursor: pointer;
  pointer-events: auto;
  border: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.checkbox-row > label:first-child {
  width: 60px;
  font-weight: 500;
}

.search-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 300px;
  font-size: 16px;
}

.table-container {
  overflow-x: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-radius: 8px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background-color: #f8f9fa;
  font-weight: 600;
  white-space: nowrap;
  user-select: none;
}

th.sortable {
  cursor: pointer;
}

th.sortable:hover {
  background-color: #e9ecef;
}

tr:hover {
  background-color: #f5f5f5;
}

.title-cell {
  font-weight: 500;
  min-width: 200px;
}

.difficulty-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  color: white;
  background-color: #999;
}

.diff-1 { background-color: #4caf50; } /* Easy */
.diff-2 { background-color: #8bc34a; } /* Normal */
.diff-3 { background-color: #ff9800; } /* Hard */
.diff-4 { background-color: #e91e63; } /* Oni */
.diff-5 { background-color: #9c27b0; } /* Ura */

.has-rating {
  color: #2196f3;
  font-weight: bold;
}

.rating-cell {
  position: relative;
}

.rating-tooltip {
  position: absolute;
  top: 50%;
  left: 100%;
  transform: translateY(-50%);
  margin-left: 12px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 1000;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease-in-out, visibility 0.2s ease-in-out;
}

.rating-tooltip::before {
  content: '';
  position: absolute;
  top: 50%;
  right: 100%;
  transform: translateY(-50%);
  border: 5px solid transparent;
  border-right-color: rgba(0, 0, 0, 0.9);
}

.rating-cell:hover .rating-tooltip {
  opacity: 1;
  visibility: visible;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}
</style>
