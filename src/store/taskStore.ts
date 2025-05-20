import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task } from '../types/task'

export type FilterType = 'all' | 'active' | 'completed'

export const useTaskStore = defineStore('tasks', () => {
    const tasks = ref<Task[]>([])
    const filter = ref<FilterType>('all')
    const nextId = ref(1)

    const filteredTasks = computed(() => {
        switch (filter.value) {
            case 'active':
                return tasks.value.filter(task => !task.completed)
            case 'completed':
                return tasks.value.filter(task => task.completed)
            default:
                return tasks.value
        }
    })

    function setFilter(newFilter: FilterType) {
        filter.value = newFilter
    }
    
    function addTask(title: string, category: string = '') {
        tasks.value.push({
            id: nextId.value++,
            title,
            completed: false,
            category
        })
        saveToLocalStorage()
    }
    
    function toggleTask(id: number) {
        const task = tasks.value.find(task => task.id === id)
        if (task) {
            task.completed = !task.completed
            saveToLocalStorage()
        }
    }
    
    function deleteTask(id: number) {
        const index = tasks.value.findIndex(task => task.id === id)
        if (index !== -1) {
            tasks.value.splice(index, 1)
            saveToLocalStorage()
        }
    }
    
    function editTask(id: number, title: string) {
        const task = tasks.value.find(task => task.id === id)
        if (task) {
            task.title = title
            saveToLocalStorage()
        }
    }
    
    function clearCompleted() {
        tasks.value = tasks.value.filter(task => !task.completed)
        saveToLocalStorage()
    }
    
    function loadFromLocalStorage() {
        const savedTasks = localStorage.getItem('tasks')
        if (savedTasks) {
            tasks.value = JSON.parse(savedTasks)
            nextId.value = Math.max(...tasks.value.map(task => task.id), 0) + 1
        }
    }
    
    function saveToLocalStorage() {
        localStorage.setItem('tasks', JSON.stringify(tasks.value))
    }

    return {
        tasks,
        filter,
        filteredTasks,
        setFilter,
        addTask,
        toggleTask,
        deleteTask,
        editTask,
        clearCompleted,
        loadFromLocalStorage
    }
})
