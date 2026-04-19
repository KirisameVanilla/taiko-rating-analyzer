<script setup lang="ts">
import { useModal } from '@composables/useModal'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { LockedScores } from '@/types'
import { useScoreStore } from '@/store/scoreStore'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const scoreInput = ref('')
const { showModal } = useModal()

// Tab 切换
const activeTab = ref<'sync' | 'manual' | 'sakura'>('sync')
const transitionName = ref('slide-left')

const tabOrder = ['sync', 'manual', 'sakura'] as const

const switchTab = (tab: 'sync' | 'manual' | 'sakura') => {
  if (tab === activeTab.value) return
  const oldIndex = tabOrder.indexOf(activeTab.value)
  const newIndex = tabOrder.indexOf(tab)
  transitionName.value = newIndex > oldIndex ? 'slide-left' : 'slide-right'
  activeTab.value = tab
}

// 自动同步相关状态
const savedDonderId = localStorage.getItem('donderId') || ''
const donderId = ref(savedDonderId)
const isLoading = ref(false)

// 从Donder查分器获取数据并分析
const fetchAndAnalyze = async () => {
  const id = donderId.value.trim()
  if (!id) {
    showModal('请输入广场 ID', '提示')
    return
  }
  if (!/^\d+$/.test(id)) {
    showModal('广场 ID 必须是数字', '错误')
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
      showModal(t('guide.errors.formatError'), '分析失败')
      isLoading.value = false
      return
    }

    anyalyze(output)
  } catch (error: any) {
    showModal(error.message || t('guide.errors.syncFailed'), '分析失败')
    isLoading.value = false
  }
}

// Sakura Bot 导入相关状态
const savedSakuraToken = localStorage.getItem('sakuraToken') || ''
const sakuraToken = ref(savedSakuraToken)
const isSakuraLoading = ref(false)

const fetchSakuraAndAnalyze = async () => {
  const token = sakuraToken.value.trim()
  if (!token) {
    showModal('请输入 Token', '提示')
    return
  }

  localStorage.setItem('sakuraToken', token)

  isSakuraLoading.value = true

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
      showModal('未找到成绩数据，请确认 Token 是否有效以及 Bot 是否已同步成绩。', '分析失败')
      isSakuraLoading.value = false
      return
    }

    const output = tryParseOfficialData(songs)

    if (!output) {
      showModal('成绩数据格式不正确', '分析失败')
      isSakuraLoading.value = false
      return
    }

    anyalyze(output)
  } catch (error: any) {
    showModal(error.message || '同步数据失败', '同步失败')
    isSakuraLoading.value = false
  }
}

// 组件挂载时初始化（不再需要向导初始化）

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
          showModal(t('guide.errors.formatError'), '错误')
          return
        }
        anyalyze(output)
        // scoreInput.value = text
        // showModal('文件内容已粘贴到文本框！')
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          showModal(t('guide.errors.readFailed'), '错误')
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
  } catch (e) { }
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
function tryParseDonderHiroba(input: string): string | null {
  let parsed: any;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    return null;
  }

  const isLegacyItem = (obj: any) => {
    return obj && typeof obj === 'object' && 'songNo' in obj && 'difficulty' in obj && 'score' in obj;
  };

  // 新格式：{ "21": { songNo: "21", difficulty: { oni: {...}, easy: {...} } } }
  const isGroupedItem = (obj: any) => {
    return obj && typeof obj === 'object' && 'songNo' in obj && 'difficulty' in obj && typeof obj.difficulty === 'object';
  };

  let rawItems: any[] = [];
  if (Array.isArray(parsed)) {
    rawItems = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (isLegacyItem(parsed) || isGroupedItem(parsed)) {
      rawItems = [parsed];
    } else {
      rawItems = Object.entries(parsed).map(([songNo, item]: [string, any]) => {
        if (item && typeof item === 'object' && !('songNo' in item)) {
          return { ...item, songNo };
        }
        return item;
      });
    }
  }

  if (rawItems.length === 0) return null;

  // 难度映射
  const difficultyMap: { [key: string]: number } = {
    'easy': 1,
    'normal': 2,
    'hard': 3,
    'oni': 4,
    'ura': 5
  };

  const rows: any[] = [];

  const pushRow = (songNo: any, difficultyName: string, scoreData: any) => {
    rows.push([
      songNo,
      difficultyMap[difficultyName] ?? 4,
      scoreData?.score ?? 0,
      scoreData?.badge ?? '',
      scoreData?.good ?? 0,
      scoreData?.ok ?? 0,
      scoreData?.bad ?? 0,
      scoreData?.roll ?? 0,
      scoreData?.maxCombo ?? 0,
      scoreData?.count?.play ?? 0,
      scoreData?.count?.clear ?? 0,
      (scoreData?.count?.fullcombo ?? 0) > 0,
      (scoreData?.count?.donderfullcombo ?? 0) > 0,
      ''
    ]);
  };

  for (const item of rawItems) {
    if (isLegacyItem(item)) {
      pushRow(item.songNo, item.difficulty, item.score);
      continue;
    }

    if (isGroupedItem(item)) {
      for (const [difficultyName, difficultyData] of Object.entries(item.difficulty || {})) {
        const scoreData = (difficultyData as any)?.score && typeof (difficultyData as any).score === 'object'
          ? (difficultyData as any).score
          : difficultyData;
        if (scoreData && typeof scoreData === 'object') {
          pushRow(item.songNo, difficultyName, scoreData);
        }
      }
    }
  }

  if (rows.length === 0) return null;
  return JSON.stringify(rows);
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
  return tryParseOfficialData(parsed);
}

/* 尝试官方格式
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
function tryParseOfficialData(data: any): string | null {
  const isNewFormat = (obj: any) => {
    return obj && typeof obj === 'object' && (
      (Array.isArray(obj) && obj.length > 0 && obj[0] && typeof obj[0] === 'object' && 'song_no' in obj[0]) ||
      (!Array.isArray(obj) && 'song_no' in obj)
    );
  };
  if (!isNewFormat(data)) return null;
  let arr = Array.isArray(data) ? data : [data];
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

  // 保存旧数据到 lastTaikoScore（仅当新数据与当前数据不同时）
  const currentScoreData = localStorage.getItem('taikoScoreData')
  if (currentScoreData && currentScoreData !== input) {
    localStorage.setItem('lastTaikoScore', currentScoreData)
  }

  // 将数据存储到 localStorage
  localStorage.setItem('taikoScoreData', input)

  // 触发 store 更新
  const store = useScoreStore()
  await store.init(true)

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
          <p class="m-0 text-[#86868B] text-sm">{{ t('guide.disclaimer') }}</p>
        </div>
      </div>
    </section>

    <section class="bg-white/70 shadow-sm backdrop-blur-xl my-8 border border-white/20 rounded-[32px] overflow-hidden">
      <!-- Tab 栏 -->
      <div class="relative flex border-black/5 border-b">
        <div class="bottom-0 absolute bg-[#007AFF] rounded-full h-0.5 transition-all duration-300 ease-out" :style="{
          left: tabOrder.indexOf(activeTab) * 33.333 + '%',
          width: '33.333%'
        }" />
        <button @click="switchTab('sync')"
          class="z-10 relative flex-1 py-4 border-none font-semibold text-sm transition-colors duration-200 cursor-pointer"
          :class="activeTab === 'sync' ? 'text-[#007AFF]' : 'text-[#86868B] hover:text-[#1D1D1F]'">
          <i class="mr-2 fa-solid fa-arrows-rotate"></i>{{ t('guide.syncTitle') }}
        </button>
        <button @click="switchTab('manual')"
          class="z-10 relative flex-1 py-4 border-none font-semibold text-sm transition-colors duration-200 cursor-pointer"
          :class="activeTab === 'manual' ? 'text-[#007AFF]' : 'text-[#86868B] hover:text-[#1D1D1F]'">
          <i class="mr-2 fa-solid fa-file-import"></i>{{ t('guide.manualTitle') }}
        </button>
        <button @click="switchTab('sakura')"
          class="z-10 relative flex-1 py-4 border-none font-semibold text-sm transition-colors duration-200 cursor-pointer"
          :class="activeTab === 'sakura' ? 'text-[#007AFF]' : 'text-[#86868B] hover:text-[#1D1D1F]'">
          <i class="mr-2 fa-solid fa-robot"></i>{{ t('guide.sakuraTitle') }}
        </button>
      </div>

      <!-- Tab 内容区域 -->
      <Transition :name="transitionName" mode="out-in">
        <!-- 自动同步 -->
        <div v-if="activeTab === 'sync'" key="sync" class="p-10 text-left">
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

        <!-- 手动导入成绩 -->
        <div v-else-if="activeTab === 'manual'" key="manual" class="p-8 text-left">
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

        <!-- Sakura Bot 导入 -->
        <div v-else key="sakura" class="p-10 text-left">
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
              <button @click="fetchSakuraAndAnalyze" :disabled="isSakuraLoading"
                class="bg-[#007AFF] hover:bg-[#0071E3] disabled:opacity-50 shadow-[#007AFF]/20 shadow-lg py-4 border-none rounded-2xl w-full font-bold text-white text-lg active:scale-[0.98] transition-all cursor-pointer">
                <i v-if="isSakuraLoading" class="mr-2 fa-solid fa-circle-notch fa-spin"></i>
                {{ isSakuraLoading ? t('report.calculating') : t('guide.sakuraBtnImport') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </section>
  </div>
</template>

<style scoped>
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

/* sync → manual: 旧内容向左滑出，新内容从右滑入 */
.slide-left-leave-to {
  transform: translateX(-30px);
  opacity: 0;
}

.slide-left-enter-from {
  transform: translateX(30px);
  opacity: 0;
}

/* manual → sync: 旧内容向右滑出，新内容从左滑入 */
.slide-right-leave-to {
  transform: translateX(30px);
  opacity: 0;
}

.slide-right-enter-from {
  transform: translateX(-30px);
  opacity: 0;
}
</style>
