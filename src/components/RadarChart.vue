<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref } from 'vue'
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'

interface Props {
  data: {
    daigouryoku: number
    stamina: number
    speed: number
    accuracy: number
    rhythm: number
    complex: number
  }
}

const props = defineProps<Props>()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

// 注册Chart.js插件
Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, ChartDataLabels)

const createChart = () => {
  if (!canvasRef.value) return
  
  // 销毁旧实例
  if (chartInstance) {
    chartInstance.destroy()
  }

  const stats = [
    props.data.daigouryoku,
    props.data.stamina,
    props.data.speed,
    props.data.accuracy,
    props.data.rhythm,
    props.data.complex
  ]
  const minVal = Math.min(...stats) - 1

  chartInstance = new Chart(canvasRef.value, {
    type: 'radar',
    data: {
      labels: ['大歌力', '耐力', '高速', '精度', '节奏处理', '复合处理'],
      datasets: [{
        label: '玩家能力值',
        data: stats,
        backgroundColor: 'rgba(233, 30, 99, 0.2)',
        borderColor: 'rgba(233, 30, 99, 1)',
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#e91e63'
      }]
    },
    options: {
      scales: {
        r: {
          suggestedMin: minVal > 0 ? minVal : 0,
          ticks: {
            display: true,
            backdropColor: 'transparent',
            stepSize: 1,
            callback: (value: number | string) => Number(value).toFixed(0)
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        datalabels: {
          anchor: 'end',
          align: 'end',
          formatter: (value: number) => Number(value).toFixed(2),
          font: {
            size: 12,
            weight: 'bold'
          },
          color: '#e91e63'
        }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  })
}

onMounted(() => {
  createChart()
})

// 监听数据变化,重新绘制图表
watch(() => props.data, () => {
  createChart()
}, { deep: true })

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>

<template>
  <canvas ref="canvasRef"></canvas>
</template>
