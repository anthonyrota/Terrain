import 'regenerator-runtime/runtime';
import { vec3, vec4 } from 'gl-matrix';
import {
    ChunkColorRegion,
    ChunkHeightMapGenerationGeneralParameters,
} from './chunkWorker';
import { FirstPersonCamera } from './FirstPersonCamera';
import { loadTexturePower2 } from './glUtil';
import { ChunkPosition } from './LazyChunkLoader';
import { Terrain } from './Terrain';
import {
    makeTerrainShader,
    TerrainShaderRenderParameters,
} from './terrainShader';
import { toRadians } from './toRadians';
import { makeWaterShader } from './waterShader';

void (async function () {
    const canvas = document.querySelector('.canvas') as HTMLCanvasElement;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false })!;

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
        far: 1450,
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
    const waterHeight =
        chunkHeightMapGenerationGeneralParameters.MAX_HEIGHT *
        chunkHeightMapGenerationGeneralParameters.erosionParameters
            .OCEAN_HEIGHT;

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
        const terrainHeight = terrain.getHeightAtPlayerPosition(
            camera.x,
            camera.z,
        );
        if (camera.y - playerHeight < terrainHeight) {
            camera.y = terrainHeight + playerHeight;
        }
        clear();
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        const terrainChunks = terrain.getVisibleLoadedChunks(camera.frustum);
        const diffuseColor = vec3.normalize(
            vec3.create(),
            vec3.fromValues(0.6, 0.6, 0.74),
        );
        const lightDirection = vec3.normalize(
            vec3.create(),
            vec3.fromValues(0, 1.6, 1.48),
        );
        const fogPower = 1.8;
        const fogColor = vec3.fromValues(1, 1, 1);
        const sharedTerrainRenderValues: Omit<
            TerrainShaderRenderParameters,
            'clippingPlane' | 'isUsingClippingPlane' | `camera${string}`
        > = {
            ambientColor: vec3.fromValues(0.8, 0.8, 0.8),
            diffuseColor,
            lightDirection,
            fogDistance: camera.far,
            fogPower,
            fogColor,
            terrainChunks,
            specularReflectivity: 0.6,
            shineDamping: 10,
        };
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, waterShader.reflectionFramebuffer);
        clear();
        gl.viewport(
            0,
            0,
            reflectionFramebufferWidth,
            reflectionFramebufferHeight,
        );
        camera.reflectAboutY(waterHeight);
        terrainShader.render({
            clippingPlane: vec4.fromValues(0, 1, 0, -waterHeight + 1),
            isUsingClippingPlane: true,
            cameraProjectionMatrix: camera.projectionMatrix,
            cameraViewMatrix: camera.lookAtMatrix,
            cameraPosition: vec3.fromValues(camera.x, camera.y, camera.z),
            ...sharedTerrainRenderValues,
        });
        gl.bindFramebuffer(gl.FRAMEBUFFER, waterShader.refractionFramebuffer);
        clear();
        gl.viewport(
            0,
            0,
            refractionFramebufferWidth,
            refractionFramebufferHeight,
        );
        camera.reflectAboutY(waterHeight);
        terrainShader.render({
            clippingPlane: vec4.fromValues(0, -1, 0, waterHeight + 1),
            isUsingClippingPlane: true,
            cameraProjectionMatrix: camera.projectionMatrix,
            cameraViewMatrix: camera.lookAtMatrix,
            cameraPosition: vec3.fromValues(camera.x, camera.y, camera.z),
            ...sharedTerrainRenderValues,
        });
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        clear();
        gl.viewport(0, 0, canvas.width, canvas.height);
        const cameraPosition = vec3.fromValues(camera.x, camera.y, camera.z);
        terrainShader.render({
            clippingPlane: vec4.create(),
            isUsingClippingPlane: false,
            cameraProjectionMatrix: camera.projectionMatrix,
            cameraViewMatrix: camera.lookAtMatrix,
            cameraPosition,
            ...sharedTerrainRenderValues,
        });
        waterShader.render({
            cameraProjectionMatrix: camera.projectionMatrix,
            cameraViewMatrix: camera.lookAtMatrix,
            cameraPosition,
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
            lightDirection,
            fogDistance: camera.far,
            fogPower,
            fogColor,
            specularReflectivity: 0.6,
            shineDamping: 30,
        });
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
})();
