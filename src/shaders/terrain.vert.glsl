#version 300 es
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
}
