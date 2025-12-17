<script setup lang="ts">
import { eventBus } from '@utils/eventBus'

function openAnnouncement() {
  eventBus.emit('open-announcement')
}
</script>

<template>
  <button 
    class="right-8 bottom-24 z-[999] fixed flex justify-center items-center bg-white/70 shadow-lg backdrop-blur-xl border border-white/20 rounded-full w-14 h-14 text-[#007AFF] text-xl hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer" 
    @click="openAnnouncement"
    title="公告"
  >
    <i class="fa-solid fa-bullhorn"></i>
  </button>
</template>
