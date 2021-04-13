export function initProgram(
    gl: WebGL2RenderingContext,
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
    gl: WebGL2RenderingContext,
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
