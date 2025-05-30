import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { useTaskStore } from '../store/taskStore';
import { watch, computed } from 'vue';
import type { Task } from '../types/task';
import { useThemeColors } from './useThemeColors';

export function useThreeBackground() {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const { currentTheme, themes } = useThemeColors();

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
    }, { immediate: true })

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
        })
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
            
            if (particle.position.x > 70 || particle.position.x < -70) {
                particle.userData.velocity.x *= -1
            }
            if (particle.position.y > 32 || particle.position.y < -30) {
                particle.userData.velocity.y *= -1
            }
            if (particle.position.z > 10 || particle.position.z < -10) {
                particle.userData.velocity.z *= -1
            }
            
            particle.rotation.x += particle.userData.rotationSpeed.x
            particle.rotation.y += particle.userData.rotationSpeed.y
        });

        // Анимируем частицы задач
        taskParticles.forEach(particle => {
            particle.position.add(particle.userData.velocity)
            
            // Те же границы
            if (particle.position.x > 70 || particle.position.x < -70) {
                particle.userData.velocity.x *= -1
            }
            if (particle.position.y > 32 || particle.position.y < -30) {
                particle.userData.velocity.y *= -1
            }
            if (particle.position.z > 10 || particle.position.z < -10) {
                particle.userData.velocity.z *= -1
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
        themes
    };
}
