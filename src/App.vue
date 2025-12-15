<script setup lang="ts">
import NavigationBar from './components/NavigationBar.vue'
import Modal from './components/Modal.vue'
import FloatingMenu from './components/FloatingMenu.vue'
import { useModal } from './composables/useModal'

const { modalState, hideModal } = useModal()
</script>

<template>
  <div id="app" class="flex flex-col min-h-screen">
    <NavigationBar />
    <main class="flex-1 p-5">
      <router-view />
    </main>
    <FloatingMenu />
    <Modal 
      :show="modalState.show" 
      :title="modalState.title" 
      :message="modalState.message"
      @close="hideModal"
    />
  </div>
</template>
