import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { useTaskStore } from '../store/taskStore';
import { watch, computed } from 'vue';
import type { Task } from '../types/task';
import { useThemeColors } from './useThemeColors';
import { useCoordinateConverter } from './useCoordinateConverter';

export function useThreeBackground() {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const { currentTheme, themes } = useThemeColors();
    const { screenToThreeJS } = useCoordinateConverter();
    let taskListBounds: {left: number, right: number, top: number, bottom: number} | null = null;

    let scene: THREE.Scene
    let camera: THREE.PerspectiveCamera
    let renderer: THREE.WebGLRenderer
    let animationId: number;
    let backgroundParticles: THREE.Mesh[] = [] // маленькие фоновые
    let taskParticles: THREE.Mesh[] = []       // большие для задач
    const taskStore = useTaskStore();

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

    const updateTaskListBounds = (domBounds: DOMRect) => {
        if (!camera || !renderer) return
        
        const canvas = renderer.domElement
        const canvasRect = canvas.getBoundingClientRect()
        
        // Преобразуем координаты TaskList в Three.js координаты
        const topLeft = screenToThreeJS(
            domBounds.left - canvasRect.left,
            domBounds.top - canvasRect.top,
            canvasRect.width,
            canvasRect.height,
            camera
        )
        
        const bottomRight = screenToThreeJS(
            domBounds.right - canvasRect.left,
            domBounds.bottom - canvasRect.top,
            canvasRect.width,
            canvasRect.height,
            camera
        )
        
        taskListBounds = {
            left: topLeft.x,
            right: bottomRight.x,
            top: topLeft.y,
            bottom: bottomRight.y
        }
    }
    
    const updateTaskListBoundsFromDOM = () => {
        // Автоматически ищем TaskList в DOM по классу
        const taskListElement = document.querySelector('.task-list-container') as HTMLElement
        if (taskListElement) {
            const rect = taskListElement.getBoundingClientRect()
            updateTaskListBounds(rect)
            
            // ОТЛАДКА: выводим границы в консоль
            console.log('DOM границы TaskList:', {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height
            })
            
            console.log('Three.js границы TaskList:', taskListBounds)
        }
    }

    const updateParticles = () => {
        const { progress } = taskStats.value;

        // ПЛАВНЫЕ переходы между цветами на основе прогресса
        let targetHue, targetSaturation, targetLightness;
        
        if (progress === 1) {
            targetHue = 60; targetSaturation = 0.8; targetLightness = 0.7; // Золотой
        } else if (progress > 0.7) {
            targetHue = 120; targetSaturation = 0.7; targetLightness = 0.6; // Зелёный
        } else if (progress < 0.3) {
            targetHue = 0; targetSaturation = 0.8; targetLightness = 0.6; // Красный
        } else {
            targetHue = 240; targetSaturation = 0.7; targetLightness = 0.6; // Синий
        }

        // ПЛАВНАЯ анимация к целевому цвету
        backgroundParticles.forEach(particle => {
            if(particle.material instanceof THREE.MeshBasicMaterial) {
                // ИСПРАВЛЯЕМ: создаём объект HSL с нужными свойствами
                const currentColor = { h: 0, s: 0, l: 0 };
                particle.material.color.getHSL(currentColor);
                
                // Плавная интерполяция к целевому цвету (lerp)
                const newHue = THREE.MathUtils.lerp(currentColor.h, targetHue / 360, 0.05);
                const newSat = THREE.MathUtils.lerp(currentColor.s, targetSaturation, 0.05);
                const newLight = THREE.MathUtils.lerp(currentColor.l, targetLightness, 0.05);
                
                particle.material.color.setHSL(newHue, newSat, newLight);
            }
        })
    }

    const currentThemeColor = computed(() => {
        const {progress} = taskStats.value;

        if(progress === 1) return 'gold';
        else if(progress > 0.7) return 'green';
        else if(progress < 0.3) return 'red';
        else return 'blue';
    })

    watch(currentThemeColor, (newTheme) => {
        currentTheme.value = newTheme;
    }, { immediate: true })

    watch(taskStats, () => {
        updateParticles()
    }, { deep: true })
    
    watch(() => taskStore.tasks.length, (newLength, oldLength) => {
        if (newLength > oldLength) {
            const newTask = taskStore.tasks[taskStore.tasks.length - 1];
            addSingleTaskParticle(newTask, taskStore.tasks.length - 1)
        } else if (newLength < oldLength) {
            createTaskParticles()
        }
    })

    watch(() => taskStore.tasks, (newTasks) => {
        // ИЗМЕНЯЕМ условие: если количество частиц НЕ равно количеству задач
        if (newTasks.length > 0 && taskParticles.length !== newTasks.length) {
            createTaskParticles()
        }
    })

    // ДОБАВЛЯЕМ новый watcher для отслеживания изменений статуса задач
    watch(() => taskStore.tasks.map(task => task.completed), (newCompletedStates, oldCompletedStates) => {
        if (!newCompletedStates || !oldCompletedStates) return;
        
        // Находим задачи, у которых изменился статус
        newCompletedStates.forEach((isCompleted, index) => {
            const wasCompleted = oldCompletedStates[index];
            
            // Если статус задачи изменился
            if (isCompleted !== wasCompleted) {
                updateTaskParticleColor(taskStore.tasks[index].id, isCompleted);
            }
        });
    }, { deep: true })

    // Функция для обновления цвета конкретной task particle
    const updateTaskParticleColor = (taskId: number, isCompleted: boolean) => {
        const particle = taskParticles.find(p => p.userData.taskId === taskId);
        
        if (particle && particle.material instanceof THREE.MeshBasicMaterial) {
            // Устанавливаем целевой цвет в userData для плавной анимации
            particle.userData.targetColor = isCompleted ? 0x00ff00 : 0xff6600; // зеленый : оранжевый
            
            console.log(`Установлен целевой цвет для частицы задачи ${taskId}: ${isCompleted ? 'зеленый' : 'оранжевый'}`);
        }
    }

    const addSingleTaskParticle = (task: any, index: number) => {
        // ДОБАВЛЯЕМ проверку
        if (!scene) return;
        
        const geometry = new THREE.BoxGeometry(2.5, 2.5, 2.5)
        
        const material = new THREE.MeshBasicMaterial({
            color: task.completed ? 0x00ff00 : 0xff6600,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        })
        
        const mesh = new THREE.Mesh(geometry, material)
        
        // Появляется ТОЛЬКО в боковых областях (слева или справа от todo окна)
        const isLeftSide = Math.random() < 0.5
        let startX, startY
        
        if (isLeftSide) {
            // Левая боковая область
            startX = -50 - Math.random() * 20  // от -50 до -70
            startY = (Math.random() - 0.5) * 40 // по всей высоте
        } else {
            // Правая боковая область  
            startX = 50 + Math.random() * 20   // от +50 до +70
            startY = (Math.random() - 0.5) * 40 // по всей высоте
        }
        
        mesh.position.set(startX, startY, (Math.random() - 0.5) * 10)
        
        // Обычная случайная скорость
        mesh.userData = {
            taskId: task.id,
            targetColor: task.completed ? 0x00ff00 : 0xff6600, // начальный целевой цвет
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.1
            ),
            rotationSpeed: {
                x: Math.random() * 0.015,
                y: Math.random() * 0.015
            }
        }
        
        scene.add(mesh)
        taskParticles.push(mesh)
    }

    const createBackgroundParticles = () => {
        for (let i = 0; i < 30; i++) {
            const geometries = [
                new THREE.BoxGeometry(0.8, 0.8, 0.8),
                new THREE.SphereGeometry(0.5, 6, 6),
                new THREE.ConeGeometry(0.5, 1.0, 6)
            ]
            
            const geometry = geometries[Math.floor(Math.random() * geometries.length)]
            
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(240/360, 0.7, 0.6),
                wireframe: true,
                transparent: true,
                opacity: 0.6
            })
            
            const mesh = new THREE.Mesh(geometry, material)
            
            // Появляются в боковых областях (как и частицы задач)
            const isLeftSide = Math.random() < 0.5
            let startX, startY
            
            if (isLeftSide) {
                // Левая боковая область
                startX = -40 - Math.random() * 30  // от -40 до -70
                startY = (Math.random() - 0.5) * 50 // по всей высоте
            } else {
                // Правая боковая область  
                startX = 40 + Math.random() * 30   // от +40 до +70
                startY = (Math.random() - 0.5) * 50 // по всей высоте
            }
            
            mesh.position.set(startX, startY, (Math.random() - 0.5) * 15)
            
            mesh.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.2
                ),
                rotationSpeed: {
                    x: Math.random() * 0.01,
                    y: Math.random() * 0.01
                }
            }
            
            scene.add(mesh)
            backgroundParticles.push(mesh)
        }
    }
    
    const createTaskParticles = () => {
        // ДОБАВЛЯЕМ проверку
        if (!scene) return;
        
        console.log(`Создание частиц задач: ${taskStore.tasks.length} задач найдено`);
        
        // Очищаем старые частицы задач
        taskParticles.forEach(particle => {
            scene.remove(particle)
        })
        taskParticles = []
        
        // Создаём по частице на каждую задачу
        taskStore.tasks.forEach((task, index) => {  
            const geometry = new THREE.BoxGeometry(2.5, 2.5, 2.5)
            
            const material = new THREE.MeshBasicMaterial({
                color: task.completed ? 0x00ff00 : 0xff6600,
                wireframe: true,
                transparent: true,
                opacity: 0.8
            })
            
            const mesh = new THREE.Mesh(geometry, material)
            
            // ДЕТЕРМИНИРОВАННОЕ позиционирование на основе индекса
            const isLeftSide = index % 2 === 0  // чётные слева, нечётные справа
            const verticalOffset = (index * 8) % 40 - 20  // распределяем по высоте
            
            let startX, startY
            
            if (isLeftSide) {
                startX = -55 - (index * 3) % 15  // разные X для левой стороны
                startY = verticalOffset
            } else {
                startX = 55 + (index * 3) % 15   // разные X для правой стороны  
                startY = verticalOffset
            }
            
            mesh.position.set(startX, startY, (index * 2) % 10 - 5)  // разные Z
            
            mesh.userData = {
                taskId: task.id,
                targetColor: task.completed ? 0x00ff00 : 0xff6600, // начальный целевой цвет
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.1
                ),
                rotationSpeed: {
                    x: Math.random() * 0.015,
                    y: Math.random() * 0.015
                }
            }
            
            scene.add(mesh)
            taskParticles.push(mesh)
            
            console.log(`Создана частица для задачи ${task.id}: "${task.title}" (${task.completed ? 'завершена' : 'активна'})`);
        })
        
        console.log(`Всего создано частиц задач: ${taskParticles.length}`);
    }
    
    const initThree = () => {
        if (!canvasRef.value) return;

        scene = new THREE.Scene();

        const parent = canvasRef.value.parentElement;
        const width = parent?.clientWidth || window.innerWidth;
        const height = parent?.clientHeight || window.innerHeight;

        renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.value,
            alpha: true,
            antialias: true,
        });
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);

        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 50;

        createBackgroundParticles()
        createTaskParticles()
        updateParticles()
        
        // Автоматически обновляем границы TaskList после инициализации
        setTimeout(() => {
            updateTaskListBoundsFromDOM()
        }, 100)
    }

    const animate = () => {
        animationId = requestAnimationFrame(animate);

        // ДОБАВЛЯЕМ проверку
        if (!renderer || !scene || !camera) return;

        // ДОБАВЛЯЕМ плавное обновление цветов каждый кадр
        updateParticles();

        // Анимируем фоновые частицы
        backgroundParticles.forEach(particle => {
            particle.position.add(particle.userData.velocity)
            
            // Отскок от границ экрана
            if (particle.position.x > 70 || particle.position.x < -70) {
                particle.userData.velocity.x *= -1
            }
            if (particle.position.y > 32 || particle.position.y < -30) {
                particle.userData.velocity.y *= -1
            }
            if (particle.position.z > 10 || particle.position.z < -10) {
                particle.userData.velocity.z *= -1
            }
            
            // Отскок от области TaskList (если границы определены)
            if (taskListBounds) {
                const margin = 2; // отступ для отскока
                
                // Проверяем приближение к границам TaskList
                if (particle.position.x > (taskListBounds.left - margin) && 
                    particle.position.x < (taskListBounds.right + margin) &&
                    particle.position.y < (taskListBounds.top + margin) && 
                    particle.position.y > (taskListBounds.bottom - margin)) {
                    
                    // Определяем с какой стороны частица приближается
                    const centerX = (taskListBounds.left + taskListBounds.right) / 2
                    const centerY = (taskListBounds.top + taskListBounds.bottom) / 2
                    
                    const deltaX = particle.position.x - centerX
                    const deltaY = particle.position.y - centerY
                    
                    // Отскакиваем в направлении от центра TaskList
                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                        // Горизонтальный отскок
                        particle.userData.velocity.x = deltaX > 0 ? Math.abs(particle.userData.velocity.x) : -Math.abs(particle.userData.velocity.x)
                    } else {
                        // Вертикальный отскок
                        particle.userData.velocity.y = deltaY > 0 ? Math.abs(particle.userData.velocity.y) : -Math.abs(particle.userData.velocity.y)
                    }
                }
            }
            
            particle.rotation.x += particle.userData.rotationSpeed.x
            particle.rotation.y += particle.userData.rotationSpeed.y
        });

        // Анимируем частицы задач
        taskParticles.forEach(particle => {
            particle.position.add(particle.userData.velocity)
            
            // Отскок от границ экрана
            if (particle.position.x > 70 || particle.position.x < -70) {
                particle.userData.velocity.x *= -1
            }
            if (particle.position.y > 32 || particle.position.y < -30) {
                particle.userData.velocity.y *= -1
            }
            if (particle.position.z > 10 || particle.position.z < -10) {
                particle.userData.velocity.z *= -1
            }
            
            // Отскок от области TaskList (если границы определены)
            if (taskListBounds) {
                const margin = 2; // отступ для отскока
                
                // Проверяем приближение к границам TaskList
                if (particle.position.x > (taskListBounds.left - margin) && 
                    particle.position.x < (taskListBounds.right + margin) &&
                    particle.position.y < (taskListBounds.top + margin) && 
                    particle.position.y > (taskListBounds.bottom - margin)) {
                    
                    // Определяем с какой стороны частица приближается
                    const centerX = (taskListBounds.left + taskListBounds.right) / 2
                    const centerY = (taskListBounds.top + taskListBounds.bottom) / 2
                    
                    const deltaX = particle.position.x - centerX
                    const deltaY = particle.position.y - centerY
                    
                    // Отскакиваем в направлении от центра TaskList
                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                        // Горизонтальный отскок
                        particle.userData.velocity.x = deltaX > 0 ? Math.abs(particle.userData.velocity.x) : -Math.abs(particle.userData.velocity.x)
                    } else {
                        // Вертикальный отскок
                        particle.userData.velocity.y = deltaY > 0 ? Math.abs(particle.userData.velocity.y) : -Math.abs(particle.userData.velocity.y)
                    }
                }
            }
            
            // ПЛАВНАЯ анимация цвета
            if (particle.userData.targetColor !== undefined && 
                particle.material instanceof THREE.MeshBasicMaterial) {
                
                const currentColor = particle.material.color;
                const targetColor = new THREE.Color(particle.userData.targetColor);
                
                // Плавная интерполяция к целевому цвету
                currentColor.lerp(targetColor, 0.05); // 0.05 = скорость перехода
                
                // Проверяем близость через сравнение компонентов RGB
                const rDiff = Math.abs(currentColor.r - targetColor.r);
                const gDiff = Math.abs(currentColor.g - targetColor.g);
                const bDiff = Math.abs(currentColor.b - targetColor.b);
                
                if (rDiff < 0.01 && gDiff < 0.01 && bDiff < 0.01) {
                    delete particle.userData.targetColor;
                }
            }
            
            particle.rotation.x += particle.userData.rotationSpeed.x
            particle.rotation.y += particle.userData.rotationSpeed.y
        });

        renderer.render(scene, camera);
    }

    const handleResize = () => {
        if (!renderer || !camera || !canvasRef.value) return
        
        const parent = canvasRef.value.parentElement;
        const width = parent?.clientWidth || window.innerWidth;
        const height = parent?.clientHeight || window.innerHeight;
        
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height)
        
        // Обновляем границы TaskList после изменения размера
        setTimeout(() => {
            updateTaskListBoundsFromDOM()
        }, 50)
    }

    onMounted(() => {
        initThree();
        animate();
        window.addEventListener('resize', handleResize);
    });

    onUnmounted(() => {
        if(animationId) {
            cancelAnimationFrame(animationId);
        }
        if(renderer) {
            renderer.dispose();
        }
        window.removeEventListener('resize', handleResize);
    });

    return {
        canvasRef,
        initThree,
        currentTheme,
        themes,
        updateTaskListBounds
    };
}
