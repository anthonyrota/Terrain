import { vec3 } from 'gl-matrix';
import { Box3 } from './Box3';
import { ChunkData } from './chunkWorker';
import { Disposable } from './Disposable';
import { ChunkPosition } from './LazyChunkLoader';
import { TerrainShaderLocations } from './terrainShader';
import { WaterShaderLocations } from './waterShader';

export interface TerrainChunkParameters {
    chunkData: ChunkData;
    CHUNK_WIDTH: number;
    CHUNK_DEPTH: number;
    MAX_HEIGHT: number;
    WATER_HEIGHT: number;
    chunkPosition: ChunkPosition;
    gl: WebGL2RenderingContext;
    terrainShaderLocations: TerrainShaderLocations;
    waterShaderLocations: WaterShaderLocations;
}

export class TerrainChunk extends Disposable {
    private _heightMap: Float32Array;
    private _CHUNK_WIDTH: number;
    private _CHUNK_DEPTH: number;
    private _chunkPosition: ChunkPosition;
    private _indicesCount: number;
    private _boundingBox: Box3;
    private _vao!: WebGLVertexArrayObject;
    private _waterVao!: WebGLVertexArrayObject;
    private _buffers: WebGLBuffer[] | null = [];

    public get boundingBox(): Box3 {
        return this._boundingBox;
    }
    public get vao(): WebGLVertexArrayObject {
        return this._vao;
    }
    public get indicesCount(): number {
        return this._indicesCount;
    }
    public get waterVao(): WebGLVertexArrayObject {
        return this._waterVao;
    }
    public get waterIndicesCount(): number {
        return 6;
    }

    constructor(parameters: TerrainChunkParameters) {
        super(() => {
            gl.deleteVertexArray(this._vao);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this._vao = null!;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this._buffers!.forEach((buffer) => {
                gl.deleteBuffer(buffer);
            });
            this._buffers = null;
        });
        const { gl } = parameters;
        this._heightMap = parameters.chunkData.heightMap;
        this._CHUNK_WIDTH = parameters.CHUNK_WIDTH;
        this._CHUNK_DEPTH = parameters.CHUNK_DEPTH;
        this._chunkPosition = parameters.chunkPosition;
        this._createVao(
            gl,
            parameters.chunkData,
            parameters.terrainShaderLocations,
        );
        this._createWaterVao(
            gl,
            parameters.WATER_HEIGHT,
            parameters.waterShaderLocations,
        );
        this._indicesCount = parameters.chunkData.indices.length;
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

    private _createVao(
        gl: WebGL2RenderingContext,
        chunkData: ChunkData,
        locations: TerrainShaderLocations,
    ): void {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const buffers = this._buffers!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this._vao = gl.createVertexArray()!;
        gl.bindVertexArray(this._vao);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const vertexBuffer = gl.createBuffer()!;
        buffers.push(vertexBuffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(
            locations.attribs.a_vertexPosition,
            3,
            gl.FLOAT,
            false,
            0,
            0,
        );
        gl.enableVertexAttribArray(locations.attribs.a_vertexPosition);
        gl.bufferData(gl.ARRAY_BUFFER, chunkData.vertices, gl.STATIC_DRAW);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const normalsBuffer = gl.createBuffer()!;
        buffers.push(normalsBuffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
        gl.vertexAttribPointer(
            locations.attribs.a_vertexNormal,
            3,
            gl.FLOAT,
            false,
            0,
            0,
        );
        gl.enableVertexAttribArray(locations.attribs.a_vertexNormal);
        gl.bufferData(gl.ARRAY_BUFFER, chunkData.normals, gl.STATIC_DRAW);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const colorsBuffer = gl.createBuffer()!;
        buffers.push(colorsBuffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, colorsBuffer);
        gl.vertexAttribPointer(
            locations.attribs.a_vertexColor,
            3,
            gl.FLOAT,
            false,
            0,
            0,
        );
        gl.enableVertexAttribArray(locations.attribs.a_vertexColor);
        gl.bufferData(gl.ARRAY_BUFFER, chunkData.colors, gl.STATIC_DRAW);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const indicesBuffer = gl.createBuffer()!;
        buffers.push(indicesBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            chunkData.indices,
            gl.STATIC_DRAW,
        );
        gl.bindVertexArray(null);
    }

    private _createWaterVao(
        gl: WebGL2RenderingContext,
        WATER_HEIGHT: number,
        locations: WaterShaderLocations,
    ): void {
        const { chunkX, chunkZ } = this._chunkPosition;
        const offsetX = chunkX * this._CHUNK_WIDTH;
        const offsetZ = chunkZ * this._CHUNK_DEPTH;
        const vertices = new Float32Array([
            offsetX,
            WATER_HEIGHT,
            offsetZ,
            offsetX,
            WATER_HEIGHT,
            offsetZ + this._CHUNK_DEPTH,
            offsetX + this._CHUNK_WIDTH,
            WATER_HEIGHT,
            offsetZ,
            offsetX,
            WATER_HEIGHT,
            offsetZ + this._CHUNK_DEPTH,
            offsetX + this._CHUNK_WIDTH,
            WATER_HEIGHT,
            offsetZ + this._CHUNK_DEPTH,
            offsetX + this._CHUNK_WIDTH,
            WATER_HEIGHT,
            offsetZ,
        ]);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const buffers = this._buffers!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this._waterVao = gl.createVertexArray()!;
        gl.bindVertexArray(this._waterVao);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const vertexBuffer = gl.createBuffer()!;
        buffers.push(vertexBuffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(
            locations.attribs.a_vertexPosition,
            3,
            gl.FLOAT,
            false,
            0,
            0,
        );
        gl.enableVertexAttribArray(locations.attribs.a_vertexPosition);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
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
