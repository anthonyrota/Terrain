import * as fs from 'fs';
import { vec3, vec4, mat4 } from 'gl-matrix';
import { initProgram, calculateLocations, Locations } from './glUtil';
import { TerrainChunk } from './TerrainChunk';

const vertexSource = fs.readFileSync('src/shaders/terrain.vert.glsl', 'utf8');
const fragmentSource = fs.readFileSync('src/shaders/terrain.frag.glsl', 'utf8');

const attribs = {
    a_vertexPosition: true,
    a_vertexNormal: true,
    a_vertexColor: true,
} as const;
const uniforms = {
    u_projMatrix: true,
    u_viewMatrix: true,
    u_lightDirection: true,
    u_ambientColor: true,
    u_diffuseColor: true,
    u_fogDistance: true,
    u_fogPower: true,
    u_fogColor: true,
    u_cameraPosition: true,
    u_clippingPlane: true,
    u_useClippingPlane: true,
    u_specularReflectivity: true,
    u_shineDamping: true,
} as const;

export type TerrainShaderLocations = Locations<typeof attribs, typeof uniforms>;

export interface TerrainShaderRenderParameters {
    clippingPlane: vec4;
    isUsingClippingPlane: boolean;
    cameraProjectionMatrix: mat4;
    cameraViewMatrix: mat4;
    cameraPosition: vec3;
    ambientColor: vec3;
    diffuseColor: vec3;
    lightDirection: vec3;
    fogDistance: number;
    fogPower: number;
    fogColor: vec3;
    terrainChunks: TerrainChunk[];
    specularReflectivity: number;
    shineDamping: number;
}

export interface TerrainShader {
    render(parameters: TerrainShaderRenderParameters): void;
    locations: TerrainShaderLocations;
}

export function makeTerrainShader(gl: WebGL2RenderingContext): TerrainShader {
    const program = initProgram(gl, vertexSource, fragmentSource);
    const locations = calculateLocations(gl, program, attribs, uniforms);

    function render(parameters: TerrainShaderRenderParameters): void {
        const {
            clippingPlane,
            isUsingClippingPlane,
            cameraProjectionMatrix,
            cameraViewMatrix,
            cameraPosition,
            ambientColor,
            diffuseColor,
            lightDirection,
            fogDistance,
            fogPower,
            fogColor,
            terrainChunks,
            specularReflectivity,
            shineDamping,
        } = parameters;

        if (terrainChunks.length === 0) {
            return;
        }

        gl.useProgram(program);
        gl.uniform4fv(locations.uniforms.u_clippingPlane, clippingPlane);
        gl.uniform1f(
            locations.uniforms.u_useClippingPlane,
            isUsingClippingPlane ? 1 : 0,
        );
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
        gl.uniform3fv(locations.uniforms.u_cameraPosition, cameraPosition);
        gl.uniform3fv(locations.uniforms.u_ambientColor, ambientColor);
        gl.uniform3fv(locations.uniforms.u_diffuseColor, diffuseColor);
        gl.uniform3fv(locations.uniforms.u_lightDirection, lightDirection);
        gl.uniform1f(locations.uniforms.u_fogDistance, fogDistance);
        gl.uniform1f(locations.uniforms.u_fogPower, fogPower);
        gl.uniform3fv(locations.uniforms.u_fogColor, fogColor);
        gl.uniform1f(
            locations.uniforms.u_specularReflectivity,
            specularReflectivity,
        );
        gl.uniform1f(locations.uniforms.u_shineDamping, shineDamping);

        terrainChunks.forEach((chunk) => {
            gl.bindVertexArray(chunk.vao);
            gl.drawElements(
                gl.TRIANGLES,
                chunk.indicesCount,
                gl.UNSIGNED_INT,
                0,
            );
        });
        gl.bindVertexArray(null);
    }

    return {
        render,
        locations,
    };
}
