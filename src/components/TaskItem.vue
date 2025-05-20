<script setup lang="ts">
import { ref } from 'vue';

interface Props {
    id: number;
    title: string;
    completed: boolean;
    category?: string;
}

const props = defineProps<Props>();

const emit = defineEmits(['toggle', 'delete', 'edit']);

const isEditing = ref(false);
const editedTitle = ref(props.title);

function saveEdit() {
    if (editedTitle.value.trim()) {
        emit('edit', { id: props.id, title: editedTitle.value });
        isEditing.value = false;
    }
}

function cancelEdit() {
    editedTitle.value = props.title;
    isEditing.value = false;
}

</script>

<template>
    <div class="task-item" :class="{ completed: completed }">
        <div v-if="!isEditing" class="task-content">
            <input type="checkbox" :checked="completed" @change="emit('toggle', id)">
            <span :class="{ completed: completed }">{{ title }}</span>
            <span v-if="category" class="category">{{ category }}</span>

            <div class="actions">
                <button @click="isEditing = true">✏️</button>
                <button @click="emit('delete', id)">🗑️</button>
            </div>
        </div>

        <div v-else class="edit-form">
            <input v-model="editedTitle" @keyup.enter="saveEdit" @keyup.esc="cancelEdit" ref="editInput"
                class="edit-input" />
            <div class="edit-actions">
                <button @click="saveEdit">💾</button>
                <button @click="cancelEdit">❌</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.task-item {
    display: flex;
    align-items: center;
    margin: 8px 0;
    padding: 12px;
    background-color: #f9f9f9;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: all 0.3s;
}

.task-content {
    display: flex;
    width: 100%;
    align-items: center;
}

.completed {
    text-decoration: line-through;
    color: #888;
}

.task-item.completed {
opacity: 0.7;
background-color: #f0f0f0;
}

.category {
    margin-left: 10px;
    font-size: 0.8em;
    background-color: #e1e1e1;
    padding: 2px 6px;
    border-radius: 10px;
}

input[type="checkbox"] {
  margin-right: 10px;
}

.actions {
  margin-left: auto;
}

button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1em;
    margin-left: 5px;
}

.edit-form {
  display: flex;
  width: 100%;
}

.edit-input {
  flex-grow: 1;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.edit-actions {
  display: flex;
  margin-left: 8px;
}
</style>