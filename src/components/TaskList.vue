<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import TaskItem from './TaskItem.vue';

interface Task {
    id: number;
    title: string;
    completed: boolean;
    category?: string;
}

const tasks = ref<Task[]>([]);
const newTaskText = ref('');
const newTaskCategory = ref('');
const filter = ref<'all' | 'active' | 'completed'>('all');
const nextId = ref(1);
const categories = ref<string[]>(['Работа', 'Дом', 'Учеба', 'Спорт', 'Другое']);

onMounted(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
        tasks.value = JSON.parse(savedTasks);
        nextId.value = Math.max(...tasks.value.map(task => task.id), 0) + 1;
    }
});

watch(tasks, (newTasks) => {
    localStorage.setItem('tasks', JSON.stringify(newTasks));
}, { deep: true });

const filteredTasks = computed(() => {
    switch (filter.value) {
        case 'active':
            return tasks.value.filter(task => !task.completed);
        case 'completed':
            return tasks.value.filter(task => task.completed);
        default:
            return tasks.value;
    }
});

function addTask() {
    if (newTaskText.value.trim()) {
        tasks.value.push({
            id: nextId.value++,
            title: newTaskText.value.trim(),
            completed: false,
            category: newTaskCategory.value,
        });
        newTaskText.value = '';
    }
}

function toggleTask(id: number) {
    const task = tasks.value.find(task => task.id === id);
    if (task) {
        task.completed = !task.completed;
    }
}

function deleteTask(id: number) {
    const index = tasks.value.findIndex(task => task.id === id);
    if (index !== -1) {
        tasks.value.splice(index, 1);
    }
}

function editTask(data: {id: number, title: string}) {
    const task = tasks.value.find(task => task.id === data.id);
    if (task) {
        task.title = data.title;
    }
}

function clearCompleted() {
    tasks.value = tasks.value.filter(task => !task.completed);
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
        :class="{ active: filter === 'all' }" 
        @click="filter = 'all'"
      >
        Все
      </button>
      <button 
        :class="{ active: filter === 'active' }" 
        @click="filter = 'active'"
      >
        Активные
      </button>
      <button 
        :class="{ active: filter === 'completed' }" 
        @click="filter = 'completed'"
      >
        Выполненные
      </button>
      <button 
        v-if="tasks.some(task => task.completed)" 
        @click="clearCompleted"
        class="clear-btn"
      >
        Очистить выполненные
      </button>
    </div>
    
    <!-- Список задач -->
    <div class="tasks-container">
      <p v-if="filteredTasks.length === 0" class="empty-message">
        Нет задач для отображения
      </p>
      <TaskItem
        v-for="task in filteredTasks"
        :key="task.id"
        :id="task.id"
        :title="task.title"
        :completed="task.completed"
        :category="task.category"
        @toggle="toggleTask"
        @delete="deleteTask"
        @edit="editTask"
      />
    </div>
    
    <!-- Счетчик задач -->
    <div class="task-count" v-if="tasks.length > 0">
      Всего: {{ tasks.length }} | 
      Активных: {{ tasks.filter(t => !t.completed).length }} | 
      Выполненных: {{ tasks.filter(t => t.completed).length }}
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