import { vec3, mat4 } from 'gl-matrix';
import { initProgram, calculateLocations, Locations } from './glUtil';

const vertexSource = `#version 300 es
precision highp float;

in vec4 a_vertexPosition;

out vec4 v_vertexPosition;

void main(void) {
    v_vertexPosition = a_vertexPosition;
    v_vertexPosition.z = 1.0;
    gl_Position = a_vertexPosition;
    gl_Position.z = 1.0;
}`;
// https://github.com/wwwtyro/glsl-atmosphere.
export const atmosphereFragment = `
#define PI 3.141592
#define iSteps 16
#define jSteps 8

vec2 rsi(vec3 r0, vec3 rd, float sr) {
    float a = dot(rd, rd);
    float b = 2.0 * dot(rd, r0);
    float c = dot(r0, r0) - (sr * sr);
    float d = (b*b) - 4.0*a*c;
    if (d < 0.0) return vec2(1e5,-1e5);
    return vec2(
        (-b - sqrt(d))/(2.0*a),
        (-b + sqrt(d))/(2.0*a)
    );
}

vec3 atmosphere_(vec3 r, vec3 r0, vec3 pSun, float iSun, float rPlanet, float rAtmos, vec3 kRlh, float kMie, float shRlh, float shMie, float g) {
    pSun = normalize(pSun);
    vec2 p = rsi(r0, r, rAtmos);
    if (p.x > p.y) return vec3(0,0,0);
    p.y = min(p.y, rsi(r0, r, rPlanet).x);
    float iStepSize = (p.y - p.x) / float(iSteps);
    float iTime = 0.0;
    vec3 totalRlh = vec3(0,0,0);
    vec3 totalMie = vec3(0,0,0);
    float iOdRlh = 0.0;
    float iOdMie = 0.0;
    float mu = dot(r, pSun);
    float mumu = mu * mu;
    float gg = g * g;
    float pRlh = 3.0 / (16.0 * PI) * (1.0 + mumu);
    float pMie = 3.0 / (8.0 * PI) * ((1.0 - gg) * (mumu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * g, 1.5) * (2.0 + gg));
    for (int i = 0; i < iSteps; i++) {
        vec3 iPos = r0 + r * (iTime + iStepSize * 0.5);
        float iHeight = length(iPos) - rPlanet;
        float odStepRlh = exp(-iHeight / shRlh) * iStepSize;
        float odStepMie = exp(-iHeight / shMie) * iStepSize;
        iOdRlh += odStepRlh;
        iOdMie += odStepMie;
        float jStepSize = rsi(iPos, pSun, rAtmos).y / float(jSteps);
        float jTime = 0.0;
        float jOdRlh = 0.0;
        float jOdMie = 0.0;
        for (int j = 0; j < jSteps; j++) {
            vec3 jPos = iPos + pSun * (jTime + jStepSize * 0.5);
            float jHeight = length(jPos) - rPlanet;
            jOdRlh += exp(-jHeight / shRlh) * jStepSize;
            jOdMie += exp(-jHeight / shMie) * jStepSize;
            jTime += jStepSize;
        }
        vec3 attn = exp(-(kMie * (iOdMie + jOdMie) + kRlh * (iOdRlh + jOdRlh)));
        totalRlh += odStepRlh * attn;
        totalMie += odStepMie * attn;
        iTime += iStepSize;
    }
    return iSun * (pRlh * kRlh * totalRlh + pMie * kMie * totalMie);
}

vec3 atmosphere(vec3 rayDir) {
    vec3 color = atmosphere_(
        rayDir,
        vec3(0, 6372e3, 0),
        u_sunPosition,
        22.0,
        6371e3,
        6471e3,
        vec3(5.5e-6, 13.0e-6, 22.4e-6),
        21e-6,
        8e3,
        1.2e3,
        0.758
    );
    color = 1.0 - exp(-1.0 * color);
    return color;
}
`.trim();
const fragmentSource = `#version 300 es
precision highp float;

in vec4 v_vertexPosition;

uniform mat4 u_viewDirProjInverseMatrix;
uniform vec3 u_sunPosition;
uniform float u_atmosphereCutoffFactor;
uniform float u_downBlendingCutoff;
uniform float u_downBlendingPower;

out vec4 out_color;

${atmosphereFragment}

void main(void) {
    vec4 temp = u_viewDirProjInverseMatrix * v_vertexPosition;
    vec3 rayDir = temp.xyz / temp.w;
    rayDir = normalize(rayDir);
    if (rayDir.y <= u_atmosphereCutoffFactor) {
        vec2 xzDir = normalize(vec2(rayDir.x, rayDir.z));
        vec3 cutoffColor = atmosphere(normalize(vec3(xzDir.x, u_atmosphereCutoffFactor, xzDir.y)));
        if (rayDir.y <= u_downBlendingCutoff - 1.0) {
            float blend = 1.0 - pow(1.0 - (rayDir.y + 1.0) / u_downBlendingCutoff, u_downBlendingPower);
            vec2 xzSun = normalize(vec2(u_sunPosition.x, u_sunPosition.z));
            vec3 blendColor = atmosphere(normalize(vec3(-xzSun.y, u_atmosphereCutoffFactor, xzSun.x)));
            out_color = vec4(vec3(mix(blendColor, cutoffColor, blend)), 1.0);
            return;
        }
        out_color = vec4(cutoffColor, 1.0);
        return;
    }
    out_color = vec4(atmosphere(rayDir), 1.0);
}`;

const attribs = {
    a_vertexPosition: true,
} as const;
const uniforms = {
    u_viewDirProjInverseMatrix: true,
    u_sunPosition: true,
    u_atmosphereCutoffFactor: true,
    u_downBlendingCutoff: true,
    u_downBlendingPower: true,
} as const;

export type SkyShaderLocations = Locations<typeof attribs, typeof uniforms>;

export interface SkyShader {
    render(parameters: SkyShaderRenderParameters): void;
    locations: SkyShaderLocations;
}

export interface SkyShaderRenderParameters {
    viewDirProjInverseMatrix: mat4;
    sunPosition: vec3;
    atmosphereCutoffFactor: number;
    downBlendingCutoff: number;
    downBlendingPower: number;
}

export function makeSkyShader(gl: WebGL2RenderingContext): SkyShader {
    const program = initProgram(gl, vertexSource, fragmentSource);
    const locations = calculateLocations(gl, program, attribs, uniforms);

    const buffers: WebGLBuffer[] | null = [];
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const vertexBuffer = gl.createBuffer()!;
    buffers.push(vertexBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(
        locations.attribs.a_vertexPosition,
        2,
        gl.FLOAT,
        false,
        0,
        0,
    );
    gl.enableVertexAttribArray(locations.attribs.a_vertexPosition);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
    );
    gl.bindVertexArray(null);

    function render(parameters: SkyShaderRenderParameters): void {
        const {
            viewDirProjInverseMatrix,
            sunPosition,
            atmosphereCutoffFactor,
            downBlendingCutoff,
            downBlendingPower,
        } = parameters;
        gl.useProgram(program);
        gl.uniformMatrix4fv(
            locations.uniforms.u_viewDirProjInverseMatrix,
            false,
            viewDirProjInverseMatrix,
        );
        gl.uniform3fv(locations.uniforms.u_sunPosition, sunPosition);
        gl.uniform1f(
            locations.uniforms.u_atmosphereCutoffFactor,
            atmosphereCutoffFactor,
        );
        gl.uniform1f(
            locations.uniforms.u_downBlendingCutoff,
            downBlendingCutoff,
        );
        gl.uniform1f(locations.uniforms.u_downBlendingPower, downBlendingPower);
        gl.depthFunc(gl.LEQUAL);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
        gl.depthFunc(gl.LESS);
    }

    return {
        render,
        locations,
    };
}
