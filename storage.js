!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.storage=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],2:[function(_dereq_,module,exports){
/*!
 * Module dependencies.
 */

var Schema = _dereq_('./schema')
  , Document = _dereq_('./document');

//TODO: написать метод .upsert( doc ) - обновление документа, а если его нет, то создание

//TODO: доделать логику с apiResource (сохранять ссылку на него и использовть при методе doc.save)
/**
 * Конструктор коллекций.
 *
 * @example
 *
 * @param {string} name - название коллекции
 * @param {Schema} schema - Схема или объект описания схемы
 * @param {Object} [api] - ссылка на api ресурс
 * @constructor
 */
function Collection ( name, schema, api ){
  // Сохраним название пространства имён
  this.name = name;
  // Хранилище для документов
  this.documents = {};

  if ( _.isObject( schema ) && !( schema instanceof Schema ) ) {
    schema = new Schema( schema );
  }

  // Сохраним ссылку на api для метода .save()
  this.api = api;

  // Используемая схема для коллекции
  this.schema = schema;

  // Отображение объекта documents в виде массива (для нокаута)
  this.array = [];
  ko.track( this, ['array'] );
}

Collection.prototype = {
  /**
   * Добавить документ или массив документов.
   *
   * @example
   * storage.collection.add({ type: 'jelly bean' });
   * storage.collection.add([{ type: 'jelly bean' }, { type: 'snickers' }]);
   * storage.collection.add({ _id: '*****', type: 'jelly bean' }, true);
   *
   * @param {object|Array.<object>} [doc] - Документ
   * @param {object} [fields] - выбранные поля при запросе (не реализовано в документе)
   * @param {boolean} [init] - hydrate document - наполнить документ данными (используется в api-client)
   * @param {boolean} [_storageWillMutate] - Флаг добавления массива документов. только для внутреннего использования
   * @returns {storage.Document|Array.<storage.Document>}
   */
  add: function( doc, fields, init, _storageWillMutate ){
    var self = this;

    // Если документа нет, значит будет пустой
    if ( doc == null ) doc = null;

    // Массив документов
    if ( _.isArray( doc ) ){
      var savedDocs = [];

      _.each( doc, function( doc ){
        savedDocs.push( self.add( doc, fields, init, true ) );
      });

      this.storageHasMutated();

      return savedDocs;
    }

    var id = doc && doc._id;

    // Если документ уже есть, то просто установить значения
    if ( id && this.documents[ id ] ){
      this.documents[ id ].set( doc );

    } else {
      var discriminatorMapping = this.schema
        ? this.schema.discriminatorMapping
        : null;

      var key = discriminatorMapping && discriminatorMapping.isRoot
        ? discriminatorMapping.key
        : null;

      // Выбираем схему, если есть дискриминатор
      var schema;
      if (key && doc && doc[key] && this.schema.discriminators && this.schema.discriminators[doc[key]]) {
        schema = this.schema.discriminators[doc[key]];

      } else {
        schema = this.schema;
      }

      var newDoc = new Document( doc, this.name, schema, fields, init );
      id = newDoc._id.toString();
    }

    // Для одиночных документов тоже нужно  вызвать storageHasMutated
    if ( !_storageWillMutate ){
      this.storageHasMutated();
    }

    return this.documents[ id ];
  },

  /**
   * Удаленить документ.
   *
   * @example
   * storage.collection.remove( Document );
   * storage.collection.remove( uuid );
   *
   * @param {object|number} document - Сам документ или его id.
   * @returns {boolean}
   */
  remove: function( document ){
    return delete this.documents[ document._id || document ];
  },

  /**
   * Найти документы.
   *
   * @example
   * // named john
   * storage.collection.find({ name: 'john' });
   * storage.collection.find({ author: 'Shakespeare', year: 1611 });
   *
   * @param conditions
   * @returns {Array.<storage.Document>}
   */
  find: function( conditions ){
    return _.where( this.documents, conditions );
  },

  /**
   * Найти один документ по id.
   *
   * @example
   * storage.collection.findById( id );
   *
   * @param _id
   * @returns {storage.Document|undefined}
   */
  findById: function( _id ){
    return this.documents[ _id ];
  },

  /**
   * Найти по id документ и удалить его.
   *
   * @example
   * storage.collection.findByIdAndRemove( id ) // returns сollection
   *
   * @see Collection.findById
   * @see Collection.remove
   *
   * @param _id
   * @returns {Collection}
   */
  findByIdAndRemove: function( _id ){
    this.remove( this.findById( _id ) );
    return this;
  },

  /**
   * Найти по id документ и обновить его.
   *
   * @see Collection.findById
   * @see Collection.update
   *
   * @param _id
   * @param {string|object} path
   * @param {object|boolean|number|string|null|undefined} value
   * @returns {storage.Document|undefined}
   */
  findByIdAndUpdate: function( _id, path, value ){
    return this.update( this.findById( _id ), path, value );
  },

  /**
   * Найти один документ.
   *
   * @example
   * // find one iphone adventures
   * storage.adventure.findOne({ type: 'iphone' });
   *
   * @param conditions
   * @returns {storage.Document|undefined}
   */
  findOne: function( conditions ){
    return _.findWhere( this.documents, conditions );
  },

  /**
   * Найти по условию один документ и удалить его.
   *
   * @example
   * storage.collection.findOneAndRemove( conditions ) // returns сollection
   *
   * @see Collection.findOne
   * @see Collection.remove
   *
   * @param {object} conditions
   * @returns {Collection}
   */
  findOneAndRemove: function( conditions ){
    this.remove( this.findOne( conditions ) );
    return this;
  },

  /**
   * Найти документ по условию и обновить его.
   *
   * @see Collection.findOne
   * @see Collection.update
   *
   * @param {object} conditions
   * @param {string|object} path
   * @param {object|boolean|number|string|null|undefined} value
   * @returns {storage.Document|undefined}
   */
  findOneAndUpdate: function( conditions, path, value ){
    return this.update( this.findOne( conditions ), path, value );
  },

  /**
   * Обновить существующие поля в документе.
   *
   * @example
   * storage.places.update( storage.places.findById( 0 ), {
   *   name: 'Irkutsk'
   * });
   *
   * @param {number|object} document
   * @param {string|object} path
   * @param {object|boolean|number|string|null|undefined} value
   * @returns {storage.Document|Boolean}
   */
  update: function( document, path, value ){
    var doc = this.documents[ document._id || document ];

    if ( doc == null ){
      console.warn('storage::update: Document is not found.');
      return false;
    }

    return doc.set( path, value );
  },

  /**
   * Обработчик на изменения (добавление, удаление) данных в коллекции
   */
  storageHasMutated: function(){
    // Обновим массив документов (специальное отображение для перебора нокаутом)
    this.array = _.toArray( this.documents );
  }
};

/*!
 * Module exports.
 */

module.exports = Collection;

},{"./document":3,"./schema":13}],3:[function(_dereq_,module,exports){
/*!
 * Module dependencies.
 */

var Events = _dereq_('./events')
  , StorageError = _dereq_('./error')
  , MixedSchema = _dereq_('./schema/mixed')
  , ObjectId = _dereq_('./types/objectid')
  , Schema = _dereq_('./schema')
  , ValidatorError = _dereq_('./schematype').ValidatorError
  , utils = _dereq_('./utils')
  , clone = utils.clone
  , ValidationError = StorageError.ValidationError
  , InternalCache = _dereq_('./internal')
  , deepEqual = utils.deepEqual
  , DocumentArray
  , SchemaArray
  , Embedded;

/**
 * Конструктор документа.
 *
 * @param {object} data - значения, которые нужно установить
 * @param {string|undefined} [collectionName] - коллекция в которой будет находится документ
 * @param {Schema} schema - схема по которой будет создан документ
 * @param {object} [fields] - выбранные поля в документе (не реализовано)
 * @param {Boolean} [init] - hydrate document - наполнить документ данными (используется в api-client)
 * @constructor
 */
function Document ( data, collectionName, schema, fields, init ){
  this.isNew = true;

  // Создать пустой документ с флагом init
  // new TestDocument(true);
  if ( 'boolean' === typeof data ){
    init = data;
    data = null;
  }

  // Создать документ с флагом init
  // new TestDocument({ test: 'boom' }, true);
  if ( 'boolean' === typeof collectionName ){
    init = collectionName;
    collectionName = undefined;
  }

  // Создать пустой документ по схеме
  if ( data instanceof Schema ){
    schema = data;
    data = null;

    if ( schema.options._id ){
      data = { _id: new ObjectId() };
    }

  } else {
    // При создании EmbeddedDocument, в нём уже есть схема и ему не нужен _id
    schema = this.schema || schema;
    // Сгенерировать ObjectId, если он отсутствует и его требует схема
    if ( !this.schema && schema.options._id ){
      data = data || {};

      if ( !data._id ){
        data._id = new ObjectId();
      }
    }
  }

  if ( !schema ){
    //todo: throw new mongoose.Error.MissingSchemaError(name);
    throw new TypeError('Нельзя создавать документ без схемы');
  }

  this.schema = schema;
  this.collection = window.storage[ collectionName ];
  this.collectionName = collectionName;

  if ( this.collection ){
    if ( data == null || !data._id ){
      throw new TypeError('Для помещения в коллекцию необходимо, чтобы у документа был _id');
    }
    // Поместить документ в коллекцию
    this.collection.documents[ data._id ] = this;
  }

  this.$__ = new InternalCache;
  this.$__.strictMode = schema.options && schema.options.strict;
  this.$__.selected = fields;

  var required = schema.requiredPaths();
  for (var i = 0; i < required.length; ++i) {
    this.$__.activePaths.require( required[i] );
  }

  this.$__setSchema( schema );

  this._doc = this.$__buildDoc( data, init );

  if ( init ){
    this.init( data );
  } else if ( data ) {
    this.set( data, undefined, true );
  }

  // apply methods
  for ( var m in schema.methods ){
    this[ m ] = schema.methods[ m ];
  }
  // apply statics
  for ( var s in schema.statics ){
    this[ s ] = schema.statics[ s ];
  }
}

/*!
 * Inherits from EventEmitter.
 */
Document.prototype.__proto__ = Events.prototype;

/**
 * The documents schema.
 *
 * @api public
 * @property schema
 */
Document.prototype.schema;

/**
 * Boolean flag specifying if the document is new.
 *
 * @api public
 * @property isNew
 */
Document.prototype.isNew;

/**
 * The string version of this documents _id.
 *
 * ####Note:
 *
 * This getter exists on all documents by default. The getter can be disabled by setting the `id` [option](/docs/guide.html#id) of its `Schema` to false at construction time.
 *
 *     new Schema({ name: String }, { id: false });
 *
 * @api public
 * @see Schema options /docs/guide.html#options
 * @property id
 */
Document.prototype.id;

/**
 * Hash containing current validation errors.
 *
 * @api public
 * @property errors
 */
Document.prototype.errors;

/**
 * Builds the default doc structure
 *
 * @param {Object} obj
 * @param {Boolean} [skipId]
 * @return {Object}
 * @api private
 * @method $__buildDoc
 * @memberOf Document
 */
Document.prototype.$__buildDoc = function ( obj, skipId ) {
  var doc = {}
    , self = this;

  var paths = Object.keys( this.schema.paths )
    , plen = paths.length
    , ii = 0;

  for ( ; ii < plen; ++ii ) {
    var p = paths[ii];

    if ( '_id' == p ) {
      if ( skipId ) continue;
      if ( obj && '_id' in obj ) continue;
    }

    var type = this.schema.paths[ p ]
      , path = p.split('.')
      , len = path.length
      , last = len - 1
      , doc_ = doc
      , i = 0;

    for ( ; i < len; ++i ) {
      var piece = path[ i ]
        , defaultVal;

      if ( i === last ) {
        defaultVal = type.getDefault( self, true );

        if ('undefined' !== typeof defaultVal ) {
          doc_[ piece ] = defaultVal;
          self.$__.activePaths.default( p );
        }
      } else {
        doc_ = doc_[ piece ] || ( doc_[ piece ] = {} );
      }
    }
  }

  return doc;
};

/**
 * Initializes the document without setters or marking anything modified.
 *
 * Called internally after a document is returned from server.
 *
 * @param {Object} data document returned by server
 * @api private
 */
Document.prototype.init = function ( data ) {
  this.isNew = false;

  //todo: сдесь всё изменится, смотреть коммент метода this.populated
  // handle docs with populated paths
  /*if ( doc._id && opts && opts.populated && opts.populated.length ) {
    var id = String( doc._id );
    for (var i = 0; i < opts.populated.length; ++i) {
      var item = opts.populated[ i ];
      this.populated( item.path, item._docs[id], item );
    }
  }*/

  init( this, data, this._doc );

  return this;
};

/*!
 * Init helper.
 *
 * @param {Object} self document instance
 * @param {Object} obj raw server doc
 * @param {Object} doc object we are initializing
 * @api private
 */
function init (self, obj, doc, prefix) {
  prefix = prefix || '';

  var keys = Object.keys(obj)
    , len = keys.length
    , schema
    , path
    , i;

  while (len--) {
    i = keys[len];
    path = prefix + i;
    schema = self.schema.path(path);

    if (!schema && _.isPlainObject( obj[ i ] ) &&
        (!obj[i].constructor || 'Object' == obj[i].constructor.name)) {
      // assume nested object
      if (!doc[i]) doc[i] = {};
      init(self, obj[i], doc[i], path + '.');
    } else {
      if (obj[i] === null) {
        doc[i] = null;
      } else if (obj[i] !== undefined) {
        var observable = ko.getObservable( self, path );

        if (schema) {
          self.$__try(function(){
            doc[i] = schema.cast(obj[i], self, true);
          });
        } else {
          doc[i] = obj[i];
        }

        // Установить начальное значение
        observable && observable( doc[i] );
      }
      // mark as hydrated
      self.$__.activePaths.init(path);
    }
  }
}

/**
 * Sets the value of a path, or many paths.
 *
 * ####Example:
 *
 *     // path, value
 *     doc.set(path, value)
 *
 *     // object
 *     doc.set({
 *         path  : value
 *       , path2 : {
 *            path  : value
 *         }
 *     })
 *
 *     // only-the-fly cast to number
 *     doc.set(path, value, Number)
 *
 *     // only-the-fly cast to string
 *     doc.set(path, value, String)
 *
 *     // changing strict mode behavior
 *     doc.set(path, value, { strict: false });
 *
 * @param {String|Object} path path or object of key/vals to set
 * @param {Mixed} val the value to set
 * @param {Schema|String|Number|etc..} [type] optionally specify a type for "on-the-fly" attributes
 * @param {Object} [options] optionally specify options that modify the behavior of the set
 * @api public
 */
Document.prototype.set = function (path, val, type, options) {
  if (type && 'Object' == type.constructor.name) {
    options = type;
    type = undefined;
  }

  var merge = options && options.merge
    , adhoc = type && true !== type
    , constructing = true === type
    , adhocs;

  var strict = options && 'strict' in options
    ? options.strict
    : this.$__.strictMode;

  if (adhoc) {
    adhocs = this.$__.adhocPaths || (this.$__.adhocPaths = {});
    adhocs[path] = Schema.interpretAsType(path, type);
  }

  if ('string' !== typeof path) {
    // new Document({ key: val })

    if (null === path || undefined === path) {
      var _temp = path;
      path = val;
      val = _temp;

    } else {
      var prefix = val
        ? val + '.'
        : '';

      if (path instanceof Document) path = path._doc;

      var keys = Object.keys(path)
        , i = keys.length
        , pathtype
        , key;


      while (i--) {
        key = keys[i];
        pathtype = this.schema.pathType(prefix + key);
        if (null != path[key]
            // need to know if plain object - no Buffer, ObjectId, ref, etc
            && _.isPlainObject(path[key])
            && ( !path[key].constructor || 'Object' == path[key].constructor.name )
            && 'virtual' != pathtype
            && !( this.$__path( prefix + key ) instanceof MixedSchema )
            && !( this.schema.paths[key] && this.schema.paths[key].options.ref )
          ){

          this.set(path[key], prefix + key, constructing);

        } else if (strict) {
          if ('real' === pathtype || 'virtual' === pathtype) {
            this.set(prefix + key, path[key], constructing);

          } else if ('throw' == strict) {
            throw new Error("Field `" + key + "` is not in schema.");
          }

        } else if (undefined !== path[key]) {
          this.set(prefix + key, path[key], constructing);
        }
      }

      return this;
    }
  }

  // ensure _strict is honored for obj props
  // docschema = new Schema({ path: { nest: 'string' }})
  // doc.set('path', obj);
  var pathType = this.schema.pathType(path);
  if ('nested' == pathType && val && _.isPlainObject(val) &&
      (!val.constructor || 'Object' == val.constructor.name)) {
    if (!merge) this.setValue(path, null);
    this.set(val, path, constructing);
    return this;
  }

  var schema;
  var parts = path.split('.');
  var subpath;

  if ('adhocOrUndefined' == pathType && strict) {

    // check for roots that are Mixed types
    var mixed;

    for (var i = 0; i < parts.length; ++i) {
      subpath = parts.slice(0, i+1).join('.');
      schema = this.schema.path(subpath);
      if (schema instanceof MixedSchema) {
        // allow changes to sub paths of mixed types
        mixed = true;
        break;
      }
    }

    if (!mixed) {
      if ('throw' == strict) {
        throw new Error("Field `" + path + "` is not in schema.");
      }
      return this;
    }

  } else if ('virtual' == pathType) {
    schema = this.schema.virtualpath(path);
    schema.applySetters(val, this);
    return this;
  } else {
    schema = this.$__path(path);
  }

  var pathToMark;

  // When using the $set operator the path to the field must already exist.
  // Else mongodb throws: "LEFT_SUBFIELD only supports Object"

  if (parts.length <= 1) {
    pathToMark = path;
  } else {
    for ( i = 0; i < parts.length; ++i ) {
      subpath = parts.slice(0, i + 1).join('.');
      if (this.isDirectModified(subpath) // earlier prefixes that are already
                                         // marked as dirty have precedence
          || this.get(subpath) === null) {
        pathToMark = subpath;
        break;
      }
    }

    if (!pathToMark) pathToMark = path;
  }

  // if this doc is being constructed we should not trigger getters
  var priorVal = constructing
    ? undefined
    : this.getValue(path);

  if (!schema || undefined === val) {
    this.$__set(pathToMark, path, constructing, parts, schema, val, priorVal);
    return this;
  }

  var self = this;
  var shouldSet = this.$__try(function(){
    val = schema.applySetters(val, self, false, priorVal);
  });

  if (shouldSet) {
    this.$__set(pathToMark, path, constructing, parts, schema, val, priorVal);
  }

  return this;
};

/**
 * Determine if we should mark this change as modified.
 *
 * @return {Boolean}
 * @api private
 * @method $__shouldModify
 * @memberOf Document
 */
Document.prototype.$__shouldModify = function (
    pathToMark, path, constructing, parts, schema, val, priorVal) {

  if (this.isNew) return true;

  if ( undefined === val && !this.isSelected(path) ) {
    // when a path is not selected in a query, its initial
    // value will be undefined.
    return true;
  }

  if (undefined === val && path in this.$__.activePaths.states.default) {
    // we're just unsetting the default value which was never saved
    return false;
  }

  if (!utils.deepEqual(val, priorVal || this.get(path))) {
    return true;
  }

  //тест не проходит из-за наличия лишнего поля в states.default (comments)
  // На самом деле поле вроде и не лишнее
  //console.info( path, path in this.$__.activePaths.states.default );
  //console.log( this.$__.activePaths );

  // Когда мы устанавливаем такое же значение как default
  // Не понятно зачем мангуст его обновлял
  /*if (!constructing &&
      null != val &&
      path in this.$__.activePaths.states.default &&
      utils.deepEqual(val, schema.getDefault(this, constructing)) ) {

    //console.log( pathToMark, this.$__.activePaths.states.modify );

    // a path with a default was $unset on the server
    // and the user is setting it to the same value again
    return true;
  }*/

  return false;
};

/**
 * Handles the actual setting of the value and marking the path modified if appropriate.
 *
 * @api private
 * @method $__set
 * @memberOf Document
 */
Document.prototype.$__set = function ( pathToMark, path, constructing, parts, schema, val, priorVal ) {
  var shouldModify = this.$__shouldModify.apply(this, arguments);

  if (shouldModify) {
    this.markModified(pathToMark, val);
  }

  var obj = this._doc
    , i = 0
    , l = parts.length;

  for (; i < l; i++) {
    var next = i + 1
      , last = next === l;

    if ( last ) {
      obj[parts[i]] = val;

      var observable = ko.getObservable( this, path );

      //TODO: Иногда observable === null, понять почему так порисходит и исправить это
      //console.log( path, observable );

      // Обновим observable (чтобы работали привязки)
      observable && observable( val );

    } else {
      if (obj[parts[i]] && 'Object' === obj[parts[i]].constructor.name) {
        obj = obj[parts[i]];

      } else if (obj[parts[i]] && 'EmbeddedDocument' === obj[parts[i]].constructor.name) {
        obj = obj[parts[i]];

      } else if (obj[parts[i]] && Array.isArray(obj[parts[i]])) {
        obj = obj[parts[i]];

      } else {
        obj = obj[parts[i]] = {};
      }
    }
  }
};

/**
 * Gets a raw value from a path (no getters)
 *
 * @param {String} path
 * @api private
 */
Document.prototype.getValue = function (path) {
  return utils.getValue(path, this._doc);
};

/**
 * Sets a raw value for a path (no casting, setters, transformations)
 *
 * @param {String} path
 * @param {Object} value
 * @api private
 */
Document.prototype.setValue = function (path, value) {
  utils.setValue(path, value, this._doc);
  return this;
};

/**
 * Returns the value of a path.
 *
 * ####Example
 *
 *     // path
 *     doc.get('age') // 47
 *
 *     // dynamic casting to a string
 *     doc.get('age', String) // "47"
 *
 * @param {String} path
 * @param {Schema|String|Number} [type] optionally specify a type for on-the-fly attributes
 * @api public
 */
Document.prototype.get = function (path, type) {
  var adhocs;
  if (type) {
    adhocs = this.$__.adhocPaths || (this.$__.adhocPaths = {});
    adhocs[path] = Schema.interpretAsType(path, type);
  }

  var schema = this.$__path(path) || this.schema.virtualpath(path)
    , pieces = path.split('.')
    , obj = this._doc;

  for (var i = 0, l = pieces.length; i < l; i++) {
    obj = undefined === obj || null === obj
      ? undefined
      : obj[pieces[i]];
  }

  if (schema) {
    obj = schema.applyGetters(obj, this);
  }

  var observable = ko.getObservable( this, path );
  observable && observable();

  return obj;
};

/**
 * Returns the schematype for the given `path`.
 *
 * @param {String} path
 * @api private
 * @method $__path
 * @memberOf Document
 */
Document.prototype.$__path = function (path) {
  var adhocs = this.$__.adhocPaths
    , adhocType = adhocs && adhocs[path];

  if (adhocType) {
    return adhocType;
  } else {
    return this.schema.path(path);
  }
};

/**
 * Marks the path as having pending changes to write to the db.
 *
 * _Very helpful when using [Mixed](./schematypes.html#mixed) types._
 *
 * ####Example:
 *
 *     doc.mixed.type = 'changed';
 *     doc.markModified('mixed.type');
 *     doc.save() // changes to mixed.type are now persisted
 *
 * @param {String} path the path to mark modified
 * @api public
 */
Document.prototype.markModified = function (path) {
  this.$__.activePaths.modify(path);
};

/**
 * Catches errors that occur during execution of `fn` and stores them to later be passed when `save()` is executed.
 *
 * @param {Function} fn function to execute
 * @param {Object} [scope] the scope with which to call fn
 * @api private
 * @method $__try
 * @memberOf Document
 */
Document.prototype.$__try = function (fn, scope) {
  var res;
  try {
    fn.call(scope);
    res = true;
  } catch (e) {
    this.$__error(e);
    res = false;
  }
  return res;
};

/**
 * Returns the list of paths that have been modified.
 *
 * @return {Array}
 * @api public
 */
Document.prototype.modifiedPaths = function () {
  var directModifiedPaths = Object.keys(this.$__.activePaths.states.modify);

  return directModifiedPaths.reduce(function (list, path) {
    var parts = path.split('.');
    return list.concat(parts.reduce(function (chains, part, i) {
      return chains.concat(parts.slice(0, i).concat(part).join('.'));
    }, []));
  }, []);
};

/**
 * Returns true if this document was modified, else false.
 *
 * If `path` is given, checks if a path or any full path containing `path` as part of its path chain has been modified.
 *
 * ####Example
 *
 *     doc.set('documents.0.title', 'changed');
 *     doc.isModified()                    // true
 *     doc.isModified('documents')         // true
 *     doc.isModified('documents.0.title') // true
 *     doc.isDirectModified('documents')   // false
 *
 * @param {String} [path] optional
 * @return {Boolean}
 * @api public
 */
Document.prototype.isModified = function (path) {
  return path
    ? !!~this.modifiedPaths().indexOf(path)
    : this.$__.activePaths.some('modify');
};

/**
 * Returns true if `path` was directly set and modified, else false.
 *
 * ####Example
 *
 *     doc.set('documents.0.title', 'changed');
 *     doc.isDirectModified('documents.0.title') // true
 *     doc.isDirectModified('documents') // false
 *
 * @param {String} path
 * @return {Boolean}
 * @api public
 */
Document.prototype.isDirectModified = function (path) {
  return (path in this.$__.activePaths.states.modify);
};

/**
 * Checks if `path` was initialized.
 *
 * @param {String} path
 * @return {Boolean}
 * @api public
 */
Document.prototype.isInit = function (path) {
  return (path in this.$__.activePaths.states.init);
};

/**
 * Checks if `path` was selected in the source query which initialized this document.
 *
 * ####Example
 *
 *     Thing.findOne().select('name').exec(function (err, doc) {
 *        doc.isSelected('name') // true
 *        doc.isSelected('age')  // false
 *     })
 *
 * @param {String} path
 * @return {Boolean}
 * @api public
 */

Document.prototype.isSelected = function isSelected (path) {
  if (this.$__.selected) {

    if ('_id' === path) {
      return 0 !== this.$__.selected._id;
    }

    var paths = Object.keys(this.$__.selected)
      , i = paths.length
      , inclusive = false
      , cur;

    if (1 === i && '_id' === paths[0]) {
      // only _id was selected.
      return 0 === this.$__.selected._id;
    }

    while (i--) {
      cur = paths[i];
      if ('_id' == cur) continue;
      inclusive = !! this.$__.selected[cur];
      break;
    }

    if (path in this.$__.selected) {
      return inclusive;
    }

    i = paths.length;
    var pathDot = path + '.';

    while (i--) {
      cur = paths[i];
      if ('_id' == cur) continue;

      if (0 === cur.indexOf(pathDot)) {
        return inclusive;
      }

      if (0 === pathDot.indexOf(cur + '.')) {
        return inclusive;
      }
    }

    return ! inclusive;
  }

  return true;
};

/**
 * Executes registered validation rules for this document.
 *
 * ####Note:
 *
 * This method is called `pre` save and if a validation rule is violated, [save](#model_Model-save) is aborted and the error is returned to your `callback`.
 *
 * ####Example:
 *
 *     doc.validate(function (err) {
 *       if (err) handleError(err);
 *       else // validation passed
 *     });
 *
 * @param {Function} cb called after validation completes, passing an error if one occurred
 * @api public
 */
Document.prototype.validate = function (cb) {
  var self = this;

  // only validate required fields when necessary
  var paths = Object.keys(this.$__.activePaths.states.require).filter(function (path) {
    if (!self.isSelected(path) && !self.isModified(path)) return false;
    return true;
  });

  paths = paths.concat(Object.keys(this.$__.activePaths.states.init));
  paths = paths.concat(Object.keys(this.$__.activePaths.states.modify));
  paths = paths.concat(Object.keys(this.$__.activePaths.states.default));

  if (0 === paths.length) {
    complete();
    return this;
  }

  var validating = {}
    , total = 0;

  paths.forEach(validatePath);
  return this;

  function validatePath (path) {
    if (validating[path]) return;

    validating[path] = true;
    total++;

    utils.setImmediate(function(){
      var p = self.schema.path(path);
      if (!p) return --total || complete();

      var val = self.getValue(path);
      p.doValidate(val, function (err) {
        if (err) {
          self.invalidate(
              path
            , err
            , undefined
            //, true // embedded docs
            );
        }
        --total || complete();
      }, self);
    });
  }

  function complete () {
    var err = self.$__.validationError;
    self.$__.validationError = undefined;
    cb && cb(err);
  }
};

/**
 * Marks a path as invalid, causing validation to fail.
 *
 * The `errorMsg` argument will become the message of the `ValidationError`.
 *
 * The `value` argument (if passed) will be available through the `ValidationError.value` property.
 *
 *     doc.invalidate('size', 'must be less than 20', 14);

 *     doc.validate(function (err) {
 *       console.log(err)
 *       // prints
 *       { message: 'Validation failed',
 *         name: 'ValidationError',
 *         errors:
 *          { size:
 *             { message: 'must be less than 20',
 *               name: 'ValidatorError',
 *               path: 'size',
 *               type: 'user defined',
 *               value: 14 } } }
 *     })
 *
 * @param {String} path the field to invalidate
 * @param {String|Error} errorMsg the error which states the reason `path` was invalid
 * @param {Object|String|Number|any} value optional invalid value
 * @api public
 */
Document.prototype.invalidate = function (path, errorMsg, value) {
  if (!this.$__.validationError) {
    this.$__.validationError = new ValidationError(this);
  }

  if (!errorMsg || 'string' === typeof errorMsg) {
    errorMsg = new ValidatorError(path, errorMsg, 'user defined', value);
  }

  if (this.$__.validationError == errorMsg) return;

  this.$__.validationError.errors[path] = errorMsg;
};

/**
 * Resets the internal modified state of this document.
 *
 * @api private
 * @return {Document}
 * @method $__reset
 * @memberOf Document
 */

Document.prototype.$__reset = function reset () {
  var self = this;
  DocumentArray || (DocumentArray = _dereq_('./types/documentarray'));

  this.$__.activePaths
  .map('init', 'modify', function (i) {
    return self.getValue(i);
  })
  .filter(function (val) {
    return val && val instanceof DocumentArray && val.length;
  })
  .forEach(function (array) {
    var i = array.length;
    while (i--) {
      var doc = array[i];
      if (!doc) continue;
      doc.$__reset();
    }
  });

  // Clear 'modify'('dirty') cache
  this.$__.activePaths.clear('modify');
  this.$__.validationError = undefined;
  this.errors = undefined;
  //console.log( self.$__.activePaths.states.require );
  //TODO: тут
  this.schema.requiredPaths().forEach(function (path) {
    self.$__.activePaths.require(path);
  });

  return this;
};


/**
 * Returns this documents dirty paths / vals.
 *
 * @api private
 * @method $__dirty
 * @memberOf Document
 */

Document.prototype.$__dirty = function () {
  var self = this;

  var all = this.$__.activePaths.map('modify', function (path) {
    return { path: path
           , value: self.getValue( path )
           , schema: self.$__path( path ) };
  });

  // Sort dirty paths in a flat hierarchy.
  all.sort(function (a, b) {
    return (a.path < b.path ? -1 : (a.path > b.path ? 1 : 0));
  });

  // Ignore "foo.a" if "foo" is dirty already.
  var minimal = []
    , lastPath
    , top;

  all.forEach(function( item ){
    lastPath = item.path + '.';
    minimal.push(item);
    top = item;
  });

  top = lastPath = null;
  return minimal;
};

/*!
 * Compiles schemas.
 * (установить геттеры/сеттеры на поля документа)
 */
function compile (self, tree, proto, prefix) {
  var keys = Object.keys(tree)
    , i = keys.length
    , limb
    , key;

  while (i--) {
    key = keys[i];
    limb = tree[key];

    define(self
        , key
        , (('Object' === limb.constructor.name
               && Object.keys(limb).length)
               && (!limb.type || limb.type.type)
               ? limb
               : null)
        , proto
        , prefix
        , keys);
  }
}

/*!
 * Defines the accessor named prop on the incoming prototype.
 * там же, поля документа сделаем наблюдаемыми
 */
function define (self, prop, subprops, prototype, prefix, keys) {
  prefix = prefix || '';
  var path = (prefix ? prefix + '.' : '') + prop;

  if (subprops) {
    Object.defineProperty(prototype, prop, {
        enumerable: true
      , get: function () {
          if (!this.$__.getters)
            this.$__.getters = {};

          if (!this.$__.getters[path]) {
            var nested = Object.create(this);

            // save scope for nested getters/setters
            if (!prefix) nested.$__.scope = this;

            // shadow inherited getters from sub-objects so
            // thing.nested.nested.nested... doesn't occur (gh-366)
            var i = 0
              , len = keys.length;

            for (; i < len; ++i) {
              // over-write the parents getter without triggering it
              Object.defineProperty(nested, keys[i], {
                  enumerable: false   // It doesn't show up.
                , writable: true      // We can set it later.
                , configurable: true  // We can Object.defineProperty again.
                , value: undefined    // It shadows its parent.
              });
            }

            nested.toObject = function () {
              return this.get(path);
            };

            compile( self, subprops, nested, path );
            this.$__.getters[path] = nested;
          }

          return this.$__.getters[path];
        }
      , set: function (v) {
          if (v instanceof Document) v = v.toObject();
          return (this.$__.scope || this).set( path, v );
        }
    });

  } else {
    SchemaArray || (SchemaArray = _dereq_('./schema/array'));

    var allObservablesForObject = ko.es5.getAllObservablesForObject( self, true ),
      schema = prototype.schema || prototype.constructor.schema,
      isArray = schema.path( path ) instanceof SchemaArray,
      observable = isArray ? ko.observableArray()
                           : ko.observable();

    Object.defineProperty( prototype, prop, {
        enumerable: true
      , get: function ( ) { return this.get.call(this.$__.scope || this, path); }
      , set: function (v) { return this.set.call(this.$__.scope || this, path, v); }
    });

    // Поддержка Knockout.Validation
    var validators = schema.path(path) && schema.path(path).validators;
    if(validators && validators.length){
      var i = validators.length;
      while(i--){
        var validator = validators[i][0]
          , message = validators[i][1]
          , type = validators[i][2];

        //if( type = 'required' )
        observable.extend({  // custom validator
          validation: {
            validator: validator,
            message: message
          }
        })
      }
    }

    allObservablesForObject[ path ] = observable;

    if ( isArray ) {
      ko.es5.notifyWhenPresentOrFutureArrayValuesMutate( ko, observable );
    }
  }
}

/**
 * Assigns/compiles `schema` into this documents prototype.
 *
 * @param {Schema} schema
 * @api private
 * @method $__setSchema
 * @memberOf Document
 */
Document.prototype.$__setSchema = function ( schema ) {
  this.schema = schema;
  compile( this, schema.tree, this );
};

/**
 * Get all subdocs (by bfs)
 *
 * @api private
 * @method $__getAllSubdocs
 * @memberOf Document
 */
Document.prototype.$__getAllSubdocs = function () {
  DocumentArray || (DocumentArray = _dereq_('./types/documentarray'));
  Embedded = Embedded || _dereq_('./types/embedded');

  function docReducer(seed, path) {
    var val = this[path];
    if (val instanceof Embedded) seed.push(val);
    if (val instanceof DocumentArray)
      val.forEach(function _docReduce(doc) {
        if (!doc || !doc._doc) return;
        if (doc instanceof Embedded) seed.push(doc);
        seed = Object.keys(doc._doc).reduce(docReducer.bind(doc._doc), seed);
      });
    return seed;
  }

  return Object.keys(this._doc).reduce(docReducer.bind(this), []);
};

/**
 * Handle generic save stuff.
 * to solve #1446 use use hierarchy instead of hooks
 *
 * @api private
 * @method $__presaveValidate
 * @memberOf Document
 */
Document.prototype.$__presaveValidate = function $__presaveValidate() {
  // if any doc.set() calls failed

  var docs = this.$__getArrayPathsToValidate();

  var e2 = docs.map(function (doc) {
    return doc.$__presaveValidate();
  });
  var e1 = [this.$__.saveError].concat(e2);
  var err = e1.filter(function (x) {return x})[0];
  this.$__.saveError = null;

  return err;
};

/**
 * Get active path that were changed and are arrays
 *
 * @api private
 * @method $__getArrayPathsToValidate
 * @memberOf Document
 */
Document.prototype.$__getArrayPathsToValidate = function () {
  DocumentArray || (DocumentArray = _dereq_('./types/documentarray'));

  // validate all document arrays.
  return this.$__.activePaths
    .map('init', 'modify', function (i) {
      return this.getValue(i);
    }.bind(this))
    .filter(function (val) {
      return val && val instanceof DocumentArray && val.length;
    }).reduce(function(seed, array) {
      return seed.concat(array);
    }, [])
    .filter(function (doc) {return doc});
};

/**
 * Registers an error
 *
 * @param {Error} err
 * @api private
 * @method $__error
 * @memberOf Document
 */
Document.prototype.$__error = function (err) {
  this.$__.saveError = err;
  return this;
};

/**
 * Produces a special query document of the modified properties used in updates.
 *
 * @api private
 * @method $__delta
 * @memberOf Document
 */
Document.prototype.$__delta = function () {
  var dirty = this.$__dirty();

  var delta = {}
    , len = dirty.length
    , d = 0;

  for (; d < len; ++d) {
    var data = dirty[ d ];
    var value = data.value;

    value = utils.clone(value, { depopulate: 1 });
    delta[ data.path ] = value;
  }

  return delta;
};

Document.prototype.$__handleSave = function(){
  // Получаем ресурс коллекции, куда будем сохранять данные
  var resource;
  if ( this.collection ){
    resource = this.collection.api;
  }

  var innerPromise = new $.Deferred();

  if ( this.isNew ) {
    // send entire doc
    var obj = this.toObject({ depopulate: 1 });

    if ( ( obj || {} ).hasOwnProperty('_id') === false ) {
      // documents must have an _id else mongoose won't know
      // what to update later if more changes are made. the user
      // wouldn't know what _id was generated by mongodb either
      // nor would the ObjectId generated my mongodb necessarily
      // match the schema definition.
      innerPromise.reject(new Error('document must have an _id before saving'));
      return innerPromise;
    }

    // Проверка на окружение тестов
    // Хотя можно таким образом просто делать валидацию, даже если нет коллекции или api
    if ( !resource ){
      innerPromise.resolve( this );
    } else {
      resource.create( obj ).always( innerPromise.resolve );
    }

    this.$__reset();
    this.isNew = false;
    this.trigger('isNew', false);
    // Make it possible to retry the insert
    this.$__.inserting = true;

  } else {
    // Make sure we don't treat it as a new object on error,
    // since it already exists
    this.$__.inserting = false;

    var delta = this.$__delta();

    if ( !_.isEmpty( delta ) ) {
      this.$__reset();
      // Проверка на окружение тестов
      // Хотя можно таким образом просто делать валидацию, даже если нет коллекции или api
      if ( !resource ){
        innerPromise.resolve( this );
      } else {
        resource( this.id ).update( delta ).always( innerPromise.resolve );
      }
    } else {
      this.$__reset();
      innerPromise.resolve( this );
    }

    this.trigger('isNew', false);
  }

  return innerPromise;
};

/**
 * @description Saves this document.
 *
 * @example:
 *
 *     product.sold = Date.now();
 *     product.save(function (err, product, numberAffected) {
 *       if (err) ..
 *     })
 *
 * @description The callback will receive three parameters, `err` if an error occurred, `product` which is the saved `product`, and `numberAffected` which will be 1 when the document was found and updated in the database, otherwise 0.
 *
 * The `fn` callback is optional. If no `fn` is passed and validation fails, the validation error will be emitted on the connection used to create this model.
 * @example:
 *     var db = mongoose.createConnection(..);
 *     var schema = new Schema(..);
 *     var Product = db.model('Product', schema);
 *
 *     db.on('error', handleError);
 *
 * @description However, if you desire more local error handling you can add an `error` listener to the model and handle errors there instead.
 * @example:
 *     Product.on('error', handleError);
 *
 * @description As an extra measure of flow control, save will return a Promise (bound to `fn` if passed) so it could be chained, or hook to recive errors
 * @example:
 *     product.save().then(function (product, numberAffected) {
 *        ...
 *     }).onRejected(function (err) {
 *        assert.ok(err)
 *     })
 *
 * @param {function(err, product, Number)} [done] optional callback
 * @return {Promise} Promise
 * @api public
 * @see middleware http://mongoosejs.com/docs/middleware.html
 */
Document.prototype.save = function ( done ) {
  var self = this;
  var finalPromise = new $.Deferred().done( done );

  // Сохранять документ можно только если он находится в коллекции
  if ( !this.collection ){
    finalPromise.reject( arguments );
    console.error('Document.save api handle is not implemented.');
    return finalPromise;
  }

  // Check for preSave errors (точо знаю, что она проверяет ошибки в массивах (CastError))
  var preSaveErr = self.$__presaveValidate();
  if ( preSaveErr ) {
    finalPromise.reject( preSaveErr );
    return finalPromise;
  }

  // Validate
  var p0 = new $.Deferred();
  self.validate(function( err ){
    if ( err ){
      p0.reject( err );
      finalPromise.reject( err );
    } else {
      p0.resolve();
    }
  });

  // Сначала надо сохранить все поддокументы и сделать resolve!!!
  // Call save hooks on subdocs
  var subDocs = self.$__getAllSubdocs();
  var whenCond = subDocs.map(function (d) {return d.save();});
  whenCond.push( p0 );

  // Так мы передаём массив promise условий
  var p1 = $.when.apply( $, whenCond );

  // Handle save and results
  p1
    .then( this.$__handleSave.bind( this ) )
    .then(function(){
      return finalPromise.resolve( self );
    }, function ( err ) {
      // If the initial insert fails provide a second chance.
      // (If we did this all the time we would break updates)
      if (self.$__.inserting) {
        self.isNew = true;
        self.emit('isNew', true);
      }
      finalPromise.reject( err );
    });

  return finalPromise;
};

/*function all (promiseOfArr) {
  var pRet = new Promise;
  this.then(promiseOfArr).then(
    function (promiseArr) {
      var count = 0;
      var ret = [];
      var errSentinel;
      if (!promiseArr.length) pRet.resolve();
      promiseArr.forEach(function (promise, index) {
        if (errSentinel) return;
        count++;
        promise.then(
          function (val) {
            if (errSentinel) return;
            ret[index] = val;
            --count;
            if (count == 0) pRet.fulfill(ret);
          },
          function (err) {
            if (errSentinel) return;
            errSentinel = err;
            pRet.reject(err);
          }
        );
      });
      return pRet;
    }
    , pRet.reject.bind(pRet)
  );
  return pRet;
}*/


/**
 * Converts this document into a plain javascript object, ready for storage in MongoDB.
 *
 * Buffers are converted to instances of [mongodb.Binary](http://mongodb.github.com/node-mongodb-native/api-bson-generated/binary.html) for proper storage.
 *
 * ####Options:
 *
 * - `getters` apply all getters (path and virtual getters)
 * - `virtuals` apply virtual getters (can override `getters` option)
 * - `minimize` remove empty objects (defaults to true)
 * - `transform` a transform function to apply to the resulting document before returning
 *
 * ####Getters/Virtuals
 *
 * Example of only applying path getters
 *
 *     doc.toObject({ getters: true, virtuals: false })
 *
 * Example of only applying virtual getters
 *
 *     doc.toObject({ virtuals: true })
 *
 * Example of applying both path and virtual getters
 *
 *     doc.toObject({ getters: true })
 *
 * To apply these options to every document of your schema by default, set your [schemas](#schema_Schema) `toObject` option to the same argument.
 *
 *     schema.set('toObject', { virtuals: true })
 *
 * ####Transform
 *
 * We may need to perform a transformation of the resulting object based on some criteria, say to remove some sensitive information or return a custom object. In this case we set the optional `transform` function.
 *
 * Transform functions receive three arguments
 *
 *     function (doc, ret, options) {}
 *
 * - `doc` The mongoose document which is being converted
 * - `ret` The plain object representation which has been converted
 * - `options` The options in use (either schema options or the options passed inline)
 *
 * ####Example
 *
 *     // specify the transform schema option
 *     if (!schema.options.toObject) schema.options.toObject = {};
 *     schema.options.toObject.transform = function (doc, ret, options) {
 *       // remove the _id of every document before returning the result
 *       delete ret._id;
 *     }
 *
 *     // without the transformation in the schema
 *     doc.toObject(); // { _id: 'anId', name: 'Wreck-it Ralph' }
 *
 *     // with the transformation
 *     doc.toObject(); // { name: 'Wreck-it Ralph' }
 *
 * With transformations we can do a lot more than remove properties. We can even return completely new customized objects:
 *
 *     if (!schema.options.toObject) schema.options.toObject = {};
 *     schema.options.toObject.transform = function (doc, ret, options) {
 *       return { movie: ret.name }
 *     }
 *
 *     // without the transformation in the schema
 *     doc.toObject(); // { _id: 'anId', name: 'Wreck-it Ralph' }
 *
 *     // with the transformation
 *     doc.toObject(); // { movie: 'Wreck-it Ralph' }
 *
 * _Note: if a transform function returns `undefined`, the return value will be ignored._
 *
 * Transformations may also be applied inline, overridding any transform set in the options:
 *
 *     function xform (doc, ret, options) {
 *       return { inline: ret.name, custom: true }
 *     }
 *
 *     // pass the transform as an inline option
 *     doc.toObject({ transform: xform }); // { inline: 'Wreck-it Ralph', custom: true }
 *
 * _Note: if you call `toObject` and pass any options, the transform declared in your schema options will __not__ be applied. To force its application pass `transform: true`_
 *
 *     if (!schema.options.toObject) schema.options.toObject = {};
 *     schema.options.toObject.hide = '_id';
 *     schema.options.toObject.transform = function (doc, ret, options) {
 *       if (options.hide) {
 *         options.hide.split(' ').forEach(function (prop) {
 *           delete ret[prop];
 *         });
 *       }
 *     }
 *
 *     var doc = new Doc({ _id: 'anId', secret: 47, name: 'Wreck-it Ralph' });
 *     doc.toObject();                                        // { secret: 47, name: 'Wreck-it Ralph' }
 *     doc.toObject({ hide: 'secret _id' });                  // { _id: 'anId', secret: 47, name: 'Wreck-it Ralph' }
 *     doc.toObject({ hide: 'secret _id', transform: true }); // { name: 'Wreck-it Ralph' }
 *
 * Transforms are applied to the document _and each of its sub-documents_. To determine whether or not you are currently operating on a sub-document you might use the following guard:
 *
 *     if ('function' == typeof doc.ownerDocument) {
 *       // working with a sub doc
 *     }
 *
 * Transforms, like all of these options, are also available for `toJSON`.
 *
 * See [schema options](/docs/guide.html#toObject) for some more details.
 *
 * _During save, no custom options are applied to the document before being sent to the database._
 *
 * @param {Object} [options]
 * @return {Object} js object
 * @see mongodb.Binary http://mongodb.github.com/node-mongodb-native/api-bson-generated/binary.html
 * @api public
 */
Document.prototype.toObject = function (options) {
  if (options && options.depopulate && this.$__.wasPopulated) {
    // populated paths that we set to a document
    return utils.clone(this._id, options);
  }

  // When internally saving this document we always pass options,
  // bypassing the custom schema options.
  var optionsParameter = options;
  if (!(options && 'Object' == options.constructor.name) ||
    (options && options._useSchemaOptions)) {
    options = this.schema.options.toObject
      ? clone(this.schema.options.toObject)
      : {};
  }

  if ( options.minimize === undefined ){
    options.minimize = this.schema.options.minimize;
  }

  if (!optionsParameter) {
    options._useSchemaOptions = true;
  }

  var ret = utils.clone(this._doc, options);

  if (options.virtuals || options.getters && false !== options.virtuals) {
    applyGetters(this, ret, 'virtuals', options);
  }

  if (options.getters) {
    applyGetters(this, ret, 'paths', options);
    // applyGetters for paths will add nested empty objects;
    // if minimize is set, we need to remove them.
    if (options.minimize) {
      ret = minimize(ret) || {};
    }
  }

  // In the case where a subdocument has its own transform function, we need to
  // check and see if the parent has a transform (options.transform) and if the
  // child schema has a transform (this.schema.options.toObject) In this case,
  // we need to adjust options.transform to be the child schema's transform and
  // not the parent schema's
  if (true === options.transform ||
      (this.schema.options.toObject && options.transform)) {
    var opts = options.json
      ? this.schema.options.toJSON
      : this.schema.options.toObject;
    if (opts) {
      options.transform = opts.transform;
    }
  }

  if ('function' == typeof options.transform) {
    var xformed = options.transform(this, ret, options);
    if ('undefined' != typeof xformed) ret = xformed;
  }

  return ret;
};

/*!
 * Minimizes an object, removing undefined values and empty objects
 *
 * @param {Object} object to minimize
 * @return {Object}
 */

function minimize (obj) {
  var keys = Object.keys(obj)
    , i = keys.length
    , hasKeys
    , key
    , val;

  while (i--) {
    key = keys[i];
    val = obj[key];

    if ( _.isPlainObject(val) ) {
      obj[key] = minimize(val);
    }

    if (undefined === obj[key]) {
      delete obj[key];
      continue;
    }

    hasKeys = true;
  }

  return hasKeys
    ? obj
    : undefined;
}

/*!
 * Applies virtuals properties to `json`.
 *
 * @param {Document} self
 * @param {Object} json
 * @param {String} type either `virtuals` or `paths`
 * @return {Object} `json`
 */

function applyGetters (self, json, type, options) {
  var schema = self.schema
    , paths = Object.keys(schema[type])
    , i = paths.length
    , path;

  while (i--) {
    path = paths[i];

    var parts = path.split('.')
      , plen = parts.length
      , last = plen - 1
      , branch = json
      , part;

    for (var ii = 0; ii < plen; ++ii) {
      part = parts[ii];
      if (ii === last) {
        branch[part] = utils.clone(self.get(path), options);
      } else {
        branch = branch[part] || (branch[part] = {});
      }
    }
  }

  return json;
}

/**
 * The return value of this method is used in calls to JSON.stringify(doc).
 *
 * This method accepts the same options as [Document#toObject](#document_Document-toObject). To apply the options to every document of your schema by default, set your [schemas](#schema_Schema) `toJSON` option to the same argument.
 *
 *     schema.set('toJSON', { virtuals: true })
 *
 * See [schema options](/docs/guide.html#toJSON) for details.
 *
 * @param {Object} options
 * @return {Object}
 * @see Document#toObject #document_Document-toObject
 * @api public
 */

Document.prototype.toJSON = function (options) {
  // check for object type since an array of documents
  // being stringified passes array indexes instead
  // of options objects. JSON.stringify([doc, doc])
  // The second check here is to make sure that populated documents (or
  // subdocuments) use their own options for `.toJSON()` instead of their
  // parent's
  if (!(options && 'Object' == options.constructor.name)
      || ((!options || options.json) && this.schema.options.toJSON)) {

    options = this.schema.options.toJSON
      ? utils.clone(this.schema.options.toJSON)
      : {};
  }
  options.json = true;

  return this.toObject(options);
};

/**
 * Returns true if the Document stores the same data as doc.
 *
 * Documents are considered equal when they have matching `_id`s, unless neither
 * document has an `_id`, in which case this function falls back to using
 * `deepEqual()`.
 *
 * @param {Document} doc a document to compare
 * @return {Boolean}
 * @api public
 */

Document.prototype.equals = function (doc) {
  var tid = this.get('_id');
  var docid = doc.get('_id');
  if (!tid && !docid) {
    return deepEqual(this, doc);
  }
  return tid && tid.equals
    ? tid.equals(docid)
    : tid === docid;
}

/**
 * Gets _id(s) used during population of the given `path`.
 *
 * ####Example:
 *
 *     Model.findOne().populate('author').exec(function (err, doc) {
 *       console.log(doc.author.name)         // Dr.Seuss
 *       console.log(doc.populated('author')) // '5144cf8050f071d979c118a7'
 *     })
 *
 * If the path was not populated, undefined is returned.
 *
 * @param {String} path
 * @return {Array|ObjectId|Number|Buffer|String|undefined}
 * @api public
 */
Document.prototype.populated = function (path, val, options) {
  // val and options are internal

  //TODO: доделать эту проверку, она должна опираться не на $__.populated, а на то, что наш объект имеет родителя
  // и потом уже выставлять свойство populated == true
  if (null == val) {
    if (!this.$__.populated) return undefined;
    var v = this.$__.populated[path];
    if (v) return v.value;
    return undefined;
  }

  // internal

  if (true === val) {
    if (!this.$__.populated) return undefined;
    return this.$__.populated[path];
  }

  this.$__.populated || (this.$__.populated = {});
  this.$__.populated[path] = { value: val, options: options };
  return val;
};

/**
 * Returns the full path to this document.
 *
 * @param {String} [path]
 * @return {String}
 * @api private
 * @method $__fullPath
 * @memberOf Document
 */
Document.prototype.$__fullPath = function (path) {
  // overridden in SubDocuments
  return path || '';
};

/**
 * Удалить документ и вернуть коллекцию.
 *
 * @example
 * storage.collection.document.remove();
 * document.remove();
 *
 * @see Collection.remove
 * @returns {boolean}
 */
Document.prototype.remove = function(){
  if ( this.collection ){
    return this.collection.remove( this );
  }

  return delete this;
};


/**
 * Очищает документ (выставляет значение по умолчанию или undefined)
 */
Document.prototype.empty = function(){
  var doc = this
    , self = this
    , paths = Object.keys( this.schema.paths )
    , plen = paths.length
    , ii = 0;

  for ( ; ii < plen; ++ii ) {
    var p = paths[ii];

    if ( '_id' == p ) continue;

    var type = this.schema.paths[ p ]
      , path = p.split('.')
      , len = path.length
      , last = len - 1
      , doc_ = doc
      , i = 0;

    for ( ; i < len; ++i ) {
      var piece = path[ i ]
        , defaultVal;

      if ( i === last ) {
        defaultVal = type.getDefault( self, true );

        doc_[ piece ] = defaultVal || undefined;
        self.$__.activePaths.default( p );
      } else {
        doc_ = doc_[ piece ] || ( doc_[ piece ] = {} );
      }
    }
  }
};

/*!
 * Module exports.
 */

Document.ValidationError = ValidationError;
module.exports = Document;

},{"./error":4,"./events":9,"./internal":11,"./schema":13,"./schema/array":14,"./schema/mixed":19,"./schematype":23,"./types/documentarray":26,"./types/embedded":27,"./types/objectid":29,"./utils":30}],4:[function(_dereq_,module,exports){
//todo: портировать все ошибки!!!
/**
 * StorageError constructor
 *
 * @param {String} msg - Error message
 * @inherits Error https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error
 * http://stackoverflow.com/questions/783818/how-do-i-create-a-custom-error-in-javascript
 */
function StorageError ( msg ) {
  this.message = msg;
  this.name = 'StorageError';
}
StorageError.prototype = new Error();


/*!
 * Formats error messages
 */
StorageError.prototype.formatMessage = function (msg, path, type, val) {
  if (!msg) throw new TypeError('message is required');

  return msg.replace(/{PATH}/, path)
            .replace(/{VALUE}/, String(val||''))
            .replace(/{TYPE}/, type || 'declared type');
};

/*!
 * Module exports.
 */

module.exports = StorageError;

/**
 * The default built-in validator error messages.
 *
 * @see Error.messages #error_messages_MongooseError-messages
 * @api public
 */

StorageError.messages = _dereq_('./error/messages');

/*!
 * Expose subclasses
 */

StorageError.CastError = _dereq_('./error/cast');
StorageError.ValidationError = _dereq_('./error/validation');
StorageError.ValidatorError = _dereq_('./error/validator');
//todo:
//StorageError.VersionError = require('./error/version');
//StorageError.OverwriteModelError = require('./error/overwriteModel');
//StorageError.MissingSchemaError = require('./error/missingSchema');
//StorageError.DivergentArrayError = require('./error/divergentArray');

},{"./error/cast":5,"./error/messages":6,"./error/validation":7,"./error/validator":8}],5:[function(_dereq_,module,exports){
/*!
 * Module dependencies.
 */

var StorageError = _dereq_('../error.js');

/**
 * Casting Error constructor.
 *
 * @param {String} type
 * @param {String} value
 * @inherits MongooseError
 * @api private
 */

function CastError (type, value, path) {
  StorageError.call(this, 'Cast to ' + type + ' failed for value "' + value + '" at path "' + path + '"');
  this.name = 'CastError';
  this.type = type;
  this.value = value;
  this.path = path;
}

/*!
 * Inherits from MongooseError.
 */

CastError.prototype.__proto__ = StorageError.prototype;

/*!
 * exports
 */

module.exports = CastError;

},{"../error.js":4}],6:[function(_dereq_,module,exports){

/**
 * The default built-in validator error messages. These may be customized.
 *
 *     // customize within each schema or globally like so
 *     var mongoose = require('mongoose');
 *     mongoose.Error.messages.String.enum  = "Your custom message for {PATH}.";
 *
 * As you might have noticed, error messages support basic templating
 *
 * - `{PATH}` is replaced with the invalid document path
 * - `{VALUE}` is replaced with the invalid value
 * - `{TYPE}` is replaced with the validator type such as "regexp", "min", or "user defined"
 * - `{MIN}` is replaced with the declared min value for the Number.min validator
 * - `{MAX}` is replaced with the declared max value for the Number.max validator
 *
 * Click the "show code" link below to see all defaults.
 *
 * @property messages
 * @receiver MongooseError
 * @api public
 */

var msg = module.exports = {};

msg.general = {};
msg.general.default = "Validator failed for path `{PATH}` with value `{VALUE}`";
msg.general.required = "Path `{PATH}` is required.";

msg.Number = {};
msg.Number.min = "Path `{PATH}` ({VALUE}) is less than minimum allowed value ({MIN}).";
msg.Number.max = "Path `{PATH}` ({VALUE}) is more than maximum allowed value ({MAX}).";

msg.String = {};
msg.String.enum = "`{VALUE}` is not a valid enum value for path `{PATH}`.";
msg.String.match = "Path `{PATH}` is invalid ({VALUE}).";


},{}],7:[function(_dereq_,module,exports){

/*!
 * Module requirements
 */

var StorageError = _dereq_('../error.js');

/**
 * Document Validation Error
 *
 * @api private
 * @param {Document} instance
 * @inherits MongooseError
 */

function ValidationError (instance) {
  StorageError.call(this, "Validation failed");
  this.name = 'ValidationError';
  this.errors = instance.errors = {};
}

/*!
 * Inherits from MongooseError.
 */

ValidationError.prototype.__proto__ = StorageError.prototype;

/*!
 * Module exports
 */

module.exports = ValidationError;

},{"../error.js":4}],8:[function(_dereq_,module,exports){
/*!
 * Module dependencies.
 */

var StorageError = _dereq_('../error.js');
var errorMessages = StorageError.messages;

/**
 * Schema validator error
 *
 * @param {String} path
 * @param {String} msg
 * @param {String|Number|any} val
 * @inherits MongooseError
 * @api private
 */

function ValidatorError (path, msg, type, val) {
  if (!msg) msg = errorMessages.general.default;
  var message = this.formatMessage(msg, path, type, val);
  StorageError.call(this, message);
  this.name = 'ValidatorError';
  this.path = path;
  this.type = type;
  this.value = val;
}

/*!
 * toString helper
 */

ValidatorError.prototype.toString = function () {
  return this.message;
}

/*!
 * Inherits from MongooseError
 */

ValidatorError.prototype.__proto__ = StorageError.prototype;

/*!
 * exports
 */

module.exports = ValidatorError;

},{"../error.js":4}],9:[function(_dereq_,module,exports){
// Backbone.Events
// ---------------

// A module that can be mixed in to *any object* in order to provide it with
// custom events. You may bind with `on` or remove with `off` callback
// functions to an event; `trigger`-ing an event fires all callbacks in
// succession.
//
//     var object = {};
//     _.extend(object, Events.prototype);
//     object.on('expand', function(){ alert('expanded'); });
//     object.trigger('expand');
//
function Events() {}

Events.prototype = {

  // Bind an event to a `callback` function. Passing `"all"` will bind
  // the callback to all events fired.
  on: function(name, callback, context) {
    if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
    this._events || (this._events = {});
    var events = this._events[name] || (this._events[name] = []);
    events.push({callback: callback, context: context, ctx: context || this});
    return this;
  },

  // Bind an event to only be triggered a single time. After the first time
  // the callback is invoked, it will be removed.
  once: function(name, callback, context) {
    if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
    var self = this;
    var once = _.once(function() {
      self.off(name, once);
      callback.apply(this, arguments);
    });
    once._callback = callback;
    return this.on(name, once, context);
  },

  // Remove one or many callbacks. If `context` is null, removes all
  // callbacks with that function. If `callback` is null, removes all
  // callbacks for the event. If `name` is null, removes all bound
  // callbacks for all events.
  off: function(name, callback, context) {
    var retain, ev, events, names, i, l, j, k;
    if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
    if (!name && !callback && !context) {
      this._events = {};
      return this;
    }
    names = name ? [name] : _.keys(this._events);
    for (i = 0, l = names.length; i < l; i++) {
      name = names[i];
      if (events = this._events[name]) {
        this._events[name] = retain = [];
        if (callback || context) {
          for (j = 0, k = events.length; j < k; j++) {
            ev = events[j];
            if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
              (context && context !== ev.context)) {
              retain.push(ev);
            }
          }
        }
        if (!retain.length) delete this._events[name];
      }
    }

    return this;
  },

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  trigger: function(name) {
    if (!this._events) return this;
    var args = Array.prototype.slice.call(arguments, 1);
    if (!eventsApi(this, 'trigger', name, args)) return this;
    var events = this._events[name];
    var allEvents = this._events.all;
    if (events) triggerEvents(events, args);
    if (allEvents) triggerEvents(allEvents, arguments);
    return this;
  },

  // Tell this object to stop listening to either specific events ... or
  // to every object it's currently listening to.
  stopListening: function(obj, name, callback) {
    var listeningTo = this._listeningTo;
    if (!listeningTo) return this;
    var remove = !name && !callback;
    if (!callback && typeof name === 'object') callback = this;
    if (obj) (listeningTo = {})[obj._listenId] = obj;
    for (var id in listeningTo) {
      obj = listeningTo[id];
      obj.off(name, callback, this);
      if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
    }
    return this;
  }
};

// Regular expression used to split event strings.
var eventSplitter = /\s+/;

// Implement fancy features of the Events API such as multiple event
// names `"change blur"` and jQuery-style event maps `{change: action}`
// in terms of the existing API.
var eventsApi = function(obj, action, name, rest) {
  if (!name) return true;

  // Handle event maps.
  if (typeof name === 'object') {
    for (var key in name) {
      obj[action].apply(obj, [key, name[key]].concat(rest));
    }
    return false;
  }

  // Handle space separated event names.
  if (eventSplitter.test(name)) {
    var names = name.split(eventSplitter);
    for (var i = 0, l = names.length; i < l; i++) {
      obj[action].apply(obj, [names[i]].concat(rest));
    }
    return false;
  }

  return true;
};

// A difficult-to-believe, but optimized internal dispatch function for
// triggering events. Tries to keep the usual cases speedy (most internal
// Backbone events have 3 arguments).
var triggerEvents = function(events, args) {
  var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
  switch (args.length) {
    case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
    case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
    case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
    case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
    default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
  }
};

var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

// Inversion-of-control versions of `on` and `once`. Tell *this* object to
// listen to an event in another object ... keeping track of what it's
// listening to.
_.each(listenMethods, function(implementation, method) {
  Events[method] = function(obj, name, callback) {
    var listeningTo = this._listeningTo || (this._listeningTo = {});
    var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
    listeningTo[id] = obj;
    if (!callback && typeof name === 'object') callback = this;
    obj[implementation](name, callback, this);
    return this;
  };
});

module.exports = Events;

},{}],10:[function(_dereq_,module,exports){
/**
 * Хранилище документов по схемам
 * вдохновлён mongoose 3.8.4 (исправлены баги по 3.8.14)
 *
 * Реализации хранилища
 * http://docs.meteor.com/#selectors
 * https://github.com/meteor/meteor/tree/master/packages/minimongo
 *
 * browserify src/ --standalone storage > storage.js -d
 */

'use strict';

/*!
 * Module dependencies.
 */

var Collection = _dereq_('./collection')
  , Schema = _dereq_('./schema')
  , SchemaType = _dereq_('./schematype')
  , VirtualType = _dereq_('./virtualtype')
  , Types = _dereq_('./types')
  , Document = _dereq_('./document')
  , utils = _dereq_('./utils');


/**
 * Storage constructor.
 *
 * The exports object of the `storage` module is an instance of this class.
 * Most apps will only use this one instance.
 *
 * @api public
 */
function Storage () {
  this.collectionNames = [];
}

/**
 * Создать коллекцию и получить её.
 *
 * @example
 *
 * @param {string} name
 * @param {storage.Schema|undefined} schema
 * @param {Object} [api] - ссылка на апи ресурс
 * @returns {Collection|undefined}
 */
Storage.prototype.createCollection = function( name, schema, api ){
  if ( this[ name ] ){
    console.info('storage::collection: `' + name + '` already exist');
    return this[ name ];
  }

  if ( 'Schema' !== schema.constructor.name ){
    throw new TypeError('`schema` must be Schema instance');
  }

  this.collectionNames.push( name );

  return this[ name ] = new Collection( name, schema, api );
};

/**
 * Получить название коллекций в виде массива строк.
 *
 * @returns {Array.<string>} An array containing all collections in the storage.
 */
Storage.prototype.getCollectionNames = function(){
  return this.collectionNames;
};

/**
 * The Mongoose Collection constructor
 *
 * @method Collection
 * @api public
 */

Storage.prototype.Collection = Collection;

/**
 * The Storage version
 *
 * @property version
 * @api public
 */
//todo:
//Storage.prototype.version = pkg.version;

/**
 * The Storage [Schema](#schema_Schema) constructor
 *
 * ####Example:
 *
 *     var mongoose = require('mongoose');
 *     var Schema = mongoose.Schema;
 *     var CatSchema = new Schema(..);
 *
 * @method Schema
 * @api public
 */

Storage.prototype.Schema = Schema;

/**
 * The Mongoose [SchemaType](#schematype_SchemaType) constructor
 *
 * @method SchemaType
 * @api public
 */

Storage.prototype.SchemaType = SchemaType;

/**
 * The various Mongoose SchemaTypes.
 *
 * ####Note:
 *
 * _Alias of mongoose.Schema.Types for backwards compatibility._
 *
 * @property SchemaTypes
 * @see Schema.SchemaTypes #schema_Schema.Types
 * @api public
 */

Storage.prototype.SchemaTypes = Schema.Types;

/**
 * The Mongoose [VirtualType](#virtualtype_VirtualType) constructor
 *
 * @method VirtualType
 * @api public
 */

Storage.prototype.VirtualType = VirtualType;

/**
 * The various Mongoose Types.
 *
 * ####Example:
 *
 *     var mongoose = require('mongoose');
 *     var array = mongoose.Types.Array;
 *
 * ####Types:
 *
 * - [ObjectId](#types-objectid-js)
 * - [SubDocument](#types-embedded-js)
 * - [Array](#types-array-js)
 * - [DocumentArray](#types-documentarray-js)
 *
 * Using this exposed access to the `ObjectId` type, we can construct ids on demand.
 *
 *     var ObjectId = mongoose.Types.ObjectId;
 *     var id1 = new ObjectId;
 *
 * @property Types
 * @api public
 */

Storage.prototype.Types = Types;

/**
 * The Mongoose [Document](#document-js) constructor.
 *
 * @method Document
 * @api public
 */

Storage.prototype.Document = Document;

/**
 * The [MongooseError](#error_MongooseError) constructor.
 *
 * @method Error
 * @api public
 */

Storage.prototype.Error = _dereq_('./error');



Storage.prototype.StateMachine = _dereq_('./statemachine');
Storage.prototype.utils = utils;
Storage.prototype.ObjectId = Types.ObjectId;
Storage.prototype.schemas = Schema.schemas;

/*
 * Generate a random uuid.
 * http://www.broofa.com/Tools/Math.uuid.htm
 * fork Math.uuid.js (v1.4)
 *
 * http://www.broofa.com/2008/09/javascript-uuid-function/
 */
/*uuid: {
  // Private array of chars to use
  CHARS: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''),

  // returns RFC4122, version 4 ID
  generate: function(){
    var chars = this.CHARS, uuid = new Array( 36 ), rnd = 0, r;
    for ( var i = 0; i < 36; i++ ) {
      if ( i == 8 || i == 13 || i == 18 || i == 23 ) {
        uuid[i] = '-';
      } else if ( i == 14 ) {
        uuid[i] = '4';
      } else {
        if ( rnd <= 0x02 ) rnd = 0x2000000 + (Math.random() * 0x1000000) | 0;
        r = rnd & 0xf;
        rnd = rnd >> 4;
        uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
      }
    }
    return uuid.join('').toLowerCase();
  }
}*/


/*!
 * The exports object is an instance of Storage.
 *
 * @api public
 */

module.exports = new Storage;

},{"./collection":2,"./document":3,"./error":4,"./schema":13,"./schematype":23,"./statemachine":24,"./types":28,"./utils":30,"./virtualtype":31}],11:[function(_dereq_,module,exports){
// Машина состояний используется для пометки, в каком состоянии находятся поле
// Например: если поле имеет состояние default - значит его значением является значение по умолчанию
// Примечание: для массивов в общем случае это означает пустой массив

/*!
 * Dependencies
 */

var StateMachine = _dereq_('./statemachine');

var ActiveRoster = StateMachine.ctor('require', 'modify', 'init', 'default');

module.exports = InternalCache;

function InternalCache () {
  this.strictMode = undefined;
  this.selected = undefined;
  this.saveError = undefined;
  this.validationError = undefined;
  this.adhocPaths = undefined;
  this.removing = undefined;
  this.inserting = undefined;
  this.version = undefined;
  this.getters = {};
  this._id = undefined;
  this.populate = undefined; // what we want to populate in this doc
  this.populated = undefined;// the _ids that have been populated
  this.wasPopulated = false; // if this doc was the result of a population
  this.scope = undefined;
  this.activePaths = new ActiveRoster;

  // embedded docs
  this.ownerDocument = undefined;
  this.fullPath = undefined;
}

},{"./statemachine":24}],12:[function(_dereq_,module,exports){
/**
 * Returns the value of object `o` at the given `path`.
 *
 * ####Example:
 *
 *     var obj = {
 *         comments: [
 *             { title: 'exciting!', _doc: { title: 'great!' }}
 *           , { title: 'number dos' }
 *         ]
 *     }
 *
 *     mpath.get('comments.0.title', o)         // 'exciting!'
 *     mpath.get('comments.0.title', o, '_doc') // 'great!'
 *     mpath.get('comments.title', o)           // ['exciting!', 'number dos']
 *
 *     // summary
 *     mpath.get(path, o)
 *     mpath.get(path, o, special)
 *     mpath.get(path, o, map)
 *     mpath.get(path, o, special, map)
 *
 * @param {String} path
 * @param {Object} o
 * @param {String} [special] When this property name is present on any object in the path, walking will continue on the value of this property.
 * @param {Function} [map] Optional function which receives each individual found value. The value returned from `map` is used in the original values place.
 */

exports.get = function (path, o, special, map) {
  var lookup;

  if ('function' == typeof special) {
    if (special.length < 2) {
      map = special;
      special = undefined;
    } else {
      lookup = special;
      special = undefined;
    }
  }

  map || (map = K);

  var parts = 'string' == typeof path
    ? path.split('.')
    : path;

  if (!Array.isArray(parts)) {
    throw new TypeError('Invalid `path`. Must be either string or array');
  }

  var obj = o
    , part;

  for (var i = 0; i < parts.length; ++i) {
    part = parts[i];

    if (Array.isArray(obj) && !/^\d+$/.test(part)) {
      // reading a property from the array items
      var paths = parts.slice(i);

      return obj.map(function (item) {
        return item
          ? exports.get(paths, item, special || lookup, map)
          : map(undefined);
      });
    }

    if (lookup) {
      obj = lookup(obj, part);
    } else {
      obj = special && obj[special]
        ? obj[special][part]
        : obj[part];
    }

    if (!obj) return map(obj);
  }

  return map(obj);
}

/**
 * Sets the `val` at the given `path` of object `o`.
 *
 * @param {String} path
 * @param {Anything} val
 * @param {Object} o
 * @param {String} [special] When this property name is present on any object in the path, walking will continue on the value of this property.
 * @param {Function} [map] Optional function which is passed each individual value before setting it. The value returned from `map` is used in the original values place.
 */

exports.set = function (path, val, o, special, map, _copying) {
  var lookup;

  if ('function' == typeof special) {
    if (special.length < 2) {
      map = special;
      special = undefined;
    } else {
      lookup = special;
      special = undefined;
    }
  }

  map || (map = K);

  var parts = 'string' == typeof path
    ? path.split('.')
    : path;

  if (!Array.isArray(parts)) {
    throw new TypeError('Invalid `path`. Must be either string or array');
  }

  if (null == o) return;

  // the existance of $ in a path tells us if the user desires
  // the copying of an array instead of setting each value of
  // the array to the one by one to matching positions of the
  // current array.
  var copy = _copying || /\$/.test(path)
    , obj = o
    , part

  for (var i = 0, len = parts.length - 1; i < len; ++i) {
    part = parts[i];

    if ('$' == part) {
      if (i == len - 1) {
        break;
      } else {
        continue;
      }
    }

    if (Array.isArray(obj) && !/^\d+$/.test(part)) {
      var paths = parts.slice(i);
      if (!copy && Array.isArray(val)) {
        for (var j = 0; j < obj.length && j < val.length; ++j) {
          // assignment of single values of array
          exports.set(paths, val[j], obj[j], special || lookup, map, copy);
        }
      } else {
        for (var j = 0; j < obj.length; ++j) {
          // assignment of entire value
          exports.set(paths, val, obj[j], special || lookup, map, copy);
        }
      }
      return;
    }

    if (lookup) {
      obj = lookup(obj, part);
    } else {
      obj = special && obj[special]
        ? obj[special][part]
        : obj[part];
    }

    if (!obj) return;
  }

  // process the last property of the path

  part = parts[len];

  // use the special property if exists
  if (special && obj[special]) {
    obj = obj[special];
  }

  // set the value on the last branch
  if (Array.isArray(obj) && !/^\d+$/.test(part)) {
    if (!copy && Array.isArray(val)) {
      for (var item, j = 0; j < obj.length && j < val.length; ++j) {
        item = obj[j];
        if (item) {
          if (lookup) {
            lookup(item, part, map(val[j]));
          } else {
            if (item[special]) item = item[special];
            item[part] = map(val[j]);
          }
        }
      }
    } else {
      for (var j = 0; j < obj.length; ++j) {
        item = obj[j];
        if (item) {
          if (lookup) {
            lookup(item, part, map(val));
          } else {
            if (item[special]) item = item[special];
            item[part] = map(val);
          }
        }
      }
    }
  } else {
    if (lookup) {
      lookup(obj, part, map(val));
    } else {
      obj[part] = map(val);
    }
  }
}

/*!
 * Returns the value passed to it.
 */

function K (v) {
  return v;
}
},{}],13:[function(_dereq_,module,exports){
/*!
 * Module dependencies.
 */

var Events = _dereq_('./events')
  , VirtualType = _dereq_('./virtualtype')
  , utils = _dereq_('./utils')
  , Types
  , schemas;

/**
 * Schema constructor.
 *
 * ####Example:
 *
 *     var child = new Schema({ name: String });
 *     var schema = new Schema({ name: String, age: Number, children: [child] });
 *     var Tree = mongoose.model('Tree', schema);
 *
 *     // setting schema options
 *     new Schema({ name: String }, { _id: false, autoIndex: false })
 *
 * ####Options:
 *
 * - [collection](/docs/guide.html#collection): string - no default
 * - [id](/docs/guide.html#id): bool - defaults to true
 * - `minimize`: bool - controls [document#toObject](#document_Document-toObject) behavior when called manually - defaults to true
 * - [strict](/docs/guide.html#strict): bool - defaults to true
 * - [toJSON](/docs/guide.html#toJSON) - object - no default
 * - [toObject](/docs/guide.html#toObject) - object - no default
 * - [versionKey](/docs/guide.html#versionKey): bool - defaults to "__v"
 *
 * ####Note:
 *
 * _When nesting schemas, (`children` in the example above), always declare the child schema first before passing it into is parent._
 *
 * @param {String|undefined} [name] Название схемы
 * @param {Schema} [baseSchema] Базовая схема при наследовании
 * @param {Object} obj Схема
 * @param {Object} [options]
 * @api public
 */
function Schema ( name, baseSchema, obj, options ) {
  if ( !(this instanceof Schema) )
    return new Schema( name, baseSchema, obj, options );

  // Если это именованая схема
  if ( typeof name === 'string' ){
    this.name = name;
    schemas[ name ] = this;
  } else {
    options = obj;
    obj = baseSchema;
    baseSchema = name;
    name = undefined;
  }

  if ( !(baseSchema instanceof Schema) ){
    options = obj;
    obj = baseSchema;
    baseSchema = undefined;
  }

  // Сохраним описание схемы для поддержки дискриминаторов
  this.source = obj;

  this.paths = {};
  this.subpaths = {};
  this.virtuals = {};
  this.nested = {};
  this.inherits = {};
  this.callQueue = [];
  this.methods = {};
  this.statics = {};
  this.tree = {};
  this._requiredpaths = undefined;
  this.discriminatorMapping = undefined;

  this.options = this.defaultOptions( options );

  if ( baseSchema instanceof Schema ){
    baseSchema.discriminator( name, this );

    //this.discriminator( name, baseSchema );
  }

  // build paths
  if ( obj ) {
    this.add( obj );
  }

  // ensure the documents get an auto _id unless disabled
  var auto_id = !this.paths['_id'] && (!this.options.noId && this.options._id);
  if (auto_id) {
    this.add({ _id: {type: Schema.ObjectId, auto: true} });
  }

  // ensure the documents receive an id getter unless disabled
  var autoid = !this.paths['id'] && this.options.id;
  if ( autoid ) {
    this.virtual('id').get( idGetter );
  }
}

/*!
 * Returns this documents _id cast to a string.
 */
function idGetter () {
  if (this.$__._id) {
    return this.$__._id;
  }

  return this.$__._id = null == this._id
    ? null
    : String(this._id);
}

/*!
 * Inherit from EventEmitter.
 */

Schema.prototype.__proto__ = Events.prototype;

/**
 * Schema as flat paths
 *
 * ####Example:
 *     {
 *         '_id'        : SchemaType,
 *       , 'nested.key' : SchemaType,
 *     }
 *
 * @api private
 * @property paths
 */
Schema.prototype.paths;

/**
 * Schema as a tree
 *
 * ####Example:
 *     {
 *         '_id'     : ObjectId
 *       , 'nested'  : {
 *             'key' : String
 *         }
 *     }
 *
 * @api private
 * @property tree
 */
Schema.prototype.tree;

/**
 * Returns default options for this schema, merged with `options`.
 *
 * @param {Object} options
 * @return {Object}
 * @api private
 */
Schema.prototype.defaultOptions = function (options) {
  options = $.extend({
      strict: true
    , versionKey: '__v'
    , discriminatorKey: '__t'
    , minimize: true
    // the following are only applied at construction time
    , _id: true
    , id: true
  }, options );

  return options;
};

/**
 * Adds key path / schema type pairs to this schema.
 *
 * ####Example:
 *
 *     var ToySchema = new Schema;
 *     ToySchema.add({ name: 'string', color: 'string', price: 'number' });
 *
 * @param {Object} obj
 * @param {String} prefix
 * @api public
 */
Schema.prototype.add = function add ( obj, prefix ) {
  prefix = prefix || '';
  var keys = Object.keys( obj );

  for (var i = 0; i < keys.length; ++i) {
    var key = keys[i];

    if (null == obj[ key ]) {
      throw new TypeError('Invalid value for schema path `'+ prefix + key +'`');
    }

    if ( _.isPlainObject(obj[key] )
      && ( !obj[ key ].constructor || 'Object' == obj[ key ].constructor.name )
      && ( !obj[ key ].type || obj[ key ].type.type ) ){

      if ( Object.keys(obj[ key ]).length ) {
        // nested object { last: { name: String }}
        this.nested[ prefix + key ] = true;
        this.add( obj[ key ], prefix + key + '.');

      } else {
        this.path( prefix + key, obj[ key ] ); // mixed type
      }

    } else {
      this.path( prefix + key, obj[ key ] );
    }
  }
};

/**
 * Reserved document keys.
 *
 * Keys in this object are names that are rejected in schema declarations b/c they conflict with mongoose functionality. Using these key name will throw an error.
 *
 *      on, emit, _events, db, get, set, init, isNew, errors, schema, options, modelName, collection, _pres, _posts, toObject
 *
 * _NOTE:_ Use of these terms as method names is permitted, but play at your own risk, as they may be existing mongoose document methods you are stomping on.
 *
 *      var schema = new Schema(..);
 *      schema.methods.init = function () {} // potentially breaking
 */
Schema.reserved = Object.create( null );
var reserved = Schema.reserved;
reserved.on =
reserved.db =
reserved.get =
reserved.set =
reserved.init =
reserved.isNew =
reserved.errors =
reserved.schema =
reserved.options =
reserved.modelName =
reserved.collection =
reserved.toObject =
reserved.domain =
reserved.emit =    // EventEmitter
reserved._events = // EventEmitter
reserved._pres = reserved._posts = 1; // hooks.js

/**
 * Gets/sets schema paths.
 *
 * Sets a path (if arity 2)
 * Gets a path (if arity 1)
 *
 * ####Example
 *
 *     schema.path('name') // returns a SchemaType
 *     schema.path('name', Number) // changes the schemaType of `name` to Number
 *
 * @param {String} path
 * @param {Object} constructor
 * @api public
 */
Schema.prototype.path = function (path, obj) {
  if (obj == undefined) {
    if (this.paths[path]) return this.paths[path];
    if (this.subpaths[path]) return this.subpaths[path];

    // subpaths?
    return /\.\d+\.?.*$/.test(path)
      ? getPositionalPath(this, path)
      : undefined;
  }

  // some path names conflict with document methods
  if (reserved[path]) {
    throw new Error("`" + path + "` may not be used as a schema pathname");
  }

  // update the tree
  var subpaths = path.split(/\./)
    , last = subpaths.pop()
    , branch = this.tree;

  subpaths.forEach(function(sub, i) {
    if (!branch[sub]) branch[sub] = {};
    if ('object' != typeof branch[sub]) {
      var msg = 'Cannot set nested path `' + path + '`. '
              + 'Parent path `'
              + subpaths.slice(0, i).concat([sub]).join('.')
              + '` already set to type ' + branch[sub].name
              + '.';
      throw new Error(msg);
    }
    branch = branch[sub];
  });

  branch[last] = utils.clone(obj);

  this.paths[path] = Schema.interpretAsType(path, obj);
  return this;
};

/**
 * Converts type arguments into Schema Types.
 *
 * @param {String} path
 * @param {Object} obj constructor
 * @api private
 */
Schema.interpretAsType = function (path, obj) {
  if (obj.constructor && obj.constructor.name != 'Object')
    obj = { type: obj };

  // Get the type making sure to allow keys named "type"
  // and default to mixed if not specified.
  // { type: { type: String, default: 'freshcut' } }
  var type = obj.type && !obj.type.type
    ? obj.type
    : {};

  if ('Object' == type.constructor.name || 'mixed' == type) {
    return new Types.Mixed(path, obj);
  }

  if (Array.isArray(type) || Array == type || 'array' == type) {
    // if it was specified through { type } look for `cast`
    var cast = (Array == type || 'array' == type)
      ? obj.cast
      : type[0];

    if (cast instanceof Schema) {
      return new Types.DocumentArray(path, cast, obj);
    }

    if ('string' == typeof cast) {
      cast = Types[cast.charAt(0).toUpperCase() + cast.substring(1)];
    } else if (cast && (!cast.type || cast.type.type)
                    && 'Object' == cast.constructor.name
                    && Object.keys(cast).length) {
      return new Types.DocumentArray(path, new Schema(cast), obj);
    }

    return new Types.Array(path, cast || Types.Mixed, obj);
  }

  var name = 'string' == typeof type
    ? type
    : type.name;

  if (name) {
    name = name.charAt(0).toUpperCase() + name.substring(1);
  }

  if (undefined == Types[name]) {
    throw new TypeError('Undefined type at `' + path +
        '`\n  Did you try nesting Schemas? ' +
        'You can only nest using refs or arrays.');
  }

  return new Types[name](path, obj);
};

/**
 * Iterates the schemas paths similar to Array#forEach.
 *
 * The callback is passed the pathname and schemaType as arguments on each iteration.
 *
 * @param {Function} fn callback function
 * @return {Schema} this
 * @api public
 */
Schema.prototype.eachPath = function (fn) {
  var keys = Object.keys(this.paths)
    , len = keys.length;

  for (var i = 0; i < len; ++i) {
    fn(keys[i], this.paths[keys[i]]);
  }

  return this;
};

/**
 * Returns an Array of path strings that are required by this schema.
 *
 * @api public
 * @return {Array}
 */
Schema.prototype.requiredPaths = function requiredPaths () {
  if (this._requiredpaths) return this._requiredpaths;

  var paths = Object.keys(this.paths)
    , i = paths.length
    , ret = [];

  while (i--) {
    var path = paths[i];
    if (this.paths[path].isRequired) ret.push(path);
  }

  return this._requiredpaths = ret;
};

/**
 * Returns the pathType of `path` for this schema.
 *
 * Given a path, returns whether it is a real, virtual, nested, or ad-hoc/undefined path.
 *
 * @param {String} path
 * @return {String}
 * @api public
 */
Schema.prototype.pathType = function (path) {
  if (path in this.paths) return 'real';
  if (path in this.virtuals) return 'virtual';
  if (path in this.nested) return 'nested';
  if (path in this.subpaths) return 'real';

  if (/\.\d+\.|\.\d+$/.test(path) && getPositionalPath(this, path)) {
    return 'real';
  } else {
    return 'adhocOrUndefined'
  }
};

/*!
 * ignore
 */
function getPositionalPath (self, path) {
  var subpaths = path.split(/\.(\d+)\.|\.(\d+)$/).filter(Boolean);
  if (subpaths.length < 2) {
    return self.paths[subpaths[0]];
  }

  var val = self.path(subpaths[0]);
  if (!val) return val;

  var last = subpaths.length - 1
    , subpath
    , i = 1;

  for (; i < subpaths.length; ++i) {
    subpath = subpaths[i];

    if (i === last && val && !val.schema && !/\D/.test(subpath)) {
      if (val instanceof Types.Array) {
        // StringSchema, NumberSchema, etc
        val = val.caster;
      } else {
        val = undefined;
      }
      break;
    }

    // ignore if its just a position segment: path.0.subpath
    if (!/\D/.test(subpath)) continue;

    if (!(val && val.schema)) {
      val = undefined;
      break;
    }

    val = val.schema.path(subpath);
  }

  return self.subpaths[path] = val;
}

/**
 * Adds a method call to the queue.
 *
 * @param {String} name name of the document method to call later
 * @param {Array} args arguments to pass to the method
 * @api private
 */
Schema.prototype.queue = function(name, args){
  this.callQueue.push([name, args]);
  return this;
};

/**
 * Defines a pre hook for the document.
 *
 * ####Example
 *
 *     var toySchema = new Schema(..);
 *
 *     toySchema.pre('save', function (next) {
 *       if (!this.created) this.created = new Date;
 *       next();
 *     })
 *
 *     toySchema.pre('validate', function (next) {
 *       if (this.name != 'Woody') this.name = 'Woody';
 *       next();
 *     })
 *
 * @param {String} method
 * @param {Function} callback
 * @see hooks.js https://github.com/bnoguchi/hooks-js/tree/31ec571cef0332e21121ee7157e0cf9728572cc3
 * @api public
 */
Schema.prototype.pre = function(){
  return this.queue('pre', arguments);
};

/**
 * Defines a post for the document
 *
 * Post hooks fire `on` the event emitted from document instances of Models compiled from this schema.
 *
 *     var schema = new Schema(..);
 *     schema.post('save', function (doc) {
 *       console.log('this fired after a document was saved');
 *     });
 *
 *     var Model = mongoose.model('Model', schema);
 *
 *     var m = new Model(..);
 *     m.save(function (err) {
 *       console.log('this fires after the `post` hook');
 *     });
 *
 * @param {String} method name of the method to hook
 * @param {Function} fn callback
 * @see hooks.js https://github.com/bnoguchi/hooks-js/tree/31ec571cef0332e21121ee7157e0cf9728572cc3
 * @api public
 */
Schema.prototype.post = function(method, fn){
  return this.queue('on', arguments);
};

/**
 * Registers a plugin for this schema.
 *
 * @param {Function} plugin callback
 * @param {Object} opts
 * @see plugins
 * @api public
 */
Schema.prototype.plugin = function (fn, opts) {
  fn(this, opts);
  return this;
};

/**
 * Adds an instance method to documents constructed from Models compiled from this schema.
 *
 * ####Example
 *
 *     var schema = kittySchema = new Schema(..);
 *
 *     schema.method('meow', function () {
 *       console.log('meeeeeoooooooooooow');
 *     })
 *
 *     var Kitty = mongoose.model('Kitty', schema);
 *
 *     var fizz = new Kitty;
 *     fizz.meow(); // meeeeeooooooooooooow
 *
 * If a hash of name/fn pairs is passed as the only argument, each name/fn pair will be added as methods.
 *
 *     schema.method({
 *         purr: function () {}
 *       , scratch: function () {}
 *     });
 *
 *     // later
 *     fizz.purr();
 *     fizz.scratch();
 *
 * @param {String|Object} method name
 * @param {Function} [fn]
 * @api public
 */
Schema.prototype.method = function (name, fn) {
  if ('string' != typeof name)
    for (var i in name)
      this.methods[i] = name[i];
  else
    this.methods[name] = fn;
  return this;
};

/**
 * Adds static "class" methods to Models compiled from this schema.
 *
 * ####Example
 *
 *     var schema = new Schema(..);
 *     schema.static('findByName', function (name, callback) {
 *       return this.find({ name: name }, callback);
 *     });
 *
 *     var Drink = mongoose.model('Drink', schema);
 *     Drink.findByName('sanpellegrino', function (err, drinks) {
 *       //
 *     });
 *
 * If a hash of name/fn pairs is passed as the only argument, each name/fn pair will be added as statics.
 *
 * @param {String} name
 * @param {Function} fn
 * @api public
 */
Schema.prototype.static = function(name, fn) {
  if ('string' != typeof name)
    for (var i in name)
      this.statics[i] = name[i];
  else
    this.statics[name] = fn;
  return this;
};

/**
 * Sets/gets a schema option.
 *
 * @param {String} key option name
 * @param {Object} [value] if not passed, the current option value is returned
 * @api public
 */
Schema.prototype.set = function (key, value) {
  if (1 === arguments.length) {
    return this.options[key];
  }

  switch (key) {
    case 'safe':
      this.options[key] = false === value
        ? { w: 0 }
        : value;
      break;
    default:
      this.options[key] = value;
  }

  return this;
};

/**
 * Gets a schema option.
 *
 * @param {String} key option name
 * @api public
 */

Schema.prototype.get = function (key) {
  return this.options[key];
};

/**
 * Creates a virtual type with the given name.
 *
 * @param {String} name
 * @param {Object} [options]
 * @return {VirtualType}
 */

Schema.prototype.virtual = function (name, options) {
  var virtuals = this.virtuals;
  var parts = name.split('.');
  return virtuals[name] = parts.reduce(function (mem, part, i) {
    mem[part] || (mem[part] = (i === parts.length-1)
                            ? new VirtualType(options, name)
                            : {});
    return mem[part];
  }, this.tree);
};

/**
 * Returns the virtual type with the given `name`.
 *
 * @param {String} name
 * @return {VirtualType}
 */

Schema.prototype.virtualpath = function (name) {
  return this.virtuals[name];
};

/**
 * Registered discriminators for this schema.
 *
 * @property discriminators
 * @api public
 */
Schema.discriminators;

/**
 * Наследование от схемы.
 * this - базовая схема!!!
 *
 * ####Example:
 *     var PersonSchema = new Schema('Person', {
 *       name: String,
 *       createdAt: Date
 *     });
 *
 *     var BossSchema = new Schema('Boss', PersonSchema, { department: String });
 *
 * @param {String} name   discriminator model name
 * @param {Schema} schema discriminator model schema
 * @api public
 */
Schema.prototype.discriminator = function discriminator (name, schema) {
  if (!(schema instanceof Schema)) {
    throw new Error("You must pass a valid discriminator Schema");
  }

  if ( this.discriminatorMapping && !this.discriminatorMapping.isRoot ) {
    throw new Error("Discriminator \"" + name + "\" can only be a discriminator of the root model");
  }

  var key = this.options.discriminatorKey;
  if ( schema.path(key) ) {
    throw new Error("Discriminator \"" + name + "\" cannot have field with name \"" + key + "\"");
  }

  // merges base schema into new discriminator schema and sets new type field.
  (function mergeSchemas(schema, baseSchema) {
    utils.merge(schema, baseSchema);

    var obj = {};
    obj[key] = { type: String, default: name };
    schema.add(obj);
    schema.discriminatorMapping = { key: key, value: name, isRoot: false };

    if (baseSchema.options.collection) {
      schema.options.collection = baseSchema.options.collection;
    }

      // throws error if options are invalid
    (function validateOptions(a, b) {
      a = utils.clone(a);
      b = utils.clone(b);
      delete a.toJSON;
      delete a.toObject;
      delete b.toJSON;
      delete b.toObject;

      if (!utils.deepEqual(a, b)) {
        throw new Error("Discriminator options are not customizable (except toJSON & toObject)");
      }
    })(schema.options, baseSchema.options);

    var toJSON = schema.options.toJSON
      , toObject = schema.options.toObject;

    schema.options = utils.clone(baseSchema.options);
    if (toJSON)   schema.options.toJSON = toJSON;
    if (toObject) schema.options.toObject = toObject;

    schema.callQueue = baseSchema.callQueue.concat(schema.callQueue);
    schema._requiredpaths = undefined; // reset just in case Schema#requiredPaths() was called on either schema
  })(schema, this);

  if (!this.discriminators) {
    this.discriminators = {};
  }

  if (!this.discriminatorMapping) {
    this.discriminatorMapping = { key: key, value: null, isRoot: true };
  }

  if (this.discriminators[name]) {
    throw new Error("Discriminator with name \"" + name + "\" already exists");
  }

  this.discriminators[name] = schema;
};

/*!
 * exports
 */

module.exports = Schema;
window.Schema = Schema;

// require down here because of reference issues

/**
 * The various built-in Mongoose Schema Types.
 *
 * ####Example:
 *
 *     var mongoose = require('mongoose');
 *     var ObjectId = mongoose.Schema.Types.ObjectId;
 *
 * ####Types:
 *
 * - [String](#schema-string-js)
 * - [Number](#schema-number-js)
 * - [Boolean](#schema-boolean-js) | Bool
 * - [Array](#schema-array-js)
 * - [Date](#schema-date-js)
 * - [ObjectId](#schema-objectid-js) | Oid
 * - [Mixed](#schema-mixed-js) | Object
 *
 * Using this exposed access to the `Mixed` SchemaType, we can use them in our schema.
 *
 *     var Mixed = mongoose.Schema.Types.Mixed;
 *     new mongoose.Schema({ _user: Mixed })
 *
 * @api public
 */
Schema.Types = _dereq_('./schema/index');

// Хранилище схем
Schema.schemas = schemas = {};


/*!
 * ignore
 */

Types = Schema.Types;
var ObjectId = Schema.ObjectId = Types.ObjectId;

},{"./events":9,"./schema/index":18,"./utils":30,"./virtualtype":31}],14:[function(_dereq_,module,exports){
/*!
 * Module dependencies.
 */

var SchemaType = _dereq_('../schematype')
  , CastError = SchemaType.CastError
  , Types = {
        Boolean: _dereq_('./boolean')
      , Date: _dereq_('./date')
      , Number: _dereq_('./number')
      , String: _dereq_('./string')
      , ObjectId: _dereq_('./objectid')
    }
  , StorageArray = _dereq_('../types/array')
  , Mixed = _dereq_('./mixed')
  , EmbeddedDoc;

/**
 * Array SchemaType constructor
 *
 * @param {String} key
 * @param {SchemaType} cast
 * @param {Object} options
 * @inherits SchemaType
 * @api private
 */
function SchemaArray (key, cast, options) {
  if (cast) {
    var castOptions = {};

    if ('Object' === cast.constructor.name) {
      if (cast.type) {
        // support { type: Woot }
        castOptions = _.clone( cast ); // do not alter user arguments
        delete castOptions.type;
        cast = cast.type;
      } else {
        cast = Mixed;
      }
    }

    // support { type: 'String' }
    var name = 'string' == typeof cast
      ? cast
      : cast.name;

    var caster = name in Types
      ? Types[name]
      : cast;

    this.casterConstructor = caster;
    this.caster = new caster(null, castOptions);

    // lazy load
    EmbeddedDoc || (EmbeddedDoc = _dereq_('../types/embedded'));

    if (!(this.caster instanceof EmbeddedDoc)) {
      this.caster.path = key;
    }
  }

  SchemaType.call(this, key, options);

  var self = this
    , defaultArr
    , fn;

  if (this.defaultValue) {
    defaultArr = this.defaultValue;
    fn = 'function' == typeof defaultArr;
  }

  this.default(function(){
    var arr = fn ? defaultArr() : defaultArr || [];
    return new StorageArray(arr, self.path, this);
  });
}


/*!
 * Inherits from SchemaType.
 */
SchemaArray.prototype.__proto__ = SchemaType.prototype;

/**
 * Check required
 *
 * @param {Array} value
 * @api private
 */
SchemaArray.prototype.checkRequired = function (value) {
  return !!(value && value.length);
};

/**
 * Overrides the getters application for the population special-case
 *
 * @param {Object} value
 * @param {Object} scope
 * @api private
 */
SchemaArray.prototype.applyGetters = function (value, scope) {
  if (this.caster.options && this.caster.options.ref) {
    // means the object id was populated
    return value;
  }

  return SchemaType.prototype.applyGetters.call(this, value, scope);
};

/**
 * Casts values for set().
 *
 * @param {Object} value
 * @param {Document} doc document that triggers the casting
 * @param {Boolean} init whether this is an initialization cast
 * @api private
 */
SchemaArray.prototype.cast = function ( value, doc, init ) {
  if (Array.isArray(value)) {
    if (!(value instanceof StorageArray)) {
      value = new StorageArray(value, this.path, doc);
    }

    if (this.caster) {
      try {
        for (var i = 0, l = value.length; i < l; i++) {
          value[i] = this.caster.cast(value[i], doc, init);
        }
      } catch (e) {
        // rethrow
        throw new CastError(e.type, value, this.path);
      }
    }

    return value;
  } else {
    return this.cast([value], doc, init);
  }
};

/*!
 * Module exports.
 */

module.exports = SchemaArray;

},{"../schematype":23,"../types/array":25,"../types/embedded":27,"./boolean":15,"./date":16,"./mixed":19,"./number":20,"./objectid":21,"./string":22}],15:[function(_dereq_,module,exports){
/*!
 * Module dependencies.
 */

var SchemaType = _dereq_('../schematype');

/**
 * Boolean SchemaType constructor.
 *
 * @param {String} path
 * @param {Object} options
 * @inherits SchemaType
 * @api private
 */
function BooleanSchema (path, options) {
  SchemaType.call(this, path, options);
}

/*!
 * Inherits from SchemaType.
 */
BooleanSchema.prototype.__proto__ = SchemaType.prototype;

/**
 * Required validator
 *
 * @api private
 */
BooleanSchema.prototype.checkRequired = function (value) {
  return value === true || value === false;
};

/**
 * Casts to boolean
 *
 * @param {Object} value
 * @api private
 */
BooleanSchema.prototype.cast = function (value) {
  if (null === value) return value;
  if ('0' === value) return false;
  if ('true' === value) return true;
  if ('false' === value) return false;
  return !! value;
};

/*!
 * Module exports.
 */

module.exports = BooleanSchema;

},{"../schematype":23}],16:[function(_dereq_,module,exports){
/*!
 * Module requirements.
 */

var SchemaType = _dereq_('../schematype');
var CastError = SchemaType.CastError;

/**
 * Date SchemaType constructor.
 *
 * @param {String} key
 * @param {Object} options
 * @inherits SchemaType
 * @api private
 */

function DateSchema (key, options) {
  SchemaType.call(this, key, options);
}

/*!
 * Inherits from SchemaType.
 */
DateSchema.prototype.__proto__ = SchemaType.prototype;

/**
 * Required validator for date
 *
 * @api private
 */
DateSchema.prototype.checkRequired = function (value) {
  return value instanceof Date;
};

/**
 * Casts to date
 *
 * @param {Object} value to cast
 * @api private
 */
DateSchema.prototype.cast = function (value) {
  if (value === null || value === '')
    return null;

  if (value instanceof Date)
    return value;

  var date;

  // support for timestamps
  if (value instanceof Number || 'number' == typeof value
      || String(value) == Number(value))
    date = new Date(Number(value));

  // support for date strings
  else if (value.toString)
    date = new Date(value.toString());

  if (date.toString() != 'Invalid Date')
    return date;

  throw new CastError('date', value, this.path );
};

/*!
 * Module exports.
 */

module.exports = DateSchema;

},{"../schematype":23}],17:[function(_dereq_,module,exports){

/*!
 * Module dependencies.
 */

var SchemaType = _dereq_('../schematype')
  , ArrayType = _dereq_('./array')
  , StorageDocumentArray = _dereq_('../types/documentarray')
  , Subdocument = _dereq_('../types/embedded')
  , Document = _dereq_('../document');

/**
 * SubdocsArray SchemaType constructor
 *
 * @param {String} key
 * @param {Schema} schema
 * @param {Object} options
 * @inherits SchemaArray
 * @api private
 */
function DocumentArray (key, schema, options) {

  // compile an embedded document for this schema
  function EmbeddedDocument () {
    Subdocument.apply( this, arguments );
  }

  EmbeddedDocument.prototype.__proto__ = Subdocument.prototype;
  EmbeddedDocument.prototype.$__setSchema( schema );

  // apply methods
  for (var i in schema.methods) {
    EmbeddedDocument.prototype[i] = schema.methods[i];
  }

  // apply statics
  for (var i in schema.statics) {
    EmbeddedDocument[i] = schema.statics[i];
  }

  EmbeddedDocument.options = options;
  this.schema = schema;

  ArrayType.call(this, key, EmbeddedDocument, options);

  this.schema = schema;
  var path = this.path;
  var fn = this.defaultValue;

  this.default(function(){
    var arr = fn.call(this);
    if (!Array.isArray(arr)) arr = [arr];
    return new StorageDocumentArray(arr, path, this);
  });
}

/*!
 * Inherits from ArrayType.
 */
DocumentArray.prototype.__proto__ = ArrayType.prototype;

/**
 * Performs local validations first, then validations on each embedded doc
 *
 * @api private
 */
DocumentArray.prototype.doValidate = function (array, fn, scope) {
  var self = this;

  SchemaType.prototype.doValidate.call(this, array, function (err) {
    if (err) return fn(err);

    var count = array && array.length
      , error;

    if (!count) return fn();

    // handle sparse arrays, do not use array.forEach which does not
    // iterate over sparse elements yet reports array.length including
    // them :(

    for (var i = 0, len = count; i < len; ++i) {
      // sidestep sparse entries
      var doc = array[i];
      if (!doc) {
        --count || fn();
        continue;
      }

      ;(function (i) {
        doc.validate(function (err) {
          if (err && !error) {
            // rewrite the key
            err.key = self.key + '.' + i + '.' + err.key;
            return fn(error = err);
          }
          --count || fn();
        });
      })(i);
    }
  }, scope);
};

/**
 * Casts contents
 *
 * @param {Object} value
 * @param {Document} doc that triggers the casting
 * @api private
 */
DocumentArray.prototype.cast = function (value, doc, init, prev) {
  var selected
    , subdoc
    , i;

  if (!Array.isArray(value)) {
    return this.cast([value], doc, init, prev);
  }

  if (!(value instanceof StorageDocumentArray)) {
    value = new StorageDocumentArray(value, this.path, doc);
    if (prev && prev._handlers) {
      for (var key in prev._handlers) {
        doc.off(key, prev._handlers[key]);
      }
    }
  }

  i = value.length;

  while (i--) {
    if (!(value[i] instanceof Subdocument) && value[i]) {
      if (init) {
        selected || (selected = scopePaths(this, doc.$__.selected, init));
        subdoc = new this.casterConstructor(null, value, true, selected);
        value[i] = subdoc.init(value[i]);
      } else {
        try {
          subdoc = prev.id(value[i]._id);
        } catch(e) {}

        if (prev && subdoc) {
          // handle resetting doc with existing id but differing data
          // doc.array = [{ doc: 'val' }]
          subdoc.set(value[i]);
        } else {
          subdoc = new this.casterConstructor(value[i], value);
        }

        // if set() is hooked it will have no return value
        // see gh-746
        value[i] = subdoc;
      }
    }
  }

  return value;
};

/*!
 * Scopes paths selected in a query to this array.
 * Necessary for proper default application of subdocument values.
 *
 * @param {DocumentArray} array - the array to scope `fields` paths
 * @param {Object|undefined} fields - the root fields selected in the query
 * @param {Boolean|undefined} init - if we are being created part of a query result
 */
function scopePaths (array, fields, init) {
  if (!(init && fields)) return undefined;

  var path = array.path + '.'
    , keys = Object.keys(fields)
    , i = keys.length
    , selected = {}
    , hasKeys
    , key;

  while (i--) {
    key = keys[i];
    if (0 === key.indexOf(path)) {
      hasKeys || (hasKeys = true);
      selected[key.substring(path.length)] = fields[key];
    }
  }

  return hasKeys && selected || undefined;
}

/*!
 * Module exports.
 */

module.exports = DocumentArray;

},{"../document":3,"../schematype":23,"../types/documentarray":26,"../types/embedded":27,"./array":14}],18:[function(_dereq_,module,exports){

/*!
 * Module exports.
 */

exports.String = _dereq_('./string');

exports.Number = _dereq_('./number');

exports.Boolean = _dereq_('./boolean');

exports.DocumentArray = _dereq_('./documentarray');

exports.Array = _dereq_('./array');

exports.Date = _dereq_('./date');

exports.ObjectId = _dereq_('./objectid');

exports.Mixed = _dereq_('./mixed');

// alias

exports.Oid = exports.ObjectId;
exports.Object = exports.Mixed;
exports.Bool = exports.Boolean;

},{"./array":14,"./boolean":15,"./date":16,"./documentarray":17,"./mixed":19,"./number":20,"./objectid":21,"./string":22}],19:[function(_dereq_,module,exports){
/*!
 * Module dependencies.
 */

var SchemaType = _dereq_('../schematype');

/**
 * Mixed SchemaType constructor.
 *
 * @param {String} path
 * @param {Object} options
 * @inherits SchemaType
 * @api private
 */
function Mixed (path, options) {
  if (options && options.default) {
    var def = options.default;
    if (Array.isArray(def) && 0 === def.length) {
      // make sure empty array defaults are handled
      options.default = Array;
    } else if (!options.shared &&
               _.isPlainObject(def) &&
               0 === Object.keys(def).length) {
      // prevent odd "shared" objects between documents
      options.default = function () {
        return {}
      }
    }
  }

  SchemaType.call(this, path, options);
}

/*!
 * Inherits from SchemaType.
 */
Mixed.prototype.__proto__ = SchemaType.prototype;

/**
 * Required validator
 *
 * @api private
 */
Mixed.prototype.checkRequired = function (val) {
  return (val !== undefined) && (val !== null);
};

/**
 * Casts `val` for Mixed.
 *
 * _this is a no-op_
 *
 * @param {Object} value to cast
 * @api private
 */
Mixed.prototype.cast = function (val) {
  return val;
};

/*!
 * Module exports.
 */

module.exports = Mixed;

},{"../schematype":23}],20:[function(_dereq_,module,exports){
/*!
 * Module requirements.
 */

var SchemaType = _dereq_('../schematype')
  , CastError = SchemaType.CastError
  , errorMessages = _dereq_('../error').messages;

/**
 * Number SchemaType constructor.
 *
 * @param {String} key
 * @param {Object} options
 * @inherits SchemaType
 * @api private
 */
function NumberSchema (key, options) {
  SchemaType.call(this, key, options, 'Number');
}

/*!
 * Inherits from SchemaType.
 */
NumberSchema.prototype.__proto__ = SchemaType.prototype;

/**
 * Required validator for number
 *
 * @api private
 */
NumberSchema.prototype.checkRequired = function ( value ) {
  if ( SchemaType._isRef( this, value ) ) {
    return null != value;
  } else {
    return typeof value == 'number' || value instanceof Number;
  }
};

/**
 * Sets a minimum number validator.
 *
 * ####Example:
 *
 *     var s = new Schema({ n: { type: Number, min: 10 })
 *     var M = db.model('M', s)
 *     var m = new M({ n: 9 })
 *     m.save(function (err) {
 *       console.error(err) // validator error
 *       m.n = 10;
 *       m.save() // success
 *     })
 *
 *     // custom error messages
 *     // We can also use the special {MIN} token which will be replaced with the invalid value
 *     var min = [10, 'The value of path `{PATH}` ({VALUE}) is beneath the limit ({MIN}).'];
 *     var schema = new Schema({ n: { type: Number, min: min })
 *     var M = mongoose.model('Measurement', schema);
 *     var s= new M({ n: 4 });
 *     s.validate(function (err) {
 *       console.log(String(err)) // ValidationError: The value of path `n` (4) is beneath the limit (10).
 *     })
 *
 * @param {Number} value minimum number
 * @param {String} [message] optional custom error message
 * @return {SchemaType} this
 * @see Customized Error Messages #error_messages_MongooseError-messages
 * @api public
 */
NumberSchema.prototype.min = function (value, message) {
  if (this.minValidator) {
    this.validators = this.validators.filter(function (v) {
      return v[0] != this.minValidator;
    }, this);
  }

  if (null != value) {
    var msg = message || errorMessages.Number.min;
    msg = msg.replace(/{MIN}/, value);
    this.validators.push([this.minValidator = function (v) {
      return v === null || v >= value;
    }, msg, 'min']);
  }

  return this;
};

/**
 * Sets a maximum number validator.
 *
 * ####Example:
 *
 *     var s = new Schema({ n: { type: Number, max: 10 })
 *     var M = db.model('M', s)
 *     var m = new M({ n: 11 })
 *     m.save(function (err) {
 *       console.error(err) // validator error
 *       m.n = 10;
 *       m.save() // success
 *     })
 *
 *     // custom error messages
 *     // We can also use the special {MAX} token which will be replaced with the invalid value
 *     var max = [10, 'The value of path `{PATH}` ({VALUE}) exceeds the limit ({MAX}).'];
 *     var schema = new Schema({ n: { type: Number, max: max })
 *     var M = mongoose.model('Measurement', schema);
 *     var s= new M({ n: 4 });
 *     s.validate(function (err) {
 *       console.log(String(err)) // ValidationError: The value of path `n` (4) exceeds the limit (10).
 *     })
 *
 * @param {Number} value maximum number
 * @param {String} [message] optional custom error message
 * @return {SchemaType} this
 * @see Customized Error Messages #error_messages_MongooseError-messages
 * @api public
 */
NumberSchema.prototype.max = function (value, message) {
  if (this.maxValidator) {
    this.validators = this.validators.filter(function(v){
      return v[0] != this.maxValidator;
    }, this);
  }

  if (null != value) {
    var msg = message || errorMessages.Number.max;
    msg = msg.replace(/{MAX}/, value);
    this.validators.push([this.maxValidator = function(v){
      return v === null || v <= value;
    }, msg, 'max']);
  }

  return this;
};

/**
 * Casts to number
 *
 * @param {Object} value value to cast
 * @api private
 */
NumberSchema.prototype.cast = function ( value ) {
  var val = value && value._id
    ? value._id // documents
    : value;

  if (!isNaN(val)){
    if (null === val) return val;
    if ('' === val) return null;
    if ('string' == typeof val) val = Number(val);
    if (val instanceof Number) return val
    if ('number' == typeof val) return val;
    if (val.toString && !Array.isArray(val) &&
        val.toString() == Number(val)) {
      return new Number(val);
    }
  }

  throw new CastError('number', value, this.path);
};

/*!
 * Module exports.
 */

module.exports = NumberSchema;

},{"../error":4,"../schematype":23}],21:[function(_dereq_,module,exports){
/*!
 * Module dependencies.
 */

var SchemaType = _dereq_('../schematype')
  , CastError = SchemaType.CastError
  , oid = _dereq_('../types/objectid')
  , utils = _dereq_('../utils')
  , Document;

/**
 * ObjectId SchemaType constructor.
 *
 * @param {String} key
 * @param {Object} options
 * @inherits SchemaType
 * @api private
 */

function ObjectId (key, options) {
  SchemaType.call(this, key, options, 'ObjectId');
}

/*!
 * Inherits from SchemaType.
 */

ObjectId.prototype.__proto__ = SchemaType.prototype;

/**
 * Adds an auto-generated ObjectId default if turnOn is true.
 * @param {Boolean} turnOn auto generated ObjectId defaults
 * @api public
 * @return {SchemaType} this
 */
ObjectId.prototype.auto = function ( turnOn ) {
  if ( turnOn ) {
    this.default( defaultId );
    this.set( resetId )
  }

  return this;
};

/**
 * Check required
 *
 * @api private
 */
ObjectId.prototype.checkRequired = function ( value ) {
  if (SchemaType._isRef( this, value )) {
    return null != value;
  } else {
    return value instanceof oid;
  }
};

/**
 * Casts to ObjectId
 *
 * @param {Object} value
 * @api private
 */
ObjectId.prototype.cast = function ( value ) {
  if ( SchemaType._isRef( this, value ) ) {
    // wait! we may need to cast this to a document

    if (null == value) {
      return value;
    }

    // lazy load
    Document || (Document = _dereq_('./../document'));

    if (value instanceof Document) {
      value.$__.wasPopulated = true;
      return value;
    }

    // setting a populated path
    if (value instanceof oid ) {
      return value;
    } else if ( !_.isPlainObject( value ) ) {
      throw new CastError('ObjectId', value, this.path);
    }

    // Нужно создать документ по схеме, указанной в ссылке
    var schema = this.options.ref;
    if ( !schema ){
      throw new TypeError('При ссылке (ref) на документ ' +
        'нужно указывать схему, по которой этот документ создавать');
    }

    var doc = new Document( value, undefined, storage.schemas[ schema ] );
    doc.$__.wasPopulated = true;

    return doc;
  }

  if (value === null) return value;

  if (value instanceof oid)
    return value;

  if ( value._id && value._id instanceof oid )
    return value._id;

  if (value.toString) {
    try {
      return new oid( value.toString() );
    } catch (err) {
      throw new CastError('ObjectId', value, this.path);
    }
  }

  throw new CastError('ObjectId', value, this.path);
};

/*!
 * ignore
 */
function defaultId () {
  return new oid();
}

function resetId (v) {
  this.$__._id = null;
  return v;
}

/*!
 * Module exports.
 */

module.exports = ObjectId;

},{"../schematype":23,"../types/objectid":29,"../utils":30,"./../document":3}],22:[function(_dereq_,module,exports){
/*!
 * Module dependencies.
 */

var SchemaType = _dereq_('../schematype')
  , CastError = SchemaType.CastError
  , errorMessages = _dereq_('../error').messages;

/**
 * String SchemaType constructor.
 *
 * @param {String} key
 * @param {Object} options
 * @inherits SchemaType
 * @api private
 */

function StringSchema (key, options) {
  this.enumValues = [];
  this.regExp = null;
  SchemaType.call(this, key, options, 'String');
}

/*!
 * Inherits from SchemaType.
 */
StringSchema.prototype.__proto__ = SchemaType.prototype;

/**
 * Adds an enum validator
 *
 * ####Example:
 *
 *     var states = 'opening open closing closed'.split(' ')
 *     var s = new Schema({ state: { type: String, enum: states }})
 *     var M = db.model('M', s)
 *     var m = new M({ state: 'invalid' })
 *     m.save(function (err) {
 *       console.error(String(err)) // ValidationError: `invalid` is not a valid enum value for path `state`.
 *       m.state = 'open'
 *       m.save(callback) // success
 *     })
 *
 *     // or with custom error messages
 *     var enu = {
 *       values: 'opening open closing closed'.split(' '),
 *       message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
 *     }
 *     var s = new Schema({ state: { type: String, enum: enu })
 *     var M = db.model('M', s)
 *     var m = new M({ state: 'invalid' })
 *     m.save(function (err) {
 *       console.error(String(err)) // ValidationError: enum validator failed for path `state` with value `invalid`
 *       m.state = 'open'
 *       m.save(callback) // success
 *     })
 *
 * @param {String|Object} [args...] enumeration values
 * @return {SchemaType} this
 * @see Customized Error Messages #error_messages_MongooseError-messages
 * @api public
 */
StringSchema.prototype.enum = function () {
  if (this.enumValidator) {
    this.validators = this.validators.filter(function(v){
      return v[0] != this.enumValidator;
    }, this);
    this.enumValidator = false;
  }

  if (undefined === arguments[0] || false === arguments[0]) {
    return this;
  }

  var values;
  var errorMessage;

  if (_.isPlainObject(arguments[0])) {
    values = arguments[0].values;
    errorMessage = arguments[0].message;
  } else {
    values = arguments;
    errorMessage = errorMessages.String.enum;
  }

  for (var i = 0; i < values.length; i++) {
    if (undefined !== values[i]) {
      this.enumValues.push(this.cast(values[i]));
    }
  }

  var vals = this.enumValues;
  this.enumValidator = function (v) {
    return undefined === v || ~vals.indexOf(v);
  };
  this.validators.push([this.enumValidator, errorMessage, 'enum']);

  return this;
};

/**
 * Adds a lowercase setter.
 *
 * ####Example:
 *
 *     var s = new Schema({ email: { type: String, lowercase: true }})
 *     var M = db.model('M', s);
 *     var m = new M({ email: 'SomeEmail@example.COM' });
 *     console.log(m.email) // someemail@example.com
 *
 * @api public
 * @return {SchemaType} this
 */
StringSchema.prototype.lowercase = function () {
  return this.set(function (v, self) {
    if ('string' != typeof v) v = self.cast(v);
    if (v) return v.toLowerCase();
    return v;
  });
};

/**
 * Adds an uppercase setter.
 *
 * ####Example:
 *
 *     var s = new Schema({ caps: { type: String, uppercase: true }})
 *     var M = db.model('M', s);
 *     var m = new M({ caps: 'an example' });
 *     console.log(m.caps) // AN EXAMPLE
 *
 * @api public
 * @return {SchemaType} this
 */
StringSchema.prototype.uppercase = function () {
  return this.set(function (v, self) {
    if ('string' != typeof v) v = self.cast(v);
    if (v) return v.toUpperCase();
    return v;
  });
};

/**
 * Adds a trim setter.
 *
 * The string value will be trimmed when set.
 *
 * ####Example:
 *
 *     var s = new Schema({ name: { type: String, trim: true }})
 *     var M = db.model('M', s)
 *     var string = ' some name '
 *     console.log(string.length) // 11
 *     var m = new M({ name: string })
 *     console.log(m.name.length) // 9
 *
 * @api public
 * @return {SchemaType} this
 */
StringSchema.prototype.trim = function () {
  return this.set(function (v, self) {
    if ('string' != typeof v) v = self.cast(v);
    if (v) return v.trim();
    return v;
  });
};

/**
 * Sets a regexp validator.
 *
 * Any value that does not pass `regExp`.test(val) will fail validation.
 *
 * ####Example:
 *
 *     var s = new Schema({ name: { type: String, match: /^a/ }})
 *     var M = db.model('M', s)
 *     var m = new M({ name: 'I am invalid' })
 *     m.validate(function (err) {
 *       console.error(String(err)) // "ValidationError: Path `name` is invalid (I am invalid)."
 *       m.name = 'apples'
 *       m.validate(function (err) {
 *         assert.ok(err) // success
 *       })
 *     })
 *
 *     // using a custom error message
 *     var match = [ /\.html$/, "That file doesn't end in .html ({VALUE})" ];
 *     var s = new Schema({ file: { type: String, match: match }})
 *     var M = db.model('M', s);
 *     var m = new M({ file: 'invalid' });
 *     m.validate(function (err) {
 *       console.log(String(err)) // "ValidationError: That file doesn't end in .html (invalid)"
 *     })
 *
 * Empty strings, `undefined`, and `null` values always pass the match validator. If you require these values, enable the `required` validator also.
 *
 *     var s = new Schema({ name: { type: String, match: /^a/, required: true }})
 *
 * @param {RegExp} regExp regular expression to test against
 * @param {String} [message] optional custom error message
 * @return {SchemaType} this
 * @see Customized Error Messages #error_messages_MongooseError-messages
 * @api public
 */
StringSchema.prototype.match = function match (regExp, message) {
  // yes, we allow multiple match validators

  var msg = message || errorMessages.String.match;

  function matchValidator (v){
    return null != v && '' !== v
      ? regExp.test(v)
      : true
  }

  this.validators.push([matchValidator, msg, 'regexp']);
  return this;
};

/**
 * Check required
 *
 * @param {String|null|undefined} value
 * @api private
 */
StringSchema.prototype.checkRequired = function checkRequired (value, doc) {
  if (SchemaType._isRef(this, value, doc, true)) {
    return null != value;
  } else {
    return (value instanceof String || typeof value == 'string') && value.length;
  }
};

/**
 * Casts to String
 *
 * @api private
 */
StringSchema.prototype.cast = function ( value ) {
  if ( value === null ) {
    return value;
  }

  if ('undefined' !== typeof value) {
    // handle documents being passed
    if (value._id && 'string' == typeof value._id) {
      return value._id;
    }
    if ( value.toString ) {
      return value.toString();
    }
  }

  throw new CastError('string', value, this.path);
};

/*!
 * Module exports.
 */

module.exports = StringSchema;

},{"../error":4,"../schematype":23}],23:[function(_dereq_,module,exports){
/*!
 * Module dependencies.
 */

var error = _dereq_('./error');
var errorMessages = error.messages;
var CastError = error.CastError;
var ValidatorError = error.ValidatorError;

/**
 * SchemaType constructor
 *
 * @param {String} path
 * @param {Object} [options]
 * @param {String} [instance]
 * @api public
 */

function SchemaType (path, options, instance) {
  this.path = path;
  this.instance = instance;
  this.validators = [];
  this.setters = [];
  this.getters = [];
  this.options = options;

  for (var i in options) if (this[i] && 'function' == typeof this[i]) {
    var opts = Array.isArray(options[i])
      ? options[i]
      : [options[i]];

    this[i].apply(this, opts);
  }
}

/**
 * Sets a default value for this SchemaType.
 *
 * ####Example:
 *
 *     var schema = new Schema({ n: { type: Number, default: 10 })
 *     var M = db.model('M', schema)
 *     var m = new M;
 *     console.log(m.n) // 10
 *
 * Defaults can be either `functions` which return the value to use as the default or the literal value itself. Either way, the value will be cast based on its schema type before being set during document creation.
 *
 * ####Example:
 *
 *     // values are cast:
 *     var schema = new Schema({ aNumber: Number, default: "4.815162342" })
 *     var M = db.model('M', schema)
 *     var m = new M;
 *     console.log(m.aNumber) // 4.815162342
 *
 *     // default unique objects for Mixed types:
 *     var schema = new Schema({ mixed: Schema.Types.Mixed });
 *     schema.path('mixed').default(function () {
 *       return {};
 *     });
 *
 *     // if we don't use a function to return object literals for Mixed defaults,
 *     // each document will receive a reference to the same object literal creating
 *     // a "shared" object instance:
 *     var schema = new Schema({ mixed: Schema.Types.Mixed });
 *     schema.path('mixed').default({});
 *     var M = db.model('M', schema);
 *     var m1 = new M;
 *     m1.mixed.added = 1;
 *     console.log(m1.mixed); // { added: 1 }
 *     var m2 = new M;
 *     console.log(m2.mixed); // { added: 1 }
 *
 * @param {Function|any} val the default value
 * @return {defaultValue}
 * @api public
 */
SchemaType.prototype.default = function (val) {
  if (1 === arguments.length) {
    this.defaultValue = typeof val === 'function'
      ? val
      : this.cast( val );

    return this;

  } else if ( arguments.length > 1 ) {
    this.defaultValue = _.toArray( arguments );
  }
  return this.defaultValue;
};

/**
 * Adds a setter to this schematype.
 *
 * ####Example:
 *
 *     function capitalize (val) {
 *       if ('string' != typeof val) val = '';
 *       return val.charAt(0).toUpperCase() + val.substring(1);
 *     }
 *
 *     // defining within the schema
 *     var s = new Schema({ name: { type: String, set: capitalize }})
 *
 *     // or by retreiving its SchemaType
 *     var s = new Schema({ name: String })
 *     s.path('name').set(capitalize)
 *
 * Setters allow you to transform the data before it gets to the raw mongodb document and is set as a value on an actual key.
 *
 * Suppose you are implementing user registration for a website. Users provide an email and password, which gets saved to mongodb. The email is a string that you will want to normalize to lower case, in order to avoid one email having more than one account -- e.g., otherwise, avenue@q.com can be registered for 2 accounts via avenue@q.com and AvEnUe@Q.CoM.
 *
 * You can set up email lower case normalization easily via a Mongoose setter.
 *
 *     function toLower (v) {
 *       return v.toLowerCase();
 *     }
 *
 *     var UserSchema = new Schema({
 *       email: { type: String, set: toLower }
 *     })
 *
 *     var User = db.model('User', UserSchema)
 *
 *     var user = new User({email: 'AVENUE@Q.COM'})
 *     console.log(user.email); // 'avenue@q.com'
 *
 *     // or
 *     var user = new User
 *     user.email = 'Avenue@Q.com'
 *     console.log(user.email) // 'avenue@q.com'
 *
 * As you can see above, setters allow you to transform the data before it gets to the raw mongodb document and is set as a value on an actual key.
 *
 * _NOTE: we could have also just used the built-in `lowercase: true` SchemaType option instead of defining our own function._
 *
 *     new Schema({ email: { type: String, lowercase: true }})
 *
 * Setters are also passed a second argument, the schematype on which the setter was defined. This allows for tailored behavior based on options passed in the schema.
 *
 *     function inspector (val, schematype) {
 *       if (schematype.options.required) {
 *         return schematype.path + ' is required';
 *       } else {
 *         return val;
 *       }
 *     }
 *
 *     var VirusSchema = new Schema({
 *       name: { type: String, required: true, set: inspector },
 *       taxonomy: { type: String, set: inspector }
 *     })
 *
 *     var Virus = db.model('Virus', VirusSchema);
 *     var v = new Virus({ name: 'Parvoviridae', taxonomy: 'Parvovirinae' });
 *
 *     console.log(v.name);     // name is required
 *     console.log(v.taxonomy); // Parvovirinae
 *
 * @param {Function} fn
 * @return {SchemaType} this
 * @api public
 */
SchemaType.prototype.set = function (fn) {
  if ('function' != typeof fn)
    throw new TypeError('A setter must be a function.');
  this.setters.push(fn);
  return this;
};

/**
 * Adds a getter to this schematype.
 *
 * ####Example:
 *
 *     function dob (val) {
 *       if (!val) return val;
 *       return (val.getMonth() + 1) + "/" + val.getDate() + "/" + val.getFullYear();
 *     }
 *
 *     // defining within the schema
 *     var s = new Schema({ born: { type: Date, get: dob })
 *
 *     // or by retreiving its SchemaType
 *     var s = new Schema({ born: Date })
 *     s.path('born').get(dob)
 *
 * Getters allow you to transform the representation of the data as it travels from the raw mongodb document to the value that you see.
 *
 * Suppose you are storing credit card numbers and you want to hide everything except the last 4 digits to the mongoose user. You can do so by defining a getter in the following way:
 *
 *     function obfuscate (cc) {
 *       return '****-****-****-' + cc.slice(cc.length-4, cc.length);
 *     }
 *
 *     var AccountSchema = new Schema({
 *       creditCardNumber: { type: String, get: obfuscate }
 *     });
 *
 *     var Account = db.model('Account', AccountSchema);
 *
 *     Account.findById(id, function (err, found) {
 *       console.log(found.creditCardNumber); // '****-****-****-1234'
 *     });
 *
 * Getters are also passed a second argument, the schematype on which the getter was defined. This allows for tailored behavior based on options passed in the schema.
 *
 *     function inspector (val, schematype) {
 *       if (schematype.options.required) {
 *         return schematype.path + ' is required';
 *       } else {
 *         return schematype.path + ' is not';
 *       }
 *     }
 *
 *     var VirusSchema = new Schema({
 *       name: { type: String, required: true, get: inspector },
 *       taxonomy: { type: String, get: inspector }
 *     })
 *
 *     var Virus = db.model('Virus', VirusSchema);
 *
 *     Virus.findById(id, function (err, virus) {
 *       console.log(virus.name);     // name is required
 *       console.log(virus.taxonomy); // taxonomy is not
 *     })
 *
 * @param {Function} fn
 * @return {SchemaType} this
 * @api public
 */
SchemaType.prototype.get = function (fn) {
  if ('function' != typeof fn)
    throw new TypeError('A getter must be a function.');
  this.getters.push(fn);
  return this;
};

/**
 * Adds validator(s) for this document path.
 *
 * Validators always receive the value to validate as their first argument and must return `Boolean`. Returning `false` means validation failed.
 *
 * The error message argument is optional. If not passed, the [default generic error message template](#error_messages_MongooseError-messages) will be used.
 *
 * ####Examples:
 *
 *     // make sure every value is equal to "something"
 *     function validator (val) {
 *       return val == 'something';
 *     }
 *     new Schema({ name: { type: String, validate: validator }});
 *
 *     // with a custom error message
 *
 *     var custom = [validator, 'Uh oh, {PATH} does not equal "something".']
 *     new Schema({ name: { type: String, validate: custom }});
 *
 *     // adding many validators at a time
 *
 *     var many = [
 *         { validator: validator, msg: 'uh oh' }
 *       , { validator: anotherValidator, msg: 'failed' }
 *     ]
 *     new Schema({ name: { type: String, validate: many }});
 *
 *     // or utilizing SchemaType methods directly:
 *
 *     var schema = new Schema({ name: 'string' });
 *     schema.path('name').validate(validator, 'validation of `{PATH}` failed with value `{VALUE}`');
 *
 * ####Error message templates:
 *
 * From the examples above, you may have noticed that error messages support baseic templating. There are a few other template keywords besides `{PATH}` and `{VALUE}` too. To find out more, details are available [here](#error_messages_MongooseError-messages)
 *
 * ####Asynchronous validation:
 *
 * Passing a validator function that receives two arguments tells mongoose that the validator is an asynchronous validator. The first argument passed to the validator function is the value being validated. The second argument is a callback function that must called when you finish validating the value and passed either `true` or `false` to communicate either success or failure respectively.
 *
 *     schema.path('name').validate(function (value, respond) {
 *       doStuff(value, function () {
 *         ...
 *         respond(false); // validation failed
 *       })
*      }, '{PATH} failed validation.');
*
 * You might use asynchronous validators to retreive other documents from the database to validate against or to meet other I/O bound validation needs.
 *
 * Validation occurs `pre('save')` or whenever you manually execute [document#validate](#document_Document-validate).
 *
 * If validation fails during `pre('save')` and no callback was passed to receive the error, an `error` event will be emitted on your Models associated db [connection](#connection_Connection), passing the validation error object along.
 *
 *     var conn = mongoose.createConnection(..);
 *     conn.on('error', handleError);
 *
 *     var Product = conn.model('Product', yourSchema);
 *     var dvd = new Product(..);
 *     dvd.save(); // emits error on the `conn` above
 *
 * If you desire handling these errors at the Model level, attach an `error` listener to your Model and the event will instead be emitted there.
 *
 *     // registering an error listener on the Model lets us handle errors more locally
 *     Product.on('error', handleError);
 *
 * @param {RegExp|Function|Object} obj validator
 * @param {String} [errorMsg] optional error message
 * @return {SchemaType} this
 * @api public
 */
SchemaType.prototype.validate = function (obj, message, type) {
  if ('function' == typeof obj || obj && 'RegExp' === obj.constructor.name) {
    if (!message) message = errorMessages.general.default;
    if (!type) type = 'user defined';
    this.validators.push([obj, message, type]);
    return this;
  }

  var i = arguments.length
    , arg;

  while (i--) {
    arg = arguments[i];
    if (!(arg && 'Object' == arg.constructor.name)) {
      var msg = 'Invalid validator. Received (' + typeof arg + ') '
        + arg
        + '. See http://mongoosejs.com/docs/api.html#schematype_SchemaType-validate';

      throw new Error(msg);
    }
    this.validate(arg.validator, arg.msg, arg.type);
  }

  return this;
};

/**
 * Adds a required validator to this schematype.
 *
 * ####Example:
 *
 *     var s = new Schema({ born: { type: Date, required: true })
 *
 *     // or with custom error message
 *
 *     var s = new Schema({ born: { type: Date, required: '{PATH} is required!' })
 *
 *     // or through the path API
 *
 *     Schema.path('name').required(true);
 *
 *     // with custom error messaging
 *
 *     Schema.path('name').required(true, 'grrr :( ');
 *
 *
 * @param {Boolean} required enable/disable the validator
 * @param {String} [message] optional custom error message
 * @return {SchemaType} this
 * @see Customized Error Messages #error_messages_MongooseError-messages
 * @api public
 */
SchemaType.prototype.required = function (required, message) {
  if (false === required) {
    this.validators = this.validators.filter(function (v) {
      return v[0] != this.requiredValidator;
    }, this);

    this.isRequired = false;
    return this;
  }

  var self = this;
  this.isRequired = true;

  this.requiredValidator = function (v) {
    // in here, `this` refers to the validating document.
    // no validation when this path wasn't selected in the query.
    if (this !== undefined && // специальная проверка из-за strict mode и особенности .call(undefined)
        'isSelected' in this &&
        !this.isSelected(self.path) &&
        !this.isModified(self.path)) return true;

    return self.checkRequired(v, this);
  };

  if ('string' == typeof required) {
    message = required;
    required = undefined;
  }

  var msg = message || errorMessages.general.required;
  this.validators.push([this.requiredValidator, msg, 'required']);

  return this;
};


/**
 * Gets the default value
 *
 * @param {Object} scope the scope which callback are executed
 * @param {Boolean} init
 * @api private
 */
SchemaType.prototype.getDefault = function (scope, init) {
  var ret = 'function' === typeof this.defaultValue
    ? this.defaultValue.call(scope)
    : this.defaultValue;

  if (null !== ret && undefined !== ret) {
    return this.cast(ret, scope, init);
  } else {
    return ret;
  }
};

/**
 * Applies setters
 *
 * @param {Object} value
 * @param {Object} scope
 * @param {Boolean} init
 * @api private
 */

SchemaType.prototype.applySetters = function (value, scope, init, priorVal) {
  if (SchemaType._isRef( this, value )) {
    return init
      ? value
      : this.cast(value, scope, init, priorVal);
  }

  var v = value
    , setters = this.setters
    , len = setters.length
    , caster = this.caster;

  if (Array.isArray(v) && caster && caster.setters) {
    for (var i = 0; i < v.length; i++) {
      v[i] = caster.applySetters(v[i], scope, init, priorVal);
    }
  }

  if (!len) {
    if (null === v || undefined === v) return v;
    return this.cast(v, scope, init, priorVal);
  }

  while (len--) {
    v = setters[len].call(scope, v, this);
  }

  if (null === v || undefined === v) return v;

  // do not cast until all setters are applied #665
  v = this.cast(v, scope, init, priorVal);

  return v;
};

/**
 * Applies getters to a value
 *
 * @param {Object} value
 * @param {Object} scope
 * @api private
 */
SchemaType.prototype.applyGetters = function( value, scope ){
  if ( SchemaType._isRef( this, value ) ) return value;

  var v = value
    , getters = this.getters
    , len = getters.length;

  if ( !len ) {
    return v;
  }

  while ( len-- ) {
    v = getters[ len ].call(scope, v, this);
  }

  return v;
};

/**
 * Performs a validation of `value` using the validators declared for this SchemaType.
 *
 * @param {any} value
 * @param {Function} callback
 * @param {Object} scope
 * @api private
 */
SchemaType.prototype.doValidate = function (value, callback, scope) {
  var err = false
    , path = this.path
    , count = this.validators.length;

  if (!count) return callback(null);

  function validate (ok, message, type, val) {
    if (err) return;
    if (ok === undefined || ok) {
      --count || callback(null);
    } else {
      callback(err = new ValidatorError(path, message, type, val));
    }
  }

  this.validators.forEach(function (v) {
    var validator = v[0]
      , message = v[1]
      , type = v[2];

    if (validator instanceof RegExp) {
      validate(validator.test(value), message, type, value);
    } else if ('function' === typeof validator) {
      if (2 === validator.length) {
        validator.call(scope, value, function (ok) {
          validate(ok, message, type, value);
        });
      } else {
        validate(validator.call(scope, value), message, type, value);
      }
    }
  });
};

/**
 * Determines if value is a valid Reference.
 *
 * На клиенте в качестве ссылки можно хранить как id, так и полные документы
 *
 * @param {SchemaType} self
 * @param {Object} value
 * @return {Boolean}
 * @api private
 */
SchemaType._isRef = function( self, value ){
  // fast path
  var ref = self.options && self.options.ref;

  if ( ref ) {
    if ( null == value ) return true;
    if ( _.isObject( value ) ) {
      return true;
    }
  }

  return false;
};

/*!
 * Module exports.
 */

module.exports = SchemaType;

SchemaType.CastError = CastError;

SchemaType.ValidatorError = ValidatorError;

},{"./error":4}],24:[function(_dereq_,module,exports){
/*!
 * StateMachine represents a minimal `interface` for the
 * constructors it builds via StateMachine.ctor(...).
 *
 * @api private
 */

var StateMachine = module.exports = function StateMachine () {
  this.paths = {};
  this.states = {};
};

/*!
 * StateMachine.ctor('state1', 'state2', ...)
 * A factory method for subclassing StateMachine.
 * The arguments are a list of states. For each state,
 * the constructor's prototype gets state transition
 * methods named after each state. These transition methods
 * place their path argument into the given state.
 *
 * @param {String} state
 * @param {String} [state]
 * @return {Function} subclass constructor
 * @private
 */

StateMachine.ctor = function () {
  var states = _.toArray(arguments);

  var ctor = function () {
    StateMachine.apply(this, arguments);
    this.stateNames = states;

    var i = states.length
      , state;

    while (i--) {
      state = states[i];
      this.states[state] = {};
    }
  };

  ctor.prototype.__proto__ = StateMachine.prototype;

  states.forEach(function (state) {
    // Changes the `path`'s state to `state`.
    ctor.prototype[state] = function (path) {
      this._changeState(path, state);
    }
  });

  return ctor;
};

/*!
 * This function is wrapped by the state change functions:
 *
 * - `require(path)`
 * - `modify(path)`
 * - `init(path)`
 *
 * @api private
 */

StateMachine.prototype._changeState = function _changeState (path, nextState) {
  var prevBucket = this.states[this.paths[path]];
  if (prevBucket) delete prevBucket[path];

  this.paths[path] = nextState;
  this.states[nextState][path] = true;
};

/*!
 * ignore
 */

StateMachine.prototype.clear = function clear (state) {
  var keys = Object.keys(this.states[state])
    , i = keys.length
    , path;

  while (i--) {
    path = keys[i];
    delete this.states[state][path];
    delete this.paths[path];
  }
};

/*!
 * Checks to see if at least one path is in the states passed in via `arguments`
 * e.g., this.some('required', 'inited')
 *
 * @param {String} state that we want to check for.
 * @private
 */

StateMachine.prototype.some = function some () {
  var self = this;
  var what = arguments.length ? arguments : this.stateNames;
  return Array.prototype.some.call(what, function (state) {
    return Object.keys(self.states[state]).length;
  });
};

/*!
 * This function builds the functions that get assigned to `forEach` and `map`,
 * since both of those methods share a lot of the same logic.
 *
 * @param {String} iterMethod is either 'forEach' or 'map'
 * @return {Function}
 * @api private
 */

StateMachine.prototype._iter = function _iter (iterMethod) {
  return function () {
    var numArgs = arguments.length
      , states = _.toArray(arguments).slice(0, numArgs-1)
      , callback = arguments[numArgs-1];

    if (!states.length) states = this.stateNames;

    var self = this;

    var paths = states.reduce(function (paths, state) {
      return paths.concat(Object.keys(self.states[state]));
    }, []);

    return paths[iterMethod](function (path, i, paths) {
      return callback(path, i, paths);
    });
  };
};

/*!
 * Iterates over the paths that belong to one of the parameter states.
 *
 * The function profile can look like:
 * this.forEach(state1, fn);         // iterates over all paths in state1
 * this.forEach(state1, state2, fn); // iterates over all paths in state1 or state2
 * this.forEach(fn);                 // iterates over all paths in all states
 *
 * @param {String} [state]
 * @param {String} [state]
 * @param {Function} callback
 * @private
 */

StateMachine.prototype.forEach = function forEach () {
  this.forEach = this._iter('forEach');
  return this.forEach.apply(this, arguments);
};

/*!
 * Maps over the paths that belong to one of the parameter states.
 *
 * The function profile can look like:
 * this.forEach(state1, fn);         // iterates over all paths in state1
 * this.forEach(state1, state2, fn); // iterates over all paths in state1 or state2
 * this.forEach(fn);                 // iterates over all paths in all states
 *
 * @param {String} [state]
 * @param {String} [state]
 * @param {Function} callback
 * @return {Array}
 * @private
 */

StateMachine.prototype.map = function map () {
  this.map = this._iter('map');
  return this.map.apply(this, arguments);
};


},{}],25:[function(_dereq_,module,exports){
//TODO: почистить код

/*!
 * Module dependencies.
 */

var EmbeddedDocument = _dereq_('./embedded');
var Document = _dereq_('../document');
var ObjectId = _dereq_('./objectid');
var utils = _dereq_('../utils');

/**
 * Storage Array constructor.
 *
 * ####NOTE:
 *
 * _Values always have to be passed to the constructor to initialize, otherwise `StorageArray#push` will mark the array as modified._
 *
 * @param {Array} values
 * @param {String} path
 * @param {Document} doc parent document
 * @api private
 * @inherits Array
 * @see http://bit.ly/f6CnZU
 */
function StorageArray (values, path, doc) {
  var arr = [];
  arr.push.apply(arr, values);
  arr.__proto__ = StorageArray.prototype;

  arr.validators = [];
  arr._path = path;

  if (doc) {
    arr._parent = doc;
    arr._schema = doc.schema.path(path);
  }

  return arr;
}

/*!
 * Inherit from Array
 */
StorageArray.prototype = new Array;

/**
 * Parent owner document
 *
 * @property _parent
 * @api private
 */
StorageArray.prototype._parent;

/**
 * Casts a member based on this arrays schema.
 *
 * @param {any} value
 * @return value the casted value
 * @api private
 */
StorageArray.prototype._cast = function ( value ) {
  var owner = this._owner;
  var populated = false;

  if (this._parent) {
    // if a populated array, we must cast to the same model
    // instance as specified in the original query.
    if (!owner) {
      owner = this._owner = this._parent.ownerDocument
        ? this._parent.ownerDocument()
        : this._parent;
    }

    populated = owner.populated(this._path, true);
  }

  if (populated && null != value) {
    // cast to the populated Models schema
    var Model = populated.options.model;

    // only objects are permitted so we can safely assume that
    // non-objects are to be interpreted as _id
    if ( value instanceof ObjectId || !_.isObject(value) ) {
      value = { _id: value };
    }

    value = new Model(value);
    return this._schema.caster.cast(value, this._parent, true)
  }

  return this._schema.caster.cast(value, this._parent, false)
};

/**
 * Marks this array as modified.
 *
 * If it bubbles up from an embedded document change, then it takes the following arguments (otherwise, takes 0 arguments)
 *
 * @param {EmbeddedDocument} embeddedDoc the embedded doc that invoked this method on the Array
 * @param {String} embeddedPath the path which changed in the embeddedDoc
 * @api private
 */
StorageArray.prototype._markModified = function (elem, embeddedPath) {
  var parent = this._parent
    , dirtyPath;

  if (parent) {
    dirtyPath = this._path;

    if (arguments.length) {
      if (null != embeddedPath) {
        // an embedded doc bubbled up the change
        dirtyPath = dirtyPath + '.' + this.indexOf(elem) + '.' + embeddedPath;
      } else {
        // directly set an index
        dirtyPath = dirtyPath + '.' + elem;
      }
    }

    parent.markModified(dirtyPath);
  }

  return this;
};

/**
 * Wraps [`Array#push`](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/push) with proper change tracking.
 *
 * @param {Object} [args...]
 * @api public
 */
StorageArray.prototype.push = function () {
  var values = [].map.call(arguments, this._cast, this)
    , ret = [].push.apply(this, values);

  this._markModified();
  return ret;
};

/**
 * Wraps [`Array#pop`](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/pop) with proper change tracking.
 *
 * ####Note:
 *
 * _marks the entire array as modified which will pass the entire thing to $set potentially overwritting any changes that happen between when you retrieved the object and when you save it._
 *
 * @see StorageArray#$pop #types_array_MongooseArray-%24pop
 * @api public
 */
StorageArray.prototype.pop = function () {
  var ret = [].pop.call(this);

  this._markModified();
  return ret;
};

/**
 * Wraps [`Array#shift`](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/unshift) with proper change tracking.
 *
 * ####Example:
 *
 *     doc.array = [2,3];
 *     var res = doc.array.shift();
 *     console.log(res) // 2
 *     console.log(doc.array) // [3]
 *
 * ####Note:
 *
 * _marks the entire array as modified, which if saved, will store it as a `$set` operation, potentially overwritting any changes that happen between when you retrieved the object and when you save it._
 *
 * @api public
 */
StorageArray.prototype.shift = function () {
  var ret = [].shift.call(this);

  this._markModified();
  return ret;
};

/**
 * Pulls items from the array atomically.
 *
 * ####Examples:
 *
 *     doc.array.pull(ObjectId)
 *     doc.array.pull({ _id: 'someId' })
 *     doc.array.pull(36)
 *     doc.array.pull('tag 1', 'tag 2')
 *
 * To remove a document from a subdocument array we may pass an object with a matching `_id`.
 *
 *     doc.subdocs.push({ _id: 4815162342 })
 *     doc.subdocs.pull({ _id: 4815162342 }) // removed
 *
 * Or we may passing the _id directly and let mongoose take care of it.
 *
 *     doc.subdocs.push({ _id: 4815162342 })
 *     doc.subdocs.pull(4815162342); // works
 *
 * @param {any} [args...]
 * @see mongodb http://www.mongodb.org/display/DOCS/Updating/#Updating-%24pull
 * @api public
 */
StorageArray.prototype.pull = function () {
  var values = [].map.call(arguments, this._cast, this)
    , cur = this._parent.get(this._path)
    , i = cur.length
    , mem;

  while (i--) {
    mem = cur[i];
    if (mem instanceof EmbeddedDocument) {
      if (values.some(function (v) { return v.equals(mem); } )) {
        [].splice.call(cur, i, 1);
      }
    } else if (~cur.indexOf.call(values, mem)) {
      [].splice.call(cur, i, 1);
    }
  }

  this._markModified();
  return this;
};

/**
 * Alias of [pull](#types_array_MongooseArray-pull)
 *
 * @see StorageArray#pull #types_array_MongooseArray-pull
 * @see mongodb http://www.mongodb.org/display/DOCS/Updating/#Updating-%24pull
 * @api public
 * @memberOf StorageArray
 * @method remove
 */
StorageArray.prototype.remove = StorageArray.prototype.pull;

/**
 * Wraps [`Array#splice`](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/splice) with proper change tracking and casting.
 *
 * ####Note:
 *
 * _marks the entire array as modified, which if saved, will store it as a `$set` operation, potentially overwritting any changes that happen between when you retrieved the object and when you save it._
 *
 * @api public
 */
StorageArray.prototype.splice = function splice () {
  var ret, vals, i;

  if (arguments.length) {
    vals = [];
    for (i = 0; i < arguments.length; ++i) {
      vals[i] = i < 2
        ? arguments[i]
        : this._cast(arguments[i]);
    }
    ret = [].splice.apply(this, vals);

    this._markModified();
  }

  return ret;
};

/**
 * Wraps [`Array#unshift`](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/unshift) with proper change tracking.
 *
 * ####Note:
 *
 * _marks the entire array as modified, which if saved, will store it as a `$set` operation, potentially overwritting any changes that happen between when you retrieved the object and when you save it._
 *
 * @api public
 */
StorageArray.prototype.unshift = function () {
  var values = [].map.call(arguments, this._cast, this);
  [].unshift.apply(this, values);

  this._markModified();
  return this.length;
};

/**
 * Wraps [`Array#sort`](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/sort) with proper change tracking.
 *
 * ####NOTE:
 *
 * _marks the entire array as modified, which if saved, will store it as a `$set` operation, potentially overwritting any changes that happen between when you retrieved the object and when you save it._
 *
 * @api public
 */
StorageArray.prototype.sort = function () {
  var ret = [].sort.apply(this, arguments);

  this._markModified();
  return ret;
};

/**
 * Adds values to the array if not already present.
 *
 * ####Example:
 *
 *     console.log(doc.array) // [2,3,4]
 *     var added = doc.array.addToSet(4,5);
 *     console.log(doc.array) // [2,3,4,5]
 *     console.log(added)     // [5]
 *
 * @param {any} [args...]
 * @return {Array} the values that were added
 * @api public
 */
StorageArray.prototype.addToSet = function addToSet () {
  var values = [].map.call(arguments, this._cast, this)
    , added = []
    , type = values[0] instanceof EmbeddedDocument ? 'doc' :
             values[0] instanceof Date ? 'date' :
             '';

  values.forEach(function (v) {
    var found;
    switch (type) {
      case 'doc':
        found = this.some(function(doc){ return doc.equals(v) });
        break;
      case 'date':
        var val = +v;
        found = this.some(function(d){ return +d === val });
        break;
      default:
        found = ~this.indexOf(v);
    }

    if (!found) {
      [].push.call(this, v);

      this._markModified();
      [].push.call(added, v);
    }
  }, this);

  return added;
};

/**
 * Sets the casted `val` at index `i` and marks the array modified.
 *
 * ####Example:
 *
 *     // given documents based on the following
 *     var Doc = mongoose.model('Doc', new Schema({ array: [Number] }));
 *
 *     var doc = new Doc({ array: [2,3,4] })
 *
 *     console.log(doc.array) // [2,3,4]
 *
 *     doc.array.set(1,"5");
 *     console.log(doc.array); // [2,5,4] // properly cast to number
 *     doc.save() // the change is saved
 *
 *     // VS not using array#set
 *     doc.array[1] = "5";
 *     console.log(doc.array); // [2,"5",4] // no casting
 *     doc.save() // change is not saved
 *
 * @return {Array} this
 * @api public
 */
StorageArray.prototype.set = function (i, val) {
  this[i] = this._cast(val);
  this._markModified(i);
  return this;
};

/**
 * Returns a native js Array.
 *
 * @param {Object} options
 * @return {Array}
 * @api public
 */
StorageArray.prototype.toObject = function (options) {
  if (options && options.depopulate) {
    return this.map(function (doc) {
      return doc instanceof Document
        ? doc.toObject(options)
        : doc
    });
  }

  return this.slice();
};


/**
 * Return the index of `obj` or `-1` if not found.
 *
 * @param {Object} obj the item to look for
 * @return {Number}
 * @api public
 */
StorageArray.prototype.indexOf = function indexOf (obj) {
  if (obj instanceof ObjectId) obj = obj.toString();
  for (var i = 0, len = this.length; i < len; ++i) {
    if (obj == this[i])
      return i;
  }
  return -1;
};

/*!
 * Module exports.
 */

module.exports = StorageArray;

},{"../document":3,"../utils":30,"./embedded":27,"./objectid":29}],26:[function(_dereq_,module,exports){
/*!
 * Module dependencies.
 */

var StorageArray = _dereq_('./array')
  , ObjectId = _dereq_('./objectid')
  , ObjectIdSchema = _dereq_('../schema/objectid')
  , utils = _dereq_('../utils')
  , Document = _dereq_('../document');

/**
 * DocumentArray constructor
 *
 * @param {Array} values
 * @param {String} path the path to this array
 * @param {Document} doc parent document
 * @api private
 * @return {StorageDocumentArray}
 * @inherits StorageArray
 * @see http://bit.ly/f6CnZU
 * TODO: подчистить код
 *
 * Весь нужный код скопирован
 */
function StorageDocumentArray (values, path, doc) {
  var arr = [];

  // Values always have to be passed to the constructor to initialize, since
  // otherwise StorageArray#push will mark the array as modified to the parent.
  arr.push.apply(arr, values);
  arr.__proto__ = StorageDocumentArray.prototype;

  arr.validators = [];
  arr._path = path;

  if (doc) {
    arr._parent = doc;
    arr._schema = doc.schema.path(path);
    arr._handlers = {
      isNew: arr.notify('isNew'),
      save: arr.notify('save')
    }
    // Проброс изменения состояния в поддокумент
    doc.on('save', arr._handlers.save);
    doc.on('isNew', arr._handlers.isNew);
  }

  return arr;
}

/*!
 * Inherits from StorageArray
 */
StorageDocumentArray.prototype.__proto__ = StorageArray.prototype;

/**
 * Overrides StorageArray#cast
 *
 * @api private
 */
StorageDocumentArray.prototype._cast = function (value) {
  if (value instanceof this._schema.casterConstructor) {
    if (!(value.__parent && value.__parentArray)) {
      // value may have been created using array.create()
      value.__parent = this._parent;
      value.__parentArray = this;
    }
    return value;
  }

  // handle cast('string') or cast(ObjectId) etc.
  // only objects are permitted so we can safely assume that
  // non-objects are to be interpreted as _id
  if ( value instanceof ObjectId || !_.isObject(value) ) {
    value = { _id: value };
  }

  return new this._schema.casterConstructor(value, this);
};

/**
 * Searches array items for the first document with a matching _id.
 *
 * ####Example:
 *
 *     var embeddedDoc = m.array.id(some_id);
 *
 * @return {EmbeddedDocument|null} the subdocument or null if not found.
 * @param {ObjectId|String|Number} id
 * @TODO cast to the _id based on schema for proper comparison
 * @api public
 */
StorageDocumentArray.prototype.id = function (id) {
  var casted
    , sid
    , _id;

  try {
    var casted_ = ObjectIdSchema.prototype.cast.call({}, id);
    if (casted_) casted = String(casted_);
  } catch (e) {
    casted = null;
  }

  for (var i = 0, l = this.length; i < l; i++) {
    _id = this[i].get('_id');

    if (_id instanceof Document) {
      sid || (sid = String(id));
      if (sid == _id._id) return this[i];
    } else if (!(_id instanceof ObjectId)) {
      sid || (sid = String(id));
      if (sid == _id) return this[i];
    } else if (casted == _id) {
      return this[i];
    }
  }

  return null;
};

/**
 * Returns a native js Array of plain js objects
 *
 * ####NOTE:
 *
 * _Each sub-document is converted to a plain object by calling its `#toObject` method._
 *
 * @param {Object} [options] optional options to pass to each documents `toObject` method call during conversion
 * @return {Array}
 * @api public
 */

StorageDocumentArray.prototype.toObject = function (options) {
  return this.map(function (doc) {
    return doc && doc.toObject(options) || null;
  });
};

/**
 * Creates a subdocument casted to this schema.
 *
 * This is the same subdocument constructor used for casting.
 *
 * @param {Object} obj the value to cast to this arrays SubDocument schema
 * @api public
 */

StorageDocumentArray.prototype.create = function (obj) {
  return new this._schema.casterConstructor(obj);
};

/**
 * Creates a fn that notifies all child docs of `event`.
 *
 * @param {String} event
 * @return {Function}
 * @api private
 */
StorageDocumentArray.prototype.notify = function notify (event) {
  var self = this;
  return function notify (val) {
    var i = self.length;
    while (i--) {
      if (!self[i]) continue;
      self[i].trigger(event, val);
    }
  }
};

/*!
 * Module exports.
 */

module.exports = StorageDocumentArray;

},{"../document":3,"../schema/objectid":21,"../utils":30,"./array":25,"./objectid":29}],27:[function(_dereq_,module,exports){
/*!
 * Module dependencies.
 */

var Document = _dereq_('../document');

/**
 * EmbeddedDocument constructor.
 *
 * @param {Object} data js object returned from the db
 * @param {MongooseDocumentArray} parentArr the parent array of this document
 * @inherits Document
 * @api private
 */
function EmbeddedDocument ( data, parentArr ) {
  if (parentArr) {
    this.__parentArray = parentArr;
    this.__parent = parentArr._parent;
  } else {
    this.__parentArray = undefined;
    this.__parent = undefined;
  }

  Document.call( this, data, undefined );

  // Нужно для проброса изменения значения из родительского документа, например при сохранении
  var self = this;
  this.on('isNew', function (val) {
    self.isNew = val;
  });
}

/*!
 * Inherit from Document
 */

EmbeddedDocument.prototype.__proto__ = Document.prototype;

/**
 * Marks the embedded doc modified.
 *
 * ####Example:
 *
 *     var doc = blogpost.comments.id(hexstring);
 *     doc.mixed.type = 'changed';
 *     doc.markModified('mixed.type');
 *
 * @param {String} path the path which changed
 * @api public
 */
EmbeddedDocument.prototype.markModified = function (path) {
  if (!this.__parentArray) return;

  this.$__.activePaths.modify(path);

  if (this.isNew) {
    // Mark the WHOLE parent array as modified
    // if this is a new document (i.e., we are initializing
    // a document),
    this.__parentArray._markModified();
  } else
    this.__parentArray._markModified(this, path);
};

/**
 * Used as a stub for [hooks.js](https://github.com/bnoguchi/hooks-js/tree/31ec571cef0332e21121ee7157e0cf9728572cc3)
 *
 * ####NOTE:
 *
 * _This is a no-op. Does not actually save the doc to the db._
 *
 * @param {Function} [fn]
 * @return {Promise} resolved Promise
 * @api private
 */

EmbeddedDocument.prototype.save = function (fn) {
  var promise = $.Deferred().done(fn);
  promise.resolve();
  return promise;
}

/**
 * Removes the subdocument from its parent array.
 *
 * @param {Function} [fn]
 * @api public
 */
EmbeddedDocument.prototype.remove = function (fn) {
  if (!this.__parentArray) return this;

  var _id;
  if (!this.willRemove) {
    _id = this._doc._id;
    if (!_id) {
      throw new Error('For your own good, Mongoose does not know ' +
                      'how to remove an EmbeddedDocument that has no _id');
    }
    this.__parentArray.pull({ _id: _id });
    this.willRemove = true;
  }

  if (fn)
    fn(null);

  return this;
};

/**
 * Override #update method of parent documents.
 * @api private
 */
EmbeddedDocument.prototype.update = function () {
  throw new Error('The #update method is not available on EmbeddedDocuments');
};

/**
 * Marks a path as invalid, causing validation to fail.
 *
 * @param {String} path the field to invalidate
 * @param {String|Error} err error which states the reason `path` was invalid
 * @return {Boolean}
 * @api public
 */
EmbeddedDocument.prototype.invalidate = function (path, err, val, first) {
  if (!this.__parent) {
    var msg = 'Unable to invalidate a subdocument that has not been added to an array.'
    throw new Error(msg);
  }

  var index = this.__parentArray.indexOf(this);
  var parentPath = this.__parentArray._path;
  var fullPath = [parentPath, index, path].join('.');

  // sniffing arguments:
  // need to check if user passed a value to keep
  // our error message clean.
  if (2 < arguments.length) {
    this.__parent.invalidate(fullPath, err, val);
  } else {
    this.__parent.invalidate(fullPath, err);
  }

  if (first)
    this.$__.validationError = this.ownerDocument().$__.validationError;
  return true;
};

/**
 * Returns the top level document of this sub-document.
 *
 * @return {Document}
 */
EmbeddedDocument.prototype.ownerDocument = function () {
  if (this.$__.ownerDocument) {
    return this.$__.ownerDocument;
  }

  var parent = this.__parent;
  if (!parent) return this;

  while (parent.__parent) {
    parent = parent.__parent;
  }

  return this.$__.ownerDocument = parent;
};

/**
 * Returns the full path to this document. If optional `path` is passed, it is appended to the full path.
 *
 * @param {String} [path]
 * @return {String}
 * @api private
 * @method $__fullPath
 * @memberOf EmbeddedDocument
 */
EmbeddedDocument.prototype.$__fullPath = function (path) {
  if (!this.$__.fullPath) {
    var parent = this;
    if (!parent.__parent) return path;

    var paths = [];
    while (parent.__parent) {
      paths.unshift(parent.__parentArray._path);
      parent = parent.__parent;
    }

    this.$__.fullPath = paths.join('.');

    if (!this.$__.ownerDocument) {
      // optimization
      this.$__.ownerDocument = parent;
    }
  }

  return path
    ? this.$__.fullPath + '.' + path
    : this.$__.fullPath;
};

/**
 * Returns this sub-documents parent document.
 *
 * @api public
 */
EmbeddedDocument.prototype.parent = function () {
  return this.__parent;
};

/**
 * Returns this sub-documents parent array.
 *
 * @api public
 */
EmbeddedDocument.prototype.parentArray = function () {
  return this.__parentArray;
};

/*!
 * Module exports.
 */

module.exports = EmbeddedDocument;

},{"../document":3}],28:[function(_dereq_,module,exports){

/*!
 * Module exports.
 */

exports.Array = _dereq_('./array');

exports.Embedded = _dereq_('./embedded');

exports.DocumentArray = _dereq_('./documentarray');
exports.ObjectId = _dereq_('./objectid');

},{"./array":25,"./documentarray":26,"./embedded":27,"./objectid":29}],29:[function(_dereq_,module,exports){
// Regular expression that checks for hex value
var rcheckForHex = new RegExp("^[0-9a-fA-F]{24}$");

/**
* Create a new ObjectId instance
*
* @param {String} [id] Can be a 24 byte hex string.
* @return {Object} instance of ObjectId.
*/
function ObjectId( id ) {
  // Конструктор можно использовать без new
  if (!(this instanceof ObjectId)) return new ObjectId( id );
  //if ( id instanceof ObjectId ) return id;

  // Throw an error if it's not a valid setup
  if ( id != null && typeof id != 'string' && id.length != 24 )
    throw new Error('Argument passed in must be a string of 24 hex characters');

  // Generate id
  if ( id == null ) {
    this.id = this.generate();

  } else if( rcheckForHex.test( id ) ) {
    this.id = id;

  } else {
    throw new Error('Value passed in is not a valid 24 character hex string');
  }
}

// Private array of chars to use
ObjectId.prototype.CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

//TODO: можно ли использовать большие символы A-Z?
// Generate a random ObjectId.
ObjectId.prototype.generate = function(){
  var chars = this.CHARS, _id = new Array( 36 ), rnd = 0, r;
  for ( var i = 0; i < 24; i++ ) {
    if ( rnd <= 0x02 )
      rnd = 0x2000000 + (Math.random() * 0x1000000) | 0;

    r = rnd & 0xf;
    rnd = rnd >> 4;
    _id[ i ] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
  }

  return _id.join('').toLowerCase();
};

/**
* Return the ObjectId id as a 24 byte hex string representation
*
* @return {String} return the 24 byte hex string representation.
* @api public
*/
ObjectId.prototype.toHexString = function() {
  return this.id;
};

/**
* Converts the id into a 24 byte hex string for printing
*
* @return {String} return the 24 byte hex string representation.
* @api private
*/
ObjectId.prototype.toString = function() {
  return this.toHexString();
};

/**
* Converts to its JSON representation.
*
* @return {String} return the 24 byte hex string representation.
* @api private
*/
ObjectId.prototype.toJSON = function() {
  return this.toHexString();
};

/**
* Compares the equality of this ObjectId with `otherID`.
*
* @param {Object} otherID ObjectId instance to compare against.
* @return {Bool} the result of comparing two ObjectId's
* @api public
*/
ObjectId.prototype.equals = function equals( otherID ){
  var id = ( otherID instanceof ObjectId || otherID.toHexString )
    ? otherID.id
    : new ObjectId( otherID ).id;

  return this.id === id;
};

module.exports = ObjectId;

},{}],30:[function(_dereq_,module,exports){
(function (process,global){
/*!
 * Module dependencies.
 */

var ObjectId = _dereq_('./types/objectid')
  , mpath = _dereq_('./mpath')
  , StorageArray
  , Document;

/**
 * Pluralization rules.
 *
 * These rules are applied while processing the argument to `pluralize`.
 *
 */
exports.pluralization = [
  [/(m)an$/gi, '$1en'],
  [/(pe)rson$/gi, '$1ople'],
  [/(child)$/gi, '$1ren'],
  [/^(ox)$/gi, '$1en'],
  [/(ax|test)is$/gi, '$1es'],
  [/(octop|vir)us$/gi, '$1i'],
  [/(alias|status)$/gi, '$1es'],
  [/(bu)s$/gi, '$1ses'],
  [/(buffal|tomat|potat)o$/gi, '$1oes'],
  [/([ti])um$/gi, '$1a'],
  [/sis$/gi, 'ses'],
  [/(?:([^f])fe|([lr])f)$/gi, '$1$2ves'],
  [/(hive)$/gi, '$1s'],
  [/([^aeiouy]|qu)y$/gi, '$1ies'],
  [/(x|ch|ss|sh)$/gi, '$1es'],
  [/(matr|vert|ind)ix|ex$/gi, '$1ices'],
  [/([m|l])ouse$/gi, '$1ice'],
  [/(kn|w|l)ife$/gi, '$1ives'],
  [/(quiz)$/gi, '$1zes'],
  [/s$/gi, 's'],
  [/([^a-z])$/, '$1'],
  [/$/gi, 's']
];
var rules = exports.pluralization;

/**
 * Uncountable words.
 *
 * These words are applied while processing the argument to `pluralize`.
 * @api public
 */
exports.uncountables = [
  'advice',
  'energy',
  'excretion',
  'digestion',
  'cooperation',
  'health',
  'justice',
  'labour',
  'machinery',
  'equipment',
  'information',
  'pollution',
  'sewage',
  'paper',
  'money',
  'species',
  'series',
  'rain',
  'rice',
  'fish',
  'sheep',
  'moose',
  'deer',
  'news',
  'expertise',
  'status',
  'media'
];
var uncountables = exports.uncountables;

/*!
 * Pluralize function.
 *
 * @author TJ Holowaychuk (extracted from _ext.js_)
 * @param {String} string to pluralize
 * @api private
 */

exports.pluralize = function (str) {
  var found;
  if (!~uncountables.indexOf(str.toLowerCase())){
    found = rules.filter(function(rule){
      return str.match(rule[0]);
    });
    if (found[0]) return str.replace(found[0][0], found[0][1]);
  }
  return str;
}

/*!
 * Determines if `a` and `b` are deep equal.
 *
 * Modified from node/lib/assert.js
 * Modified from mongoose/utils.js
 *
 * @param {any} a a value to compare to `b`
 * @param {any} b a value to compare to `a`
 * @return {Boolean}
 * @api private
 */
exports.deepEqual = function deepEqual (a, b) {
  if (isStorageObject(a)) a = a.toObject();
  if (isStorageObject(b)) b = b.toObject();

  return _.isEqual(a, b);
};



var toString = Object.prototype.toString;

function isRegExp (o) {
  return 'object' == typeof o
      && '[object RegExp]' == toString.call(o);
}

function cloneRegExp (regexp) {
  if (!isRegExp(regexp)) {
    throw new TypeError('Not a RegExp');
  }

  var flags = [];
  if (regexp.global) flags.push('g');
  if (regexp.multiline) flags.push('m');
  if (regexp.ignoreCase) flags.push('i');
  return new RegExp(regexp.source, flags.join(''));
}

/*!
 * Object clone with Storage natives support.
 *
 * If options.minimize is true, creates a minimal data object. Empty objects and undefined values will not be cloned. This makes the data payload sent to MongoDB as small as possible.
 *
 * Functions are never cloned.
 *
 * @param {Object} obj the object to clone
 * @param {Object} options
 * @return {Object} the cloned object
 * @api private
 */
exports.clone = function clone (obj, options) {
  if (obj === undefined || obj === null)
    return obj;

  if ( _.isArray( obj ) ) {
    return cloneArray( obj, options );
  }

  if ( isStorageObject( obj ) ) {
    if (options && options.json && 'function' === typeof obj.toJSON) {
      return obj.toJSON( options );
    } else {
      return obj.toObject( options );
    }
  }

  if ( obj.constructor ) {
    switch (obj.constructor.name) {
      case 'Object':
        return cloneObject(obj, options);
      case 'Date':
        return new obj.constructor( +obj );
      case 'RegExp':
        return cloneRegExp( obj );
      default:
        // ignore
        break;
    }
  }

  if ( obj instanceof ObjectId ) {
    return new ObjectId( obj.id );
  }

  if ( !obj.constructor && _.isObject( obj ) ) {
    // object created with Object.create(null)
    return cloneObject( obj, options );
  }

  if ( obj.valueOf ){
    return obj.valueOf();
  }
};
var clone = exports.clone;

/*!
 * ignore
 */
function cloneObject (obj, options) {
  var retainKeyOrder = options && options.retainKeyOrder
    , minimize = options && options.minimize
    , ret = {}
    , hasKeys
    , keys
    , val
    , k
    , i;

  if ( retainKeyOrder ) {
    for (k in obj) {
      val = clone( obj[k], options );

      if ( !minimize || ('undefined' !== typeof val) ) {
        hasKeys || (hasKeys = true);
        ret[k] = val;
      }
    }
  } else {
    // faster

    keys = Object.keys( obj );
    i = keys.length;

    while (i--) {
      k = keys[i];
      val = clone(obj[k], options);

      if (!minimize || ('undefined' !== typeof val)) {
        if (!hasKeys) hasKeys = true;
        ret[k] = val;
      }
    }
  }

  return minimize
    ? hasKeys && ret
    : ret;
}

function cloneArray (arr, options) {
  var ret = [];
  for (var i = 0, l = arr.length; i < l; i++) {
    ret.push( clone( arr[i], options ) );
  }
  return ret;
}

/*!
 * Merges `from` into `to` without overwriting existing properties.
 *
 * @param {Object} to
 * @param {Object} from
 * @api private
 */
exports.merge = function merge (to, from) {
  var keys = Object.keys(from)
    , i = keys.length
    , key;

  while (i--) {
    key = keys[i];
    if ('undefined' === typeof to[key]) {
      to[key] = from[key];
    } else if ( _.isObject(from[key]) ) {
      merge(to[key], from[key]);
    }
  }
};

/*!
 * Generates a random string
 *
 * @api private
 */

exports.random = function () {
  return Math.random().toString().substr(3);
};


/*!
 * Returns if `v` is a storage object that has a `toObject()` method we can use.
 *
 * This is for compatibility with libs like Date.js which do foolish things to Natives.
 *
 * @param {any} v
 * @api private
 */
exports.isStorageObject = function ( v ) {
  Document || (Document = _dereq_('./document'));
  StorageArray || (StorageArray = _dereq_('./types/array'));

  return v instanceof Document ||
         v instanceof StorageArray;
};
var isStorageObject = exports.isStorageObject;

/*!
 * Return the value of `obj` at the given `path`.
 *
 * @param {String} path
 * @param {Object} obj
 */

exports.getValue = function (path, obj, map) {
  return mpath.get(path, obj, '_doc', map);
};

/*!
 * Sets the value of `obj` at the given `path`.
 *
 * @param {String} path
 * @param {Anything} val
 * @param {Object} obj
 */

exports.setValue = function (path, val, obj, map) {
  mpath.set(path, val, obj, '_doc', map);
};

exports.setImmediate = (function() {
  // Для поддержки тестов (окружение node.js)
  if ( typeof global === 'object' && process.nextTick ) return process.nextTick;
  // Если в браузере уже реализован этот метод
  if ( window.setImmediate ) return window.setImmediate;

  var head = { }, tail = head; // очередь вызовов, 1-связный список

  var ID = Math.random(); // уникальный идентификатор

  function onmessage(e) {
    if(e.data != ID) return; // не наше сообщение
    head = head.next;
    var func = head.func;
    delete head.func;
    func();
  }

  if(window.addEventListener) { // IE9+, другие браузеры
    window.addEventListener('message', onmessage, false);
  } else { // IE8
    window.attachEvent( 'onmessage', onmessage );
  }

  return window.postMessage ? function(func) {
    tail = tail.next = { func: func };
    window.postMessage(ID, "*");
  } :
  function(func) { // IE<8
    setTimeout(func, 0);
  };
}());


}).call(this,_dereq_("JkpR2F"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./document":3,"./mpath":12,"./types/array":25,"./types/objectid":29,"JkpR2F":1}],31:[function(_dereq_,module,exports){

/**
 * VirtualType constructor
 *
 * This is what mongoose uses to define virtual attributes via `Schema.prototype.virtual`.
 *
 * ####Example:
 *
 *     var fullname = schema.virtual('fullname');
 *     fullname instanceof mongoose.VirtualType // true
 *
 * @parma {Object} options
 * @api public
 */

function VirtualType (options, name) {
  this.path = name;
  this.getters = [];
  this.setters = [];
  this.options = options || {};
}

/**
 * Defines a getter.
 *
 * ####Example:
 *
 *     var virtual = schema.virtual('fullname');
 *     virtual.get(function () {
 *       return this.name.first + ' ' + this.name.last;
 *     });
 *
 * @param {Function} fn
 * @return {VirtualType} this
 * @api public
 */

VirtualType.prototype.get = function (fn) {
  this.getters.push(fn);
  return this;
};

/**
 * Defines a setter.
 *
 * ####Example:
 *
 *     var virtual = schema.virtual('fullname');
 *     virtual.set(function (v) {
 *       var parts = v.split(' ');
 *       this.name.first = parts[0];
 *       this.name.last = parts[1];
 *     });
 *
 * @param {Function} fn
 * @return {VirtualType} this
 * @api public
 */

VirtualType.prototype.set = function (fn) {
  this.setters.push(fn);
  return this;
};

/**
 * Applies getters to `value` using optional `scope`.
 *
 * @param {Object} value
 * @param {Object} scope
 * @return {any} the value after applying all getters
 * @api public
 */

VirtualType.prototype.applyGetters = function (value, scope) {
  var v = value;
  for (var l = this.getters.length - 1; l >= 0; l--) {
    v = this.getters[l].call(scope, v, this);
  }
  return v;
};

/**
 * Applies setters to `value` using optional `scope`.
 *
 * @param {Object} value
 * @param {Object} scope
 * @return {any} the value after applying all setters
 * @api public
 */

VirtualType.prototype.applySetters = function (value, scope) {
  var v = value;
  for (var l = this.setters.length - 1; l >= 0; l--) {
    v = this.setters[l].call(scope, v, this);
  }
  return v;
};

/*!
 * exports
 */

module.exports = VirtualType;

},{}]},{},[10])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9pcmluYS9TaXRlcy9naXRodWIvc3RvcmFnZS9ub2RlX21vZHVsZXMvZ3J1bnQtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL1VzZXJzL2lyaW5hL1NpdGVzL2dpdGh1Yi9zdG9yYWdlL25vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIvVXNlcnMvaXJpbmEvU2l0ZXMvZ2l0aHViL3N0b3JhZ2Uvc3JjL2NvbGxlY3Rpb24uanMiLCIvVXNlcnMvaXJpbmEvU2l0ZXMvZ2l0aHViL3N0b3JhZ2Uvc3JjL2RvY3VtZW50LmpzIiwiL1VzZXJzL2lyaW5hL1NpdGVzL2dpdGh1Yi9zdG9yYWdlL3NyYy9lcnJvci5qcyIsIi9Vc2Vycy9pcmluYS9TaXRlcy9naXRodWIvc3RvcmFnZS9zcmMvZXJyb3IvY2FzdC5qcyIsIi9Vc2Vycy9pcmluYS9TaXRlcy9naXRodWIvc3RvcmFnZS9zcmMvZXJyb3IvbWVzc2FnZXMuanMiLCIvVXNlcnMvaXJpbmEvU2l0ZXMvZ2l0aHViL3N0b3JhZ2Uvc3JjL2Vycm9yL3ZhbGlkYXRpb24uanMiLCIvVXNlcnMvaXJpbmEvU2l0ZXMvZ2l0aHViL3N0b3JhZ2Uvc3JjL2Vycm9yL3ZhbGlkYXRvci5qcyIsIi9Vc2Vycy9pcmluYS9TaXRlcy9naXRodWIvc3RvcmFnZS9zcmMvZXZlbnRzLmpzIiwiL1VzZXJzL2lyaW5hL1NpdGVzL2dpdGh1Yi9zdG9yYWdlL3NyYy9pbmRleC5qcyIsIi9Vc2Vycy9pcmluYS9TaXRlcy9naXRodWIvc3RvcmFnZS9zcmMvaW50ZXJuYWwuanMiLCIvVXNlcnMvaXJpbmEvU2l0ZXMvZ2l0aHViL3N0b3JhZ2Uvc3JjL21wYXRoLmpzIiwiL1VzZXJzL2lyaW5hL1NpdGVzL2dpdGh1Yi9zdG9yYWdlL3NyYy9zY2hlbWEuanMiLCIvVXNlcnMvaXJpbmEvU2l0ZXMvZ2l0aHViL3N0b3JhZ2Uvc3JjL3NjaGVtYS9hcnJheS5qcyIsIi9Vc2Vycy9pcmluYS9TaXRlcy9naXRodWIvc3RvcmFnZS9zcmMvc2NoZW1hL2Jvb2xlYW4uanMiLCIvVXNlcnMvaXJpbmEvU2l0ZXMvZ2l0aHViL3N0b3JhZ2Uvc3JjL3NjaGVtYS9kYXRlLmpzIiwiL1VzZXJzL2lyaW5hL1NpdGVzL2dpdGh1Yi9zdG9yYWdlL3NyYy9zY2hlbWEvZG9jdW1lbnRhcnJheS5qcyIsIi9Vc2Vycy9pcmluYS9TaXRlcy9naXRodWIvc3RvcmFnZS9zcmMvc2NoZW1hL2luZGV4LmpzIiwiL1VzZXJzL2lyaW5hL1NpdGVzL2dpdGh1Yi9zdG9yYWdlL3NyYy9zY2hlbWEvbWl4ZWQuanMiLCIvVXNlcnMvaXJpbmEvU2l0ZXMvZ2l0aHViL3N0b3JhZ2Uvc3JjL3NjaGVtYS9udW1iZXIuanMiLCIvVXNlcnMvaXJpbmEvU2l0ZXMvZ2l0aHViL3N0b3JhZ2Uvc3JjL3NjaGVtYS9vYmplY3RpZC5qcyIsIi9Vc2Vycy9pcmluYS9TaXRlcy9naXRodWIvc3RvcmFnZS9zcmMvc2NoZW1hL3N0cmluZy5qcyIsIi9Vc2Vycy9pcmluYS9TaXRlcy9naXRodWIvc3RvcmFnZS9zcmMvc2NoZW1hdHlwZS5qcyIsIi9Vc2Vycy9pcmluYS9TaXRlcy9naXRodWIvc3RvcmFnZS9zcmMvc3RhdGVtYWNoaW5lLmpzIiwiL1VzZXJzL2lyaW5hL1NpdGVzL2dpdGh1Yi9zdG9yYWdlL3NyYy90eXBlcy9hcnJheS5qcyIsIi9Vc2Vycy9pcmluYS9TaXRlcy9naXRodWIvc3RvcmFnZS9zcmMvdHlwZXMvZG9jdW1lbnRhcnJheS5qcyIsIi9Vc2Vycy9pcmluYS9TaXRlcy9naXRodWIvc3RvcmFnZS9zcmMvdHlwZXMvZW1iZWRkZWQuanMiLCIvVXNlcnMvaXJpbmEvU2l0ZXMvZ2l0aHViL3N0b3JhZ2Uvc3JjL3R5cGVzL2luZGV4LmpzIiwiL1VzZXJzL2lyaW5hL1NpdGVzL2dpdGh1Yi9zdG9yYWdlL3NyYy90eXBlcy9vYmplY3RpZC5qcyIsIi9Vc2Vycy9pcmluYS9TaXRlcy9naXRodWIvc3RvcmFnZS9zcmMvdXRpbHMuanMiLCIvVXNlcnMvaXJpbmEvU2l0ZXMvZ2l0aHViL3N0b3JhZ2Uvc3JjL3ZpcnR1YWx0eXBlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3MURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbE9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0TkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2x6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDak1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDampCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhblBvc3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5wb3N0TWVzc2FnZSAmJiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lclxuICAgIDtcblxuICAgIGlmIChjYW5TZXRJbW1lZGlhdGUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmKSB7IHJldHVybiB3aW5kb3cuc2V0SW1tZWRpYXRlKGYpIH07XG4gICAgfVxuXG4gICAgaWYgKGNhblBvc3QpIHtcbiAgICAgICAgdmFyIHF1ZXVlID0gW107XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICB2YXIgc291cmNlID0gZXYuc291cmNlO1xuICAgICAgICAgICAgaWYgKChzb3VyY2UgPT09IHdpbmRvdyB8fCBzb3VyY2UgPT09IG51bGwpICYmIGV2LmRhdGEgPT09ICdwcm9jZXNzLXRpY2snKSB7XG4gICAgICAgICAgICAgICAgZXYuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZuID0gcXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgZm4oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2UoJ3Byb2Nlc3MtdGljaycsICcqJyk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZm4sIDApO1xuICAgIH07XG59KSgpO1xuXG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn1cblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuIiwiLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBTY2hlbWEgPSByZXF1aXJlKCcuL3NjaGVtYScpXG4gICwgRG9jdW1lbnQgPSByZXF1aXJlKCcuL2RvY3VtZW50Jyk7XG5cbi8vVE9ETzog0L3QsNC/0LjRgdCw0YLRjCDQvNC10YLQvtC0IC51cHNlcnQoIGRvYyApIC0g0L7QsdC90L7QstC70LXQvdC40LUg0LTQvtC60YPQvNC10L3RgtCwLCDQsCDQtdGB0LvQuCDQtdCz0L4g0L3QtdGCLCDRgtC+INGB0L7Qt9C00LDQvdC40LVcblxuLy9UT0RPOiDQtNC+0LTQtdC70LDRgtGMINC70L7Qs9C40LrRgyDRgSBhcGlSZXNvdXJjZSAo0YHQvtGF0YDQsNC90Y/RgtGMINGB0YHRi9C70LrRgyDQvdCwINC90LXQs9C+INC4INC40YHQv9C+0LvRjNC30L7QstGC0Ywg0L/RgNC4INC80LXRgtC+0LTQtSBkb2Muc2F2ZSlcbi8qKlxuICog0JrQvtC90YHRgtGA0YPQutGC0L7RgCDQutC+0LvQu9C10LrRhtC40LkuXG4gKlxuICogQGV4YW1wbGVcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtINC90LDQt9Cy0LDQvdC40LUg0LrQvtC70LvQtdC60YbQuNC4XG4gKiBAcGFyYW0ge1NjaGVtYX0gc2NoZW1hIC0g0KHRhdC10LzQsCDQuNC70Lgg0L7QsdGK0LXQutGCINC+0L/QuNGB0LDQvdC40Y8g0YHRhdC10LzRi1xuICogQHBhcmFtIHtPYmplY3R9IFthcGldIC0g0YHRgdGL0LvQutCwINC90LAgYXBpINGA0LXRgdGD0YDRgVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIENvbGxlY3Rpb24gKCBuYW1lLCBzY2hlbWEsIGFwaSApe1xuICAvLyDQodC+0YXRgNCw0L3QuNC8INC90LDQt9Cy0LDQvdC40LUg0L/RgNC+0YHRgtGA0LDQvdGB0YLQstCwINC40LzRkdC9XG4gIHRoaXMubmFtZSA9IG5hbWU7XG4gIC8vINCl0YDQsNC90LjQu9C40YnQtSDQtNC70Y8g0LTQvtC60YPQvNC10L3RgtC+0LJcbiAgdGhpcy5kb2N1bWVudHMgPSB7fTtcblxuICBpZiAoIF8uaXNPYmplY3QoIHNjaGVtYSApICYmICEoIHNjaGVtYSBpbnN0YW5jZW9mIFNjaGVtYSApICkge1xuICAgIHNjaGVtYSA9IG5ldyBTY2hlbWEoIHNjaGVtYSApO1xuICB9XG5cbiAgLy8g0KHQvtGF0YDQsNC90LjQvCDRgdGB0YvQu9C60YMg0L3QsCBhcGkg0LTQu9GPINC80LXRgtC+0LTQsCAuc2F2ZSgpXG4gIHRoaXMuYXBpID0gYXBpO1xuXG4gIC8vINCY0YHQv9C+0LvRjNC30YPQtdC80LDRjyDRgdGF0LXQvNCwINC00LvRjyDQutC+0LvQu9C10LrRhtC40LhcbiAgdGhpcy5zY2hlbWEgPSBzY2hlbWE7XG5cbiAgLy8g0J7RgtC+0LHRgNCw0LbQtdC90LjQtSDQvtCx0YrQtdC60YLQsCBkb2N1bWVudHMg0LIg0LLQuNC00LUg0LzQsNGB0YHQuNCy0LAgKNC00LvRjyDQvdC+0LrQsNGD0YLQsClcbiAgdGhpcy5hcnJheSA9IFtdO1xuICBrby50cmFjayggdGhpcywgWydhcnJheSddICk7XG59XG5cbkNvbGxlY3Rpb24ucHJvdG90eXBlID0ge1xuICAvKipcbiAgICog0JTQvtCx0LDQstC40YLRjCDQtNC+0LrRg9C80LXQvdGCINC40LvQuCDQvNCw0YHRgdC40LIg0LTQvtC60YPQvNC10L3RgtC+0LIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIHN0b3JhZ2UuY29sbGVjdGlvbi5hZGQoeyB0eXBlOiAnamVsbHkgYmVhbicgfSk7XG4gICAqIHN0b3JhZ2UuY29sbGVjdGlvbi5hZGQoW3sgdHlwZTogJ2plbGx5IGJlYW4nIH0sIHsgdHlwZTogJ3NuaWNrZXJzJyB9XSk7XG4gICAqIHN0b3JhZ2UuY29sbGVjdGlvbi5hZGQoeyBfaWQ6ICcqKioqKicsIHR5cGU6ICdqZWxseSBiZWFuJyB9LCB0cnVlKTtcbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R8QXJyYXkuPG9iamVjdD59IFtkb2NdIC0g0JTQvtC60YPQvNC10L3RglxuICAgKiBAcGFyYW0ge29iamVjdH0gW2ZpZWxkc10gLSDQstGL0LHRgNCw0L3QvdGL0LUg0L/QvtC70Y8g0L/RgNC4INC30LDQv9GA0L7RgdC1ICjQvdC1INGA0LXQsNC70LjQt9C+0LLQsNC90L4g0LIg0LTQvtC60YPQvNC10L3RgtC1KVxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtpbml0XSAtIGh5ZHJhdGUgZG9jdW1lbnQgLSDQvdCw0L/QvtC70L3QuNGC0Ywg0LTQvtC60YPQvNC10L3RgiDQtNCw0L3QvdGL0LzQuCAo0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINCyIGFwaS1jbGllbnQpXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW19zdG9yYWdlV2lsbE11dGF0ZV0gLSDQpNC70LDQsyDQtNC+0LHQsNCy0LvQtdC90LjRjyDQvNCw0YHRgdC40LLQsCDQtNC+0LrRg9C80LXQvdGC0L7Qsi4g0YLQvtC70YzQutC+INC00LvRjyDQstC90YPRgtGA0LXQvdC90LXQs9C+INC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPXG4gICAqIEByZXR1cm5zIHtzdG9yYWdlLkRvY3VtZW50fEFycmF5LjxzdG9yYWdlLkRvY3VtZW50Pn1cbiAgICovXG4gIGFkZDogZnVuY3Rpb24oIGRvYywgZmllbGRzLCBpbml0LCBfc3RvcmFnZVdpbGxNdXRhdGUgKXtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyDQldGB0LvQuCDQtNC+0LrRg9C80LXQvdGC0LAg0L3QtdGCLCDQt9C90LDRh9C40YIg0LHRg9C00LXRgiDQv9GD0YHRgtC+0LlcbiAgICBpZiAoIGRvYyA9PSBudWxsICkgZG9jID0gbnVsbDtcblxuICAgIC8vINCc0LDRgdGB0LjQsiDQtNC+0LrRg9C80LXQvdGC0L7QslxuICAgIGlmICggXy5pc0FycmF5KCBkb2MgKSApe1xuICAgICAgdmFyIHNhdmVkRG9jcyA9IFtdO1xuXG4gICAgICBfLmVhY2goIGRvYywgZnVuY3Rpb24oIGRvYyApe1xuICAgICAgICBzYXZlZERvY3MucHVzaCggc2VsZi5hZGQoIGRvYywgZmllbGRzLCBpbml0LCB0cnVlICkgKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnN0b3JhZ2VIYXNNdXRhdGVkKCk7XG5cbiAgICAgIHJldHVybiBzYXZlZERvY3M7XG4gICAgfVxuXG4gICAgdmFyIGlkID0gZG9jICYmIGRvYy5faWQ7XG5cbiAgICAvLyDQldGB0LvQuCDQtNC+0LrRg9C80LXQvdGCINGD0LbQtSDQtdGB0YLRjCwg0YLQviDQv9GA0L7RgdGC0L4g0YPRgdGC0LDQvdC+0LLQuNGC0Ywg0LfQvdCw0YfQtdC90LjRj1xuICAgIGlmICggaWQgJiYgdGhpcy5kb2N1bWVudHNbIGlkIF0gKXtcbiAgICAgIHRoaXMuZG9jdW1lbnRzWyBpZCBdLnNldCggZG9jICk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGRpc2NyaW1pbmF0b3JNYXBwaW5nID0gdGhpcy5zY2hlbWFcbiAgICAgICAgPyB0aGlzLnNjaGVtYS5kaXNjcmltaW5hdG9yTWFwcGluZ1xuICAgICAgICA6IG51bGw7XG5cbiAgICAgIHZhciBrZXkgPSBkaXNjcmltaW5hdG9yTWFwcGluZyAmJiBkaXNjcmltaW5hdG9yTWFwcGluZy5pc1Jvb3RcbiAgICAgICAgPyBkaXNjcmltaW5hdG9yTWFwcGluZy5rZXlcbiAgICAgICAgOiBudWxsO1xuXG4gICAgICAvLyDQktGL0LHQuNGA0LDQtdC8INGB0YXQtdC80YMsINC10YHQu9C4INC10YHRgtGMINC00LjRgdC60YDQuNC80LjQvdCw0YLQvtGAXG4gICAgICB2YXIgc2NoZW1hO1xuICAgICAgaWYgKGtleSAmJiBkb2MgJiYgZG9jW2tleV0gJiYgdGhpcy5zY2hlbWEuZGlzY3JpbWluYXRvcnMgJiYgdGhpcy5zY2hlbWEuZGlzY3JpbWluYXRvcnNbZG9jW2tleV1dKSB7XG4gICAgICAgIHNjaGVtYSA9IHRoaXMuc2NoZW1hLmRpc2NyaW1pbmF0b3JzW2RvY1trZXldXTtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2NoZW1hID0gdGhpcy5zY2hlbWE7XG4gICAgICB9XG5cbiAgICAgIHZhciBuZXdEb2MgPSBuZXcgRG9jdW1lbnQoIGRvYywgdGhpcy5uYW1lLCBzY2hlbWEsIGZpZWxkcywgaW5pdCApO1xuICAgICAgaWQgPSBuZXdEb2MuX2lkLnRvU3RyaW5nKCk7XG4gICAgfVxuXG4gICAgLy8g0JTQu9GPINC+0LTQuNC90L7Rh9C90YvRhSDQtNC+0LrRg9C80LXQvdGC0L7QsiDRgtC+0LbQtSDQvdGD0LbQvdC+ICDQstGL0LfQstCw0YLRjCBzdG9yYWdlSGFzTXV0YXRlZFxuICAgIGlmICggIV9zdG9yYWdlV2lsbE11dGF0ZSApe1xuICAgICAgdGhpcy5zdG9yYWdlSGFzTXV0YXRlZCgpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmRvY3VtZW50c1sgaWQgXTtcbiAgfSxcblxuICAvKipcbiAgICog0KPQtNCw0LvQtdC90LjRgtGMINC00L7QutGD0LzQtdC90YIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIHN0b3JhZ2UuY29sbGVjdGlvbi5yZW1vdmUoIERvY3VtZW50ICk7XG4gICAqIHN0b3JhZ2UuY29sbGVjdGlvbi5yZW1vdmUoIHV1aWQgKTtcbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R8bnVtYmVyfSBkb2N1bWVudCAtINCh0LDQvCDQtNC+0LrRg9C80LXQvdGCINC40LvQuCDQtdCz0L4gaWQuXG4gICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgKi9cbiAgcmVtb3ZlOiBmdW5jdGlvbiggZG9jdW1lbnQgKXtcbiAgICByZXR1cm4gZGVsZXRlIHRoaXMuZG9jdW1lbnRzWyBkb2N1bWVudC5faWQgfHwgZG9jdW1lbnQgXTtcbiAgfSxcblxuICAvKipcbiAgICog0J3QsNC50YLQuCDQtNC+0LrRg9C80LXQvdGC0YsuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIC8vIG5hbWVkIGpvaG5cbiAgICogc3RvcmFnZS5jb2xsZWN0aW9uLmZpbmQoeyBuYW1lOiAnam9obicgfSk7XG4gICAqIHN0b3JhZ2UuY29sbGVjdGlvbi5maW5kKHsgYXV0aG9yOiAnU2hha2VzcGVhcmUnLCB5ZWFyOiAxNjExIH0pO1xuICAgKlxuICAgKiBAcGFyYW0gY29uZGl0aW9uc1xuICAgKiBAcmV0dXJucyB7QXJyYXkuPHN0b3JhZ2UuRG9jdW1lbnQ+fVxuICAgKi9cbiAgZmluZDogZnVuY3Rpb24oIGNvbmRpdGlvbnMgKXtcbiAgICByZXR1cm4gXy53aGVyZSggdGhpcy5kb2N1bWVudHMsIGNvbmRpdGlvbnMgKTtcbiAgfSxcblxuICAvKipcbiAgICog0J3QsNC50YLQuCDQvtC00LjQvSDQtNC+0LrRg9C80LXQvdGCINC/0L4gaWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIHN0b3JhZ2UuY29sbGVjdGlvbi5maW5kQnlJZCggaWQgKTtcbiAgICpcbiAgICogQHBhcmFtIF9pZFxuICAgKiBAcmV0dXJucyB7c3RvcmFnZS5Eb2N1bWVudHx1bmRlZmluZWR9XG4gICAqL1xuICBmaW5kQnlJZDogZnVuY3Rpb24oIF9pZCApe1xuICAgIHJldHVybiB0aGlzLmRvY3VtZW50c1sgX2lkIF07XG4gIH0sXG5cbiAgLyoqXG4gICAqINCd0LDQudGC0Lgg0L/QviBpZCDQtNC+0LrRg9C80LXQvdGCINC4INGD0LTQsNC70LjRgtGMINC10LPQvi5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogc3RvcmFnZS5jb2xsZWN0aW9uLmZpbmRCeUlkQW5kUmVtb3ZlKCBpZCApIC8vIHJldHVybnMg0YFvbGxlY3Rpb25cbiAgICpcbiAgICogQHNlZSBDb2xsZWN0aW9uLmZpbmRCeUlkXG4gICAqIEBzZWUgQ29sbGVjdGlvbi5yZW1vdmVcbiAgICpcbiAgICogQHBhcmFtIF9pZFxuICAgKiBAcmV0dXJucyB7Q29sbGVjdGlvbn1cbiAgICovXG4gIGZpbmRCeUlkQW5kUmVtb3ZlOiBmdW5jdGlvbiggX2lkICl7XG4gICAgdGhpcy5yZW1vdmUoIHRoaXMuZmluZEJ5SWQoIF9pZCApICk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLyoqXG4gICAqINCd0LDQudGC0Lgg0L/QviBpZCDQtNC+0LrRg9C80LXQvdGCINC4INC+0LHQvdC+0LLQuNGC0Ywg0LXQs9C+LlxuICAgKlxuICAgKiBAc2VlIENvbGxlY3Rpb24uZmluZEJ5SWRcbiAgICogQHNlZSBDb2xsZWN0aW9uLnVwZGF0ZVxuICAgKlxuICAgKiBAcGFyYW0gX2lkXG4gICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gcGF0aFxuICAgKiBAcGFyYW0ge29iamVjdHxib29sZWFufG51bWJlcnxzdHJpbmd8bnVsbHx1bmRlZmluZWR9IHZhbHVlXG4gICAqIEByZXR1cm5zIHtzdG9yYWdlLkRvY3VtZW50fHVuZGVmaW5lZH1cbiAgICovXG4gIGZpbmRCeUlkQW5kVXBkYXRlOiBmdW5jdGlvbiggX2lkLCBwYXRoLCB2YWx1ZSApe1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZSggdGhpcy5maW5kQnlJZCggX2lkICksIHBhdGgsIHZhbHVlICk7XG4gIH0sXG5cbiAgLyoqXG4gICAqINCd0LDQudGC0Lgg0L7QtNC40L0g0LTQvtC60YPQvNC10L3Rgi5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogLy8gZmluZCBvbmUgaXBob25lIGFkdmVudHVyZXNcbiAgICogc3RvcmFnZS5hZHZlbnR1cmUuZmluZE9uZSh7IHR5cGU6ICdpcGhvbmUnIH0pO1xuICAgKlxuICAgKiBAcGFyYW0gY29uZGl0aW9uc1xuICAgKiBAcmV0dXJucyB7c3RvcmFnZS5Eb2N1bWVudHx1bmRlZmluZWR9XG4gICAqL1xuICBmaW5kT25lOiBmdW5jdGlvbiggY29uZGl0aW9ucyApe1xuICAgIHJldHVybiBfLmZpbmRXaGVyZSggdGhpcy5kb2N1bWVudHMsIGNvbmRpdGlvbnMgKTtcbiAgfSxcblxuICAvKipcbiAgICog0J3QsNC50YLQuCDQv9C+INGD0YHQu9C+0LLQuNGOINC+0LTQuNC9INC00L7QutGD0LzQtdC90YIg0Lgg0YPQtNCw0LvQuNGC0Ywg0LXQs9C+LlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBzdG9yYWdlLmNvbGxlY3Rpb24uZmluZE9uZUFuZFJlbW92ZSggY29uZGl0aW9ucyApIC8vIHJldHVybnMg0YFvbGxlY3Rpb25cbiAgICpcbiAgICogQHNlZSBDb2xsZWN0aW9uLmZpbmRPbmVcbiAgICogQHNlZSBDb2xsZWN0aW9uLnJlbW92ZVxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gY29uZGl0aW9uc1xuICAgKiBAcmV0dXJucyB7Q29sbGVjdGlvbn1cbiAgICovXG4gIGZpbmRPbmVBbmRSZW1vdmU6IGZ1bmN0aW9uKCBjb25kaXRpb25zICl7XG4gICAgdGhpcy5yZW1vdmUoIHRoaXMuZmluZE9uZSggY29uZGl0aW9ucyApICk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLyoqXG4gICAqINCd0LDQudGC0Lgg0LTQvtC60YPQvNC10L3RgiDQv9C+INGD0YHQu9C+0LLQuNGOINC4INC+0LHQvdC+0LLQuNGC0Ywg0LXQs9C+LlxuICAgKlxuICAgKiBAc2VlIENvbGxlY3Rpb24uZmluZE9uZVxuICAgKiBAc2VlIENvbGxlY3Rpb24udXBkYXRlXG4gICAqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBjb25kaXRpb25zXG4gICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gcGF0aFxuICAgKiBAcGFyYW0ge29iamVjdHxib29sZWFufG51bWJlcnxzdHJpbmd8bnVsbHx1bmRlZmluZWR9IHZhbHVlXG4gICAqIEByZXR1cm5zIHtzdG9yYWdlLkRvY3VtZW50fHVuZGVmaW5lZH1cbiAgICovXG4gIGZpbmRPbmVBbmRVcGRhdGU6IGZ1bmN0aW9uKCBjb25kaXRpb25zLCBwYXRoLCB2YWx1ZSApe1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZSggdGhpcy5maW5kT25lKCBjb25kaXRpb25zICksIHBhdGgsIHZhbHVlICk7XG4gIH0sXG5cbiAgLyoqXG4gICAqINCe0LHQvdC+0LLQuNGC0Ywg0YHRg9GJ0LXRgdGC0LLRg9GO0YnQuNC1INC/0L7Qu9GPINCyINC00L7QutGD0LzQtdC90YLQtS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogc3RvcmFnZS5wbGFjZXMudXBkYXRlKCBzdG9yYWdlLnBsYWNlcy5maW5kQnlJZCggMCApLCB7XG4gICAqICAgbmFtZTogJ0lya3V0c2snXG4gICAqIH0pO1xuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcnxvYmplY3R9IGRvY3VtZW50XG4gICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gcGF0aFxuICAgKiBAcGFyYW0ge29iamVjdHxib29sZWFufG51bWJlcnxzdHJpbmd8bnVsbHx1bmRlZmluZWR9IHZhbHVlXG4gICAqIEByZXR1cm5zIHtzdG9yYWdlLkRvY3VtZW50fEJvb2xlYW59XG4gICAqL1xuICB1cGRhdGU6IGZ1bmN0aW9uKCBkb2N1bWVudCwgcGF0aCwgdmFsdWUgKXtcbiAgICB2YXIgZG9jID0gdGhpcy5kb2N1bWVudHNbIGRvY3VtZW50Ll9pZCB8fCBkb2N1bWVudCBdO1xuXG4gICAgaWYgKCBkb2MgPT0gbnVsbCApe1xuICAgICAgY29uc29sZS53YXJuKCdzdG9yYWdlOjp1cGRhdGU6IERvY3VtZW50IGlzIG5vdCBmb3VuZC4nKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZG9jLnNldCggcGF0aCwgdmFsdWUgKTtcbiAgfSxcblxuICAvKipcbiAgICog0J7QsdGA0LDQsdC+0YLRh9C40Log0L3QsCDQuNC30LzQtdC90LXQvdC40Y8gKNC00L7QsdCw0LLQu9C10L3QuNC1LCDRg9C00LDQu9C10L3QuNC1KSDQtNCw0L3QvdGL0YUg0LIg0LrQvtC70LvQtdC60YbQuNC4XG4gICAqL1xuICBzdG9yYWdlSGFzTXV0YXRlZDogZnVuY3Rpb24oKXtcbiAgICAvLyDQntCx0L3QvtCy0LjQvCDQvNCw0YHRgdC40LIg0LTQvtC60YPQvNC10L3RgtC+0LIgKNGB0L/QtdGG0LjQsNC70YzQvdC+0LUg0L7RgtC+0LHRgNCw0LbQtdC90LjQtSDQtNC70Y8g0L/QtdGA0LXQsdC+0YDQsCDQvdC+0LrQsNGD0YLQvtC8KVxuICAgIHRoaXMuYXJyYXkgPSBfLnRvQXJyYXkoIHRoaXMuZG9jdW1lbnRzICk7XG4gIH1cbn07XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBDb2xsZWN0aW9uO1xuIiwiLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBFdmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpXG4gICwgU3RvcmFnZUVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpXG4gICwgTWl4ZWRTY2hlbWEgPSByZXF1aXJlKCcuL3NjaGVtYS9taXhlZCcpXG4gICwgT2JqZWN0SWQgPSByZXF1aXJlKCcuL3R5cGVzL29iamVjdGlkJylcbiAgLCBTY2hlbWEgPSByZXF1aXJlKCcuL3NjaGVtYScpXG4gICwgVmFsaWRhdG9yRXJyb3IgPSByZXF1aXJlKCcuL3NjaGVtYXR5cGUnKS5WYWxpZGF0b3JFcnJvclxuICAsIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpXG4gICwgY2xvbmUgPSB1dGlscy5jbG9uZVxuICAsIFZhbGlkYXRpb25FcnJvciA9IFN0b3JhZ2VFcnJvci5WYWxpZGF0aW9uRXJyb3JcbiAgLCBJbnRlcm5hbENhY2hlID0gcmVxdWlyZSgnLi9pbnRlcm5hbCcpXG4gICwgZGVlcEVxdWFsID0gdXRpbHMuZGVlcEVxdWFsXG4gICwgRG9jdW1lbnRBcnJheVxuICAsIFNjaGVtYUFycmF5XG4gICwgRW1iZWRkZWQ7XG5cbi8qKlxuICog0JrQvtC90YHRgtGA0YPQutGC0L7RgCDQtNC+0LrRg9C80LXQvdGC0LAuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IGRhdGEgLSDQt9C90LDRh9C10L3QuNGPLCDQutC+0YLQvtGA0YvQtSDQvdGD0LbQvdC+INGD0YHRgtCw0L3QvtCy0LjRgtGMXG4gKiBAcGFyYW0ge3N0cmluZ3x1bmRlZmluZWR9IFtjb2xsZWN0aW9uTmFtZV0gLSDQutC+0LvQu9C10LrRhtC40Y8g0LIg0LrQvtGC0L7RgNC+0Lkg0LHRg9C00LXRgiDQvdCw0YXQvtC00LjRgtGB0Y8g0LTQvtC60YPQvNC10L3RglxuICogQHBhcmFtIHtTY2hlbWF9IHNjaGVtYSAtINGB0YXQtdC80LAg0L/QviDQutC+0YLQvtGA0L7QuSDQsdGD0LTQtdGCINGB0L7Qt9C00LDQvSDQtNC+0LrRg9C80LXQvdGCXG4gKiBAcGFyYW0ge29iamVjdH0gW2ZpZWxkc10gLSDQstGL0LHRgNCw0L3QvdGL0LUg0L/QvtC70Y8g0LIg0LTQvtC60YPQvNC10L3RgtC1ICjQvdC1INGA0LXQsNC70LjQt9C+0LLQsNC90L4pXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtpbml0XSAtIGh5ZHJhdGUgZG9jdW1lbnQgLSDQvdCw0L/QvtC70L3QuNGC0Ywg0LTQvtC60YPQvNC10L3RgiDQtNCw0L3QvdGL0LzQuCAo0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINCyIGFwaS1jbGllbnQpXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gRG9jdW1lbnQgKCBkYXRhLCBjb2xsZWN0aW9uTmFtZSwgc2NoZW1hLCBmaWVsZHMsIGluaXQgKXtcbiAgdGhpcy5pc05ldyA9IHRydWU7XG5cbiAgLy8g0KHQvtC30LTQsNGC0Ywg0L/Rg9GB0YLQvtC5INC00L7QutGD0LzQtdC90YIg0YEg0YTQu9Cw0LPQvtC8IGluaXRcbiAgLy8gbmV3IFRlc3REb2N1bWVudCh0cnVlKTtcbiAgaWYgKCAnYm9vbGVhbicgPT09IHR5cGVvZiBkYXRhICl7XG4gICAgaW5pdCA9IGRhdGE7XG4gICAgZGF0YSA9IG51bGw7XG4gIH1cblxuICAvLyDQodC+0LfQtNCw0YLRjCDQtNC+0LrRg9C80LXQvdGCINGBINGE0LvQsNCz0L7QvCBpbml0XG4gIC8vIG5ldyBUZXN0RG9jdW1lbnQoeyB0ZXN0OiAnYm9vbScgfSwgdHJ1ZSk7XG4gIGlmICggJ2Jvb2xlYW4nID09PSB0eXBlb2YgY29sbGVjdGlvbk5hbWUgKXtcbiAgICBpbml0ID0gY29sbGVjdGlvbk5hbWU7XG4gICAgY29sbGVjdGlvbk5hbWUgPSB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyDQodC+0LfQtNCw0YLRjCDQv9GD0YHRgtC+0Lkg0LTQvtC60YPQvNC10L3RgiDQv9C+INGB0YXQtdC80LVcbiAgaWYgKCBkYXRhIGluc3RhbmNlb2YgU2NoZW1hICl7XG4gICAgc2NoZW1hID0gZGF0YTtcbiAgICBkYXRhID0gbnVsbDtcblxuICAgIGlmICggc2NoZW1hLm9wdGlvbnMuX2lkICl7XG4gICAgICBkYXRhID0geyBfaWQ6IG5ldyBPYmplY3RJZCgpIH07XG4gICAgfVxuXG4gIH0gZWxzZSB7XG4gICAgLy8g0J/RgNC4INGB0L7Qt9C00LDQvdC40LggRW1iZWRkZWREb2N1bWVudCwg0LIg0L3RkdC8INGD0LbQtSDQtdGB0YLRjCDRgdGF0LXQvNCwINC4INC10LzRgyDQvdC1INC90YPQttC10L0gX2lkXG4gICAgc2NoZW1hID0gdGhpcy5zY2hlbWEgfHwgc2NoZW1hO1xuICAgIC8vINCh0LPQtdC90LXRgNC40YDQvtCy0LDRgtGMIE9iamVjdElkLCDQtdGB0LvQuCDQvtC9INC+0YLRgdGD0YLRgdGC0LLRg9C10YIg0Lgg0LXQs9C+INGC0YDQtdCx0YPQtdGCINGB0YXQtdC80LBcbiAgICBpZiAoICF0aGlzLnNjaGVtYSAmJiBzY2hlbWEub3B0aW9ucy5faWQgKXtcbiAgICAgIGRhdGEgPSBkYXRhIHx8IHt9O1xuXG4gICAgICBpZiAoICFkYXRhLl9pZCApe1xuICAgICAgICBkYXRhLl9pZCA9IG5ldyBPYmplY3RJZCgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmICggIXNjaGVtYSApe1xuICAgIC8vdG9kbzogdGhyb3cgbmV3IG1vbmdvb3NlLkVycm9yLk1pc3NpbmdTY2hlbWFFcnJvcihuYW1lKTtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCfQndC10LvRjNC30Y8g0YHQvtC30LTQsNCy0LDRgtGMINC00L7QutGD0LzQtdC90YIg0LHQtdC3INGB0YXQtdC80YsnKTtcbiAgfVxuXG4gIHRoaXMuc2NoZW1hID0gc2NoZW1hO1xuICB0aGlzLmNvbGxlY3Rpb24gPSB3aW5kb3cuc3RvcmFnZVsgY29sbGVjdGlvbk5hbWUgXTtcbiAgdGhpcy5jb2xsZWN0aW9uTmFtZSA9IGNvbGxlY3Rpb25OYW1lO1xuXG4gIGlmICggdGhpcy5jb2xsZWN0aW9uICl7XG4gICAgaWYgKCBkYXRhID09IG51bGwgfHwgIWRhdGEuX2lkICl7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCfQlNC70Y8g0L/QvtC80LXRidC10L3QuNGPINCyINC60L7Qu9C70LXQutGG0LjRjiDQvdC10L7QsdGF0L7QtNC40LzQviwg0YfRgtC+0LHRiyDRgyDQtNC+0LrRg9C80LXQvdGC0LAg0LHRi9C7IF9pZCcpO1xuICAgIH1cbiAgICAvLyDQn9C+0LzQtdGB0YLQuNGC0Ywg0LTQvtC60YPQvNC10L3RgiDQsiDQutC+0LvQu9C10LrRhtC40Y5cbiAgICB0aGlzLmNvbGxlY3Rpb24uZG9jdW1lbnRzWyBkYXRhLl9pZCBdID0gdGhpcztcbiAgfVxuXG4gIHRoaXMuJF9fID0gbmV3IEludGVybmFsQ2FjaGU7XG4gIHRoaXMuJF9fLnN0cmljdE1vZGUgPSBzY2hlbWEub3B0aW9ucyAmJiBzY2hlbWEub3B0aW9ucy5zdHJpY3Q7XG4gIHRoaXMuJF9fLnNlbGVjdGVkID0gZmllbGRzO1xuXG4gIHZhciByZXF1aXJlZCA9IHNjaGVtYS5yZXF1aXJlZFBhdGhzKCk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcmVxdWlyZWQubGVuZ3RoOyArK2kpIHtcbiAgICB0aGlzLiRfXy5hY3RpdmVQYXRocy5yZXF1aXJlKCByZXF1aXJlZFtpXSApO1xuICB9XG5cbiAgdGhpcy4kX19zZXRTY2hlbWEoIHNjaGVtYSApO1xuXG4gIHRoaXMuX2RvYyA9IHRoaXMuJF9fYnVpbGREb2MoIGRhdGEsIGluaXQgKTtcblxuICBpZiAoIGluaXQgKXtcbiAgICB0aGlzLmluaXQoIGRhdGEgKTtcbiAgfSBlbHNlIGlmICggZGF0YSApIHtcbiAgICB0aGlzLnNldCggZGF0YSwgdW5kZWZpbmVkLCB0cnVlICk7XG4gIH1cblxuICAvLyBhcHBseSBtZXRob2RzXG4gIGZvciAoIHZhciBtIGluIHNjaGVtYS5tZXRob2RzICl7XG4gICAgdGhpc1sgbSBdID0gc2NoZW1hLm1ldGhvZHNbIG0gXTtcbiAgfVxuICAvLyBhcHBseSBzdGF0aWNzXG4gIGZvciAoIHZhciBzIGluIHNjaGVtYS5zdGF0aWNzICl7XG4gICAgdGhpc1sgcyBdID0gc2NoZW1hLnN0YXRpY3NbIHMgXTtcbiAgfVxufVxuXG4vKiFcbiAqIEluaGVyaXRzIGZyb20gRXZlbnRFbWl0dGVyLlxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuX19wcm90b19fID0gRXZlbnRzLnByb3RvdHlwZTtcblxuLyoqXG4gKiBUaGUgZG9jdW1lbnRzIHNjaGVtYS5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICogQHByb3BlcnR5IHNjaGVtYVxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuc2NoZW1hO1xuXG4vKipcbiAqIEJvb2xlYW4gZmxhZyBzcGVjaWZ5aW5nIGlmIHRoZSBkb2N1bWVudCBpcyBuZXcuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqIEBwcm9wZXJ0eSBpc05ld1xuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuaXNOZXc7XG5cbi8qKlxuICogVGhlIHN0cmluZyB2ZXJzaW9uIG9mIHRoaXMgZG9jdW1lbnRzIF9pZC5cbiAqXG4gKiAjIyMjTm90ZTpcbiAqXG4gKiBUaGlzIGdldHRlciBleGlzdHMgb24gYWxsIGRvY3VtZW50cyBieSBkZWZhdWx0LiBUaGUgZ2V0dGVyIGNhbiBiZSBkaXNhYmxlZCBieSBzZXR0aW5nIHRoZSBgaWRgIFtvcHRpb25dKC9kb2NzL2d1aWRlLmh0bWwjaWQpIG9mIGl0cyBgU2NoZW1hYCB0byBmYWxzZSBhdCBjb25zdHJ1Y3Rpb24gdGltZS5cbiAqXG4gKiAgICAgbmV3IFNjaGVtYSh7IG5hbWU6IFN0cmluZyB9LCB7IGlkOiBmYWxzZSB9KTtcbiAqXG4gKiBAYXBpIHB1YmxpY1xuICogQHNlZSBTY2hlbWEgb3B0aW9ucyAvZG9jcy9ndWlkZS5odG1sI29wdGlvbnNcbiAqIEBwcm9wZXJ0eSBpZFxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuaWQ7XG5cbi8qKlxuICogSGFzaCBjb250YWluaW5nIGN1cnJlbnQgdmFsaWRhdGlvbiBlcnJvcnMuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqIEBwcm9wZXJ0eSBlcnJvcnNcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLmVycm9ycztcblxuLyoqXG4gKiBCdWlsZHMgdGhlIGRlZmF1bHQgZG9jIHN0cnVjdHVyZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW3NraXBJZF1cbiAqIEByZXR1cm4ge09iamVjdH1cbiAqIEBhcGkgcHJpdmF0ZVxuICogQG1ldGhvZCAkX19idWlsZERvY1xuICogQG1lbWJlck9mIERvY3VtZW50XG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS4kX19idWlsZERvYyA9IGZ1bmN0aW9uICggb2JqLCBza2lwSWQgKSB7XG4gIHZhciBkb2MgPSB7fVxuICAgICwgc2VsZiA9IHRoaXM7XG5cbiAgdmFyIHBhdGhzID0gT2JqZWN0LmtleXMoIHRoaXMuc2NoZW1hLnBhdGhzIClcbiAgICAsIHBsZW4gPSBwYXRocy5sZW5ndGhcbiAgICAsIGlpID0gMDtcblxuICBmb3IgKCA7IGlpIDwgcGxlbjsgKytpaSApIHtcbiAgICB2YXIgcCA9IHBhdGhzW2lpXTtcblxuICAgIGlmICggJ19pZCcgPT0gcCApIHtcbiAgICAgIGlmICggc2tpcElkICkgY29udGludWU7XG4gICAgICBpZiAoIG9iaiAmJiAnX2lkJyBpbiBvYmogKSBjb250aW51ZTtcbiAgICB9XG5cbiAgICB2YXIgdHlwZSA9IHRoaXMuc2NoZW1hLnBhdGhzWyBwIF1cbiAgICAgICwgcGF0aCA9IHAuc3BsaXQoJy4nKVxuICAgICAgLCBsZW4gPSBwYXRoLmxlbmd0aFxuICAgICAgLCBsYXN0ID0gbGVuIC0gMVxuICAgICAgLCBkb2NfID0gZG9jXG4gICAgICAsIGkgPSAwO1xuXG4gICAgZm9yICggOyBpIDwgbGVuOyArK2kgKSB7XG4gICAgICB2YXIgcGllY2UgPSBwYXRoWyBpIF1cbiAgICAgICAgLCBkZWZhdWx0VmFsO1xuXG4gICAgICBpZiAoIGkgPT09IGxhc3QgKSB7XG4gICAgICAgIGRlZmF1bHRWYWwgPSB0eXBlLmdldERlZmF1bHQoIHNlbGYsIHRydWUgKTtcblxuICAgICAgICBpZiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBkZWZhdWx0VmFsICkge1xuICAgICAgICAgIGRvY19bIHBpZWNlIF0gPSBkZWZhdWx0VmFsO1xuICAgICAgICAgIHNlbGYuJF9fLmFjdGl2ZVBhdGhzLmRlZmF1bHQoIHAgKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZG9jXyA9IGRvY19bIHBpZWNlIF0gfHwgKCBkb2NfWyBwaWVjZSBdID0ge30gKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gZG9jO1xufTtcblxuLyoqXG4gKiBJbml0aWFsaXplcyB0aGUgZG9jdW1lbnQgd2l0aG91dCBzZXR0ZXJzIG9yIG1hcmtpbmcgYW55dGhpbmcgbW9kaWZpZWQuXG4gKlxuICogQ2FsbGVkIGludGVybmFsbHkgYWZ0ZXIgYSBkb2N1bWVudCBpcyByZXR1cm5lZCBmcm9tIHNlcnZlci5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gZGF0YSBkb2N1bWVudCByZXR1cm5lZCBieSBzZXJ2ZXJcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uICggZGF0YSApIHtcbiAgdGhpcy5pc05ldyA9IGZhbHNlO1xuXG4gIC8vdG9kbzog0YHQtNC10YHRjCDQstGB0ZEg0LjQt9C80LXQvdC40YLRgdGPLCDRgdC80L7RgtGA0LXRgtGMINC60L7QvNC80LXQvdGCINC80LXRgtC+0LTQsCB0aGlzLnBvcHVsYXRlZFxuICAvLyBoYW5kbGUgZG9jcyB3aXRoIHBvcHVsYXRlZCBwYXRoc1xuICAvKmlmICggZG9jLl9pZCAmJiBvcHRzICYmIG9wdHMucG9wdWxhdGVkICYmIG9wdHMucG9wdWxhdGVkLmxlbmd0aCApIHtcbiAgICB2YXIgaWQgPSBTdHJpbmcoIGRvYy5faWQgKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9wdHMucG9wdWxhdGVkLmxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgaXRlbSA9IG9wdHMucG9wdWxhdGVkWyBpIF07XG4gICAgICB0aGlzLnBvcHVsYXRlZCggaXRlbS5wYXRoLCBpdGVtLl9kb2NzW2lkXSwgaXRlbSApO1xuICAgIH1cbiAgfSovXG5cbiAgaW5pdCggdGhpcywgZGF0YSwgdGhpcy5fZG9jICk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKiFcbiAqIEluaXQgaGVscGVyLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBzZWxmIGRvY3VtZW50IGluc3RhbmNlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIHJhdyBzZXJ2ZXIgZG9jXG4gKiBAcGFyYW0ge09iamVjdH0gZG9jIG9iamVjdCB3ZSBhcmUgaW5pdGlhbGl6aW5nXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gaW5pdCAoc2VsZiwgb2JqLCBkb2MsIHByZWZpeCkge1xuICBwcmVmaXggPSBwcmVmaXggfHwgJyc7XG5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopXG4gICAgLCBsZW4gPSBrZXlzLmxlbmd0aFxuICAgICwgc2NoZW1hXG4gICAgLCBwYXRoXG4gICAgLCBpO1xuXG4gIHdoaWxlIChsZW4tLSkge1xuICAgIGkgPSBrZXlzW2xlbl07XG4gICAgcGF0aCA9IHByZWZpeCArIGk7XG4gICAgc2NoZW1hID0gc2VsZi5zY2hlbWEucGF0aChwYXRoKTtcblxuICAgIGlmICghc2NoZW1hICYmIF8uaXNQbGFpbk9iamVjdCggb2JqWyBpIF0gKSAmJlxuICAgICAgICAoIW9ialtpXS5jb25zdHJ1Y3RvciB8fCAnT2JqZWN0JyA9PSBvYmpbaV0uY29uc3RydWN0b3IubmFtZSkpIHtcbiAgICAgIC8vIGFzc3VtZSBuZXN0ZWQgb2JqZWN0XG4gICAgICBpZiAoIWRvY1tpXSkgZG9jW2ldID0ge307XG4gICAgICBpbml0KHNlbGYsIG9ialtpXSwgZG9jW2ldLCBwYXRoICsgJy4nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG9ialtpXSA9PT0gbnVsbCkge1xuICAgICAgICBkb2NbaV0gPSBudWxsO1xuICAgICAgfSBlbHNlIGlmIChvYmpbaV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB2YXIgb2JzZXJ2YWJsZSA9IGtvLmdldE9ic2VydmFibGUoIHNlbGYsIHBhdGggKTtcblxuICAgICAgICBpZiAoc2NoZW1hKSB7XG4gICAgICAgICAgc2VsZi4kX190cnkoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGRvY1tpXSA9IHNjaGVtYS5jYXN0KG9ialtpXSwgc2VsZiwgdHJ1ZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZG9jW2ldID0gb2JqW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g0KPRgdGC0LDQvdC+0LLQuNGC0Ywg0L3QsNGH0LDQu9GM0L3QvtC1INC30L3QsNGH0LXQvdC40LVcbiAgICAgICAgb2JzZXJ2YWJsZSAmJiBvYnNlcnZhYmxlKCBkb2NbaV0gKTtcbiAgICAgIH1cbiAgICAgIC8vIG1hcmsgYXMgaHlkcmF0ZWRcbiAgICAgIHNlbGYuJF9fLmFjdGl2ZVBhdGhzLmluaXQocGF0aCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogU2V0cyB0aGUgdmFsdWUgb2YgYSBwYXRoLCBvciBtYW55IHBhdGhzLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICAvLyBwYXRoLCB2YWx1ZVxuICogICAgIGRvYy5zZXQocGF0aCwgdmFsdWUpXG4gKlxuICogICAgIC8vIG9iamVjdFxuICogICAgIGRvYy5zZXQoe1xuICogICAgICAgICBwYXRoICA6IHZhbHVlXG4gKiAgICAgICAsIHBhdGgyIDoge1xuICogICAgICAgICAgICBwYXRoICA6IHZhbHVlXG4gKiAgICAgICAgIH1cbiAqICAgICB9KVxuICpcbiAqICAgICAvLyBvbmx5LXRoZS1mbHkgY2FzdCB0byBudW1iZXJcbiAqICAgICBkb2Muc2V0KHBhdGgsIHZhbHVlLCBOdW1iZXIpXG4gKlxuICogICAgIC8vIG9ubHktdGhlLWZseSBjYXN0IHRvIHN0cmluZ1xuICogICAgIGRvYy5zZXQocGF0aCwgdmFsdWUsIFN0cmluZylcbiAqXG4gKiAgICAgLy8gY2hhbmdpbmcgc3RyaWN0IG1vZGUgYmVoYXZpb3JcbiAqICAgICBkb2Muc2V0KHBhdGgsIHZhbHVlLCB7IHN0cmljdDogZmFsc2UgfSk7XG4gKlxuICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBwYXRoIHBhdGggb3Igb2JqZWN0IG9mIGtleS92YWxzIHRvIHNldFxuICogQHBhcmFtIHtNaXhlZH0gdmFsIHRoZSB2YWx1ZSB0byBzZXRcbiAqIEBwYXJhbSB7U2NoZW1hfFN0cmluZ3xOdW1iZXJ8ZXRjLi59IFt0eXBlXSBvcHRpb25hbGx5IHNwZWNpZnkgYSB0eXBlIGZvciBcIm9uLXRoZS1mbHlcIiBhdHRyaWJ1dGVzXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIG9wdGlvbmFsbHkgc3BlY2lmeSBvcHRpb25zIHRoYXQgbW9kaWZ5IHRoZSBiZWhhdmlvciBvZiB0aGUgc2V0XG4gKiBAYXBpIHB1YmxpY1xuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKHBhdGgsIHZhbCwgdHlwZSwgb3B0aW9ucykge1xuICBpZiAodHlwZSAmJiAnT2JqZWN0JyA9PSB0eXBlLmNvbnN0cnVjdG9yLm5hbWUpIHtcbiAgICBvcHRpb25zID0gdHlwZTtcbiAgICB0eXBlID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgdmFyIG1lcmdlID0gb3B0aW9ucyAmJiBvcHRpb25zLm1lcmdlXG4gICAgLCBhZGhvYyA9IHR5cGUgJiYgdHJ1ZSAhPT0gdHlwZVxuICAgICwgY29uc3RydWN0aW5nID0gdHJ1ZSA9PT0gdHlwZVxuICAgICwgYWRob2NzO1xuXG4gIHZhciBzdHJpY3QgPSBvcHRpb25zICYmICdzdHJpY3QnIGluIG9wdGlvbnNcbiAgICA/IG9wdGlvbnMuc3RyaWN0XG4gICAgOiB0aGlzLiRfXy5zdHJpY3RNb2RlO1xuXG4gIGlmIChhZGhvYykge1xuICAgIGFkaG9jcyA9IHRoaXMuJF9fLmFkaG9jUGF0aHMgfHwgKHRoaXMuJF9fLmFkaG9jUGF0aHMgPSB7fSk7XG4gICAgYWRob2NzW3BhdGhdID0gU2NoZW1hLmludGVycHJldEFzVHlwZShwYXRoLCB0eXBlKTtcbiAgfVxuXG4gIGlmICgnc3RyaW5nJyAhPT0gdHlwZW9mIHBhdGgpIHtcbiAgICAvLyBuZXcgRG9jdW1lbnQoeyBrZXk6IHZhbCB9KVxuXG4gICAgaWYgKG51bGwgPT09IHBhdGggfHwgdW5kZWZpbmVkID09PSBwYXRoKSB7XG4gICAgICB2YXIgX3RlbXAgPSBwYXRoO1xuICAgICAgcGF0aCA9IHZhbDtcbiAgICAgIHZhbCA9IF90ZW1wO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBwcmVmaXggPSB2YWxcbiAgICAgICAgPyB2YWwgKyAnLidcbiAgICAgICAgOiAnJztcblxuICAgICAgaWYgKHBhdGggaW5zdGFuY2VvZiBEb2N1bWVudCkgcGF0aCA9IHBhdGguX2RvYztcblxuICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhwYXRoKVxuICAgICAgICAsIGkgPSBrZXlzLmxlbmd0aFxuICAgICAgICAsIHBhdGh0eXBlXG4gICAgICAgICwga2V5O1xuXG5cbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgcGF0aHR5cGUgPSB0aGlzLnNjaGVtYS5wYXRoVHlwZShwcmVmaXggKyBrZXkpO1xuICAgICAgICBpZiAobnVsbCAhPSBwYXRoW2tleV1cbiAgICAgICAgICAgIC8vIG5lZWQgdG8ga25vdyBpZiBwbGFpbiBvYmplY3QgLSBubyBCdWZmZXIsIE9iamVjdElkLCByZWYsIGV0Y1xuICAgICAgICAgICAgJiYgXy5pc1BsYWluT2JqZWN0KHBhdGhba2V5XSlcbiAgICAgICAgICAgICYmICggIXBhdGhba2V5XS5jb25zdHJ1Y3RvciB8fCAnT2JqZWN0JyA9PSBwYXRoW2tleV0uY29uc3RydWN0b3IubmFtZSApXG4gICAgICAgICAgICAmJiAndmlydHVhbCcgIT0gcGF0aHR5cGVcbiAgICAgICAgICAgICYmICEoIHRoaXMuJF9fcGF0aCggcHJlZml4ICsga2V5ICkgaW5zdGFuY2VvZiBNaXhlZFNjaGVtYSApXG4gICAgICAgICAgICAmJiAhKCB0aGlzLnNjaGVtYS5wYXRoc1trZXldICYmIHRoaXMuc2NoZW1hLnBhdGhzW2tleV0ub3B0aW9ucy5yZWYgKVxuICAgICAgICAgICl7XG5cbiAgICAgICAgICB0aGlzLnNldChwYXRoW2tleV0sIHByZWZpeCArIGtleSwgY29uc3RydWN0aW5nKTtcblxuICAgICAgICB9IGVsc2UgaWYgKHN0cmljdCkge1xuICAgICAgICAgIGlmICgncmVhbCcgPT09IHBhdGh0eXBlIHx8ICd2aXJ0dWFsJyA9PT0gcGF0aHR5cGUpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0KHByZWZpeCArIGtleSwgcGF0aFtrZXldLCBjb25zdHJ1Y3RpbmcpO1xuXG4gICAgICAgICAgfSBlbHNlIGlmICgndGhyb3cnID09IHN0cmljdCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRmllbGQgYFwiICsga2V5ICsgXCJgIGlzIG5vdCBpbiBzY2hlbWEuXCIpO1xuICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKHVuZGVmaW5lZCAhPT0gcGF0aFtrZXldKSB7XG4gICAgICAgICAgdGhpcy5zZXQocHJlZml4ICsga2V5LCBwYXRoW2tleV0sIGNvbnN0cnVjdGluZyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9XG5cbiAgLy8gZW5zdXJlIF9zdHJpY3QgaXMgaG9ub3JlZCBmb3Igb2JqIHByb3BzXG4gIC8vIGRvY3NjaGVtYSA9IG5ldyBTY2hlbWEoeyBwYXRoOiB7IG5lc3Q6ICdzdHJpbmcnIH19KVxuICAvLyBkb2Muc2V0KCdwYXRoJywgb2JqKTtcbiAgdmFyIHBhdGhUeXBlID0gdGhpcy5zY2hlbWEucGF0aFR5cGUocGF0aCk7XG4gIGlmICgnbmVzdGVkJyA9PSBwYXRoVHlwZSAmJiB2YWwgJiYgXy5pc1BsYWluT2JqZWN0KHZhbCkgJiZcbiAgICAgICghdmFsLmNvbnN0cnVjdG9yIHx8ICdPYmplY3QnID09IHZhbC5jb25zdHJ1Y3Rvci5uYW1lKSkge1xuICAgIGlmICghbWVyZ2UpIHRoaXMuc2V0VmFsdWUocGF0aCwgbnVsbCk7XG4gICAgdGhpcy5zZXQodmFsLCBwYXRoLCBjb25zdHJ1Y3RpbmcpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgdmFyIHNjaGVtYTtcbiAgdmFyIHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xuICB2YXIgc3VicGF0aDtcblxuICBpZiAoJ2FkaG9jT3JVbmRlZmluZWQnID09IHBhdGhUeXBlICYmIHN0cmljdCkge1xuXG4gICAgLy8gY2hlY2sgZm9yIHJvb3RzIHRoYXQgYXJlIE1peGVkIHR5cGVzXG4gICAgdmFyIG1peGVkO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7ICsraSkge1xuICAgICAgc3VicGF0aCA9IHBhcnRzLnNsaWNlKDAsIGkrMSkuam9pbignLicpO1xuICAgICAgc2NoZW1hID0gdGhpcy5zY2hlbWEucGF0aChzdWJwYXRoKTtcbiAgICAgIGlmIChzY2hlbWEgaW5zdGFuY2VvZiBNaXhlZFNjaGVtYSkge1xuICAgICAgICAvLyBhbGxvdyBjaGFuZ2VzIHRvIHN1YiBwYXRocyBvZiBtaXhlZCB0eXBlc1xuICAgICAgICBtaXhlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghbWl4ZWQpIHtcbiAgICAgIGlmICgndGhyb3cnID09IHN0cmljdCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJGaWVsZCBgXCIgKyBwYXRoICsgXCJgIGlzIG5vdCBpbiBzY2hlbWEuXCIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gIH0gZWxzZSBpZiAoJ3ZpcnR1YWwnID09IHBhdGhUeXBlKSB7XG4gICAgc2NoZW1hID0gdGhpcy5zY2hlbWEudmlydHVhbHBhdGgocGF0aCk7XG4gICAgc2NoZW1hLmFwcGx5U2V0dGVycyh2YWwsIHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9IGVsc2Uge1xuICAgIHNjaGVtYSA9IHRoaXMuJF9fcGF0aChwYXRoKTtcbiAgfVxuXG4gIHZhciBwYXRoVG9NYXJrO1xuXG4gIC8vIFdoZW4gdXNpbmcgdGhlICRzZXQgb3BlcmF0b3IgdGhlIHBhdGggdG8gdGhlIGZpZWxkIG11c3QgYWxyZWFkeSBleGlzdC5cbiAgLy8gRWxzZSBtb25nb2RiIHRocm93czogXCJMRUZUX1NVQkZJRUxEIG9ubHkgc3VwcG9ydHMgT2JqZWN0XCJcblxuICBpZiAocGFydHMubGVuZ3RoIDw9IDEpIHtcbiAgICBwYXRoVG9NYXJrID0gcGF0aDtcbiAgfSBlbHNlIHtcbiAgICBmb3IgKCBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgKytpICkge1xuICAgICAgc3VicGF0aCA9IHBhcnRzLnNsaWNlKDAsIGkgKyAxKS5qb2luKCcuJyk7XG4gICAgICBpZiAodGhpcy5pc0RpcmVjdE1vZGlmaWVkKHN1YnBhdGgpIC8vIGVhcmxpZXIgcHJlZml4ZXMgdGhhdCBhcmUgYWxyZWFkeVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBtYXJrZWQgYXMgZGlydHkgaGF2ZSBwcmVjZWRlbmNlXG4gICAgICAgICAgfHwgdGhpcy5nZXQoc3VicGF0aCkgPT09IG51bGwpIHtcbiAgICAgICAgcGF0aFRvTWFyayA9IHN1YnBhdGg7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghcGF0aFRvTWFyaykgcGF0aFRvTWFyayA9IHBhdGg7XG4gIH1cblxuICAvLyBpZiB0aGlzIGRvYyBpcyBiZWluZyBjb25zdHJ1Y3RlZCB3ZSBzaG91bGQgbm90IHRyaWdnZXIgZ2V0dGVyc1xuICB2YXIgcHJpb3JWYWwgPSBjb25zdHJ1Y3RpbmdcbiAgICA/IHVuZGVmaW5lZFxuICAgIDogdGhpcy5nZXRWYWx1ZShwYXRoKTtcblxuICBpZiAoIXNjaGVtYSB8fCB1bmRlZmluZWQgPT09IHZhbCkge1xuICAgIHRoaXMuJF9fc2V0KHBhdGhUb01hcmssIHBhdGgsIGNvbnN0cnVjdGluZywgcGFydHMsIHNjaGVtYSwgdmFsLCBwcmlvclZhbCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBzaG91bGRTZXQgPSB0aGlzLiRfX3RyeShmdW5jdGlvbigpe1xuICAgIHZhbCA9IHNjaGVtYS5hcHBseVNldHRlcnModmFsLCBzZWxmLCBmYWxzZSwgcHJpb3JWYWwpO1xuICB9KTtcblxuICBpZiAoc2hvdWxkU2V0KSB7XG4gICAgdGhpcy4kX19zZXQocGF0aFRvTWFyaywgcGF0aCwgY29uc3RydWN0aW5nLCBwYXJ0cywgc2NoZW1hLCB2YWwsIHByaW9yVmFsKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgd2Ugc2hvdWxkIG1hcmsgdGhpcyBjaGFuZ2UgYXMgbW9kaWZpZWQuXG4gKlxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHJpdmF0ZVxuICogQG1ldGhvZCAkX19zaG91bGRNb2RpZnlcbiAqIEBtZW1iZXJPZiBEb2N1bWVudFxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuJF9fc2hvdWxkTW9kaWZ5ID0gZnVuY3Rpb24gKFxuICAgIHBhdGhUb01hcmssIHBhdGgsIGNvbnN0cnVjdGluZywgcGFydHMsIHNjaGVtYSwgdmFsLCBwcmlvclZhbCkge1xuXG4gIGlmICh0aGlzLmlzTmV3KSByZXR1cm4gdHJ1ZTtcblxuICBpZiAoIHVuZGVmaW5lZCA9PT0gdmFsICYmICF0aGlzLmlzU2VsZWN0ZWQocGF0aCkgKSB7XG4gICAgLy8gd2hlbiBhIHBhdGggaXMgbm90IHNlbGVjdGVkIGluIGEgcXVlcnksIGl0cyBpbml0aWFsXG4gICAgLy8gdmFsdWUgd2lsbCBiZSB1bmRlZmluZWQuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBpZiAodW5kZWZpbmVkID09PSB2YWwgJiYgcGF0aCBpbiB0aGlzLiRfXy5hY3RpdmVQYXRocy5zdGF0ZXMuZGVmYXVsdCkge1xuICAgIC8vIHdlJ3JlIGp1c3QgdW5zZXR0aW5nIHRoZSBkZWZhdWx0IHZhbHVlIHdoaWNoIHdhcyBuZXZlciBzYXZlZFxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICghdXRpbHMuZGVlcEVxdWFsKHZhbCwgcHJpb3JWYWwgfHwgdGhpcy5nZXQocGF0aCkpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvL9GC0LXRgdGCINC90LUg0L/RgNC+0YXQvtC00LjRgiDQuNC3LdC30LAg0L3QsNC70LjRh9C40Y8g0LvQuNGI0L3QtdCz0L4g0L/QvtC70Y8g0LIgc3RhdGVzLmRlZmF1bHQgKGNvbW1lbnRzKVxuICAvLyDQndCwINGB0LDQvNC+0Lwg0LTQtdC70LUg0L/QvtC70LUg0LLRgNC+0LTQtSDQuCDQvdC1INC70LjRiNC90LXQtVxuICAvL2NvbnNvbGUuaW5mbyggcGF0aCwgcGF0aCBpbiB0aGlzLiRfXy5hY3RpdmVQYXRocy5zdGF0ZXMuZGVmYXVsdCApO1xuICAvL2NvbnNvbGUubG9nKCB0aGlzLiRfXy5hY3RpdmVQYXRocyApO1xuXG4gIC8vINCa0L7Qs9C00LAg0LzRiyDRg9GB0YLQsNC90LDQstC70LjQstCw0LXQvCDRgtCw0LrQvtC1INC20LUg0LfQvdCw0YfQtdC90LjQtSDQutCw0LogZGVmYXVsdFxuICAvLyDQndC1INC/0L7QvdGP0YLQvdC+INC30LDRh9C10Lwg0LzQsNC90LPRg9GB0YIg0LXQs9C+INC+0LHQvdC+0LLQu9GP0LtcbiAgLyppZiAoIWNvbnN0cnVjdGluZyAmJlxuICAgICAgbnVsbCAhPSB2YWwgJiZcbiAgICAgIHBhdGggaW4gdGhpcy4kX18uYWN0aXZlUGF0aHMuc3RhdGVzLmRlZmF1bHQgJiZcbiAgICAgIHV0aWxzLmRlZXBFcXVhbCh2YWwsIHNjaGVtYS5nZXREZWZhdWx0KHRoaXMsIGNvbnN0cnVjdGluZykpICkge1xuXG4gICAgLy9jb25zb2xlLmxvZyggcGF0aFRvTWFyaywgdGhpcy4kX18uYWN0aXZlUGF0aHMuc3RhdGVzLm1vZGlmeSApO1xuXG4gICAgLy8gYSBwYXRoIHdpdGggYSBkZWZhdWx0IHdhcyAkdW5zZXQgb24gdGhlIHNlcnZlclxuICAgIC8vIGFuZCB0aGUgdXNlciBpcyBzZXR0aW5nIGl0IHRvIHRoZSBzYW1lIHZhbHVlIGFnYWluXG4gICAgcmV0dXJuIHRydWU7XG4gIH0qL1xuXG4gIHJldHVybiBmYWxzZTtcbn07XG5cbi8qKlxuICogSGFuZGxlcyB0aGUgYWN0dWFsIHNldHRpbmcgb2YgdGhlIHZhbHVlIGFuZCBtYXJraW5nIHRoZSBwYXRoIG1vZGlmaWVkIGlmIGFwcHJvcHJpYXRlLlxuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICogQG1ldGhvZCAkX19zZXRcbiAqIEBtZW1iZXJPZiBEb2N1bWVudFxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuJF9fc2V0ID0gZnVuY3Rpb24gKCBwYXRoVG9NYXJrLCBwYXRoLCBjb25zdHJ1Y3RpbmcsIHBhcnRzLCBzY2hlbWEsIHZhbCwgcHJpb3JWYWwgKSB7XG4gIHZhciBzaG91bGRNb2RpZnkgPSB0aGlzLiRfX3Nob3VsZE1vZGlmeS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gIGlmIChzaG91bGRNb2RpZnkpIHtcbiAgICB0aGlzLm1hcmtNb2RpZmllZChwYXRoVG9NYXJrLCB2YWwpO1xuICB9XG5cbiAgdmFyIG9iaiA9IHRoaXMuX2RvY1xuICAgICwgaSA9IDBcbiAgICAsIGwgPSBwYXJ0cy5sZW5ndGg7XG5cbiAgZm9yICg7IGkgPCBsOyBpKyspIHtcbiAgICB2YXIgbmV4dCA9IGkgKyAxXG4gICAgICAsIGxhc3QgPSBuZXh0ID09PSBsO1xuXG4gICAgaWYgKCBsYXN0ICkge1xuICAgICAgb2JqW3BhcnRzW2ldXSA9IHZhbDtcblxuICAgICAgdmFyIG9ic2VydmFibGUgPSBrby5nZXRPYnNlcnZhYmxlKCB0aGlzLCBwYXRoICk7XG5cbiAgICAgIC8vVE9ETzog0JjQvdC+0LPQtNCwIG9ic2VydmFibGUgPT09IG51bGwsINC/0L7QvdGP0YLRjCDQv9C+0YfQtdC80YMg0YLQsNC6INC/0L7RgNC40YHRhdC+0LTQuNGCINC4INC40YHQv9GA0LDQstC40YLRjCDRjdGC0L5cbiAgICAgIC8vY29uc29sZS5sb2coIHBhdGgsIG9ic2VydmFibGUgKTtcblxuICAgICAgLy8g0J7QsdC90L7QstC40Lwgb2JzZXJ2YWJsZSAo0YfRgtC+0LHRiyDRgNCw0LHQvtGC0LDQu9C4INC/0YDQuNCy0Y/Qt9C60LgpXG4gICAgICBvYnNlcnZhYmxlICYmIG9ic2VydmFibGUoIHZhbCApO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChvYmpbcGFydHNbaV1dICYmICdPYmplY3QnID09PSBvYmpbcGFydHNbaV1dLmNvbnN0cnVjdG9yLm5hbWUpIHtcbiAgICAgICAgb2JqID0gb2JqW3BhcnRzW2ldXTtcblxuICAgICAgfSBlbHNlIGlmIChvYmpbcGFydHNbaV1dICYmICdFbWJlZGRlZERvY3VtZW50JyA9PT0gb2JqW3BhcnRzW2ldXS5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgICAgIG9iaiA9IG9ialtwYXJ0c1tpXV07XG5cbiAgICAgIH0gZWxzZSBpZiAob2JqW3BhcnRzW2ldXSAmJiBBcnJheS5pc0FycmF5KG9ialtwYXJ0c1tpXV0pKSB7XG4gICAgICAgIG9iaiA9IG9ialtwYXJ0c1tpXV07XG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9iaiA9IG9ialtwYXJ0c1tpXV0gPSB7fTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogR2V0cyBhIHJhdyB2YWx1ZSBmcm9tIGEgcGF0aCAobm8gZ2V0dGVycylcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQGFwaSBwcml2YXRlXG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS5nZXRWYWx1ZSA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gIHJldHVybiB1dGlscy5nZXRWYWx1ZShwYXRoLCB0aGlzLl9kb2MpO1xufTtcblxuLyoqXG4gKiBTZXRzIGEgcmF3IHZhbHVlIGZvciBhIHBhdGggKG5vIGNhc3RpbmcsIHNldHRlcnMsIHRyYW5zZm9ybWF0aW9ucylcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLnNldFZhbHVlID0gZnVuY3Rpb24gKHBhdGgsIHZhbHVlKSB7XG4gIHV0aWxzLnNldFZhbHVlKHBhdGgsIHZhbHVlLCB0aGlzLl9kb2MpO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgdmFsdWUgb2YgYSBwYXRoLlxuICpcbiAqICMjIyNFeGFtcGxlXG4gKlxuICogICAgIC8vIHBhdGhcbiAqICAgICBkb2MuZ2V0KCdhZ2UnKSAvLyA0N1xuICpcbiAqICAgICAvLyBkeW5hbWljIGNhc3RpbmcgdG8gYSBzdHJpbmdcbiAqICAgICBkb2MuZ2V0KCdhZ2UnLCBTdHJpbmcpIC8vIFwiNDdcIlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge1NjaGVtYXxTdHJpbmd8TnVtYmVyfSBbdHlwZV0gb3B0aW9uYWxseSBzcGVjaWZ5IGEgdHlwZSBmb3Igb24tdGhlLWZseSBhdHRyaWJ1dGVzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKHBhdGgsIHR5cGUpIHtcbiAgdmFyIGFkaG9jcztcbiAgaWYgKHR5cGUpIHtcbiAgICBhZGhvY3MgPSB0aGlzLiRfXy5hZGhvY1BhdGhzIHx8ICh0aGlzLiRfXy5hZGhvY1BhdGhzID0ge30pO1xuICAgIGFkaG9jc1twYXRoXSA9IFNjaGVtYS5pbnRlcnByZXRBc1R5cGUocGF0aCwgdHlwZSk7XG4gIH1cblxuICB2YXIgc2NoZW1hID0gdGhpcy4kX19wYXRoKHBhdGgpIHx8IHRoaXMuc2NoZW1hLnZpcnR1YWxwYXRoKHBhdGgpXG4gICAgLCBwaWVjZXMgPSBwYXRoLnNwbGl0KCcuJylcbiAgICAsIG9iaiA9IHRoaXMuX2RvYztcblxuICBmb3IgKHZhciBpID0gMCwgbCA9IHBpZWNlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBvYmogPSB1bmRlZmluZWQgPT09IG9iaiB8fCBudWxsID09PSBvYmpcbiAgICAgID8gdW5kZWZpbmVkXG4gICAgICA6IG9ialtwaWVjZXNbaV1dO1xuICB9XG5cbiAgaWYgKHNjaGVtYSkge1xuICAgIG9iaiA9IHNjaGVtYS5hcHBseUdldHRlcnMob2JqLCB0aGlzKTtcbiAgfVxuXG4gIHZhciBvYnNlcnZhYmxlID0ga28uZ2V0T2JzZXJ2YWJsZSggdGhpcywgcGF0aCApO1xuICBvYnNlcnZhYmxlICYmIG9ic2VydmFibGUoKTtcblxuICByZXR1cm4gb2JqO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBzY2hlbWF0eXBlIGZvciB0aGUgZ2l2ZW4gYHBhdGhgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAYXBpIHByaXZhdGVcbiAqIEBtZXRob2QgJF9fcGF0aFxuICogQG1lbWJlck9mIERvY3VtZW50XG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS4kX19wYXRoID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgdmFyIGFkaG9jcyA9IHRoaXMuJF9fLmFkaG9jUGF0aHNcbiAgICAsIGFkaG9jVHlwZSA9IGFkaG9jcyAmJiBhZGhvY3NbcGF0aF07XG5cbiAgaWYgKGFkaG9jVHlwZSkge1xuICAgIHJldHVybiBhZGhvY1R5cGU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHRoaXMuc2NoZW1hLnBhdGgocGF0aCk7XG4gIH1cbn07XG5cbi8qKlxuICogTWFya3MgdGhlIHBhdGggYXMgaGF2aW5nIHBlbmRpbmcgY2hhbmdlcyB0byB3cml0ZSB0byB0aGUgZGIuXG4gKlxuICogX1ZlcnkgaGVscGZ1bCB3aGVuIHVzaW5nIFtNaXhlZF0oLi9zY2hlbWF0eXBlcy5odG1sI21peGVkKSB0eXBlcy5fXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIGRvYy5taXhlZC50eXBlID0gJ2NoYW5nZWQnO1xuICogICAgIGRvYy5tYXJrTW9kaWZpZWQoJ21peGVkLnR5cGUnKTtcbiAqICAgICBkb2Muc2F2ZSgpIC8vIGNoYW5nZXMgdG8gbWl4ZWQudHlwZSBhcmUgbm93IHBlcnNpc3RlZFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIHRoZSBwYXRoIHRvIG1hcmsgbW9kaWZpZWRcbiAqIEBhcGkgcHVibGljXG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS5tYXJrTW9kaWZpZWQgPSBmdW5jdGlvbiAocGF0aCkge1xuICB0aGlzLiRfXy5hY3RpdmVQYXRocy5tb2RpZnkocGF0aCk7XG59O1xuXG4vKipcbiAqIENhdGNoZXMgZXJyb3JzIHRoYXQgb2NjdXIgZHVyaW5nIGV4ZWN1dGlvbiBvZiBgZm5gIGFuZCBzdG9yZXMgdGhlbSB0byBsYXRlciBiZSBwYXNzZWQgd2hlbiBgc2F2ZSgpYCBpcyBleGVjdXRlZC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcGFyYW0ge09iamVjdH0gW3Njb3BlXSB0aGUgc2NvcGUgd2l0aCB3aGljaCB0byBjYWxsIGZuXG4gKiBAYXBpIHByaXZhdGVcbiAqIEBtZXRob2QgJF9fdHJ5XG4gKiBAbWVtYmVyT2YgRG9jdW1lbnRcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLiRfX3RyeSA9IGZ1bmN0aW9uIChmbiwgc2NvcGUpIHtcbiAgdmFyIHJlcztcbiAgdHJ5IHtcbiAgICBmbi5jYWxsKHNjb3BlKTtcbiAgICByZXMgPSB0cnVlO1xuICB9IGNhdGNoIChlKSB7XG4gICAgdGhpcy4kX19lcnJvcihlKTtcbiAgICByZXMgPSBmYWxzZTtcbiAgfVxuICByZXR1cm4gcmVzO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBsaXN0IG9mIHBhdGhzIHRoYXQgaGF2ZSBiZWVuIG1vZGlmaWVkLlxuICpcbiAqIEByZXR1cm4ge0FycmF5fVxuICogQGFwaSBwdWJsaWNcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLm1vZGlmaWVkUGF0aHMgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBkaXJlY3RNb2RpZmllZFBhdGhzID0gT2JqZWN0LmtleXModGhpcy4kX18uYWN0aXZlUGF0aHMuc3RhdGVzLm1vZGlmeSk7XG5cbiAgcmV0dXJuIGRpcmVjdE1vZGlmaWVkUGF0aHMucmVkdWNlKGZ1bmN0aW9uIChsaXN0LCBwYXRoKSB7XG4gICAgdmFyIHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xuICAgIHJldHVybiBsaXN0LmNvbmNhdChwYXJ0cy5yZWR1Y2UoZnVuY3Rpb24gKGNoYWlucywgcGFydCwgaSkge1xuICAgICAgcmV0dXJuIGNoYWlucy5jb25jYXQocGFydHMuc2xpY2UoMCwgaSkuY29uY2F0KHBhcnQpLmpvaW4oJy4nKSk7XG4gICAgfSwgW10pKTtcbiAgfSwgW10pO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhpcyBkb2N1bWVudCB3YXMgbW9kaWZpZWQsIGVsc2UgZmFsc2UuXG4gKlxuICogSWYgYHBhdGhgIGlzIGdpdmVuLCBjaGVja3MgaWYgYSBwYXRoIG9yIGFueSBmdWxsIHBhdGggY29udGFpbmluZyBgcGF0aGAgYXMgcGFydCBvZiBpdHMgcGF0aCBjaGFpbiBoYXMgYmVlbiBtb2RpZmllZC5cbiAqXG4gKiAjIyMjRXhhbXBsZVxuICpcbiAqICAgICBkb2Muc2V0KCdkb2N1bWVudHMuMC50aXRsZScsICdjaGFuZ2VkJyk7XG4gKiAgICAgZG9jLmlzTW9kaWZpZWQoKSAgICAgICAgICAgICAgICAgICAgLy8gdHJ1ZVxuICogICAgIGRvYy5pc01vZGlmaWVkKCdkb2N1bWVudHMnKSAgICAgICAgIC8vIHRydWVcbiAqICAgICBkb2MuaXNNb2RpZmllZCgnZG9jdW1lbnRzLjAudGl0bGUnKSAvLyB0cnVlXG4gKiAgICAgZG9jLmlzRGlyZWN0TW9kaWZpZWQoJ2RvY3VtZW50cycpICAgLy8gZmFsc2VcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gW3BhdGhdIG9wdGlvbmFsXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLmlzTW9kaWZpZWQgPSBmdW5jdGlvbiAocGF0aCkge1xuICByZXR1cm4gcGF0aFxuICAgID8gISF+dGhpcy5tb2RpZmllZFBhdGhzKCkuaW5kZXhPZihwYXRoKVxuICAgIDogdGhpcy4kX18uYWN0aXZlUGF0aHMuc29tZSgnbW9kaWZ5Jyk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiBgcGF0aGAgd2FzIGRpcmVjdGx5IHNldCBhbmQgbW9kaWZpZWQsIGVsc2UgZmFsc2UuXG4gKlxuICogIyMjI0V4YW1wbGVcbiAqXG4gKiAgICAgZG9jLnNldCgnZG9jdW1lbnRzLjAudGl0bGUnLCAnY2hhbmdlZCcpO1xuICogICAgIGRvYy5pc0RpcmVjdE1vZGlmaWVkKCdkb2N1bWVudHMuMC50aXRsZScpIC8vIHRydWVcbiAqICAgICBkb2MuaXNEaXJlY3RNb2RpZmllZCgnZG9jdW1lbnRzJykgLy8gZmFsc2VcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS5pc0RpcmVjdE1vZGlmaWVkID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgcmV0dXJuIChwYXRoIGluIHRoaXMuJF9fLmFjdGl2ZVBhdGhzLnN0YXRlcy5tb2RpZnkpO1xufTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHBhdGhgIHdhcyBpbml0aWFsaXplZC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS5pc0luaXQgPSBmdW5jdGlvbiAocGF0aCkge1xuICByZXR1cm4gKHBhdGggaW4gdGhpcy4kX18uYWN0aXZlUGF0aHMuc3RhdGVzLmluaXQpO1xufTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHBhdGhgIHdhcyBzZWxlY3RlZCBpbiB0aGUgc291cmNlIHF1ZXJ5IHdoaWNoIGluaXRpYWxpemVkIHRoaXMgZG9jdW1lbnQuXG4gKlxuICogIyMjI0V4YW1wbGVcbiAqXG4gKiAgICAgVGhpbmcuZmluZE9uZSgpLnNlbGVjdCgnbmFtZScpLmV4ZWMoZnVuY3Rpb24gKGVyciwgZG9jKSB7XG4gKiAgICAgICAgZG9jLmlzU2VsZWN0ZWQoJ25hbWUnKSAvLyB0cnVlXG4gKiAgICAgICAgZG9jLmlzU2VsZWN0ZWQoJ2FnZScpICAvLyBmYWxzZVxuICogICAgIH0pXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbkRvY3VtZW50LnByb3RvdHlwZS5pc1NlbGVjdGVkID0gZnVuY3Rpb24gaXNTZWxlY3RlZCAocGF0aCkge1xuICBpZiAodGhpcy4kX18uc2VsZWN0ZWQpIHtcblxuICAgIGlmICgnX2lkJyA9PT0gcGF0aCkge1xuICAgICAgcmV0dXJuIDAgIT09IHRoaXMuJF9fLnNlbGVjdGVkLl9pZDtcbiAgICB9XG5cbiAgICB2YXIgcGF0aHMgPSBPYmplY3Qua2V5cyh0aGlzLiRfXy5zZWxlY3RlZClcbiAgICAgICwgaSA9IHBhdGhzLmxlbmd0aFxuICAgICAgLCBpbmNsdXNpdmUgPSBmYWxzZVxuICAgICAgLCBjdXI7XG5cbiAgICBpZiAoMSA9PT0gaSAmJiAnX2lkJyA9PT0gcGF0aHNbMF0pIHtcbiAgICAgIC8vIG9ubHkgX2lkIHdhcyBzZWxlY3RlZC5cbiAgICAgIHJldHVybiAwID09PSB0aGlzLiRfXy5zZWxlY3RlZC5faWQ7XG4gICAgfVxuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgY3VyID0gcGF0aHNbaV07XG4gICAgICBpZiAoJ19pZCcgPT0gY3VyKSBjb250aW51ZTtcbiAgICAgIGluY2x1c2l2ZSA9ICEhIHRoaXMuJF9fLnNlbGVjdGVkW2N1cl07XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBpZiAocGF0aCBpbiB0aGlzLiRfXy5zZWxlY3RlZCkge1xuICAgICAgcmV0dXJuIGluY2x1c2l2ZTtcbiAgICB9XG5cbiAgICBpID0gcGF0aHMubGVuZ3RoO1xuICAgIHZhciBwYXRoRG90ID0gcGF0aCArICcuJztcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGN1ciA9IHBhdGhzW2ldO1xuICAgICAgaWYgKCdfaWQnID09IGN1cikgY29udGludWU7XG5cbiAgICAgIGlmICgwID09PSBjdXIuaW5kZXhPZihwYXRoRG90KSkge1xuICAgICAgICByZXR1cm4gaW5jbHVzaXZlO1xuICAgICAgfVxuXG4gICAgICBpZiAoMCA9PT0gcGF0aERvdC5pbmRleE9mKGN1ciArICcuJykpIHtcbiAgICAgICAgcmV0dXJuIGluY2x1c2l2ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gISBpbmNsdXNpdmU7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8qKlxuICogRXhlY3V0ZXMgcmVnaXN0ZXJlZCB2YWxpZGF0aW9uIHJ1bGVzIGZvciB0aGlzIGRvY3VtZW50LlxuICpcbiAqICMjIyNOb3RlOlxuICpcbiAqIFRoaXMgbWV0aG9kIGlzIGNhbGxlZCBgcHJlYCBzYXZlIGFuZCBpZiBhIHZhbGlkYXRpb24gcnVsZSBpcyB2aW9sYXRlZCwgW3NhdmVdKCNtb2RlbF9Nb2RlbC1zYXZlKSBpcyBhYm9ydGVkIGFuZCB0aGUgZXJyb3IgaXMgcmV0dXJuZWQgdG8geW91ciBgY2FsbGJhY2tgLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICBkb2MudmFsaWRhdGUoZnVuY3Rpb24gKGVycikge1xuICogICAgICAgaWYgKGVycikgaGFuZGxlRXJyb3IoZXJyKTtcbiAqICAgICAgIGVsc2UgLy8gdmFsaWRhdGlvbiBwYXNzZWRcbiAqICAgICB9KTtcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYiBjYWxsZWQgYWZ0ZXIgdmFsaWRhdGlvbiBjb21wbGV0ZXMsIHBhc3NpbmcgYW4gZXJyb3IgaWYgb25lIG9jY3VycmVkXG4gKiBAYXBpIHB1YmxpY1xuICovXG5Eb2N1bWVudC5wcm90b3R5cGUudmFsaWRhdGUgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIC8vIG9ubHkgdmFsaWRhdGUgcmVxdWlyZWQgZmllbGRzIHdoZW4gbmVjZXNzYXJ5XG4gIHZhciBwYXRocyA9IE9iamVjdC5rZXlzKHRoaXMuJF9fLmFjdGl2ZVBhdGhzLnN0YXRlcy5yZXF1aXJlKS5maWx0ZXIoZnVuY3Rpb24gKHBhdGgpIHtcbiAgICBpZiAoIXNlbGYuaXNTZWxlY3RlZChwYXRoKSAmJiAhc2VsZi5pc01vZGlmaWVkKHBhdGgpKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0pO1xuXG4gIHBhdGhzID0gcGF0aHMuY29uY2F0KE9iamVjdC5rZXlzKHRoaXMuJF9fLmFjdGl2ZVBhdGhzLnN0YXRlcy5pbml0KSk7XG4gIHBhdGhzID0gcGF0aHMuY29uY2F0KE9iamVjdC5rZXlzKHRoaXMuJF9fLmFjdGl2ZVBhdGhzLnN0YXRlcy5tb2RpZnkpKTtcbiAgcGF0aHMgPSBwYXRocy5jb25jYXQoT2JqZWN0LmtleXModGhpcy4kX18uYWN0aXZlUGF0aHMuc3RhdGVzLmRlZmF1bHQpKTtcblxuICBpZiAoMCA9PT0gcGF0aHMubGVuZ3RoKSB7XG4gICAgY29tcGxldGUoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHZhciB2YWxpZGF0aW5nID0ge31cbiAgICAsIHRvdGFsID0gMDtcblxuICBwYXRocy5mb3JFYWNoKHZhbGlkYXRlUGF0aCk7XG4gIHJldHVybiB0aGlzO1xuXG4gIGZ1bmN0aW9uIHZhbGlkYXRlUGF0aCAocGF0aCkge1xuICAgIGlmICh2YWxpZGF0aW5nW3BhdGhdKSByZXR1cm47XG5cbiAgICB2YWxpZGF0aW5nW3BhdGhdID0gdHJ1ZTtcbiAgICB0b3RhbCsrO1xuXG4gICAgdXRpbHMuc2V0SW1tZWRpYXRlKGZ1bmN0aW9uKCl7XG4gICAgICB2YXIgcCA9IHNlbGYuc2NoZW1hLnBhdGgocGF0aCk7XG4gICAgICBpZiAoIXApIHJldHVybiAtLXRvdGFsIHx8IGNvbXBsZXRlKCk7XG5cbiAgICAgIHZhciB2YWwgPSBzZWxmLmdldFZhbHVlKHBhdGgpO1xuICAgICAgcC5kb1ZhbGlkYXRlKHZhbCwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgc2VsZi5pbnZhbGlkYXRlKFxuICAgICAgICAgICAgICBwYXRoXG4gICAgICAgICAgICAsIGVyclxuICAgICAgICAgICAgLCB1bmRlZmluZWRcbiAgICAgICAgICAgIC8vLCB0cnVlIC8vIGVtYmVkZGVkIGRvY3NcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgLS10b3RhbCB8fCBjb21wbGV0ZSgpO1xuICAgICAgfSwgc2VsZik7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBjb21wbGV0ZSAoKSB7XG4gICAgdmFyIGVyciA9IHNlbGYuJF9fLnZhbGlkYXRpb25FcnJvcjtcbiAgICBzZWxmLiRfXy52YWxpZGF0aW9uRXJyb3IgPSB1bmRlZmluZWQ7XG4gICAgY2IgJiYgY2IoZXJyKTtcbiAgfVxufTtcblxuLyoqXG4gKiBNYXJrcyBhIHBhdGggYXMgaW52YWxpZCwgY2F1c2luZyB2YWxpZGF0aW9uIHRvIGZhaWwuXG4gKlxuICogVGhlIGBlcnJvck1zZ2AgYXJndW1lbnQgd2lsbCBiZWNvbWUgdGhlIG1lc3NhZ2Ugb2YgdGhlIGBWYWxpZGF0aW9uRXJyb3JgLlxuICpcbiAqIFRoZSBgdmFsdWVgIGFyZ3VtZW50IChpZiBwYXNzZWQpIHdpbGwgYmUgYXZhaWxhYmxlIHRocm91Z2ggdGhlIGBWYWxpZGF0aW9uRXJyb3IudmFsdWVgIHByb3BlcnR5LlxuICpcbiAqICAgICBkb2MuaW52YWxpZGF0ZSgnc2l6ZScsICdtdXN0IGJlIGxlc3MgdGhhbiAyMCcsIDE0KTtcblxuICogICAgIGRvYy52YWxpZGF0ZShmdW5jdGlvbiAoZXJyKSB7XG4gKiAgICAgICBjb25zb2xlLmxvZyhlcnIpXG4gKiAgICAgICAvLyBwcmludHNcbiAqICAgICAgIHsgbWVzc2FnZTogJ1ZhbGlkYXRpb24gZmFpbGVkJyxcbiAqICAgICAgICAgbmFtZTogJ1ZhbGlkYXRpb25FcnJvcicsXG4gKiAgICAgICAgIGVycm9yczpcbiAqICAgICAgICAgIHsgc2l6ZTpcbiAqICAgICAgICAgICAgIHsgbWVzc2FnZTogJ211c3QgYmUgbGVzcyB0aGFuIDIwJyxcbiAqICAgICAgICAgICAgICAgbmFtZTogJ1ZhbGlkYXRvckVycm9yJyxcbiAqICAgICAgICAgICAgICAgcGF0aDogJ3NpemUnLFxuICogICAgICAgICAgICAgICB0eXBlOiAndXNlciBkZWZpbmVkJyxcbiAqICAgICAgICAgICAgICAgdmFsdWU6IDE0IH0gfSB9XG4gKiAgICAgfSlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCB0aGUgZmllbGQgdG8gaW52YWxpZGF0ZVxuICogQHBhcmFtIHtTdHJpbmd8RXJyb3J9IGVycm9yTXNnIHRoZSBlcnJvciB3aGljaCBzdGF0ZXMgdGhlIHJlYXNvbiBgcGF0aGAgd2FzIGludmFsaWRcbiAqIEBwYXJhbSB7T2JqZWN0fFN0cmluZ3xOdW1iZXJ8YW55fSB2YWx1ZSBvcHRpb25hbCBpbnZhbGlkIHZhbHVlXG4gKiBAYXBpIHB1YmxpY1xuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuaW52YWxpZGF0ZSA9IGZ1bmN0aW9uIChwYXRoLCBlcnJvck1zZywgdmFsdWUpIHtcbiAgaWYgKCF0aGlzLiRfXy52YWxpZGF0aW9uRXJyb3IpIHtcbiAgICB0aGlzLiRfXy52YWxpZGF0aW9uRXJyb3IgPSBuZXcgVmFsaWRhdGlvbkVycm9yKHRoaXMpO1xuICB9XG5cbiAgaWYgKCFlcnJvck1zZyB8fCAnc3RyaW5nJyA9PT0gdHlwZW9mIGVycm9yTXNnKSB7XG4gICAgZXJyb3JNc2cgPSBuZXcgVmFsaWRhdG9yRXJyb3IocGF0aCwgZXJyb3JNc2csICd1c2VyIGRlZmluZWQnLCB2YWx1ZSk7XG4gIH1cblxuICBpZiAodGhpcy4kX18udmFsaWRhdGlvbkVycm9yID09IGVycm9yTXNnKSByZXR1cm47XG5cbiAgdGhpcy4kX18udmFsaWRhdGlvbkVycm9yLmVycm9yc1twYXRoXSA9IGVycm9yTXNnO1xufTtcblxuLyoqXG4gKiBSZXNldHMgdGhlIGludGVybmFsIG1vZGlmaWVkIHN0YXRlIG9mIHRoaXMgZG9jdW1lbnQuXG4gKlxuICogQGFwaSBwcml2YXRlXG4gKiBAcmV0dXJuIHtEb2N1bWVudH1cbiAqIEBtZXRob2QgJF9fcmVzZXRcbiAqIEBtZW1iZXJPZiBEb2N1bWVudFxuICovXG5cbkRvY3VtZW50LnByb3RvdHlwZS4kX19yZXNldCA9IGZ1bmN0aW9uIHJlc2V0ICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBEb2N1bWVudEFycmF5IHx8IChEb2N1bWVudEFycmF5ID0gcmVxdWlyZSgnLi90eXBlcy9kb2N1bWVudGFycmF5JykpO1xuXG4gIHRoaXMuJF9fLmFjdGl2ZVBhdGhzXG4gIC5tYXAoJ2luaXQnLCAnbW9kaWZ5JywgZnVuY3Rpb24gKGkpIHtcbiAgICByZXR1cm4gc2VsZi5nZXRWYWx1ZShpKTtcbiAgfSlcbiAgLmZpbHRlcihmdW5jdGlvbiAodmFsKSB7XG4gICAgcmV0dXJuIHZhbCAmJiB2YWwgaW5zdGFuY2VvZiBEb2N1bWVudEFycmF5ICYmIHZhbC5sZW5ndGg7XG4gIH0pXG4gIC5mb3JFYWNoKGZ1bmN0aW9uIChhcnJheSkge1xuICAgIHZhciBpID0gYXJyYXkubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHZhciBkb2MgPSBhcnJheVtpXTtcbiAgICAgIGlmICghZG9jKSBjb250aW51ZTtcbiAgICAgIGRvYy4kX19yZXNldCgpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gQ2xlYXIgJ21vZGlmeScoJ2RpcnR5JykgY2FjaGVcbiAgdGhpcy4kX18uYWN0aXZlUGF0aHMuY2xlYXIoJ21vZGlmeScpO1xuICB0aGlzLiRfXy52YWxpZGF0aW9uRXJyb3IgPSB1bmRlZmluZWQ7XG4gIHRoaXMuZXJyb3JzID0gdW5kZWZpbmVkO1xuICAvL2NvbnNvbGUubG9nKCBzZWxmLiRfXy5hY3RpdmVQYXRocy5zdGF0ZXMucmVxdWlyZSApO1xuICAvL1RPRE86INGC0YPRglxuICB0aGlzLnNjaGVtYS5yZXF1aXJlZFBhdGhzKCkuZm9yRWFjaChmdW5jdGlvbiAocGF0aCkge1xuICAgIHNlbGYuJF9fLmFjdGl2ZVBhdGhzLnJlcXVpcmUocGF0aCk7XG4gIH0pO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuXG4vKipcbiAqIFJldHVybnMgdGhpcyBkb2N1bWVudHMgZGlydHkgcGF0aHMgLyB2YWxzLlxuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICogQG1ldGhvZCAkX19kaXJ0eVxuICogQG1lbWJlck9mIERvY3VtZW50XG4gKi9cblxuRG9jdW1lbnQucHJvdG90eXBlLiRfX2RpcnR5ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgdmFyIGFsbCA9IHRoaXMuJF9fLmFjdGl2ZVBhdGhzLm1hcCgnbW9kaWZ5JywgZnVuY3Rpb24gKHBhdGgpIHtcbiAgICByZXR1cm4geyBwYXRoOiBwYXRoXG4gICAgICAgICAgICwgdmFsdWU6IHNlbGYuZ2V0VmFsdWUoIHBhdGggKVxuICAgICAgICAgICAsIHNjaGVtYTogc2VsZi4kX19wYXRoKCBwYXRoICkgfTtcbiAgfSk7XG5cbiAgLy8gU29ydCBkaXJ0eSBwYXRocyBpbiBhIGZsYXQgaGllcmFyY2h5LlxuICBhbGwuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgIHJldHVybiAoYS5wYXRoIDwgYi5wYXRoID8gLTEgOiAoYS5wYXRoID4gYi5wYXRoID8gMSA6IDApKTtcbiAgfSk7XG5cbiAgLy8gSWdub3JlIFwiZm9vLmFcIiBpZiBcImZvb1wiIGlzIGRpcnR5IGFscmVhZHkuXG4gIHZhciBtaW5pbWFsID0gW11cbiAgICAsIGxhc3RQYXRoXG4gICAgLCB0b3A7XG5cbiAgYWxsLmZvckVhY2goZnVuY3Rpb24oIGl0ZW0gKXtcbiAgICBsYXN0UGF0aCA9IGl0ZW0ucGF0aCArICcuJztcbiAgICBtaW5pbWFsLnB1c2goaXRlbSk7XG4gICAgdG9wID0gaXRlbTtcbiAgfSk7XG5cbiAgdG9wID0gbGFzdFBhdGggPSBudWxsO1xuICByZXR1cm4gbWluaW1hbDtcbn07XG5cbi8qIVxuICogQ29tcGlsZXMgc2NoZW1hcy5cbiAqICjRg9GB0YLQsNC90L7QstC40YLRjCDQs9C10YLRgtC10YDRiy/RgdC10YLRgtC10YDRiyDQvdCwINC/0L7Qu9GPINC00L7QutGD0LzQtdC90YLQsClcbiAqL1xuZnVuY3Rpb24gY29tcGlsZSAoc2VsZiwgdHJlZSwgcHJvdG8sIHByZWZpeCkge1xuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRyZWUpXG4gICAgLCBpID0ga2V5cy5sZW5ndGhcbiAgICAsIGxpbWJcbiAgICAsIGtleTtcblxuICB3aGlsZSAoaS0tKSB7XG4gICAga2V5ID0ga2V5c1tpXTtcbiAgICBsaW1iID0gdHJlZVtrZXldO1xuXG4gICAgZGVmaW5lKHNlbGZcbiAgICAgICAgLCBrZXlcbiAgICAgICAgLCAoKCdPYmplY3QnID09PSBsaW1iLmNvbnN0cnVjdG9yLm5hbWVcbiAgICAgICAgICAgICAgICYmIE9iamVjdC5rZXlzKGxpbWIpLmxlbmd0aClcbiAgICAgICAgICAgICAgICYmICghbGltYi50eXBlIHx8IGxpbWIudHlwZS50eXBlKVxuICAgICAgICAgICAgICAgPyBsaW1iXG4gICAgICAgICAgICAgICA6IG51bGwpXG4gICAgICAgICwgcHJvdG9cbiAgICAgICAgLCBwcmVmaXhcbiAgICAgICAgLCBrZXlzKTtcbiAgfVxufVxuXG4vKiFcbiAqIERlZmluZXMgdGhlIGFjY2Vzc29yIG5hbWVkIHByb3Agb24gdGhlIGluY29taW5nIHByb3RvdHlwZS5cbiAqINGC0LDQvCDQttC1LCDQv9C+0LvRjyDQtNC+0LrRg9C80LXQvdGC0LAg0YHQtNC10LvQsNC10Lwg0L3QsNCx0LvRjtC00LDQtdC80YvQvNC4XG4gKi9cbmZ1bmN0aW9uIGRlZmluZSAoc2VsZiwgcHJvcCwgc3VicHJvcHMsIHByb3RvdHlwZSwgcHJlZml4LCBrZXlzKSB7XG4gIHByZWZpeCA9IHByZWZpeCB8fCAnJztcbiAgdmFyIHBhdGggPSAocHJlZml4ID8gcHJlZml4ICsgJy4nIDogJycpICsgcHJvcDtcblxuICBpZiAoc3VicHJvcHMpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG90eXBlLCBwcm9wLCB7XG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICwgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgaWYgKCF0aGlzLiRfXy5nZXR0ZXJzKVxuICAgICAgICAgICAgdGhpcy4kX18uZ2V0dGVycyA9IHt9O1xuXG4gICAgICAgICAgaWYgKCF0aGlzLiRfXy5nZXR0ZXJzW3BhdGhdKSB7XG4gICAgICAgICAgICB2YXIgbmVzdGVkID0gT2JqZWN0LmNyZWF0ZSh0aGlzKTtcblxuICAgICAgICAgICAgLy8gc2F2ZSBzY29wZSBmb3IgbmVzdGVkIGdldHRlcnMvc2V0dGVyc1xuICAgICAgICAgICAgaWYgKCFwcmVmaXgpIG5lc3RlZC4kX18uc2NvcGUgPSB0aGlzO1xuXG4gICAgICAgICAgICAvLyBzaGFkb3cgaW5oZXJpdGVkIGdldHRlcnMgZnJvbSBzdWItb2JqZWN0cyBzb1xuICAgICAgICAgICAgLy8gdGhpbmcubmVzdGVkLm5lc3RlZC5uZXN0ZWQuLi4gZG9lc24ndCBvY2N1ciAoZ2gtMzY2KVxuICAgICAgICAgICAgdmFyIGkgPSAwXG4gICAgICAgICAgICAgICwgbGVuID0ga2V5cy5sZW5ndGg7XG5cbiAgICAgICAgICAgIGZvciAoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICAgICAgLy8gb3Zlci13cml0ZSB0aGUgcGFyZW50cyBnZXR0ZXIgd2l0aG91dCB0cmlnZ2VyaW5nIGl0XG4gICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuZXN0ZWQsIGtleXNbaV0sIHtcbiAgICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlICAgLy8gSXQgZG9lc24ndCBzaG93IHVwLlxuICAgICAgICAgICAgICAgICwgd3JpdGFibGU6IHRydWUgICAgICAvLyBXZSBjYW4gc2V0IGl0IGxhdGVyLlxuICAgICAgICAgICAgICAgICwgY29uZmlndXJhYmxlOiB0cnVlICAvLyBXZSBjYW4gT2JqZWN0LmRlZmluZVByb3BlcnR5IGFnYWluLlxuICAgICAgICAgICAgICAgICwgdmFsdWU6IHVuZGVmaW5lZCAgICAvLyBJdCBzaGFkb3dzIGl0cyBwYXJlbnQuXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBuZXN0ZWQudG9PYmplY3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmdldChwYXRoKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbXBpbGUoIHNlbGYsIHN1YnByb3BzLCBuZXN0ZWQsIHBhdGggKTtcbiAgICAgICAgICAgIHRoaXMuJF9fLmdldHRlcnNbcGF0aF0gPSBuZXN0ZWQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHRoaXMuJF9fLmdldHRlcnNbcGF0aF07XG4gICAgICAgIH1cbiAgICAgICwgc2V0OiBmdW5jdGlvbiAodikge1xuICAgICAgICAgIGlmICh2IGluc3RhbmNlb2YgRG9jdW1lbnQpIHYgPSB2LnRvT2JqZWN0KCk7XG4gICAgICAgICAgcmV0dXJuICh0aGlzLiRfXy5zY29wZSB8fCB0aGlzKS5zZXQoIHBhdGgsIHYgKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gIH0gZWxzZSB7XG4gICAgU2NoZW1hQXJyYXkgfHwgKFNjaGVtYUFycmF5ID0gcmVxdWlyZSgnLi9zY2hlbWEvYXJyYXknKSk7XG5cbiAgICB2YXIgYWxsT2JzZXJ2YWJsZXNGb3JPYmplY3QgPSBrby5lczUuZ2V0QWxsT2JzZXJ2YWJsZXNGb3JPYmplY3QoIHNlbGYsIHRydWUgKSxcbiAgICAgIHNjaGVtYSA9IHByb3RvdHlwZS5zY2hlbWEgfHwgcHJvdG90eXBlLmNvbnN0cnVjdG9yLnNjaGVtYSxcbiAgICAgIGlzQXJyYXkgPSBzY2hlbWEucGF0aCggcGF0aCApIGluc3RhbmNlb2YgU2NoZW1hQXJyYXksXG4gICAgICBvYnNlcnZhYmxlID0gaXNBcnJheSA/IGtvLm9ic2VydmFibGVBcnJheSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICA6IGtvLm9ic2VydmFibGUoKTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSggcHJvdG90eXBlLCBwcm9wLCB7XG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICwgZ2V0OiBmdW5jdGlvbiAoICkgeyByZXR1cm4gdGhpcy5nZXQuY2FsbCh0aGlzLiRfXy5zY29wZSB8fCB0aGlzLCBwYXRoKTsgfVxuICAgICAgLCBzZXQ6IGZ1bmN0aW9uICh2KSB7IHJldHVybiB0aGlzLnNldC5jYWxsKHRoaXMuJF9fLnNjb3BlIHx8IHRoaXMsIHBhdGgsIHYpOyB9XG4gICAgfSk7XG5cbiAgICAvLyDQn9C+0LTQtNC10YDQttC60LAgS25vY2tvdXQuVmFsaWRhdGlvblxuICAgIHZhciB2YWxpZGF0b3JzID0gc2NoZW1hLnBhdGgocGF0aCkgJiYgc2NoZW1hLnBhdGgocGF0aCkudmFsaWRhdG9ycztcbiAgICBpZih2YWxpZGF0b3JzICYmIHZhbGlkYXRvcnMubGVuZ3RoKXtcbiAgICAgIHZhciBpID0gdmFsaWRhdG9ycy5sZW5ndGg7XG4gICAgICB3aGlsZShpLS0pe1xuICAgICAgICB2YXIgdmFsaWRhdG9yID0gdmFsaWRhdG9yc1tpXVswXVxuICAgICAgICAgICwgbWVzc2FnZSA9IHZhbGlkYXRvcnNbaV1bMV1cbiAgICAgICAgICAsIHR5cGUgPSB2YWxpZGF0b3JzW2ldWzJdO1xuXG4gICAgICAgIC8vaWYoIHR5cGUgPSAncmVxdWlyZWQnIClcbiAgICAgICAgb2JzZXJ2YWJsZS5leHRlbmQoeyAgLy8gY3VzdG9tIHZhbGlkYXRvclxuICAgICAgICAgIHZhbGlkYXRpb246IHtcbiAgICAgICAgICAgIHZhbGlkYXRvcjogdmFsaWRhdG9yLFxuICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhbGxPYnNlcnZhYmxlc0Zvck9iamVjdFsgcGF0aCBdID0gb2JzZXJ2YWJsZTtcblxuICAgIGlmICggaXNBcnJheSApIHtcbiAgICAgIGtvLmVzNS5ub3RpZnlXaGVuUHJlc2VudE9yRnV0dXJlQXJyYXlWYWx1ZXNNdXRhdGUoIGtvLCBvYnNlcnZhYmxlICk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQXNzaWducy9jb21waWxlcyBgc2NoZW1hYCBpbnRvIHRoaXMgZG9jdW1lbnRzIHByb3RvdHlwZS5cbiAqXG4gKiBAcGFyYW0ge1NjaGVtYX0gc2NoZW1hXG4gKiBAYXBpIHByaXZhdGVcbiAqIEBtZXRob2QgJF9fc2V0U2NoZW1hXG4gKiBAbWVtYmVyT2YgRG9jdW1lbnRcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLiRfX3NldFNjaGVtYSA9IGZ1bmN0aW9uICggc2NoZW1hICkge1xuICB0aGlzLnNjaGVtYSA9IHNjaGVtYTtcbiAgY29tcGlsZSggdGhpcywgc2NoZW1hLnRyZWUsIHRoaXMgKTtcbn07XG5cbi8qKlxuICogR2V0IGFsbCBzdWJkb2NzIChieSBiZnMpXG4gKlxuICogQGFwaSBwcml2YXRlXG4gKiBAbWV0aG9kICRfX2dldEFsbFN1YmRvY3NcbiAqIEBtZW1iZXJPZiBEb2N1bWVudFxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuJF9fZ2V0QWxsU3ViZG9jcyA9IGZ1bmN0aW9uICgpIHtcbiAgRG9jdW1lbnRBcnJheSB8fCAoRG9jdW1lbnRBcnJheSA9IHJlcXVpcmUoJy4vdHlwZXMvZG9jdW1lbnRhcnJheScpKTtcbiAgRW1iZWRkZWQgPSBFbWJlZGRlZCB8fCByZXF1aXJlKCcuL3R5cGVzL2VtYmVkZGVkJyk7XG5cbiAgZnVuY3Rpb24gZG9jUmVkdWNlcihzZWVkLCBwYXRoKSB7XG4gICAgdmFyIHZhbCA9IHRoaXNbcGF0aF07XG4gICAgaWYgKHZhbCBpbnN0YW5jZW9mIEVtYmVkZGVkKSBzZWVkLnB1c2godmFsKTtcbiAgICBpZiAodmFsIGluc3RhbmNlb2YgRG9jdW1lbnRBcnJheSlcbiAgICAgIHZhbC5mb3JFYWNoKGZ1bmN0aW9uIF9kb2NSZWR1Y2UoZG9jKSB7XG4gICAgICAgIGlmICghZG9jIHx8ICFkb2MuX2RvYykgcmV0dXJuO1xuICAgICAgICBpZiAoZG9jIGluc3RhbmNlb2YgRW1iZWRkZWQpIHNlZWQucHVzaChkb2MpO1xuICAgICAgICBzZWVkID0gT2JqZWN0LmtleXMoZG9jLl9kb2MpLnJlZHVjZShkb2NSZWR1Y2VyLmJpbmQoZG9jLl9kb2MpLCBzZWVkKTtcbiAgICAgIH0pO1xuICAgIHJldHVybiBzZWVkO1xuICB9XG5cbiAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2RvYykucmVkdWNlKGRvY1JlZHVjZXIuYmluZCh0aGlzKSwgW10pO1xufTtcblxuLyoqXG4gKiBIYW5kbGUgZ2VuZXJpYyBzYXZlIHN0dWZmLlxuICogdG8gc29sdmUgIzE0NDYgdXNlIHVzZSBoaWVyYXJjaHkgaW5zdGVhZCBvZiBob29rc1xuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICogQG1ldGhvZCAkX19wcmVzYXZlVmFsaWRhdGVcbiAqIEBtZW1iZXJPZiBEb2N1bWVudFxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuJF9fcHJlc2F2ZVZhbGlkYXRlID0gZnVuY3Rpb24gJF9fcHJlc2F2ZVZhbGlkYXRlKCkge1xuICAvLyBpZiBhbnkgZG9jLnNldCgpIGNhbGxzIGZhaWxlZFxuXG4gIHZhciBkb2NzID0gdGhpcy4kX19nZXRBcnJheVBhdGhzVG9WYWxpZGF0ZSgpO1xuXG4gIHZhciBlMiA9IGRvY3MubWFwKGZ1bmN0aW9uIChkb2MpIHtcbiAgICByZXR1cm4gZG9jLiRfX3ByZXNhdmVWYWxpZGF0ZSgpO1xuICB9KTtcbiAgdmFyIGUxID0gW3RoaXMuJF9fLnNhdmVFcnJvcl0uY29uY2F0KGUyKTtcbiAgdmFyIGVyciA9IGUxLmZpbHRlcihmdW5jdGlvbiAoeCkge3JldHVybiB4fSlbMF07XG4gIHRoaXMuJF9fLnNhdmVFcnJvciA9IG51bGw7XG5cbiAgcmV0dXJuIGVycjtcbn07XG5cbi8qKlxuICogR2V0IGFjdGl2ZSBwYXRoIHRoYXQgd2VyZSBjaGFuZ2VkIGFuZCBhcmUgYXJyYXlzXG4gKlxuICogQGFwaSBwcml2YXRlXG4gKiBAbWV0aG9kICRfX2dldEFycmF5UGF0aHNUb1ZhbGlkYXRlXG4gKiBAbWVtYmVyT2YgRG9jdW1lbnRcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLiRfX2dldEFycmF5UGF0aHNUb1ZhbGlkYXRlID0gZnVuY3Rpb24gKCkge1xuICBEb2N1bWVudEFycmF5IHx8IChEb2N1bWVudEFycmF5ID0gcmVxdWlyZSgnLi90eXBlcy9kb2N1bWVudGFycmF5JykpO1xuXG4gIC8vIHZhbGlkYXRlIGFsbCBkb2N1bWVudCBhcnJheXMuXG4gIHJldHVybiB0aGlzLiRfXy5hY3RpdmVQYXRoc1xuICAgIC5tYXAoJ2luaXQnLCAnbW9kaWZ5JywgZnVuY3Rpb24gKGkpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldFZhbHVlKGkpO1xuICAgIH0uYmluZCh0aGlzKSlcbiAgICAuZmlsdGVyKGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgIHJldHVybiB2YWwgJiYgdmFsIGluc3RhbmNlb2YgRG9jdW1lbnRBcnJheSAmJiB2YWwubGVuZ3RoO1xuICAgIH0pLnJlZHVjZShmdW5jdGlvbihzZWVkLCBhcnJheSkge1xuICAgICAgcmV0dXJuIHNlZWQuY29uY2F0KGFycmF5KTtcbiAgICB9LCBbXSlcbiAgICAuZmlsdGVyKGZ1bmN0aW9uIChkb2MpIHtyZXR1cm4gZG9jfSk7XG59O1xuXG4vKipcbiAqIFJlZ2lzdGVycyBhbiBlcnJvclxuICpcbiAqIEBwYXJhbSB7RXJyb3J9IGVyclxuICogQGFwaSBwcml2YXRlXG4gKiBAbWV0aG9kICRfX2Vycm9yXG4gKiBAbWVtYmVyT2YgRG9jdW1lbnRcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLiRfX2Vycm9yID0gZnVuY3Rpb24gKGVycikge1xuICB0aGlzLiRfXy5zYXZlRXJyb3IgPSBlcnI7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBQcm9kdWNlcyBhIHNwZWNpYWwgcXVlcnkgZG9jdW1lbnQgb2YgdGhlIG1vZGlmaWVkIHByb3BlcnRpZXMgdXNlZCBpbiB1cGRhdGVzLlxuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICogQG1ldGhvZCAkX19kZWx0YVxuICogQG1lbWJlck9mIERvY3VtZW50XG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS4kX19kZWx0YSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGRpcnR5ID0gdGhpcy4kX19kaXJ0eSgpO1xuXG4gIHZhciBkZWx0YSA9IHt9XG4gICAgLCBsZW4gPSBkaXJ0eS5sZW5ndGhcbiAgICAsIGQgPSAwO1xuXG4gIGZvciAoOyBkIDwgbGVuOyArK2QpIHtcbiAgICB2YXIgZGF0YSA9IGRpcnR5WyBkIF07XG4gICAgdmFyIHZhbHVlID0gZGF0YS52YWx1ZTtcblxuICAgIHZhbHVlID0gdXRpbHMuY2xvbmUodmFsdWUsIHsgZGVwb3B1bGF0ZTogMSB9KTtcbiAgICBkZWx0YVsgZGF0YS5wYXRoIF0gPSB2YWx1ZTtcbiAgfVxuXG4gIHJldHVybiBkZWx0YTtcbn07XG5cbkRvY3VtZW50LnByb3RvdHlwZS4kX19oYW5kbGVTYXZlID0gZnVuY3Rpb24oKXtcbiAgLy8g0J/QvtC70YPRh9Cw0LXQvCDRgNC10YHRg9GA0YEg0LrQvtC70LvQtdC60YbQuNC4LCDQutGD0LTQsCDQsdGD0LTQtdC8INGB0L7RhdGA0LDQvdGP0YLRjCDQtNCw0L3QvdGL0LVcbiAgdmFyIHJlc291cmNlO1xuICBpZiAoIHRoaXMuY29sbGVjdGlvbiApe1xuICAgIHJlc291cmNlID0gdGhpcy5jb2xsZWN0aW9uLmFwaTtcbiAgfVxuXG4gIHZhciBpbm5lclByb21pc2UgPSBuZXcgJC5EZWZlcnJlZCgpO1xuXG4gIGlmICggdGhpcy5pc05ldyApIHtcbiAgICAvLyBzZW5kIGVudGlyZSBkb2NcbiAgICB2YXIgb2JqID0gdGhpcy50b09iamVjdCh7IGRlcG9wdWxhdGU6IDEgfSk7XG5cbiAgICBpZiAoICggb2JqIHx8IHt9ICkuaGFzT3duUHJvcGVydHkoJ19pZCcpID09PSBmYWxzZSApIHtcbiAgICAgIC8vIGRvY3VtZW50cyBtdXN0IGhhdmUgYW4gX2lkIGVsc2UgbW9uZ29vc2Ugd29uJ3Qga25vd1xuICAgICAgLy8gd2hhdCB0byB1cGRhdGUgbGF0ZXIgaWYgbW9yZSBjaGFuZ2VzIGFyZSBtYWRlLiB0aGUgdXNlclxuICAgICAgLy8gd291bGRuJ3Qga25vdyB3aGF0IF9pZCB3YXMgZ2VuZXJhdGVkIGJ5IG1vbmdvZGIgZWl0aGVyXG4gICAgICAvLyBub3Igd291bGQgdGhlIE9iamVjdElkIGdlbmVyYXRlZCBteSBtb25nb2RiIG5lY2Vzc2FyaWx5XG4gICAgICAvLyBtYXRjaCB0aGUgc2NoZW1hIGRlZmluaXRpb24uXG4gICAgICBpbm5lclByb21pc2UucmVqZWN0KG5ldyBFcnJvcignZG9jdW1lbnQgbXVzdCBoYXZlIGFuIF9pZCBiZWZvcmUgc2F2aW5nJykpO1xuICAgICAgcmV0dXJuIGlubmVyUHJvbWlzZTtcbiAgICB9XG5cbiAgICAvLyDQn9GA0L7QstC10YDQutCwINC90LAg0L7QutGA0YPQttC10L3QuNC1INGC0LXRgdGC0L7QslxuICAgIC8vINCl0L7RgtGPINC80L7QttC90L4g0YLQsNC60LjQvCDQvtCx0YDQsNC30L7QvCDQv9GA0L7RgdGC0L4g0LTQtdC70LDRgtGMINCy0LDQu9C40LTQsNGG0LjRjiwg0LTQsNC20LUg0LXRgdC70Lgg0L3QtdGCINC60L7Qu9C70LXQutGG0LjQuCDQuNC70LggYXBpXG4gICAgaWYgKCAhcmVzb3VyY2UgKXtcbiAgICAgIGlubmVyUHJvbWlzZS5yZXNvbHZlKCB0aGlzICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc291cmNlLmNyZWF0ZSggb2JqICkuYWx3YXlzKCBpbm5lclByb21pc2UucmVzb2x2ZSApO1xuICAgIH1cblxuICAgIHRoaXMuJF9fcmVzZXQoKTtcbiAgICB0aGlzLmlzTmV3ID0gZmFsc2U7XG4gICAgdGhpcy50cmlnZ2VyKCdpc05ldycsIGZhbHNlKTtcbiAgICAvLyBNYWtlIGl0IHBvc3NpYmxlIHRvIHJldHJ5IHRoZSBpbnNlcnRcbiAgICB0aGlzLiRfXy5pbnNlcnRpbmcgPSB0cnVlO1xuXG4gIH0gZWxzZSB7XG4gICAgLy8gTWFrZSBzdXJlIHdlIGRvbid0IHRyZWF0IGl0IGFzIGEgbmV3IG9iamVjdCBvbiBlcnJvcixcbiAgICAvLyBzaW5jZSBpdCBhbHJlYWR5IGV4aXN0c1xuICAgIHRoaXMuJF9fLmluc2VydGluZyA9IGZhbHNlO1xuXG4gICAgdmFyIGRlbHRhID0gdGhpcy4kX19kZWx0YSgpO1xuXG4gICAgaWYgKCAhXy5pc0VtcHR5KCBkZWx0YSApICkge1xuICAgICAgdGhpcy4kX19yZXNldCgpO1xuICAgICAgLy8g0J/RgNC+0LLQtdGA0LrQsCDQvdCwINC+0LrRgNGD0LbQtdC90LjQtSDRgtC10YHRgtC+0LJcbiAgICAgIC8vINCl0L7RgtGPINC80L7QttC90L4g0YLQsNC60LjQvCDQvtCx0YDQsNC30L7QvCDQv9GA0L7RgdGC0L4g0LTQtdC70LDRgtGMINCy0LDQu9C40LTQsNGG0LjRjiwg0LTQsNC20LUg0LXRgdC70Lgg0L3QtdGCINC60L7Qu9C70LXQutGG0LjQuCDQuNC70LggYXBpXG4gICAgICBpZiAoICFyZXNvdXJjZSApe1xuICAgICAgICBpbm5lclByb21pc2UucmVzb2x2ZSggdGhpcyApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzb3VyY2UoIHRoaXMuaWQgKS51cGRhdGUoIGRlbHRhICkuYWx3YXlzKCBpbm5lclByb21pc2UucmVzb2x2ZSApO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLiRfX3Jlc2V0KCk7XG4gICAgICBpbm5lclByb21pc2UucmVzb2x2ZSggdGhpcyApO1xuICAgIH1cblxuICAgIHRoaXMudHJpZ2dlcignaXNOZXcnLCBmYWxzZSk7XG4gIH1cblxuICByZXR1cm4gaW5uZXJQcm9taXNlO1xufTtcblxuLyoqXG4gKiBAZGVzY3JpcHRpb24gU2F2ZXMgdGhpcyBkb2N1bWVudC5cbiAqXG4gKiBAZXhhbXBsZTpcbiAqXG4gKiAgICAgcHJvZHVjdC5zb2xkID0gRGF0ZS5ub3coKTtcbiAqICAgICBwcm9kdWN0LnNhdmUoZnVuY3Rpb24gKGVyciwgcHJvZHVjdCwgbnVtYmVyQWZmZWN0ZWQpIHtcbiAqICAgICAgIGlmIChlcnIpIC4uXG4gKiAgICAgfSlcbiAqXG4gKiBAZGVzY3JpcHRpb24gVGhlIGNhbGxiYWNrIHdpbGwgcmVjZWl2ZSB0aHJlZSBwYXJhbWV0ZXJzLCBgZXJyYCBpZiBhbiBlcnJvciBvY2N1cnJlZCwgYHByb2R1Y3RgIHdoaWNoIGlzIHRoZSBzYXZlZCBgcHJvZHVjdGAsIGFuZCBgbnVtYmVyQWZmZWN0ZWRgIHdoaWNoIHdpbGwgYmUgMSB3aGVuIHRoZSBkb2N1bWVudCB3YXMgZm91bmQgYW5kIHVwZGF0ZWQgaW4gdGhlIGRhdGFiYXNlLCBvdGhlcndpc2UgMC5cbiAqXG4gKiBUaGUgYGZuYCBjYWxsYmFjayBpcyBvcHRpb25hbC4gSWYgbm8gYGZuYCBpcyBwYXNzZWQgYW5kIHZhbGlkYXRpb24gZmFpbHMsIHRoZSB2YWxpZGF0aW9uIGVycm9yIHdpbGwgYmUgZW1pdHRlZCBvbiB0aGUgY29ubmVjdGlvbiB1c2VkIHRvIGNyZWF0ZSB0aGlzIG1vZGVsLlxuICogQGV4YW1wbGU6XG4gKiAgICAgdmFyIGRiID0gbW9uZ29vc2UuY3JlYXRlQ29ubmVjdGlvbiguLik7XG4gKiAgICAgdmFyIHNjaGVtYSA9IG5ldyBTY2hlbWEoLi4pO1xuICogICAgIHZhciBQcm9kdWN0ID0gZGIubW9kZWwoJ1Byb2R1Y3QnLCBzY2hlbWEpO1xuICpcbiAqICAgICBkYi5vbignZXJyb3InLCBoYW5kbGVFcnJvcik7XG4gKlxuICogQGRlc2NyaXB0aW9uIEhvd2V2ZXIsIGlmIHlvdSBkZXNpcmUgbW9yZSBsb2NhbCBlcnJvciBoYW5kbGluZyB5b3UgY2FuIGFkZCBhbiBgZXJyb3JgIGxpc3RlbmVyIHRvIHRoZSBtb2RlbCBhbmQgaGFuZGxlIGVycm9ycyB0aGVyZSBpbnN0ZWFkLlxuICogQGV4YW1wbGU6XG4gKiAgICAgUHJvZHVjdC5vbignZXJyb3InLCBoYW5kbGVFcnJvcik7XG4gKlxuICogQGRlc2NyaXB0aW9uIEFzIGFuIGV4dHJhIG1lYXN1cmUgb2YgZmxvdyBjb250cm9sLCBzYXZlIHdpbGwgcmV0dXJuIGEgUHJvbWlzZSAoYm91bmQgdG8gYGZuYCBpZiBwYXNzZWQpIHNvIGl0IGNvdWxkIGJlIGNoYWluZWQsIG9yIGhvb2sgdG8gcmVjaXZlIGVycm9yc1xuICogQGV4YW1wbGU6XG4gKiAgICAgcHJvZHVjdC5zYXZlKCkudGhlbihmdW5jdGlvbiAocHJvZHVjdCwgbnVtYmVyQWZmZWN0ZWQpIHtcbiAqICAgICAgICAuLi5cbiAqICAgICB9KS5vblJlamVjdGVkKGZ1bmN0aW9uIChlcnIpIHtcbiAqICAgICAgICBhc3NlcnQub2soZXJyKVxuICogICAgIH0pXG4gKlxuICogQHBhcmFtIHtmdW5jdGlvbihlcnIsIHByb2R1Y3QsIE51bWJlcil9IFtkb25lXSBvcHRpb25hbCBjYWxsYmFja1xuICogQHJldHVybiB7UHJvbWlzZX0gUHJvbWlzZVxuICogQGFwaSBwdWJsaWNcbiAqIEBzZWUgbWlkZGxld2FyZSBodHRwOi8vbW9uZ29vc2Vqcy5jb20vZG9jcy9taWRkbGV3YXJlLmh0bWxcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiAoIGRvbmUgKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGZpbmFsUHJvbWlzZSA9IG5ldyAkLkRlZmVycmVkKCkuZG9uZSggZG9uZSApO1xuXG4gIC8vINCh0L7RhdGA0LDQvdGP0YLRjCDQtNC+0LrRg9C80LXQvdGCINC80L7QttC90L4g0YLQvtC70YzQutC+INC10YHQu9C4INC+0L0g0L3QsNGF0L7QtNC40YLRgdGPINCyINC60L7Qu9C70LXQutGG0LjQuFxuICBpZiAoICF0aGlzLmNvbGxlY3Rpb24gKXtcbiAgICBmaW5hbFByb21pc2UucmVqZWN0KCBhcmd1bWVudHMgKTtcbiAgICBjb25zb2xlLmVycm9yKCdEb2N1bWVudC5zYXZlIGFwaSBoYW5kbGUgaXMgbm90IGltcGxlbWVudGVkLicpO1xuICAgIHJldHVybiBmaW5hbFByb21pc2U7XG4gIH1cblxuICAvLyBDaGVjayBmb3IgcHJlU2F2ZSBlcnJvcnMgKNGC0L7Rh9C+INC30L3QsNGOLCDRh9GC0L4g0L7QvdCwINC/0YDQvtCy0LXRgNGP0LXRgiDQvtGI0LjQsdC60Lgg0LIg0LzQsNGB0YHQuNCy0LDRhSAoQ2FzdEVycm9yKSlcbiAgdmFyIHByZVNhdmVFcnIgPSBzZWxmLiRfX3ByZXNhdmVWYWxpZGF0ZSgpO1xuICBpZiAoIHByZVNhdmVFcnIgKSB7XG4gICAgZmluYWxQcm9taXNlLnJlamVjdCggcHJlU2F2ZUVyciApO1xuICAgIHJldHVybiBmaW5hbFByb21pc2U7XG4gIH1cblxuICAvLyBWYWxpZGF0ZVxuICB2YXIgcDAgPSBuZXcgJC5EZWZlcnJlZCgpO1xuICBzZWxmLnZhbGlkYXRlKGZ1bmN0aW9uKCBlcnIgKXtcbiAgICBpZiAoIGVyciApe1xuICAgICAgcDAucmVqZWN0KCBlcnIgKTtcbiAgICAgIGZpbmFsUHJvbWlzZS5yZWplY3QoIGVyciApO1xuICAgIH0gZWxzZSB7XG4gICAgICBwMC5yZXNvbHZlKCk7XG4gICAgfVxuICB9KTtcblxuICAvLyDQodC90LDRh9Cw0LvQsCDQvdCw0LTQviDRgdC+0YXRgNCw0L3QuNGC0Ywg0LLRgdC1INC/0L7QtNC00L7QutGD0LzQtdC90YLRiyDQuCDRgdC00LXQu9Cw0YLRjCByZXNvbHZlISEhXG4gIC8vIENhbGwgc2F2ZSBob29rcyBvbiBzdWJkb2NzXG4gIHZhciBzdWJEb2NzID0gc2VsZi4kX19nZXRBbGxTdWJkb2NzKCk7XG4gIHZhciB3aGVuQ29uZCA9IHN1YkRvY3MubWFwKGZ1bmN0aW9uIChkKSB7cmV0dXJuIGQuc2F2ZSgpO30pO1xuICB3aGVuQ29uZC5wdXNoKCBwMCApO1xuXG4gIC8vINCi0LDQuiDQvNGLINC/0LXRgNC10LTQsNGR0Lwg0LzQsNGB0YHQuNCyIHByb21pc2Ug0YPRgdC70L7QstC40LlcbiAgdmFyIHAxID0gJC53aGVuLmFwcGx5KCAkLCB3aGVuQ29uZCApO1xuXG4gIC8vIEhhbmRsZSBzYXZlIGFuZCByZXN1bHRzXG4gIHAxXG4gICAgLnRoZW4oIHRoaXMuJF9faGFuZGxlU2F2ZS5iaW5kKCB0aGlzICkgKVxuICAgIC50aGVuKGZ1bmN0aW9uKCl7XG4gICAgICByZXR1cm4gZmluYWxQcm9taXNlLnJlc29sdmUoIHNlbGYgKTtcbiAgICB9LCBmdW5jdGlvbiAoIGVyciApIHtcbiAgICAgIC8vIElmIHRoZSBpbml0aWFsIGluc2VydCBmYWlscyBwcm92aWRlIGEgc2Vjb25kIGNoYW5jZS5cbiAgICAgIC8vIChJZiB3ZSBkaWQgdGhpcyBhbGwgdGhlIHRpbWUgd2Ugd291bGQgYnJlYWsgdXBkYXRlcylcbiAgICAgIGlmIChzZWxmLiRfXy5pbnNlcnRpbmcpIHtcbiAgICAgICAgc2VsZi5pc05ldyA9IHRydWU7XG4gICAgICAgIHNlbGYuZW1pdCgnaXNOZXcnLCB0cnVlKTtcbiAgICAgIH1cbiAgICAgIGZpbmFsUHJvbWlzZS5yZWplY3QoIGVyciApO1xuICAgIH0pO1xuXG4gIHJldHVybiBmaW5hbFByb21pc2U7XG59O1xuXG4vKmZ1bmN0aW9uIGFsbCAocHJvbWlzZU9mQXJyKSB7XG4gIHZhciBwUmV0ID0gbmV3IFByb21pc2U7XG4gIHRoaXMudGhlbihwcm9taXNlT2ZBcnIpLnRoZW4oXG4gICAgZnVuY3Rpb24gKHByb21pc2VBcnIpIHtcbiAgICAgIHZhciBjb3VudCA9IDA7XG4gICAgICB2YXIgcmV0ID0gW107XG4gICAgICB2YXIgZXJyU2VudGluZWw7XG4gICAgICBpZiAoIXByb21pc2VBcnIubGVuZ3RoKSBwUmV0LnJlc29sdmUoKTtcbiAgICAgIHByb21pc2VBcnIuZm9yRWFjaChmdW5jdGlvbiAocHJvbWlzZSwgaW5kZXgpIHtcbiAgICAgICAgaWYgKGVyclNlbnRpbmVsKSByZXR1cm47XG4gICAgICAgIGNvdW50Kys7XG4gICAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgICBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgICAgICBpZiAoZXJyU2VudGluZWwpIHJldHVybjtcbiAgICAgICAgICAgIHJldFtpbmRleF0gPSB2YWw7XG4gICAgICAgICAgICAtLWNvdW50O1xuICAgICAgICAgICAgaWYgKGNvdW50ID09IDApIHBSZXQuZnVsZmlsbChyZXQpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgaWYgKGVyclNlbnRpbmVsKSByZXR1cm47XG4gICAgICAgICAgICBlcnJTZW50aW5lbCA9IGVycjtcbiAgICAgICAgICAgIHBSZXQucmVqZWN0KGVycik7XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gcFJldDtcbiAgICB9XG4gICAgLCBwUmV0LnJlamVjdC5iaW5kKHBSZXQpXG4gICk7XG4gIHJldHVybiBwUmV0O1xufSovXG5cblxuLyoqXG4gKiBDb252ZXJ0cyB0aGlzIGRvY3VtZW50IGludG8gYSBwbGFpbiBqYXZhc2NyaXB0IG9iamVjdCwgcmVhZHkgZm9yIHN0b3JhZ2UgaW4gTW9uZ29EQi5cbiAqXG4gKiBCdWZmZXJzIGFyZSBjb252ZXJ0ZWQgdG8gaW5zdGFuY2VzIG9mIFttb25nb2RiLkJpbmFyeV0oaHR0cDovL21vbmdvZGIuZ2l0aHViLmNvbS9ub2RlLW1vbmdvZGItbmF0aXZlL2FwaS1ic29uLWdlbmVyYXRlZC9iaW5hcnkuaHRtbCkgZm9yIHByb3BlciBzdG9yYWdlLlxuICpcbiAqICMjIyNPcHRpb25zOlxuICpcbiAqIC0gYGdldHRlcnNgIGFwcGx5IGFsbCBnZXR0ZXJzIChwYXRoIGFuZCB2aXJ0dWFsIGdldHRlcnMpXG4gKiAtIGB2aXJ0dWFsc2AgYXBwbHkgdmlydHVhbCBnZXR0ZXJzIChjYW4gb3ZlcnJpZGUgYGdldHRlcnNgIG9wdGlvbilcbiAqIC0gYG1pbmltaXplYCByZW1vdmUgZW1wdHkgb2JqZWN0cyAoZGVmYXVsdHMgdG8gdHJ1ZSlcbiAqIC0gYHRyYW5zZm9ybWAgYSB0cmFuc2Zvcm0gZnVuY3Rpb24gdG8gYXBwbHkgdG8gdGhlIHJlc3VsdGluZyBkb2N1bWVudCBiZWZvcmUgcmV0dXJuaW5nXG4gKlxuICogIyMjI0dldHRlcnMvVmlydHVhbHNcbiAqXG4gKiBFeGFtcGxlIG9mIG9ubHkgYXBwbHlpbmcgcGF0aCBnZXR0ZXJzXG4gKlxuICogICAgIGRvYy50b09iamVjdCh7IGdldHRlcnM6IHRydWUsIHZpcnR1YWxzOiBmYWxzZSB9KVxuICpcbiAqIEV4YW1wbGUgb2Ygb25seSBhcHBseWluZyB2aXJ0dWFsIGdldHRlcnNcbiAqXG4gKiAgICAgZG9jLnRvT2JqZWN0KHsgdmlydHVhbHM6IHRydWUgfSlcbiAqXG4gKiBFeGFtcGxlIG9mIGFwcGx5aW5nIGJvdGggcGF0aCBhbmQgdmlydHVhbCBnZXR0ZXJzXG4gKlxuICogICAgIGRvYy50b09iamVjdCh7IGdldHRlcnM6IHRydWUgfSlcbiAqXG4gKiBUbyBhcHBseSB0aGVzZSBvcHRpb25zIHRvIGV2ZXJ5IGRvY3VtZW50IG9mIHlvdXIgc2NoZW1hIGJ5IGRlZmF1bHQsIHNldCB5b3VyIFtzY2hlbWFzXSgjc2NoZW1hX1NjaGVtYSkgYHRvT2JqZWN0YCBvcHRpb24gdG8gdGhlIHNhbWUgYXJndW1lbnQuXG4gKlxuICogICAgIHNjaGVtYS5zZXQoJ3RvT2JqZWN0JywgeyB2aXJ0dWFsczogdHJ1ZSB9KVxuICpcbiAqICMjIyNUcmFuc2Zvcm1cbiAqXG4gKiBXZSBtYXkgbmVlZCB0byBwZXJmb3JtIGEgdHJhbnNmb3JtYXRpb24gb2YgdGhlIHJlc3VsdGluZyBvYmplY3QgYmFzZWQgb24gc29tZSBjcml0ZXJpYSwgc2F5IHRvIHJlbW92ZSBzb21lIHNlbnNpdGl2ZSBpbmZvcm1hdGlvbiBvciByZXR1cm4gYSBjdXN0b20gb2JqZWN0LiBJbiB0aGlzIGNhc2Ugd2Ugc2V0IHRoZSBvcHRpb25hbCBgdHJhbnNmb3JtYCBmdW5jdGlvbi5cbiAqXG4gKiBUcmFuc2Zvcm0gZnVuY3Rpb25zIHJlY2VpdmUgdGhyZWUgYXJndW1lbnRzXG4gKlxuICogICAgIGZ1bmN0aW9uIChkb2MsIHJldCwgb3B0aW9ucykge31cbiAqXG4gKiAtIGBkb2NgIFRoZSBtb25nb29zZSBkb2N1bWVudCB3aGljaCBpcyBiZWluZyBjb252ZXJ0ZWRcbiAqIC0gYHJldGAgVGhlIHBsYWluIG9iamVjdCByZXByZXNlbnRhdGlvbiB3aGljaCBoYXMgYmVlbiBjb252ZXJ0ZWRcbiAqIC0gYG9wdGlvbnNgIFRoZSBvcHRpb25zIGluIHVzZSAoZWl0aGVyIHNjaGVtYSBvcHRpb25zIG9yIHRoZSBvcHRpb25zIHBhc3NlZCBpbmxpbmUpXG4gKlxuICogIyMjI0V4YW1wbGVcbiAqXG4gKiAgICAgLy8gc3BlY2lmeSB0aGUgdHJhbnNmb3JtIHNjaGVtYSBvcHRpb25cbiAqICAgICBpZiAoIXNjaGVtYS5vcHRpb25zLnRvT2JqZWN0KSBzY2hlbWEub3B0aW9ucy50b09iamVjdCA9IHt9O1xuICogICAgIHNjaGVtYS5vcHRpb25zLnRvT2JqZWN0LnRyYW5zZm9ybSA9IGZ1bmN0aW9uIChkb2MsIHJldCwgb3B0aW9ucykge1xuICogICAgICAgLy8gcmVtb3ZlIHRoZSBfaWQgb2YgZXZlcnkgZG9jdW1lbnQgYmVmb3JlIHJldHVybmluZyB0aGUgcmVzdWx0XG4gKiAgICAgICBkZWxldGUgcmV0Ll9pZDtcbiAqICAgICB9XG4gKlxuICogICAgIC8vIHdpdGhvdXQgdGhlIHRyYW5zZm9ybWF0aW9uIGluIHRoZSBzY2hlbWFcbiAqICAgICBkb2MudG9PYmplY3QoKTsgLy8geyBfaWQ6ICdhbklkJywgbmFtZTogJ1dyZWNrLWl0IFJhbHBoJyB9XG4gKlxuICogICAgIC8vIHdpdGggdGhlIHRyYW5zZm9ybWF0aW9uXG4gKiAgICAgZG9jLnRvT2JqZWN0KCk7IC8vIHsgbmFtZTogJ1dyZWNrLWl0IFJhbHBoJyB9XG4gKlxuICogV2l0aCB0cmFuc2Zvcm1hdGlvbnMgd2UgY2FuIGRvIGEgbG90IG1vcmUgdGhhbiByZW1vdmUgcHJvcGVydGllcy4gV2UgY2FuIGV2ZW4gcmV0dXJuIGNvbXBsZXRlbHkgbmV3IGN1c3RvbWl6ZWQgb2JqZWN0czpcbiAqXG4gKiAgICAgaWYgKCFzY2hlbWEub3B0aW9ucy50b09iamVjdCkgc2NoZW1hLm9wdGlvbnMudG9PYmplY3QgPSB7fTtcbiAqICAgICBzY2hlbWEub3B0aW9ucy50b09iamVjdC50cmFuc2Zvcm0gPSBmdW5jdGlvbiAoZG9jLCByZXQsIG9wdGlvbnMpIHtcbiAqICAgICAgIHJldHVybiB7IG1vdmllOiByZXQubmFtZSB9XG4gKiAgICAgfVxuICpcbiAqICAgICAvLyB3aXRob3V0IHRoZSB0cmFuc2Zvcm1hdGlvbiBpbiB0aGUgc2NoZW1hXG4gKiAgICAgZG9jLnRvT2JqZWN0KCk7IC8vIHsgX2lkOiAnYW5JZCcsIG5hbWU6ICdXcmVjay1pdCBSYWxwaCcgfVxuICpcbiAqICAgICAvLyB3aXRoIHRoZSB0cmFuc2Zvcm1hdGlvblxuICogICAgIGRvYy50b09iamVjdCgpOyAvLyB7IG1vdmllOiAnV3JlY2staXQgUmFscGgnIH1cbiAqXG4gKiBfTm90ZTogaWYgYSB0cmFuc2Zvcm0gZnVuY3Rpb24gcmV0dXJucyBgdW5kZWZpbmVkYCwgdGhlIHJldHVybiB2YWx1ZSB3aWxsIGJlIGlnbm9yZWQuX1xuICpcbiAqIFRyYW5zZm9ybWF0aW9ucyBtYXkgYWxzbyBiZSBhcHBsaWVkIGlubGluZSwgb3ZlcnJpZGRpbmcgYW55IHRyYW5zZm9ybSBzZXQgaW4gdGhlIG9wdGlvbnM6XG4gKlxuICogICAgIGZ1bmN0aW9uIHhmb3JtIChkb2MsIHJldCwgb3B0aW9ucykge1xuICogICAgICAgcmV0dXJuIHsgaW5saW5lOiByZXQubmFtZSwgY3VzdG9tOiB0cnVlIH1cbiAqICAgICB9XG4gKlxuICogICAgIC8vIHBhc3MgdGhlIHRyYW5zZm9ybSBhcyBhbiBpbmxpbmUgb3B0aW9uXG4gKiAgICAgZG9jLnRvT2JqZWN0KHsgdHJhbnNmb3JtOiB4Zm9ybSB9KTsgLy8geyBpbmxpbmU6ICdXcmVjay1pdCBSYWxwaCcsIGN1c3RvbTogdHJ1ZSB9XG4gKlxuICogX05vdGU6IGlmIHlvdSBjYWxsIGB0b09iamVjdGAgYW5kIHBhc3MgYW55IG9wdGlvbnMsIHRoZSB0cmFuc2Zvcm0gZGVjbGFyZWQgaW4geW91ciBzY2hlbWEgb3B0aW9ucyB3aWxsIF9fbm90X18gYmUgYXBwbGllZC4gVG8gZm9yY2UgaXRzIGFwcGxpY2F0aW9uIHBhc3MgYHRyYW5zZm9ybTogdHJ1ZWBfXG4gKlxuICogICAgIGlmICghc2NoZW1hLm9wdGlvbnMudG9PYmplY3QpIHNjaGVtYS5vcHRpb25zLnRvT2JqZWN0ID0ge307XG4gKiAgICAgc2NoZW1hLm9wdGlvbnMudG9PYmplY3QuaGlkZSA9ICdfaWQnO1xuICogICAgIHNjaGVtYS5vcHRpb25zLnRvT2JqZWN0LnRyYW5zZm9ybSA9IGZ1bmN0aW9uIChkb2MsIHJldCwgb3B0aW9ucykge1xuICogICAgICAgaWYgKG9wdGlvbnMuaGlkZSkge1xuICogICAgICAgICBvcHRpb25zLmhpZGUuc3BsaXQoJyAnKS5mb3JFYWNoKGZ1bmN0aW9uIChwcm9wKSB7XG4gKiAgICAgICAgICAgZGVsZXRlIHJldFtwcm9wXTtcbiAqICAgICAgICAgfSk7XG4gKiAgICAgICB9XG4gKiAgICAgfVxuICpcbiAqICAgICB2YXIgZG9jID0gbmV3IERvYyh7IF9pZDogJ2FuSWQnLCBzZWNyZXQ6IDQ3LCBuYW1lOiAnV3JlY2staXQgUmFscGgnIH0pO1xuICogICAgIGRvYy50b09iamVjdCgpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB7IHNlY3JldDogNDcsIG5hbWU6ICdXcmVjay1pdCBSYWxwaCcgfVxuICogICAgIGRvYy50b09iamVjdCh7IGhpZGU6ICdzZWNyZXQgX2lkJyB9KTsgICAgICAgICAgICAgICAgICAvLyB7IF9pZDogJ2FuSWQnLCBzZWNyZXQ6IDQ3LCBuYW1lOiAnV3JlY2staXQgUmFscGgnIH1cbiAqICAgICBkb2MudG9PYmplY3QoeyBoaWRlOiAnc2VjcmV0IF9pZCcsIHRyYW5zZm9ybTogdHJ1ZSB9KTsgLy8geyBuYW1lOiAnV3JlY2staXQgUmFscGgnIH1cbiAqXG4gKiBUcmFuc2Zvcm1zIGFyZSBhcHBsaWVkIHRvIHRoZSBkb2N1bWVudCBfYW5kIGVhY2ggb2YgaXRzIHN1Yi1kb2N1bWVudHNfLiBUbyBkZXRlcm1pbmUgd2hldGhlciBvciBub3QgeW91IGFyZSBjdXJyZW50bHkgb3BlcmF0aW5nIG9uIGEgc3ViLWRvY3VtZW50IHlvdSBtaWdodCB1c2UgdGhlIGZvbGxvd2luZyBndWFyZDpcbiAqXG4gKiAgICAgaWYgKCdmdW5jdGlvbicgPT0gdHlwZW9mIGRvYy5vd25lckRvY3VtZW50KSB7XG4gKiAgICAgICAvLyB3b3JraW5nIHdpdGggYSBzdWIgZG9jXG4gKiAgICAgfVxuICpcbiAqIFRyYW5zZm9ybXMsIGxpa2UgYWxsIG9mIHRoZXNlIG9wdGlvbnMsIGFyZSBhbHNvIGF2YWlsYWJsZSBmb3IgYHRvSlNPTmAuXG4gKlxuICogU2VlIFtzY2hlbWEgb3B0aW9uc10oL2RvY3MvZ3VpZGUuaHRtbCN0b09iamVjdCkgZm9yIHNvbWUgbW9yZSBkZXRhaWxzLlxuICpcbiAqIF9EdXJpbmcgc2F2ZSwgbm8gY3VzdG9tIG9wdGlvbnMgYXJlIGFwcGxpZWQgdG8gdGhlIGRvY3VtZW50IGJlZm9yZSBiZWluZyBzZW50IHRvIHRoZSBkYXRhYmFzZS5fXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHJldHVybiB7T2JqZWN0fSBqcyBvYmplY3RcbiAqIEBzZWUgbW9uZ29kYi5CaW5hcnkgaHR0cDovL21vbmdvZGIuZ2l0aHViLmNvbS9ub2RlLW1vbmdvZGItbmF0aXZlL2FwaS1ic29uLWdlbmVyYXRlZC9iaW5hcnkuaHRtbFxuICogQGFwaSBwdWJsaWNcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLnRvT2JqZWN0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5kZXBvcHVsYXRlICYmIHRoaXMuJF9fLndhc1BvcHVsYXRlZCkge1xuICAgIC8vIHBvcHVsYXRlZCBwYXRocyB0aGF0IHdlIHNldCB0byBhIGRvY3VtZW50XG4gICAgcmV0dXJuIHV0aWxzLmNsb25lKHRoaXMuX2lkLCBvcHRpb25zKTtcbiAgfVxuXG4gIC8vIFdoZW4gaW50ZXJuYWxseSBzYXZpbmcgdGhpcyBkb2N1bWVudCB3ZSBhbHdheXMgcGFzcyBvcHRpb25zLFxuICAvLyBieXBhc3NpbmcgdGhlIGN1c3RvbSBzY2hlbWEgb3B0aW9ucy5cbiAgdmFyIG9wdGlvbnNQYXJhbWV0ZXIgPSBvcHRpb25zO1xuICBpZiAoIShvcHRpb25zICYmICdPYmplY3QnID09IG9wdGlvbnMuY29uc3RydWN0b3IubmFtZSkgfHxcbiAgICAob3B0aW9ucyAmJiBvcHRpb25zLl91c2VTY2hlbWFPcHRpb25zKSkge1xuICAgIG9wdGlvbnMgPSB0aGlzLnNjaGVtYS5vcHRpb25zLnRvT2JqZWN0XG4gICAgICA/IGNsb25lKHRoaXMuc2NoZW1hLm9wdGlvbnMudG9PYmplY3QpXG4gICAgICA6IHt9O1xuICB9XG5cbiAgaWYgKCBvcHRpb25zLm1pbmltaXplID09PSB1bmRlZmluZWQgKXtcbiAgICBvcHRpb25zLm1pbmltaXplID0gdGhpcy5zY2hlbWEub3B0aW9ucy5taW5pbWl6ZTtcbiAgfVxuXG4gIGlmICghb3B0aW9uc1BhcmFtZXRlcikge1xuICAgIG9wdGlvbnMuX3VzZVNjaGVtYU9wdGlvbnMgPSB0cnVlO1xuICB9XG5cbiAgdmFyIHJldCA9IHV0aWxzLmNsb25lKHRoaXMuX2RvYywgb3B0aW9ucyk7XG5cbiAgaWYgKG9wdGlvbnMudmlydHVhbHMgfHwgb3B0aW9ucy5nZXR0ZXJzICYmIGZhbHNlICE9PSBvcHRpb25zLnZpcnR1YWxzKSB7XG4gICAgYXBwbHlHZXR0ZXJzKHRoaXMsIHJldCwgJ3ZpcnR1YWxzJywgb3B0aW9ucyk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5nZXR0ZXJzKSB7XG4gICAgYXBwbHlHZXR0ZXJzKHRoaXMsIHJldCwgJ3BhdGhzJywgb3B0aW9ucyk7XG4gICAgLy8gYXBwbHlHZXR0ZXJzIGZvciBwYXRocyB3aWxsIGFkZCBuZXN0ZWQgZW1wdHkgb2JqZWN0cztcbiAgICAvLyBpZiBtaW5pbWl6ZSBpcyBzZXQsIHdlIG5lZWQgdG8gcmVtb3ZlIHRoZW0uXG4gICAgaWYgKG9wdGlvbnMubWluaW1pemUpIHtcbiAgICAgIHJldCA9IG1pbmltaXplKHJldCkgfHwge307XG4gICAgfVxuICB9XG5cbiAgLy8gSW4gdGhlIGNhc2Ugd2hlcmUgYSBzdWJkb2N1bWVudCBoYXMgaXRzIG93biB0cmFuc2Zvcm0gZnVuY3Rpb24sIHdlIG5lZWQgdG9cbiAgLy8gY2hlY2sgYW5kIHNlZSBpZiB0aGUgcGFyZW50IGhhcyBhIHRyYW5zZm9ybSAob3B0aW9ucy50cmFuc2Zvcm0pIGFuZCBpZiB0aGVcbiAgLy8gY2hpbGQgc2NoZW1hIGhhcyBhIHRyYW5zZm9ybSAodGhpcy5zY2hlbWEub3B0aW9ucy50b09iamVjdCkgSW4gdGhpcyBjYXNlLFxuICAvLyB3ZSBuZWVkIHRvIGFkanVzdCBvcHRpb25zLnRyYW5zZm9ybSB0byBiZSB0aGUgY2hpbGQgc2NoZW1hJ3MgdHJhbnNmb3JtIGFuZFxuICAvLyBub3QgdGhlIHBhcmVudCBzY2hlbWEnc1xuICBpZiAodHJ1ZSA9PT0gb3B0aW9ucy50cmFuc2Zvcm0gfHxcbiAgICAgICh0aGlzLnNjaGVtYS5vcHRpb25zLnRvT2JqZWN0ICYmIG9wdGlvbnMudHJhbnNmb3JtKSkge1xuICAgIHZhciBvcHRzID0gb3B0aW9ucy5qc29uXG4gICAgICA/IHRoaXMuc2NoZW1hLm9wdGlvbnMudG9KU09OXG4gICAgICA6IHRoaXMuc2NoZW1hLm9wdGlvbnMudG9PYmplY3Q7XG4gICAgaWYgKG9wdHMpIHtcbiAgICAgIG9wdGlvbnMudHJhbnNmb3JtID0gb3B0cy50cmFuc2Zvcm07XG4gICAgfVxuICB9XG5cbiAgaWYgKCdmdW5jdGlvbicgPT0gdHlwZW9mIG9wdGlvbnMudHJhbnNmb3JtKSB7XG4gICAgdmFyIHhmb3JtZWQgPSBvcHRpb25zLnRyYW5zZm9ybSh0aGlzLCByZXQsIG9wdGlvbnMpO1xuICAgIGlmICgndW5kZWZpbmVkJyAhPSB0eXBlb2YgeGZvcm1lZCkgcmV0ID0geGZvcm1lZDtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59O1xuXG4vKiFcbiAqIE1pbmltaXplcyBhbiBvYmplY3QsIHJlbW92aW5nIHVuZGVmaW5lZCB2YWx1ZXMgYW5kIGVtcHR5IG9iamVjdHNcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IHRvIG1pbmltaXplXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cblxuZnVuY3Rpb24gbWluaW1pemUgKG9iaikge1xuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKG9iailcbiAgICAsIGkgPSBrZXlzLmxlbmd0aFxuICAgICwgaGFzS2V5c1xuICAgICwga2V5XG4gICAgLCB2YWw7XG5cbiAgd2hpbGUgKGktLSkge1xuICAgIGtleSA9IGtleXNbaV07XG4gICAgdmFsID0gb2JqW2tleV07XG5cbiAgICBpZiAoIF8uaXNQbGFpbk9iamVjdCh2YWwpICkge1xuICAgICAgb2JqW2tleV0gPSBtaW5pbWl6ZSh2YWwpO1xuICAgIH1cblxuICAgIGlmICh1bmRlZmluZWQgPT09IG9ialtrZXldKSB7XG4gICAgICBkZWxldGUgb2JqW2tleV07XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBoYXNLZXlzID0gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBoYXNLZXlzXG4gICAgPyBvYmpcbiAgICA6IHVuZGVmaW5lZDtcbn1cblxuLyohXG4gKiBBcHBsaWVzIHZpcnR1YWxzIHByb3BlcnRpZXMgdG8gYGpzb25gLlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IHNlbGZcbiAqIEBwYXJhbSB7T2JqZWN0fSBqc29uXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZSBlaXRoZXIgYHZpcnR1YWxzYCBvciBgcGF0aHNgXG4gKiBAcmV0dXJuIHtPYmplY3R9IGBqc29uYFxuICovXG5cbmZ1bmN0aW9uIGFwcGx5R2V0dGVycyAoc2VsZiwganNvbiwgdHlwZSwgb3B0aW9ucykge1xuICB2YXIgc2NoZW1hID0gc2VsZi5zY2hlbWFcbiAgICAsIHBhdGhzID0gT2JqZWN0LmtleXMoc2NoZW1hW3R5cGVdKVxuICAgICwgaSA9IHBhdGhzLmxlbmd0aFxuICAgICwgcGF0aDtcblxuICB3aGlsZSAoaS0tKSB7XG4gICAgcGF0aCA9IHBhdGhzW2ldO1xuXG4gICAgdmFyIHBhcnRzID0gcGF0aC5zcGxpdCgnLicpXG4gICAgICAsIHBsZW4gPSBwYXJ0cy5sZW5ndGhcbiAgICAgICwgbGFzdCA9IHBsZW4gLSAxXG4gICAgICAsIGJyYW5jaCA9IGpzb25cbiAgICAgICwgcGFydDtcblxuICAgIGZvciAodmFyIGlpID0gMDsgaWkgPCBwbGVuOyArK2lpKSB7XG4gICAgICBwYXJ0ID0gcGFydHNbaWldO1xuICAgICAgaWYgKGlpID09PSBsYXN0KSB7XG4gICAgICAgIGJyYW5jaFtwYXJ0XSA9IHV0aWxzLmNsb25lKHNlbGYuZ2V0KHBhdGgpLCBvcHRpb25zKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyYW5jaCA9IGJyYW5jaFtwYXJ0XSB8fCAoYnJhbmNoW3BhcnRdID0ge30pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBqc29uO1xufVxuXG4vKipcbiAqIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBtZXRob2QgaXMgdXNlZCBpbiBjYWxscyB0byBKU09OLnN0cmluZ2lmeShkb2MpLlxuICpcbiAqIFRoaXMgbWV0aG9kIGFjY2VwdHMgdGhlIHNhbWUgb3B0aW9ucyBhcyBbRG9jdW1lbnQjdG9PYmplY3RdKCNkb2N1bWVudF9Eb2N1bWVudC10b09iamVjdCkuIFRvIGFwcGx5IHRoZSBvcHRpb25zIHRvIGV2ZXJ5IGRvY3VtZW50IG9mIHlvdXIgc2NoZW1hIGJ5IGRlZmF1bHQsIHNldCB5b3VyIFtzY2hlbWFzXSgjc2NoZW1hX1NjaGVtYSkgYHRvSlNPTmAgb3B0aW9uIHRvIHRoZSBzYW1lIGFyZ3VtZW50LlxuICpcbiAqICAgICBzY2hlbWEuc2V0KCd0b0pTT04nLCB7IHZpcnR1YWxzOiB0cnVlIH0pXG4gKlxuICogU2VlIFtzY2hlbWEgb3B0aW9uc10oL2RvY3MvZ3VpZGUuaHRtbCN0b0pTT04pIGZvciBkZXRhaWxzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKiBAc2VlIERvY3VtZW50I3RvT2JqZWN0ICNkb2N1bWVudF9Eb2N1bWVudC10b09iamVjdFxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5Eb2N1bWVudC5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgLy8gY2hlY2sgZm9yIG9iamVjdCB0eXBlIHNpbmNlIGFuIGFycmF5IG9mIGRvY3VtZW50c1xuICAvLyBiZWluZyBzdHJpbmdpZmllZCBwYXNzZXMgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkXG4gIC8vIG9mIG9wdGlvbnMgb2JqZWN0cy4gSlNPTi5zdHJpbmdpZnkoW2RvYywgZG9jXSlcbiAgLy8gVGhlIHNlY29uZCBjaGVjayBoZXJlIGlzIHRvIG1ha2Ugc3VyZSB0aGF0IHBvcHVsYXRlZCBkb2N1bWVudHMgKG9yXG4gIC8vIHN1YmRvY3VtZW50cykgdXNlIHRoZWlyIG93biBvcHRpb25zIGZvciBgLnRvSlNPTigpYCBpbnN0ZWFkIG9mIHRoZWlyXG4gIC8vIHBhcmVudCdzXG4gIGlmICghKG9wdGlvbnMgJiYgJ09iamVjdCcgPT0gb3B0aW9ucy5jb25zdHJ1Y3Rvci5uYW1lKVxuICAgICAgfHwgKCghb3B0aW9ucyB8fCBvcHRpb25zLmpzb24pICYmIHRoaXMuc2NoZW1hLm9wdGlvbnMudG9KU09OKSkge1xuXG4gICAgb3B0aW9ucyA9IHRoaXMuc2NoZW1hLm9wdGlvbnMudG9KU09OXG4gICAgICA/IHV0aWxzLmNsb25lKHRoaXMuc2NoZW1hLm9wdGlvbnMudG9KU09OKVxuICAgICAgOiB7fTtcbiAgfVxuICBvcHRpb25zLmpzb24gPSB0cnVlO1xuXG4gIHJldHVybiB0aGlzLnRvT2JqZWN0KG9wdGlvbnMpO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIERvY3VtZW50IHN0b3JlcyB0aGUgc2FtZSBkYXRhIGFzIGRvYy5cbiAqXG4gKiBEb2N1bWVudHMgYXJlIGNvbnNpZGVyZWQgZXF1YWwgd2hlbiB0aGV5IGhhdmUgbWF0Y2hpbmcgYF9pZGBzLCB1bmxlc3MgbmVpdGhlclxuICogZG9jdW1lbnQgaGFzIGFuIGBfaWRgLCBpbiB3aGljaCBjYXNlIHRoaXMgZnVuY3Rpb24gZmFsbHMgYmFjayB0byB1c2luZ1xuICogYGRlZXBFcXVhbCgpYC5cbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2MgYSBkb2N1bWVudCB0byBjb21wYXJlXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5Eb2N1bWVudC5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gKGRvYykge1xuICB2YXIgdGlkID0gdGhpcy5nZXQoJ19pZCcpO1xuICB2YXIgZG9jaWQgPSBkb2MuZ2V0KCdfaWQnKTtcbiAgaWYgKCF0aWQgJiYgIWRvY2lkKSB7XG4gICAgcmV0dXJuIGRlZXBFcXVhbCh0aGlzLCBkb2MpO1xuICB9XG4gIHJldHVybiB0aWQgJiYgdGlkLmVxdWFsc1xuICAgID8gdGlkLmVxdWFscyhkb2NpZClcbiAgICA6IHRpZCA9PT0gZG9jaWQ7XG59XG5cbi8qKlxuICogR2V0cyBfaWQocykgdXNlZCBkdXJpbmcgcG9wdWxhdGlvbiBvZiB0aGUgZ2l2ZW4gYHBhdGhgLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICBNb2RlbC5maW5kT25lKCkucG9wdWxhdGUoJ2F1dGhvcicpLmV4ZWMoZnVuY3Rpb24gKGVyciwgZG9jKSB7XG4gKiAgICAgICBjb25zb2xlLmxvZyhkb2MuYXV0aG9yLm5hbWUpICAgICAgICAgLy8gRHIuU2V1c3NcbiAqICAgICAgIGNvbnNvbGUubG9nKGRvYy5wb3B1bGF0ZWQoJ2F1dGhvcicpKSAvLyAnNTE0NGNmODA1MGYwNzFkOTc5YzExOGE3J1xuICogICAgIH0pXG4gKlxuICogSWYgdGhlIHBhdGggd2FzIG5vdCBwb3B1bGF0ZWQsIHVuZGVmaW5lZCBpcyByZXR1cm5lZC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHJldHVybiB7QXJyYXl8T2JqZWN0SWR8TnVtYmVyfEJ1ZmZlcnxTdHJpbmd8dW5kZWZpbmVkfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLnBvcHVsYXRlZCA9IGZ1bmN0aW9uIChwYXRoLCB2YWwsIG9wdGlvbnMpIHtcbiAgLy8gdmFsIGFuZCBvcHRpb25zIGFyZSBpbnRlcm5hbFxuXG4gIC8vVE9ETzog0LTQvtC00LXQu9Cw0YLRjCDRjdGC0YMg0L/RgNC+0LLQtdGA0LrRgywg0L7QvdCwINC00L7Qu9C20L3QsCDQvtC/0LjRgNCw0YLRjNGB0Y8g0L3QtSDQvdCwICRfXy5wb3B1bGF0ZWQsINCwINC90LAg0YLQviwg0YfRgtC+INC90LDRiCDQvtCx0YrQtdC60YIg0LjQvNC10LXRgiDRgNC+0LTQuNGC0LXQu9GPXG4gIC8vINC4INC/0L7RgtC+0Lwg0YPQttC1INCy0YvRgdGC0LDQstC70Y/RgtGMINGB0LLQvtC50YHRgtCy0L4gcG9wdWxhdGVkID09IHRydWVcbiAgaWYgKG51bGwgPT0gdmFsKSB7XG4gICAgaWYgKCF0aGlzLiRfXy5wb3B1bGF0ZWQpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgdmFyIHYgPSB0aGlzLiRfXy5wb3B1bGF0ZWRbcGF0aF07XG4gICAgaWYgKHYpIHJldHVybiB2LnZhbHVlO1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyBpbnRlcm5hbFxuXG4gIGlmICh0cnVlID09PSB2YWwpIHtcbiAgICBpZiAoIXRoaXMuJF9fLnBvcHVsYXRlZCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICByZXR1cm4gdGhpcy4kX18ucG9wdWxhdGVkW3BhdGhdO1xuICB9XG5cbiAgdGhpcy4kX18ucG9wdWxhdGVkIHx8ICh0aGlzLiRfXy5wb3B1bGF0ZWQgPSB7fSk7XG4gIHRoaXMuJF9fLnBvcHVsYXRlZFtwYXRoXSA9IHsgdmFsdWU6IHZhbCwgb3B0aW9uczogb3B0aW9ucyB9O1xuICByZXR1cm4gdmFsO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBmdWxsIHBhdGggdG8gdGhpcyBkb2N1bWVudC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gW3BhdGhdXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqIEBtZXRob2QgJF9fZnVsbFBhdGhcbiAqIEBtZW1iZXJPZiBEb2N1bWVudFxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuJF9fZnVsbFBhdGggPSBmdW5jdGlvbiAocGF0aCkge1xuICAvLyBvdmVycmlkZGVuIGluIFN1YkRvY3VtZW50c1xuICByZXR1cm4gcGF0aCB8fCAnJztcbn07XG5cbi8qKlxuICog0KPQtNCw0LvQuNGC0Ywg0LTQvtC60YPQvNC10L3RgiDQuCDQstC10YDQvdGD0YLRjCDQutC+0LvQu9C10LrRhtC40Y4uXG4gKlxuICogQGV4YW1wbGVcbiAqIHN0b3JhZ2UuY29sbGVjdGlvbi5kb2N1bWVudC5yZW1vdmUoKTtcbiAqIGRvY3VtZW50LnJlbW92ZSgpO1xuICpcbiAqIEBzZWUgQ29sbGVjdGlvbi5yZW1vdmVcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24oKXtcbiAgaWYgKCB0aGlzLmNvbGxlY3Rpb24gKXtcbiAgICByZXR1cm4gdGhpcy5jb2xsZWN0aW9uLnJlbW92ZSggdGhpcyApO1xuICB9XG5cbiAgcmV0dXJuIGRlbGV0ZSB0aGlzO1xufTtcblxuXG4vKipcbiAqINCe0YfQuNGJ0LDQtdGCINC00L7QutGD0LzQtdC90YIgKNCy0YvRgdGC0LDQstC70Y/QtdGCINC30L3QsNGH0LXQvdC40LUg0L/QviDRg9C80L7Qu9GH0LDQvdC40Y4g0LjQu9C4IHVuZGVmaW5lZClcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLmVtcHR5ID0gZnVuY3Rpb24oKXtcbiAgdmFyIGRvYyA9IHRoaXNcbiAgICAsIHNlbGYgPSB0aGlzXG4gICAgLCBwYXRocyA9IE9iamVjdC5rZXlzKCB0aGlzLnNjaGVtYS5wYXRocyApXG4gICAgLCBwbGVuID0gcGF0aHMubGVuZ3RoXG4gICAgLCBpaSA9IDA7XG5cbiAgZm9yICggOyBpaSA8IHBsZW47ICsraWkgKSB7XG4gICAgdmFyIHAgPSBwYXRoc1tpaV07XG5cbiAgICBpZiAoICdfaWQnID09IHAgKSBjb250aW51ZTtcblxuICAgIHZhciB0eXBlID0gdGhpcy5zY2hlbWEucGF0aHNbIHAgXVxuICAgICAgLCBwYXRoID0gcC5zcGxpdCgnLicpXG4gICAgICAsIGxlbiA9IHBhdGgubGVuZ3RoXG4gICAgICAsIGxhc3QgPSBsZW4gLSAxXG4gICAgICAsIGRvY18gPSBkb2NcbiAgICAgICwgaSA9IDA7XG5cbiAgICBmb3IgKCA7IGkgPCBsZW47ICsraSApIHtcbiAgICAgIHZhciBwaWVjZSA9IHBhdGhbIGkgXVxuICAgICAgICAsIGRlZmF1bHRWYWw7XG5cbiAgICAgIGlmICggaSA9PT0gbGFzdCApIHtcbiAgICAgICAgZGVmYXVsdFZhbCA9IHR5cGUuZ2V0RGVmYXVsdCggc2VsZiwgdHJ1ZSApO1xuXG4gICAgICAgIGRvY19bIHBpZWNlIF0gPSBkZWZhdWx0VmFsIHx8IHVuZGVmaW5lZDtcbiAgICAgICAgc2VsZi4kX18uYWN0aXZlUGF0aHMuZGVmYXVsdCggcCApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZG9jXyA9IGRvY19bIHBpZWNlIF0gfHwgKCBkb2NfWyBwaWVjZSBdID0ge30gKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxuRG9jdW1lbnQuVmFsaWRhdGlvbkVycm9yID0gVmFsaWRhdGlvbkVycm9yO1xubW9kdWxlLmV4cG9ydHMgPSBEb2N1bWVudDtcbiIsIi8vdG9kbzog0L/QvtGA0YLQuNGA0L7QstCw0YLRjCDQstGB0LUg0L7RiNC40LHQutC4ISEhXG4vKipcbiAqIFN0b3JhZ2VFcnJvciBjb25zdHJ1Y3RvclxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBtc2cgLSBFcnJvciBtZXNzYWdlXG4gKiBAaW5oZXJpdHMgRXJyb3IgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvRXJyb3JcbiAqIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNzgzODE4L2hvdy1kby1pLWNyZWF0ZS1hLWN1c3RvbS1lcnJvci1pbi1qYXZhc2NyaXB0XG4gKi9cbmZ1bmN0aW9uIFN0b3JhZ2VFcnJvciAoIG1zZyApIHtcbiAgdGhpcy5tZXNzYWdlID0gbXNnO1xuICB0aGlzLm5hbWUgPSAnU3RvcmFnZUVycm9yJztcbn1cblN0b3JhZ2VFcnJvci5wcm90b3R5cGUgPSBuZXcgRXJyb3IoKTtcblxuXG4vKiFcbiAqIEZvcm1hdHMgZXJyb3IgbWVzc2FnZXNcbiAqL1xuU3RvcmFnZUVycm9yLnByb3RvdHlwZS5mb3JtYXRNZXNzYWdlID0gZnVuY3Rpb24gKG1zZywgcGF0aCwgdHlwZSwgdmFsKSB7XG4gIGlmICghbXNnKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdtZXNzYWdlIGlzIHJlcXVpcmVkJyk7XG5cbiAgcmV0dXJuIG1zZy5yZXBsYWNlKC97UEFUSH0vLCBwYXRoKVxuICAgICAgICAgICAgLnJlcGxhY2UoL3tWQUxVRX0vLCBTdHJpbmcodmFsfHwnJykpXG4gICAgICAgICAgICAucmVwbGFjZSgve1RZUEV9LywgdHlwZSB8fCAnZGVjbGFyZWQgdHlwZScpO1xufTtcblxuLyohXG4gKiBNb2R1bGUgZXhwb3J0cy5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0b3JhZ2VFcnJvcjtcblxuLyoqXG4gKiBUaGUgZGVmYXVsdCBidWlsdC1pbiB2YWxpZGF0b3IgZXJyb3IgbWVzc2FnZXMuXG4gKlxuICogQHNlZSBFcnJvci5tZXNzYWdlcyAjZXJyb3JfbWVzc2FnZXNfTW9uZ29vc2VFcnJvci1tZXNzYWdlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5TdG9yYWdlRXJyb3IubWVzc2FnZXMgPSByZXF1aXJlKCcuL2Vycm9yL21lc3NhZ2VzJyk7XG5cbi8qIVxuICogRXhwb3NlIHN1YmNsYXNzZXNcbiAqL1xuXG5TdG9yYWdlRXJyb3IuQ2FzdEVycm9yID0gcmVxdWlyZSgnLi9lcnJvci9jYXN0Jyk7XG5TdG9yYWdlRXJyb3IuVmFsaWRhdGlvbkVycm9yID0gcmVxdWlyZSgnLi9lcnJvci92YWxpZGF0aW9uJyk7XG5TdG9yYWdlRXJyb3IuVmFsaWRhdG9yRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yL3ZhbGlkYXRvcicpO1xuLy90b2RvOlxuLy9TdG9yYWdlRXJyb3IuVmVyc2lvbkVycm9yID0gcmVxdWlyZSgnLi9lcnJvci92ZXJzaW9uJyk7XG4vL1N0b3JhZ2VFcnJvci5PdmVyd3JpdGVNb2RlbEVycm9yID0gcmVxdWlyZSgnLi9lcnJvci9vdmVyd3JpdGVNb2RlbCcpO1xuLy9TdG9yYWdlRXJyb3IuTWlzc2luZ1NjaGVtYUVycm9yID0gcmVxdWlyZSgnLi9lcnJvci9taXNzaW5nU2NoZW1hJyk7XG4vL1N0b3JhZ2VFcnJvci5EaXZlcmdlbnRBcnJheUVycm9yID0gcmVxdWlyZSgnLi9lcnJvci9kaXZlcmdlbnRBcnJheScpO1xuIiwiLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBTdG9yYWdlRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvci5qcycpO1xuXG4vKipcbiAqIENhc3RpbmcgRXJyb3IgY29uc3RydWN0b3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZVxuICogQGluaGVyaXRzIE1vbmdvb3NlRXJyb3JcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIENhc3RFcnJvciAodHlwZSwgdmFsdWUsIHBhdGgpIHtcbiAgU3RvcmFnZUVycm9yLmNhbGwodGhpcywgJ0Nhc3QgdG8gJyArIHR5cGUgKyAnIGZhaWxlZCBmb3IgdmFsdWUgXCInICsgdmFsdWUgKyAnXCIgYXQgcGF0aCBcIicgKyBwYXRoICsgJ1wiJyk7XG4gIHRoaXMubmFtZSA9ICdDYXN0RXJyb3InO1xuICB0aGlzLnR5cGUgPSB0eXBlO1xuICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIHRoaXMucGF0aCA9IHBhdGg7XG59XG5cbi8qIVxuICogSW5oZXJpdHMgZnJvbSBNb25nb29zZUVycm9yLlxuICovXG5cbkNhc3RFcnJvci5wcm90b3R5cGUuX19wcm90b19fID0gU3RvcmFnZUVycm9yLnByb3RvdHlwZTtcblxuLyohXG4gKiBleHBvcnRzXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBDYXN0RXJyb3I7XG4iLCJcbi8qKlxuICogVGhlIGRlZmF1bHQgYnVpbHQtaW4gdmFsaWRhdG9yIGVycm9yIG1lc3NhZ2VzLiBUaGVzZSBtYXkgYmUgY3VzdG9taXplZC5cbiAqXG4gKiAgICAgLy8gY3VzdG9taXplIHdpdGhpbiBlYWNoIHNjaGVtYSBvciBnbG9iYWxseSBsaWtlIHNvXG4gKiAgICAgdmFyIG1vbmdvb3NlID0gcmVxdWlyZSgnbW9uZ29vc2UnKTtcbiAqICAgICBtb25nb29zZS5FcnJvci5tZXNzYWdlcy5TdHJpbmcuZW51bSAgPSBcIllvdXIgY3VzdG9tIG1lc3NhZ2UgZm9yIHtQQVRIfS5cIjtcbiAqXG4gKiBBcyB5b3UgbWlnaHQgaGF2ZSBub3RpY2VkLCBlcnJvciBtZXNzYWdlcyBzdXBwb3J0IGJhc2ljIHRlbXBsYXRpbmdcbiAqXG4gKiAtIGB7UEFUSH1gIGlzIHJlcGxhY2VkIHdpdGggdGhlIGludmFsaWQgZG9jdW1lbnQgcGF0aFxuICogLSBge1ZBTFVFfWAgaXMgcmVwbGFjZWQgd2l0aCB0aGUgaW52YWxpZCB2YWx1ZVxuICogLSBge1RZUEV9YCBpcyByZXBsYWNlZCB3aXRoIHRoZSB2YWxpZGF0b3IgdHlwZSBzdWNoIGFzIFwicmVnZXhwXCIsIFwibWluXCIsIG9yIFwidXNlciBkZWZpbmVkXCJcbiAqIC0gYHtNSU59YCBpcyByZXBsYWNlZCB3aXRoIHRoZSBkZWNsYXJlZCBtaW4gdmFsdWUgZm9yIHRoZSBOdW1iZXIubWluIHZhbGlkYXRvclxuICogLSBge01BWH1gIGlzIHJlcGxhY2VkIHdpdGggdGhlIGRlY2xhcmVkIG1heCB2YWx1ZSBmb3IgdGhlIE51bWJlci5tYXggdmFsaWRhdG9yXG4gKlxuICogQ2xpY2sgdGhlIFwic2hvdyBjb2RlXCIgbGluayBiZWxvdyB0byBzZWUgYWxsIGRlZmF1bHRzLlxuICpcbiAqIEBwcm9wZXJ0eSBtZXNzYWdlc1xuICogQHJlY2VpdmVyIE1vbmdvb3NlRXJyb3JcbiAqIEBhcGkgcHVibGljXG4gKi9cblxudmFyIG1zZyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbm1zZy5nZW5lcmFsID0ge307XG5tc2cuZ2VuZXJhbC5kZWZhdWx0ID0gXCJWYWxpZGF0b3IgZmFpbGVkIGZvciBwYXRoIGB7UEFUSH1gIHdpdGggdmFsdWUgYHtWQUxVRX1gXCI7XG5tc2cuZ2VuZXJhbC5yZXF1aXJlZCA9IFwiUGF0aCBge1BBVEh9YCBpcyByZXF1aXJlZC5cIjtcblxubXNnLk51bWJlciA9IHt9O1xubXNnLk51bWJlci5taW4gPSBcIlBhdGggYHtQQVRIfWAgKHtWQUxVRX0pIGlzIGxlc3MgdGhhbiBtaW5pbXVtIGFsbG93ZWQgdmFsdWUgKHtNSU59KS5cIjtcbm1zZy5OdW1iZXIubWF4ID0gXCJQYXRoIGB7UEFUSH1gICh7VkFMVUV9KSBpcyBtb3JlIHRoYW4gbWF4aW11bSBhbGxvd2VkIHZhbHVlICh7TUFYfSkuXCI7XG5cbm1zZy5TdHJpbmcgPSB7fTtcbm1zZy5TdHJpbmcuZW51bSA9IFwiYHtWQUxVRX1gIGlzIG5vdCBhIHZhbGlkIGVudW0gdmFsdWUgZm9yIHBhdGggYHtQQVRIfWAuXCI7XG5tc2cuU3RyaW5nLm1hdGNoID0gXCJQYXRoIGB7UEFUSH1gIGlzIGludmFsaWQgKHtWQUxVRX0pLlwiO1xuXG4iLCJcbi8qIVxuICogTW9kdWxlIHJlcXVpcmVtZW50c1xuICovXG5cbnZhciBTdG9yYWdlRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvci5qcycpO1xuXG4vKipcbiAqIERvY3VtZW50IFZhbGlkYXRpb24gRXJyb3JcbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGluc3RhbmNlXG4gKiBAaW5oZXJpdHMgTW9uZ29vc2VFcnJvclxuICovXG5cbmZ1bmN0aW9uIFZhbGlkYXRpb25FcnJvciAoaW5zdGFuY2UpIHtcbiAgU3RvcmFnZUVycm9yLmNhbGwodGhpcywgXCJWYWxpZGF0aW9uIGZhaWxlZFwiKTtcbiAgdGhpcy5uYW1lID0gJ1ZhbGlkYXRpb25FcnJvcic7XG4gIHRoaXMuZXJyb3JzID0gaW5zdGFuY2UuZXJyb3JzID0ge307XG59XG5cbi8qIVxuICogSW5oZXJpdHMgZnJvbSBNb25nb29zZUVycm9yLlxuICovXG5cblZhbGlkYXRpb25FcnJvci5wcm90b3R5cGUuX19wcm90b19fID0gU3RvcmFnZUVycm9yLnByb3RvdHlwZTtcblxuLyohXG4gKiBNb2R1bGUgZXhwb3J0c1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gVmFsaWRhdGlvbkVycm9yO1xuIiwiLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBTdG9yYWdlRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvci5qcycpO1xudmFyIGVycm9yTWVzc2FnZXMgPSBTdG9yYWdlRXJyb3IubWVzc2FnZXM7XG5cbi8qKlxuICogU2NoZW1hIHZhbGlkYXRvciBlcnJvclxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge1N0cmluZ30gbXNnXG4gKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ8YW55fSB2YWxcbiAqIEBpbmhlcml0cyBNb25nb29zZUVycm9yXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBWYWxpZGF0b3JFcnJvciAocGF0aCwgbXNnLCB0eXBlLCB2YWwpIHtcbiAgaWYgKCFtc2cpIG1zZyA9IGVycm9yTWVzc2FnZXMuZ2VuZXJhbC5kZWZhdWx0O1xuICB2YXIgbWVzc2FnZSA9IHRoaXMuZm9ybWF0TWVzc2FnZShtc2csIHBhdGgsIHR5cGUsIHZhbCk7XG4gIFN0b3JhZ2VFcnJvci5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xuICB0aGlzLm5hbWUgPSAnVmFsaWRhdG9yRXJyb3InO1xuICB0aGlzLnBhdGggPSBwYXRoO1xuICB0aGlzLnR5cGUgPSB0eXBlO1xuICB0aGlzLnZhbHVlID0gdmFsO1xufVxuXG4vKiFcbiAqIHRvU3RyaW5nIGhlbHBlclxuICovXG5cblZhbGlkYXRvckVycm9yLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMubWVzc2FnZTtcbn1cblxuLyohXG4gKiBJbmhlcml0cyBmcm9tIE1vbmdvb3NlRXJyb3JcbiAqL1xuXG5WYWxpZGF0b3JFcnJvci5wcm90b3R5cGUuX19wcm90b19fID0gU3RvcmFnZUVycm9yLnByb3RvdHlwZTtcblxuLyohXG4gKiBleHBvcnRzXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBWYWxpZGF0b3JFcnJvcjtcbiIsIi8vIEJhY2tib25lLkV2ZW50c1xuLy8gLS0tLS0tLS0tLS0tLS0tXG5cbi8vIEEgbW9kdWxlIHRoYXQgY2FuIGJlIG1peGVkIGluIHRvICphbnkgb2JqZWN0KiBpbiBvcmRlciB0byBwcm92aWRlIGl0IHdpdGhcbi8vIGN1c3RvbSBldmVudHMuIFlvdSBtYXkgYmluZCB3aXRoIGBvbmAgb3IgcmVtb3ZlIHdpdGggYG9mZmAgY2FsbGJhY2tcbi8vIGZ1bmN0aW9ucyB0byBhbiBldmVudDsgYHRyaWdnZXJgLWluZyBhbiBldmVudCBmaXJlcyBhbGwgY2FsbGJhY2tzIGluXG4vLyBzdWNjZXNzaW9uLlxuLy9cbi8vICAgICB2YXIgb2JqZWN0ID0ge307XG4vLyAgICAgXy5leHRlbmQob2JqZWN0LCBFdmVudHMucHJvdG90eXBlKTtcbi8vICAgICBvYmplY3Qub24oJ2V4cGFuZCcsIGZ1bmN0aW9uKCl7IGFsZXJ0KCdleHBhbmRlZCcpOyB9KTtcbi8vICAgICBvYmplY3QudHJpZ2dlcignZXhwYW5kJyk7XG4vL1xuZnVuY3Rpb24gRXZlbnRzKCkge31cblxuRXZlbnRzLnByb3RvdHlwZSA9IHtcblxuICAvLyBCaW5kIGFuIGV2ZW50IHRvIGEgYGNhbGxiYWNrYCBmdW5jdGlvbi4gUGFzc2luZyBgXCJhbGxcImAgd2lsbCBiaW5kXG4gIC8vIHRoZSBjYWxsYmFjayB0byBhbGwgZXZlbnRzIGZpcmVkLlxuICBvbjogZnVuY3Rpb24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICBpZiAoIWV2ZW50c0FwaSh0aGlzLCAnb24nLCBuYW1lLCBbY2FsbGJhY2ssIGNvbnRleHRdKSB8fCAhY2FsbGJhY2spIHJldHVybiB0aGlzO1xuICAgIHRoaXMuX2V2ZW50cyB8fCAodGhpcy5fZXZlbnRzID0ge30pO1xuICAgIHZhciBldmVudHMgPSB0aGlzLl9ldmVudHNbbmFtZV0gfHwgKHRoaXMuX2V2ZW50c1tuYW1lXSA9IFtdKTtcbiAgICBldmVudHMucHVzaCh7Y2FsbGJhY2s6IGNhbGxiYWNrLCBjb250ZXh0OiBjb250ZXh0LCBjdHg6IGNvbnRleHQgfHwgdGhpc30pO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8vIEJpbmQgYW4gZXZlbnQgdG8gb25seSBiZSB0cmlnZ2VyZWQgYSBzaW5nbGUgdGltZS4gQWZ0ZXIgdGhlIGZpcnN0IHRpbWVcbiAgLy8gdGhlIGNhbGxiYWNrIGlzIGludm9rZWQsIGl0IHdpbGwgYmUgcmVtb3ZlZC5cbiAgb25jZTogZnVuY3Rpb24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICBpZiAoIWV2ZW50c0FwaSh0aGlzLCAnb25jZScsIG5hbWUsIFtjYWxsYmFjaywgY29udGV4dF0pIHx8ICFjYWxsYmFjaykgcmV0dXJuIHRoaXM7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBvbmNlID0gXy5vbmNlKGZ1bmN0aW9uKCkge1xuICAgICAgc2VsZi5vZmYobmFtZSwgb25jZSk7XG4gICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH0pO1xuICAgIG9uY2UuX2NhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgcmV0dXJuIHRoaXMub24obmFtZSwgb25jZSwgY29udGV4dCk7XG4gIH0sXG5cbiAgLy8gUmVtb3ZlIG9uZSBvciBtYW55IGNhbGxiYWNrcy4gSWYgYGNvbnRleHRgIGlzIG51bGwsIHJlbW92ZXMgYWxsXG4gIC8vIGNhbGxiYWNrcyB3aXRoIHRoYXQgZnVuY3Rpb24uIElmIGBjYWxsYmFja2AgaXMgbnVsbCwgcmVtb3ZlcyBhbGxcbiAgLy8gY2FsbGJhY2tzIGZvciB0aGUgZXZlbnQuIElmIGBuYW1lYCBpcyBudWxsLCByZW1vdmVzIGFsbCBib3VuZFxuICAvLyBjYWxsYmFja3MgZm9yIGFsbCBldmVudHMuXG4gIG9mZjogZnVuY3Rpb24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICB2YXIgcmV0YWluLCBldiwgZXZlbnRzLCBuYW1lcywgaSwgbCwgaiwgaztcbiAgICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhZXZlbnRzQXBpKHRoaXMsICdvZmYnLCBuYW1lLCBbY2FsbGJhY2ssIGNvbnRleHRdKSkgcmV0dXJuIHRoaXM7XG4gICAgaWYgKCFuYW1lICYmICFjYWxsYmFjayAmJiAhY29udGV4dCkge1xuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgbmFtZXMgPSBuYW1lID8gW25hbWVdIDogXy5rZXlzKHRoaXMuX2V2ZW50cyk7XG4gICAgZm9yIChpID0gMCwgbCA9IG5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgbmFtZSA9IG5hbWVzW2ldO1xuICAgICAgaWYgKGV2ZW50cyA9IHRoaXMuX2V2ZW50c1tuYW1lXSkge1xuICAgICAgICB0aGlzLl9ldmVudHNbbmFtZV0gPSByZXRhaW4gPSBbXTtcbiAgICAgICAgaWYgKGNhbGxiYWNrIHx8IGNvbnRleHQpIHtcbiAgICAgICAgICBmb3IgKGogPSAwLCBrID0gZXZlbnRzLmxlbmd0aDsgaiA8IGs7IGorKykge1xuICAgICAgICAgICAgZXYgPSBldmVudHNbal07XG4gICAgICAgICAgICBpZiAoKGNhbGxiYWNrICYmIGNhbGxiYWNrICE9PSBldi5jYWxsYmFjayAmJiBjYWxsYmFjayAhPT0gZXYuY2FsbGJhY2suX2NhbGxiYWNrKSB8fFxuICAgICAgICAgICAgICAoY29udGV4dCAmJiBjb250ZXh0ICE9PSBldi5jb250ZXh0KSkge1xuICAgICAgICAgICAgICByZXRhaW4ucHVzaChldik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghcmV0YWluLmxlbmd0aCkgZGVsZXRlIHRoaXMuX2V2ZW50c1tuYW1lXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICAvLyBUcmlnZ2VyIG9uZSBvciBtYW55IGV2ZW50cywgZmlyaW5nIGFsbCBib3VuZCBjYWxsYmFja3MuIENhbGxiYWNrcyBhcmVcbiAgLy8gcGFzc2VkIHRoZSBzYW1lIGFyZ3VtZW50cyBhcyBgdHJpZ2dlcmAgaXMsIGFwYXJ0IGZyb20gdGhlIGV2ZW50IG5hbWVcbiAgLy8gKHVubGVzcyB5b3UncmUgbGlzdGVuaW5nIG9uIGBcImFsbFwiYCwgd2hpY2ggd2lsbCBjYXVzZSB5b3VyIGNhbGxiYWNrIHRvXG4gIC8vIHJlY2VpdmUgdGhlIHRydWUgbmFtZSBvZiB0aGUgZXZlbnQgYXMgdGhlIGZpcnN0IGFyZ3VtZW50KS5cbiAgdHJpZ2dlcjogZnVuY3Rpb24obmFtZSkge1xuICAgIGlmICghdGhpcy5fZXZlbnRzKSByZXR1cm4gdGhpcztcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgaWYgKCFldmVudHNBcGkodGhpcywgJ3RyaWdnZXInLCBuYW1lLCBhcmdzKSkgcmV0dXJuIHRoaXM7XG4gICAgdmFyIGV2ZW50cyA9IHRoaXMuX2V2ZW50c1tuYW1lXTtcbiAgICB2YXIgYWxsRXZlbnRzID0gdGhpcy5fZXZlbnRzLmFsbDtcbiAgICBpZiAoZXZlbnRzKSB0cmlnZ2VyRXZlbnRzKGV2ZW50cywgYXJncyk7XG4gICAgaWYgKGFsbEV2ZW50cykgdHJpZ2dlckV2ZW50cyhhbGxFdmVudHMsIGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLy8gVGVsbCB0aGlzIG9iamVjdCB0byBzdG9wIGxpc3RlbmluZyB0byBlaXRoZXIgc3BlY2lmaWMgZXZlbnRzIC4uLiBvclxuICAvLyB0byBldmVyeSBvYmplY3QgaXQncyBjdXJyZW50bHkgbGlzdGVuaW5nIHRvLlxuICBzdG9wTGlzdGVuaW5nOiBmdW5jdGlvbihvYmosIG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGxpc3RlbmluZ1RvID0gdGhpcy5fbGlzdGVuaW5nVG87XG4gICAgaWYgKCFsaXN0ZW5pbmdUbykgcmV0dXJuIHRoaXM7XG4gICAgdmFyIHJlbW92ZSA9ICFuYW1lICYmICFjYWxsYmFjaztcbiAgICBpZiAoIWNhbGxiYWNrICYmIHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JykgY2FsbGJhY2sgPSB0aGlzO1xuICAgIGlmIChvYmopIChsaXN0ZW5pbmdUbyA9IHt9KVtvYmouX2xpc3RlbklkXSA9IG9iajtcbiAgICBmb3IgKHZhciBpZCBpbiBsaXN0ZW5pbmdUbykge1xuICAgICAgb2JqID0gbGlzdGVuaW5nVG9baWRdO1xuICAgICAgb2JqLm9mZihuYW1lLCBjYWxsYmFjaywgdGhpcyk7XG4gICAgICBpZiAocmVtb3ZlIHx8IF8uaXNFbXB0eShvYmouX2V2ZW50cykpIGRlbGV0ZSB0aGlzLl9saXN0ZW5pbmdUb1tpZF07XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG59O1xuXG4vLyBSZWd1bGFyIGV4cHJlc3Npb24gdXNlZCB0byBzcGxpdCBldmVudCBzdHJpbmdzLlxudmFyIGV2ZW50U3BsaXR0ZXIgPSAvXFxzKy87XG5cbi8vIEltcGxlbWVudCBmYW5jeSBmZWF0dXJlcyBvZiB0aGUgRXZlbnRzIEFQSSBzdWNoIGFzIG11bHRpcGxlIGV2ZW50XG4vLyBuYW1lcyBgXCJjaGFuZ2UgYmx1clwiYCBhbmQgalF1ZXJ5LXN0eWxlIGV2ZW50IG1hcHMgYHtjaGFuZ2U6IGFjdGlvbn1gXG4vLyBpbiB0ZXJtcyBvZiB0aGUgZXhpc3RpbmcgQVBJLlxudmFyIGV2ZW50c0FwaSA9IGZ1bmN0aW9uKG9iaiwgYWN0aW9uLCBuYW1lLCByZXN0KSB7XG4gIGlmICghbmFtZSkgcmV0dXJuIHRydWU7XG5cbiAgLy8gSGFuZGxlIGV2ZW50IG1hcHMuXG4gIGlmICh0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gbmFtZSkge1xuICAgICAgb2JqW2FjdGlvbl0uYXBwbHkob2JqLCBba2V5LCBuYW1lW2tleV1dLmNvbmNhdChyZXN0KSk7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIEhhbmRsZSBzcGFjZSBzZXBhcmF0ZWQgZXZlbnQgbmFtZXMuXG4gIGlmIChldmVudFNwbGl0dGVyLnRlc3QobmFtZSkpIHtcbiAgICB2YXIgbmFtZXMgPSBuYW1lLnNwbGl0KGV2ZW50U3BsaXR0ZXIpO1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gbmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBvYmpbYWN0aW9uXS5hcHBseShvYmosIFtuYW1lc1tpXV0uY29uY2F0KHJlc3QpKTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG4vLyBBIGRpZmZpY3VsdC10by1iZWxpZXZlLCBidXQgb3B0aW1pemVkIGludGVybmFsIGRpc3BhdGNoIGZ1bmN0aW9uIGZvclxuLy8gdHJpZ2dlcmluZyBldmVudHMuIFRyaWVzIHRvIGtlZXAgdGhlIHVzdWFsIGNhc2VzIHNwZWVkeSAobW9zdCBpbnRlcm5hbFxuLy8gQmFja2JvbmUgZXZlbnRzIGhhdmUgMyBhcmd1bWVudHMpLlxudmFyIHRyaWdnZXJFdmVudHMgPSBmdW5jdGlvbihldmVudHMsIGFyZ3MpIHtcbiAgdmFyIGV2LCBpID0gLTEsIGwgPSBldmVudHMubGVuZ3RoLCBhMSA9IGFyZ3NbMF0sIGEyID0gYXJnc1sxXSwgYTMgPSBhcmdzWzJdO1xuICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgY2FzZSAwOiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5jYWxsKGV2LmN0eCk7IHJldHVybjtcbiAgICBjYXNlIDE6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4LCBhMSk7IHJldHVybjtcbiAgICBjYXNlIDI6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4LCBhMSwgYTIpOyByZXR1cm47XG4gICAgY2FzZSAzOiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5jYWxsKGV2LmN0eCwgYTEsIGEyLCBhMyk7IHJldHVybjtcbiAgICBkZWZhdWx0OiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5hcHBseShldi5jdHgsIGFyZ3MpO1xuICB9XG59O1xuXG52YXIgbGlzdGVuTWV0aG9kcyA9IHtsaXN0ZW5UbzogJ29uJywgbGlzdGVuVG9PbmNlOiAnb25jZSd9O1xuXG4vLyBJbnZlcnNpb24tb2YtY29udHJvbCB2ZXJzaW9ucyBvZiBgb25gIGFuZCBgb25jZWAuIFRlbGwgKnRoaXMqIG9iamVjdCB0b1xuLy8gbGlzdGVuIHRvIGFuIGV2ZW50IGluIGFub3RoZXIgb2JqZWN0IC4uLiBrZWVwaW5nIHRyYWNrIG9mIHdoYXQgaXQnc1xuLy8gbGlzdGVuaW5nIHRvLlxuXy5lYWNoKGxpc3Rlbk1ldGhvZHMsIGZ1bmN0aW9uKGltcGxlbWVudGF0aW9uLCBtZXRob2QpIHtcbiAgRXZlbnRzW21ldGhvZF0gPSBmdW5jdGlvbihvYmosIG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGxpc3RlbmluZ1RvID0gdGhpcy5fbGlzdGVuaW5nVG8gfHwgKHRoaXMuX2xpc3RlbmluZ1RvID0ge30pO1xuICAgIHZhciBpZCA9IG9iai5fbGlzdGVuSWQgfHwgKG9iai5fbGlzdGVuSWQgPSBfLnVuaXF1ZUlkKCdsJykpO1xuICAgIGxpc3RlbmluZ1RvW2lkXSA9IG9iajtcbiAgICBpZiAoIWNhbGxiYWNrICYmIHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JykgY2FsbGJhY2sgPSB0aGlzO1xuICAgIG9ialtpbXBsZW1lbnRhdGlvbl0obmFtZSwgY2FsbGJhY2ssIHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRzO1xuIiwiLyoqXG4gKiDQpdGA0LDQvdC40LvQuNGJ0LUg0LTQvtC60YPQvNC10L3RgtC+0LIg0L/QviDRgdGF0LXQvNCw0LxcbiAqINCy0LTQvtGF0L3QvtCy0LvRkdC9IG1vbmdvb3NlIDMuOC40ICjQuNGB0L/RgNCw0LLQu9C10L3RiyDQsdCw0LPQuCDQv9C+IDMuOC4xNClcbiAqXG4gKiDQoNC10LDQu9C40LfQsNGG0LjQuCDRhdGA0LDQvdC40LvQuNGJ0LBcbiAqIGh0dHA6Ly9kb2NzLm1ldGVvci5jb20vI3NlbGVjdG9yc1xuICogaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvdHJlZS9tYXN0ZXIvcGFja2FnZXMvbWluaW1vbmdvXG4gKlxuICogYnJvd3NlcmlmeSBzcmMvIC0tc3RhbmRhbG9uZSBzdG9yYWdlID4gc3RvcmFnZS5qcyAtZFxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBDb2xsZWN0aW9uID0gcmVxdWlyZSgnLi9jb2xsZWN0aW9uJylcbiAgLCBTY2hlbWEgPSByZXF1aXJlKCcuL3NjaGVtYScpXG4gICwgU2NoZW1hVHlwZSA9IHJlcXVpcmUoJy4vc2NoZW1hdHlwZScpXG4gICwgVmlydHVhbFR5cGUgPSByZXF1aXJlKCcuL3ZpcnR1YWx0eXBlJylcbiAgLCBUeXBlcyA9IHJlcXVpcmUoJy4vdHlwZXMnKVxuICAsIERvY3VtZW50ID0gcmVxdWlyZSgnLi9kb2N1bWVudCcpXG4gICwgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cblxuLyoqXG4gKiBTdG9yYWdlIGNvbnN0cnVjdG9yLlxuICpcbiAqIFRoZSBleHBvcnRzIG9iamVjdCBvZiB0aGUgYHN0b3JhZ2VgIG1vZHVsZSBpcyBhbiBpbnN0YW5jZSBvZiB0aGlzIGNsYXNzLlxuICogTW9zdCBhcHBzIHdpbGwgb25seSB1c2UgdGhpcyBvbmUgaW5zdGFuY2UuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuZnVuY3Rpb24gU3RvcmFnZSAoKSB7XG4gIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG59XG5cbi8qKlxuICog0KHQvtC30LTQsNGC0Ywg0LrQvtC70LvQtdC60YbQuNGOINC4INC/0L7Qu9GD0YfQuNGC0Ywg0LXRkS5cbiAqXG4gKiBAZXhhbXBsZVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lXG4gKiBAcGFyYW0ge3N0b3JhZ2UuU2NoZW1hfHVuZGVmaW5lZH0gc2NoZW1hXG4gKiBAcGFyYW0ge09iamVjdH0gW2FwaV0gLSDRgdGB0YvQu9C60LAg0L3QsCDQsNC/0Lgg0YDQtdGB0YPRgNGBXG4gKiBAcmV0dXJucyB7Q29sbGVjdGlvbnx1bmRlZmluZWR9XG4gKi9cblN0b3JhZ2UucHJvdG90eXBlLmNyZWF0ZUNvbGxlY3Rpb24gPSBmdW5jdGlvbiggbmFtZSwgc2NoZW1hLCBhcGkgKXtcbiAgaWYgKCB0aGlzWyBuYW1lIF0gKXtcbiAgICBjb25zb2xlLmluZm8oJ3N0b3JhZ2U6OmNvbGxlY3Rpb246IGAnICsgbmFtZSArICdgIGFscmVhZHkgZXhpc3QnKTtcbiAgICByZXR1cm4gdGhpc1sgbmFtZSBdO1xuICB9XG5cbiAgaWYgKCAnU2NoZW1hJyAhPT0gc2NoZW1hLmNvbnN0cnVjdG9yLm5hbWUgKXtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdgc2NoZW1hYCBtdXN0IGJlIFNjaGVtYSBpbnN0YW5jZScpO1xuICB9XG5cbiAgdGhpcy5jb2xsZWN0aW9uTmFtZXMucHVzaCggbmFtZSApO1xuXG4gIHJldHVybiB0aGlzWyBuYW1lIF0gPSBuZXcgQ29sbGVjdGlvbiggbmFtZSwgc2NoZW1hLCBhcGkgKTtcbn07XG5cbi8qKlxuICog0J/QvtC70YPRh9C40YLRjCDQvdCw0LfQstCw0L3QuNC1INC60L7Qu9C70LXQutGG0LjQuSDQsiDQstC40LTQtSDQvNCw0YHRgdC40LLQsCDRgdGC0YDQvtC6LlxuICpcbiAqIEByZXR1cm5zIHtBcnJheS48c3RyaW5nPn0gQW4gYXJyYXkgY29udGFpbmluZyBhbGwgY29sbGVjdGlvbnMgaW4gdGhlIHN0b3JhZ2UuXG4gKi9cblN0b3JhZ2UucHJvdG90eXBlLmdldENvbGxlY3Rpb25OYW1lcyA9IGZ1bmN0aW9uKCl7XG4gIHJldHVybiB0aGlzLmNvbGxlY3Rpb25OYW1lcztcbn07XG5cbi8qKlxuICogVGhlIE1vbmdvb3NlIENvbGxlY3Rpb24gY29uc3RydWN0b3JcbiAqXG4gKiBAbWV0aG9kIENvbGxlY3Rpb25cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuU3RvcmFnZS5wcm90b3R5cGUuQ29sbGVjdGlvbiA9IENvbGxlY3Rpb247XG5cbi8qKlxuICogVGhlIFN0b3JhZ2UgdmVyc2lvblxuICpcbiAqIEBwcm9wZXJ0eSB2ZXJzaW9uXG4gKiBAYXBpIHB1YmxpY1xuICovXG4vL3RvZG86XG4vL1N0b3JhZ2UucHJvdG90eXBlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuLyoqXG4gKiBUaGUgU3RvcmFnZSBbU2NoZW1hXSgjc2NoZW1hX1NjaGVtYSkgY29uc3RydWN0b3JcbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIG1vbmdvb3NlID0gcmVxdWlyZSgnbW9uZ29vc2UnKTtcbiAqICAgICB2YXIgU2NoZW1hID0gbW9uZ29vc2UuU2NoZW1hO1xuICogICAgIHZhciBDYXRTY2hlbWEgPSBuZXcgU2NoZW1hKC4uKTtcbiAqXG4gKiBAbWV0aG9kIFNjaGVtYVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5TdG9yYWdlLnByb3RvdHlwZS5TY2hlbWEgPSBTY2hlbWE7XG5cbi8qKlxuICogVGhlIE1vbmdvb3NlIFtTY2hlbWFUeXBlXSgjc2NoZW1hdHlwZV9TY2hlbWFUeXBlKSBjb25zdHJ1Y3RvclxuICpcbiAqIEBtZXRob2QgU2NoZW1hVHlwZVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5TdG9yYWdlLnByb3RvdHlwZS5TY2hlbWFUeXBlID0gU2NoZW1hVHlwZTtcblxuLyoqXG4gKiBUaGUgdmFyaW91cyBNb25nb29zZSBTY2hlbWFUeXBlcy5cbiAqXG4gKiAjIyMjTm90ZTpcbiAqXG4gKiBfQWxpYXMgb2YgbW9uZ29vc2UuU2NoZW1hLlR5cGVzIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eS5fXG4gKlxuICogQHByb3BlcnR5IFNjaGVtYVR5cGVzXG4gKiBAc2VlIFNjaGVtYS5TY2hlbWFUeXBlcyAjc2NoZW1hX1NjaGVtYS5UeXBlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5TdG9yYWdlLnByb3RvdHlwZS5TY2hlbWFUeXBlcyA9IFNjaGVtYS5UeXBlcztcblxuLyoqXG4gKiBUaGUgTW9uZ29vc2UgW1ZpcnR1YWxUeXBlXSgjdmlydHVhbHR5cGVfVmlydHVhbFR5cGUpIGNvbnN0cnVjdG9yXG4gKlxuICogQG1ldGhvZCBWaXJ0dWFsVHlwZVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5TdG9yYWdlLnByb3RvdHlwZS5WaXJ0dWFsVHlwZSA9IFZpcnR1YWxUeXBlO1xuXG4vKipcbiAqIFRoZSB2YXJpb3VzIE1vbmdvb3NlIFR5cGVzLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgbW9uZ29vc2UgPSByZXF1aXJlKCdtb25nb29zZScpO1xuICogICAgIHZhciBhcnJheSA9IG1vbmdvb3NlLlR5cGVzLkFycmF5O1xuICpcbiAqICMjIyNUeXBlczpcbiAqXG4gKiAtIFtPYmplY3RJZF0oI3R5cGVzLW9iamVjdGlkLWpzKVxuICogLSBbU3ViRG9jdW1lbnRdKCN0eXBlcy1lbWJlZGRlZC1qcylcbiAqIC0gW0FycmF5XSgjdHlwZXMtYXJyYXktanMpXG4gKiAtIFtEb2N1bWVudEFycmF5XSgjdHlwZXMtZG9jdW1lbnRhcnJheS1qcylcbiAqXG4gKiBVc2luZyB0aGlzIGV4cG9zZWQgYWNjZXNzIHRvIHRoZSBgT2JqZWN0SWRgIHR5cGUsIHdlIGNhbiBjb25zdHJ1Y3QgaWRzIG9uIGRlbWFuZC5cbiAqXG4gKiAgICAgdmFyIE9iamVjdElkID0gbW9uZ29vc2UuVHlwZXMuT2JqZWN0SWQ7XG4gKiAgICAgdmFyIGlkMSA9IG5ldyBPYmplY3RJZDtcbiAqXG4gKiBAcHJvcGVydHkgVHlwZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuU3RvcmFnZS5wcm90b3R5cGUuVHlwZXMgPSBUeXBlcztcblxuLyoqXG4gKiBUaGUgTW9uZ29vc2UgW0RvY3VtZW50XSgjZG9jdW1lbnQtanMpIGNvbnN0cnVjdG9yLlxuICpcbiAqIEBtZXRob2QgRG9jdW1lbnRcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuU3RvcmFnZS5wcm90b3R5cGUuRG9jdW1lbnQgPSBEb2N1bWVudDtcblxuLyoqXG4gKiBUaGUgW01vbmdvb3NlRXJyb3JdKCNlcnJvcl9Nb25nb29zZUVycm9yKSBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBAbWV0aG9kIEVycm9yXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cblN0b3JhZ2UucHJvdG90eXBlLkVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpO1xuXG5cblxuU3RvcmFnZS5wcm90b3R5cGUuU3RhdGVNYWNoaW5lID0gcmVxdWlyZSgnLi9zdGF0ZW1hY2hpbmUnKTtcblN0b3JhZ2UucHJvdG90eXBlLnV0aWxzID0gdXRpbHM7XG5TdG9yYWdlLnByb3RvdHlwZS5PYmplY3RJZCA9IFR5cGVzLk9iamVjdElkO1xuU3RvcmFnZS5wcm90b3R5cGUuc2NoZW1hcyA9IFNjaGVtYS5zY2hlbWFzO1xuXG4vKlxuICogR2VuZXJhdGUgYSByYW5kb20gdXVpZC5cbiAqIGh0dHA6Ly93d3cuYnJvb2ZhLmNvbS9Ub29scy9NYXRoLnV1aWQuaHRtXG4gKiBmb3JrIE1hdGgudXVpZC5qcyAodjEuNClcbiAqXG4gKiBodHRwOi8vd3d3LmJyb29mYS5jb20vMjAwOC8wOS9qYXZhc2NyaXB0LXV1aWQtZnVuY3Rpb24vXG4gKi9cbi8qdXVpZDoge1xuICAvLyBQcml2YXRlIGFycmF5IG9mIGNoYXJzIHRvIHVzZVxuICBDSEFSUzogJzAxMjM0NTY3ODlBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6Jy5zcGxpdCgnJyksXG5cbiAgLy8gcmV0dXJucyBSRkM0MTIyLCB2ZXJzaW9uIDQgSURcbiAgZ2VuZXJhdGU6IGZ1bmN0aW9uKCl7XG4gICAgdmFyIGNoYXJzID0gdGhpcy5DSEFSUywgdXVpZCA9IG5ldyBBcnJheSggMzYgKSwgcm5kID0gMCwgcjtcbiAgICBmb3IgKCB2YXIgaSA9IDA7IGkgPCAzNjsgaSsrICkge1xuICAgICAgaWYgKCBpID09IDggfHwgaSA9PSAxMyB8fCBpID09IDE4IHx8IGkgPT0gMjMgKSB7XG4gICAgICAgIHV1aWRbaV0gPSAnLSc7XG4gICAgICB9IGVsc2UgaWYgKCBpID09IDE0ICkge1xuICAgICAgICB1dWlkW2ldID0gJzQnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCBybmQgPD0gMHgwMiApIHJuZCA9IDB4MjAwMDAwMCArIChNYXRoLnJhbmRvbSgpICogMHgxMDAwMDAwKSB8IDA7XG4gICAgICAgIHIgPSBybmQgJiAweGY7XG4gICAgICAgIHJuZCA9IHJuZCA+PiA0O1xuICAgICAgICB1dWlkW2ldID0gY2hhcnNbKGkgPT0gMTkpID8gKHIgJiAweDMpIHwgMHg4IDogcl07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1dWlkLmpvaW4oJycpLnRvTG93ZXJDYXNlKCk7XG4gIH1cbn0qL1xuXG5cbi8qIVxuICogVGhlIGV4cG9ydHMgb2JqZWN0IGlzIGFuIGluc3RhbmNlIG9mIFN0b3JhZ2UuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBTdG9yYWdlO1xuIiwiLy8g0JzQsNGI0LjQvdCwINGB0L7RgdGC0L7Rj9C90LjQuSDQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8g0LTQu9GPINC/0L7QvNC10YLQutC4LCDQsiDQutCw0LrQvtC8INGB0L7RgdGC0L7Rj9C90LjQuCDQvdCw0YXQvtC00Y/RgtGB0Y8g0L/QvtC70LVcbi8vINCd0LDQv9GA0LjQvNC10YA6INC10YHQu9C4INC/0L7Qu9C1INC40LzQtdC10YIg0YHQvtGB0YLQvtGP0L3QuNC1IGRlZmF1bHQgLSDQt9C90LDRh9C40YIg0LXQs9C+INC30L3QsNGH0LXQvdC40LXQvCDRj9Cy0LvRj9C10YLRgdGPINC30L3QsNGH0LXQvdC40LUg0L/QviDRg9C80L7Qu9GH0LDQvdC40Y5cbi8vINCf0YDQuNC80LXRh9Cw0L3QuNC1OiDQtNC70Y8g0LzQsNGB0YHQuNCy0L7QsiDQsiDQvtCx0YnQtdC8INGB0LvRg9GH0LDQtSDRjdGC0L4g0L7Qt9C90LDRh9Cw0LXRgiDQv9GD0YHRgtC+0Lkg0LzQsNGB0YHQuNCyXG5cbi8qIVxuICogRGVwZW5kZW5jaWVzXG4gKi9cblxudmFyIFN0YXRlTWFjaGluZSA9IHJlcXVpcmUoJy4vc3RhdGVtYWNoaW5lJyk7XG5cbnZhciBBY3RpdmVSb3N0ZXIgPSBTdGF0ZU1hY2hpbmUuY3RvcigncmVxdWlyZScsICdtb2RpZnknLCAnaW5pdCcsICdkZWZhdWx0Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gSW50ZXJuYWxDYWNoZTtcblxuZnVuY3Rpb24gSW50ZXJuYWxDYWNoZSAoKSB7XG4gIHRoaXMuc3RyaWN0TW9kZSA9IHVuZGVmaW5lZDtcbiAgdGhpcy5zZWxlY3RlZCA9IHVuZGVmaW5lZDtcbiAgdGhpcy5zYXZlRXJyb3IgPSB1bmRlZmluZWQ7XG4gIHRoaXMudmFsaWRhdGlvbkVycm9yID0gdW5kZWZpbmVkO1xuICB0aGlzLmFkaG9jUGF0aHMgPSB1bmRlZmluZWQ7XG4gIHRoaXMucmVtb3ZpbmcgPSB1bmRlZmluZWQ7XG4gIHRoaXMuaW5zZXJ0aW5nID0gdW5kZWZpbmVkO1xuICB0aGlzLnZlcnNpb24gPSB1bmRlZmluZWQ7XG4gIHRoaXMuZ2V0dGVycyA9IHt9O1xuICB0aGlzLl9pZCA9IHVuZGVmaW5lZDtcbiAgdGhpcy5wb3B1bGF0ZSA9IHVuZGVmaW5lZDsgLy8gd2hhdCB3ZSB3YW50IHRvIHBvcHVsYXRlIGluIHRoaXMgZG9jXG4gIHRoaXMucG9wdWxhdGVkID0gdW5kZWZpbmVkOy8vIHRoZSBfaWRzIHRoYXQgaGF2ZSBiZWVuIHBvcHVsYXRlZFxuICB0aGlzLndhc1BvcHVsYXRlZCA9IGZhbHNlOyAvLyBpZiB0aGlzIGRvYyB3YXMgdGhlIHJlc3VsdCBvZiBhIHBvcHVsYXRpb25cbiAgdGhpcy5zY29wZSA9IHVuZGVmaW5lZDtcbiAgdGhpcy5hY3RpdmVQYXRocyA9IG5ldyBBY3RpdmVSb3N0ZXI7XG5cbiAgLy8gZW1iZWRkZWQgZG9jc1xuICB0aGlzLm93bmVyRG9jdW1lbnQgPSB1bmRlZmluZWQ7XG4gIHRoaXMuZnVsbFBhdGggPSB1bmRlZmluZWQ7XG59XG4iLCIvKipcbiAqIFJldHVybnMgdGhlIHZhbHVlIG9mIG9iamVjdCBgb2AgYXQgdGhlIGdpdmVuIGBwYXRoYC5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIG9iaiA9IHtcbiAqICAgICAgICAgY29tbWVudHM6IFtcbiAqICAgICAgICAgICAgIHsgdGl0bGU6ICdleGNpdGluZyEnLCBfZG9jOiB7IHRpdGxlOiAnZ3JlYXQhJyB9fVxuICogICAgICAgICAgICwgeyB0aXRsZTogJ251bWJlciBkb3MnIH1cbiAqICAgICAgICAgXVxuICogICAgIH1cbiAqXG4gKiAgICAgbXBhdGguZ2V0KCdjb21tZW50cy4wLnRpdGxlJywgbykgICAgICAgICAvLyAnZXhjaXRpbmchJ1xuICogICAgIG1wYXRoLmdldCgnY29tbWVudHMuMC50aXRsZScsIG8sICdfZG9jJykgLy8gJ2dyZWF0ISdcbiAqICAgICBtcGF0aC5nZXQoJ2NvbW1lbnRzLnRpdGxlJywgbykgICAgICAgICAgIC8vIFsnZXhjaXRpbmchJywgJ251bWJlciBkb3MnXVxuICpcbiAqICAgICAvLyBzdW1tYXJ5XG4gKiAgICAgbXBhdGguZ2V0KHBhdGgsIG8pXG4gKiAgICAgbXBhdGguZ2V0KHBhdGgsIG8sIHNwZWNpYWwpXG4gKiAgICAgbXBhdGguZ2V0KHBhdGgsIG8sIG1hcClcbiAqICAgICBtcGF0aC5nZXQocGF0aCwgbywgc3BlY2lhbCwgbWFwKVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge09iamVjdH0gb1xuICogQHBhcmFtIHtTdHJpbmd9IFtzcGVjaWFsXSBXaGVuIHRoaXMgcHJvcGVydHkgbmFtZSBpcyBwcmVzZW50IG9uIGFueSBvYmplY3QgaW4gdGhlIHBhdGgsIHdhbGtpbmcgd2lsbCBjb250aW51ZSBvbiB0aGUgdmFsdWUgb2YgdGhpcyBwcm9wZXJ0eS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFttYXBdIE9wdGlvbmFsIGZ1bmN0aW9uIHdoaWNoIHJlY2VpdmVzIGVhY2ggaW5kaXZpZHVhbCBmb3VuZCB2YWx1ZS4gVGhlIHZhbHVlIHJldHVybmVkIGZyb20gYG1hcGAgaXMgdXNlZCBpbiB0aGUgb3JpZ2luYWwgdmFsdWVzIHBsYWNlLlxuICovXG5cbmV4cG9ydHMuZ2V0ID0gZnVuY3Rpb24gKHBhdGgsIG8sIHNwZWNpYWwsIG1hcCkge1xuICB2YXIgbG9va3VwO1xuXG4gIGlmICgnZnVuY3Rpb24nID09IHR5cGVvZiBzcGVjaWFsKSB7XG4gICAgaWYgKHNwZWNpYWwubGVuZ3RoIDwgMikge1xuICAgICAgbWFwID0gc3BlY2lhbDtcbiAgICAgIHNwZWNpYWwgPSB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvb2t1cCA9IHNwZWNpYWw7XG4gICAgICBzcGVjaWFsID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuXG4gIG1hcCB8fCAobWFwID0gSyk7XG5cbiAgdmFyIHBhcnRzID0gJ3N0cmluZycgPT0gdHlwZW9mIHBhdGhcbiAgICA/IHBhdGguc3BsaXQoJy4nKVxuICAgIDogcGF0aDtcblxuICBpZiAoIUFycmF5LmlzQXJyYXkocGFydHMpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBgcGF0aGAuIE11c3QgYmUgZWl0aGVyIHN0cmluZyBvciBhcnJheScpO1xuICB9XG5cbiAgdmFyIG9iaiA9IG9cbiAgICAsIHBhcnQ7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7ICsraSkge1xuICAgIHBhcnQgPSBwYXJ0c1tpXTtcblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iaikgJiYgIS9eXFxkKyQvLnRlc3QocGFydCkpIHtcbiAgICAgIC8vIHJlYWRpbmcgYSBwcm9wZXJ0eSBmcm9tIHRoZSBhcnJheSBpdGVtc1xuICAgICAgdmFyIHBhdGhzID0gcGFydHMuc2xpY2UoaSk7XG5cbiAgICAgIHJldHVybiBvYmoubWFwKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtXG4gICAgICAgICAgPyBleHBvcnRzLmdldChwYXRocywgaXRlbSwgc3BlY2lhbCB8fCBsb29rdXAsIG1hcClcbiAgICAgICAgICA6IG1hcCh1bmRlZmluZWQpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKGxvb2t1cCkge1xuICAgICAgb2JqID0gbG9va3VwKG9iaiwgcGFydCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9iaiA9IHNwZWNpYWwgJiYgb2JqW3NwZWNpYWxdXG4gICAgICAgID8gb2JqW3NwZWNpYWxdW3BhcnRdXG4gICAgICAgIDogb2JqW3BhcnRdO1xuICAgIH1cblxuICAgIGlmICghb2JqKSByZXR1cm4gbWFwKG9iaik7XG4gIH1cblxuICByZXR1cm4gbWFwKG9iaik7XG59XG5cbi8qKlxuICogU2V0cyB0aGUgYHZhbGAgYXQgdGhlIGdpdmVuIGBwYXRoYCBvZiBvYmplY3QgYG9gLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge0FueXRoaW5nfSB2YWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvXG4gKiBAcGFyYW0ge1N0cmluZ30gW3NwZWNpYWxdIFdoZW4gdGhpcyBwcm9wZXJ0eSBuYW1lIGlzIHByZXNlbnQgb24gYW55IG9iamVjdCBpbiB0aGUgcGF0aCwgd2Fsa2luZyB3aWxsIGNvbnRpbnVlIG9uIHRoZSB2YWx1ZSBvZiB0aGlzIHByb3BlcnR5LlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW21hcF0gT3B0aW9uYWwgZnVuY3Rpb24gd2hpY2ggaXMgcGFzc2VkIGVhY2ggaW5kaXZpZHVhbCB2YWx1ZSBiZWZvcmUgc2V0dGluZyBpdC4gVGhlIHZhbHVlIHJldHVybmVkIGZyb20gYG1hcGAgaXMgdXNlZCBpbiB0aGUgb3JpZ2luYWwgdmFsdWVzIHBsYWNlLlxuICovXG5cbmV4cG9ydHMuc2V0ID0gZnVuY3Rpb24gKHBhdGgsIHZhbCwgbywgc3BlY2lhbCwgbWFwLCBfY29weWluZykge1xuICB2YXIgbG9va3VwO1xuXG4gIGlmICgnZnVuY3Rpb24nID09IHR5cGVvZiBzcGVjaWFsKSB7XG4gICAgaWYgKHNwZWNpYWwubGVuZ3RoIDwgMikge1xuICAgICAgbWFwID0gc3BlY2lhbDtcbiAgICAgIHNwZWNpYWwgPSB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvb2t1cCA9IHNwZWNpYWw7XG4gICAgICBzcGVjaWFsID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuXG4gIG1hcCB8fCAobWFwID0gSyk7XG5cbiAgdmFyIHBhcnRzID0gJ3N0cmluZycgPT0gdHlwZW9mIHBhdGhcbiAgICA/IHBhdGguc3BsaXQoJy4nKVxuICAgIDogcGF0aDtcblxuICBpZiAoIUFycmF5LmlzQXJyYXkocGFydHMpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBgcGF0aGAuIE11c3QgYmUgZWl0aGVyIHN0cmluZyBvciBhcnJheScpO1xuICB9XG5cbiAgaWYgKG51bGwgPT0gbykgcmV0dXJuO1xuXG4gIC8vIHRoZSBleGlzdGFuY2Ugb2YgJCBpbiBhIHBhdGggdGVsbHMgdXMgaWYgdGhlIHVzZXIgZGVzaXJlc1xuICAvLyB0aGUgY29weWluZyBvZiBhbiBhcnJheSBpbnN0ZWFkIG9mIHNldHRpbmcgZWFjaCB2YWx1ZSBvZlxuICAvLyB0aGUgYXJyYXkgdG8gdGhlIG9uZSBieSBvbmUgdG8gbWF0Y2hpbmcgcG9zaXRpb25zIG9mIHRoZVxuICAvLyBjdXJyZW50IGFycmF5LlxuICB2YXIgY29weSA9IF9jb3B5aW5nIHx8IC9cXCQvLnRlc3QocGF0aClcbiAgICAsIG9iaiA9IG9cbiAgICAsIHBhcnRcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gcGFydHMubGVuZ3RoIC0gMTsgaSA8IGxlbjsgKytpKSB7XG4gICAgcGFydCA9IHBhcnRzW2ldO1xuXG4gICAgaWYgKCckJyA9PSBwYXJ0KSB7XG4gICAgICBpZiAoaSA9PSBsZW4gLSAxKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSAmJiAhL15cXGQrJC8udGVzdChwYXJ0KSkge1xuICAgICAgdmFyIHBhdGhzID0gcGFydHMuc2xpY2UoaSk7XG4gICAgICBpZiAoIWNvcHkgJiYgQXJyYXkuaXNBcnJheSh2YWwpKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgb2JqLmxlbmd0aCAmJiBqIDwgdmFsLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgLy8gYXNzaWdubWVudCBvZiBzaW5nbGUgdmFsdWVzIG9mIGFycmF5XG4gICAgICAgICAgZXhwb3J0cy5zZXQocGF0aHMsIHZhbFtqXSwgb2JqW2pdLCBzcGVjaWFsIHx8IGxvb2t1cCwgbWFwLCBjb3B5KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBvYmoubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICAvLyBhc3NpZ25tZW50IG9mIGVudGlyZSB2YWx1ZVxuICAgICAgICAgIGV4cG9ydHMuc2V0KHBhdGhzLCB2YWwsIG9ialtqXSwgc3BlY2lhbCB8fCBsb29rdXAsIG1hcCwgY29weSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobG9va3VwKSB7XG4gICAgICBvYmogPSBsb29rdXAob2JqLCBwYXJ0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqID0gc3BlY2lhbCAmJiBvYmpbc3BlY2lhbF1cbiAgICAgICAgPyBvYmpbc3BlY2lhbF1bcGFydF1cbiAgICAgICAgOiBvYmpbcGFydF07XG4gICAgfVxuXG4gICAgaWYgKCFvYmopIHJldHVybjtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgdGhlIGxhc3QgcHJvcGVydHkgb2YgdGhlIHBhdGhcblxuICBwYXJ0ID0gcGFydHNbbGVuXTtcblxuICAvLyB1c2UgdGhlIHNwZWNpYWwgcHJvcGVydHkgaWYgZXhpc3RzXG4gIGlmIChzcGVjaWFsICYmIG9ialtzcGVjaWFsXSkge1xuICAgIG9iaiA9IG9ialtzcGVjaWFsXTtcbiAgfVxuXG4gIC8vIHNldCB0aGUgdmFsdWUgb24gdGhlIGxhc3QgYnJhbmNoXG4gIGlmIChBcnJheS5pc0FycmF5KG9iaikgJiYgIS9eXFxkKyQvLnRlc3QocGFydCkpIHtcbiAgICBpZiAoIWNvcHkgJiYgQXJyYXkuaXNBcnJheSh2YWwpKSB7XG4gICAgICBmb3IgKHZhciBpdGVtLCBqID0gMDsgaiA8IG9iai5sZW5ndGggJiYgaiA8IHZhbC5sZW5ndGg7ICsraikge1xuICAgICAgICBpdGVtID0gb2JqW2pdO1xuICAgICAgICBpZiAoaXRlbSkge1xuICAgICAgICAgIGlmIChsb29rdXApIHtcbiAgICAgICAgICAgIGxvb2t1cChpdGVtLCBwYXJ0LCBtYXAodmFsW2pdKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChpdGVtW3NwZWNpYWxdKSBpdGVtID0gaXRlbVtzcGVjaWFsXTtcbiAgICAgICAgICAgIGl0ZW1bcGFydF0gPSBtYXAodmFsW2pdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBvYmoubGVuZ3RoOyArK2opIHtcbiAgICAgICAgaXRlbSA9IG9ialtqXTtcbiAgICAgICAgaWYgKGl0ZW0pIHtcbiAgICAgICAgICBpZiAobG9va3VwKSB7XG4gICAgICAgICAgICBsb29rdXAoaXRlbSwgcGFydCwgbWFwKHZhbCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaXRlbVtzcGVjaWFsXSkgaXRlbSA9IGl0ZW1bc3BlY2lhbF07XG4gICAgICAgICAgICBpdGVtW3BhcnRdID0gbWFwKHZhbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChsb29rdXApIHtcbiAgICAgIGxvb2t1cChvYmosIHBhcnQsIG1hcCh2YWwpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqW3BhcnRdID0gbWFwKHZhbCk7XG4gICAgfVxuICB9XG59XG5cbi8qIVxuICogUmV0dXJucyB0aGUgdmFsdWUgcGFzc2VkIHRvIGl0LlxuICovXG5cbmZ1bmN0aW9uIEsgKHYpIHtcbiAgcmV0dXJuIHY7XG59IiwiLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBFdmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cycpXG4gICwgVmlydHVhbFR5cGUgPSByZXF1aXJlKCcuL3ZpcnR1YWx0eXBlJylcbiAgLCB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKVxuICAsIFR5cGVzXG4gICwgc2NoZW1hcztcblxuLyoqXG4gKiBTY2hlbWEgY29uc3RydWN0b3IuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIHZhciBjaGlsZCA9IG5ldyBTY2hlbWEoeyBuYW1lOiBTdHJpbmcgfSk7XG4gKiAgICAgdmFyIHNjaGVtYSA9IG5ldyBTY2hlbWEoeyBuYW1lOiBTdHJpbmcsIGFnZTogTnVtYmVyLCBjaGlsZHJlbjogW2NoaWxkXSB9KTtcbiAqICAgICB2YXIgVHJlZSA9IG1vbmdvb3NlLm1vZGVsKCdUcmVlJywgc2NoZW1hKTtcbiAqXG4gKiAgICAgLy8gc2V0dGluZyBzY2hlbWEgb3B0aW9uc1xuICogICAgIG5ldyBTY2hlbWEoeyBuYW1lOiBTdHJpbmcgfSwgeyBfaWQ6IGZhbHNlLCBhdXRvSW5kZXg6IGZhbHNlIH0pXG4gKlxuICogIyMjI09wdGlvbnM6XG4gKlxuICogLSBbY29sbGVjdGlvbl0oL2RvY3MvZ3VpZGUuaHRtbCNjb2xsZWN0aW9uKTogc3RyaW5nIC0gbm8gZGVmYXVsdFxuICogLSBbaWRdKC9kb2NzL2d1aWRlLmh0bWwjaWQpOiBib29sIC0gZGVmYXVsdHMgdG8gdHJ1ZVxuICogLSBgbWluaW1pemVgOiBib29sIC0gY29udHJvbHMgW2RvY3VtZW50I3RvT2JqZWN0XSgjZG9jdW1lbnRfRG9jdW1lbnQtdG9PYmplY3QpIGJlaGF2aW9yIHdoZW4gY2FsbGVkIG1hbnVhbGx5IC0gZGVmYXVsdHMgdG8gdHJ1ZVxuICogLSBbc3RyaWN0XSgvZG9jcy9ndWlkZS5odG1sI3N0cmljdCk6IGJvb2wgLSBkZWZhdWx0cyB0byB0cnVlXG4gKiAtIFt0b0pTT05dKC9kb2NzL2d1aWRlLmh0bWwjdG9KU09OKSAtIG9iamVjdCAtIG5vIGRlZmF1bHRcbiAqIC0gW3RvT2JqZWN0XSgvZG9jcy9ndWlkZS5odG1sI3RvT2JqZWN0KSAtIG9iamVjdCAtIG5vIGRlZmF1bHRcbiAqIC0gW3ZlcnNpb25LZXldKC9kb2NzL2d1aWRlLmh0bWwjdmVyc2lvbktleSk6IGJvb2wgLSBkZWZhdWx0cyB0byBcIl9fdlwiXG4gKlxuICogIyMjI05vdGU6XG4gKlxuICogX1doZW4gbmVzdGluZyBzY2hlbWFzLCAoYGNoaWxkcmVuYCBpbiB0aGUgZXhhbXBsZSBhYm92ZSksIGFsd2F5cyBkZWNsYXJlIHRoZSBjaGlsZCBzY2hlbWEgZmlyc3QgYmVmb3JlIHBhc3NpbmcgaXQgaW50byBpcyBwYXJlbnQuX1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfHVuZGVmaW5lZH0gW25hbWVdINCd0LDQt9Cy0LDQvdC40LUg0YHRhdC10LzRi1xuICogQHBhcmFtIHtTY2hlbWF9IFtiYXNlU2NoZW1hXSDQkdCw0LfQvtCy0LDRjyDRgdGF0LXQvNCwINC/0YDQuCDQvdCw0YHQu9C10LTQvtCy0LDQvdC40LhcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmog0KHRhdC10LzQsFxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQGFwaSBwdWJsaWNcbiAqL1xuZnVuY3Rpb24gU2NoZW1hICggbmFtZSwgYmFzZVNjaGVtYSwgb2JqLCBvcHRpb25zICkge1xuICBpZiAoICEodGhpcyBpbnN0YW5jZW9mIFNjaGVtYSkgKVxuICAgIHJldHVybiBuZXcgU2NoZW1hKCBuYW1lLCBiYXNlU2NoZW1hLCBvYmosIG9wdGlvbnMgKTtcblxuICAvLyDQldGB0LvQuCDRjdGC0L4g0LjQvNC10L3QvtCy0LDQvdCw0Y8g0YHRhdC10LzQsFxuICBpZiAoIHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJyApe1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgc2NoZW1hc1sgbmFtZSBdID0gdGhpcztcbiAgfSBlbHNlIHtcbiAgICBvcHRpb25zID0gb2JqO1xuICAgIG9iaiA9IGJhc2VTY2hlbWE7XG4gICAgYmFzZVNjaGVtYSA9IG5hbWU7XG4gICAgbmFtZSA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGlmICggIShiYXNlU2NoZW1hIGluc3RhbmNlb2YgU2NoZW1hKSApe1xuICAgIG9wdGlvbnMgPSBvYmo7XG4gICAgb2JqID0gYmFzZVNjaGVtYTtcbiAgICBiYXNlU2NoZW1hID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgLy8g0KHQvtGF0YDQsNC90LjQvCDQvtC/0LjRgdCw0L3QuNC1INGB0YXQtdC80Ysg0LTQu9GPINC/0L7QtNC00LXRgNC20LrQuCDQtNC40YHQutGA0LjQvNC40L3QsNGC0L7RgNC+0LJcbiAgdGhpcy5zb3VyY2UgPSBvYmo7XG5cbiAgdGhpcy5wYXRocyA9IHt9O1xuICB0aGlzLnN1YnBhdGhzID0ge307XG4gIHRoaXMudmlydHVhbHMgPSB7fTtcbiAgdGhpcy5uZXN0ZWQgPSB7fTtcbiAgdGhpcy5pbmhlcml0cyA9IHt9O1xuICB0aGlzLmNhbGxRdWV1ZSA9IFtdO1xuICB0aGlzLm1ldGhvZHMgPSB7fTtcbiAgdGhpcy5zdGF0aWNzID0ge307XG4gIHRoaXMudHJlZSA9IHt9O1xuICB0aGlzLl9yZXF1aXJlZHBhdGhzID0gdW5kZWZpbmVkO1xuICB0aGlzLmRpc2NyaW1pbmF0b3JNYXBwaW5nID0gdW5kZWZpbmVkO1xuXG4gIHRoaXMub3B0aW9ucyA9IHRoaXMuZGVmYXVsdE9wdGlvbnMoIG9wdGlvbnMgKTtcblxuICBpZiAoIGJhc2VTY2hlbWEgaW5zdGFuY2VvZiBTY2hlbWEgKXtcbiAgICBiYXNlU2NoZW1hLmRpc2NyaW1pbmF0b3IoIG5hbWUsIHRoaXMgKTtcblxuICAgIC8vdGhpcy5kaXNjcmltaW5hdG9yKCBuYW1lLCBiYXNlU2NoZW1hICk7XG4gIH1cblxuICAvLyBidWlsZCBwYXRoc1xuICBpZiAoIG9iaiApIHtcbiAgICB0aGlzLmFkZCggb2JqICk7XG4gIH1cblxuICAvLyBlbnN1cmUgdGhlIGRvY3VtZW50cyBnZXQgYW4gYXV0byBfaWQgdW5sZXNzIGRpc2FibGVkXG4gIHZhciBhdXRvX2lkID0gIXRoaXMucGF0aHNbJ19pZCddICYmICghdGhpcy5vcHRpb25zLm5vSWQgJiYgdGhpcy5vcHRpb25zLl9pZCk7XG4gIGlmIChhdXRvX2lkKSB7XG4gICAgdGhpcy5hZGQoeyBfaWQ6IHt0eXBlOiBTY2hlbWEuT2JqZWN0SWQsIGF1dG86IHRydWV9IH0pO1xuICB9XG5cbiAgLy8gZW5zdXJlIHRoZSBkb2N1bWVudHMgcmVjZWl2ZSBhbiBpZCBnZXR0ZXIgdW5sZXNzIGRpc2FibGVkXG4gIHZhciBhdXRvaWQgPSAhdGhpcy5wYXRoc1snaWQnXSAmJiB0aGlzLm9wdGlvbnMuaWQ7XG4gIGlmICggYXV0b2lkICkge1xuICAgIHRoaXMudmlydHVhbCgnaWQnKS5nZXQoIGlkR2V0dGVyICk7XG4gIH1cbn1cblxuLyohXG4gKiBSZXR1cm5zIHRoaXMgZG9jdW1lbnRzIF9pZCBjYXN0IHRvIGEgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBpZEdldHRlciAoKSB7XG4gIGlmICh0aGlzLiRfXy5faWQpIHtcbiAgICByZXR1cm4gdGhpcy4kX18uX2lkO1xuICB9XG5cbiAgcmV0dXJuIHRoaXMuJF9fLl9pZCA9IG51bGwgPT0gdGhpcy5faWRcbiAgICA/IG51bGxcbiAgICA6IFN0cmluZyh0aGlzLl9pZCk7XG59XG5cbi8qIVxuICogSW5oZXJpdCBmcm9tIEV2ZW50RW1pdHRlci5cbiAqL1xuXG5TY2hlbWEucHJvdG90eXBlLl9fcHJvdG9fXyA9IEV2ZW50cy5wcm90b3R5cGU7XG5cbi8qKlxuICogU2NoZW1hIGFzIGZsYXQgcGF0aHNcbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqICAgICB7XG4gKiAgICAgICAgICdfaWQnICAgICAgICA6IFNjaGVtYVR5cGUsXG4gKiAgICAgICAsICduZXN0ZWQua2V5JyA6IFNjaGVtYVR5cGUsXG4gKiAgICAgfVxuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICogQHByb3BlcnR5IHBhdGhzXG4gKi9cblNjaGVtYS5wcm90b3R5cGUucGF0aHM7XG5cbi8qKlxuICogU2NoZW1hIGFzIGEgdHJlZVxuICpcbiAqICMjIyNFeGFtcGxlOlxuICogICAgIHtcbiAqICAgICAgICAgJ19pZCcgICAgIDogT2JqZWN0SWRcbiAqICAgICAgICwgJ25lc3RlZCcgIDoge1xuICogICAgICAgICAgICAgJ2tleScgOiBTdHJpbmdcbiAqICAgICAgICAgfVxuICogICAgIH1cbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqIEBwcm9wZXJ0eSB0cmVlXG4gKi9cblNjaGVtYS5wcm90b3R5cGUudHJlZTtcblxuLyoqXG4gKiBSZXR1cm5zIGRlZmF1bHQgb3B0aW9ucyBmb3IgdGhpcyBzY2hlbWEsIG1lcmdlZCB3aXRoIGBvcHRpb25zYC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7T2JqZWN0fVxuICogQGFwaSBwcml2YXRlXG4gKi9cblNjaGVtYS5wcm90b3R5cGUuZGVmYXVsdE9wdGlvbnMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICBvcHRpb25zID0gJC5leHRlbmQoe1xuICAgICAgc3RyaWN0OiB0cnVlXG4gICAgLCB2ZXJzaW9uS2V5OiAnX192J1xuICAgICwgZGlzY3JpbWluYXRvcktleTogJ19fdCdcbiAgICAsIG1pbmltaXplOiB0cnVlXG4gICAgLy8gdGhlIGZvbGxvd2luZyBhcmUgb25seSBhcHBsaWVkIGF0IGNvbnN0cnVjdGlvbiB0aW1lXG4gICAgLCBfaWQ6IHRydWVcbiAgICAsIGlkOiB0cnVlXG4gIH0sIG9wdGlvbnMgKTtcblxuICByZXR1cm4gb3B0aW9ucztcbn07XG5cbi8qKlxuICogQWRkcyBrZXkgcGF0aCAvIHNjaGVtYSB0eXBlIHBhaXJzIHRvIHRoaXMgc2NoZW1hLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgVG95U2NoZW1hID0gbmV3IFNjaGVtYTtcbiAqICAgICBUb3lTY2hlbWEuYWRkKHsgbmFtZTogJ3N0cmluZycsIGNvbG9yOiAnc3RyaW5nJywgcHJpY2U6ICdudW1iZXInIH0pO1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwcmVmaXhcbiAqIEBhcGkgcHVibGljXG4gKi9cblNjaGVtYS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gYWRkICggb2JqLCBwcmVmaXggKSB7XG4gIHByZWZpeCA9IHByZWZpeCB8fCAnJztcbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyggb2JqICk7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIGtleSA9IGtleXNbaV07XG5cbiAgICBpZiAobnVsbCA9PSBvYmpbIGtleSBdKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIHZhbHVlIGZvciBzY2hlbWEgcGF0aCBgJysgcHJlZml4ICsga2V5ICsnYCcpO1xuICAgIH1cblxuICAgIGlmICggXy5pc1BsYWluT2JqZWN0KG9ialtrZXldIClcbiAgICAgICYmICggIW9ialsga2V5IF0uY29uc3RydWN0b3IgfHwgJ09iamVjdCcgPT0gb2JqWyBrZXkgXS5jb25zdHJ1Y3Rvci5uYW1lIClcbiAgICAgICYmICggIW9ialsga2V5IF0udHlwZSB8fCBvYmpbIGtleSBdLnR5cGUudHlwZSApICl7XG5cbiAgICAgIGlmICggT2JqZWN0LmtleXMob2JqWyBrZXkgXSkubGVuZ3RoICkge1xuICAgICAgICAvLyBuZXN0ZWQgb2JqZWN0IHsgbGFzdDogeyBuYW1lOiBTdHJpbmcgfX1cbiAgICAgICAgdGhpcy5uZXN0ZWRbIHByZWZpeCArIGtleSBdID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5hZGQoIG9ialsga2V5IF0sIHByZWZpeCArIGtleSArICcuJyk7XG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucGF0aCggcHJlZml4ICsga2V5LCBvYmpbIGtleSBdICk7IC8vIG1peGVkIHR5cGVcbiAgICAgIH1cblxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBhdGgoIHByZWZpeCArIGtleSwgb2JqWyBrZXkgXSApO1xuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiBSZXNlcnZlZCBkb2N1bWVudCBrZXlzLlxuICpcbiAqIEtleXMgaW4gdGhpcyBvYmplY3QgYXJlIG5hbWVzIHRoYXQgYXJlIHJlamVjdGVkIGluIHNjaGVtYSBkZWNsYXJhdGlvbnMgYi9jIHRoZXkgY29uZmxpY3Qgd2l0aCBtb25nb29zZSBmdW5jdGlvbmFsaXR5LiBVc2luZyB0aGVzZSBrZXkgbmFtZSB3aWxsIHRocm93IGFuIGVycm9yLlxuICpcbiAqICAgICAgb24sIGVtaXQsIF9ldmVudHMsIGRiLCBnZXQsIHNldCwgaW5pdCwgaXNOZXcsIGVycm9ycywgc2NoZW1hLCBvcHRpb25zLCBtb2RlbE5hbWUsIGNvbGxlY3Rpb24sIF9wcmVzLCBfcG9zdHMsIHRvT2JqZWN0XG4gKlxuICogX05PVEU6XyBVc2Ugb2YgdGhlc2UgdGVybXMgYXMgbWV0aG9kIG5hbWVzIGlzIHBlcm1pdHRlZCwgYnV0IHBsYXkgYXQgeW91ciBvd24gcmlzaywgYXMgdGhleSBtYXkgYmUgZXhpc3RpbmcgbW9uZ29vc2UgZG9jdW1lbnQgbWV0aG9kcyB5b3UgYXJlIHN0b21waW5nIG9uLlxuICpcbiAqICAgICAgdmFyIHNjaGVtYSA9IG5ldyBTY2hlbWEoLi4pO1xuICogICAgICBzY2hlbWEubWV0aG9kcy5pbml0ID0gZnVuY3Rpb24gKCkge30gLy8gcG90ZW50aWFsbHkgYnJlYWtpbmdcbiAqL1xuU2NoZW1hLnJlc2VydmVkID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xudmFyIHJlc2VydmVkID0gU2NoZW1hLnJlc2VydmVkO1xucmVzZXJ2ZWQub24gPVxucmVzZXJ2ZWQuZGIgPVxucmVzZXJ2ZWQuZ2V0ID1cbnJlc2VydmVkLnNldCA9XG5yZXNlcnZlZC5pbml0ID1cbnJlc2VydmVkLmlzTmV3ID1cbnJlc2VydmVkLmVycm9ycyA9XG5yZXNlcnZlZC5zY2hlbWEgPVxucmVzZXJ2ZWQub3B0aW9ucyA9XG5yZXNlcnZlZC5tb2RlbE5hbWUgPVxucmVzZXJ2ZWQuY29sbGVjdGlvbiA9XG5yZXNlcnZlZC50b09iamVjdCA9XG5yZXNlcnZlZC5kb21haW4gPVxucmVzZXJ2ZWQuZW1pdCA9ICAgIC8vIEV2ZW50RW1pdHRlclxucmVzZXJ2ZWQuX2V2ZW50cyA9IC8vIEV2ZW50RW1pdHRlclxucmVzZXJ2ZWQuX3ByZXMgPSByZXNlcnZlZC5fcG9zdHMgPSAxOyAvLyBob29rcy5qc1xuXG4vKipcbiAqIEdldHMvc2V0cyBzY2hlbWEgcGF0aHMuXG4gKlxuICogU2V0cyBhIHBhdGggKGlmIGFyaXR5IDIpXG4gKiBHZXRzIGEgcGF0aCAoaWYgYXJpdHkgMSlcbiAqXG4gKiAjIyMjRXhhbXBsZVxuICpcbiAqICAgICBzY2hlbWEucGF0aCgnbmFtZScpIC8vIHJldHVybnMgYSBTY2hlbWFUeXBlXG4gKiAgICAgc2NoZW1hLnBhdGgoJ25hbWUnLCBOdW1iZXIpIC8vIGNoYW5nZXMgdGhlIHNjaGVtYVR5cGUgb2YgYG5hbWVgIHRvIE51bWJlclxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge09iamVjdH0gY29uc3RydWN0b3JcbiAqIEBhcGkgcHVibGljXG4gKi9cblNjaGVtYS5wcm90b3R5cGUucGF0aCA9IGZ1bmN0aW9uIChwYXRoLCBvYmopIHtcbiAgaWYgKG9iaiA9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAodGhpcy5wYXRoc1twYXRoXSkgcmV0dXJuIHRoaXMucGF0aHNbcGF0aF07XG4gICAgaWYgKHRoaXMuc3VicGF0aHNbcGF0aF0pIHJldHVybiB0aGlzLnN1YnBhdGhzW3BhdGhdO1xuXG4gICAgLy8gc3VicGF0aHM/XG4gICAgcmV0dXJuIC9cXC5cXGQrXFwuPy4qJC8udGVzdChwYXRoKVxuICAgICAgPyBnZXRQb3NpdGlvbmFsUGF0aCh0aGlzLCBwYXRoKVxuICAgICAgOiB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyBzb21lIHBhdGggbmFtZXMgY29uZmxpY3Qgd2l0aCBkb2N1bWVudCBtZXRob2RzXG4gIGlmIChyZXNlcnZlZFtwYXRoXSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcImBcIiArIHBhdGggKyBcImAgbWF5IG5vdCBiZSB1c2VkIGFzIGEgc2NoZW1hIHBhdGhuYW1lXCIpO1xuICB9XG5cbiAgLy8gdXBkYXRlIHRoZSB0cmVlXG4gIHZhciBzdWJwYXRocyA9IHBhdGguc3BsaXQoL1xcLi8pXG4gICAgLCBsYXN0ID0gc3VicGF0aHMucG9wKClcbiAgICAsIGJyYW5jaCA9IHRoaXMudHJlZTtcblxuICBzdWJwYXRocy5mb3JFYWNoKGZ1bmN0aW9uKHN1YiwgaSkge1xuICAgIGlmICghYnJhbmNoW3N1Yl0pIGJyYW5jaFtzdWJdID0ge307XG4gICAgaWYgKCdvYmplY3QnICE9IHR5cGVvZiBicmFuY2hbc3ViXSkge1xuICAgICAgdmFyIG1zZyA9ICdDYW5ub3Qgc2V0IG5lc3RlZCBwYXRoIGAnICsgcGF0aCArICdgLiAnXG4gICAgICAgICAgICAgICsgJ1BhcmVudCBwYXRoIGAnXG4gICAgICAgICAgICAgICsgc3VicGF0aHMuc2xpY2UoMCwgaSkuY29uY2F0KFtzdWJdKS5qb2luKCcuJylcbiAgICAgICAgICAgICAgKyAnYCBhbHJlYWR5IHNldCB0byB0eXBlICcgKyBicmFuY2hbc3ViXS5uYW1lXG4gICAgICAgICAgICAgICsgJy4nO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gICAgfVxuICAgIGJyYW5jaCA9IGJyYW5jaFtzdWJdO1xuICB9KTtcblxuICBicmFuY2hbbGFzdF0gPSB1dGlscy5jbG9uZShvYmopO1xuXG4gIHRoaXMucGF0aHNbcGF0aF0gPSBTY2hlbWEuaW50ZXJwcmV0QXNUeXBlKHBhdGgsIG9iaik7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBDb252ZXJ0cyB0eXBlIGFyZ3VtZW50cyBpbnRvIFNjaGVtYSBUeXBlcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHBhcmFtIHtPYmplY3R9IG9iaiBjb25zdHJ1Y3RvclxuICogQGFwaSBwcml2YXRlXG4gKi9cblNjaGVtYS5pbnRlcnByZXRBc1R5cGUgPSBmdW5jdGlvbiAocGF0aCwgb2JqKSB7XG4gIGlmIChvYmouY29uc3RydWN0b3IgJiYgb2JqLmNvbnN0cnVjdG9yLm5hbWUgIT0gJ09iamVjdCcpXG4gICAgb2JqID0geyB0eXBlOiBvYmogfTtcblxuICAvLyBHZXQgdGhlIHR5cGUgbWFraW5nIHN1cmUgdG8gYWxsb3cga2V5cyBuYW1lZCBcInR5cGVcIlxuICAvLyBhbmQgZGVmYXVsdCB0byBtaXhlZCBpZiBub3Qgc3BlY2lmaWVkLlxuICAvLyB7IHR5cGU6IHsgdHlwZTogU3RyaW5nLCBkZWZhdWx0OiAnZnJlc2hjdXQnIH0gfVxuICB2YXIgdHlwZSA9IG9iai50eXBlICYmICFvYmoudHlwZS50eXBlXG4gICAgPyBvYmoudHlwZVxuICAgIDoge307XG5cbiAgaWYgKCdPYmplY3QnID09IHR5cGUuY29uc3RydWN0b3IubmFtZSB8fCAnbWl4ZWQnID09IHR5cGUpIHtcbiAgICByZXR1cm4gbmV3IFR5cGVzLk1peGVkKHBhdGgsIG9iaik7XG4gIH1cblxuICBpZiAoQXJyYXkuaXNBcnJheSh0eXBlKSB8fCBBcnJheSA9PSB0eXBlIHx8ICdhcnJheScgPT0gdHlwZSkge1xuICAgIC8vIGlmIGl0IHdhcyBzcGVjaWZpZWQgdGhyb3VnaCB7IHR5cGUgfSBsb29rIGZvciBgY2FzdGBcbiAgICB2YXIgY2FzdCA9IChBcnJheSA9PSB0eXBlIHx8ICdhcnJheScgPT0gdHlwZSlcbiAgICAgID8gb2JqLmNhc3RcbiAgICAgIDogdHlwZVswXTtcblxuICAgIGlmIChjYXN0IGluc3RhbmNlb2YgU2NoZW1hKSB7XG4gICAgICByZXR1cm4gbmV3IFR5cGVzLkRvY3VtZW50QXJyYXkocGF0aCwgY2FzdCwgb2JqKTtcbiAgICB9XG5cbiAgICBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIGNhc3QpIHtcbiAgICAgIGNhc3QgPSBUeXBlc1tjYXN0LmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgY2FzdC5zdWJzdHJpbmcoMSldO1xuICAgIH0gZWxzZSBpZiAoY2FzdCAmJiAoIWNhc3QudHlwZSB8fCBjYXN0LnR5cGUudHlwZSlcbiAgICAgICAgICAgICAgICAgICAgJiYgJ09iamVjdCcgPT0gY2FzdC5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgICAgICAgICAgICAgICAgICYmIE9iamVjdC5rZXlzKGNhc3QpLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIG5ldyBUeXBlcy5Eb2N1bWVudEFycmF5KHBhdGgsIG5ldyBTY2hlbWEoY2FzdCksIG9iaik7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBUeXBlcy5BcnJheShwYXRoLCBjYXN0IHx8IFR5cGVzLk1peGVkLCBvYmopO1xuICB9XG5cbiAgdmFyIG5hbWUgPSAnc3RyaW5nJyA9PSB0eXBlb2YgdHlwZVxuICAgID8gdHlwZVxuICAgIDogdHlwZS5uYW1lO1xuXG4gIGlmIChuYW1lKSB7XG4gICAgbmFtZSA9IG5hbWUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBuYW1lLnN1YnN0cmluZygxKTtcbiAgfVxuXG4gIGlmICh1bmRlZmluZWQgPT0gVHlwZXNbbmFtZV0pIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmRlZmluZWQgdHlwZSBhdCBgJyArIHBhdGggK1xuICAgICAgICAnYFxcbiAgRGlkIHlvdSB0cnkgbmVzdGluZyBTY2hlbWFzPyAnICtcbiAgICAgICAgJ1lvdSBjYW4gb25seSBuZXN0IHVzaW5nIHJlZnMgb3IgYXJyYXlzLicpO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBUeXBlc1tuYW1lXShwYXRoLCBvYmopO1xufTtcblxuLyoqXG4gKiBJdGVyYXRlcyB0aGUgc2NoZW1hcyBwYXRocyBzaW1pbGFyIHRvIEFycmF5I2ZvckVhY2guXG4gKlxuICogVGhlIGNhbGxiYWNrIGlzIHBhc3NlZCB0aGUgcGF0aG5hbWUgYW5kIHNjaGVtYVR5cGUgYXMgYXJndW1lbnRzIG9uIGVhY2ggaXRlcmF0aW9uLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIGNhbGxiYWNrIGZ1bmN0aW9uXG4gKiBAcmV0dXJuIHtTY2hlbWF9IHRoaXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblNjaGVtYS5wcm90b3R5cGUuZWFjaFBhdGggPSBmdW5jdGlvbiAoZm4pIHtcbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh0aGlzLnBhdGhzKVxuICAgICwgbGVuID0ga2V5cy5sZW5ndGg7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIGZuKGtleXNbaV0sIHRoaXMucGF0aHNba2V5c1tpXV0pO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYW4gQXJyYXkgb2YgcGF0aCBzdHJpbmdzIHRoYXQgYXJlIHJlcXVpcmVkIGJ5IHRoaXMgc2NoZW1hLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqL1xuU2NoZW1hLnByb3RvdHlwZS5yZXF1aXJlZFBhdGhzID0gZnVuY3Rpb24gcmVxdWlyZWRQYXRocyAoKSB7XG4gIGlmICh0aGlzLl9yZXF1aXJlZHBhdGhzKSByZXR1cm4gdGhpcy5fcmVxdWlyZWRwYXRocztcblxuICB2YXIgcGF0aHMgPSBPYmplY3Qua2V5cyh0aGlzLnBhdGhzKVxuICAgICwgaSA9IHBhdGhzLmxlbmd0aFxuICAgICwgcmV0ID0gW107XG5cbiAgd2hpbGUgKGktLSkge1xuICAgIHZhciBwYXRoID0gcGF0aHNbaV07XG4gICAgaWYgKHRoaXMucGF0aHNbcGF0aF0uaXNSZXF1aXJlZCkgcmV0LnB1c2gocGF0aCk7XG4gIH1cblxuICByZXR1cm4gdGhpcy5fcmVxdWlyZWRwYXRocyA9IHJldDtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgcGF0aFR5cGUgb2YgYHBhdGhgIGZvciB0aGlzIHNjaGVtYS5cbiAqXG4gKiBHaXZlbiBhIHBhdGgsIHJldHVybnMgd2hldGhlciBpdCBpcyBhIHJlYWwsIHZpcnR1YWwsIG5lc3RlZCwgb3IgYWQtaG9jL3VuZGVmaW5lZCBwYXRoLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWEucHJvdG90eXBlLnBhdGhUeXBlID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgaWYgKHBhdGggaW4gdGhpcy5wYXRocykgcmV0dXJuICdyZWFsJztcbiAgaWYgKHBhdGggaW4gdGhpcy52aXJ0dWFscykgcmV0dXJuICd2aXJ0dWFsJztcbiAgaWYgKHBhdGggaW4gdGhpcy5uZXN0ZWQpIHJldHVybiAnbmVzdGVkJztcbiAgaWYgKHBhdGggaW4gdGhpcy5zdWJwYXRocykgcmV0dXJuICdyZWFsJztcblxuICBpZiAoL1xcLlxcZCtcXC58XFwuXFxkKyQvLnRlc3QocGF0aCkgJiYgZ2V0UG9zaXRpb25hbFBhdGgodGhpcywgcGF0aCkpIHtcbiAgICByZXR1cm4gJ3JlYWwnO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAnYWRob2NPclVuZGVmaW5lZCdcbiAgfVxufTtcblxuLyohXG4gKiBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gZ2V0UG9zaXRpb25hbFBhdGggKHNlbGYsIHBhdGgpIHtcbiAgdmFyIHN1YnBhdGhzID0gcGF0aC5zcGxpdCgvXFwuKFxcZCspXFwufFxcLihcXGQrKSQvKS5maWx0ZXIoQm9vbGVhbik7XG4gIGlmIChzdWJwYXRocy5sZW5ndGggPCAyKSB7XG4gICAgcmV0dXJuIHNlbGYucGF0aHNbc3VicGF0aHNbMF1dO1xuICB9XG5cbiAgdmFyIHZhbCA9IHNlbGYucGF0aChzdWJwYXRoc1swXSk7XG4gIGlmICghdmFsKSByZXR1cm4gdmFsO1xuXG4gIHZhciBsYXN0ID0gc3VicGF0aHMubGVuZ3RoIC0gMVxuICAgICwgc3VicGF0aFxuICAgICwgaSA9IDE7XG5cbiAgZm9yICg7IGkgPCBzdWJwYXRocy5sZW5ndGg7ICsraSkge1xuICAgIHN1YnBhdGggPSBzdWJwYXRoc1tpXTtcblxuICAgIGlmIChpID09PSBsYXN0ICYmIHZhbCAmJiAhdmFsLnNjaGVtYSAmJiAhL1xcRC8udGVzdChzdWJwYXRoKSkge1xuICAgICAgaWYgKHZhbCBpbnN0YW5jZW9mIFR5cGVzLkFycmF5KSB7XG4gICAgICAgIC8vIFN0cmluZ1NjaGVtYSwgTnVtYmVyU2NoZW1hLCBldGNcbiAgICAgICAgdmFsID0gdmFsLmNhc3RlcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbCA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIGlnbm9yZSBpZiBpdHMganVzdCBhIHBvc2l0aW9uIHNlZ21lbnQ6IHBhdGguMC5zdWJwYXRoXG4gICAgaWYgKCEvXFxELy50ZXN0KHN1YnBhdGgpKSBjb250aW51ZTtcblxuICAgIGlmICghKHZhbCAmJiB2YWwuc2NoZW1hKSkge1xuICAgICAgdmFsID0gdW5kZWZpbmVkO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgdmFsID0gdmFsLnNjaGVtYS5wYXRoKHN1YnBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIHNlbGYuc3VicGF0aHNbcGF0aF0gPSB2YWw7XG59XG5cbi8qKlxuICogQWRkcyBhIG1ldGhvZCBjYWxsIHRvIHRoZSBxdWV1ZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBuYW1lIG9mIHRoZSBkb2N1bWVudCBtZXRob2QgdG8gY2FsbCBsYXRlclxuICogQHBhcmFtIHtBcnJheX0gYXJncyBhcmd1bWVudHMgdG8gcGFzcyB0byB0aGUgbWV0aG9kXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuU2NoZW1hLnByb3RvdHlwZS5xdWV1ZSA9IGZ1bmN0aW9uKG5hbWUsIGFyZ3Mpe1xuICB0aGlzLmNhbGxRdWV1ZS5wdXNoKFtuYW1lLCBhcmdzXSk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBEZWZpbmVzIGEgcHJlIGhvb2sgZm9yIHRoZSBkb2N1bWVudC5cbiAqXG4gKiAjIyMjRXhhbXBsZVxuICpcbiAqICAgICB2YXIgdG95U2NoZW1hID0gbmV3IFNjaGVtYSguLik7XG4gKlxuICogICAgIHRveVNjaGVtYS5wcmUoJ3NhdmUnLCBmdW5jdGlvbiAobmV4dCkge1xuICogICAgICAgaWYgKCF0aGlzLmNyZWF0ZWQpIHRoaXMuY3JlYXRlZCA9IG5ldyBEYXRlO1xuICogICAgICAgbmV4dCgpO1xuICogICAgIH0pXG4gKlxuICogICAgIHRveVNjaGVtYS5wcmUoJ3ZhbGlkYXRlJywgZnVuY3Rpb24gKG5leHQpIHtcbiAqICAgICAgIGlmICh0aGlzLm5hbWUgIT0gJ1dvb2R5JykgdGhpcy5uYW1lID0gJ1dvb2R5JztcbiAqICAgICAgIG5leHQoKTtcbiAqICAgICB9KVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAc2VlIGhvb2tzLmpzIGh0dHBzOi8vZ2l0aHViLmNvbS9ibm9ndWNoaS9ob29rcy1qcy90cmVlLzMxZWM1NzFjZWYwMzMyZTIxMTIxZWU3MTU3ZTBjZjk3Mjg1NzJjYzNcbiAqIEBhcGkgcHVibGljXG4gKi9cblNjaGVtYS5wcm90b3R5cGUucHJlID0gZnVuY3Rpb24oKXtcbiAgcmV0dXJuIHRoaXMucXVldWUoJ3ByZScsIGFyZ3VtZW50cyk7XG59O1xuXG4vKipcbiAqIERlZmluZXMgYSBwb3N0IGZvciB0aGUgZG9jdW1lbnRcbiAqXG4gKiBQb3N0IGhvb2tzIGZpcmUgYG9uYCB0aGUgZXZlbnQgZW1pdHRlZCBmcm9tIGRvY3VtZW50IGluc3RhbmNlcyBvZiBNb2RlbHMgY29tcGlsZWQgZnJvbSB0aGlzIHNjaGVtYS5cbiAqXG4gKiAgICAgdmFyIHNjaGVtYSA9IG5ldyBTY2hlbWEoLi4pO1xuICogICAgIHNjaGVtYS5wb3N0KCdzYXZlJywgZnVuY3Rpb24gKGRvYykge1xuICogICAgICAgY29uc29sZS5sb2coJ3RoaXMgZmlyZWQgYWZ0ZXIgYSBkb2N1bWVudCB3YXMgc2F2ZWQnKTtcbiAqICAgICB9KTtcbiAqXG4gKiAgICAgdmFyIE1vZGVsID0gbW9uZ29vc2UubW9kZWwoJ01vZGVsJywgc2NoZW1hKTtcbiAqXG4gKiAgICAgdmFyIG0gPSBuZXcgTW9kZWwoLi4pO1xuICogICAgIG0uc2F2ZShmdW5jdGlvbiAoZXJyKSB7XG4gKiAgICAgICBjb25zb2xlLmxvZygndGhpcyBmaXJlcyBhZnRlciB0aGUgYHBvc3RgIGhvb2snKTtcbiAqICAgICB9KTtcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWV0aG9kIG5hbWUgb2YgdGhlIG1ldGhvZCB0byBob29rXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBjYWxsYmFja1xuICogQHNlZSBob29rcy5qcyBodHRwczovL2dpdGh1Yi5jb20vYm5vZ3VjaGkvaG9va3MtanMvdHJlZS8zMWVjNTcxY2VmMDMzMmUyMTEyMWVlNzE1N2UwY2Y5NzI4NTcyY2MzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWEucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbihtZXRob2QsIGZuKXtcbiAgcmV0dXJuIHRoaXMucXVldWUoJ29uJywgYXJndW1lbnRzKTtcbn07XG5cbi8qKlxuICogUmVnaXN0ZXJzIGEgcGx1Z2luIGZvciB0aGlzIHNjaGVtYS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBwbHVnaW4gY2FsbGJhY2tcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKiBAc2VlIHBsdWdpbnNcbiAqIEBhcGkgcHVibGljXG4gKi9cblNjaGVtYS5wcm90b3R5cGUucGx1Z2luID0gZnVuY3Rpb24gKGZuLCBvcHRzKSB7XG4gIGZuKHRoaXMsIG9wdHMpO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQWRkcyBhbiBpbnN0YW5jZSBtZXRob2QgdG8gZG9jdW1lbnRzIGNvbnN0cnVjdGVkIGZyb20gTW9kZWxzIGNvbXBpbGVkIGZyb20gdGhpcyBzY2hlbWEuXG4gKlxuICogIyMjI0V4YW1wbGVcbiAqXG4gKiAgICAgdmFyIHNjaGVtYSA9IGtpdHR5U2NoZW1hID0gbmV3IFNjaGVtYSguLik7XG4gKlxuICogICAgIHNjaGVtYS5tZXRob2QoJ21lb3cnLCBmdW5jdGlvbiAoKSB7XG4gKiAgICAgICBjb25zb2xlLmxvZygnbWVlZWVlb29vb29vb29vb29vdycpO1xuICogICAgIH0pXG4gKlxuICogICAgIHZhciBLaXR0eSA9IG1vbmdvb3NlLm1vZGVsKCdLaXR0eScsIHNjaGVtYSk7XG4gKlxuICogICAgIHZhciBmaXp6ID0gbmV3IEtpdHR5O1xuICogICAgIGZpenoubWVvdygpOyAvLyBtZWVlZWVvb29vb29vb29vb29vd1xuICpcbiAqIElmIGEgaGFzaCBvZiBuYW1lL2ZuIHBhaXJzIGlzIHBhc3NlZCBhcyB0aGUgb25seSBhcmd1bWVudCwgZWFjaCBuYW1lL2ZuIHBhaXIgd2lsbCBiZSBhZGRlZCBhcyBtZXRob2RzLlxuICpcbiAqICAgICBzY2hlbWEubWV0aG9kKHtcbiAqICAgICAgICAgcHVycjogZnVuY3Rpb24gKCkge31cbiAqICAgICAgICwgc2NyYXRjaDogZnVuY3Rpb24gKCkge31cbiAqICAgICB9KTtcbiAqXG4gKiAgICAgLy8gbGF0ZXJcbiAqICAgICBmaXp6LnB1cnIoKTtcbiAqICAgICBmaXp6LnNjcmF0Y2goKTtcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xPYmplY3R9IG1ldGhvZCBuYW1lXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbZm5dXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWEucHJvdG90eXBlLm1ldGhvZCA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICBpZiAoJ3N0cmluZycgIT0gdHlwZW9mIG5hbWUpXG4gICAgZm9yICh2YXIgaSBpbiBuYW1lKVxuICAgICAgdGhpcy5tZXRob2RzW2ldID0gbmFtZVtpXTtcbiAgZWxzZVxuICAgIHRoaXMubWV0aG9kc1tuYW1lXSA9IGZuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQWRkcyBzdGF0aWMgXCJjbGFzc1wiIG1ldGhvZHMgdG8gTW9kZWxzIGNvbXBpbGVkIGZyb20gdGhpcyBzY2hlbWEuXG4gKlxuICogIyMjI0V4YW1wbGVcbiAqXG4gKiAgICAgdmFyIHNjaGVtYSA9IG5ldyBTY2hlbWEoLi4pO1xuICogICAgIHNjaGVtYS5zdGF0aWMoJ2ZpbmRCeU5hbWUnLCBmdW5jdGlvbiAobmFtZSwgY2FsbGJhY2spIHtcbiAqICAgICAgIHJldHVybiB0aGlzLmZpbmQoeyBuYW1lOiBuYW1lIH0sIGNhbGxiYWNrKTtcbiAqICAgICB9KTtcbiAqXG4gKiAgICAgdmFyIERyaW5rID0gbW9uZ29vc2UubW9kZWwoJ0RyaW5rJywgc2NoZW1hKTtcbiAqICAgICBEcmluay5maW5kQnlOYW1lKCdzYW5wZWxsZWdyaW5vJywgZnVuY3Rpb24gKGVyciwgZHJpbmtzKSB7XG4gKiAgICAgICAvL1xuICogICAgIH0pO1xuICpcbiAqIElmIGEgaGFzaCBvZiBuYW1lL2ZuIHBhaXJzIGlzIHBhc3NlZCBhcyB0aGUgb25seSBhcmd1bWVudCwgZWFjaCBuYW1lL2ZuIHBhaXIgd2lsbCBiZSBhZGRlZCBhcyBzdGF0aWNzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQGFwaSBwdWJsaWNcbiAqL1xuU2NoZW1hLnByb3RvdHlwZS5zdGF0aWMgPSBmdW5jdGlvbihuYW1lLCBmbikge1xuICBpZiAoJ3N0cmluZycgIT0gdHlwZW9mIG5hbWUpXG4gICAgZm9yICh2YXIgaSBpbiBuYW1lKVxuICAgICAgdGhpcy5zdGF0aWNzW2ldID0gbmFtZVtpXTtcbiAgZWxzZVxuICAgIHRoaXMuc3RhdGljc1tuYW1lXSA9IGZuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogU2V0cy9nZXRzIGEgc2NoZW1hIG9wdGlvbi5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5IG9wdGlvbiBuYW1lXG4gKiBAcGFyYW0ge09iamVjdH0gW3ZhbHVlXSBpZiBub3QgcGFzc2VkLCB0aGUgY3VycmVudCBvcHRpb24gdmFsdWUgaXMgcmV0dXJuZWRcbiAqIEBhcGkgcHVibGljXG4gKi9cblNjaGVtYS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgaWYgKDEgPT09IGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICByZXR1cm4gdGhpcy5vcHRpb25zW2tleV07XG4gIH1cblxuICBzd2l0Y2ggKGtleSkge1xuICAgIGNhc2UgJ3NhZmUnOlxuICAgICAgdGhpcy5vcHRpb25zW2tleV0gPSBmYWxzZSA9PT0gdmFsdWVcbiAgICAgICAgPyB7IHc6IDAgfVxuICAgICAgICA6IHZhbHVlO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRoaXMub3B0aW9uc1trZXldID0gdmFsdWU7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogR2V0cyBhIHNjaGVtYSBvcHRpb24uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleSBvcHRpb24gbmFtZVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5TY2hlbWEucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgcmV0dXJuIHRoaXMub3B0aW9uc1trZXldO1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgdmlydHVhbCB0eXBlIHdpdGggdGhlIGdpdmVuIG5hbWUuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEByZXR1cm4ge1ZpcnR1YWxUeXBlfVxuICovXG5cblNjaGVtYS5wcm90b3R5cGUudmlydHVhbCA9IGZ1bmN0aW9uIChuYW1lLCBvcHRpb25zKSB7XG4gIHZhciB2aXJ0dWFscyA9IHRoaXMudmlydHVhbHM7XG4gIHZhciBwYXJ0cyA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgcmV0dXJuIHZpcnR1YWxzW25hbWVdID0gcGFydHMucmVkdWNlKGZ1bmN0aW9uIChtZW0sIHBhcnQsIGkpIHtcbiAgICBtZW1bcGFydF0gfHwgKG1lbVtwYXJ0XSA9IChpID09PSBwYXJ0cy5sZW5ndGgtMSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IG5ldyBWaXJ0dWFsVHlwZShvcHRpb25zLCBuYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDoge30pO1xuICAgIHJldHVybiBtZW1bcGFydF07XG4gIH0sIHRoaXMudHJlZSk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIHZpcnR1YWwgdHlwZSB3aXRoIHRoZSBnaXZlbiBgbmFtZWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge1ZpcnR1YWxUeXBlfVxuICovXG5cblNjaGVtYS5wcm90b3R5cGUudmlydHVhbHBhdGggPSBmdW5jdGlvbiAobmFtZSkge1xuICByZXR1cm4gdGhpcy52aXJ0dWFsc1tuYW1lXTtcbn07XG5cbi8qKlxuICogUmVnaXN0ZXJlZCBkaXNjcmltaW5hdG9ycyBmb3IgdGhpcyBzY2hlbWEuXG4gKlxuICogQHByb3BlcnR5IGRpc2NyaW1pbmF0b3JzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWEuZGlzY3JpbWluYXRvcnM7XG5cbi8qKlxuICog0J3QsNGB0LvQtdC00L7QstCw0L3QuNC1INC+0YIg0YHRhdC10LzRiy5cbiAqIHRoaXMgLSDQsdCw0LfQvtCy0LDRjyDRgdGF0LXQvNCwISEhXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKiAgICAgdmFyIFBlcnNvblNjaGVtYSA9IG5ldyBTY2hlbWEoJ1BlcnNvbicsIHtcbiAqICAgICAgIG5hbWU6IFN0cmluZyxcbiAqICAgICAgIGNyZWF0ZWRBdDogRGF0ZVxuICogICAgIH0pO1xuICpcbiAqICAgICB2YXIgQm9zc1NjaGVtYSA9IG5ldyBTY2hlbWEoJ0Jvc3MnLCBQZXJzb25TY2hlbWEsIHsgZGVwYXJ0bWVudDogU3RyaW5nIH0pO1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lICAgZGlzY3JpbWluYXRvciBtb2RlbCBuYW1lXG4gKiBAcGFyYW0ge1NjaGVtYX0gc2NoZW1hIGRpc2NyaW1pbmF0b3IgbW9kZWwgc2NoZW1hXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWEucHJvdG90eXBlLmRpc2NyaW1pbmF0b3IgPSBmdW5jdGlvbiBkaXNjcmltaW5hdG9yIChuYW1lLCBzY2hlbWEpIHtcbiAgaWYgKCEoc2NoZW1hIGluc3RhbmNlb2YgU2NoZW1hKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIllvdSBtdXN0IHBhc3MgYSB2YWxpZCBkaXNjcmltaW5hdG9yIFNjaGVtYVwiKTtcbiAgfVxuXG4gIGlmICggdGhpcy5kaXNjcmltaW5hdG9yTWFwcGluZyAmJiAhdGhpcy5kaXNjcmltaW5hdG9yTWFwcGluZy5pc1Jvb3QgKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRGlzY3JpbWluYXRvciBcXFwiXCIgKyBuYW1lICsgXCJcXFwiIGNhbiBvbmx5IGJlIGEgZGlzY3JpbWluYXRvciBvZiB0aGUgcm9vdCBtb2RlbFwiKTtcbiAgfVxuXG4gIHZhciBrZXkgPSB0aGlzLm9wdGlvbnMuZGlzY3JpbWluYXRvcktleTtcbiAgaWYgKCBzY2hlbWEucGF0aChrZXkpICkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkRpc2NyaW1pbmF0b3IgXFxcIlwiICsgbmFtZSArIFwiXFxcIiBjYW5ub3QgaGF2ZSBmaWVsZCB3aXRoIG5hbWUgXFxcIlwiICsga2V5ICsgXCJcXFwiXCIpO1xuICB9XG5cbiAgLy8gbWVyZ2VzIGJhc2Ugc2NoZW1hIGludG8gbmV3IGRpc2NyaW1pbmF0b3Igc2NoZW1hIGFuZCBzZXRzIG5ldyB0eXBlIGZpZWxkLlxuICAoZnVuY3Rpb24gbWVyZ2VTY2hlbWFzKHNjaGVtYSwgYmFzZVNjaGVtYSkge1xuICAgIHV0aWxzLm1lcmdlKHNjaGVtYSwgYmFzZVNjaGVtYSk7XG5cbiAgICB2YXIgb2JqID0ge307XG4gICAgb2JqW2tleV0gPSB7IHR5cGU6IFN0cmluZywgZGVmYXVsdDogbmFtZSB9O1xuICAgIHNjaGVtYS5hZGQob2JqKTtcbiAgICBzY2hlbWEuZGlzY3JpbWluYXRvck1hcHBpbmcgPSB7IGtleToga2V5LCB2YWx1ZTogbmFtZSwgaXNSb290OiBmYWxzZSB9O1xuXG4gICAgaWYgKGJhc2VTY2hlbWEub3B0aW9ucy5jb2xsZWN0aW9uKSB7XG4gICAgICBzY2hlbWEub3B0aW9ucy5jb2xsZWN0aW9uID0gYmFzZVNjaGVtYS5vcHRpb25zLmNvbGxlY3Rpb247XG4gICAgfVxuXG4gICAgICAvLyB0aHJvd3MgZXJyb3IgaWYgb3B0aW9ucyBhcmUgaW52YWxpZFxuICAgIChmdW5jdGlvbiB2YWxpZGF0ZU9wdGlvbnMoYSwgYikge1xuICAgICAgYSA9IHV0aWxzLmNsb25lKGEpO1xuICAgICAgYiA9IHV0aWxzLmNsb25lKGIpO1xuICAgICAgZGVsZXRlIGEudG9KU09OO1xuICAgICAgZGVsZXRlIGEudG9PYmplY3Q7XG4gICAgICBkZWxldGUgYi50b0pTT047XG4gICAgICBkZWxldGUgYi50b09iamVjdDtcblxuICAgICAgaWYgKCF1dGlscy5kZWVwRXF1YWwoYSwgYikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRGlzY3JpbWluYXRvciBvcHRpb25zIGFyZSBub3QgY3VzdG9taXphYmxlIChleGNlcHQgdG9KU09OICYgdG9PYmplY3QpXCIpO1xuICAgICAgfVxuICAgIH0pKHNjaGVtYS5vcHRpb25zLCBiYXNlU2NoZW1hLm9wdGlvbnMpO1xuXG4gICAgdmFyIHRvSlNPTiA9IHNjaGVtYS5vcHRpb25zLnRvSlNPTlxuICAgICAgLCB0b09iamVjdCA9IHNjaGVtYS5vcHRpb25zLnRvT2JqZWN0O1xuXG4gICAgc2NoZW1hLm9wdGlvbnMgPSB1dGlscy5jbG9uZShiYXNlU2NoZW1hLm9wdGlvbnMpO1xuICAgIGlmICh0b0pTT04pICAgc2NoZW1hLm9wdGlvbnMudG9KU09OID0gdG9KU09OO1xuICAgIGlmICh0b09iamVjdCkgc2NoZW1hLm9wdGlvbnMudG9PYmplY3QgPSB0b09iamVjdDtcblxuICAgIHNjaGVtYS5jYWxsUXVldWUgPSBiYXNlU2NoZW1hLmNhbGxRdWV1ZS5jb25jYXQoc2NoZW1hLmNhbGxRdWV1ZSk7XG4gICAgc2NoZW1hLl9yZXF1aXJlZHBhdGhzID0gdW5kZWZpbmVkOyAvLyByZXNldCBqdXN0IGluIGNhc2UgU2NoZW1hI3JlcXVpcmVkUGF0aHMoKSB3YXMgY2FsbGVkIG9uIGVpdGhlciBzY2hlbWFcbiAgfSkoc2NoZW1hLCB0aGlzKTtcblxuICBpZiAoIXRoaXMuZGlzY3JpbWluYXRvcnMpIHtcbiAgICB0aGlzLmRpc2NyaW1pbmF0b3JzID0ge307XG4gIH1cblxuICBpZiAoIXRoaXMuZGlzY3JpbWluYXRvck1hcHBpbmcpIHtcbiAgICB0aGlzLmRpc2NyaW1pbmF0b3JNYXBwaW5nID0geyBrZXk6IGtleSwgdmFsdWU6IG51bGwsIGlzUm9vdDogdHJ1ZSB9O1xuICB9XG5cbiAgaWYgKHRoaXMuZGlzY3JpbWluYXRvcnNbbmFtZV0pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJEaXNjcmltaW5hdG9yIHdpdGggbmFtZSBcXFwiXCIgKyBuYW1lICsgXCJcXFwiIGFscmVhZHkgZXhpc3RzXCIpO1xuICB9XG5cbiAgdGhpcy5kaXNjcmltaW5hdG9yc1tuYW1lXSA9IHNjaGVtYTtcbn07XG5cbi8qIVxuICogZXhwb3J0c1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gU2NoZW1hO1xud2luZG93LlNjaGVtYSA9IFNjaGVtYTtcblxuLy8gcmVxdWlyZSBkb3duIGhlcmUgYmVjYXVzZSBvZiByZWZlcmVuY2UgaXNzdWVzXG5cbi8qKlxuICogVGhlIHZhcmlvdXMgYnVpbHQtaW4gTW9uZ29vc2UgU2NoZW1hIFR5cGVzLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgbW9uZ29vc2UgPSByZXF1aXJlKCdtb25nb29zZScpO1xuICogICAgIHZhciBPYmplY3RJZCA9IG1vbmdvb3NlLlNjaGVtYS5UeXBlcy5PYmplY3RJZDtcbiAqXG4gKiAjIyMjVHlwZXM6XG4gKlxuICogLSBbU3RyaW5nXSgjc2NoZW1hLXN0cmluZy1qcylcbiAqIC0gW051bWJlcl0oI3NjaGVtYS1udW1iZXItanMpXG4gKiAtIFtCb29sZWFuXSgjc2NoZW1hLWJvb2xlYW4tanMpIHwgQm9vbFxuICogLSBbQXJyYXldKCNzY2hlbWEtYXJyYXktanMpXG4gKiAtIFtEYXRlXSgjc2NoZW1hLWRhdGUtanMpXG4gKiAtIFtPYmplY3RJZF0oI3NjaGVtYS1vYmplY3RpZC1qcykgfCBPaWRcbiAqIC0gW01peGVkXSgjc2NoZW1hLW1peGVkLWpzKSB8IE9iamVjdFxuICpcbiAqIFVzaW5nIHRoaXMgZXhwb3NlZCBhY2Nlc3MgdG8gdGhlIGBNaXhlZGAgU2NoZW1hVHlwZSwgd2UgY2FuIHVzZSB0aGVtIGluIG91ciBzY2hlbWEuXG4gKlxuICogICAgIHZhciBNaXhlZCA9IG1vbmdvb3NlLlNjaGVtYS5UeXBlcy5NaXhlZDtcbiAqICAgICBuZXcgbW9uZ29vc2UuU2NoZW1hKHsgX3VzZXI6IE1peGVkIH0pXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuU2NoZW1hLlR5cGVzID0gcmVxdWlyZSgnLi9zY2hlbWEvaW5kZXgnKTtcblxuLy8g0KXRgNCw0L3QuNC70LjRidC1INGB0YXQtdC8XG5TY2hlbWEuc2NoZW1hcyA9IHNjaGVtYXMgPSB7fTtcblxuXG4vKiFcbiAqIGlnbm9yZVxuICovXG5cblR5cGVzID0gU2NoZW1hLlR5cGVzO1xudmFyIE9iamVjdElkID0gU2NoZW1hLk9iamVjdElkID0gVHlwZXMuT2JqZWN0SWQ7XG4iLCIvKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIFNjaGVtYVR5cGUgPSByZXF1aXJlKCcuLi9zY2hlbWF0eXBlJylcbiAgLCBDYXN0RXJyb3IgPSBTY2hlbWFUeXBlLkNhc3RFcnJvclxuICAsIFR5cGVzID0ge1xuICAgICAgICBCb29sZWFuOiByZXF1aXJlKCcuL2Jvb2xlYW4nKVxuICAgICAgLCBEYXRlOiByZXF1aXJlKCcuL2RhdGUnKVxuICAgICAgLCBOdW1iZXI6IHJlcXVpcmUoJy4vbnVtYmVyJylcbiAgICAgICwgU3RyaW5nOiByZXF1aXJlKCcuL3N0cmluZycpXG4gICAgICAsIE9iamVjdElkOiByZXF1aXJlKCcuL29iamVjdGlkJylcbiAgICB9XG4gICwgU3RvcmFnZUFycmF5ID0gcmVxdWlyZSgnLi4vdHlwZXMvYXJyYXknKVxuICAsIE1peGVkID0gcmVxdWlyZSgnLi9taXhlZCcpXG4gICwgRW1iZWRkZWREb2M7XG5cbi8qKlxuICogQXJyYXkgU2NoZW1hVHlwZSBjb25zdHJ1Y3RvclxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7U2NoZW1hVHlwZX0gY2FzdFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBpbmhlcml0cyBTY2hlbWFUeXBlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gU2NoZW1hQXJyYXkgKGtleSwgY2FzdCwgb3B0aW9ucykge1xuICBpZiAoY2FzdCkge1xuICAgIHZhciBjYXN0T3B0aW9ucyA9IHt9O1xuXG4gICAgaWYgKCdPYmplY3QnID09PSBjYXN0LmNvbnN0cnVjdG9yLm5hbWUpIHtcbiAgICAgIGlmIChjYXN0LnR5cGUpIHtcbiAgICAgICAgLy8gc3VwcG9ydCB7IHR5cGU6IFdvb3QgfVxuICAgICAgICBjYXN0T3B0aW9ucyA9IF8uY2xvbmUoIGNhc3QgKTsgLy8gZG8gbm90IGFsdGVyIHVzZXIgYXJndW1lbnRzXG4gICAgICAgIGRlbGV0ZSBjYXN0T3B0aW9ucy50eXBlO1xuICAgICAgICBjYXN0ID0gY2FzdC50eXBlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FzdCA9IE1peGVkO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHN1cHBvcnQgeyB0eXBlOiAnU3RyaW5nJyB9XG4gICAgdmFyIG5hbWUgPSAnc3RyaW5nJyA9PSB0eXBlb2YgY2FzdFxuICAgICAgPyBjYXN0XG4gICAgICA6IGNhc3QubmFtZTtcblxuICAgIHZhciBjYXN0ZXIgPSBuYW1lIGluIFR5cGVzXG4gICAgICA/IFR5cGVzW25hbWVdXG4gICAgICA6IGNhc3Q7XG5cbiAgICB0aGlzLmNhc3RlckNvbnN0cnVjdG9yID0gY2FzdGVyO1xuICAgIHRoaXMuY2FzdGVyID0gbmV3IGNhc3RlcihudWxsLCBjYXN0T3B0aW9ucyk7XG5cbiAgICAvLyBsYXp5IGxvYWRcbiAgICBFbWJlZGRlZERvYyB8fCAoRW1iZWRkZWREb2MgPSByZXF1aXJlKCcuLi90eXBlcy9lbWJlZGRlZCcpKTtcblxuICAgIGlmICghKHRoaXMuY2FzdGVyIGluc3RhbmNlb2YgRW1iZWRkZWREb2MpKSB7XG4gICAgICB0aGlzLmNhc3Rlci5wYXRoID0ga2V5O1xuICAgIH1cbiAgfVxuXG4gIFNjaGVtYVR5cGUuY2FsbCh0aGlzLCBrZXksIG9wdGlvbnMpO1xuXG4gIHZhciBzZWxmID0gdGhpc1xuICAgICwgZGVmYXVsdEFyclxuICAgICwgZm47XG5cbiAgaWYgKHRoaXMuZGVmYXVsdFZhbHVlKSB7XG4gICAgZGVmYXVsdEFyciA9IHRoaXMuZGVmYXVsdFZhbHVlO1xuICAgIGZuID0gJ2Z1bmN0aW9uJyA9PSB0eXBlb2YgZGVmYXVsdEFycjtcbiAgfVxuXG4gIHRoaXMuZGVmYXVsdChmdW5jdGlvbigpe1xuICAgIHZhciBhcnIgPSBmbiA/IGRlZmF1bHRBcnIoKSA6IGRlZmF1bHRBcnIgfHwgW107XG4gICAgcmV0dXJuIG5ldyBTdG9yYWdlQXJyYXkoYXJyLCBzZWxmLnBhdGgsIHRoaXMpO1xuICB9KTtcbn1cblxuXG4vKiFcbiAqIEluaGVyaXRzIGZyb20gU2NoZW1hVHlwZS5cbiAqL1xuU2NoZW1hQXJyYXkucHJvdG90eXBlLl9fcHJvdG9fXyA9IFNjaGVtYVR5cGUucHJvdG90eXBlO1xuXG4vKipcbiAqIENoZWNrIHJlcXVpcmVkXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdmFsdWVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5TY2hlbWFBcnJheS5wcm90b3R5cGUuY2hlY2tSZXF1aXJlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICByZXR1cm4gISEodmFsdWUgJiYgdmFsdWUubGVuZ3RoKTtcbn07XG5cbi8qKlxuICogT3ZlcnJpZGVzIHRoZSBnZXR0ZXJzIGFwcGxpY2F0aW9uIGZvciB0aGUgcG9wdWxhdGlvbiBzcGVjaWFsLWNhc2VcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZVxuICogQGFwaSBwcml2YXRlXG4gKi9cblNjaGVtYUFycmF5LnByb3RvdHlwZS5hcHBseUdldHRlcnMgPSBmdW5jdGlvbiAodmFsdWUsIHNjb3BlKSB7XG4gIGlmICh0aGlzLmNhc3Rlci5vcHRpb25zICYmIHRoaXMuY2FzdGVyLm9wdGlvbnMucmVmKSB7XG4gICAgLy8gbWVhbnMgdGhlIG9iamVjdCBpZCB3YXMgcG9wdWxhdGVkXG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgcmV0dXJuIFNjaGVtYVR5cGUucHJvdG90eXBlLmFwcGx5R2V0dGVycy5jYWxsKHRoaXMsIHZhbHVlLCBzY29wZSk7XG59O1xuXG4vKipcbiAqIENhc3RzIHZhbHVlcyBmb3Igc2V0KCkuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2MgZG9jdW1lbnQgdGhhdCB0cmlnZ2VycyB0aGUgY2FzdGluZ1xuICogQHBhcmFtIHtCb29sZWFufSBpbml0IHdoZXRoZXIgdGhpcyBpcyBhbiBpbml0aWFsaXphdGlvbiBjYXN0XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuU2NoZW1hQXJyYXkucHJvdG90eXBlLmNhc3QgPSBmdW5jdGlvbiAoIHZhbHVlLCBkb2MsIGluaXQgKSB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIGlmICghKHZhbHVlIGluc3RhbmNlb2YgU3RvcmFnZUFycmF5KSkge1xuICAgICAgdmFsdWUgPSBuZXcgU3RvcmFnZUFycmF5KHZhbHVlLCB0aGlzLnBhdGgsIGRvYyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FzdGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHZhbHVlLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgIHZhbHVlW2ldID0gdGhpcy5jYXN0ZXIuY2FzdCh2YWx1ZVtpXSwgZG9jLCBpbml0KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyByZXRocm93XG4gICAgICAgIHRocm93IG5ldyBDYXN0RXJyb3IoZS50eXBlLCB2YWx1ZSwgdGhpcy5wYXRoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHRoaXMuY2FzdChbdmFsdWVdLCBkb2MsIGluaXQpO1xuICB9XG59O1xuXG4vKiFcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gU2NoZW1hQXJyYXk7XG4iLCIvKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIFNjaGVtYVR5cGUgPSByZXF1aXJlKCcuLi9zY2hlbWF0eXBlJyk7XG5cbi8qKlxuICogQm9vbGVhbiBTY2hlbWFUeXBlIGNvbnN0cnVjdG9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQGluaGVyaXRzIFNjaGVtYVR5cGVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBCb29sZWFuU2NoZW1hIChwYXRoLCBvcHRpb25zKSB7XG4gIFNjaGVtYVR5cGUuY2FsbCh0aGlzLCBwYXRoLCBvcHRpb25zKTtcbn1cblxuLyohXG4gKiBJbmhlcml0cyBmcm9tIFNjaGVtYVR5cGUuXG4gKi9cbkJvb2xlYW5TY2hlbWEucHJvdG90eXBlLl9fcHJvdG9fXyA9IFNjaGVtYVR5cGUucHJvdG90eXBlO1xuXG4vKipcbiAqIFJlcXVpcmVkIHZhbGlkYXRvclxuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5Cb29sZWFuU2NoZW1hLnByb3RvdHlwZS5jaGVja1JlcXVpcmVkID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gZmFsc2U7XG59O1xuXG4vKipcbiAqIENhc3RzIHRvIGJvb2xlYW5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5Cb29sZWFuU2NoZW1hLnByb3RvdHlwZS5jYXN0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIGlmIChudWxsID09PSB2YWx1ZSkgcmV0dXJuIHZhbHVlO1xuICBpZiAoJzAnID09PSB2YWx1ZSkgcmV0dXJuIGZhbHNlO1xuICBpZiAoJ3RydWUnID09PSB2YWx1ZSkgcmV0dXJuIHRydWU7XG4gIGlmICgnZmFsc2UnID09PSB2YWx1ZSkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gISEgdmFsdWU7XG59O1xuXG4vKiFcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gQm9vbGVhblNjaGVtYTtcbiIsIi8qIVxuICogTW9kdWxlIHJlcXVpcmVtZW50cy5cbiAqL1xuXG52YXIgU2NoZW1hVHlwZSA9IHJlcXVpcmUoJy4uL3NjaGVtYXR5cGUnKTtcbnZhciBDYXN0RXJyb3IgPSBTY2hlbWFUeXBlLkNhc3RFcnJvcjtcblxuLyoqXG4gKiBEYXRlIFNjaGVtYVR5cGUgY29uc3RydWN0b3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBpbmhlcml0cyBTY2hlbWFUeXBlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBEYXRlU2NoZW1hIChrZXksIG9wdGlvbnMpIHtcbiAgU2NoZW1hVHlwZS5jYWxsKHRoaXMsIGtleSwgb3B0aW9ucyk7XG59XG5cbi8qIVxuICogSW5oZXJpdHMgZnJvbSBTY2hlbWFUeXBlLlxuICovXG5EYXRlU2NoZW1hLnByb3RvdHlwZS5fX3Byb3RvX18gPSBTY2hlbWFUeXBlLnByb3RvdHlwZTtcblxuLyoqXG4gKiBSZXF1aXJlZCB2YWxpZGF0b3IgZm9yIGRhdGVcbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuRGF0ZVNjaGVtYS5wcm90b3R5cGUuY2hlY2tSZXF1aXJlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBEYXRlO1xufTtcblxuLyoqXG4gKiBDYXN0cyB0byBkYXRlXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlIHRvIGNhc3RcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5EYXRlU2NoZW1hLnByb3RvdHlwZS5jYXN0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gJycpXG4gICAgcmV0dXJuIG51bGw7XG5cbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSlcbiAgICByZXR1cm4gdmFsdWU7XG5cbiAgdmFyIGRhdGU7XG5cbiAgLy8gc3VwcG9ydCBmb3IgdGltZXN0YW1wc1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBOdW1iZXIgfHwgJ251bWJlcicgPT0gdHlwZW9mIHZhbHVlXG4gICAgICB8fCBTdHJpbmcodmFsdWUpID09IE51bWJlcih2YWx1ZSkpXG4gICAgZGF0ZSA9IG5ldyBEYXRlKE51bWJlcih2YWx1ZSkpO1xuXG4gIC8vIHN1cHBvcnQgZm9yIGRhdGUgc3RyaW5nc1xuICBlbHNlIGlmICh2YWx1ZS50b1N0cmluZylcbiAgICBkYXRlID0gbmV3IERhdGUodmFsdWUudG9TdHJpbmcoKSk7XG5cbiAgaWYgKGRhdGUudG9TdHJpbmcoKSAhPSAnSW52YWxpZCBEYXRlJylcbiAgICByZXR1cm4gZGF0ZTtcblxuICB0aHJvdyBuZXcgQ2FzdEVycm9yKCdkYXRlJywgdmFsdWUsIHRoaXMucGF0aCApO1xufTtcblxuLyohXG4gKiBNb2R1bGUgZXhwb3J0cy5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IERhdGVTY2hlbWE7XG4iLCJcbi8qIVxuICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAqL1xuXG52YXIgU2NoZW1hVHlwZSA9IHJlcXVpcmUoJy4uL3NjaGVtYXR5cGUnKVxuICAsIEFycmF5VHlwZSA9IHJlcXVpcmUoJy4vYXJyYXknKVxuICAsIFN0b3JhZ2VEb2N1bWVudEFycmF5ID0gcmVxdWlyZSgnLi4vdHlwZXMvZG9jdW1lbnRhcnJheScpXG4gICwgU3ViZG9jdW1lbnQgPSByZXF1aXJlKCcuLi90eXBlcy9lbWJlZGRlZCcpXG4gICwgRG9jdW1lbnQgPSByZXF1aXJlKCcuLi9kb2N1bWVudCcpO1xuXG4vKipcbiAqIFN1YmRvY3NBcnJheSBTY2hlbWFUeXBlIGNvbnN0cnVjdG9yXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHtTY2hlbWF9IHNjaGVtYVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBpbmhlcml0cyBTY2hlbWFBcnJheVxuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIERvY3VtZW50QXJyYXkgKGtleSwgc2NoZW1hLCBvcHRpb25zKSB7XG5cbiAgLy8gY29tcGlsZSBhbiBlbWJlZGRlZCBkb2N1bWVudCBmb3IgdGhpcyBzY2hlbWFcbiAgZnVuY3Rpb24gRW1iZWRkZWREb2N1bWVudCAoKSB7XG4gICAgU3ViZG9jdW1lbnQuYXBwbHkoIHRoaXMsIGFyZ3VtZW50cyApO1xuICB9XG5cbiAgRW1iZWRkZWREb2N1bWVudC5wcm90b3R5cGUuX19wcm90b19fID0gU3ViZG9jdW1lbnQucHJvdG90eXBlO1xuICBFbWJlZGRlZERvY3VtZW50LnByb3RvdHlwZS4kX19zZXRTY2hlbWEoIHNjaGVtYSApO1xuXG4gIC8vIGFwcGx5IG1ldGhvZHNcbiAgZm9yICh2YXIgaSBpbiBzY2hlbWEubWV0aG9kcykge1xuICAgIEVtYmVkZGVkRG9jdW1lbnQucHJvdG90eXBlW2ldID0gc2NoZW1hLm1ldGhvZHNbaV07XG4gIH1cblxuICAvLyBhcHBseSBzdGF0aWNzXG4gIGZvciAodmFyIGkgaW4gc2NoZW1hLnN0YXRpY3MpIHtcbiAgICBFbWJlZGRlZERvY3VtZW50W2ldID0gc2NoZW1hLnN0YXRpY3NbaV07XG4gIH1cblxuICBFbWJlZGRlZERvY3VtZW50Lm9wdGlvbnMgPSBvcHRpb25zO1xuICB0aGlzLnNjaGVtYSA9IHNjaGVtYTtcblxuICBBcnJheVR5cGUuY2FsbCh0aGlzLCBrZXksIEVtYmVkZGVkRG9jdW1lbnQsIG9wdGlvbnMpO1xuXG4gIHRoaXMuc2NoZW1hID0gc2NoZW1hO1xuICB2YXIgcGF0aCA9IHRoaXMucGF0aDtcbiAgdmFyIGZuID0gdGhpcy5kZWZhdWx0VmFsdWU7XG5cbiAgdGhpcy5kZWZhdWx0KGZ1bmN0aW9uKCl7XG4gICAgdmFyIGFyciA9IGZuLmNhbGwodGhpcyk7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGFycikpIGFyciA9IFthcnJdO1xuICAgIHJldHVybiBuZXcgU3RvcmFnZURvY3VtZW50QXJyYXkoYXJyLCBwYXRoLCB0aGlzKTtcbiAgfSk7XG59XG5cbi8qIVxuICogSW5oZXJpdHMgZnJvbSBBcnJheVR5cGUuXG4gKi9cbkRvY3VtZW50QXJyYXkucHJvdG90eXBlLl9fcHJvdG9fXyA9IEFycmF5VHlwZS5wcm90b3R5cGU7XG5cbi8qKlxuICogUGVyZm9ybXMgbG9jYWwgdmFsaWRhdGlvbnMgZmlyc3QsIHRoZW4gdmFsaWRhdGlvbnMgb24gZWFjaCBlbWJlZGRlZCBkb2NcbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuRG9jdW1lbnRBcnJheS5wcm90b3R5cGUuZG9WYWxpZGF0ZSA9IGZ1bmN0aW9uIChhcnJheSwgZm4sIHNjb3BlKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBTY2hlbWFUeXBlLnByb3RvdHlwZS5kb1ZhbGlkYXRlLmNhbGwodGhpcywgYXJyYXksIGZ1bmN0aW9uIChlcnIpIHtcbiAgICBpZiAoZXJyKSByZXR1cm4gZm4oZXJyKTtcblxuICAgIHZhciBjb3VudCA9IGFycmF5ICYmIGFycmF5Lmxlbmd0aFxuICAgICAgLCBlcnJvcjtcblxuICAgIGlmICghY291bnQpIHJldHVybiBmbigpO1xuXG4gICAgLy8gaGFuZGxlIHNwYXJzZSBhcnJheXMsIGRvIG5vdCB1c2UgYXJyYXkuZm9yRWFjaCB3aGljaCBkb2VzIG5vdFxuICAgIC8vIGl0ZXJhdGUgb3ZlciBzcGFyc2UgZWxlbWVudHMgeWV0IHJlcG9ydHMgYXJyYXkubGVuZ3RoIGluY2x1ZGluZ1xuICAgIC8vIHRoZW0gOihcblxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb3VudDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAvLyBzaWRlc3RlcCBzcGFyc2UgZW50cmllc1xuICAgICAgdmFyIGRvYyA9IGFycmF5W2ldO1xuICAgICAgaWYgKCFkb2MpIHtcbiAgICAgICAgLS1jb3VudCB8fCBmbigpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgOyhmdW5jdGlvbiAoaSkge1xuICAgICAgICBkb2MudmFsaWRhdGUoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgIGlmIChlcnIgJiYgIWVycm9yKSB7XG4gICAgICAgICAgICAvLyByZXdyaXRlIHRoZSBrZXlcbiAgICAgICAgICAgIGVyci5rZXkgPSBzZWxmLmtleSArICcuJyArIGkgKyAnLicgKyBlcnIua2V5O1xuICAgICAgICAgICAgcmV0dXJuIGZuKGVycm9yID0gZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLS1jb3VudCB8fCBmbigpO1xuICAgICAgICB9KTtcbiAgICAgIH0pKGkpO1xuICAgIH1cbiAgfSwgc2NvcGUpO1xufTtcblxuLyoqXG4gKiBDYXN0cyBjb250ZW50c1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jIHRoYXQgdHJpZ2dlcnMgdGhlIGNhc3RpbmdcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5Eb2N1bWVudEFycmF5LnByb3RvdHlwZS5jYXN0ID0gZnVuY3Rpb24gKHZhbHVlLCBkb2MsIGluaXQsIHByZXYpIHtcbiAgdmFyIHNlbGVjdGVkXG4gICAgLCBzdWJkb2NcbiAgICAsIGk7XG5cbiAgaWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHJldHVybiB0aGlzLmNhc3QoW3ZhbHVlXSwgZG9jLCBpbml0LCBwcmV2KTtcbiAgfVxuXG4gIGlmICghKHZhbHVlIGluc3RhbmNlb2YgU3RvcmFnZURvY3VtZW50QXJyYXkpKSB7XG4gICAgdmFsdWUgPSBuZXcgU3RvcmFnZURvY3VtZW50QXJyYXkodmFsdWUsIHRoaXMucGF0aCwgZG9jKTtcbiAgICBpZiAocHJldiAmJiBwcmV2Ll9oYW5kbGVycykge1xuICAgICAgZm9yICh2YXIga2V5IGluIHByZXYuX2hhbmRsZXJzKSB7XG4gICAgICAgIGRvYy5vZmYoa2V5LCBwcmV2Ll9oYW5kbGVyc1trZXldKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpID0gdmFsdWUubGVuZ3RoO1xuXG4gIHdoaWxlIChpLS0pIHtcbiAgICBpZiAoISh2YWx1ZVtpXSBpbnN0YW5jZW9mIFN1YmRvY3VtZW50KSAmJiB2YWx1ZVtpXSkge1xuICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgc2VsZWN0ZWQgfHwgKHNlbGVjdGVkID0gc2NvcGVQYXRocyh0aGlzLCBkb2MuJF9fLnNlbGVjdGVkLCBpbml0KSk7XG4gICAgICAgIHN1YmRvYyA9IG5ldyB0aGlzLmNhc3RlckNvbnN0cnVjdG9yKG51bGwsIHZhbHVlLCB0cnVlLCBzZWxlY3RlZCk7XG4gICAgICAgIHZhbHVlW2ldID0gc3ViZG9jLmluaXQodmFsdWVbaV0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBzdWJkb2MgPSBwcmV2LmlkKHZhbHVlW2ldLl9pZCk7XG4gICAgICAgIH0gY2F0Y2goZSkge31cblxuICAgICAgICBpZiAocHJldiAmJiBzdWJkb2MpIHtcbiAgICAgICAgICAvLyBoYW5kbGUgcmVzZXR0aW5nIGRvYyB3aXRoIGV4aXN0aW5nIGlkIGJ1dCBkaWZmZXJpbmcgZGF0YVxuICAgICAgICAgIC8vIGRvYy5hcnJheSA9IFt7IGRvYzogJ3ZhbCcgfV1cbiAgICAgICAgICBzdWJkb2Muc2V0KHZhbHVlW2ldKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdWJkb2MgPSBuZXcgdGhpcy5jYXN0ZXJDb25zdHJ1Y3Rvcih2YWx1ZVtpXSwgdmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgc2V0KCkgaXMgaG9va2VkIGl0IHdpbGwgaGF2ZSBubyByZXR1cm4gdmFsdWVcbiAgICAgICAgLy8gc2VlIGdoLTc0NlxuICAgICAgICB2YWx1ZVtpXSA9IHN1YmRvYztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdmFsdWU7XG59O1xuXG4vKiFcbiAqIFNjb3BlcyBwYXRocyBzZWxlY3RlZCBpbiBhIHF1ZXJ5IHRvIHRoaXMgYXJyYXkuXG4gKiBOZWNlc3NhcnkgZm9yIHByb3BlciBkZWZhdWx0IGFwcGxpY2F0aW9uIG9mIHN1YmRvY3VtZW50IHZhbHVlcy5cbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50QXJyYXl9IGFycmF5IC0gdGhlIGFycmF5IHRvIHNjb3BlIGBmaWVsZHNgIHBhdGhzXG4gKiBAcGFyYW0ge09iamVjdHx1bmRlZmluZWR9IGZpZWxkcyAtIHRoZSByb290IGZpZWxkcyBzZWxlY3RlZCBpbiB0aGUgcXVlcnlcbiAqIEBwYXJhbSB7Qm9vbGVhbnx1bmRlZmluZWR9IGluaXQgLSBpZiB3ZSBhcmUgYmVpbmcgY3JlYXRlZCBwYXJ0IG9mIGEgcXVlcnkgcmVzdWx0XG4gKi9cbmZ1bmN0aW9uIHNjb3BlUGF0aHMgKGFycmF5LCBmaWVsZHMsIGluaXQpIHtcbiAgaWYgKCEoaW5pdCAmJiBmaWVsZHMpKSByZXR1cm4gdW5kZWZpbmVkO1xuXG4gIHZhciBwYXRoID0gYXJyYXkucGF0aCArICcuJ1xuICAgICwga2V5cyA9IE9iamVjdC5rZXlzKGZpZWxkcylcbiAgICAsIGkgPSBrZXlzLmxlbmd0aFxuICAgICwgc2VsZWN0ZWQgPSB7fVxuICAgICwgaGFzS2V5c1xuICAgICwga2V5O1xuXG4gIHdoaWxlIChpLS0pIHtcbiAgICBrZXkgPSBrZXlzW2ldO1xuICAgIGlmICgwID09PSBrZXkuaW5kZXhPZihwYXRoKSkge1xuICAgICAgaGFzS2V5cyB8fCAoaGFzS2V5cyA9IHRydWUpO1xuICAgICAgc2VsZWN0ZWRba2V5LnN1YnN0cmluZyhwYXRoLmxlbmd0aCldID0gZmllbGRzW2tleV07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGhhc0tleXMgJiYgc2VsZWN0ZWQgfHwgdW5kZWZpbmVkO1xufVxuXG4vKiFcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gRG9jdW1lbnRBcnJheTtcbiIsIlxuLyohXG4gKiBNb2R1bGUgZXhwb3J0cy5cbiAqL1xuXG5leHBvcnRzLlN0cmluZyA9IHJlcXVpcmUoJy4vc3RyaW5nJyk7XG5cbmV4cG9ydHMuTnVtYmVyID0gcmVxdWlyZSgnLi9udW1iZXInKTtcblxuZXhwb3J0cy5Cb29sZWFuID0gcmVxdWlyZSgnLi9ib29sZWFuJyk7XG5cbmV4cG9ydHMuRG9jdW1lbnRBcnJheSA9IHJlcXVpcmUoJy4vZG9jdW1lbnRhcnJheScpO1xuXG5leHBvcnRzLkFycmF5ID0gcmVxdWlyZSgnLi9hcnJheScpO1xuXG5leHBvcnRzLkRhdGUgPSByZXF1aXJlKCcuL2RhdGUnKTtcblxuZXhwb3J0cy5PYmplY3RJZCA9IHJlcXVpcmUoJy4vb2JqZWN0aWQnKTtcblxuZXhwb3J0cy5NaXhlZCA9IHJlcXVpcmUoJy4vbWl4ZWQnKTtcblxuLy8gYWxpYXNcblxuZXhwb3J0cy5PaWQgPSBleHBvcnRzLk9iamVjdElkO1xuZXhwb3J0cy5PYmplY3QgPSBleHBvcnRzLk1peGVkO1xuZXhwb3J0cy5Cb29sID0gZXhwb3J0cy5Cb29sZWFuO1xuIiwiLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBTY2hlbWFUeXBlID0gcmVxdWlyZSgnLi4vc2NoZW1hdHlwZScpO1xuXG4vKipcbiAqIE1peGVkIFNjaGVtYVR5cGUgY29uc3RydWN0b3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAaW5oZXJpdHMgU2NoZW1hVHlwZVxuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIE1peGVkIChwYXRoLCBvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZGVmYXVsdCkge1xuICAgIHZhciBkZWYgPSBvcHRpb25zLmRlZmF1bHQ7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZGVmKSAmJiAwID09PSBkZWYubGVuZ3RoKSB7XG4gICAgICAvLyBtYWtlIHN1cmUgZW1wdHkgYXJyYXkgZGVmYXVsdHMgYXJlIGhhbmRsZWRcbiAgICAgIG9wdGlvbnMuZGVmYXVsdCA9IEFycmF5O1xuICAgIH0gZWxzZSBpZiAoIW9wdGlvbnMuc2hhcmVkICYmXG4gICAgICAgICAgICAgICBfLmlzUGxhaW5PYmplY3QoZGVmKSAmJlxuICAgICAgICAgICAgICAgMCA9PT0gT2JqZWN0LmtleXMoZGVmKS5sZW5ndGgpIHtcbiAgICAgIC8vIHByZXZlbnQgb2RkIFwic2hhcmVkXCIgb2JqZWN0cyBiZXR3ZWVuIGRvY3VtZW50c1xuICAgICAgb3B0aW9ucy5kZWZhdWx0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge31cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBTY2hlbWFUeXBlLmNhbGwodGhpcywgcGF0aCwgb3B0aW9ucyk7XG59XG5cbi8qIVxuICogSW5oZXJpdHMgZnJvbSBTY2hlbWFUeXBlLlxuICovXG5NaXhlZC5wcm90b3R5cGUuX19wcm90b19fID0gU2NoZW1hVHlwZS5wcm90b3R5cGU7XG5cbi8qKlxuICogUmVxdWlyZWQgdmFsaWRhdG9yXG4gKlxuICogQGFwaSBwcml2YXRlXG4gKi9cbk1peGVkLnByb3RvdHlwZS5jaGVja1JlcXVpcmVkID0gZnVuY3Rpb24gKHZhbCkge1xuICByZXR1cm4gKHZhbCAhPT0gdW5kZWZpbmVkKSAmJiAodmFsICE9PSBudWxsKTtcbn07XG5cbi8qKlxuICogQ2FzdHMgYHZhbGAgZm9yIE1peGVkLlxuICpcbiAqIF90aGlzIGlzIGEgbm8tb3BfXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlIHRvIGNhc3RcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5NaXhlZC5wcm90b3R5cGUuY2FzdCA9IGZ1bmN0aW9uICh2YWwpIHtcbiAgcmV0dXJuIHZhbDtcbn07XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBNaXhlZDtcbiIsIi8qIVxuICogTW9kdWxlIHJlcXVpcmVtZW50cy5cbiAqL1xuXG52YXIgU2NoZW1hVHlwZSA9IHJlcXVpcmUoJy4uL3NjaGVtYXR5cGUnKVxuICAsIENhc3RFcnJvciA9IFNjaGVtYVR5cGUuQ2FzdEVycm9yXG4gICwgZXJyb3JNZXNzYWdlcyA9IHJlcXVpcmUoJy4uL2Vycm9yJykubWVzc2FnZXM7XG5cbi8qKlxuICogTnVtYmVyIFNjaGVtYVR5cGUgY29uc3RydWN0b3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBpbmhlcml0cyBTY2hlbWFUeXBlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gTnVtYmVyU2NoZW1hIChrZXksIG9wdGlvbnMpIHtcbiAgU2NoZW1hVHlwZS5jYWxsKHRoaXMsIGtleSwgb3B0aW9ucywgJ051bWJlcicpO1xufVxuXG4vKiFcbiAqIEluaGVyaXRzIGZyb20gU2NoZW1hVHlwZS5cbiAqL1xuTnVtYmVyU2NoZW1hLnByb3RvdHlwZS5fX3Byb3RvX18gPSBTY2hlbWFUeXBlLnByb3RvdHlwZTtcblxuLyoqXG4gKiBSZXF1aXJlZCB2YWxpZGF0b3IgZm9yIG51bWJlclxuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5OdW1iZXJTY2hlbWEucHJvdG90eXBlLmNoZWNrUmVxdWlyZWQgPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuICBpZiAoIFNjaGVtYVR5cGUuX2lzUmVmKCB0aGlzLCB2YWx1ZSApICkge1xuICAgIHJldHVybiBudWxsICE9IHZhbHVlO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgfHwgdmFsdWUgaW5zdGFuY2VvZiBOdW1iZXI7XG4gIH1cbn07XG5cbi8qKlxuICogU2V0cyBhIG1pbmltdW0gbnVtYmVyIHZhbGlkYXRvci5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIHMgPSBuZXcgU2NoZW1hKHsgbjogeyB0eXBlOiBOdW1iZXIsIG1pbjogMTAgfSlcbiAqICAgICB2YXIgTSA9IGRiLm1vZGVsKCdNJywgcylcbiAqICAgICB2YXIgbSA9IG5ldyBNKHsgbjogOSB9KVxuICogICAgIG0uc2F2ZShmdW5jdGlvbiAoZXJyKSB7XG4gKiAgICAgICBjb25zb2xlLmVycm9yKGVycikgLy8gdmFsaWRhdG9yIGVycm9yXG4gKiAgICAgICBtLm4gPSAxMDtcbiAqICAgICAgIG0uc2F2ZSgpIC8vIHN1Y2Nlc3NcbiAqICAgICB9KVxuICpcbiAqICAgICAvLyBjdXN0b20gZXJyb3IgbWVzc2FnZXNcbiAqICAgICAvLyBXZSBjYW4gYWxzbyB1c2UgdGhlIHNwZWNpYWwge01JTn0gdG9rZW4gd2hpY2ggd2lsbCBiZSByZXBsYWNlZCB3aXRoIHRoZSBpbnZhbGlkIHZhbHVlXG4gKiAgICAgdmFyIG1pbiA9IFsxMCwgJ1RoZSB2YWx1ZSBvZiBwYXRoIGB7UEFUSH1gICh7VkFMVUV9KSBpcyBiZW5lYXRoIHRoZSBsaW1pdCAoe01JTn0pLiddO1xuICogICAgIHZhciBzY2hlbWEgPSBuZXcgU2NoZW1hKHsgbjogeyB0eXBlOiBOdW1iZXIsIG1pbjogbWluIH0pXG4gKiAgICAgdmFyIE0gPSBtb25nb29zZS5tb2RlbCgnTWVhc3VyZW1lbnQnLCBzY2hlbWEpO1xuICogICAgIHZhciBzPSBuZXcgTSh7IG46IDQgfSk7XG4gKiAgICAgcy52YWxpZGF0ZShmdW5jdGlvbiAoZXJyKSB7XG4gKiAgICAgICBjb25zb2xlLmxvZyhTdHJpbmcoZXJyKSkgLy8gVmFsaWRhdGlvbkVycm9yOiBUaGUgdmFsdWUgb2YgcGF0aCBgbmAgKDQpIGlzIGJlbmVhdGggdGhlIGxpbWl0ICgxMCkuXG4gKiAgICAgfSlcbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgbWluaW11bSBudW1iZXJcbiAqIEBwYXJhbSB7U3RyaW5nfSBbbWVzc2FnZV0gb3B0aW9uYWwgY3VzdG9tIGVycm9yIG1lc3NhZ2VcbiAqIEByZXR1cm4ge1NjaGVtYVR5cGV9IHRoaXNcbiAqIEBzZWUgQ3VzdG9taXplZCBFcnJvciBNZXNzYWdlcyAjZXJyb3JfbWVzc2FnZXNfTW9uZ29vc2VFcnJvci1tZXNzYWdlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuTnVtYmVyU2NoZW1hLnByb3RvdHlwZS5taW4gPSBmdW5jdGlvbiAodmFsdWUsIG1lc3NhZ2UpIHtcbiAgaWYgKHRoaXMubWluVmFsaWRhdG9yKSB7XG4gICAgdGhpcy52YWxpZGF0b3JzID0gdGhpcy52YWxpZGF0b3JzLmZpbHRlcihmdW5jdGlvbiAodikge1xuICAgICAgcmV0dXJuIHZbMF0gIT0gdGhpcy5taW5WYWxpZGF0b3I7XG4gICAgfSwgdGhpcyk7XG4gIH1cblxuICBpZiAobnVsbCAhPSB2YWx1ZSkge1xuICAgIHZhciBtc2cgPSBtZXNzYWdlIHx8IGVycm9yTWVzc2FnZXMuTnVtYmVyLm1pbjtcbiAgICBtc2cgPSBtc2cucmVwbGFjZSgve01JTn0vLCB2YWx1ZSk7XG4gICAgdGhpcy52YWxpZGF0b3JzLnB1c2goW3RoaXMubWluVmFsaWRhdG9yID0gZnVuY3Rpb24gKHYpIHtcbiAgICAgIHJldHVybiB2ID09PSBudWxsIHx8IHYgPj0gdmFsdWU7XG4gICAgfSwgbXNnLCAnbWluJ10pO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFNldHMgYSBtYXhpbXVtIG51bWJlciB2YWxpZGF0b3IuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIHZhciBzID0gbmV3IFNjaGVtYSh7IG46IHsgdHlwZTogTnVtYmVyLCBtYXg6IDEwIH0pXG4gKiAgICAgdmFyIE0gPSBkYi5tb2RlbCgnTScsIHMpXG4gKiAgICAgdmFyIG0gPSBuZXcgTSh7IG46IDExIH0pXG4gKiAgICAgbS5zYXZlKGZ1bmN0aW9uIChlcnIpIHtcbiAqICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKSAvLyB2YWxpZGF0b3IgZXJyb3JcbiAqICAgICAgIG0ubiA9IDEwO1xuICogICAgICAgbS5zYXZlKCkgLy8gc3VjY2Vzc1xuICogICAgIH0pXG4gKlxuICogICAgIC8vIGN1c3RvbSBlcnJvciBtZXNzYWdlc1xuICogICAgIC8vIFdlIGNhbiBhbHNvIHVzZSB0aGUgc3BlY2lhbCB7TUFYfSB0b2tlbiB3aGljaCB3aWxsIGJlIHJlcGxhY2VkIHdpdGggdGhlIGludmFsaWQgdmFsdWVcbiAqICAgICB2YXIgbWF4ID0gWzEwLCAnVGhlIHZhbHVlIG9mIHBhdGggYHtQQVRIfWAgKHtWQUxVRX0pIGV4Y2VlZHMgdGhlIGxpbWl0ICh7TUFYfSkuJ107XG4gKiAgICAgdmFyIHNjaGVtYSA9IG5ldyBTY2hlbWEoeyBuOiB7IHR5cGU6IE51bWJlciwgbWF4OiBtYXggfSlcbiAqICAgICB2YXIgTSA9IG1vbmdvb3NlLm1vZGVsKCdNZWFzdXJlbWVudCcsIHNjaGVtYSk7XG4gKiAgICAgdmFyIHM9IG5ldyBNKHsgbjogNCB9KTtcbiAqICAgICBzLnZhbGlkYXRlKGZ1bmN0aW9uIChlcnIpIHtcbiAqICAgICAgIGNvbnNvbGUubG9nKFN0cmluZyhlcnIpKSAvLyBWYWxpZGF0aW9uRXJyb3I6IFRoZSB2YWx1ZSBvZiBwYXRoIGBuYCAoNCkgZXhjZWVkcyB0aGUgbGltaXQgKDEwKS5cbiAqICAgICB9KVxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSBtYXhpbXVtIG51bWJlclxuICogQHBhcmFtIHtTdHJpbmd9IFttZXNzYWdlXSBvcHRpb25hbCBjdXN0b20gZXJyb3IgbWVzc2FnZVxuICogQHJldHVybiB7U2NoZW1hVHlwZX0gdGhpc1xuICogQHNlZSBDdXN0b21pemVkIEVycm9yIE1lc3NhZ2VzICNlcnJvcl9tZXNzYWdlc19Nb25nb29zZUVycm9yLW1lc3NhZ2VzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5OdW1iZXJTY2hlbWEucHJvdG90eXBlLm1heCA9IGZ1bmN0aW9uICh2YWx1ZSwgbWVzc2FnZSkge1xuICBpZiAodGhpcy5tYXhWYWxpZGF0b3IpIHtcbiAgICB0aGlzLnZhbGlkYXRvcnMgPSB0aGlzLnZhbGlkYXRvcnMuZmlsdGVyKGZ1bmN0aW9uKHYpe1xuICAgICAgcmV0dXJuIHZbMF0gIT0gdGhpcy5tYXhWYWxpZGF0b3I7XG4gICAgfSwgdGhpcyk7XG4gIH1cblxuICBpZiAobnVsbCAhPSB2YWx1ZSkge1xuICAgIHZhciBtc2cgPSBtZXNzYWdlIHx8IGVycm9yTWVzc2FnZXMuTnVtYmVyLm1heDtcbiAgICBtc2cgPSBtc2cucmVwbGFjZSgve01BWH0vLCB2YWx1ZSk7XG4gICAgdGhpcy52YWxpZGF0b3JzLnB1c2goW3RoaXMubWF4VmFsaWRhdG9yID0gZnVuY3Rpb24odil7XG4gICAgICByZXR1cm4gdiA9PT0gbnVsbCB8fCB2IDw9IHZhbHVlO1xuICAgIH0sIG1zZywgJ21heCddKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBDYXN0cyB0byBudW1iZXJcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWUgdmFsdWUgdG8gY2FzdFxuICogQGFwaSBwcml2YXRlXG4gKi9cbk51bWJlclNjaGVtYS5wcm90b3R5cGUuY2FzdCA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG4gIHZhciB2YWwgPSB2YWx1ZSAmJiB2YWx1ZS5faWRcbiAgICA/IHZhbHVlLl9pZCAvLyBkb2N1bWVudHNcbiAgICA6IHZhbHVlO1xuXG4gIGlmICghaXNOYU4odmFsKSl7XG4gICAgaWYgKG51bGwgPT09IHZhbCkgcmV0dXJuIHZhbDtcbiAgICBpZiAoJycgPT09IHZhbCkgcmV0dXJuIG51bGw7XG4gICAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiB2YWwpIHZhbCA9IE51bWJlcih2YWwpO1xuICAgIGlmICh2YWwgaW5zdGFuY2VvZiBOdW1iZXIpIHJldHVybiB2YWxcbiAgICBpZiAoJ251bWJlcicgPT0gdHlwZW9mIHZhbCkgcmV0dXJuIHZhbDtcbiAgICBpZiAodmFsLnRvU3RyaW5nICYmICFBcnJheS5pc0FycmF5KHZhbCkgJiZcbiAgICAgICAgdmFsLnRvU3RyaW5nKCkgPT0gTnVtYmVyKHZhbCkpIHtcbiAgICAgIHJldHVybiBuZXcgTnVtYmVyKHZhbCk7XG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IENhc3RFcnJvcignbnVtYmVyJywgdmFsdWUsIHRoaXMucGF0aCk7XG59O1xuXG4vKiFcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gTnVtYmVyU2NoZW1hO1xuIiwiLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBTY2hlbWFUeXBlID0gcmVxdWlyZSgnLi4vc2NoZW1hdHlwZScpXG4gICwgQ2FzdEVycm9yID0gU2NoZW1hVHlwZS5DYXN0RXJyb3JcbiAgLCBvaWQgPSByZXF1aXJlKCcuLi90eXBlcy9vYmplY3RpZCcpXG4gICwgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpXG4gICwgRG9jdW1lbnQ7XG5cbi8qKlxuICogT2JqZWN0SWQgU2NoZW1hVHlwZSBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQGluaGVyaXRzIFNjaGVtYVR5cGVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIE9iamVjdElkIChrZXksIG9wdGlvbnMpIHtcbiAgU2NoZW1hVHlwZS5jYWxsKHRoaXMsIGtleSwgb3B0aW9ucywgJ09iamVjdElkJyk7XG59XG5cbi8qIVxuICogSW5oZXJpdHMgZnJvbSBTY2hlbWFUeXBlLlxuICovXG5cbk9iamVjdElkLnByb3RvdHlwZS5fX3Byb3RvX18gPSBTY2hlbWFUeXBlLnByb3RvdHlwZTtcblxuLyoqXG4gKiBBZGRzIGFuIGF1dG8tZ2VuZXJhdGVkIE9iamVjdElkIGRlZmF1bHQgaWYgdHVybk9uIGlzIHRydWUuXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHR1cm5PbiBhdXRvIGdlbmVyYXRlZCBPYmplY3RJZCBkZWZhdWx0c1xuICogQGFwaSBwdWJsaWNcbiAqIEByZXR1cm4ge1NjaGVtYVR5cGV9IHRoaXNcbiAqL1xuT2JqZWN0SWQucHJvdG90eXBlLmF1dG8gPSBmdW5jdGlvbiAoIHR1cm5PbiApIHtcbiAgaWYgKCB0dXJuT24gKSB7XG4gICAgdGhpcy5kZWZhdWx0KCBkZWZhdWx0SWQgKTtcbiAgICB0aGlzLnNldCggcmVzZXRJZCApXG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQ2hlY2sgcmVxdWlyZWRcbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuT2JqZWN0SWQucHJvdG90eXBlLmNoZWNrUmVxdWlyZWQgPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuICBpZiAoU2NoZW1hVHlwZS5faXNSZWYoIHRoaXMsIHZhbHVlICkpIHtcbiAgICByZXR1cm4gbnVsbCAhPSB2YWx1ZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBvaWQ7XG4gIH1cbn07XG5cbi8qKlxuICogQ2FzdHMgdG8gT2JqZWN0SWRcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5PYmplY3RJZC5wcm90b3R5cGUuY2FzdCA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG4gIGlmICggU2NoZW1hVHlwZS5faXNSZWYoIHRoaXMsIHZhbHVlICkgKSB7XG4gICAgLy8gd2FpdCEgd2UgbWF5IG5lZWQgdG8gY2FzdCB0aGlzIHRvIGEgZG9jdW1lbnRcblxuICAgIGlmIChudWxsID09IHZhbHVlKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgLy8gbGF6eSBsb2FkXG4gICAgRG9jdW1lbnQgfHwgKERvY3VtZW50ID0gcmVxdWlyZSgnLi8uLi9kb2N1bWVudCcpKTtcblxuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERvY3VtZW50KSB7XG4gICAgICB2YWx1ZS4kX18ud2FzUG9wdWxhdGVkID0gdHJ1ZTtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICAvLyBzZXR0aW5nIGEgcG9wdWxhdGVkIHBhdGhcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBvaWQgKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSBlbHNlIGlmICggIV8uaXNQbGFpbk9iamVjdCggdmFsdWUgKSApIHtcbiAgICAgIHRocm93IG5ldyBDYXN0RXJyb3IoJ09iamVjdElkJywgdmFsdWUsIHRoaXMucGF0aCk7XG4gICAgfVxuXG4gICAgLy8g0J3Rg9C20L3QviDRgdC+0LfQtNCw0YLRjCDQtNC+0LrRg9C80LXQvdGCINC/0L4g0YHRhdC10LzQtSwg0YPQutCw0LfQsNC90L3QvtC5INCyINGB0YHRi9C70LrQtVxuICAgIHZhciBzY2hlbWEgPSB0aGlzLm9wdGlvbnMucmVmO1xuICAgIGlmICggIXNjaGVtYSApe1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcign0J/RgNC4INGB0YHRi9C70LrQtSAocmVmKSDQvdCwINC00L7QutGD0LzQtdC90YIgJyArXG4gICAgICAgICfQvdGD0LbQvdC+INGD0LrQsNC30YvQstCw0YLRjCDRgdGF0LXQvNGDLCDQv9C+INC60L7RgtC+0YDQvtC5INGN0YLQvtGCINC00L7QutGD0LzQtdC90YIg0YHQvtC30LTQsNCy0LDRgtGMJyk7XG4gICAgfVxuXG4gICAgdmFyIGRvYyA9IG5ldyBEb2N1bWVudCggdmFsdWUsIHVuZGVmaW5lZCwgc3RvcmFnZS5zY2hlbWFzWyBzY2hlbWEgXSApO1xuICAgIGRvYy4kX18ud2FzUG9wdWxhdGVkID0gdHJ1ZTtcblxuICAgIHJldHVybiBkb2M7XG4gIH1cblxuICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiB2YWx1ZTtcblxuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBvaWQpXG4gICAgcmV0dXJuIHZhbHVlO1xuXG4gIGlmICggdmFsdWUuX2lkICYmIHZhbHVlLl9pZCBpbnN0YW5jZW9mIG9pZCApXG4gICAgcmV0dXJuIHZhbHVlLl9pZDtcblxuICBpZiAodmFsdWUudG9TdHJpbmcpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIG5ldyBvaWQoIHZhbHVlLnRvU3RyaW5nKCkgKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRocm93IG5ldyBDYXN0RXJyb3IoJ09iamVjdElkJywgdmFsdWUsIHRoaXMucGF0aCk7XG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IENhc3RFcnJvcignT2JqZWN0SWQnLCB2YWx1ZSwgdGhpcy5wYXRoKTtcbn07XG5cbi8qIVxuICogaWdub3JlXG4gKi9cbmZ1bmN0aW9uIGRlZmF1bHRJZCAoKSB7XG4gIHJldHVybiBuZXcgb2lkKCk7XG59XG5cbmZ1bmN0aW9uIHJlc2V0SWQgKHYpIHtcbiAgdGhpcy4kX18uX2lkID0gbnVsbDtcbiAgcmV0dXJuIHY7XG59XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBPYmplY3RJZDtcbiIsIi8qIVxuICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAqL1xuXG52YXIgU2NoZW1hVHlwZSA9IHJlcXVpcmUoJy4uL3NjaGVtYXR5cGUnKVxuICAsIENhc3RFcnJvciA9IFNjaGVtYVR5cGUuQ2FzdEVycm9yXG4gICwgZXJyb3JNZXNzYWdlcyA9IHJlcXVpcmUoJy4uL2Vycm9yJykubWVzc2FnZXM7XG5cbi8qKlxuICogU3RyaW5nIFNjaGVtYVR5cGUgY29uc3RydWN0b3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBpbmhlcml0cyBTY2hlbWFUeXBlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBTdHJpbmdTY2hlbWEgKGtleSwgb3B0aW9ucykge1xuICB0aGlzLmVudW1WYWx1ZXMgPSBbXTtcbiAgdGhpcy5yZWdFeHAgPSBudWxsO1xuICBTY2hlbWFUeXBlLmNhbGwodGhpcywga2V5LCBvcHRpb25zLCAnU3RyaW5nJyk7XG59XG5cbi8qIVxuICogSW5oZXJpdHMgZnJvbSBTY2hlbWFUeXBlLlxuICovXG5TdHJpbmdTY2hlbWEucHJvdG90eXBlLl9fcHJvdG9fXyA9IFNjaGVtYVR5cGUucHJvdG90eXBlO1xuXG4vKipcbiAqIEFkZHMgYW4gZW51bSB2YWxpZGF0b3JcbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIHN0YXRlcyA9ICdvcGVuaW5nIG9wZW4gY2xvc2luZyBjbG9zZWQnLnNwbGl0KCcgJylcbiAqICAgICB2YXIgcyA9IG5ldyBTY2hlbWEoeyBzdGF0ZTogeyB0eXBlOiBTdHJpbmcsIGVudW06IHN0YXRlcyB9fSlcbiAqICAgICB2YXIgTSA9IGRiLm1vZGVsKCdNJywgcylcbiAqICAgICB2YXIgbSA9IG5ldyBNKHsgc3RhdGU6ICdpbnZhbGlkJyB9KVxuICogICAgIG0uc2F2ZShmdW5jdGlvbiAoZXJyKSB7XG4gKiAgICAgICBjb25zb2xlLmVycm9yKFN0cmluZyhlcnIpKSAvLyBWYWxpZGF0aW9uRXJyb3I6IGBpbnZhbGlkYCBpcyBub3QgYSB2YWxpZCBlbnVtIHZhbHVlIGZvciBwYXRoIGBzdGF0ZWAuXG4gKiAgICAgICBtLnN0YXRlID0gJ29wZW4nXG4gKiAgICAgICBtLnNhdmUoY2FsbGJhY2spIC8vIHN1Y2Nlc3NcbiAqICAgICB9KVxuICpcbiAqICAgICAvLyBvciB3aXRoIGN1c3RvbSBlcnJvciBtZXNzYWdlc1xuICogICAgIHZhciBlbnUgPSB7XG4gKiAgICAgICB2YWx1ZXM6ICdvcGVuaW5nIG9wZW4gY2xvc2luZyBjbG9zZWQnLnNwbGl0KCcgJyksXG4gKiAgICAgICBtZXNzYWdlOiAnZW51bSB2YWxpZGF0b3IgZmFpbGVkIGZvciBwYXRoIGB7UEFUSH1gIHdpdGggdmFsdWUgYHtWQUxVRX1gJ1xuICogICAgIH1cbiAqICAgICB2YXIgcyA9IG5ldyBTY2hlbWEoeyBzdGF0ZTogeyB0eXBlOiBTdHJpbmcsIGVudW06IGVudSB9KVxuICogICAgIHZhciBNID0gZGIubW9kZWwoJ00nLCBzKVxuICogICAgIHZhciBtID0gbmV3IE0oeyBzdGF0ZTogJ2ludmFsaWQnIH0pXG4gKiAgICAgbS5zYXZlKGZ1bmN0aW9uIChlcnIpIHtcbiAqICAgICAgIGNvbnNvbGUuZXJyb3IoU3RyaW5nKGVycikpIC8vIFZhbGlkYXRpb25FcnJvcjogZW51bSB2YWxpZGF0b3IgZmFpbGVkIGZvciBwYXRoIGBzdGF0ZWAgd2l0aCB2YWx1ZSBgaW52YWxpZGBcbiAqICAgICAgIG0uc3RhdGUgPSAnb3BlbidcbiAqICAgICAgIG0uc2F2ZShjYWxsYmFjaykgLy8gc3VjY2Vzc1xuICogICAgIH0pXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBbYXJncy4uLl0gZW51bWVyYXRpb24gdmFsdWVzXG4gKiBAcmV0dXJuIHtTY2hlbWFUeXBlfSB0aGlzXG4gKiBAc2VlIEN1c3RvbWl6ZWQgRXJyb3IgTWVzc2FnZXMgI2Vycm9yX21lc3NhZ2VzX01vbmdvb3NlRXJyb3ItbWVzc2FnZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblN0cmluZ1NjaGVtYS5wcm90b3R5cGUuZW51bSA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuZW51bVZhbGlkYXRvcikge1xuICAgIHRoaXMudmFsaWRhdG9ycyA9IHRoaXMudmFsaWRhdG9ycy5maWx0ZXIoZnVuY3Rpb24odil7XG4gICAgICByZXR1cm4gdlswXSAhPSB0aGlzLmVudW1WYWxpZGF0b3I7XG4gICAgfSwgdGhpcyk7XG4gICAgdGhpcy5lbnVtVmFsaWRhdG9yID0gZmFsc2U7XG4gIH1cblxuICBpZiAodW5kZWZpbmVkID09PSBhcmd1bWVudHNbMF0gfHwgZmFsc2UgPT09IGFyZ3VtZW50c1swXSkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgdmFyIHZhbHVlcztcbiAgdmFyIGVycm9yTWVzc2FnZTtcblxuICBpZiAoXy5pc1BsYWluT2JqZWN0KGFyZ3VtZW50c1swXSkpIHtcbiAgICB2YWx1ZXMgPSBhcmd1bWVudHNbMF0udmFsdWVzO1xuICAgIGVycm9yTWVzc2FnZSA9IGFyZ3VtZW50c1swXS5tZXNzYWdlO1xuICB9IGVsc2Uge1xuICAgIHZhbHVlcyA9IGFyZ3VtZW50cztcbiAgICBlcnJvck1lc3NhZ2UgPSBlcnJvck1lc3NhZ2VzLlN0cmluZy5lbnVtO1xuICB9XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB2YWx1ZXNbaV0pIHtcbiAgICAgIHRoaXMuZW51bVZhbHVlcy5wdXNoKHRoaXMuY2FzdCh2YWx1ZXNbaV0pKTtcbiAgICB9XG4gIH1cblxuICB2YXIgdmFscyA9IHRoaXMuZW51bVZhbHVlcztcbiAgdGhpcy5lbnVtVmFsaWRhdG9yID0gZnVuY3Rpb24gKHYpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkID09PSB2IHx8IH52YWxzLmluZGV4T2Yodik7XG4gIH07XG4gIHRoaXMudmFsaWRhdG9ycy5wdXNoKFt0aGlzLmVudW1WYWxpZGF0b3IsIGVycm9yTWVzc2FnZSwgJ2VudW0nXSk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEFkZHMgYSBsb3dlcmNhc2Ugc2V0dGVyLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgcyA9IG5ldyBTY2hlbWEoeyBlbWFpbDogeyB0eXBlOiBTdHJpbmcsIGxvd2VyY2FzZTogdHJ1ZSB9fSlcbiAqICAgICB2YXIgTSA9IGRiLm1vZGVsKCdNJywgcyk7XG4gKiAgICAgdmFyIG0gPSBuZXcgTSh7IGVtYWlsOiAnU29tZUVtYWlsQGV4YW1wbGUuQ09NJyB9KTtcbiAqICAgICBjb25zb2xlLmxvZyhtLmVtYWlsKSAvLyBzb21lZW1haWxAZXhhbXBsZS5jb21cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICogQHJldHVybiB7U2NoZW1hVHlwZX0gdGhpc1xuICovXG5TdHJpbmdTY2hlbWEucHJvdG90eXBlLmxvd2VyY2FzZSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuc2V0KGZ1bmN0aW9uICh2LCBzZWxmKSB7XG4gICAgaWYgKCdzdHJpbmcnICE9IHR5cGVvZiB2KSB2ID0gc2VsZi5jYXN0KHYpO1xuICAgIGlmICh2KSByZXR1cm4gdi50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiB2O1xuICB9KTtcbn07XG5cbi8qKlxuICogQWRkcyBhbiB1cHBlcmNhc2Ugc2V0dGVyLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgcyA9IG5ldyBTY2hlbWEoeyBjYXBzOiB7IHR5cGU6IFN0cmluZywgdXBwZXJjYXNlOiB0cnVlIH19KVxuICogICAgIHZhciBNID0gZGIubW9kZWwoJ00nLCBzKTtcbiAqICAgICB2YXIgbSA9IG5ldyBNKHsgY2FwczogJ2FuIGV4YW1wbGUnIH0pO1xuICogICAgIGNvbnNvbGUubG9nKG0uY2FwcykgLy8gQU4gRVhBTVBMRVxuICpcbiAqIEBhcGkgcHVibGljXG4gKiBAcmV0dXJuIHtTY2hlbWFUeXBlfSB0aGlzXG4gKi9cblN0cmluZ1NjaGVtYS5wcm90b3R5cGUudXBwZXJjYXNlID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5zZXQoZnVuY3Rpb24gKHYsIHNlbGYpIHtcbiAgICBpZiAoJ3N0cmluZycgIT0gdHlwZW9mIHYpIHYgPSBzZWxmLmNhc3Qodik7XG4gICAgaWYgKHYpIHJldHVybiB2LnRvVXBwZXJDYXNlKCk7XG4gICAgcmV0dXJuIHY7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBBZGRzIGEgdHJpbSBzZXR0ZXIuXG4gKlxuICogVGhlIHN0cmluZyB2YWx1ZSB3aWxsIGJlIHRyaW1tZWQgd2hlbiBzZXQuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIHZhciBzID0gbmV3IFNjaGVtYSh7IG5hbWU6IHsgdHlwZTogU3RyaW5nLCB0cmltOiB0cnVlIH19KVxuICogICAgIHZhciBNID0gZGIubW9kZWwoJ00nLCBzKVxuICogICAgIHZhciBzdHJpbmcgPSAnIHNvbWUgbmFtZSAnXG4gKiAgICAgY29uc29sZS5sb2coc3RyaW5nLmxlbmd0aCkgLy8gMTFcbiAqICAgICB2YXIgbSA9IG5ldyBNKHsgbmFtZTogc3RyaW5nIH0pXG4gKiAgICAgY29uc29sZS5sb2cobS5uYW1lLmxlbmd0aCkgLy8gOVxuICpcbiAqIEBhcGkgcHVibGljXG4gKiBAcmV0dXJuIHtTY2hlbWFUeXBlfSB0aGlzXG4gKi9cblN0cmluZ1NjaGVtYS5wcm90b3R5cGUudHJpbSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuc2V0KGZ1bmN0aW9uICh2LCBzZWxmKSB7XG4gICAgaWYgKCdzdHJpbmcnICE9IHR5cGVvZiB2KSB2ID0gc2VsZi5jYXN0KHYpO1xuICAgIGlmICh2KSByZXR1cm4gdi50cmltKCk7XG4gICAgcmV0dXJuIHY7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBTZXRzIGEgcmVnZXhwIHZhbGlkYXRvci5cbiAqXG4gKiBBbnkgdmFsdWUgdGhhdCBkb2VzIG5vdCBwYXNzIGByZWdFeHBgLnRlc3QodmFsKSB3aWxsIGZhaWwgdmFsaWRhdGlvbi5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIHMgPSBuZXcgU2NoZW1hKHsgbmFtZTogeyB0eXBlOiBTdHJpbmcsIG1hdGNoOiAvXmEvIH19KVxuICogICAgIHZhciBNID0gZGIubW9kZWwoJ00nLCBzKVxuICogICAgIHZhciBtID0gbmV3IE0oeyBuYW1lOiAnSSBhbSBpbnZhbGlkJyB9KVxuICogICAgIG0udmFsaWRhdGUoZnVuY3Rpb24gKGVycikge1xuICogICAgICAgY29uc29sZS5lcnJvcihTdHJpbmcoZXJyKSkgLy8gXCJWYWxpZGF0aW9uRXJyb3I6IFBhdGggYG5hbWVgIGlzIGludmFsaWQgKEkgYW0gaW52YWxpZCkuXCJcbiAqICAgICAgIG0ubmFtZSA9ICdhcHBsZXMnXG4gKiAgICAgICBtLnZhbGlkYXRlKGZ1bmN0aW9uIChlcnIpIHtcbiAqICAgICAgICAgYXNzZXJ0Lm9rKGVycikgLy8gc3VjY2Vzc1xuICogICAgICAgfSlcbiAqICAgICB9KVxuICpcbiAqICAgICAvLyB1c2luZyBhIGN1c3RvbSBlcnJvciBtZXNzYWdlXG4gKiAgICAgdmFyIG1hdGNoID0gWyAvXFwuaHRtbCQvLCBcIlRoYXQgZmlsZSBkb2Vzbid0IGVuZCBpbiAuaHRtbCAoe1ZBTFVFfSlcIiBdO1xuICogICAgIHZhciBzID0gbmV3IFNjaGVtYSh7IGZpbGU6IHsgdHlwZTogU3RyaW5nLCBtYXRjaDogbWF0Y2ggfX0pXG4gKiAgICAgdmFyIE0gPSBkYi5tb2RlbCgnTScsIHMpO1xuICogICAgIHZhciBtID0gbmV3IE0oeyBmaWxlOiAnaW52YWxpZCcgfSk7XG4gKiAgICAgbS52YWxpZGF0ZShmdW5jdGlvbiAoZXJyKSB7XG4gKiAgICAgICBjb25zb2xlLmxvZyhTdHJpbmcoZXJyKSkgLy8gXCJWYWxpZGF0aW9uRXJyb3I6IFRoYXQgZmlsZSBkb2Vzbid0IGVuZCBpbiAuaHRtbCAoaW52YWxpZClcIlxuICogICAgIH0pXG4gKlxuICogRW1wdHkgc3RyaW5ncywgYHVuZGVmaW5lZGAsIGFuZCBgbnVsbGAgdmFsdWVzIGFsd2F5cyBwYXNzIHRoZSBtYXRjaCB2YWxpZGF0b3IuIElmIHlvdSByZXF1aXJlIHRoZXNlIHZhbHVlcywgZW5hYmxlIHRoZSBgcmVxdWlyZWRgIHZhbGlkYXRvciBhbHNvLlxuICpcbiAqICAgICB2YXIgcyA9IG5ldyBTY2hlbWEoeyBuYW1lOiB7IHR5cGU6IFN0cmluZywgbWF0Y2g6IC9eYS8sIHJlcXVpcmVkOiB0cnVlIH19KVxuICpcbiAqIEBwYXJhbSB7UmVnRXhwfSByZWdFeHAgcmVndWxhciBleHByZXNzaW9uIHRvIHRlc3QgYWdhaW5zdFxuICogQHBhcmFtIHtTdHJpbmd9IFttZXNzYWdlXSBvcHRpb25hbCBjdXN0b20gZXJyb3IgbWVzc2FnZVxuICogQHJldHVybiB7U2NoZW1hVHlwZX0gdGhpc1xuICogQHNlZSBDdXN0b21pemVkIEVycm9yIE1lc3NhZ2VzICNlcnJvcl9tZXNzYWdlc19Nb25nb29zZUVycm9yLW1lc3NhZ2VzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TdHJpbmdTY2hlbWEucHJvdG90eXBlLm1hdGNoID0gZnVuY3Rpb24gbWF0Y2ggKHJlZ0V4cCwgbWVzc2FnZSkge1xuICAvLyB5ZXMsIHdlIGFsbG93IG11bHRpcGxlIG1hdGNoIHZhbGlkYXRvcnNcblxuICB2YXIgbXNnID0gbWVzc2FnZSB8fCBlcnJvck1lc3NhZ2VzLlN0cmluZy5tYXRjaDtcblxuICBmdW5jdGlvbiBtYXRjaFZhbGlkYXRvciAodil7XG4gICAgcmV0dXJuIG51bGwgIT0gdiAmJiAnJyAhPT0gdlxuICAgICAgPyByZWdFeHAudGVzdCh2KVxuICAgICAgOiB0cnVlXG4gIH1cblxuICB0aGlzLnZhbGlkYXRvcnMucHVzaChbbWF0Y2hWYWxpZGF0b3IsIG1zZywgJ3JlZ2V4cCddKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIENoZWNrIHJlcXVpcmVkXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8bnVsbHx1bmRlZmluZWR9IHZhbHVlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuU3RyaW5nU2NoZW1hLnByb3RvdHlwZS5jaGVja1JlcXVpcmVkID0gZnVuY3Rpb24gY2hlY2tSZXF1aXJlZCAodmFsdWUsIGRvYykge1xuICBpZiAoU2NoZW1hVHlwZS5faXNSZWYodGhpcywgdmFsdWUsIGRvYywgdHJ1ZSkpIHtcbiAgICByZXR1cm4gbnVsbCAhPSB2YWx1ZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gKHZhbHVlIGluc3RhbmNlb2YgU3RyaW5nIHx8IHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJykgJiYgdmFsdWUubGVuZ3RoO1xuICB9XG59O1xuXG4vKipcbiAqIENhc3RzIHRvIFN0cmluZ1xuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5TdHJpbmdTY2hlbWEucHJvdG90eXBlLmNhc3QgPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuICBpZiAoIHZhbHVlID09PSBudWxsICkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG4gIGlmICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHZhbHVlKSB7XG4gICAgLy8gaGFuZGxlIGRvY3VtZW50cyBiZWluZyBwYXNzZWRcbiAgICBpZiAodmFsdWUuX2lkICYmICdzdHJpbmcnID09IHR5cGVvZiB2YWx1ZS5faWQpIHtcbiAgICAgIHJldHVybiB2YWx1ZS5faWQ7XG4gICAgfVxuICAgIGlmICggdmFsdWUudG9TdHJpbmcgKSB7XG4gICAgICByZXR1cm4gdmFsdWUudG9TdHJpbmcoKTtcbiAgICB9XG4gIH1cblxuICB0aHJvdyBuZXcgQ2FzdEVycm9yKCdzdHJpbmcnLCB2YWx1ZSwgdGhpcy5wYXRoKTtcbn07XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBTdHJpbmdTY2hlbWE7XG4iLCIvKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpO1xudmFyIGVycm9yTWVzc2FnZXMgPSBlcnJvci5tZXNzYWdlcztcbnZhciBDYXN0RXJyb3IgPSBlcnJvci5DYXN0RXJyb3I7XG52YXIgVmFsaWRhdG9yRXJyb3IgPSBlcnJvci5WYWxpZGF0b3JFcnJvcjtcblxuLyoqXG4gKiBTY2hlbWFUeXBlIGNvbnN0cnVjdG9yXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEBwYXJhbSB7U3RyaW5nfSBbaW5zdGFuY2VdXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIFNjaGVtYVR5cGUgKHBhdGgsIG9wdGlvbnMsIGluc3RhbmNlKSB7XG4gIHRoaXMucGF0aCA9IHBhdGg7XG4gIHRoaXMuaW5zdGFuY2UgPSBpbnN0YW5jZTtcbiAgdGhpcy52YWxpZGF0b3JzID0gW107XG4gIHRoaXMuc2V0dGVycyA9IFtdO1xuICB0aGlzLmdldHRlcnMgPSBbXTtcbiAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcblxuICBmb3IgKHZhciBpIGluIG9wdGlvbnMpIGlmICh0aGlzW2ldICYmICdmdW5jdGlvbicgPT0gdHlwZW9mIHRoaXNbaV0pIHtcbiAgICB2YXIgb3B0cyA9IEFycmF5LmlzQXJyYXkob3B0aW9uc1tpXSlcbiAgICAgID8gb3B0aW9uc1tpXVxuICAgICAgOiBbb3B0aW9uc1tpXV07XG5cbiAgICB0aGlzW2ldLmFwcGx5KHRoaXMsIG9wdHMpO1xuICB9XG59XG5cbi8qKlxuICogU2V0cyBhIGRlZmF1bHQgdmFsdWUgZm9yIHRoaXMgU2NoZW1hVHlwZS5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIHNjaGVtYSA9IG5ldyBTY2hlbWEoeyBuOiB7IHR5cGU6IE51bWJlciwgZGVmYXVsdDogMTAgfSlcbiAqICAgICB2YXIgTSA9IGRiLm1vZGVsKCdNJywgc2NoZW1hKVxuICogICAgIHZhciBtID0gbmV3IE07XG4gKiAgICAgY29uc29sZS5sb2cobS5uKSAvLyAxMFxuICpcbiAqIERlZmF1bHRzIGNhbiBiZSBlaXRoZXIgYGZ1bmN0aW9uc2Agd2hpY2ggcmV0dXJuIHRoZSB2YWx1ZSB0byB1c2UgYXMgdGhlIGRlZmF1bHQgb3IgdGhlIGxpdGVyYWwgdmFsdWUgaXRzZWxmLiBFaXRoZXIgd2F5LCB0aGUgdmFsdWUgd2lsbCBiZSBjYXN0IGJhc2VkIG9uIGl0cyBzY2hlbWEgdHlwZSBiZWZvcmUgYmVpbmcgc2V0IGR1cmluZyBkb2N1bWVudCBjcmVhdGlvbi5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgLy8gdmFsdWVzIGFyZSBjYXN0OlxuICogICAgIHZhciBzY2hlbWEgPSBuZXcgU2NoZW1hKHsgYU51bWJlcjogTnVtYmVyLCBkZWZhdWx0OiBcIjQuODE1MTYyMzQyXCIgfSlcbiAqICAgICB2YXIgTSA9IGRiLm1vZGVsKCdNJywgc2NoZW1hKVxuICogICAgIHZhciBtID0gbmV3IE07XG4gKiAgICAgY29uc29sZS5sb2cobS5hTnVtYmVyKSAvLyA0LjgxNTE2MjM0MlxuICpcbiAqICAgICAvLyBkZWZhdWx0IHVuaXF1ZSBvYmplY3RzIGZvciBNaXhlZCB0eXBlczpcbiAqICAgICB2YXIgc2NoZW1hID0gbmV3IFNjaGVtYSh7IG1peGVkOiBTY2hlbWEuVHlwZXMuTWl4ZWQgfSk7XG4gKiAgICAgc2NoZW1hLnBhdGgoJ21peGVkJykuZGVmYXVsdChmdW5jdGlvbiAoKSB7XG4gKiAgICAgICByZXR1cm4ge307XG4gKiAgICAgfSk7XG4gKlxuICogICAgIC8vIGlmIHdlIGRvbid0IHVzZSBhIGZ1bmN0aW9uIHRvIHJldHVybiBvYmplY3QgbGl0ZXJhbHMgZm9yIE1peGVkIGRlZmF1bHRzLFxuICogICAgIC8vIGVhY2ggZG9jdW1lbnQgd2lsbCByZWNlaXZlIGEgcmVmZXJlbmNlIHRvIHRoZSBzYW1lIG9iamVjdCBsaXRlcmFsIGNyZWF0aW5nXG4gKiAgICAgLy8gYSBcInNoYXJlZFwiIG9iamVjdCBpbnN0YW5jZTpcbiAqICAgICB2YXIgc2NoZW1hID0gbmV3IFNjaGVtYSh7IG1peGVkOiBTY2hlbWEuVHlwZXMuTWl4ZWQgfSk7XG4gKiAgICAgc2NoZW1hLnBhdGgoJ21peGVkJykuZGVmYXVsdCh7fSk7XG4gKiAgICAgdmFyIE0gPSBkYi5tb2RlbCgnTScsIHNjaGVtYSk7XG4gKiAgICAgdmFyIG0xID0gbmV3IE07XG4gKiAgICAgbTEubWl4ZWQuYWRkZWQgPSAxO1xuICogICAgIGNvbnNvbGUubG9nKG0xLm1peGVkKTsgLy8geyBhZGRlZDogMSB9XG4gKiAgICAgdmFyIG0yID0gbmV3IE07XG4gKiAgICAgY29uc29sZS5sb2cobTIubWl4ZWQpOyAvLyB7IGFkZGVkOiAxIH1cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufGFueX0gdmFsIHRoZSBkZWZhdWx0IHZhbHVlXG4gKiBAcmV0dXJuIHtkZWZhdWx0VmFsdWV9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWFUeXBlLnByb3RvdHlwZS5kZWZhdWx0ID0gZnVuY3Rpb24gKHZhbCkge1xuICBpZiAoMSA9PT0gYXJndW1lbnRzLmxlbmd0aCkge1xuICAgIHRoaXMuZGVmYXVsdFZhbHVlID0gdHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgPyB2YWxcbiAgICAgIDogdGhpcy5jYXN0KCB2YWwgKTtcblxuICAgIHJldHVybiB0aGlzO1xuXG4gIH0gZWxzZSBpZiAoIGFyZ3VtZW50cy5sZW5ndGggPiAxICkge1xuICAgIHRoaXMuZGVmYXVsdFZhbHVlID0gXy50b0FycmF5KCBhcmd1bWVudHMgKTtcbiAgfVxuICByZXR1cm4gdGhpcy5kZWZhdWx0VmFsdWU7XG59O1xuXG4vKipcbiAqIEFkZHMgYSBzZXR0ZXIgdG8gdGhpcyBzY2hlbWF0eXBlLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICBmdW5jdGlvbiBjYXBpdGFsaXplICh2YWwpIHtcbiAqICAgICAgIGlmICgnc3RyaW5nJyAhPSB0eXBlb2YgdmFsKSB2YWwgPSAnJztcbiAqICAgICAgIHJldHVybiB2YWwuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyB2YWwuc3Vic3RyaW5nKDEpO1xuICogICAgIH1cbiAqXG4gKiAgICAgLy8gZGVmaW5pbmcgd2l0aGluIHRoZSBzY2hlbWFcbiAqICAgICB2YXIgcyA9IG5ldyBTY2hlbWEoeyBuYW1lOiB7IHR5cGU6IFN0cmluZywgc2V0OiBjYXBpdGFsaXplIH19KVxuICpcbiAqICAgICAvLyBvciBieSByZXRyZWl2aW5nIGl0cyBTY2hlbWFUeXBlXG4gKiAgICAgdmFyIHMgPSBuZXcgU2NoZW1hKHsgbmFtZTogU3RyaW5nIH0pXG4gKiAgICAgcy5wYXRoKCduYW1lJykuc2V0KGNhcGl0YWxpemUpXG4gKlxuICogU2V0dGVycyBhbGxvdyB5b3UgdG8gdHJhbnNmb3JtIHRoZSBkYXRhIGJlZm9yZSBpdCBnZXRzIHRvIHRoZSByYXcgbW9uZ29kYiBkb2N1bWVudCBhbmQgaXMgc2V0IGFzIGEgdmFsdWUgb24gYW4gYWN0dWFsIGtleS5cbiAqXG4gKiBTdXBwb3NlIHlvdSBhcmUgaW1wbGVtZW50aW5nIHVzZXIgcmVnaXN0cmF0aW9uIGZvciBhIHdlYnNpdGUuIFVzZXJzIHByb3ZpZGUgYW4gZW1haWwgYW5kIHBhc3N3b3JkLCB3aGljaCBnZXRzIHNhdmVkIHRvIG1vbmdvZGIuIFRoZSBlbWFpbCBpcyBhIHN0cmluZyB0aGF0IHlvdSB3aWxsIHdhbnQgdG8gbm9ybWFsaXplIHRvIGxvd2VyIGNhc2UsIGluIG9yZGVyIHRvIGF2b2lkIG9uZSBlbWFpbCBoYXZpbmcgbW9yZSB0aGFuIG9uZSBhY2NvdW50IC0tIGUuZy4sIG90aGVyd2lzZSwgYXZlbnVlQHEuY29tIGNhbiBiZSByZWdpc3RlcmVkIGZvciAyIGFjY291bnRzIHZpYSBhdmVudWVAcS5jb20gYW5kIEF2RW5VZUBRLkNvTS5cbiAqXG4gKiBZb3UgY2FuIHNldCB1cCBlbWFpbCBsb3dlciBjYXNlIG5vcm1hbGl6YXRpb24gZWFzaWx5IHZpYSBhIE1vbmdvb3NlIHNldHRlci5cbiAqXG4gKiAgICAgZnVuY3Rpb24gdG9Mb3dlciAodikge1xuICogICAgICAgcmV0dXJuIHYudG9Mb3dlckNhc2UoKTtcbiAqICAgICB9XG4gKlxuICogICAgIHZhciBVc2VyU2NoZW1hID0gbmV3IFNjaGVtYSh7XG4gKiAgICAgICBlbWFpbDogeyB0eXBlOiBTdHJpbmcsIHNldDogdG9Mb3dlciB9XG4gKiAgICAgfSlcbiAqXG4gKiAgICAgdmFyIFVzZXIgPSBkYi5tb2RlbCgnVXNlcicsIFVzZXJTY2hlbWEpXG4gKlxuICogICAgIHZhciB1c2VyID0gbmV3IFVzZXIoe2VtYWlsOiAnQVZFTlVFQFEuQ09NJ30pXG4gKiAgICAgY29uc29sZS5sb2codXNlci5lbWFpbCk7IC8vICdhdmVudWVAcS5jb20nXG4gKlxuICogICAgIC8vIG9yXG4gKiAgICAgdmFyIHVzZXIgPSBuZXcgVXNlclxuICogICAgIHVzZXIuZW1haWwgPSAnQXZlbnVlQFEuY29tJ1xuICogICAgIGNvbnNvbGUubG9nKHVzZXIuZW1haWwpIC8vICdhdmVudWVAcS5jb20nXG4gKlxuICogQXMgeW91IGNhbiBzZWUgYWJvdmUsIHNldHRlcnMgYWxsb3cgeW91IHRvIHRyYW5zZm9ybSB0aGUgZGF0YSBiZWZvcmUgaXQgZ2V0cyB0byB0aGUgcmF3IG1vbmdvZGIgZG9jdW1lbnQgYW5kIGlzIHNldCBhcyBhIHZhbHVlIG9uIGFuIGFjdHVhbCBrZXkuXG4gKlxuICogX05PVEU6IHdlIGNvdWxkIGhhdmUgYWxzbyBqdXN0IHVzZWQgdGhlIGJ1aWx0LWluIGBsb3dlcmNhc2U6IHRydWVgIFNjaGVtYVR5cGUgb3B0aW9uIGluc3RlYWQgb2YgZGVmaW5pbmcgb3VyIG93biBmdW5jdGlvbi5fXG4gKlxuICogICAgIG5ldyBTY2hlbWEoeyBlbWFpbDogeyB0eXBlOiBTdHJpbmcsIGxvd2VyY2FzZTogdHJ1ZSB9fSlcbiAqXG4gKiBTZXR0ZXJzIGFyZSBhbHNvIHBhc3NlZCBhIHNlY29uZCBhcmd1bWVudCwgdGhlIHNjaGVtYXR5cGUgb24gd2hpY2ggdGhlIHNldHRlciB3YXMgZGVmaW5lZC4gVGhpcyBhbGxvd3MgZm9yIHRhaWxvcmVkIGJlaGF2aW9yIGJhc2VkIG9uIG9wdGlvbnMgcGFzc2VkIGluIHRoZSBzY2hlbWEuXG4gKlxuICogICAgIGZ1bmN0aW9uIGluc3BlY3RvciAodmFsLCBzY2hlbWF0eXBlKSB7XG4gKiAgICAgICBpZiAoc2NoZW1hdHlwZS5vcHRpb25zLnJlcXVpcmVkKSB7XG4gKiAgICAgICAgIHJldHVybiBzY2hlbWF0eXBlLnBhdGggKyAnIGlzIHJlcXVpcmVkJztcbiAqICAgICAgIH0gZWxzZSB7XG4gKiAgICAgICAgIHJldHVybiB2YWw7XG4gKiAgICAgICB9XG4gKiAgICAgfVxuICpcbiAqICAgICB2YXIgVmlydXNTY2hlbWEgPSBuZXcgU2NoZW1hKHtcbiAqICAgICAgIG5hbWU6IHsgdHlwZTogU3RyaW5nLCByZXF1aXJlZDogdHJ1ZSwgc2V0OiBpbnNwZWN0b3IgfSxcbiAqICAgICAgIHRheG9ub215OiB7IHR5cGU6IFN0cmluZywgc2V0OiBpbnNwZWN0b3IgfVxuICogICAgIH0pXG4gKlxuICogICAgIHZhciBWaXJ1cyA9IGRiLm1vZGVsKCdWaXJ1cycsIFZpcnVzU2NoZW1hKTtcbiAqICAgICB2YXIgdiA9IG5ldyBWaXJ1cyh7IG5hbWU6ICdQYXJ2b3ZpcmlkYWUnLCB0YXhvbm9teTogJ1BhcnZvdmlyaW5hZScgfSk7XG4gKlxuICogICAgIGNvbnNvbGUubG9nKHYubmFtZSk7ICAgICAvLyBuYW1lIGlzIHJlcXVpcmVkXG4gKiAgICAgY29uc29sZS5sb2codi50YXhvbm9teSk7IC8vIFBhcnZvdmlyaW5hZVxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKiBAcmV0dXJuIHtTY2hlbWFUeXBlfSB0aGlzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWFUeXBlLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAoZm4pIHtcbiAgaWYgKCdmdW5jdGlvbicgIT0gdHlwZW9mIGZuKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0Egc2V0dGVyIG11c3QgYmUgYSBmdW5jdGlvbi4nKTtcbiAgdGhpcy5zZXR0ZXJzLnB1c2goZm4pO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQWRkcyBhIGdldHRlciB0byB0aGlzIHNjaGVtYXR5cGUuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIGZ1bmN0aW9uIGRvYiAodmFsKSB7XG4gKiAgICAgICBpZiAoIXZhbCkgcmV0dXJuIHZhbDtcbiAqICAgICAgIHJldHVybiAodmFsLmdldE1vbnRoKCkgKyAxKSArIFwiL1wiICsgdmFsLmdldERhdGUoKSArIFwiL1wiICsgdmFsLmdldEZ1bGxZZWFyKCk7XG4gKiAgICAgfVxuICpcbiAqICAgICAvLyBkZWZpbmluZyB3aXRoaW4gdGhlIHNjaGVtYVxuICogICAgIHZhciBzID0gbmV3IFNjaGVtYSh7IGJvcm46IHsgdHlwZTogRGF0ZSwgZ2V0OiBkb2IgfSlcbiAqXG4gKiAgICAgLy8gb3IgYnkgcmV0cmVpdmluZyBpdHMgU2NoZW1hVHlwZVxuICogICAgIHZhciBzID0gbmV3IFNjaGVtYSh7IGJvcm46IERhdGUgfSlcbiAqICAgICBzLnBhdGgoJ2Jvcm4nKS5nZXQoZG9iKVxuICpcbiAqIEdldHRlcnMgYWxsb3cgeW91IHRvIHRyYW5zZm9ybSB0aGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIGRhdGEgYXMgaXQgdHJhdmVscyBmcm9tIHRoZSByYXcgbW9uZ29kYiBkb2N1bWVudCB0byB0aGUgdmFsdWUgdGhhdCB5b3Ugc2VlLlxuICpcbiAqIFN1cHBvc2UgeW91IGFyZSBzdG9yaW5nIGNyZWRpdCBjYXJkIG51bWJlcnMgYW5kIHlvdSB3YW50IHRvIGhpZGUgZXZlcnl0aGluZyBleGNlcHQgdGhlIGxhc3QgNCBkaWdpdHMgdG8gdGhlIG1vbmdvb3NlIHVzZXIuIFlvdSBjYW4gZG8gc28gYnkgZGVmaW5pbmcgYSBnZXR0ZXIgaW4gdGhlIGZvbGxvd2luZyB3YXk6XG4gKlxuICogICAgIGZ1bmN0aW9uIG9iZnVzY2F0ZSAoY2MpIHtcbiAqICAgICAgIHJldHVybiAnKioqKi0qKioqLSoqKiotJyArIGNjLnNsaWNlKGNjLmxlbmd0aC00LCBjYy5sZW5ndGgpO1xuICogICAgIH1cbiAqXG4gKiAgICAgdmFyIEFjY291bnRTY2hlbWEgPSBuZXcgU2NoZW1hKHtcbiAqICAgICAgIGNyZWRpdENhcmROdW1iZXI6IHsgdHlwZTogU3RyaW5nLCBnZXQ6IG9iZnVzY2F0ZSB9XG4gKiAgICAgfSk7XG4gKlxuICogICAgIHZhciBBY2NvdW50ID0gZGIubW9kZWwoJ0FjY291bnQnLCBBY2NvdW50U2NoZW1hKTtcbiAqXG4gKiAgICAgQWNjb3VudC5maW5kQnlJZChpZCwgZnVuY3Rpb24gKGVyciwgZm91bmQpIHtcbiAqICAgICAgIGNvbnNvbGUubG9nKGZvdW5kLmNyZWRpdENhcmROdW1iZXIpOyAvLyAnKioqKi0qKioqLSoqKiotMTIzNCdcbiAqICAgICB9KTtcbiAqXG4gKiBHZXR0ZXJzIGFyZSBhbHNvIHBhc3NlZCBhIHNlY29uZCBhcmd1bWVudCwgdGhlIHNjaGVtYXR5cGUgb24gd2hpY2ggdGhlIGdldHRlciB3YXMgZGVmaW5lZC4gVGhpcyBhbGxvd3MgZm9yIHRhaWxvcmVkIGJlaGF2aW9yIGJhc2VkIG9uIG9wdGlvbnMgcGFzc2VkIGluIHRoZSBzY2hlbWEuXG4gKlxuICogICAgIGZ1bmN0aW9uIGluc3BlY3RvciAodmFsLCBzY2hlbWF0eXBlKSB7XG4gKiAgICAgICBpZiAoc2NoZW1hdHlwZS5vcHRpb25zLnJlcXVpcmVkKSB7XG4gKiAgICAgICAgIHJldHVybiBzY2hlbWF0eXBlLnBhdGggKyAnIGlzIHJlcXVpcmVkJztcbiAqICAgICAgIH0gZWxzZSB7XG4gKiAgICAgICAgIHJldHVybiBzY2hlbWF0eXBlLnBhdGggKyAnIGlzIG5vdCc7XG4gKiAgICAgICB9XG4gKiAgICAgfVxuICpcbiAqICAgICB2YXIgVmlydXNTY2hlbWEgPSBuZXcgU2NoZW1hKHtcbiAqICAgICAgIG5hbWU6IHsgdHlwZTogU3RyaW5nLCByZXF1aXJlZDogdHJ1ZSwgZ2V0OiBpbnNwZWN0b3IgfSxcbiAqICAgICAgIHRheG9ub215OiB7IHR5cGU6IFN0cmluZywgZ2V0OiBpbnNwZWN0b3IgfVxuICogICAgIH0pXG4gKlxuICogICAgIHZhciBWaXJ1cyA9IGRiLm1vZGVsKCdWaXJ1cycsIFZpcnVzU2NoZW1hKTtcbiAqXG4gKiAgICAgVmlydXMuZmluZEJ5SWQoaWQsIGZ1bmN0aW9uIChlcnIsIHZpcnVzKSB7XG4gKiAgICAgICBjb25zb2xlLmxvZyh2aXJ1cy5uYW1lKTsgICAgIC8vIG5hbWUgaXMgcmVxdWlyZWRcbiAqICAgICAgIGNvbnNvbGUubG9nKHZpcnVzLnRheG9ub215KTsgLy8gdGF4b25vbXkgaXMgbm90XG4gKiAgICAgfSlcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7U2NoZW1hVHlwZX0gdGhpc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuU2NoZW1hVHlwZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGZuKSB7XG4gIGlmICgnZnVuY3Rpb24nICE9IHR5cGVvZiBmbilcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBIGdldHRlciBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gIHRoaXMuZ2V0dGVycy5wdXNoKGZuKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEFkZHMgdmFsaWRhdG9yKHMpIGZvciB0aGlzIGRvY3VtZW50IHBhdGguXG4gKlxuICogVmFsaWRhdG9ycyBhbHdheXMgcmVjZWl2ZSB0aGUgdmFsdWUgdG8gdmFsaWRhdGUgYXMgdGhlaXIgZmlyc3QgYXJndW1lbnQgYW5kIG11c3QgcmV0dXJuIGBCb29sZWFuYC4gUmV0dXJuaW5nIGBmYWxzZWAgbWVhbnMgdmFsaWRhdGlvbiBmYWlsZWQuXG4gKlxuICogVGhlIGVycm9yIG1lc3NhZ2UgYXJndW1lbnQgaXMgb3B0aW9uYWwuIElmIG5vdCBwYXNzZWQsIHRoZSBbZGVmYXVsdCBnZW5lcmljIGVycm9yIG1lc3NhZ2UgdGVtcGxhdGVdKCNlcnJvcl9tZXNzYWdlc19Nb25nb29zZUVycm9yLW1lc3NhZ2VzKSB3aWxsIGJlIHVzZWQuXG4gKlxuICogIyMjI0V4YW1wbGVzOlxuICpcbiAqICAgICAvLyBtYWtlIHN1cmUgZXZlcnkgdmFsdWUgaXMgZXF1YWwgdG8gXCJzb21ldGhpbmdcIlxuICogICAgIGZ1bmN0aW9uIHZhbGlkYXRvciAodmFsKSB7XG4gKiAgICAgICByZXR1cm4gdmFsID09ICdzb21ldGhpbmcnO1xuICogICAgIH1cbiAqICAgICBuZXcgU2NoZW1hKHsgbmFtZTogeyB0eXBlOiBTdHJpbmcsIHZhbGlkYXRlOiB2YWxpZGF0b3IgfX0pO1xuICpcbiAqICAgICAvLyB3aXRoIGEgY3VzdG9tIGVycm9yIG1lc3NhZ2VcbiAqXG4gKiAgICAgdmFyIGN1c3RvbSA9IFt2YWxpZGF0b3IsICdVaCBvaCwge1BBVEh9IGRvZXMgbm90IGVxdWFsIFwic29tZXRoaW5nXCIuJ11cbiAqICAgICBuZXcgU2NoZW1hKHsgbmFtZTogeyB0eXBlOiBTdHJpbmcsIHZhbGlkYXRlOiBjdXN0b20gfX0pO1xuICpcbiAqICAgICAvLyBhZGRpbmcgbWFueSB2YWxpZGF0b3JzIGF0IGEgdGltZVxuICpcbiAqICAgICB2YXIgbWFueSA9IFtcbiAqICAgICAgICAgeyB2YWxpZGF0b3I6IHZhbGlkYXRvciwgbXNnOiAndWggb2gnIH1cbiAqICAgICAgICwgeyB2YWxpZGF0b3I6IGFub3RoZXJWYWxpZGF0b3IsIG1zZzogJ2ZhaWxlZCcgfVxuICogICAgIF1cbiAqICAgICBuZXcgU2NoZW1hKHsgbmFtZTogeyB0eXBlOiBTdHJpbmcsIHZhbGlkYXRlOiBtYW55IH19KTtcbiAqXG4gKiAgICAgLy8gb3IgdXRpbGl6aW5nIFNjaGVtYVR5cGUgbWV0aG9kcyBkaXJlY3RseTpcbiAqXG4gKiAgICAgdmFyIHNjaGVtYSA9IG5ldyBTY2hlbWEoeyBuYW1lOiAnc3RyaW5nJyB9KTtcbiAqICAgICBzY2hlbWEucGF0aCgnbmFtZScpLnZhbGlkYXRlKHZhbGlkYXRvciwgJ3ZhbGlkYXRpb24gb2YgYHtQQVRIfWAgZmFpbGVkIHdpdGggdmFsdWUgYHtWQUxVRX1gJyk7XG4gKlxuICogIyMjI0Vycm9yIG1lc3NhZ2UgdGVtcGxhdGVzOlxuICpcbiAqIEZyb20gdGhlIGV4YW1wbGVzIGFib3ZlLCB5b3UgbWF5IGhhdmUgbm90aWNlZCB0aGF0IGVycm9yIG1lc3NhZ2VzIHN1cHBvcnQgYmFzZWljIHRlbXBsYXRpbmcuIFRoZXJlIGFyZSBhIGZldyBvdGhlciB0ZW1wbGF0ZSBrZXl3b3JkcyBiZXNpZGVzIGB7UEFUSH1gIGFuZCBge1ZBTFVFfWAgdG9vLiBUbyBmaW5kIG91dCBtb3JlLCBkZXRhaWxzIGFyZSBhdmFpbGFibGUgW2hlcmVdKCNlcnJvcl9tZXNzYWdlc19Nb25nb29zZUVycm9yLW1lc3NhZ2VzKVxuICpcbiAqICMjIyNBc3luY2hyb25vdXMgdmFsaWRhdGlvbjpcbiAqXG4gKiBQYXNzaW5nIGEgdmFsaWRhdG9yIGZ1bmN0aW9uIHRoYXQgcmVjZWl2ZXMgdHdvIGFyZ3VtZW50cyB0ZWxscyBtb25nb29zZSB0aGF0IHRoZSB2YWxpZGF0b3IgaXMgYW4gYXN5bmNocm9ub3VzIHZhbGlkYXRvci4gVGhlIGZpcnN0IGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgdmFsaWRhdG9yIGZ1bmN0aW9uIGlzIHRoZSB2YWx1ZSBiZWluZyB2YWxpZGF0ZWQuIFRoZSBzZWNvbmQgYXJndW1lbnQgaXMgYSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IG11c3QgY2FsbGVkIHdoZW4geW91IGZpbmlzaCB2YWxpZGF0aW5nIHRoZSB2YWx1ZSBhbmQgcGFzc2VkIGVpdGhlciBgdHJ1ZWAgb3IgYGZhbHNlYCB0byBjb21tdW5pY2F0ZSBlaXRoZXIgc3VjY2VzcyBvciBmYWlsdXJlIHJlc3BlY3RpdmVseS5cbiAqXG4gKiAgICAgc2NoZW1hLnBhdGgoJ25hbWUnKS52YWxpZGF0ZShmdW5jdGlvbiAodmFsdWUsIHJlc3BvbmQpIHtcbiAqICAgICAgIGRvU3R1ZmYodmFsdWUsIGZ1bmN0aW9uICgpIHtcbiAqICAgICAgICAgLi4uXG4gKiAgICAgICAgIHJlc3BvbmQoZmFsc2UpOyAvLyB2YWxpZGF0aW9uIGZhaWxlZFxuICogICAgICAgfSlcbiogICAgICB9LCAne1BBVEh9IGZhaWxlZCB2YWxpZGF0aW9uLicpO1xuKlxuICogWW91IG1pZ2h0IHVzZSBhc3luY2hyb25vdXMgdmFsaWRhdG9ycyB0byByZXRyZWl2ZSBvdGhlciBkb2N1bWVudHMgZnJvbSB0aGUgZGF0YWJhc2UgdG8gdmFsaWRhdGUgYWdhaW5zdCBvciB0byBtZWV0IG90aGVyIEkvTyBib3VuZCB2YWxpZGF0aW9uIG5lZWRzLlxuICpcbiAqIFZhbGlkYXRpb24gb2NjdXJzIGBwcmUoJ3NhdmUnKWAgb3Igd2hlbmV2ZXIgeW91IG1hbnVhbGx5IGV4ZWN1dGUgW2RvY3VtZW50I3ZhbGlkYXRlXSgjZG9jdW1lbnRfRG9jdW1lbnQtdmFsaWRhdGUpLlxuICpcbiAqIElmIHZhbGlkYXRpb24gZmFpbHMgZHVyaW5nIGBwcmUoJ3NhdmUnKWAgYW5kIG5vIGNhbGxiYWNrIHdhcyBwYXNzZWQgdG8gcmVjZWl2ZSB0aGUgZXJyb3IsIGFuIGBlcnJvcmAgZXZlbnQgd2lsbCBiZSBlbWl0dGVkIG9uIHlvdXIgTW9kZWxzIGFzc29jaWF0ZWQgZGIgW2Nvbm5lY3Rpb25dKCNjb25uZWN0aW9uX0Nvbm5lY3Rpb24pLCBwYXNzaW5nIHRoZSB2YWxpZGF0aW9uIGVycm9yIG9iamVjdCBhbG9uZy5cbiAqXG4gKiAgICAgdmFyIGNvbm4gPSBtb25nb29zZS5jcmVhdGVDb25uZWN0aW9uKC4uKTtcbiAqICAgICBjb25uLm9uKCdlcnJvcicsIGhhbmRsZUVycm9yKTtcbiAqXG4gKiAgICAgdmFyIFByb2R1Y3QgPSBjb25uLm1vZGVsKCdQcm9kdWN0JywgeW91clNjaGVtYSk7XG4gKiAgICAgdmFyIGR2ZCA9IG5ldyBQcm9kdWN0KC4uKTtcbiAqICAgICBkdmQuc2F2ZSgpOyAvLyBlbWl0cyBlcnJvciBvbiB0aGUgYGNvbm5gIGFib3ZlXG4gKlxuICogSWYgeW91IGRlc2lyZSBoYW5kbGluZyB0aGVzZSBlcnJvcnMgYXQgdGhlIE1vZGVsIGxldmVsLCBhdHRhY2ggYW4gYGVycm9yYCBsaXN0ZW5lciB0byB5b3VyIE1vZGVsIGFuZCB0aGUgZXZlbnQgd2lsbCBpbnN0ZWFkIGJlIGVtaXR0ZWQgdGhlcmUuXG4gKlxuICogICAgIC8vIHJlZ2lzdGVyaW5nIGFuIGVycm9yIGxpc3RlbmVyIG9uIHRoZSBNb2RlbCBsZXRzIHVzIGhhbmRsZSBlcnJvcnMgbW9yZSBsb2NhbGx5XG4gKiAgICAgUHJvZHVjdC5vbignZXJyb3InLCBoYW5kbGVFcnJvcik7XG4gKlxuICogQHBhcmFtIHtSZWdFeHB8RnVuY3Rpb258T2JqZWN0fSBvYmogdmFsaWRhdG9yXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Vycm9yTXNnXSBvcHRpb25hbCBlcnJvciBtZXNzYWdlXG4gKiBAcmV0dXJuIHtTY2hlbWFUeXBlfSB0aGlzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWFUeXBlLnByb3RvdHlwZS52YWxpZGF0ZSA9IGZ1bmN0aW9uIChvYmosIG1lc3NhZ2UsIHR5cGUpIHtcbiAgaWYgKCdmdW5jdGlvbicgPT0gdHlwZW9mIG9iaiB8fCBvYmogJiYgJ1JlZ0V4cCcgPT09IG9iai5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgaWYgKCFtZXNzYWdlKSBtZXNzYWdlID0gZXJyb3JNZXNzYWdlcy5nZW5lcmFsLmRlZmF1bHQ7XG4gICAgaWYgKCF0eXBlKSB0eXBlID0gJ3VzZXIgZGVmaW5lZCc7XG4gICAgdGhpcy52YWxpZGF0b3JzLnB1c2goW29iaiwgbWVzc2FnZSwgdHlwZV0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgdmFyIGkgPSBhcmd1bWVudHMubGVuZ3RoXG4gICAgLCBhcmc7XG5cbiAgd2hpbGUgKGktLSkge1xuICAgIGFyZyA9IGFyZ3VtZW50c1tpXTtcbiAgICBpZiAoIShhcmcgJiYgJ09iamVjdCcgPT0gYXJnLmNvbnN0cnVjdG9yLm5hbWUpKSB7XG4gICAgICB2YXIgbXNnID0gJ0ludmFsaWQgdmFsaWRhdG9yLiBSZWNlaXZlZCAoJyArIHR5cGVvZiBhcmcgKyAnKSAnXG4gICAgICAgICsgYXJnXG4gICAgICAgICsgJy4gU2VlIGh0dHA6Ly9tb25nb29zZWpzLmNvbS9kb2NzL2FwaS5odG1sI3NjaGVtYXR5cGVfU2NoZW1hVHlwZS12YWxpZGF0ZSc7XG5cbiAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpO1xuICAgIH1cbiAgICB0aGlzLnZhbGlkYXRlKGFyZy52YWxpZGF0b3IsIGFyZy5tc2csIGFyZy50eXBlKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBBZGRzIGEgcmVxdWlyZWQgdmFsaWRhdG9yIHRvIHRoaXMgc2NoZW1hdHlwZS5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIHMgPSBuZXcgU2NoZW1hKHsgYm9ybjogeyB0eXBlOiBEYXRlLCByZXF1aXJlZDogdHJ1ZSB9KVxuICpcbiAqICAgICAvLyBvciB3aXRoIGN1c3RvbSBlcnJvciBtZXNzYWdlXG4gKlxuICogICAgIHZhciBzID0gbmV3IFNjaGVtYSh7IGJvcm46IHsgdHlwZTogRGF0ZSwgcmVxdWlyZWQ6ICd7UEFUSH0gaXMgcmVxdWlyZWQhJyB9KVxuICpcbiAqICAgICAvLyBvciB0aHJvdWdoIHRoZSBwYXRoIEFQSVxuICpcbiAqICAgICBTY2hlbWEucGF0aCgnbmFtZScpLnJlcXVpcmVkKHRydWUpO1xuICpcbiAqICAgICAvLyB3aXRoIGN1c3RvbSBlcnJvciBtZXNzYWdpbmdcbiAqXG4gKiAgICAgU2NoZW1hLnBhdGgoJ25hbWUnKS5yZXF1aXJlZCh0cnVlLCAnZ3JyciA6KCAnKTtcbiAqXG4gKlxuICogQHBhcmFtIHtCb29sZWFufSByZXF1aXJlZCBlbmFibGUvZGlzYWJsZSB0aGUgdmFsaWRhdG9yXG4gKiBAcGFyYW0ge1N0cmluZ30gW21lc3NhZ2VdIG9wdGlvbmFsIGN1c3RvbSBlcnJvciBtZXNzYWdlXG4gKiBAcmV0dXJuIHtTY2hlbWFUeXBlfSB0aGlzXG4gKiBAc2VlIEN1c3RvbWl6ZWQgRXJyb3IgTWVzc2FnZXMgI2Vycm9yX21lc3NhZ2VzX01vbmdvb3NlRXJyb3ItbWVzc2FnZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblNjaGVtYVR5cGUucHJvdG90eXBlLnJlcXVpcmVkID0gZnVuY3Rpb24gKHJlcXVpcmVkLCBtZXNzYWdlKSB7XG4gIGlmIChmYWxzZSA9PT0gcmVxdWlyZWQpIHtcbiAgICB0aGlzLnZhbGlkYXRvcnMgPSB0aGlzLnZhbGlkYXRvcnMuZmlsdGVyKGZ1bmN0aW9uICh2KSB7XG4gICAgICByZXR1cm4gdlswXSAhPSB0aGlzLnJlcXVpcmVkVmFsaWRhdG9yO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgdGhpcy5pc1JlcXVpcmVkID0gZmFsc2U7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHRoaXMuaXNSZXF1aXJlZCA9IHRydWU7XG5cbiAgdGhpcy5yZXF1aXJlZFZhbGlkYXRvciA9IGZ1bmN0aW9uICh2KSB7XG4gICAgLy8gaW4gaGVyZSwgYHRoaXNgIHJlZmVycyB0byB0aGUgdmFsaWRhdGluZyBkb2N1bWVudC5cbiAgICAvLyBubyB2YWxpZGF0aW9uIHdoZW4gdGhpcyBwYXRoIHdhc24ndCBzZWxlY3RlZCBpbiB0aGUgcXVlcnkuXG4gICAgaWYgKHRoaXMgIT09IHVuZGVmaW5lZCAmJiAvLyDRgdC/0LXRhtC40LDQu9GM0L3QsNGPINC/0YDQvtCy0LXRgNC60LAg0LjQty3Qt9CwIHN0cmljdCBtb2RlINC4INC+0YHQvtCx0LXQvdC90L7RgdGC0LggLmNhbGwodW5kZWZpbmVkKVxuICAgICAgICAnaXNTZWxlY3RlZCcgaW4gdGhpcyAmJlxuICAgICAgICAhdGhpcy5pc1NlbGVjdGVkKHNlbGYucGF0aCkgJiZcbiAgICAgICAgIXRoaXMuaXNNb2RpZmllZChzZWxmLnBhdGgpKSByZXR1cm4gdHJ1ZTtcblxuICAgIHJldHVybiBzZWxmLmNoZWNrUmVxdWlyZWQodiwgdGhpcyk7XG4gIH07XG5cbiAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiByZXF1aXJlZCkge1xuICAgIG1lc3NhZ2UgPSByZXF1aXJlZDtcbiAgICByZXF1aXJlZCA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHZhciBtc2cgPSBtZXNzYWdlIHx8IGVycm9yTWVzc2FnZXMuZ2VuZXJhbC5yZXF1aXJlZDtcbiAgdGhpcy52YWxpZGF0b3JzLnB1c2goW3RoaXMucmVxdWlyZWRWYWxpZGF0b3IsIG1zZywgJ3JlcXVpcmVkJ10pO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuXG4vKipcbiAqIEdldHMgdGhlIGRlZmF1bHQgdmFsdWVcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gc2NvcGUgdGhlIHNjb3BlIHdoaWNoIGNhbGxiYWNrIGFyZSBleGVjdXRlZFxuICogQHBhcmFtIHtCb29sZWFufSBpbml0XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuU2NoZW1hVHlwZS5wcm90b3R5cGUuZ2V0RGVmYXVsdCA9IGZ1bmN0aW9uIChzY29wZSwgaW5pdCkge1xuICB2YXIgcmV0ID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHRoaXMuZGVmYXVsdFZhbHVlXG4gICAgPyB0aGlzLmRlZmF1bHRWYWx1ZS5jYWxsKHNjb3BlKVxuICAgIDogdGhpcy5kZWZhdWx0VmFsdWU7XG5cbiAgaWYgKG51bGwgIT09IHJldCAmJiB1bmRlZmluZWQgIT09IHJldCkge1xuICAgIHJldHVybiB0aGlzLmNhc3QocmV0LCBzY29wZSwgaW5pdCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHJldDtcbiAgfVxufTtcblxuLyoqXG4gKiBBcHBsaWVzIHNldHRlcnNcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZVxuICogQHBhcmFtIHtCb29sZWFufSBpbml0XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5TY2hlbWFUeXBlLnByb3RvdHlwZS5hcHBseVNldHRlcnMgPSBmdW5jdGlvbiAodmFsdWUsIHNjb3BlLCBpbml0LCBwcmlvclZhbCkge1xuICBpZiAoU2NoZW1hVHlwZS5faXNSZWYoIHRoaXMsIHZhbHVlICkpIHtcbiAgICByZXR1cm4gaW5pdFxuICAgICAgPyB2YWx1ZVxuICAgICAgOiB0aGlzLmNhc3QodmFsdWUsIHNjb3BlLCBpbml0LCBwcmlvclZhbCk7XG4gIH1cblxuICB2YXIgdiA9IHZhbHVlXG4gICAgLCBzZXR0ZXJzID0gdGhpcy5zZXR0ZXJzXG4gICAgLCBsZW4gPSBzZXR0ZXJzLmxlbmd0aFxuICAgICwgY2FzdGVyID0gdGhpcy5jYXN0ZXI7XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkodikgJiYgY2FzdGVyICYmIGNhc3Rlci5zZXR0ZXJzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB2W2ldID0gY2FzdGVyLmFwcGx5U2V0dGVycyh2W2ldLCBzY29wZSwgaW5pdCwgcHJpb3JWYWwpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghbGVuKSB7XG4gICAgaWYgKG51bGwgPT09IHYgfHwgdW5kZWZpbmVkID09PSB2KSByZXR1cm4gdjtcbiAgICByZXR1cm4gdGhpcy5jYXN0KHYsIHNjb3BlLCBpbml0LCBwcmlvclZhbCk7XG4gIH1cblxuICB3aGlsZSAobGVuLS0pIHtcbiAgICB2ID0gc2V0dGVyc1tsZW5dLmNhbGwoc2NvcGUsIHYsIHRoaXMpO1xuICB9XG5cbiAgaWYgKG51bGwgPT09IHYgfHwgdW5kZWZpbmVkID09PSB2KSByZXR1cm4gdjtcblxuICAvLyBkbyBub3QgY2FzdCB1bnRpbCBhbGwgc2V0dGVycyBhcmUgYXBwbGllZCAjNjY1XG4gIHYgPSB0aGlzLmNhc3Qodiwgc2NvcGUsIGluaXQsIHByaW9yVmFsKTtcblxuICByZXR1cm4gdjtcbn07XG5cbi8qKlxuICogQXBwbGllcyBnZXR0ZXJzIHRvIGEgdmFsdWVcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZVxuICogQGFwaSBwcml2YXRlXG4gKi9cblNjaGVtYVR5cGUucHJvdG90eXBlLmFwcGx5R2V0dGVycyA9IGZ1bmN0aW9uKCB2YWx1ZSwgc2NvcGUgKXtcbiAgaWYgKCBTY2hlbWFUeXBlLl9pc1JlZiggdGhpcywgdmFsdWUgKSApIHJldHVybiB2YWx1ZTtcblxuICB2YXIgdiA9IHZhbHVlXG4gICAgLCBnZXR0ZXJzID0gdGhpcy5nZXR0ZXJzXG4gICAgLCBsZW4gPSBnZXR0ZXJzLmxlbmd0aDtcblxuICBpZiAoICFsZW4gKSB7XG4gICAgcmV0dXJuIHY7XG4gIH1cblxuICB3aGlsZSAoIGxlbi0tICkge1xuICAgIHYgPSBnZXR0ZXJzWyBsZW4gXS5jYWxsKHNjb3BlLCB2LCB0aGlzKTtcbiAgfVxuXG4gIHJldHVybiB2O1xufTtcblxuLyoqXG4gKiBQZXJmb3JtcyBhIHZhbGlkYXRpb24gb2YgYHZhbHVlYCB1c2luZyB0aGUgdmFsaWRhdG9ycyBkZWNsYXJlZCBmb3IgdGhpcyBTY2hlbWFUeXBlLlxuICpcbiAqIEBwYXJhbSB7YW55fSB2YWx1ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZVxuICogQGFwaSBwcml2YXRlXG4gKi9cblNjaGVtYVR5cGUucHJvdG90eXBlLmRvVmFsaWRhdGUgPSBmdW5jdGlvbiAodmFsdWUsIGNhbGxiYWNrLCBzY29wZSkge1xuICB2YXIgZXJyID0gZmFsc2VcbiAgICAsIHBhdGggPSB0aGlzLnBhdGhcbiAgICAsIGNvdW50ID0gdGhpcy52YWxpZGF0b3JzLmxlbmd0aDtcblxuICBpZiAoIWNvdW50KSByZXR1cm4gY2FsbGJhY2sobnVsbCk7XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGUgKG9rLCBtZXNzYWdlLCB0eXBlLCB2YWwpIHtcbiAgICBpZiAoZXJyKSByZXR1cm47XG4gICAgaWYgKG9rID09PSB1bmRlZmluZWQgfHwgb2spIHtcbiAgICAgIC0tY291bnQgfHwgY2FsbGJhY2sobnVsbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrKGVyciA9IG5ldyBWYWxpZGF0b3JFcnJvcihwYXRoLCBtZXNzYWdlLCB0eXBlLCB2YWwpKTtcbiAgICB9XG4gIH1cblxuICB0aGlzLnZhbGlkYXRvcnMuZm9yRWFjaChmdW5jdGlvbiAodikge1xuICAgIHZhciB2YWxpZGF0b3IgPSB2WzBdXG4gICAgICAsIG1lc3NhZ2UgPSB2WzFdXG4gICAgICAsIHR5cGUgPSB2WzJdO1xuXG4gICAgaWYgKHZhbGlkYXRvciBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgdmFsaWRhdGUodmFsaWRhdG9yLnRlc3QodmFsdWUpLCBtZXNzYWdlLCB0eXBlLCB2YWx1ZSk7XG4gICAgfSBlbHNlIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgdmFsaWRhdG9yKSB7XG4gICAgICBpZiAoMiA9PT0gdmFsaWRhdG9yLmxlbmd0aCkge1xuICAgICAgICB2YWxpZGF0b3IuY2FsbChzY29wZSwgdmFsdWUsIGZ1bmN0aW9uIChvaykge1xuICAgICAgICAgIHZhbGlkYXRlKG9rLCBtZXNzYWdlLCB0eXBlLCB2YWx1ZSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsaWRhdGUodmFsaWRhdG9yLmNhbGwoc2NvcGUsIHZhbHVlKSwgbWVzc2FnZSwgdHlwZSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG59O1xuXG4vKipcbiAqIERldGVybWluZXMgaWYgdmFsdWUgaXMgYSB2YWxpZCBSZWZlcmVuY2UuXG4gKlxuICog0J3QsCDQutC70LjQtdC90YLQtSDQsiDQutCw0YfQtdGB0YLQstC1INGB0YHRi9C70LrQuCDQvNC+0LbQvdC+INGF0YDQsNC90LjRgtGMINC60LDQuiBpZCwg0YLQsNC6INC4INC/0L7Qu9C90YvQtSDQtNC+0LrRg9C80LXQvdGC0YtcbiAqXG4gKiBAcGFyYW0ge1NjaGVtYVR5cGV9IHNlbGZcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5TY2hlbWFUeXBlLl9pc1JlZiA9IGZ1bmN0aW9uKCBzZWxmLCB2YWx1ZSApe1xuICAvLyBmYXN0IHBhdGhcbiAgdmFyIHJlZiA9IHNlbGYub3B0aW9ucyAmJiBzZWxmLm9wdGlvbnMucmVmO1xuXG4gIGlmICggcmVmICkge1xuICAgIGlmICggbnVsbCA9PSB2YWx1ZSApIHJldHVybiB0cnVlO1xuICAgIGlmICggXy5pc09iamVjdCggdmFsdWUgKSApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn07XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBTY2hlbWFUeXBlO1xuXG5TY2hlbWFUeXBlLkNhc3RFcnJvciA9IENhc3RFcnJvcjtcblxuU2NoZW1hVHlwZS5WYWxpZGF0b3JFcnJvciA9IFZhbGlkYXRvckVycm9yO1xuIiwiLyohXG4gKiBTdGF0ZU1hY2hpbmUgcmVwcmVzZW50cyBhIG1pbmltYWwgYGludGVyZmFjZWAgZm9yIHRoZVxuICogY29uc3RydWN0b3JzIGl0IGJ1aWxkcyB2aWEgU3RhdGVNYWNoaW5lLmN0b3IoLi4uKS5cbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG52YXIgU3RhdGVNYWNoaW5lID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBTdGF0ZU1hY2hpbmUgKCkge1xuICB0aGlzLnBhdGhzID0ge307XG4gIHRoaXMuc3RhdGVzID0ge307XG59O1xuXG4vKiFcbiAqIFN0YXRlTWFjaGluZS5jdG9yKCdzdGF0ZTEnLCAnc3RhdGUyJywgLi4uKVxuICogQSBmYWN0b3J5IG1ldGhvZCBmb3Igc3ViY2xhc3NpbmcgU3RhdGVNYWNoaW5lLlxuICogVGhlIGFyZ3VtZW50cyBhcmUgYSBsaXN0IG9mIHN0YXRlcy4gRm9yIGVhY2ggc3RhdGUsXG4gKiB0aGUgY29uc3RydWN0b3IncyBwcm90b3R5cGUgZ2V0cyBzdGF0ZSB0cmFuc2l0aW9uXG4gKiBtZXRob2RzIG5hbWVkIGFmdGVyIGVhY2ggc3RhdGUuIFRoZXNlIHRyYW5zaXRpb24gbWV0aG9kc1xuICogcGxhY2UgdGhlaXIgcGF0aCBhcmd1bWVudCBpbnRvIHRoZSBnaXZlbiBzdGF0ZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RhdGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBbc3RhdGVdXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn0gc3ViY2xhc3MgY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cblxuU3RhdGVNYWNoaW5lLmN0b3IgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZXMgPSBfLnRvQXJyYXkoYXJndW1lbnRzKTtcblxuICB2YXIgY3RvciA9IGZ1bmN0aW9uICgpIHtcbiAgICBTdGF0ZU1hY2hpbmUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB0aGlzLnN0YXRlTmFtZXMgPSBzdGF0ZXM7XG5cbiAgICB2YXIgaSA9IHN0YXRlcy5sZW5ndGhcbiAgICAgICwgc3RhdGU7XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBzdGF0ZSA9IHN0YXRlc1tpXTtcbiAgICAgIHRoaXMuc3RhdGVzW3N0YXRlXSA9IHt9O1xuICAgIH1cbiAgfTtcblxuICBjdG9yLnByb3RvdHlwZS5fX3Byb3RvX18gPSBTdGF0ZU1hY2hpbmUucHJvdG90eXBlO1xuXG4gIHN0YXRlcy5mb3JFYWNoKGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgIC8vIENoYW5nZXMgdGhlIGBwYXRoYCdzIHN0YXRlIHRvIGBzdGF0ZWAuXG4gICAgY3Rvci5wcm90b3R5cGVbc3RhdGVdID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICAgIHRoaXMuX2NoYW5nZVN0YXRlKHBhdGgsIHN0YXRlKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBjdG9yO1xufTtcblxuLyohXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIHdyYXBwZWQgYnkgdGhlIHN0YXRlIGNoYW5nZSBmdW5jdGlvbnM6XG4gKlxuICogLSBgcmVxdWlyZShwYXRoKWBcbiAqIC0gYG1vZGlmeShwYXRoKWBcbiAqIC0gYGluaXQocGF0aClgXG4gKlxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuU3RhdGVNYWNoaW5lLnByb3RvdHlwZS5fY2hhbmdlU3RhdGUgPSBmdW5jdGlvbiBfY2hhbmdlU3RhdGUgKHBhdGgsIG5leHRTdGF0ZSkge1xuICB2YXIgcHJldkJ1Y2tldCA9IHRoaXMuc3RhdGVzW3RoaXMucGF0aHNbcGF0aF1dO1xuICBpZiAocHJldkJ1Y2tldCkgZGVsZXRlIHByZXZCdWNrZXRbcGF0aF07XG5cbiAgdGhpcy5wYXRoc1twYXRoXSA9IG5leHRTdGF0ZTtcbiAgdGhpcy5zdGF0ZXNbbmV4dFN0YXRlXVtwYXRoXSA9IHRydWU7XG59O1xuXG4vKiFcbiAqIGlnbm9yZVxuICovXG5cblN0YXRlTWFjaGluZS5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiBjbGVhciAoc3RhdGUpIHtcbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh0aGlzLnN0YXRlc1tzdGF0ZV0pXG4gICAgLCBpID0ga2V5cy5sZW5ndGhcbiAgICAsIHBhdGg7XG5cbiAgd2hpbGUgKGktLSkge1xuICAgIHBhdGggPSBrZXlzW2ldO1xuICAgIGRlbGV0ZSB0aGlzLnN0YXRlc1tzdGF0ZV1bcGF0aF07XG4gICAgZGVsZXRlIHRoaXMucGF0aHNbcGF0aF07XG4gIH1cbn07XG5cbi8qIVxuICogQ2hlY2tzIHRvIHNlZSBpZiBhdCBsZWFzdCBvbmUgcGF0aCBpcyBpbiB0aGUgc3RhdGVzIHBhc3NlZCBpbiB2aWEgYGFyZ3VtZW50c2BcbiAqIGUuZy4sIHRoaXMuc29tZSgncmVxdWlyZWQnLCAnaW5pdGVkJylcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RhdGUgdGhhdCB3ZSB3YW50IHRvIGNoZWNrIGZvci5cbiAqIEBwcml2YXRlXG4gKi9cblxuU3RhdGVNYWNoaW5lLnByb3RvdHlwZS5zb21lID0gZnVuY3Rpb24gc29tZSAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIHdoYXQgPSBhcmd1bWVudHMubGVuZ3RoID8gYXJndW1lbnRzIDogdGhpcy5zdGF0ZU5hbWVzO1xuICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNvbWUuY2FsbCh3aGF0LCBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMoc2VsZi5zdGF0ZXNbc3RhdGVdKS5sZW5ndGg7XG4gIH0pO1xufTtcblxuLyohXG4gKiBUaGlzIGZ1bmN0aW9uIGJ1aWxkcyB0aGUgZnVuY3Rpb25zIHRoYXQgZ2V0IGFzc2lnbmVkIHRvIGBmb3JFYWNoYCBhbmQgYG1hcGAsXG4gKiBzaW5jZSBib3RoIG9mIHRob3NlIG1ldGhvZHMgc2hhcmUgYSBsb3Qgb2YgdGhlIHNhbWUgbG9naWMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGl0ZXJNZXRob2QgaXMgZWl0aGVyICdmb3JFYWNoJyBvciAnbWFwJ1xuICogQHJldHVybiB7RnVuY3Rpb259XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5TdGF0ZU1hY2hpbmUucHJvdG90eXBlLl9pdGVyID0gZnVuY3Rpb24gX2l0ZXIgKGl0ZXJNZXRob2QpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbnVtQXJncyA9IGFyZ3VtZW50cy5sZW5ndGhcbiAgICAgICwgc3RhdGVzID0gXy50b0FycmF5KGFyZ3VtZW50cykuc2xpY2UoMCwgbnVtQXJncy0xKVxuICAgICAgLCBjYWxsYmFjayA9IGFyZ3VtZW50c1tudW1BcmdzLTFdO1xuXG4gICAgaWYgKCFzdGF0ZXMubGVuZ3RoKSBzdGF0ZXMgPSB0aGlzLnN0YXRlTmFtZXM7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgcGF0aHMgPSBzdGF0ZXMucmVkdWNlKGZ1bmN0aW9uIChwYXRocywgc3RhdGUpIHtcbiAgICAgIHJldHVybiBwYXRocy5jb25jYXQoT2JqZWN0LmtleXMoc2VsZi5zdGF0ZXNbc3RhdGVdKSk7XG4gICAgfSwgW10pO1xuXG4gICAgcmV0dXJuIHBhdGhzW2l0ZXJNZXRob2RdKGZ1bmN0aW9uIChwYXRoLCBpLCBwYXRocykge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKHBhdGgsIGksIHBhdGhzKTtcbiAgICB9KTtcbiAgfTtcbn07XG5cbi8qIVxuICogSXRlcmF0ZXMgb3ZlciB0aGUgcGF0aHMgdGhhdCBiZWxvbmcgdG8gb25lIG9mIHRoZSBwYXJhbWV0ZXIgc3RhdGVzLlxuICpcbiAqIFRoZSBmdW5jdGlvbiBwcm9maWxlIGNhbiBsb29rIGxpa2U6XG4gKiB0aGlzLmZvckVhY2goc3RhdGUxLCBmbik7ICAgICAgICAgLy8gaXRlcmF0ZXMgb3ZlciBhbGwgcGF0aHMgaW4gc3RhdGUxXG4gKiB0aGlzLmZvckVhY2goc3RhdGUxLCBzdGF0ZTIsIGZuKTsgLy8gaXRlcmF0ZXMgb3ZlciBhbGwgcGF0aHMgaW4gc3RhdGUxIG9yIHN0YXRlMlxuICogdGhpcy5mb3JFYWNoKGZuKTsgICAgICAgICAgICAgICAgIC8vIGl0ZXJhdGVzIG92ZXIgYWxsIHBhdGhzIGluIGFsbCBzdGF0ZXNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gW3N0YXRlXVxuICogQHBhcmFtIHtTdHJpbmd9IFtzdGF0ZV1cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcHJpdmF0ZVxuICovXG5cblN0YXRlTWFjaGluZS5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIGZvckVhY2ggKCkge1xuICB0aGlzLmZvckVhY2ggPSB0aGlzLl9pdGVyKCdmb3JFYWNoJyk7XG4gIHJldHVybiB0aGlzLmZvckVhY2guYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbi8qIVxuICogTWFwcyBvdmVyIHRoZSBwYXRocyB0aGF0IGJlbG9uZyB0byBvbmUgb2YgdGhlIHBhcmFtZXRlciBzdGF0ZXMuXG4gKlxuICogVGhlIGZ1bmN0aW9uIHByb2ZpbGUgY2FuIGxvb2sgbGlrZTpcbiAqIHRoaXMuZm9yRWFjaChzdGF0ZTEsIGZuKTsgICAgICAgICAvLyBpdGVyYXRlcyBvdmVyIGFsbCBwYXRocyBpbiBzdGF0ZTFcbiAqIHRoaXMuZm9yRWFjaChzdGF0ZTEsIHN0YXRlMiwgZm4pOyAvLyBpdGVyYXRlcyBvdmVyIGFsbCBwYXRocyBpbiBzdGF0ZTEgb3Igc3RhdGUyXG4gKiB0aGlzLmZvckVhY2goZm4pOyAgICAgICAgICAgICAgICAgLy8gaXRlcmF0ZXMgb3ZlciBhbGwgcGF0aHMgaW4gYWxsIHN0YXRlc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBbc3RhdGVdXG4gKiBAcGFyYW0ge1N0cmluZ30gW3N0YXRlXVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEByZXR1cm4ge0FycmF5fVxuICogQHByaXZhdGVcbiAqL1xuXG5TdGF0ZU1hY2hpbmUucHJvdG90eXBlLm1hcCA9IGZ1bmN0aW9uIG1hcCAoKSB7XG4gIHRoaXMubWFwID0gdGhpcy5faXRlcignbWFwJyk7XG4gIHJldHVybiB0aGlzLm1hcC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuIiwiLy9UT0RPOiDQv9C+0YfQuNGB0YLQuNGC0Ywg0LrQvtC0XG5cbi8qIVxuICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAqL1xuXG52YXIgRW1iZWRkZWREb2N1bWVudCA9IHJlcXVpcmUoJy4vZW1iZWRkZWQnKTtcbnZhciBEb2N1bWVudCA9IHJlcXVpcmUoJy4uL2RvY3VtZW50Jyk7XG52YXIgT2JqZWN0SWQgPSByZXF1aXJlKCcuL29iamVjdGlkJyk7XG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xuXG4vKipcbiAqIFN0b3JhZ2UgQXJyYXkgY29uc3RydWN0b3IuXG4gKlxuICogIyMjI05PVEU6XG4gKlxuICogX1ZhbHVlcyBhbHdheXMgaGF2ZSB0byBiZSBwYXNzZWQgdG8gdGhlIGNvbnN0cnVjdG9yIHRvIGluaXRpYWxpemUsIG90aGVyd2lzZSBgU3RvcmFnZUFycmF5I3B1c2hgIHdpbGwgbWFyayB0aGUgYXJyYXkgYXMgbW9kaWZpZWQuX1xuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHZhbHVlc1xuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvYyBwYXJlbnQgZG9jdW1lbnRcbiAqIEBhcGkgcHJpdmF0ZVxuICogQGluaGVyaXRzIEFycmF5XG4gKiBAc2VlIGh0dHA6Ly9iaXQubHkvZjZDblpVXG4gKi9cbmZ1bmN0aW9uIFN0b3JhZ2VBcnJheSAodmFsdWVzLCBwYXRoLCBkb2MpIHtcbiAgdmFyIGFyciA9IFtdO1xuICBhcnIucHVzaC5hcHBseShhcnIsIHZhbHVlcyk7XG4gIGFyci5fX3Byb3RvX18gPSBTdG9yYWdlQXJyYXkucHJvdG90eXBlO1xuXG4gIGFyci52YWxpZGF0b3JzID0gW107XG4gIGFyci5fcGF0aCA9IHBhdGg7XG5cbiAgaWYgKGRvYykge1xuICAgIGFyci5fcGFyZW50ID0gZG9jO1xuICAgIGFyci5fc2NoZW1hID0gZG9jLnNjaGVtYS5wYXRoKHBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIGFycjtcbn1cblxuLyohXG4gKiBJbmhlcml0IGZyb20gQXJyYXlcbiAqL1xuU3RvcmFnZUFycmF5LnByb3RvdHlwZSA9IG5ldyBBcnJheTtcblxuLyoqXG4gKiBQYXJlbnQgb3duZXIgZG9jdW1lbnRcbiAqXG4gKiBAcHJvcGVydHkgX3BhcmVudFxuICogQGFwaSBwcml2YXRlXG4gKi9cblN0b3JhZ2VBcnJheS5wcm90b3R5cGUuX3BhcmVudDtcblxuLyoqXG4gKiBDYXN0cyBhIG1lbWJlciBiYXNlZCBvbiB0aGlzIGFycmF5cyBzY2hlbWEuXG4gKlxuICogQHBhcmFtIHthbnl9IHZhbHVlXG4gKiBAcmV0dXJuIHZhbHVlIHRoZSBjYXN0ZWQgdmFsdWVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5TdG9yYWdlQXJyYXkucHJvdG90eXBlLl9jYXN0ID0gZnVuY3Rpb24gKCB2YWx1ZSApIHtcbiAgdmFyIG93bmVyID0gdGhpcy5fb3duZXI7XG4gIHZhciBwb3B1bGF0ZWQgPSBmYWxzZTtcblxuICBpZiAodGhpcy5fcGFyZW50KSB7XG4gICAgLy8gaWYgYSBwb3B1bGF0ZWQgYXJyYXksIHdlIG11c3QgY2FzdCB0byB0aGUgc2FtZSBtb2RlbFxuICAgIC8vIGluc3RhbmNlIGFzIHNwZWNpZmllZCBpbiB0aGUgb3JpZ2luYWwgcXVlcnkuXG4gICAgaWYgKCFvd25lcikge1xuICAgICAgb3duZXIgPSB0aGlzLl9vd25lciA9IHRoaXMuX3BhcmVudC5vd25lckRvY3VtZW50XG4gICAgICAgID8gdGhpcy5fcGFyZW50Lm93bmVyRG9jdW1lbnQoKVxuICAgICAgICA6IHRoaXMuX3BhcmVudDtcbiAgICB9XG5cbiAgICBwb3B1bGF0ZWQgPSBvd25lci5wb3B1bGF0ZWQodGhpcy5fcGF0aCwgdHJ1ZSk7XG4gIH1cblxuICBpZiAocG9wdWxhdGVkICYmIG51bGwgIT0gdmFsdWUpIHtcbiAgICAvLyBjYXN0IHRvIHRoZSBwb3B1bGF0ZWQgTW9kZWxzIHNjaGVtYVxuICAgIHZhciBNb2RlbCA9IHBvcHVsYXRlZC5vcHRpb25zLm1vZGVsO1xuXG4gICAgLy8gb25seSBvYmplY3RzIGFyZSBwZXJtaXR0ZWQgc28gd2UgY2FuIHNhZmVseSBhc3N1bWUgdGhhdFxuICAgIC8vIG5vbi1vYmplY3RzIGFyZSB0byBiZSBpbnRlcnByZXRlZCBhcyBfaWRcbiAgICBpZiAoIHZhbHVlIGluc3RhbmNlb2YgT2JqZWN0SWQgfHwgIV8uaXNPYmplY3QodmFsdWUpICkge1xuICAgICAgdmFsdWUgPSB7IF9pZDogdmFsdWUgfTtcbiAgICB9XG5cbiAgICB2YWx1ZSA9IG5ldyBNb2RlbCh2YWx1ZSk7XG4gICAgcmV0dXJuIHRoaXMuX3NjaGVtYS5jYXN0ZXIuY2FzdCh2YWx1ZSwgdGhpcy5fcGFyZW50LCB0cnVlKVxuICB9XG5cbiAgcmV0dXJuIHRoaXMuX3NjaGVtYS5jYXN0ZXIuY2FzdCh2YWx1ZSwgdGhpcy5fcGFyZW50LCBmYWxzZSlcbn07XG5cbi8qKlxuICogTWFya3MgdGhpcyBhcnJheSBhcyBtb2RpZmllZC5cbiAqXG4gKiBJZiBpdCBidWJibGVzIHVwIGZyb20gYW4gZW1iZWRkZWQgZG9jdW1lbnQgY2hhbmdlLCB0aGVuIGl0IHRha2VzIHRoZSBmb2xsb3dpbmcgYXJndW1lbnRzIChvdGhlcndpc2UsIHRha2VzIDAgYXJndW1lbnRzKVxuICpcbiAqIEBwYXJhbSB7RW1iZWRkZWREb2N1bWVudH0gZW1iZWRkZWREb2MgdGhlIGVtYmVkZGVkIGRvYyB0aGF0IGludm9rZWQgdGhpcyBtZXRob2Qgb24gdGhlIEFycmF5XG4gKiBAcGFyYW0ge1N0cmluZ30gZW1iZWRkZWRQYXRoIHRoZSBwYXRoIHdoaWNoIGNoYW5nZWQgaW4gdGhlIGVtYmVkZGVkRG9jXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuU3RvcmFnZUFycmF5LnByb3RvdHlwZS5fbWFya01vZGlmaWVkID0gZnVuY3Rpb24gKGVsZW0sIGVtYmVkZGVkUGF0aCkge1xuICB2YXIgcGFyZW50ID0gdGhpcy5fcGFyZW50XG4gICAgLCBkaXJ0eVBhdGg7XG5cbiAgaWYgKHBhcmVudCkge1xuICAgIGRpcnR5UGF0aCA9IHRoaXMuX3BhdGg7XG5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgaWYgKG51bGwgIT0gZW1iZWRkZWRQYXRoKSB7XG4gICAgICAgIC8vIGFuIGVtYmVkZGVkIGRvYyBidWJibGVkIHVwIHRoZSBjaGFuZ2VcbiAgICAgICAgZGlydHlQYXRoID0gZGlydHlQYXRoICsgJy4nICsgdGhpcy5pbmRleE9mKGVsZW0pICsgJy4nICsgZW1iZWRkZWRQYXRoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZGlyZWN0bHkgc2V0IGFuIGluZGV4XG4gICAgICAgIGRpcnR5UGF0aCA9IGRpcnR5UGF0aCArICcuJyArIGVsZW07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcGFyZW50Lm1hcmtNb2RpZmllZChkaXJ0eVBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFdyYXBzIFtgQXJyYXkjcHVzaGBdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L3B1c2gpIHdpdGggcHJvcGVyIGNoYW5nZSB0cmFja2luZy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gW2FyZ3MuLi5dXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TdG9yYWdlQXJyYXkucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiAoKSB7XG4gIHZhciB2YWx1ZXMgPSBbXS5tYXAuY2FsbChhcmd1bWVudHMsIHRoaXMuX2Nhc3QsIHRoaXMpXG4gICAgLCByZXQgPSBbXS5wdXNoLmFwcGx5KHRoaXMsIHZhbHVlcyk7XG5cbiAgdGhpcy5fbWFya01vZGlmaWVkKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG4vKipcbiAqIFdyYXBzIFtgQXJyYXkjcG9wYF0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvQXJyYXkvcG9wKSB3aXRoIHByb3BlciBjaGFuZ2UgdHJhY2tpbmcuXG4gKlxuICogIyMjI05vdGU6XG4gKlxuICogX21hcmtzIHRoZSBlbnRpcmUgYXJyYXkgYXMgbW9kaWZpZWQgd2hpY2ggd2lsbCBwYXNzIHRoZSBlbnRpcmUgdGhpbmcgdG8gJHNldCBwb3RlbnRpYWxseSBvdmVyd3JpdHRpbmcgYW55IGNoYW5nZXMgdGhhdCBoYXBwZW4gYmV0d2VlbiB3aGVuIHlvdSByZXRyaWV2ZWQgdGhlIG9iamVjdCBhbmQgd2hlbiB5b3Ugc2F2ZSBpdC5fXG4gKlxuICogQHNlZSBTdG9yYWdlQXJyYXkjJHBvcCAjdHlwZXNfYXJyYXlfTW9uZ29vc2VBcnJheS0lMjRwb3BcbiAqIEBhcGkgcHVibGljXG4gKi9cblN0b3JhZ2VBcnJheS5wcm90b3R5cGUucG9wID0gZnVuY3Rpb24gKCkge1xuICB2YXIgcmV0ID0gW10ucG9wLmNhbGwodGhpcyk7XG5cbiAgdGhpcy5fbWFya01vZGlmaWVkKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG4vKipcbiAqIFdyYXBzIFtgQXJyYXkjc2hpZnRgXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9BcnJheS91bnNoaWZ0KSB3aXRoIHByb3BlciBjaGFuZ2UgdHJhY2tpbmcuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIGRvYy5hcnJheSA9IFsyLDNdO1xuICogICAgIHZhciByZXMgPSBkb2MuYXJyYXkuc2hpZnQoKTtcbiAqICAgICBjb25zb2xlLmxvZyhyZXMpIC8vIDJcbiAqICAgICBjb25zb2xlLmxvZyhkb2MuYXJyYXkpIC8vIFszXVxuICpcbiAqICMjIyNOb3RlOlxuICpcbiAqIF9tYXJrcyB0aGUgZW50aXJlIGFycmF5IGFzIG1vZGlmaWVkLCB3aGljaCBpZiBzYXZlZCwgd2lsbCBzdG9yZSBpdCBhcyBhIGAkc2V0YCBvcGVyYXRpb24sIHBvdGVudGlhbGx5IG92ZXJ3cml0dGluZyBhbnkgY2hhbmdlcyB0aGF0IGhhcHBlbiBiZXR3ZWVuIHdoZW4geW91IHJldHJpZXZlZCB0aGUgb2JqZWN0IGFuZCB3aGVuIHlvdSBzYXZlIGl0Ll9cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TdG9yYWdlQXJyYXkucHJvdG90eXBlLnNoaWZ0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgcmV0ID0gW10uc2hpZnQuY2FsbCh0aGlzKTtcblxuICB0aGlzLl9tYXJrTW9kaWZpZWQoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbi8qKlxuICogUHVsbHMgaXRlbXMgZnJvbSB0aGUgYXJyYXkgYXRvbWljYWxseS5cbiAqXG4gKiAjIyMjRXhhbXBsZXM6XG4gKlxuICogICAgIGRvYy5hcnJheS5wdWxsKE9iamVjdElkKVxuICogICAgIGRvYy5hcnJheS5wdWxsKHsgX2lkOiAnc29tZUlkJyB9KVxuICogICAgIGRvYy5hcnJheS5wdWxsKDM2KVxuICogICAgIGRvYy5hcnJheS5wdWxsKCd0YWcgMScsICd0YWcgMicpXG4gKlxuICogVG8gcmVtb3ZlIGEgZG9jdW1lbnQgZnJvbSBhIHN1YmRvY3VtZW50IGFycmF5IHdlIG1heSBwYXNzIGFuIG9iamVjdCB3aXRoIGEgbWF0Y2hpbmcgYF9pZGAuXG4gKlxuICogICAgIGRvYy5zdWJkb2NzLnB1c2goeyBfaWQ6IDQ4MTUxNjIzNDIgfSlcbiAqICAgICBkb2Muc3ViZG9jcy5wdWxsKHsgX2lkOiA0ODE1MTYyMzQyIH0pIC8vIHJlbW92ZWRcbiAqXG4gKiBPciB3ZSBtYXkgcGFzc2luZyB0aGUgX2lkIGRpcmVjdGx5IGFuZCBsZXQgbW9uZ29vc2UgdGFrZSBjYXJlIG9mIGl0LlxuICpcbiAqICAgICBkb2Muc3ViZG9jcy5wdXNoKHsgX2lkOiA0ODE1MTYyMzQyIH0pXG4gKiAgICAgZG9jLnN1YmRvY3MucHVsbCg0ODE1MTYyMzQyKTsgLy8gd29ya3NcbiAqXG4gKiBAcGFyYW0ge2FueX0gW2FyZ3MuLi5dXG4gKiBAc2VlIG1vbmdvZGIgaHR0cDovL3d3dy5tb25nb2RiLm9yZy9kaXNwbGF5L0RPQ1MvVXBkYXRpbmcvI1VwZGF0aW5nLSUyNHB1bGxcbiAqIEBhcGkgcHVibGljXG4gKi9cblN0b3JhZ2VBcnJheS5wcm90b3R5cGUucHVsbCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHZhbHVlcyA9IFtdLm1hcC5jYWxsKGFyZ3VtZW50cywgdGhpcy5fY2FzdCwgdGhpcylcbiAgICAsIGN1ciA9IHRoaXMuX3BhcmVudC5nZXQodGhpcy5fcGF0aClcbiAgICAsIGkgPSBjdXIubGVuZ3RoXG4gICAgLCBtZW07XG5cbiAgd2hpbGUgKGktLSkge1xuICAgIG1lbSA9IGN1cltpXTtcbiAgICBpZiAobWVtIGluc3RhbmNlb2YgRW1iZWRkZWREb2N1bWVudCkge1xuICAgICAgaWYgKHZhbHVlcy5zb21lKGZ1bmN0aW9uICh2KSB7IHJldHVybiB2LmVxdWFscyhtZW0pOyB9ICkpIHtcbiAgICAgICAgW10uc3BsaWNlLmNhbGwoY3VyLCBpLCAxKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKH5jdXIuaW5kZXhPZi5jYWxsKHZhbHVlcywgbWVtKSkge1xuICAgICAgW10uc3BsaWNlLmNhbGwoY3VyLCBpLCAxKTtcbiAgICB9XG4gIH1cblxuICB0aGlzLl9tYXJrTW9kaWZpZWQoKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEFsaWFzIG9mIFtwdWxsXSgjdHlwZXNfYXJyYXlfTW9uZ29vc2VBcnJheS1wdWxsKVxuICpcbiAqIEBzZWUgU3RvcmFnZUFycmF5I3B1bGwgI3R5cGVzX2FycmF5X01vbmdvb3NlQXJyYXktcHVsbFxuICogQHNlZSBtb25nb2RiIGh0dHA6Ly93d3cubW9uZ29kYi5vcmcvZGlzcGxheS9ET0NTL1VwZGF0aW5nLyNVcGRhdGluZy0lMjRwdWxsXG4gKiBAYXBpIHB1YmxpY1xuICogQG1lbWJlck9mIFN0b3JhZ2VBcnJheVxuICogQG1ldGhvZCByZW1vdmVcbiAqL1xuU3RvcmFnZUFycmF5LnByb3RvdHlwZS5yZW1vdmUgPSBTdG9yYWdlQXJyYXkucHJvdG90eXBlLnB1bGw7XG5cbi8qKlxuICogV3JhcHMgW2BBcnJheSNzcGxpY2VgXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9BcnJheS9zcGxpY2UpIHdpdGggcHJvcGVyIGNoYW5nZSB0cmFja2luZyBhbmQgY2FzdGluZy5cbiAqXG4gKiAjIyMjTm90ZTpcbiAqXG4gKiBfbWFya3MgdGhlIGVudGlyZSBhcnJheSBhcyBtb2RpZmllZCwgd2hpY2ggaWYgc2F2ZWQsIHdpbGwgc3RvcmUgaXQgYXMgYSBgJHNldGAgb3BlcmF0aW9uLCBwb3RlbnRpYWxseSBvdmVyd3JpdHRpbmcgYW55IGNoYW5nZXMgdGhhdCBoYXBwZW4gYmV0d2VlbiB3aGVuIHlvdSByZXRyaWV2ZWQgdGhlIG9iamVjdCBhbmQgd2hlbiB5b3Ugc2F2ZSBpdC5fXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuU3RvcmFnZUFycmF5LnByb3RvdHlwZS5zcGxpY2UgPSBmdW5jdGlvbiBzcGxpY2UgKCkge1xuICB2YXIgcmV0LCB2YWxzLCBpO1xuXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgdmFscyA9IFtdO1xuICAgIGZvciAoaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhbHNbaV0gPSBpIDwgMlxuICAgICAgICA/IGFyZ3VtZW50c1tpXVxuICAgICAgICA6IHRoaXMuX2Nhc3QoYXJndW1lbnRzW2ldKTtcbiAgICB9XG4gICAgcmV0ID0gW10uc3BsaWNlLmFwcGx5KHRoaXMsIHZhbHMpO1xuXG4gICAgdGhpcy5fbWFya01vZGlmaWVkKCk7XG4gIH1cblxuICByZXR1cm4gcmV0O1xufTtcblxuLyoqXG4gKiBXcmFwcyBbYEFycmF5I3Vuc2hpZnRgXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9BcnJheS91bnNoaWZ0KSB3aXRoIHByb3BlciBjaGFuZ2UgdHJhY2tpbmcuXG4gKlxuICogIyMjI05vdGU6XG4gKlxuICogX21hcmtzIHRoZSBlbnRpcmUgYXJyYXkgYXMgbW9kaWZpZWQsIHdoaWNoIGlmIHNhdmVkLCB3aWxsIHN0b3JlIGl0IGFzIGEgYCRzZXRgIG9wZXJhdGlvbiwgcG90ZW50aWFsbHkgb3ZlcndyaXR0aW5nIGFueSBjaGFuZ2VzIHRoYXQgaGFwcGVuIGJldHdlZW4gd2hlbiB5b3UgcmV0cmlldmVkIHRoZSBvYmplY3QgYW5kIHdoZW4geW91IHNhdmUgaXQuX1xuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblN0b3JhZ2VBcnJheS5wcm90b3R5cGUudW5zaGlmdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHZhbHVlcyA9IFtdLm1hcC5jYWxsKGFyZ3VtZW50cywgdGhpcy5fY2FzdCwgdGhpcyk7XG4gIFtdLnVuc2hpZnQuYXBwbHkodGhpcywgdmFsdWVzKTtcblxuICB0aGlzLl9tYXJrTW9kaWZpZWQoKTtcbiAgcmV0dXJuIHRoaXMubGVuZ3RoO1xufTtcblxuLyoqXG4gKiBXcmFwcyBbYEFycmF5I3NvcnRgXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9BcnJheS9zb3J0KSB3aXRoIHByb3BlciBjaGFuZ2UgdHJhY2tpbmcuXG4gKlxuICogIyMjI05PVEU6XG4gKlxuICogX21hcmtzIHRoZSBlbnRpcmUgYXJyYXkgYXMgbW9kaWZpZWQsIHdoaWNoIGlmIHNhdmVkLCB3aWxsIHN0b3JlIGl0IGFzIGEgYCRzZXRgIG9wZXJhdGlvbiwgcG90ZW50aWFsbHkgb3ZlcndyaXR0aW5nIGFueSBjaGFuZ2VzIHRoYXQgaGFwcGVuIGJldHdlZW4gd2hlbiB5b3UgcmV0cmlldmVkIHRoZSBvYmplY3QgYW5kIHdoZW4geW91IHNhdmUgaXQuX1xuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblN0b3JhZ2VBcnJheS5wcm90b3R5cGUuc29ydCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHJldCA9IFtdLnNvcnQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICB0aGlzLl9tYXJrTW9kaWZpZWQoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbi8qKlxuICogQWRkcyB2YWx1ZXMgdG8gdGhlIGFycmF5IGlmIG5vdCBhbHJlYWR5IHByZXNlbnQuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIGNvbnNvbGUubG9nKGRvYy5hcnJheSkgLy8gWzIsMyw0XVxuICogICAgIHZhciBhZGRlZCA9IGRvYy5hcnJheS5hZGRUb1NldCg0LDUpO1xuICogICAgIGNvbnNvbGUubG9nKGRvYy5hcnJheSkgLy8gWzIsMyw0LDVdXG4gKiAgICAgY29uc29sZS5sb2coYWRkZWQpICAgICAvLyBbNV1cbiAqXG4gKiBAcGFyYW0ge2FueX0gW2FyZ3MuLi5dXG4gKiBAcmV0dXJuIHtBcnJheX0gdGhlIHZhbHVlcyB0aGF0IHdlcmUgYWRkZWRcbiAqIEBhcGkgcHVibGljXG4gKi9cblN0b3JhZ2VBcnJheS5wcm90b3R5cGUuYWRkVG9TZXQgPSBmdW5jdGlvbiBhZGRUb1NldCAoKSB7XG4gIHZhciB2YWx1ZXMgPSBbXS5tYXAuY2FsbChhcmd1bWVudHMsIHRoaXMuX2Nhc3QsIHRoaXMpXG4gICAgLCBhZGRlZCA9IFtdXG4gICAgLCB0eXBlID0gdmFsdWVzWzBdIGluc3RhbmNlb2YgRW1iZWRkZWREb2N1bWVudCA/ICdkb2MnIDpcbiAgICAgICAgICAgICB2YWx1ZXNbMF0gaW5zdGFuY2VvZiBEYXRlID8gJ2RhdGUnIDpcbiAgICAgICAgICAgICAnJztcblxuICB2YWx1ZXMuZm9yRWFjaChmdW5jdGlvbiAodikge1xuICAgIHZhciBmb3VuZDtcbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgIGNhc2UgJ2RvYyc6XG4gICAgICAgIGZvdW5kID0gdGhpcy5zb21lKGZ1bmN0aW9uKGRvYyl7IHJldHVybiBkb2MuZXF1YWxzKHYpIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2RhdGUnOlxuICAgICAgICB2YXIgdmFsID0gK3Y7XG4gICAgICAgIGZvdW5kID0gdGhpcy5zb21lKGZ1bmN0aW9uKGQpeyByZXR1cm4gK2QgPT09IHZhbCB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBmb3VuZCA9IH50aGlzLmluZGV4T2Yodik7XG4gICAgfVxuXG4gICAgaWYgKCFmb3VuZCkge1xuICAgICAgW10ucHVzaC5jYWxsKHRoaXMsIHYpO1xuXG4gICAgICB0aGlzLl9tYXJrTW9kaWZpZWQoKTtcbiAgICAgIFtdLnB1c2guY2FsbChhZGRlZCwgdik7XG4gICAgfVxuICB9LCB0aGlzKTtcblxuICByZXR1cm4gYWRkZWQ7XG59O1xuXG4vKipcbiAqIFNldHMgdGhlIGNhc3RlZCBgdmFsYCBhdCBpbmRleCBgaWAgYW5kIG1hcmtzIHRoZSBhcnJheSBtb2RpZmllZC5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgLy8gZ2l2ZW4gZG9jdW1lbnRzIGJhc2VkIG9uIHRoZSBmb2xsb3dpbmdcbiAqICAgICB2YXIgRG9jID0gbW9uZ29vc2UubW9kZWwoJ0RvYycsIG5ldyBTY2hlbWEoeyBhcnJheTogW051bWJlcl0gfSkpO1xuICpcbiAqICAgICB2YXIgZG9jID0gbmV3IERvYyh7IGFycmF5OiBbMiwzLDRdIH0pXG4gKlxuICogICAgIGNvbnNvbGUubG9nKGRvYy5hcnJheSkgLy8gWzIsMyw0XVxuICpcbiAqICAgICBkb2MuYXJyYXkuc2V0KDEsXCI1XCIpO1xuICogICAgIGNvbnNvbGUubG9nKGRvYy5hcnJheSk7IC8vIFsyLDUsNF0gLy8gcHJvcGVybHkgY2FzdCB0byBudW1iZXJcbiAqICAgICBkb2Muc2F2ZSgpIC8vIHRoZSBjaGFuZ2UgaXMgc2F2ZWRcbiAqXG4gKiAgICAgLy8gVlMgbm90IHVzaW5nIGFycmF5I3NldFxuICogICAgIGRvYy5hcnJheVsxXSA9IFwiNVwiO1xuICogICAgIGNvbnNvbGUubG9nKGRvYy5hcnJheSk7IC8vIFsyLFwiNVwiLDRdIC8vIG5vIGNhc3RpbmdcbiAqICAgICBkb2Muc2F2ZSgpIC8vIGNoYW5nZSBpcyBub3Qgc2F2ZWRcbiAqXG4gKiBAcmV0dXJuIHtBcnJheX0gdGhpc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuU3RvcmFnZUFycmF5LnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAoaSwgdmFsKSB7XG4gIHRoaXNbaV0gPSB0aGlzLl9jYXN0KHZhbCk7XG4gIHRoaXMuX21hcmtNb2RpZmllZChpKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYSBuYXRpdmUganMgQXJyYXkuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge0FycmF5fVxuICogQGFwaSBwdWJsaWNcbiAqL1xuU3RvcmFnZUFycmF5LnByb3RvdHlwZS50b09iamVjdCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZGVwb3B1bGF0ZSkge1xuICAgIHJldHVybiB0aGlzLm1hcChmdW5jdGlvbiAoZG9jKSB7XG4gICAgICByZXR1cm4gZG9jIGluc3RhbmNlb2YgRG9jdW1lbnRcbiAgICAgICAgPyBkb2MudG9PYmplY3Qob3B0aW9ucylcbiAgICAgICAgOiBkb2NcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB0aGlzLnNsaWNlKCk7XG59O1xuXG5cbi8qKlxuICogUmV0dXJuIHRoZSBpbmRleCBvZiBgb2JqYCBvciBgLTFgIGlmIG5vdCBmb3VuZC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIHRoZSBpdGVtIHRvIGxvb2sgZm9yXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5TdG9yYWdlQXJyYXkucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBpbmRleE9mIChvYmopIHtcbiAgaWYgKG9iaiBpbnN0YW5jZW9mIE9iamVjdElkKSBvYmogPSBvYmoudG9TdHJpbmcoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRoaXMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAob2JqID09IHRoaXNbaV0pXG4gICAgICByZXR1cm4gaTtcbiAgfVxuICByZXR1cm4gLTE7XG59O1xuXG4vKiFcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gU3RvcmFnZUFycmF5O1xuIiwiLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBTdG9yYWdlQXJyYXkgPSByZXF1aXJlKCcuL2FycmF5JylcbiAgLCBPYmplY3RJZCA9IHJlcXVpcmUoJy4vb2JqZWN0aWQnKVxuICAsIE9iamVjdElkU2NoZW1hID0gcmVxdWlyZSgnLi4vc2NoZW1hL29iamVjdGlkJylcbiAgLCB1dGlscyA9IHJlcXVpcmUoJy4uL3V0aWxzJylcbiAgLCBEb2N1bWVudCA9IHJlcXVpcmUoJy4uL2RvY3VtZW50Jyk7XG5cbi8qKlxuICogRG9jdW1lbnRBcnJheSBjb25zdHJ1Y3RvclxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHZhbHVlc1xuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggdGhlIHBhdGggdG8gdGhpcyBhcnJheVxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jIHBhcmVudCBkb2N1bWVudFxuICogQGFwaSBwcml2YXRlXG4gKiBAcmV0dXJuIHtTdG9yYWdlRG9jdW1lbnRBcnJheX1cbiAqIEBpbmhlcml0cyBTdG9yYWdlQXJyYXlcbiAqIEBzZWUgaHR0cDovL2JpdC5seS9mNkNuWlVcbiAqIFRPRE86INC/0L7QtNGH0LjRgdGC0LjRgtGMINC60L7QtFxuICpcbiAqINCS0LXRgdGMINC90YPQttC90YvQuSDQutC+0LQg0YHQutC+0L/QuNGA0L7QstCw0L1cbiAqL1xuZnVuY3Rpb24gU3RvcmFnZURvY3VtZW50QXJyYXkgKHZhbHVlcywgcGF0aCwgZG9jKSB7XG4gIHZhciBhcnIgPSBbXTtcblxuICAvLyBWYWx1ZXMgYWx3YXlzIGhhdmUgdG8gYmUgcGFzc2VkIHRvIHRoZSBjb25zdHJ1Y3RvciB0byBpbml0aWFsaXplLCBzaW5jZVxuICAvLyBvdGhlcndpc2UgU3RvcmFnZUFycmF5I3B1c2ggd2lsbCBtYXJrIHRoZSBhcnJheSBhcyBtb2RpZmllZCB0byB0aGUgcGFyZW50LlxuICBhcnIucHVzaC5hcHBseShhcnIsIHZhbHVlcyk7XG4gIGFyci5fX3Byb3RvX18gPSBTdG9yYWdlRG9jdW1lbnRBcnJheS5wcm90b3R5cGU7XG5cbiAgYXJyLnZhbGlkYXRvcnMgPSBbXTtcbiAgYXJyLl9wYXRoID0gcGF0aDtcblxuICBpZiAoZG9jKSB7XG4gICAgYXJyLl9wYXJlbnQgPSBkb2M7XG4gICAgYXJyLl9zY2hlbWEgPSBkb2Muc2NoZW1hLnBhdGgocGF0aCk7XG4gICAgYXJyLl9oYW5kbGVycyA9IHtcbiAgICAgIGlzTmV3OiBhcnIubm90aWZ5KCdpc05ldycpLFxuICAgICAgc2F2ZTogYXJyLm5vdGlmeSgnc2F2ZScpXG4gICAgfVxuICAgIC8vINCf0YDQvtCx0YDQvtGBINC40LfQvNC10L3QtdC90LjRjyDRgdC+0YHRgtC+0Y/QvdC40Y8g0LIg0L/QvtC00LTQvtC60YPQvNC10L3RglxuICAgIGRvYy5vbignc2F2ZScsIGFyci5faGFuZGxlcnMuc2F2ZSk7XG4gICAgZG9jLm9uKCdpc05ldycsIGFyci5faGFuZGxlcnMuaXNOZXcpO1xuICB9XG5cbiAgcmV0dXJuIGFycjtcbn1cblxuLyohXG4gKiBJbmhlcml0cyBmcm9tIFN0b3JhZ2VBcnJheVxuICovXG5TdG9yYWdlRG9jdW1lbnRBcnJheS5wcm90b3R5cGUuX19wcm90b19fID0gU3RvcmFnZUFycmF5LnByb3RvdHlwZTtcblxuLyoqXG4gKiBPdmVycmlkZXMgU3RvcmFnZUFycmF5I2Nhc3RcbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuU3RvcmFnZURvY3VtZW50QXJyYXkucHJvdG90eXBlLl9jYXN0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIHRoaXMuX3NjaGVtYS5jYXN0ZXJDb25zdHJ1Y3Rvcikge1xuICAgIGlmICghKHZhbHVlLl9fcGFyZW50ICYmIHZhbHVlLl9fcGFyZW50QXJyYXkpKSB7XG4gICAgICAvLyB2YWx1ZSBtYXkgaGF2ZSBiZWVuIGNyZWF0ZWQgdXNpbmcgYXJyYXkuY3JlYXRlKClcbiAgICAgIHZhbHVlLl9fcGFyZW50ID0gdGhpcy5fcGFyZW50O1xuICAgICAgdmFsdWUuX19wYXJlbnRBcnJheSA9IHRoaXM7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG4gIC8vIGhhbmRsZSBjYXN0KCdzdHJpbmcnKSBvciBjYXN0KE9iamVjdElkKSBldGMuXG4gIC8vIG9ubHkgb2JqZWN0cyBhcmUgcGVybWl0dGVkIHNvIHdlIGNhbiBzYWZlbHkgYXNzdW1lIHRoYXRcbiAgLy8gbm9uLW9iamVjdHMgYXJlIHRvIGJlIGludGVycHJldGVkIGFzIF9pZFxuICBpZiAoIHZhbHVlIGluc3RhbmNlb2YgT2JqZWN0SWQgfHwgIV8uaXNPYmplY3QodmFsdWUpICkge1xuICAgIHZhbHVlID0geyBfaWQ6IHZhbHVlIH07XG4gIH1cblxuICByZXR1cm4gbmV3IHRoaXMuX3NjaGVtYS5jYXN0ZXJDb25zdHJ1Y3Rvcih2YWx1ZSwgdGhpcyk7XG59O1xuXG4vKipcbiAqIFNlYXJjaGVzIGFycmF5IGl0ZW1zIGZvciB0aGUgZmlyc3QgZG9jdW1lbnQgd2l0aCBhIG1hdGNoaW5nIF9pZC5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIGVtYmVkZGVkRG9jID0gbS5hcnJheS5pZChzb21lX2lkKTtcbiAqXG4gKiBAcmV0dXJuIHtFbWJlZGRlZERvY3VtZW50fG51bGx9IHRoZSBzdWJkb2N1bWVudCBvciBudWxsIGlmIG5vdCBmb3VuZC5cbiAqIEBwYXJhbSB7T2JqZWN0SWR8U3RyaW5nfE51bWJlcn0gaWRcbiAqIEBUT0RPIGNhc3QgdG8gdGhlIF9pZCBiYXNlZCBvbiBzY2hlbWEgZm9yIHByb3BlciBjb21wYXJpc29uXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TdG9yYWdlRG9jdW1lbnRBcnJheS5wcm90b3R5cGUuaWQgPSBmdW5jdGlvbiAoaWQpIHtcbiAgdmFyIGNhc3RlZFxuICAgICwgc2lkXG4gICAgLCBfaWQ7XG5cbiAgdHJ5IHtcbiAgICB2YXIgY2FzdGVkXyA9IE9iamVjdElkU2NoZW1hLnByb3RvdHlwZS5jYXN0LmNhbGwoe30sIGlkKTtcbiAgICBpZiAoY2FzdGVkXykgY2FzdGVkID0gU3RyaW5nKGNhc3RlZF8pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY2FzdGVkID0gbnVsbDtcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBfaWQgPSB0aGlzW2ldLmdldCgnX2lkJyk7XG5cbiAgICBpZiAoX2lkIGluc3RhbmNlb2YgRG9jdW1lbnQpIHtcbiAgICAgIHNpZCB8fCAoc2lkID0gU3RyaW5nKGlkKSk7XG4gICAgICBpZiAoc2lkID09IF9pZC5faWQpIHJldHVybiB0aGlzW2ldO1xuICAgIH0gZWxzZSBpZiAoIShfaWQgaW5zdGFuY2VvZiBPYmplY3RJZCkpIHtcbiAgICAgIHNpZCB8fCAoc2lkID0gU3RyaW5nKGlkKSk7XG4gICAgICBpZiAoc2lkID09IF9pZCkgcmV0dXJuIHRoaXNbaV07XG4gICAgfSBlbHNlIGlmIChjYXN0ZWQgPT0gX2lkKSB7XG4gICAgICByZXR1cm4gdGhpc1tpXTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIG5hdGl2ZSBqcyBBcnJheSBvZiBwbGFpbiBqcyBvYmplY3RzXG4gKlxuICogIyMjI05PVEU6XG4gKlxuICogX0VhY2ggc3ViLWRvY3VtZW50IGlzIGNvbnZlcnRlZCB0byBhIHBsYWluIG9iamVjdCBieSBjYWxsaW5nIGl0cyBgI3RvT2JqZWN0YCBtZXRob2QuX1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gb3B0aW9uYWwgb3B0aW9ucyB0byBwYXNzIHRvIGVhY2ggZG9jdW1lbnRzIGB0b09iamVjdGAgbWV0aG9kIGNhbGwgZHVyaW5nIGNvbnZlcnNpb25cbiAqIEByZXR1cm4ge0FycmF5fVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5TdG9yYWdlRG9jdW1lbnRBcnJheS5wcm90b3R5cGUudG9PYmplY3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICByZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24gKGRvYykge1xuICAgIHJldHVybiBkb2MgJiYgZG9jLnRvT2JqZWN0KG9wdGlvbnMpIHx8IG51bGw7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgc3ViZG9jdW1lbnQgY2FzdGVkIHRvIHRoaXMgc2NoZW1hLlxuICpcbiAqIFRoaXMgaXMgdGhlIHNhbWUgc3ViZG9jdW1lbnQgY29uc3RydWN0b3IgdXNlZCBmb3IgY2FzdGluZy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIHRoZSB2YWx1ZSB0byBjYXN0IHRvIHRoaXMgYXJyYXlzIFN1YkRvY3VtZW50IHNjaGVtYVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5TdG9yYWdlRG9jdW1lbnRBcnJheS5wcm90b3R5cGUuY3JlYXRlID0gZnVuY3Rpb24gKG9iaikge1xuICByZXR1cm4gbmV3IHRoaXMuX3NjaGVtYS5jYXN0ZXJDb25zdHJ1Y3RvcihvYmopO1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgZm4gdGhhdCBub3RpZmllcyBhbGwgY2hpbGQgZG9jcyBvZiBgZXZlbnRgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuU3RvcmFnZURvY3VtZW50QXJyYXkucHJvdG90eXBlLm5vdGlmeSA9IGZ1bmN0aW9uIG5vdGlmeSAoZXZlbnQpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICByZXR1cm4gZnVuY3Rpb24gbm90aWZ5ICh2YWwpIHtcbiAgICB2YXIgaSA9IHNlbGYubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGlmICghc2VsZltpXSkgY29udGludWU7XG4gICAgICBzZWxmW2ldLnRyaWdnZXIoZXZlbnQsIHZhbCk7XG4gICAgfVxuICB9XG59O1xuXG4vKiFcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gU3RvcmFnZURvY3VtZW50QXJyYXk7XG4iLCIvKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIERvY3VtZW50ID0gcmVxdWlyZSgnLi4vZG9jdW1lbnQnKTtcblxuLyoqXG4gKiBFbWJlZGRlZERvY3VtZW50IGNvbnN0cnVjdG9yLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIGpzIG9iamVjdCByZXR1cm5lZCBmcm9tIHRoZSBkYlxuICogQHBhcmFtIHtNb25nb29zZURvY3VtZW50QXJyYXl9IHBhcmVudEFyciB0aGUgcGFyZW50IGFycmF5IG9mIHRoaXMgZG9jdW1lbnRcbiAqIEBpbmhlcml0cyBEb2N1bWVudFxuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIEVtYmVkZGVkRG9jdW1lbnQgKCBkYXRhLCBwYXJlbnRBcnIgKSB7XG4gIGlmIChwYXJlbnRBcnIpIHtcbiAgICB0aGlzLl9fcGFyZW50QXJyYXkgPSBwYXJlbnRBcnI7XG4gICAgdGhpcy5fX3BhcmVudCA9IHBhcmVudEFyci5fcGFyZW50O1xuICB9IGVsc2Uge1xuICAgIHRoaXMuX19wYXJlbnRBcnJheSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9fcGFyZW50ID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgRG9jdW1lbnQuY2FsbCggdGhpcywgZGF0YSwgdW5kZWZpbmVkICk7XG5cbiAgLy8g0J3Rg9C20L3QviDQtNC70Y8g0L/RgNC+0LHRgNC+0YHQsCDQuNC30LzQtdC90LXQvdC40Y8g0LfQvdCw0YfQtdC90LjRjyDQuNC3INGA0L7QtNC40YLQtdC70YzRgdC60L7Qs9C+INC00L7QutGD0LzQtdC90YLQsCwg0L3QsNC/0YDQuNC80LXRgCDQv9GA0Lgg0YHQvtGF0YDQsNC90LXQvdC40LhcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLm9uKCdpc05ldycsIGZ1bmN0aW9uICh2YWwpIHtcbiAgICBzZWxmLmlzTmV3ID0gdmFsO1xuICB9KTtcbn1cblxuLyohXG4gKiBJbmhlcml0IGZyb20gRG9jdW1lbnRcbiAqL1xuXG5FbWJlZGRlZERvY3VtZW50LnByb3RvdHlwZS5fX3Byb3RvX18gPSBEb2N1bWVudC5wcm90b3R5cGU7XG5cbi8qKlxuICogTWFya3MgdGhlIGVtYmVkZGVkIGRvYyBtb2RpZmllZC5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIGRvYyA9IGJsb2dwb3N0LmNvbW1lbnRzLmlkKGhleHN0cmluZyk7XG4gKiAgICAgZG9jLm1peGVkLnR5cGUgPSAnY2hhbmdlZCc7XG4gKiAgICAgZG9jLm1hcmtNb2RpZmllZCgnbWl4ZWQudHlwZScpO1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIHRoZSBwYXRoIHdoaWNoIGNoYW5nZWRcbiAqIEBhcGkgcHVibGljXG4gKi9cbkVtYmVkZGVkRG9jdW1lbnQucHJvdG90eXBlLm1hcmtNb2RpZmllZCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gIGlmICghdGhpcy5fX3BhcmVudEFycmF5KSByZXR1cm47XG5cbiAgdGhpcy4kX18uYWN0aXZlUGF0aHMubW9kaWZ5KHBhdGgpO1xuXG4gIGlmICh0aGlzLmlzTmV3KSB7XG4gICAgLy8gTWFyayB0aGUgV0hPTEUgcGFyZW50IGFycmF5IGFzIG1vZGlmaWVkXG4gICAgLy8gaWYgdGhpcyBpcyBhIG5ldyBkb2N1bWVudCAoaS5lLiwgd2UgYXJlIGluaXRpYWxpemluZ1xuICAgIC8vIGEgZG9jdW1lbnQpLFxuICAgIHRoaXMuX19wYXJlbnRBcnJheS5fbWFya01vZGlmaWVkKCk7XG4gIH0gZWxzZVxuICAgIHRoaXMuX19wYXJlbnRBcnJheS5fbWFya01vZGlmaWVkKHRoaXMsIHBhdGgpO1xufTtcblxuLyoqXG4gKiBVc2VkIGFzIGEgc3R1YiBmb3IgW2hvb2tzLmpzXShodHRwczovL2dpdGh1Yi5jb20vYm5vZ3VjaGkvaG9va3MtanMvdHJlZS8zMWVjNTcxY2VmMDMzMmUyMTEyMWVlNzE1N2UwY2Y5NzI4NTcyY2MzKVxuICpcbiAqICMjIyNOT1RFOlxuICpcbiAqIF9UaGlzIGlzIGEgbm8tb3AuIERvZXMgbm90IGFjdHVhbGx5IHNhdmUgdGhlIGRvYyB0byB0aGUgZGIuX1xuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtmbl1cbiAqIEByZXR1cm4ge1Byb21pc2V9IHJlc29sdmVkIFByb21pc2VcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbkVtYmVkZGVkRG9jdW1lbnQucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiAoZm4pIHtcbiAgdmFyIHByb21pc2UgPSAkLkRlZmVycmVkKCkuZG9uZShmbik7XG4gIHByb21pc2UucmVzb2x2ZSgpO1xuICByZXR1cm4gcHJvbWlzZTtcbn1cblxuLyoqXG4gKiBSZW1vdmVzIHRoZSBzdWJkb2N1bWVudCBmcm9tIGl0cyBwYXJlbnQgYXJyYXkuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2ZuXVxuICogQGFwaSBwdWJsaWNcbiAqL1xuRW1iZWRkZWREb2N1bWVudC5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gKGZuKSB7XG4gIGlmICghdGhpcy5fX3BhcmVudEFycmF5KSByZXR1cm4gdGhpcztcblxuICB2YXIgX2lkO1xuICBpZiAoIXRoaXMud2lsbFJlbW92ZSkge1xuICAgIF9pZCA9IHRoaXMuX2RvYy5faWQ7XG4gICAgaWYgKCFfaWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRm9yIHlvdXIgb3duIGdvb2QsIE1vbmdvb3NlIGRvZXMgbm90IGtub3cgJyArXG4gICAgICAgICAgICAgICAgICAgICAgJ2hvdyB0byByZW1vdmUgYW4gRW1iZWRkZWREb2N1bWVudCB0aGF0IGhhcyBubyBfaWQnKTtcbiAgICB9XG4gICAgdGhpcy5fX3BhcmVudEFycmF5LnB1bGwoeyBfaWQ6IF9pZCB9KTtcbiAgICB0aGlzLndpbGxSZW1vdmUgPSB0cnVlO1xuICB9XG5cbiAgaWYgKGZuKVxuICAgIGZuKG51bGwpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBPdmVycmlkZSAjdXBkYXRlIG1ldGhvZCBvZiBwYXJlbnQgZG9jdW1lbnRzLlxuICogQGFwaSBwcml2YXRlXG4gKi9cbkVtYmVkZGVkRG9jdW1lbnQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdUaGUgI3VwZGF0ZSBtZXRob2QgaXMgbm90IGF2YWlsYWJsZSBvbiBFbWJlZGRlZERvY3VtZW50cycpO1xufTtcblxuLyoqXG4gKiBNYXJrcyBhIHBhdGggYXMgaW52YWxpZCwgY2F1c2luZyB2YWxpZGF0aW9uIHRvIGZhaWwuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggdGhlIGZpZWxkIHRvIGludmFsaWRhdGVcbiAqIEBwYXJhbSB7U3RyaW5nfEVycm9yfSBlcnIgZXJyb3Igd2hpY2ggc3RhdGVzIHRoZSByZWFzb24gYHBhdGhgIHdhcyBpbnZhbGlkXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuRW1iZWRkZWREb2N1bWVudC5wcm90b3R5cGUuaW52YWxpZGF0ZSA9IGZ1bmN0aW9uIChwYXRoLCBlcnIsIHZhbCwgZmlyc3QpIHtcbiAgaWYgKCF0aGlzLl9fcGFyZW50KSB7XG4gICAgdmFyIG1zZyA9ICdVbmFibGUgdG8gaW52YWxpZGF0ZSBhIHN1YmRvY3VtZW50IHRoYXQgaGFzIG5vdCBiZWVuIGFkZGVkIHRvIGFuIGFycmF5LidcbiAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgfVxuXG4gIHZhciBpbmRleCA9IHRoaXMuX19wYXJlbnRBcnJheS5pbmRleE9mKHRoaXMpO1xuICB2YXIgcGFyZW50UGF0aCA9IHRoaXMuX19wYXJlbnRBcnJheS5fcGF0aDtcbiAgdmFyIGZ1bGxQYXRoID0gW3BhcmVudFBhdGgsIGluZGV4LCBwYXRoXS5qb2luKCcuJyk7XG5cbiAgLy8gc25pZmZpbmcgYXJndW1lbnRzOlxuICAvLyBuZWVkIHRvIGNoZWNrIGlmIHVzZXIgcGFzc2VkIGEgdmFsdWUgdG8ga2VlcFxuICAvLyBvdXIgZXJyb3IgbWVzc2FnZSBjbGVhbi5cbiAgaWYgKDIgPCBhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgdGhpcy5fX3BhcmVudC5pbnZhbGlkYXRlKGZ1bGxQYXRoLCBlcnIsIHZhbCk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5fX3BhcmVudC5pbnZhbGlkYXRlKGZ1bGxQYXRoLCBlcnIpO1xuICB9XG5cbiAgaWYgKGZpcnN0KVxuICAgIHRoaXMuJF9fLnZhbGlkYXRpb25FcnJvciA9IHRoaXMub3duZXJEb2N1bWVudCgpLiRfXy52YWxpZGF0aW9uRXJyb3I7XG4gIHJldHVybiB0cnVlO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSB0b3AgbGV2ZWwgZG9jdW1lbnQgb2YgdGhpcyBzdWItZG9jdW1lbnQuXG4gKlxuICogQHJldHVybiB7RG9jdW1lbnR9XG4gKi9cbkVtYmVkZGVkRG9jdW1lbnQucHJvdG90eXBlLm93bmVyRG9jdW1lbnQgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLiRfXy5vd25lckRvY3VtZW50KSB7XG4gICAgcmV0dXJuIHRoaXMuJF9fLm93bmVyRG9jdW1lbnQ7XG4gIH1cblxuICB2YXIgcGFyZW50ID0gdGhpcy5fX3BhcmVudDtcbiAgaWYgKCFwYXJlbnQpIHJldHVybiB0aGlzO1xuXG4gIHdoaWxlIChwYXJlbnQuX19wYXJlbnQpIHtcbiAgICBwYXJlbnQgPSBwYXJlbnQuX19wYXJlbnQ7XG4gIH1cblxuICByZXR1cm4gdGhpcy4kX18ub3duZXJEb2N1bWVudCA9IHBhcmVudDtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgZnVsbCBwYXRoIHRvIHRoaXMgZG9jdW1lbnQuIElmIG9wdGlvbmFsIGBwYXRoYCBpcyBwYXNzZWQsIGl0IGlzIGFwcGVuZGVkIHRvIHRoZSBmdWxsIHBhdGguXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IFtwYXRoXVxuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKiBAbWV0aG9kICRfX2Z1bGxQYXRoXG4gKiBAbWVtYmVyT2YgRW1iZWRkZWREb2N1bWVudFxuICovXG5FbWJlZGRlZERvY3VtZW50LnByb3RvdHlwZS4kX19mdWxsUGF0aCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gIGlmICghdGhpcy4kX18uZnVsbFBhdGgpIHtcbiAgICB2YXIgcGFyZW50ID0gdGhpcztcbiAgICBpZiAoIXBhcmVudC5fX3BhcmVudCkgcmV0dXJuIHBhdGg7XG5cbiAgICB2YXIgcGF0aHMgPSBbXTtcbiAgICB3aGlsZSAocGFyZW50Ll9fcGFyZW50KSB7XG4gICAgICBwYXRocy51bnNoaWZ0KHBhcmVudC5fX3BhcmVudEFycmF5Ll9wYXRoKTtcbiAgICAgIHBhcmVudCA9IHBhcmVudC5fX3BhcmVudDtcbiAgICB9XG5cbiAgICB0aGlzLiRfXy5mdWxsUGF0aCA9IHBhdGhzLmpvaW4oJy4nKTtcblxuICAgIGlmICghdGhpcy4kX18ub3duZXJEb2N1bWVudCkge1xuICAgICAgLy8gb3B0aW1pemF0aW9uXG4gICAgICB0aGlzLiRfXy5vd25lckRvY3VtZW50ID0gcGFyZW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXRoXG4gICAgPyB0aGlzLiRfXy5mdWxsUGF0aCArICcuJyArIHBhdGhcbiAgICA6IHRoaXMuJF9fLmZ1bGxQYXRoO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoaXMgc3ViLWRvY3VtZW50cyBwYXJlbnQgZG9jdW1lbnQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuRW1iZWRkZWREb2N1bWVudC5wcm90b3R5cGUucGFyZW50ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5fX3BhcmVudDtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGlzIHN1Yi1kb2N1bWVudHMgcGFyZW50IGFycmF5LlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cbkVtYmVkZGVkRG9jdW1lbnQucHJvdG90eXBlLnBhcmVudEFycmF5ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5fX3BhcmVudEFycmF5O1xufTtcblxuLyohXG4gKiBNb2R1bGUgZXhwb3J0cy5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVtYmVkZGVkRG9jdW1lbnQ7XG4iLCJcbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxuZXhwb3J0cy5BcnJheSA9IHJlcXVpcmUoJy4vYXJyYXknKTtcblxuZXhwb3J0cy5FbWJlZGRlZCA9IHJlcXVpcmUoJy4vZW1iZWRkZWQnKTtcblxuZXhwb3J0cy5Eb2N1bWVudEFycmF5ID0gcmVxdWlyZSgnLi9kb2N1bWVudGFycmF5Jyk7XG5leHBvcnRzLk9iamVjdElkID0gcmVxdWlyZSgnLi9vYmplY3RpZCcpO1xuIiwiLy8gUmVndWxhciBleHByZXNzaW9uIHRoYXQgY2hlY2tzIGZvciBoZXggdmFsdWVcbnZhciByY2hlY2tGb3JIZXggPSBuZXcgUmVnRXhwKFwiXlswLTlhLWZBLUZdezI0fSRcIik7XG5cbi8qKlxuKiBDcmVhdGUgYSBuZXcgT2JqZWN0SWQgaW5zdGFuY2VcbipcbiogQHBhcmFtIHtTdHJpbmd9IFtpZF0gQ2FuIGJlIGEgMjQgYnl0ZSBoZXggc3RyaW5nLlxuKiBAcmV0dXJuIHtPYmplY3R9IGluc3RhbmNlIG9mIE9iamVjdElkLlxuKi9cbmZ1bmN0aW9uIE9iamVjdElkKCBpZCApIHtcbiAgLy8g0JrQvtC90YHRgtGA0YPQutGC0L7RgCDQvNC+0LbQvdC+INC40YHQv9C+0LvRjNC30L7QstCw0YLRjCDQsdC10LcgbmV3XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBPYmplY3RJZCkpIHJldHVybiBuZXcgT2JqZWN0SWQoIGlkICk7XG4gIC8vaWYgKCBpZCBpbnN0YW5jZW9mIE9iamVjdElkICkgcmV0dXJuIGlkO1xuXG4gIC8vIFRocm93IGFuIGVycm9yIGlmIGl0J3Mgbm90IGEgdmFsaWQgc2V0dXBcbiAgaWYgKCBpZCAhPSBudWxsICYmIHR5cGVvZiBpZCAhPSAnc3RyaW5nJyAmJiBpZC5sZW5ndGggIT0gMjQgKVxuICAgIHRocm93IG5ldyBFcnJvcignQXJndW1lbnQgcGFzc2VkIGluIG11c3QgYmUgYSBzdHJpbmcgb2YgMjQgaGV4IGNoYXJhY3RlcnMnKTtcblxuICAvLyBHZW5lcmF0ZSBpZFxuICBpZiAoIGlkID09IG51bGwgKSB7XG4gICAgdGhpcy5pZCA9IHRoaXMuZ2VuZXJhdGUoKTtcblxuICB9IGVsc2UgaWYoIHJjaGVja0ZvckhleC50ZXN0KCBpZCApICkge1xuICAgIHRoaXMuaWQgPSBpZDtcblxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcignVmFsdWUgcGFzc2VkIGluIGlzIG5vdCBhIHZhbGlkIDI0IGNoYXJhY3RlciBoZXggc3RyaW5nJyk7XG4gIH1cbn1cblxuLy8gUHJpdmF0ZSBhcnJheSBvZiBjaGFycyB0byB1c2Vcbk9iamVjdElkLnByb3RvdHlwZS5DSEFSUyA9ICcwMTIzNDU2Nzg5QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5eicuc3BsaXQoJycpO1xuXG4vL1RPRE86INC80L7QttC90L4g0LvQuCDQuNGB0L/QvtC70YzQt9C+0LLQsNGC0Ywg0LHQvtC70YzRiNC40LUg0YHQuNC80LLQvtC70YsgQS1aP1xuLy8gR2VuZXJhdGUgYSByYW5kb20gT2JqZWN0SWQuXG5PYmplY3RJZC5wcm90b3R5cGUuZ2VuZXJhdGUgPSBmdW5jdGlvbigpe1xuICB2YXIgY2hhcnMgPSB0aGlzLkNIQVJTLCBfaWQgPSBuZXcgQXJyYXkoIDM2ICksIHJuZCA9IDAsIHI7XG4gIGZvciAoIHZhciBpID0gMDsgaSA8IDI0OyBpKysgKSB7XG4gICAgaWYgKCBybmQgPD0gMHgwMiApXG4gICAgICBybmQgPSAweDIwMDAwMDAgKyAoTWF0aC5yYW5kb20oKSAqIDB4MTAwMDAwMCkgfCAwO1xuXG4gICAgciA9IHJuZCAmIDB4ZjtcbiAgICBybmQgPSBybmQgPj4gNDtcbiAgICBfaWRbIGkgXSA9IGNoYXJzWyhpID09IDE5KSA/IChyICYgMHgzKSB8IDB4OCA6IHJdO1xuICB9XG5cbiAgcmV0dXJuIF9pZC5qb2luKCcnKS50b0xvd2VyQ2FzZSgpO1xufTtcblxuLyoqXG4qIFJldHVybiB0aGUgT2JqZWN0SWQgaWQgYXMgYSAyNCBieXRlIGhleCBzdHJpbmcgcmVwcmVzZW50YXRpb25cbipcbiogQHJldHVybiB7U3RyaW5nfSByZXR1cm4gdGhlIDI0IGJ5dGUgaGV4IHN0cmluZyByZXByZXNlbnRhdGlvbi5cbiogQGFwaSBwdWJsaWNcbiovXG5PYmplY3RJZC5wcm90b3R5cGUudG9IZXhTdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuaWQ7XG59O1xuXG4vKipcbiogQ29udmVydHMgdGhlIGlkIGludG8gYSAyNCBieXRlIGhleCBzdHJpbmcgZm9yIHByaW50aW5nXG4qXG4qIEByZXR1cm4ge1N0cmluZ30gcmV0dXJuIHRoZSAyNCBieXRlIGhleCBzdHJpbmcgcmVwcmVzZW50YXRpb24uXG4qIEBhcGkgcHJpdmF0ZVxuKi9cbk9iamVjdElkLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy50b0hleFN0cmluZygpO1xufTtcblxuLyoqXG4qIENvbnZlcnRzIHRvIGl0cyBKU09OIHJlcHJlc2VudGF0aW9uLlxuKlxuKiBAcmV0dXJuIHtTdHJpbmd9IHJldHVybiB0aGUgMjQgYnl0ZSBoZXggc3RyaW5nIHJlcHJlc2VudGF0aW9uLlxuKiBAYXBpIHByaXZhdGVcbiovXG5PYmplY3RJZC5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLnRvSGV4U3RyaW5nKCk7XG59O1xuXG4vKipcbiogQ29tcGFyZXMgdGhlIGVxdWFsaXR5IG9mIHRoaXMgT2JqZWN0SWQgd2l0aCBgb3RoZXJJRGAuXG4qXG4qIEBwYXJhbSB7T2JqZWN0fSBvdGhlcklEIE9iamVjdElkIGluc3RhbmNlIHRvIGNvbXBhcmUgYWdhaW5zdC5cbiogQHJldHVybiB7Qm9vbH0gdGhlIHJlc3VsdCBvZiBjb21wYXJpbmcgdHdvIE9iamVjdElkJ3NcbiogQGFwaSBwdWJsaWNcbiovXG5PYmplY3RJZC5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gZXF1YWxzKCBvdGhlcklEICl7XG4gIHZhciBpZCA9ICggb3RoZXJJRCBpbnN0YW5jZW9mIE9iamVjdElkIHx8IG90aGVySUQudG9IZXhTdHJpbmcgKVxuICAgID8gb3RoZXJJRC5pZFxuICAgIDogbmV3IE9iamVjdElkKCBvdGhlcklEICkuaWQ7XG5cbiAgcmV0dXJuIHRoaXMuaWQgPT09IGlkO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBPYmplY3RJZDtcbiIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwpe1xuLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBPYmplY3RJZCA9IHJlcXVpcmUoJy4vdHlwZXMvb2JqZWN0aWQnKVxuICAsIG1wYXRoID0gcmVxdWlyZSgnLi9tcGF0aCcpXG4gICwgU3RvcmFnZUFycmF5XG4gICwgRG9jdW1lbnQ7XG5cbi8qKlxuICogUGx1cmFsaXphdGlvbiBydWxlcy5cbiAqXG4gKiBUaGVzZSBydWxlcyBhcmUgYXBwbGllZCB3aGlsZSBwcm9jZXNzaW5nIHRoZSBhcmd1bWVudCB0byBgcGx1cmFsaXplYC5cbiAqXG4gKi9cbmV4cG9ydHMucGx1cmFsaXphdGlvbiA9IFtcbiAgWy8obSlhbiQvZ2ksICckMWVuJ10sXG4gIFsvKHBlKXJzb24kL2dpLCAnJDFvcGxlJ10sXG4gIFsvKGNoaWxkKSQvZ2ksICckMXJlbiddLFxuICBbL14ob3gpJC9naSwgJyQxZW4nXSxcbiAgWy8oYXh8dGVzdClpcyQvZ2ksICckMWVzJ10sXG4gIFsvKG9jdG9wfHZpcil1cyQvZ2ksICckMWknXSxcbiAgWy8oYWxpYXN8c3RhdHVzKSQvZ2ksICckMWVzJ10sXG4gIFsvKGJ1KXMkL2dpLCAnJDFzZXMnXSxcbiAgWy8oYnVmZmFsfHRvbWF0fHBvdGF0KW8kL2dpLCAnJDFvZXMnXSxcbiAgWy8oW3RpXSl1bSQvZ2ksICckMWEnXSxcbiAgWy9zaXMkL2dpLCAnc2VzJ10sXG4gIFsvKD86KFteZl0pZmV8KFtscl0pZikkL2dpLCAnJDEkMnZlcyddLFxuICBbLyhoaXZlKSQvZ2ksICckMXMnXSxcbiAgWy8oW15hZWlvdXldfHF1KXkkL2dpLCAnJDFpZXMnXSxcbiAgWy8oeHxjaHxzc3xzaCkkL2dpLCAnJDFlcyddLFxuICBbLyhtYXRyfHZlcnR8aW5kKWl4fGV4JC9naSwgJyQxaWNlcyddLFxuICBbLyhbbXxsXSlvdXNlJC9naSwgJyQxaWNlJ10sXG4gIFsvKGtufHd8bClpZmUkL2dpLCAnJDFpdmVzJ10sXG4gIFsvKHF1aXopJC9naSwgJyQxemVzJ10sXG4gIFsvcyQvZ2ksICdzJ10sXG4gIFsvKFteYS16XSkkLywgJyQxJ10sXG4gIFsvJC9naSwgJ3MnXVxuXTtcbnZhciBydWxlcyA9IGV4cG9ydHMucGx1cmFsaXphdGlvbjtcblxuLyoqXG4gKiBVbmNvdW50YWJsZSB3b3Jkcy5cbiAqXG4gKiBUaGVzZSB3b3JkcyBhcmUgYXBwbGllZCB3aGlsZSBwcm9jZXNzaW5nIHRoZSBhcmd1bWVudCB0byBgcGx1cmFsaXplYC5cbiAqIEBhcGkgcHVibGljXG4gKi9cbmV4cG9ydHMudW5jb3VudGFibGVzID0gW1xuICAnYWR2aWNlJyxcbiAgJ2VuZXJneScsXG4gICdleGNyZXRpb24nLFxuICAnZGlnZXN0aW9uJyxcbiAgJ2Nvb3BlcmF0aW9uJyxcbiAgJ2hlYWx0aCcsXG4gICdqdXN0aWNlJyxcbiAgJ2xhYm91cicsXG4gICdtYWNoaW5lcnknLFxuICAnZXF1aXBtZW50JyxcbiAgJ2luZm9ybWF0aW9uJyxcbiAgJ3BvbGx1dGlvbicsXG4gICdzZXdhZ2UnLFxuICAncGFwZXInLFxuICAnbW9uZXknLFxuICAnc3BlY2llcycsXG4gICdzZXJpZXMnLFxuICAncmFpbicsXG4gICdyaWNlJyxcbiAgJ2Zpc2gnLFxuICAnc2hlZXAnLFxuICAnbW9vc2UnLFxuICAnZGVlcicsXG4gICduZXdzJyxcbiAgJ2V4cGVydGlzZScsXG4gICdzdGF0dXMnLFxuICAnbWVkaWEnXG5dO1xudmFyIHVuY291bnRhYmxlcyA9IGV4cG9ydHMudW5jb3VudGFibGVzO1xuXG4vKiFcbiAqIFBsdXJhbGl6ZSBmdW5jdGlvbi5cbiAqXG4gKiBAYXV0aG9yIFRKIEhvbG93YXljaHVrIChleHRyYWN0ZWQgZnJvbSBfZXh0LmpzXylcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmcgdG8gcGx1cmFsaXplXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5leHBvcnRzLnBsdXJhbGl6ZSA9IGZ1bmN0aW9uIChzdHIpIHtcbiAgdmFyIGZvdW5kO1xuICBpZiAoIX51bmNvdW50YWJsZXMuaW5kZXhPZihzdHIudG9Mb3dlckNhc2UoKSkpe1xuICAgIGZvdW5kID0gcnVsZXMuZmlsdGVyKGZ1bmN0aW9uKHJ1bGUpe1xuICAgICAgcmV0dXJuIHN0ci5tYXRjaChydWxlWzBdKTtcbiAgICB9KTtcbiAgICBpZiAoZm91bmRbMF0pIHJldHVybiBzdHIucmVwbGFjZShmb3VuZFswXVswXSwgZm91bmRbMF1bMV0pO1xuICB9XG4gIHJldHVybiBzdHI7XG59XG5cbi8qIVxuICogRGV0ZXJtaW5lcyBpZiBgYWAgYW5kIGBiYCBhcmUgZGVlcCBlcXVhbC5cbiAqXG4gKiBNb2RpZmllZCBmcm9tIG5vZGUvbGliL2Fzc2VydC5qc1xuICogTW9kaWZpZWQgZnJvbSBtb25nb29zZS91dGlscy5qc1xuICpcbiAqIEBwYXJhbSB7YW55fSBhIGEgdmFsdWUgdG8gY29tcGFyZSB0byBgYmBcbiAqIEBwYXJhbSB7YW55fSBiIGEgdmFsdWUgdG8gY29tcGFyZSB0byBgYWBcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZXhwb3J0cy5kZWVwRXF1YWwgPSBmdW5jdGlvbiBkZWVwRXF1YWwgKGEsIGIpIHtcbiAgaWYgKGlzU3RvcmFnZU9iamVjdChhKSkgYSA9IGEudG9PYmplY3QoKTtcbiAgaWYgKGlzU3RvcmFnZU9iamVjdChiKSkgYiA9IGIudG9PYmplY3QoKTtcblxuICByZXR1cm4gXy5pc0VxdWFsKGEsIGIpO1xufTtcblxuXG5cbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbmZ1bmN0aW9uIGlzUmVnRXhwIChvKSB7XG4gIHJldHVybiAnb2JqZWN0JyA9PSB0eXBlb2Ygb1xuICAgICAgJiYgJ1tvYmplY3QgUmVnRXhwXScgPT0gdG9TdHJpbmcuY2FsbChvKTtcbn1cblxuZnVuY3Rpb24gY2xvbmVSZWdFeHAgKHJlZ2V4cCkge1xuICBpZiAoIWlzUmVnRXhwKHJlZ2V4cCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdOb3QgYSBSZWdFeHAnKTtcbiAgfVxuXG4gIHZhciBmbGFncyA9IFtdO1xuICBpZiAocmVnZXhwLmdsb2JhbCkgZmxhZ3MucHVzaCgnZycpO1xuICBpZiAocmVnZXhwLm11bHRpbGluZSkgZmxhZ3MucHVzaCgnbScpO1xuICBpZiAocmVnZXhwLmlnbm9yZUNhc2UpIGZsYWdzLnB1c2goJ2knKTtcbiAgcmV0dXJuIG5ldyBSZWdFeHAocmVnZXhwLnNvdXJjZSwgZmxhZ3Muam9pbignJykpO1xufVxuXG4vKiFcbiAqIE9iamVjdCBjbG9uZSB3aXRoIFN0b3JhZ2UgbmF0aXZlcyBzdXBwb3J0LlxuICpcbiAqIElmIG9wdGlvbnMubWluaW1pemUgaXMgdHJ1ZSwgY3JlYXRlcyBhIG1pbmltYWwgZGF0YSBvYmplY3QuIEVtcHR5IG9iamVjdHMgYW5kIHVuZGVmaW5lZCB2YWx1ZXMgd2lsbCBub3QgYmUgY2xvbmVkLiBUaGlzIG1ha2VzIHRoZSBkYXRhIHBheWxvYWQgc2VudCB0byBNb25nb0RCIGFzIHNtYWxsIGFzIHBvc3NpYmxlLlxuICpcbiAqIEZ1bmN0aW9ucyBhcmUgbmV2ZXIgY2xvbmVkLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogdGhlIG9iamVjdCB0byBjbG9uZVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge09iamVjdH0gdGhlIGNsb25lZCBvYmplY3RcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5leHBvcnRzLmNsb25lID0gZnVuY3Rpb24gY2xvbmUgKG9iaiwgb3B0aW9ucykge1xuICBpZiAob2JqID09PSB1bmRlZmluZWQgfHwgb2JqID09PSBudWxsKVxuICAgIHJldHVybiBvYmo7XG5cbiAgaWYgKCBfLmlzQXJyYXkoIG9iaiApICkge1xuICAgIHJldHVybiBjbG9uZUFycmF5KCBvYmosIG9wdGlvbnMgKTtcbiAgfVxuXG4gIGlmICggaXNTdG9yYWdlT2JqZWN0KCBvYmogKSApIHtcbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmpzb24gJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG9iai50b0pTT04pIHtcbiAgICAgIHJldHVybiBvYmoudG9KU09OKCBvcHRpb25zICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBvYmoudG9PYmplY3QoIG9wdGlvbnMgKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIG9iai5jb25zdHJ1Y3RvciApIHtcbiAgICBzd2l0Y2ggKG9iai5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgICBjYXNlICdPYmplY3QnOlxuICAgICAgICByZXR1cm4gY2xvbmVPYmplY3Qob2JqLCBvcHRpb25zKTtcbiAgICAgIGNhc2UgJ0RhdGUnOlxuICAgICAgICByZXR1cm4gbmV3IG9iai5jb25zdHJ1Y3RvciggK29iaiApO1xuICAgICAgY2FzZSAnUmVnRXhwJzpcbiAgICAgICAgcmV0dXJuIGNsb25lUmVnRXhwKCBvYmogKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIC8vIGlnbm9yZVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBpZiAoIG9iaiBpbnN0YW5jZW9mIE9iamVjdElkICkge1xuICAgIHJldHVybiBuZXcgT2JqZWN0SWQoIG9iai5pZCApO1xuICB9XG5cbiAgaWYgKCAhb2JqLmNvbnN0cnVjdG9yICYmIF8uaXNPYmplY3QoIG9iaiApICkge1xuICAgIC8vIG9iamVjdCBjcmVhdGVkIHdpdGggT2JqZWN0LmNyZWF0ZShudWxsKVxuICAgIHJldHVybiBjbG9uZU9iamVjdCggb2JqLCBvcHRpb25zICk7XG4gIH1cblxuICBpZiAoIG9iai52YWx1ZU9mICl7XG4gICAgcmV0dXJuIG9iai52YWx1ZU9mKCk7XG4gIH1cbn07XG52YXIgY2xvbmUgPSBleHBvcnRzLmNsb25lO1xuXG4vKiFcbiAqIGlnbm9yZVxuICovXG5mdW5jdGlvbiBjbG9uZU9iamVjdCAob2JqLCBvcHRpb25zKSB7XG4gIHZhciByZXRhaW5LZXlPcmRlciA9IG9wdGlvbnMgJiYgb3B0aW9ucy5yZXRhaW5LZXlPcmRlclxuICAgICwgbWluaW1pemUgPSBvcHRpb25zICYmIG9wdGlvbnMubWluaW1pemVcbiAgICAsIHJldCA9IHt9XG4gICAgLCBoYXNLZXlzXG4gICAgLCBrZXlzXG4gICAgLCB2YWxcbiAgICAsIGtcbiAgICAsIGk7XG5cbiAgaWYgKCByZXRhaW5LZXlPcmRlciApIHtcbiAgICBmb3IgKGsgaW4gb2JqKSB7XG4gICAgICB2YWwgPSBjbG9uZSggb2JqW2tdLCBvcHRpb25zICk7XG5cbiAgICAgIGlmICggIW1pbmltaXplIHx8ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHZhbCkgKSB7XG4gICAgICAgIGhhc0tleXMgfHwgKGhhc0tleXMgPSB0cnVlKTtcbiAgICAgICAgcmV0W2tdID0gdmFsO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBmYXN0ZXJcblxuICAgIGtleXMgPSBPYmplY3Qua2V5cyggb2JqICk7XG4gICAgaSA9IGtleXMubGVuZ3RoO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgayA9IGtleXNbaV07XG4gICAgICB2YWwgPSBjbG9uZShvYmpba10sIG9wdGlvbnMpO1xuXG4gICAgICBpZiAoIW1pbmltaXplIHx8ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHZhbCkpIHtcbiAgICAgICAgaWYgKCFoYXNLZXlzKSBoYXNLZXlzID0gdHJ1ZTtcbiAgICAgICAgcmV0W2tdID0gdmFsO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtaW5pbWl6ZVxuICAgID8gaGFzS2V5cyAmJiByZXRcbiAgICA6IHJldDtcbn1cblxuZnVuY3Rpb24gY2xvbmVBcnJheSAoYXJyLCBvcHRpb25zKSB7XG4gIHZhciByZXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcnIubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgcmV0LnB1c2goIGNsb25lKCBhcnJbaV0sIG9wdGlvbnMgKSApO1xuICB9XG4gIHJldHVybiByZXQ7XG59XG5cbi8qIVxuICogTWVyZ2VzIGBmcm9tYCBpbnRvIGB0b2Agd2l0aG91dCBvdmVyd3JpdGluZyBleGlzdGluZyBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB0b1xuICogQHBhcmFtIHtPYmplY3R9IGZyb21cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5leHBvcnRzLm1lcmdlID0gZnVuY3Rpb24gbWVyZ2UgKHRvLCBmcm9tKSB7XG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZnJvbSlcbiAgICAsIGkgPSBrZXlzLmxlbmd0aFxuICAgICwga2V5O1xuXG4gIHdoaWxlIChpLS0pIHtcbiAgICBrZXkgPSBrZXlzW2ldO1xuICAgIGlmICgndW5kZWZpbmVkJyA9PT0gdHlwZW9mIHRvW2tleV0pIHtcbiAgICAgIHRvW2tleV0gPSBmcm9tW2tleV07XG4gICAgfSBlbHNlIGlmICggXy5pc09iamVjdChmcm9tW2tleV0pICkge1xuICAgICAgbWVyZ2UodG9ba2V5XSwgZnJvbVtrZXldKTtcbiAgICB9XG4gIH1cbn07XG5cbi8qIVxuICogR2VuZXJhdGVzIGEgcmFuZG9tIHN0cmluZ1xuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmV4cG9ydHMucmFuZG9tID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gTWF0aC5yYW5kb20oKS50b1N0cmluZygpLnN1YnN0cigzKTtcbn07XG5cblxuLyohXG4gKiBSZXR1cm5zIGlmIGB2YCBpcyBhIHN0b3JhZ2Ugb2JqZWN0IHRoYXQgaGFzIGEgYHRvT2JqZWN0KClgIG1ldGhvZCB3ZSBjYW4gdXNlLlxuICpcbiAqIFRoaXMgaXMgZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBsaWJzIGxpa2UgRGF0ZS5qcyB3aGljaCBkbyBmb29saXNoIHRoaW5ncyB0byBOYXRpdmVzLlxuICpcbiAqIEBwYXJhbSB7YW55fSB2XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZXhwb3J0cy5pc1N0b3JhZ2VPYmplY3QgPSBmdW5jdGlvbiAoIHYgKSB7XG4gIERvY3VtZW50IHx8IChEb2N1bWVudCA9IHJlcXVpcmUoJy4vZG9jdW1lbnQnKSk7XG4gIFN0b3JhZ2VBcnJheSB8fCAoU3RvcmFnZUFycmF5ID0gcmVxdWlyZSgnLi90eXBlcy9hcnJheScpKTtcblxuICByZXR1cm4gdiBpbnN0YW5jZW9mIERvY3VtZW50IHx8XG4gICAgICAgICB2IGluc3RhbmNlb2YgU3RvcmFnZUFycmF5O1xufTtcbnZhciBpc1N0b3JhZ2VPYmplY3QgPSBleHBvcnRzLmlzU3RvcmFnZU9iamVjdDtcblxuLyohXG4gKiBSZXR1cm4gdGhlIHZhbHVlIG9mIGBvYmpgIGF0IHRoZSBnaXZlbiBgcGF0aGAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqL1xuXG5leHBvcnRzLmdldFZhbHVlID0gZnVuY3Rpb24gKHBhdGgsIG9iaiwgbWFwKSB7XG4gIHJldHVybiBtcGF0aC5nZXQocGF0aCwgb2JqLCAnX2RvYycsIG1hcCk7XG59O1xuXG4vKiFcbiAqIFNldHMgdGhlIHZhbHVlIG9mIGBvYmpgIGF0IHRoZSBnaXZlbiBgcGF0aGAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEBwYXJhbSB7QW55dGhpbmd9IHZhbFxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICovXG5cbmV4cG9ydHMuc2V0VmFsdWUgPSBmdW5jdGlvbiAocGF0aCwgdmFsLCBvYmosIG1hcCkge1xuICBtcGF0aC5zZXQocGF0aCwgdmFsLCBvYmosICdfZG9jJywgbWFwKTtcbn07XG5cbmV4cG9ydHMuc2V0SW1tZWRpYXRlID0gKGZ1bmN0aW9uKCkge1xuICAvLyDQlNC70Y8g0L/QvtC00LTQtdGA0LbQutC4INGC0LXRgdGC0L7QsiAo0L7QutGA0YPQttC10L3QuNC1IG5vZGUuanMpXG4gIGlmICggdHlwZW9mIGdsb2JhbCA9PT0gJ29iamVjdCcgJiYgcHJvY2Vzcy5uZXh0VGljayApIHJldHVybiBwcm9jZXNzLm5leHRUaWNrO1xuICAvLyDQldGB0LvQuCDQsiDQsdGA0LDRg9C30LXRgNC1INGD0LbQtSDRgNC10LDQu9C40LfQvtCy0LDQvSDRjdGC0L7RgiDQvNC10YLQvtC0XG4gIGlmICggd2luZG93LnNldEltbWVkaWF0ZSApIHJldHVybiB3aW5kb3cuc2V0SW1tZWRpYXRlO1xuXG4gIHZhciBoZWFkID0geyB9LCB0YWlsID0gaGVhZDsgLy8g0L7Rh9C10YDQtdC00Ywg0LLRi9C30L7QstC+0LIsIDEt0YHQstGP0LfQvdGL0Lkg0YHQv9C40YHQvtC6XG5cbiAgdmFyIElEID0gTWF0aC5yYW5kb20oKTsgLy8g0YPQvdC40LrQsNC70YzQvdGL0Lkg0LjQtNC10L3RgtC40YTQuNC60LDRgtC+0YBcblxuICBmdW5jdGlvbiBvbm1lc3NhZ2UoZSkge1xuICAgIGlmKGUuZGF0YSAhPSBJRCkgcmV0dXJuOyAvLyDQvdC1INC90LDRiNC1INGB0L7QvtCx0YnQtdC90LjQtVxuICAgIGhlYWQgPSBoZWFkLm5leHQ7XG4gICAgdmFyIGZ1bmMgPSBoZWFkLmZ1bmM7XG4gICAgZGVsZXRlIGhlYWQuZnVuYztcbiAgICBmdW5jKCk7XG4gIH1cblxuICBpZih3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcikgeyAvLyBJRTkrLCDQtNGA0YPQs9C40LUg0LHRgNCw0YPQt9C10YDRi1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgb25tZXNzYWdlLCBmYWxzZSk7XG4gIH0gZWxzZSB7IC8vIElFOFxuICAgIHdpbmRvdy5hdHRhY2hFdmVudCggJ29ubWVzc2FnZScsIG9ubWVzc2FnZSApO1xuICB9XG5cbiAgcmV0dXJuIHdpbmRvdy5wb3N0TWVzc2FnZSA/IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICB0YWlsID0gdGFpbC5uZXh0ID0geyBmdW5jOiBmdW5jIH07XG4gICAgd2luZG93LnBvc3RNZXNzYWdlKElELCBcIipcIik7XG4gIH0gOlxuICBmdW5jdGlvbihmdW5jKSB7IC8vIElFPDhcbiAgICBzZXRUaW1lb3V0KGZ1bmMsIDApO1xuICB9O1xufSgpKTtcblxuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIkprcFIyRlwiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiXG4vKipcbiAqIFZpcnR1YWxUeXBlIGNvbnN0cnVjdG9yXG4gKlxuICogVGhpcyBpcyB3aGF0IG1vbmdvb3NlIHVzZXMgdG8gZGVmaW5lIHZpcnR1YWwgYXR0cmlidXRlcyB2aWEgYFNjaGVtYS5wcm90b3R5cGUudmlydHVhbGAuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIHZhciBmdWxsbmFtZSA9IHNjaGVtYS52aXJ0dWFsKCdmdWxsbmFtZScpO1xuICogICAgIGZ1bGxuYW1lIGluc3RhbmNlb2YgbW9uZ29vc2UuVmlydHVhbFR5cGUgLy8gdHJ1ZVxuICpcbiAqIEBwYXJtYSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIFZpcnR1YWxUeXBlIChvcHRpb25zLCBuYW1lKSB7XG4gIHRoaXMucGF0aCA9IG5hbWU7XG4gIHRoaXMuZ2V0dGVycyA9IFtdO1xuICB0aGlzLnNldHRlcnMgPSBbXTtcbiAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbn1cblxuLyoqXG4gKiBEZWZpbmVzIGEgZ2V0dGVyLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgdmlydHVhbCA9IHNjaGVtYS52aXJ0dWFsKCdmdWxsbmFtZScpO1xuICogICAgIHZpcnR1YWwuZ2V0KGZ1bmN0aW9uICgpIHtcbiAqICAgICAgIHJldHVybiB0aGlzLm5hbWUuZmlyc3QgKyAnICcgKyB0aGlzLm5hbWUubGFzdDtcbiAqICAgICB9KTtcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7VmlydHVhbFR5cGV9IHRoaXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuVmlydHVhbFR5cGUucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChmbikge1xuICB0aGlzLmdldHRlcnMucHVzaChmbik7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBEZWZpbmVzIGEgc2V0dGVyLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgdmlydHVhbCA9IHNjaGVtYS52aXJ0dWFsKCdmdWxsbmFtZScpO1xuICogICAgIHZpcnR1YWwuc2V0KGZ1bmN0aW9uICh2KSB7XG4gKiAgICAgICB2YXIgcGFydHMgPSB2LnNwbGl0KCcgJyk7XG4gKiAgICAgICB0aGlzLm5hbWUuZmlyc3QgPSBwYXJ0c1swXTtcbiAqICAgICAgIHRoaXMubmFtZS5sYXN0ID0gcGFydHNbMV07XG4gKiAgICAgfSk7XG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge1ZpcnR1YWxUeXBlfSB0aGlzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cblZpcnR1YWxUeXBlLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAoZm4pIHtcbiAgdGhpcy5zZXR0ZXJzLnB1c2goZm4pO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQXBwbGllcyBnZXR0ZXJzIHRvIGB2YWx1ZWAgdXNpbmcgb3B0aW9uYWwgYHNjb3BlYC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZVxuICogQHJldHVybiB7YW55fSB0aGUgdmFsdWUgYWZ0ZXIgYXBwbHlpbmcgYWxsIGdldHRlcnNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuVmlydHVhbFR5cGUucHJvdG90eXBlLmFwcGx5R2V0dGVycyA9IGZ1bmN0aW9uICh2YWx1ZSwgc2NvcGUpIHtcbiAgdmFyIHYgPSB2YWx1ZTtcbiAgZm9yICh2YXIgbCA9IHRoaXMuZ2V0dGVycy5sZW5ndGggLSAxOyBsID49IDA7IGwtLSkge1xuICAgIHYgPSB0aGlzLmdldHRlcnNbbF0uY2FsbChzY29wZSwgdiwgdGhpcyk7XG4gIH1cbiAgcmV0dXJuIHY7XG59O1xuXG4vKipcbiAqIEFwcGxpZXMgc2V0dGVycyB0byBgdmFsdWVgIHVzaW5nIG9wdGlvbmFsIGBzY29wZWAuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlXG4gKiBAcGFyYW0ge09iamVjdH0gc2NvcGVcbiAqIEByZXR1cm4ge2FueX0gdGhlIHZhbHVlIGFmdGVyIGFwcGx5aW5nIGFsbCBzZXR0ZXJzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cblZpcnR1YWxUeXBlLnByb3RvdHlwZS5hcHBseVNldHRlcnMgPSBmdW5jdGlvbiAodmFsdWUsIHNjb3BlKSB7XG4gIHZhciB2ID0gdmFsdWU7XG4gIGZvciAodmFyIGwgPSB0aGlzLnNldHRlcnMubGVuZ3RoIC0gMTsgbCA+PSAwOyBsLS0pIHtcbiAgICB2ID0gdGhpcy5zZXR0ZXJzW2xdLmNhbGwoc2NvcGUsIHYsIHRoaXMpO1xuICB9XG4gIHJldHVybiB2O1xufTtcblxuLyohXG4gKiBleHBvcnRzXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBWaXJ0dWFsVHlwZTtcbiJdfQ==
(10)
});
