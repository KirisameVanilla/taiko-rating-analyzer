<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const scoreInput = ref('')

const copyPowerShellCode = () => {
  const text = `$content = (iwr "https://www.baidu.com/api/ahfsdafbaqwerhue").Content; $content | Set-Clipboard; Write-Host "内容已复制到剪贴板！长度为: $($content.Length)" -ForegroundColor Green`
  navigator.clipboard.writeText(text).then(() => {
    alert('PowerShell 代码已复制到剪贴板！')
  }).catch(err => {
    console.error('复制失败:', err)
  })
}

const handleAnalyze = () => {
  if (!scoreInput.value.trim()) {
    alert('请输入数据')
    return
  }
  // 将数据存储到 localStorage
  localStorage.setItem('taikoScoreData', scoreInput.value)
  // 导航到报告页面
  router.push('/report')
}
</script>

<template>
  <div class="container">
    <h6>更新时间:2025/12/05</h6>
    <h6>算法仍在调整中</h6>
    <h6>本Rating系统旨在分析自身弱点并针对练习,请勿用于攀比</h6>
    <h2>使用指南</h2>
    <p>1. 启动传分器,按照指引打开电脑端广场爬分,直到传分器走到在DonNote点击上传按钮之前的一步(不需要打开donnote,更不需要点击上传按钮)</p>
    <p>2. 将浏览器代理设置到系统代理,打开<a href="https://www.baidu.com/api/ahfsdafbaqwerhue" target="_blank">baidu</a>,传分器会将分数传到页面中,ctrl+a全选复制过来粘贴</p>
    <p>3. 如果不会设置浏览器代理,按win键搜索PowerShell,将以下代码粘贴并回车执行,会把数据复制到你的剪贴板。<a href="javascript:void(0);" @click="copyPowerShellCode">复制代码</a></p>
    <p>传分器链接:
      <a href="https://gitee.com/donnote/taiko-score-getter/releases/tag/latest" target="_blank">旧版</a>,
      <a href="https://github.com/Steve-xmh/taiko-score-getter-rs/releases/tag/v0.1.2" target="_blank">新版(gitee 的失效了,github 的可能需要翻墙)</a>
    </p>
    <textarea 
      v-model="scoreInput" 
      rows="4" 
      placeholder="请输入数据"
    ></textarea>
    <button @click="handleAnalyze">分析数据</button>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

h2 {
  text-align: center;
  color: #333;
}

h6 {
  text-align: center;
  color: #888;
  margin: 10px 0;
}

p {
  margin: 10px 0;
  line-height: 1.6;
}

a {
  color: #e91e63;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
  margin: 20px 0;
  box-sizing: border-box;
}

button {
  width: 100%;
  padding: 12px;
  background: #e91e63;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.3s;
}

button:hover {
  background: #c2185b;
}
</style>
