<script setup lang="ts">
import type { SongStats } from '@/types'
import RadarChart from '@components/RadarChart.vue'
import TopTable from '@components/TopTable.vue'
import { eventBus } from '@utils/eventBus'
import html2canvas from 'html2canvas'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useScoreStore } from '@/store/scoreStore'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
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
    if (isLoading.value) return t('report.loading')
    if (error.value) return error.value
    if (filteredSongStats.value.length === 0) return t('report.noData')
    return ''
})

const contentRef = ref<HTMLElement | null>(null)
const isSaving = ref(false)

const activeSection = ref('overview')
const activeSubTab = ref<'top' | 'recommend'>('top')

const menuItems = computed(() => [
    { id: 'overview', label: t('report.overview') },
    { id: 'rating', label: 'Rating' },
    { id: 'daigouryoku', label: t('radar.daigouryoku') },
    { id: 'stamina', label: t('radar.stamina') },
    { id: 'speed', label: t('radar.speed') },
    { id: 'accuracy_power', label: t('radar.accuracy') },
    { id: 'rhythm', label: t('radar.rhythm') },
    { id: 'complex', label: t('radar.complex') }
])

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
    const item = menuItems.value.find(i => i.id === activeSection.value)
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
        class="bg-white/80 shadow-sm backdrop-blur-xl mx-auto p-8 max-md:p-4 border border-black/5 rounded-[32px] max-w-[1100px] min-h-[600px]">
        <div v-if="notice" class="my-10 font-medium text-[#8E8E93] text-center">{{ notice }}</div>

        <template v-else>
            <div class="flex max-md:flex-col gap-8 min-h-[500px]">
                <!-- Sidebar -->
                <div
                    class="flex flex-col flex-shrink-0 max-md:mb-6 pr-6 max-md:pr-0 max-md:pb-4 border-black/5 border-r max-md:border-r-0 max-md:border-b w-[220px] max-md:w-full no-capture">
                    <div class="max-md:flex flex-1 max-md:gap-2 max-md:pb-2 max-md:overflow-x-auto custom-scrollbar">
                        <div v-for="item in menuItems" :key="item.id"
                            class="mb-1.5 max-md:mb-0 px-5 py-3 rounded-2xl font-semibold text-sm max-md:whitespace-nowrap active:scale-[0.98] transition-all duration-200 cursor-pointer"
                            :class="activeSection === item.id ? 'bg-[#007AFF] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/5'"
                            @click="activeSection = item.id">
                            {{ item.label }}
                        </div>
                    </div>
                </div>

                <!-- Content Area -->
                <div class="relative flex-1" ref="contentRef">
                    <!-- Overview Section -->
                    <div v-if="activeSection === 'overview'" class="flex flex-col items-center">
                        <div class="mb-8 w-full text-center">
                            <h1 class="m-0 font-bold text-[#1D1D1F] text-3xl tracking-tight">{{ t('report.ratingRadar') }}</h1>
                        </div>

                        <div class="flex justify-center mb-10 w-full">
                            <div class="bg-black/5 p-6 rounded-[24px] min-w-[160px] text-center">
                                <div class="font-semibold text-[#8E8E93] text-sm uppercase tracking-wider">Rating</div>
                                <div class="mt-1 font-bold text-[#007AFF] text-[40px] leading-none">
                                    {{ overallRating.toFixed(2) }}
                                </div>
                                <div v-if="lastOverallRating > 0" class="mt-2 font-bold text-sm" :class="overallRating >= lastOverallRating ? 'text-[#34C759]' : 'text-[#FF3B30]'">
                                    {{ overallRating >= lastOverallRating ? '↑' : '↓' }} {{ Math.abs(overallRating - lastOverallRating).toFixed(2) }}
                                </div>
                            </div>
                        </div>

                        <div class="w-full max-w-[700px] h-[450px]">
                            <RadarChart :data="radarData" />
                        </div>
                    </div>

                    <!-- Top Tables -->
                    <div v-else-if="currentTableData">
                        <!-- Sub Tabs (Segmented Control Style) -->
                        <div class="inline-flex bg-black/5 mb-8 p-1 rounded-full">
                            <button 
                                class="px-6 py-2 rounded-full font-semibold text-sm transition-all duration-200"
                                :class="activeSubTab === 'top' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#8E8E93] hover:text-[#1D1D1F]'"
                                @click="activeSubTab = 'top'"
                            >
                                {{ t('report.top') }}
                            </button>
                            <button 
                                class="px-6 py-2 rounded-full font-semibold text-sm transition-all duration-200"
                                :class="activeSubTab === 'recommend' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#8E8E93] hover:text-[#1D1D1F]'"
                                @click="activeSubTab = 'recommend'"
                            >
                                {{ t('report.recommend') }}
                            </button>
                        </div>

                        <TopTable :title="currentTableData.title" :data="currentTableData.data"
                            :valueKey="currentTableData.valueKey" :showMode="currentTableData.showMode" />
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
