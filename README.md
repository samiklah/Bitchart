# Bitchart - Volume Footprint Chart Library

A modular, high-performance charting library for displaying volume footprint data with advanced interactions.

## 🚀 Quick Start

```bash
npm install
npm run build
```

Then include `dist/index.js` in your HTML:

```html
<script src="path/to/bitchart/dist/index.js"></script>
<script>
  const chart = bitchart.createChart(container, {
    width: 800,
    height: 600
  });

  const series = chart.addVolumeFootprintSeries();
  series.setData(candleData);
</script>
```

## 📁 Project Structure

```
vfc/
├── src/
│   ├── api/           # Public API layer (Lightweight-charts compatible)
│   │   ├── ichart-api.ts         # Main chart interface
│   │   ├── chart-api.ts          # Chart implementation
│   │   ├── volume-footprint-series-api.ts  # Series API
│   │   ├── time-scale-api.ts     # Time axis API
│   │   └── price-scale-api.ts    # Price axis API
│   ├── chart.ts       # Core chart orchestrator
│   ├── drawing.ts     # Canvas rendering engine
│   ├── interactions.ts # Mouse/keyboard event handling
│   ├── scales.ts      # Coordinate transformations
│   ├── styles.css     # Chart styling
│   ├── index.ts       # Library exports
│   └── types.ts       # TypeScript definitions
├── dist/              # Built library
├── example.html       # Working demo
└── package.json       # Dependencies and scripts
```

## 🏗️ Architecture Overview

### Core Components

#### 1. **API Layer** (`src/api/`)
- **Purpose**: Provides a clean, stable public interface compatible with Lightweight Charts
- **Key Files**:
  - `chart-api.ts`: Main chart instance with methods like `addVolumeFootprintSeries()`
  - `volume-footprint-series-api.ts`: Series-specific methods like `setData()`
- **When to Edit**: When adding new public methods or changing the API contract

#### 2. **Chart Core** (`src/chart.ts`)
- **Purpose**: Orchestrates all components and manages the chart lifecycle
- **Responsibilities**:
  - Canvas setup and resizing
  - Component initialization (scales, drawing, interactions)
  - Event binding and cleanup
- **When to Edit**: For major architectural changes or new component integration

#### 3. **Drawing Engine** (`src/drawing.ts`)
- **Purpose**: Handles all canvas rendering operations
- **Key Methods**:
  - `drawAll()`: Main render loop
  - `drawGrid()`: Background grid
  - `drawChart()`: Candles and footprints
  - `drawScales()`: Axes and labels
- **When to Edit**: For visual changes, new chart elements, or rendering optimizations

#### 4. **Interactions** (`src/interactions.ts`)
- **Purpose**: Manages user input (mouse, keyboard, touch)
- **Key Methods**:
  - `handleWheel()`: Zoom and scroll
  - `handlePointerDown()`: Drag/pan
- **When to Edit**: For new interaction modes or changing zoom/pan behavior

#### 5. **Scales** (`src/scales.ts`)
- **Purpose**: Mathematical transformations between data and screen coordinates
- **Key Methods**:
  - `priceToY()`: Convert price to Y coordinate
  - `indexToX()`: Convert time index to X coordinate
  - `scaledSpacing()`: Zoom-adjusted spacing
- **When to Edit**: For coordinate system changes or new scaling logic

#### 6. **Styling** (`src/styles.css`)
- **Purpose**: CSS styling for toolbar and container elements
- **When to Edit**: For UI theme changes or layout adjustments

## 🔧 Customization Guide

### Adding New Chart Elements

To add a new visual element (like trend lines):

1. **Add rendering logic** in `drawing.ts`:
```typescript
drawTrendLines(): void {
  // Your rendering code here
}
```

2. **Call it from `drawAll()`**:
```typescript
drawAll(): void {
  // ... existing code ...
  this.drawTrendLines();
}
```

3. **Add data management** in `chart.ts` if needed.

### Modifying Zoom Behavior

Edit `interactions.ts` in the `handleWheel()` method:

```typescript
// Change zoom factors
const factor = (e.deltaY < 0 ? 1.2 : 0.8); // Faster zoom

// Add new zoom regions
const overCustomArea = /* your condition */;
if (overCustomArea) {
  // Custom zoom logic
}
```

### Changing Colors/Themes

Modify the rendering constants in `drawing.ts`:

```typescript
// Candle colors
const bullColor = '#00ff00';  // Green for up candles
const bearColor = '#ff0000';  // Red for down candles

// Volume colors
const buyOpacity = 0.3;
const sellOpacity = 0.3;
```

### Adding New Data Fields

1. **Update types** in `types.ts`:
```typescript
interface CandleData {
  // ... existing fields ...
  customField?: number;
}
```

2. **Use in rendering** in `drawing.ts`:
```typescript
// Access customField in drawFootprint()
const customValue = candle.customField;
```

## 🎨 Styling

The library uses CSS custom properties for theming:

```css
.vfc-container {
  --background: #111;
  --text-color: #eee;
  --grid-color: #333;
}
```

## 📊 Data Format

```typescript
interface CandleData {
  time: string;        // ISO timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  footprint: FootprintLevel[];
}

interface FootprintLevel {
  price: number;
  buy: number;         // Buy volume
  sell: number;        // Sell volume
}
```

## 🔄 Build System

```bash
npm run build    # Production build
npm run dev      # Development with watch mode
```

The build outputs UMD format for browser compatibility.

## 🐛 Debugging

Enable debug logging by modifying `chart.ts`:

```typescript
console.log('Chart state:', this.view);
console.log('Data length:', this.data.length);
```

## 🚀 Performance Tips

1. **Large datasets**: Implement data virtualization in `chart.ts`
2. **Smooth animations**: Use `requestAnimationFrame` for custom animations
3. **Memory management**: Clean up event listeners in `destroy()`

## 📝 API Reference

### Chart API
```typescript
const chart = bitchart.createChart(container, options);

chart.addVolumeFootprintSeries(options): VolumeFootprintSeries
chart.applyOptions(options): void
chart.resize(width, height): void
chart.destroy(): void
```

### Series API
```typescript
const series = chart.addVolumeFootprintSeries(options);

series.setData(data: CandleData[]): void
series.updateData(data: CandleData[]): void
series.applyOptions(options): void
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch
3. **Test** your changes with `npm run build`
4. **Submit** a pull request

## 📄 License

MIT License - see LICENSE file for details.