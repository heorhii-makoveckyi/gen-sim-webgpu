export async function initWebGPU(canvas: HTMLCanvasElement) {
  if (!('gpu' in navigator)) {
    throw new Error("WebGPU not supported in this browser.");
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("Failed to get GPU adapter.");
  }
  const device = await adapter.requestDevice();
  const canvasContext = canvas.getContext('webgpu') as GPUCanvasContext;
  const format = navigator.gpu.getPreferredCanvasFormat();
  canvasContext.configure({
    device,
    format,
    alphaMode: 'opaque'
  });
  return { device, canvasContext, presentationFormat: format };
}

declare global {
  interface Navigator {
    readonly gpu: GPU;
  }
}
