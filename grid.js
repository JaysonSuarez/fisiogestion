const fs = require('fs');
const img = fs.readFileSync('D:/Proyectos/fisiogestion/public/referencia.jpeg').toString('base64');
let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">';
svg += '<image href="data:image/jpeg;base64,' + img + '" width="100" height="100" />';
for (let i = 0; i <= 100; i += 5) {
  svg += `<line x1="${i}" y1="0" x2="${i}" y2="100" stroke="red" stroke-width="0.2" opacity="0.5" />`;
  svg += `<line x1="0" y1="${i}" x2="100" y2="${i}" stroke="red" stroke-width="0.2" opacity="0.5" />`;
  if (i % 10 === 0) {
    svg += `<text x="${i}" y="2" font-size="2" fill="yellow" stroke="black" stroke-width="0.1">${i}</text>`;
    svg += `<text x="1" y="${i}" font-size="2" fill="yellow" stroke="black" stroke-width="0.1">${i}</text>`;
  }
}
svg += '</svg>';
fs.writeFileSync('D:/Proyectos/fisiogestion/public/grid.svg', svg);
console.log('Done');
