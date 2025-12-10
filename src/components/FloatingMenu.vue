<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { eventBus } from '../utils/eventBus'

const route = useRoute()
const isOpen = ref(false)

const isReportPage = computed(() => route.name === 'report')

function toggleMenu() {
  isOpen.value = !isOpen.value
}

function closeMenu() {
  isOpen.value = false
}

function handleScreenshot() {
  eventBus.emit('trigger-screenshot')
  closeMenu()
}
</script>

<template>
  <div class="floating-menu-container no-capture">
    <!-- Main Button -->
    <button 
      class="main-button" 
      @click="toggleMenu"
      title="菜单"
    >
      <span class="icon">☰</span>
    </button>

    <!-- Popup Modal -->
    <div v-if="isOpen" class="popup-overlay" @click="closeMenu">
      <div class="popup-content" @click.stop>
        <div class="popup-header">
          <h3>菜单</h3>
          <button class="close-btn" @click="closeMenu">✕</button>
        </div>
        
        <div class="menu-items">
          <a 
            href="https://qm.qq.com/q/EhuH4pBPmU" 
            target="_blank" 
            class="menu-item"
            title="点击链接加入群聊【太鼓之达人Rating交流群】"
          >
            <span class="icon">👥</span>
            <span class="label">加入QQ群</span>
          </a>
          
          <button 
            v-if="isReportPage" 
            @click="handleScreenshot" 
            class="menu-item"
          >
            <span class="icon">📷</span>
            <span class="label">保存截图</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.main-button {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 1000;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: #e91e63;
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.main-button:hover {
  transform: scale(1.1);
  background-color: #d81b60;
}

.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.2s ease-out;
}

.popup-content {
  background: white;
  padding: 20px;
  border-radius: 12px;
  width: 90%;
  max-width: 300px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: scaleIn 0.2s ease-out;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.popup-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
  padding: 0 5px;
}

.close-btn:hover {
  color: #333;
}

.menu-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 12px 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  text-decoration: none;
  color: #333;
  font-size: 16px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  box-sizing: border-box;
}

.menu-item:hover {
  background-color: #fff;
  border-color: #e91e63;
  color: #e91e63;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(233, 30, 99, 0.1);
}

.menu-item .icon {
  font-size: 20px;
  width: 24px;
  text-align: center;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { 
    opacity: 0;
    transform: scale(0.9); 
  }
  to { 
    opacity: 1;
    transform: scale(1); 
  }
}
</style>
