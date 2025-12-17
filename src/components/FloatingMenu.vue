<script setup lang="ts">
import { eventBus } from '@utils/eventBus'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isOpen = ref(false)
const onlyCnSongs = ref(false)

const isReportPage = computed(() => route.name === 'report')

onMounted(() => {
  const savedSetting = localStorage.getItem('onlyCnSongs')
  if (savedSetting !== null) {
    onlyCnSongs.value = savedSetting === 'true'
  }
})

function toggleMenu() {
  isOpen.value = !isOpen.value
}

function closeMenu() {
  isOpen.value = false
}

function handleScreenshot() {
  eventBus.emit('trigger-screenshot')
  closeMenu()
}

function toggleCnSongs() {
  onlyCnSongs.value = !onlyCnSongs.value
  localStorage.setItem('onlyCnSongs', String(onlyCnSongs.value))
  // 触发全局事件通知其他组件更新
  eventBus.emit('cn-filter-changed', onlyCnSongs.value)
}
</script>

<template>
  <div class="no-capture">
    <!-- Main Button -->
    <button 
      class="right-[30px] bottom-[30px] z-[1000] fixed flex justify-center items-center bg-[#007AFF] hover:bg-[#0071e3] shadow-lg border-none rounded-full w-14 h-14 text-white text-2xl active:scale-90 transition-all duration-300 cursor-pointer" 
      @click="toggleMenu"
      title="菜单"
    >
      <i class="z-[1] relative fas fa-bars"></i>
    </button>

    <!-- Popup Modal -->
    <Transition name="menu">
      <div v-if="isOpen" class="z-[2000] fixed inset-0 flex justify-center items-center bg-black/20 backdrop-blur-sm" @click="closeMenu">
        <div class="bg-white/80 shadow-2xl backdrop-blur-xl p-6 border border-white/20 rounded-[32px] w-[90%] max-w-[320px]" @click.stop>
          <div class="flex justify-between items-center mb-6">
            <h3 class="m-0 font-bold text-[#1D1D1F] text-xl tracking-tight">菜单</h3>
            <button class="flex justify-center items-center bg-black/5 hover:bg-black/10 rounded-full w-8 h-8 text-[#8E8E93] transition-colors cursor-pointer" @click="closeMenu">
              <i class="text-sm fas fa-times"></i>
            </button>
          </div>
          
          <div class="flex flex-col gap-3">
            <!-- 只查看国服设置 -->
            <button
              @click="toggleCnSongs"
              class="flex items-center gap-4 bg-black/5 hover:bg-black/10 px-5 py-4 rounded-2xl w-full font-semibold text-[#1D1D1F] text-base active:scale-[0.98] transition-all duration-200 cursor-pointer"
              :class="{ 'bg-[#007AFF]/10 text-[#007AFF]': onlyCnSongs }"
            >
                <i v-if="onlyCnSongs" class="text-[#007AFF] fa-regular fa-circle-check"></i>
                <i v-else class="fa-regular fa-circle"></i>
              <span>只查看国服</span>
            </button>

            <a 
              href="https://qm.qq.com/q/EhuH4pBPmU" 
              target="_blank" 
              class="flex items-center gap-4 bg-black/5 hover:bg-black/10 px-5 py-4 rounded-2xl w-full font-semibold text-[#1D1D1F] text-base no-underline active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <i class="fa-user-group fa-solid"></i>
              <span>加入QQ群</span>
            </a>
            
            <button 
              v-if="isReportPage" 
              @click="handleScreenshot" 
              class="flex items-center gap-4 bg-black/5 hover:bg-black/10 px-5 py-4 rounded-2xl w-full font-semibold text-[#1D1D1F] text-base active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <i class="fa-solid fa-camera"></i>
              <span>保存截图</span>
            </button>

            <a 
              href="https://github.com/kirisamevanilla/taiko-best" 
              target="_blank" 
              class="flex items-center gap-4 bg-black/5 hover:bg-black/10 px-5 py-4 rounded-2xl w-full font-semibold text-[#1D1D1F] text-base no-underline active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <i class="fa-brands fa-github"></i>
              <span>GitHub 仓库</span>
            </a>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Overlay fade + scale transition */
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.2s ease-out;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
}

/* Content scale transition */
.menu-enter-active > div,
.menu-leave-active > div {
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
}

.menu-enter-from > div,
.menu-leave-to > div {
  opacity: 0;
  transform: scale(0.9);
}
</style>
