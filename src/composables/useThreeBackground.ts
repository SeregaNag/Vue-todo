import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';

export function useThreeBackground() {
    const canvasRef = ref<HTMLCanvasElement | null>(null);

    let scene: THREE.Scene
    let camera: THREE.PerspectiveCamera
    let renderer: THREE.WebGLRenderer
    let animationId: number;
    let particles: THREE.Mesh[] = [];

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

        const createParticles = () => {
            for (let i = 0; i < 30; i++) {
                // Случайная геометрия
                const geometries = [
                    new THREE.BoxGeometry(1, 1, 1),
                    new THREE.SphereGeometry(0.5, 8, 8),
                    new THREE.ConeGeometry(0.5, 1, 8)
                ]
                
                const geometry = geometries[Math.floor(Math.random() * geometries.length)]
                
                // Случайный цвет
                const material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
                    wireframe: true,
                    transparent: true,
                    opacity: 0.7
                })
                
                const mesh = new THREE.Mesh(geometry, material)
                
                // На центральную позицию
                mesh.position.set(0, 0, 0)
                
                mesh.userData = {
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 0.5,
                        (Math.random() - 0.5) * 0.5,
                        (Math.random() - 0.5) * 0.3
                    ),
                    rotationSpeed: {
                        x: Math.random() * 0.02,
                        y: Math.random() * 0.02
                    }
                }
                
                scene.add(mesh)
                particles.push(mesh)
            }
        }

        createParticles();
    }

    const animate = () => {
        animationId = requestAnimationFrame(animate);

        if(particles.length > 0) {
            particles.forEach(particle => {
                particle.position.add(particle.userData.velocity)
                
                // СТАТИЧНЫЕ границы (без вычислений)
                if (particle.position.x > 40 || particle.position.x < -40) {
                    particle.userData.velocity.x *= -1
                }
                if (particle.position.y > 25 || particle.position.y < -25) {
                    particle.userData.velocity.y *= -1
                }
                if (particle.position.z > 10 || particle.position.z < -10) {
                    particle.userData.velocity.z *= -1
                }
                
                particle.rotation.x += particle.userData.rotationSpeed.x
                particle.rotation.y += particle.userData.rotationSpeed.y
            });
        }

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
        initThree
    };
}
