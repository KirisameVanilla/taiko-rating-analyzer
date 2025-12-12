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
  showMode?: 'top20' | 'recommend'
}

const props = withDefaults(defineProps<Props>(), {
  showMode: 'top20'
})

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
  <div class="bg-white mt-0 p-2.5 rounded-lg">
    <div class="flex justify-center items-center mb-5">
      <h2>{{ title }}</h2>
    </div>
    
    <!-- Top 20 表格 -->
    <div v-if="showMode === 'top20'" class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
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
    <div v-else-if="showMode === 'recommend'" class="mt-8 text-left">
      <h3 class="mb-2.5 text-primary text-base">请注意: 当前功能正在开发中, 结果可能不准确</h3>
  <p class="description">难度偏差是指歌曲难度指标与 B20 中位数的偏差百分比，越接近0表示难度越适中。难度偏越差小，评分顺位越低，意味着该歌曲你越有能力取得更高的评分。刷新该曲目的评分能够更客观的反映你的实际水平并以此为依据推荐更适合的曲目。难度偏差大如果为正数，说明该曲目在一定程度上超过了你的当前能力范围，但同时也有更高的进步空间，请根据你的实际情况和游戏倾向合理选择练习曲目。</p>
      <!-- 基准值信息 -->
      <div v-if="recommendedSongs.length > 0" class="flex gap-6 bg-[#f9f9f9] mb-3 px-3 py-2 border-primary border-l-[3px] rounded">
        <span class="text-gray-600 text-sm">
          <strong class="mr-1 text-gray-800">当前评分维度基准值：</strong>{{ (recommendedSongs[0] as any)._best20IndicatorMedian?.toFixed(2) || '-' }}
        </span>
        <span class="text-gray-600 text-sm">
          <strong class="mr-1 text-gray-800">Rating 基准值：</strong>{{ (recommendedSongs[0] as any)._scoreBaseline?.toFixed(2) || '-' }}
        </span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th>曲名</th>
              <th>定数</th>
              <th>精度</th>
              <!-- <th>歌曲难度指标</th> -->
              <th>难度偏差</th>
              <th>当前评分</th>
              <th>评分顺位</th>
              <!-- <th>Rating 偏差</th> -->
            </tr>
          </thead>
          <tbody>
            <tr v-for="song in recommendedSongs" :key="song.title">
              <td class="font-bold text-[#333] text-left">{{ song.title }}</td>
              <td>{{ (song as any)._constant ?? '-' }}</td>
              <td>
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
              <!-- <td>{{ (song as any)._songIndicatorValue?.toFixed(2) || '-' }}</td> -->
              <td :class="{'text-[#4caf50] font-semibold': (song as any)._songIndicatorValue < (song as any)._best20IndicatorMedian, 'text-[#ff9800] font-semibold': (song as any)._songIndicatorValue >= (song as any)._best20IndicatorMedian}">
                <template v-if="(song as any)._best20IndicatorMedian && (song as any)._best20IndicatorMedian !== 0">
                  {{ (((((song as any)._songIndicatorValue - (song as any)._best20IndicatorMedian) / (song as any)._best20IndicatorMedian) * 100) .toFixed(1)) }}%
                </template>
                <template v-else>-</template>
              </td>
              <td>
                <template v-if="!(song as any)._isUnplayed">
                  {{ formatValue(song, valueKey) }}
                </template>
                <template v-else>-</template>
              </td>
              <!-- <td :class="{'text-[#4caf50] font-semibold': ((song as any)._userScoreValue - (song as any)._scoreBaseline) < 0, 'text-[#ff9800] font-semibold': ((song as any)._userScoreValue - (song as any)._scoreBaseline) >= 0}">
                {{ ((song as any)._userScoreValue - (song as any)._scoreBaseline)?.toFixed(2) || '-' }}
              </td> -->
              <td>
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

<style scoped>
h2 {
  color: #333;
  margin: 0;
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

table tbody tr:nth-child(even) {
  background-color: #f2f2f2;
}

/* 推荐说明描述样式 */
.description {
  font-size: 14px;
  color: #353535;
  margin-bottom: 10px;
  line-height: 1.8;
  /* background: #f7f7fa; */
  border-radius: 4px;
  /* padding: 8px 12px; */
  display: inline-block;
}
h3.text-primary {
  font-weight: bold;
}

</style>