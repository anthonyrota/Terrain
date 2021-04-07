import {
    ChunkColorRegion,
    ChunkData,
    ChunkGenerationParameters,
    ChunkHeightMapGenerationGeneralParameters,
    chunkWorker,
    ChunkWorkerMethod,
} from './Chunk';
import { Disposable } from './Disposable';
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
}

export class Terrain extends Disposable {
    // eslint-disable-next-line max-len
    private _chunkHeightMapGenerationGeneralParameters: ChunkHeightMapGenerationGeneralParameters;
    private _colorRegions: ChunkColorRegion[];
    private _renderDistance: number;
    private _getPlayerChunkPosition: () => ChunkPosition;
    private _chunkLoader: LazyChunkLoader;
    private _chunks = new Map<SerializedChunkPosition, TerrainChunk | null>();

    constructor(parameters: TerrainParameters) {
        super();
        this._chunkHeightMapGenerationGeneralParameters =
            parameters.chunkHeightMapGenerationGeneralParameters;
        this._colorRegions = parameters.colorRegions;
        this._renderDistance = parameters.renderDistance;
        this._getPlayerChunkPosition = parameters.getPlayerChunkPosition;
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

    private _loadChunk(chunkPosition: ChunkPosition): Disposable {
        const {
            CHUNK_WIDTH,
            CHUNK_DEPTH,
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
        chunkWorker
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
                        CHUNK_WIDTH: CHUNK_WIDTH,
                        CHUNK_DEPTH: CHUNK_DEPTH,
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
}

class TerrainChunk {
    private _chunkData: ChunkData;
    private _CHUNK_WIDTH: number;
    private _CHUNK_DEPTH: number;

    constructor(parameters: TerrainChunkParameters) {
        this._chunkData = parameters.chunkData;
        this._CHUNK_WIDTH = parameters.CHUNK_WIDTH;
        this._CHUNK_DEPTH = parameters.CHUNK_DEPTH;
    }

    public getHeightAtChunkOffset(x: number, z: number): number {
        const CHUNK_WIDTH = this._CHUNK_WIDTH;
        const CHUNK_DEPTH = this._CHUNK_DEPTH;
        const DEFAULT = 0;
        const heightMap = this._chunkData.heightMap;

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

    public get vertices(): Float32Array {
        return this._chunkData.vertices;
    }

    public get normals(): Float32Array {
        return this._chunkData.normals;
    }

    public get indices(): Uint16Array {
        return this._chunkData.indices;
    }

    public get colors(): Float32Array {
        return this._chunkData.colors;
    }
}
