import { ref, computed, watch } from "vue";
import { useTaskStore } from '../store/taskStore';

// ДОБАВЛЯЕМ типы
export type ThemeName = 'red' | 'blue' | 'green' | 'gold'

export interface ThemeColors {
    primary: string;
    secondary: string;
    bg: string;
}

export function useThemeColors() {
    const currentTheme = ref<ThemeName>('blue') // ТИПИЗИРУЕМ
    const taskStore = useTaskStore();
    
    const themes: Record<ThemeName, ThemeColors> = { // ТИПИЗИРУЕМ
        red: { primary: '#ff4444', secondary: '#ff6666', bg: '#f5f5f5' },
        blue: { primary: '#4444ff', secondary: '#6666ff', bg: '#f5f5f5' },
        green: { primary: '#44ff44', secondary: '#66ff66', bg: '#f5f5f5' },
        gold: { primary: '#ffaa00', secondary: '#ffcc44', bg: '#f5f5f5' }
    }
    
    // Вычисляем статистику задач
    const taskStats = computed(() => {
        const total = taskStore.tasks.length;
        const completed = taskStore.tasks.filter(task => task.completed).length;
        const progress = total > 0 ? completed / total : 0;
        return {
            total,
            completed,
            progress
        }
    })

    // Вычисляем название темы на основе прогресса
    const currentThemeColor = computed(() => {
        const {progress} = taskStats.value;

        if(progress === 1) return 'gold';
        else if(progress > 0.7) return 'green';
        else if(progress < 0.3) return 'red';
        else return 'blue';
    })

    // Следим за изменением темы и обновляем currentTheme
    watch(currentThemeColor, (newTheme) => {
        currentTheme.value = newTheme;
    }, { immediate: true })
    
    // Функция для плавной интерполяции цветов
    const getCurrentThemeColors = (progress: number) => {
        if (progress === 1) return themes.gold;
        if (progress > 0.7) return themes.green;
        if (progress < 0.3) return themes.red;
        return themes.blue;
    }
    
    return { currentTheme, themes, getCurrentThemeColors, taskStats }
}