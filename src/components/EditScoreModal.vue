<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { UserScore, SongData, SongStats } from '../types'
import { calculateSongStats } from '../utils/calculator'

interface Props {
  show: boolean
  title: string
  initialScore?: UserScore
  songData?: SongData
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', score: Partial<UserScore>): void
  (e: 'clear'): void
}>()

const form = ref({
  score: 0,
  great: 0,
  good: 0,
  bad: 0,
  drumroll: 0,
  combo: 0
})

const previewStats = computed<SongStats | null>(() => {
  if (!props.songData) return null
  
  // Construct a temporary UserScore object for calculation
  // We only need fields that affect calculation (great, good, bad)
  // But we should provide a valid object structure
  const tempScore: UserScore = {
    id: 0, // Dummy
    level: 0, // Dummy
    score: form.value.score,
    scoreRank: 0,
    great: form.value.great,
    good: form.value.good,
    bad: form.value.bad,
    drumroll: form.value.drumroll,
    combo: form.value.combo,
    playCount: 0,
    clearCount: 0,
    fullcomboCount: 0,
    perfectCount: 0,
    updatedAt: ''
  }
  
  return calculateSongStats(props.songData, tempScore)
})

watch(() => props.show, (newVal) => {
  if (newVal) {
    if (props.initialScore) {
      form.value = {
        score: props.initialScore.score,
        great: props.initialScore.great,
        good: props.initialScore.good,
        bad: props.initialScore.bad,
        drumroll: props.initialScore.drumroll,
        combo: props.initialScore.combo
      }
    } else {
      form.value = {
        score: 0,
        great: 0,
        good: 0,
        bad: 0,
        drumroll: 0,
        combo: 0
      }
    }
  }
})

const handleSave = () => {
  emit('save', { ...form.value })
}

const handleClear = () => {
  if (confirm('确定要清除这条成绩吗？')) {
    emit('clear')
  }
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="z-[1000] fixed inset-0 flex justify-center items-center bg-black/50 transition-opacity duration-300" @click.self="$emit('close')">
      <div class="bg-white shadow-[0_4px_6px_rgba(0,0,0,0.1)] rounded-lg w-[90%] max-w-[500px] transition-transform duration-300">
        <div class="flex justify-between items-center px-5 py-4 border-gray-200 border-b">
          <h3 class="m-0 font-semibold text-lg">编辑成绩 - {{ title }}</h3>
          <button class="bg-none border-none text-gray-600 text-2xl cursor-pointer" @click="$emit('close')">&times;</button>
        </div>
        
        <div class="p-5">
          <div class="mb-[15px]">
            <label class="block mb-1.5 font-medium text-gray-700">分数</label>
            <input type="number" v-model.number="form.score" class="box-border p-2 border border-gray-300 rounded w-full" />
          </div>
          <div class="flex gap-[15px]">
            <div class="flex-1 mb-[15px]">
              <label class="block mb-1.5 font-medium text-gray-700">良</label>
              <input type="number" v-model.number="form.great" class="box-border p-2 border border-gray-300 rounded w-full" />
            </div>
            <div class="flex-1 mb-[15px]">
              <label class="block mb-1.5 font-medium text-gray-700">可</label>
              <input type="number" v-model.number="form.good" class="box-border p-2 border border-gray-300 rounded w-full" />
            </div>
            <div class="flex-1 mb-[15px]">
              <label class="block mb-1.5 font-medium text-gray-700">不可</label>
              <input type="number" v-model.number="form.bad" class="box-border p-2 border border-gray-300 rounded w-full" />
            </div>
          </div>
          <div class="flex gap-[15px]">
            <div class="flex-1 mb-[15px]">
              <label class="block mb-1.5 font-medium text-gray-700">连打</label>
              <input type="number" v-model.number="form.drumroll" class="box-border p-2 border border-gray-300 rounded w-full" />
            </div>
            <div class="flex-1 mb-[15px]">
              <label class="block mb-1.5 font-medium text-gray-700">连击</label>
              <input type="number" v-model.number="form.combo" class="box-border p-2 border border-gray-300 rounded w-full" />
            </div>
          </div>

          <div v-if="previewStats" class="mt-5 pt-[15px] border-gray-200 border-t">
            <h4 class="m-0 mb-2.5 text-gray-700">预览 Rating: {{ previewStats.rating.toFixed(2) }}</h4>
            <div class="gap-2.5 grid grid-cols-3">
              <div class="flex flex-col bg-gray-50 p-2 rounded">
                <span class="text-gray-600 text-xs">大歌力</span>
                <span class="font-semibold text-gray-900">{{ previewStats.daigouryoku.toFixed(2) }}</span>
              </div>
              <div class="flex flex-col bg-gray-50 p-2 rounded">
                <span class="text-gray-600 text-xs">体力</span>
                <span class="font-semibold text-gray-900">{{ previewStats.stamina.toFixed(2) }}</span>
              </div>
              <div class="flex flex-col bg-gray-50 p-2 rounded">
                <span class="text-gray-600 text-xs">高速力</span>
                <span class="font-semibold text-gray-900">{{ previewStats.speed.toFixed(2) }}</span>
              </div>
              <div class="flex flex-col bg-gray-50 p-2 rounded">
                <span class="text-gray-600 text-xs">精度力</span>
                <span class="font-semibold text-gray-900">{{ previewStats.accuracy_power.toFixed(2) }}</span>
              </div>
              <div class="flex flex-col bg-gray-50 p-2 rounded">
                <span class="text-gray-600 text-xs">节奏处理</span>
                <span class="font-semibold text-gray-900">{{ previewStats.rhythm.toFixed(2) }}</span>
              </div>
              <div class="flex flex-col bg-gray-50 p-2 rounded">
                <span class="text-gray-600 text-xs">复合处理</span>
                <span class="font-semibold text-gray-900">{{ previewStats.complex.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-between items-center px-5 py-4 border-gray-200 border-t">
          <button class="bg-red-500 px-4 py-2 border-none rounded font-medium text-white cursor-pointer" @click="handleClear" v-if="initialScore">清除成绩</button>
          <div class="flex gap-2.5 ml-auto">
            <button class="bg-gray-200 px-4 py-2 border-none rounded font-medium text-gray-700 cursor-pointer" @click="$emit('close')">取消</button>
            <button class="bg-blue-500 px-4 py-2 border-none rounded font-medium text-white cursor-pointer" @click="handleSave">保存</button>
          </div>
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
