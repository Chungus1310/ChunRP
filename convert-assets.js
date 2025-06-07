// This script converts SVG assets to PNG format for platforms that require them
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Asset directory
const assetsDir = path.join(__dirname, 'src/frontend/assets');

// List of SVG files to convert and their target sizes
const assetsToConvert = [
  { file: 'icon.svg', sizes: [16, 32, 64, 128, 256, 512] },
  { file: 'default-avatar.svg', sizes: [64, 128, 256] },
  { file: 'splash.svg', sizes: [1024] }
];

// Create the output directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Function to convert SVG to PNG
async function convertSVGtoPNG(svgPath, pngPath, size) {
  try {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Load and draw the SVG
    const image = await loadImage(svgPath);
    ctx.drawImage(image, 0, 0, size, size);
    
    // Save as PNG
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pngPath, buffer);
    console.log(`Converted ${svgPath} to ${pngPath}`);
  } catch (error) {
    console.error(`Error converting ${svgPath}:`, error);
  }
}

// Convert all assets
async function convertAssets() {
  for (const asset of assetsToConvert) {
    const svgPath = path.join(assetsDir, asset.file);
    
    for (const size of asset.sizes) {
      const fileName = asset.file.replace('.svg', '');
      const pngPath = path.join(assetsDir, `${fileName}${size > 64 ? '' : `-${size}`}.png`);
      
      await convertSVGtoPNG(svgPath, pngPath, size);
    }
  }
  
  // Create .icns file for macOS (requires additional tooling)
  console.log('Note: For macOS .icns files, you will need to use a tool like iconutil');
}

// Run the conversion
convertAssets().catch(console.error);
