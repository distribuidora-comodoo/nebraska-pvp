/* =====================================================================
   Genera un archivo QR por cada producto del manifest.

   Uso (parado en la carpeta "herramientas"):
     npm install                 <- una sola vez
     node generar-qr.js https://usuario.github.io/nebraska/
     node generar-qr.js https://usuario.github.io/nebraska/ --svg
     node generar-qr.js https://usuario.github.io/nebraska/ --cat=compresores

   Deja los archivos en:  qr/<categoria>/<CODIGO>.png
   Cada QR abre:          <base>ficha-producto.html?id=CODIGO&cat=CATEGORIA
   ===================================================================== */
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const RAIZ = path.join(__dirname, "..");
const MANIFEST = path.join(RAIZ, "fichas", "manifest.json");
const SALIDA = path.join(RAIZ, "qr");

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) || "").trim();
const svg = args.includes("--svg");
const soloCat = (args.find((a) => a.startsWith("--cat=")) || "").slice(6);

if (!base || !/^https?:\/\//i.test(base)) {
  console.error("\nFalta la dirección del catálogo.\n");
  console.error("  node generar-qr.js https://usuario.github.io/nebraska/\n");
  console.error("Opciones: --svg (vectorial, para imprenta)  --cat=compresores\n");
  process.exit(1);
}

const BASE = base.endsWith("/") ? base : base + "/";
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

const opciones = {
  margin: 4, // zona blanca alrededor: sin esto muchos lectores fallan
  errorCorrectionLevel: "M",
  color: { dark: "#000000", light: "#FFFFFF" },
  width: 1000 // sólo aplica al PNG; el SVG escala sin perder calidad
};

(async function () {
  let hechos = 0;
  const categorias = Object.keys(manifest.categorias).filter(
    (c) => !soloCat || c === soloCat
  );

  if (!categorias.length) {
    console.error('No existe la categoría "' + soloCat + '" en el manifest.');
    process.exit(1);
  }

  for (const cat of categorias) {
    const carpeta = path.join(SALIDA, cat);
    fs.mkdirSync(carpeta, { recursive: true });

    for (const codigo of manifest.categorias[cat].productos) {
      const url =
        BASE + "ficha-producto.html?id=" + encodeURIComponent(codigo) +
        "&cat=" + encodeURIComponent(cat);
      const archivo = path.join(carpeta, codigo + (svg ? ".svg" : ".png"));

      if (svg) {
        fs.writeFileSync(archivo, await QRCode.toString(url, { ...opciones, type: "svg" }));
      } else {
        await QRCode.toFile(archivo, url, opciones);
      }
      hechos++;
    }
    console.log("  " + manifest.categorias[cat].nombre + ": " +
                manifest.categorias[cat].productos.length + " QR");
  }

  console.log("\nListo: " + hechos + " QR en " + SALIDA);
  console.log("Apuntan a: " + BASE + "ficha-producto.html?id=...\n");
})().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
