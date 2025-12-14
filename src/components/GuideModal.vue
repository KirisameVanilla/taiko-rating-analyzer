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
    <div v-if="show" class="z-[1000] fixed inset-0 flex justify-center items-center bg-black/50 transition-opacity duration-300" @mousedown="handleOverlayMouseDown">
      <div class="flex flex-col bg-white shadow-[0_4px_6px_rgba(0,0,0,0.1)] rounded-lg w-[90%] max-w-[800px] max-h-[85vh] overflow-hidden transition-transform duration-300">
        <div class="flex flex-shrink-0 justify-between items-center px-5 py-4 border-gray-200 border-b">
          <div class="flex items-center gap-2">
            <svg class="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <h3 class="m-0 font-bold text-[#e91e63] text-lg">曲目推荐使用说明</h3>
          </div>
          <button class="flex justify-center items-center bg-none p-0 border-none w-[30px] h-[30px] text-[28px] text-gray-500 hover:text-gray-900 leading-none cursor-pointer" @click="handleClose">&times;</button>
        </div>
        <div class="p-5 overflow-y-auto text-sm leading-relaxed">
          <div class="bg-yellow-50 mb-4 p-3 border-yellow-400 border-l-4 rounded">
            <p class="font-semibold text-yellow-800">⚠️ 请注意：推荐算法会持续优化，推荐结果可能会有所变化。</p>
          </div>
          
          <h4 class="flex items-center gap-2 mt-4 mb-2 font-bold text-[#333] text-base">
            <span class="bg-[#e91e63] rounded w-1 h-5"></span>
            推荐原理
          </h4>
          <p class="mb-2">推荐系统基于您的B20成绩（各维度前20最佳成绩）进行智能分析：</p>
          <ul class="space-y-1 mb-3 pl-6 list-disc">
            <li><strong>进步空间优先</strong>：优先推荐您尚未游玩或成绩提升空间较大的曲目</li>
            <li><strong>难度适配</strong>：根据您B20的定数中位数，推荐难度适中的曲目（默认难度范围可调整）</li>
            <li><strong>维度针对性</strong>：在选定维度上为您推荐能有效提升该项能力的曲目</li>
          </ul>
          
          <h4 class="flex items-center gap-2 mt-4 mb-2 font-bold text-[#333] text-base">
            <span class="bg-[#e91e63] rounded w-1 h-5"></span>
            如何使用
          </h4>
          
          <div class="bg-gray-50 mb-3 p-3 border-pink-400 border-l-4 rounded-md">
            <h5 class="mb-1 font-semibold text-[#e91e63]">1. 选择维度</h5>
            <p class="text-gray-700">点击左侧菜单选择您想提升的维度（Rating/大歌力/体力/高速力/精度力/节奏处理/复合处理）</p>
          </div>
          
          <div class="bg-gray-50 mb-3 p-3 border-purple-400 border-l-4 rounded-md">
            <h5 class="mb-2 font-semibold text-purple-600">2. 调整筛选条件</h5>
            <ul class="space-y-1 pl-5 text-gray-700 list-disc">
              <li><strong>国服筛选</strong>：如果您在主菜单中开启了"只查看国服"的选项，计算可能会出现一定偏差，由于目前国服部分歌曲数据缺失，无法准确计算定数</li>
              <li><strong>难度调整</strong>：通过滑块调整推荐曲目的难度范围。难度定数的基数=您当前维度的B20曲目的综合难度定数中位数+0.1，难度偏好修正值通常为 0，但也会会根据您其它歌曲的表现进行动态调整。您可以根据您的游戏偏好手动调整修正值。如果您发现无法继续降低难度定数，说明在这个条件下会筛选出永远无法刷新您的 B20 的曲目，对于练习的帮助非常小，故不再进行推荐。</li>
            </ul>
          </div>
          
          <div class="bg-gray-50 mb-3 p-3 border-blue-400 border-l-4 rounded-md">
            <h5 class="mb-2 font-semibold text-blue-600">3. 理解推荐列表</h5>
            <p class="mb-2 text-gray-700">推荐列表按推荐优先级排序，每首曲目显示：</p>
            <ul class="space-y-1 pl-5 text-gray-700 list-disc">
              <li><strong>排名</strong>：曲目在当前维度下评分在全曲中的排名</li>
              <li><strong>曲名</strong>：曲目标题及表里谱标识</li>
              <li><strong>定数</strong>：该曲目难度定数</li>
              <li><strong>精度</strong>：该曲您的良判定百分比</li>
              <li><strong>难度偏差</strong>：曲目的当前维度难度定数和当前维度 B20 评分中位数的差距百分比</li>
              <li><strong>用户评分</strong>：您在该维度上已获得的评分以及能获得的最高分数</li>
            </ul>
          </div>
          
          <h4 class="flex items-center gap-2 mt-4 mb-2 font-bold text-[#333] text-base">
            <span class="bg-[#e91e63] rounded w-1 h-5"></span>
            推荐策略
          </h4>
          <ul class="space-y-1.5 mb-3 pl-6 text-gray-700 list-disc">
            <li>未游玩曲目和已游玩曲目会尽量按照1:1比例混合推荐</li>
            <li>已全良的曲目不会出现在推荐列表中</li>
            <li>过滤重复曲目（如普通版和翻唱版）</li>
            <li>推荐曲目的难度定数不会超过您B20定数基数+调整值，避免过难导致挫败</li>
          </ul>
          
          <h4 class="flex items-center gap-2 mt-4 mb-2 font-bold text-[#333] text-base">
            <span class="bg-[#e91e63] rounded w-1 h-5"></span>
            最佳实践
          </h4>
          <ul class="space-y-1.5 pl-6 text-gray-700 list-disc">
            <li><strong class="text-pink-600">新手玩家</strong>：建议从综合 Rating 维度开始练习，这是综合能力的体现</li>
            <li><strong class="text-purple-600">针对性提升</strong>：如果某项能力明显偏弱，可专注练习该维度的推荐曲目</li>
            <li><strong class="text-blue-600">循序渐进</strong>：建议根据自身的游戏（冲星 / 精度）倾向，将难度调整设为 ±0~0.2 范围，避免跨度过大</li>
            <li><strong class="text-green-600">定期更新</strong>：完成推荐曲目后重新分析成绩，获取新的推荐</li>
          </ul>
        </div>
        <div class="flex flex-shrink-0 justify-end px-5 py-3 border-gray-200 border-t">
          <button class="bg-[#e91e63] hover:bg-[#c2185b] px-4 py-2 border-none rounded-md font-medium text-white text-sm transition-colors cursor-pointer" @click="handleClose">我知道了</button>
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
