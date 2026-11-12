(function (global) {
  'use strict';

  var TUCO = global.TUCO = global.TUCO || {};

  var LIMITE_LISTADO = 20;
  var CAMPOS = ['nombre', 'email'];
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var el = null;
  var filasMostradas = 0;

  function $(id) { return document.getElementById(id); }

  function mostrarError(campo, texto) {
    el.errores[campo].textContent = texto;
    el.errores[campo].hidden = texto === '';
    if (texto === '') { el.controles[campo].removeAttribute('aria-invalid'); }
    else { el.controles[campo].setAttribute('aria-invalid', 'true'); }
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

  function crearFila(cliente) {
    var fila = document.createElement('tr');
    [cliente.id, cliente.nombre, cliente.email].forEach(function (valor) {
      var td = document.createElement('td');
      td.textContent = valor;
      fila.appendChild(td);
    });
    return fila;
  }

  function cargarListado() {
    el.listadoCargando.hidden = false;
    el.listadoError.hidden = true;
    el.listadoVacio.hidden = true;

    TUCO.api.clientes.listar({ limit: LIMITE_LISTADO, offset: 0 }).then(function (clientes) {
      el.listadoCargando.hidden = true;
      el.cuerpo.replaceChildren.apply(el.cuerpo, clientes.map(crearFila));
      filasMostradas = clientes.length;
      el.listadoVacio.hidden = filasMostradas > 0;
    }).catch(function (e) {
      el.listadoCargando.hidden = true;
      el.listadoError.textContent = e.message;
      el.listadoError.hidden = false;
    });
  }

  function enviar(evento) {
    evento.preventDefault();
    limpiarMensajes();

    var nombre = el.controles.nombre.value.trim();
    var email = el.controles.email.value.trim();
    var errores = {};

    if (nombre === '') { errores.nombre = 'Ingresá el nombre.'; }
    else if (nombre.length > 120) { errores.nombre = 'El nombre admite hasta 120 caracteres.'; }

    if (email === '') { errores.email = 'Ingresá el email.'; }
    else if (!EMAIL.test(email)) { errores.email = 'Ingresá un email válido.'; }
    else if (email.length > 254) { errores.email = 'El email admite hasta 254 caracteres.'; }

    var invalidos = CAMPOS.filter(function (c) { return errores[c]; });
    if (invalidos.length > 0) {
      invalidos.forEach(function (c) { mostrarError(c, errores[c]); });
      mostrarResumen('Revisá los campos marcados.');
      el.controles[invalidos[0]].focus();
      return;
    }

    el.boton.disabled = true;
    TUCO.api.clientes.crear({ nombre: nombre, email: email }).then(function (creado) {
      if (filasMostradas < LIMITE_LISTADO) {
        el.cuerpo.appendChild(crearFila(creado));
        filasMostradas += 1;
        el.listadoVacio.hidden = true;
      }
      el.formulario.reset();
      el.exito.textContent = 'Cliente registrado correctamente (ID ' + creado.id + ').';
      el.exito.classList.add('mensaje--exito');
      el.exito.hidden = false;
      el.controles.nombre.focus();
    }).catch(function (e) {
      mostrarResumen(e.message); // 409 (email repetido) o 422: mensaje del servidor
    }).then(function () {
      el.boton.disabled = false;
    });
  }

  // Búsqueda por ID: GET /clientes/{id}
  function buscarPorId(evento) {
    evento.preventDefault();
    var salida = el.resultado;
    var texto = el.buscarId.value.trim();

    salida.className = 'mensaje';
    salida.hidden = false;

    if (!/^[1-9]\d*$/.test(texto)) {
      salida.classList.add('mensaje--error');
      salida.textContent = 'Ingresá un ID entero positivo.';
      return;
    }

    el.botonBuscar.disabled = true;
    salida.classList.add('mensaje--info');
    salida.textContent = 'Buscando…';

    TUCO.api.clientes.obtener(texto).then(function (c) {
      salida.className = 'mensaje mensaje--exito';
      salida.textContent = 'Cliente ' + c.id + ': ' + c.nombre + ' (' + c.email + ')';
    }).catch(function (e) {
      salida.className = 'mensaje mensaje--error';
      salida.textContent = e.status === 404 ? 'No existe un cliente con ese ID.' : e.message;
    }).then(function () {
      el.botonBuscar.disabled = false;
    });
  }

  function inicializar() {
    var formulario = $('form-cliente');
    if (!formulario) { return; }

    el = {
      formulario: formulario,
      boton: $('boton-cliente'),
      resumen: $('resumen-errores-cliente'),
      exito: $('mensaje-cliente'),
      cuerpo: document.querySelector('#tabla-clientes tbody'),
      listadoCargando: $('mensaje-clientes-cargando'),
      listadoError: $('mensaje-clientes-error'),
      listadoVacio: $('mensaje-clientes-vacio'),
      buscarId: $('buscar-id'),
      botonBuscar: $('boton-buscar-cliente'),
      resultado: $('resultado-busqueda'),
      controles: { nombre: $('nombre'), email: $('email') },
      errores: { nombre: $('error-nombre'), email: $('error-email') }
    };

    formulario.addEventListener('submit', enviar);
    $('form-buscar-cliente').addEventListener('submit', buscarPorId);
    cargarListado();
  }

  TUCO.clientes = { inicializar: inicializar };

  if (typeof document !== 'undefined') {
    TUCO.clientes.inicializar();
  }
})(window);
