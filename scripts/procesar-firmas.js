// Procesa una firma escaneada a PNG de tinta oscura sobre fondo BLANCO OPACO
// (sin transparencia) y recortada. Se aplana sobre blanco primero, lo que
// resuelve tanto originales con fondo transparente como con papel claro.
//
// Por qué opaco y no transparente: jsPDF no compone de forma fiable un PNG con
// canal alfa + RGB uniforme (la firma de Liliana salía como una caja oscura).
// Como el documento es blanco, un fondo blanco opaco es invisible y se
// renderiza siempre bien.
//
// Ejecutar: node scripts/procesar-firmas.js
//
// Nota: los escaneos originales de Luisa y Jeniffer ya no están disponibles;
// sus PNG (firma-luisa.png / firma-jeniffer.png) ya renderizan bien y se
// versionan directamente. Aquí solo se regenera Liliana desde su original.
const sharp = require('sharp')
const path = require('path')

const pub = path.join(process.cwd(), 'public')

async function procesar(src, out, { invert = false, gain = 1.6, cutoff = 40 } = {}) {
  let pipe = sharp(path.join(pub, src)).flatten({ background: '#ffffff' })
  if (invert) pipe = pipe.negate({ alpha: false }) // tinta clara sobre fondo oscuro
  const { data, info } = await pipe.grayscale().raw().toBuffer({ resolveWithObject: true })

  const { width, height } = info
  const out3 = Buffer.alloc(width * height * 3)
  for (let p = 0, q = 0; p < data.length; p++, q += 3) {
    let ink = (255 - data[p]) * gain // cuanto más oscuro el pixel, más tinta
    if (ink < cutoff) ink = 0        // limpia ruido/papel
    ink = Math.min(255, ink)
    const v = Math.round(255 - ink * (255 - 30) / 255) // mezcla tinta(30) sobre blanco
    out3[q] = v; out3[q + 1] = v; out3[q + 2] = v
  }

  // Recorta el borde blanco para que la firma llene su recuadro en el PDF.
  const r = await sharp(out3, { raw: { width, height, channels: 3 } })
    .trim()
    .png()
    .toFile(path.join(pub, out))
  console.log('escrito', out, `${r.width}x${r.height}`)
}

;(async () => {
  await procesar('firma liliana PNG transparente.PNG', 'firma-liliana.png', { gain: 1.6, cutoff: 40 })
})()
