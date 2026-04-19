<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  showModal: (msg: string, title?: string) => void
  tryParseDonderTool: (input: any) => string | null
}>()

const emit = defineEmits<{
  analyze: [data: string]
}>()

const donderId = ref(localStorage.getItem('donderId') || '')
const isLoading = ref(false)

const fetchAndAnalyze = async () => {
  const id = donderId.value.trim()
  if (!id) {
    props.showModal('请输入广场 ID', '提示')
    return
  }
  if (!/^\d+$/.test(id)) {
    props.showModal('广场 ID 必须是数字', '错误')
    return
  }

  localStorage.setItem('donderId', id)

  isLoading.value = true

  try {
    const response = await fetch(`https://hasura.llx.life/api/rest/donder/get-score?id=${donderId.value}`)

    if (!response.ok) {
      throw new Error(t('guide.errors.syncFailed'))
    }

    const data = await response.json()
    const scoreData = data?.score?.data

    if (!scoreData || scoreData.length === 0) {
      props.showModal(`未找到数据，请确认：
1.您绑定的广场 ID 是否正确？
2.您的查分器是否打开了 "公开成绩" 选项？
3.查分器分数是否已经同步到最新？
4.是否有魔王难度的分数记录？`, '分析失败')
      isLoading.value = false
      return
    }

    const output = props.tryParseDonderTool(scoreData)

    if (!output) {
      props.showModal(t('guide.errors.formatError'), '分析失败')
      isLoading.value = false
      return
    }

    emit('analyze', output)
  } catch (error: any) {
    props.showModal(error.message || t('guide.errors.syncFailed'), '分析失败')
    isLoading.value = false
  }
}

const handleUpload = () => {
  if ('showOpenFilePicker' in window) {
    (async () => {
      try {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: '文本或数据文件',
              accept: {
                'text/plain': ['.json']
              }
            }
          ],
          multiple: false
        })
        if (!fileHandle) return
        const file = await fileHandle.getFile()
        const text = await file.text()
        const output = props.tryParseDonderTool(JSON.parse(text))
        if (!output) {
          props.showModal(t('guide.errors.formatError'), '错误')
          return
        }
        emit('analyze', output)
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          props.showModal(t('guide.errors.readFailed'), '错误')
        }
      }
    })()
  } else {
    props.showModal('当前浏览器不支持文件选择 API，请使用新版 Chrome/Edge/Firefox', '错误')
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
            <p class="m-0 font-medium text-[#1D1D1F]">{{ t('guide.syncStep1Title') }}</p>
            <p class="m-0 text-[#86868B] text-sm leading-relaxed" v-html="t('guide.syncStep1Desc')"></p>
          </div>
        </div>
        <div class="flex gap-4">
          <div
            class="flex flex-shrink-0 justify-center items-center bg-[#007AFF] rounded-full w-8 h-8 font-bold text-white text-sm">
            2</div>
          <div class="space-y-1">
            <p class="m-0 font-medium text-[#1D1D1F]">{{ t('guide.syncStep2Title') }}</p>
            <p class="m-0 text-[#86868B] text-sm leading-relaxed" v-html="t('guide.syncStep2Desc')"></p>
          </div>
        </div>
        <div class="flex gap-4">
          <div
            class="flex flex-shrink-0 justify-center items-center bg-[#007AFF] rounded-full w-8 h-8 font-bold text-white text-sm">
            3</div>
          <div class="space-y-1">
            <p class="m-0 font-medium text-[#1D1D1F]">{{ t('guide.syncStep3Title') }}</p>
            <p class="m-0 text-[#86868B] text-sm leading-relaxed">{{ t('guide.syncStep3Desc') }}</p>
          </div>
        </div>
      </div>

      <div class="space-y-4 bg-black/5 p-6 rounded-[24px]">
        <p class="m-0 font-bold text-[#1D1D1F]">{{ t('guide.syncNoteTitle') }}</p>
        <ul class="space-y-1 m-0 pl-5 text-[#86868B] text-sm list-disc">
          <li>{{ t('guide.syncNote1') }}</li>
          <li>{{ t('guide.syncNote2') }}</li>
        </ul>
      </div>

      <div class="space-y-4 pt-2">
        <div class="relative">
          <input v-model="donderId" type="text" :placeholder="t('guide.idPlaceholder')"
            class="box-border bg-black/5 focus:bg-white px-6 py-4 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] text-lg transition-all"
            @keyup.enter="fetchAndAnalyze" />
        </div>
        <div class="flex gap-4">
          <button @click="fetchAndAnalyze" :disabled="isLoading"
            class="flex-1 bg-[#007AFF] hover:bg-[#0071E3] disabled:opacity-50 shadow-[#007AFF]/20 shadow-lg py-4 border-none rounded-2xl font-bold text-white text-lg active:scale-[0.98] transition-all cursor-pointer">
            <i v-if="isLoading" class="mr-2 fa-solid fa-circle-notch fa-spin"></i>
            {{ isLoading ? t('report.calculating') : t('guide.btnSync') }}
          </button>
          <button @click="handleUpload" :disabled="isLoading"
            class="flex-1 bg-black/5 hover:bg-black/10 disabled:opacity-50 py-4 border-none rounded-2xl font-semibold text-[#1D1D1F] text-lg active:scale-[0.98] transition-all cursor-pointer">
            {{ t('guide.btnUpload') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
