import { vec3, vec4, mat4 } from 'gl-matrix';
import {
    CHUNK_DEPTH,
    CHUNK_WIDTH,
    EROSION_OCEAN_HEIGHT,
    MAX_HEIGHT,
} from './crateConstants';
import { FirstPersonCamera } from './FirstPersonCamera';
import { loadTexturePower2 } from './glUtil';
import { ChunkPosition } from './LazyChunkLoader';
import { makeSkyShader } from './skyShader';
import { Terrain } from './Terrain';
import {
    makeTerrainShader,
    TerrainShaderRenderParameters,
} from './terrainShader';
import { toRadians } from './toRadians';
import { makeWaterShader } from './waterShader';

const canvas = document.querySelector('.canvas') as HTMLCanvasElement;
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false })!;

if (!gl) {
    throw new Error('WebGL2 not supported.');
}

const playerHeight = 2.5;

function getCanCameraJump(): boolean {
    return (
        camera.y - playerHeight <=
        terrain.getHeightAtPlayerPosition(camera.x, camera.z) + 0.2
    );
}

const camera = new FirstPersonCamera({
    canvas,
    horizontalSpeed: 1000,
    verticalSpeed: 300,
    maxFallSpeed: 600,
    gravity: 600,
    horizontalDrag: 0.8 / 1000,
    fov: toRadians(75),
    sensitivity: 180 / 50000,
    aspect: canvas.width / canvas.height,
    near: 0.1,
    far: 1000,
    getCanJump: getCanCameraJump,
});

const waterHeight = MAX_HEIGHT * EROSION_OCEAN_HEIGHT;

const skyShader = makeSkyShader(gl);
const terrainShader = makeTerrainShader(gl);
const reflectionFramebufferWidth = 512;
const reflectionFramebufferHeight = 512;
const refractionFramebufferWidth = 512;
const refractionFramebufferHeight = 512;
const waterShader = makeWaterShader(gl, {
    reflectionFramebufferWidth,
    reflectionFramebufferHeight,
    refractionFramebufferWidth,
    refractionFramebufferHeight,
});

const terrain = new Terrain({
    getPlayerChunkPosition: (): ChunkPosition => {
        return {
            chunkX: Math.floor(camera.x / CHUNK_WIDTH),
            chunkZ: Math.floor(camera.z / CHUNK_DEPTH),
        };
    },
    renderDistance: Math.ceil(camera.far / ((CHUNK_WIDTH + CHUNK_DEPTH) / 2)),
    gl,
    terrainShaderLocations: terrainShader.locations,
    waterShaderLocations: waterShader.locations,
    seed: Math.random(),
    workerCount: navigator.hardwareConcurrency || 4,
});

function resize(): void {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.aspect = canvas.width / canvas.height;
}

function clear(): void {
    gl.clearColor(1, 1, 1, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
}

resize();
window.addEventListener('resize', resize);
const startTime = performance.now();
let lastTime = startTime;
terrain.update(0);
const [waterDuDvTexture, waterNormalTexture] = await Promise.all([
    loadTexturePower2(gl, '/water_duDv.png'),
    loadTexturePower2(gl, '/water_normal.png'),
]);
function loop(): void {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    camera.update(dt);
    terrain.update(dt);
    const terrainHeight = terrain.getHeightAtPlayerPosition(camera.x, camera.z);
    if (camera.y - playerHeight < terrainHeight) {
        camera.y = terrainHeight + playerHeight;
    }
    clear();
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    const terrainChunks = terrain.getVisibleLoadedChunks(camera.frustum);
    const diffuseColor = vec3.fromValues(0.6, 0.6, 0.74);
    const sunRepetition = 50000;
    const sunDaySpeedupFactor = 0.867;
    const sunAngleFactor = ((now - startTime) % sunRepetition) / sunRepetition;
    let sunAngle: number;
    if (sunAngleFactor <= sunDaySpeedupFactor) {
        sunAngle = (sunAngleFactor / sunDaySpeedupFactor) * Math.PI;
    } else {
        sunAngle =
            Math.PI +
            ((sunAngleFactor - sunDaySpeedupFactor) /
                (1.0 - sunDaySpeedupFactor)) *
                Math.PI;
    }
    const sunPosition = vec3.normalize(
        vec3.create(),
        vec3.fromValues(Math.cos(sunAngle), Math.sin(sunAngle), 0),
    );
    const fogPower = 6;
    const atmosphereCutoffFactor = 0.05;
    const sharedTerrainRenderValues: Omit<
        TerrainShaderRenderParameters,
        'clippingPlane' | 'isUsingClippingPlane' | `camera${string}`
    > = {
        ambientColor: vec3.fromValues(0.4, 0.4, 0.4),
        diffuseColor,
        sunPosition,
        fogDistance: camera.far,
        fogPower,
        terrainChunks,
        specularReflectivity: 0.2,
        shineDamping: 60,
        atmosphereCutoffFactor,
    };
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, waterShader.reflectionFramebuffer);
    clear();
    gl.viewport(0, 0, reflectionFramebufferWidth, reflectionFramebufferHeight);
    camera.reflectAboutY(waterHeight);
    terrainShader.render({
        clippingPlane: vec4.fromValues(0, 1, 0, -waterHeight + 1),
        isUsingClippingPlane: true,
        cameraProjectionMatrix: camera.projectionMatrix,
        cameraViewMatrix: camera.lookAtMatrix,
        cameraPosition: camera.xyz,
        ...sharedTerrainRenderValues,
    });
    function calculateViewDirProjInverseMatrix(): mat4 {
        const viewDirProjInverseMatrix = mat4.copy(
            mat4.create(),
            camera.lookAtMatrix,
        );
        // Only care about direction so remove translation.
        viewDirProjInverseMatrix[12] = 0;
        viewDirProjInverseMatrix[13] = 0;
        viewDirProjInverseMatrix[14] = 0;
        mat4.multiply(
            viewDirProjInverseMatrix,
            camera.projectionMatrix,
            viewDirProjInverseMatrix,
        );
        mat4.invert(viewDirProjInverseMatrix, viewDirProjInverseMatrix);
        return viewDirProjInverseMatrix;
    }
    skyShader.render({
        viewDirProjInverseMatrix: calculateViewDirProjInverseMatrix(),
        sunPosition,
        atmosphereCutoffFactor,
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, waterShader.refractionFramebuffer);
    clear();
    gl.viewport(0, 0, refractionFramebufferWidth, refractionFramebufferHeight);
    camera.reflectAboutY(waterHeight);
    terrainShader.render({
        clippingPlane: vec4.fromValues(0, -1, 0, waterHeight + 1),
        isUsingClippingPlane: true,
        cameraProjectionMatrix: camera.projectionMatrix,
        cameraViewMatrix: camera.lookAtMatrix,
        cameraPosition: camera.xyz,
        ...sharedTerrainRenderValues,
    });
    skyShader.render({
        viewDirProjInverseMatrix: calculateViewDirProjInverseMatrix(),
        sunPosition,
        atmosphereCutoffFactor,
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    clear();
    gl.viewport(0, 0, canvas.width, canvas.height);
    terrainShader.render({
        clippingPlane: vec4.create(),
        isUsingClippingPlane: false,
        cameraProjectionMatrix: camera.projectionMatrix,
        cameraViewMatrix: camera.lookAtMatrix,
        cameraPosition: camera.xyz,
        ...sharedTerrainRenderValues,
    });
    waterShader.render({
        cameraProjectionMatrix: camera.projectionMatrix,
        cameraViewMatrix: camera.lookAtMatrix,
        cameraPosition: camera.xyz,
        near: camera.near,
        far: camera.far,
        blendDistance: 25,
        terrainChunks,
        duDvTexture: waterDuDvTexture,
        duDvTiling: 3,
        normalTexture: waterNormalTexture,
        time: now - startTime,
        waveSpeed: 0.00003,
        waveStrength: 0.02,
        reflectivity: 2,
        waterColor: vec3.fromValues(0.0, 0.3, 0.8),
        waterColorStrength: 0.2,
        diffuseColor,
        sunPosition,
        fogDistance: camera.far,
        fogPower,
        specularReflectivity: 0.6,
        shineDamping: 30,
        atmosphereCutoffFactor,
    });
    skyShader.render({
        viewDirProjInverseMatrix: calculateViewDirProjInverseMatrix(),
        sunPosition,
        atmosphereCutoffFactor,
    });
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
