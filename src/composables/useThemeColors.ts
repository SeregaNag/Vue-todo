import { ref } from "vue";

// ДОБАВЛЯЕМ типы
export type ThemeName = 'red' | 'blue' | 'green' | 'gold'

export interface ThemeColors {
    primary: string;
    secondary: string;
    bg: string;
}

export function useThemeColors() {
    const currentTheme = ref<ThemeName>('blue') // ТИПИЗИРУЕМ
    
    const themes: Record<ThemeName, ThemeColors> = { // ТИПИЗИРУЕМ
        red: { primary: '#ff4444', secondary: '#ff6666', bg: '#f5f5f5' },
        blue: { primary: '#4444ff', secondary: '#6666ff', bg: '#f5f5f5' },
        green: { primary: '#44ff44', secondary: '#66ff66', bg: '#f5f5f5' },
        gold: { primary: '#ffaa00', secondary: '#ffcc44', bg: '#f5f5f5' }
    }
    
    // Функция для плавной интерполяции цветов
    const getCurrentThemeColors = (progress: number) => {
        if (progress === 1) return themes.gold;
        if (progress > 0.7) return themes.green;
        if (progress < 0.3) return themes.red;
        return themes.blue;
    }
    
    return { currentTheme, themes, getCurrentThemeColors }
}