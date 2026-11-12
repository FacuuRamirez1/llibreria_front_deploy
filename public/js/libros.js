(function (global) {
  'use strict';

  var TUCO = global.TUCO = global.TUCO || {};

  var LIMITE_LISTADO = 20;
  var LIMITE_OPCIONES = 100; // máximo que admite la API
  var ROLES = { autor: 'Autor', coautor: 'Coautor', traductor: 'Traductor', ilustrador: 'Ilustrador' };
  var CAMPOS = ['titulo', 'isbn', 'precio', 'stock', 'editorialId', 'autorIds'];

  var el = null;
  var autoresDisponibles = {}; // id -> nombre
  var autoresElegidos = [];    // [{autor_id, nombre, rol}], el orden es la posición
  var filasMostradas = 0;

  function $(id) { return document.getElementById(id); }

  // ---------- opciones de los selectores ----------

  function opcion(valor, texto, deshabilitada, seleccionada) {
    var o = document.createElement('option');
    o.value = valor;
    o.textContent = texto;
    o.disabled = Boolean(deshabilitada);
    o.selected = Boolean(seleccionada);
    return o;
  }

  function llenarSelector(select, marcador, deshabilitado, items) {
    var fragmento = document.createDocumentFragment();
    fragmento.appendChild(opcion('', marcador, deshabilitado, true));
    items.forEach(function (i) { fragmento.appendChild(opcion(i.id, i.nombre)); });
    select.replaceChildren(fragmento);
  }

  function cargarOpciones() {
    TUCO.api.editoriales.listar({ limit: LIMITE_OPCIONES }).then(function (lista) {
      llenarSelector(el.editorial, 'Seleccioná una editorial', true, lista);
    }).catch(function (e) {
      llenarSelector(el.editorial, 'No se pudieron cargar las editoriales', true, []);
      mostrarResumen('Editoriales: ' + e.message);
    });

    TUCO.api.generos.listar({ limit: LIMITE_OPCIONES }).then(function (lista) {
      llenarSelector(el.genero, 'Sin clasificar', false, lista);
    }).catch(function (e) {
      mostrarResumen('Géneros: ' + e.message);
    });

    TUCO.api.autores.listar({ limit: LIMITE_OPCIONES }).then(function (lista) {
      autoresDisponibles = {};
      lista.forEach(function (a) { autoresDisponibles[a.id] = a.nombre; });
      llenarSelector(el.autorSelect, 'Seleccioná un autor', true, lista);
    }).catch(function (e) {
      llenarSelector(el.autorSelect, 'No se pudieron cargar los autores', true, []);
      mostrarResumen('Autores: ' + e.message);
    });
  }

  // ---------- autores elegidos ----------

  function dibujarAutores() {
    var fragmento = document.createDocumentFragment();
    autoresElegidos.forEach(function (a, indice) {
      var li = document.createElement('li');
      li.appendChild(document.createTextNode(a.nombre + ' — ' + ROLES[a.rol] + ' '));
      var quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'boton boton--peligro boton--pequeno';
      quitar.textContent = 'Quitar';
      quitar.setAttribute('aria-label', 'Quitar a ' + a.nombre);
      quitar.addEventListener('click', function () {
        autoresElegidos.splice(indice, 1);
        dibujarAutores();
      });
      li.appendChild(quitar);
      fragmento.appendChild(li);
    });
    el.autoresLista.replaceChildren(fragmento);
    el.autoresVacio.hidden = autoresElegidos.length > 0;
  }

  function agregarAutor() {
    var id = el.autorSelect.value;
    mostrarError('autorIds', '');
    if (id === '') {
      mostrarError('autorIds', 'Seleccioná un autor para agregarlo.');
      return;
    }
    var yaEsta = autoresElegidos.some(function (a) { return String(a.autor_id) === id; });
    if (yaEsta) {
      mostrarError('autorIds', 'Ese autor ya está en la lista.');
      return;
    }
    autoresElegidos.push({
      autor_id: Number(id),
      nombre: autoresDisponibles[id] || ('Autor ' + id),
      rol: el.autorRol.value
    });
    el.autorSelect.value = '';
    dibujarAutores();
  }

  // ---------- errores y mensajes ----------

  function mostrarError(campo, texto) {
    var caja = el.errores[campo];
    caja.textContent = texto;
    caja.hidden = texto === '';
    if (el.controles[campo]) {
      if (texto === '') { el.controles[campo].removeAttribute('aria-invalid'); }
      else { el.controles[campo].setAttribute('aria-invalid', 'true'); }
    }
  }

  function mostrarResumen(texto) {
    el.resumen.textContent = texto;
    el.resumen.hidden = texto === '';
  }

  function limpiarMensajes() {
    CAMPOS.forEach(function (c) { mostrarError(c, ''); });
    mostrarResumen('');
    el.exito.hidden = true;
    el.exito.textContent = '';
    el.exito.classList.remove('mensaje--exito');
  }

  // ---------- validación en el cliente ----------

  function validar() {
    var errores = {};
    var titulo = el.controles.titulo.value.trim();
    var isbn = el.controles.isbn.value.trim();
    var precioTexto = el.controles.precio.value.trim();
    var stockTexto = el.controles.stock.value.trim();
    var editorial = el.controles.editorialId.value;

    if (titulo === '') { errores.titulo = 'Ingresá el título.'; }
    else if (titulo.length > 255) { errores.titulo = 'El título admite hasta 255 caracteres.'; }

    if (isbn === '') { errores.isbn = 'Ingresá el ISBN.'; }
    else if (isbn.length > 17) { errores.isbn = 'El ISBN admite hasta 17 caracteres.'; }

    var precio = Number(precioTexto);
    if (precioTexto === '' || !isFinite(precio) || precio <= 0) {
      errores.precio = 'El precio debe ser un número mayor que cero.';
    } else if (!/^\d+(\.\d{1,2})?$/.test(precioTexto)) {
      errores.precio = 'El precio admite hasta 2 decimales.';
    }

    if (!/^\d+$/.test(stockTexto)) {
      errores.stock = 'El stock debe ser un entero desde 0.';
    }

    if (editorial === '') { errores.editorialId = 'Seleccioná una editorial.'; }

    if (autoresElegidos.length === 0) { errores.autorIds = 'Agregá al menos un autor.'; }

    if (Object.keys(errores).length > 0) {
      return { errores: errores };
    }

    var generoTexto = el.controles.generoId.value;
    return {
      datos: {
        titulo: titulo,
        isbn: isbn,
        precio: precio,
        stock: Number(stockTexto),
        editorial_id: Number(editorial),
        genero_id: generoTexto === '' ? null : Number(generoTexto),
        autores: autoresElegidos.map(function (a, i) {
          return { autor_id: a.autor_id, rol: a.rol, orden: i + 1 };
        })
      }
    };
  }

  // ---------- listado ----------

  function celda(fila, texto) {
    var td = document.createElement('td');
    td.textContent = texto === null || texto === undefined ? '' : String(texto);
    fila.appendChild(td);
    return td;
  }

  function textoAutores(detalle) {
    return (detalle.autores || [])
      .slice()
      .sort(function (a, b) { return a.orden - b.orden; })
      .map(function (a) { return a.autor.nombre + ' (' + a.rol + ')'; })
      .join(', ');
  }

  function crearFila(libro) {
    var fila = document.createElement('tr');
    celda(fila, libro.titulo);
    celda(fila, libro.isbn);
    celda(fila, libro.editorial ? libro.editorial.nombre : '');
    celda(fila, libro.genero ? libro.genero.nombre : 'Sin clasificar');
    celda(fila, libro.stock);

    var tdAutores = celda(fila, '');
    if (libro.autores) { // respuesta de alta: ya trae autores
      tdAutores.textContent = textoAutores(libro);
    } else {             // listado: los autores se piden con GET /libros/{id}
      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'boton boton--secundario boton--pequeno';
      boton.textContent = 'Ver autores';
      boton.addEventListener('click', function () {
        boton.disabled = true;
        tdAutores.textContent = 'Cargando…';
        TUCO.api.libros.obtener(libro.id).then(function (detalle) {
          tdAutores.textContent = textoAutores(detalle) || 'Sin autores registrados.';
        }).catch(function (e) {
          tdAutores.textContent = '';
          tdAutores.appendChild(boton);
          boton.disabled = false;
          mostrarResumen(e.message);
        });
      });
      tdAutores.textContent = '';
      tdAutores.appendChild(boton);
    }

    celda(fila, TUCO.formato.formatearMoneda(libro.precio));
    return fila;
  }

  function actualizarVacio() {
    el.listadoVacio.hidden = filasMostradas > 0;
  }

  function cargarListado() {
    el.listadoCargando.hidden = false;
    el.listadoError.hidden = true;
    el.listadoVacio.hidden = true;

    TUCO.api.libros.listar({ limit: LIMITE_LISTADO, offset: 0 }).then(function (libros) {
      el.listadoCargando.hidden = true;
      el.cuerpo.replaceChildren.apply(el.cuerpo, libros.map(crearFila));
      filasMostradas = libros.length;
      actualizarVacio();
    }).catch(function (e) {
      el.listadoCargando.hidden = true;
      el.listadoError.textContent = e.message;
      el.listadoError.hidden = false;
    });
  }

  // ---------- envío ----------

  function enviar(evento) {
    evento.preventDefault();
    limpiarMensajes();

    var resultado = validar();
    if (resultado.errores) {
      CAMPOS.forEach(function (c) {
        if (resultado.errores[c]) { mostrarError(c, resultado.errores[c]); }
      });
      var primero = CAMPOS.filter(function (c) { return resultado.errores[c]; })[0];
      mostrarResumen('Revisá los campos marcados.');
      if (el.controles[primero]) { el.controles[primero].focus(); }
      return;
    }

    el.boton.disabled = true;
    TUCO.api.libros.crear(resultado.datos).then(function (creado) {
      // Se usa el registro devuelto (201) para actualizar la tabla.
      if (filasMostradas < LIMITE_LISTADO) {
        el.cuerpo.appendChild(crearFila(creado));
        filasMostradas += 1;
        actualizarVacio();
      }
      el.formulario.reset();
      autoresElegidos = [];
      dibujarAutores();
      el.exito.textContent = 'Libro registrado correctamente (ID ' + creado.id + ').';
      el.exito.classList.add('mensaje--exito');
      el.exito.hidden = false;
      el.controles.titulo.focus();
    }).catch(function (e) {
      // 409 (ISBN duplicado, referencia inválida) o 422: mensaje del servidor.
      mostrarResumen(e.message);
    }).then(function () {
      el.boton.disabled = false;
    });
  }

  function inicializar() {
    var formulario = $('form-libro');
    if (!formulario) { return; }

    el = {
      formulario: formulario,
      boton: $('boton-libro'),
      resumen: $('resumen-errores-libro'),
      exito: $('mensaje-libro'),
      editorial: $('editorialId'),
      genero: $('generoId'),
      autorSelect: $('autor-select'),
      autorRol: $('autor-rol'),
      autoresLista: $('autores-elegidos'),
      autoresVacio: $('autores-vacio'),
      cuerpo: document.querySelector('#tabla-libros tbody'),
      listadoCargando: $('mensaje-libros-cargando'),
      listadoError: $('mensaje-libros-error'),
      listadoVacio: $('mensaje-libros-vacio'),
      controles: {
        titulo: $('titulo'), isbn: $('isbn'), precio: $('precio'), stock: $('stock'),
        editorialId: $('editorialId'), generoId: $('generoId'), autorIds: $('autor-select')
      },
      errores: {
        titulo: $('error-titulo'), isbn: $('error-isbn'), precio: $('error-precio'),
        stock: $('error-stock'), editorialId: $('error-editorialId'), autorIds: $('error-autorIds')
      }
    };

    $('autor-agregar').addEventListener('click', agregarAutor);
    formulario.addEventListener('submit', enviar);
    dibujarAutores();
    cargarOpciones();
    cargarListado();
  }

  TUCO.libros = { inicializar: inicializar };

  if (typeof document !== 'undefined') {
    TUCO.libros.inicializar();
  }
})(window);
