import { vec3, vec4 } from 'gl-matrix';
import {
    ChunkColorRegion,
    ChunkHeightMapGenerationGeneralParameters,
} from './chunkWorker';
import { FirstPersonCamera } from './FirstPersonCamera';
import * as glUtil from './glUtil';
import { ChunkPosition } from './LazyChunkLoader';
import { Terrain } from './Terrain';
import { makeTerrainShader } from './terrainShader';
import { toRadians } from './toRadians';

const canvas = document.querySelector('.canvas') as HTMLCanvasElement;
const gl =
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    canvas.getContext('webgl') ||
    (canvas.getContext('experimental-webgl') as WebGLRenderingContext);

if (!gl.getExtension('OES_element_index_uint')) {
    throw new Error('Large WebGL indices not supported.');
}

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const blend = 0.6;
const colorRegions: ChunkColorRegion[] = [
    {
        maxHeight: 0.65 / 7,
        color: [201 / 255, 178 / 255, 99 / 255],
        blend,
    },
    {
        maxHeight: 1.15 / 7,
        color: [164 / 255, 155 / 255, 98 / 255],
        blend,
    },
    {
        maxHeight: 1.7 / 7,
        color: [164 / 255, 155 / 255, 98 / 255],
        blend,
    },
    {
        maxHeight: 2.6 / 7,
        color: [229 / 255, 219 / 255, 164 / 255],
        blend,
    },
    {
        maxHeight: 4 / 7,
        color: [135 / 255, 184 / 255, 82 / 255],
        blend,
    },
    {
        maxHeight: 5.5 / 7,
        color: [120 / 255, 120 / 255, 120 / 255],
        blend,
    },
    {
        maxHeight: 7 / 7,
        color: [200 / 255, 200 / 255, 210 / 255],
        blend,
    },
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
    horizontalSpeed: 500,
    verticalSpeed: 200,
    maxFallSpeed: 600,
    gravity: 600,
    horizontalDrag: 0.8 / 1000,
    fov: toRadians(75),
    sensitivity: 180 / 50000,
    aspect: canvas.width / canvas.height,
    near: 0.1,
    far: 1450,
    getCanJump: getCanCameraJump,
});

const CHUNK_SIZE = 1024;
// eslint-disable-next-line max-len
const chunkHeightMapGenerationGeneralParameters: ChunkHeightMapGenerationGeneralParameters = {
    CHUNK_WIDTH: CHUNK_SIZE,
    CHUNK_DEPTH: CHUNK_SIZE,
    MAX_HEIGHT: 1000,
    OCTAVES: 5,
    PERSISTENCE: 0.25,
    LACUNARITY: 2.5,
    FINENESS: 900,
    NOISE_SLOPE: 0.84,
    erosionParameters: {
        DROPS_PER_CELL: 0.75,
        EROSION_RATE: 0.1,
        DEPOSITION_RATE: 0.085,
        SPEED: 0.15,
        FRICTION: 0.7,
        RADIUS: 2,
        MAX_RAIN_ITERATIONS: 800,
        ITERATION_SCALE: 0.08,
    },
};

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
});

function resize(): void {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.aspect = canvas.width / canvas.height;
}

const terrainShader = makeTerrainShader(gl);

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
    glUtil.clear(gl, vec4.fromValues(1, 1, 1, 1));
    terrainShader.render({
        clippingPlane: vec4.create(),
        isUsingClippingPlane: false,
        cameraProjectionMatrix: camera.projectionMatrix,
        cameraViewMatrix: camera.lookAtMatrix,
        cameraPosition: vec3.fromValues(camera.x, camera.y, camera.z),
        ambientColor: vec3.fromValues(0.7, 0.7, 0.7),
        diffuseColor: vec3.normalize(
            vec3.create(),
            vec3.fromValues(0.4, 0.4, 0.54),
        ),
        lightDirection: vec3.normalize(
            vec3.create(),
            vec3.fromValues(0, 1.6, 1.48),
        ),
        fogDistance: camera.far,
        fogPower: 1.8,
        fogColor: vec3.fromValues(1, 1, 1),
        terrainChunks: terrain.getVisibleLoadedChunks(camera.frustum),
        specularReflectivity: 0.6,
        shineDamping: 10,
    });
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
