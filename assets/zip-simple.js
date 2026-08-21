/* =====================================================================
   ZIP mínimo, sin dependencias ni internet.

   Guarda los archivos "tal cual" (método store, sin comprimir): los PNG
   ya vienen comprimidos, así que comprimir de nuevo no ahorra nada y
   evita tener que meter una librería de deflate en el repo.

   Uso:
     var z = new ZipSimple();
     z.agregar("Categoria/CODIGO.png", uint8array);
     var blob = z.blob();          // -> descargar con URL.createObjectURL
   ===================================================================== */
(function (global) {
  "use strict";

  /* Tabla de CRC-32, la que pide el formato ZIP. Se arma una sola vez. */
  var TABLA = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = TABLA[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* Los nombres van en UTF-8 (bandera 0x0800) para no romper los acentos. */
  function aBytes(texto) {
    if (global.TextEncoder) return new TextEncoder().encode(texto);
    var esc = unescape(encodeURIComponent(texto));
    var out = new Uint8Array(esc.length);
    for (var i = 0; i < esc.length; i++) out[i] = esc.charCodeAt(i);
    return out;
  }

  /* Hora y fecha en el formato viejo de DOS que usa el ZIP. */
  function fechaDOS(d) {
    return {
      hora: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2)) & 0xFFFF,
      fecha: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF
    };
  }

  function Escritor(largo) {
    this.b = new Uint8Array(largo);
    this.v = new DataView(this.b.buffer);
    this.p = 0;
  }
  Escritor.prototype.u16 = function (n) { this.v.setUint16(this.p, n, true); this.p += 2; return this; };
  Escritor.prototype.u32 = function (n) { this.v.setUint32(this.p, n >>> 0, true); this.p += 4; return this; };
  Escritor.prototype.bytes = function (a) { this.b.set(a, this.p); this.p += a.length; return this; };

  function ZipSimple() {
    this.entradas = [];
    this.partes = [];
    this.offset = 0;
  }

  /* nombre: ruta dentro del zip, con "/" para las carpetas.
     datos:  Uint8Array o ArrayBuffer. */
  ZipSimple.prototype.agregar = function (nombre, datos) {
    var bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
    var nom = aBytes(String(nombre).replace(/\\/g, "/").replace(/^\/+/, ""));
    var f = fechaDOS(new Date());
    var crc = crc32(bytes);

    var cab = new Escritor(30 + nom.length);
    cab.u32(0x04034B50).u16(20).u16(0x0800).u16(0)
       .u16(f.hora).u16(f.fecha)
       .u32(crc).u32(bytes.length).u32(bytes.length)
       .u16(nom.length).u16(0).bytes(nom);

    this.entradas.push({ nom: nom, crc: crc, tam: bytes.length, off: this.offset, hora: f.hora, fecha: f.fecha });
    this.partes.push(cab.b, bytes);
    this.offset += cab.b.length + bytes.length;
    return this;
  };

  ZipSimple.prototype.blob = function () {
    var largoCentral = 0, i;
    for (i = 0; i < this.entradas.length; i++) largoCentral += 46 + this.entradas[i].nom.length;

    var c = new Escritor(largoCentral + 22);
    for (i = 0; i < this.entradas.length; i++) {
      var e = this.entradas[i];
      c.u32(0x02014B50).u16(20).u16(20).u16(0x0800).u16(0)
       .u16(e.hora).u16(e.fecha)
       .u32(e.crc).u32(e.tam).u32(e.tam)
       .u16(e.nom.length).u16(0).u16(0)
       .u16(0).u16(0).u32(0)
       .u32(e.off).bytes(e.nom);
    }
    c.u32(0x06054B50).u16(0).u16(0)
     .u16(this.entradas.length).u16(this.entradas.length)
     .u32(largoCentral).u32(this.offset).u16(0);

    return new Blob(this.partes.concat([c.b]), { type: "application/zip" });
  };

  /* Se expone porque el armador de PNG también necesita CRC-32. */
  ZipSimple.crc32 = crc32;

  global.ZipSimple = ZipSimple;
})(window);
