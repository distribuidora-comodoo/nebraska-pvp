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

   Cada paso pertenece a una página (inicio, ficha, categoría). Al
   entrar a una página salen solos únicamente los pasos de esa página,
   que es donde la persona los puede aplicar en el momento. El "?" de
   arriba muestra el recorrido completo.

   Cada página dice cuál es definiendo, antes de cargar este archivo,
   window.NB_TUTORIAL = { pagina: "inicio" }. El panel de destacados
   trae además sus propios pasos ({ clave, pasos }), con su propio "no
   volver a mostrar", sin mezclarse con el del catálogo.
   ===================================================================== */
(function (global) {
  "use strict";

  var propio = global.NB_TUTORIAL || {};
  var clave = propio.clave || "catalogo";
  var pagina = propio.pagina || "";
  var LLAVE_OCULTAR = "nb_tutorial_ocultar_" + clave;               /* localStorage: "no volver a mostrar" */
  var LLAVE_SESION = "nb_tutorial_visto_" + clave + "_" + pagina;   /* sessionStorage: ya salió en esta visita */

  var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  var ICONO_QR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3M21 14v7h-4M17 21h-3v-3"/></svg>';
  var ICONO_ESTRELLA = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>';
  var ICONO_COMPARTIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
  var ICONO_STORY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M9 7h6" stroke-linecap="round"/></svg>';
  var ICONO_BAJAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M6 11l6 6 6-6M4 20h16"/></svg>';
  var ICONO_VARIAS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><path d="M14 17.5l2.5 2.5 4.5-5" stroke-linecap="round"/></svg>';

  var PASOS = propio.pasos || [
    {
      pagina: "inicio",
      titulo: "Buscá un producto",
      texto: "Escaneá el QR que está pegado en el producto, o escribí su código en el buscador de arriba.",
      icono: ICONO_QR
    },
    {
      pagina: "inicio",
      titulo: "Destacados",
      texto: "Arriba están los productos destacados de la semana. Tocá uno para ver su ficha y su precio.",
      icono: ICONO_ESTRELLA
    },
    {
      pagina: "ficha",
      titulo: "Compartir la ficha",
      texto: "Tocá <b>Compartir</b>. Se abre el menú de tu celular: ahí elegís WhatsApp o Instagram.",
      icono: ICONO_COMPARTIR
    },
    {
      pagina: "ficha",
      titulo: "Subirla como estado o story",
      texto: "En WhatsApp tocá <b>Mi estado</b>. En Instagram, <b>Historia</b>. Dejá <b>Para story</b> activado: así el precio no se corta.",
      icono: ICONO_STORY
    },
    {
      pagina: "ficha",
      titulo: "Guardar la foto",
      texto: esIOS
        ? "Tocá <b>Compartir o guardar foto</b> y después <b>Guardar imagen</b>. Queda en Fotos."
        : "Tocá <b>Descargar</b>. La foto queda en la galería, lista para subir.",
      icono: ICONO_BAJAR
    },
    {
      pagina: "categoria",
      titulo: "Varias de una vez",
      texto: "<b>Elegir y compartir</b> marca varias fichas y las manda juntas. <b>Descargar todo</b> baja la categoría entera.",
      icono: ICONO_VARIAS
    }
  ];

  /* Los pasos que salen solos en esta página. Sin página definida (o
     con pasos propios sin página), salen todos. */
  function pasosDeAca() {
    var lista = PASOS.filter(function (p) { return !p.pagina || p.pagina === pagina; });
    return lista.length ? lista : PASOS;
  }

  var capa = null;
  var activos = PASOS;   /* lo que se está mostrando: los de la página, o todos */
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

    capa.querySelector(".nb-tuto-cerrar").addEventListener("click", cerrar);
    capa.querySelectorAll("[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () {
        var d = parseInt(b.dataset.ir, 10);
        if (d > 0 && paso === activos.length - 1) return cerrar();
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

  /* Un punto por paso de la lista activa. */
  function armarPuntos() {
    var puntos = capa.querySelector(".nb-tuto-puntos");
    puntos.innerHTML = "";
    activos.forEach(function (_, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Paso " + (i + 1));
      b.addEventListener("click", function () { ir(i); });
      puntos.appendChild(b);
    });
    puntos.hidden = activos.length < 2;
  }

  function ir(n) {
    if (n < 0 || n >= activos.length) return;
    paso = n;
    var p = activos[n];
    capa.querySelector(".nb-tuto-icono").innerHTML = p.icono;
    capa.querySelector(".nb-tuto-titulo").textContent = p.titulo;
    capa.querySelector(".nb-tuto-texto").innerHTML = p.texto;
    capa.querySelectorAll(".nb-tuto-puntos button").forEach(function (b, i) {
      b.setAttribute("aria-current", i === n ? "step" : "false");
    });
    capa.querySelector('[data-ir="-1"]').style.visibility = n === 0 ? "hidden" : "";
    capa.querySelector('[data-ir="1"]').textContent = n === activos.length - 1 ? "Entendido" : "Siguiente";
  }

  /* abrir(true) muestra el recorrido completo (desde el "?");
     abrir() sólo los pasos de esta página. */
  function abrir(todos) {
    if (!capa) armar();
    activos = todos === true ? PASOS : pasosDeAca();
    armarPuntos();
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
    b.addEventListener("click", function () { abrir(true); });
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
    setTimeout(function () { abrir(false); }, 600);
  }

  global.NBTutorial = { abrir: abrir, cerrar: cerrar };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
