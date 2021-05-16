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

export function loadTexturePower2(
    gl: WebGL2RenderingContext,
    src: string,
): Promise<WebGLTexture> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const image = new Image();
    let resolve: (value: WebGLTexture) => void;
    const promise = new Promise<WebGLTexture>((resolve_) => {
        resolve = resolve_;
    });
    image.onload = (): void => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGB,
            gl.RGB,
            gl.UNSIGNED_BYTE,
            image,
        );
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);
        resolve(texture);
    };
    image.src = src;
    return promise;
}

export function attachFramebufferColorTexture(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
): WebGLTexture {
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
        gl.RGB,
        width,
        height,
        0,
        gl.RGB,
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

export function checkFramebufferStatus(gl: WebGL2RenderingContext): void {
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
