<script setup lang="ts">
import { useModal } from '@composables/useModal'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { LockedScores } from '@/types'
import { useScoreStore } from '@/store/scoreStore'

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
        const output = tryParseTaikoScoreGetter(text) || tryParseDonderTool(text) || tryParseDonderHiroba(text)
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

/* 尝试解析国际服 Donder Hiroba 抓分器格式
  schema: {
    songName: string,
    difficulty: string,
    score: {
      crown: string,
      badge: string,
      score: number,
      ranking: number,
      good: number,
      maxCombo: number,
      ok: number,
      roll: number,
      bad: number,
      count: {
        play: number,
        clear: number,
        fullcombo: number,
        donderfullcombo: number
      }
    },
    songNo: string
  }
*/
function tryParseDonderHiroba (input: string): string | null {
  let parsed: any;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    return null;
  }

  // 检查是否为 Donder Hiroba 格式
  const isDonderHirobaFormat = (obj: any) => {
    return obj && typeof obj === 'object' && (
      (Array.isArray(obj) && obj.length > 0 && obj[0] && typeof obj[0] === 'object' && 'songNo' in obj[0] && 'difficulty' in obj[0] && 'score' in obj[0]) ||
      (!Array.isArray(obj) && 'songNo' in obj && 'difficulty' in obj && 'score' in obj)
    );
  };

  if (!isDonderHirobaFormat(parsed)) return null;

  // 难度映射
  const difficultyMap: { [key: string]: number } = {
    'easy': 1,
    'normal': 2,
    'hard': 3,
    'oni': 4,
    'ura': 5
  };

  let arr = Array.isArray(parsed) ? parsed : [parsed];
  
  return JSON.stringify(arr.map((item: any) => [
    item.songNo,
    difficultyMap[item.difficulty] ?? 4,
    item.score?.score ?? 0,
    item.score?.badge ?? '',
    item.score?.good ?? 0,
    item.score?.ok ?? 0,
    item.score?.bad ?? 0,
    item.score?.roll ?? 0,
    item.score?.maxCombo ?? 0,
    item.score?.count?.play ?? 0,
    item.score?.count?.clear ?? 0,
    (item.score?.count?.fullcombo ?? 0) > 0,
    (item.score?.count?.donderfullcombo ?? 0) > 0,
    ''
  ]));
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
  let output = tryParseTaikoScoreGetter(input) || tryParseDonderHiroba(input);
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

const restoreLockedScores = (scoreData: any[]) => {
  try {
    const lockedDataStr = localStorage.getItem('taiko-locked-songs')
    if (!lockedDataStr) return scoreData

    const lockedData: LockedScores = JSON.parse(lockedDataStr)
    const lockedKeys = Object.keys(lockedData)
    if (lockedKeys.length === 0) return scoreData

    for (const key in lockedData) {
      const lockedScore = lockedData[key]
      const [songId, level] = key.split('-').map(Number)
      
      const index = scoreData.findIndex((item: any[]) => Number(item[0]) === songId && Number(item[1]) === level)
      
      // Schema: [song_no, level, high_score, best_score_rank, good_cnt, ok_cnt, ng_cnt, pound_cnt, combo_cnt, stage_cnt, clear_cnt, full_combo_cnt, dondaful_combo_cnt, update_datetime]
      const newEntry = [
        lockedScore.id,
        lockedScore.level,
        lockedScore.score,
        lockedScore.scoreRank,
        lockedScore.great,
        lockedScore.good,
        lockedScore.bad,
        lockedScore.drumroll,
        lockedScore.combo,
        lockedScore.playCount,
        lockedScore.clearCount,
        lockedScore.fullcomboCount,
        lockedScore.perfectCount,
        lockedScore.updatedAt
      ]
      
      if (index !== -1) {
        scoreData[index] = newEntry
      } else {
        scoreData.push(newEntry)
      }
    }
  } catch (e) {
    console.error('Failed to restore locked scores', e)
  }
  return scoreData
}


const anyalyze = async (input: string) => {
  let scoreData: any[] = []
  try {
    scoreData = JSON.parse(input)
    if (Array.isArray(scoreData)) {
      scoreData = restoreLockedScores(scoreData)
      input = JSON.stringify(scoreData)
    }
  } catch (e) {
    console.error('Failed to parse input for analysis', e)
  }

  // 保存旧数据到 lastTaikoScore
  const currentScoreData = localStorage.getItem('taikoScoreData')
  if (currentScoreData) {
    localStorage.setItem('lastTaikoScore', currentScoreData)
  }

  // 将数据存储到 localStorage
  localStorage.setItem('taikoScoreData', input)
  
  // 触发 store 更新
  const store = useScoreStore()
  await store.init()
  
  // 触发自定义事件以通知其他组件
  window.dispatchEvent(new Event('localStorageUpdate'))
  // 导航到报告页面
  router.push('/report')
}
</script>

<template>
  <div class="mx-auto max-w-[800px]">
    <!-- 顶部提示卡片 -->
    <section class="bg-white/70 shadow-sm backdrop-blur-xl mb-6 p-6 border border-white/20 rounded-[24px]">
      <div class="flex items-start gap-4">
        <div class="bg-[#007AFF]/10 p-2 rounded-full">
          <i class="text-[#007AFF] fa-solid fa-circle-info"></i>
        </div>
        <div class="space-y-2">
          <p class="m-0 font-medium text-[#1D1D1F]">曲目列表页面点击歌曲可以修改成绩，右下角菜单按钮可以加入我们的 QQ 群</p>
          <p class="m-0 text-[#86868B] text-sm">本 Rating 系统旨在分析自身弱点并针对练习，请勿用于攀比</p>
        </div>
      </div>
    </section>

    <section>
      <!-- 新的向导 -->
      <transition name="fade">
        <div v-show="showWizard" class="bg-white/70 shadow-sm backdrop-blur-xl my-8 p-10 border border-white/20 rounded-[32px] text-center">
          <div class="flex flex-col items-center gap-6">
            <!-- 步骤1：绑定广场ID -->
            <div v-if="wizardStep === 1" class="flex flex-col items-center gap-6 w-full">
              <div class="space-y-2">
                <h2 class="m-0 font-bold text-[#1D1D1F] text-2xl">欢迎使用太鼓达人 Rating 分析系统</h2>
                <p class="m-0 text-[#86868B]">请先绑定您的鼓众广场 ID</p>
              </div>
              
              <div class="flex flex-col items-center gap-4 w-full max-w-[460px]">
                <div class="relative w-full">
                  <input 
                    v-model="inputDonderId" 
                    type="text" 
                    placeholder="请输入广场 ID"
                    class="box-border bg-black/5 focus:bg-white px-6 py-4 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] text-lg text-center transition-all"
                    @keyup.enter="bindDonderId"
                  />
                </div>
                <button 
                  @click="bindDonderId" 
                  class="bg-[#007AFF] hover:bg-[#0071E3] shadow-[#007AFF]/20 shadow-lg py-4 border-none rounded-2xl w-full font-semibold text-white text-lg active:scale-[0.98] transition-all cursor-pointer"
                >
                  绑定广场 ID
                </button>
                <button 
                  @click="handleManualImport" 
                  class="bg-transparent px-6 py-2 border-none font-medium text-[#007AFF] hover:text-[#0071E3] text-sm transition-all cursor-pointer"
                >
                  我没有广场 ID，跳过并手动导入成绩
                </button>
              </div>
            </div>

            <!-- 步骤2：同步并分析数据 -->
            <div v-else-if="wizardStep === 2" class="flex flex-col items-center gap-8 w-full">
              <div class="flex flex-col items-center gap-3">
                <div class="bg-[#007AFF]/10 px-6 py-3 border border-[#007AFF]/20 rounded-full">
                  <span class="text-[#86868B] text-sm">您的广场 ID：</span>
                  <span class="ml-2 font-bold text-[#1D1D1F] text-xl">{{ donderId }}</span>
                </div>
                <button @click="rebindDonderId" class="bg-black/5 hover:bg-black/10 px-4 py-1.5 border-none rounded-full font-medium text-[#86868B] text-xs transition-all cursor-pointer">重新绑定</button>
              </div>

              <div class="gap-4 grid grid-cols-1 md:grid-cols-2 w-full text-left">
                <div class="space-y-3 bg-black/5 p-6 rounded-[24px]">
                  <div class="flex justify-center items-center bg-[#007AFF] rounded-full w-8 h-8 font-bold text-white text-sm">1</div>
                  <p class="text-[#1D1D1F] text-sm leading-relaxed">前往 <a href="https://donder-tool.llx.life/score" class="font-medium text-[#007AFF] hover:underline" target="_blank">Donder 查分器</a>，绑定 ID 并同步成绩。</p>
                </div>
                <div class="space-y-3 bg-black/5 p-6 rounded-[24px]">
                  <div class="flex justify-center items-center bg-[#007AFF] rounded-full w-8 h-8 font-bold text-white text-sm">2</div>
                  <p class="text-[#1D1D1F] text-sm leading-relaxed">确保查分器中的成绩数据是最新的，并开启 <b>公开成绩</b> 选项。若不想公开成绩请点击导出，并选择上传成绩。</p>
                </div>
              </div>

              <div class="flex sm:flex-row flex-col justify-center gap-4 w-full max-w-[500px]">
                <button 
                  @click="fetchAndAnalyze" 
                  :disabled="isLoading"
                  class="flex-1 bg-[#007AFF] hover:bg-[#0071E3] disabled:opacity-50 shadow-[#007AFF]/20 shadow-lg py-4 border-none rounded-2xl font-semibold text-white text-lg active:scale-[0.98] transition-all cursor-pointer"
                >
                  <i v-if="isLoading" class="mr-2 fa-solid fa-circle-notch fa-spin"></i>
                  {{ isLoading ? '正在分析...' : '同步成绩' }}
                </button>
                <button 
                  @click="handleUpload" 
                  :disabled="isLoading"
                  class="flex-1 bg-black/5 hover:bg-black/10 disabled:opacity-50 py-4 border-none rounded-2xl font-semibold text-[#1D1D1F] text-lg active:scale-[0.98] transition-all cursor-pointer"
                >
                  上传成绩
                </button>
              </div>
              
              <p class="m-0 text-[#86868B] text-sm">
                如果自动同步遇到问题，您可以尝试
                <button @click="handleManualImport" class="bg-transparent p-0 border-none font-medium text-[#007AFF] hover:underline cursor-pointer">手动导入成绩</button>
              </p>
            </div>
          </div>
        </div>
      </transition>
      
      <!-- 原有的使用指南内容 -->
      <transition name="fade">
        <div v-show="showGuideContent" class="bg-white/70 shadow-sm backdrop-blur-xl my-8 p-8 border border-white/20 rounded-[32px]">
          <div class="flex justify-between items-center mb-8">
            <h2 class="m-0 font-bold text-[#1D1D1F] text-2xl">手动导入成绩</h2>
            <button 
              @click="backToWizard" 
              class="bg-black/5 hover:bg-black/10 px-5 py-2 border-none rounded-full font-medium text-[#1D1D1F] text-sm transition-all cursor-pointer"
            >
              <i class="fa-chevron-left mr-1 fa-solid"></i> 返回
            </button>
          </div>

          <div class="space-y-6">
            <div class="space-y-4">
              <div class="flex gap-4">
                <div class="flex flex-shrink-0 justify-center items-center bg-black/5 rounded-full w-6 h-6 font-bold text-[#86868B] text-xs">1</div>
                <p class="m-0 text-[#1D1D1F]">须使用 Windows 或 MacOS 系统</p>
              </div>
              <div class="flex gap-4">
                <div class="flex flex-shrink-0 justify-center items-center bg-black/5 rounded-full w-6 h-6 font-bold text-[#86868B] text-xs">2</div>
                <p class="m-0 text-[#1D1D1F]">启动传分器，按照指引打开电脑端广场爬分，直到传分器走到在 DonNote 点击上传按钮之前的一步。</p>
              </div>
              <div class="flex gap-4">
                <div class="flex flex-shrink-0 justify-center items-center bg-black/5 rounded-full w-6 h-6 font-bold text-[#86868B] text-xs">3</div>
                <p class="m-0 text-[#1D1D1F]">
                  将浏览器代理设置到系统代理，打开 
                  <a href="https://www.baidu.com/api/ahfsdafbaqwerhue" target="_blank" class="font-medium text-[#007AFF] hover:underline">获取成绩</a>，
                  传分器会将分数传到页面中，全选复制过来粘贴。
                </p>
              </div>
              <div class="flex gap-4">
                <div class="flex flex-shrink-0 justify-center items-center bg-black/5 rounded-full w-6 h-6 font-bold text-[#86868B] text-xs">4</div>
                <p class="m-0 text-[#1D1D1F]">
                  如果不会设置浏览器代理，按 Win 键搜索 PowerShell，将以下代码粘贴并回车执行：
                  <button @click="copyPowerShellCode" class="bg-transparent p-0 border-none font-medium text-[#007AFF] hover:underline cursor-pointer">点我复制代码</button>
                </p>
              </div>
            </div>

            <div class="space-y-4 bg-black/5 p-6 rounded-[24px]">
              <p class="m-0 font-bold text-[#1D1D1F]">传分器下载:</p>
              <div class="gap-3 grid grid-cols-1">
                <a href="https://gitee.com/donnote/taiko-score-getter/releases/tag/latest" target="_blank" class="group flex items-center gap-3 bg-white/50 hover:bg-white p-3 rounded-xl text-[#1D1D1F] no-underline transition-all">
                  <i class="text-[#F05032] text-xl fa-brands fa-git-alt"></i>
                  <span class="flex-1 font-medium text-sm">旧版 @Gitee donnote/taiko-score-getter</span>
                  <i class="fa-chevron-right text-black/10 group-hover:text-black/30 transition-all fa-solid"></i>
                </a>
                <a href="https://github.com/Steve-xmh/taiko-score-getter-rs/releases/tag/v0.1.2" target="_blank" class="group flex items-center gap-3 bg-white/50 hover:bg-white p-3 rounded-xl text-[#1D1D1F] no-underline transition-all">
                  <i class="text-xl fa-brands fa-github"></i>
                  <span class="flex-1 font-medium text-sm">新版 @GitHub Steve-xmh/taiko-score-getter-rs</span>
                  <i class="fa-chevron-right text-black/10 group-hover:text-black/30 transition-all fa-solid"></i>
                </a>
                <a href="https://ghproxy.vanillaaaa.org/https://github.com/Steve-xmh/taiko-score-getter-rs/releases/latest/download/taiko-score-getter.exe" target="_blank" class="group flex items-center gap-3 bg-[#007AFF]/10 hover:bg-[#007AFF]/20 p-3 rounded-xl text-[#007AFF] no-underline transition-all">
                  <i class="text-xl fa-solid fa-download"></i>
                  <span class="flex-1 font-bold text-sm">点我下载新版传分器</span>
                  <i class="fa-chevron-right opacity-30 group-hover:opacity-100 transition-all fa-solid"></i>
                </a>
              </div>
            </div>

            <div class="space-y-4 pt-4">
              <div class="flex gap-2">
                <button @click="handleUpload" class="flex-1 bg-black/5 hover:bg-black/10 py-3 border-none rounded-xl font-medium text-[#1D1D1F] transition-all cursor-pointer">
                  <i class="mr-2 fa-regular fa-file"></i> 上传文件
                </button>
                <button @click="handlePaste" class="flex-1 bg-black/5 hover:bg-black/10 py-3 border-none rounded-xl font-medium text-[#1D1D1F] transition-all cursor-pointer">
                  <i class="mr-2 fa-regular fa-clipboard"></i> 粘贴数据
                </button>
              </div>
              <textarea 
                v-model="scoreInput" 
                rows="4" 
                placeholder="在此处粘贴数据..."
                class="box-border bg-black/5 focus:bg-white p-4 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full font-mono text-[#1D1D1F] transition-all resize-none"
              ></textarea>
              <button @click="handleAnalyze" class="bg-[#007AFF] hover:bg-[#0071E3] shadow-[#007AFF]/20 shadow-lg py-4 border-none rounded-2xl w-full font-bold text-white text-lg active:scale-[0.98] transition-all cursor-pointer">
                分析数据
              </button>
            </div>
          </div>
        </div>
      </transition>
    </section>
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
