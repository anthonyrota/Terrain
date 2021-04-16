import { CHUNK_WIDTH, CHUNK_DEPTH } from './crateConstants';
import { Disposable } from './Disposable';
import { Frustum } from './Frustum';
import {
    LazyChunkLoader,
    LazyChunkLoaderActions,
    ChunkPosition,
    SerializedChunkPosition,
    serializeChunkPosition,
} from './LazyChunkLoader';
import { TerrainChunk } from './TerrainChunk';
import { TerrainShaderLocations } from './terrainShader';
import {
    GenerateChunkResponse,
    RequestType,
    WPRequest,
    WPResponse,
} from './terrainWorkerTypes';
import { WaterShaderLocations } from './waterShader';
import { ExecutionCanceledError, WorkerPool } from './WorkerPool';

interface TerrainParameters {
    renderDistance: number;
    getPlayerChunkPosition: () => ChunkPosition;
    gl: WebGL2RenderingContext;
    terrainShaderLocations: TerrainShaderLocations;
    waterShaderLocations: WaterShaderLocations;
    seed: number;
    workerCount: number;
}

export class Terrain extends Disposable {
    // eslint-disable-next-line max-len
    private _renderDistance: number;
    private _getPlayerChunkPosition: () => ChunkPosition;
    private _gl: WebGL2RenderingContext;
    private _terrainShaderLocations: TerrainShaderLocations;
    private _waterShaderLocations: WaterShaderLocations;
    private _chunkLoader: LazyChunkLoader;
    private _chunks = new Map<SerializedChunkPosition, TerrainChunk | null>();
    private _chunkWorker: WorkerPool<WPRequest, WPResponse>;

    constructor(parameters: TerrainParameters) {
        super();
        this._renderDistance = parameters.renderDistance;
        this._getPlayerChunkPosition = parameters.getPlayerChunkPosition;
        this._gl = parameters.gl;
        this._terrainShaderLocations = parameters.terrainShaderLocations;
        this._waterShaderLocations = parameters.waterShaderLocations;
        const workerCount = navigator.hardwareConcurrency || 4;
        this._chunkWorker = new WorkerPool<WPRequest, WPResponse>(
            () => new Worker(new URL('./terrainWorker.ts', import.meta.url)),
            workerCount,
        );
        for (let i = 0; i < workerCount; i++) {
            void this._chunkWorker.execute(
                {
                    type: RequestType.SetSeed,
                    seed: parameters.seed,
                },
                this,
            );
        }
        this.add(this._chunkWorker);
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
        const { chunkX, chunkZ } = chunkPosition;
        const serializedChunkPosition = serializeChunkPosition(chunkPosition);
        this._chunks.set(serializedChunkPosition, null);
        const disposable = new Disposable(() => {
            if (this.disposed) {
                return;
            }
            const chunk = this._chunks.get(serializedChunkPosition);
            if (!chunk) {
                return;
            }
            chunk.dispose();
            this._chunks.delete(serializedChunkPosition);
        });
        const request: WPRequest = {
            type: RequestType.GenerateChunk,
            chunkX,
            chunkZ,
        };
        this._chunkWorker
            .execute(request, disposable)
            .then((response) => {
                const {
                    heightMap,
                    vertices,
                    normals,
                    colors,
                    indices,
                } = response as GenerateChunkResponse;
                const chunk = new TerrainChunk({
                    heightMap,
                    vertices,
                    normals,
                    colors,
                    indices,
                    chunkPosition,
                    gl: this._gl,
                    terrainShaderLocations: this._terrainShaderLocations,
                    waterShaderLocations: this._waterShaderLocations,
                });
                this._chunks.set(serializedChunkPosition, chunk);
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
