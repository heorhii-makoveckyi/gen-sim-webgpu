import React, { useRef, useEffect, useCallback } from 'react'
import { SimulationParams, SimulationState } from '../types/simulation'
import { generateRandomGeneMatrix } from '../utils/simulation'
import { WebGLSimulation } from '../utils/WebGLSimulation'

interface Props {
  params: SimulationParams
  state: SimulationState
  onStateChange: (state: Partial<SimulationState>) => void
  copiedGenes: number[][] | null
}

export const SimulationCanvas: React.FC<Props> = ({ params, state, onStateChange, copiedGenes }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simulationRef = useRef<WebGLSimulation | null>(null)
  const animationRef = useRef<number>(0)
  const geneMatrixRef = useRef<number[][]>([])

  const initializeSimulation = useCallback(() => {
    if (!canvasRef.current || !simulationRef.current) return

    // Generate or use copied gene matrix
    geneMatrixRef.current = copiedGenes || generateRandomGeneMatrix(params.geneMatrixWidth, params.geneMatrixHeight)

    // Initialize the simulation
    simulationRef.current.initialize(params, geneMatrixRef.current)
    onStateChange({ frameCount: 0 })
  }, [params, copiedGenes, onStateChange])

  const runSimulationStep = useCallback(() => {
    if (!simulationRef.current || !state.running || state.paused || !canvasRef.current) return

    // Run simulation step
    simulationRef.current.step(params)

    // Render to canvas
    simulationRef.current.render(params, canvasRef.current)

    // Get stats and update state
    const stats = simulationRef.current.getStats()
    onStateChange({
      frameCount: state.frameCount + 1,
      cellCount: stats.cellCount,
      totalEnergy: stats.totalEnergy
    })

    animationRef.current = requestAnimationFrame(runSimulationStep)
  }, [state.running, state.paused, state.frameCount, params, onStateChange])

  // Initialize WebGL simulation
  useEffect(() => {
    if (!canvasRef.current) return

    try {
      simulationRef.current = new WebGLSimulation(canvasRef.current)
      initializeSimulation()
    } catch (error) {
      console.error('Failed to initialize WebGL:', error)
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.dispose()
        simulationRef.current = null
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // Handle simulation initialization when parameters change
  useEffect(() => {
    if (simulationRef.current && !state.running) {
      initializeSimulation()
    }
  }, [params, copiedGenes, state.running, initializeSimulation])

  // Handle animation loop
  useEffect(() => {
    if (state.running && !state.paused) {
      animationRef.current = requestAnimationFrame(runSimulationStep)
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [state.running, state.paused, runSimulationStep])

  return (
    <canvas
      ref={canvasRef}
      width={params.width}
      height={params.height}
      style={{
        border: '1px solid #ccc',
        maxWidth: '100%',
        height: 'auto',
        imageRendering: 'pixelated'
      }}
    />
  )
}
