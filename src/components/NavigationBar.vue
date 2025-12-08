<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import './NavigationBar.css'

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
  <nav class="navigation-bar">
    <div class="nav-container">
      <div class="nav-brand">
        <span class="brand-text">太鼓之达人 Rating & 六维分析</span>
      </div>
      <div class="nav-buttons">
        <button 
          @click="navigateToHome"
          :class="{ active: route.path === '/' }"
          class="nav-button"
        >
          <span>导入界面</span>
        </button>
        <button 
          @click="navigateToSongs"
          :class="{ active: route.path === '/songs' }"
          class="nav-button"
        >
          <span>曲目列表</span>
        </button>
        <button 
          @click="navigateToReport"
          :disabled="!hasScoreData"
          :class="{ active: route.path === '/report' }"
          class="nav-button"
        >
          <span>分析报告</span>
        </button>
      </div>
    </div>
  </nav>
</template>
