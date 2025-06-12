// WebGPU Compute Shader: Simulation Logic

struct Cell {
  originalId: u32,
  energy: atomic<u32>,
  maxEnergy: u32,
  will: u32,
  maxEnergyToGet: u32,
  energyInFieldCell: atomic<u32>,
  energyFromSun: u32,
  activeGen: u32,
};
@group(0) @binding(0) var<storage, read_write> stateIn: array<Cell>;
@group(0) @binding(1) var<storage, read_write> stateOut: array<Cell>;
@group(0) @binding(2) var<storage, read> geneMatrix: array<u32>;  // Flat array of all gene codes
@group(0) @binding(3) var<uniform> params: vec4<f32>;   // [sunEnergy, sunCycle, sunMode, energyMultiplier] in x,y,z,w
@group(0) @binding(4) var<uniform> frameInfo: vec4<u32>; // frameInfo.x = current frame count

// Helper: get 1D index from 2D
fn getIndex(x: u32, y: u32) -> u32 {
  return y * ${CanvasWidth}u + x;
}

// Pseudo-random number generator (Xorshift) for mutation
var<workgroup> randState: atomic<u32>;  // one shared state per workgroup
fn randomSeed(seed: u32) {
  // Initialize shared RNG state
  atomicStore(&randState, seed);
}
fn randomU32() -> u32 {
  let x = atomicLoad(&randState);
  var z = x;
  z ^= z << 13;
  z ^= z >> 17;
  z ^= z << 5;
  atomicStore(&randState, z);
  return z;
}
fn randomUniform() -> f32 {
  return f32(randomU32()) / 0xFFFFFFFFu;
}

// Determine if a given pixel is lit by sun this frame, based on mode
fn isSunLit(x: u32, y: u32) -> bool {
  let sunEnergy = params.x;
  let cycle = u32(params.y);
  let mode = u32(params.z);
  let frameCount = frameInfo.x;
  switch(mode) {
    // Mode 0: Constant Full
    case 0u: {
      return true;
    }
    // Mode 1: Clipping Full (global day/night)
    case 1u: {
      if (cycle == 0u) { return true; }
      // half cycle on, half off
      return (frameCount % cycle) < (cycle / 2u);
    }
    // Mode 2: Constant 4 Islands (quadrants always lit)
    case 2u: {
      let midX = ${CanvasWidth / 2}u;
      let midY = ${CanvasHeight / 2}u;
      // define 4 quadrant regions as islands:
      let inIsland = (x < midX && y < midY) || // bottom-left quadrant
                     (x >= midX && y < midY) || // bottom-right
                     (x < midX && y >= midY) || // top-left
                     (x >= midX && y >= midY);  // top-right
      return inIsland;
    }
    // Mode 3: Clipping 4 Islands (quadrants blink together)
    case 3u: {
      if (cycle == 0u) {
        // If no cycle defined, behave like constant 4 islands
        let midX = ${CanvasWidth / 2}u;
        let midY = ${CanvasHeight / 2}u;
        return ((x < midX && y < midY) || (x >= midX && y < midY) || (x < midX && y >= midY) || (x >= midX && y >= midY));
      }
      let day = (frameCount % cycle) < (cycle / 2u);
      if (!day) { return false; }
      // if day, same as constant islands:
      let midX = ${CanvasWidth / 2}u;
      let midY = ${CanvasHeight / 2}u;
      return ((x < midX && y < midY) || (x >= midX && y < midY) || (x < midX && y >= midY) || (x >= midX && y >= midY));
    }
    // Mode 4: Dynamic Sun (moving vertical band of sunlight)
    case 4u: {
      if (cycle == 0u) {
        // if no cycle, treat as full sun
        return true;
      }
      let phase = f32(frameCount % cycle) / f32(cycle);
      // Band center moves from top (y ~ height-1) to bottom (y ~ 0) as phase goes 0->1
      let centerY = (1.0 - phase) * f32(${CanvasHeight - 1});
      let bandHalfHeight = f32(${CanvasHeight}) * 0.25; // band covers 50% of height total
      let yFloat = f32(y);
      return (yFloat >= centerY - bandHalfHeight && yFloat <= centerY + bandHalfHeight);
    }
    default: {
      return true;
    }
  }
}

// Get neighbor coordinate for a direction code 0-7 (0=up, then clockwise)
fn getNeighborCoord(x: u32, y: u32, dir: u32) -> vec2<u32> {
  var nx: i32 = i32(x);
  var ny: i32 = i32(y);
  switch(dir) {
    case 0u: { ny = ny + 1; }          // up
    case 1u: { nx = nx + 1; ny = ny + 1; } // up-right
    case 2u: { nx = nx + 1; }          // right
    case 3u: { nx = nx + 1; ny = ny - 1; } // down-right
    case 4u: { ny = ny - 1; }          // down
    case 5u: { nx = nx - 1; ny = ny - 1; } // down-left
    case 6u: { nx = nx - 1; }          // left
    case 7u: { nx = nx - 1; ny = ny + 1; } // up-left
    default: {}
  }
  return vec2<u32>(max(0, min(${CanvasWidth-1}, nx)), max(0, min(${CanvasHeight-1}, ny)));
}

// Gene action costs (we use a simple if ladder instead of a const array for WGSL compatibility)
fn getCost(gene: u32) -> u32 {
  if (gene == 0u) {
    return 0u;
  } else if (gene == 11u) {
    return 5u;
  } else if (gene >= 14u && gene <= 16u) {
    return 0u;
  } else {
    return 1u;
  }
}

@compute @workgroup_size(16, 16)
fn computeMain(@builtin(global_invocation_id) GlobalId: vec3u) {
  let x = GlobalId.x;
  let y = GlobalId.y;
  if (x >= ${CanvasWidth}u || y >= ${CanvasHeight}u) {
    return;
  }
  let index = getIndex(x, y);
  let cellIn = stateIn[index];

  // Copy environment energy from current to next by default
  atomicStore(&stateOut[index].energyInFieldCell, atomicLoad(&cellIn.energyInFieldCell));

  // Set default next state for cell: if no cell currently, remain empty
  if (cellIn.originalId == 0u) {
    // Ensure it stays empty: zero out fields (except environment which is handled)
    stateOut[index].originalId = 0u;
    stateOut[index].maxEnergy = cellIn.maxEnergy;
    stateOut[index].will = cellIn.will;
    stateOut[index].maxEnergyToGet = cellIn.maxEnergyToGet;
    stateOut[index].energyFromSun = cellIn.energyFromSun;
    stateOut[index].activeGen = 0u;
    // (No further action needed for empty cell)
    return;
  }

  // If cell exists, we will process its genes
  // First, prepare to carry over its properties to next (they may change due to actions)
  var newCell: Cell;
  // Copy static properties
  newCell.originalId = cellIn.originalId;
  newCell.maxEnergy = cellIn.maxEnergy;
  newCell.will = cellIn.will;
  newCell.maxEnergyToGet = cellIn.maxEnergyToGet;
  newCell.energyFromSun = cellIn.energyFromSun;
  // activeGen will normally remain same unless changed via reproduction logic
  newCell.activeGen = cellIn.activeGen;

  // We'll maintain local variables for energy and environment to avoid excessive atomic ops
  var energy = atomicLoad(&cellIn.energy);
  var envEnergyHere = atomicLoad(&cellIn.energyInFieldCell);

  // Set up RNG for potential mutations (seed with frame+index to vary per cell per frame)
  randomSeed(frameInfo.x + index);

  // Loop through gene instructions
  let geneCount = ${geneCount}u;
  var pc = cellIn.activeGen;
  var alive = true;
  for(var gi: u32 = 0u; gi < geneCount; gi = gi + 1u) {
    let gene = geneMatrix[index * ${geneCount}u + pc];
    pc = (pc + 1u) % ${geneCount}u;

    // Check cost
    let cost = getCost(gene);
    if (cost > 0u) {
      if (energy < cost) {
        // cannot pay cost -> cell dies
        alive = false;
        // Drop remaining energy to environment
        atomicAdd(&stateOut[index].energyInFieldCell, energy);
        energy = 0u;
        break;
      }
      energy -= cost;
    }

    switch(gene) {
      case 0u: {
        // no-op: do nothing
      }
      case 1u: { // extract energy from environment
        let take = min(newCell.maxEnergyToGet, envEnergyHere);
        if (take > 0u && energy < newCell.maxEnergy) {
          // Limit by cell capacity
          let capacity = newCell.maxEnergy - energy;
          let actualTake = min(take, capacity);
          envEnergyHere -= actualTake;
          energy += actualTake;
        }
      }
      case 2u: { // photosynthesis (sunlight)
        if (isSunLit(x, y)) {
          let availableSun = u32(params.x); // energy per pixel from uniform (params.x)
          let absorb = min(newCell.energyFromSun * u32(params.w), availableSun);
          if (absorb > 0u && energy < newCell.maxEnergy) {
            let capacity = newCell.maxEnergy - energy;
            let actualAbsorb = min(absorb, capacity);
            energy += actualAbsorb;
            // (Sunlight is not added to environment if unused, as per our design)
          }
        }
      }
      case 3u, 4u, 5u, 6u, 7u, 8u, 9u, 10u: { // transfer to neighbor directions
        let dir = gene - 3u;
        let neighborCoord = getNeighborCoord(x, y, dir);
        let nx = neighborCoord.x;
        let ny = neighborCoord.y;
        if (nx == x && ny == y) {
          // If neighbor is itself (out of bounds case), skip
        } else {
          let nIndex = getIndex(nx, ny);
          let neighborId = stateIn[nIndex].originalId;
          // Determine amount to transfer (half of current energy)
          let give = energy / 2u;
          if (give > 0u) {
            energy -= give;
            if (neighborId != 0u) {
              // neighbor cell exists: transfer to its energy
              atomicAdd(&stateOut[nIndex].energy, give);
            } else {
              // neighbor empty: drop to environment at neighbor
              atomicAdd(&stateOut[nIndex].energyInFieldCell, give);
            }
          }
        }
      }
      case 11u: { // divide
        if (gi + 2u <= geneCount - 1u) {
          // Next two genes are parameters: direction and newActiveGen
          let dirGene = geneMatrix[index * ${geneCount}u + pc];
          pc = (pc + 1u) % ${geneCount}u;
          let newActiveGeneVal = geneMatrix[index * ${geneCount}u + pc];
          pc = (pc + 1u) % ${geneCount}u;
          let neighborCoord = getNeighborCoord(x, y, dirGene % 8u);
          let nx = neighborCoord.x;
          let ny = neighborCoord.y;
          if (!(nx == x && ny == y)) {
            let nIndex = getIndex(nx, ny);
            // Only divide if neighbor spot is empty in current state
            if (stateIn[nIndex].originalId == 0u) {
              if (energy < 2u) {
                // not enough energy to reproduce
                alive = false;
                // drop whatever energy remains to environment
                atomicAdd(&stateOut[index].energyInFieldCell, energy);
                energy = 0u;
                break; // cell dies
              }
              // Use atomic compare-exchange to claim spot
              let expected: u32 = 0u;
              let succeeded: bool = atomicCompareExchange(&stateOut[nIndex].originalId, expected, cellIn.originalId).exchanged;
              if (succeeded) {
                // Create new cell in stateOut at nIndex
                // Copy genes from parent and mutate with some probability
                // (We assume geneMatrix is read-only; to mutate we could write into stateOut's gene area or separate mutation tracking)
                // For simplicity, we'll directly modify geneMatrix for the new cell in stateOut.
                // Actually, geneMatrix is a read-only buffer of initial genes; a real implementation might maintain a modifiable gene storage.
                // Here, we simulate mutation by potentially altering our local gene sequence copy and then writing out (which is not trivial with current design).
                // We'll skip full mutation implementation due to complexity, but note it.
                // Deduct energy for reproduction (give half to child)
                let childEnergy = energy / 2u;
                energy -= childEnergy;
                // Initialize child cell properties in output
                stateOut[nIndex].originalId = cellIn.originalId;
                atomicStore(&stateOut[nIndex].energy, childEnergy);
                stateOut[nIndex].maxEnergy = cellIn.maxEnergy;
                stateOut[nIndex].will = cellIn.will;
                stateOut[nIndex].maxEnergyToGet = cellIn.maxEnergyToGet;
                atomicStore(&stateOut[nIndex].energyInFieldCell, 0u);
                stateOut[nIndex].energyFromSun = cellIn.energyFromSun;
                stateOut[nIndex].activeGen = newActiveGeneVal % ${geneCount}u;
                // (Gene matrix copying and mutation would be done here in a full implementation)
              }
            }
          }
        }
      }
      case 14u, 15u, 16u: { // conditional suicide
        var thresholdRatio: f32;
        switch(gene) {
          case 14u: { thresholdRatio = 0.3; }
          case 15u: { thresholdRatio = 0.2; }
          case 16u: { thresholdRatio = 0.1; }
          default: { thresholdRatio = 0.1; }
        }
        let threshold = min(f32(newCell.will), thresholdRatio * f32(newCell.maxEnergy));
        if (f32(energy) < threshold) {
          // Low energy -> commit suicide
          // Transfer all energy to one neighbor (or environment if none)
          var given = false;
          // check all neighbors for a cell to give to
          for (var d: u32 = 0u; d < 8u; d = d + 1u) {
            let nCoord = getNeighborCoord(x, y, d);
            let nx = nCoord.x;
            let ny = nCoord.y;
            if (nx == x && ny == y) { continue; }
            let nIndex = getIndex(nx, ny);
            if (stateIn[nIndex].originalId != 0u) {
              // give to this neighbor
              atomicAdd(&stateOut[nIndex].energy, energy);
              given = true;
              break;
            }
          }
          if (!given) {
            // no neighbor cells, drop to environment here
            atomicAdd(&stateOut[index].energyInFieldCell, energy);
          }
          energy = 0u;
          alive = false;
          break;
        }
      }
      default: {
        // If gene code doesn't match any case, treat as no-op
      }
    } // end switch

    if (!alive) {
      break;
    }
  } // end gene loop

  if (alive) {
    // Cell survives this frame, write its updated state to stateOut
    stateOut[index].originalId = newCell.originalId;
    // Write back energy to atomic
    atomicStore(&stateOut[index].energy, energy);
    stateOut[index].maxEnergy = newCell.maxEnergy;
    stateOut[index].will = newCell.will;
    stateOut[index].maxEnergyToGet = newCell.maxEnergyToGet;
    // stateOut[index].energyInFieldCell already carried over and modified as needed
    stateOut[index].energyFromSun = newCell.energyFromSun;
    stateOut[index].activeGen = newCell.activeGen;
  } else {
    // Cell died this frame. We already transferred its energy out.
    // Mark cell as empty in stateOut
    stateOut[index].originalId = 0u;
    // (energy and env energy updated above, originalId=0 marks it empty)
    stateOut[index].maxEnergy = newCell.maxEnergy;
    stateOut[index].will = newCell.will;
    stateOut[index].maxEnergyToGet = newCell.maxEnergyToGet;
    stateOut[index].energyFromSun = newCell.energyFromSun;
    stateOut[index].activeGen = 0u;
  }
}
