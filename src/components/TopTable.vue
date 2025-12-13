<script setup lang="ts">
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import type { SongStats, SongsDatabase } from '../types'
import { recommendSongs, setSongsDatabase } from '../utils/recommend'
import { parsePastedScores, calculateSongStats } from '../utils/calculator'
import { loadSongsData } from '../data/songs'
import { expandSongsDatabase } from '../utils/songHelpers'
import { eventBus } from '../utils/eventBus'
import { difficultyMap } from '../utils/difficulty'

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

// 计算推荐歌曲
const calculateRecommendations = async () => {
  if (props.showMode !== 'recommend') return;
  
  isLoading.value = true;
  
  // 使用 setTimeout 让 UI 有机会更新显示加载状态
  await nextTick();
  
  setTimeout(() => {
    try {
      // 创建筛选函数
      const filterFn = onlyCnSongs.value && songsDB.value
        ? (id: number) => {
            const song = songsDB.value!.find(s => s.id === id)
            return song?.is_cn === true
          }
        : undefined

      let songs = recommendSongs(
        allStats.value.length ? allStats.value : props.data, 
        props.valueKey,
        20,
        filterFn
      );
      
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
  () => {
    if (props.showMode === 'recommend') {
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
            <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">{{ title.split(' ')[0] }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in data" :key="index" :class="{'bg-[#f2f2f2]': index % 2 === 1}">
            <td class="p-2.5 border-[#ddd] border-b text-left">{{ index + 1 }}</td>
            <td class="p-2.5 border-[#ddd] border-b text-left">{{ item.title}}</td>
            <td class="p-2.5 border-[#ddd] border-b text-left">{{ item.great }}</td>
            <td class="p-2.5 border-[#ddd] border-b text-left">{{ item.good }}</td>
            <td class="p-2.5 border-[#ddd] border-b text-left">{{ item.bad }}</td>
            <td class="p-2.5 border-[#ddd] border-b text-left">{{ formatValue(item, valueKey) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- 推荐歌曲列表 -->
    <div v-else-if="showMode === 'recommend'" class="mt-8 text-left">
      <h3 class="mb-2.5 font-bold text-primary text-base">请注意: 当前功能正在开发中, 结果可能不准确</h3>
      <p class="inline-block mb-2.5 rounded text-[#353535] text-sm leading-[1.8]">难度偏差是指歌曲难度指标与 B20 中位数的偏差百分比，越接近0表示难度越适中。难度偏越差小，评分顺位越低，意味着该歌曲你越有能力取得更高的评分。刷新该曲目的评分能够更客观的反映你的实际水平并以此为依据推荐更适合的曲目。难度偏差如果为正数，说明该曲目在一定程度上超过了你的当前能力范围，但同时也有更高的进步空间，请根据你的实际情况和游戏倾向合理选择练习曲目。</p>
      
      <!-- 加载提示 -->
      <div v-if="isLoading" class="flex justify-center items-center py-16">
        <div class="text-center">
          <div class="inline-block border-[3px] border-primary border-t-transparent rounded-[50%] w-10 h-10 animate-spin"></div>
          <p class="mt-3 text-gray-600">正在计算推荐曲目...</p>
        </div>
      </div>
      <!-- 基准值信息 -->
      <div v-if="!isLoading && recommendedSongs.length > 0" class="flex gap-6 bg-[#f9f9f9] mb-3 px-3 py-2 border-primary border-l-[3px] rounded">
        <span class="text-gray-600 text-sm">
          <strong class="mr-1 text-gray-800">当前评分维度基准值：</strong>{{ (recommendedSongs[0] as any)._best20IndicatorMedian?.toFixed(2) || '-' }}
        </span>
        <span class="text-gray-600 text-sm">
          <strong class="mr-1 text-gray-800">Rating 基准值：</strong>{{ (recommendedSongs[0] as any)._scoreBaseline?.toFixed(2) || '-' }}
        </span>
      </div>
      <div v-if="!isLoading" class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">曲名</th>
              <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">定数</th>
              <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">精度</th>
              <!-- <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">歌曲难度指标</th> -->
              <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">难度偏差</th>
              <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">当前评分</th>
              <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">评分顺位</th>
              <!-- <th class="bg-[#e91e63] p-2.5 border-[#ddd] border-b text-white text-left">Rating 偏差</th> -->
            </tr>
          </thead>
          <tbody>
            <tr v-for="(song, index) in recommendedSongs" :key="song.title" :class="{'bg-[#f2f2f2]': index % 2 === 1}">
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
              <td class="p-2.5 border-[#ddd] border-b text-left" :class="{'text-[#4caf50] font-semibold': (song as any)._songIndicatorValue < (song as any)._best20IndicatorMedian, 'text-[#ff9800] font-semibold': (song as any)._songIndicatorValue >= (song as any)._best20IndicatorMedian}">
                <template v-if="(song as any)._best20IndicatorMedian && (song as any)._best20IndicatorMedian !== 0">
                  {{ (((((song as any)._songIndicatorValue - (song as any)._best20IndicatorMedian) / (song as any)._best20IndicatorMedian) * 100) .toFixed(1)) }}%
                </template>
                <template v-else>-</template>
              </td>
              <td class="p-2.5 border-[#ddd] border-b text-left">
                <template v-if="!(song as any)._isUnplayed">
                  {{ formatValue(song, valueKey) }}
                </template>
                <template v-else>-</template>
              </td>
              <!-- <td class="p-2.5 border-[#ddd] border-b text-left" :class="{'text-[#4caf50] font-semibold': ((song as any)._userScoreValue - (song as any)._scoreBaseline) < 0, 'text-[#ff9800] font-semibold': ((song as any)._userScoreValue - (song as any)._scoreBaseline) >= 0}">
                {{ ((song as any)._userScoreValue - (song as any)._scoreBaseline)?.toFixed(2) || '-' }}
              </td> -->
              <td class="p-2.5 border-[#ddd] border-b text-left">
                <!-- 仅已游玩歌曲展示排名，未游玩显示 '-' -->
                <template v-if="(song as any)._dimensionRanks && (song as any)._dimensionRanks[valueKey] && !(song as any)._isUnplayed">
                  {{ (song as any)._dimensionRanks[valueKey] }}
                </template>
                <template v-else>-</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>