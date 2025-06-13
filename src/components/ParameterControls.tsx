import React from 'react'
import { SimulationParams, SunMode } from '../types/simulation'

interface Props {
  params: SimulationParams
  onChange: (params: Partial<SimulationParams>) => void
  disabled: boolean
}

export const ParameterControls: React.FC<Props> = ({ params, onChange, disabled }) => {
  const handleRangeChange = (key: keyof SimulationParams, index: number, value: number) => {
    const range = [...(params[key] as number[])] as [number, number]
    range[index] = value
    onChange({ [key]: range })
  }

  return (
    <div style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
      <h3>Simulation Parameters</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label>
            Initial Cell Count:
            <input
              type="number"
              value={params.initialCellCount}
              onChange={e => onChange({ initialCellCount: parseInt(e.target.value) })}
              disabled={disabled}
              min={1}
              max={100}
            />
          </label>
        </div>

        <div>
          <label>
            Gene Matrix Width:
            <input
              type="number"
              value={params.geneMatrixWidth}
              onChange={e => onChange({ geneMatrixWidth: parseInt(e.target.value) })}
              disabled={disabled}
              min={1}
              max={20}
            />
          </label>
        </div>

        <div>
          <label>
            Gene Matrix Height:
            <input
              type="number"
              value={params.geneMatrixHeight}
              onChange={e => onChange({ geneMatrixHeight: parseInt(e.target.value) })}
              disabled={disabled}
              min={1}
              max={20}
            />
          </label>
        </div>

        <div>
          <label>
            Initial Energy Multiplier:
            <input
              type="number"
              value={params.initialEnergyMultiplier}
              onChange={e => onChange({ initialEnergyMultiplier: parseFloat(e.target.value) })}
              disabled={disabled}
              min={0.1}
              max={10}
              step={0.1}
            />
          </label>
        </div>

        <div>
          <label>
            Mutation Probability:
            <input
              type="number"
              value={params.mutationProbability}
              onChange={e => onChange({ mutationProbability: parseFloat(e.target.value) })}
              disabled={disabled}
              min={0}
              max={1}
              step={0.001}
            />
          </label>
        </div>
      </div>

      <h4>Cell Parameter Ranges</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
        <div>
          <label>Will Range:</label>
          <input
            type="number"
            value={params.willRange[0]}
            onChange={e => handleRangeChange('willRange', 0, parseFloat(e.target.value))}
            disabled={disabled}
            min={1}
            max={100}
          />
          <span> - </span>
          <input
            type="number"
            value={params.willRange[1]}
            onChange={e => handleRangeChange('willRange', 1, parseFloat(e.target.value))}
            disabled={disabled}
            min={1}
            max={100}
          />
        </div>

        <div>
          <label>Max Energy Range:</label>
          <input
            type="number"
            value={params.maxEnergyRange[0]}
            onChange={e => handleRangeChange('maxEnergyRange', 0, parseFloat(e.target.value))}
            disabled={disabled}
            min={10}
            max={10000}
          />
          <span> - </span>
          <input
            type="number"
            value={params.maxEnergyRange[1]}
            onChange={e => handleRangeChange('maxEnergyRange', 1, parseFloat(e.target.value))}
            disabled={disabled}
            min={10}
            max={10000}
          />
        </div>

        <div>
          <label>Max Energy To Get Range:</label>
          <input
            type="number"
            value={params.maxEnergyToGetRange[0]}
            onChange={e => handleRangeChange('maxEnergyToGetRange', 0, parseFloat(e.target.value))}
            disabled={disabled}
            min={1}
            max={100}
          />
          <span> - </span>
          <input
            type="number"
            value={params.maxEnergyToGetRange[1]}
            onChange={e => handleRangeChange('maxEnergyToGetRange', 1, parseFloat(e.target.value))}
            disabled={disabled}
            min={1}
            max={100}
          />
        </div>
      </div>

      <h4>Sunlight Configuration</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label>
            Max Solar Energy:
            <input
              type="number"
              value={params.maxSolarEnergy}
              onChange={e => onChange({ maxSolarEnergy: parseFloat(e.target.value) })}
              disabled={disabled}
              min={0}
              max={10}
              step={0.1}
            />
          </label>
        </div>

        <div>
          <label>
            Day Cycle Duration:
            <input
              type="number"
              value={params.dayCycleDuration}
              onChange={e => onChange({ dayCycleDuration: parseInt(e.target.value) })}
              disabled={disabled}
              min={10}
              max={10000}
            />
          </label>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label>
            Sun Mode:
            <select
              value={params.sunMode}
              onChange={e => onChange({ sunMode: e.target.value as SunMode })}
              disabled={disabled}
            >
              <option value={SunMode.CONSTANT_FULL}>Constant Full Size</option>
              <option value={SunMode.CLIPPING_FULL}>Clipping Full Size</option>
              <option value={SunMode.CONSTANT_ISLANDS}>Constant 4 Islands</option>
              <option value={SunMode.CLIPPING_ISLANDS}>Clipping 4 Islands</option>
              <option value={SunMode.DYNAMIC_SUN}>Dynamic Sun</option>
            </select>
          </label>
        </div>
      </div>

      <h4>Visual Controls</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <label>
          <input
            type="checkbox"
            checked={params.showAccumulatedEnergy}
            onChange={e => onChange({ showAccumulatedEnergy: e.target.checked })}
          />
          Show Accumulated Energy (Purple)
        </label>

        <label>
          <input
            type="checkbox"
            checked={params.showSunEnergy}
            onChange={e => onChange({ showSunEnergy: e.target.checked })}
          />
          Show Sun Energy (Yellow)
        </label>

        <label>
          <input
            type="checkbox"
            checked={params.showCells}
            onChange={e => onChange({ showCells: e.target.checked })}
          />
          Show Cells
        </label>

        <label>
          <input
            type="checkbox"
            checked={params.showCellEnergy}
            onChange={e => onChange({ showCellEnergy: e.target.checked })}
          />
          Show Cell Energy (Green)
        </label>
      </div>
    </div>
  )
}
