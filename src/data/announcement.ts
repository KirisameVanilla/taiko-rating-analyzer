import { Announcement } from "@/types"
import { ref } from "vue"

const ANNOUNCEMENT_VERSION = 'announcement-v1-2025-12-17'

const announcements = ref<Announcement[]>([
  { 
    id: 1, 
    text: '建议使用新网址: <a href="https://rating.ourtaiko.org/" class="font-bold text-cyan-400 hover:text-cyan-300 decoration-2 underline underline-offset-4 transition-colors" target="_blank">rating.ourtaiko.org</a>', 
    type: 'info',
    date: '2025-12-16'
  },
  {
    id: 2,
    text: '有网页功能上的建议或问题可以通过群聊<b>@</b>我反馈，或者在GitHub开issue免得我忘记',
    type: 'info',
    date: '2025-12-17'
  },
  { 
    id: 299, 
    text: '域名 ourtaiko.org 免费提供, 有需要可以通过 GitHub 或者群聊联系我', 
    type: 'success',
    date: '2025-12-16'
  },
  { 
    id: 300, 
    text: '广告位招租', 
    type: 'warning',
    date: '2354-01-01'
  }
])

export { ANNOUNCEMENT_VERSION, announcements }