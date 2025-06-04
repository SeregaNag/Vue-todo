import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { useTaskStore } from '../store/taskStore';
import { watch, computed } from 'vue';
import type { Task } from '../types/task';
import { useThemeColors } from './useThemeColors';
import { useCoordinateConverter } from './useCoordinateConverter';

const taskParticleColors = {
    red: {
        completed: 0xFF6B6B,    // кораллово-красный
        active: 0x5A1A1A       // пыльный бордовый
    },
    blue: {
        completed: 0x7FDBFF,   // светло-голубой неон
        active: 0x1B3A4B       // глубокий тёмно-синий
    },
    green: {
        completed: 0xA4F57A,   // лаймово-зелёный
        active: 0x355E3B       // тускло-зелёный
    },
    gold: {
        completed: 0xFFD700,   // насыщенное золото
        active: 0x6E552D       // тяжёлое бронзово-золотое
    }
}

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

    let distractionFragments: THREE.Mesh[] = [] // фрагменты разборки  
    let assemblyFragments: THREE.Mesh[] = []     // фрагменты сборки

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

    const createDistractionEffect = (particle: THREE.Mesh) => {
        const fragments: THREE.Mesh[] = [];
        const fragmentCount = 50;

        for(let i = 0; i<fragmentCount; i++) {
            const fragmentSize = Math.random() * 0.3 + 0.1;
            const fragmentGeometry = new THREE.BoxGeometry(fragmentSize, fragmentSize, fragmentSize);

            const fragmentMaterial = new THREE.MeshBasicMaterial({
                color: (particle.material as THREE.MeshBasicMaterial).color.clone(),
                wireframe: true,
                transparent: true,
                opacity: 0.8
            })

            const fragment = new THREE.Mesh(fragmentGeometry, fragmentMaterial);
            
            fragment.position.copy(particle.position);
            fragment.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ))
            
            fragment.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.8,
                    (Math.random() - 0.5) * 0.8,
                    (Math.random() - 0.5) * 0.8
                ),
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.1,
                    y: (Math.random() - 0.5) * 0.1,
                    z: (Math.random() - 0.5) * 0.1
                },
                lifetime: 0,
                maxLifetime: Math.random() * 2 + 1
            }

            scene.add(fragment)
            distractionFragments.push(fragment)
        }

        return fragments;
    }

    const animateFragments = () => {
        for(let i = distractionFragments.length - 1; i >= 0; i--) {
            const fragment = distractionFragments[i];
            fragment.userData.lifetime++;

            fragment.position.add(fragment.userData.velocity);

            fragment.rotation.x += fragment.userData.rotationSpeed.x;
            fragment.rotation.y += fragment.userData.rotationSpeed.y;
            fragment.rotation.z += fragment.userData.rotationSpeed.z;

            fragment.userData.velocity.multiplyScalar(0.98);

            const lifeProgress = fragment.userData.lifetime / fragment.userData.maxLifetime;
            if(fragment.material instanceof THREE.MeshBasicMaterial) {
                fragment.material.opacity = Math.max(0, 1 - lifeProgress);
            }

            if(fragment.userData.lifetime >= fragment.userData.maxLifetime) {
                scene.remove(fragment);
                distractionFragments.splice(i, 1);
            }
        }
    }

    const createAssemblyEffect = (targetPosition: THREE.Vector3, task: any) => {
        const fragments: THREE.Mesh[] = [];
        const fragmentCount = 100;

        for(let i = 0; i<fragmentCount; i++) {
            const fragmentSize = Math.random() * 0.2;
            const fragmentGeometry = new THREE.BoxGeometry(fragmentSize, fragmentSize, fragmentSize);

            const themeColors = taskParticleColors[currentTheme.value];
            const fragmentMaterial = new THREE.MeshBasicMaterial({
                color: task.completed ? themeColors.completed : themeColors.active,
                wireframe: true,
                transparent: true,
                opacity: 0
            })

            const fragment = new THREE.Mesh(fragmentGeometry, fragmentMaterial);
            
            const startRadius = 15;
            fragment.position.copy(targetPosition);
            fragment.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * startRadius,
                (Math.random() - 0.5) * startRadius,
                (Math.random() - 0.5) * startRadius
            ));

            fragment.userData = {
                targetPosition: targetPosition.clone(),
                lifetime: 0,
                maxLifetime: 90,
                isAssembling: true,
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.1,
                    y: (Math.random() - 0.5) * 0.1,
                    z: (Math.random() - 0.5) * 0.1
                }
            }
            scene.add(fragment);
            assemblyFragments.push(fragment);
        }
        return fragments;
    }
    
    const animateAssemblyFragments = () => {
        for(let i = assemblyFragments.length - 1; i >= 0; i--) {
            const fragment = assemblyFragments[i];
            fragment.userData.lifetime++;

            const direction = new THREE.Vector3().subVectors(
                fragment.userData.targetPosition,
                fragment.position
            );
            const speed = 0.03;
            fragment.position.add(direction.multiplyScalar(speed));

            fragment.rotation.x += fragment.userData.rotationSpeed.x;
            fragment.rotation.y += fragment.userData.rotationSpeed.y;
            fragment.rotation.z += fragment.userData.rotationSpeed.z;

            const lifeProgress = fragment.userData.lifetime/fragment.userData.maxLifetime;
            if(fragment.material instanceof THREE.MeshBasicMaterial) {
                fragment.material.opacity = Math.min(1.0, lifeProgress);
            }

            const distanceToTarget = fragment.position.distanceTo(fragment.userData.targetPosition);
            if(fragment.userData.lifetime >= fragment.userData.maxLifetime || distanceToTarget < 0.5) {
                scene.remove(fragment);
                assemblyFragments.splice(i, 1);
            }
        }
    }
    

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

    // ДОБАВИТЬ ЗДЕСЬ функции trigger* (ДО watchers)
const triggerTaskCreation = (task: any) => {
    const particle = taskParticles.find(p => p.userData.taskId === task.id);
    if (particle) {
        // Частица уже скрыта при создании
        createAssemblyEffect(particle.position, task);
        
        // ПОКАЗАТЬ частицу когда сборка действительно завершится
        // maxLifetime: 90 кадров при 60fps = 1500ms
        setTimeout(() => {
            particle.visible = true;
        }, 1500); 
        
        console.log(`Эффект сборки для задачи ${task.id}`);
    }
}

const triggerTaskDeletion = (taskId: number) => {
    const particle = taskParticles.find(p => p.userData.taskId === taskId);
    if (particle) {
        createDistractionEffect(particle);
        console.log(`Эффект разборки для задачи ${taskId}`);
    }
}

const triggerTaskStatusChange = (task: any) => {
    const particle = taskParticles.find(p => p.userData.taskId === task.id);
    if (particle) {
        createDistractionEffect(particle);
        setTimeout(() => {
            createAssemblyEffect(particle.position, task);
        }, 500);
        console.log(`Эффект смены статуса для задачи ${task.id}`);
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
            addSingleTaskParticle(newTask, taskStore.tasks.length - 1);
            
            // ДОБАВИТЬ: эффект создания задачи
            setTimeout(() => {
                triggerTaskCreation(newTask);
            }, 200);
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
        
        newCompletedStates.forEach((isCompleted, index) => {
            const wasCompleted = oldCompletedStates[index];
            
            if (isCompleted !== wasCompleted) {
                updateTaskParticleColor(taskStore.tasks[index].id, isCompleted);
                
                // ДОБАВИТЬ: эффект смены статуса  
                triggerTaskStatusChange(taskStore.tasks[index]);
            }
        });
    }, { deep: true })

    // Функция для обновления цвета конкретной task particle
    const updateTaskParticleColor = (taskId: number, isCompleted: boolean) => {
        const particle = taskParticles.find(p => p.userData.taskId === taskId);
        
        if (particle && particle.material instanceof THREE.MeshBasicMaterial) {
            // Получаем цвет на основе текущей темы и статуса задачи
            const themeColors = taskParticleColors[currentTheme.value];
            const targetColor = isCompleted ? themeColors.completed : themeColors.active;
            
            particle.userData.targetColor = targetColor;
            
            console.log(`Установлен цвет для частицы задачи ${taskId} в теме ${currentTheme.value}: ${isCompleted ? 'выполнено' : 'активно'}`);
        }
    }

    const addSingleTaskParticle = (task: any, index: number) => {
        // ДОБАВЛЯЕМ проверку
        if (!scene) return;
        
        const geometry = new THREE.BoxGeometry(2.5, 2.5, 2.5)
        
        const themeColors = taskParticleColors[currentTheme.value];
        const material = new THREE.MeshBasicMaterial({
            color: task.completed ? themeColors.completed : themeColors.active,
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
            targetColor: task.completed ? themeColors.completed : themeColors.active,
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

        // Скрываем новую частицу до завершения эффекта сборки
        mesh.visible = false;
    }

    const createBackgroundParticles = () => {
        for (let i = 0; i < 50; i++) {
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
            
            const themeColors = taskParticleColors[currentTheme.value];
            const material = new THREE.MeshBasicMaterial({
                color: task.completed ? themeColors.completed : themeColors.active,
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
                targetColor: task.completed ? themeColors.completed : themeColors.active,
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

        // Анимируем эффекты разборки и сборки
        animateFragments();
        animateAssemblyFragments();

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

    // Добавим новый watcher для смены темы
    watch(currentTheme, (newTheme) => {
        // Обновляем цвета всех существующих task particles при смене темы
        updateAllTaskParticleColors();
    }, { immediate: false })

    // Функция для обновления цветов всех task particles
    const updateAllTaskParticleColors = () => {
        const themeColors = taskParticleColors[currentTheme.value];
        
        taskParticles.forEach(particle => {
            if (particle.material instanceof THREE.MeshBasicMaterial) {
                // Находим соответствующую задачу по taskId
                const task = taskStore.tasks.find(t => t.id === particle.userData.taskId);
                
                if (task) {
                    const targetColor = task.completed ? themeColors.completed : themeColors.active;
                    particle.userData.targetColor = targetColor;
                    
                    console.log(`Обновлен цвет частицы задачи ${task.id} для темы ${currentTheme.value}`);
                }
            }
        });
        
        console.log(`Обновлены цвета всех частиц для темы: ${currentTheme.value}`);
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
        updateTaskListBounds,
        createDistractionEffect,
        createAssemblyEffect,
        triggerTaskCreation,
        triggerTaskDeletion,
        triggerTaskStatusChange
    };
}
