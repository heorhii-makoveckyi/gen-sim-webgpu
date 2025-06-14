#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_initialCellCount;
uniform float u_initialEnergyMultiplier;
uniform vec2 u_willRange;
uniform vec2 u_maxEnergyRange;
uniform vec2 u_maxEnergyToGetRange;
uniform float u_geneMatrixSize; // width * height
uniform float u_geneMatrixHeight; // rows

in vec2 v_texCoord;
out vec4 fragColor;

// Simple hash function for randomness
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void main() {
    vec2  coord       = v_texCoord * u_resolution;
    float pixelIndex  = coord.y * u_resolution.x + coord.x;   // оставляем для unique ID

    // Initialize empty cell
    vec4 cell1 = vec4(0.0); // originalId, energy, maxEnergy, will
    vec4 cell2 = vec4(0.0); // maxEnergyToGet, energyInFieldCell, energyFromSun, activeGen

    // Create initial cells
    float totalPixels = u_resolution.x * u_resolution.y;
    if (hash(coord) < u_initialCellCount / totalPixels) {
        float seed = hash(coord);

        // originalId (non-zero unique value)
        cell1.x = pixelIndex + 1.0;

        // will (random in range)
        cell1.w = mix(u_willRange.x, u_willRange.y, hash(coord + vec2(1.0, 0.0)));

        // maxEnergy (random in range)
        cell1.z = mix(u_maxEnergyRange.x, u_maxEnergyRange.y, hash(coord + vec2(2.0, 0.0)));

        // energy (initialEnergyMultiplier * will * geneCount)
        cell1.y = u_initialEnergyMultiplier * cell1.w * u_geneMatrixSize;
        cell1.y = min(cell1.y, cell1.z); // Cap at maxEnergy

        // maxEnergyToGet (random in range)
        cell2.x = mix(u_maxEnergyToGetRange.x, u_maxEnergyToGetRange.y, hash(coord + vec2(3.0, 0.0)));

        // energyInFieldCell (starts at 0)
        cell2.y = 0.0;

        // energyFromSun (starts at 0)
        cell2.z = 0.0;

        // activeGen (random starting gene sequence)
        cell2.w = floor(hash(coord + vec2(4.0, 0.0)) * u_geneMatrixHeight);
    }

    // Output characteristics (we'll use two textures to store all 8 values)
    fragColor = cell1; // This will be written to texture 1
    // Note: We'll need a second pass to write cell2 to texture 2
}
