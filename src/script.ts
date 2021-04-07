import {
    chunkWorker,
    ChunkColorRegion,
    ChunkWorkerMethod,
    ChunkHeightMapGenerationGeneralParameters,
} from './Chunk';
import { Disposable } from './Disposable';
import { FirstPersonCamera } from './FirstPersonCamera';
import { ChunkPosition } from './LazyChunkLoader';
import { Terrain } from './Terrain';
import { toRadians } from './toRadians';

const canvas = document.querySelector('.canvas') as HTMLCanvasElement;

const PIXEL_SIZE = 1;

const CHUNK_SIZE = 256;
const MAX_HEIGHT = 256;

canvas.width = (CHUNK_SIZE + 1) * PIXEL_SIZE;
canvas.height = (CHUNK_SIZE + 1) * PIXEL_SIZE;

const blend = 0.6;
const colorRegions: ChunkColorRegion[] = [
    {
        maxHeight: 1.25 / 7,
        color: [201 / 255, 178 / 255, 99 / 255],
        blend,
    },
    {
        maxHeight: 1.75 / 7,
        color: [164 / 255, 155 / 255, 98 / 255],
        blend,
    },
    {
        maxHeight: 2.2 / 7,
        color: [164 / 255, 155 / 255, 98 / 255],
        blend,
    },
    {
        maxHeight: 3 / 7,
        color: [229 / 255, 219 / 255, 164 / 255],
        blend,
    },
    {
        maxHeight: 4.5 / 7,
        color: [135 / 255, 184 / 255, 82 / 255],
        blend,
    },
    {
        maxHeight: 5.6 / 7,
        color: [120 / 255, 120 / 255, 120 / 255],
        blend,
    },
    {
        maxHeight: 7 / 7,
        color: [200 / 255, 200 / 255, 210 / 255],
        blend,
    },
];

function getCanCameraJump(): boolean {
    return (
        camera.y <= terrain.getHeightAtPlayerPosition(camera.x, camera.z) + 0.2
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
    sensitivity: 180 / 600,
    aspect: canvas.width / canvas.height,
    near: 0.1,
    far: 500,
    getCanJump: getCanCameraJump,
});

// eslint-disable-next-line max-len
const chunkHeightMapGenerationGeneralParameters: ChunkHeightMapGenerationGeneralParameters = {
    CHUNK_WIDTH: CHUNK_SIZE,
    CHUNK_DEPTH: CHUNK_SIZE,
    MAX_HEIGHT,
    OCTAVES: 4,
    PERSISTENCE: 0.4,
    LACUNARITY: 3,
    FINENESS: 100,
    erosionParameters: {
        DROPS_PER_CELL: 0.75,
        EROSION_RATE: 0.04,
        DEPOSITION_RATE: 0.03,
        SPEED: 0.15,
        FRICTION: 0.7,
        RADIUS: 0.8,
        MAX_RAIN_ITERATIONS: 800,
        ITERATION_SCALE: 0.04,
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
});

function resize(): void {
    // canvas.width = window.innerWidth;
    // canvas.height = window.innerHeight;
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
    if (camera.y < terrainHeight) {
        camera.y = terrainHeight;
    }
    setTimeout(loop, 100);
}
requestAnimationFrame(loop);

chunkWorker
    .execute(
        ChunkWorkerMethod.GENERATE_CHUNK_DATA,
        [
            {
                ...chunkHeightMapGenerationGeneralParameters,
                chunkX: 0,
                chunkZ: 0,
                colorRegions,
            },
        ],
        new Disposable(),
    )
    .then(({ colors }) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const context = canvas.getContext('2d')!;
        const imageData = context.createImageData(canvas.width, canvas.height);
        const pixels = imageData.data;
        for (let x = 0; x <= CHUNK_SIZE; x++) {
            for (let z = 0; z <= CHUNK_SIZE; z++) {
                const colorR = 255 * colors[(z * (CHUNK_SIZE + 1) + x) * 3];
                const colorG = 255 * colors[(z * (CHUNK_SIZE + 1) + x) * 3 + 1];
                const colorB = 255 * colors[(z * (CHUNK_SIZE + 1) + x) * 3 + 2];
                for (let xOffset = 0; xOffset < PIXEL_SIZE; xOffset++) {
                    for (let zOffset = 0; zOffset < PIXEL_SIZE; zOffset++) {
                        const pointer =
                            ((z * PIXEL_SIZE + zOffset) *
                                (CHUNK_SIZE + 1) *
                                PIXEL_SIZE +
                                (x * PIXEL_SIZE + xOffset)) *
                            4;
                        pixels[pointer] = colorR;
                        pixels[pointer + 1] = colorG;
                        pixels[pointer + 2] = colorB;
                        pixels[pointer + 3] = 255;
                    }
                }
            }
        }
        context.putImageData(imageData, 0, 0);
    })
    .catch(console.error);
