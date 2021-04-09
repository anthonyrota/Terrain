import { vec3, vec4, mat4 } from 'gl-matrix';
import * as glUtil from './glUtil';
import { TerrainChunk } from './Terrain';

const vertexSource = `
  precision highp float;
  
  attribute vec3 aVertexPosition;
  attribute vec3 aVertexNormal;
  attribute vec3 aVertexColor;
  
  uniform mat4 uViewMatrix;
  uniform mat4 uProjMatrix;
  
  varying vec3 vVertexPosition;
  varying vec3 vVertexNormal;
  varying vec3 vVertexColor;
  
  void main(void) {
    vVertexPosition = aVertexPosition;
    vVertexNormal = aVertexNormal;
    vVertexColor = aVertexColor;
    
    gl_Position = uProjMatrix * uViewMatrix * vec4(aVertexPosition, 1.0);
  }
`;

const fragmentSource = `
  precision highp float;
  
  uniform vec3 uLightDirection;
  uniform vec3 uAmbientColor;
  uniform vec3 uDiffuseColor;
  
  uniform float uFogDistance;
  uniform float uFogPower;
  uniform vec3 uFogColor;
  
  uniform vec3 uCameraPosition;
  
  uniform float uSpecularReflectivity;
  uniform float uShineDamping;
  
  uniform vec4 uClippingPlane;
  uniform bool uUseClippingPlane;
  
  varying vec3 vVertexPosition;
  varying vec3 vVertexNormal;
  varying vec3 vVertexColor;
  
  vec3 calculateSpecularLighting(vec3 toCameraVector, vec3 toLightVector, vec3 normal) {
    vec3 reflectedLightDirection = reflect(-toLightVector, normal);
    
    float specularFactor = max(dot(reflectedLightDirection, toCameraVector), 0.0);
    float specularValue = pow(specularFactor, uShineDamping);
    
    return specularValue * uSpecularReflectivity * uDiffuseColor;
  }
  
  vec3 calculateDiffuseLighting(vec3 toLightVector, vec3 normal) {
    float diffuseWeighting = max(dot(normal, toLightVector), 0.0);
    
    return uDiffuseColor * diffuseWeighting;
  }
  
  void main(void) {
    if (uUseClippingPlane && dot(vec4(vVertexPosition, 1.0), uClippingPlane) < 0.0) {
      discard;
    }

    vec3 toCameraVector = normalize(uCameraPosition - vVertexPosition);
    vec3 toLightVector = uLightDirection;
    
    vec3 normal = normalize(vVertexNormal);
    vec3 specularLighting = calculateSpecularLighting(toCameraVector, toLightVector, normal);
    vec3 diffuseLighting = calculateDiffuseLighting(toLightVector, normal);
    
    vec3 vertexColor = vVertexColor * (uAmbientColor + (diffuseLighting + specularLighting)/4.0);
    
    float distanceToCamera = length(uCameraPosition - vVertexPosition);
    float fogFactor = clamp(1.0 - pow(distanceToCamera / uFogDistance, uFogPower), 0.0, 1.0);
    
    gl_FragColor = vec4(mix(uFogColor, vertexColor, fogFactor), 1.0);
  }
`;

const attribs = {
    aVertexPosition: true,
    aVertexNormal: true,
    aVertexColor: true,
} as const;
const uniforms = {
    uProjMatrix: true,
    uViewMatrix: true,
    uLightDirection: true,
    uAmbientColor: true,
    uDiffuseColor: true,
    uFogDistance: true,
    uFogPower: true,
    uFogColor: true,
    uCameraPosition: true,
    uClippingPlane: true,
    uUseClippingPlane: true,
    uSpecularReflectivity: true,
    uShineDamping: true,
} as const;

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
}

export function makeTerrainShader(gl: WebGLRenderingContext): TerrainShader {
    const program = glUtil.initProgram(gl, vertexSource, fragmentSource);
    const locations = glUtil.calculateLocations(gl, program, attribs, uniforms);

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
        gl.uniform4fv(locations.uniforms.uClippingPlane, clippingPlane);
        gl.uniform1f(
            locations.uniforms.uUseClippingPlane,
            isUsingClippingPlane ? 1 : 0,
        );
        gl.uniformMatrix4fv(
            locations.uniforms.uProjMatrix,
            false,
            cameraProjectionMatrix,
        );
        gl.uniformMatrix4fv(
            locations.uniforms.uViewMatrix,
            false,
            cameraViewMatrix,
        );
        gl.uniform3fv(locations.uniforms.uCameraPosition, cameraPosition);
        gl.uniform3fv(locations.uniforms.uAmbientColor, ambientColor);
        gl.uniform3fv(locations.uniforms.uDiffuseColor, diffuseColor);
        gl.uniform3fv(locations.uniforms.uLightDirection, lightDirection);
        gl.uniform1f(locations.uniforms.uFogDistance, fogDistance);
        gl.uniform1f(locations.uniforms.uFogPower, fogPower);
        gl.uniform3fv(locations.uniforms.uFogColor, fogColor);
        gl.uniform1f(
            locations.uniforms.uSpecularReflectivity,
            specularReflectivity,
        );
        gl.uniform1f(locations.uniforms.uShineDamping, shineDamping);

        terrainChunks.forEach((chunk) => {
            glUtil.setArrayBuffer(
                gl,
                locations.attribs.aVertexPosition,
                chunk.vertexBuffer,
                3,
            );
            glUtil.setArrayBuffer(
                gl,
                locations.attribs.aVertexNormal,
                chunk.normalsBuffer,
                3,
            );
            glUtil.setIndicesArrayBuffer(gl, chunk.indicesBuffer);
            glUtil.setArrayBuffer(
                gl,
                locations.attribs.aVertexColor,
                chunk.colorsBuffer,
                3,
            );
            glUtil.drawTriangles(gl, chunk.trianglesCount * 3);
        });
    }

    return {
        render,
    };
}
