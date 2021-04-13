#version 300 es
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
}
