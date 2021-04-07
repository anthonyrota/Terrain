import { Disposable } from './Disposable';

export interface ChunkPosition {
    chunkX: number;
    chunkZ: number;
}

export interface LazyChunkLoaderActions {
    loadChunk(chunkPosition: ChunkPosition, priority: number): Disposable;
    setChunkLoadingPriority(
        chunkPosition: ChunkPosition,
        priority: number,
    ): void;
}

declare const _SerializedChunkPosition$Symbol: unique symbol;
export type SerializedChunkPosition = string & {
    [_SerializedChunkPosition$Symbol]: void;
};

export function serializeChunkPosition(
    chunkPosition: ChunkPosition,
): SerializedChunkPosition {
    return `${chunkPosition.chunkX},${chunkPosition.chunkZ}` as SerializedChunkPosition;
}

export function parseChunkPosition(
    serializedChunkPosition: SerializedChunkPosition,
): ChunkPosition {
    const { 0: chunkX, 1: chunkZ } = serializedChunkPosition.split(',');
    return {
        chunkX: Number(chunkX),
        chunkZ: Number(chunkZ),
    };
}

export class LazyChunkLoader extends Disposable {
    private _activeChunkSubscriptions = new Map<
        SerializedChunkPosition,
        Disposable
    >();

    constructor(
        private _actions: LazyChunkLoaderActions,
        private _renderDistance: number,
    ) {
        super();
    }

    public loadChunksSurroundingPlayerChunkPosition(
        playerChunk: ChunkPosition,
    ): void {
        this._activeChunkSubscriptions.forEach(
            (disposable, serializedChunkPosition) => {
                const chunkPosition = parseChunkPosition(
                    serializedChunkPosition,
                );
                const distanceX = Math.abs(
                    chunkPosition.chunkX - playerChunk.chunkX,
                );
                if (distanceX > this._renderDistance) {
                    this._activeChunkSubscriptions.delete(
                        serializedChunkPosition,
                    );
                    disposable.dispose();
                    return;
                }
                const distanceZ = Math.abs(
                    chunkPosition.chunkZ - playerChunk.chunkZ,
                );
                if (distanceZ > this._renderDistance) {
                    this._activeChunkSubscriptions.delete(
                        serializedChunkPosition,
                    );
                    disposable.dispose();
                }
            },
        );
        spiralLoop(
            playerChunk.chunkX,
            playerChunk.chunkZ,
            this._renderDistance,
            (chunkX, chunkZ) => {
                const chunkPosition: ChunkPosition = {
                    chunkX,
                    chunkZ,
                };
                const serializedChunkPosition = serializeChunkPosition(
                    chunkPosition,
                );
                const priority =
                    (chunkX - playerChunk.chunkX) ** 2 +
                    (chunkZ - playerChunk.chunkZ) ** 2;
                if (
                    this._activeChunkSubscriptions.has(serializedChunkPosition)
                ) {
                    this._actions.setChunkLoadingPriority(
                        chunkPosition,
                        priority,
                    );
                    return;
                }
                this._activeChunkSubscriptions.set(
                    serializedChunkPosition,
                    this._actions.loadChunk(chunkPosition, priority),
                );
            },
        );
    }

    public dispose(): void {
        this._activeChunkSubscriptions.forEach((disposable) => {
            disposable.dispose();
        });
    }
}

function spiralLoop(
    x: number,
    y: number,
    size: number,
    callback: (x: number, y: number) => void,
): void {
    callback(x, y);
    for (let n = 1; n <= size; n++) {
        x--;
        y--;
        const toTravel = n * 2;
        for (let i = 0; i < toTravel; i++) {
            callback(x + i, y);
        }
        for (let i = 0; i < toTravel; i++) {
            callback(x + toTravel, y + i);
        }
        for (let i = toTravel; i > 0; i--) {
            callback(x + i, y + toTravel);
        }
        for (let i = toTravel; i > 0; i--) {
            callback(x, y + i);
        }
    }
}
