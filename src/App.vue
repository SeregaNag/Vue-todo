<script setup lang="ts">
</script>

<template>
  <div class="app">
    <header>
      <nav>
        <router-link to="/" class="nav-link">Задачи</router-link>
        <router-link to="/about" class="nav-link">О проекте</router-link>
      </nav>
    </header>

    <main>
      <router-view></router-view>
    </main>

    <footer>
      <p>Vue Task Manager &copy; 2023</p>
    </footer>
  </div>
</template>

<style >
body {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0;
  padding: 0;
  background-color: #f5f5f5;
  color: #2c3e50;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  background-color: #42b883;
  color: white;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
}

footer {
  text-align: center;
  padding: 1rem;
  background-color: #2c3e50;
  color: white;
  font-size: 0.8rem;
}
</style>
