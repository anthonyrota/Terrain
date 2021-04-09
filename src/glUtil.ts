import { vec4 } from 'gl-matrix';

export function initProgram(
    gl: WebGLRenderingContext,
    vertexSource: string,
    fragmentSource: string,
): WebGLProgram {
    function loadShader(type: number, source: string): WebGLShader {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(
                // eslint-disable-next-line max-len
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                `ERROR: Shader compile failed: ${gl.getShaderInfoLog(shader)!}`,
            );
        }
        return shader;
    }
    const vertexShader = loadShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fragmentSource);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            `ERROR: unable to initialize the shader program: ${gl.getProgramInfoLog(
                program,
            )!}`,
        );
    }
    return program;
}

export interface Locations<
    A extends { [key: string]: true },
    U extends { [key: string]: true }
> {
    attribs: { [K in keyof A]: number };
    uniforms: { [K in keyof U]: WebGLUniformLocation };
}

export function calculateLocations<
    A extends { [key: string]: true },
    U extends { [key: string]: true }
>(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    attribs: A,
    uniforms: U,
): Locations<A, U> {
    const locations = {
        attribs: {},
        uniforms: {},
    } as Locations<A, U>;
    Object.keys(attribs).forEach((name) => {
        locations.attribs[name as keyof A] = gl.getAttribLocation(
            program,
            name,
        );
    });
    Object.keys(uniforms).forEach((name) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        locations.uniforms[name as keyof U] = gl.getUniformLocation(
            program,
            name,
        )!;
    });
    return locations;
}

export function clear(gl: WebGLRenderingContext, color: vec4): void {
    gl.clearColor(color[0], color[1], color[2], color[3]);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}

export function createStaticArrayBuffer(
    gl: WebGLRenderingContext,
    data: Float32Array,
): WebGLBuffer {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
}

export function createStaticElementArrayBuffer(
    gl: WebGLRenderingContext,
    data: Uint32Array,
): WebGLBuffer {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
}

export function setArrayBuffer(
    gl: WebGLRenderingContext,
    index: number,
    buffer: WebGLBuffer,
    numComponents: number,
): void {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(index, numComponents, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(index);
}

export function setIndicesArrayBuffer(
    gl: WebGLRenderingContext,
    buffer: WebGLBuffer,
): void {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
}

export function drawTriangles(gl: WebGLRenderingContext, count: number): void {
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
}
