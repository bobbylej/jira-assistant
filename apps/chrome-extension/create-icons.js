const fs = require('fs');
const path = require('path');

// Ensure icons directory exists
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a simple SVG icon
function createSvgIcon(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#0052cc"/>
    <text x="50%" y="50%" font-family="Arial" font-size="${size/2}px" fill="white" text-anchor="middle" dominant-baseline="middle">J</text>
  </svg>`;
}

// Save icons in different sizes
const sizes = [16, 48, 128];
sizes.forEach(size => {
  const iconPath = path.join(iconsDir, `icon${size}.png`);
  
  // For simplicity, we'll just create SVG files instead of PNGs
  // In a real project, you'd want to convert these to PNGs
  fs.writeFileSync(iconPath.replace('.png', '.svg'), createSvgIcon(size));
  
  console.log(`Created icon: ${iconPath.replace('.png', '.svg')}`);
});

console.log('Icons created successfully. Note: These are SVG files, not PNGs.');
console.log('Update your manifest.json to use .svg extension instead of .png'); 