/* =====================================================================
   Nebraska — lógica compartida del catálogo
   - Lee fichas/manifest.json una sola vez por página (cacheado)
   - Buscador por código disponible en TODAS las páginas
   ===================================================================== */
(function (global) {
  "use strict";

  var BASE = "fichas";
  var promesa = null;

  /* Descarga el manifest una sola vez. El "?t=" evita que el navegador
     muestre una versión vieja en caché después de actualizar el repo. */
  function manifest() {
    if (!promesa) {
      promesa = fetch(BASE + "/manifest.json?t=" + Date.now()).then(function (r) {
        if (!r.ok) throw new Error("manifest " + r.status);
        return r.json();
      });
    }
    return promesa;
  }

  /* Deja el texto comparable: sin espacios, guiones ni acentos. */
  function norm(s) {
    return String(s || "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[^A-Z0-9]/g, "");
  }

  /* Lista plana [{codigo, cat, catNombre}] de todo el catálogo. */
  function indice(data) {
    var out = [];
    Object.keys(data.categorias || {}).forEach(function (cat) {
      var info = data.categorias[cat];
      (info.productos || []).forEach(function (codigo) {
        out.push({ codigo: codigo, cat: cat, catNombre: info.nombre, key: norm(codigo) });
      });
    });
    return out;
  }

  /* Categoría a la que pertenece un código (null si no está en el manifest). */
  function catDe(data, codigo) {
    var k = norm(codigo);
    var cats = data.categorias || {};
    var encontrada = null;
    Object.keys(cats).forEach(function (cat) {
      if (encontrada) return;
      (cats[cat].productos || []).forEach(function (c) {
        if (!encontrada && norm(c) === k) encontrada = cat;
      });
    });
    return encontrada;
  }

  function linkFicha(codigo, cat) {
    return "ficha-producto.html?id=" + encodeURIComponent(codigo) + (cat ? "&cat=" + encodeURIComponent(cat) : "");
  }

  function imgFicha(codigo, cat) {
    return (cat ? BASE + "/" + cat : BASE) + "/" + codigo + ".png";
  }

  /* ------------------------- más visitados ---------------------------
     El sitio es estático (GitHub Pages), así que no hay servidor donde
     sumar las visitas de todos los clientes. Lo que se guarda acá son
     las visitas DE ESTE CELULAR, en el propio navegador (localStorage):
     alcanza para que cada vendedor o cliente vea primero lo que más
     mira. Para un ranking real de todos los clientes haría falta un
     contador externo (Google Analytics, Firebase o similar).
     ------------------------------------------------------------------- */
  var LLAVE = "nb_visitas_v1";

  function leerVisitas() {
    try {
      var v = JSON.parse(localStorage.getItem(LLAVE));
      if (v && v.cats && v.prods) return v;
    } catch (e) {}
    return { cats: {}, prods: [] };
  }

  function registrarVisita(cat, codigo) {
    var v = leerVisitas();
    if (cat) v.cats[cat] = (v.cats[cat] || 0) + 1;
    if (codigo) {
      v.prods = v.prods.filter(function (p) { return p.codigo !== codigo; });
      v.prods.unshift({ codigo: codigo, cat: cat || null });
      v.prods = v.prods.slice(0, 10);
    }
    try { localStorage.setItem(LLAVE, JSON.stringify(v)); } catch (e) {}
  }

  /* Claves de categoría ordenadas de más a menos visitada. Las que
     todavía no se visitaron mantienen el orden del manifest. */
  function categoriasOrdenadas(data) {
    var v = leerVisitas().cats;
    return Object.keys(data.categorias || {}).sort(function (a, b) {
      return (v[b] || 0) - (v[a] || 0);
    });
  }

  function hayVisitas() {
    var v = leerVisitas();
    return Object.keys(v.cats).length > 0;
  }

  function recientes() {
    return leerVisitas().prods;
  }

  /* --------------------------- buscador ------------------------------ */
  function buscar(items, cats, q) {
    var k = norm(q);
    if (!k) return [];
    var empieza = [], contiene = [];
    items.forEach(function (it) {
      var i = it.key.indexOf(k);
      if (i === 0) empieza.push(it);
      else if (i > 0) contiene.push(it);
    });
    var res = empieza.concat(contiene).slice(0, 12);

    /* Si además el texto coincide con el nombre de una categoría, la
       ofrecemos al final para poder ver la familia completa. */
    Object.keys(cats).forEach(function (cat) {
      if (norm(cats[cat].nombre).indexOf(k) >= 0 && k.length >= 3) {
        res.push({ esCat: true, cat: cat, catNombre: cats[cat].nombre, cant: (cats[cat].productos || []).length });
      }
    });
    return res.slice(0, 14);
  }

  /* Marca en naranja la parte del código que el cliente escribió. Si el
     código tiene guiones (ej: NEPDG-8) y la búsqueda no, se muestra sin
     resaltado en vez de cortar mal el texto. */
  function resaltar(codigo, q) {
    var k = q.trim().toUpperCase();
    var i = k ? codigo.toUpperCase().indexOf(k) : -1;
    if (i < 0) return escapar(codigo);
    return escapar(codigo.slice(0, i)) + "<b>" + escapar(codigo.slice(i, i + k.length)) + "</b>" + escapar(codigo.slice(i + k.length));
  }

  function escapar(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function initBuscador() {
    var input = document.getElementById("nb-q");
    var panel = document.getElementById("nb-res");
    var limpiar = document.querySelector(".nb-limpiar");
    if (!input || !panel) return;

    var items = [], cats = {}, listos = false, activo = -1;

    manifest().then(function (data) {
      items = indice(data);
      cats = data.categorias || {};
      listos = true;
      if (input.value) render();
    }).catch(function () {});

    function cerrar() {
      panel.innerHTML = "";
      panel.style.display = "none";
      activo = -1;
    }

    function render() {
      var q = input.value.trim();
      limpiar.style.display = q ? "flex" : "none";
      if (!q) return cerrar();

      if (!listos) {
        panel.innerHTML = '<div class="vacio">Cargando catálogo…</div>';
        panel.style.display = "block";
        return;
      }

      var res = buscar(items, cats, q);
      if (!res.length) {
        panel.innerHTML = '<div class="vacio">Sin resultados para “' + escapar(q) + '”</div>';
        panel.style.display = "block";
        return;
      }

      panel.innerHTML = res.map(function (it) {
        if (it.esCat) {
          return '<a href="categoria.html?cat=' + encodeURIComponent(it.cat) + '">' +
                 '<span class="cod">' + escapar(it.catNombre) + '</span>' +
                 '<span class="cat">' + it.cant + " productos</span></a>";
        }
        return '<a href="' + linkFicha(it.codigo, it.cat) + '">' +
               '<span class="cod">' + resaltar(it.codigo, q) + "</span>" +
               '<span class="cat">' + escapar(it.catNombre) + "</span></a>";
      }).join("");
      panel.style.display = "block";
      activo = -1;
    }

    function mover(paso) {
      var links = panel.querySelectorAll("a");
      if (!links.length) return;
      if (activo >= 0) links[activo].classList.remove("act");
      activo = (activo + paso + links.length) % links.length;
      links[activo].classList.add("act");
      links[activo].scrollIntoView({ block: "nearest" });
    }

    input.addEventListener("input", render);
    input.addEventListener("focus", render);

    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); mover(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); mover(-1); }
      else if (e.key === "Escape") { input.blur(); cerrar(); }
      else if (e.key === "Enter") {
        var links = panel.querySelectorAll("a");
        var destino = links[activo >= 0 ? activo : 0];
        if (destino) { e.preventDefault(); window.location.href = destino.getAttribute("href"); }
      }
    });

    limpiar.addEventListener("click", function () {
      input.value = "";
      render();
      input.focus();
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".nb-search")) cerrar();
    });

    cerrar();
  }

  /* Tarjeta de producto reutilizable (grilla y carrusel).
     Si todavía no está subida la imagen de la ficha, en vez de una imagen
     rota se muestra un cartel prolijo y el link sigue funcionando. */
  function tarjeta(codigo, cat) {
    var a = document.createElement("a");
    a.className = "nb-prod";
    a.href = linkFicha(codigo, cat);
    a.innerHTML =
      '<img src="' + imgFicha(codigo, cat) + '" loading="lazy" alt="Ficha ' + escapar(codigo) + '">' +
      '<span class="cod">' + escapar(codigo) + "</span>";

    a.querySelector("img").addEventListener("error", function () {
      this.insertAdjacentHTML("afterend",
        '<span class="nb-sin-ficha">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">' +
        '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 15l4.5-4 4 3.5L15 10l6 5.5"/></svg>' +
        "Ficha en preparación</span>");
      this.remove();
    });
    return a;
  }

  global.NB = {
    BASE: BASE,
    manifest: manifest,
    indice: indice,
    catDe: catDe,
    linkFicha: linkFicha,
    imgFicha: imgFicha,
    tarjeta: tarjeta,
    escapar: escapar,
    initBuscador: initBuscador,
    registrarVisita: registrarVisita,
    categoriasOrdenadas: categoriasOrdenadas,
    hayVisitas: hayVisitas,
    recientes: recientes
  };

  document.addEventListener("DOMContentLoaded", initBuscador);
})(window);
