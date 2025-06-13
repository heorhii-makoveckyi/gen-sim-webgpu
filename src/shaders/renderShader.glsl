#version 300 es
precision highp float;

uniform sampler2D u_cellTexture1; // originalId, energy, maxEnergy, will
uniform sampler2D u_cellTexture2; // maxEnergyToGet, energyInFieldCell, energyFromSun, activeGen
uniform bool u_showAccumulatedEnergy;
uniform bool u_showSunEnergy;
uniform bool u_showCells;
uniform bool u_showCellEnergy;

in vec2 v_texCoord;
out vec4 fragColor;

// Generate color from ID
vec3 idToColor(float id) {
    float hue = fract(id * 0.618033988749895); // Golden ratio
    float sat = 0.7;
    float val = 0.8;

    vec3 rgb = vec3(0.0);
    float c = val * sat;
    float x = c * (1.0 - abs(mod(hue * 6.0, 2.0) - 1.0));
    float m = val - c;

    if (hue < 1.0/6.0) rgb = vec3(c, x, 0.0);
    else if (hue < 2.0/6.0) rgb = vec3(x, c, 0.0);
    else if (hue < 3.0/6.0) rgb = vec3(0.0, c, x);
    else if (hue < 4.0/6.0) rgb = vec3(0.0, x, c);
    else if (hue < 5.0/6.0) rgb = vec3(x, 0.0, c);
    else rgb = vec3(c, 0.0, x);

    return rgb + m;
}

void main() {
    vec4 cell1 = texture(u_cellTexture1, v_texCoord);
    vec4 cell2 = texture(u_cellTexture2, v_texCoord);

    vec3 color = vec3(0.0);
    float alpha = 1.0;

    // Base color
    if (u_showCells && cell1.x > 0.0) {
        color = idToColor(cell1.x);
    } else {
        color = vec3(0.1); // Dark background
    }

    // Overlay effects with 30% opacity each
    vec3 overlayColor = vec3(0.0);
    float overlayAlpha = 0.0;

    if (u_showAccumulatedEnergy && cell2.y > 0.0) {
        float intensity = min(cell2.y / 100.0, 1.0); // Normalize
        overlayColor += vec3(0.5, 0.0, 0.5) * intensity * 0.3; // Purple
        overlayAlpha += 0.3;
    }

    if (u_showSunEnergy && cell2.z > 0.0) {
        float intensity = cell2.z; // Already 0-1
        overlayColor += vec3(1.0, 1.0, 0.0) * intensity * 0.3; // Yellow
        overlayAlpha += 0.3;
    }

    if (u_showCellEnergy && cell1.x > 0.0 && cell1.y > 0.0) {
        float intensity = cell1.y / cell1.z; // Normalize by max energy
        overlayColor += vec3(0.0, 1.0, 0.0) * intensity * 0.3; // Green
        overlayAlpha += 0.3;
    }

    // Blend overlays
    if (overlayAlpha > 0.0) {
        overlayAlpha = min(overlayAlpha, 0.7); // Cap total overlay
        color = mix(color, overlayColor / overlayAlpha, overlayAlpha);
    }

    fragColor = vec4(color, alpha);
}
