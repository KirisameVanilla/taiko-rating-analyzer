import { createI18n } from 'vue-i18n';
import zh from './locales/zh.json';
import en from './locales/en.json';

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: localStorage.getItem('lang') || 'zh', // 默认语言
  fallbackLocale: 'en', // 回退语言
  messages: {
    zh,
    en
  }
});

export default i18n;
