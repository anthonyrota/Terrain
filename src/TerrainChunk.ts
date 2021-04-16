import { vec3 } from 'gl-matrix';
import { Box3 } from './Box3';
import {
    CHUNK_DEPTH,
    CHUNK_WIDTH,
    EROSION_OCEAN_HEIGHT,
    MAX_HEIGHT,
} from './crateConstants';
import { Disposable } from './Disposable';
import { ChunkPosition } from './LazyChunkLoader';
import { TerrainShaderLocations } from './terrainShader';
import { WaterShaderLocations } from './waterShader';

export interface TerrainChunkParameters {
    heightMap: Float32Array;
    vertices: Float32Array;
    normals: Float32Array;
    colors: Float32Array;
    indices: Uint32Array;
    chunkPosition: ChunkPosition;
    gl: WebGL2RenderingContext;
    terrainShaderLocations: TerrainShaderLocations;
    waterShaderLocations: WaterShaderLocations;
}

export class TerrainChunk extends Disposable {
    private _heightMap: Float32Array;
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
        this._heightMap = parameters.heightMap;
        this._chunkPosition = parameters.chunkPosition;
        this._createVao(
            gl,
            parameters.vertices,
            parameters.normals,
            parameters.colors,
            parameters.indices,
            parameters.terrainShaderLocations,
        );
        this._createWaterVao(gl, parameters.waterShaderLocations);
        this._indicesCount = parameters.indices.length;
        const boxMin = vec3.fromValues(
            this._chunkPosition.chunkX * CHUNK_WIDTH,
            0,
            this._chunkPosition.chunkZ * CHUNK_DEPTH,
        );
        const boxMax = vec3.add(
            vec3.create(),
            boxMin,
            vec3.fromValues(CHUNK_WIDTH, MAX_HEIGHT, CHUNK_DEPTH),
        );
        this._boundingBox = new Box3(boxMin, boxMax);
    }

    private _createVao(
        gl: WebGL2RenderingContext,
        vertices: Float32Array,
        normals: Float32Array,
        colors: Float32Array,
        indices: Uint32Array,
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
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
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
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
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
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const indicesBuffer = gl.createBuffer()!;
        buffers.push(indicesBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
    }

    private _createWaterVao(
        gl: WebGL2RenderingContext,
        locations: WaterShaderLocations,
    ): void {
        const { chunkX, chunkZ } = this._chunkPosition;
        const offsetX = chunkX * CHUNK_WIDTH;
        const offsetZ = chunkZ * CHUNK_DEPTH;
        const WATER_HEIGHT = MAX_HEIGHT * EROSION_OCEAN_HEIGHT;
        const vertices = new Float32Array([
            offsetX,
            WATER_HEIGHT,
            offsetZ,
            offsetX,
            WATER_HEIGHT,
            offsetZ + CHUNK_DEPTH,
            offsetX + CHUNK_WIDTH,
            WATER_HEIGHT,
            offsetZ,
            offsetX,
            WATER_HEIGHT,
            offsetZ + CHUNK_DEPTH,
            offsetX + CHUNK_WIDTH,
            WATER_HEIGHT,
            offsetZ + CHUNK_DEPTH,
            offsetX + CHUNK_WIDTH,
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
