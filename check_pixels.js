const sharp = require('sharp');

sharp('D:/Proyectos/fisiogestion/public/referencia.jpeg')
  .raw()
  .toBuffer({ resolveWithObject: true })
  .then(({ data, info }) => {
    let minX = info.width, maxX = 0;
    let minY = info.height, maxY = 0;
    
    // Find left hand (x < info.width * 0.2)
    let leftHandMinY = info.height, leftHandMaxY = 0;

    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        let idx = (y * info.width + x) * info.channels;
        let r = data[idx];
        let g = data[idx+1];
        let b = data[idx+2];
        
        // not white background (assuming >240 is white)
        if (r < 240 || g < 240 || b < 240) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          
          if (x < info.width * 0.2) {
             if (y < leftHandMinY) leftHandMinY = y;
             if (y > leftHandMaxY) leftHandMaxY = y;
          }
        }
      }
    }
    
    console.log(`Bounding Box: v=[${minY/info.height} to ${maxY/info.height}] h=[${minX/info.width} to ${maxX/info.width}]`);
    console.log(`Left Hand Y range: ${leftHandMinY/info.height} to ${leftHandMaxY/info.height}`);
  });
