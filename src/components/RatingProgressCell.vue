<script setup lang="ts">
import type { SongStats } from '../types'

interface Props {
  song: SongStats
  valueKey: keyof SongStats
  formatValue: (item: SongStats, key: keyof SongStats) => string
}

const props = defineProps<Props>()
</script>

<template>
  <div class="flex items-center gap-1.5">
    <!-- 进度条（包含分数文本） -->
    <div class="relative bg-gray-200 rounded-full w-28 h-5 overflow-hidden">
      <div 
        class="h-full transition-all duration-500 ease-out"
        :class="{
          'bg-emerald-300/60': (() => {
            const maxRatings = (song as any)._maxRatings;
            const key = valueKey as string;
            let maxValue = 0;
            if (key === 'rating') maxValue = maxRatings.maxRating;
            else if (key === 'daigouryoku') maxValue = maxRatings.maxDaigouryoku;
            else if (key === 'stamina') maxValue = maxRatings.maxStamina;
            else if (key === 'speed') maxValue = maxRatings.maxSpeed;
            else if (key === 'accuracy_power') maxValue = maxRatings.maxAccuracyPower;
            else if (key === 'rhythm') maxValue = maxRatings.maxRhythm;
            else if (key === 'complex') maxValue = maxRatings.maxComplex;
            const currentValue = (song as any)._isUnplayed ? 0 : parseFloat(formatValue(song, valueKey));
            const percentage = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
            return percentage >= 80;
          })(),
          'bg-blue-300/60': (() => {
            const maxRatings = (song as any)._maxRatings;
            const key = valueKey as string;
            let maxValue = 0;
            if (key === 'rating') maxValue = maxRatings.maxRating;
            else if (key === 'daigouryoku') maxValue = maxRatings.maxDaigouryoku;
            else if (key === 'stamina') maxValue = maxRatings.maxStamina;
            else if (key === 'speed') maxValue = maxRatings.maxSpeed;
            else if (key === 'accuracy_power') maxValue = maxRatings.maxAccuracyPower;
            else if (key === 'rhythm') maxValue = maxRatings.maxRhythm;
            else if (key === 'complex') maxValue = maxRatings.maxComplex;
            const currentValue = (song as any)._isUnplayed ? 0 : parseFloat(formatValue(song, valueKey));
            const percentage = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
            return percentage >= 60 && percentage < 80;
          })(),
          'bg-yellow-300/60': (() => {
            const maxRatings = (song as any)._maxRatings;
            const key = valueKey as string;
            let maxValue = 0;
            if (key === 'rating') maxValue = maxRatings.maxRating;
            else if (key === 'daigouryoku') maxValue = maxRatings.maxDaigouryoku;
            else if (key === 'stamina') maxValue = maxRatings.maxStamina;
            else if (key === 'speed') maxValue = maxRatings.maxSpeed;
            else if (key === 'accuracy_power') maxValue = maxRatings.maxAccuracyPower;
            else if (key === 'rhythm') maxValue = maxRatings.maxRhythm;
            else if (key === 'complex') maxValue = maxRatings.maxComplex;
            const currentValue = (song as any)._isUnplayed ? 0 : parseFloat(formatValue(song, valueKey));
            const percentage = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
            return percentage >= 40 && percentage < 60;
          })(),
          'bg-orange-300/60': (() => {
            const maxRatings = (song as any)._maxRatings;
            const key = valueKey as string;
            let maxValue = 0;
            if (key === 'rating') maxValue = maxRatings.maxRating;
            else if (key === 'daigouryoku') maxValue = maxRatings.maxDaigouryoku;
            else if (key === 'stamina') maxValue = maxRatings.maxStamina;
            else if (key === 'speed') maxValue = maxRatings.maxSpeed;
            else if (key === 'accuracy_power') maxValue = maxRatings.maxAccuracyPower;
            else if (key === 'rhythm') maxValue = maxRatings.maxRhythm;
            else if (key === 'complex') maxValue = maxRatings.maxComplex;
            const currentValue = (song as any)._isUnplayed ? 0 : parseFloat(formatValue(song, valueKey));
            const percentage = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
            return percentage >= 20 && percentage < 40;
          })(),
          'bg-primary/60': (() => {
            const maxRatings = (song as any)._maxRatings;
            const key = valueKey as string;
            let maxValue = 0;
            if (key === 'rating') maxValue = maxRatings.maxRating;
            else if (key === 'daigouryoku') maxValue = maxRatings.maxDaigouryoku;
            else if (key === 'stamina') maxValue = maxRatings.maxStamina;
            else if (key === 'speed') maxValue = maxRatings.maxSpeed;
            else if (key === 'accuracy_power') maxValue = maxRatings.maxAccuracyPower;
            else if (key === 'rhythm') maxValue = maxRatings.maxRhythm;
            else if (key === 'complex') maxValue = maxRatings.maxComplex;
            const currentValue = (song as any)._isUnplayed ? 0 : parseFloat(formatValue(song, valueKey));
            const percentage = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
            return percentage < 20;
          })()
        }"
        :style="{
          width: (() => {
            const maxRatings = (song as any)._maxRatings;
            const key = valueKey as string;
            let maxValue = 0;
            if (key === 'rating') maxValue = maxRatings.maxRating;
            else if (key === 'daigouryoku') maxValue = maxRatings.maxDaigouryoku;
            else if (key === 'stamina') maxValue = maxRatings.maxStamina;
            else if (key === 'speed') maxValue = maxRatings.maxSpeed;
            else if (key === 'accuracy_power') maxValue = maxRatings.maxAccuracyPower;
            else if (key === 'rhythm') maxValue = maxRatings.maxRhythm;
            else if (key === 'complex') maxValue = maxRatings.maxComplex;
            const currentValue = (song as any)._isUnplayed ? 0 : parseFloat(formatValue(song, valueKey));
            const percentage = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
            return `${Math.min(percentage, 100)}%`;
          })()
        }"
      ></div>
      <!-- 当前rating/最高rating（绝对定位在进度条上） -->
      <div class="absolute inset-0 flex justify-center items-center font-bold text-[11px] whitespace-nowrap">
        <span class="text-gray-800">
          {{
            (() => {
              const currentValue = (song as any)._isUnplayed ? '0.00' : formatValue(song, valueKey);
              return currentValue;
            })()
          }}
        </span>
        <span class="ml-0.5 text-[9px] text-gray-600">
          / {{
            (() => {
              const maxRatings = (song as any)._maxRatings;
              const key = valueKey as string;
              let maxValue = 0;
              if (key === 'rating') maxValue = maxRatings.maxRating;
              else if (key === 'daigouryoku') maxValue = maxRatings.maxDaigouryoku;
              else if (key === 'stamina') maxValue = maxRatings.maxStamina;
              else if (key === 'speed') maxValue = maxRatings.maxSpeed;
              else if (key === 'accuracy_power') maxValue = maxRatings.maxAccuracyPower;
              else if (key === 'rhythm') maxValue = maxRatings.maxRhythm;
              else if (key === 'complex') maxValue = maxRatings.maxComplex;
              return maxValue.toFixed(2);
            })()
          }}
        </span>
      </div>
    </div>
  </div>
</template>
