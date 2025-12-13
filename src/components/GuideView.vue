<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useModal } from '../composables/useModal'

const router = useRouter()
const scoreInput = ref('')
const { showModal } = useModal()

// 控制向导和使用指南的显示
const showWizard = ref(true)
const showGuideContent = ref(false)

// 向导相关状态
const donderId = ref('')
const inputDonderId = ref('')
const wizardStep = ref(1)
const isLoading = ref(false)

// 初始化：检查是否已绑定广场ID
const initDonderId = () => {
  const savedId = localStorage.getItem('donderId')
  if (savedId) {
    donderId.value = savedId
    wizardStep.value = 2
  }
}

// 绑定广场ID
const bindDonderId = () => {
  const id = inputDonderId.value.trim()
  if (!id) {
    showModal('请输入广场 ID', '错误')
    return
  }
  if (!/^\d+$/.test(id)) {
    showModal('广场 ID 必须是数字', '错误')
    return
  }
  localStorage.setItem('donderId', id)
  donderId.value = id
  wizardStep.value = 2
}

// 重新绑定
const rebindDonderId = () => {
  donderId.value = ''
  inputDonderId.value = ''
  wizardStep.value = 1
}

// 从Donder查分器获取数据并分析
const fetchAndAnalyze = async () => {
  if (!donderId.value) {
    showModal('广场 ID 不存在', '错误')
    return
  }
  
  isLoading.value = true
  
  try {
    const response = await fetch(`https://hasura.llx.life/api/rest/donder/get-score?id=${donderId.value}`)
    
    if (!response.ok) {
      throw new Error('同步数据失败')
    }
    
    const data = await response.json()
    const scoreData = data?.score?.data
    
    if (!scoreData || scoreData.length === 0) {
      showModal(`未找到数据，请确认：
1.您绑定的广场 ID 是否正确？
2.您的查分器是否打开了 “公开成绩” 选项？
3.查分器分数是否已经同步到最新？
4.是否有魔王难度的分数记录？`, '分析失败')
      isLoading.value = false
      return
    }
    
    const output = tryParseDonderTool(scoreData)
    
    if (!output) {
      showModal('数据格式不正确', '分析失败')
      isLoading.value = false
      return
    }
    
    anyalyze(output)
  } catch (error: any) {
    showModal(error.message || '同步数据失败', '分析失败')
    isLoading.value = false
  }
}

// 点击手动导入成绩按钮
const handleManualImport = () => {
  showWizard.value = false
  showGuideContent.value = true
}

// 返回向导
const backToWizard = () => {
  showGuideContent.value = false
  showWizard.value = true
}

// 组件挂载时初始化
initDonderId()

const copyPowerShellCode = () => {
  const text = `$content = (iwr "https://www.baidu.com/api/ahfsdafbaqwerhue").Content; $content | Set-Clipboard; Write-Host "内容已复制到剪贴板！长度为: $($content.Length)" -ForegroundColor Green`
  navigator.clipboard.writeText(text).then(() => {
    showModal('PowerShell 代码已复制到剪贴板！')
  }).catch(err => {
    console.error('复制失败:', err)
  })
}

const handlePaste = async () => {
  try {
    const text = await navigator.clipboard.readText()
    scoreInput.value = text
    showModal('粘贴成功！')
  } catch (err) {
    console.error('粘贴失败:', err)
    showModal('粘贴失败，请确保已授予剪贴板访问权限', '错误')
  }
}

const handleUpload = () => {
  // 使用现代浏览器 API showOpenFilePicker
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
        const output = tryParseTaikoScoreGetter(text) || tryParseDonderTool(text)
        if (!output) {
          showModal('文件内容格式不正确', '错误')
          return
        }
        anyalyze(output)
        // scoreInput.value = text
        // showModal('文件内容已粘贴到文本框！')
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          showModal('读取文件失败', '错误')
        }
      }
    })()
  } else {
    showModal('当前浏览器不支持文件选择 API，请使用新版 Chrome/Edge/Firefox', '错误')
  }
}

/* 尝试解析旧版传分器格式
  schema: [
    [song_no, level, high_score, best_score_rank, good_cnt, ok_cnt, ng_cnt, pound_cnt, combo_cnt, stage_cnt, clear_cnt, full_combo_cnt, dondaful_combo_cnt, update_datetime],
    ...
  ]
*/
function tryParseTaikoScoreGetter(input: string): string | null {
  try {
    const arr = JSON.parse(input);
    if (Array.isArray(arr) && (Array.isArray(arr[0]) || arr.length === 0)) {
      return JSON.stringify(arr);
    }
  } catch (e) {}
  return null;
}

/* 尝试解析新版 LLX Donder Tool 传分器格式
  schema: [
    {
      song_no: string,
      level: string,
      high_score: number,
      best_score_rank: string,
      good_cnt: number,
      ok_cnt: number,
      ng_cnt: number,
      pound_cnt: number,
      combo_cnt: number,
      stage_cnt: number,
      clear_cnt: string,
      full_combo_cnt: boolean,
      dondaful_combo_cnt: boolean,
      update_datetime?: string
    },
    ...
  ]
*/
function tryParseDonderTool(input: string): string | null {
  let parsed: any;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    return null;
  }
  const isNewFormat = (obj: any) => {
    return obj && typeof obj === 'object' && (
      (Array.isArray(obj) && obj.length > 0 && obj[0] && typeof obj[0] === 'object' && 'song_no' in obj[0]) ||
      (!Array.isArray(obj) && 'song_no' in obj)
    );
  };
  if (!isNewFormat(parsed)) return null;
  let arr = Array.isArray(parsed) ? parsed : [parsed];
  return JSON.stringify(arr.map((item: any) => [
    item.song_no,
    item.level,
    item.high_score,
    item.best_score_rank,
    item.good_cnt,
    item.ok_cnt,
    item.ng_cnt,
    item.pound_cnt,
    item.combo_cnt,
    item.stage_cnt,
    item.clear_cnt,
    item.full_combo_cnt,
    item.dondaful_combo_cnt,
    item.update_datetime || item.highscore_datetime || ''
  ]));
}

const handleAnalyze = () => {
  if (!scoreInput.value.trim()) {
    showModal('请输入数据', '提示')
    return
  }

  const input = scoreInput.value.trim();
  let output = tryParseTaikoScoreGetter(input);
  if (!output) {
    output = tryParseDonderTool(input);
  }
  if (!output) {
    // 既不是旧格式也不是新格式，忽略解析
    showModal('数据格式不正确', '错误')
    return
  }

  anyalyze(output)
}

const anyalyze = (input: string) => {
  // 将数据存储到 localStorage
  localStorage.setItem('taikoScoreData', input)
  // 触发自定义事件以通知其他组件
  window.dispatchEvent(new Event('localStorageUpdate'))
  // 导航到报告页面
  router.push('/report')
}
</script>

<template>
  <div class="bg-white shadow-[0_4px_6px_rgba(0,0,0,0.1)] mx-auto p-[30px] rounded-[10px] max-w-[800px]">
    <section class="bg-[#f8f9fa] mb-6 p-5 border border-[#e0e0e0] border-l-[#2196f3] border-l-4 rounded-md text-[#333]">
      <p class="my-1">算法更新时间: 2025/12/11</p>
      <p class="my-1">网页更新时间: 2025/12/13</p>
      <p class="my-1">曲目列表页面点击歌曲可以修改成绩，右下角菜单按钮可以加入我们的QQ群</p>
      <p class="my-1">本 Rating 系统旨在分析自身弱点并针对练习, 请勿用于攀比</p>
    </section>
    <section>
      <!-- 新的向导 -->
      <transition name="fade">
        <div v-show="showWizard" class="bg-gradient-to-br from-[#546e7a] to-[#37474f] shadow-[0_10px_25px_rgba(84,110,122,0.3)] my-8 p-10 rounded-xl text-center">
          <div class="flex flex-col items-center gap-5">
            <!-- 步骤1：绑定广场ID -->
            <div v-if="wizardStep === 1" class="flex flex-col items-center gap-4 w-full">
              <p class="m-0 font-medium text-white text-lg">欢迎使用太鼓达人 Rating 分析系统！</p>
              <p class="m-0 text-white/90 text-sm">请先绑定您的鼓众广场 ID</p>
              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0 sm:focus-within:shadow-[0_0_0_3px_rgba(255,255,255,0.3)] sm:rounded-lg w-full max-w-[500px] transition-all duration-300">
                <input 
                  v-model="inputDonderId" 
                  type="text" 
                  placeholder="请输入广场 ID"
                  class="box-border flex-1 bg-white/95 focus:bg-white px-4 py-3 border-2 border-white/30 focus:border-white/30 sm:border-r-0 rounded-lg sm:rounded-l-lg sm:rounded-r-none focus:outline-none h-12 text-[#333] placeholder:text-[#999] text-base transition-all duration-300"
                  @keyup.enter="bindDonderId"
                />
                <button @click="bindDonderId" class="box-border flex items-center justify-center bg-[#607d8b] hover:bg-[#546e7a] active:bg-[#455a64] disabled:opacity-70 shadow-[0_4px_15px_rgba(96,125,139,0.3)] hover:shadow-[0_6px_20px_rgba(96,125,139,0.4)] px-6 border-none rounded-lg sm:rounded-r-lg sm:rounded-l-none h-12 font-semibold text-white text-base whitespace-nowrap transition-all duration-300 cursor-pointer disabled:cursor-not-allowed">绑定广场 ID →</button>
              </div>
            </div>

            <!-- 步骤2：同步并分析数据 -->
            <div v-else-if="wizardStep === 2" class="flex flex-col items-center gap-4 w-full">
              <div class="flex flex-wrap justify-center items-center gap-3 bg-white/15 px-5 py-3 rounded-lg">
                <span class="text-white/90 text-sm">您的广场 ID：</span>
                <span class="font-semibold text-white text-lg">{{ donderId }}</span>
                <button @click="rebindDonderId" class="bg-white/20 hover:bg-white/30 px-4 py-1.5 border border-white/50 rounded-md font-medium text-white text-sm transition-all duration-300 cursor-pointer">重新绑定</button>
              </div>
              <p class="m-0 max-w-[500px] text-white/95 text-sm text-left leading-relaxed">
                1. 请先前往 <a href="https://donder-tool.llx.life/score" class="font-semibold text-white underline hover:no-underline" target="_blank">Donder 查分器</a>，绑定自己的鼓众广场 ID，并同步你的成绩。
                <br />
                2. 请确保你在查分器中的成绩数据是最新的，否则分析结果可能不准确。
                <br />
                3. 完成上述操作后，您可以选择用如下方式同步你的成绩：
                <br />
                &nbsp;· 如果您想使用自动同步功能，请确保查分器的 <b>公开成绩</b> 选项已开启，然后点击下方 “分析数据” 按钮自动同步分析数据。
                <br />
                &nbsp;· 如果您不想在查分器中公开自己的成绩，请在查分器中导出成绩，然后点击上传成绩按钮手动导入成绩。
              </p>
              <div class="flex flex-col sm:flex-row gap-3 justify-center">
              <button 
                @click="handleUpload" 
                :disabled="isLoading"
                class="bg-white disabled:opacity-70 shadow-[0_4px_15px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] px-8 py-3 border-none rounded-lg min-w-[160px] font-semibold text-[#546e7a] text-base transition-all hover:translate-y-[-2px] active:translate-y-0 duration-300 cursor-pointer disabled:cursor-not-allowed"
              >
                {{ isLoading ? '正在分析...' : '上传成绩并分析数据' }}
              </button>
              <button 
                @click="fetchAndAnalyze" 
                :disabled="isLoading"
                class="bg-white disabled:opacity-70 shadow-[0_4px_15px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] px-8 py-3 border-none rounded-lg min-w-[160px] font-semibold text-[#546e7a] text-base transition-all hover:translate-y-[-2px] active:translate-y-0 duration-300 cursor-pointer disabled:cursor-not-allowed"
              >
                {{ isLoading ? '正在分析...' : '同步成绩并分析数据' }}
              </button>
              </div>
              <p class="m-0 max-w-[500px] text-white/95 text-sm text-center leading-relaxed">如果自动同步分析数据遇到问题，您可以尝试<button @click="handleManualImport" class="bg-transparent px-4 py-2 border-none text-white/90 hover:text-white text-sm underline transition-all duration-300 cursor-pointer">手动导入成绩</button></p>
            </div>
          </div>
        </div>
      </transition>
      
      <!-- 原有的使用指南内容 -->
      <transition name="fade">
        <div v-show="showGuideContent">
          <div class="flex justify-between items-center mb-4">
            <h2 class="m-0 font-bold text-[#333]">手动导入成绩</h2>
            <button 
              @click="backToWizard" 
              class="bg-[#607d8b] hover:bg-[#546e7a] px-4 py-2 border-none rounded-lg font-medium text-white text-sm transition-all duration-300 cursor-pointer"
            >
              ← 返回
            </button>
          </div>
            <p class="my-2.5 leading-relaxed">1. 须使用 Windows 系统</p>
            <p class="my-2.5 leading-relaxed">2. 启动传分器, 按照指引打开电脑端广场爬分, 直到传分器走到在 DonNote 点击上传按钮之前的一步(不需要打开 DonNote, 更不需要点击上传按钮)</p>
            <p class="my-2.5 leading-relaxed">3. 将浏览器代理设置到系统代理,打开 <a href="https://www.baidu.com/api/ahfsdafbaqwerhue" target="_blank" class="text-primary hover:underline no-underline">获取成绩</a>, 传分器会将分数传到页面中, ctrl + a 全选复制过来粘贴</p>
            <p class="my-2.5 leading-relaxed">4. 如果不会设置浏览器代理, 按 win 键搜索 PowerShell, 将以下代码粘贴并回车执行 <a href="javascript:void(0);" @click="copyPowerShellCode" class="text-primary hover:underline no-underline">点我复制代码</a></p>
            <div class="bg-[#f5f5f5] my-[15px] px-5 py-[15px] border-primary border-l-4 rounded-lg">
            <p class="m-0 mb-2.5 font-bold text-[#333]">传分器链接:</p>
            <ul class="m-0 p-0 list-none">
              <li class="before:left-0 before:absolute relative py-2 pl-5 before:font-bold before:text-primary before:content-['▸']"><a href="https://gitee.com/donnote/taiko-score-getter/releases/tag/latest" target="_blank" class="text-[15px] text-primary hover:text-primary-dark no-underline hover:no-underline transition-colors">旧版@Gitee donnote/taiko-score-getter</a></li>
              <li class="before:left-0 before:absolute relative py-2 pl-5 before:font-bold before:text-primary before:content-['▸']"><a href="https://github.com/Steve-xmh/taiko-score-getter-rs/releases/tag/v0.1.2" target="_blank" class="text-[15px] text-primary hover:text-primary-dark no-underline hover:no-underline transition-colors">新版@GitHub Steve-xmh/taiko-score-getter-rs</a></li>
              <li class="before:left-0 before:absolute relative py-2 pl-5 before:font-bold before:text-primary before:content-['▸']"><a href="https://github.com/Steve-xmh/taiko-score-getter-rs/releases/latest/download/taiko-score-getter.exe" target="_blank" class="text-[15px] text-primary hover:text-primary-dark no-underline hover:no-underline transition-colors">点我下载新版传分器</a></li>
              <li class="before:left-0 before:absolute relative py-2 pl-5 before:font-bold before:text-primary before:content-['▸']"><a href="https://ghproxy.vanillaaaa.org/https://github.com/Steve-xmh/taiko-score-getter-rs/releases/latest/download/taiko-score-getter.exe" target="_blank" class="text-[15px] text-primary hover:text-primary-dark no-underline hover:no-underline transition-colors">点我使用代理下载新版传分器，大部分时间不用翻墙</a></li>
            </ul>
          </div>
        </div>
      </transition>
      
    </section>
    <transition name="fade">
      <div v-show="showGuideContent" class="my-5">
        <div class="flex flex-wrap gap-2 mb-2">
          <button @click="handleUpload" class="bg-[#2196f3] hover:bg-[#1976d2] px-2 py-1 border-none rounded text-white text-sm whitespace-nowrap transition-colors cursor-pointer">📁 上传文件</button>
          <button @click="handlePaste" class="bg-[#2196f3] hover:bg-[#1976d2] px-2 py-1 border-none rounded text-white text-sm whitespace-nowrap transition-colors cursor-pointer">📋 粘贴数据</button>
        </div>
        <textarea 
          v-model="scoreInput" 
          rows="4" 
          placeholder="请输入数据"
          class="box-border p-2.5 border border-[#ddd] rounded w-full font-mono resize-none"
        ></textarea>
      </div>
    </transition>
    <transition name="fade">
      <button v-show="showGuideContent" @click="handleAnalyze" class="bg-primary hover:bg-primary-dark p-3 border-none rounded w-full text-white text-base transition-colors cursor-pointer">分析数据</button>
    </transition>
  </div>
</template>

<style scoped>
.fade-enter-active {
  transition: opacity 0.3s;
}
.fade-leave-active {
  transition: opacity 0s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
