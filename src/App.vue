<script setup lang="ts">
import NavigationBar from './components/NavigationBar.vue'
import AnnouncementModal from './components/AnnouncementModal.vue'
import AnnouncementButton from './components/AnnouncementButton.vue'
import Modal from './components/Modal.vue'
import FloatingMenu from './components/FloatingMenu.vue'
import { useModal } from './composables/useModal'
import { ref, onMounted, onUnmounted } from 'vue'
import { eventBus } from './utils/eventBus'
import { ANNOUNCEMENT_VERSION } from '@data/announcement'

const STORAGE_KEY = 'announcement-version'

const { modalState, hideModal } = useModal()
const showAnnouncementModal = ref(false)

const openAnnouncement = () => {
  showAnnouncementModal.value = true
}

const checkAndShowAnnouncement = () => {
  const savedVersion = localStorage.getItem(STORAGE_KEY)
  if (savedVersion !== ANNOUNCEMENT_VERSION) {
    showAnnouncementModal.value = true
  }
}

const updateAnnouncementVersion = () => {
  localStorage.setItem(STORAGE_KEY, ANNOUNCEMENT_VERSION)
}

onMounted(() => {
  eventBus.on('open-announcement', openAnnouncement)
  // 检查公告版本并自动打开
  checkAndShowAnnouncement()
})

onUnmounted(() => {
  eventBus.off('open-announcement', openAnnouncement)
})
</script>

<template>
  <div id="app" class="flex flex-col bg-[#F5F5F7] min-h-screen">
    <NavigationBar />
    <main class="flex-1 mx-auto px-4 py-10 w-full max-w-[1200px]">
      <router-view />
    </main>
    <FloatingMenu />
    <AnnouncementButton />
    <Modal 
      :show="modalState.show" 
      :title="modalState.title" 
      :message="modalState.message"
      @close="hideModal"
    />
    <AnnouncementModal 
      :show="showAnnouncementModal" 
      @close="showAnnouncementModal = false"
      @update-version="updateAnnouncementVersion"
    />
  </div>
</template>
