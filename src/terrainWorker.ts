import { CHUNK_DEPTH, CHUNK_WIDTH } from './crateConstants';
import {
    Request,
    RequestType,
    SetSeedRequest,
    SetSeedResponse,
    GenerateChunkRequest,
    GenerateChunkResponse,
} from './terrainWorkerTypes';

const importsP = Promise.all([
    import('../crate/pkg/index_bg.wasm'),
    import('../crate/pkg'),
]);

async function generateChunk(request: GenerateChunkRequest): Promise<void> {
    const { requestId, chunkX, chunkZ } = request;
    const [wasm, crate] = await importsP;
    const chunkData = crate.gen_chunk_data(chunkX, chunkZ);
    const heightMapArrayLength = (CHUNK_WIDTH + 1) * (CHUNK_DEPTH + 1);
    const vertexArrayLength = heightMapArrayLength * 3;
    const indicesArrayLength = CHUNK_WIDTH * CHUNK_DEPTH * 6;
    const heightMap = new Float32Array(
        wasm.memory.buffer,
        chunkData.height_map,
        heightMapArrayLength,
    ).slice();
    const vertices = new Float32Array(
        wasm.memory.buffer,
        chunkData.vertices,
        vertexArrayLength,
    ).slice();
    const normals = new Float32Array(
        wasm.memory.buffer,
        chunkData.normals,
        vertexArrayLength,
    ).slice();
    const colors = new Float32Array(
        wasm.memory.buffer,
        chunkData.colors,
        vertexArrayLength,
    ).slice();
    const indices = new Uint32Array(
        wasm.memory.buffer,
        chunkData.indices,
        indicesArrayLength,
    ).slice();
    chunkData.free();
    const response: GenerateChunkResponse = {
        type: RequestType.GenerateChunk,
        requestId,
        heightMap,
        vertices,
        normals,
        colors,
        indices,
    };
    console.log(response);
    // eslint-disable-next-line max-len
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    (self as any).postMessage(response, [
        heightMap.buffer,
        vertices.buffer,
        normals.buffer,
        colors.buffer,
        indices.buffer,
    ]);
}

async function setSeed(request: SetSeedRequest): Promise<void> {
    const { requestId, seed } = request;
    const [crate] = await importsP;
    crate.set_seed(seed);
    const response: SetSeedResponse = {
        type: RequestType.SetSeed,
        requestId,
    };
    // eslint-disable-next-line max-len
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    (self as any).postMessage(response);
}

self.onmessage = (event: MessageEvent<Request>) => {
    const request = event.data;
    switch (request.type) {
        case RequestType.SetSeed:
            void setSeed(request);
            break;
        case RequestType.GenerateChunk:
            void generateChunk(request);
    }
};
