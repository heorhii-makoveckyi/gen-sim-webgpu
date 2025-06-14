import { SimulationParams } from '../types/simulation'
import { createShader, createProgram, createTexture, createFramebuffer, createQuadBuffer } from './webgl'
import { createGeneTexture } from './simulation'

import vertexShaderSource from '../shaders/vertexShader.glsl'
import initShaderSource from '../shaders/initShader.glsl'
import init2ShaderSource from '../shaders/init2Shader.glsl'
import sunlightShaderSource from '../shaders/sunlightShader.glsl'
import intentionShaderSource from '../shaders/intentionShader.glsl'
import resolveShaderSource from '../shaders/resolveShader.glsl'
import resolve2ShaderSource from '../shaders/resolve2Shader.glsl'
import renderShaderSource from '../shaders/renderShader.glsl'

export class WebGLSimulation {
  private width = 0
  private height = 0
  private gl: WebGL2RenderingContext
  private programs: Record<string, WebGLProgram> = {}
  private textures: Record<string, WebGLTexture> = {}
  private framebuffers: Record<string, WebGLFramebuffer> = {}
  private quadBuffer: WebGLBuffer
  private time = 0
  private pingPong = false

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      preserveDrawingBuffer: true
    })
    if (!gl) throw new Error('WebGL2 not supported')

    this.gl = gl

    // Enable extensions
    gl.getExtension('EXT_color_buffer_float')

    // Create shaders
    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)

    this.programs = {
      init: createProgram(gl, vs, createShader(gl, gl.FRAGMENT_SHADER, initShaderSource)),
      init2: createProgram(gl, vs, createShader(gl, gl.FRAGMENT_SHADER, init2ShaderSource)),
      sunlight: createProgram(gl, vs, createShader(gl, gl.FRAGMENT_SHADER, sunlightShaderSource)),
      intention: createProgram(gl, vs, createShader(gl, gl.FRAGMENT_SHADER, intentionShaderSource)),
      resolve: createProgram(gl, vs, createShader(gl, gl.FRAGMENT_SHADER, resolveShaderSource)),
      resolve2: createProgram(gl, vs, createShader(gl, gl.FRAGMENT_SHADER, resolve2ShaderSource)),
      render: createProgram(gl, vs, createShader(gl, gl.FRAGMENT_SHADER, renderShaderSource))
    }

    // Create quad buffer
    this.quadBuffer = createQuadBuffer(gl)

    // Setup vertex attributes
    this.setupVertexAttributes()
  }

  private setupVertexAttributes() {
    Object.values(this.programs).forEach(program => {
      this.gl.useProgram(program)
      const posLoc = this.gl.getAttribLocation(program, 'a_position')
      const texLoc = this.gl.getAttribLocation(program, 'a_texCoord')

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer)
      this.gl.enableVertexAttribArray(posLoc)
      this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 16, 0)
      this.gl.enableVertexAttribArray(texLoc)
      this.gl.vertexAttribPointer(texLoc, 2, this.gl.FLOAT, false, 16, 8)
    })
  }

  initialize(params: SimulationParams, geneMatrix: number[][]) {
    const { width, height } = params

    this.width = width
    this.height = height

    // Create textures
    this.textures = {
      cellTexture1A: createTexture(this.gl, width, height),
      cellTexture1B: createTexture(this.gl, width, height),
      cellTexture2A: createTexture(this.gl, width, height),
      cellTexture2B: createTexture(this.gl, width, height),
      intentionTexture: createTexture(this.gl, width, height),
      geneTexture: createGeneTexture(this.gl, geneMatrix)
    }

    // Create framebuffers
    Object.entries(this.textures).forEach(([name, texture]) => {
      if (name !== 'geneTexture') {
        this.framebuffers[name] = createFramebuffer(this.gl, texture)
      }
    })

    // Run initialization
    this.runInitialization(params)
    this.time = 0
    this.pingPong = false
  }

  private runInitialization(params: SimulationParams) {
    const gl = this.gl

    // Initialize cell texture 1
    gl.useProgram(this.programs.init)
    this.setUniform2f('u_resolution', params.width, params.height)
    this.setUniform1f('u_initialCellCount', params.initialCellCount)
    this.setUniform1f('u_initialEnergyMultiplier', params.initialEnergyMultiplier)
    this.setUniform2f('u_willRange', params.willRange[0], params.willRange[1])
    this.setUniform2f('u_maxEnergyRange', params.maxEnergyRange[0], params.maxEnergyRange[1])
    this.setUniform2f('u_maxEnergyToGetRange', params.maxEnergyToGetRange[0], params.maxEnergyToGetRange[1])
    this.setUniform1f('u_geneMatrixSize', params.geneMatrixWidth * params.geneMatrixHeight)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.cellTexture1A)
    gl.viewport(0, 0, params.width, params.height)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // Initialize cell texture 2
    gl.useProgram(this.programs.init2)
    this.bindTexture(0, this.textures.cellTexture1A, 'u_cellTexture1')
    this.setUniform2f('u_resolution', params.width, params.height)
    this.setUniform2f('u_maxEnergyToGetRange', params.maxEnergyToGetRange[0], params.maxEnergyToGetRange[1])
    this.setUniform1f('u_geneMatrixSize', params.geneMatrixWidth * params.geneMatrixHeight)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.cellTexture2A)
    gl.viewport(0, 0, params.width, params.height)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  step(params: SimulationParams) {
    const gl = this.gl

    const currentTextures = {
      cellTexture1: this.pingPong ? this.textures.cellTexture1B : this.textures.cellTexture1A,
      cellTexture2: this.pingPong ? this.textures.cellTexture2B : this.textures.cellTexture2A
    }
    const nextTextures = {
      cellTexture1: this.pingPong ? this.textures.cellTexture1A : this.textures.cellTexture1B,
      cellTexture2: this.pingPong ? this.textures.cellTexture2A : this.textures.cellTexture2B
    }
    const currentFramebuffers = {
      cellTexture1: this.pingPong ? this.framebuffers.cellTexture1B : this.framebuffers.cellTexture1A,
      cellTexture2: this.pingPong ? this.framebuffers.cellTexture2B : this.framebuffers.cellTexture2A
    }
    const nextFramebuffers = {
      cellTexture1: this.pingPong ? this.framebuffers.cellTexture1A : this.framebuffers.cellTexture1B,
      cellTexture2: this.pingPong ? this.framebuffers.cellTexture2A : this.framebuffers.cellTexture2B
    }

    // 1. Update sunlight
    gl.useProgram(this.programs.sunlight)
    this.bindTexture(0, currentTextures.cellTexture2, 'u_cellTexture2')
    this.setUniform2f('u_resolution', params.width, params.height)
    this.setUniform1f('u_maxSolarEnergy', params.maxSolarEnergy)
    this.setUniform1f('u_time', this.time)
    this.setUniform1f('u_dayCycleDuration', params.dayCycleDuration)
    this.setUniform1i('u_sunMode', this.getSunModeIndex(params.sunMode))

    gl.bindFramebuffer(gl.FRAMEBUFFER, nextFramebuffers.cellTexture2)
    gl.viewport(0, 0, params.width, params.height)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // 2. Generate intentions
    gl.useProgram(this.programs.intention)
    this.bindTexture(0, currentTextures.cellTexture1, 'u_cellTexture1')
    this.bindTexture(1, nextTextures.cellTexture2, 'u_cellTexture2')
    this.bindTexture(2, this.textures.geneTexture, 'u_geneTexture')
    this.setUniform2f('u_resolution', params.width, params.height)
    this.setUniform2f('u_geneMatrixSize', params.geneMatrixWidth, params.geneMatrixHeight)
    this.setUniform1f('u_mutationProbability', params.mutationProbability)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.intentionTexture)
    gl.viewport(0, 0, params.width, params.height)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // 3. Resolve conflicts - First pass (update cell texture 1)
    gl.useProgram(this.programs.resolve)
    this.bindTexture(0, currentTextures.cellTexture1, 'u_cellTexture1')
    this.bindTexture(1, nextTextures.cellTexture2, 'u_cellTexture2')
    this.bindTexture(2, this.textures.intentionTexture, 'u_intentionTexture')
    this.bindTexture(3, this.textures.geneTexture, 'u_geneTexture')
    this.setUniform2f('u_resolution', params.width, params.height)
    this.setUniform2f('u_geneMatrixSize', params.geneMatrixWidth, params.geneMatrixHeight)
    this.setUniform1f('u_mutationProbability', params.mutationProbability)
    this.setUniform1f('u_time', this.time)

    gl.bindFramebuffer(gl.FRAMEBUFFER, nextFramebuffers.cellTexture1)
    gl.viewport(0, 0, params.width, params.height)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // 4. Resolve conflicts - Second pass (update cell texture 2)
    gl.useProgram(this.programs.resolve2)
    this.bindTexture(0, nextTextures.cellTexture1, 'u_cellTexture1')
    this.bindTexture(1, currentTextures.cellTexture1, 'u_cellTexture1Old')
    this.bindTexture(2, nextTextures.cellTexture2, 'u_cellTexture2')
    this.bindTexture(3, this.textures.intentionTexture, 'u_intentionTexture')
    this.bindTexture(4, this.textures.geneTexture, 'u_geneTexture')
    this.setUniform2f('u_resolution', params.width, params.height)
    this.setUniform2f('u_geneMatrixSize', params.geneMatrixWidth, params.geneMatrixHeight)
    this.setUniform1f('u_mutationProbability', params.mutationProbability)
    this.setUniform1f('u_time', this.time)

    gl.bindFramebuffer(gl.FRAMEBUFFER, currentFramebuffers.cellTexture2)
    gl.viewport(0, 0, params.width, params.height)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    this.time++
    this.pingPong = !this.pingPong
  }

  render(params: SimulationParams, canvas: HTMLCanvasElement) {
    const gl = this.gl

    const currentTextures = {
      cellTexture1: this.pingPong ? this.textures.cellTexture1B : this.textures.cellTexture1A,
      cellTexture2: this.pingPong ? this.textures.cellTexture2B : this.textures.cellTexture2A
    }

    gl.useProgram(this.programs.render)
    this.bindTexture(0, currentTextures.cellTexture1, 'u_cellTexture1')
    this.bindTexture(1, currentTextures.cellTexture2, 'u_cellTexture2')
    this.setUniform1i('u_showAccumulatedEnergy', params.showAccumulatedEnergy ? 1 : 0)
    this.setUniform1i('u_showSunEnergy', params.showSunEnergy ? 1 : 0)
    this.setUniform1i('u_showCells', params.showCells ? 1 : 0)
    this.setUniform1i('u_showCellEnergy', params.showCellEnergy ? 1 : 0)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  private bindTexture(unit: number, texture: WebGLTexture, uniformName: string) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    const currentProgram = this.gl.getParameter(this.gl.CURRENT_PROGRAM)
    const location = gl.getUniformLocation(currentProgram, uniformName)
    if (location !== null) {
      gl.uniform1i(location, unit)
    }
  }

  private setUniform1f(name: string, value: number) {
    const currentProgram = this.gl.getParameter(this.gl.CURRENT_PROGRAM)
    const location = this.gl.getUniformLocation(currentProgram, name)
    if (location !== null) {
      this.gl.uniform1f(location, value)
    }
  }

  private setUniform1i(name: string, value: number) {
    const currentProgram = this.gl.getParameter(this.gl.CURRENT_PROGRAM)
    const location = this.gl.getUniformLocation(currentProgram, name)
    if (location !== null) {
      this.gl.uniform1i(location, value)
    }
  }

  private setUniform2f(name: string, x: number, y: number) {
    const currentProgram = this.gl.getParameter(this.gl.CURRENT_PROGRAM)
    const location = this.gl.getUniformLocation(currentProgram, name)
    if (location !== null) {
      this.gl.uniform2f(location, x, y)
    }
  }

  private getSunModeIndex(mode: string): number {
    const modes = ['constant_full', 'clipping_full', 'constant_islands', 'clipping_islands', 'dynamic_sun']
    return modes.indexOf(mode)
  }

  getStats(): { cellCount: number; totalEnergy: number } {
    // This would need to read back from GPU - expensive operation
    // For now, return placeholder values
    // return { cellCount: 0, totalEnergy: 0 }
    const gl = this.gl

      /* 1. Выбираем актуальный FBO с cellTexture1 */
          const readFbo = this.pingPong
         ? this.framebuffers.cellTexture1B
            : this.framebuffers.cellTexture1A

          gl.bindFramebuffer(gl.FRAMEBUFFER, readFbo)

          const { width, height } = { width: this.width, height: this.height }  // задаётся в initialize()
        const pixels = new Float32Array(width * height * 4)                   // RGBA32F

          gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, pixels)
          gl.bindFramebuffer(gl.FRAMEBUFFER, null)

          /* 2. Построчный подсчёт */
            let cellCount = 0
          let totalEnergy = 0

          for (let row = 0; row < height; row++) {
            const rowOffset = row * width * 4
              for (let col = 0; col < width; col++) {
                const idx = rowOffset + col * 4

                  const originalId = pixels[idx]       // R-канал
                  if (originalId > 0.0) {              // 0 = пустая ячейка
                    cellCount++
                    totalEnergy += pixels[idx + 1]     // G-канал = energy
                    }
              }
          }

          return { cellCount, totalEnergy }
  }

  dispose() {
    const gl = this.gl

    // Clean up WebGL resources
    Object.values(this.programs).forEach(program => gl.deleteProgram(program))
    Object.values(this.textures).forEach(texture => gl.deleteTexture(texture))
    Object.values(this.framebuffers).forEach(fb => gl.deleteFramebuffer(fb))
    gl.deleteBuffer(this.quadBuffer)
  }
}
