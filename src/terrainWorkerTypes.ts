export enum RequestType {
    SetSeed,
    GenerateChunk,
}

export interface RequestBase {
    requestId: number;
}
export interface ResponseBase {
    requestId: number;
}

export interface SetSeedRequest extends RequestBase {
    type: RequestType.SetSeed;
    seed: number;
}
export interface SetSeedResponse extends ResponseBase {
    type: RequestType.SetSeed;
}

export interface GenerateChunkRequest extends RequestBase {
    type: RequestType.GenerateChunk;
    chunkX: number;
    chunkZ: number;
}
export interface GenerateChunkResponse extends ResponseBase {
    type: RequestType.GenerateChunk;
    heightMap: Float32Array;
    vertices: Float32Array;
    normals: Float32Array;
    colors: Float32Array;
    indices: Uint32Array;
}

export type Request = SetSeedRequest | GenerateChunkRequest;
export type Response = SetSeedResponse | GenerateChunkResponse;

export type WPRequest =
    | Omit<SetSeedRequest, 'requestId'>
    | Omit<GenerateChunkRequest, 'requestId'>;
export type WPResponse =
    | Omit<SetSeedResponse, 'requestId'>
    | Omit<GenerateChunkResponse, 'requestId'>;
