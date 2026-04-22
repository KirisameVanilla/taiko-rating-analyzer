<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UserScore } from '@/types'

const { t } = useI18n()

const props = defineProps<{
  showModal: (msg: string, title?: string) => void
  tryParseTaikoScoreGetter: (input: string) => UserScore[] | null
  tryParseDonderTool: (input: any) => UserScore[] | null
  tryParseDonderHiroba: (input: string) => UserScore[] | null
}>()

const emit = defineEmits<{
  analyze: [data: UserScore[]]
}>()

const scoreInput = ref('')

const copyPowerShellCode = () => {
  const text = `$content = (iwr "https://www.baidu.com/api/ahfsdafbaqwerhue").Content; $content | Set-Clipboard; Write-Host "内容已复制到剪贴板！长度为: $($content.Length)" -ForegroundColor Green`
  navigator.clipboard.writeText(text).then(() => {
    props.showModal('PowerShell 代码已复制到剪贴板！')
  }).catch(err => {
    console.error('复制失败:', err)
  })
}

const handlePaste = async () => {
  try {
    const text = await navigator.clipboard.readText()
    scoreInput.value = text
    props.showModal('粘贴成功！')
  } catch (err) {
    console.error('粘贴失败:', err)
    props.showModal('粘贴失败，请确保已授予剪贴板访问权限', '错误')
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
        const output = props.tryParseTaikoScoreGetter(text) || props.tryParseDonderTool(text) || props.tryParseDonderHiroba(text)
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

const handleAnalyze = () => {
  if (!scoreInput.value.trim()) {
    props.showModal('请输入数据', '提示')
    return
  }

  const input = scoreInput.value.trim()
  let output = props.tryParseTaikoScoreGetter(input) || props.tryParseDonderHiroba(input)
  if (!output) {
    output = props.tryParseDonderTool(input)
  }
  if (!output) {
    props.showModal('数据格式不正确', '错误')
    return
  }

  emit('analyze', output)
}
</script>

<template>
  <div class="p-8 text-left">
    <div class="space-y-6">
      <div class="space-y-4">
        <div class="flex gap-4">
          <div
            class="flex flex-shrink-0 justify-center items-center bg-black/5 rounded-full w-6 h-6 font-bold text-[#86868B] text-xs">
            1</div>
          <p class="m-0 text-[#1D1D1F]">{{ t('guide.osReq') }}</p>
        </div>
        <div class="flex gap-4">
          <div
            class="flex flex-shrink-0 justify-center items-center bg-black/5 rounded-full w-6 h-6 font-bold text-[#86868B] text-xs">
            2</div>
          <p class="m-0 text-[#1D1D1F]">{{ t('guide.startTool') }}</p>
        </div>
        <div class="flex gap-4">
          <div
            class="flex flex-shrink-0 justify-center items-center bg-black/5 rounded-full w-6 h-6 font-bold text-[#86868B] text-xs">
            3</div>
          <p class="m-0 text-[#1D1D1F]" v-html="t('guide.setProxy')"></p>
        </div>
        <div class="flex gap-4">
          <div
            class="flex flex-shrink-0 justify-center items-center bg-black/5 rounded-full w-6 h-6 font-bold text-[#86868B] text-xs">
            4</div>
          <p class="m-0 text-[#1D1D1F]">
            {{ t('guide.helpProxy') }}
            <button @click="copyPowerShellCode"
              class="bg-transparent p-0 border-none font-medium text-[#007AFF] hover:underline cursor-pointer">{{
                t('guide.copyCode') }}</button>
          </p>
        </div>
      </div>

      <div class="space-y-4 bg-black/5 p-6 rounded-[24px]">
        <p class="m-0 font-bold text-[#1D1D1F]">{{ t('guide.download') }}</p>
        <div class="gap-3 grid grid-cols-1">
          <a href="https://gitee.com/donnote/taiko-score-getter/releases/tag/latest" target="_blank"
            class="group flex items-center gap-3 bg-white/50 hover:bg-white p-3 rounded-xl text-[#1D1D1F] no-underline transition-all">
            <i class="text-[#F05032] text-xl fa-brands fa-git-alt"></i>
            <span class="flex-1 font-medium text-sm">{{ t('guide.old') }} @Gitee donnote/taiko-score-getter</span>
            <i class="fa-chevron-right text-black/10 group-hover:text-black/30 transition-all fa-solid"></i>
          </a>
          <a href="https://github.com/Steve-xmh/taiko-score-getter-rs/releases/tag/v0.1.2" target="_blank"
            class="group flex items-center gap-3 bg-white/50 hover:bg-white p-3 rounded-xl text-[#1D1D1F] no-underline transition-all">
            <i class="text-xl fa-brands fa-github"></i>
            <span class="flex-1 font-medium text-sm">{{ t('guide.new') }} @GitHub
              Steve-xmh/taiko-score-getter-rs</span>
            <i class="fa-chevron-right text-black/10 group-hover:text-black/30 transition-all fa-solid"></i>
          </a>
          <a href="https://ghproxy.vanillaaaa.org/https://github.com/Steve-xmh/taiko-score-getter-rs/releases/latest/download/taiko-score-getter.exe"
            target="_blank"
            class="group flex items-center gap-3 bg-[#007AFF]/10 hover:bg-[#007AFF]/20 p-3 rounded-xl text-[#007AFF] no-underline transition-all">
            <i class="text-xl fa-solid fa-download"></i>
            <span class="flex-1 font-bold text-sm">{{ t('guide.downloadNew') }}</span>
            <i class="fa-chevron-right opacity-30 group-hover:opacity-100 transition-all fa-solid"></i>
          </a>
        </div>
      </div>

      <div class="space-y-4 pt-4">
        <div class="flex gap-2">
          <button @click="handleUpload"
            class="flex-1 bg-black/5 hover:bg-black/10 py-3 border-none rounded-xl font-medium text-[#1D1D1F] transition-all cursor-pointer">
            <i class="mr-2 fa-regular fa-file"></i> {{ t('guide.uploadFile') }}
          </button>
          <button @click="handlePaste"
            class="flex-1 bg-black/5 hover:bg-black/10 py-3 border-none rounded-xl font-medium text-[#1D1D1F] transition-all cursor-pointer">
            <i class="mr-2 fa-regular fa-clipboard"></i> {{ t('guide.pasteData') }}
          </button>
        </div>
        <textarea v-model="scoreInput" rows="4" :placeholder="t('guide.pastePlaceholder')"
          class="box-border bg-black/5 focus:bg-white p-4 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full font-mono text-[#1D1D1F] transition-all resize-none"></textarea>
        <button @click="handleAnalyze"
          class="bg-[#007AFF] hover:bg-[#0071E3] shadow-[#007AFF]/20 shadow-lg py-4 border-none rounded-2xl w-full font-bold text-white text-lg active:scale-[0.98] transition-all cursor-pointer">
          {{ t('guide.analyze') }}
        </button>
      </div>
    </div>
  </div>
</template>
