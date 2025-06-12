// WebGPU Render Shaders: Vertex and Fragment for drawing cells and overlays

struct CellOut {
  originalId: u32;
  energy: u32;
  maxEnergy: u32;
  will: u32;
  maxEnergyToGet: u32;
  energyInFieldCell: u32;
  energyFromSun: u32;
  activeGen: u32;
};

@group(0) @binding(0) var<storage, read> state: array<CellOut>;
@group(0) @binding(1) var<uniform> params: vec4<f32>;
@group(0) @binding(2) var<uniform> frameInfo: vec4<u32>;

// Vertex output to fragment
struct Varyings {
  @builtin(position) Position: vec4<f32>,
  @location(0) cellIndex: u32
};

@vertex
fn vertMain(@builtin(vertex_index) vertexIndex: u32) -> Varyings {
  var out: Varyings;
  let width = ${CanvasWidth}u;
  let height = ${CanvasHeight}u;
  // Compute cell coordinates from vertex index (treat 0 as bottom-left cell)
  let x = vertexIndex % width;
  let y = vertexIndex / width;
  // Map to NDC with point at pixel center
  let centerX = f32(x) + 0.5;
  let centerY = f32(y) + 0.5;
  out.Position = vec4<f32>(
    centerX * 2.0 / f32(width) - 1.0,
    centerY * 2.0 / f32(height) - 1.0,
    0.0, 1.0);
  out.cellIndex = vertexIndex;
  return out;
}

@fragment
fn fragMain(@location(0) cellIndex: u32) -> @location(0) vec4<f32> {
  let cell = state[cellIndex];
  // Unpack uniform parameters and toggles
  let sunMode = u32(params.z);
  let energyMultiplier = params.w;
  // Toggle booleans stored in params.x/y or frameInfo if we packed them differently.
  // (We only used params for four floats; for simplicity, we'll repurpose the .y or .z of frameInfo for toggles in this example).
  // Actually, to keep it simple, let's assume toggles were packed into frameInfo.y as a bit mask:
  // bit0: showCells, bit1: showEnergy, bit2: showSun, bit3: showCellEnergy.
  let toggleMask = frameInfo.y;
  let showCells = (toggleMask & 0x1u) != 0u;
  let showEnergy = (toggleMask & 0x2u) != 0u;
  let showSun = (toggleMask & 0x4u) != 0u;
  let showCellEnergy = (toggleMask & 0x8u) != 0u;

  var color = vec3<f32>(0.0, 0.0, 0.0); // base black

  if (cell.originalId != 0u && showCells) {
    // Map originalId to a base color (simple hash for color variety)
    let id = cell.originalId;
    // Use bitwise operations or prime mod to get some color variation
    let r = f32((id * 97u) % 255u) / 255.0;
    let g = f32((id * 57u) % 255u) / 255.0;
    let b = f32((id * 17u) % 255u) / 255.0;
    color = vec3<f32>(r, g, b);
  }

  if (showEnergy) {
    // Overlay environment energy as purple (mix in proportionally)
    let env = cell.energyInFieldCell;
    if (env > 0u) {
      // Normalize energy amount to [0,1] range for intensity (assuming some reasonable scale, e.g., maxEnergy or a fixed value)
      let intensity = min(f32(env) / 50.0, 1.0);
      // Purple color
      let purple = vec3<f32>(0.6, 0.0, 0.6);
      // Additive blend purple based on intensity
      color = color + purple * intensity;
    }
  }

  if (showSun) {
    // If cell is under sunlight this frame, overlay yellow
    // We reuse isSunLit logic in fragment (duplicated to avoid complexity of calling compute function here)
    var lit = false;
    let width = ${CanvasWidth}u;
    let x = cellIndex % width;
    let y = cellIndex / width;
    let frameCount = frameInfo.x;
    switch(sunMode) {
      case 0u: { lit = true; }
      case 1u: { if (frameCount % u32(params.y) < u32(params.y)/2u) { lit = true; } }
      case 2u: {
        let midX = ${CanvasWidth/2}u;
        let midY = ${CanvasHeight/2}u;
        lit = (x < midX && y < midY) || (x >= midX && y < midY) || (x < midX && y >= midY) || (x >= midX && y >= midY);
      }
      case 3u: {
        if (frameCount % u32(params.y) < u32(params.y)/2u) {
          let midX = ${CanvasWidth/2}u;
          let midY = ${CanvasHeight/2}u;
          lit = (x < midX && y < midY) || (x >= midX && y < midY) || (x < midX && y >= midY) || (x >= midX && y >= midY);
        } else {
          lit = false;
        }
      }
      case 4u: {
        let cycle = u32(params.y);
        if (cycle == 0u) {
          lit = true;
        } else {
          let phase = f32(frameCount % cycle) / f32(cycle);
          let centerY = (1.0 - phase) * f32(${CanvasHeight - 1});
          let bandHalf = f32(${CanvasHeight}) * 0.25;
          let yf = f32(y);
          lit = (yf >= centerY - bandHalf && yf <= centerY + bandHalf);
        }
      }
      default: {}
    }
    if (lit) {
      // Yellow overlay
      let yellow = vec3<f32>(0.8, 0.8, 0.1);
      color = color + yellow * 0.5; // moderate intensity so it doesn't overwhelm
    }
  }

  if (cell.originalId != 0u && showCellEnergy) {
    // Overlay green according to cell's energy level
    let energyLevel = f32(cell.energy) / f32(cell.maxEnergy);
    let green = vec3<f32>(0.0, 1.0, 0.0);
    // Blend the current color towards green by energyLevel factor
    color = mix(color, green, energyLevel);
  }

  // Clamp final color
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(color, 1.0);
}
