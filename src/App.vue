<script setup lang="ts">
import ThreeBackground from './components/ThreeBackground.vue';
import { useThreeBackground } from './composables/useThreeBackground';

const { currentTheme, themes } = useThreeBackground();
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
      <router-view></router-view>
    </main>

    <footer :style="{ backgroundColor: themes[currentTheme].secondary }">
      <p>Vue Task Manager &copy; 2023</p>
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
}

footer {
  text-align: center;
  padding: 1rem;
  color: white;
  font-size: 0.8rem;
  transition: all 0.3s ease; /* ПЛАВНЫЕ ПЕРЕХОДЫ */
}
</style>
