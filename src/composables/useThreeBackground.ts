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
    
    let isInitialized = false; // флаг для избежания дублирования при инициализации

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
        console.log('🔴 Дезинтеграция Таноса (вокселизация) для частицы:', particle.userData.taskId);
        
        const fragments: THREE.Mesh[] = [];
        
        // Разбиваем куб на воксели 4x4x4 = 64 мини-куба
        const voxelSize = 2.5 / 4; // размер одного вокселя
        const voxelsPerSide = 4;
        
        for(let x = 0; x < voxelsPerSide; x++) {
            for(let y = 0; y < voxelsPerSide; y++) {
                for(let z = 0; z < voxelsPerSide; z++) {
                    // Создаем ВСЕ воксели для двухволновой дезинтеграции
                    
                    const voxelGeometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
                    const voxelMaterial = new THREE.MeshBasicMaterial({
                        color: (particle.material as THREE.MeshBasicMaterial).color.clone(),
                        wireframe: false,
                        transparent: true,
                        opacity: 0.8
                    });
                    
                    const voxel = new THREE.Mesh(voxelGeometry, voxelMaterial);
                    
                    // Позиция вокселя относительно центра куба
                    const localX = (x - voxelsPerSide/2 + 0.5) * voxelSize;
                    const localY = (y - voxelsPerSide/2 + 0.5) * voxelSize;
                    const localZ = (z - voxelsPerSide/2 + 0.5) * voxelSize;
                    
                    voxel.position.copy(particle.position);
                    voxel.position.add(new THREE.Vector3(localX, localY, localZ));
                    
                    // Воксели разлетаются от своей позиции в кубе
                    const velocity = new THREE.Vector3(localX, localY, localZ).normalize();
                    velocity.multiplyScalar(0.05 + Math.random() * 0.1); // скорость 0.05-0.15
                    velocity.y -= 0.05; // легкое падение вниз
                    
                    // Определяем какой волне принадлежит воксель
                    const distanceFromCenter = Math.sqrt(localX*localX + localY*localY + localZ*localZ);
                    const isFirstWave = Math.random() < 0.5; // 50/50 случайно
                    
                    voxel.userData = {
                        velocity: velocity,
                        lifetime: 0,
                        maxLifetime: 240,
                        isDistracting: true,
                        // Первая волна: 0-90 кадров, вторая волна: 90-180 кадров
                        appearDelay: isFirstWave ? 
                            Math.random() * 90 : // первая волна
                            90 + Math.random() * 90, // вторая волна с задержкой
                        isFirstWave: isFirstWave,
                        rotationSpeed: {
                            x: (Math.random() - 0.5) * 0.05,
                            y: (Math.random() - 0.5) * 0.05,
                            z: (Math.random() - 0.5) * 0.05
                        }
                    };
                    
                    scene.add(voxel);
                    distractionFragments.push(voxel);
                }
            }
        }
        
        console.log(`Создано ${distractionFragments.length} вокселей для дезинтеграции`);
        return fragments;
    }

    const animateFragments = () => {
        for(let i = distractionFragments.length - 1; i >= 0; i--) {
            const fragment = distractionFragments[i];
            fragment.userData.lifetime++;

            // Движение с физикой - ветер и гравитация
            fragment.position.add(fragment.userData.velocity);
            
            // Медленная гравитация - падение вниз ускоряется
            fragment.userData.velocity.y -= 0.001;
            
            // Сильное сопротивление воздуха - замедление
            fragment.userData.velocity.multiplyScalar(0.992);

            fragment.rotation.x += fragment.userData.rotationSpeed.x;
            fragment.rotation.y += fragment.userData.rotationSpeed.y;
            fragment.rotation.z += fragment.userData.rotationSpeed.z;

            // Эффект дезинтеграции для разных типов фрагментов
            if(fragment.material instanceof THREE.MeshBasicMaterial) {
                // Для летящих вокселей (isFlying) - сразу видимы
                if (fragment.userData.isFlying) {
                    const visibleProgress = fragment.userData.lifetime / fragment.userData.maxLifetime;
                    
                    // Медленное исчезновение
                    const fadeProgress = Math.pow(visibleProgress, 2); // квадратичное затухание
                    fragment.material.opacity = Math.max(0, 0.8 * (1 - fadeProgress));
                    
                    // Фрагменты слегка уменьшаются со временем
                    const scale = 1 - visibleProgress * 0.2;
                    fragment.scale.setScalar(scale);
                    
                } else if (fragment.userData.lifetime < fragment.userData.appearDelay) {
                    // Старая логика для фрагментов с задержкой появления
                    fragment.material.opacity = 0;
                } else {
                    // Появились - медленно исчезаем как пепел
                    const visibleLifetime = fragment.userData.lifetime - fragment.userData.appearDelay;
                    const visibleProgress = visibleLifetime / (fragment.userData.maxLifetime - fragment.userData.appearDelay);
                    
                    const fadeProgress = Math.pow(visibleProgress, 2); // квадратичное затухание
                    fragment.material.opacity = Math.max(0, 0.8 * (1 - fadeProgress));
                    
                    // Фрагменты слегка уменьшаются со временем
                    const scale = 1 - visibleProgress * 0.2;
                    fragment.scale.setScalar(scale);
                }
            }

            if(fragment.userData.lifetime >= fragment.userData.maxLifetime) {
                scene.remove(fragment);
                distractionFragments.splice(i, 1);
            }
        }
    }

    const createAssemblyEffect = (targetPosition: THREE.Vector3, task: any) => {
        console.log('🔵 createAssemblyEffect вызван для задачи:', task.id, task.title);
        console.trace('🔍 Стек вызовов createAssemblyEffect:');
        
        const fragments: THREE.Mesh[] = [];
        const fragmentCount = 250;

        for(let i = 0; i<fragmentCount; i++) {
            const fragmentSize = 0.05;
            const fragmentGeometry = new THREE.BoxGeometry(fragmentSize, fragmentSize, fragmentSize);

            const themeColors = taskParticleColors[currentTheme.value];
            const fragmentMaterial = new THREE.MeshBasicMaterial({
                color: task.completed ? themeColors.completed : themeColors.active,
                wireframe: false,  // сплошные кубы
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
                targetPosition: new THREE.Vector3(
                    targetPosition.x + (Math.random() - 0.5) * 2.5,  // разброс ±1.25
                    targetPosition.y + (Math.random() - 0.5) * 2.5,  // разброс ±1.25  
                    targetPosition.z + (Math.random() - 0.5) * 2.5   // разброс ±1.25
                ),
                lifetime: 0,
                maxLifetime: 90,
                isAssembling: true,
                appearDelay: Math.random() * 60,  // большая задержка появления
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

            // Плавное появление фрагментов сборки
            if(fragment.material instanceof THREE.MeshBasicMaterial) {
                if (fragment.userData.lifetime < fragment.userData.appearDelay) {
                    // Еще не время появляться
                    fragment.material.opacity = 0;
                } else {
                    // Появились - плавно проявляемся
                    const visibleLifetime = fragment.userData.lifetime - fragment.userData.appearDelay;
                    const visibleProgress = visibleLifetime / (fragment.userData.maxLifetime - fragment.userData.appearDelay);
                    fragment.material.opacity = Math.min(1.0, visibleProgress);
                }
            }

            if(fragment.userData.lifetime >= fragment.userData.maxLifetime) {
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
    // Эффект сборки уже запускается в addSingleTaskParticle
    console.log(`Эффект сборки для задачи ${task.id} уже запущен`);
}

const triggerTaskDeletion = (taskId: number) => {
    const particle = taskParticles.find(p => p.userData.taskId === taskId);
    if (particle) {
        createDistractionEffect(particle);
        console.log(`Эффект разборки для задачи ${taskId}`);
    }
}

const triggerTaskStatusChange = (task: any) => {
    // При смене статуса задачи только плавно меняем цвет частицы
    // Никаких эффектов разборки/сборки
    console.log(`Плавная смена цвета для задачи ${task.id}: ${task.completed ? 'выполнена' : 'активна'}`);
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
    
    // Для отслеживания удаленных задач
    let previousTaskIds: number[] = []

    watch(() => taskStore.tasks.length, (newLength, oldLength) => {
        // Проверяем что уже инициализировано, чтобы избежать срабатывания при старте
        if (!isInitialized) return;
        
        if (newLength > oldLength) {
            const newTask = taskStore.tasks[taskStore.tasks.length - 1];
            addSingleTaskParticle(newTask, taskStore.tasks.length - 1);
            
            // ДОБАВИТЬ: эффект создания задачи
            setTimeout(() => {
                triggerTaskCreation(newTask);
            }, 200);
        } else if (newLength < oldLength) {
            // Находим удаленную задачу
            const currentTaskIds = taskStore.tasks.map(task => task.id);
            const deletedTaskId = previousTaskIds.find(id => !currentTaskIds.includes(id));
            
            if (deletedTaskId) {
                removeSingleTaskParticle(deletedTaskId);
            }
        }
        
        // Обновляем список ID задач
        previousTaskIds = taskStore.tasks.map(task => task.id);
    })

    watch(() => taskStore.tasks, (newTasks) => {
        // ИЗМЕНЯЕМ условие: если количество частиц НЕ равно количеству задач И уже инициализировано
        if (newTasks.length > 0 && taskParticles.length !== newTasks.length) {
            createTaskParticles()
        }
    })

    // ДОБАВЛЯЕМ новый watcher для отслеживания изменений статуса задач
    watch(() => taskStore.tasks.map(task => task.completed), (newCompletedStates, oldCompletedStates) => {
        if (!isInitialized || !newCompletedStates || !oldCompletedStates) return;
        
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
        
        if (particle) {
            // Получаем цвет на основе текущей темы и статуса задачи
            const themeColors = taskParticleColors[currentTheme.value];
            const targetColor = isCompleted ? themeColors.completed : themeColors.active;
            
            particle.userData.targetColor = targetColor;
            
            // Если это воксельный куб, обновляем цвета всех вокселей
            if (particle.userData.voxels) {
                const voxels = particle.userData.voxels as THREE.Mesh[];
                voxels.forEach(voxel => {
                    if (voxel.material instanceof THREE.MeshBasicMaterial) {
                        voxel.userData.targetColor = targetColor;
                    }
                });
            }
            
            console.log(`Установлен цвет для воксельной частицы задачи ${taskId} в теме ${currentTheme.value}: ${isCompleted ? 'выполнено' : 'активно'}`);
        }
    }

    const removeSingleTaskParticle = (taskId: number) => {
        const particleIndex = taskParticles.findIndex(p => p.userData.taskId === taskId);
        
        if (particleIndex !== -1) {
            const particle = taskParticles[particleIndex];
            
            // Если это воксельный куб, запускаем дезинтеграцию вокселей
            if (particle.userData.voxels) {
                startVoxelDisintegration(particle);
            } else {
                // Запускаем старый эффект для обычных кубов
                createDistractionEffect(particle);
                particle.visible = false;
            }
            
            // Удаляем из массива через 5 секунд
            setTimeout(() => {
                scene.remove(particle);
                const currentIndex = taskParticles.findIndex(p => p.userData.taskId === taskId);
                if (currentIndex !== -1) {
                    taskParticles.splice(currentIndex, 1);
                }
            }, 5000);
            
            console.log(`Запущен эффект удаления для задачи ${taskId}`);
        }
    }

    const startVoxelDisintegration = (particle: THREE.Mesh) => {
        console.log('🔴 Воксельная дезинтеграция для частицы:', particle.userData.taskId);
        
        const voxels = particle.userData.voxels as THREE.Mesh[];
        
        // Запускаем все воксели с большими задержками для медленного эффекта
        setTimeout(() => {
            voxels.forEach((voxel, index) => {
                if (voxel) {
                    makeVoxelFly(voxel, Math.random() * 1200); // задержка 0-1200ms
                }
            });
        }, 500);
    }

    const makeVoxelFly = (voxel: THREE.Mesh, delay: number) => {
        setTimeout(() => {
            // Получаем мировую позицию вокселя
            const worldPosition = new THREE.Vector3();
            voxel.getWorldPosition(worldPosition);
            
            // Основное направление - вверх и влево с небольшим разбросом
            const direction = new THREE.Vector3(
                -0.8 + Math.random() * 0.3,     // влево (-0.8 до -0.5)
                0.6 + Math.random() * 0.4,      // вверх (0.6 до 1.0)
                (Math.random() - 0.5) * 0.4     // небольшой разброс по глубине
            ).normalize();
            
            // Добавляем воксель в список летящих фрагментов
            voxel.userData = {
                ...voxel.userData,
                velocity: direction.multiplyScalar(0.08 + Math.random() * 0.12), // медленная скорость 0.08-0.20
                lifetime: 0,
                maxLifetime: 420, // дольше живут
                isFlying: true,
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.05, // медленнее вращаются
                    y: (Math.random() - 0.5) * 0.05,
                    z: (Math.random() - 0.5) * 0.05
                }
            };
            
            // Удаляем из группы куба и добавляем в сцену как отдельный объект
            const parent = voxel.parent!;
            parent.remove(voxel);
            voxel.position.copy(worldPosition);
            scene.add(voxel);
            distractionFragments.push(voxel);
            
            console.log(`💥 Воксель летит влево от позиции:`, worldPosition, 'с направлением:', direction);
            
        }, delay);
    }

    const createVoxelCube = (task: any) => {
        // Создаем группу для всего куба
        const cubeGroup = new THREE.Group();
        const voxels: THREE.Mesh[] = [];
        
        const voxelSize = 2.5 / 4; // 4x4x4 воксели
        const voxelsPerSide = 4;
        
        const themeColors = taskParticleColors[currentTheme.value];
        const baseColor = task.completed ? themeColors.completed : themeColors.active;
        
        for(let x = 0; x < voxelsPerSide; x++) {
            for(let y = 0; y < voxelsPerSide; y++) {
                for(let z = 0; z < voxelsPerSide; z++) {
                    const voxelGeometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
                    const voxelMaterial = new THREE.MeshBasicMaterial({
                        color: baseColor,
                        wireframe: false,
                        transparent: true,
                        opacity: 0.8
                    });
                    
                    const voxel = new THREE.Mesh(voxelGeometry, voxelMaterial);
                    
                    // Позиция вокселя в кубе
                    const localX = (x - voxelsPerSide/2 + 0.5) * voxelSize;
                    const localY = (y - voxelsPerSide/2 + 0.5) * voxelSize;
                    const localZ = (z - voxelsPerSide/2 + 0.5) * voxelSize;
                    
                    voxel.position.set(localX, localY, localZ);
                    
                    cubeGroup.add(voxel);
                    voxels.push(voxel);
                }
            }
        }
        
        return { cubeGroup, voxels };
    }

    const addSingleTaskParticle = (task: any, index: number) => {
        // ДОБАВЛЯЕМ проверку
        if (!scene) return;
        
        // Создаем воксельный куб
        const { cubeGroup, voxels } = createVoxelCube(task);
        
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
        
        cubeGroup.position.set(startX, startY, (Math.random() - 0.5) * 10)
        
        // Обычная случайная скорость
        cubeGroup.userData = {
            taskId: task.id,
            targetColor: task.completed ? taskParticleColors[currentTheme.value].completed : taskParticleColors[currentTheme.value].active,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.1
            ),
            rotationSpeed: {
                x: Math.random() * 0.015,
                y: Math.random() * 0.015
            },
            voxels: voxels // сохраняем ссылки на воксели
        }
        
        scene.add(cubeGroup)
        taskParticles.push(cubeGroup as any)

        // Скрываем новую частицу до завершения эффекта сборки
        cubeGroup.visible = false;
        
        // Запускаем эффект сборки сразу
        createAssemblyEffect(cubeGroup.position, task);
        
        // Показываем частицу через 1800ms после начала эффекта
        setTimeout(() => {
            cubeGroup.visible = true;
        }, 1800);
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
                wireframe: false,  // сплошные фигуры
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
        
        console.log(`🟢 createTaskParticles вызвана: ${taskStore.tasks.length} задач найдено`);
        console.trace('🔍 Стек вызовов createTaskParticles:');
        
        // Очищаем старые частицы задач
        taskParticles.forEach(particle => {
            scene.remove(particle)
        })
        taskParticles = []
        
        // Создаём по частице на каждую задачу
        taskStore.tasks.forEach((task, index) => {  
            // Создаем воксельный куб
            const { cubeGroup, voxels } = createVoxelCube(task);
            
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
            
            cubeGroup.position.set(startX, startY, (index * 2) % 10 - 5)  // разные Z
            
            cubeGroup.userData = {
                taskId: task.id,
                targetColor: task.completed ? taskParticleColors[currentTheme.value].completed : taskParticleColors[currentTheme.value].active,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.1
                ),
                rotationSpeed: {
                    x: Math.random() * 0.015,
                    y: Math.random() * 0.015
                },
                voxels: voxels // сохраняем ссылки на воксели
            }
            
            // Изначально частица невидима до завершения эффекта сборки
            cubeGroup.visible = false;
            
            scene.add(cubeGroup)
            taskParticles.push(cubeGroup as any)
            
            // Запускаем эффект сборки сразу для всех частиц
            createAssemblyEffect(cubeGroup.position, task);
            
            // Показываем частицу через 1800ms после начала эффекта
            setTimeout(() => {
                cubeGroup.visible = true;
            }, 1800);
            
            console.log(`Создана воксельная частица для задачи ${task.id}: "${task.title}" (${task.completed ? 'завершена' : 'активна'})`);
        })
        
        console.log(`Всего создано частиц задач: ${taskParticles.length}`);
        
        // Устанавливаем флаг инициализации только если есть реальные задачи
        if (!isInitialized && taskStore.tasks.length > 0) {
            isInitialized = true;
            // Инициализируем список ID задач
            previousTaskIds = taskStore.tasks.map(task => task.id);
            console.log('✅ Инициализация завершена с задачами:', taskStore.tasks.length);
        }
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

        // Анимируем частицы задач (воксельные кубы)
        taskParticles.forEach(particle => {
            if (!particle.visible) return; // НЕ двигаем скрытые частицы
            
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
            
            // ПЛАВНАЯ анимация цвета для воксельных кубов
            if (particle.userData.targetColor !== undefined) {
                const targetColor = new THREE.Color(particle.userData.targetColor);
                
                // Обновляем цвета всех вокселей в кубе
                if (particle.userData.voxels) {
                    const voxels = particle.userData.voxels as THREE.Mesh[];
                    let allVoxelsReachedTarget = true;
                    
                    voxels.forEach(voxel => {
                        if (voxel.material instanceof THREE.MeshBasicMaterial) {
                            const currentColor = voxel.material.color;
                            
                            // Плавная интерполяция к целевому цвету
                            currentColor.lerp(targetColor, 0.05); // 0.05 = скорость перехода
                            
                            // Проверяем близость
                            const rDiff = Math.abs(currentColor.r - targetColor.r);
                            const gDiff = Math.abs(currentColor.g - targetColor.g);
                            const bDiff = Math.abs(currentColor.b - targetColor.b);
                            
                            if (rDiff >= 0.01 || gDiff >= 0.01 || bDiff >= 0.01) {
                                allVoxelsReachedTarget = false;
                            }
                        }
                    });
                    
                    // Если все воксели достигли целевого цвета, убираем таргет
                    if (allVoxelsReachedTarget) {
                        delete particle.userData.targetColor;
                    }
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
            // Находим соответствующую задачу по taskId
            const task = taskStore.tasks.find(t => t.id === particle.userData.taskId);
            
            if (task) {
                const targetColor = task.completed ? themeColors.completed : themeColors.active;
                particle.userData.targetColor = targetColor;
                
                // Обновляем цвета всех вокселей в кубе
                if (particle.userData.voxels) {
                    const voxels = particle.userData.voxels as THREE.Mesh[];
                    voxels.forEach(voxel => {
                        if (voxel.material instanceof THREE.MeshBasicMaterial) {
                            voxel.userData.targetColor = targetColor;
                        }
                    });
                }
                
                console.log(`Обновлен цвет воксельной частицы задачи ${task.id} для темы ${currentTheme.value}`);
            }
        });
        
        console.log(`Обновлены цвета всех воксельных частиц для темы: ${currentTheme.value}`);
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
