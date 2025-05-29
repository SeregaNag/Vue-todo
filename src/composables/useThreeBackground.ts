import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';

export function useThreeBackground() {
    const canvasRef = ref<HTMLCanvasElement | null>(null);

    let scene: THREE.Scene
    let camera: THREE.PerspectiveCamera
    let renderer: THREE.WebGLRenderer
    let animationId: number;

    const initThree = () => {
        if (!canvasRef.value) return;

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 50;

        renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.value,
            alpha: true,
            antialias: true,
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);

        const geometry = new THREE.SphereGeometry(1, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.7,
        });

        const testMesh = new THREE.Mesh(geometry, material);
        testMesh.position.set(0, 0, 0);
        scene.add(testMesh);
    }

    const animate = () => {
        animationId = requestAnimationFrame(animate);

        renderer.render(scene, camera);
    }

    const handleResize = () => {
        if (!renderer || !camera) return
        
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
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
