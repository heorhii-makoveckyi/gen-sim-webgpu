# Example Usage Guide

## Basic Simulation Setup

1. **Start with Default Parameters:**
    - Initial Cell Count: 10
    - Gene Matrix: 8x4
    - Mutation Probability: 0.01
    - Sun Mode: Constant Full Size

2. **Click "Start" to begin the simulation**

## Understanding the Visualization

### Color Meanings:
- **Unique Cell Colors**: Each cell gets a unique color based on its ID
- **Green Overlay**: Cell energy level (brighter = more energy)
- **Yellow Overlay**: Solar energy available at that pixel
- **Purple Overlay**: Accumulated energy in the pixel

## Common Patterns to Observe

### 1. Early Expansion Phase
- Cells will initially divide rapidly using their starting energy
- Look for cells spreading outward from initial positions

### 2. Energy Competition
- Cells compete for solar energy and pixel energy
- Stronger cells (higher "will") dominate territories

### 3. Evolution Patterns
- Successful gene combinations spread through the population
- Watch for emerging dominant strategies

## Interesting Experiments

### Experiment 1: Solar Islands
1. Set Sun Mode to "Constant 4 Islands"
2. Start with 4 cells
3. Observe how cells migrate to and colonize energy sources

### Experiment 2: High Mutation
1. Set Mutation Probability to 0.1 (10%)
2. Watch for rapid genetic diversity
3. Notice unstable populations and frequent extinctions

### Experiment 3: Energy Scarcity
1. Set Max Solar Energy to 0.5
2. Increase Initial Cell Count to 50
3. Observe intense competition and territorial behavior

## Gene Matrix Interpretation

Each row in the gene matrix represents a gene sequence:
```
Row 0: [1, 4, 6, 0, 5, 2, 7, 3]  // Active when activeGen = 0
Row 1: [6, 6, 1, 2, 5, 0, 8, 4]  // Active when activeGen = 1
...
```

### Reading Gene Actions:
- **0**: Rest (no energy cost)
- **1-4**: Divide in direction (up/right/down/left)
- **5**: Extract pixel energy
- **6**: Harvest solar energy
- **7-10**: Transfer energy to neighbor

## Tips for Interesting Simulations

1. **Create Predator-Prey Dynamics:**
    - Some cells with genes focused on energy extraction (5)
    - Others focused on solar collection (6)
    - Creates interdependency

2. **Island Hopping:**
    - Use "Dynamic Sun" mode
    - Cells must follow the moving energy source
    - Selects for mobility genes

3. **Stable Ecosystems:**
    - Low mutation rate (0.001)
    - Moderate energy availability
    - Watch for equilibrium states

## Performance Optimization

For larger simulations:
- Start with fewer initial cells
- Disable some visual overlays
- Use Firefox or Chrome for best WebGL2 performance

## Copying Successful Cells

1. Wait for an interesting cell pattern to emerge
2. The simulation stores cell data that can be copied
3. Use "Paste Copied Cell" with "Enable Repeated Generation"
4. This creates populations from successful genotypes
