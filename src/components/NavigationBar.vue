<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const hasScoreData = ref(false)

const checkScoreData = () => {
  hasScoreData.value = localStorage.getItem('taikoScoreData') !== null
}

onMounted(() => {
  checkScoreData()
  // 监听 storage 事件以响应 localStorage 的变化
  window.addEventListener('storage', checkScoreData)
  // 监听自定义事件以响应同一页面内的 localStorage 变化
  window.addEventListener('localStorageUpdate', checkScoreData)
})

onUnmounted(() => {
  window.removeEventListener('storage', checkScoreData)
  window.removeEventListener('localStorageUpdate', checkScoreData)
})

// 手动检查 localStorage 变化（用于同一标签页内的更新）
const navigateToReport = () => {
  checkScoreData()
  if (hasScoreData.value) {
    router.push('/report')
  }
}

const navigateToHome = () => {
  router.push('/')
}

const navigateToSongs = () => {
  router.push('/songs')
}
</script>

<template>
  <nav class="top-0 right-0 left-0 z-[1000] sticky bg-nav-primary shadow-md">
    <div class="flex max-md:flex-col justify-between items-center max-md:gap-4 mx-auto px-8 max-md:px-4 py-4 max-w-[1200px]">
      <div class="flex items-center gap-3 font-bold text-nav-text text-xl">
        <span class="max-md:text-lg tracking-wide">太鼓之达人 Rating & 六维分析</span>
      </div>
      <div class="flex max-md:justify-center gap-4 max-md:w-full">
        <button 
          @click="navigateToHome"
          :class="{ 
            'bg-nav-active border-nav-active shadow-[0_2px_8px_rgba(52,152,219,0.4)]': route.path === '/',
            'bg-nav-secondary border-nav-secondary': route.path !== '/'
          }"
          class="relative flex items-center gap-2 hover:bg-nav-active disabled:bg-[#475a6d] disabled:opacity-50 hover:shadow-[0_4px_12px_rgba(52,152,219,0.3)] px-6 py-3 border-2 hover:border-nav-active disabled:border-[#475a6d] rounded-md overflow-hidden font-semibold text-nav-text disabled:text-[#7f8c8d] text-base transition-all hover:-translate-y-0.5 active:translate-y-0 duration-300 cursor-pointer disabled:cursor-not-allowed"
        >
          <span class="z-[1] relative">导入界面</span>
        </button>
        <button 
          @click="navigateToSongs"
          :class="{ 
            'bg-nav-active border-nav-active shadow-[0_2px_8px_rgba(52,152,219,0.4)]': route.path === '/songs',
            'bg-nav-secondary border-nav-secondary': route.path !== '/songs'
          }"
          class="relative flex items-center gap-2 hover:bg-nav-active disabled:bg-[#475a6d] disabled:opacity-50 hover:shadow-[0_4px_12px_rgba(52,152,219,0.3)] px-6 py-3 border-2 hover:border-nav-active disabled:border-[#475a6d] rounded-md overflow-hidden font-semibold text-nav-text disabled:text-[#7f8c8d] text-base transition-all hover:-translate-y-0.5 active:translate-y-0 duration-300 cursor-pointer disabled:cursor-not-allowed"
        >
          <span class="z-[1] relative">曲目列表</span>
        </button>
        <button 
          @click="navigateToReport"
          :disabled="!hasScoreData"
          :class="{ 
            'bg-nav-active border-nav-active shadow-[0_2px_8px_rgba(52,152,219,0.4)]': route.path === '/report',
            'bg-nav-secondary border-nav-secondary': route.path !== '/report'
          }"
          class="relative flex items-center gap-2 hover:bg-nav-active disabled:bg-[#475a6d] disabled:opacity-50 hover:shadow-[0_4px_12px_rgba(52,152,219,0.3)] px-6 py-3 border-2 hover:border-nav-active disabled:border-[#475a6d] rounded-md overflow-hidden font-semibold text-nav-text disabled:text-[#7f8c8d] text-base transition-all hover:-translate-y-0.5 active:translate-y-0 duration-300 cursor-pointer disabled:cursor-not-allowed"
        >
          <span class="z-[1] relative">分析报告</span>
        </button>
      </div>
    </div>
  </nav>
</template>
