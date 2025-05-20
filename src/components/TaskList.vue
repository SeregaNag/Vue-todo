<script setup lang="ts">
import { ref, onMounted } from 'vue';
import TaskItem from './TaskItem.vue';
import { useTaskStore } from '../store/taskStore';

// Состояние
const taskStore = useTaskStore();
const newTaskText = ref('');
const newTaskCategory = ref('');
const categories = ref<string[]>(['Работа', 'Личное', 'Учеба', 'Покупки']);

// Загрузка из localStorage при монтировании компонента
onMounted(() => {
  taskStore.loadFromLocalStorage();
});

// Методы
function addTask() {
  if (newTaskText.value.trim()) {
    taskStore.addTask(newTaskText.value.trim(), newTaskCategory.value);
    newTaskText.value = '';
  }
}
</script>

<template>
  <div class="task-list-container">
    <h1>Менеджер задач</h1>
    
    <!-- Добавление новой задачи -->
    <div class="add-task">
      <input 
        v-model="newTaskText"
        @keyup.enter="addTask"
        placeholder="Добавить новую задачу"
        class="task-input"
      />
      <select v-model="newTaskCategory" class="category-select">
        <option value="">Без категории</option>
        <option v-for="category in categories" :key="category" :value="category">
          {{ category }}
        </option>
      </select>
      <button @click="addTask" class="add-btn">Добавить</button>
    </div>
    
    <!-- Фильтры -->
    <div class="filters">
      <button 
        :class="{ active: taskStore.filter === 'all' }" 
        @click="taskStore.setFilter('all')"
      >
        Все
      </button>
      <button 
        :class="{ active: taskStore.filter === 'active' }" 
        @click="taskStore.setFilter('active')"
      >
        Активные
      </button>
      <button 
        :class="{ active: taskStore.filter === 'completed' }" 
        @click="taskStore.setFilter('completed')"
      >
        Выполненные
      </button>
      <button 
        v-if="taskStore.tasks.some(task => task.completed)" 
        @click="taskStore.clearCompleted()"
        class="clear-btn"
      >
        Очистить выполненные
      </button>
    </div>
    
    <!-- Список задач -->
    <div class="tasks-container">
      <p v-if="taskStore.filteredTasks.length === 0" class="empty-message">
        Нет задач для отображения
      </p>
      <TaskItem
        v-for="task in taskStore.filteredTasks"
        :key="task.id"
        :id="task.id"
        :title="task.title"
        :completed="task.completed"
        :category="task.category"
        @toggle="taskStore.toggleTask"
        @delete="taskStore.deleteTask"
        @edit="(data) => taskStore.editTask(data.id, data.title)"
      />
    </div>
    
    <!-- Счетчик задач -->
    <div class="task-count" v-if="taskStore.tasks.length > 0">
      Всего: {{ taskStore.tasks.length }} | 
      Активных: {{ taskStore.tasks.filter(t => !t.completed).length }} | 
      Выполненных: {{ taskStore.tasks.filter(t => t.completed).length }}
    </div>
  </div>
</template>

<style scoped>
.task-list-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 20px;
}

.add-task {
  display: flex;
  margin-bottom: 20px;
  gap: 8px;
}

.task-input {
  flex-grow: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.category-select {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
}

.add-btn {
  padding: 10px 15px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.add-btn:hover {
  background-color: #45a049;
}

.filters {
  display: flex;
  margin-bottom: 20px;
  gap: 8px;
}

.filters button {
  padding: 8px 12px;
  background-color: #f1f1f1;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.filters button.active {
  background-color: #2196f3;
  color: white;
}

.filters button:hover:not(.active) {
  background-color: #ddd;
}

.clear-btn {
  margin-left: auto;
  background-color: #f44336 !important;
  color: white;
}

.clear-btn:hover {
  background-color: #d32f2f !important;
}

.tasks-container {
  margin-bottom: 20px;
}

.empty-message {
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 20px;
}

.task-count {
  font-size: 14px;
  color: #666;
  text-align: right;
}
</style>