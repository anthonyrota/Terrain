#version 300 es
precision highp float;

in vec3 a_vertexPosition;

uniform mat4 u_viewMatrix;
uniform mat4 u_projMatrix;

void main(void) {
    gl_Position = u_projMatrix * u_viewMatrix * vec4(a_vertexPosition, 1.0);
}
