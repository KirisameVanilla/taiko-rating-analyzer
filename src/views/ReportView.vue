<script setup lang="ts">
import type { SongStats } from '@/types'
import RadarChart from '@components/RadarChart.vue'
import TopTable from '@components/TopTable.vue'
import { eventBus } from '@utils/eventBus'
import html2canvas from 'html2canvas'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useScoreStore } from '@/store/scoreStore'

const store = useScoreStore()
const { 
    filteredSongStats, 
    overallRating, 
    lastOverallRating, 
    radarData, 
    topLists, 
    isLoading, 
    error
} = store

const notice = computed(() => {
    if (isLoading.value) return '正在加载数据…'
    if (error.value) return error.value
    if (filteredSongStats.value.length === 0) return '未获取到成绩数据或无法计算, 可能是没有魔王难度、里魔王难度成绩'
    return ''
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
    store.setCnFilter(value)
}

onMounted(async () => {
    eventBus.on('trigger-screenshot', handleScreenshot)
    eventBus.on('cn-filter-changed', handleCnFilterChange)

    await store.init()
})

onUnmounted(() => {
    eventBus.off('trigger-screenshot', handleScreenshot)
    eventBus.off('cn-filter-changed', handleCnFilterChange)
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
                                <div class="font-bold text-[28px] text-primary">
                                    {{ overallRating.toFixed(2) }}
                                    <span v-if="lastOverallRating > 0" class="ml-2 text-sm" :class="overallRating >= lastOverallRating ? 'text-red-500' : 'text-blue-500'">
                                        {{ overallRating >= lastOverallRating ? '+' : '' }}{{ (overallRating - lastOverallRating).toFixed(2) }}
                                    </span>
                                </div>
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
