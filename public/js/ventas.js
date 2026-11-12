(function (global) {
  'use strict';

  var TUCO = global.TUCO = global.TUCO || {};

  var LIMITE_OPCIONES = 100; // máximo que admite la API
  var ESPERA_BUSQUEDA_MS = 300;
  var ENTERO_POSITIVO = /^[1-9]\d*$/;

  var el = null;
  var catalogo = {};   // id -> libro (resultado de la búsqueda actual)
  var renglones = [];  // borrador en memoria: [{libro_id, titulo, precio, cantidad}]
  var temporizador = null;
  var numeroBusqueda = 0;
  var enviando = false;

  function $(id) { return document.getElementById(id); }

  // ---------- mensajes ----------

  function mostrarError(campo, texto) {
    var caja = el.errores[campo];
    caja.textContent = texto;
    caja.hidden = texto === '';
    if (texto === '') { el.controles[campo].removeAttribute('aria-invalid'); }
    else { el.controles[campo].setAttribute('aria-invalid', 'true'); }
  }

  function mostrarResumen(texto) {
    el.resumen.textContent = texto;
    el.resumen.hidden = texto === '';
  }

  function limpiarErrores() {
    ['clienteId', 'libroId', 'cantidad'].forEach(function (c) { mostrarError(c, ''); });
    mostrarResumen('');
  }

  // ---------- opciones ----------

  function opcion(valor, texto, deshabilitada, seleccionada) {
    var o = document.createElement('option');
    o.value = valor;
    o.textContent = texto;
    o.disabled = Boolean(deshabilitada);
    o.selected = Boolean(seleccionada);
    return o;
  }

  function cargarClientes() {
    TUCO.api.clientes.listar({ limit: LIMITE_OPCIONES }).then(function (lista) {
      var f = document.createDocumentFragment();
      f.appendChild(opcion('', lista.length ? 'Seleccioná un cliente' : 'No hay clientes registrados', true, true));
      lista.forEach(function (c) {
        f.appendChild(opcion(c.id, c.nombre + ' (' + c.email + ')'));
      });
      el.cliente.replaceChildren(f);
    }).catch(function (e) {
      el.cliente.replaceChildren(opcion('', 'No se pudieron cargar los clientes', true, true));
      mostrarResumen('Clientes: ' + e.message);
    });
  }

  function cargarLibros(titulo) {
    var propia = ++numeroBusqueda;
    TUCO.api.libros.listar({ titulo: titulo, limit: LIMITE_OPCIONES, offset: 0 }).then(function (lista) {
      if (propia !== numeroBusqueda) { return; }
      catalogo = {};
      var f = document.createDocumentFragment();
      f.appendChild(opcion('', lista.length ? 'Seleccioná un libro' : 'No hay libros para ese título', true, true));
      lista.forEach(function (l) {
        catalogo[l.id] = l;
        f.appendChild(opcion(l.id, l.titulo + ' — ' + TUCO.formato.formatearMoneda(l.precio)));
      });
      el.libro.replaceChildren(f);
    }).catch(function (e) {
      if (propia !== numeroBusqueda) { return; }
      el.libro.replaceChildren(opcion('', 'No se pudieron cargar los libros', true, true));
      mostrarResumen('Libros: ' + e.message);
    });
  }

  // ---------- borrador ----------

  function totalEstimado() {
    return renglones.reduce(function (suma, r) { return suma + r.precio * r.cantidad; }, 0);
  }

  function dibujarBorrador() {
    var filas = renglones.map(function (r, indice) {
      var tr = document.createElement('tr');

      var tdLibro = document.createElement('td');
      tdLibro.textContent = r.titulo;
      tr.appendChild(tdLibro);

      var tdCantidad = document.createElement('td');
      var input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.step = '1';
      input.className = 'cantidad-renglon';
      input.value = r.cantidad;
      input.setAttribute('aria-label', 'Cantidad de ' + r.titulo);
      input.addEventListener('change', function () {
        var texto = input.value.trim();
        if (ENTERO_POSITIVO.test(texto)) {
          r.cantidad = Number(texto);
          mostrarResumen('');
        } else {
          input.value = r.cantidad; // vuelve al último valor válido
          mostrarResumen('La cantidad debe ser un entero positivo.');
        }
      });
      tdCantidad.appendChild(input);
      tr.appendChild(tdCantidad);

      var tdPrecio = document.createElement('td');
      tdPrecio.textContent = TUCO.formato.formatearMoneda(r.precio);
      tr.appendChild(tdPrecio);

      var tdAcciones = document.createElement('td');
      var quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'boton boton--peligro boton--pequeno';
      quitar.textContent = 'Quitar renglón';
      quitar.setAttribute('aria-label', 'Quitar ' + r.titulo);
      quitar.addEventListener('click', function () {
        renglones.splice(indice, 1);
        dibujarBorrador();
      });
      tdAcciones.appendChild(quitar);
      tr.appendChild(tdAcciones);

      return tr;
    });

    el.cuerpo.replaceChildren.apply(el.cuerpo, filas);
    el.mensaje.textContent = renglones.length === 0
      ? 'Todavía no se agregaron renglones a la venta.'
      : 'Renglones en el borrador: ' + renglones.length +
        '. Los importes definitivos los calcula el servidor al confirmar.';
  }

  function agregarRenglon(evento) {
    evento.preventDefault();
    limpiarErrores();

    var libroId = el.libro.value;
    var cantidadTexto = el.cantidad.value.trim();
    var hayError = false;

    if (libroId === '' || !catalogo[libroId]) {
      mostrarError('libroId', 'Seleccioná un libro del catálogo.');
      hayError = true;
    } else if (renglones.some(function (r) { return String(r.libro_id) === libroId; })) {
      mostrarError('libroId', 'Ese libro ya está en la venta. Cambiá su cantidad en la tabla.');
      hayError = true;
    }

    if (!ENTERO_POSITIVO.test(cantidadTexto)) {
      mostrarError('cantidad', 'La cantidad debe ser un entero positivo.');
      hayError = true;
    }

    if (hayError) { return; }

    var libro = catalogo[libroId];
    renglones.push({
      libro_id: libro.id,
      titulo: libro.titulo,
      precio: Number(libro.precio),
      cantidad: Number(cantidadTexto)
    });
    el.libro.value = '';
    el.cantidad.value = '1';
    dibujarBorrador();
  }

  // ---------- confirmación ----------

  function mostrarConfirmada(venta) {
    var filas = venta.renglones.map(function (r) {
      var tr = document.createElement('tr');
      [r.titulo, r.cantidad, TUCO.formato.formatearMoneda(r.precio_unitario),
        TUCO.formato.formatearMoneda(r.subtotal)].forEach(function (valor) {
        var td = document.createElement('td');
        td.textContent = valor;
        tr.appendChild(td);
      });
      return tr;
    });
    el.cuerpoConfirmada.replaceChildren.apply(el.cuerpoConfirmada, filas);
    el.textoConfirmada.textContent = 'Venta N.º ' + venta.id + ' registrada para ' +
      venta.cliente.nombre + '.';
    el.totalConfirmada.textContent = TUCO.formato.formatearMoneda(venta.total);
    el.enlaceConfirmada.href = 'venta-detalle.html?id=' + encodeURIComponent(venta.id);
    el.seccionConfirmada.hidden = false;
  }

  function confirmar() {
    if (enviando) { return; }
    limpiarErrores();

    var clienteId = el.cliente.value;
    var hayError = false;

    if (clienteId === '') {
      mostrarError('clienteId', 'Seleccioná un cliente.');
      hayError = true;
    }
    if (renglones.length === 0) {
      mostrarResumen('Agregá al menos un renglón antes de confirmar.');
      hayError = true;
    }
    var invalido = renglones.some(function (r) {
      return !Number.isInteger(r.cantidad) || r.cantidad <= 0;
    });
    if (invalido) {
      mostrarResumen('Todas las cantidades deben ser enteros positivos.');
      hayError = true;
    }
    if (hayError) { return; }

    // Cuerpo exacto que pide la consigna: sólo cliente_id y libro_id/cantidad.
    var cuerpo = {
      cliente_id: Number(clienteId),
      renglones: renglones.map(function (r) {
        return { libro_id: r.libro_id, cantidad: r.cantidad };
      })
    };

    enviando = true;
    el.confirmar.disabled = true;
    el.seccionConfirmada.hidden = true;

    TUCO.api.ventas.crear(cuerpo).then(function (venta) {
      mostrarConfirmada(venta);
      renglones = [];            // limpiar el borrador sólo si se aceptó
      dibujarBorrador();
      el.cliente.value = '';
      el.cantidad.value = '1';
      el.seccionConfirmada.scrollIntoView && el.seccionConfirmada.scrollIntoView();
    }).catch(function (e) {
      // 409 (cliente o libro inexistente), 422 (cuerpo inválido) o conexión:
      // se muestra el mensaje y se conserva el borrador.
      mostrarResumen(e.message);
    }).then(function () {
      enviando = false;
      el.confirmar.disabled = false;
    });
  }

  function inicializar() {
    var formulario = $('form-venta');
    if (!formulario) { return; }

    el = {
      formulario: formulario,
      resumen: $('resumen-errores-venta'),
      cliente: $('clienteId'),
      libro: $('libroId'),
      buscador: $('buscar-libro'),
      cantidad: $('cantidad'),
      cuerpo: document.querySelector('#tabla-renglones tbody'),
      mensaje: $('mensaje-venta'),
      confirmar: $('boton-confirmar'),
      seccionConfirmada: $('seccion-confirmada'),
      textoConfirmada: $('texto-confirmada'),
      cuerpoConfirmada: document.querySelector('#tabla-confirmada tbody'),
      totalConfirmada: $('total-confirmada'),
      enlaceConfirmada: $('enlace-confirmada'),
      controles: { clienteId: $('clienteId'), libroId: $('libroId'), cantidad: $('cantidad') },
      errores: {
        clienteId: $('error-clienteId'),
        libroId: $('error-libroId'),
        cantidad: $('error-cantidad')
      }
    };

    formulario.addEventListener('submit', agregarRenglon);
    el.confirmar.addEventListener('click', confirmar);
    el.buscador.addEventListener('input', function () {
      clearTimeout(temporizador);
      temporizador = setTimeout(function () { cargarLibros(el.buscador.value); }, ESPERA_BUSQUEDA_MS);
    });

    dibujarBorrador();
    cargarClientes();
    cargarLibros('');
  }

  TUCO.ventas = { inicializar: inicializar };

  if (typeof document !== 'undefined') {
    TUCO.ventas.inicializar();
  }
})(window);
