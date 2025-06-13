# Setup Guide

## Quick Start

1. **Create the project and install dependencies:**
```bash
yarn create vite genetic-algorithm-sim --template react-ts
cd genetic-algorithm-sim
yarn add -D vite-plugin-glsl @types/node
```

2. **Replace the default files with the provided code:**
    - Copy all the provided files to their respective locations
    - Make sure the folder structure matches the one described in README.md

3. **Start the development server:**
```bash
yarn dev
```

## Troubleshooting

### WebGL2 Not Supported
- Make sure you're using a modern browser (Chrome, Firefox, Edge)
- Check that hardware acceleration is enabled in your browser settings

### Shader Compilation Errors
- Open the browser console to see detailed error messages
- Make sure all shader files are in the correct location
- Verify that the vite-plugin-glsl is properly configured in vite.config.ts

### Import Errors
- Ensure that src/shaders.d.ts exists and contains the module declarations
- Restart the development server after adding new shader files

### Performance Issues
- Try reducing the simulation size (width/height parameters)
- Lower the initial cell count
- Disable some visual layers

## Browser Requirements
- WebGL2 support (check at https://webgl2fundamentals.org/)
- ES6 module support
- Modern JavaScript features

## Development Tips

1. **Debugging Shaders:**
    - Use console.log in the TypeScript code to track uniform values
    - Temporarily output debug colors in shaders to visualize data
    - Use the browser's WebGL inspector extensions

2. **Performance Optimization:**
    - Keep the gene matrix size reasonable (8x4 is a good default)
    - Use power-of-2 dimensions for textures when possible
    - Minimize texture switches and state changes

3. **Adding New Features:**
    - Add new gene actions by extending the gene action enum
    - Create new visualization modes by adding uniforms to the render shader
    - Implement new sun patterns in the sunlight shader

## Common Issues and Solutions

### "Failed to create shader" Error
```bash
# Clear cache and rebuild
rm -rf node_modules
yarn install
yarn dev
```

### Blank Canvas
- Check browser console for WebGL errors
- Verify that initial cell count > 0
- Ensure simulation is started (click Start button)

### Mutations Not Working
- Check that mutation probability > 0
- Verify gene matrix has been properly initialized
- Ensure cells are successfully dividing
