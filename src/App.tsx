import { useState, useCallback } from 'react'
import './App.css'
import { SimulationCanvas } from './components/SimulationCanvas'
import { ControlPanel } from './components/ControlPanel'
import { ParameterControls } from './components/ParameterControls'
import { SimulationParams, SimulationState } from './types/simulation'
import { getDefaultParams, parseClipboardCell } from './utils/simulation'

function App() {
  const [params, setParams] = useState<SimulationParams>(getDefaultParams())
  const [state, setState] = useState<SimulationState>({
    running: false,
    paused: false,
    frameCount: 0,
    cellCount: 0,
    totalEnergy: 0
  })
  const [copiedGenes, setCopiedGenes] = useState<number[][] | null>(null)
  const [enableRepeatGeneration, setEnableRepeatGeneration] = useState(false)

  const handleStart = useCallback(() => {
    setState({ ...state, running: true, paused: false, frameCount: 0 })
  }, [state])

  const handlePause = useCallback(() => {
    setState({ ...state, paused: true })
  }, [state])

  const handleContinue = useCallback(() => {
    setState({ ...state, paused: false })
  }, [state])

  const handleStop = useCallback(() => {
    setState({ running: false, paused: false, frameCount: 0, cellCount: 0, totalEnergy: 0 })
  }, [])

  const handleStartRandom = useCallback(() => {
    const randomParams = {
      initialCellCount: Math.floor(Math.random() * 50) + 5,
      initialEnergyMultiplier: Math.random() * 5 + 1,
      mutationProbability: Math.random() * 0.1,
      willRange: [1, Math.floor(Math.random() * 20) + 5] as [number, number],
      maxEnergyRange: [100, Math.floor(Math.random() * 900) + 100] as [number, number],
      maxEnergyToGetRange: [5, Math.floor(Math.random() * 15) + 5] as [number, number],
      maxSolarEnergy: Math.random() * 5,
      dayCycleDuration: Math.floor(Math.random() * 900) + 100
    }
    setParams({ ...params, ...randomParams })
    handleStart()
  }, [params, handleStart])

  const handlePasteCopiedCell = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      const cellData = parseClipboardCell(text)
      if (cellData && cellData.genes) {
        setCopiedGenes(cellData.genes)
        if (enableRepeatGeneration) {
          handleStart()
        }
      } else {
        alert('Invalid cell data in clipboard')
      }
    } catch {
      alert('Failed to read clipboard')
    }
  }, [enableRepeatGeneration, handleStart])

  return (
    <div className="App">
      <h1>Genetic Algorithm Simulation</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', padding: '20px' }}>
        <div>
          <SimulationCanvas
            params={params}
            state={state}
            onStateChange={(newState) => setState({ ...state, ...newState })}
            copiedGenes={enableRepeatGeneration ? copiedGenes : null}
          />
        </div>

        <div>
          <ControlPanel
            state={state}
            onStart={handleStart}
            onPause={handlePause}
            onContinue={handleContinue}
            onStop={handleStop}
            onStartRandom={handleStartRandom}
            onPasteCopiedCell={handlePasteCopiedCell}
            enableRepeatGeneration={enableRepeatGeneration}
            onToggleRepeatGeneration={() => setEnableRepeatGeneration(!enableRepeatGeneration)}
          />

          <div style={{ marginTop: '20px' }}>
            <ParameterControls
              params={params}
              onChange={(newParams) => setParams({ ...params, ...newParams })}
              disabled={state.running}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
