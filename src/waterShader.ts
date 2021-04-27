import { vec3, mat4 } from 'gl-matrix';
import { initProgram, calculateLocations, Locations } from './glUtil';
import { atmosphereFragment } from './skyShader';
import { TerrainChunk } from './TerrainChunk';
import { fogFragment } from './terrainShader';

const vertexSource = `#version 300 es
precision highp float;

in vec3 a_vertexPosition;

uniform mat4 u_viewMatrix;
uniform mat4 u_projMatrix;
uniform vec4 u_chunkPositioning;
uniform float u_duDvTiling;

out vec3 v_vertexPosition;
out vec4 v_clipSpace;
out vec2 v_textureCoords;

void main(void) {
    v_vertexPosition = a_vertexPosition;
    v_clipSpace = u_projMatrix * u_viewMatrix * vec4(a_vertexPosition, 1.0);
    v_textureCoords = u_duDvTiling * vec2(
        (a_vertexPosition.x - u_chunkPositioning.x) / u_chunkPositioning.z,
        (a_vertexPosition.z - u_chunkPositioning.y) / u_chunkPositioning.w
    );
    gl_Position = v_clipSpace;
}`;
const fragmentSource = `#version 300 es
precision highp float;

in vec3 v_vertexPosition;
in vec4 v_clipSpace;
in vec2 v_textureCoords;

uniform vec3 u_cameraPosition;
uniform sampler2D u_reflectionTexture;
uniform sampler2D u_refractionTexture;
uniform sampler2D u_duDvTexture;
uniform sampler2D u_normalTexture;
uniform sampler2D u_depthTexture;
uniform float u_near;
uniform float u_far;
uniform float u_blendDistance;
uniform float u_waveStrength;
uniform float u_waveOffset;
uniform float u_reflectivity;
uniform vec3 u_waterColor;
uniform float u_waterColorStrength;
uniform vec3 u_diffuseColor;
uniform vec3 u_sunPosition;
uniform float u_fogDistance;
uniform float u_fogPower;
uniform float u_specularReflectivity;
uniform float u_shineDamping;
uniform float u_atmosphereCutoffFactor;

out vec4 out_color;

${atmosphereFragment}
${fogFragment}

vec3 calculateSpecularLighting(vec3 toCameraVector, vec3 toLightVector, vec3 normal, float multiplier) {
    vec3 reflectedSunPosition = reflect(-toLightVector, normal);
    float specularFactor = max(dot(reflectedSunPosition, toCameraVector), 0.0);
    float specularValue = pow(specularFactor, u_shineDamping);
    return specularValue * u_specularReflectivity * multiplier * u_diffuseColor;
}

void main(void) {
    vec2 refractTexCoords = (v_clipSpace.xy / v_clipSpace.w) / 2.0 + 0.5;
    vec2 reflectTexCoords = vec2(refractTexCoords.x, 1.0 - refractTexCoords.y);
    float depth1 = texture(u_depthTexture, refractTexCoords).r;
    float floorDistance = 2.0 * u_near * u_far / (u_far + u_near - (2.0 * depth1 - 1.0) * (u_far - u_near));
    float depth2 = gl_FragCoord.z;
    float waterDistance = 2.0 * u_near * u_far / (u_far + u_near - (2.0 * depth2 - 1.0) * (u_far - u_near));
    float waterDepth = floorDistance - waterDistance;
    vec2 distortedTexCoords = texture(u_duDvTexture, vec2(v_textureCoords.x + u_waveOffset, v_textureCoords.y)).rg * 0.1;
    distortedTexCoords = v_textureCoords + vec2(distortedTexCoords.x, distortedTexCoords.y + u_waveOffset);
    vec2 totalDistortion = (texture(u_duDvTexture, distortedTexCoords).rg * 2.0 - 1.0) * u_waveStrength * clamp(waterDepth / u_blendDistance / 4.0, 0.0, 1.0);
    refractTexCoords += totalDistortion;
    reflectTexCoords += totalDistortion;
    refractTexCoords = clamp(refractTexCoords, 0.001, 0.999);
    reflectTexCoords = clamp(reflectTexCoords, 0.001, 0.999);
    vec4 reflectColor = texture(u_reflectionTexture, reflectTexCoords);
    vec4 refractColor = texture(u_refractionTexture, refractTexCoords);
    vec3 toCameraDirection = normalize(u_cameraPosition - v_vertexPosition);
    vec4 normalMapColor = texture(u_normalTexture, distortedTexCoords);
    vec3 normal = normalize(vec3(normalMapColor.r * 2.0 - 1.0, normalMapColor.b * 3.0, normalMapColor.g * 2.0 - 1.0));
    float refractiveFactor = pow(dot(toCameraDirection, normal), u_reflectivity);
    vec3 finalColor = mix(reflectColor.rgb, refractColor.rgb, refractiveFactor);
    finalColor = mix(finalColor, u_waterColor, u_waterColorStrength);
    float specularMultiplier = pow(clamp(waterDepth / u_blendDistance, 0.0, 1.0), 2.0);
    vec3 specularLighting = calculateSpecularLighting(toCameraDirection, u_sunPosition, normal, specularMultiplier);
    finalColor += specularLighting;
    float distanceToCamera = length(u_cameraPosition - v_vertexPosition);
    finalColor = applyFog(distanceToCamera, -toCameraDirection, finalColor);
    if (distanceToCamera >= u_fogDistance * 0.9) {
        out_color = vec4(finalColor, 1.0);
    } else {
        float alpha = clamp(waterDepth / u_blendDistance, 0.0, 1.0);
        out_color = vec4(finalColor, alpha);
    }
}`;

const attribs = {
    a_vertexPosition: true,
} as const;
const uniforms = {
    u_projMatrix: true,
    u_viewMatrix: true,
    u_cameraPosition: true,
    u_chunkPositioning: true,
    u_reflectionTexture: true,
    u_refractionTexture: true,
    u_duDvTexture: true,
    u_duDvTiling: true,
    u_normalTexture: true,
    u_depthTexture: true,
    u_near: true,
    u_far: true,
    u_blendDistance: true,
    u_waveStrength: true,
    u_waveOffset: true,
    u_reflectivity: true,
    u_waterColor: true,
    u_waterColorStrength: true,
    u_diffuseColor: true,
    u_sunPosition: true,
    u_fogDistance: true,
    u_fogPower: true,
    u_specularReflectivity: true,
    u_shineDamping: true,
    u_atmosphereCutoffFactor: true,
} as const;

export type WaterShaderLocations = Locations<typeof attribs, typeof uniforms>;

export interface WaterShader {
    render(parameters: WaterShaderRenderParameters): void;
    locations: WaterShaderLocations;
    reflectionFramebuffer: WebGLFramebuffer;
    refractionFramebuffer: WebGLFramebuffer;
}

export interface WaterShaderParameters {
    reflectionFramebufferWidth: number;
    reflectionFramebufferHeight: number;
    refractionFramebufferWidth: number;
    refractionFramebufferHeight: number;
}

export interface WaterShaderRenderParameters {
    cameraProjectionMatrix: mat4;
    cameraViewMatrix: mat4;
    cameraPosition: vec3;
    near: number;
    far: number;
    blendDistance: number;
    terrainChunks: TerrainChunk[];
    time: number;
    duDvTexture: WebGLTexture;
    duDvTiling: number;
    normalTexture: WebGLTexture;
    waveStrength: number;
    waveSpeed: number;
    reflectivity: number;
    waterColor: vec3;
    waterColorStrength: number;
    diffuseColor: vec3;
    sunPosition: vec3;
    fogDistance: number;
    fogPower: number;
    specularReflectivity: number;
    shineDamping: number;
    atmosphereCutoffFactor: number;
}

export function makeWaterShader(
    gl: WebGL2RenderingContext,
    parameters: WaterShaderParameters,
): WaterShader {
    const {
        reflectionFramebufferWidth,
        reflectionFramebufferHeight,
        refractionFramebufferWidth,
        refractionFramebufferHeight,
    } = parameters;

    const program = initProgram(gl, vertexSource, fragmentSource);
    const locations = calculateLocations(gl, program, attribs, uniforms);

    function attachColorTexture(width: number, height: number): WebGLTexture {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const colorTexture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, colorTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width,
            height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
        );
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            colorTexture,
            0,
        );
        return colorTexture;
    }

    function checkFramebufferStatus(): void {
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        let error = '';
        switch (status) {
            case gl.FRAMEBUFFER_COMPLETE:
                return;
            case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                error =
                    'The attachment types are mismatched or not all framebuffer attachment points are framebuffer attachment complete.';
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                error = 'There is no attachment.';
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                error = 'Height and width of the attachment are not the same.';
                break;
            case gl.FRAMEBUFFER_UNSUPPORTED:
                error =
                    'The format of the attachment is not supported or if depth and stencil attachments are not the same renderbuffer.';
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE:
                error =
                    'The values of gl.RENDERBUFFER_SAMPLES are different among attached render buffers, or are non-zero if the attached images are a mix of render buffers and textures.';
                break;
            default:
                error = `Unknown status, ${status}.`;
                break;
        }
        throw new Error(`WebGL Framebuffer status check failed - ${error}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const reflectionFramebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, reflectionFramebuffer);
    const reflectionColorTexture = attachColorTexture(
        reflectionFramebufferWidth,
        reflectionFramebufferHeight,
    );
    const reflectionDepthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, reflectionDepthBuffer);
    gl.renderbufferStorage(
        gl.RENDERBUFFER,
        gl.DEPTH_COMPONENT16,
        reflectionFramebufferWidth,
        reflectionFramebufferHeight,
    );
    gl.framebufferRenderbuffer(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.RENDERBUFFER,
        reflectionDepthBuffer,
    );
    checkFramebufferStatus();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const refractionFramebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, refractionFramebuffer);
    const refractionColorTexture = attachColorTexture(
        refractionFramebufferWidth,
        refractionFramebufferHeight,
    );
    const depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.DEPTH_COMPONENT16,
        refractionFramebufferWidth,
        refractionFramebufferHeight,
        0,
        gl.DEPTH_COMPONENT,
        gl.UNSIGNED_SHORT,
        null,
    );
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.TEXTURE_2D,
        depthTexture,
        0,
    );
    checkFramebufferStatus();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    function render(parameters: WaterShaderRenderParameters): void {
        const {
            cameraProjectionMatrix,
            cameraViewMatrix,
            cameraPosition,
            near,
            far,
            blendDistance,
            terrainChunks,
            time,
            duDvTexture,
            duDvTiling,
            normalTexture,
            waveStrength,
            waveSpeed,
            reflectivity,
            waterColor,
            waterColorStrength,
            diffuseColor,
            sunPosition,
            fogDistance,
            fogPower,
            specularReflectivity,
            shineDamping,
            atmosphereCutoffFactor,
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
        gl.uniform3fv(locations.uniforms.u_cameraPosition, cameraPosition);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, reflectionColorTexture);
        gl.uniform1i(locations.uniforms.u_reflectionTexture, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, refractionColorTexture);
        gl.uniform1i(locations.uniforms.u_refractionTexture, 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, duDvTexture);
        gl.uniform1i(locations.uniforms.u_duDvTexture, 2);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, normalTexture);
        gl.uniform1i(locations.uniforms.u_normalTexture, 3);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, depthTexture);
        gl.uniform1i(locations.uniforms.u_depthTexture, 4);
        gl.uniform1f(locations.uniforms.u_near, near);
        gl.uniform1f(locations.uniforms.u_far, far);
        gl.uniform1f(locations.uniforms.u_blendDistance, blendDistance);
        gl.uniform1f(locations.uniforms.u_duDvTiling, duDvTiling);
        gl.uniform1f(locations.uniforms.u_waveStrength, waveStrength);
        gl.uniform1f(locations.uniforms.u_waveOffset, (time * waveSpeed) % 1);
        gl.uniform1f(locations.uniforms.u_reflectivity, reflectivity);
        gl.uniform3fv(locations.uniforms.u_waterColor, waterColor);
        gl.uniform1f(
            locations.uniforms.u_waterColorStrength,
            waterColorStrength,
        );
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

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        terrainChunks.forEach((chunk) => {
            gl.uniform4f(
                locations.uniforms.u_chunkPositioning,
                chunk.boundingBox.min[0],
                chunk.boundingBox.min[2],
                chunk.boundingBox.max[0] - chunk.boundingBox.min[0],
                chunk.boundingBox.max[2] - chunk.boundingBox.min[2],
            );
            gl.bindVertexArray(chunk.waterVao);
            gl.drawArrays(gl.TRIANGLES, 0, chunk.waterIndicesCount);
        });
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
    }

    return {
        render,
        locations,
        reflectionFramebuffer,
        refractionFramebuffer,
    };
}
