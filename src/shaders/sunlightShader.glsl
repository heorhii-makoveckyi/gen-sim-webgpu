#version 300 es
precision highp float;

uniform sampler2D u_cellTexture2; // Contains energyFromSun at .z
uniform vec2 u_resolution;
uniform float u_maxSolarEnergy;
uniform float u_time;
uniform float u_dayCycleDuration;
uniform int u_sunMode; // 0-4 for different sun modes

in vec2 v_texCoord;
out vec4 fragColor;

float getSunIntensity(vec2 coord) {
    float intensity = 0.0;
    float cycleProgress = mod(u_time, u_dayCycleDuration) / u_dayCycleDuration;

    if (u_sunMode == 0) { // CONSTANT_FULL
                          intensity = 1.0;
    }
    else if (u_sunMode == 1) { // CLIPPING_FULL
                               intensity = abs(sin(cycleProgress * 3.14159));
    }
    else if (u_sunMode == 2) { // CONSTANT_ISLANDS
                               vec2 center1 = vec2(0.25, 0.25);
                               vec2 center2 = vec2(0.75, 0.25);
                               vec2 center3 = vec2(0.25, 0.75);
                               vec2 center4 = vec2(0.75, 0.75);

                               float radius = 0.15;
                               float d1 = distance(coord, center1);
                               float d2 = distance(coord, center2);
                               float d3 = distance(coord, center3);
                               float d4 = distance(coord, center4);

                               if (d1 < radius || d2 < radius || d3 < radius || d4 < radius) {
                                   intensity = 1.0;
                               }
    }
    else if (u_sunMode == 3) { // CLIPPING_ISLANDS
                               vec2 center1 = vec2(0.25, 0.25);
                               vec2 center2 = vec2(0.75, 0.25);
                               vec2 center3 = vec2(0.25, 0.75);
                               vec2 center4 = vec2(0.75, 0.75);

                               float radius = 0.15;
                               float d1 = distance(coord, center1);
                               float d2 = distance(coord, center2);
                               float d3 = distance(coord, center3);
                               float d4 = distance(coord, center4);

                               if (d1 < radius || d2 < radius || d3 < radius || d4 < radius) {
                                   intensity = abs(sin(cycleProgress * 3.14159));
                               }
    }
    else if (u_sunMode == 4) { // DYNAMIC_SUN
                               float sunX = cycleProgress;
                               float sunRadius = 0.2;
                               vec2 sunCenter = vec2(sunX, 0.5);
                               float dist = distance(coord, sunCenter);

                               if (dist < sunRadius) {
                                   intensity = 1.0 - (dist / sunRadius);
                               }
    }

    return intensity;
}

void main() {
    vec4 cell2 = texture(u_cellTexture2, v_texCoord);

    // Update energyFromSun based on sun intensity
    float sunIntensity = getSunIntensity(v_texCoord);
    cell2.z = sunIntensity * u_maxSolarEnergy;

    fragColor = cell2;
}
