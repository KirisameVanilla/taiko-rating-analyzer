<script setup lang="ts">
import NavigationBar from './components/NavigationBar.vue'
import Modal from './components/Modal.vue'
import FloatingMenu from './components/FloatingMenu.vue'
import { useModal } from './composables/useModal'

const { modalState, hideModal } = useModal()
</script>

<template>
  <div id="app">
    <NavigationBar />
    <main class="main-content">
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

<style scoped>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  padding: 20px;
}
</style>
