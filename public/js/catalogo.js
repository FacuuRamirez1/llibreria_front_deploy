(function (global) {
  'use strict';

  var TUCO = global.TUCO = global.TUCO || {};

  var LIMITE = 20;
  var ESPERA_BUSQUEDA_MS = 300;

  var elementos = null;
  var estado = { titulo: '', offset: 0 };
  var numeroPeticion = 0;
  var temporizador = null;

  var PORTADAS = {
    'Ficciones': 'Ficciones.webp',
    'Rayuela': 'Rayuela.webp',
    'Cien años de soledad': 'Cien-anos-de-soledad.webp',
    'El túnel': 'el-tunel.webp',
    'Las cosas que perdimos en el fuego': 'Las-cosas-que-perdimos-en-el-fuego.webp',
    'Catedrales': 'Catedrales.webp'
  };

  function obtenerPortada(titulo) {
    return PORTADAS[titulo] || 'portada-placeholder.svg';
  }

  function asignarTexto(contenedor, selector, valor) {
    var nodo = contenedor.querySelector(selector);
    if (nodo) {
      nodo.textContent = valor === null || valor === undefined ? '' : String(valor);
    }
  }

  // Una sola vista visible a la vez: 'cargando' | 'error' | 'vacio' | 'sin-resultados' | 'lista'
  function mostrarVista(vista, textoError) {
    elementos.cargando.hidden = vista !== 'cargando';
    elementos.error.hidden = vista !== 'error';
    elementos.vacio.hidden = vista !== 'vacio';
    elementos.sinResultados.hidden = vista !== 'sin-resultados';
    if (vista === 'error') {
      elementos.textoError.textContent = textoError;
    }
    if (vista !== 'lista') {
      elementos.listado.replaceChildren();
    }
    elementos.listado.setAttribute('aria-busy', vista === 'cargando' ? 'true' : 'false');
  }

  function crearTarjeta(libro) {
    var tarjeta = elementos.plantilla.content.cloneNode(true).querySelector('.tarjeta');

    var imagen = tarjeta.querySelector('img');
    if (imagen) {
      imagen.src = 'assets/portadas/' + obtenerPortada(libro.titulo);
      imagen.alt = 'Portada de ' + libro.titulo;
    }

    tarjeta.setAttribute('tabindex', '0');
    asignarTexto(tarjeta, '.tarjeta-titulo', libro.titulo);
    asignarTexto(tarjeta, '.tarjeta-isbn', libro.isbn);
    asignarTexto(tarjeta, '.tarjeta-editorial', libro.editorial ? libro.editorial.nombre : '');
    asignarTexto(tarjeta, '.tarjeta-genero', libro.genero ? libro.genero.nombre : 'Sin clasificar');
    asignarTexto(tarjeta, '.tarjeta-precio', TUCO.formato.formatearMoneda(libro.precio));

    var boton = tarjeta.querySelector('.tarjeta-ver-autores');
    if (boton) {
      boton.addEventListener('click', function () {
        cargarAutores(libro.id, tarjeta, boton);
      });
    }

    return tarjeta;
  }

  // El listado no trae autores: se piden con GET /libros/{id}.
  function cargarAutores(id, tarjeta, boton) {
    var destino = tarjeta.querySelector('.tarjeta-autores');
    boton.disabled = true;
    destino.textContent = 'Cargando autores…';

    TUCO.api.libros.obtener(id).then(function (detalle) {
      var autores = (detalle.autores || [])
        .slice()
        .sort(function (a, b) { return a.orden - b.orden; })
        .map(function (a) { return a.autor.nombre + ' (' + a.rol + ')'; });
      destino.textContent = autores.length ? autores.join(', ') : 'Sin autores registrados.';
      boton.hidden = true;
    }).catch(function (error) {
      destino.textContent = error.message;
      boton.disabled = false;
    });
  }

  function actualizarPaginacion(cantidad) {
    var hayAnterior = estado.offset > 0;
    // La API no informa el total: si la página vino llena, puede haber otra.
    var haySiguiente = cantidad === LIMITE;

    elementos.paginacion.hidden = !hayAnterior && !haySiguiente;
    elementos.anterior.disabled = !hayAnterior;
    elementos.siguiente.disabled = !haySiguiente;
    elementos.indicador.textContent = 'Página ' + (Math.floor(estado.offset / LIMITE) + 1);
  }

  function cargar() {
    var propia = ++numeroPeticion;
    mostrarVista('cargando');
    elementos.paginacion.hidden = true;

    TUCO.api.libros.listar({
      titulo: estado.titulo,
      limit: LIMITE,
      offset: estado.offset
    }).then(function (libros) {
      if (propia !== numeroPeticion) {
        return; // llegó una respuesta de una búsqueda anterior
      }

      if (libros.length === 0 && estado.offset > 0) {
        // Página más allá del final: volver a la anterior.
        estado.offset = Math.max(0, estado.offset - LIMITE);
        cargar();
        return;
      }

      if (libros.length === 0) {
        mostrarVista(estado.titulo.trim() === '' ? 'vacio' : 'sin-resultados');
        actualizarPaginacion(0);
        return;
      }

      mostrarVista('lista');
      var fragmento = document.createDocumentFragment();
      libros.forEach(function (libro) { fragmento.appendChild(crearTarjeta(libro)); });
      elementos.listado.replaceChildren(fragmento);
      actualizarPaginacion(libros.length);
    }).catch(function (error) {
      if (propia !== numeroPeticion) {
        return;
      }
      mostrarVista('error', error.message);
      elementos.paginacion.hidden = true;
    });
  }

  function buscar(titulo) {
    estado.titulo = titulo;
    estado.offset = 0; // al cambiar el filtro se reinicia el desplazamiento
    cargar();
  }

  function inicializar() {
    var listado = document.getElementById('listado-catalogo');
    var plantilla = document.getElementById('plantilla-tarjeta-libro');
    if (!listado || !plantilla) {
      return;
    }

    var buscador = document.getElementById('buscador-titulo');
    var formulario = buscador ? buscador.closest('form') : null;

    elementos = {
      buscador: buscador,
      listado: listado,
      plantilla: plantilla,
      cargando: document.getElementById('mensaje-catalogo-cargando'),
      vacio: document.getElementById('mensaje-catalogo-vacio'),
      sinResultados: document.getElementById('mensaje-sin-resultados'),
      error: document.getElementById('mensaje-catalogo-error'),
      textoError: document.getElementById('texto-catalogo-error'),
      reintentar: document.getElementById('boton-reintentar'),
      paginacion: document.getElementById('paginacion-catalogo'),
      anterior: document.getElementById('pagina-anterior'),
      siguiente: document.getElementById('pagina-siguiente'),
      indicador: document.getElementById('pagina-indicador')
    };

    buscador.addEventListener('input', function (evento) {
      clearTimeout(temporizador);
      var valor = evento.target.value;
      temporizador = setTimeout(function () { buscar(valor); }, ESPERA_BUSQUEDA_MS);
    });

    formulario.addEventListener('submit', function (evento) {
      evento.preventDefault();
      clearTimeout(temporizador);
      buscar(buscador.value);
    });

    elementos.reintentar.addEventListener('click', cargar);
    elementos.anterior.addEventListener('click', function () {
      estado.offset = Math.max(0, estado.offset - LIMITE);
      cargar();
    });
    elementos.siguiente.addEventListener('click', function () {
      estado.offset += LIMITE;
      cargar();
    });

    buscar(buscador.value);
  }

  TUCO.catalogo = { inicializar: inicializar };

  if (typeof document !== 'undefined') {
    TUCO.catalogo.inicializar();
  }
})(window);
