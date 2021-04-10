import { vec3 } from 'gl-matrix';
import { Box3 } from './Box3';
import {
    ChunkColorRegion,
    ChunkData,
    ChunkGenerationParameters,
    ChunkHeightMapGenerationGeneralParameters,
    ChunkWorkerMethod,
    ChunkWorker,
    createChunkWorker,
} from './chunkWorker';
import { Disposable } from './Disposable';
import { Frustum } from './Frustum';
import * as glUtil from './glUtil';
import {
    LazyChunkLoader,
    LazyChunkLoaderActions,
    ChunkPosition,
    SerializedChunkPosition,
    serializeChunkPosition,
} from './LazyChunkLoader';
import { ExecutionCanceledError } from './WorkerPool';

interface TerrainParameters {
    // eslint-disable-next-line max-len
    chunkHeightMapGenerationGeneralParameters: ChunkHeightMapGenerationGeneralParameters;
    colorRegions: ChunkColorRegion[];
    renderDistance: number;
    getPlayerChunkPosition: () => ChunkPosition;
    gl: WebGLRenderingContext;
    seed: number;
    workerCount: number;
}

export class Terrain extends Disposable {
    // eslint-disable-next-line max-len
    private _chunkHeightMapGenerationGeneralParameters: ChunkHeightMapGenerationGeneralParameters;
    private _colorRegions: ChunkColorRegion[];
    private _renderDistance: number;
    private _getPlayerChunkPosition: () => ChunkPosition;
    private _gl: WebGLRenderingContext;
    private _chunkLoader: LazyChunkLoader;
    private _chunks = new Map<SerializedChunkPosition, TerrainChunk | null>();
    private _chunkWorker: ChunkWorker;

    constructor(parameters: TerrainParameters) {
        super();
        this._chunkHeightMapGenerationGeneralParameters =
            parameters.chunkHeightMapGenerationGeneralParameters;
        this._colorRegions = parameters.colorRegions;
        this._renderDistance = parameters.renderDistance;
        this._getPlayerChunkPosition = parameters.getPlayerChunkPosition;
        this._gl = parameters.gl;
        this._chunkWorker = createChunkWorker({
            seed: parameters.seed,
            workerCount: parameters.workerCount,
        });
        const chunkLoaderActions: LazyChunkLoaderActions = {
            loadChunk: (chunkPosition) => this._loadChunk(chunkPosition),
            setChunkLoadingPriority: () => {},
        };
        this._chunkLoader = new LazyChunkLoader(
            chunkLoaderActions,
            this._renderDistance,
        );
        this.add(this._chunkLoader);
    }

    public update(_dt: number): void {
        const playerChunkPosition = this._getPlayerChunkPosition();
        this._chunkLoader.loadChunksSurroundingPlayerChunkPosition(
            playerChunkPosition,
        );
    }

    public getHeightAtPlayerPosition(x: number, z: number): number {
        const {
            CHUNK_WIDTH,
            CHUNK_DEPTH,
        } = this._chunkHeightMapGenerationGeneralParameters;
        const chunkX = Math.floor(x / CHUNK_WIDTH);
        const chunkZ = Math.floor(z / CHUNK_DEPTH);
        const chunkPosition: ChunkPosition = { chunkX, chunkZ };
        const serializedChunkPosition = serializeChunkPosition(chunkPosition);
        const chunk = this._chunks.get(serializedChunkPosition);
        if (!chunk) {
            return 0;
        }
        return chunk.getHeightAtChunkOffset(
            x - chunkX * CHUNK_WIDTH,
            z - chunkZ * CHUNK_DEPTH,
        );
    }

    public getVisibleLoadedChunks(frustum: Frustum) {
        const visibleLoadedChunks: TerrainChunk[] = [];
        this._chunks.forEach((chunk) => {
            if (!chunk) {
                return;
            }
            if (frustum.collidesWithBox3(chunk.boundingBox)) {
                visibleLoadedChunks.push(chunk);
            }
        });
        return visibleLoadedChunks;
    }

    private _loadChunk(chunkPosition: ChunkPosition): Disposable {
        const {
            CHUNK_WIDTH,
            CHUNK_DEPTH,
            MAX_HEIGHT,
        } = this._chunkHeightMapGenerationGeneralParameters;
        const { chunkX, chunkZ } = chunkPosition;
        const serializedChunkPosition = serializeChunkPosition(chunkPosition);
        this._chunks.set(serializedChunkPosition, null);
        const disposable = new Disposable(() => {
            if (this.disposed) {
                return;
            }
            this._chunks.delete(serializedChunkPosition);
        });
        const parameters: ChunkGenerationParameters = {
            ...this._chunkHeightMapGenerationGeneralParameters,
            chunkX,
            chunkZ,
            colorRegions: this._colorRegions,
        };
        this._chunkWorker
            .execute(
                ChunkWorkerMethod.GENERATE_CHUNK_DATA,
                [parameters],
                disposable,
            )
            .then((chunkData) => {
                this._chunks.set(
                    serializedChunkPosition,
                    new TerrainChunk({
                        chunkData,
                        CHUNK_WIDTH,
                        MAX_HEIGHT,
                        CHUNK_DEPTH,
                        chunkPosition,
                        gl: this._gl,
                    }),
                );
            })
            .catch((error) => {
                if (error instanceof ExecutionCanceledError) {
                    return;
                }
                throw error;
            });
        return disposable;
    }
}

interface TerrainChunkParameters {
    chunkData: ChunkData;
    CHUNK_WIDTH: number;
    CHUNK_DEPTH: number;
    MAX_HEIGHT: number;
    chunkPosition: ChunkPosition;
    gl: WebGLRenderingContext;
}

export class TerrainChunk {
    private _heightMap: Float32Array;
    private _CHUNK_WIDTH: number;
    private _CHUNK_DEPTH: number;
    private _chunkPosition: ChunkPosition;
    private _vertexBuffer: WebGLBuffer;
    private _normalsBuffer: WebGLBuffer;
    private _indicesBuffer: WebGLBuffer;
    private _colorsBuffer: WebGLBuffer;
    private _trianglesCount: number;
    private _boundingBox: Box3;

    public get vertexBuffer(): WebGLBuffer {
        return this._vertexBuffer;
    }
    public get normalsBuffer(): WebGLBuffer {
        return this._normalsBuffer;
    }
    public get indicesBuffer(): WebGLBuffer {
        return this._indicesBuffer;
    }
    public get colorsBuffer(): WebGLBuffer {
        return this._colorsBuffer;
    }
    public get trianglesCount(): number {
        return this._trianglesCount;
    }
    public get boundingBox(): Box3 {
        return this._boundingBox;
    }

    constructor(parameters: TerrainChunkParameters) {
        this._heightMap = parameters.chunkData.heightMap;
        this._CHUNK_WIDTH = parameters.CHUNK_WIDTH;
        this._CHUNK_DEPTH = parameters.CHUNK_DEPTH;
        this._chunkPosition = parameters.chunkPosition;
        this._vertexBuffer = glUtil.createStaticArrayBuffer(
            parameters.gl,
            parameters.chunkData.vertices,
        );
        this._normalsBuffer = glUtil.createStaticArrayBuffer(
            parameters.gl,
            parameters.chunkData.normals,
        );
        this._indicesBuffer = glUtil.createStaticElementArrayBuffer(
            parameters.gl,
            parameters.chunkData.indices,
        );
        this._colorsBuffer = glUtil.createStaticArrayBuffer(
            parameters.gl,
            parameters.chunkData.colors,
        );
        this._trianglesCount = parameters.chunkData.indices.length / 3;
        const boxMin = vec3.fromValues(
            this._chunkPosition.chunkX * this._CHUNK_WIDTH,
            0,
            this._chunkPosition.chunkZ * this._CHUNK_DEPTH,
        );
        const boxMax = vec3.add(
            vec3.create(),
            boxMin,
            vec3.fromValues(
                this._CHUNK_WIDTH,
                parameters.MAX_HEIGHT,
                this._CHUNK_DEPTH,
            ),
        );
        this._boundingBox = new Box3(boxMin, boxMax);
    }

    public getHeightAtChunkOffset(x: number, z: number): number {
        const CHUNK_WIDTH = this._CHUNK_WIDTH;
        const CHUNK_DEPTH = this._CHUNK_DEPTH;
        const DEFAULT = 0;
        const heightMap = this._heightMap;

        if (x < 0 || z < 0) {
            return DEFAULT;
        }

        const floorX = Math.floor(x);
        const floorZ = Math.floor(z);

        if (floorX >= CHUNK_WIDTH || floorZ >= CHUNK_DEPTH) {
            return DEFAULT;
        }

        const gridOffsetX = x - floorX;
        const gridOffsetZ = z - floorZ;

        const heightTopLeft = heightMap[floorZ * (CHUNK_WIDTH + 1) + floorX];
        const heightTopRight =
            heightMap[floorZ * (CHUNK_WIDTH + 1) + (floorX + 1)];
        const heightBottomLeft =
            heightMap[(floorZ + 1) * (CHUNK_WIDTH + 1) + floorX];
        const heightBottomRight =
            heightMap[(floorZ + 1) * (CHUNK_WIDTH + 1) + (floorX + 1)];

        const heightLeft =
            heightTopLeft + (heightBottomLeft - heightTopLeft) * gridOffsetZ;
        const heightRight =
            heightTopRight + (heightBottomRight - heightTopRight) * gridOffsetZ;

        return heightLeft + (heightRight - heightLeft) * gridOffsetX;
    }
}
