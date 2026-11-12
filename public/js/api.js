(function (global) {
  'use strict';

  var TUCO = global.TUCO = global.TUCO || {};

  // Prefijo público: Nginx lo reenvía al backend quitando "/api".
  var BASE_URL = '/api';

  // Error con la información necesaria para que la interfaz distinga casos.
  //  tipo: 'conexion' (no hubo respuesta) | 'http' (respuesta con status de error)
  function ApiError(tipo, status, mensaje, detalle) {
    this.name = 'ApiError';
    this.tipo = tipo;
    this.status = status;
    this.message = mensaje;
    this.detalle = detalle;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  // FastAPI devuelve {detail: "texto"} (409, 404) o {detail: [{loc, msg}, ...]} (422).
  function mensajeDeDetalle(detail, status) {
    if (typeof detail === 'string' && detail) {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map(function (e) {
        var campo = Array.isArray(e.loc) ? e.loc.filter(function (p) {
          return p !== 'body' && p !== 'query';
        }).join('.') : '';
        return (campo ? campo + ': ' : '') + (e.msg || 'valor inválido');
      }).join('; ');
    }
    return 'El servidor respondió con error ' + status + '.';
  }

  function armarQuery(params) {
    if (!params) {
      return '';
    }
    var partes = [];
    Object.keys(params).forEach(function (clave) {
      var valor = params[clave];
      if (valor === undefined || valor === null || valor === '') {
        return;
      }
      partes.push(encodeURIComponent(clave) + '=' + encodeURIComponent(valor));
    });
    return partes.length ? '?' + partes.join('&') : '';
  }

  // ruta: exactamente la del backend, con su barra final si la tiene ("/libros/").
  function pedir(metodo, ruta, opciones) {
    opciones = opciones || {};
    var init = { method: metodo, headers: { 'Accept': 'application/json' } };
    if (opciones.cuerpo !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opciones.cuerpo);
    }

    return fetch(BASE_URL + ruta + armarQuery(opciones.params), init).then(
      function (respuesta) {
        return respuesta.text().then(function (texto) {
          var datos = null;
          if (texto) {
            try { datos = JSON.parse(texto); } catch (e) { datos = null; }
          }
          if (!respuesta.ok) {
            var detail = datos && datos.detail;
            throw new ApiError('http', respuesta.status,
              mensajeDeDetalle(detail, respuesta.status), detail);
          }
          return datos;
        });
      },
      function () {
        throw new ApiError('conexion', 0,
          'No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.');
      }
    );
  }

  TUCO.api = {
    BASE_URL: BASE_URL,
    ApiError: ApiError,
    get: function (ruta, params) { return pedir('GET', ruta, { params: params }); },
    post: function (ruta, cuerpo) { return pedir('POST', ruta, { cuerpo: cuerpo }); },
    patch: function (ruta, cuerpo) { return pedir('PATCH', ruta, { cuerpo: cuerpo }); },

    // Atajos por recurso (rutas con barra final tal como las expone FastAPI).
    libros: {
      listar: function (p) { return pedir('GET', '/libros/', { params: { titulo: p && p.titulo, limit: p && p.limit, offset: p && p.offset } }); },
      obtener: function (id) { return pedir('GET', '/libros/' + id); },
      crear: function (datos) { return pedir('POST', '/libros/', { cuerpo: datos }); }
    },
    editoriales: {
      listar: function (p) { return pedir('GET', '/editoriales/', { params: p }); }
    },
    generos: {
      listar: function (p) { return pedir('GET', '/generos/', { params: p }); }
    },
    autores: {
      listar: function (p) { return pedir('GET', '/autores/', { params: p }); },
      obtener: function (id) { return pedir('GET', '/autores/' + id); }
    },
    clientes: {
      listar: function (p) { return pedir('GET', '/clientes/', { params: p }); },
      crear: function (datos) { return pedir('POST', '/clientes/', { cuerpo: datos }); },
      obtener: function (id) { return pedir('GET', '/clientes/' + id); }
    },
    ventas: {
      listar: function (p) { return pedir('GET', '/ventas/', { params: { limit: p && p.limit, offset: p && p.offset } }); },
      obtener: function (id) { return pedir('GET', '/ventas/' + id); },
      crear: function (datos) { return pedir('POST', '/ventas/', { cuerpo: datos }); }
    },
    salud: function () { return pedir('GET', '/health/ready'); }
  };
})(window);
