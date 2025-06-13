// Cell characteristic indices
export enum CellChar {
  ORIGINAL_ID = 0,
  ENERGY = 1,
  MAX_ENERGY = 2,
  WILL = 3,
  MAX_ENERGY_TO_GET = 4,
  ENERGY_IN_FIELD_CELL = 5,
  ENERGY_FROM_SUN = 6,
  ACTIVE_GEN = 7
}

// Gene action types
export enum GeneAction {
  IDLE = 0,
  DIVIDE_UP = 1,
  DIVIDE_RIGHT = 2,
  DIVIDE_DOWN = 3,
  DIVIDE_LEFT = 4,
  EXTRACT_ENERGY = 5,
  GET_SOLAR_ENERGY = 6,
  TRANSFER_UP = 7,
  TRANSFER_RIGHT = 8,
  TRANSFER_DOWN = 9,
  TRANSFER_LEFT = 10,
  SUICIDE_RESET_ZERO = 11,
  SUICIDE_RESET_MAX = 12,
  SUICIDE_ADD_ENERGY = 13,
  SUICIDE_TRANSFER_UP = 14,
  SUICIDE_TRANSFER_RIGHT = 15,
  SUICIDE_TRANSFER_DOWN = 16,
  SUICIDE_TRANSFER_LEFT = 17
}

export enum SunMode {
  CONSTANT_FULL = 'constant_full',
  CLIPPING_FULL = 'clipping_full',
  CONSTANT_ISLANDS = 'constant_islands',
  CLIPPING_ISLANDS = 'clipping_islands',
  DYNAMIC_SUN = 'dynamic_sun'
}

export interface SimulationParams {
  initialCellCount: number
  geneMatrixWidth: number
  geneMatrixHeight: number
  initialEnergyMultiplier: number
  mutationProbability: number

  // Cell parameter ranges
  willRange: [number, number]
  maxEnergyRange: [number, number]
  maxEnergyToGetRange: [number, number]

  // Sunlight parameters
  maxSolarEnergy: number
  dayCycleDuration: number
  sunMode: SunMode

  // Visual toggles
  showAccumulatedEnergy: boolean
  showSunEnergy: boolean
  showCells: boolean
  showCellEnergy: boolean

  // Simulation dimensions
  width: number
  height: number
}

export interface CellData {
  originalId: number
  energy: number
  maxEnergy: number
  will: number
  maxEnergyToGet: number
  energyInFieldCell: number
  energyFromSun: number
  activeGen: number
  genes: number[][]
}

export interface SimulationState {
  running: boolean
  paused: boolean
  frameCount: number
  cellCount: number
  totalEnergy: number
}
