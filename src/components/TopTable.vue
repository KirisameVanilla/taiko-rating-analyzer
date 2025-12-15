<script setup lang="ts">
import type { SongsDatabase, SongStats } from '@/types'
import GuideModal from '@components/GuideModal.vue'
import RatingProgressCell from '@components/RatingProgressCell.vue'
import { loadSongsData } from '@data/songs'
import { calculateSongStats, MAX_CONSTANT_VALUE, parsePastedScores } from '@utils/calculator'
import { difficultyMap } from '@utils/difficulty'
import { eventBus } from '@utils/eventBus'
import { recommendSongs, setSongsDatabase } from '@utils/recommend'
import { expandSongsDatabase } from '@utils/songHelpers'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

interface Props {
  title: string
  data: SongStats[]
  valueKey: keyof SongStats
  showMode?: 'top20' | 'recommend'
}

const props = withDefaults(defineProps<Props>(), {
  showMode: 'top20'
})

const isLoading = ref(false)
const onlyCnSongs = ref(false)
const songsDB = ref<SongsDatabase | null>(null)
const difficultyAdjustment = ref<number>(0)
const best20ConstantBase = ref<number>(0)
const showGuide = ref(false)

const formatValue = (item: SongStats, key: keyof SongStats): string => {
  const value = item[key]
  if (typeof value === 'number') {
    return value.toFixed(2)
  }
  return String(value)
}

// 仿照 SongsView 组件，合成全曲 SongStats
const allStats = ref<SongStats[]>([])

function handleCnFilterChange(value: boolean) {
  onlyCnSongs.value = value
  if (props.showMode === 'recommend') {
    calculateRecommendations()
  }
}

function increaseDifficulty() {
  difficultyAdjustment.value += 0.1
  calculateRecommendations()
}

function decreaseDifficulty() {
  difficultyAdjustment.value -= 0.1
  calculateRecommendations()
}

onMounted(async () => {
  // 从 localStorage 读取设置
  const savedSetting = localStorage.getItem('onlyCnSongs')
  if (savedSetting !== null) {
    onlyCnSongs.value = savedSetting === 'true'
  }

  // 监听国服筛选变化
  eventBus.on('cn-filter-changed', handleCnFilterChange)

  try {
    const db = await loadSongsData()
    songsDB.value = db
    // 设置推荐算法使用的歌曲数据库
    setSongsDatabase(db)
    
    const scoreInput = localStorage.getItem('taikoScoreData') || ''
    const userScores = scoreInput ? parsePastedScores(scoreInput) : []
    const scoreMap = new Map<string, any>()
    userScores.forEach(s => {
      scoreMap.set(`${s.id}-${s.level}`, s)
    })
    const result: SongStats[] = []
    
    // 使用新的展开函数处理数据库
    const expandedEntries = expandSongsDatabase(db)
    for (const entry of expandedEntries) {
      const key = `${entry.id}-${entry.level}`
      const score = scoreMap.get(key)
      if (score) {
        const stats = calculateSongStats(entry.data, score, entry.title)
        if (stats) result.push(stats)
      }
    }
    allStats.value = result
  } catch (e) {
    allStats.value = []
  }
})

onUnmounted(() => {
  eventBus.off('cn-filter-changed', handleCnFilterChange)
})

// 推荐列表，取前10首，基于全曲数据
const recommendedSongs = ref<SongStats[]>([]);

// 计算 B20 定数中位数
const calculatebest20ConstantBase = () => {
  if (!songsDB.value) return 0;
  
  const best20 = [...allStats.value]
    .sort((a, b) => (b[props.valueKey] as number) - (a[props.valueKey] as number))
    .slice(0, 20);
  
  if (best20.length === 0) return 0;
  
  const best20Constants = best20
    .map(s => {
      const songData = songsDB.value!.find(song => song.id === s.id);
      if (!songData) return 0;
      const levelData = songData.level[s.level as 4 | 5];
      return levelData?.constant ?? 0;
    })
    .filter(c => c > 0);
  
  if (best20Constants.length === 0) return 0;
  
  const sorted = [...best20Constants].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // 计算中位数
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  return median + 0.1;
};

// 计算推荐歌曲
const calculateRecommendations = async () => {
  if (props.showMode !== 'recommend') return;
  
  isLoading.value = true;
  
  // 使用 setTimeout 让 UI 有机会更新显示加载状态
  await nextTick();
  
  setTimeout(() => {
    try {
      // 计算 B20 定数中位数
      best20ConstantBase.value = calculatebest20ConstantBase();
      
      // 创建筛选函数
      const filterFn = onlyCnSongs.value && songsDB.value
        ? (id: number) => {
            const song = songsDB.value!.find(s => s.id === id)
            return song?.is_cn === true
          }
        : undefined

      let currentDifficultyAdjustment = difficultyAdjustment.value;
      let songs: SongStats[] = [];
      const targetCount = 20;
      const maxAdjustment = MAX_CONSTANT_VALUE - best20ConstantBase.value;
      
      // 动态调整难度修正值，直到找到足够的推荐歌曲或达到最大值
      while (songs.length < targetCount && currentDifficultyAdjustment <= maxAdjustment) {
        songs = recommendSongs(
          allStats.value.length ? allStats.value : props.data, 
          props.valueKey,
          targetCount,
          filterFn,
          currentDifficultyAdjustment,
          best20ConstantBase.value
        );
        
        // 如果歌曲数量不足，增加难度修正值
        if (songs.length < targetCount) {
          currentDifficultyAdjustment += 0.1;
        } else {
          break;
        }
      }
      
      // 更新实际使用的难度修正值
      if (currentDifficultyAdjustment !== difficultyAdjustment.value) {
        difficultyAdjustment.value = currentDifficultyAdjustment;
      }
      
      // 如果启用了国服筛选，替换标题为中文，并添加难度标识
      if (onlyCnSongs.value && songsDB.value) {
        const idToTitleCn = new Map<number, string>()
        songsDB.value.forEach(song => {
          if (song.title_cn) {
            idToTitleCn.set(song.id, song.title_cn)
          }
        })
        
        songs = songs.map(song => {
          const titleCn = idToTitleCn.get(song.id)
          const difficulty = difficultyMap[song.level] || ''
          if (titleCn) {
            return { ...song, title: `${titleCn}${difficulty}` }
          }
          return { ...song, title: `${song.title}${difficulty}` }
        })
      } else {
        // 未启用国服筛选时也添加难度标识
        songs = songs.map(song => {
          const difficulty = difficultyMap[song.level] || ''
          return { ...song, title: `${song.title}${difficulty}` }
        })
      }
      
      recommendedSongs.value = songs;
    } finally {
      isLoading.value = false;
    }
  }, 50);
};

// 监听 showMode 和 valueKey 变化，重新计算推荐
watch(
  [() => props.showMode, () => props.valueKey, allStats],
  (newVals, oldVals) => {
    if (props.showMode === 'recommend') {
      // 如果是从其他模式切换到推荐模式，或者 valueKey 变化，重置难度调整值
      if (oldVals && (oldVals[0] !== 'recommend' || oldVals[1] !== newVals[1])) {
        difficultyAdjustment.value = 0;
      }
      calculateRecommendations();
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="bg-white mt-0 p-2.5 rounded-lg">
    <div class="flex justify-center items-center mb-5 font-bold">
      <h2 class="m-0 text-[#333]">{{ title }}</h2>
    </div>
    
    <!-- Top 20 表格 -->
    <div v-if="showMode === 'top20'" class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">排名</th>
            <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">曲名</th>
            <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">良</th>
            <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">可</th>
            <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">不可</th>
            <!-- <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">{{ title.split(' ')[0] }}</th> -->
            <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">定数</th>
            <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left w32">{{ title.split(' ')[0] }}<span class="font-normal text-[10px]">（当前/最大）</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in data" :key="index" :class="{'bg-[#f2f2f2]': index % 2 === 1}">
            <td class="p-2.5 border-[#ddd] border-b text-left">{{ index + 1 }}</td>
            <td class="p-2.5 border-[#ddd] border-b text-left">{{ item.title}}</td>
            <td class="p-2.5 border-[#ddd] border-b text-left">{{ item.great }}</td>
            <td class="p-2.5 border-[#ddd] border-b text-left">{{ item.good }}</td>
            <td class="p-2.5 border-[#ddd] border-b text-left">{{ item.bad }}</td>
            <!-- <td class="p-2.5 border-[#ddd] border-b text-left">{{ formatValue(item, valueKey) }}</td> -->
            <td class="p-2.5 border-[#ddd] border-b text-left">{{ (item as any)._constant ?? '-' }}</td>
            <td class="p-1.5 border-[#ddd] border-b text-left">
              <template v-if="(item as any)._maxRatings">
                <RatingProgressCell :song="item" :valueKey="valueKey" :formatValue="formatValue" />
              </template>
              <div v-else class="text-gray-400 text-xs">-</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- 推荐歌曲列表 -->
    <div v-else-if="showMode === 'recommend'" class="mt-8 text-left">
      <!-- 难度调整工具栏 -->
      <div class="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-3 py-3">
        <div class="flex sm:flex-row flex-col sm:items-center gap-3">
          <span class="font-semibold text-gray-700 text-sm">难度定数偏好调整</span>
          <div class="inline-flex items-stretch self-start sm:self-auto bg-white shadow-sm border border-gray-300 rounded-md overflow-hidden">
            <button 
              @click="decreaseDifficulty" 
              class="bg-white hover:bg-pink-50 active:bg-pink-100 disabled:bg-gray-100 px-3 py-1.5 border-gray-300 border-r font-medium text-gray-700 disabled:text-gray-400 text-xs transition-colors disabled:cursor-not-allowed"
              :disabled="isLoading"
              title="降低难度"
            >
              - 降低
            </button>
            <span v-if="isLoading" class="flex justify-center items-center bg-gray-50 px-3 py-1.5 border-gray-300 border-r min-w-[4.5rem] font-medium text-gray-500 text-xs">
              计算中...
            </span>
            <span v-else class="flex justify-center items-center bg-gradient-to-r from-pink-50 to-purple-50 px-3 py-1.5 border-gray-300 border-r min-w-[4.5rem] font-bold text-gray-800 text-xs">
              <span class="font-normal text-[10px] text-gray-500">
                {{ best20ConstantBase > 0 ? best20ConstantBase.toFixed(1) : '-' }}
              </span>
              <span class="ml-1" :class="difficultyAdjustment >= 0 ? 'text-pink-600' : 'text-blue-600'">
                {{ difficultyAdjustment >= 0 ? '+' : '' }}{{ difficultyAdjustment.toFixed(1) }}
              </span>
            </span>
            <button 
              @click="increaseDifficulty" 
              class="bg-white hover:bg-pink-50 active:bg-pink-100 disabled:bg-gray-100 px-3 py-1.5 font-medium text-gray-700 disabled:text-gray-400 text-xs transition-colors disabled:cursor-not-allowed"
              :disabled="isLoading"
              title="提高难度"
            >
              + 提高
            </button>
          </div>
        </div>
        <button 
          @click="showGuide = !showGuide" 
          class="flex items-center self-start sm:self-auto gap-2 bg-white hover:bg-pink-50 active:bg-pink-100 shadow-sm px-4 py-1.5 border border-gray-200 hover:border-pink-300 rounded-md font-medium text-gray-700 text-xs transition-all"
          title="使用说明"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>{{ '使用说明' }}</span>
        </button>
      </div>
      
      <!-- 加载提示 -->
      <div v-if="isLoading" class="flex justify-center items-center py-16">
        <div class="text-center">
          <div class="inline-block border-[3px] border-primary border-t-transparent rounded-[50%] w-10 h-10 animate-spin"></div>
          <p class="mt-3 text-gray-600">正在计算推荐曲目...</p>
        </div>
      </div>
      <!-- 基准值信息：仅用于调试 -->
      <!-- <div v-if="!isLoading && recommendedSongs.length > 0" class="flex gap-6 bg-[#f9f9f9] mb-3 px-3 py-2 border-primary border-l-[3px] rounded">
        <span class="text-gray-600 text-sm">
          <strong class="mr-1 text-gray-800">当前评分维度基准值：</strong>{{ (recommendedSongs[0] as any)._best20IndicatorMedian?.toFixed(2) || '-' }}
        </span>
        <span class="text-gray-600 text-sm">
          <strong class="mr-1 text-gray-800">Rating 基准值：</strong>{{ (recommendedSongs[0] as any)._scoreBaseline?.toFixed(2) || '-' }}
        </span>
      </div> -->
      <div v-if="!isLoading" class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">排名</th>
              <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">曲名</th>
              <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">定数</th>
              <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">精度</th>
              <!-- <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">歌曲难度指标</th> -->
              <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">难度偏差</th>
              <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left w32">用户评分<span class="font-normal text-[10px]">（当前/目标）</span></th>
              <!-- <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">Rating 偏差</th> -->
            </tr>
          </thead>
          <tbody>
            <tr v-for="(song, index) in recommendedSongs" :key="song.title" :class="{'bg-[#f2f2f2]': index % 2 === 1}">
              <td class="p-2.5 border-[#ddd] border-b text-left">
                <template v-if="!(song as any)._isUnplayed && (song as any)._dimensionRanks && (song as any)._dimensionRanks[valueKey]">
                  {{ (song as any)._dimensionRanks[valueKey] }}
                </template>
                <template v-else-if="(song as any)._isUnplayed">
                  <span class="text-gray-400 text-xs">-</span>
                </template>
              </td>
              <td class="p-2.5 border-[#ddd] border-b font-bold text-[#333] text-left">{{ song.title }}</td>
              <td class="p-2.5 border-[#ddd] border-b text-left">{{ (song as any)._constant ?? '-' }}</td>
              <td class="p-2.5 border-[#ddd] border-b text-left">
                <template v-if="typeof (song as any).great === 'number' && typeof (song as any).good === 'number' && (song as any)._constant && (song as any)._constant > 0 && (song as any)._songIndicatorValue">
                  {{
                    (() => {
                      try {
                        const total = (song as any).great + (song as any).good + (song as any).bad;
                        if (total === 0) return '-';
                        const acc = ((song as any).great) / total;
                        return (acc * 100).toFixed(2) + '%';
                      } catch { return '-'; }
                    })()
                  }}
                </template>
                <template v-else>-</template>
              </td>
              <!-- <td class="p-2.5 border-[#ddd] border-b text-left">{{ (song as any)._songIndicatorValue?.toFixed(2) || '-' }}</td> -->
              <td class="p-5.5 border-[#ddd] border-b text-left" :class="{'text-[#4caf50] font-semibold': (song as any)._songIndicatorValue < (song as any)._best20IndicatorMedian, 'text-[#ff9800] font-semibold': (song as any)._songIndicatorValue >= (song as any)._best20IndicatorMedian}">
                <template v-if="(song as any)._best20IndicatorMedian && (song as any)._best20IndicatorMedian !== 0">
                  {{ (((((song as any)._songIndicatorValue - (song as any)._best20IndicatorMedian) / (song as any)._best20IndicatorMedian) * 100) .toFixed(1)) }}%
                </template>
                <template v-else>-</template>
              </td>
              <td class="p-1.5 border-[#ddd] border-b text-left">
                <template v-if="(song as any)._maxRatings">
                  <RatingProgressCell :song="song" :valueKey="valueKey" :formatValue="formatValue" />
                </template>
                <div v-else class="text-gray-400 text-xs">-</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- 使用说明弹窗 -->
    <GuideModal :show="showGuide" @close="showGuide = false" />
  </div>
</template>