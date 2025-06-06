<template>
    <canvas ref="canvasRef" class="three-background"/>
</template>

<script setup lang="ts">
import { useThreeBackground } from '../composables/useThreeBackground';

const { canvasRef } = useThreeBackground();
</script>

<style scoped>
.three-background {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  z-index: -1;
  pointer-events: none;
}
</style>
