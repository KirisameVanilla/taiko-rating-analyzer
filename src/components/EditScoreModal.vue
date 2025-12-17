<script setup lang="ts">
import type { SongLevelData, SongStats, UserScore, LockedScores } from '@/types'
import { calculateSongStats } from '@utils/calculator'
import { computed, ref, watch } from 'vue'

interface Props {
  show: boolean
  title: string
  initialScore?: UserScore
  songData?: SongLevelData
  songId?: number
  difficulty?: number
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

const isLocked = ref(false)

const getLockKey = () => {
  if (props.songId !== undefined && props.difficulty !== undefined) {
    return `${props.songId}-${props.difficulty}`
  }
  if (props.initialScore) {
    return `${props.initialScore.id}-${props.initialScore.level}`
  }
  return null
}

const checkLockStatus = () => {
  const key = getLockKey()
  if (!key) {
    isLocked.value = false
    return
  }
  try {
    const lockedDataStr = localStorage.getItem('taiko-locked-songs')
    if (lockedDataStr) {
      const lockedData: LockedScores = JSON.parse(lockedDataStr)
      isLocked.value = !!lockedData[key]
    } else {
      isLocked.value = false
    }
  } catch (e) {
    isLocked.value = false
  }
}

const toggleLock = () => {
  const key = getLockKey()
  if (!key) return

  try {
    const lockedDataStr = localStorage.getItem('taiko-locked-songs')
    let lockedData: LockedScores = lockedDataStr ? JSON.parse(lockedDataStr) : {}

    if (isLocked.value) {
      delete lockedData[key]
      isLocked.value = false
    } else {
      const scoreToLock: UserScore = {
        id: props.songId || props.initialScore?.id || 0,
        level: props.difficulty || props.initialScore?.level || 0,
        score: form.value.score,
        scoreRank: props.initialScore?.scoreRank || 0,
        great: form.value.great,
        good: form.value.good,
        bad: form.value.bad,
        drumroll: form.value.drumroll,
        combo: form.value.combo,
        playCount: props.initialScore?.playCount || 0,
        clearCount: props.initialScore?.clearCount || 0,
        fullcomboCount: props.initialScore?.fullcomboCount || 0,
        perfectCount: props.initialScore?.perfectCount || 0,
        updatedAt: new Date().toISOString()
      }
      lockedData[key] = scoreToLock
      isLocked.value = true
    }
    localStorage.setItem('taiko-locked-songs', JSON.stringify(lockedData))
  } catch (e) {
    console.error('Failed to toggle lock', e)
  }
}

const previewStats = computed<SongStats | null>(() => {
  if (!props.songData) return null
  
  const tempScore: UserScore = {
    id: 0,
    level: 0,
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
    checkLockStatus()
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
  if (isLocked.value) {
    const key = getLockKey()
    if (key) {
      try {
        const lockedDataStr = localStorage.getItem('taiko-locked-songs')
        let lockedData: LockedScores = lockedDataStr ? JSON.parse(lockedDataStr) : {}
        
        const scoreToLock: UserScore = {
          id: props.songId || props.initialScore?.id || 0,
          level: props.difficulty || props.initialScore?.level || 0,
          score: form.value.score,
          scoreRank: props.initialScore?.scoreRank || 0,
          great: form.value.great,
          good: form.value.good,
          bad: form.value.bad,
          drumroll: form.value.drumroll,
          combo: form.value.combo,
          playCount: props.initialScore?.playCount || 0,
          clearCount: props.initialScore?.clearCount || 0,
          fullcomboCount: props.initialScore?.fullcomboCount || 0,
          perfectCount: props.initialScore?.perfectCount || 0,
          updatedAt: new Date().toISOString()
        }
        
        lockedData[key] = scoreToLock
        localStorage.setItem('taiko-locked-songs', JSON.stringify(lockedData))
      } catch (e) {
        console.error('Failed to update locked score', e)
      }
    }
  }
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
    <div v-if="show" class="z-[1000] fixed inset-0 flex justify-center items-center bg-black/40 backdrop-blur-sm transition-opacity duration-300" @mousedown.self="$emit('close')">
      <div class="bg-white/90 shadow-2xl backdrop-blur-2xl border border-white/20 rounded-[32px] w-[95%] max-w-[500px] overflow-hidden transition-all duration-300" @mousedown.stop>
        <!-- Header -->
        <div class="flex justify-between items-center px-8 py-6">
          <div class="space-y-1">
            <h3 class="m-0 font-bold text-[#1D1D1F] text-xl">编辑成绩</h3>
            <p class="m-0 max-w-[300px] text-[#86868B] text-sm truncate">{{ title }}</p>
          </div>
          <button class="flex justify-center items-center bg-black/5 hover:bg-black/10 border-none rounded-full w-8 h-8 text-[#1D1D1F] transition-all cursor-pointer" @click="$emit('close')">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div class="space-y-6 px-8 pb-8">
          <!-- Score Input -->
          <div class="space-y-2">
            <label class="block px-1 font-semibold text-[#1D1D1F] text-sm">分数</label>
            <input 
              type="number" 
              v-model.number="form.score" 
              class="box-border bg-black/5 focus:bg-white px-4 py-3 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] text-lg transition-all" 
            />
          </div>

          <!-- Counts Grid -->
          <div class="gap-4 grid grid-cols-3">
            <div class="space-y-2">
              <label class="block px-1 font-semibold text-[#1D1D1F] text-sm">良</label>
              <input type="number" v-model.number="form.great" class="box-border bg-black/5 focus:bg-white px-4 py-3 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] transition-all" />
            </div>
            <div class="space-y-2">
              <label class="block px-1 font-semibold text-[#1D1D1F] text-sm">可</label>
              <input type="number" v-model.number="form.good" class="box-border bg-black/5 focus:bg-white px-4 py-3 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] transition-all" />
            </div>
            <div class="space-y-2">
              <label class="block px-1 font-semibold text-[#1D1D1F] text-sm">不可</label>
              <input type="number" v-model.number="form.bad" class="box-border bg-black/5 focus:bg-white px-4 py-3 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] transition-all" />
            </div>
          </div>

          <!-- Combo & Drumroll -->
          <div class="gap-4 grid grid-cols-2">
            <div class="space-y-2">
              <label class="block px-1 font-semibold text-[#1D1D1F] text-sm">连打</label>
              <input type="number" v-model.number="form.drumroll" class="box-border bg-black/5 focus:bg-white px-4 py-3 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] transition-all" />
            </div>
            <div class="space-y-2">
              <label class="block px-1 font-semibold text-[#1D1D1F] text-sm">连击</label>
              <input type="number" v-model.number="form.combo" class="box-border bg-black/5 focus:bg-white px-4 py-3 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] transition-all" />
            </div>
          </div>

          <!-- Preview Section -->
          <div v-if="previewStats" class="space-y-4 bg-black/5 p-6 rounded-[24px]">
            <div class="flex justify-between items-center">
              <span class="font-medium text-[#86868B]">预览 Rating</span>
              <span class="font-bold text-[#007AFF] text-2xl">{{ previewStats.rating.toFixed(2) }}</span>
            </div>
            <div class="gap-3 grid grid-cols-3">
              <div class="flex flex-col items-center bg-white/50 p-3 rounded-xl">
                <span class="font-bold text-[#86868B] text-[10px] uppercase tracking-wider">大歌力</span>
                <span class="font-bold text-[#1D1D1F]">{{ previewStats.daigouryoku.toFixed(1) }}</span>
              </div>
              <div class="flex flex-col items-center bg-white/50 p-3 rounded-xl">
                <span class="font-bold text-[#86868B] text-[10px] uppercase tracking-wider">体力</span>
                <span class="font-bold text-[#1D1D1F]">{{ previewStats.stamina.toFixed(1) }}</span>
              </div>
              <div class="flex flex-col items-center bg-white/50 p-3 rounded-xl">
                <span class="font-bold text-[#86868B] text-[10px] uppercase tracking-wider">高速力</span>
                <span class="font-bold text-[#1D1D1F]">{{ previewStats.speed.toFixed(1) }}</span>
              </div>
              <div class="flex flex-col items-center bg-white/50 p-3 rounded-xl">
                <span class="font-bold text-[#86868B] text-[10px] uppercase tracking-wider">精度力</span>
                <span class="font-bold text-[#1D1D1F]">{{ previewStats.accuracy_power.toFixed(1) }}</span>
              </div>
              <div class="flex flex-col items-center bg-white/50 p-3 rounded-xl">
                <span class="font-bold text-[#86868B] text-[10px] uppercase tracking-wider">节奏</span>
                <span class="font-bold text-[#1D1D1F]">{{ previewStats.rhythm.toFixed(1) }}</span>
              </div>
              <div class="flex flex-col items-center bg-white/50 p-3 rounded-xl">
                <span class="font-bold text-[#86868B] text-[10px] uppercase tracking-wider">复合</span>
                <span class="font-bold text-[#1D1D1F]">{{ previewStats.complex.toFixed(1) }}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3 pt-2">
            <button 
              class="flex justify-center items-center bg-red-50 hover:bg-red-100 disabled:opacity-30 border-none rounded-2xl w-12 h-12 text-[#FF3B30] transition-all cursor-pointer" 
              @click="handleClear" 
              :disabled="!initialScore"
              title="清除成绩"
            >
              <i class="fa-solid fa-trash"></i>
            </button>
            <button 
              class="flex justify-center items-center border-none rounded-2xl w-12 h-12 transition-all cursor-pointer"
              :class="isLocked ? 'bg-[#FF9500]/10 text-[#FF9500]' : 'bg-black/5 text-[#86868B]'"
              @click="toggleLock"
              :title="isLocked ? '已锁定' : '锁定成绩'"
            >
              <i class="fa-solid" :class="isLocked ? 'fa-lock' : 'fa-lock-open'"></i>
            </button>
            <div class="flex flex-1 gap-3">
              <button class="flex-1 bg-black/5 hover:bg-black/10 py-3 border-none rounded-2xl font-semibold text-[#1D1D1F] transition-all cursor-pointer" @click="$emit('close')">取消</button>
              <button class="flex-1 bg-[#007AFF] hover:bg-[#0071E3] shadow-[#007AFF]/20 shadow-lg py-3 border-none rounded-2xl font-bold text-white transition-all cursor-pointer" @click="handleSave">保存</button>
            </div>
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
