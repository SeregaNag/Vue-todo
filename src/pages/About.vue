<script setup lang="ts">

</script>

<template>
    <div class="about">
        <h1>О проекте</h1>
        <p>Это простой менеджер задач на Vue 3 с Vue Router для организации навигации.</p>
        <p>Создан для изучения основных возможностей Vue и Vite.</p>

        <h2>Используемые технологии:</h2>
        <ul>
            <li>Vue 3 Composition API</li>
            <li>TypeScript</li>
            <li>Vue Router</li>
            <li>Vite</li>
            <li>LocalStorage для хранения задач</li>
        </ul>
    </div>
</template>

<style scoped>
.about {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h1 {
    color: #2c3e50;
    border-bottom: 2px solid #42b883;
    padding-bottom: 10px;
}

h2 {
    color: #42b883;
    margin-top: 20px;
}

ul {
    padding-left: 20px;
}

li {
    margin: 8px 0;
    color: #2c3e50;
}

p {
    line-height: 1.6;
    color: #34495e;
}
</style>
