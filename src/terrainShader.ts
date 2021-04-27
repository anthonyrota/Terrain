import { vec3, vec4, mat4 } from 'gl-matrix';
import { initProgram, calculateLocations, Locations } from './glUtil';
import { atmosphereFragment } from './skyShader';
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
export const fogFragment = `
vec3 applyFog(float distanceToCamera, vec3 cameraToVertex, vec3 color) {
    float fogFactor = clamp(1.0 - pow(distanceToCamera / u_fogDistance, u_fogPower), 0.0, 1.0);
    if (fogFactor <= 0.9) {
        vec2 xzDir = normalize(vec2(cameraToVertex.x, cameraToVertex.z));
        vec3 fogColor = atmosphere(normalize(vec3(xzDir.x, u_atmosphereCutoffFactor, xzDir.y)));
        return mix(fogColor, color, fogFactor);
    }
    return color;
}
`.trim();
const fragmentSource = `#version 300 es
precision highp float;

uniform vec3 u_sunPosition;
uniform vec3 u_ambientColor;
uniform vec3 u_diffuseColor;
uniform float u_fogDistance;
uniform float u_fogPower;
uniform vec3 u_cameraPosition;
uniform float u_specularReflectivity;
uniform float u_shineDamping;
uniform float u_atmosphereCutoffFactor;
uniform vec4 u_clippingPlane;
uniform bool u_useClippingPlane;

in vec3 v_vertexPosition;
in vec3 v_vertexNormal;
in vec3 v_vertexColor;

out vec4 out_color;

${atmosphereFragment}
${fogFragment}

vec3 calculateSpecularLighting(vec3 toCameraVector, vec3 toLightVector, vec3 normal) {
    vec3 reflectedSunPosition = reflect(-toLightVector, normal);
    float specularFactor = max(dot(reflectedSunPosition, toCameraVector), 0.0);
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
    vec3 toLightVector = u_sunPosition;
    vec3 normal = normalize(v_vertexNormal);
    vec3 specularLighting = calculateSpecularLighting(toCameraVector, toLightVector, normal);
    vec3 diffuseLighting = calculateDiffuseLighting(toLightVector, normal);
    vec3 vertexColor = v_vertexColor * (u_ambientColor + (diffuseLighting + specularLighting));
    float distanceToCamera = length(u_cameraPosition - v_vertexPosition);
    out_color = vec4(applyFog(distanceToCamera, -toCameraVector, vertexColor), 1.0);
}`;

const attribs = {
    a_vertexPosition: true,
    a_vertexNormal: true,
    a_vertexColor: true,
} as const;
const uniforms = {
    u_projMatrix: true,
    u_viewMatrix: true,
    u_sunPosition: true,
    u_ambientColor: true,
    u_diffuseColor: true,
    u_fogDistance: true,
    u_fogPower: true,
    u_cameraPosition: true,
    u_clippingPlane: true,
    u_useClippingPlane: true,
    u_specularReflectivity: true,
    u_shineDamping: true,
    u_atmosphereCutoffFactor: true,
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
    sunPosition: vec3;
    fogDistance: number;
    fogPower: number;
    terrainChunks: TerrainChunk[];
    specularReflectivity: number;
    shineDamping: number;
    atmosphereCutoffFactor: number;
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
            sunPosition,
            fogDistance,
            fogPower,
            terrainChunks,
            specularReflectivity,
            shineDamping,
            atmosphereCutoffFactor,
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
        gl.uniform3fv(locations.uniforms.u_sunPosition, sunPosition);
        gl.uniform1f(locations.uniforms.u_fogDistance, fogDistance);
        gl.uniform1f(locations.uniforms.u_fogPower, fogPower);
        gl.uniform1f(
            locations.uniforms.u_specularReflectivity,
            specularReflectivity,
        );
        gl.uniform1f(locations.uniforms.u_shineDamping, shineDamping);
        gl.uniform1f(
            locations.uniforms.u_atmosphereCutoffFactor,
            atmosphereCutoffFactor,
        );

        terrainChunks.forEach((chunk) => {
            if (!chunk.initialized) {
                return;
            }
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
