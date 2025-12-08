// 提取songs.json的脚本
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

try {
  const htmlContent = readFileSync(join(__dirname, '太鼓六维计算器（自动填分版）_12.08.html'), 'utf-8')
  
  // 查找JSON数据的起始和结束位置
  const startMarker = 'return JSON.parse(`{'
  const endMarker = '}`);'
  
  const startIndex = htmlContent.indexOf(startMarker)
  const endIndex = htmlContent.indexOf(endMarker, startIndex)
  
  if (startIndex === -1 || endIndex === -1) {
    throw new Error('无法找到songs数据')
  }
  
  // 提取JSON字符串
  const jsonStart = startIndex + startMarker.length - 1
  const jsonString = htmlContent.substring(jsonStart, endIndex + 1)
  
  // 验证并格式化JSON
  const songsData = JSON.parse(jsonString)
  
  // 写入到public目录
  writeFileSync(
    join(__dirname, 'public', 'songs.json'),
    JSON.stringify(songsData, null, 2),
    'utf-8'
  )
  
  console.log('✅ songs.json 提取成功!')
  console.log(`📊 包含 ${Object.keys(songsData).length} 首歌曲`)
} catch (error) {
  console.error('❌ 提取失败:', error)
  process.exit(1)
}
