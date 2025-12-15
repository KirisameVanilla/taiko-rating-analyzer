<script setup lang="ts">
import type { SongStats, SongsDatabase } from '@/types'
import RadarChart from '@components/RadarChart.vue'
import TopTable from '@components/TopTable.vue'
import duplicateSongs from '@data/duplicateSongs'
import { loadSongsData } from '@data/songs'
import {
    calcMaxRatings,
    calculateSongStats,
    filterDuplicateSongs,
    getTop20Median,
    getTop20WeightedAverage,
    parsePastedScores,
    topValueCompensate
} from '@utils/calculator'
import { difficultyMap } from '@utils/difficulty'
import { eventBus } from '@utils/eventBus'
import { expandSongsDatabase, findSongByIdLevel } from '@utils/songHelpers'
import html2canvas from 'html2canvas'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const notice = ref('正在加载数据…')
const results = ref<SongStats[]>([])
const allResults = ref<SongStats[]>([])
const onlyCnSongs = ref(false)
const songsDB = ref<SongsDatabase | null>(null)
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
const activeSubTab = ref<'top20' | 'recommend'>('top20')

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

const handleScreenshot = () => {
    saveElementAsImage(contentRef.value, `taiko-${activeSection.value}`)
}

function handleCnFilterChange(value: boolean) {
    onlyCnSongs.value = value
    applyCnFilter()
}

function applyCnFilter() {
    if (!songsDB.value) {
        console.warn('songsDB is not loaded')
        return
    }

    if (onlyCnSongs.value) {
        // 只保留国服曲目
        const cnSongIds = new Set(
            songsDB.value.filter(song => song.is_cn === true).map(song => song.id)
        )

        // 创建 id 到 title_cn 的映射
        const idToTitleCn = new Map<number, string>()
        songsDB.value.forEach(song => {
            if (song.title_cn) {
                idToTitleCn.set(song.id, song.title_cn)
            }
        })

        // 筛选国服曲目，并替换标题为中文，添加难度标识
        results.value = allResults.value
            .filter(stat => cnSongIds.has(stat.id))
            .map(stat => {
                const titleCn = idToTitleCn.get(stat.id)
                const difficulty = difficultyMap[stat.level] || ''
                if (titleCn) {
                    return { ...stat, title: `${titleCn}${difficulty}` }
                }
                return { ...stat, title: `${stat.title}${difficulty}` }
            })
    } else {
        results.value = allResults.value.map(stat => {
            const difficulty = difficultyMap[stat.level] || ''
            return { ...stat, title: `${stat.title}${difficulty}` }
        })
    }

    // 重新计算统计数据
    const filteredResults = filterDuplicateSongs(results.value, duplicateSongs)
    calculateOverallStats(filteredResults)
}

onMounted(async () => {
    eventBus.on('trigger-screenshot', handleScreenshot)
    eventBus.on('cn-filter-changed', handleCnFilterChange)

    // 从 localStorage 读取设置
    const savedSetting = localStorage.getItem('onlyCnSongs')
    if (savedSetting !== null) {
        onlyCnSongs.value = savedSetting === 'true'
    }

    try {
        // 从 localStorage 读取数据
        const scoreInput = localStorage.getItem('taikoScoreData') || ''
        if (!scoreInput) {
            notice.value = '未找到数据, 请先在首页输入数据'
            return
        }

        const db = await loadSongsData()
        songsDB.value = db
        if (db.length === 0) {
            notice.value = '歌曲数据加载失败, 请检查网络连接后刷新页面'
            return
        }
        const scores = parsePastedScores(scoreInput)
        const tempResults: SongStats[] = []

        // 展开数据库并创建映射
        const expandedEntries = expandSongsDatabase(db)
        const entryMap = new Map()
        expandedEntries.forEach(entry => {
            const key = `${entry.id}-${entry.level}`
            entryMap.set(key, entry)
        })

        scores.forEach(s => {
            const key = `${s.id}-${s.level}`
            const entry = entryMap.get(key)
            if (!entry) return

            const stats = calculateSongStats(entry.data, s, entry.title)
            if (stats) tempResults.push(stats)
        })

        allResults.value = tempResults
        applyCnFilter()

        if (tempResults.length === 0) {
            notice.value = '未获取到成绩数据或无法计算, 可能是没有魔王难度、里魔王难度成绩'
        } else {
            notice.value = ''
        }
    } catch (e) {
        console.error(e)
        notice.value = '成绩数据计算失败, 请检查输入格式'
    }
})

onUnmounted(() => {
    eventBus.off('trigger-screenshot', handleScreenshot)
    eventBus.off('cn-filter-changed', handleCnFilterChange)
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

// 增强歌曲数据，添加定数和最大评分等信息
function enhanceSongStats(songs: SongStats[], allFilteredSongs: SongStats[]): SongStats[] {
    if (!songsDB.value) return songs

    // 计算所有维度的排名（使用过滤后的所有歌曲）
    const dimensionKeys: (keyof SongStats)[] = ['rating', 'daigouryoku', 'stamina', 'speed', 'accuracy_power', 'rhythm', 'complex']
    const dimensionRankMaps: Record<string, Map<string, number>> = {}

    for (const key of dimensionKeys) {
        const sorted = [...allFilteredSongs].sort((a, b) => (b[key] as number) - (a[key] as number))
        const map = new Map<string, number>()
        sorted.forEach((s, idx) => {
            map.set(s.title, idx + 1)
        })
        dimensionRankMaps[key] = map
    }

    return songs.map(song => {
        const result = findSongByIdLevel(songsDB.value!, song.id, song.level as 4 | 5)
        if (!result) return song

        const levelData = result.levelData
        const maxRatings = calcMaxRatings(levelData)

        const dimensionRanks: Record<string, number> = {}
        for (const key of dimensionKeys) {
            dimensionRanks[key] = dimensionRankMaps[key].get(song.title) ?? 0
        }

        return {
            ...song,
            _constant: levelData.constant,
            _maxRatings: maxRatings,
            _dimensionRanks: dimensionRanks,
            _isUnplayed: song.great === 0 && song.good === 0 && song.bad === 0
        }
    })
}

// 取前 20 名列表
const topLists = computed(() => {
    // 先过滤掉包含关系的低rating曲目
    const filtered = filterDuplicateSongs(results.value, duplicateSongs)

    // 为每个维度的 top20 增强数据（传入过滤后的完整数据用于计算排名）
    return {
        rating: enhanceSongStats([...filtered].sort((a, b) => b.rating - a.rating).slice(0, 20), filtered),
        daigouryoku: enhanceSongStats([...filtered].sort((a, b) => b.daigouryoku - a.daigouryoku).slice(0, 20), filtered),
        stamina: enhanceSongStats([...filtered].sort((a, b) => b.stamina - a.stamina).slice(0, 20), filtered),
        speed: enhanceSongStats([...filtered].sort((a, b) => b.speed - a.speed).slice(0, 20), filtered),
        accuracy_power: enhanceSongStats([...filtered].sort((a, b) => b.accuracy_power - a.accuracy_power).slice(0, 20), filtered),
        rhythm: enhanceSongStats([...filtered].sort((a, b) => b.rhythm - a.rhythm).slice(0, 20), filtered),
        complex: enhanceSongStats([...filtered].sort((a, b) => b.complex - a.complex).slice(0, 20), filtered)
    }
})

const currentTableData = computed(() => {
    if (activeSection.value === 'overview') return null
    const item = menuItems.find(i => i.id === activeSection.value)
    if (!item) return null
    return {
        title: item.label,
        data: topLists.value[activeSection.value as keyof typeof topLists.value],
        valueKey: activeSection.value as keyof SongStats,
        showMode: activeSubTab.value
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
    <div
        class="bg-white shadow-[0_4px_6px_rgba(0,0,0,0.1)] mx-auto p-5 max-md:p-2.5 rounded-[10px] max-w-[1000px] min-h-[600px]">
        <div v-if="notice" class="my-5 text-[#888] text-center">{{ notice }}</div>

        <template v-else>
            <div class="flex max-md:flex-col gap-5 min-h-[500px]">
                <!-- Sidebar -->
                <div
                    class="flex flex-col flex-shrink-0 max-md:mb-5 pr-5 max-md:pr-0 max-md:pb-2.5 border-[#eee] border-r max-md:border-r-0 max-md:border-b w-[200px] max-md:w-full no-capture">
                    <div class="max-md:flex flex-1 max-md:gap-2.5 max-md:pb-1.5 max-md:overflow-x-auto">
                        <div v-for="item in menuItems" :key="item.id"
                            class="hover:bg-[#ffbfbe] mb-1.5 max-md:mb-0 px-[15px] py-3 rounded-md text-gray-600 hover:text-[#333] max-md:whitespace-nowrap transition-all duration-300 cursor-pointer"
                            :class="{ 'bg-primary text-white': activeSection === item.id }"
                            @click="activeSection = item.id">
                            {{ item.label }}
                        </div>
                    </div>
                </div>

                <!-- Content Area -->
                <div class="relative flex-1 pl-2.5 max-md:pl-0" ref="contentRef">
                    <!-- Overview Section -->
                    <div v-if="activeSection === 'overview'" class="flex flex-col items-center px-2.5 pb-2.5">
                        <div class="mb-5 w-full text-center">
                            <h1 class="m-0 font-bold text-[#333] text-2xl">Rating 及六维雷达图</h1>
                        </div>

                        <div class="flex justify-center mb-[30px] w-full">
                            <div class="bg-[#f8f9fa] p-[10px] rounded-lg min-w-[120px] text-center">
                                <div class="text-gray-600 text-m">Rating</div>
                                <div class="font-bold text-[28px] text-primary">{{ overallRating.toFixed(2) }}</div>
                            </div>
                        </div>

                        <div class="w-full max-w-[700px] h-[400px]">
                            <RadarChart :data="radarData" />
                        </div>
                    </div>

                    <!-- Top Tables -->
                    <div v-else-if="currentTableData">
                        <!-- Sub Tabs -->
                        <div class="flex gap-2.5 mb-5 border-[#eee] border-b-2">
                            <div class="mb-[-2px] px-5 py-2.5 border-transparent border-b-[3px] font-medium text-gray-600 hover:text-primary transition-all duration-300 cursor-pointer"
                                :class="{ 'text-primary border-b-primary': activeSubTab === 'top20' }"
                                @click="activeSubTab = 'top20'">
                                Top 20
                            </div>
                            <div class="mb-[-2px] px-5 py-2.5 border-transparent border-b-[3px] font-medium text-gray-600 hover:text-primary transition-all duration-300 cursor-pointer"
                                :class="{ 'text-primary border-b-primary': activeSubTab === 'recommend' }"
                                @click="activeSubTab = 'recommend'">
                                推荐曲目
                            </div>
                        </div>

                        <TopTable :title="currentTableData.title" :data="currentTableData.data"
                            :valueKey="currentTableData.valueKey" :showMode="currentTableData.showMode" />
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
