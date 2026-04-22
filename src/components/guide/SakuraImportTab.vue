<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UserScore } from '@/types'

const { t } = useI18n()

const props = defineProps<{
  showModal: (msg: string, title?: string) => void
  tryParseOfficialData: (data: any) => UserScore[] | null
}>()

const emit = defineEmits<{
  analyze: [data: UserScore[]]
}>()

const sakuraToken = ref(localStorage.getItem('sakuraToken') || '')
const isLoading = ref(false)

const fetchSakuraAndAnalyze = async () => {
  const token = sakuraToken.value.trim()
  if (!token) {
    props.showModal('请输入 Token', '提示')
    return
  }

  localStorage.setItem('sakuraToken', token)

  isLoading.value = true

  try {
    const response = await fetch('https://sakura-bot.cn/api/public-score/by-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => null)
      throw new Error(errData?.message || `请求失败 (${response.status})`)
    }

    const payload = await response.json()
    const songs = payload?.data?.songs

    if (!songs || songs.length === 0) {
      props.showModal('未找到成绩数据，请确认 Token 是否有效以及 Bot 是否已同步成绩。', '分析失败')
      isLoading.value = false
      return
    }

    const output = props.tryParseOfficialData(songs)

    if (!output) {
      props.showModal('成绩数据格式不正确', '分析失败')
      isLoading.value = false
      return
    }

    emit('analyze', output)
  } catch (error: any) {
    props.showModal(error.message || '同步数据失败', '同步失败')
    isLoading.value = false
  }
}
</script>

<template>
  <div class="p-10 text-left">
    <div class="space-y-6">
      <div class="space-y-4">
        <div class="flex gap-4">
          <div
            class="flex flex-shrink-0 justify-center items-center bg-[#007AFF] rounded-full w-8 h-8 font-bold text-white text-sm">
            1</div>
          <div class="space-y-1">
            <p class="m-0 font-medium text-[#1D1D1F]">{{ t('guide.sakuraStep1Title') }}</p>
            <p class="m-0 text-[#86868B] text-sm leading-relaxed" v-html="t('guide.sakuraStep1Desc')"></p>
          </div>
        </div>
        <div class="flex gap-4">
          <div
            class="flex flex-shrink-0 justify-center items-center bg-[#007AFF] rounded-full w-8 h-8 font-bold text-white text-sm">
            2</div>
          <div class="space-y-1">
            <p class="m-0 font-medium text-[#1D1D1F]">{{ t('guide.sakuraStep2Title') }}</p>
            <p class="m-0 text-[#86868B] text-sm leading-relaxed">{{ t('guide.sakuraStep2Desc') }}</p>
          </div>
        </div>
        <div class="flex gap-4">
          <div
            class="flex flex-shrink-0 justify-center items-center bg-[#007AFF] rounded-full w-8 h-8 font-bold text-white text-sm">
            3</div>
          <div class="space-y-1">
            <p class="m-0 font-medium text-[#1D1D1F]">{{ t('guide.sakuraStep3Title') }}</p>
            <p class="m-0 text-[#86868B] text-sm leading-relaxed">{{ t('guide.sakuraStep3Desc') }}</p>
          </div>
        </div>
      </div>

      <div class="space-y-4 bg-black/5 p-6 rounded-[24px]">
        <p class="m-0 font-bold text-[#1D1D1F]">{{ t('guide.sakuraNoteTitle') }}</p>
        <ul class="space-y-1 m-0 pl-5 text-[#86868B] text-sm list-disc">
          <li>{{ t('guide.sakuraNote1') }}</li>
          <li>{{ t('guide.sakuraNote2') }}</li>
        </ul>
      </div>

      <div class="space-y-4 pt-2">
        <div class="relative">
          <input v-model="sakuraToken" type="text" :placeholder="t('guide.sakuraTokenPlaceholder')"
            class="box-border bg-black/5 focus:bg-white px-6 py-4 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] text-lg transition-all"
            @keyup.enter="fetchSakuraAndAnalyze" />
        </div>
        <button @click="fetchSakuraAndAnalyze" :disabled="isLoading"
          class="bg-[#007AFF] hover:bg-[#0071E3] disabled:opacity-50 shadow-[#007AFF]/20 shadow-lg py-4 border-none rounded-2xl w-full font-bold text-white text-lg active:scale-[0.98] transition-all cursor-pointer">
          <i v-if="isLoading" class="mr-2 fa-solid fa-circle-notch fa-spin"></i>
          {{ isLoading ? t('report.calculating') : t('guide.sakuraBtnImport') }}
        </button>
      </div>
    </div>
  </div>
</template>
