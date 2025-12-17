<script setup lang="ts">
interface Props {
  show: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const handleClose = () => {
  emit('close')
}

const handleOverlayMouseDown = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="z-[1000] fixed inset-0 flex justify-center items-center bg-black/40 backdrop-blur-sm transition-opacity duration-300" @mousedown="handleOverlayMouseDown">
      <div class="flex flex-col bg-white/90 shadow-2xl backdrop-blur-2xl border border-white/20 rounded-[32px] w-[95%] max-w-[800px] max-h-[85vh] overflow-hidden transition-all duration-300">
        <!-- Header -->
        <div class="flex flex-shrink-0 justify-between items-center px-8 py-6 border-black/5 border-b">
          <div class="flex items-center gap-3">
            <div class="bg-[#007AFF]/10 p-2 rounded-full">
              <i class="text-[#007AFF] fa-solid fa-circle-info"></i>
            </div>
            <h3 class="m-0 font-bold text-[#1D1D1F] text-xl">曲目推荐使用说明</h3>
          </div>
          <button class="flex justify-center items-center bg-black/5 hover:bg-black/10 border-none rounded-full w-8 h-8 text-[#1D1D1F] transition-all cursor-pointer" @click="handleClose">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Content -->
        <div class="space-y-8 p-8 overflow-y-auto">
          <!-- Warning Card -->
          <div class="flex gap-3 bg-[#FF9500]/10 p-4 border border-[#FF9500]/20 rounded-2xl">
            <i class="mt-1 text-[#FF9500] fa-solid fa-triangle-exclamation"></i>
            <p class="m-0 font-semibold text-[#FF9500] text-sm">请注意：推荐算法会持续优化，推荐结果可能会有所变化。</p>
          </div>
          
          <!-- Section: Principle -->
          <section class="space-y-4">
            <div class="flex items-center gap-2">
              <div class="bg-[#007AFF] rounded-full w-1 h-5"></div>
              <h4 class="m-0 font-bold text-[#1D1D1F] text-lg">推荐原理</h4>
            </div>
            <p class="text-[#86868B] leading-relaxed">推荐系统基于您的 B20 成绩（各维度前 20 最佳成绩）进行智能分析：</p>
            <div class="gap-4 grid grid-cols-1 md:grid-cols-3">
              <div class="space-y-2 bg-black/5 p-4 rounded-2xl">
                <i class="text-[#34C759] fa-solid fa-arrow-trend-up"></i>
                <h5 class="m-0 font-bold text-[#1D1D1F] text-sm">进步空间优先</h5>
                <p class="m-0 text-[#86868B] text-xs leading-relaxed">优先推荐您尚未游玩或成绩提升空间较大的曲目</p>
              </div>
              <div class="space-y-2 bg-black/5 p-4 rounded-2xl">
                <i class="text-[#007AFF] fa-solid fa-sliders"></i>
                <h5 class="m-0 font-bold text-[#1D1D1F] text-sm">难度适配</h5>
                <p class="m-0 text-[#86868B] text-xs leading-relaxed">根据您 B20 的定数中位数，推荐难度适中的曲目</p>
              </div>
              <div class="space-y-2 bg-black/5 p-4 rounded-2xl">
                <i class="text-[#FF3B30] fa-solid fa-bullseye"></i>
                <h5 class="m-0 font-bold text-[#1D1D1F] text-sm">维度针对性</h5>
                <p class="m-0 text-[#86868B] text-xs leading-relaxed">在选定维度上为您推荐能有效提升该项能力的曲目</p>
              </div>
            </div>
          </section>
          
          <!-- Section: How to use -->
          <section class="space-y-4">
            <div class="flex items-center gap-2">
              <div class="bg-[#AF52DE] rounded-full w-1 h-5"></div>
              <h4 class="m-0 font-bold text-[#1D1D1F] text-lg">如何使用</h4>
            </div>
            
            <div class="space-y-4">
              <div class="flex gap-4 bg-black/5 p-4 rounded-2xl">
                <div class="flex flex-shrink-0 justify-center items-center bg-[#AF52DE] rounded-full w-6 h-6 font-bold text-white text-xs">1</div>
                <div class="space-y-1">
                  <h5 class="m-0 font-bold text-[#1D1D1F]">选择维度</h5>
                  <p class="m-0 text-[#86868B] text-sm">点击左侧菜单选择您想提升的维度（Rating/大歌力/体力/高速力等）</p>
                </div>
              </div>
              
              <div class="flex gap-4 bg-black/5 p-4 rounded-2xl">
                <div class="flex flex-shrink-0 justify-center items-center bg-[#AF52DE] rounded-full w-6 h-6 font-bold text-white text-xs">2</div>
                <div class="space-y-2">
                  <h5 class="m-0 font-bold text-[#1D1D1F]">调整筛选条件</h5>
                  <ul class="space-y-2 m-0 pl-4 text-[#86868B] text-sm list-disc">
                    <li><strong>国服筛选</strong>：开启"只查看国服"时，由于部分歌曲数据缺失，计算可能出现偏差。</li>
                    <li><strong>难度调整</strong>：通过滑块调整推荐曲目的难度范围。难度定数的基数 = 您当前维度的 B20 曲目的综合难度定数中位数 + 0.1。</li>
                  </ul>
                </div>
              </div>
              
              <div class="flex gap-4 bg-black/5 p-4 rounded-2xl">
                <div class="flex flex-shrink-0 justify-center items-center bg-[#AF52DE] rounded-full w-6 h-6 font-bold text-white text-xs">3</div>
                <div class="space-y-2">
                  <h5 class="m-0 font-bold text-[#1D1D1F]">理解推荐列表</h5>
                  <p class="m-0 text-[#86868B] text-sm">推荐列表按优先级排序，显示排名、曲名、定数、精度、难度偏差及用户评分。</p>
                </div>
              </div>
            </div>
          </section>
          
          <!-- Section: Strategy -->
          <section class="space-y-4">
            <div class="flex items-center gap-2">
              <div class="bg-[#34C759] rounded-full w-1 h-5"></div>
              <h4 class="m-0 font-bold text-[#1D1D1F] text-lg">推荐策略</h4>
            </div>
            <ul class="space-y-2 m-0 pl-6 text-[#86868B] text-sm list-disc">
              <li>未游玩曲目和已游玩曲目会尽量按照 1:1 比例混合推荐</li>
              <li>已全良的曲目不会出现在推荐列表中</li>
              <li>过滤重复曲目（如普通版和翻唱版）</li>
              <li>推荐曲目的难度定数不会超过您 B20 定数基数 + 调整值，避免过难导致挫败</li>
            </ul>
          </section>
        </div>

        <!-- Footer -->
        <div class="flex flex-shrink-0 justify-end px-8 py-6 border-black/5 border-t">
          <button class="bg-[#007AFF] hover:bg-[#0071E3] shadow-[#007AFF]/20 shadow-lg px-8 py-3 border-none rounded-2xl font-bold text-white transition-all cursor-pointer" @click="handleClose">
            我知道了
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.9);
}
</style>
