import React from 'react'
import { SimulationState } from '../types/simulation'

interface Props {
  state: SimulationState
  onStart: () => void
  onPause: () => void
  onContinue: () => void
  onStop: () => void
  onStartRandom: () => void
  onPasteCopiedCell: () => void
  enableRepeatGeneration: boolean
  onToggleRepeatGeneration: () => void
}

export const ControlPanel: React.FC<Props> = ({
                                                state,
                                                onStart,
                                                onPause,
                                                onContinue,
                                                onStop,
                                                onStartRandom,
                                                onPasteCopiedCell,
                                                enableRepeatGeneration,
                                                onToggleRepeatGeneration
                                              }) => {
  return (
    <div style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
      <h3>Simulation Controls</h3>

      <div style={{ marginBottom: '10px' }}>
        <button onClick={onStart} disabled={state.running}>
          Start
        </button>
        <button onClick={onPause} disabled={!state.running || state.paused}>
          Pause
        </button>
        <button onClick={onContinue} disabled={!state.running || !state.paused}>
          Continue
        </button>
        <button onClick={onStop} disabled={!state.running}>
          Stop
        </button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <button onClick={onStartRandom}>
          Start Random
        </button>
        <button onClick={onPasteCopiedCell}>
          Paste Copied Cell
        </button>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={enableRepeatGeneration}
            onChange={onToggleRepeatGeneration}
          />
          Enable Repeated Generation from Copied Cell
        </label>
      </div>

      <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
        <div>Frame: {state.frameCount}</div>
        <div>Cell Count: {state.cellCount}</div>
        <div>Total Energy: {state.totalEnergy.toFixed(2)}</div>
      </div>
    </div>
  )
}
