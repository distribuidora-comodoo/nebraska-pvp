/* =====================================================================
   PNG en blanco y negro armado a mano, a partir de la matriz del QR.

   ¿Por qué no usar canvas.toBlob? Porque el codificador PNG del
   navegador tarda alrededor de un segundo por imagen grande, y con 200
   productos eso son varios minutos de espera. Acá el QR se escribe
   como PNG de 1 bit por píxel (blanco o negro, que es todo lo que un
   QR necesita), lo que sale en milisegundos y además pesa menos.

   Uso:
     PNGQR.generar("https://...", 600).then(function (bytes) { ... });
   ===================================================================== */
(function (global) {
  "use strict";

  var crc32 = global.ZipSimple.crc32;

  function u32(n) {
    return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
  }

  /* Un bloque PNG: largo + tipo + datos + CRC del tipo y los datos. */
  function chunk(tipo, datos) {
    var nom = new Uint8Array([tipo.charCodeAt(0), tipo.charCodeAt(1), tipo.charCodeAt(2), tipo.charCodeAt(3)]);
    var cuerpo = new Uint8Array(4 + datos.length);
    cuerpo.set(nom, 0);
    cuerpo.set(datos, 4);

    var out = new Uint8Array(12 + datos.length);
    out.set(u32(datos.length), 0);
    out.set(cuerpo, 4);
    out.set(u32(crc32(cuerpo)), 8 + datos.length);
    return out;
  }

  /* Filas crudas del PNG: 1 byte de filtro + los píxeles empaquetados
     de a 8 por byte. En PNG de 1 bit, 0 = negro y 1 = blanco. */
  function filas(qr, margen, escala) {
    var size = qr.modules.size;
    var data = qr.modules.data;
    var lado = (size + margen * 2) * escala;
    var bytesFila = Math.ceil(lado / 8);
    var out = new Uint8Array((bytesFila + 1) * lado);

    /* Una fila de módulos ocupa "escala" filas de píxeles idénticas,
       así que se arma una sola vez y se copia. */
    var buf = new Uint8Array(bytesFila);
    var y, x, i, fila, destino;

    for (y = 0; y < size + margen * 2; y++) {
      buf.fill(0xFF); /* todo blanco: cubre el margen de los costados */
      fila = y - margen;

      if (fila >= 0 && fila < size) {
        for (x = 0; x < size; x++) {
          if (!data[fila * size + x]) continue; /* claro: queda en blanco */
          var desde = (x + margen) * escala;
          for (i = 0; i < escala; i++) {
            var px = desde + i;
            buf[px >> 3] &= ~(0x80 >> (px & 7)); /* apaga el bit: negro */
          }
        }
      }

      for (i = 0; i < escala; i++) {
        destino = (y * escala + i) * (bytesFila + 1);
        out[destino] = 0; /* filtro "None" */
        out.set(buf, destino + 1);
      }
    }
    return { datos: out, lado: lado };
  }

  /* zlib con CompressionStream, que es el que trae el navegador.
     Si no estuviera, se guarda sin comprimir (pesa más, pero anda). */
  function comprimir(bytes) {
    if (typeof global.CompressionStream === "function") {
      var cs = new global.CompressionStream("deflate");
      var w = cs.writable.getWriter();
      w.write(bytes);
      w.close();
      return new Response(cs.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); });
    }
    return Promise.resolve(zlibSinComprimir(bytes));
  }

  /* Respaldo: envoltorio zlib con bloques "stored" (sin comprimir). */
  function zlibSinComprimir(bytes) {
    var MAX = 65535;
    var bloques = Math.max(1, Math.ceil(bytes.length / MAX));
    var out = new Uint8Array(2 + bloques * 5 + bytes.length + 4);
    var p = 0;
    out[p++] = 0x78; out[p++] = 0x01;

    for (var i = 0; i < bytes.length || i === 0; i += MAX) {
      var trozo = bytes.subarray(i, Math.min(i + MAX, bytes.length));
      var ultimo = (i + MAX >= bytes.length) ? 1 : 0;
      out[p++] = ultimo;
      out[p++] = trozo.length & 255;
      out[p++] = (trozo.length >> 8) & 255;
      out[p++] = (~trozo.length) & 255;
      out[p++] = ((~trozo.length) >> 8) & 255;
      out.set(trozo, p); p += trozo.length;
      if (ultimo) break;
    }

    /* Adler-32, la suma de control que pide zlib. */
    var a = 1, b = 0;
    for (var j = 0; j < bytes.length; j++) {
      a = (a + bytes[j]) % 65521;
      b = (b + a) % 65521;
    }
    out.set(u32(((b << 16) | a) >>> 0), p); p += 4;
    return out.subarray(0, p);
  }

  /* Devuelve los bytes de un PNG con el QR del texto dado.
     "res" es el ancho buscado en píxeles; se redondea al múltiplo
     entero más cercano para que los cuadraditos queden con el borde
     limpio en vez de borroneados. */
  function generar(texto, res, opciones) {
    opciones = opciones || {};
    var margen = opciones.margen == null ? 2 : opciones.margen;

    return Promise.resolve().then(function () {
      var qr = global.QRCode.create(texto, {
        errorCorrectionLevel: opciones.correccion || "M"
      });

      var lado = qr.modules.size + margen * 2;
      var escala = Math.max(1, Math.round((res || 600) / lado));
      var f = filas(qr, margen, escala);

      return comprimir(f.datos).then(function (comprimido) {
        var ihdr = new Uint8Array(13);
        ihdr.set(u32(f.lado), 0);
        ihdr.set(u32(f.lado), 4);
        ihdr[8] = 1;  /* 1 bit por píxel */
        ihdr[9] = 0;  /* escala de grises */
        ihdr[10] = 0; /* compresión estándar */
        ihdr[11] = 0; /* filtrado estándar */
        ihdr[12] = 0; /* sin entrelazado */

        var partes = [
          new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
          chunk("IHDR", ihdr),
          chunk("IDAT", comprimido),
          chunk("IEND", new Uint8Array(0))
        ];

        var total = 0, i;
        for (i = 0; i < partes.length; i++) total += partes[i].length;
        var png = new Uint8Array(total);
        for (i = 0, total = 0; i < partes.length; i++) {
          png.set(partes[i], total);
          total += partes[i].length;
        }
        return png;
      });
    });
  }

  global.PNGQR = { generar: generar };
})(window);
