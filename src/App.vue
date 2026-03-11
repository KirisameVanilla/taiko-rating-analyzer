<script setup lang="ts">
import NavigationBar from './components/NavigationBar.vue'
import Modal from './components/Modal.vue'
import FloatingMenu from './components/FloatingMenu.vue'
import FloatingSettings from './components/FloatingSettings.vue'
import { useModal } from './composables/useModal'

const { modalState, hideModal } = useModal()

</script>

<template>
  <div id="app" class="flex flex-col bg-[#F5F5F7] min-h-screen">
    <NavigationBar />
    <main class="flex-1 mx-auto px-4 py-10 w-full max-w-[1200px]">
      <router-view />
    </main>
    <FloatingMenu />
    <FloatingSettings />
    <Modal 
      :show="modalState.show" 
      :title="modalState.title" 
      :message="modalState.message"
      @close="hideModal"
    />
  </div>
</template>
