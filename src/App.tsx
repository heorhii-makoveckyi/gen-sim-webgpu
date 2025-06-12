import React, { useEffect, useRef, useState } from 'react';
import { initWebGPU } from './webgpuUtil';
// We'll import shader code as strings via Vite's raw import:
import computeShaderCode from './shaders/simulation.wgsl?raw';
import renderShaderCode from './shaders/render.wgsl?raw';

const CanvasWidth = 600;   // Canvas pixel dimensions (could be parameterized)
const CanvasHeight = 600;

type CellParams = {
  maxEnergy: number;
  will: number;
  maxEnergyToGet: number;
  energyFromSun: number;
};

// Helper to create a cell state object (for CPU side initialization)
const createCell = (id: number, params: CellParams, energy: number, activeGen: number) => {
  return {
    originalId: id,
    energy,
    maxEnergy: params.maxEnergy,
    will: params.will,
    maxEnergyToGet: params.maxEnergyToGet,
    energyInFieldCell: 0,
    energyFromSun: params.energyFromSun,
    activeGen
  };
};

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simulation settings state (controlled by inputs):
  const [initialCount, setInitialCount] = useState(10);
  const [geneCount, setGeneCount] = useState(16);  // total genes per cell
  const [energyMultiplier, setEnergyMultiplier] = useState(1);
  const [mutationProb, setMutationProb] = useState(0.05);
  // Cell param ranges (we store as string for inputs, parse to numbers):
  const [maxEnergyRange, setMaxEnergyRange] = useState("100");
  const [willRange, setWillRange] = useState("50");
  const [maxEnergyToGetRange, setMaxEnergyToGetRange] = useState("20");
  const [energyFromSunRange, setEnergyFromSunRange] = useState("10");

  // Sunlight settings:
  const [sunMode, setSunMode] = useState("Constant Full");
  const [sunEnergy, setSunEnergy] = useState(5);
  const [sunCycle, setSunCycle] = useState(200); // frames

  // Overlay toggles:
  const [showCells, setShowCells] = useState(true);
  const [showEnergy, setShowEnergy] = useState(true);
  const [showSun, setShowSun] = useState(true);
  const [showCellEnergy, setShowCellEnergy] = useState(true);

  // WebGPU device and context state:
  const gpuDeviceRef = useRef<GPUDevice>(null);
  const canvasCtxRef = useRef<GPUCanvasContext>(null);
  const computePipelineRef = useRef<GPUComputePipeline>(null);
  const renderPipelineRef = useRef<GPURenderPipeline>(null);
  const bindGroupComputeRef = useRef<GPUBindGroup>(null);
  const presentationFormatRef = useRef<GPUTextureFormat>("bgra8unorm");
  const bindGroupRenderRef = useRef<GPUBindGroup>(null);
  const stateBufferARef = useRef<GPUBuffer>(null);
  const stateBufferBRef = useRef<GPUBuffer>(null);
  const geneBufferRef = useRef<GPUBuffer>(null);
  const paramUniformRef = useRef<GPUBuffer>(null);    // Uniform buffer for parameters (sun, toggles, etc.)
  const frameUniformRef = useRef<GPUBuffer>(null);    // Uniform buffer for dynamic per-frame data (like frame count)

  const [simRunning, setSimRunning] = useState(false);
  const frameCountRef = useRef<number>(0);        // Keep track of simulation frames
  const animationFrameRef = useRef<number>(null);     // requestAnimationFrame handle
  const [paused, setPaused] = useState(false);

  // Copy-paste buffer for a cell's gene and params:
  const copiedGeneRef = useRef<Uint32Array>(null);   // store gene sequence of copied cell
  const copiedParamsRef = useRef<CellParams>(null);  // store traits of copied cell

  // Initialize WebGPU device and buffers
  useEffect(() => {
    const init = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        // Request WebGPU Device and Canvas Context
        const { device, canvasContext, presentationFormat } = await initWebGPU(canvas);
        gpuDeviceRef.current = device;
        canvasCtxRef.current = canvasContext;

        presentationFormatRef.current = presentationFormat;

        // Create uniform buffers (paramUniform holds global settings; frameUniform holds frameCount and possibly time)
        paramUniformRef.current = device.createBuffer({
          size: 4 * 16,  // allocate 16 floats/ints worth of space (64 bytes) for various parameters
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        frameUniformRef.current = device.createBuffer({
          size: 4 * 4,  // space for 4 floats/ints (16 bytes)
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // No state or gene buffers yet (they depend on simulation start parameters). We'll create them on Start.

      } catch (err) {
        console.error("WebGPU initialization error:", err);
      }
    };
    init();
  }, []);  // run once on mount

  const createPipelines = () => {
    const device = gpuDeviceRef.current;
    if (!device) return;
    const presentationFormat = presentationFormatRef.current;

    const evalExpr = (expr: string): string => {
      const ctx = { CanvasWidth, CanvasHeight, geneCount };
      const sanitized = expr.replace(/CanvasWidth|CanvasHeight|geneCount/g, (m) => String(ctx[m as keyof typeof ctx]));
      try {
        return Function(`"use strict"; return (${sanitized});`)().toString();
      } catch {
        return expr;
      }
    };

    const placeholderRegex = /\${([^}]+)}/g;

    const computeCode = computeShaderCode.replace(placeholderRegex, (_, ex) => evalExpr(ex));
    const renderCode = renderShaderCode.replace(placeholderRegex, (_, ex) => evalExpr(ex));

    const computeModule = device.createShaderModule({ code: computeCode });
    const renderModule = device.createShaderModule({ code: renderCode });

    const computeBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
      ]
    });

    const renderBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }
      ]
    });

    computePipelineRef.current = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [computeBindGroupLayout] }),
      compute: { module: computeModule, entryPoint: 'computeMain' }
    });

    renderPipelineRef.current = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
      vertex: { module: renderModule, entryPoint: 'vertMain', buffers: [] },
      fragment: { module: renderModule, entryPoint: 'fragMain', targets: [{ format: presentationFormat }] },
      primitive: { topology: 'point-list' }
    });
  };

  // Function to initialize simulation state buffers and bind groups
  const setupSimulation = () => {
    const device = gpuDeviceRef.current;
    if (!device) return;

    frameCountRef.current = 0;

    // Derive numeric ranges for initial random cell parameters
    const maxE = Number(maxEnergyRange.split('-')[0] || maxEnergyRange);
    const wil = Number(willRange.split('-')[0] || willRange);
    const maxGet = Number(maxEnergyToGetRange.split('-')[0] || maxEnergyToGetRange);
    const eSun = Number(energyFromSunRange.split('-')[0] || energyFromSunRange);
    const baseParams: CellParams = {
      maxEnergy: maxE || 100,
      will: wil || 50,
      maxEnergyToGet: maxGet || 20,
      energyFromSun: eSun || 10
    };

    const totalCells = CanvasWidth * CanvasHeight;
    const stateStructSize = 8 * 4; // 8 properties * 4 bytes (u32) each = 32 bytes per cell.
    const stateBufferSize = totalCells * stateStructSize;
    const geneBufferSize = totalCells * geneCount * 4; // each gene code 4 bytes

    // If buffers exist from previous run, destroy them to release memory
    stateBufferARef.current?.destroy();
    stateBufferBRef.current?.destroy();
    geneBufferRef.current?.destroy();

    stateBufferARef.current = device.createBuffer({
      size: stateBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    stateBufferBRef.current = device.createBuffer({
      size: stateBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    geneBufferRef.current = device.createBuffer({
      size: geneBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    // Prepare initial data for state and gene buffers (on CPU)
    const stateArray = new Uint32Array(totalCells * 8);
    const geneArray = new Uint32Array(totalCells * geneCount);

    // Fill with empty defaults
    for (let i = 0; i < totalCells; ++i) {
      // Default environment energy etc.
      stateArray[i*8 + 0] = 0; // originalId = 0 (no cell)
      stateArray[i*8 + 1] = 0; // energy
      stateArray[i*8 + 2] = baseParams.maxEnergy;
      stateArray[i*8 + 3] = baseParams.will;
      stateArray[i*8 + 4] = baseParams.maxEnergyToGet;
      stateArray[i*8 + 5] = 0; // energyInFieldCell
      stateArray[i*8 + 6] = baseParams.energyFromSun;
      stateArray[i*8 + 7] = 0; // activeGen
      // Gene matrix already 0-filled by default (no-ops).
    }

    // Randomly create initialCount cells
    for (let c = 0; c < initialCount; ++c) {
      const idx = Math.floor(Math.random() * totalCells);
      // Assign a unique originalId (1..initialCount)
      const origId = c + 1;
      // Randomize traits within some range if specified as range (not used here extensively)
      const cellParams: CellParams = {
        maxEnergy: baseParams.maxEnergy,
        will: baseParams.will,
        maxEnergyToGet: baseParams.maxEnergyToGet,
        energyFromSun: baseParams.energyFromSun
      };
      // If range inputs were provided like "80-120", could randomize here. (For simplicity, using baseParams directly)
      const initialEnergy = Math.floor(cellParams.maxEnergy / 2); // start with half max energy
      const activeGeneStart = 0;  // could randomize start gene if desired

      // Place cell in stateArray
      const o = idx * 8;
      stateArray[o] = origId;
      stateArray[o+1] = initialEnergy;
      stateArray[o+2] = cellParams.maxEnergy;
      stateArray[o+3] = cellParams.will;
      stateArray[o+4] = cellParams.maxEnergyToGet;
      stateArray[o+5] = 0;  // environment energy initially 0
      stateArray[o+6] = cellParams.energyFromSun;
      stateArray[o+7] = activeGeneStart;

      // Create a random gene sequence for this cell
      // We'll populate with some random actions to start diversity
      for (let g = 0; g < geneCount; ++g) {
        let geneCode;
        if (g < geneCount - 2) {
          // Avoid placing divide at last index because it expects params after
          const actions = [0, 1, 2, 3, 4, 5, 6, 7, 14];
          // (Include a sampling of allowed actions; include one suicide maybe)
          geneCode = actions[Math.floor(Math.random() * actions.length)];
        } else {
          geneCode = 0; // ensure safe tail (or could wrap around)
        }
        geneArray[idx * geneCount + g] = geneCode;
      }
      // Optionally ensure each cell has at least one divide gene in its genome to allow evolution (not strictly required).
      // This is domain-specific tuning.
      geneArray[idx * geneCount + Math.floor(Math.random()* (geneCount-2))] = 11; // place a divide somewhere
      // Put direction and new active right after divide (just random values as placeholder)
      // (If divide is at second last position, ensure last pos exists as param).
    }

    // Upload initial data to GPU buffers
    device.queue.writeBuffer(stateBufferARef.current, 0, stateArray);
    device.queue.writeBuffer(stateBufferBRef.current, 0, stateArray);
    // We initialize both A and B with the same initial state for simplicity. A is current, B will be next.
    device.queue.writeBuffer(geneBufferRef.current, 0, geneArray);

    // Create bind groups for compute and render, using the current initial buffers.
    const computeBindGroup = device.createBindGroup({
      layout: computePipelineRef.current!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: stateBufferARef.current! } },  // input state
        { binding: 1, resource: { buffer: stateBufferBRef.current! } },  // output state
        { binding: 2, resource: { buffer: geneBufferRef.current! } },
        { binding: 3, resource: { buffer: paramUniformRef.current! } },
        { binding: 4, resource: { buffer: frameUniformRef.current! } }
      ]
    });
    const renderBindGroup = device.createBindGroup({
      layout: renderPipelineRef.current!.getBindGroupLayout(0),
      entries: [
        // For rendering, we'll always use the "current state" buffer. Start with A as current.
        { binding: 0, resource: { buffer: stateBufferARef.current! } },
        { binding: 1, resource: { buffer: paramUniformRef.current! } },
        { binding: 2, resource: { buffer: frameUniformRef.current! } }
      ]
    });
    bindGroupComputeRef.current = computeBindGroup;
    bindGroupRenderRef.current = renderBindGroup;
  };

  // Write uniform data (sun settings, overlay toggles) to paramUniform buffer
  const updateParamUniforms = () => {
    const device = gpuDeviceRef.current;
    if (!device) return;
    // We pack data into an array of 16 32-bit values (just to match the buffer size reserved)
    const data = new Float32Array(16);
    // Sun parameters
    data[0] = sunEnergy;
    data[1] = sunCycle;
    let modeIndex;
    switch (sunMode) {
      case "Constant Full": modeIndex = 0; break;
      case "Clipping Full": modeIndex = 1; break;
      case "Constant 4 Islands": modeIndex = 2; break;
      case "Clipping 4 Islands": modeIndex = 3; break;
      case "Dynamic Sun": modeIndex = 4; break;
      default: modeIndex = 0;
    }
    data[2] = modeIndex;
    data[3] = energyMultiplier;
    // Overlay toggles (use 0 or 1 integers, stored in float array but will be cast to bool in shader)
    data[4] = showCells ? 1 : 0;
    data[5] = showEnergy ? 1 : 0;
    data[6] = showSun ? 1 : 0;
    data[7] = showCellEnergy ? 1 : 0;
    // (We can use additional slots for other global params if needed)

    device.queue.writeBuffer(paramUniformRef.current!, 0, data.buffer);
  };

  // Frame update function: runs one simulation step and schedules the next frame
  const runFrame = () => {
    const device = gpuDeviceRef.current;
    const canvasContext = canvasCtxRef.current;
    if (!device || !canvasContext) return;

    // Update uniforms for this frame
    frameCountRef.current += 1;
    const frameData = new Uint32Array([ frameCountRef.current ]);
    device.queue.writeBuffer(frameUniformRef.current!, 0, frameData);  // update frame count (for dynamic sun)
    updateParamUniforms();

    // Encode commands for compute and render
    const commandEncoder = device.createCommandEncoder();

    // Compute pass: execute simulation compute shader
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipelineRef.current!);
    computePass.setBindGroup(0, bindGroupComputeRef.current!);
    // Dispatch workgroups to cover entire grid (we choose 1 thread per pixel for simplicity)
    const workgroupSize = 16;
    const dispatchX = Math.ceil(CanvasWidth / workgroupSize);
    const dispatchY = Math.ceil(CanvasHeight / workgroupSize);
    computePass.dispatchWorkgroups(dispatchX, dispatchY);
    computePass.end();

    // After compute, swap the state buffers (ping-pong) for next iteration.
    // We don't actually swap GPU buffer contents, just swap our references and update bind groups.
    [stateBufferARef.current, stateBufferBRef.current] = [stateBufferBRef.current, stateBufferARef.current];
    // Now stateBufferARef is the new current state (just computed).
    // Update bind groups to reflect swapped roles:
    bindGroupComputeRef.current = device.createBindGroup({
      layout: computePipelineRef.current!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: stateBufferARef.current! } }, // new current (was B)
        { binding: 1, resource: { buffer: stateBufferBRef.current! } }, // new output (was A)
        { binding: 2, resource: { buffer: geneBufferRef.current! } },
        { binding: 3, resource: { buffer: paramUniformRef.current! } },
        { binding: 4, resource: { buffer: frameUniformRef.current! } }
      ]
    });
    bindGroupRenderRef.current = device.createBindGroup({
      layout: renderPipelineRef.current!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: stateBufferARef.current! } }, // use updated current for rendering
        { binding: 1, resource: { buffer: paramUniformRef.current! } },
        { binding: 2, resource: { buffer: frameUniformRef.current! } }
      ]
    });

    // Render pass: draw the current state to canvas
    const textureView = canvasContext.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 }, // clear to black
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    renderPass.setPipeline(renderPipelineRef.current!);
    renderPass.setBindGroup(0, bindGroupRenderRef.current!);
    // Draw points: vertexCount = total cells, each vertex is one point
    const totalVertices = CanvasWidth * CanvasHeight;
    renderPass.draw(totalVertices, 1, 0, 0);
    renderPass.end();

    // Submit command buffer
    device.queue.submit([commandEncoder.finish()]);

    // Schedule next frame if running and not paused
    if (simRunning && !paused) {
      animationFrameRef.current = requestAnimationFrame(runFrame);
    }
  };

  const startSimulation = () => {
    if (simRunning) {
      // If already running, stop first to reinitialize
      stopSimulation();
    }
    createPipelines();
    setupSimulation();
    setSimRunning(true);
    setPaused(false);
    frameCountRef.current = 0;
    // Kick off the animation loop
    animationFrameRef.current = requestAnimationFrame(runFrame);
  };

  const pauseSimulation = () => {
    setPaused(true);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const continueSimulation = () => {
    if (simRunning && paused) {
      setPaused(false);
      animationFrameRef.current = requestAnimationFrame(runFrame);
    }
  };

  const stopSimulation = () => {
    setSimRunning(false);
    setPaused(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    // Optionally, we could clear the canvas or reset GPU state. For simplicity, we just leave last frame.
  };

  // Placeholder for copy/paste actions (actual cell selection via mouse not implemented here)
  const copyCell = () => {
    // In a full implementation, we would read back a selected cell's state from GPU or track it in CPU state.
    // For now, just log (assuming we had selected the first cell for demo).
    if (!gpuDeviceRef.current) return;
    console.log("Copy cell feature not fully implemented in this demo.");
    // We could use device.queue.readBuffer to get cell data at an index if needed.
  };
  const pasteCell = () => {
    if (!gpuDeviceRef.current || !copiedGeneRef.current || !copiedParamsRef.current) return;
    // For demo, paste the copied cell at a random empty location
    const device = gpuDeviceRef.current;
    const totalCells = CanvasWidth * CanvasHeight;
    const idx = Math.floor(Math.random() * totalCells);
    // We would update stateBufferA at that index with copied params and geneBuffer with copiedGene.
    // This requires writing to the GPU buffer at specific offset.
    const offset = idx * 8 * 4; // offset in bytes for state (8 properties each 4 bytes)
    const geneOffset = idx * geneCount * 4;
    const cell = createCell(copiedParamsRef.current!.will, copiedParamsRef.current!, copiedParamsRef.current!.maxEnergy/2, 0);
    // Actually, originalId for pasted could be new or from copied, depending on whether we treat it as same lineage.
    // We'll set originalId = a large number (like 9999) to mark it as an injected foreign cell.
    cell.originalId = 9999;
    const cellData = new Uint32Array([
      cell.originalId,
      cell.energy,
      cell.maxEnergy,
      cell.will,
      cell.maxEnergyToGet,
      0, // env energy
      cell.energyFromSun,
      cell.activeGen
    ]);
    device.queue.writeBuffer(stateBufferARef.current!, offset, cellData);
    device.queue.writeBuffer(geneBufferRef.current!, geneOffset, copiedGeneRef.current);
    console.log(`Pasted cell at index ${idx}`);
  };

  return (
    <div id="controls">
      <h1>WebGPU Genetic Algorithm Simulation</h1>
      <canvas ref={canvasRef} width={CanvasWidth} height={CanvasHeight}></canvas>
      <div>
        <button onClick={startSimulation}>Start</button>
        <button onClick={pauseSimulation}>Pause</button>
        <button onClick={continueSimulation}>Continue</button>
        <button onClick={stopSimulation}>Stop</button>
        <button onClick={startSimulation}>Start Random</button>
      </div>
      <div style={{ marginTop: '0.5em' }}>
        Initial Cell Count:
        <input type="number" value={initialCount} min="0" max={CanvasWidth*CanvasHeight} onChange={e=>setInitialCount(Number(e.target.value))} />
        Gene Matrix Size:
        <input type="number" value={geneCount} min="4" max="256" onChange={e=>setGeneCount(Number(e.target.value))} />
        Energy Multiplier:
        <input type="number" value={energyMultiplier} step="0.1" onChange={e=>setEnergyMultiplier(Number(e.target.value))} />
      </div>
      <div>
        MaxEnergy:
        <input type="text" value={maxEnergyRange} onChange={e=>setMaxEnergyRange(e.target.value)} title="Set a value or range for maxEnergy" />
        Will:
        <input type="text" value={willRange} onChange={e=>setWillRange(e.target.value)} />
        MaxEnergyToGet:
        <input type="text" value={maxEnergyToGetRange} onChange={e=>setMaxEnergyToGetRange(e.target.value)} />
        EnergyFromSun:
        <input type="text" value={energyFromSunRange} onChange={e=>setEnergyFromSunRange(e.target.value)} />
      </div>
      <div>
        Mutation Probability:
        <input type="number" value={mutationProb} step="0.01" min="0" max="1" onChange={e=>setMutationProb(Number(e.target.value))} />
      </div>
      <div style={{ marginTop: '0.5em' }}>
        Sun Mode:
        <select value={sunMode} onChange={e=>setSunMode(e.target.value)}>
          <option>Constant Full</option>
          <option>Clipping Full</option>
          <option>Constant 4 Islands</option>
          <option>Clipping 4 Islands</option>
          <option>Dynamic Sun</option>
        </select>
        Energy per pixel:
        <input type="number" value={sunEnergy} onChange={e=>setSunEnergy(Number(e.target.value))} />
        Cycle duration (frames):
        <input type="number" value={sunCycle} onChange={e=>setSunCycle(Number(e.target.value))} />
      </div>
      <div style={{ marginTop: '0.5em' }}>
        <label><input type="checkbox" checked={showCells} onChange={e=>setShowCells(e.target.checked)} /> Show Cells (color)</label>
        <label><input type="checkbox" checked={showEnergy} onChange={e=>setShowEnergy(e.target.checked)} /> Show Env Energy (purple)</label>
        <label><input type="checkbox" checked={showSun} onChange={e=>setShowSun(e.target.checked)} /> Show Sunlight (yellow)</label>
        <label><input type="checkbox" checked={showCellEnergy} onChange={e=>setShowCellEnergy(e.target.checked)} /> Show Cell Energy (green)</label>
      </div>
      <div style={{ marginTop: '0.5em' }}>
        <button onClick={copyCell}>Copy Cell</button>
        <button onClick={pasteCell}>Paste Copied Cell</button>
        <label><input type="checkbox" /> Repeat Paste</label>
      </div>
    </div>
  );
};

export default App;
