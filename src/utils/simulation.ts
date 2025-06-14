import { SimulationParams, CellData } from '../types/simulation'

export function generateRandomGeneMatrix(width: number, height: number): number[][] {
  const matrix: number[][] = []
  for (let i = 0; i < height; i++) {
    const row: number[] = []
    for (let j = 0; j < width; j++) {
      row.push(Math.floor(Math.random() * 18)) // 0-17 gene actions
    }
    matrix.push(row)
  }
  return matrix
}

export function createGeneTexture(gl: WebGL2RenderingContext, geneMatrix: number[][]): WebGLTexture {
  const width = geneMatrix[0].length
  const height = geneMatrix.length
  const data = new Float32Array(width * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      data[idx] = geneMatrix[y][x]
      data[idx + 1] = 0
      data[idx + 2] = 0
      data[idx + 3] = 1
    }
  }

  const texture = gl.createTexture()
  if (!texture) throw new Error('Failed to create gene texture')

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  return texture
}

export function getDefaultParams(): SimulationParams {
  return {
    initialCellCount: 1000,
    geneMatrixWidth: 30,
    geneMatrixHeight: 15,
    initialEnergyMultiplier: 5,
    mutationProbability: 0.01,

    willRange: [1, 10],
    maxEnergyRange: [100, 1000],
    maxEnergyToGetRange: [5, 20],

    maxSolarEnergy: 2,
    dayCycleDuration: 1000,
    sunMode: 'constant_full' as any,

    showAccumulatedEnergy: true,
    showSunEnergy: true,
    showCells: true,
    showCellEnergy: true,

    width: 512,
    height: 512
  }
}

export function parseClipboardCell(text: string): CellData | null {
  try {
    const data = JSON.parse(text)
    if (data.originalId && data.genes) {
      return data as CellData
    }
  } catch (e) {
    console.error('Failed to parse clipboard data:', e)
  }
  return null
}

export function cellToClipboard(cell: CellData): string {
  return JSON.stringify(cell, null, 2)
}
