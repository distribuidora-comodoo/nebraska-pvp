/* =====================================================================
   Nebraska — compartir y descargar fichas

   Pensado para el vendedor que quiere subir la ficha a un estado de
   WhatsApp o a una story de Instagram desde el celular.

   - "Para story": arma una imagen 1080x1920 con la ficha centrada sobre
     el fondo negro de la marca. Sin esto, Instagram agranda la ficha
     hasta llenar la pantalla y recorta el precio.
   - Compartir usa el menú nativo del celular (Web Share), donde la
     persona elige WhatsApp -> Mi estado, o Instagram -> Historia.
     Ninguna app deja publicar directo desde una web, así que este es el
     camino más corto que existe.
   - Si el navegador no puede compartir archivos (una PC, un celular
     viejo), el mismo botón descarga.
   ===================================================================== */
(function (global) {
  "use strict";

  var STORY_ANCHO = 1080;
  var STORY_ALTO = 1920;
  /* Instagram y WhatsApp tapan la franja de arriba (nombre de usuario)
     y la de abajo (responder). La ficha se mantiene fuera de esas zonas. */
  var STORY_MARGEN_VERTICAL = 260;
  var STORY_MARGEN_LADO = 64;

  var LLAVE_FORMATO = "nb_formato";

  /* En iPhone, el atributo "download" no guarda en Fotos: la salida que
     sí funciona es el menú de compartir y ahí "Guardar imagen". */
  var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function formato() {
    return localStorage.getItem(LLAVE_FORMATO) === "original" ? "original" : "story";
  }
  function guardarFormato(f) {
    try { localStorage.setItem(LLAVE_FORMATO, f); } catch (e) {}
  }

  function rectanguloRedondeado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* La ficha centrada sobre fondo de marca, en tamaño de story. */
  function armarStory(img) {
    var c = document.createElement("canvas");
    c.width = STORY_ANCHO;
    c.height = STORY_ALTO;
    var ctx = c.getContext("2d");

    ctx.fillStyle = "#1d1d1d";
    ctx.fillRect(0, 0, STORY_ANCHO, STORY_ALTO);

    /* La misma línea naranja que lleva el encabezado del sitio. */
    ctx.fillStyle = "#fc771d";
    ctx.fillRect(0, 0, STORY_ANCHO, 10);
    ctx.fillRect(0, STORY_ALTO - 10, STORY_ANCHO, 10);

    var maxW = STORY_ANCHO - STORY_MARGEN_LADO * 2;
    var maxH = STORY_ALTO - STORY_MARGEN_VERTICAL * 2;
    var esc = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    var w = Math.round(img.naturalWidth * esc);
    var h = Math.round(img.naturalHeight * esc);
    var x = Math.round((STORY_ANCHO - w) / 2);
    var y = Math.round((STORY_ALTO - h) / 2);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 18;
    rectanguloRedondeado(ctx, x, y, w, h, 28);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();

    ctx.save();
    rectanguloRedondeado(ctx, x, y, w, h, 28);
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();

    return c;
  }

  function aBlob(canvas, tipo, calidad) {
    return new Promise(function (ok, mal) {
      canvas.toBlob(function (b) { b ? ok(b) : mal(new Error("No se pudo armar la imagen")); }, tipo, calidad);
    });
  }

  function cargarImagen(url) {
    return new Promise(function (ok, mal) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { mal(new Error("No se pudo cargar la ficha")); };
      img.src = url;
    });
  }

  /* Prepara las dos versiones (story y original) de una ficha. Se cachea
     por URL, y conviene llamarlo apenas se ve la ficha: así, cuando la
     persona toca Compartir, el archivo ya está listo. Eso importa en
     iPhone, que sólo abre el menú de compartir si se lo pide justo
     después del toque, sin esperas de por medio. */
  var cache = {};

  function preparar(fuente, codigo) {
    var url = typeof fuente === "string" ? fuente : fuente.src;
    if (cache[url]) return cache[url];

    var img = (typeof fuente !== "string" && fuente.complete && fuente.naturalWidth) ? Promise.resolve(fuente) : cargarImagen(url);

    cache[url] = img.then(function (im) {
      return Promise.all([
        aBlob(armarStory(im), "image/jpeg", 0.9),
        fetch(url).then(function (r) { return r.blob(); })
      ]);
    }).then(function (r) {
      return {
        story: new File([r[0]], "Nebraska-" + codigo + "-story.jpg", { type: "image/jpeg" }),
        original: new File([r[1]], "Nebraska-" + codigo + ".png", { type: r[1].type || "image/png" })
      };
    });
    cache[url].catch(function () { delete cache[url]; });
    return cache[url];
  }

  function puedeCompartir(archivos) {
    try {
      return !!(navigator.share && navigator.canShare && navigator.canShare({ files: archivos }));
    } catch (e) { return false; }
  }

  function descargar(archivo) {
    var href = URL.createObjectURL(archivo);
    var a = document.createElement("a");
    a.href = href;
    a.download = archivo.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 60000);
  }

  /* Abre el menú de compartir del celular con los archivos adjuntos.
     Devuelve "compartido", "cancelado" (la persona cerró el menú) o
     "descargado" (no se pudo compartir y se bajaron los archivos). */
  function compartir(archivos, titulo) {
    if (puedeCompartir(archivos)) {
      return navigator.share({ files: archivos, title: titulo || "Nebraska" })
        .then(function () { return "compartido"; })
        .catch(function (e) {
          if (e && e.name === "AbortError") return "cancelado";
          archivos.forEach(descargar);
          return "descargado";
        });
    }
    archivos.forEach(descargar);
    return Promise.resolve("descargado");
  }

  /* "Descargar" hace lo que cada teléfono permite: en Android baja a la
     galería; en iPhone abre el menú para tocar "Guardar imagen". */
  function guardar(archivos, titulo) {
    if (esIOS && puedeCompartir(archivos)) return compartir(archivos, titulo);
    archivos.forEach(descargar);
    return Promise.resolve("descargado");
  }

  global.NBCompartir = {
    esIOS: esIOS,
    formato: formato,
    guardarFormato: guardarFormato,
    preparar: preparar,
    compartir: compartir,
    guardar: guardar,
    puedeCompartir: puedeCompartir
  };
})(window);
