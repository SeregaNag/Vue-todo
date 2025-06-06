import * as THREE from 'three';

export function useCoordinateConverter() {
    const screenToThreeJS = (screenX: number, screenY: number, screenWidth: number, screenHeight: number, camera: THREE.PerspectiveCamera) => {
        const normalizedX = (screenX / screenWidth) * 2 - 1;
        const normalizedY = -(screenY / screenHeight) * 2 + 1;

        const distance = camera.position.z;

        const vFOV = THREE.MathUtils.degToRad(camera.fov);
        const height = 2 * Math.tan(vFOV / 2) * distance;
        const width = height * camera.aspect;

        const threeX = (normalizedX * width) / 2;
        const threeY = (normalizedY * height) / 2;

        return {
            x: threeX,
            y: threeY,
        }
    }

    return {
        screenToThreeJS,
    }
}