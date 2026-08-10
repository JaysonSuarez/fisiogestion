// Convierte las firmas escaneadas a PNG con fondo transparente y tinta oscura.
// - Liliana / Luisa: tinta oscura sobre papel claro -> se vuelve transparente el fondo.
// - Jeniffer: tinta clara sobre fondo oscuro -> se invierte primero, luego transparente.
// Ejecutar: node scripts/procesar-firmas.js
const sharp = require('sharp')
const path = require('path')

const pub = path.join(process.cwd(), 'public')

async function procesar(src, out, { invert = false, gain = 1.6, cutoff = 30 } = {}) {
  const { data, info } = await sharp(path.join(pub, src))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  for (let i = 0; i < data.length; i += channels) {
    let r = data[i], g = data[i + 1], b = data[i + 2]
    if (invert) { r = 255 - r; g = 255 - g; b = 255 - b }
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    // Cuanto más oscuro el trazo, más opaco; el fondo claro queda transparente.
    // `gain` sube la opacidad de trazos de bajo contraste; `cutoff` elimina el
    // ruido del papel (píxeles muy claros que quedan casi transparentes).
    let alpha = Math.min(255, (255 - lum) * gain)
    if (alpha < cutoff) alpha = 0
    data[i] = 30; data[i + 1] = 30; data[i + 2] = 30; data[i + 3] = alpha
  }

  // Recortamos el borde transparente para que la firma llene su recuadro en el PDF.
  const info2 = await sharp(data, { raw: { width, height, channels } })
    .trim()
    .png()
    .toFile(path.join(pub, out))
  console.log('escrito', out, `${info2.width}x${info2.height}`)
}

;(async () => {
  await procesar('FIRMA DIGITAL LILIANA GONZALEZ.PNG', 'firma-liliana.png', { gain: 1.6, cutoff: 30 })
  await procesar('FIRMA DIGITAL LUISA JIMENEZ.jpeg', 'firma-luisa.png', { gain: 1.5, cutoff: 55 })
  await procesar('FIRMA DIGITAL JENIFFER.jpeg', 'firma-jeniffer.png', { invert: true, gain: 2.6, cutoff: 35 })
})()
