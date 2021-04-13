import { vec3, vec4 } from 'gl-matrix';
import {
    ChunkColorRegion,
    ChunkHeightMapGenerationGeneralParameters,
} from './chunkWorker';
import { FirstPersonCamera } from './FirstPersonCamera';
import { ChunkPosition } from './LazyChunkLoader';
import { Terrain } from './Terrain';
import { makeTerrainShader } from './terrainShader';
import { toRadians } from './toRadians';
import { makeWaterShader } from './waterShader';

const canvas = document.querySelector('.canvas') as HTMLCanvasElement;
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const gl = canvas.getContext('webgl2', { antialias: true })!;

if (!gl) {
    throw new Error('WebGL2 not supported.');
}

const blend = 0.6;
const colorRegions: ChunkColorRegion[] = [
    { maxHeight: 0.65 / 7, color: [201 / 255, 178 / 255, 99 / 255], blend },
    { maxHeight: 1.15 / 7, color: [164 / 255, 155 / 255, 98 / 255], blend },
    { maxHeight: 1.7 / 7, color: [164 / 255, 155 / 255, 98 / 255], blend },
    { maxHeight: 2.6 / 7, color: [229 / 255, 219 / 255, 164 / 255], blend },
    { maxHeight: 4 / 7, color: [135 / 255, 184 / 255, 82 / 255], blend },
    { maxHeight: 5.5 / 7, color: [120 / 255, 120 / 255, 120 / 255], blend },
    { maxHeight: 7 / 7, color: [200 / 255, 200 / 255, 210 / 255], blend },
];

const playerHeight = 10;

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
    far: 2450,
    getCanJump: getCanCameraJump,
});

const CHUNK_SIZE = 512;
// eslint-disable-next-line max-len
const chunkHeightMapGenerationGeneralParameters: ChunkHeightMapGenerationGeneralParameters = {
    CHUNK_WIDTH: CHUNK_SIZE,
    CHUNK_DEPTH: CHUNK_SIZE,
    MAX_HEIGHT: 1024,
    OCTAVES: 5,
    PERSISTENCE: 0.25,
    LACUNARITY: 2.5,
    FINENESS: 1024,
    NOISE_SLOPE: 0.84,
    erosionParameters: {
        DROPS_PER_CELL: 0.75,
        EROSION_RATE: 0.1,
        DEPOSITION_RATE: 0.075,
        SPEED: 0.15,
        FRICTION: 0.7,
        RADIUS: 0.8,
        MAX_RAIN_ITERATIONS: 800,
        ITERATION_SCALE: 0.04,
        OCEAN_HEIGHT: 0.37,
        OCEAN_SLOWDOWN: 5,
        EDGE_DAMP_MIN_DISTANCE: 3,
        EDGE_DAMP_MAX_DISTANCE: 10,
        EDGE_DAMP_STRENGTH: 5,
    },
};

const terrainShader = makeTerrainShader(gl);
const waterShader = makeWaterShader(gl);

const terrain = new Terrain({
    chunkHeightMapGenerationGeneralParameters,
    colorRegions,
    getPlayerChunkPosition: (): ChunkPosition => {
        return {
            chunkX: Math.floor(camera.x / CHUNK_SIZE),
            chunkZ: Math.floor(camera.z / CHUNK_SIZE),
        };
    },
    renderDistance: Math.ceil(camera.far / CHUNK_SIZE),
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

resize();
window.addEventListener('resize', resize);
let lastTime = performance.now();
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
    gl.clearColor(1, 1, 1, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    const terrainChunks = terrain.getVisibleLoadedChunks(camera.frustum);
    terrainShader.render({
        clippingPlane: vec4.create(),
        isUsingClippingPlane: false,
        cameraProjectionMatrix: camera.projectionMatrix,
        cameraViewMatrix: camera.lookAtMatrix,
        cameraPosition: vec3.fromValues(camera.x, camera.y, camera.z),
        ambientColor: vec3.fromValues(0.8, 0.8, 0.8),
        diffuseColor: vec3.normalize(
            vec3.create(),
            vec3.fromValues(0.6, 0.6, 0.74),
        ),
        lightDirection: vec3.normalize(
            vec3.create(),
            vec3.fromValues(0, 1.6, 1.48),
        ),
        fogDistance: camera.far,
        fogPower: 1.8,
        fogColor: vec3.fromValues(1, 1, 1),
        terrainChunks,
        specularReflectivity: 0.6,
        shineDamping: 10,
    });
    waterShader.render({
        cameraProjectionMatrix: camera.projectionMatrix,
        cameraViewMatrix: camera.lookAtMatrix,
        terrainChunks,
    });
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
