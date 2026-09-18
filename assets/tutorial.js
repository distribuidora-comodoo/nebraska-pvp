/* =====================================================================
   Nebraska — tutorial de uso

   Un recorrido corto de cinco pasos: buscar, destacados, publicar en
   estados y stories, descargar, y varias de una vez.

   - Aparece solo la primera vez que se entra al sitio en cada visita,
     hasta que la persona marca "No volver a mostrar".
   - Arriba queda un "?" chiquito que lo abre cuando haga falta.

   "Cada visita" y no "cada página": el sitio son varias páginas
   (menú, categoría, ficha) y molestaría que salte en cada toque. Se
   muestra una vez por sesión del navegador mientras no lo apaguen.

   Una página puede traer su propio recorrido definiendo, antes de
   cargar este archivo, window.NB_TUTORIAL = { clave, pasos }. Así el
   panel de destacados tiene el suyo, con su propio "no volver a
   mostrar", sin mezclarse con el del catálogo.
   ===================================================================== */
(function (global) {
  "use strict";

  var propio = global.NB_TUTORIAL || {};
  var clave = propio.clave || "catalogo";
  var LLAVE_OCULTAR = "nb_tutorial_ocultar_" + clave;   /* localStorage: "no volver a mostrar" */
  var LLAVE_SESION = "nb_tutorial_visto_" + clave;      /* sessionStorage: ya salió en esta visita */

  var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  var PASOS = propio.pasos || [
    {
      titulo: "Buscá el producto",
      texto: "Escaneá el QR que está en el producto, o escribí su código en el buscador de arriba. También podés entrar por categoría.",
      icono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3M21 14v7h-4M17 21h-3v-3"/></svg>'
    },
    {
      titulo: "Los Destacados, primero",
      texto: "Arriba de todo están los productos destacados de la semana. Se mueven solos; tocá uno para ver su ficha.",
      icono: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'
    },
    {
      titulo: "Publicar en estados y stories",
      texto: "En la ficha, tocá <b>Compartir</b>. Elegí WhatsApp y <b>Mi estado</b>, o Instagram e <b>Historia</b>. Con <b>Para story</b> activado el precio no se corta.",
      icono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>'
    },
    {
      titulo: "Guardar la foto",
      texto: esIOS
        ? "Tocá <b>Compartir o guardar foto</b> y elegí <b>Guardar imagen</b>. Queda en Fotos."
        : "Tocá <b>Descargar</b> y la foto queda en la galería, lista para subir.",
      icono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M6 11l6 6 6-6M4 20h16"/></svg>'
    },
    {
      titulo: "Varias de una vez",
      texto: "Dentro de una categoría, <b>Elegir y compartir</b> te deja marcar varias fichas y mandarlas juntas. <b>Descargar todo</b> baja la categoría entera.",
      icono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><path d="M14 17.5l2.5 2.5 4.5-5" stroke-linecap="round"/></svg>'
    }
  ];

  var capa = null;
  var paso = 0;
  var ultimoFoco = null;

  function ocultarSiempre() { try { return localStorage.getItem(LLAVE_OCULTAR) === "1"; } catch (e) { return false; } }

  function armar() {
    capa = document.createElement("div");
    capa.className = "nb-tuto";
    capa.setAttribute("role", "dialog");
    capa.setAttribute("aria-modal", "true");
    capa.setAttribute("aria-label", propio.etiqueta || "Cómo usar el catálogo");
    capa.innerHTML =
      '<div class="nb-tuto-caja">' +
        '<button class="nb-tuto-cerrar" type="button" aria-label="Cerrar">&times;</button>' +
        '<div class="nb-tuto-icono"></div>' +
        '<div class="nb-tuto-puntos"></div>' +
        '<h2 class="nb-tuto-titulo"></h2>' +
        '<p class="nb-tuto-texto"></p>' +
        '<div class="nb-tuto-botones">' +
          '<button class="nb-btn nb-btn--claro" type="button" data-ir="-1">Anterior</button>' +
          '<button class="nb-btn" type="button" data-ir="1">Siguiente</button>' +
        "</div>" +
        '<label class="nb-tuto-check"><input type="checkbox"> No volver a mostrar</label>' +
      "</div>";
    document.body.appendChild(capa);

    var puntos = capa.querySelector(".nb-tuto-puntos");
    PASOS.forEach(function (_, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Paso " + (i + 1));
      b.addEventListener("click", function () { ir(i); });
      puntos.appendChild(b);
    });

    capa.querySelector(".nb-tuto-cerrar").addEventListener("click", cerrar);
    capa.querySelectorAll("[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () {
        var d = parseInt(b.dataset.ir, 10);
        if (d > 0 && paso === PASOS.length - 1) return cerrar();
        ir(paso + d);
      });
    });
    capa.querySelector(".nb-tuto-check input").addEventListener("change", function () {
      try {
        if (this.checked) localStorage.setItem(LLAVE_OCULTAR, "1");
        else localStorage.removeItem(LLAVE_OCULTAR);
      } catch (e) {}
    });
    capa.addEventListener("click", function (e) { if (e.target === capa) cerrar(); });
    document.addEventListener("keydown", function (e) {
      if (!capa.classList.contains("abierto")) return;
      if (e.key === "Escape") cerrar();
      else if (e.key === "ArrowRight") ir(paso + 1);
      else if (e.key === "ArrowLeft") ir(paso - 1);
    });
  }

  function ir(n) {
    if (n < 0 || n >= PASOS.length) return;
    paso = n;
    var p = PASOS[n];
    capa.querySelector(".nb-tuto-icono").innerHTML = p.icono;
    capa.querySelector(".nb-tuto-titulo").textContent = p.titulo;
    capa.querySelector(".nb-tuto-texto").innerHTML = p.texto;
    capa.querySelectorAll(".nb-tuto-puntos button").forEach(function (b, i) {
      b.setAttribute("aria-current", i === n ? "step" : "false");
    });
    capa.querySelector('[data-ir="-1"]').style.visibility = n === 0 ? "hidden" : "";
    capa.querySelector('[data-ir="1"]').textContent = n === PASOS.length - 1 ? "Entendido" : "Siguiente";
  }

  function abrir() {
    if (!capa) armar();
    ultimoFoco = document.activeElement;
    capa.querySelector(".nb-tuto-check input").checked = ocultarSiempre();
    ir(0);
    capa.classList.add("abierto");
    document.body.classList.add("nb-tuto-abierto");
    capa.querySelector('[data-ir="1"]').focus();
  }

  function cerrar() {
    if (!capa) return;
    capa.classList.remove("abierto");
    document.body.classList.remove("nb-tuto-abierto");
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  /* El "?" en la barra de arriba, antes del botón que ya esté ahí. */
  function botonAyuda() {
    var bar = document.querySelector(".nb-bar");
    if (!bar) return;
    var b = document.createElement("button");
    b.className = "nb-ayuda";
    b.type = "button";
    b.setAttribute("aria-label", propio.etiqueta || "Cómo usar el catálogo");
    b.title = propio.etiqueta || "Cómo usar el catálogo";
    b.textContent = "?";
    b.addEventListener("click", abrir);
    var existente = bar.querySelector(".nb-btn");
    if (existente) bar.insertBefore(b, existente); else bar.appendChild(b);
  }

  function iniciar() {
    botonAyuda();
    if (ocultarSiempre()) return;
    try {
      if (sessionStorage.getItem(LLAVE_SESION)) return;
      sessionStorage.setItem(LLAVE_SESION, "1");
    } catch (e) {}
    /* Un respiro para que la página termine de pintar antes del cartel. */
    setTimeout(abrir, 600);
  }

  global.NBTutorial = { abrir: abrir, cerrar: cerrar };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
