// Simple test to verify the VFC library loads and instantiates correctly
import { VFC } from './dist/index.mjs';

console.log('Testing VFC library...');

// Create a mock container element
const container = {
  appendChild: () => {},
  querySelector: () => ({ getContext: () => ({}) }),
  clientWidth: 800,
  clientHeight: 600
};

// Try to create a chart instance
try {
  const chart = new VFC(container, {
    width: 800,
    height: 600
  });

  console.log('✅ Chart instance created successfully');

  // Test setData
  const mockData = [{
    time: '2023-01-01T00:00:00.000Z',
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    footprint: [
      { price: 100, buy: 1000, sell: 800 },
      { price: 105, buy: 1200, sell: 900 }
    ]
  }];

  chart.setData(mockData);
  console.log('✅ Data set successfully');

  console.log('🎉 All tests passed! The chart should display correctly.');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}