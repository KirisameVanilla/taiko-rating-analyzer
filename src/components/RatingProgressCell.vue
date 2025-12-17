<script setup lang="ts">
import type { SongStats, RatingDimensions } from '@/types';

interface Props {
  song: SongStats
  valueKey: keyof SongStats
  formatValue: (item: SongStats, key: keyof SongStats) => string
}

const props = defineProps<Props>()

const getPercentage = () => {
  const maxRatings = props.song._maxRatings;
  if (!maxRatings) return 0;
  
  // valueKey might be 'great', 'good' etc which are not in RatingDimensions
  // But this component seems to be used only for rating dimensions
  if (!(props.valueKey in maxRatings)) return 0;
  
  const key = props.valueKey as keyof RatingDimensions;
  const maxValue = maxRatings[key] || 0;
  const currentValue = props.song._isUnplayed ? 0 : parseFloat(props.formatValue(props.song, props.valueKey));
  
  return maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
}

const getMaxValue = () => {
  const maxRatings = props.song._maxRatings;
  if (!maxRatings) return 0;
  if (!(props.valueKey in maxRatings)) return 0;
  
  const key = props.valueKey as keyof RatingDimensions;
  return maxRatings[key] || 0;
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <!-- 进度条（包含分数文本） -->
    <div class="relative bg-gray-200 rounded-full w-28 h-5 overflow-hidden">
      <div 
        class="h-full transition-all duration-500 ease-out"
        :class="{
          'bg-emerald-300/60': getPercentage() >= 80,
          'bg-blue-300/60': getPercentage() >= 60 && getPercentage() < 80,
          'bg-yellow-300/60': getPercentage() >= 40 && getPercentage() < 60,
          'bg-orange-300/60': getPercentage() >= 20 && getPercentage() < 40,
          'bg-primary/60': getPercentage() < 20
        }"
        :style="{
          width: `${Math.min(getPercentage(), 100)}%`
        }"
      ></div>
      <!-- 当前rating/最高rating（绝对定位在进度条上） -->
      <div class="absolute inset-0 flex justify-center items-center font-bold text-[11px] whitespace-nowrap">
        <span class="text-gray-800">
          {{ song._isUnplayed ? '0.00' : formatValue(song, valueKey) }}
        </span>
        <span class="ml-0.5 text-[9px] text-gray-600">
          / {{ getMaxValue().toFixed(2) }}
        </span>
      </div>
    </div>
  </div>
</template>
