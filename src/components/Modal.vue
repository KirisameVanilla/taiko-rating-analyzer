<script setup lang="ts">
interface Props {
  show: boolean
  title?: string
  message: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '提示'
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const handleClose = () => {
  emit('close')
}

const handleOverlayClick = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="z-[1000] fixed inset-0 flex justify-center items-center bg-black/50 transition-opacity duration-300" @click="handleOverlayClick">
      <div class="bg-white shadow-[0_4px_6px_rgba(0,0,0,0.1)] rounded-lg min-w-[300px] max-w-[500px] transition-transform duration-300">
        <div class="flex justify-between items-center px-5 py-4 border-gray-200 border-b">
          <h3 class="m-0 font-semibold text-gray-900 text-lg">{{ title }}</h3>
          <button class="flex justify-center items-center bg-none p-0 border-none w-[30px] h-[30px] text-[28px] text-gray-500 hover:text-gray-900 leading-none cursor-pointer" @click="handleClose">&times;</button>
        </div>
        <div class="p-5">
          <p class="m-0 text-gray-700 leading-normal">{{ message }}</p>
        </div>
        <div class="flex justify-end px-5 py-3 border-gray-200 border-t">
          <button class="bg-blue-500 hover:bg-blue-600 px-4 py-2 border-none rounded-md font-medium text-white text-sm cursor-pointer" @click="handleClose">确定</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.9);
}
</style>
