import { createApp } from 'vue'
import { inject } from '@vercel/analytics'
import './style.css'
import '@fortawesome/fontawesome-free/css/all.css'
import App from './App.vue'
import router from './router'
import i18n from './i18n'

inject()

const app = createApp(App)
app.use(router)
app.use(i18n)
app.mount('#app')
