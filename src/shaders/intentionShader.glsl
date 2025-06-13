#version 300 es
precision highp float;

uniform sampler2D u_cellTexture1; // originalId, energy, maxEnergy, will
uniform sampler2D u_cellTexture2; // maxEnergyToGet, energyInFieldCell, energyFromSun, activeGen
uniform sampler2D u_geneTexture;  // Gene matrix
uniform vec2 u_resolution;
uniform vec2 u_geneMatrixSize;
uniform float u_mutationProbability;

in vec2 v_texCoord;
layout(location = 0) out vec4 intentionData; // action, targetX, targetY, data

// Hash for randomness
float hash(vec3 p) {
    p = fract(p * vec3(123.34, 456.21, 789.32));
    p += dot(p, p.yzx + 45.32);
    return fract(p.x * p.y * p.z);
}

// Get gene from matrix
float getGene(float activeGen, float geneIndex) {
    float totalGenes = u_geneMatrixSize.x * u_geneMatrixSize.y;
    float row = floor(activeGen);
    float col = floor(geneIndex);

    vec2 geneCoord = vec2(col, row) / u_geneMatrixSize;
    return texture(u_geneTexture, geneCoord).r;
}

void main() {
    vec4 cell1 = texture(u_cellTexture1, v_texCoord);
    vec4 cell2 = texture(u_cellTexture2, v_texCoord);

    // Default: no intention
    intentionData = vec4(0.0);

    // Skip if empty cell
    if (cell1.x == 0.0) return;

    float originalId = cell1.x;
    float energy = cell1.y;
    float maxEnergy = cell1.z;
    float will = cell1.w;
    float activeGen = cell2.w;

    // Check if cell should die
    float minEnergy = u_geneMatrixSize.x * will;
    bool isDying = energy < minEnergy;

    // Execute genes in order
    vec2 pixelCoord = floor(v_texCoord * u_resolution);

    for (float i = 0.0; i < u_geneMatrixSize.x; i++) {
        float gene = getGene(activeGen, i);
        float energyCost = will;

        // Skip if not enough energy (except for suicide genes)
        if (!isDying && energy < energyCost) continue;

        if (gene == 0.0) { // IDLE
                           // No action, no energy cost
        }
        else if (gene >= 1.0 && gene <= 4.0) { // DIVIDE
                                               if (!isDying) {
                                                   vec2 targetPos = pixelCoord;
                                                   if (gene == 1.0) targetPos.y -= 1.0; // UP
                                                   else if (gene == 2.0) targetPos.x += 1.0; // RIGHT
                                                   else if (gene == 3.0) targetPos.y += 1.0; // DOWN
                                                   else if (gene == 4.0) targetPos.x -= 1.0; // LEFT

                                                   // Check bounds
                                                   if (targetPos.x >= 0.0 && targetPos.x < u_resolution.x &&
                                                   targetPos.y >= 0.0 && targetPos.y < u_resolution.y) {

                                                       // Get next gene for new cell's activeGen
                                                       float nextGeneIndex = i + 1.0;
                                                       if (nextGeneIndex < u_geneMatrixSize.x) {
                                                           float newActiveGen = getGene(activeGen, nextGeneIndex);

                                                           intentionData = vec4(gene, targetPos.x, targetPos.y, newActiveGen);
                                                           energy -= energyCost;
                                                           break; // Only one action per frame
                                                       }
                                                   }
                                               }
        }
        else if (gene == 5.0) { // EXTRACT_ENERGY
                                if (!isDying) {
                                    float extracted = min(cell2.x, cell2.y); // min(maxEnergyToGet, energyInFieldCell)
                                    energy = min(energy + extracted - energyCost, maxEnergy);
                                    intentionData = vec4(gene, pixelCoord.x, pixelCoord.y, extracted);
                                    break;
                                }
        }
        else if (gene == 6.0) { // GET_SOLAR_ENERGY
                                if (!isDying) {
                                    float solar = cell2.z; // energyFromSun
                                    energy = min(energy + solar - energyCost, maxEnergy);
                                    intentionData = vec4(gene, pixelCoord.x, pixelCoord.y, solar);
                                    break;
                                }
        }
        else if (gene >= 7.0 && gene <= 10.0) { // TRANSFER_ENERGY
                                                if (!isDying) {
                                                    vec2 targetPos = pixelCoord;
                                                    if (gene == 7.0) targetPos.y -= 1.0; // UP
                                                    else if (gene == 8.0) targetPos.x += 1.0; // RIGHT
                                                    else if (gene == 9.0) targetPos.y += 1.0; // DOWN
                                                    else if (gene == 10.0) targetPos.x -= 1.0; // LEFT

                                                    if (targetPos.x >= 0.0 && targetPos.x < u_resolution.x &&
                                                    targetPos.y >= 0.0 && targetPos.y < u_resolution.y) {

                                                        float transferAmount = min(energy - energyCost, cell2.x); // maxEnergyToGet
                                                        if (transferAmount > 0.0) {
                                                            intentionData = vec4(gene, targetPos.x, targetPos.y, transferAmount);
                                                            energy -= (transferAmount + energyCost);
                                                            break;
                                                        }
                                                    }
                                                }
        }
        else if (isDying && gene >= 11.0 && gene <= 17.0) { // SUICIDE_GENES
                                                            if (gene == 11.0) { // RESET_ZERO
                                                                                intentionData = vec4(gene, pixelCoord.x, pixelCoord.y, 0.0);
                                                            }
                                                            else if (gene == 12.0) { // RESET_MAX
                                                                                     intentionData = vec4(gene, pixelCoord.x, pixelCoord.y, maxEnergy);
                                                            }
                                                            else if (gene == 13.0) { // ADD_ENERGY
                                                                                     intentionData = vec4(gene, pixelCoord.x, pixelCoord.y, energy);
                                                            }
                                                            else if (gene >= 14.0 && gene <= 17.0) { // SUICIDE_TRANSFER
                                                                                                     vec2 targetPos = pixelCoord;
                                                                                                     if (gene == 14.0) targetPos.y -= 1.0; // UP
                                                                                                     else if (gene == 15.0) targetPos.x += 1.0; // RIGHT
                                                                                                     else if (gene == 16.0) targetPos.y += 1.0; // DOWN
                                                                                                     else if (gene == 17.0) targetPos.x -= 1.0; // LEFT

                                                                                                     if (targetPos.x >= 0.0 && targetPos.x < u_resolution.x &&
                                                                                                     targetPos.y >= 0.0 && targetPos.y < u_resolution.y) {
                                                                                                         intentionData = vec4(gene, targetPos.x, targetPos.y, energy);
                                                                                                     }
                                                            }
                                                            break; // Suicide genes execute immediately
        }
    }
}
