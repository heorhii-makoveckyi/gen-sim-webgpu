#version 300 es
precision highp float;

uniform sampler2D u_cellTexture1;      // Updated cell texture 1
uniform sampler2D u_cellTexture1Old;   // Original cell texture 1
uniform sampler2D u_cellTexture2;      // Current cell texture 2
uniform sampler2D u_intentionTexture;
uniform sampler2D u_geneTexture;
uniform vec2 u_resolution;
uniform vec2 u_geneMatrixSize;
uniform float u_mutationProbability;
uniform float u_time;

in vec2 v_texCoord;
out vec4 fragColor;

float hash(vec3 p) {
    p = fract(p * vec3(123.34, 456.21, 789.32));
    p += dot(p, p.yzx + 45.32);
    return fract(p.x * p.y * p.z);
}

void main() {
    vec2 pixelPos = floor(v_texCoord * u_resolution);
    vec4 cell1 = texture(u_cellTexture1, v_texCoord);
    vec4 cell1Old = texture(u_cellTexture1Old, v_texCoord);
    vec4 cell2 = texture(u_cellTexture2, v_texCoord);
    vec4 myIntention = texture(u_intentionTexture, v_texCoord);

    vec4 newCell2 = cell2;

    // Check if this cell was newly created (ID changed)
    if (cell1.x != cell1Old.x && cell1.x > 0.0) {
        // Find parent's intention
        for (float dy = -1.0; dy <= 1.0; dy++) {
            for (float dx = -1.0; dx <= 1.0; dx++) {
                if (dx == 0.0 && dy == 0.0) continue;

                vec2 checkPos = pixelPos + vec2(dx, dy);
                if (checkPos.x < 0.0 || checkPos.x >= u_resolution.x ||
                checkPos.y < 0.0 || checkPos.y >= u_resolution.y) continue;

                vec2 checkCoord = checkPos / u_resolution;
                vec4 intention = texture(u_intentionTexture, checkCoord);

                if (intention.x >= 1.0 && intention.x <= 4.0 &&
                abs(intention.y - pixelPos.x) < 0.5 &&
                abs(intention.z - pixelPos.y) < 0.5) {

                    // This is our parent
                    vec4 parentCell2 = texture(u_cellTexture2, checkCoord);
                    newCell2 = parentCell2;
                    newCell2.w = intention.w; // New activeGen
                    newCell2.y = 0.0; // Reset energyInFieldCell

                    // Apply mutation to activeGen
                    float seed = hash(vec3(pixelPos, u_time));
                    if (hash(vec3(seed, 0.0, u_time)) < u_mutationProbability) {
                        newCell2.w = floor(hash(vec3(seed, 1.0, u_time)) * u_geneMatrixSize.x * u_geneMatrixSize.y);
                    }
                    break;
                }
            }
        }
    }

    // Handle energy field updates
    if (cell1Old.x > 0.0 && myIntention.x > 0.0) {
        float action = myIntention.x;

        if (action == 5.0) { // Extract energy
                             float extracted = myIntention.w;
                             newCell2.y = max(0.0, newCell2.y - extracted);
        }
        else if (action >= 11.0 && action <= 13.0) { // Suicide actions
                                                     if (action == 11.0) newCell2.y = 0.0;
                                                     else if (action == 12.0) newCell2.y = cell1Old.z;
                                                     else if (action == 13.0) newCell2.y += cell1Old.y;

                                                     // Clear other fields
                                                     newCell2.x = 0.0;
                                                     newCell2.z = 0.0;
                                                     newCell2.w = 0.0;
        }
    }

    // Handle incoming energy to pixel
    if (cell1.x == 0.0) { // Empty cell
                          for (float dy = -1.0; dy <= 1.0; dy++) {
                              for (float dx = -1.0; dx <= 1.0; dx++) {
                                  if (dx == 0.0 && dy == 0.0) continue;

                                  vec2 checkPos = pixelPos + vec2(dx, dy);
                                  if (checkPos.x < 0.0 || checkPos.x >= u_resolution.x ||
                                  checkPos.y < 0.0 || checkPos.y >= u_resolution.y) continue;

                                  vec2 checkCoord = checkPos / u_resolution;
                                  vec4 intention = texture(u_intentionTexture, checkCoord);

                                  if ((intention.x >= 7.0 && intention.x <= 10.0) ||
                                  (intention.x >= 14.0 && intention.x <= 17.0)) {
                                      if (abs(intention.y - pixelPos.x) < 0.5 &&
                                      abs(intention.z - pixelPos.y) < 0.5) {
                                          newCell2.y += intention.w;
                                      }
                                  }
                              }
                          }
    }

    // Clear fields if cell died and store remaining energy in the pixel
    if (cell1Old.x > 0.0 && cell1.x == 0.0) {
        newCell2.y += cell1Old.y;
        newCell2.x = 0.0;
        newCell2.z = 0.0;
        newCell2.w = 0.0;
    }

    fragColor = newCell2;
}
