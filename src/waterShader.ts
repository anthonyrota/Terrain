import * as fs from 'fs';
import { mat4 } from 'gl-matrix';
import { initProgram, calculateLocations, Locations } from './glUtil';
import { TerrainChunk } from './TerrainChunk';

const vertexSource = fs.readFileSync('src/shaders/water.vert.glsl', 'utf8');
const fragmentSource = fs.readFileSync('src/shaders/water.frag.glsl', 'utf8');

const attribs = {
    a_vertexPosition: true,
} as const;
const uniforms = {
    u_projMatrix: true,
    u_viewMatrix: true,
} as const;

export type WaterShaderLocations = Locations<typeof attribs, typeof uniforms>;

export interface WaterShaderRenderParameters {
    cameraProjectionMatrix: mat4;
    cameraViewMatrix: mat4;
    terrainChunks: TerrainChunk[];
}

export interface WaterShader {
    render(parameters: WaterShaderRenderParameters): void;
    locations: WaterShaderLocations;
}

export function makeWaterShader(gl: WebGL2RenderingContext): WaterShader {
    const program = initProgram(gl, vertexSource, fragmentSource);
    const locations = calculateLocations(gl, program, attribs, uniforms);

    function render(parameters: WaterShaderRenderParameters): void {
        const {
            cameraProjectionMatrix,
            cameraViewMatrix,
            terrainChunks,
        } = parameters;

        if (terrainChunks.length === 0) {
            return;
        }

        gl.useProgram(program);
        gl.uniformMatrix4fv(
            locations.uniforms.u_projMatrix,
            false,
            cameraProjectionMatrix,
        );
        gl.uniformMatrix4fv(
            locations.uniforms.u_viewMatrix,
            false,
            cameraViewMatrix,
        );

        terrainChunks.forEach((chunk) => {
            gl.bindVertexArray(chunk.waterVao);
            gl.drawArrays(gl.TRIANGLES, 0, chunk.waterIndicesCount);
        });
        gl.bindVertexArray(null);
    }

    return {
        render,
        locations,
    };
}
