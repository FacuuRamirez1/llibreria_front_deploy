(function (global) {
  'use strict';

  var TUCO = global.TUCO = global.TUCO || {};

  var LIMITE = 20;
  var el = null;
  var offset = 0;
  var numeroPeticion = 0;

  function $(id) { return document.getElementById(id); }

  function mostrarVista(vista, texto) {
    el.cargando.hidden = vista !== 'cargando';
    el.vacio.hidden = vista !== 'vacio';
    el.error.hidden = vista !== 'error';
    if (vista === 'error') { el.textoError.textContent = texto; }
    if (vista !== 'lista') { el.cuerpo.replaceChildren(); }
  }

  function crearFila(venta) {
    var tr = document.createElement('tr');
    [venta.id, TUCO.formato.formatearFecha(venta.fecha), venta.cliente.nombre,
      TUCO.formato.formatearMoneda(venta.total)].forEach(function (valor) {
      var td = document.createElement('td');
      td.textContent = valor;
      tr.appendChild(td);
    });

    var td = document.createElement('td');
    var enlace = document.createElement('a');
    enlace.href = 'venta-detalle.html?id=' + encodeURIComponent(venta.id);
    enlace.textContent = 'Ver detalle';
    var oculto = document.createElement('span');
    oculto.className = 'visualmente-oculto';
    oculto.textContent = ' de la venta ' + venta.id;
    enlace.appendChild(oculto);
    td.appendChild(enlace);
    tr.appendChild(td);
    return tr;
  }

  function actualizarPaginacion(cantidad) {
    var hayAnterior = offset > 0;
    var haySiguiente = cantidad === LIMITE; // la API no informa el total
    el.paginacion.hidden = !hayAnterior && !haySiguiente;
    el.anterior.disabled = !hayAnterior;
    el.siguiente.disabled = !haySiguiente;
    el.indicador.textContent = 'Página ' + (Math.floor(offset / LIMITE) + 1);
  }

  function cargar() {
    var propia = ++numeroPeticion;
    mostrarVista('cargando');
    el.paginacion.hidden = true;

    TUCO.api.ventas.listar({ limit: LIMITE, offset: offset }).then(function (ventas) {
      if (propia !== numeroPeticion) { return; }

      if (ventas.length === 0 && offset > 0) {
        offset = Math.max(0, offset - LIMITE);
        cargar();
        return;
      }
      if (ventas.length === 0) {
        mostrarVista('vacio');
        actualizarPaginacion(0);
        return;
      }

      mostrarVista('lista');
      el.cuerpo.replaceChildren.apply(el.cuerpo, ventas.map(crearFila));
      actualizarPaginacion(ventas.length);
    }).catch(function (e) {
      if (propia !== numeroPeticion) { return; }
      mostrarVista('error', e.message);
    });
  }

  function inicializar() {
    var cuerpo = document.querySelector('#tabla-ventas tbody');
    if (!cuerpo) { return; }

    el = {
      cuerpo: cuerpo,
      cargando: $('mensaje-historial-cargando'),
      vacio: $('mensaje-historial-vacio'),
      error: $('mensaje-historial-error'),
      textoError: $('texto-historial-error'),
      paginacion: $('paginacion-historial'),
      anterior: $('pagina-anterior'),
      siguiente: $('pagina-siguiente'),
      indicador: $('pagina-indicador')
    };

    $('boton-reintentar').addEventListener('click', cargar);
    el.anterior.addEventListener('click', function () {
      offset = Math.max(0, offset - LIMITE);
      cargar();
    });
    el.siguiente.addEventListener('click', function () {
      offset += LIMITE;
      cargar();
    });

    cargar();
  }

  TUCO.historial = { inicializar: inicializar };

  if (typeof document !== 'undefined') {
    TUCO.historial.inicializar();
  }
})(window);
