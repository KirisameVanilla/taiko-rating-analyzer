<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useModal } from '../composables/useModal'
import './GuideView.css'

const router = useRouter()
const scoreInput = ref('')
const { showModal } = useModal()

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

const handleAnalyze = () => {
  if (!scoreInput.value.trim()) {
    showModal('请输入数据', '提示')
    return
  }
  // 将数据存储到 localStorage
  localStorage.setItem('taikoScoreData', scoreInput.value)
  // 触发自定义事件以通知其他组件
  window.dispatchEvent(new Event('localStorageUpdate'))
  // 导航到报告页面
  router.push('/report')
}
</script>

<template>
  <div class="container">
    <h6>算法更新时间: 2025/12/08</h6>
    <h6>网页更新时间: 2025/12/10</h6>
    <h6>曲目列表页面点击歌曲可以修改成绩，右下角菜单按钮可以加入我们的QQ群</h6>
    <h6>本 Rating 系统旨在分析自身弱点并针对练习, 请勿用于攀比</h6>
    <h2>使用指南(需要使用电脑)</h2>
    <p>1. 启动传分器, 按照指引打开电脑端广场爬分, 直到传分器走到在 DonNote 点击上传按钮之前的一步(不需要打开 DonNote, 更不需要点击上传按钮)</p>
    <p>2. 将浏览器代理设置到系统代理,打开 <a href="https://www.baidu.com/api/ahfsdafbaqwerhue" target="_blank">获取成绩</a>, 传分器会将分数传到页面中, ctrl + a 全选复制过来粘贴</p>
    <p>3. 如果不会设置浏览器代理, 按 win 键搜索 PowerShell, 将以下代码粘贴并回车执行 <a href="javascript:void(0);" @click="copyPowerShellCode">点我复制代码</a></p>
    <div class="links-section">
      <p class="links-title">传分器链接:</p>
      <ul class="links-list">
        <li><a href="https://gitee.com/donnote/taiko-score-getter/releases/tag/latest" target="_blank">旧版@Gitee donnote/taiko-score-getter</a></li>
        <li><a href="https://github.com/Steve-xmh/taiko-score-getter-rs/releases/tag/v0.1.2" target="_blank">新版@GitHub Steve-xmh/taiko-score-getter-rs</a></li>
        <li><a href="https://github.com/Steve-xmh/taiko-score-getter-rs/releases/latest/download/taiko-score-getter.exe" target="_blank">点我下载新版传分器</a></li>
        <li><a href="https://ghproxy.vanillaaaa.org/https://github.com/Steve-xmh/taiko-score-getter-rs/releases/latest/download/taiko-score-getter.exe" target="_blank">点我使用代理下载新版传分器，大部分时间不用翻墙</a></li>
      </ul>
    </div>
    <div class="textarea-container">
      <textarea 
        v-model="scoreInput" 
        rows="4" 
        placeholder="请输入数据"
      ></textarea>
      <button @click="handlePaste" class="paste-btn-inside">粘贴</button>
    </div>
    <button @click="handleAnalyze" class="analyze-btn">分析数据</button>
  </div>
</template>
