import { vec3, vec4, mat4 } from 'gl-matrix';
import { initProgram, calculateLocations, Locations } from './glUtil';
import { TerrainChunk } from './TerrainChunk';

const vertexSource = `#version 300 es
precision highp float;

in vec3 a_vertexPosition;
in vec3 a_vertexNormal;
in vec3 a_vertexColor;

uniform mat4 u_viewMatrix;
uniform mat4 u_projMatrix;

out vec3 v_vertexPosition;
out vec3 v_vertexNormal;
out vec3 v_vertexColor;

void main(void) {
    v_vertexPosition = a_vertexPosition;
    v_vertexNormal = a_vertexNormal;
    v_vertexColor = a_vertexColor;

    gl_Position = u_projMatrix * u_viewMatrix * vec4(a_vertexPosition, 1.0);
}`;
const fragmentSource = `#version 300 es
precision highp float;

uniform vec3 u_lightDirection;
uniform vec3 u_ambientColor;
uniform vec3 u_diffuseColor;
uniform float u_fogDistance;
uniform float u_fogPower;
uniform vec3 u_fogColor;
uniform vec3 u_cameraPosition;
uniform float u_specularReflectivity;
uniform float u_shineDamping;
uniform vec4 u_clippingPlane;
uniform bool u_useClippingPlane;

in vec3 v_vertexPosition;
in vec3 v_vertexNormal;
in vec3 v_vertexColor;

out vec4 out_color;

vec3 calculateSpecularLighting(vec3 toCameraVector, vec3 toLightVector, vec3 normal) {
    vec3 reflectedLightDirection = reflect(-toLightVector, normal);
    float specularFactor = max(dot(reflectedLightDirection, toCameraVector), 0.0);
    float specularValue = pow(specularFactor, u_shineDamping);
    return specularValue * u_specularReflectivity * u_diffuseColor;
}

vec3 calculateDiffuseLighting(vec3 toLightVector, vec3 normal) {
    float diffuseWeighting = max(dot(normal, toLightVector), 0.0);
    return u_diffuseColor * diffuseWeighting;
}

void main(void) {
    if (u_useClippingPlane && dot(vec4(v_vertexPosition, 1.0), u_clippingPlane) < 0.0) {
        discard;
    }
    vec3 toCameraVector = normalize(u_cameraPosition - v_vertexPosition);
    vec3 toLightVector = u_lightDirection;
    vec3 normal = normalize(v_vertexNormal);
    vec3 specularLighting = calculateSpecularLighting(toCameraVector, toLightVector, normal);
    vec3 diffuseLighting = calculateDiffuseLighting(toLightVector, normal);
    vec3 vertexColor = v_vertexColor * (u_ambientColor + (diffuseLighting + specularLighting) / 4.0);
    float distanceToCamera = length(u_cameraPosition - v_vertexPosition);
    float fogFactor = clamp(1.0 - pow(distanceToCamera / u_fogDistance, u_fogPower), 0.0, 1.0);
    out_color = vec4(mix(u_fogColor, vertexColor, fogFactor), 1.0);
}`;

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

export interface TerrainShader {
    render(parameters: TerrainShaderRenderParameters): void;
    locations: TerrainShaderLocations;
}

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
