<script setup lang="ts">
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import type { SongStats, SongsDatabase } from '../types'
import { recommendSongs, setSongsDatabase } from '../utils/recommend'
import { parsePastedScores, calculateSongStats, MAX_CONSTANT_VALUE } from '../utils/calculator'
import { loadSongsData } from '../data/songs'
import { expandSongsDatabase } from '../utils/songHelpers'
import { eventBus } from '../utils/eventBus'
import { difficultyMap } from '../utils/difficulty'
import RatingProgressCell from './RatingProgressCell.vue'

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
    <div class="flex justify-center items-center mb-5">
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
      <div class="flex items-center justify-between py-3">
        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold text-gray-700">难度定数偏好调整</span>
          <div class="inline-flex items-stretch border border-gray-300 rounded-md overflow-hidden shadow-sm bg-white">
            <button 
              @click="decreaseDifficulty" 
              class="px-3 py-1.5 bg-white hover:bg-pink-50 active:bg-pink-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-700 border-r border-gray-300 text-xs font-medium transition-colors"
              :disabled="isLoading"
              title="降低难度"
            >
              - 降低
            </button>
            <span v-if="isLoading" class="px-3 py-1.5 bg-gray-50 text-xs text-gray-500 min-w-[4.5rem] flex items-center justify-center font-medium border-r border-gray-300">
              计算中...
            </span>
            <span v-else class="px-3 py-1.5 bg-gradient-to-r from-pink-50 to-purple-50 text-xs font-bold text-gray-800 min-w-[4.5rem] flex items-center justify-center border-r border-gray-300">
              <span class="font-normal text-gray-500 text-[10px]">
                {{ best20ConstantBase > 0 ? best20ConstantBase.toFixed(1) : '-' }}
              </span>
              <span class="ml-1" :class="difficultyAdjustment >= 0 ? 'text-pink-600' : 'text-blue-600'">
                {{ difficultyAdjustment >= 0 ? '+' : '' }}{{ difficultyAdjustment.toFixed(1) }}
              </span>
            </span>
            <button 
              @click="increaseDifficulty" 
              class="px-3 py-1.5 bg-white hover:bg-pink-50 active:bg-pink-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-700 text-xs font-medium transition-colors"
              :disabled="isLoading"
              title="提高难度"
            >
              + 提高
            </button>
          </div>
        </div>
        <button 
          @click="showGuide = !showGuide" 
          class="px-4 py-1.5 bg-white hover:bg-pink-50 active:bg-pink-100 text-gray-700 rounded-md border border-gray-200 hover:border-pink-300 text-xs font-medium transition-all flex items-center gap-2 shadow-sm"
          title="查看使用说明"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>{{ showGuide ? '收起使用说明' : '查看使用说明' }}</span>
          <span class="text-[10px]">{{ showGuide ? '▲' : '▼' }}</span>
        </button>
      </div>
      
      <!-- 使用说明区域 -->
      <div v-if="showGuide" class="mb-4 bg-white p-5 rounded-lg border border-pink-200 shadow-sm text-sm leading-relaxed">
        <div class="flex items-center gap-2 mb-4">
          <svg class="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h3 class="text-lg font-bold text-[#e91e63]">曲目推荐使用说明</h3>
        </div>
        
        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 rounded">
          <p class="font-semibold text-yellow-800">⚠️ 请注意：推荐算法会持续优化，推荐结果可能会有所变化。</p>
        </div>
        
        <h4 class="text-base font-bold text-[#333] mt-4 mb-2 flex items-center gap-2">
          <span class="w-1 h-5 bg-[#e91e63] rounded"></span>
          推荐原理
        </h4>
        <p class="mb-2">推荐系统基于您的B20成绩（各维度前20最佳成绩）进行智能分析：</p>
        <ul class="list-disc pl-6 mb-3 space-y-1">
          <li><strong>进步空间优先</strong>：优先推荐您尚未游玩或成绩提升空间较大的曲目</li>
          <li><strong>难度适配</strong>：根据您B20的定数中位数，推荐难度适中的曲目（默认难度范围可调整）</li>
          <li><strong>维度针对性</strong>：在选定维度上为您推荐能有效提升该项能力的曲目</li>
        </ul>
        
        <h4 class="text-base font-bold text-[#333] mt-4 mb-2 flex items-center gap-2">
          <span class="w-1 h-5 bg-[#e91e63] rounded"></span>
          如何使用
        </h4>
        
        <div class="mb-3 bg-gray-50 p-3 rounded-md border-l-4 border-pink-400">
          <h5 class="font-semibold text-[#e91e63] mb-1">1. 选择维度</h5>
          <p class="text-gray-700">点击左侧菜单选择您想提升的维度（Rating/大歌力/体力/高速力/精度力/节奏处理/复合处理）</p>
        </div>
        
        <div class="mb-3 bg-gray-50 p-3 rounded-md border-l-4 border-purple-400">
          <h5 class="font-semibold text-purple-600 mb-2">2. 调整筛选条件</h5>
          <ul class="list-disc pl-5 space-y-1 text-gray-700">
            <li><strong>国服筛选</strong>：如果您在主菜单中开启了"只查看国服"的选项，计算可能会出现一定偏差，由于目前国服部分歌曲数据缺失，无法准确计算定数</li>
            <li><strong>难度调整</strong>：通过滑块调整推荐曲目的难度范围。难度定数的基数=您当前维度的B20曲目的综合难度定数中位数+0.1，难度偏好修正值通常为 0，但也会会根据您其它歌曲的表现进行动态调整。您可以根据您的游戏偏好手动调整修正值。如果您发现无法继续降低难度定数，说明在这个条件下会筛选出永远无法刷新您的 B20 的曲目，对于练习的帮助非常小，故不再进行推荐。</li>
          </ul>
        </div>
        
        <div class="mb-3 bg-gray-50 p-3 rounded-md border-l-4 border-blue-400">
          <h5 class="font-semibold text-blue-600 mb-2">3. 理解推荐列表</h5>
          <p class="text-gray-700 mb-2">推荐列表按推荐优先级排序，每首曲目显示：</p>
          <ul class="list-disc pl-5 space-y-1 text-gray-700">
            <li><strong>排名</strong>：曲目在当前维度下评分在全曲中的排名</li>
            <li><strong>曲名</strong>：曲目标题及表里谱标识</li>
            <li><strong>定数</strong>：该曲目难度定数</li>
            <li><strong>精度</strong>：该曲您的良判定百分比</li>
            <li><strong>难度偏差</strong>：曲目的当前维度难度定数和当前维度 B20 评分中位数的差距百分比</li>
            <li><strong>用户评分</strong>：您在该维度上已获得的评分以及能获得的最高分数</li>
          </ul>
        </div>
        
        <h4 class="text-base font-bold text-[#333] mt-4 mb-2 flex items-center gap-2">
          <span class="w-1 h-5 bg-[#e91e63] rounded"></span>
          推荐策略
        </h4>
        <ul class="list-disc pl-6 mb-3 space-y-1.5 text-gray-700">
          <li>未游玩曲目和已游玩曲目会尽量按照1:1比例混合推荐</li>
          <li>已全良的曲目不会出现在推荐列表中</li>
          <li>过滤重复曲目（如普通版和翻唱版）</li>
          <li>推荐曲目的难度定数不会超过您B20定数基数+调整值，避免过难导致挫败</li>
        </ul>
        
        <h4 class="text-base font-bold text-[#333] mt-4 mb-2 flex items-center gap-2">
          <span class="w-1 h-5 bg-[#e91e63] rounded"></span>
          最佳实践
        </h4>
        <ul class="list-disc pl-6 space-y-1.5 text-gray-700">
          <li><strong class="text-pink-600">新手玩家</strong>：建议从综合 Rating 维度开始练习，这是综合能力的体现</li>
          <li><strong class="text-purple-600">针对性提升</strong>：如果某项能力明显偏弱，可专注练习该维度的推荐曲目</li>
          <li><strong class="text-blue-600">循序渐进</strong>：建议根据自身的游戏（冲星 / 精度）倾向，将难度调整设为 ±0~0.2 范围，避免跨度过大</li>
          <li><strong class="text-green-600">定期更新</strong>：完成推荐曲目后重新分析成绩，获取新的推荐</li>
        </ul>
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
  </div>
</template>