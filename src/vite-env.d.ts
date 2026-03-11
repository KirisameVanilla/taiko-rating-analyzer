/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.css' {
  const content: string
  export default content
}

declare module 'chartjs-plugin-datalabels' {
  import { Plugin } from 'chart.js'
  const plugin: Plugin
  export default plugin
}

declare module '*.json' {
  const value: any
  export default value
}
