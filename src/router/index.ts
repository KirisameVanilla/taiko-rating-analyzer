import { createRouter, createWebHistory } from 'vue-router'
import GuideView from '../components/GuideView.vue'
import ReportView from '../components/ReportView.vue'
import SongsView from '../components/SongsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: GuideView
    },
    {
      path: '/report',
      name: 'report',
      component: ReportView
    },
    {
      path: '/songs',
      name: 'songs',
      component: SongsView
    }
  ]
})

export default router
