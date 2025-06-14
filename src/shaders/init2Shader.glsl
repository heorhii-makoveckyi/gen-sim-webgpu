#version 300 es
precision highp float;

uniform sampler2D u_cellTexture1; // To check which cells exist
uniform vec2 u_resolution;
uniform vec2 u_maxEnergyToGetRange;
uniform float u_geneMatrixSize;
uniform float u_geneMatrixHeight;

in vec2 v_texCoord;
out vec4 fragColor;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void main() {
    vec2 coord = v_texCoord * u_resolution;
    vec4 cell1 = texture(u_cellTexture1, v_texCoord);

    vec4 cell2 = vec4(0.0);

    // If this is an active cell, initialize its secondary properties
    if (cell1.x > 0.0) {
        // maxEnergyToGet (random in range)
        cell2.x = mix(u_maxEnergyToGetRange.x, u_maxEnergyToGetRange.y, hash(coord + vec2(3.0, 0.0)));

        // energyInFieldCell (starts at 0)
        cell2.y = 0.0;

        // energyFromSun (starts at 0)
        cell2.z = 0.0;

        // activeGen (random starting gene sequence)
        cell2.w = floor(hash(coord + vec2(4.0, 0.0)) * u_geneMatrixHeight);
    }

    fragColor = cell2;
}
