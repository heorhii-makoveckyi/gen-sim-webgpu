#version 300 es
precision highp float;

uniform sampler2D u_cellTexture1;    // originalId, energy, maxEnergy, will
uniform sampler2D u_cellTexture2;    // maxEnergyToGet, energyInFieldCell, energyFromSun, activeGen
uniform sampler2D u_intentionTexture; // action, targetX, targetY, data
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

// Check if another cell wants to act on this position
vec4 findBestIntention(vec2 pixelPos) {
    vec4 bestIntention = vec4(0.0);
    float bestScore = -1.0;

    // Check 3x3 area around this pixel for cells that might want to act here
    for (float dy = -1.0; dy <= 1.0; dy++) {
        for (float dx = -1.0; dx <= 1.0; dx++) {
            vec2 checkPos = pixelPos + vec2(dx, dy);
            if (checkPos.x < 0.0 || checkPos.x >= u_resolution.x ||
            checkPos.y < 0.0 || checkPos.y >= u_resolution.y) continue;

            vec2 checkCoord = checkPos / u_resolution;
            vec4 intention = texture(u_intentionTexture, checkCoord);

            // Check if this intention targets our pixel
            if (intention.x > 0.0 &&
            abs(intention.y - pixelPos.x) < 0.5 &&
            abs(intention.z - pixelPos.y) < 0.5) {

                // Division actions (1-4) that target this position
                if (intention.x >= 1.0 && intention.x <= 4.0) {
                    vec4 sourceCell1 = texture(u_cellTexture1, checkCoord);
                    vec4 sourceCell2 = texture(u_cellTexture2, checkCoord);

                    // Calculate conflict resolution score
                    float score = sourceCell1.w * 1000000.0 + // will
                    sourceCell1.y * 1000.0 + // energy
                    sourceCell2.y * 100.0 + // energyInFieldCell
                    sourceCell1.x;              // originalId

                    if (score > bestScore) {
                        bestScore = score;
                        float action = intention.x;     // сохраняем исходное действие
                        bestIntention = intention;       // копируем всё как есть
                        bestIntention.x = checkPos.x;      // x-коорд. родителя
                        bestIntention.y = checkPos.y;      // y-коорд. родителя
                        bestIntention.w = action;          // action 1-4 перекидываем в w
                    }
                }
            }
        }
    }

    return bestIntention;
}

// Apply mutation to gene
float mutateGene(float gene, float seed) {
    if (hash(vec3(seed, gene, u_time)) < u_mutationProbability) {
        return floor(hash(vec3(seed + 1.0, gene, u_time)) * 18.0); // 0-17
    }
    return gene;
}

void main() {
    vec2 pixelPos = floor(v_texCoord * u_resolution);
    vec4 cell1 = texture(u_cellTexture1, v_texCoord);
    vec4 cell2 = texture(u_cellTexture2, v_texCoord);
    vec4 myIntention = texture(u_intentionTexture, v_texCoord);

    vec4 newCell1 = cell1;

    // Handle incoming division
    vec4 incomingDivision = findBestIntention(pixelPos);
    // action теперь во втором слове (w)
    if (incomingDivision.w >= 1.0 && incomingDivision.w <= 4.0 && cell1.x == 0.0) {
        // This is an empty cell receiving a division
        vec2 sourceCoord = incomingDivision.xy / u_resolution;
        vec4 sourceCell1 = texture(u_cellTexture1, sourceCoord);

        // Copy parent cell with half energy
        newCell1 = sourceCell1;
        newCell1.x = pixelPos.y * u_resolution.x + pixelPos.x + u_time * 1000.0; // New unique ID
        newCell1.y = sourceCell1.y * 0.5; // Half parent's energy
    }

    // Handle my own actions
    if (cell1.x > 0.0 && myIntention.x > 0.0) {
        float action = myIntention.x;

        if (action >= 1.0 && action <= 4.0) { // Division
                                              // Halve my energy if division succeeded
                                              vec2 targetPos = vec2(myIntention.y, myIntention.z);
                                              vec4 targetCell = texture(u_cellTexture1, targetPos / u_resolution);
                                              if (targetCell.x == 0.0) { // Target was empty
                                                                         newCell1.y *= 0.5;
                                              }
        }
        else if (action == 5.0) { // Extract energy
                                  float extracted = myIntention.w;
                                  newCell1.y = min(newCell1.y + extracted - newCell1.w, newCell1.z); // Add to cell
        }
        else if (action == 6.0) { // Solar energy
                                  float solar = myIntention.w;
                                  newCell1.y = min(newCell1.y + solar - newCell1.w, newCell1.z);
        }
        else if (action >= 11.0 && action <= 13.0) { // Suicide pixel actions
                                                     // Cell dies
                                                     newCell1 = vec4(0.0);
        }
    }

    // Handle incoming energy transfers
    for (float dy = -1.0; dy <= 1.0; dy++) {
        for (float dx = -1.0; dx <= 1.0; dx++) {
            if (dx == 0.0 && dy == 0.0) continue;

            vec2 checkPos = pixelPos + vec2(dx, dy);
            if (checkPos.x < 0.0 || checkPos.x >= u_resolution.x ||
            checkPos.y < 0.0 || checkPos.y >= u_resolution.y) continue;

            vec2 checkCoord = checkPos / u_resolution;
            vec4 intention = texture(u_intentionTexture, checkCoord);

            // Check if this is an energy transfer to us
            if ((intention.x >= 7.0 && intention.x <= 10.0) ||
            (intention.x >= 14.0 && intention.x <= 17.0)) {
                if (abs(intention.y - pixelPos.x) < 0.5 &&
                abs(intention.z - pixelPos.y) < 0.5) {

                    float transferAmount = intention.w;
                    if (cell1.x > 0.0) {
                        // Transfer to cell
                        newCell1.y = min(newCell1.y + transferAmount, newCell1.z);
                    }
                }
            }
        }
    }

    if (newCell1.x > 0.0 && newCell1.y <= 0.0) {
        newCell1 = vec4(0.0);
    }

    fragColor = newCell1;
}
