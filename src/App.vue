<script setup lang="ts">
import ThreeBackground from './components/ThreeBackground.vue';
import { useThemeColors } from './composables/useThemeColors';


const { currentTheme, themes } = useThemeColors();

// Функция для определения типа анимации перехода
const getTransitionName = (route: any) => {
  // Можно добавить разные анимации для разных роутов
  if (route.path === '/') {
    return 'slide-left'; // Главная страница "выезжает" слева
  } else if (route.path === '/about') {
    return 'slide-right'; // About страница "выезжает" справа
  }
  return 'fade'; // Базовая анимация по умолчанию
};
</script>

<template>
  <div class="app">
    
    <header :style="{ 
      backgroundColor: themes[currentTheme].primary,
      boxShadow: `0 2px 8px ${themes[currentTheme].primary}33`
    }">
      <nav>
        <router-link to="/" class="nav-link">Задачи</router-link>
        <router-link to="/about" class="nav-link">О проекте</router-link>
      </nav>
    </header>

    <main>
      <ThreeBackground />
      <router-view v-slot="{ Component, route }">
        <transition :name="getTransitionName(route)" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </main>

    <footer :style="{ backgroundColor: themes[currentTheme].secondary }">
      <p>Vue Task Manager &copy; 2025</p>
    </footer>
  </div>
</template>

<style>
body {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0;
  padding: 0;
  color: #2c3e50;
  transition: all 0.3s ease; /* ПЛАВНЫЕ ПЕРЕХОДЫ */
  overflow-x: hidden; /* ПРЕДОТВРАЩАЕМ ГОРИЗОНТАЛЬНЫЙ СКРОЛЛ */
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  color: white;
  padding: 1rem;
  transition: all 0.3s ease; /* ПЛАВНЫЕ ПЕРЕХОДЫ */
}

nav {
  display: flex;
  justify-content: center;
  gap: 20px;
}

.nav-link {
  color: white;
  text-decoration: none;
  font-weight: bold;
  padding: 5px 15px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.nav-link:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.router-link-active {
  background-color: rgba(255, 255, 255, 0.3);
}

main {
  flex-grow: 1;
  padding: 20px;
  transition: all 0.3s ease; /* ПЛАВНЫЕ ПЕРЕХОДЫ */
  position: relative; /* ДЛЯ ПРАВИЛЬНОГО ПОЗИЦИОНИРОВАНИЯ АНИМАЦИЙ */
}

footer {
  text-align: center;
  padding: 1rem;
  color: white;
  font-size: 0.8rem;
  transition: all 0.3s ease; /* ПЛАВНЫЕ ПЕРЕХОДЫ */
}

/* === АНИМАЦИИ ПЕРЕХОДОВ РОУТОВ === */

/* Базовая fade анимация */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Анимация слайда слева (для главной страницы) */
.slide-left-enter-active, .slide-left-leave-active {
  transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.slide-left-enter-from {
  transform: translateX(-30px);
  opacity: 0;
}
.slide-left-leave-to {
  transform: translateX(30px);
  opacity: 0;
}

/* Анимация слайда справа (для About страницы) */
.slide-right-enter-active, .slide-right-leave-active {
  transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.slide-right-enter-from {
  transform: translateX(30px);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(-30px);
  opacity: 0;
}
</style>
