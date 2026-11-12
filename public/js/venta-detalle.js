(function (global) {
  'use strict';

  var TUCO = global.TUCO = global.TUCO || {};

  var el = null;

  function $(id) { return document.getElementById(id); }

  function obtenerId() {
    try {
      return String(new URLSearchParams(global.location.search).get('id') || '').trim();
    } catch (error) {
      return '';
    }
  }

  function mostrarError(texto, reintentable) {
    el.cargando.hidden = true;
    el.detalle.replaceChildren();
    el.textoError.textContent = texto;
    el.reintentar.hidden = !reintentable;
    el.error.hidden = false;
  }

  function par(dl, termino, valor) {
    var dt = document.createElement('dt');
    var dd = document.createElement('dd');
    dt.textContent = termino;
    dd.textContent = valor;
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function crearResumen(venta) {
    var dl = document.createElement('dl');
    par(dl, 'Identificador', venta.id);
    par(dl, 'Fecha', TUCO.formato.formatearFecha(venta.fecha));
    par(dl, 'Cliente', venta.cliente.nombre + ' (' + venta.cliente.email + ')');
    par(dl, 'Total', TUCO.formato.formatearMoneda(venta.total));
    return dl;
  }

  function crearTablaRenglones(venta) {
    var contenedor = document.createElement('div');
    contenedor.className = 'tabla-contenedor';
    contenedor.setAttribute('role', 'region');
    contenedor.setAttribute('tabindex', '0');
    contenedor.setAttribute('aria-label', 'Renglones de la venta ' + venta.id + ', tabla desplazable');

    var tabla = document.createElement('table');
    tabla.className = 'tabla tabla--ancha';

    var caption = document.createElement('caption');
    caption.textContent = 'Renglones de la venta ' + venta.id;
    tabla.appendChild(caption);

    var thead = document.createElement('thead');
    var encabezado = document.createElement('tr');
    ['Libro', 'Cantidad', 'Precio unitario', 'Subtotal'].forEach(function (texto) {
      var th = document.createElement('th');
      th.setAttribute('scope', 'col');
      th.textContent = texto;
      encabezado.appendChild(th);
    });
    thead.appendChild(encabezado);
    tabla.appendChild(thead);

    var tbody = document.createElement('tbody');
    venta.renglones.forEach(function (r) {
      var tr = document.createElement('tr');
      [r.titulo, r.cantidad, TUCO.formato.formatearMoneda(r.precio_unitario),
        TUCO.formato.formatearMoneda(r.subtotal)].forEach(function (valor) {
        var td = document.createElement('td');
        td.textContent = valor;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);

    contenedor.appendChild(tabla);
    return contenedor;
  }

  function cargar() {
    var id = obtenerId();
    if (!/^[1-9]\d*$/.test(id)) {
      mostrarError('El identificador de la venta no es válido.', false);
      return;
    }

    el.cargando.hidden = false;
    el.error.hidden = true;

    TUCO.api.ventas.obtener(id).then(function (venta) {
      el.cargando.hidden = true;
      var f = document.createDocumentFragment();
      f.appendChild(crearResumen(venta));
      f.appendChild(crearTablaRenglones(venta));
      el.detalle.replaceChildren(f);
    }).catch(function (e) {
      if (e.status === 404) {
        mostrarError('La venta solicitada no existe.', false);
      } else {
        mostrarError(e.message, true);
      }
    });
  }

  function inicializar() {
    var detalle = $('detalle-venta');
    if (!detalle) { return; }

    el = {
      detalle: detalle,
      cargando: $('mensaje-detalle-cargando'),
      error: $('mensaje-detalle'),
      textoError: $('texto-detalle-error'),
      reintentar: $('boton-reintentar')
    };

    el.reintentar.addEventListener('click', cargar);
    cargar();
  }

  TUCO.ventaDetalle = { inicializar: inicializar };

  if (typeof document !== 'undefined') {
    TUCO.ventaDetalle.inicializar();
  }
})(window);
