!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.storage=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (Buffer){
'use strict';

/**
 * A class representation of the BSON Binary type.
 *
 * Sub types
 *  - **BSON.BSON_BINARY_SUBTYPE_DEFAULT**, default BSON type.
 *  - **BSON.BSON_BINARY_SUBTYPE_FUNCTION**, BSON function type.
 *  - **BSON.BSON_BINARY_SUBTYPE_BYTE_ARRAY**, BSON byte array type.
 *  - **BSON.BSON_BINARY_SUBTYPE_UUID**, BSON uuid type.
 *  - **BSON.BSON_BINARY_SUBTYPE_MD5**, BSON md5 type.
 *  - **BSON.BSON_BINARY_SUBTYPE_USER_DEFINED**, BSON user defined type.
 *
 * @class Represents the Binary BSON type.
 * @param {Buffer} buffer a buffer object containing the binary data.
 * @param {Number} [subType] the option binary type.
 * @return {Grid}
 */
function Binary(buffer, subType) {
  if(!(this instanceof Binary)) return new Binary(buffer, subType);

  this._bsontype = 'Binary';

  if(buffer instanceof Number) {
    this.sub_type = buffer;
    this.position = 0;
  } else {
    this.sub_type = subType == null ? BSON_BINARY_SUBTYPE_DEFAULT : subType;
    this.position = 0;
  }

  if(buffer != null && !(buffer instanceof Number)) {
    // Only accept Buffer, Uint8Array or Arrays
    if(typeof buffer == 'string') {
      // Different ways of writing the length of the string for the different types
      if(typeof Buffer != 'undefined') {
        this.buffer = new Buffer(buffer);
      } else if(typeof Uint8Array != 'undefined' || (Object.prototype.toString.call(buffer) == '[object Array]')) {
        this.buffer = writeStringToArray(buffer);
      } else {
        throw new Error("only String, Buffer, Uint8Array or Array accepted");
      }
    } else {
      this.buffer = buffer;
    }
    this.position = buffer.length;
  } else {
    if(typeof Buffer != 'undefined') {
      this.buffer =  new Buffer(Binary.BUFFER_SIZE);
    } else if(typeof Uint8Array != 'undefined'){
      this.buffer = new Uint8Array(new ArrayBuffer(Binary.BUFFER_SIZE));
    } else {
      this.buffer = new Array(Binary.BUFFER_SIZE);
    }
    // Set position to start of buffer
    this.position = 0;
  }
}

/**
 * Updates this binary with byte_value.
 *
 * @param {Character} byte_value a single byte we wish to write.
 * @api public
 */
Binary.prototype.put = function put(byte_value) {
  // If it's a string and a has more than one character throw an error
  if(byte_value['length'] != null && typeof byte_value != 'number' && byte_value.length != 1) throw new Error("only accepts single character String, Uint8Array or Array");
  if(typeof byte_value != 'number' && byte_value < 0 || byte_value > 255) throw new Error("only accepts number in a valid unsigned byte range 0-255");

  // Decode the byte value once
  var decoded_byte = null;
  if(typeof byte_value == 'string') {
    decoded_byte = byte_value.charCodeAt(0);
  } else if(byte_value['length'] != null) {
    decoded_byte = byte_value[0];
  } else {
    decoded_byte = byte_value;
  }

  if(this.buffer.length > this.position) {
    this.buffer[this.position++] = decoded_byte;
  } else {
    if(typeof Buffer != 'undefined' && Buffer.isBuffer(this.buffer)) {
      // Create additional overflow buffer
      var buffer = new Buffer(Binary.BUFFER_SIZE + this.buffer.length);
      // Combine the two buffers together
      this.buffer.copy(buffer, 0, 0, this.buffer.length);
      this.buffer = buffer;
      this.buffer[this.position++] = decoded_byte;
    } else {
      var buffer = null;
      // Create a new buffer (typed or normal array)
      if(Object.prototype.toString.call(this.buffer) == '[object Uint8Array]') {
        buffer = new Uint8Array(new ArrayBuffer(Binary.BUFFER_SIZE + this.buffer.length));
      } else {
        buffer = new Array(Binary.BUFFER_SIZE + this.buffer.length);
      }

      // We need to copy all the content to the new array
      for(var i = 0; i < this.buffer.length; i++) {
        buffer[i] = this.buffer[i];
      }

      // Reassign the buffer
      this.buffer = buffer;
      // Write the byte
      this.buffer[this.position++] = decoded_byte;
    }
  }
};

/**
 * Writes a buffer or string to the binary.
 *
 * @param {Buffer|String} string a string or buffer to be written to the Binary BSON object.
 * @param {Number} offset specify the binary of where to write the content.
 * @api public
 */
Binary.prototype.write = function write(string, offset) {
  offset = typeof offset == 'number' ? offset : this.position;

  // If the buffer is to small let's extend the buffer
  if(this.buffer.length < offset + string.length) {
    var buffer = null;
    // If we are in node.js
    if(typeof Buffer != 'undefined' && Buffer.isBuffer(this.buffer)) {
      buffer = new Buffer(this.buffer.length + string.length);
      this.buffer.copy(buffer, 0, 0, this.buffer.length);
    } else if(Object.prototype.toString.call(this.buffer) == '[object Uint8Array]') {
      // Create a new buffer
      buffer = new Uint8Array(new ArrayBuffer(this.buffer.length + string.length))
      // Copy the content
      for(var i = 0; i < this.position; i++) {
        buffer[i] = this.buffer[i];
      }
    }

    // Assign the new buffer
    this.buffer = buffer;
  }

  if(typeof Buffer != 'undefined' && Buffer.isBuffer(string) && Buffer.isBuffer(this.buffer)) {
    string.copy(this.buffer, offset, 0, string.length);
    this.position = (offset + string.length) > this.position ? (offset + string.length) : this.position;
    // offset = string.length
  } else if(typeof Buffer != 'undefined' && typeof string == 'string' && Buffer.isBuffer(this.buffer)) {
    this.buffer.write(string, 'binary', offset);
    this.position = (offset + string.length) > this.position ? (offset + string.length) : this.position;
    // offset = string.length;
  } else if(Object.prototype.toString.call(string) == '[object Uint8Array]'
    || Object.prototype.toString.call(string) == '[object Array]' && typeof string != 'string') {
    for(var i = 0; i < string.length; i++) {
      this.buffer[offset++] = string[i];
    }

    this.position = offset > this.position ? offset : this.position;
  } else if(typeof string == 'string') {
    for(var i = 0; i < string.length; i++) {
      this.buffer[offset++] = string.charCodeAt(i);
    }

    this.position = offset > this.position ? offset : this.position;
  }
};

/**
 * Reads **length** bytes starting at **position**.
 *
 * @param {Number} position read from the given position in the Binary.
 * @param {Number} length the number of bytes to read.
 * @return {Buffer}
 * @api public
 */
Binary.prototype.read = function read(position, length) {
  length = length && length > 0
    ? length
    : this.position;

  // Let's return the data based on the type we have
  if(this.buffer['slice']) {
    return this.buffer.slice(position, position + length);
  } else {
    // Create a buffer to keep the result
    var buffer = typeof Uint8Array != 'undefined' ? new Uint8Array(new ArrayBuffer(length)) : new Array(length);
    for(var i = 0; i < length; i++) {
      buffer[i] = this.buffer[position++];
    }
  }
  // Return the buffer
  return buffer;
};

/**
 * Returns the value of this binary as a string.
 *
 * @return {String}
 * @api public
 */
Binary.prototype.value = function value(asRaw) {
  asRaw = asRaw == null ? false : asRaw;

  // Optimize to serialize for the situation where the data == size of buffer
  if(asRaw && typeof Buffer != 'undefined' && Buffer.isBuffer(this.buffer) && this.buffer.length == this.position)
    return this.buffer;

  // If it's a node.js buffer object
  if(typeof Buffer != 'undefined' && Buffer.isBuffer(this.buffer)) {
    return asRaw ? this.buffer.slice(0, this.position) : this.buffer.toString('binary', 0, this.position);
  } else {
    if(asRaw) {
      // we support the slice command use it
      if(this.buffer['slice'] != null) {
        return this.buffer.slice(0, this.position);
      } else {
        // Create a new buffer to copy content to
        var newBuffer = Object.prototype.toString.call(this.buffer) == '[object Uint8Array]' ? new Uint8Array(new ArrayBuffer(this.position)) : new Array(this.position);
        // Copy content
        for(var i = 0; i < this.position; i++) {
          newBuffer[i] = this.buffer[i];
        }
        // Return the buffer
        return newBuffer;
      }
    } else {
      return convertArraytoUtf8BinaryString(this.buffer, 0, this.position);
    }
  }
};

/**
 * Length.
 *
 * @return {Number} the length of the binary.
 * @api public
 */
Binary.prototype.length = function length() {
  return this.position;
};

/**
 * @ignore
 * @api private
 */
Binary.prototype.toJSON = function() {
  return this.buffer != null ? this.buffer.toString('base64') : '';
};

/**
 * @ignore
 * @api private
 */
Binary.prototype.toString = function(format) {
  return this.buffer != null ? this.buffer.slice(0, this.position).toString(format) : '';
};

// Binary default subtype
var BSON_BINARY_SUBTYPE_DEFAULT = 0;

/**
 * @ignore
 * @api private
 */
var writeStringToArray = function(data) {
  // Create a buffer
  var buffer = typeof Uint8Array != 'undefined' ? new Uint8Array(new ArrayBuffer(data.length)) : new Array(data.length);
  // Write the content to the buffer
  for(var i = 0; i < data.length; i++) {
    buffer[i] = data.charCodeAt(i);
  }
  // Write the string to the buffer
  return buffer;
};

/**
 * Convert Array ot Uint8Array to Binary String
 *
 * @ignore
 * @api private
 */
var convertArraytoUtf8BinaryString = function(byteArray, startIndex, endIndex) {
  var result = "";
  for(var i = startIndex; i < endIndex; i++) {
    result = result + String.fromCharCode(byteArray[i]);
  }
  return result;
};

Binary.BUFFER_SIZE = 256;

/**
 * Default BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_DEFAULT = 0;
/**
 * Function BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_FUNCTION = 1;
/**
 * Byte Array BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_BYTE_ARRAY = 2;
/**
 * OLD UUID BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_UUID_OLD = 3;
/**
 * UUID BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_UUID = 4;
/**
 * MD5 BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_MD5 = 5;
/**
 * User BSON type
 *
 * @classconstant SUBTYPE_DEFAULT
 **/
Binary.SUBTYPE_USER_DEFINED = 128;

/**
 * Expose.
 */
module.exports = Binary;
module.exports.Binary = Binary;
}).call(this,require("buffer").Buffer)
},{"buffer":36}],2:[function(require,module,exports){
'use strict';

/**
 * Binary Parser.
 * Jonas Raoni Soares Silva
 * http://jsfromhell.com/classes/binary-parser [v1.0]
 *
 * @see https://github.com/mongodb/js-bson/blob/master/lib/bson/binary_parser.js
 */
var chr = String.fromCharCode;

var maxBits = [];
for (var i = 0; i < 64; i++) {
	maxBits[i] = Math.pow(2, i);
}

function BinaryParser (bigEndian, allowExceptions) {
  if(!(this instanceof BinaryParser)) return new BinaryParser(bigEndian, allowExceptions);
  
	this.bigEndian = bigEndian;
	this.allowExceptions = allowExceptions;
}

BinaryParser.warn = function warn (msg) {
	if (this.allowExceptions) {
		throw new Error(msg);
  }

	return 1;
};

BinaryParser.decodeInt = function decodeInt (data, bits, signed, forceBigEndian) {
  var b = new this.Buffer(this.bigEndian || forceBigEndian, data)
      , x = b.readBits(0, bits)
      , max = maxBits[bits]; //max = Math.pow( 2, bits );
  
  return signed && x >= max / 2
      ? x - max
      : x;
};

BinaryParser.encodeInt = function encodeInt (data, bits, signed, forceBigEndian) {
	var max = maxBits[bits];

  if (data >= max || data < -(max / 2)) {
    this.warn("encodeInt::overflow");
    data = 0;
  }

	if (data < 0) {
    data += max;
  }

	for (var r = []; data; r[r.length] = String.fromCharCode(data % 256), data = Math.floor(data / 256));

	for (bits = -(-bits >> 3) - r.length; bits--; r[r.length] = "\0");

  return ((this.bigEndian || forceBigEndian) ? r.reverse() : r).join("");
};

BinaryParser.toSmall    = function( data ){ return this.decodeInt( data,  8, true  ); };
BinaryParser.fromSmall  = function( data ){ return this.encodeInt( data,  8, true  ); };
BinaryParser.toByte     = function( data ){ return this.decodeInt( data,  8, false ); };
BinaryParser.fromByte   = function( data ){ return this.encodeInt( data,  8, false ); };
BinaryParser.toShort    = function( data ){ return this.decodeInt( data, 16, true  ); };
BinaryParser.fromShort  = function( data ){ return this.encodeInt( data, 16, true  ); };
BinaryParser.toWord     = function( data ){ return this.decodeInt( data, 16, false ); };
BinaryParser.fromWord   = function( data ){ return this.encodeInt( data, 16, false ); };
BinaryParser.toInt      = function( data ){ return this.decodeInt( data, 32, true  ); };
BinaryParser.fromInt    = function( data ){ return this.encodeInt( data, 32, true  ); };
BinaryParser.toLong     = function( data ){ return this.decodeInt( data, 64, true  ); };
BinaryParser.fromLong   = function( data ){ return this.encodeInt( data, 64, true  ); };
BinaryParser.toDWord    = function( data ){ return this.decodeInt( data, 32, false ); };
BinaryParser.fromDWord  = function( data ){ return this.encodeInt( data, 32, false ); };
BinaryParser.toQWord    = function( data ){ return this.decodeInt( data, 64, true ); };
BinaryParser.fromQWord  = function( data ){ return this.encodeInt( data, 64, true ); };

/**
 * BinaryParser buffer constructor.
 */
function BinaryParserBuffer (bigEndian, buffer) {
  this.bigEndian = bigEndian || 0;
  this.buffer = [];
  this.setBuffer(buffer);
}

BinaryParserBuffer.prototype.setBuffer = function setBuffer (data) {
  var l, i, b;

	if (data) {
    i = l = data.length;
    b = this.buffer = new Array(l);
		for (; i; b[l - i] = data.charCodeAt(--i));
		this.bigEndian && b.reverse();
	}
};

BinaryParserBuffer.prototype.hasNeededBits = function hasNeededBits (neededBits) {
	return this.buffer.length >= -(-neededBits >> 3);
};

BinaryParserBuffer.prototype.checkBuffer = function checkBuffer (neededBits) {
	if (!this.hasNeededBits(neededBits)) {
		throw new Error("checkBuffer::missing bytes");
  }
};

BinaryParserBuffer.prototype.readBits = function readBits (start, length) {
	//shl fix: Henri Torgemane ~1996 (compressed by Jonas Raoni)

	function shl (a, b) {
		for (; b--; a = ((a %= 0x7fffffff + 1) & 0x40000000) == 0x40000000 ? a * 2 : (a - 0x40000000) * 2 + 0x7fffffff + 1);
		return a;
	}

	if (start < 0 || length <= 0) {
		return 0;
  }

	this.checkBuffer(start + length);

  var offsetLeft
    , offsetRight = start % 8
    , curByte = this.buffer.length - ( start >> 3 ) - 1
    , lastByte = this.buffer.length + ( -( start + length ) >> 3 )
    , diff = curByte - lastByte
    , sum = ((this.buffer[ curByte ] >> offsetRight) & ((1 << (diff ? 8 - offsetRight : length)) - 1)) + (diff && (offsetLeft = (start + length) % 8) ? (this.buffer[lastByte++] & ((1 << offsetLeft) - 1)) << (diff-- << 3) - offsetRight : 0);

	for(; diff; sum += shl(this.buffer[lastByte++], (diff-- << 3) - offsetRight));

	return sum;
};

/**
 * Expose.
 */
BinaryParser.Buffer = BinaryParserBuffer;

exports.BinaryParser = BinaryParser;

},{}],3:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var Schema = require('./schema')
  , Document = require('./document');

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
  // Нужно для обновления привязок к этому свойству для knockoutjs
  window.ko && ko.track( this, ['array'] );
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
      //todo: тут нужна проверка на существование id (может стоит смотреть в схеме опцию id)
      /*if ( !newDoc._id ){
        throw new TypeError('Для помещения в коллекцию необходимо, чтобы у документа был _id');
      }*/

      id = newDoc._id.toString();
      // Поместить документ в коллекцию
      this.documents[ id ] = newDoc;
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
  },

  /**
   * Обновить ссылку на документ в поле documents
   *
   * @param {Document} doc
   */
  updateIdLink: function( doc ){
    var id = doc._id.toString();
    var oldId = _.findKey( this.documents, { _id: doc._id });

    if ( !oldId ){
      throw new TypeError('Не найден документ для обновления ссылки по этому _id: ' + id );
    }

    delete this.documents[ oldId ];
    this.documents[ id ] = doc;
  }
};

/*!
 * Module exports.
 */

module.exports = Collection;

},{"./document":4,"./schema":15}],4:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var Events = require('./events')
  , StorageError = require('./error')
  , MixedSchema = require('./schema/mixed')
  , ObjectId = require('./types/objectid')
  , Schema = require('./schema')
  , ValidatorError = require('./schematype').ValidatorError
  , utils = require('./utils')
  , clone = utils.clone
  , ValidationError = StorageError.ValidationError
  , InternalCache = require('./internal')
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
  if ( !(this instanceof Document) ) {
    return new Document( data, collectionName, schema, fields, init );
  }

  this.$__ = new InternalCache;
  this.isNew = true;

  // Создать пустой документ с флагом init
  // new TestDocument(true);
  if ( 'boolean' === typeof data ){
    init = data;
    data = null;
  }

  if ( collectionName instanceof Schema ){
    schema = collectionName;
    collectionName = undefined;
  }

  if ( _.isObject( schema ) && !( schema instanceof Schema )) {
    schema = new Schema( schema );
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
    // Сгенерировать ObjectId, если он отсутствует, но его требует схема
    if ( schema && !this.schema && schema.options._id ){
      data = data || {};

      if ( data._id === undefined ){
        data._id = new ObjectId();
      }
    }
  }

  if ( !schema ){
    throw new StorageError.MissingSchemaError();
  }

  // Создать документ с флагом init
  // new TestDocument({ test: 'boom' }, true);
  if ( 'boolean' === typeof collectionName ){
    init = collectionName;
    collectionName = undefined;
  }

  // Создать документ с strict: true
  // collection.add({...}, true);
  if ('boolean' === typeof fields) {
    this.$__.strictMode = fields;
    fields = undefined;
  } else {
    this.$__.strictMode = schema.options && schema.options.strict;
    this.$__.selected = fields;
  }

  this.schema = schema;

  if ( collectionName ){
    this.collection = window.storage[ collectionName ];
    this.collectionName = collectionName;
  }

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
Document.prototype = Object.create( Events.prototype );
Document.prototype.constructor = Document;

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

Document.prototype.adapterHooks = {
  documentDefineProperty: $.noop,
  documentSetInitialValue: $.noop,
  documentGetValue: $.noop,
  documentSetValue: $.noop
};

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
  /*!
  if ( doc._id && opts && opts.populated && opts.populated.length ) {
    var id = String( doc._id );
    for (var i = 0; i < opts.populated.length; ++i) {
      var item = opts.populated[ i ];
      this.populated( item.path, item._docs[id], item );
    }
  }
  */

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
        (!obj[i].constructor || 'Object' == utils.getFunctionName(obj[i].constructor))) {
      // assume nested object
      if (!doc[i]) doc[i] = {};
      init(self, obj[i], doc[i], path + '.');
    } else {
      if (obj[i] === null) {
        doc[i] = null;
      } else if (obj[i] !== undefined) {
        if (schema) {
          self.$__try(function(){
            doc[i] = schema.cast(obj[i], self, true);
          });
        } else {
          doc[i] = obj[i];
        }

        self.adapterHooks.documentSetInitialValue.call( self, self, path, doc[i] );
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
  if (type && 'Object' == utils.getFunctionName(type.constructor)) {
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
            && ( !path[key].constructor || 'Object' == utils.getFunctionName(path[key].constructor) )
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
      (!val.constructor || 'Object' == utils.getFunctionName(val.constructor))) {
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
  /*!
  if (!constructing &&
      null != val &&
      path in this.$__.activePaths.states.default &&
      utils.deepEqual(val, schema.getDefault(this, constructing)) ) {

    //console.log( pathToMark, this.$__.activePaths.states.modify );

    // a path with a default was $unset on the server
    // and the user is setting it to the same value again
    return true;
  }
  */

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

      this.adapterHooks.documentSetValue.call( this, this, path, val );

    } else {
      if (obj[parts[i]] && 'Object' === utils.getFunctionName(obj[parts[i]].constructor)) {
        obj = obj[parts[i]];

      } else if (obj[parts[i]] && 'EmbeddedDocument' === utils.getFunctionName(obj[parts[i]].constructor) ) {
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

  this.adapterHooks.documentGetValue.call( this, this, path );

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

  this.$__.activePaths
  .map('init', 'modify', function (i) {
    return self.getValue(i);
  })
  .filter(function (val) {
    return val && val.isStorageDocumentArray && val.length;
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
        , (('Object' === utils.getFunctionName(limb.constructor)
               && Object.keys(limb).length)
               && (!limb.type || limb.type.type)
               ? limb
               : null)
        , proto
        , prefix
        , keys);
  }
}

// gets descriptors for all properties of `object`
// makes all properties non-enumerable to match previous behavior to #2211
function getOwnPropertyDescriptors(object) {
  var result = {};

  Object.getOwnPropertyNames(object).forEach(function(key) {
    result[key] = Object.getOwnPropertyDescriptor(object, key);
    result[key].enumerable = false;
  });

  return result;
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
      , configurable: true
      , get: function () {
          if (!this.$__.getters)
            this.$__.getters = {};

          if (!this.$__.getters[path]) {
            var nested = Object.create(Object.getPrototypeOf(this), getOwnPropertyDescriptors(this));

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
    Object.defineProperty( prototype, prop, {
        enumerable: true
      , configurable: true
      , get: function ( ) { return this.get.call(this.$__.scope || this, path); }
      , set: function (v) { return this.set.call(this.$__.scope || this, path, v); }
    });
  }

  self.adapterHooks.documentDefineProperty.call( self, self, prototype, prop, prefix, path );
  //self.adapterHooks.documentDefineProperty.call( self, self, path, prototype );
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
  DocumentArray || (DocumentArray = require('./types/documentarray'));
  Embedded = Embedded || require('./types/embedded');

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
  DocumentArray || (DocumentArray = require('./types/documentarray'));

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
  if (!(options && 'Object' == utils.getFunctionName(options.constructor)) ||
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
  if (!(options && 'Object' == utils.getFunctionName(options.constructor))
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
};

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

},{"./error":5,"./events":11,"./internal":13,"./schema":15,"./schema/mixed":22,"./schematype":26,"./types/documentarray":30,"./types/embedded":31,"./types/objectid":33,"./utils":34}],5:[function(require,module,exports){
'use strict';

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
 * @see Error.messages #error_messages_StorageError-messages
 * @api public
 */

StorageError.messages = require('./error/messages');

/*!
 * Expose subclasses
 */

StorageError.CastError = require('./error/cast');
StorageError.ValidationError = require('./error/validation');
StorageError.ValidatorError = require('./error/validator');
//todo:
//StorageError.VersionError = require('./error/version');
//StorageError.OverwriteModelError = require('./error/overwriteModel');
StorageError.MissingSchemaError = require('./error/missingSchema');
//StorageError.DivergentArrayError = require('./error/divergentArray');

},{"./error/cast":6,"./error/messages":7,"./error/missingSchema":8,"./error/validation":9,"./error/validator":10}],6:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var StorageError = require('../error.js');

/**
 * Casting Error constructor.
 *
 * @param {String} type
 * @param {String} value
 * @param {String} path
 * @inherits StorageError
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
 * Inherits from StorageError.
 */
CastError.prototype = Object.create( StorageError.prototype );
CastError.prototype.constructor = CastError;

/*!
 * exports
 */

module.exports = CastError;

},{"../error.js":5}],7:[function(require,module,exports){
'use strict';

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
 * @receiver StorageError
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


},{}],8:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var StorageError = require('../error.js');

/*!
 * MissingSchema Error constructor.
 *
 * @inherits StorageError
 */

function MissingSchemaError(){
  var msg = 'Schema hasn\'t been registered for document.\n'
    + 'Use storage.Document(data, schema)';
  StorageError.call(this, msg);

  this.name = 'MissingSchemaError';
}

/*!
 * Inherits from StorageError.
 */

MissingSchemaError.prototype = Object.create(StorageError.prototype);
MissingSchemaError.prototype.constructor = StorageError;

/*!
 * exports
 */

module.exports = MissingSchemaError;
},{"../error.js":5}],9:[function(require,module,exports){
'use strict';

/*!
 * Module requirements
 */

var StorageError = require('../error.js');

/**
 * Document Validation Error
 *
 * @api private
 * @param {Document} instance
 * @inherits StorageError
 */

function ValidationError (instance) {
  StorageError.call(this, "Validation failed");
  this.name = 'ValidationError';
  this.errors = instance.errors = {};
}

/*!
 * Inherits from StorageError.
 */
ValidationError.prototype = Object.create( StorageError.prototype );
ValidationError.prototype.constructor = ValidationError;

/*!
 * Module exports
 */

module.exports = ValidationError;

},{"../error.js":5}],10:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var StorageError = require('../error.js');
var errorMessages = StorageError.messages;

/**
 * Schema validator error
 *
 * @param {String} path
 * @param {String} msg
 * @param {String|Number|any} val
 * @inherits StorageError
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
 * Inherits from StorageError
 */
ValidatorError.prototype = Object.create( StorageError.prototype );
ValidatorError.prototype.constructor = ValidatorError;

/*!
 * exports
 */

module.exports = ValidatorError;

},{"../error.js":5}],11:[function(require,module,exports){
'use strict';

/**
 *
 * Backbone.Events

 * A module that can be mixed in to *any object* in order to provide it with
 * custom events. You may bind with `on` or remove with `off` callback
 * functions to an event; `trigger`-ing an event fires all callbacks in
 * succession.
 *
 * var object = {};
 * _.extend(object, Events.prototype);
 * object.on('expand', function(){ alert('expanded'); });
 * object.trigger('expand');
 */
function Events() {}

Events.prototype = {
  /**
   * Bind an event to a `callback` function. Passing `"all"` will bind
   * the callback to all events fired.
   * @param name
   * @param callback
   * @param context
   * @returns {Events}
   */
  on: function(name, callback, context) {
    if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
    this._events || (this._events = {});
    var events = this._events[name] || (this._events[name] = []);
    events.push({callback: callback, context: context, ctx: context || this});
    return this;
  },

  /**
   * Bind an event to only be triggered a single time. After the first time
   * the callback is invoked, it will be removed.
   *
   * @param name
   * @param callback
   * @param context
   * @returns {Events}
   */
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

  /**
   * Remove one or many callbacks. If `context` is null, removes all
   * callbacks with that function. If `callback` is null, removes all
   * callbacks for the event. If `name` is null, removes all bound
   * callbacks for all events.
   *
   * @param name
   * @param callback
   * @param context
   * @returns {Events}
   */
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

  /**
   * Trigger one or many events, firing all bound callbacks. Callbacks are
   * passed the same arguments as `trigger` is, apart from the event name
   * (unless you're listening on `"all"`, which will cause your callback to
   * receive the true name of the event as the first argument).
   *
   * @param name
   * @returns {Events}
   */
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

  /**
   * Tell this object to stop listening to either specific events ... or
   * to every object it's currently listening to.
   *
   * @param obj
   * @param name
   * @param callback
   * @returns {Events}
   */
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

/**
 * Implement fancy features of the Events API such as multiple event
 * names `"change blur"` and jQuery-style event maps `{change: action}`
 * in terms of the existing API.
 *
 * @param obj
 * @param action
 * @param name
 * @param rest
 * @returns {boolean}
 */
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

/**
 * A difficult-to-believe, but optimized internal dispatch function for
 * triggering events. Tries to keep the usual cases speedy (most internal
 * Backbone events have 3 arguments).
 *
 * @param events
 * @param args
 */
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

},{}],12:[function(require,module,exports){
(function (Buffer){
'use strict';

/*!
 * Storage documents using schema
 * inspired by mongoose 3.8.4 (fixed bugs for 3.8.16)
 *
 * Storage implementation
 * http://docs.meteor.com/#selectors
 * https://github.com/meteor/meteor/tree/master/packages/minimongo
 *
 * проследить за багом gh-1638 (3.8.16)
 */

/*!
 * Module dependencies.
 */
var Collection = require('./collection')
  , Schema = require('./schema')
  , SchemaType = require('./schematype')
  , VirtualType = require('./virtualtype')
  , Types = require('./types')
  , Document = require('./document')
  , utils = require('./utils')
  , pkg = require('../package.json');


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
 * Create a collection and get it
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

  if ( 'Schema' !== utils.getFunctionName( schema.constructor ) ){
    throw new TypeError('`schema` must be Schema instance');
  }

  this.collectionNames.push( name );

  return this[ name ] = new Collection( name, schema, api );
};

/**
 * To obtain the names of the collections in an array
 *
 * @returns {Array.<string>} An array containing all collections in the storage.
 */
Storage.prototype.getCollectionNames = function(){
  return this.collectionNames;
};

/**
 * The Storage Collection constructor
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
Storage.prototype.version = pkg.version;

/**
 * The Storage [Schema](#schema_Schema) constructor
 *
 * ####Example:
 *
 *     var Schema = storage.Schema;
 *     var CatSchema = new Schema(..);
 *
 * @method Schema
 * @api public
 */
Storage.prototype.Schema = Schema;

/**
 * The Storage [SchemaType](#schematype_SchemaType) constructor
 *
 * @method SchemaType
 * @api public
 */
Storage.prototype.SchemaType = SchemaType;

/**
 * The various Storage SchemaTypes.
 *
 * ####Note:
 *
 * _Alias of storage.Schema.Types for backwards compatibility._
 *
 * @property SchemaTypes
 * @see Schema.SchemaTypes #schema_Schema.Types
 * @api public
 */
Storage.prototype.SchemaTypes = Schema.Types;

/**
 * The Storage [VirtualType](#virtualtype_VirtualType) constructor
 *
 * @method VirtualType
 * @api public
 */
Storage.prototype.VirtualType = VirtualType;

/**
 * The various Storage Types.
 *
 * ####Example:
 *
 *     var array = storage.Types.Array;
 *
 * ####Types:
 *
 * - [ObjectId](#types-objectid-js)
 * - [Buffer](#types-buffer-js)
 * - [SubDocument](#types-embedded-js)
 * - [Array](#types-array-js)
 * - [DocumentArray](#types-documentarray-js)
 *
 * Using this exposed access to the `ObjectId` type, we can construct ids on demand.
 *
 *     var ObjectId = storage.Types.ObjectId;
 *     var id1 = new ObjectId;
 *
 * @property Types
 * @api public
 */
Storage.prototype.Types = Types;

/**
 * The Storage [Document](#document-js) constructor.
 *
 * @method Document
 * @api public
 */
Storage.prototype.Document = Document;

/**
 * The [StorageError](#error_StorageError) constructor.
 *
 * @method Error
 * @api public
 */
Storage.prototype.Error = require('./error');



Storage.prototype.StateMachine = require('./statemachine');
Storage.prototype.utils = utils;
Storage.prototype.ObjectId = Types.ObjectId;
Storage.prototype.schemas = Schema.schemas;

Storage.prototype.setAdapter = function( adapterHooks ){
  Document.prototype.adapterHooks = adapterHooks;
};


/*!
 * The exports object is an instance of Storage.
 *
 * @api public
 */
module.exports = new Storage;

window.Buffer = Buffer;

}).call(this,require("buffer").Buffer)
},{"../package.json":41,"./collection":3,"./document":4,"./error":5,"./schema":15,"./schematype":26,"./statemachine":27,"./types":32,"./utils":34,"./virtualtype":35,"buffer":36}],13:[function(require,module,exports){
'use strict';

// Машина состояний используется для пометки, в каком состоянии находятся поле
// Например: если поле имеет состояние default - значит его значением является значение по умолчанию
// Примечание: для массивов в общем случае это означает пустой массив

/*!
 * Dependencies
 */

var StateMachine = require('./statemachine');

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

},{"./statemachine":27}],14:[function(require,module,exports){
'use strict';

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
};

/**
 * Sets the `val` at the given `path` of object `o`.
 *
 * @param {String} path
 * @param {*} val
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
    , part;

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
};

/*!
 * Returns the value passed to it.
 */

function K (v) {
  return v;
}
},{}],15:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var Events = require('./events')
  , VirtualType = require('./virtualtype')
  , utils = require('./utils')
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
  if ( !(this instanceof Schema) ) {
    return new Schema( name, baseSchema, obj, options );
  }

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
Schema.prototype = Object.create( Events.prototype );
Schema.prototype.constructor = Schema;

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
      && ( !obj[ key ].constructor || 'Object' == utils.getFunctionName(obj[key].constructor) )
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
  var constructorName = utils.getFunctionName(obj.constructor);
  if (constructorName != 'Object'){
    obj = { type: obj };
  }

  // Get the type making sure to allow keys named "type"
  // and default to mixed if not specified.
  // { type: { type: String, default: 'freshcut' } }
  var type = obj.type && !obj.type.type
    ? obj.type
    : {};

  if ('Object' == utils.getFunctionName(type.constructor) || 'mixed' == type) {
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
                    && 'Object' == utils.getFunctionName(cast.constructor)
                    && Object.keys(cast).length) {
      return new Types.DocumentArray(path, new Schema(cast), obj);
    }

    return new Types.Array(path, cast || Types.Mixed, obj);
  }

  var name = 'string' == typeof type
    ? type
    // If not string, `type` is a function. Outside of IE, function.name
    // gives you the function name. In IE, you need to compute it
    : utils.getFunctionName(type);

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

  this.options[key] = value;

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
 * @param {String} name   discriminator name
 * @param {Schema} schema discriminator schema
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

    //schema.callQueue = baseSchema.callQueue.concat(schema.callQueue);
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
 * The various built-in Storage Schema Types.
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
Schema.Types = require('./schema/index');

// Хранилище схем
Schema.schemas = schemas = {};


/*!
 * ignore
 */

Types = Schema.Types;
var ObjectId = Schema.ObjectId = Types.ObjectId;

},{"./events":11,"./schema/index":21,"./utils":34,"./virtualtype":35}],16:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var SchemaType = require('../schematype')
  , CastError = SchemaType.CastError
  , Types = {
        Boolean: require('./boolean')
      , Date: require('./date')
      , Number: require('./number')
      , String: require('./string')
      , ObjectId: require('./objectid')
      , Buffer: require('./buffer')
    }
  , StorageArray = require('../types/array')
  , Mixed = require('./mixed')
  , utils = require('../utils')
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

    if ('Object' === utils.getFunctionName( cast.constructor ) ) {
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
      : utils.getFunctionName( cast );

    var caster = name in Types
      ? Types[name]
      : cast;

    this.casterConstructor = caster;
    this.caster = new caster(null, castOptions);

    // lazy load
    EmbeddedDoc || (EmbeddedDoc = require('../types/embedded'));

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
SchemaArray.prototype = Object.create( SchemaType.prototype );
SchemaArray.prototype.constructor = SchemaArray;

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
    if (!(value.isStorageArray)) {
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

},{"../schematype":26,"../types/array":28,"../types/embedded":31,"../utils":34,"./boolean":17,"./buffer":18,"./date":19,"./mixed":22,"./number":23,"./objectid":24,"./string":25}],17:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var SchemaType = require('../schematype');

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
BooleanSchema.prototype = Object.create( SchemaType.prototype );
BooleanSchema.prototype.constructor = BooleanSchema;

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

},{"../schematype":26}],18:[function(require,module,exports){
(function (Buffer){
'use strict';

/*!
 * Module dependencies.
 */

var SchemaType = require('../schematype')
  , CastError = SchemaType.CastError
  , StorageBuffer = require('../types').Buffer
  , Binary = StorageBuffer.Binary
  , utils = require('../utils')
  , Document;

/**
 * Buffer SchemaType constructor
 *
 * @param {String} key
 * @param {SchemaType} cast
 * @inherits SchemaType
 * @api private
 */

function SchemaBuffer (key, options) {
  SchemaType.call(this, key, options, 'Buffer');
}

/*!
 * Inherits from SchemaType.
 */
SchemaBuffer.prototype = Object.create( SchemaType.prototype );
SchemaBuffer.prototype.constructor = SchemaBuffer;

/**
 * Check required
 *
 * @api private
 */

SchemaBuffer.prototype.checkRequired = function (value, doc) {
  if (SchemaType._isRef(this, value, doc, true)) {
    return null != value;
  } else {
    return !!(value && value.length);
  }
};

/**
 * Casts contents
 *
 * @param {Object} value
 * @param {Document} doc document that triggers the casting
 * @param {Boolean} init
 * @api private
 */

SchemaBuffer.prototype.cast = function (value, doc, init) {
  if (SchemaType._isRef(this, value, doc, init)) {
    // wait! we may need to cast this to a document

    if (null == value) {
      return value;
    }

    // lazy load
    Document || (Document = require('./../document'));

    if (value instanceof Document) {
      value.$__.wasPopulated = true;
      return value;
    }

    // setting a populated path
    if (Buffer.isBuffer(value)) {
      return value;
    } else if (!_.isObject(value)) {
      throw new CastError('buffer', value, this.path);
    }

    // Handle the case where user directly sets a populated
    // path to a plain object; cast to the Model used in
    // the population query.
    var path = doc.$__fullPath(this.path);
    var owner = doc.ownerDocument ? doc.ownerDocument() : doc;
    var pop = owner.populated(path, true);
    var ret = new pop.options.model(value);
    ret.$__.wasPopulated = true;
    return ret;
  }

  // documents
  if (value && value._id) {
    value = value._id;
  }

  if (Buffer.isBuffer(value)) {
    if (!value || !value.isStorageBuffer) {
      value = new StorageBuffer(value, [this.path, doc]);
    }

    return value;
  } else if (value instanceof Binary) {
    var ret = new StorageBuffer(value.value(true), [this.path, doc]);
    ret.subtype(value.sub_type);
    // do not override Binary subtypes. users set this
    // to whatever they want.
    return ret;
  }

  if (null === value) return value;

  var type = typeof value;
  if ('string' == type || 'number' == type || Array.isArray(value)) {
    var ret = new StorageBuffer(value, [this.path, doc]);
    return ret;
  }

  throw new CastError('buffer', value, this.path);
};

/*!
 * Module exports.
 */

module.exports = SchemaBuffer;

}).call(this,require("buffer").Buffer)
},{"../schematype":26,"../types":32,"../utils":34,"./../document":4,"buffer":36}],19:[function(require,module,exports){
'use strict';

/*!
 * Module requirements.
 */

var SchemaType = require('../schematype');
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
DateSchema.prototype = Object.create( SchemaType.prototype );
DateSchema.prototype.constructor = DateSchema;

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

},{"../schematype":26}],20:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var SchemaType = require('../schematype')
  , ArrayType = require('./array')
  , StorageDocumentArray = require('../types/documentarray')
  , Subdocument = require('../types/embedded')
  , Document = require('../document')
  , oid = require('../types/objectid')
  , utils = require('../utils');

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

  EmbeddedDocument.prototype = Object.create( Subdocument.prototype );
  EmbeddedDocument.prototype.constructor = EmbeddedDocument;
  EmbeddedDocument.prototype.$__setSchema( schema );

  // apply methods
  for (var i in schema.methods) {
    EmbeddedDocument.prototype[i] = schema.methods[i];
  }

  // apply statics
  for (var j in schema.statics) {
    EmbeddedDocument[j] = schema.statics[j];
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
DocumentArray.prototype = Object.create( ArrayType.prototype );
DocumentArray.prototype.constructor = DocumentArray;

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

      !(function (i) {
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
 * @param {*} value
 * @param {Document} doc that triggers the casting
 * @param {Boolean} init flag
 * @param {DocumentArray} prev
 * @api private
 */
DocumentArray.prototype.cast = function (value, doc, init, prev) {
  var selected
    , subdoc
    , i;

  if (!Array.isArray(value)) {
    return this.cast([value], doc, init, prev);
  }

  // Если два массива примерно одинаковые - не надо перезаписывать
  if ( prev && approximatelyEqual( value, prev ) ){
    return prev;
  }

  if (!(value.isStorageDocumentArray)) {
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

          restorePopulatedFields( subdoc, this.schema.tree, value[i], prev );
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
 * Приблизительное сравнение двух массивов
 *
 * Это нужно для populated полей - их мы преобразовываем в id.
 * Так же в сравнении не участвует id существующих Embedded документов,
 * Если на сервере _id: false, а на клиенте по умолчанию есть _id.
 *
 * @param value
 * @param prev
 * @returns {*}
 */
function approximatelyEqual ( value, prev ) {
  prev = prev.toObject({depopulate: 1});

  // Не сравнивать по subdoc _id
  var i = value.length;
  if ( i === prev.length ){
    _.forEach( value, function( subdoc, i ){
      if ( !subdoc._id ){
        delete prev[ i ]._id
      }
    });
  }

  return utils.deepEqual( value, prev );
}

/*!
 * Restore population
 *
 * @param {*} subdoc
 * @param {Object} schemaTree
 * @param {*} value
 * @param {DocumentArray} prev
 */
function restorePopulatedFields ( subdoc, schemaTree, value, prev ) {
  var props;
  _.forEach( schemaTree, function( prop, key ){
    var curVal;

    if ( prop.ref ){
      props = {};
      curVal = value[ key ];

      if ( curVal && oid.isValid( curVal ) ){

        _.forEach( prev, function( prevDoc ){
          var prevDocProp = prevDoc[ key ];

          if ( prevDocProp instanceof Document ){
            if ( prevDocProp._id.equals( curVal ) ){
              subdoc[ key ] = prevDocProp;
            }
          }
        });
      }
    }
  });
}

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

},{"../document":4,"../schematype":26,"../types/documentarray":30,"../types/embedded":31,"../types/objectid":33,"../utils":34,"./array":16}],21:[function(require,module,exports){
'use strict';

/*!
 * Module exports.
 */

exports.String = require('./string');

exports.Number = require('./number');

exports.Boolean = require('./boolean');

exports.DocumentArray = require('./documentarray');

exports.Array = require('./array');

exports.Buffer = require('./buffer');

exports.Date = require('./date');

exports.ObjectId = require('./objectid');

exports.Mixed = require('./mixed');

// alias

exports.Oid = exports.ObjectId;
exports.Object = exports.Mixed;
exports.Bool = exports.Boolean;

},{"./array":16,"./boolean":17,"./buffer":18,"./date":19,"./documentarray":20,"./mixed":22,"./number":23,"./objectid":24,"./string":25}],22:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var SchemaType = require('../schematype');

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
Mixed.prototype = Object.create( SchemaType.prototype );
Mixed.prototype.constructor = Mixed;

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
Mixed.prototype.cast = function (value) {
  return value;
};

/*!
 * Module exports.
 */

module.exports = Mixed;

},{"../schematype":26}],23:[function(require,module,exports){
'use strict';

/*!
 * Module requirements.
 */

var SchemaType = require('../schematype')
  , CastError = SchemaType.CastError
  , errorMessages = require('../error').messages;

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
NumberSchema.prototype = Object.create( SchemaType.prototype );
NumberSchema.prototype.constructor = NumberSchema;

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
 * @see Customized Error Messages #error_messages_StorageError-messages
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
 * @see Customized Error Messages #error_messages_StorageError-messages
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
    if (val instanceof Number) return val;
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

},{"../error":5,"../schematype":26}],24:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var SchemaType = require('../schematype')
  , CastError = SchemaType.CastError
  , oid = require('../types/objectid')
  , utils = require('../utils')
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
ObjectId.prototype = Object.create( SchemaType.prototype );
ObjectId.prototype.constructor = ObjectId;

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
 * @param {ObjectId|String} value
 * @param {Document} doc
 * @param {Boolean} init
 * @param {ObjectId|Document} priorVal
 * @api private
 */
ObjectId.prototype.cast = function ( value, doc, init, priorVal ) {
  // lazy load
  Document || (Document = require('./../document'));

  if ( SchemaType._isRef( this, value ) ) {
    // wait! we may need to cast this to a document

    if (null == value) {
      return value;
    }

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

    if ( !storage.schemas[ schema ] ){
      throw new TypeError('При ссылке (ref) на документ ' +
        'нужно указывать название схемы на которую ссылаемся при её создании ( new Schema("name", schemaObject) )');
    }

    // init doc
    doc = new Document( value, undefined, storage.schemas[ schema ], undefined, true );
    doc.$__.wasPopulated = true;

    return doc;
  }

  if (value === null) return value;

  // Предотвратить depopulate
  if ( priorVal instanceof Document ){
    if ( priorVal._id && priorVal._id.equals( value ) ){
      return priorVal;
    }
  }

  if (value instanceof oid)
    return value;

  if ( value._id && value._id instanceof oid )
    return value._id;

  if (value.toString) {
    try {
      return oid.createFromHexString(value.toString());
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

},{"../schematype":26,"../types/objectid":33,"../utils":34,"./../document":4}],25:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var SchemaType = require('../schematype')
  , CastError = SchemaType.CastError
  , errorMessages = require('../error').messages;

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
StringSchema.prototype = Object.create( SchemaType.prototype );
StringSchema.prototype.constructor = StringSchema;

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
 * @see Customized Error Messages #error_messages_StorageError-messages
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
 * @see Customized Error Messages #error_messages_StorageError-messages
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

},{"../error":5,"../schematype":26}],26:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var error = require('./error')
  , utils = require('./utils');

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
 * You can set up email lower case normalization easily via a Storage setter.
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
 * The error message argument is optional. If not passed, the [default generic error message template](#error_messages_StorageError-messages) will be used.
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
 * From the examples above, you may have noticed that error messages support baseic templating. There are a few other template keywords besides `{PATH}` and `{VALUE}` too. To find out more, details are available [here](#error_messages_StorageError-messages)
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
 * @param {String} [message] optional error message
 * @return {SchemaType} this
 * @api public
 */
SchemaType.prototype.validate = function (obj, message, type) {
  if ('function' == typeof obj || obj && 'RegExp' === utils.getFunctionName( obj.constructor )) {
    if (!message) message = errorMessages.general.default;
    if (!type) type = 'user defined';
    this.validators.push([obj, message, type]);
    return this;
  }

  var i = arguments.length
    , arg;

  while (i--) {
    arg = arguments[i];
    if (!(arg && 'Object' == utils.getFunctionName( arg.constructor ) )) {
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
 * @see Customized Error Messages #error_messages_StorageError-messages
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
 * @param {*} value
 * @param {Object} scope
 * @param {Boolean} init
 * @param {*} priorVal
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
 * @param {*} value
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

},{"./error":5,"./utils":34}],27:[function(require,module,exports){
'use strict';

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

  ctor.prototype = Object.create( StateMachine.prototype );
  ctor.prototype.constructor = ctor;

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


},{}],28:[function(require,module,exports){
'use strict';

//TODO: почистить код

/*!
 * Module dependencies.
 */

var EmbeddedDocument = require('./embedded');
var Document = require('../document');
var ObjectId = require('./objectid');
var utils = require('../utils');

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
 */
function StorageArray (values, path, doc) {
  var arr = [];
  arr.push.apply(arr, values);
  _.mixin( arr, StorageArray.mixin );

  arr.validators = [];
  arr._path = path;
  arr.isStorageArray = true;

  if (doc) {
    arr._parent = doc;
    arr._schema = doc.schema.path(path);
  }

  return arr;
}

StorageArray.mixin = {
  /**
   * Parent owner document
   *
   * @property _parent
   * @api private
   */
  _parent: undefined,

  /**
   * Casts a member based on this arrays schema.
   *
   * @param {*} value
   * @return value the casted value
   * @api private
   */
  _cast: function ( value ) {
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
  },

  /**
   * Marks this array as modified.
   *
   * If it bubbles up from an embedded document change, then it takes the following arguments (otherwise, takes 0 arguments)
   *
   * @param {EmbeddedDocument} embeddedDoc the embedded doc that invoked this method on the Array
   * @param {String} embeddedPath the path which changed in the embeddedDoc
   * @api private
   */
  _markModified: function (elem, embeddedPath) {
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
  },

  /**
   * Wraps [`Array#push`](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/push) with proper change tracking.
   *
   * @param {Object} [args...]
   * @api public
   */
  push: function () {
    var values = [].map.call(arguments, this._cast, this)
      , ret = [].push.apply(this, values);

    this._markModified();
    return ret;
  },

  /**
   * Wraps [`Array#pop`](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/pop) with proper change tracking.
   *
   * ####Note:
   *
   * _marks the entire array as modified which will pass the entire thing to $set potentially overwritting any changes that happen between when you retrieved the object and when you save it._
   *
   * @see StorageArray#$pop #types_array_StorageArray-%24pop
   * @api public
   */
  pop: function () {
    var ret = [].pop.call(this);

    this._markModified();
    return ret;
  },

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
  shift: function () {
    var ret = [].shift.call(this);

    this._markModified();
    return ret;
  },

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
   * Or we may passing the _id directly and let storage take care of it.
   *
   *     doc.subdocs.push({ _id: 4815162342 })
   *     doc.subdocs.pull(4815162342); // works
   *
   * @param {*} arguments
   * @see mongodb http://www.mongodb.org/display/DOCS/Updating/#Updating-%24pull
   * @api public
   */
  pull: function () {
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
  },

  /**
   * Wraps [`Array#splice`](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/splice) with proper change tracking and casting.
   *
   * ####Note:
   *
   * _marks the entire array as modified, which if saved, will store it as a `$set` operation, potentially overwritting any changes that happen between when you retrieved the object and when you save it._
   *
   * @api public
   */
  splice: function splice () {
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
  },

  /**
   * Wraps [`Array#unshift`](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/unshift) with proper change tracking.
   *
   * ####Note:
   *
   * _marks the entire array as modified, which if saved, will store it as a `$set` operation, potentially overwritting any changes that happen between when you retrieved the object and when you save it._
   *
   * @api public
   */
  unshift: function () {
    var values = [].map.call(arguments, this._cast, this);
    [].unshift.apply(this, values);

    this._markModified();
    return this.length;
  },

  /**
   * Wraps [`Array#sort`](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/sort) with proper change tracking.
   *
   * ####NOTE:
   *
   * _marks the entire array as modified, which if saved, will store it as a `$set` operation, potentially overwritting any changes that happen between when you retrieved the object and when you save it._
   *
   * @api public
   */
  sort: function () {
    var ret = [].sort.apply(this, arguments);

    this._markModified();
    return ret;
  },

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
   * @param {*} arguments
   * @return {Array} the values that were added
   * @api public
   */
  addToSet: function addToSet () {
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
  },

  /**
   * Sets the casted `val` at index `i` and marks the array modified.
   *
   * ####Example:
   *
   *     // given documents based on the following
   *     var docs = storage.createCollection('Doc', new Schema({ array: [Number] }));
   *
   *     var doc = docs.add({ array: [2,3,4] })
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
  set: function (i, val) {
    this[i] = this._cast(val);
    this._markModified(i);
    return this;
  },

  /**
   * Returns a native js Array.
   *
   * @param {Object} options
   * @return {Array}
   * @api public
   */
  toObject: function (options) {
    if (options && options.depopulate) {
      return this.map(function (doc) {
        return doc instanceof Document
          ? doc.toObject(options)
          : doc
      });
    }

    return this.slice();
  },

  /**
   * Return the index of `obj` or `-1` if not found.
   *
   * @param {Object} obj the item to look for
   * @return {Number}
   * @api public
   */
  indexOf: function indexOf (obj) {
    if (obj instanceof ObjectId) obj = obj.toString();
    for (var i = 0, len = this.length; i < len; ++i) {
      if (obj == this[i])
        return i;
    }
    return -1;
  }
};

/**
 * Alias of [pull](#types_array_StorageArray-pull)
 *
 * @see StorageArray#pull #types_array_StorageArray-pull
 * @see mongodb http://www.mongodb.org/display/DOCS/Updating/#Updating-%24pull
 * @api public
 * @memberOf StorageArray
 * @method remove
 */
StorageArray.mixin.remove = StorageArray.mixin.pull;

/*!
 * Module exports.
 */

module.exports = StorageArray;

},{"../document":4,"../utils":34,"./embedded":31,"./objectid":33}],29:[function(require,module,exports){
(function (Buffer){
'use strict';

/*!
 * Module dependencies.
 */

var Binary = require('../binary');
var utils = require('../utils');

/**
 * Storage Buffer constructor.
 *
 * Values always have to be passed to the constructor to initialize.
 *
 * @param {Buffer} value
 * @param {String} encode
 * @param {Number} offset
 * @api private
 * @inherits Buffer
 */

function StorageBuffer (value, encode, offset) {
  var length = arguments.length;
  var val;

  if (0 === length || null === arguments[0] || undefined === arguments[0]) {
    val = 0;
  } else {
    val = value;
  }

  var encoding;
  var path;
  var doc;

  if (Array.isArray(encode)) {
    // internal casting
    path = encode[0];
    doc = encode[1];
  } else {
    encoding = encode;
  }

  var buf = new Buffer(val, encoding, offset);
  _.mixin( buf, StorageBuffer.mixin );
  buf.isStorageBuffer = true;

  // make sure these internal props don't show up in Object.keys()
  Object.defineProperties(buf, {
      validators: { value: [] }
    , _path: { value: path }
    , _parent: { value: doc }
  });

  if (doc && "string" === typeof path) {
    Object.defineProperty(buf, '_schema', {
        value: doc.schema.path(path)
    });
  }

  buf._subtype = 0;
  return buf;
}

/*!
 * Inherit from Buffer.
 */

//StorageBuffer.prototype = new Buffer(0);

StorageBuffer.mixin = {

  /**
   * Parent owner document
   *
   * @api private
   * @property _parent
   */

  _parent: undefined,

  /**
   * Default subtype for the Binary representing this Buffer
   *
   * @api private
   * @property _subtype
   */

  _subtype: undefined,

  /**
   * Marks this buffer as modified.
   *
   * @api private
   */

  _markModified: function () {
    var parent = this._parent;

    if (parent) {
      parent.markModified(this._path);
    }
    return this;
  },

  /**
   * Writes the buffer.
   */

  write: function () {
    var written = Buffer.prototype.write.apply(this, arguments);

    if (written > 0) {
      this._markModified();
    }

    return written;
  },

  /**
   * Copies the buffer.
   *
   * ####Note:
   *
   * `Buffer#copy` does not mark `target` as modified so you must copy from a `StorageBuffer` for it to work as expected. This is a work around since `copy` modifies the target, not this.
   *
   * @return {StorageBuffer}
   * @param {Buffer} target
   */

  copy: function (target) {
    var ret = Buffer.prototype.copy.apply(this, arguments);

    if (target && target.isStorageBuffer) {
      target._markModified();
    }

    return ret;
  }
};

/*!
 * Compile other Buffer methods marking this buffer as modified.
 */

;(
// node < 0.5
'writeUInt8 writeUInt16 writeUInt32 writeInt8 writeInt16 writeInt32 ' +
'writeFloat writeDouble fill ' +
'utf8Write binaryWrite asciiWrite set ' +

// node >= 0.5
'writeUInt16LE writeUInt16BE writeUInt32LE writeUInt32BE ' +
'writeInt16LE writeInt16BE writeInt32LE writeInt32BE ' +
'writeFloatLE writeFloatBE writeDoubleLE writeDoubleBE'
).split(' ').forEach(function (method) {
  if (!Buffer.prototype[method]) return;
    StorageBuffer.mixin[method] = new Function(
    'var ret = Buffer.prototype.'+method+'.apply(this, arguments);' +
    'this._markModified();' +
    'return ret;'
  )
});

/**
 * Converts this buffer to its Binary type representation.
 *
 * ####SubTypes:
 *
 *   var bson = require('bson')
 *   bson.BSON_BINARY_SUBTYPE_DEFAULT
 *   bson.BSON_BINARY_SUBTYPE_FUNCTION
 *   bson.BSON_BINARY_SUBTYPE_BYTE_ARRAY
 *   bson.BSON_BINARY_SUBTYPE_UUID
 *   bson.BSON_BINARY_SUBTYPE_MD5
 *   bson.BSON_BINARY_SUBTYPE_USER_DEFINED
 *
 *   doc.buffer.toObject(bson.BSON_BINARY_SUBTYPE_USER_DEFINED);
 *
 * @see http://bsonspec.org/#/specification
 * @param {Hex} [subtype]
 * @return {Binary}
 * @api public
 */

StorageBuffer.mixin.toObject = function (options) {
  var subtype = 'number' == typeof options
    ? options
    : (this._subtype || 0);
  return new Binary(this, subtype);
};

/**
 * Determines if this buffer is equals to `other` buffer
 *
 * @param {Buffer} other
 * @return {Boolean}
 */

StorageBuffer.mixin.equals = function (other) {
  if (!Buffer.isBuffer(other)) {
    return false;
  }

  if (this.length !== other.length) {
    return false;
  }

  for (var i = 0; i < this.length; ++i) {
    if (this[i] !== other[i]) return false;
  }

  return true;
};

/**
 * Sets the subtype option and marks the buffer modified.
 *
 * ####SubTypes:
 *
 *   var bson = require('bson')
 *   bson.BSON_BINARY_SUBTYPE_DEFAULT
 *   bson.BSON_BINARY_SUBTYPE_FUNCTION
 *   bson.BSON_BINARY_SUBTYPE_BYTE_ARRAY
 *   bson.BSON_BINARY_SUBTYPE_UUID
 *   bson.BSON_BINARY_SUBTYPE_MD5
 *   bson.BSON_BINARY_SUBTYPE_USER_DEFINED
 *
 *   doc.buffer.subtype(bson.BSON_BINARY_SUBTYPE_UUID);
 *
 * @see http://bsonspec.org/#/specification
 * @param {Hex} subtype
 * @api public
 */

StorageBuffer.mixin.subtype = function (subtype) {
  if ('number' != typeof subtype) {
    throw new TypeError('Invalid subtype. Expected a number');
  }

  if (this._subtype != subtype) {
    this._markModified();
  }

  this._subtype = subtype;
};

/*!
 * Module exports.
 */

StorageBuffer.Binary = Binary;

module.exports = StorageBuffer;

}).call(this,require("buffer").Buffer)
},{"../binary":1,"../utils":34,"buffer":36}],30:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var StorageArray = require('./array')
  , ObjectId = require('./objectid')
  , ObjectIdSchema = require('../schema/objectid')
  , utils = require('../utils')
  , Document = require('../document');

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
  _.mixin( arr, StorageDocumentArray.mixin );

  arr.validators = [];
  arr._path = path;
  arr.isStorageArray = true;
  arr.isStorageDocumentArray = true;

  if (doc) {
    arr._parent = doc;
    arr._schema = doc.schema.path(path);
    arr._handlers = {
      isNew: arr.notify('isNew'),
      save: arr.notify('save')
    };

    // Проброс изменения состояния в поддокумент
    doc.on('save', arr._handlers.save);
    doc.on('isNew', arr._handlers.isNew);
  }

  return arr;
}

/*!
 * Inherits from StorageArray
 */
StorageDocumentArray.mixin = Object.create( StorageArray.mixin );

/**
 * Overrides StorageArray#cast
 *
 * @api private
 */
StorageDocumentArray.mixin._cast = function (value) {
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
StorageDocumentArray.mixin.id = function (id) {
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

StorageDocumentArray.mixin.toObject = function (options) {
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

StorageDocumentArray.mixin.create = function (obj) {
  return new this._schema.casterConstructor(obj);
};

/**
 * Creates a fn that notifies all child docs of `event`.
 *
 * @param {String} event
 * @return {Function}
 * @api private
 */
StorageDocumentArray.mixin.notify = function notify (event) {
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

},{"../document":4,"../schema/objectid":24,"../utils":34,"./array":28,"./objectid":33}],31:[function(require,module,exports){
'use strict';

/*!
 * Module dependencies.
 */

var Document = require('../document');

/**
 * EmbeddedDocument constructor.
 *
 * @param {Object} data js object returned from the db
 * @param {StorageDocumentArray} parentArr the parent array of this document
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
EmbeddedDocument.prototype = Object.create( Document.prototype );
EmbeddedDocument.prototype.constructor = EmbeddedDocument;

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
      throw new Error('For your own good, Storage does not know ' +
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

},{"../document":4}],32:[function(require,module,exports){
'use strict';

/*!
 * Module exports.
 */

exports.Array = require('./array');
exports.Buffer = require('./buffer');

exports.Embedded = require('./embedded');

exports.DocumentArray = require('./documentarray');
exports.ObjectId = require('./objectid');

},{"./array":28,"./buffer":29,"./documentarray":30,"./embedded":31,"./objectid":33}],33:[function(require,module,exports){
(function (process){
'use strict';

/**
 * Module dependencies.
 * @ignore
 */
var BinaryParser = require('../binaryparser').BinaryParser;

/**
 * Machine id.
 *
 * Create a random 3-byte value (i.e. unique for this
 * process). Other drivers use a md5 of the machine id here, but
 * that would mean an asyc call to gethostname, so we don't bother.
 * @ignore
 */
var MACHINE_ID = parseInt(Math.random() * 0xFFFFFF, 10);

// Regular expression that checks for hex value
var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$");

/**
 * Create a new ObjectId instance
 *
 * @see https://github.com/mongodb/js-bson/blob/master/lib/bson/objectid.js
 * @class Represents a BSON ObjectId type.
 * @param {(string|number)} id Can be a 24 byte hex string, 12 byte binary string or a Number.
 * @property {number} generationTime The generation time of this ObjectId instance
 * @return {ObjectId} instance of ObjectId.
 */
function ObjectId(id) {
  if(!(this instanceof ObjectId)) return new ObjectId(id);
  if((id instanceof ObjectId)) return id;

  this._bsontype = 'ObjectId';
  var valid = ObjectId.isValid(id);

  // Throw an error if it's not a valid setup
  if(!valid && id != null){
    throw new Error("Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");
  } else if(valid && typeof id == 'string' && id.length == 24) {
    return ObjectId.createFromHexString(id);
  } else if(id == null || typeof id == 'number') {
    // convert to 12 byte binary string
    this.id = this.generate(id);
  } else if(id != null && id.length === 12) {
    // assume 12 byte string
    this.id = id;
  }

  if(ObjectId.cacheHexString) this.__id = this.toHexString();
}

// Precomputed hex table enables speedy hex string conversion
var hexTable = [];
for (var i = 0; i < 256; i++) {
  hexTable[i] = (i <= 15 ? '0' : '') + i.toString(16);
}

/**
 * Return the ObjectId id as a 24 byte hex string representation
 *
 * @method
 * @return {string} return the 24 byte hex string representation.
 */
ObjectId.prototype.toHexString = function() {
  if(ObjectId.cacheHexString && this.__id) return this.__id;

  var hexString = '';

  for (var i = 0; i < this.id.length; i++) {
    hexString += hexTable[this.id.charCodeAt(i)];
  }

  if(ObjectId.cacheHexString) this.__id = hexString;
  return hexString;
};

/**
 * Update the ObjectId index used in generating new ObjectId's on the driver
 *
 * @method
 * @return {number} returns next index value.
 * @ignore
 */
ObjectId.prototype.get_inc = function() {
  return ObjectId.index = (ObjectId.index + 1) % 0xFFFFFF;
};

/**
 * Update the ObjectId index used in generating new ObjectId's on the driver
 *
 * @method
 * @return {number} returns next index value.
 * @ignore
 */
ObjectId.prototype.getInc = function() {
  return this.get_inc();
};

/**
 * Generate a 12 byte id string used in ObjectId's
 *
 * @method
 * @param {number} [time] optional parameter allowing to pass in a second based timestamp.
 * @return {string} return the 12 byte id binary string.
 */
ObjectId.prototype.generate = function(time) {
  if ('number' != typeof time) {
    time = parseInt(Date.now()/1000,10);
  }

  var time4Bytes = BinaryParser.encodeInt(time, 32, true, true);
  /* for time-based ObjectId the bytes following the time will be zeroed */
  var machine3Bytes = BinaryParser.encodeInt(MACHINE_ID, 24, false);
  var pid2Bytes = BinaryParser.fromShort(typeof process === 'undefined' ? Math.floor(Math.random() * 100000) : process.pid);
  var index3Bytes = BinaryParser.encodeInt(this.get_inc(), 24, false, true);

  return time4Bytes + machine3Bytes + pid2Bytes + index3Bytes;
};

/**
 * Converts the id into a 24 byte hex string for printing
 *
 * @return {String} return the 24 byte hex string representation.
 * @ignore
 */
ObjectId.prototype.toString = function() {
  return this.toHexString();
};

/**
 * Converts to its JSON representation.
 *
 * @return {String} return the 24 byte hex string representation.
 * @ignore
 */
ObjectId.prototype.toJSON = function() {
  return this.toHexString();
};

/**
 * Compares the equality of this ObjectId with `otherID`.
 *
 * @method
 * @param {object} otherID ObjectId instance to compare against.
 * @return {boolean} the result of comparing two ObjectId's
 */
ObjectId.prototype.equals = function equals (otherID) {
  if(otherID == null) return false;
  var id = (otherID instanceof ObjectId || otherID.toHexString)
    ? otherID.id
    : ObjectId.createFromHexString(otherID).id;

  return this.id === id;
};

/**
 * Returns the generation date (accurate up to the second) that this ID was generated.
 *
 * @method
 * @return {date} the generation date
 */
ObjectId.prototype.getTimestamp = function() {
  var timestamp = new Date();
  timestamp.setTime(Math.floor(BinaryParser.decodeInt(this.id.substring(0,4), 32, true, true)) * 1000);
  return timestamp;
};

/**
 * @ignore
 */
ObjectId.index = parseInt(Math.random() * 0xFFFFFF, 10);

/**
 * @ignore
 */
ObjectId.createPk = function createPk () {
  return new ObjectId();
};

/**
 * Creates an ObjectId from a second based number, with the rest of the ObjectId zeroed out. Used for comparisons or sorting the ObjectId.
 *
 * @method
 * @param {number} time an integer number representing a number of seconds.
 * @return {ObjectId} return the created ObjectId
 */
ObjectId.createFromTime = function createFromTime (time) {
  var id = BinaryParser.encodeInt(time, 32, true, true) +
    BinaryParser.encodeInt(0, 64, true, true);
  return new ObjectId(id);
};

/**
 * Creates an ObjectId from a hex string representation of an ObjectId.
 *
 * @method
 * @param {string} hexString create a ObjectId from a passed in 24 byte hexstring.
 * @return {ObjectId} return the created ObjectId
 */
ObjectId.createFromHexString = function createFromHexString (hexString) {
  // Throw an error if it's not a valid setup
  if(typeof hexString === 'undefined' || hexString != null && hexString.length != 24)
    throw new Error("Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");

  var len = hexString.length;

  if(len > 12*2) {
    throw new Error('Id cannot be longer than 12 bytes');
  }

  var result = ''
    , string
    , number;

  for (var index = 0; index < len; index += 2) {
    string = hexString.substr(index, 2);
    number = parseInt(string, 16);
    result += BinaryParser.fromByte(number);
  }

  return new ObjectId(result, hexString);
};

/**
 * Checks if a value is a valid bson ObjectId
 *
 * @method
 * @return {boolean} return true if the value is a valid bson ObjectId, return false otherwise.
 */
ObjectId.isValid = function isValid(id) {
  if(id == null) return false;

  if(id != null && 'number' != typeof id && (id.length != 12 && id.length != 24)) {
    return false;
  } else {
    // Check specifically for hex correctness
    if(typeof id == 'string' && id.length == 24) return checkForHexRegExp.test(id);
    return true;
  }
};

/*!
 * @ignore
 */
Object.defineProperty(ObjectId.prototype, "generationTime", {
  enumerable: true
  , get: function () {
    return Math.floor(BinaryParser.decodeInt(this.id.substring(0,4), 32, true, true));
  }
  , set: function (value) {
    var value = BinaryParser.encodeInt(value, 32, true, true);
    this.id = value + this.id.substr(4);
    // delete this.__id;
    this.toHexString();
  }
});

/**
 * Expose.
 */
module.exports = ObjectId;
module.exports.ObjectId = ObjectId;
}).call(this,require('_process'))
},{"../binaryparser":2,"_process":40}],34:[function(require,module,exports){
(function (process,global,Buffer){
'use strict';

/*!
 * Module dependencies.
 */

var ObjectId = require('./types/objectid')
  , mpath = require('./mpath')
  , StorageArray
  , Document;

exports.mpath = mpath;

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
};

/*!
 * Determines if `a` and `b` are deep equal.
 *
 * Modified from node/lib/assert.js
 * Modified from mongoose/utils.js
 *
 * @param {*} a a value to compare to `b`
 * @param {*} b a value to compare to `a`
 * @return {Boolean}
 * @api private
 */
exports.deepEqual = function deepEqual (a, b) {
  if (a instanceof ObjectId && b instanceof ObjectId) {
    return a.toString() === b.toString();
  }

  // Handle StorageNumbers
  if (a instanceof Number && b instanceof Number) {
    return a.valueOf() === b.valueOf();
  }

  if (Buffer.isBuffer(a)) {
    return a.equals(b);
  }

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
    switch ( getFunctionName( obj.constructor )) {
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
    if ( options.depopulate ){
      return obj.toString();
    }

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
 * @param {*} v
 * @api private
 */
exports.isStorageObject = function ( v ) {
  Document || (Document = require('./document'));
  //StorageArray || (StorageArray = require('./types/array'));

  return v instanceof Document ||
       ( v && v.isStorageArray );
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

var rFunctionName = /^function\s*([^\s(]+)/;

function getFunctionName( ctor ){
  if (ctor.name) {
    return ctor.name;
  }
  return (ctor.toString().trim().match( rFunctionName ) || [])[1];
}

exports.getFunctionName = getFunctionName;

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

// PhantomJS doesn't support bind yet
if (!Function.prototype.bind) {
  Function.prototype.bind = function(oThis) {
    if (typeof this !== 'function') {
      // ближайший аналог внутренней функции
      // IsCallable в ECMAScript 5
      throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
    }

    var aArgs = Array.prototype.slice.call(arguments, 1),
      fToBind = this,
      fNOP    = function() {},
      fBound  = function() {
        return fToBind.apply(this instanceof fNOP && oThis
            ? this
            : oThis,
          aArgs.concat(Array.prototype.slice.call(arguments)));
      };

    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();

    return fBound;
  };
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"./document":4,"./mpath":14,"./types/objectid":33,"_process":40,"buffer":36}],35:[function(require,module,exports){
'use strict';

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
 * @return {*} the value after applying all getters
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
 * @return {*} the value after applying all setters
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

},{}],36:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (this.length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if(!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  if (end < start) throw new TypeError('sourceEnd < sourceStart')
  if (target_start < 0 || target_start >= target.length)
    throw new TypeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new TypeError('sourceStart out of bounds')
  if (end < 0 || end > source.length) throw new TypeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new TypeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new TypeError('start out of bounds')
  if (end < 0 || end > this.length) throw new TypeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":37,"ieee754":38,"is-array":39}],37:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],38:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],39:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],40:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canMutationObserver = typeof window !== 'undefined'
    && window.MutationObserver;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    var queue = [];

    if (canMutationObserver) {
        var hiddenDiv = document.createElement("div");
        var observer = new MutationObserver(function () {
            var queueList = queue.slice();
            queue.length = 0;
            queueList.forEach(function (fn) {
                fn();
            });
        });

        observer.observe(hiddenDiv, { attributes: true });

        return function nextTick(fn) {
            if (!queue.length) {
                hiddenDiv.setAttribute('yes', 'no');
            }
            queue.push(fn);
        };
    }

    if (canPost) {
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
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],41:[function(require,module,exports){
module.exports={
  "name": "storage.js",
  "version": "0.0.1",
  "description": "storage.js",
  "author": "Constantine Melnikov <ka.melnikov@gmail.com>",
  "maintainers": "Constantine Melnikov <ka.melnikov@gmail.com>",
  "repository": {
    "type": "git",
    "url": "https://github.com/archangel-irk/storage.git"
  },
  "scripts": {
    "test": "grunt test"
  },
  "devDependencies": {
    "grunt": "latest",
    "grunt-contrib-jshint": "latest",
    "grunt-contrib-uglify": "latest",
    "grunt-contrib-watch": "latest",
    "grunt-browserify": "latest",
    "grunt-karma": "latest",
    "grunt-karma-coveralls": "latest",
    "karma": "latest",
    "karma-coverage": "latest",
    "karma-mocha": "latest",
    "karma-chai": "latest",
    "karma-phantomjs-launcher": "latest",
    "karma-chrome-launcher": "latest",
    "karma-firefox-launcher": "latest",
    "karma-ie-launcher": "latest",
    "karma-safari-launcher": "latest",
    "karma-sauce-launcher": "latest",
    "time-grunt": "latest",
    "browserify": "latest",
    "dox": "latest",
    "highlight.js": "latest",
    "jade": "latest"
  }
}
},{}]},{},[12])(12)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvYmluYXJ5LmpzIiwibGliL2JpbmFyeXBhcnNlci5qcyIsImxpYi9jb2xsZWN0aW9uLmpzIiwibGliL2RvY3VtZW50LmpzIiwibGliL2Vycm9yLmpzIiwibGliL2Vycm9yL2Nhc3QuanMiLCJsaWIvZXJyb3IvbWVzc2FnZXMuanMiLCJsaWIvZXJyb3IvbWlzc2luZ1NjaGVtYS5qcyIsImxpYi9lcnJvci92YWxpZGF0aW9uLmpzIiwibGliL2Vycm9yL3ZhbGlkYXRvci5qcyIsImxpYi9ldmVudHMuanMiLCJsaWIvaW5kZXguanMiLCJsaWIvaW50ZXJuYWwuanMiLCJsaWIvbXBhdGguanMiLCJsaWIvc2NoZW1hLmpzIiwibGliL3NjaGVtYS9hcnJheS5qcyIsImxpYi9zY2hlbWEvYm9vbGVhbi5qcyIsImxpYi9zY2hlbWEvYnVmZmVyLmpzIiwibGliL3NjaGVtYS9kYXRlLmpzIiwibGliL3NjaGVtYS9kb2N1bWVudGFycmF5LmpzIiwibGliL3NjaGVtYS9pbmRleC5qcyIsImxpYi9zY2hlbWEvbWl4ZWQuanMiLCJsaWIvc2NoZW1hL251bWJlci5qcyIsImxpYi9zY2hlbWEvb2JqZWN0aWQuanMiLCJsaWIvc2NoZW1hL3N0cmluZy5qcyIsImxpYi9zY2hlbWF0eXBlLmpzIiwibGliL3N0YXRlbWFjaGluZS5qcyIsImxpYi90eXBlcy9hcnJheS5qcyIsImxpYi90eXBlcy9idWZmZXIuanMiLCJsaWIvdHlwZXMvZG9jdW1lbnRhcnJheS5qcyIsImxpYi90eXBlcy9lbWJlZGRlZC5qcyIsImxpYi90eXBlcy9pbmRleC5qcyIsImxpYi90eXBlcy9vYmplY3RpZC5qcyIsImxpYi91dGlscy5qcyIsImxpYi92aXJ0dWFsdHlwZS5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZ3J1bnQtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZ3J1bnQtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pcy1hcnJheS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJwYWNrYWdlLmpzb24iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5ekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeE5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMveUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0akJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMWhDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uIChCdWZmZXIpe1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEEgY2xhc3MgcmVwcmVzZW50YXRpb24gb2YgdGhlIEJTT04gQmluYXJ5IHR5cGUuXG4gKlxuICogU3ViIHR5cGVzXG4gKiAgLSAqKkJTT04uQlNPTl9CSU5BUllfU1VCVFlQRV9ERUZBVUxUKiosIGRlZmF1bHQgQlNPTiB0eXBlLlxuICogIC0gKipCU09OLkJTT05fQklOQVJZX1NVQlRZUEVfRlVOQ1RJT04qKiwgQlNPTiBmdW5jdGlvbiB0eXBlLlxuICogIC0gKipCU09OLkJTT05fQklOQVJZX1NVQlRZUEVfQllURV9BUlJBWSoqLCBCU09OIGJ5dGUgYXJyYXkgdHlwZS5cbiAqICAtICoqQlNPTi5CU09OX0JJTkFSWV9TVUJUWVBFX1VVSUQqKiwgQlNPTiB1dWlkIHR5cGUuXG4gKiAgLSAqKkJTT04uQlNPTl9CSU5BUllfU1VCVFlQRV9NRDUqKiwgQlNPTiBtZDUgdHlwZS5cbiAqICAtICoqQlNPTi5CU09OX0JJTkFSWV9TVUJUWVBFX1VTRVJfREVGSU5FRCoqLCBCU09OIHVzZXIgZGVmaW5lZCB0eXBlLlxuICpcbiAqIEBjbGFzcyBSZXByZXNlbnRzIHRoZSBCaW5hcnkgQlNPTiB0eXBlLlxuICogQHBhcmFtIHtCdWZmZXJ9IGJ1ZmZlciBhIGJ1ZmZlciBvYmplY3QgY29udGFpbmluZyB0aGUgYmluYXJ5IGRhdGEuXG4gKiBAcGFyYW0ge051bWJlcn0gW3N1YlR5cGVdIHRoZSBvcHRpb24gYmluYXJ5IHR5cGUuXG4gKiBAcmV0dXJuIHtHcmlkfVxuICovXG5mdW5jdGlvbiBCaW5hcnkoYnVmZmVyLCBzdWJUeXBlKSB7XG4gIGlmKCEodGhpcyBpbnN0YW5jZW9mIEJpbmFyeSkpIHJldHVybiBuZXcgQmluYXJ5KGJ1ZmZlciwgc3ViVHlwZSk7XG5cbiAgdGhpcy5fYnNvbnR5cGUgPSAnQmluYXJ5JztcblxuICBpZihidWZmZXIgaW5zdGFuY2VvZiBOdW1iZXIpIHtcbiAgICB0aGlzLnN1Yl90eXBlID0gYnVmZmVyO1xuICAgIHRoaXMucG9zaXRpb24gPSAwO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuc3ViX3R5cGUgPSBzdWJUeXBlID09IG51bGwgPyBCU09OX0JJTkFSWV9TVUJUWVBFX0RFRkFVTFQgOiBzdWJUeXBlO1xuICAgIHRoaXMucG9zaXRpb24gPSAwO1xuICB9XG5cbiAgaWYoYnVmZmVyICE9IG51bGwgJiYgIShidWZmZXIgaW5zdGFuY2VvZiBOdW1iZXIpKSB7XG4gICAgLy8gT25seSBhY2NlcHQgQnVmZmVyLCBVaW50OEFycmF5IG9yIEFycmF5c1xuICAgIGlmKHR5cGVvZiBidWZmZXIgPT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIERpZmZlcmVudCB3YXlzIG9mIHdyaXRpbmcgdGhlIGxlbmd0aCBvZiB0aGUgc3RyaW5nIGZvciB0aGUgZGlmZmVyZW50IHR5cGVzXG4gICAgICBpZih0eXBlb2YgQnVmZmVyICE9ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHRoaXMuYnVmZmVyID0gbmV3IEJ1ZmZlcihidWZmZXIpO1xuICAgICAgfSBlbHNlIGlmKHR5cGVvZiBVaW50OEFycmF5ICE9ICd1bmRlZmluZWQnIHx8IChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYnVmZmVyKSA9PSAnW29iamVjdCBBcnJheV0nKSkge1xuICAgICAgICB0aGlzLmJ1ZmZlciA9IHdyaXRlU3RyaW5nVG9BcnJheShidWZmZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwib25seSBTdHJpbmcsIEJ1ZmZlciwgVWludDhBcnJheSBvciBBcnJheSBhY2NlcHRlZFwiKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5idWZmZXIgPSBidWZmZXI7XG4gICAgfVxuICAgIHRoaXMucG9zaXRpb24gPSBidWZmZXIubGVuZ3RoO1xuICB9IGVsc2Uge1xuICAgIGlmKHR5cGVvZiBCdWZmZXIgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMuYnVmZmVyID0gIG5ldyBCdWZmZXIoQmluYXJ5LkJVRkZFUl9TSVpFKTtcbiAgICB9IGVsc2UgaWYodHlwZW9mIFVpbnQ4QXJyYXkgIT0gJ3VuZGVmaW5lZCcpe1xuICAgICAgdGhpcy5idWZmZXIgPSBuZXcgVWludDhBcnJheShuZXcgQXJyYXlCdWZmZXIoQmluYXJ5LkJVRkZFUl9TSVpFKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYnVmZmVyID0gbmV3IEFycmF5KEJpbmFyeS5CVUZGRVJfU0laRSk7XG4gICAgfVxuICAgIC8vIFNldCBwb3NpdGlvbiB0byBzdGFydCBvZiBidWZmZXJcbiAgICB0aGlzLnBvc2l0aW9uID0gMDtcbiAgfVxufVxuXG4vKipcbiAqIFVwZGF0ZXMgdGhpcyBiaW5hcnkgd2l0aCBieXRlX3ZhbHVlLlxuICpcbiAqIEBwYXJhbSB7Q2hhcmFjdGVyfSBieXRlX3ZhbHVlIGEgc2luZ2xlIGJ5dGUgd2Ugd2lzaCB0byB3cml0ZS5cbiAqIEBhcGkgcHVibGljXG4gKi9cbkJpbmFyeS5wcm90b3R5cGUucHV0ID0gZnVuY3Rpb24gcHV0KGJ5dGVfdmFsdWUpIHtcbiAgLy8gSWYgaXQncyBhIHN0cmluZyBhbmQgYSBoYXMgbW9yZSB0aGFuIG9uZSBjaGFyYWN0ZXIgdGhyb3cgYW4gZXJyb3JcbiAgaWYoYnl0ZV92YWx1ZVsnbGVuZ3RoJ10gIT0gbnVsbCAmJiB0eXBlb2YgYnl0ZV92YWx1ZSAhPSAnbnVtYmVyJyAmJiBieXRlX3ZhbHVlLmxlbmd0aCAhPSAxKSB0aHJvdyBuZXcgRXJyb3IoXCJvbmx5IGFjY2VwdHMgc2luZ2xlIGNoYXJhY3RlciBTdHJpbmcsIFVpbnQ4QXJyYXkgb3IgQXJyYXlcIik7XG4gIGlmKHR5cGVvZiBieXRlX3ZhbHVlICE9ICdudW1iZXInICYmIGJ5dGVfdmFsdWUgPCAwIHx8IGJ5dGVfdmFsdWUgPiAyNTUpIHRocm93IG5ldyBFcnJvcihcIm9ubHkgYWNjZXB0cyBudW1iZXIgaW4gYSB2YWxpZCB1bnNpZ25lZCBieXRlIHJhbmdlIDAtMjU1XCIpO1xuXG4gIC8vIERlY29kZSB0aGUgYnl0ZSB2YWx1ZSBvbmNlXG4gIHZhciBkZWNvZGVkX2J5dGUgPSBudWxsO1xuICBpZih0eXBlb2YgYnl0ZV92YWx1ZSA9PSAnc3RyaW5nJykge1xuICAgIGRlY29kZWRfYnl0ZSA9IGJ5dGVfdmFsdWUuY2hhckNvZGVBdCgwKTtcbiAgfSBlbHNlIGlmKGJ5dGVfdmFsdWVbJ2xlbmd0aCddICE9IG51bGwpIHtcbiAgICBkZWNvZGVkX2J5dGUgPSBieXRlX3ZhbHVlWzBdO1xuICB9IGVsc2Uge1xuICAgIGRlY29kZWRfYnl0ZSA9IGJ5dGVfdmFsdWU7XG4gIH1cblxuICBpZih0aGlzLmJ1ZmZlci5sZW5ndGggPiB0aGlzLnBvc2l0aW9uKSB7XG4gICAgdGhpcy5idWZmZXJbdGhpcy5wb3NpdGlvbisrXSA9IGRlY29kZWRfYnl0ZTtcbiAgfSBlbHNlIHtcbiAgICBpZih0eXBlb2YgQnVmZmVyICE9ICd1bmRlZmluZWQnICYmIEJ1ZmZlci5pc0J1ZmZlcih0aGlzLmJ1ZmZlcikpIHtcbiAgICAgIC8vIENyZWF0ZSBhZGRpdGlvbmFsIG92ZXJmbG93IGJ1ZmZlclxuICAgICAgdmFyIGJ1ZmZlciA9IG5ldyBCdWZmZXIoQmluYXJ5LkJVRkZFUl9TSVpFICsgdGhpcy5idWZmZXIubGVuZ3RoKTtcbiAgICAgIC8vIENvbWJpbmUgdGhlIHR3byBidWZmZXJzIHRvZ2V0aGVyXG4gICAgICB0aGlzLmJ1ZmZlci5jb3B5KGJ1ZmZlciwgMCwgMCwgdGhpcy5idWZmZXIubGVuZ3RoKTtcbiAgICAgIHRoaXMuYnVmZmVyID0gYnVmZmVyO1xuICAgICAgdGhpcy5idWZmZXJbdGhpcy5wb3NpdGlvbisrXSA9IGRlY29kZWRfYnl0ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZmZlciA9IG51bGw7XG4gICAgICAvLyBDcmVhdGUgYSBuZXcgYnVmZmVyICh0eXBlZCBvciBub3JtYWwgYXJyYXkpXG4gICAgICBpZihPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodGhpcy5idWZmZXIpID09ICdbb2JqZWN0IFVpbnQ4QXJyYXldJykge1xuICAgICAgICBidWZmZXIgPSBuZXcgVWludDhBcnJheShuZXcgQXJyYXlCdWZmZXIoQmluYXJ5LkJVRkZFUl9TSVpFICsgdGhpcy5idWZmZXIubGVuZ3RoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBidWZmZXIgPSBuZXcgQXJyYXkoQmluYXJ5LkJVRkZFUl9TSVpFICsgdGhpcy5idWZmZXIubGVuZ3RoKTtcbiAgICAgIH1cblxuICAgICAgLy8gV2UgbmVlZCB0byBjb3B5IGFsbCB0aGUgY29udGVudCB0byB0aGUgbmV3IGFycmF5XG4gICAgICBmb3IodmFyIGkgPSAwOyBpIDwgdGhpcy5idWZmZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYnVmZmVyW2ldID0gdGhpcy5idWZmZXJbaV07XG4gICAgICB9XG5cbiAgICAgIC8vIFJlYXNzaWduIHRoZSBidWZmZXJcbiAgICAgIHRoaXMuYnVmZmVyID0gYnVmZmVyO1xuICAgICAgLy8gV3JpdGUgdGhlIGJ5dGVcbiAgICAgIHRoaXMuYnVmZmVyW3RoaXMucG9zaXRpb24rK10gPSBkZWNvZGVkX2J5dGU7XG4gICAgfVxuICB9XG59O1xuXG4vKipcbiAqIFdyaXRlcyBhIGJ1ZmZlciBvciBzdHJpbmcgdG8gdGhlIGJpbmFyeS5cbiAqXG4gKiBAcGFyYW0ge0J1ZmZlcnxTdHJpbmd9IHN0cmluZyBhIHN0cmluZyBvciBidWZmZXIgdG8gYmUgd3JpdHRlbiB0byB0aGUgQmluYXJ5IEJTT04gb2JqZWN0LlxuICogQHBhcmFtIHtOdW1iZXJ9IG9mZnNldCBzcGVjaWZ5IHRoZSBiaW5hcnkgb2Ygd2hlcmUgdG8gd3JpdGUgdGhlIGNvbnRlbnQuXG4gKiBAYXBpIHB1YmxpY1xuICovXG5CaW5hcnkucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gd3JpdGUoc3RyaW5nLCBvZmZzZXQpIHtcbiAgb2Zmc2V0ID0gdHlwZW9mIG9mZnNldCA9PSAnbnVtYmVyJyA/IG9mZnNldCA6IHRoaXMucG9zaXRpb247XG5cbiAgLy8gSWYgdGhlIGJ1ZmZlciBpcyB0byBzbWFsbCBsZXQncyBleHRlbmQgdGhlIGJ1ZmZlclxuICBpZih0aGlzLmJ1ZmZlci5sZW5ndGggPCBvZmZzZXQgKyBzdHJpbmcubGVuZ3RoKSB7XG4gICAgdmFyIGJ1ZmZlciA9IG51bGw7XG4gICAgLy8gSWYgd2UgYXJlIGluIG5vZGUuanNcbiAgICBpZih0eXBlb2YgQnVmZmVyICE9ICd1bmRlZmluZWQnICYmIEJ1ZmZlci5pc0J1ZmZlcih0aGlzLmJ1ZmZlcikpIHtcbiAgICAgIGJ1ZmZlciA9IG5ldyBCdWZmZXIodGhpcy5idWZmZXIubGVuZ3RoICsgc3RyaW5nLmxlbmd0aCk7XG4gICAgICB0aGlzLmJ1ZmZlci5jb3B5KGJ1ZmZlciwgMCwgMCwgdGhpcy5idWZmZXIubGVuZ3RoKTtcbiAgICB9IGVsc2UgaWYoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHRoaXMuYnVmZmVyKSA9PSAnW29iamVjdCBVaW50OEFycmF5XScpIHtcbiAgICAgIC8vIENyZWF0ZSBhIG5ldyBidWZmZXJcbiAgICAgIGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KG5ldyBBcnJheUJ1ZmZlcih0aGlzLmJ1ZmZlci5sZW5ndGggKyBzdHJpbmcubGVuZ3RoKSlcbiAgICAgIC8vIENvcHkgdGhlIGNvbnRlbnRcbiAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCB0aGlzLnBvc2l0aW9uOyBpKyspIHtcbiAgICAgICAgYnVmZmVyW2ldID0gdGhpcy5idWZmZXJbaV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQXNzaWduIHRoZSBuZXcgYnVmZmVyXG4gICAgdGhpcy5idWZmZXIgPSBidWZmZXI7XG4gIH1cblxuICBpZih0eXBlb2YgQnVmZmVyICE9ICd1bmRlZmluZWQnICYmIEJ1ZmZlci5pc0J1ZmZlcihzdHJpbmcpICYmIEJ1ZmZlci5pc0J1ZmZlcih0aGlzLmJ1ZmZlcikpIHtcbiAgICBzdHJpbmcuY29weSh0aGlzLmJ1ZmZlciwgb2Zmc2V0LCAwLCBzdHJpbmcubGVuZ3RoKTtcbiAgICB0aGlzLnBvc2l0aW9uID0gKG9mZnNldCArIHN0cmluZy5sZW5ndGgpID4gdGhpcy5wb3NpdGlvbiA/IChvZmZzZXQgKyBzdHJpbmcubGVuZ3RoKSA6IHRoaXMucG9zaXRpb247XG4gICAgLy8gb2Zmc2V0ID0gc3RyaW5nLmxlbmd0aFxuICB9IGVsc2UgaWYodHlwZW9mIEJ1ZmZlciAhPSAndW5kZWZpbmVkJyAmJiB0eXBlb2Ygc3RyaW5nID09ICdzdHJpbmcnICYmIEJ1ZmZlci5pc0J1ZmZlcih0aGlzLmJ1ZmZlcikpIHtcbiAgICB0aGlzLmJ1ZmZlci53cml0ZShzdHJpbmcsICdiaW5hcnknLCBvZmZzZXQpO1xuICAgIHRoaXMucG9zaXRpb24gPSAob2Zmc2V0ICsgc3RyaW5nLmxlbmd0aCkgPiB0aGlzLnBvc2l0aW9uID8gKG9mZnNldCArIHN0cmluZy5sZW5ndGgpIDogdGhpcy5wb3NpdGlvbjtcbiAgICAvLyBvZmZzZXQgPSBzdHJpbmcubGVuZ3RoO1xuICB9IGVsc2UgaWYoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHN0cmluZykgPT0gJ1tvYmplY3QgVWludDhBcnJheV0nXG4gICAgfHwgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHN0cmluZykgPT0gJ1tvYmplY3QgQXJyYXldJyAmJiB0eXBlb2Ygc3RyaW5nICE9ICdzdHJpbmcnKSB7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IHN0cmluZy5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5idWZmZXJbb2Zmc2V0KytdID0gc3RyaW5nW2ldO1xuICAgIH1cblxuICAgIHRoaXMucG9zaXRpb24gPSBvZmZzZXQgPiB0aGlzLnBvc2l0aW9uID8gb2Zmc2V0IDogdGhpcy5wb3NpdGlvbjtcbiAgfSBlbHNlIGlmKHR5cGVvZiBzdHJpbmcgPT0gJ3N0cmluZycpIHtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgc3RyaW5nLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLmJ1ZmZlcltvZmZzZXQrK10gPSBzdHJpbmcuY2hhckNvZGVBdChpKTtcbiAgICB9XG5cbiAgICB0aGlzLnBvc2l0aW9uID0gb2Zmc2V0ID4gdGhpcy5wb3NpdGlvbiA/IG9mZnNldCA6IHRoaXMucG9zaXRpb247XG4gIH1cbn07XG5cbi8qKlxuICogUmVhZHMgKipsZW5ndGgqKiBieXRlcyBzdGFydGluZyBhdCAqKnBvc2l0aW9uKiouXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIHJlYWQgZnJvbSB0aGUgZ2l2ZW4gcG9zaXRpb24gaW4gdGhlIEJpbmFyeS5cbiAqIEBwYXJhbSB7TnVtYmVyfSBsZW5ndGggdGhlIG51bWJlciBvZiBieXRlcyB0byByZWFkLlxuICogQHJldHVybiB7QnVmZmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuQmluYXJ5LnByb3RvdHlwZS5yZWFkID0gZnVuY3Rpb24gcmVhZChwb3NpdGlvbiwgbGVuZ3RoKSB7XG4gIGxlbmd0aCA9IGxlbmd0aCAmJiBsZW5ndGggPiAwXG4gICAgPyBsZW5ndGhcbiAgICA6IHRoaXMucG9zaXRpb247XG5cbiAgLy8gTGV0J3MgcmV0dXJuIHRoZSBkYXRhIGJhc2VkIG9uIHRoZSB0eXBlIHdlIGhhdmVcbiAgaWYodGhpcy5idWZmZXJbJ3NsaWNlJ10pIHtcbiAgICByZXR1cm4gdGhpcy5idWZmZXIuc2xpY2UocG9zaXRpb24sIHBvc2l0aW9uICsgbGVuZ3RoKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBDcmVhdGUgYSBidWZmZXIgdG8ga2VlcCB0aGUgcmVzdWx0XG4gICAgdmFyIGJ1ZmZlciA9IHR5cGVvZiBVaW50OEFycmF5ICE9ICd1bmRlZmluZWQnID8gbmV3IFVpbnQ4QXJyYXkobmV3IEFycmF5QnVmZmVyKGxlbmd0aCkpIDogbmV3IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZmZXJbaV0gPSB0aGlzLmJ1ZmZlcltwb3NpdGlvbisrXTtcbiAgICB9XG4gIH1cbiAgLy8gUmV0dXJuIHRoZSBidWZmZXJcbiAgcmV0dXJuIGJ1ZmZlcjtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgdmFsdWUgb2YgdGhpcyBiaW5hcnkgYXMgYSBzdHJpbmcuXG4gKlxuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuQmluYXJ5LnByb3RvdHlwZS52YWx1ZSA9IGZ1bmN0aW9uIHZhbHVlKGFzUmF3KSB7XG4gIGFzUmF3ID0gYXNSYXcgPT0gbnVsbCA/IGZhbHNlIDogYXNSYXc7XG5cbiAgLy8gT3B0aW1pemUgdG8gc2VyaWFsaXplIGZvciB0aGUgc2l0dWF0aW9uIHdoZXJlIHRoZSBkYXRhID09IHNpemUgb2YgYnVmZmVyXG4gIGlmKGFzUmF3ICYmIHR5cGVvZiBCdWZmZXIgIT0gJ3VuZGVmaW5lZCcgJiYgQnVmZmVyLmlzQnVmZmVyKHRoaXMuYnVmZmVyKSAmJiB0aGlzLmJ1ZmZlci5sZW5ndGggPT0gdGhpcy5wb3NpdGlvbilcbiAgICByZXR1cm4gdGhpcy5idWZmZXI7XG5cbiAgLy8gSWYgaXQncyBhIG5vZGUuanMgYnVmZmVyIG9iamVjdFxuICBpZih0eXBlb2YgQnVmZmVyICE9ICd1bmRlZmluZWQnICYmIEJ1ZmZlci5pc0J1ZmZlcih0aGlzLmJ1ZmZlcikpIHtcbiAgICByZXR1cm4gYXNSYXcgPyB0aGlzLmJ1ZmZlci5zbGljZSgwLCB0aGlzLnBvc2l0aW9uKSA6IHRoaXMuYnVmZmVyLnRvU3RyaW5nKCdiaW5hcnknLCAwLCB0aGlzLnBvc2l0aW9uKTtcbiAgfSBlbHNlIHtcbiAgICBpZihhc1Jhdykge1xuICAgICAgLy8gd2Ugc3VwcG9ydCB0aGUgc2xpY2UgY29tbWFuZCB1c2UgaXRcbiAgICAgIGlmKHRoaXMuYnVmZmVyWydzbGljZSddICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYnVmZmVyLnNsaWNlKDAsIHRoaXMucG9zaXRpb24pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IGJ1ZmZlciB0byBjb3B5IGNvbnRlbnQgdG9cbiAgICAgICAgdmFyIG5ld0J1ZmZlciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh0aGlzLmJ1ZmZlcikgPT0gJ1tvYmplY3QgVWludDhBcnJheV0nID8gbmV3IFVpbnQ4QXJyYXkobmV3IEFycmF5QnVmZmVyKHRoaXMucG9zaXRpb24pKSA6IG5ldyBBcnJheSh0aGlzLnBvc2l0aW9uKTtcbiAgICAgICAgLy8gQ29weSBjb250ZW50XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCB0aGlzLnBvc2l0aW9uOyBpKyspIHtcbiAgICAgICAgICBuZXdCdWZmZXJbaV0gPSB0aGlzLmJ1ZmZlcltpXTtcbiAgICAgICAgfVxuICAgICAgICAvLyBSZXR1cm4gdGhlIGJ1ZmZlclxuICAgICAgICByZXR1cm4gbmV3QnVmZmVyO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY29udmVydEFycmF5dG9VdGY4QmluYXJ5U3RyaW5nKHRoaXMuYnVmZmVyLCAwLCB0aGlzLnBvc2l0aW9uKTtcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogTGVuZ3RoLlxuICpcbiAqIEByZXR1cm4ge051bWJlcn0gdGhlIGxlbmd0aCBvZiB0aGUgYmluYXJ5LlxuICogQGFwaSBwdWJsaWNcbiAqL1xuQmluYXJ5LnByb3RvdHlwZS5sZW5ndGggPSBmdW5jdGlvbiBsZW5ndGgoKSB7XG4gIHJldHVybiB0aGlzLnBvc2l0aW9uO1xufTtcblxuLyoqXG4gKiBAaWdub3JlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuQmluYXJ5LnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuYnVmZmVyICE9IG51bGwgPyB0aGlzLmJ1ZmZlci50b1N0cmluZygnYmFzZTY0JykgOiAnJztcbn07XG5cbi8qKlxuICogQGlnbm9yZVxuICogQGFwaSBwcml2YXRlXG4gKi9cbkJpbmFyeS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbihmb3JtYXQpIHtcbiAgcmV0dXJuIHRoaXMuYnVmZmVyICE9IG51bGwgPyB0aGlzLmJ1ZmZlci5zbGljZSgwLCB0aGlzLnBvc2l0aW9uKS50b1N0cmluZyhmb3JtYXQpIDogJyc7XG59O1xuXG4vLyBCaW5hcnkgZGVmYXVsdCBzdWJ0eXBlXG52YXIgQlNPTl9CSU5BUllfU1VCVFlQRV9ERUZBVUxUID0gMDtcblxuLyoqXG4gKiBAaWdub3JlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xudmFyIHdyaXRlU3RyaW5nVG9BcnJheSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgLy8gQ3JlYXRlIGEgYnVmZmVyXG4gIHZhciBidWZmZXIgPSB0eXBlb2YgVWludDhBcnJheSAhPSAndW5kZWZpbmVkJyA/IG5ldyBVaW50OEFycmF5KG5ldyBBcnJheUJ1ZmZlcihkYXRhLmxlbmd0aCkpIDogbmV3IEFycmF5KGRhdGEubGVuZ3RoKTtcbiAgLy8gV3JpdGUgdGhlIGNvbnRlbnQgdG8gdGhlIGJ1ZmZlclxuICBmb3IodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgIGJ1ZmZlcltpXSA9IGRhdGEuY2hhckNvZGVBdChpKTtcbiAgfVxuICAvLyBXcml0ZSB0aGUgc3RyaW5nIHRvIHRoZSBidWZmZXJcbiAgcmV0dXJuIGJ1ZmZlcjtcbn07XG5cbi8qKlxuICogQ29udmVydCBBcnJheSBvdCBVaW50OEFycmF5IHRvIEJpbmFyeSBTdHJpbmdcbiAqXG4gKiBAaWdub3JlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xudmFyIGNvbnZlcnRBcnJheXRvVXRmOEJpbmFyeVN0cmluZyA9IGZ1bmN0aW9uKGJ5dGVBcnJheSwgc3RhcnRJbmRleCwgZW5kSW5kZXgpIHtcbiAgdmFyIHJlc3VsdCA9IFwiXCI7XG4gIGZvcih2YXIgaSA9IHN0YXJ0SW5kZXg7IGkgPCBlbmRJbmRleDsgaSsrKSB7XG4gICAgcmVzdWx0ID0gcmVzdWx0ICsgU3RyaW5nLmZyb21DaGFyQ29kZShieXRlQXJyYXlbaV0pO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG5CaW5hcnkuQlVGRkVSX1NJWkUgPSAyNTY7XG5cbi8qKlxuICogRGVmYXVsdCBCU09OIHR5cGVcbiAqXG4gKiBAY2xhc3Njb25zdGFudCBTVUJUWVBFX0RFRkFVTFRcbiAqKi9cbkJpbmFyeS5TVUJUWVBFX0RFRkFVTFQgPSAwO1xuLyoqXG4gKiBGdW5jdGlvbiBCU09OIHR5cGVcbiAqXG4gKiBAY2xhc3Njb25zdGFudCBTVUJUWVBFX0RFRkFVTFRcbiAqKi9cbkJpbmFyeS5TVUJUWVBFX0ZVTkNUSU9OID0gMTtcbi8qKlxuICogQnl0ZSBBcnJheSBCU09OIHR5cGVcbiAqXG4gKiBAY2xhc3Njb25zdGFudCBTVUJUWVBFX0RFRkFVTFRcbiAqKi9cbkJpbmFyeS5TVUJUWVBFX0JZVEVfQVJSQVkgPSAyO1xuLyoqXG4gKiBPTEQgVVVJRCBCU09OIHR5cGVcbiAqXG4gKiBAY2xhc3Njb25zdGFudCBTVUJUWVBFX0RFRkFVTFRcbiAqKi9cbkJpbmFyeS5TVUJUWVBFX1VVSURfT0xEID0gMztcbi8qKlxuICogVVVJRCBCU09OIHR5cGVcbiAqXG4gKiBAY2xhc3Njb25zdGFudCBTVUJUWVBFX0RFRkFVTFRcbiAqKi9cbkJpbmFyeS5TVUJUWVBFX1VVSUQgPSA0O1xuLyoqXG4gKiBNRDUgQlNPTiB0eXBlXG4gKlxuICogQGNsYXNzY29uc3RhbnQgU1VCVFlQRV9ERUZBVUxUXG4gKiovXG5CaW5hcnkuU1VCVFlQRV9NRDUgPSA1O1xuLyoqXG4gKiBVc2VyIEJTT04gdHlwZVxuICpcbiAqIEBjbGFzc2NvbnN0YW50IFNVQlRZUEVfREVGQVVMVFxuICoqL1xuQmluYXJ5LlNVQlRZUEVfVVNFUl9ERUZJTkVEID0gMTI4O1xuXG4vKipcbiAqIEV4cG9zZS5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBCaW5hcnk7XG5tb2R1bGUuZXhwb3J0cy5CaW5hcnkgPSBCaW5hcnk7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXIpIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEJpbmFyeSBQYXJzZXIuXG4gKiBKb25hcyBSYW9uaSBTb2FyZXMgU2lsdmFcbiAqIGh0dHA6Ly9qc2Zyb21oZWxsLmNvbS9jbGFzc2VzL2JpbmFyeS1wYXJzZXIgW3YxLjBdXG4gKlxuICogQHNlZSBodHRwczovL2dpdGh1Yi5jb20vbW9uZ29kYi9qcy1ic29uL2Jsb2IvbWFzdGVyL2xpYi9ic29uL2JpbmFyeV9wYXJzZXIuanNcbiAqL1xudmFyIGNociA9IFN0cmluZy5mcm9tQ2hhckNvZGU7XG5cbnZhciBtYXhCaXRzID0gW107XG5mb3IgKHZhciBpID0gMDsgaSA8IDY0OyBpKyspIHtcblx0bWF4Qml0c1tpXSA9IE1hdGgucG93KDIsIGkpO1xufVxuXG5mdW5jdGlvbiBCaW5hcnlQYXJzZXIgKGJpZ0VuZGlhbiwgYWxsb3dFeGNlcHRpb25zKSB7XG4gIGlmKCEodGhpcyBpbnN0YW5jZW9mIEJpbmFyeVBhcnNlcikpIHJldHVybiBuZXcgQmluYXJ5UGFyc2VyKGJpZ0VuZGlhbiwgYWxsb3dFeGNlcHRpb25zKTtcbiAgXG5cdHRoaXMuYmlnRW5kaWFuID0gYmlnRW5kaWFuO1xuXHR0aGlzLmFsbG93RXhjZXB0aW9ucyA9IGFsbG93RXhjZXB0aW9ucztcbn1cblxuQmluYXJ5UGFyc2VyLndhcm4gPSBmdW5jdGlvbiB3YXJuIChtc2cpIHtcblx0aWYgKHRoaXMuYWxsb3dFeGNlcHRpb25zKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gIH1cblxuXHRyZXR1cm4gMTtcbn07XG5cbkJpbmFyeVBhcnNlci5kZWNvZGVJbnQgPSBmdW5jdGlvbiBkZWNvZGVJbnQgKGRhdGEsIGJpdHMsIHNpZ25lZCwgZm9yY2VCaWdFbmRpYW4pIHtcbiAgdmFyIGIgPSBuZXcgdGhpcy5CdWZmZXIodGhpcy5iaWdFbmRpYW4gfHwgZm9yY2VCaWdFbmRpYW4sIGRhdGEpXG4gICAgICAsIHggPSBiLnJlYWRCaXRzKDAsIGJpdHMpXG4gICAgICAsIG1heCA9IG1heEJpdHNbYml0c107IC8vbWF4ID0gTWF0aC5wb3coIDIsIGJpdHMgKTtcbiAgXG4gIHJldHVybiBzaWduZWQgJiYgeCA+PSBtYXggLyAyXG4gICAgICA/IHggLSBtYXhcbiAgICAgIDogeDtcbn07XG5cbkJpbmFyeVBhcnNlci5lbmNvZGVJbnQgPSBmdW5jdGlvbiBlbmNvZGVJbnQgKGRhdGEsIGJpdHMsIHNpZ25lZCwgZm9yY2VCaWdFbmRpYW4pIHtcblx0dmFyIG1heCA9IG1heEJpdHNbYml0c107XG5cbiAgaWYgKGRhdGEgPj0gbWF4IHx8IGRhdGEgPCAtKG1heCAvIDIpKSB7XG4gICAgdGhpcy53YXJuKFwiZW5jb2RlSW50OjpvdmVyZmxvd1wiKTtcbiAgICBkYXRhID0gMDtcbiAgfVxuXG5cdGlmIChkYXRhIDwgMCkge1xuICAgIGRhdGEgKz0gbWF4O1xuICB9XG5cblx0Zm9yICh2YXIgciA9IFtdOyBkYXRhOyByW3IubGVuZ3RoXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUoZGF0YSAlIDI1NiksIGRhdGEgPSBNYXRoLmZsb29yKGRhdGEgLyAyNTYpKTtcblxuXHRmb3IgKGJpdHMgPSAtKC1iaXRzID4+IDMpIC0gci5sZW5ndGg7IGJpdHMtLTsgcltyLmxlbmd0aF0gPSBcIlxcMFwiKTtcblxuICByZXR1cm4gKCh0aGlzLmJpZ0VuZGlhbiB8fCBmb3JjZUJpZ0VuZGlhbikgPyByLnJldmVyc2UoKSA6IHIpLmpvaW4oXCJcIik7XG59O1xuXG5CaW5hcnlQYXJzZXIudG9TbWFsbCAgICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmRlY29kZUludCggZGF0YSwgIDgsIHRydWUgICk7IH07XG5CaW5hcnlQYXJzZXIuZnJvbVNtYWxsICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmVuY29kZUludCggZGF0YSwgIDgsIHRydWUgICk7IH07XG5CaW5hcnlQYXJzZXIudG9CeXRlICAgICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmRlY29kZUludCggZGF0YSwgIDgsIGZhbHNlICk7IH07XG5CaW5hcnlQYXJzZXIuZnJvbUJ5dGUgICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmVuY29kZUludCggZGF0YSwgIDgsIGZhbHNlICk7IH07XG5CaW5hcnlQYXJzZXIudG9TaG9ydCAgICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmRlY29kZUludCggZGF0YSwgMTYsIHRydWUgICk7IH07XG5CaW5hcnlQYXJzZXIuZnJvbVNob3J0ICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmVuY29kZUludCggZGF0YSwgMTYsIHRydWUgICk7IH07XG5CaW5hcnlQYXJzZXIudG9Xb3JkICAgICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmRlY29kZUludCggZGF0YSwgMTYsIGZhbHNlICk7IH07XG5CaW5hcnlQYXJzZXIuZnJvbVdvcmQgICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmVuY29kZUludCggZGF0YSwgMTYsIGZhbHNlICk7IH07XG5CaW5hcnlQYXJzZXIudG9JbnQgICAgICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmRlY29kZUludCggZGF0YSwgMzIsIHRydWUgICk7IH07XG5CaW5hcnlQYXJzZXIuZnJvbUludCAgICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmVuY29kZUludCggZGF0YSwgMzIsIHRydWUgICk7IH07XG5CaW5hcnlQYXJzZXIudG9Mb25nICAgICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmRlY29kZUludCggZGF0YSwgNjQsIHRydWUgICk7IH07XG5CaW5hcnlQYXJzZXIuZnJvbUxvbmcgICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmVuY29kZUludCggZGF0YSwgNjQsIHRydWUgICk7IH07XG5CaW5hcnlQYXJzZXIudG9EV29yZCAgICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmRlY29kZUludCggZGF0YSwgMzIsIGZhbHNlICk7IH07XG5CaW5hcnlQYXJzZXIuZnJvbURXb3JkICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmVuY29kZUludCggZGF0YSwgMzIsIGZhbHNlICk7IH07XG5CaW5hcnlQYXJzZXIudG9RV29yZCAgICA9IGZ1bmN0aW9uKCBkYXRhICl7IHJldHVybiB0aGlzLmRlY29kZUludCggZGF0YSwgNjQsIHRydWUgKTsgfTtcbkJpbmFyeVBhcnNlci5mcm9tUVdvcmQgID0gZnVuY3Rpb24oIGRhdGEgKXsgcmV0dXJuIHRoaXMuZW5jb2RlSW50KCBkYXRhLCA2NCwgdHJ1ZSApOyB9O1xuXG4vKipcbiAqIEJpbmFyeVBhcnNlciBidWZmZXIgY29uc3RydWN0b3IuXG4gKi9cbmZ1bmN0aW9uIEJpbmFyeVBhcnNlckJ1ZmZlciAoYmlnRW5kaWFuLCBidWZmZXIpIHtcbiAgdGhpcy5iaWdFbmRpYW4gPSBiaWdFbmRpYW4gfHwgMDtcbiAgdGhpcy5idWZmZXIgPSBbXTtcbiAgdGhpcy5zZXRCdWZmZXIoYnVmZmVyKTtcbn1cblxuQmluYXJ5UGFyc2VyQnVmZmVyLnByb3RvdHlwZS5zZXRCdWZmZXIgPSBmdW5jdGlvbiBzZXRCdWZmZXIgKGRhdGEpIHtcbiAgdmFyIGwsIGksIGI7XG5cblx0aWYgKGRhdGEpIHtcbiAgICBpID0gbCA9IGRhdGEubGVuZ3RoO1xuICAgIGIgPSB0aGlzLmJ1ZmZlciA9IG5ldyBBcnJheShsKTtcblx0XHRmb3IgKDsgaTsgYltsIC0gaV0gPSBkYXRhLmNoYXJDb2RlQXQoLS1pKSk7XG5cdFx0dGhpcy5iaWdFbmRpYW4gJiYgYi5yZXZlcnNlKCk7XG5cdH1cbn07XG5cbkJpbmFyeVBhcnNlckJ1ZmZlci5wcm90b3R5cGUuaGFzTmVlZGVkQml0cyA9IGZ1bmN0aW9uIGhhc05lZWRlZEJpdHMgKG5lZWRlZEJpdHMpIHtcblx0cmV0dXJuIHRoaXMuYnVmZmVyLmxlbmd0aCA+PSAtKC1uZWVkZWRCaXRzID4+IDMpO1xufTtcblxuQmluYXJ5UGFyc2VyQnVmZmVyLnByb3RvdHlwZS5jaGVja0J1ZmZlciA9IGZ1bmN0aW9uIGNoZWNrQnVmZmVyIChuZWVkZWRCaXRzKSB7XG5cdGlmICghdGhpcy5oYXNOZWVkZWRCaXRzKG5lZWRlZEJpdHMpKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiY2hlY2tCdWZmZXI6Om1pc3NpbmcgYnl0ZXNcIik7XG4gIH1cbn07XG5cbkJpbmFyeVBhcnNlckJ1ZmZlci5wcm90b3R5cGUucmVhZEJpdHMgPSBmdW5jdGlvbiByZWFkQml0cyAoc3RhcnQsIGxlbmd0aCkge1xuXHQvL3NobCBmaXg6IEhlbnJpIFRvcmdlbWFuZSB+MTk5NiAoY29tcHJlc3NlZCBieSBKb25hcyBSYW9uaSlcblxuXHRmdW5jdGlvbiBzaGwgKGEsIGIpIHtcblx0XHRmb3IgKDsgYi0tOyBhID0gKChhICU9IDB4N2ZmZmZmZmYgKyAxKSAmIDB4NDAwMDAwMDApID09IDB4NDAwMDAwMDAgPyBhICogMiA6IChhIC0gMHg0MDAwMDAwMCkgKiAyICsgMHg3ZmZmZmZmZiArIDEpO1xuXHRcdHJldHVybiBhO1xuXHR9XG5cblx0aWYgKHN0YXJ0IDwgMCB8fCBsZW5ndGggPD0gMCkge1xuXHRcdHJldHVybiAwO1xuICB9XG5cblx0dGhpcy5jaGVja0J1ZmZlcihzdGFydCArIGxlbmd0aCk7XG5cbiAgdmFyIG9mZnNldExlZnRcbiAgICAsIG9mZnNldFJpZ2h0ID0gc3RhcnQgJSA4XG4gICAgLCBjdXJCeXRlID0gdGhpcy5idWZmZXIubGVuZ3RoIC0gKCBzdGFydCA+PiAzICkgLSAxXG4gICAgLCBsYXN0Qnl0ZSA9IHRoaXMuYnVmZmVyLmxlbmd0aCArICggLSggc3RhcnQgKyBsZW5ndGggKSA+PiAzIClcbiAgICAsIGRpZmYgPSBjdXJCeXRlIC0gbGFzdEJ5dGVcbiAgICAsIHN1bSA9ICgodGhpcy5idWZmZXJbIGN1ckJ5dGUgXSA+PiBvZmZzZXRSaWdodCkgJiAoKDEgPDwgKGRpZmYgPyA4IC0gb2Zmc2V0UmlnaHQgOiBsZW5ndGgpKSAtIDEpKSArIChkaWZmICYmIChvZmZzZXRMZWZ0ID0gKHN0YXJ0ICsgbGVuZ3RoKSAlIDgpID8gKHRoaXMuYnVmZmVyW2xhc3RCeXRlKytdICYgKCgxIDw8IG9mZnNldExlZnQpIC0gMSkpIDw8IChkaWZmLS0gPDwgMykgLSBvZmZzZXRSaWdodCA6IDApO1xuXG5cdGZvcig7IGRpZmY7IHN1bSArPSBzaGwodGhpcy5idWZmZXJbbGFzdEJ5dGUrK10sIChkaWZmLS0gPDwgMykgLSBvZmZzZXRSaWdodCkpO1xuXG5cdHJldHVybiBzdW07XG59O1xuXG4vKipcbiAqIEV4cG9zZS5cbiAqL1xuQmluYXJ5UGFyc2VyLkJ1ZmZlciA9IEJpbmFyeVBhcnNlckJ1ZmZlcjtcblxuZXhwb3J0cy5CaW5hcnlQYXJzZXIgPSBCaW5hcnlQYXJzZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIVxuICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAqL1xuXG52YXIgU2NoZW1hID0gcmVxdWlyZSgnLi9zY2hlbWEnKVxuICAsIERvY3VtZW50ID0gcmVxdWlyZSgnLi9kb2N1bWVudCcpO1xuXG4vL1RPRE86INC90LDQv9C40YHQsNGC0Ywg0LzQtdGC0L7QtCAudXBzZXJ0KCBkb2MgKSAtINC+0LHQvdC+0LLQu9C10L3QuNC1INC00L7QutGD0LzQtdC90YLQsCwg0LAg0LXRgdC70Lgg0LXQs9C+INC90LXRgiwg0YLQviDRgdC+0LfQtNCw0L3QuNC1XG5cbi8vVE9ETzog0LTQvtC00LXQu9Cw0YLRjCDQu9C+0LPQuNC60YMg0YEgYXBpUmVzb3VyY2UgKNGB0L7RhdGA0LDQvdGP0YLRjCDRgdGB0YvQu9C60YMg0L3QsCDQvdC10LPQviDQuCDQuNGB0L/QvtC70YzQt9C+0LLRgtGMINC/0YDQuCDQvNC10YLQvtC00LUgZG9jLnNhdmUpXG4vKipcbiAqINCa0L7QvdGB0YLRgNGD0LrRgtC+0YAg0LrQvtC70LvQtdC60YbQuNC5LlxuICpcbiAqIEBleGFtcGxlXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSDQvdCw0LfQstCw0L3QuNC1INC60L7Qu9C70LXQutGG0LjQuFxuICogQHBhcmFtIHtTY2hlbWF9IHNjaGVtYSAtINCh0YXQtdC80LAg0LjQu9C4INC+0LHRitC10LrRgiDQvtC/0LjRgdCw0L3QuNGPINGB0YXQtdC80YtcbiAqIEBwYXJhbSB7T2JqZWN0fSBbYXBpXSAtINGB0YHRi9C70LrQsCDQvdCwIGFwaSDRgNC10YHRg9GA0YFcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBDb2xsZWN0aW9uICggbmFtZSwgc2NoZW1hLCBhcGkgKXtcbiAgLy8g0KHQvtGF0YDQsNC90LjQvCDQvdCw0LfQstCw0L3QuNC1INC/0YDQvtGB0YLRgNCw0L3RgdGC0LLQsCDQuNC80ZHQvVxuICB0aGlzLm5hbWUgPSBuYW1lO1xuICAvLyDQpdGA0LDQvdC40LvQuNGJ0LUg0LTQu9GPINC00L7QutGD0LzQtdC90YLQvtCyXG4gIHRoaXMuZG9jdW1lbnRzID0ge307XG5cbiAgaWYgKCBfLmlzT2JqZWN0KCBzY2hlbWEgKSAmJiAhKCBzY2hlbWEgaW5zdGFuY2VvZiBTY2hlbWEgKSApIHtcbiAgICBzY2hlbWEgPSBuZXcgU2NoZW1hKCBzY2hlbWEgKTtcbiAgfVxuXG4gIC8vINCh0L7RhdGA0LDQvdC40Lwg0YHRgdGL0LvQutGDINC90LAgYXBpINC00LvRjyDQvNC10YLQvtC00LAgLnNhdmUoKVxuICB0aGlzLmFwaSA9IGFwaTtcblxuICAvLyDQmNGB0L/QvtC70YzQt9GD0LXQvNCw0Y8g0YHRhdC10LzQsCDQtNC70Y8g0LrQvtC70LvQtdC60YbQuNC4XG4gIHRoaXMuc2NoZW1hID0gc2NoZW1hO1xuXG4gIC8vINCe0YLQvtCx0YDQsNC20LXQvdC40LUg0L7QsdGK0LXQutGC0LAgZG9jdW1lbnRzINCyINCy0LjQtNC1INC80LDRgdGB0LjQstCwICjQtNC70Y8g0L3QvtC60LDRg9GC0LApXG4gIHRoaXMuYXJyYXkgPSBbXTtcbiAgLy8g0J3Rg9C20L3QviDQtNC70Y8g0L7QsdC90L7QstC70LXQvdC40Y8g0L/RgNC40LLRj9C30L7QuiDQuiDRjdGC0L7QvNGDINGB0LLQvtC50YHRgtCy0YMg0LTQu9GPIGtub2Nrb3V0anNcbiAgd2luZG93LmtvICYmIGtvLnRyYWNrKCB0aGlzLCBbJ2FycmF5J10gKTtcbn1cblxuQ29sbGVjdGlvbi5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiDQlNC+0LHQsNCy0LjRgtGMINC00L7QutGD0LzQtdC90YIg0LjQu9C4INC80LDRgdGB0LjQsiDQtNC+0LrRg9C80LXQvdGC0L7Qsi5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogc3RvcmFnZS5jb2xsZWN0aW9uLmFkZCh7IHR5cGU6ICdqZWxseSBiZWFuJyB9KTtcbiAgICogc3RvcmFnZS5jb2xsZWN0aW9uLmFkZChbeyB0eXBlOiAnamVsbHkgYmVhbicgfSwgeyB0eXBlOiAnc25pY2tlcnMnIH1dKTtcbiAgICogc3RvcmFnZS5jb2xsZWN0aW9uLmFkZCh7IF9pZDogJyoqKioqJywgdHlwZTogJ2plbGx5IGJlYW4nIH0sIHRydWUpO1xuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdHxBcnJheS48b2JqZWN0Pn0gW2RvY10gLSDQlNC+0LrRg9C80LXQvdGCXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBbZmllbGRzXSAtINCy0YvQsdGA0LDQvdC90YvQtSDQv9C+0LvRjyDQv9GA0Lgg0LfQsNC/0YDQvtGB0LUgKNC90LUg0YDQtdCw0LvQuNC30L7QstCw0L3QviDQsiDQtNC+0LrRg9C80LXQvdGC0LUpXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2luaXRdIC0gaHlkcmF0ZSBkb2N1bWVudCAtINC90LDQv9C+0LvQvdC40YLRjCDQtNC+0LrRg9C80LXQvdGCINC00LDQvdC90YvQvNC4ICjQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8g0LIgYXBpLWNsaWVudClcbiAgICogQHBhcmFtIHtib29sZWFufSBbX3N0b3JhZ2VXaWxsTXV0YXRlXSAtINCk0LvQsNCzINC00L7QsdCw0LLQu9C10L3QuNGPINC80LDRgdGB0LjQstCwINC00L7QutGD0LzQtdC90YLQvtCyLiDRgtC+0LvRjNC60L4g0LTQu9GPINCy0L3Rg9GC0YDQtdC90L3QtdCz0L4g0LjRgdC/0L7Qu9GM0LfQvtCy0LDQvdC40Y9cbiAgICogQHJldHVybnMge3N0b3JhZ2UuRG9jdW1lbnR8QXJyYXkuPHN0b3JhZ2UuRG9jdW1lbnQ+fVxuICAgKi9cbiAgYWRkOiBmdW5jdGlvbiggZG9jLCBmaWVsZHMsIGluaXQsIF9zdG9yYWdlV2lsbE11dGF0ZSApe1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vINCV0YHQu9C4INC00L7QutGD0LzQtdC90YLQsCDQvdC10YIsINC30L3QsNGH0LjRgiDQsdGD0LTQtdGCINC/0YPRgdGC0L7QuVxuICAgIGlmICggZG9jID09IG51bGwgKSBkb2MgPSBudWxsO1xuXG4gICAgLy8g0JzQsNGB0YHQuNCyINC00L7QutGD0LzQtdC90YLQvtCyXG4gICAgaWYgKCBfLmlzQXJyYXkoIGRvYyApICl7XG4gICAgICB2YXIgc2F2ZWREb2NzID0gW107XG5cbiAgICAgIF8uZWFjaCggZG9jLCBmdW5jdGlvbiggZG9jICl7XG4gICAgICAgIHNhdmVkRG9jcy5wdXNoKCBzZWxmLmFkZCggZG9jLCBmaWVsZHMsIGluaXQsIHRydWUgKSApO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuc3RvcmFnZUhhc011dGF0ZWQoKTtcblxuICAgICAgcmV0dXJuIHNhdmVkRG9jcztcbiAgICB9XG5cbiAgICB2YXIgaWQgPSBkb2MgJiYgZG9jLl9pZDtcblxuICAgIC8vINCV0YHQu9C4INC00L7QutGD0LzQtdC90YIg0YPQttC1INC10YHRgtGMLCDRgtC+INC/0YDQvtGB0YLQviDRg9GB0YLQsNC90L7QstC40YLRjCDQt9C90LDRh9C10L3QuNGPXG4gICAgaWYgKCBpZCAmJiB0aGlzLmRvY3VtZW50c1sgaWQgXSApe1xuICAgICAgdGhpcy5kb2N1bWVudHNbIGlkIF0uc2V0KCBkb2MgKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZGlzY3JpbWluYXRvck1hcHBpbmcgPSB0aGlzLnNjaGVtYVxuICAgICAgICA/IHRoaXMuc2NoZW1hLmRpc2NyaW1pbmF0b3JNYXBwaW5nXG4gICAgICAgIDogbnVsbDtcblxuICAgICAgdmFyIGtleSA9IGRpc2NyaW1pbmF0b3JNYXBwaW5nICYmIGRpc2NyaW1pbmF0b3JNYXBwaW5nLmlzUm9vdFxuICAgICAgICA/IGRpc2NyaW1pbmF0b3JNYXBwaW5nLmtleVxuICAgICAgICA6IG51bGw7XG5cbiAgICAgIC8vINCS0YvQsdC40YDQsNC10Lwg0YHRhdC10LzRgywg0LXRgdC70Lgg0LXRgdGC0Ywg0LTQuNGB0LrRgNC40LzQuNC90LDRgtC+0YBcbiAgICAgIHZhciBzY2hlbWE7XG4gICAgICBpZiAoa2V5ICYmIGRvYyAmJiBkb2Nba2V5XSAmJiB0aGlzLnNjaGVtYS5kaXNjcmltaW5hdG9ycyAmJiB0aGlzLnNjaGVtYS5kaXNjcmltaW5hdG9yc1tkb2Nba2V5XV0pIHtcbiAgICAgICAgc2NoZW1hID0gdGhpcy5zY2hlbWEuZGlzY3JpbWluYXRvcnNbZG9jW2tleV1dO1xuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzY2hlbWEgPSB0aGlzLnNjaGVtYTtcbiAgICAgIH1cblxuICAgICAgdmFyIG5ld0RvYyA9IG5ldyBEb2N1bWVudCggZG9jLCB0aGlzLm5hbWUsIHNjaGVtYSwgZmllbGRzLCBpbml0ICk7XG4gICAgICAvL3RvZG86INGC0YPRgiDQvdGD0LbQvdCwINC/0YDQvtCy0LXRgNC60LAg0L3QsCDRgdGD0YnQtdGB0YLQstC+0LLQsNC90LjQtSBpZCAo0LzQvtC20LXRgiDRgdGC0L7QuNGCINGB0LzQvtGC0YDQtdGC0Ywg0LIg0YHRhdC10LzQtSDQvtC/0YbQuNGOIGlkKVxuICAgICAgLyppZiAoICFuZXdEb2MuX2lkICl7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ9CU0LvRjyDQv9C+0LzQtdGJ0LXQvdC40Y8g0LIg0LrQvtC70LvQtdC60YbQuNGOINC90LXQvtCx0YXQvtC00LjQvNC+LCDRh9GC0L7QsdGLINGDINC00L7QutGD0LzQtdC90YLQsCDQsdGL0LsgX2lkJyk7XG4gICAgICB9Ki9cblxuICAgICAgaWQgPSBuZXdEb2MuX2lkLnRvU3RyaW5nKCk7XG4gICAgICAvLyDQn9C+0LzQtdGB0YLQuNGC0Ywg0LTQvtC60YPQvNC10L3RgiDQsiDQutC+0LvQu9C10LrRhtC40Y5cbiAgICAgIHRoaXMuZG9jdW1lbnRzWyBpZCBdID0gbmV3RG9jO1xuICAgIH1cblxuICAgIC8vINCU0LvRjyDQvtC00LjQvdC+0YfQvdGL0YUg0LTQvtC60YPQvNC10L3RgtC+0LIg0YLQvtC20LUg0L3Rg9C20L3QviAg0LLRi9C30LLQsNGC0Ywgc3RvcmFnZUhhc011dGF0ZWRcbiAgICBpZiAoICFfc3RvcmFnZVdpbGxNdXRhdGUgKXtcbiAgICAgIHRoaXMuc3RvcmFnZUhhc011dGF0ZWQoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5kb2N1bWVudHNbIGlkIF07XG4gIH0sXG5cbiAgLyoqXG4gICAqINCj0LTQsNC70LXQvdC40YLRjCDQtNC+0LrRg9C80LXQvdGCLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBzdG9yYWdlLmNvbGxlY3Rpb24ucmVtb3ZlKCBEb2N1bWVudCApO1xuICAgKiBzdG9yYWdlLmNvbGxlY3Rpb24ucmVtb3ZlKCB1dWlkICk7XG4gICAqXG4gICAqIEBwYXJhbSB7b2JqZWN0fG51bWJlcn0gZG9jdW1lbnQgLSDQodCw0Lwg0LTQvtC60YPQvNC10L3RgiDQuNC70Lgg0LXQs9C+IGlkLlxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICovXG4gIHJlbW92ZTogZnVuY3Rpb24oIGRvY3VtZW50ICl7XG4gICAgcmV0dXJuIGRlbGV0ZSB0aGlzLmRvY3VtZW50c1sgZG9jdW1lbnQuX2lkIHx8IGRvY3VtZW50IF07XG4gIH0sXG5cbiAgLyoqXG4gICAqINCd0LDQudGC0Lgg0LTQvtC60YPQvNC10L3RgtGLLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiAvLyBuYW1lZCBqb2huXG4gICAqIHN0b3JhZ2UuY29sbGVjdGlvbi5maW5kKHsgbmFtZTogJ2pvaG4nIH0pO1xuICAgKiBzdG9yYWdlLmNvbGxlY3Rpb24uZmluZCh7IGF1dGhvcjogJ1NoYWtlc3BlYXJlJywgeWVhcjogMTYxMSB9KTtcbiAgICpcbiAgICogQHBhcmFtIGNvbmRpdGlvbnNcbiAgICogQHJldHVybnMge0FycmF5LjxzdG9yYWdlLkRvY3VtZW50Pn1cbiAgICovXG4gIGZpbmQ6IGZ1bmN0aW9uKCBjb25kaXRpb25zICl7XG4gICAgcmV0dXJuIF8ud2hlcmUoIHRoaXMuZG9jdW1lbnRzLCBjb25kaXRpb25zICk7XG4gIH0sXG5cbiAgLyoqXG4gICAqINCd0LDQudGC0Lgg0L7QtNC40L0g0LTQvtC60YPQvNC10L3RgiDQv9C+IGlkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBzdG9yYWdlLmNvbGxlY3Rpb24uZmluZEJ5SWQoIGlkICk7XG4gICAqXG4gICAqIEBwYXJhbSBfaWRcbiAgICogQHJldHVybnMge3N0b3JhZ2UuRG9jdW1lbnR8dW5kZWZpbmVkfVxuICAgKi9cbiAgZmluZEJ5SWQ6IGZ1bmN0aW9uKCBfaWQgKXtcbiAgICByZXR1cm4gdGhpcy5kb2N1bWVudHNbIF9pZCBdO1xuICB9LFxuXG4gIC8qKlxuICAgKiDQndCw0LnRgtC4INC/0L4gaWQg0LTQvtC60YPQvNC10L3RgiDQuCDRg9C00LDQu9C40YLRjCDQtdCz0L4uXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIHN0b3JhZ2UuY29sbGVjdGlvbi5maW5kQnlJZEFuZFJlbW92ZSggaWQgKSAvLyByZXR1cm5zINGBb2xsZWN0aW9uXG4gICAqXG4gICAqIEBzZWUgQ29sbGVjdGlvbi5maW5kQnlJZFxuICAgKiBAc2VlIENvbGxlY3Rpb24ucmVtb3ZlXG4gICAqXG4gICAqIEBwYXJhbSBfaWRcbiAgICogQHJldHVybnMge0NvbGxlY3Rpb259XG4gICAqL1xuICBmaW5kQnlJZEFuZFJlbW92ZTogZnVuY3Rpb24oIF9pZCApe1xuICAgIHRoaXMucmVtb3ZlKCB0aGlzLmZpbmRCeUlkKCBfaWQgKSApO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8qKlxuICAgKiDQndCw0LnRgtC4INC/0L4gaWQg0LTQvtC60YPQvNC10L3RgiDQuCDQvtCx0L3QvtCy0LjRgtGMINC10LPQvi5cbiAgICpcbiAgICogQHNlZSBDb2xsZWN0aW9uLmZpbmRCeUlkXG4gICAqIEBzZWUgQ29sbGVjdGlvbi51cGRhdGVcbiAgICpcbiAgICogQHBhcmFtIF9pZFxuICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IHBhdGhcbiAgICogQHBhcmFtIHtvYmplY3R8Ym9vbGVhbnxudW1iZXJ8c3RyaW5nfG51bGx8dW5kZWZpbmVkfSB2YWx1ZVxuICAgKiBAcmV0dXJucyB7c3RvcmFnZS5Eb2N1bWVudHx1bmRlZmluZWR9XG4gICAqL1xuICBmaW5kQnlJZEFuZFVwZGF0ZTogZnVuY3Rpb24oIF9pZCwgcGF0aCwgdmFsdWUgKXtcbiAgICByZXR1cm4gdGhpcy51cGRhdGUoIHRoaXMuZmluZEJ5SWQoIF9pZCApLCBwYXRoLCB2YWx1ZSApO1xuICB9LFxuXG4gIC8qKlxuICAgKiDQndCw0LnRgtC4INC+0LTQuNC9INC00L7QutGD0LzQtdC90YIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIC8vIGZpbmQgb25lIGlwaG9uZSBhZHZlbnR1cmVzXG4gICAqIHN0b3JhZ2UuYWR2ZW50dXJlLmZpbmRPbmUoeyB0eXBlOiAnaXBob25lJyB9KTtcbiAgICpcbiAgICogQHBhcmFtIGNvbmRpdGlvbnNcbiAgICogQHJldHVybnMge3N0b3JhZ2UuRG9jdW1lbnR8dW5kZWZpbmVkfVxuICAgKi9cbiAgZmluZE9uZTogZnVuY3Rpb24oIGNvbmRpdGlvbnMgKXtcbiAgICByZXR1cm4gXy5maW5kV2hlcmUoIHRoaXMuZG9jdW1lbnRzLCBjb25kaXRpb25zICk7XG4gIH0sXG5cbiAgLyoqXG4gICAqINCd0LDQudGC0Lgg0L/QviDRg9GB0LvQvtCy0LjRjiDQvtC00LjQvSDQtNC+0LrRg9C80LXQvdGCINC4INGD0LTQsNC70LjRgtGMINC10LPQvi5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogc3RvcmFnZS5jb2xsZWN0aW9uLmZpbmRPbmVBbmRSZW1vdmUoIGNvbmRpdGlvbnMgKSAvLyByZXR1cm5zINGBb2xsZWN0aW9uXG4gICAqXG4gICAqIEBzZWUgQ29sbGVjdGlvbi5maW5kT25lXG4gICAqIEBzZWUgQ29sbGVjdGlvbi5yZW1vdmVcbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IGNvbmRpdGlvbnNcbiAgICogQHJldHVybnMge0NvbGxlY3Rpb259XG4gICAqL1xuICBmaW5kT25lQW5kUmVtb3ZlOiBmdW5jdGlvbiggY29uZGl0aW9ucyApe1xuICAgIHRoaXMucmVtb3ZlKCB0aGlzLmZpbmRPbmUoIGNvbmRpdGlvbnMgKSApO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8qKlxuICAgKiDQndCw0LnRgtC4INC00L7QutGD0LzQtdC90YIg0L/QviDRg9GB0LvQvtCy0LjRjiDQuCDQvtCx0L3QvtCy0LjRgtGMINC10LPQvi5cbiAgICpcbiAgICogQHNlZSBDb2xsZWN0aW9uLmZpbmRPbmVcbiAgICogQHNlZSBDb2xsZWN0aW9uLnVwZGF0ZVxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gY29uZGl0aW9uc1xuICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IHBhdGhcbiAgICogQHBhcmFtIHtvYmplY3R8Ym9vbGVhbnxudW1iZXJ8c3RyaW5nfG51bGx8dW5kZWZpbmVkfSB2YWx1ZVxuICAgKiBAcmV0dXJucyB7c3RvcmFnZS5Eb2N1bWVudHx1bmRlZmluZWR9XG4gICAqL1xuICBmaW5kT25lQW5kVXBkYXRlOiBmdW5jdGlvbiggY29uZGl0aW9ucywgcGF0aCwgdmFsdWUgKXtcbiAgICByZXR1cm4gdGhpcy51cGRhdGUoIHRoaXMuZmluZE9uZSggY29uZGl0aW9ucyApLCBwYXRoLCB2YWx1ZSApO1xuICB9LFxuXG4gIC8qKlxuICAgKiDQntCx0L3QvtCy0LjRgtGMINGB0YPRidC10YHRgtCy0YPRjtGJ0LjQtSDQv9C+0LvRjyDQsiDQtNC+0LrRg9C80LXQvdGC0LUuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIHN0b3JhZ2UucGxhY2VzLnVwZGF0ZSggc3RvcmFnZS5wbGFjZXMuZmluZEJ5SWQoIDAgKSwge1xuICAgKiAgIG5hbWU6ICdJcmt1dHNrJ1xuICAgKiB9KTtcbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJ8b2JqZWN0fSBkb2N1bWVudFxuICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IHBhdGhcbiAgICogQHBhcmFtIHtvYmplY3R8Ym9vbGVhbnxudW1iZXJ8c3RyaW5nfG51bGx8dW5kZWZpbmVkfSB2YWx1ZVxuICAgKiBAcmV0dXJucyB7c3RvcmFnZS5Eb2N1bWVudHxCb29sZWFufVxuICAgKi9cbiAgdXBkYXRlOiBmdW5jdGlvbiggZG9jdW1lbnQsIHBhdGgsIHZhbHVlICl7XG4gICAgdmFyIGRvYyA9IHRoaXMuZG9jdW1lbnRzWyBkb2N1bWVudC5faWQgfHwgZG9jdW1lbnQgXTtcblxuICAgIGlmICggZG9jID09IG51bGwgKXtcbiAgICAgIGNvbnNvbGUud2Fybignc3RvcmFnZTo6dXBkYXRlOiBEb2N1bWVudCBpcyBub3QgZm91bmQuJyk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRvYy5zZXQoIHBhdGgsIHZhbHVlICk7XG4gIH0sXG5cbiAgLyoqXG4gICAqINCe0LHRgNCw0LHQvtGC0YfQuNC6INC90LAg0LjQt9C80LXQvdC10L3QuNGPICjQtNC+0LHQsNCy0LvQtdC90LjQtSwg0YPQtNCw0LvQtdC90LjQtSkg0LTQsNC90L3Ri9GFINCyINC60L7Qu9C70LXQutGG0LjQuFxuICAgKi9cbiAgc3RvcmFnZUhhc011dGF0ZWQ6IGZ1bmN0aW9uKCl7XG4gICAgLy8g0J7QsdC90L7QstC40Lwg0LzQsNGB0YHQuNCyINC00L7QutGD0LzQtdC90YLQvtCyICjRgdC/0LXRhtC40LDQu9GM0L3QvtC1INC+0YLQvtCx0YDQsNC20LXQvdC40LUg0LTQu9GPINC/0LXRgNC10LHQvtGA0LAg0L3QvtC60LDRg9GC0L7QvClcbiAgICB0aGlzLmFycmF5ID0gXy50b0FycmF5KCB0aGlzLmRvY3VtZW50cyApO1xuICB9LFxuXG4gIC8qKlxuICAgKiDQntCx0L3QvtCy0LjRgtGMINGB0YHRi9C70LrRgyDQvdCwINC00L7QutGD0LzQtdC90YIg0LIg0L/QvtC70LUgZG9jdW1lbnRzXG4gICAqXG4gICAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY1xuICAgKi9cbiAgdXBkYXRlSWRMaW5rOiBmdW5jdGlvbiggZG9jICl7XG4gICAgdmFyIGlkID0gZG9jLl9pZC50b1N0cmluZygpO1xuICAgIHZhciBvbGRJZCA9IF8uZmluZEtleSggdGhpcy5kb2N1bWVudHMsIHsgX2lkOiBkb2MuX2lkIH0pO1xuXG4gICAgaWYgKCAhb2xkSWQgKXtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ9Cd0LUg0L3QsNC50LTQtdC9INC00L7QutGD0LzQtdC90YIg0LTQu9GPINC+0LHQvdC+0LLQu9C10L3QuNGPINGB0YHRi9C70LrQuCDQv9C+INGN0YLQvtC80YMgX2lkOiAnICsgaWQgKTtcbiAgICB9XG5cbiAgICBkZWxldGUgdGhpcy5kb2N1bWVudHNbIG9sZElkIF07XG4gICAgdGhpcy5kb2N1bWVudHNbIGlkIF0gPSBkb2M7XG4gIH1cbn07XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBDb2xsZWN0aW9uO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJylcbiAgLCBTdG9yYWdlRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yJylcbiAgLCBNaXhlZFNjaGVtYSA9IHJlcXVpcmUoJy4vc2NoZW1hL21peGVkJylcbiAgLCBPYmplY3RJZCA9IHJlcXVpcmUoJy4vdHlwZXMvb2JqZWN0aWQnKVxuICAsIFNjaGVtYSA9IHJlcXVpcmUoJy4vc2NoZW1hJylcbiAgLCBWYWxpZGF0b3JFcnJvciA9IHJlcXVpcmUoJy4vc2NoZW1hdHlwZScpLlZhbGlkYXRvckVycm9yXG4gICwgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJylcbiAgLCBjbG9uZSA9IHV0aWxzLmNsb25lXG4gICwgVmFsaWRhdGlvbkVycm9yID0gU3RvcmFnZUVycm9yLlZhbGlkYXRpb25FcnJvclxuICAsIEludGVybmFsQ2FjaGUgPSByZXF1aXJlKCcuL2ludGVybmFsJylcbiAgLCBkZWVwRXF1YWwgPSB1dGlscy5kZWVwRXF1YWxcbiAgLCBEb2N1bWVudEFycmF5XG4gICwgU2NoZW1hQXJyYXlcbiAgLCBFbWJlZGRlZDtcblxuLyoqXG4gKiDQmtC+0L3RgdGC0YDRg9C60YLQvtGAINC00L7QutGD0LzQtdC90YLQsC5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtINC30L3QsNGH0LXQvdC40Y8sINC60L7RgtC+0YDRi9C1INC90YPQttC90L4g0YPRgdGC0LDQvdC+0LLQuNGC0YxcbiAqIEBwYXJhbSB7c3RyaW5nfHVuZGVmaW5lZH0gW2NvbGxlY3Rpb25OYW1lXSAtINC60L7Qu9C70LXQutGG0LjRjyDQsiDQutC+0YLQvtGA0L7QuSDQsdGD0LTQtdGCINC90LDRhdC+0LTQuNGC0YHRjyDQtNC+0LrRg9C80LXQvdGCXG4gKiBAcGFyYW0ge1NjaGVtYX0gc2NoZW1hIC0g0YHRhdC10LzQsCDQv9C+INC60L7RgtC+0YDQvtC5INCx0YPQtNC10YIg0YHQvtC30LTQsNC9INC00L7QutGD0LzQtdC90YJcbiAqIEBwYXJhbSB7b2JqZWN0fSBbZmllbGRzXSAtINCy0YvQsdGA0LDQvdC90YvQtSDQv9C+0LvRjyDQsiDQtNC+0LrRg9C80LXQvdGC0LUgKNC90LUg0YDQtdCw0LvQuNC30L7QstCw0L3QvilcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW2luaXRdIC0gaHlkcmF0ZSBkb2N1bWVudCAtINC90LDQv9C+0LvQvdC40YLRjCDQtNC+0LrRg9C80LXQvdGCINC00LDQvdC90YvQvNC4ICjQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8g0LIgYXBpLWNsaWVudClcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBEb2N1bWVudCAoIGRhdGEsIGNvbGxlY3Rpb25OYW1lLCBzY2hlbWEsIGZpZWxkcywgaW5pdCApe1xuICBpZiAoICEodGhpcyBpbnN0YW5jZW9mIERvY3VtZW50KSApIHtcbiAgICByZXR1cm4gbmV3IERvY3VtZW50KCBkYXRhLCBjb2xsZWN0aW9uTmFtZSwgc2NoZW1hLCBmaWVsZHMsIGluaXQgKTtcbiAgfVxuXG4gIHRoaXMuJF9fID0gbmV3IEludGVybmFsQ2FjaGU7XG4gIHRoaXMuaXNOZXcgPSB0cnVlO1xuXG4gIC8vINCh0L7Qt9C00LDRgtGMINC/0YPRgdGC0L7QuSDQtNC+0LrRg9C80LXQvdGCINGBINGE0LvQsNCz0L7QvCBpbml0XG4gIC8vIG5ldyBUZXN0RG9jdW1lbnQodHJ1ZSk7XG4gIGlmICggJ2Jvb2xlYW4nID09PSB0eXBlb2YgZGF0YSApe1xuICAgIGluaXQgPSBkYXRhO1xuICAgIGRhdGEgPSBudWxsO1xuICB9XG5cbiAgaWYgKCBjb2xsZWN0aW9uTmFtZSBpbnN0YW5jZW9mIFNjaGVtYSApe1xuICAgIHNjaGVtYSA9IGNvbGxlY3Rpb25OYW1lO1xuICAgIGNvbGxlY3Rpb25OYW1lID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKCBfLmlzT2JqZWN0KCBzY2hlbWEgKSAmJiAhKCBzY2hlbWEgaW5zdGFuY2VvZiBTY2hlbWEgKSkge1xuICAgIHNjaGVtYSA9IG5ldyBTY2hlbWEoIHNjaGVtYSApO1xuICB9XG5cbiAgLy8g0KHQvtC30LTQsNGC0Ywg0L/Rg9GB0YLQvtC5INC00L7QutGD0LzQtdC90YIg0L/QviDRgdGF0LXQvNC1XG4gIGlmICggZGF0YSBpbnN0YW5jZW9mIFNjaGVtYSApe1xuICAgIHNjaGVtYSA9IGRhdGE7XG4gICAgZGF0YSA9IG51bGw7XG5cbiAgICBpZiAoIHNjaGVtYS5vcHRpb25zLl9pZCApe1xuICAgICAgZGF0YSA9IHsgX2lkOiBuZXcgT2JqZWN0SWQoKSB9O1xuICAgIH1cblxuICB9IGVsc2Uge1xuICAgIC8vINCf0YDQuCDRgdC+0LfQtNCw0L3QuNC4IEVtYmVkZGVkRG9jdW1lbnQsINCyINC90ZHQvCDRg9C20LUg0LXRgdGC0Ywg0YHRhdC10LzQsCDQuCDQtdC80YMg0L3QtSDQvdGD0LbQtdC9IF9pZFxuICAgIHNjaGVtYSA9IHRoaXMuc2NoZW1hIHx8IHNjaGVtYTtcbiAgICAvLyDQodCz0LXQvdC10YDQuNGA0L7QstCw0YLRjCBPYmplY3RJZCwg0LXRgdC70Lgg0L7QvSDQvtGC0YHRg9GC0YHRgtCy0YPQtdGCLCDQvdC+INC10LPQviDRgtGA0LXQsdGD0LXRgiDRgdGF0LXQvNCwXG4gICAgaWYgKCBzY2hlbWEgJiYgIXRoaXMuc2NoZW1hICYmIHNjaGVtYS5vcHRpb25zLl9pZCApe1xuICAgICAgZGF0YSA9IGRhdGEgfHwge307XG5cbiAgICAgIGlmICggZGF0YS5faWQgPT09IHVuZGVmaW5lZCApe1xuICAgICAgICBkYXRhLl9pZCA9IG5ldyBPYmplY3RJZCgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmICggIXNjaGVtYSApe1xuICAgIHRocm93IG5ldyBTdG9yYWdlRXJyb3IuTWlzc2luZ1NjaGVtYUVycm9yKCk7XG4gIH1cblxuICAvLyDQodC+0LfQtNCw0YLRjCDQtNC+0LrRg9C80LXQvdGCINGBINGE0LvQsNCz0L7QvCBpbml0XG4gIC8vIG5ldyBUZXN0RG9jdW1lbnQoeyB0ZXN0OiAnYm9vbScgfSwgdHJ1ZSk7XG4gIGlmICggJ2Jvb2xlYW4nID09PSB0eXBlb2YgY29sbGVjdGlvbk5hbWUgKXtcbiAgICBpbml0ID0gY29sbGVjdGlvbk5hbWU7XG4gICAgY29sbGVjdGlvbk5hbWUgPSB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyDQodC+0LfQtNCw0YLRjCDQtNC+0LrRg9C80LXQvdGCINGBIHN0cmljdDogdHJ1ZVxuICAvLyBjb2xsZWN0aW9uLmFkZCh7Li4ufSwgdHJ1ZSk7XG4gIGlmICgnYm9vbGVhbicgPT09IHR5cGVvZiBmaWVsZHMpIHtcbiAgICB0aGlzLiRfXy5zdHJpY3RNb2RlID0gZmllbGRzO1xuICAgIGZpZWxkcyA9IHVuZGVmaW5lZDtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLiRfXy5zdHJpY3RNb2RlID0gc2NoZW1hLm9wdGlvbnMgJiYgc2NoZW1hLm9wdGlvbnMuc3RyaWN0O1xuICAgIHRoaXMuJF9fLnNlbGVjdGVkID0gZmllbGRzO1xuICB9XG5cbiAgdGhpcy5zY2hlbWEgPSBzY2hlbWE7XG5cbiAgaWYgKCBjb2xsZWN0aW9uTmFtZSApe1xuICAgIHRoaXMuY29sbGVjdGlvbiA9IHdpbmRvdy5zdG9yYWdlWyBjb2xsZWN0aW9uTmFtZSBdO1xuICAgIHRoaXMuY29sbGVjdGlvbk5hbWUgPSBjb2xsZWN0aW9uTmFtZTtcbiAgfVxuXG4gIHZhciByZXF1aXJlZCA9IHNjaGVtYS5yZXF1aXJlZFBhdGhzKCk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcmVxdWlyZWQubGVuZ3RoOyArK2kpIHtcbiAgICB0aGlzLiRfXy5hY3RpdmVQYXRocy5yZXF1aXJlKCByZXF1aXJlZFtpXSApO1xuICB9XG5cbiAgdGhpcy4kX19zZXRTY2hlbWEoIHNjaGVtYSApO1xuXG4gIHRoaXMuX2RvYyA9IHRoaXMuJF9fYnVpbGREb2MoIGRhdGEsIGluaXQgKTtcblxuICBpZiAoIGluaXQgKXtcbiAgICB0aGlzLmluaXQoIGRhdGEgKTtcbiAgfSBlbHNlIGlmICggZGF0YSApIHtcbiAgICB0aGlzLnNldCggZGF0YSwgdW5kZWZpbmVkLCB0cnVlICk7XG4gIH1cblxuICAvLyBhcHBseSBtZXRob2RzXG4gIGZvciAoIHZhciBtIGluIHNjaGVtYS5tZXRob2RzICl7XG4gICAgdGhpc1sgbSBdID0gc2NoZW1hLm1ldGhvZHNbIG0gXTtcbiAgfVxuICAvLyBhcHBseSBzdGF0aWNzXG4gIGZvciAoIHZhciBzIGluIHNjaGVtYS5zdGF0aWNzICl7XG4gICAgdGhpc1sgcyBdID0gc2NoZW1hLnN0YXRpY3NbIHMgXTtcbiAgfVxufVxuXG4vKiFcbiAqIEluaGVyaXRzIGZyb20gRXZlbnRFbWl0dGVyLlxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBFdmVudHMucHJvdG90eXBlICk7XG5Eb2N1bWVudC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBEb2N1bWVudDtcblxuLyoqXG4gKiBUaGUgZG9jdW1lbnRzIHNjaGVtYS5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICogQHByb3BlcnR5IHNjaGVtYVxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuc2NoZW1hO1xuXG4vKipcbiAqIEJvb2xlYW4gZmxhZyBzcGVjaWZ5aW5nIGlmIHRoZSBkb2N1bWVudCBpcyBuZXcuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqIEBwcm9wZXJ0eSBpc05ld1xuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuaXNOZXc7XG5cbi8qKlxuICogVGhlIHN0cmluZyB2ZXJzaW9uIG9mIHRoaXMgZG9jdW1lbnRzIF9pZC5cbiAqXG4gKiAjIyMjTm90ZTpcbiAqXG4gKiBUaGlzIGdldHRlciBleGlzdHMgb24gYWxsIGRvY3VtZW50cyBieSBkZWZhdWx0LiBUaGUgZ2V0dGVyIGNhbiBiZSBkaXNhYmxlZCBieSBzZXR0aW5nIHRoZSBgaWRgIFtvcHRpb25dKC9kb2NzL2d1aWRlLmh0bWwjaWQpIG9mIGl0cyBgU2NoZW1hYCB0byBmYWxzZSBhdCBjb25zdHJ1Y3Rpb24gdGltZS5cbiAqXG4gKiAgICAgbmV3IFNjaGVtYSh7IG5hbWU6IFN0cmluZyB9LCB7IGlkOiBmYWxzZSB9KTtcbiAqXG4gKiBAYXBpIHB1YmxpY1xuICogQHNlZSBTY2hlbWEgb3B0aW9ucyAvZG9jcy9ndWlkZS5odG1sI29wdGlvbnNcbiAqIEBwcm9wZXJ0eSBpZFxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuaWQ7XG5cbi8qKlxuICogSGFzaCBjb250YWluaW5nIGN1cnJlbnQgdmFsaWRhdGlvbiBlcnJvcnMuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqIEBwcm9wZXJ0eSBlcnJvcnNcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLmVycm9ycztcblxuRG9jdW1lbnQucHJvdG90eXBlLmFkYXB0ZXJIb29rcyA9IHtcbiAgZG9jdW1lbnREZWZpbmVQcm9wZXJ0eTogJC5ub29wLFxuICBkb2N1bWVudFNldEluaXRpYWxWYWx1ZTogJC5ub29wLFxuICBkb2N1bWVudEdldFZhbHVlOiAkLm5vb3AsXG4gIGRvY3VtZW50U2V0VmFsdWU6ICQubm9vcFxufTtcblxuLyoqXG4gKiBCdWlsZHMgdGhlIGRlZmF1bHQgZG9jIHN0cnVjdHVyZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW3NraXBJZF1cbiAqIEByZXR1cm4ge09iamVjdH1cbiAqIEBhcGkgcHJpdmF0ZVxuICogQG1ldGhvZCAkX19idWlsZERvY1xuICogQG1lbWJlck9mIERvY3VtZW50XG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS4kX19idWlsZERvYyA9IGZ1bmN0aW9uICggb2JqLCBza2lwSWQgKSB7XG4gIHZhciBkb2MgPSB7fVxuICAgICwgc2VsZiA9IHRoaXM7XG5cbiAgdmFyIHBhdGhzID0gT2JqZWN0LmtleXMoIHRoaXMuc2NoZW1hLnBhdGhzIClcbiAgICAsIHBsZW4gPSBwYXRocy5sZW5ndGhcbiAgICAsIGlpID0gMDtcblxuICBmb3IgKCA7IGlpIDwgcGxlbjsgKytpaSApIHtcbiAgICB2YXIgcCA9IHBhdGhzW2lpXTtcblxuICAgIGlmICggJ19pZCcgPT0gcCApIHtcbiAgICAgIGlmICggc2tpcElkICkgY29udGludWU7XG4gICAgICBpZiAoIG9iaiAmJiAnX2lkJyBpbiBvYmogKSBjb250aW51ZTtcbiAgICB9XG5cbiAgICB2YXIgdHlwZSA9IHRoaXMuc2NoZW1hLnBhdGhzWyBwIF1cbiAgICAgICwgcGF0aCA9IHAuc3BsaXQoJy4nKVxuICAgICAgLCBsZW4gPSBwYXRoLmxlbmd0aFxuICAgICAgLCBsYXN0ID0gbGVuIC0gMVxuICAgICAgLCBkb2NfID0gZG9jXG4gICAgICAsIGkgPSAwO1xuXG4gICAgZm9yICggOyBpIDwgbGVuOyArK2kgKSB7XG4gICAgICB2YXIgcGllY2UgPSBwYXRoWyBpIF1cbiAgICAgICAgLCBkZWZhdWx0VmFsO1xuXG4gICAgICBpZiAoIGkgPT09IGxhc3QgKSB7XG4gICAgICAgIGRlZmF1bHRWYWwgPSB0eXBlLmdldERlZmF1bHQoIHNlbGYsIHRydWUgKTtcblxuICAgICAgICBpZiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBkZWZhdWx0VmFsICkge1xuICAgICAgICAgIGRvY19bIHBpZWNlIF0gPSBkZWZhdWx0VmFsO1xuICAgICAgICAgIHNlbGYuJF9fLmFjdGl2ZVBhdGhzLmRlZmF1bHQoIHAgKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZG9jXyA9IGRvY19bIHBpZWNlIF0gfHwgKCBkb2NfWyBwaWVjZSBdID0ge30gKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gZG9jO1xufTtcblxuLyoqXG4gKiBJbml0aWFsaXplcyB0aGUgZG9jdW1lbnQgd2l0aG91dCBzZXR0ZXJzIG9yIG1hcmtpbmcgYW55dGhpbmcgbW9kaWZpZWQuXG4gKlxuICogQ2FsbGVkIGludGVybmFsbHkgYWZ0ZXIgYSBkb2N1bWVudCBpcyByZXR1cm5lZCBmcm9tIHNlcnZlci5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gZGF0YSBkb2N1bWVudCByZXR1cm5lZCBieSBzZXJ2ZXJcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uICggZGF0YSApIHtcbiAgdGhpcy5pc05ldyA9IGZhbHNlO1xuXG4gIC8vdG9kbzog0YHQtNC10YHRjCDQstGB0ZEg0LjQt9C80LXQvdC40YLRgdGPLCDRgdC80L7RgtGA0LXRgtGMINC60L7QvNC80LXQvdGCINC80LXRgtC+0LTQsCB0aGlzLnBvcHVsYXRlZFxuICAvLyBoYW5kbGUgZG9jcyB3aXRoIHBvcHVsYXRlZCBwYXRoc1xuICAvKiFcbiAgaWYgKCBkb2MuX2lkICYmIG9wdHMgJiYgb3B0cy5wb3B1bGF0ZWQgJiYgb3B0cy5wb3B1bGF0ZWQubGVuZ3RoICkge1xuICAgIHZhciBpZCA9IFN0cmluZyggZG9jLl9pZCApO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3B0cy5wb3B1bGF0ZWQubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBpdGVtID0gb3B0cy5wb3B1bGF0ZWRbIGkgXTtcbiAgICAgIHRoaXMucG9wdWxhdGVkKCBpdGVtLnBhdGgsIGl0ZW0uX2RvY3NbaWRdLCBpdGVtICk7XG4gICAgfVxuICB9XG4gICovXG5cbiAgaW5pdCggdGhpcywgZGF0YSwgdGhpcy5fZG9jICk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKiFcbiAqIEluaXQgaGVscGVyLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBzZWxmIGRvY3VtZW50IGluc3RhbmNlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIHJhdyBzZXJ2ZXIgZG9jXG4gKiBAcGFyYW0ge09iamVjdH0gZG9jIG9iamVjdCB3ZSBhcmUgaW5pdGlhbGl6aW5nXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gaW5pdCAoc2VsZiwgb2JqLCBkb2MsIHByZWZpeCkge1xuICBwcmVmaXggPSBwcmVmaXggfHwgJyc7XG5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopXG4gICAgLCBsZW4gPSBrZXlzLmxlbmd0aFxuICAgICwgc2NoZW1hXG4gICAgLCBwYXRoXG4gICAgLCBpO1xuXG4gIHdoaWxlIChsZW4tLSkge1xuICAgIGkgPSBrZXlzW2xlbl07XG4gICAgcGF0aCA9IHByZWZpeCArIGk7XG4gICAgc2NoZW1hID0gc2VsZi5zY2hlbWEucGF0aChwYXRoKTtcblxuICAgIGlmICghc2NoZW1hICYmIF8uaXNQbGFpbk9iamVjdCggb2JqWyBpIF0gKSAmJlxuICAgICAgICAoIW9ialtpXS5jb25zdHJ1Y3RvciB8fCAnT2JqZWN0JyA9PSB1dGlscy5nZXRGdW5jdGlvbk5hbWUob2JqW2ldLmNvbnN0cnVjdG9yKSkpIHtcbiAgICAgIC8vIGFzc3VtZSBuZXN0ZWQgb2JqZWN0XG4gICAgICBpZiAoIWRvY1tpXSkgZG9jW2ldID0ge307XG4gICAgICBpbml0KHNlbGYsIG9ialtpXSwgZG9jW2ldLCBwYXRoICsgJy4nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG9ialtpXSA9PT0gbnVsbCkge1xuICAgICAgICBkb2NbaV0gPSBudWxsO1xuICAgICAgfSBlbHNlIGlmIChvYmpbaV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoc2NoZW1hKSB7XG4gICAgICAgICAgc2VsZi4kX190cnkoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGRvY1tpXSA9IHNjaGVtYS5jYXN0KG9ialtpXSwgc2VsZiwgdHJ1ZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZG9jW2ldID0gb2JqW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5hZGFwdGVySG9va3MuZG9jdW1lbnRTZXRJbml0aWFsVmFsdWUuY2FsbCggc2VsZiwgc2VsZiwgcGF0aCwgZG9jW2ldICk7XG4gICAgICB9XG4gICAgICAvLyBtYXJrIGFzIGh5ZHJhdGVkXG4gICAgICBzZWxmLiRfXy5hY3RpdmVQYXRocy5pbml0KHBhdGgpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFNldHMgdGhlIHZhbHVlIG9mIGEgcGF0aCwgb3IgbWFueSBwYXRocy5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgLy8gcGF0aCwgdmFsdWVcbiAqICAgICBkb2Muc2V0KHBhdGgsIHZhbHVlKVxuICpcbiAqICAgICAvLyBvYmplY3RcbiAqICAgICBkb2Muc2V0KHtcbiAqICAgICAgICAgcGF0aCAgOiB2YWx1ZVxuICogICAgICAgLCBwYXRoMiA6IHtcbiAqICAgICAgICAgICAgcGF0aCAgOiB2YWx1ZVxuICogICAgICAgICB9XG4gKiAgICAgfSlcbiAqXG4gKiAgICAgLy8gb25seS10aGUtZmx5IGNhc3QgdG8gbnVtYmVyXG4gKiAgICAgZG9jLnNldChwYXRoLCB2YWx1ZSwgTnVtYmVyKVxuICpcbiAqICAgICAvLyBvbmx5LXRoZS1mbHkgY2FzdCB0byBzdHJpbmdcbiAqICAgICBkb2Muc2V0KHBhdGgsIHZhbHVlLCBTdHJpbmcpXG4gKlxuICogICAgIC8vIGNoYW5naW5nIHN0cmljdCBtb2RlIGJlaGF2aW9yXG4gKiAgICAgZG9jLnNldChwYXRoLCB2YWx1ZSwgeyBzdHJpY3Q6IGZhbHNlIH0pO1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE9iamVjdH0gcGF0aCBwYXRoIG9yIG9iamVjdCBvZiBrZXkvdmFscyB0byBzZXRcbiAqIEBwYXJhbSB7TWl4ZWR9IHZhbCB0aGUgdmFsdWUgdG8gc2V0XG4gKiBAcGFyYW0ge1NjaGVtYXxTdHJpbmd8TnVtYmVyfGV0Yy4ufSBbdHlwZV0gb3B0aW9uYWxseSBzcGVjaWZ5IGEgdHlwZSBmb3IgXCJvbi10aGUtZmx5XCIgYXR0cmlidXRlc1xuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBvcHRpb25hbGx5IHNwZWNpZnkgb3B0aW9ucyB0aGF0IG1vZGlmeSB0aGUgYmVoYXZpb3Igb2YgdGhlIHNldFxuICogQGFwaSBwdWJsaWNcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChwYXRoLCB2YWwsIHR5cGUsIG9wdGlvbnMpIHtcbiAgaWYgKHR5cGUgJiYgJ09iamVjdCcgPT0gdXRpbHMuZ2V0RnVuY3Rpb25OYW1lKHR5cGUuY29uc3RydWN0b3IpKSB7XG4gICAgb3B0aW9ucyA9IHR5cGU7XG4gICAgdHlwZSA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHZhciBtZXJnZSA9IG9wdGlvbnMgJiYgb3B0aW9ucy5tZXJnZVxuICAgICwgYWRob2MgPSB0eXBlICYmIHRydWUgIT09IHR5cGVcbiAgICAsIGNvbnN0cnVjdGluZyA9IHRydWUgPT09IHR5cGVcbiAgICAsIGFkaG9jcztcblxuICB2YXIgc3RyaWN0ID0gb3B0aW9ucyAmJiAnc3RyaWN0JyBpbiBvcHRpb25zXG4gICAgPyBvcHRpb25zLnN0cmljdFxuICAgIDogdGhpcy4kX18uc3RyaWN0TW9kZTtcblxuICBpZiAoYWRob2MpIHtcbiAgICBhZGhvY3MgPSB0aGlzLiRfXy5hZGhvY1BhdGhzIHx8ICh0aGlzLiRfXy5hZGhvY1BhdGhzID0ge30pO1xuICAgIGFkaG9jc1twYXRoXSA9IFNjaGVtYS5pbnRlcnByZXRBc1R5cGUocGF0aCwgdHlwZSk7XG4gIH1cblxuICBpZiAoJ3N0cmluZycgIT09IHR5cGVvZiBwYXRoKSB7XG4gICAgLy8gbmV3IERvY3VtZW50KHsga2V5OiB2YWwgfSlcblxuICAgIGlmIChudWxsID09PSBwYXRoIHx8IHVuZGVmaW5lZCA9PT0gcGF0aCkge1xuICAgICAgdmFyIF90ZW1wID0gcGF0aDtcbiAgICAgIHBhdGggPSB2YWw7XG4gICAgICB2YWwgPSBfdGVtcDtcblxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgcHJlZml4ID0gdmFsXG4gICAgICAgID8gdmFsICsgJy4nXG4gICAgICAgIDogJyc7XG5cbiAgICAgIGlmIChwYXRoIGluc3RhbmNlb2YgRG9jdW1lbnQpIHBhdGggPSBwYXRoLl9kb2M7XG5cbiAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMocGF0aClcbiAgICAgICAgLCBpID0ga2V5cy5sZW5ndGhcbiAgICAgICAgLCBwYXRodHlwZVxuICAgICAgICAsIGtleTtcblxuXG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGtleSA9IGtleXNbaV07XG4gICAgICAgIHBhdGh0eXBlID0gdGhpcy5zY2hlbWEucGF0aFR5cGUocHJlZml4ICsga2V5KTtcbiAgICAgICAgaWYgKG51bGwgIT0gcGF0aFtrZXldXG4gICAgICAgICAgICAvLyBuZWVkIHRvIGtub3cgaWYgcGxhaW4gb2JqZWN0IC0gbm8gQnVmZmVyLCBPYmplY3RJZCwgcmVmLCBldGNcbiAgICAgICAgICAgICYmIF8uaXNQbGFpbk9iamVjdChwYXRoW2tleV0pXG4gICAgICAgICAgICAmJiAoICFwYXRoW2tleV0uY29uc3RydWN0b3IgfHwgJ09iamVjdCcgPT0gdXRpbHMuZ2V0RnVuY3Rpb25OYW1lKHBhdGhba2V5XS5jb25zdHJ1Y3RvcikgKVxuICAgICAgICAgICAgJiYgJ3ZpcnR1YWwnICE9IHBhdGh0eXBlXG4gICAgICAgICAgICAmJiAhKCB0aGlzLiRfX3BhdGgoIHByZWZpeCArIGtleSApIGluc3RhbmNlb2YgTWl4ZWRTY2hlbWEgKVxuICAgICAgICAgICAgJiYgISggdGhpcy5zY2hlbWEucGF0aHNba2V5XSAmJiB0aGlzLnNjaGVtYS5wYXRoc1trZXldLm9wdGlvbnMucmVmIClcbiAgICAgICAgICApe1xuXG4gICAgICAgICAgdGhpcy5zZXQocGF0aFtrZXldLCBwcmVmaXggKyBrZXksIGNvbnN0cnVjdGluZyk7XG5cbiAgICAgICAgfSBlbHNlIGlmIChzdHJpY3QpIHtcbiAgICAgICAgICBpZiAoJ3JlYWwnID09PSBwYXRodHlwZSB8fCAndmlydHVhbCcgPT09IHBhdGh0eXBlKSB7XG4gICAgICAgICAgICB0aGlzLnNldChwcmVmaXggKyBrZXksIHBhdGhba2V5XSwgY29uc3RydWN0aW5nKTtcblxuICAgICAgICAgIH0gZWxzZSBpZiAoJ3Rocm93JyA9PSBzdHJpY3QpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkZpZWxkIGBcIiArIGtleSArIFwiYCBpcyBub3QgaW4gc2NoZW1hLlwiKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIGlmICh1bmRlZmluZWQgIT09IHBhdGhba2V5XSkge1xuICAgICAgICAgIHRoaXMuc2V0KHByZWZpeCArIGtleSwgcGF0aFtrZXldLCBjb25zdHJ1Y3RpbmcpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfVxuXG4gIC8vIGVuc3VyZSBfc3RyaWN0IGlzIGhvbm9yZWQgZm9yIG9iaiBwcm9wc1xuICAvLyBkb2NzY2hlbWEgPSBuZXcgU2NoZW1hKHsgcGF0aDogeyBuZXN0OiAnc3RyaW5nJyB9fSlcbiAgLy8gZG9jLnNldCgncGF0aCcsIG9iaik7XG4gIHZhciBwYXRoVHlwZSA9IHRoaXMuc2NoZW1hLnBhdGhUeXBlKHBhdGgpO1xuICBpZiAoJ25lc3RlZCcgPT0gcGF0aFR5cGUgJiYgdmFsICYmIF8uaXNQbGFpbk9iamVjdCh2YWwpICYmXG4gICAgICAoIXZhbC5jb25zdHJ1Y3RvciB8fCAnT2JqZWN0JyA9PSB1dGlscy5nZXRGdW5jdGlvbk5hbWUodmFsLmNvbnN0cnVjdG9yKSkpIHtcbiAgICBpZiAoIW1lcmdlKSB0aGlzLnNldFZhbHVlKHBhdGgsIG51bGwpO1xuICAgIHRoaXMuc2V0KHZhbCwgcGF0aCwgY29uc3RydWN0aW5nKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHZhciBzY2hlbWE7XG4gIHZhciBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcbiAgdmFyIHN1YnBhdGg7XG5cbiAgaWYgKCdhZGhvY09yVW5kZWZpbmVkJyA9PSBwYXRoVHlwZSAmJiBzdHJpY3QpIHtcblxuICAgIC8vIGNoZWNrIGZvciByb290cyB0aGF0IGFyZSBNaXhlZCB0eXBlc1xuICAgIHZhciBtaXhlZDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHN1YnBhdGggPSBwYXJ0cy5zbGljZSgwLCBpKzEpLmpvaW4oJy4nKTtcbiAgICAgIHNjaGVtYSA9IHRoaXMuc2NoZW1hLnBhdGgoc3VicGF0aCk7XG4gICAgICBpZiAoc2NoZW1hIGluc3RhbmNlb2YgTWl4ZWRTY2hlbWEpIHtcbiAgICAgICAgLy8gYWxsb3cgY2hhbmdlcyB0byBzdWIgcGF0aHMgb2YgbWl4ZWQgdHlwZXNcbiAgICAgICAgbWl4ZWQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIW1peGVkKSB7XG4gICAgICBpZiAoJ3Rocm93JyA9PSBzdHJpY3QpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRmllbGQgYFwiICsgcGF0aCArIFwiYCBpcyBub3QgaW4gc2NoZW1hLlwiKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICB9IGVsc2UgaWYgKCd2aXJ0dWFsJyA9PSBwYXRoVHlwZSkge1xuICAgIHNjaGVtYSA9IHRoaXMuc2NoZW1hLnZpcnR1YWxwYXRoKHBhdGgpO1xuICAgIHNjaGVtYS5hcHBseVNldHRlcnModmFsLCB0aGlzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSBlbHNlIHtcbiAgICBzY2hlbWEgPSB0aGlzLiRfX3BhdGgocGF0aCk7XG4gIH1cblxuICB2YXIgcGF0aFRvTWFyaztcblxuICAvLyBXaGVuIHVzaW5nIHRoZSAkc2V0IG9wZXJhdG9yIHRoZSBwYXRoIHRvIHRoZSBmaWVsZCBtdXN0IGFscmVhZHkgZXhpc3QuXG4gIC8vIEVsc2UgbW9uZ29kYiB0aHJvd3M6IFwiTEVGVF9TVUJGSUVMRCBvbmx5IHN1cHBvcnRzIE9iamVjdFwiXG5cbiAgaWYgKHBhcnRzLmxlbmd0aCA8PSAxKSB7XG4gICAgcGF0aFRvTWFyayA9IHBhdGg7XG4gIH0gZWxzZSB7XG4gICAgZm9yICggaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7ICsraSApIHtcbiAgICAgIHN1YnBhdGggPSBwYXJ0cy5zbGljZSgwLCBpICsgMSkuam9pbignLicpO1xuICAgICAgaWYgKHRoaXMuaXNEaXJlY3RNb2RpZmllZChzdWJwYXRoKSAvLyBlYXJsaWVyIHByZWZpeGVzIHRoYXQgYXJlIGFscmVhZHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbWFya2VkIGFzIGRpcnR5IGhhdmUgcHJlY2VkZW5jZVxuICAgICAgICAgIHx8IHRoaXMuZ2V0KHN1YnBhdGgpID09PSBudWxsKSB7XG4gICAgICAgIHBhdGhUb01hcmsgPSBzdWJwYXRoO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXBhdGhUb01hcmspIHBhdGhUb01hcmsgPSBwYXRoO1xuICB9XG5cbiAgLy8gaWYgdGhpcyBkb2MgaXMgYmVpbmcgY29uc3RydWN0ZWQgd2Ugc2hvdWxkIG5vdCB0cmlnZ2VyIGdldHRlcnNcbiAgdmFyIHByaW9yVmFsID0gY29uc3RydWN0aW5nXG4gICAgPyB1bmRlZmluZWRcbiAgICA6IHRoaXMuZ2V0VmFsdWUocGF0aCk7XG5cbiAgaWYgKCFzY2hlbWEgfHwgdW5kZWZpbmVkID09PSB2YWwpIHtcbiAgICB0aGlzLiRfX3NldChwYXRoVG9NYXJrLCBwYXRoLCBjb25zdHJ1Y3RpbmcsIHBhcnRzLCBzY2hlbWEsIHZhbCwgcHJpb3JWYWwpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgc2hvdWxkU2V0ID0gdGhpcy4kX190cnkoZnVuY3Rpb24oKXtcbiAgICB2YWwgPSBzY2hlbWEuYXBwbHlTZXR0ZXJzKHZhbCwgc2VsZiwgZmFsc2UsIHByaW9yVmFsKTtcbiAgfSk7XG5cbiAgaWYgKHNob3VsZFNldCkge1xuICAgIHRoaXMuJF9fc2V0KHBhdGhUb01hcmssIHBhdGgsIGNvbnN0cnVjdGluZywgcGFydHMsIHNjaGVtYSwgdmFsLCBwcmlvclZhbCk7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIHdlIHNob3VsZCBtYXJrIHRoaXMgY2hhbmdlIGFzIG1vZGlmaWVkLlxuICpcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHByaXZhdGVcbiAqIEBtZXRob2QgJF9fc2hvdWxkTW9kaWZ5XG4gKiBAbWVtYmVyT2YgRG9jdW1lbnRcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLiRfX3Nob3VsZE1vZGlmeSA9IGZ1bmN0aW9uIChcbiAgICBwYXRoVG9NYXJrLCBwYXRoLCBjb25zdHJ1Y3RpbmcsIHBhcnRzLCBzY2hlbWEsIHZhbCwgcHJpb3JWYWwpIHtcblxuICBpZiAodGhpcy5pc05ldykgcmV0dXJuIHRydWU7XG5cbiAgaWYgKCB1bmRlZmluZWQgPT09IHZhbCAmJiAhdGhpcy5pc1NlbGVjdGVkKHBhdGgpICkge1xuICAgIC8vIHdoZW4gYSBwYXRoIGlzIG5vdCBzZWxlY3RlZCBpbiBhIHF1ZXJ5LCBpdHMgaW5pdGlhbFxuICAgIC8vIHZhbHVlIHdpbGwgYmUgdW5kZWZpbmVkLlxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKHVuZGVmaW5lZCA9PT0gdmFsICYmIHBhdGggaW4gdGhpcy4kX18uYWN0aXZlUGF0aHMuc3RhdGVzLmRlZmF1bHQpIHtcbiAgICAvLyB3ZSdyZSBqdXN0IHVuc2V0dGluZyB0aGUgZGVmYXVsdCB2YWx1ZSB3aGljaCB3YXMgbmV2ZXIgc2F2ZWRcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoIXV0aWxzLmRlZXBFcXVhbCh2YWwsIHByaW9yVmFsIHx8IHRoaXMuZ2V0KHBhdGgpKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy/RgtC10YHRgiDQvdC1INC/0YDQvtGF0L7QtNC40YIg0LjQty3Qt9CwINC90LDQu9C40YfQuNGPINC70LjRiNC90LXQs9C+INC/0L7Qu9GPINCyIHN0YXRlcy5kZWZhdWx0IChjb21tZW50cylcbiAgLy8g0J3QsCDRgdCw0LzQvtC8INC00LXQu9C1INC/0L7Qu9C1INCy0YDQvtC00LUg0Lgg0L3QtSDQu9C40YjQvdC10LVcbiAgLy9jb25zb2xlLmluZm8oIHBhdGgsIHBhdGggaW4gdGhpcy4kX18uYWN0aXZlUGF0aHMuc3RhdGVzLmRlZmF1bHQgKTtcbiAgLy9jb25zb2xlLmxvZyggdGhpcy4kX18uYWN0aXZlUGF0aHMgKTtcblxuICAvLyDQmtC+0LPQtNCwINC80Ysg0YPRgdGC0LDQvdCw0LLQu9C40LLQsNC10Lwg0YLQsNC60L7QtSDQttC1INC30L3QsNGH0LXQvdC40LUg0LrQsNC6IGRlZmF1bHRcbiAgLy8g0J3QtSDQv9C+0L3Rj9GC0L3QviDQt9Cw0YfQtdC8INC80LDQvdCz0YPRgdGCINC10LPQviDQvtCx0L3QvtCy0LvRj9C7XG4gIC8qIVxuICBpZiAoIWNvbnN0cnVjdGluZyAmJlxuICAgICAgbnVsbCAhPSB2YWwgJiZcbiAgICAgIHBhdGggaW4gdGhpcy4kX18uYWN0aXZlUGF0aHMuc3RhdGVzLmRlZmF1bHQgJiZcbiAgICAgIHV0aWxzLmRlZXBFcXVhbCh2YWwsIHNjaGVtYS5nZXREZWZhdWx0KHRoaXMsIGNvbnN0cnVjdGluZykpICkge1xuXG4gICAgLy9jb25zb2xlLmxvZyggcGF0aFRvTWFyaywgdGhpcy4kX18uYWN0aXZlUGF0aHMuc3RhdGVzLm1vZGlmeSApO1xuXG4gICAgLy8gYSBwYXRoIHdpdGggYSBkZWZhdWx0IHdhcyAkdW5zZXQgb24gdGhlIHNlcnZlclxuICAgIC8vIGFuZCB0aGUgdXNlciBpcyBzZXR0aW5nIGl0IHRvIHRoZSBzYW1lIHZhbHVlIGFnYWluXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgKi9cblxuICByZXR1cm4gZmFsc2U7XG59O1xuXG4vKipcbiAqIEhhbmRsZXMgdGhlIGFjdHVhbCBzZXR0aW5nIG9mIHRoZSB2YWx1ZSBhbmQgbWFya2luZyB0aGUgcGF0aCBtb2RpZmllZCBpZiBhcHByb3ByaWF0ZS5cbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqIEBtZXRob2QgJF9fc2V0XG4gKiBAbWVtYmVyT2YgRG9jdW1lbnRcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLiRfX3NldCA9IGZ1bmN0aW9uICggcGF0aFRvTWFyaywgcGF0aCwgY29uc3RydWN0aW5nLCBwYXJ0cywgc2NoZW1hLCB2YWwsIHByaW9yVmFsICkge1xuICB2YXIgc2hvdWxkTW9kaWZ5ID0gdGhpcy4kX19zaG91bGRNb2RpZnkuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICBpZiAoc2hvdWxkTW9kaWZ5KSB7XG4gICAgdGhpcy5tYXJrTW9kaWZpZWQocGF0aFRvTWFyaywgdmFsKTtcbiAgfVxuXG4gIHZhciBvYmogPSB0aGlzLl9kb2NcbiAgICAsIGkgPSAwXG4gICAgLCBsID0gcGFydHMubGVuZ3RoO1xuXG4gIGZvciAoOyBpIDwgbDsgaSsrKSB7XG4gICAgdmFyIG5leHQgPSBpICsgMVxuICAgICAgLCBsYXN0ID0gbmV4dCA9PT0gbDtcblxuICAgIGlmICggbGFzdCApIHtcbiAgICAgIG9ialtwYXJ0c1tpXV0gPSB2YWw7XG5cbiAgICAgIHRoaXMuYWRhcHRlckhvb2tzLmRvY3VtZW50U2V0VmFsdWUuY2FsbCggdGhpcywgdGhpcywgcGF0aCwgdmFsICk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG9ialtwYXJ0c1tpXV0gJiYgJ09iamVjdCcgPT09IHV0aWxzLmdldEZ1bmN0aW9uTmFtZShvYmpbcGFydHNbaV1dLmNvbnN0cnVjdG9yKSkge1xuICAgICAgICBvYmogPSBvYmpbcGFydHNbaV1dO1xuXG4gICAgICB9IGVsc2UgaWYgKG9ialtwYXJ0c1tpXV0gJiYgJ0VtYmVkZGVkRG9jdW1lbnQnID09PSB1dGlscy5nZXRGdW5jdGlvbk5hbWUob2JqW3BhcnRzW2ldXS5jb25zdHJ1Y3RvcikgKSB7XG4gICAgICAgIG9iaiA9IG9ialtwYXJ0c1tpXV07XG5cbiAgICAgIH0gZWxzZSBpZiAob2JqW3BhcnRzW2ldXSAmJiBBcnJheS5pc0FycmF5KG9ialtwYXJ0c1tpXV0pKSB7XG4gICAgICAgIG9iaiA9IG9ialtwYXJ0c1tpXV07XG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9iaiA9IG9ialtwYXJ0c1tpXV0gPSB7fTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogR2V0cyBhIHJhdyB2YWx1ZSBmcm9tIGEgcGF0aCAobm8gZ2V0dGVycylcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQGFwaSBwcml2YXRlXG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS5nZXRWYWx1ZSA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gIHJldHVybiB1dGlscy5nZXRWYWx1ZShwYXRoLCB0aGlzLl9kb2MpO1xufTtcblxuLyoqXG4gKiBTZXRzIGEgcmF3IHZhbHVlIGZvciBhIHBhdGggKG5vIGNhc3RpbmcsIHNldHRlcnMsIHRyYW5zZm9ybWF0aW9ucylcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLnNldFZhbHVlID0gZnVuY3Rpb24gKHBhdGgsIHZhbHVlKSB7XG4gIHV0aWxzLnNldFZhbHVlKHBhdGgsIHZhbHVlLCB0aGlzLl9kb2MpO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgdmFsdWUgb2YgYSBwYXRoLlxuICpcbiAqICMjIyNFeGFtcGxlXG4gKlxuICogICAgIC8vIHBhdGhcbiAqICAgICBkb2MuZ2V0KCdhZ2UnKSAvLyA0N1xuICpcbiAqICAgICAvLyBkeW5hbWljIGNhc3RpbmcgdG8gYSBzdHJpbmdcbiAqICAgICBkb2MuZ2V0KCdhZ2UnLCBTdHJpbmcpIC8vIFwiNDdcIlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge1NjaGVtYXxTdHJpbmd8TnVtYmVyfSBbdHlwZV0gb3B0aW9uYWxseSBzcGVjaWZ5IGEgdHlwZSBmb3Igb24tdGhlLWZseSBhdHRyaWJ1dGVzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKHBhdGgsIHR5cGUpIHtcbiAgdmFyIGFkaG9jcztcbiAgaWYgKHR5cGUpIHtcbiAgICBhZGhvY3MgPSB0aGlzLiRfXy5hZGhvY1BhdGhzIHx8ICh0aGlzLiRfXy5hZGhvY1BhdGhzID0ge30pO1xuICAgIGFkaG9jc1twYXRoXSA9IFNjaGVtYS5pbnRlcnByZXRBc1R5cGUocGF0aCwgdHlwZSk7XG4gIH1cblxuICB2YXIgc2NoZW1hID0gdGhpcy4kX19wYXRoKHBhdGgpIHx8IHRoaXMuc2NoZW1hLnZpcnR1YWxwYXRoKHBhdGgpXG4gICAgLCBwaWVjZXMgPSBwYXRoLnNwbGl0KCcuJylcbiAgICAsIG9iaiA9IHRoaXMuX2RvYztcblxuICBmb3IgKHZhciBpID0gMCwgbCA9IHBpZWNlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBvYmogPSB1bmRlZmluZWQgPT09IG9iaiB8fCBudWxsID09PSBvYmpcbiAgICAgID8gdW5kZWZpbmVkXG4gICAgICA6IG9ialtwaWVjZXNbaV1dO1xuICB9XG5cbiAgaWYgKHNjaGVtYSkge1xuICAgIG9iaiA9IHNjaGVtYS5hcHBseUdldHRlcnMob2JqLCB0aGlzKTtcbiAgfVxuXG4gIHRoaXMuYWRhcHRlckhvb2tzLmRvY3VtZW50R2V0VmFsdWUuY2FsbCggdGhpcywgdGhpcywgcGF0aCApO1xuXG4gIHJldHVybiBvYmo7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIHNjaGVtYXR5cGUgZm9yIHRoZSBnaXZlbiBgcGF0aGAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEBhcGkgcHJpdmF0ZVxuICogQG1ldGhvZCAkX19wYXRoXG4gKiBAbWVtYmVyT2YgRG9jdW1lbnRcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLiRfX3BhdGggPSBmdW5jdGlvbiAocGF0aCkge1xuICB2YXIgYWRob2NzID0gdGhpcy4kX18uYWRob2NQYXRoc1xuICAgICwgYWRob2NUeXBlID0gYWRob2NzICYmIGFkaG9jc1twYXRoXTtcblxuICBpZiAoYWRob2NUeXBlKSB7XG4gICAgcmV0dXJuIGFkaG9jVHlwZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdGhpcy5zY2hlbWEucGF0aChwYXRoKTtcbiAgfVxufTtcblxuLyoqXG4gKiBNYXJrcyB0aGUgcGF0aCBhcyBoYXZpbmcgcGVuZGluZyBjaGFuZ2VzIHRvIHdyaXRlIHRvIHRoZSBkYi5cbiAqXG4gKiBfVmVyeSBoZWxwZnVsIHdoZW4gdXNpbmcgW01peGVkXSguL3NjaGVtYXR5cGVzLmh0bWwjbWl4ZWQpIHR5cGVzLl9cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgZG9jLm1peGVkLnR5cGUgPSAnY2hhbmdlZCc7XG4gKiAgICAgZG9jLm1hcmtNb2RpZmllZCgnbWl4ZWQudHlwZScpO1xuICogICAgIGRvYy5zYXZlKCkgLy8gY2hhbmdlcyB0byBtaXhlZC50eXBlIGFyZSBub3cgcGVyc2lzdGVkXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggdGhlIHBhdGggdG8gbWFyayBtb2RpZmllZFxuICogQGFwaSBwdWJsaWNcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLm1hcmtNb2RpZmllZCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gIHRoaXMuJF9fLmFjdGl2ZVBhdGhzLm1vZGlmeShwYXRoKTtcbn07XG5cbi8qKlxuICogQ2F0Y2hlcyBlcnJvcnMgdGhhdCBvY2N1ciBkdXJpbmcgZXhlY3V0aW9uIG9mIGBmbmAgYW5kIHN0b3JlcyB0aGVtIHRvIGxhdGVyIGJlIHBhc3NlZCB3aGVuIGBzYXZlKClgIGlzIGV4ZWN1dGVkLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIGZ1bmN0aW9uIHRvIGV4ZWN1dGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBbc2NvcGVdIHRoZSBzY29wZSB3aXRoIHdoaWNoIHRvIGNhbGwgZm5cbiAqIEBhcGkgcHJpdmF0ZVxuICogQG1ldGhvZCAkX190cnlcbiAqIEBtZW1iZXJPZiBEb2N1bWVudFxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuJF9fdHJ5ID0gZnVuY3Rpb24gKGZuLCBzY29wZSkge1xuICB2YXIgcmVzO1xuICB0cnkge1xuICAgIGZuLmNhbGwoc2NvcGUpO1xuICAgIHJlcyA9IHRydWU7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICB0aGlzLiRfX2Vycm9yKGUpO1xuICAgIHJlcyA9IGZhbHNlO1xuICB9XG4gIHJldHVybiByZXM7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGxpc3Qgb2YgcGF0aHMgdGhhdCBoYXZlIGJlZW4gbW9kaWZpZWQuXG4gKlxuICogQHJldHVybiB7QXJyYXl9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5Eb2N1bWVudC5wcm90b3R5cGUubW9kaWZpZWRQYXRocyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGRpcmVjdE1vZGlmaWVkUGF0aHMgPSBPYmplY3Qua2V5cyh0aGlzLiRfXy5hY3RpdmVQYXRocy5zdGF0ZXMubW9kaWZ5KTtcblxuICByZXR1cm4gZGlyZWN0TW9kaWZpZWRQYXRocy5yZWR1Y2UoZnVuY3Rpb24gKGxpc3QsIHBhdGgpIHtcbiAgICB2YXIgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XG4gICAgcmV0dXJuIGxpc3QuY29uY2F0KHBhcnRzLnJlZHVjZShmdW5jdGlvbiAoY2hhaW5zLCBwYXJ0LCBpKSB7XG4gICAgICByZXR1cm4gY2hhaW5zLmNvbmNhdChwYXJ0cy5zbGljZSgwLCBpKS5jb25jYXQocGFydCkuam9pbignLicpKTtcbiAgICB9LCBbXSkpO1xuICB9LCBbXSk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGlzIGRvY3VtZW50IHdhcyBtb2RpZmllZCwgZWxzZSBmYWxzZS5cbiAqXG4gKiBJZiBgcGF0aGAgaXMgZ2l2ZW4sIGNoZWNrcyBpZiBhIHBhdGggb3IgYW55IGZ1bGwgcGF0aCBjb250YWluaW5nIGBwYXRoYCBhcyBwYXJ0IG9mIGl0cyBwYXRoIGNoYWluIGhhcyBiZWVuIG1vZGlmaWVkLlxuICpcbiAqICMjIyNFeGFtcGxlXG4gKlxuICogICAgIGRvYy5zZXQoJ2RvY3VtZW50cy4wLnRpdGxlJywgJ2NoYW5nZWQnKTtcbiAqICAgICBkb2MuaXNNb2RpZmllZCgpICAgICAgICAgICAgICAgICAgICAvLyB0cnVlXG4gKiAgICAgZG9jLmlzTW9kaWZpZWQoJ2RvY3VtZW50cycpICAgICAgICAgLy8gdHJ1ZVxuICogICAgIGRvYy5pc01vZGlmaWVkKCdkb2N1bWVudHMuMC50aXRsZScpIC8vIHRydWVcbiAqICAgICBkb2MuaXNEaXJlY3RNb2RpZmllZCgnZG9jdW1lbnRzJykgICAvLyBmYWxzZVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBbcGF0aF0gb3B0aW9uYWxcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuaXNNb2RpZmllZCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gIHJldHVybiBwYXRoXG4gICAgPyAhIX50aGlzLm1vZGlmaWVkUGF0aHMoKS5pbmRleE9mKHBhdGgpXG4gICAgOiB0aGlzLiRfXy5hY3RpdmVQYXRocy5zb21lKCdtb2RpZnknKTtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIGBwYXRoYCB3YXMgZGlyZWN0bHkgc2V0IGFuZCBtb2RpZmllZCwgZWxzZSBmYWxzZS5cbiAqXG4gKiAjIyMjRXhhbXBsZVxuICpcbiAqICAgICBkb2Muc2V0KCdkb2N1bWVudHMuMC50aXRsZScsICdjaGFuZ2VkJyk7XG4gKiAgICAgZG9jLmlzRGlyZWN0TW9kaWZpZWQoJ2RvY3VtZW50cy4wLnRpdGxlJykgLy8gdHJ1ZVxuICogICAgIGRvYy5pc0RpcmVjdE1vZGlmaWVkKCdkb2N1bWVudHMnKSAvLyBmYWxzZVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLmlzRGlyZWN0TW9kaWZpZWQgPSBmdW5jdGlvbiAocGF0aCkge1xuICByZXR1cm4gKHBhdGggaW4gdGhpcy4kX18uYWN0aXZlUGF0aHMuc3RhdGVzLm1vZGlmeSk7XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiBgcGF0aGAgd2FzIGluaXRpYWxpemVkLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLmlzSW5pdCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gIHJldHVybiAocGF0aCBpbiB0aGlzLiRfXy5hY3RpdmVQYXRocy5zdGF0ZXMuaW5pdCk7XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiBgcGF0aGAgd2FzIHNlbGVjdGVkIGluIHRoZSBzb3VyY2UgcXVlcnkgd2hpY2ggaW5pdGlhbGl6ZWQgdGhpcyBkb2N1bWVudC5cbiAqXG4gKiAjIyMjRXhhbXBsZVxuICpcbiAqICAgICBUaGluZy5maW5kT25lKCkuc2VsZWN0KCduYW1lJykuZXhlYyhmdW5jdGlvbiAoZXJyLCBkb2MpIHtcbiAqICAgICAgICBkb2MuaXNTZWxlY3RlZCgnbmFtZScpIC8vIHRydWVcbiAqICAgICAgICBkb2MuaXNTZWxlY3RlZCgnYWdlJykgIC8vIGZhbHNlXG4gKiAgICAgfSlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuRG9jdW1lbnQucHJvdG90eXBlLmlzU2VsZWN0ZWQgPSBmdW5jdGlvbiBpc1NlbGVjdGVkIChwYXRoKSB7XG4gIGlmICh0aGlzLiRfXy5zZWxlY3RlZCkge1xuXG4gICAgaWYgKCdfaWQnID09PSBwYXRoKSB7XG4gICAgICByZXR1cm4gMCAhPT0gdGhpcy4kX18uc2VsZWN0ZWQuX2lkO1xuICAgIH1cblxuICAgIHZhciBwYXRocyA9IE9iamVjdC5rZXlzKHRoaXMuJF9fLnNlbGVjdGVkKVxuICAgICAgLCBpID0gcGF0aHMubGVuZ3RoXG4gICAgICAsIGluY2x1c2l2ZSA9IGZhbHNlXG4gICAgICAsIGN1cjtcblxuICAgIGlmICgxID09PSBpICYmICdfaWQnID09PSBwYXRoc1swXSkge1xuICAgICAgLy8gb25seSBfaWQgd2FzIHNlbGVjdGVkLlxuICAgICAgcmV0dXJuIDAgPT09IHRoaXMuJF9fLnNlbGVjdGVkLl9pZDtcbiAgICB9XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBjdXIgPSBwYXRoc1tpXTtcbiAgICAgIGlmICgnX2lkJyA9PSBjdXIpIGNvbnRpbnVlO1xuICAgICAgaW5jbHVzaXZlID0gISEgdGhpcy4kX18uc2VsZWN0ZWRbY3VyXTtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGlmIChwYXRoIGluIHRoaXMuJF9fLnNlbGVjdGVkKSB7XG4gICAgICByZXR1cm4gaW5jbHVzaXZlO1xuICAgIH1cblxuICAgIGkgPSBwYXRocy5sZW5ndGg7XG4gICAgdmFyIHBhdGhEb3QgPSBwYXRoICsgJy4nO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgY3VyID0gcGF0aHNbaV07XG4gICAgICBpZiAoJ19pZCcgPT0gY3VyKSBjb250aW51ZTtcblxuICAgICAgaWYgKDAgPT09IGN1ci5pbmRleE9mKHBhdGhEb3QpKSB7XG4gICAgICAgIHJldHVybiBpbmNsdXNpdmU7XG4gICAgICB9XG5cbiAgICAgIGlmICgwID09PSBwYXRoRG90LmluZGV4T2YoY3VyICsgJy4nKSkge1xuICAgICAgICByZXR1cm4gaW5jbHVzaXZlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAhIGluY2x1c2l2ZTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuLyoqXG4gKiBFeGVjdXRlcyByZWdpc3RlcmVkIHZhbGlkYXRpb24gcnVsZXMgZm9yIHRoaXMgZG9jdW1lbnQuXG4gKlxuICogIyMjI05vdGU6XG4gKlxuICogVGhpcyBtZXRob2QgaXMgY2FsbGVkIGBwcmVgIHNhdmUgYW5kIGlmIGEgdmFsaWRhdGlvbiBydWxlIGlzIHZpb2xhdGVkLCBbc2F2ZV0oI21vZGVsX01vZGVsLXNhdmUpIGlzIGFib3J0ZWQgYW5kIHRoZSBlcnJvciBpcyByZXR1cm5lZCB0byB5b3VyIGBjYWxsYmFja2AuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIGRvYy52YWxpZGF0ZShmdW5jdGlvbiAoZXJyKSB7XG4gKiAgICAgICBpZiAoZXJyKSBoYW5kbGVFcnJvcihlcnIpO1xuICogICAgICAgZWxzZSAvLyB2YWxpZGF0aW9uIHBhc3NlZFxuICogICAgIH0pO1xuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNiIGNhbGxlZCBhZnRlciB2YWxpZGF0aW9uIGNvbXBsZXRlcywgcGFzc2luZyBhbiBlcnJvciBpZiBvbmUgb2NjdXJyZWRcbiAqIEBhcGkgcHVibGljXG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS52YWxpZGF0ZSA9IGZ1bmN0aW9uIChjYikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgLy8gb25seSB2YWxpZGF0ZSByZXF1aXJlZCBmaWVsZHMgd2hlbiBuZWNlc3NhcnlcbiAgdmFyIHBhdGhzID0gT2JqZWN0LmtleXModGhpcy4kX18uYWN0aXZlUGF0aHMuc3RhdGVzLnJlcXVpcmUpLmZpbHRlcihmdW5jdGlvbiAocGF0aCkge1xuICAgIGlmICghc2VsZi5pc1NlbGVjdGVkKHBhdGgpICYmICFzZWxmLmlzTW9kaWZpZWQocGF0aCkpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSk7XG5cbiAgcGF0aHMgPSBwYXRocy5jb25jYXQoT2JqZWN0LmtleXModGhpcy4kX18uYWN0aXZlUGF0aHMuc3RhdGVzLmluaXQpKTtcbiAgcGF0aHMgPSBwYXRocy5jb25jYXQoT2JqZWN0LmtleXModGhpcy4kX18uYWN0aXZlUGF0aHMuc3RhdGVzLm1vZGlmeSkpO1xuICBwYXRocyA9IHBhdGhzLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLiRfXy5hY3RpdmVQYXRocy5zdGF0ZXMuZGVmYXVsdCkpO1xuXG4gIGlmICgwID09PSBwYXRocy5sZW5ndGgpIHtcbiAgICBjb21wbGV0ZSgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgdmFyIHZhbGlkYXRpbmcgPSB7fVxuICAgICwgdG90YWwgPSAwO1xuXG4gIHBhdGhzLmZvckVhY2godmFsaWRhdGVQYXRoKTtcbiAgcmV0dXJuIHRoaXM7XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGVQYXRoIChwYXRoKSB7XG4gICAgaWYgKHZhbGlkYXRpbmdbcGF0aF0pIHJldHVybjtcblxuICAgIHZhbGlkYXRpbmdbcGF0aF0gPSB0cnVlO1xuICAgIHRvdGFsKys7XG5cbiAgICB1dGlscy5zZXRJbW1lZGlhdGUoZnVuY3Rpb24oKXtcbiAgICAgIHZhciBwID0gc2VsZi5zY2hlbWEucGF0aChwYXRoKTtcbiAgICAgIGlmICghcCkgcmV0dXJuIC0tdG90YWwgfHwgY29tcGxldGUoKTtcblxuICAgICAgdmFyIHZhbCA9IHNlbGYuZ2V0VmFsdWUocGF0aCk7XG4gICAgICBwLmRvVmFsaWRhdGUodmFsLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBzZWxmLmludmFsaWRhdGUoXG4gICAgICAgICAgICAgIHBhdGhcbiAgICAgICAgICAgICwgZXJyXG4gICAgICAgICAgICAsIHVuZGVmaW5lZFxuICAgICAgICAgICAgLy8sIHRydWUgLy8gZW1iZWRkZWQgZG9jc1xuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICAtLXRvdGFsIHx8IGNvbXBsZXRlKCk7XG4gICAgICB9LCBzZWxmKTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbXBsZXRlICgpIHtcbiAgICB2YXIgZXJyID0gc2VsZi4kX18udmFsaWRhdGlvbkVycm9yO1xuICAgIHNlbGYuJF9fLnZhbGlkYXRpb25FcnJvciA9IHVuZGVmaW5lZDtcbiAgICBjYiAmJiBjYihlcnIpO1xuICB9XG59O1xuXG4vKipcbiAqIE1hcmtzIGEgcGF0aCBhcyBpbnZhbGlkLCBjYXVzaW5nIHZhbGlkYXRpb24gdG8gZmFpbC5cbiAqXG4gKiBUaGUgYGVycm9yTXNnYCBhcmd1bWVudCB3aWxsIGJlY29tZSB0aGUgbWVzc2FnZSBvZiB0aGUgYFZhbGlkYXRpb25FcnJvcmAuXG4gKlxuICogVGhlIGB2YWx1ZWAgYXJndW1lbnQgKGlmIHBhc3NlZCkgd2lsbCBiZSBhdmFpbGFibGUgdGhyb3VnaCB0aGUgYFZhbGlkYXRpb25FcnJvci52YWx1ZWAgcHJvcGVydHkuXG4gKlxuICogICAgIGRvYy5pbnZhbGlkYXRlKCdzaXplJywgJ211c3QgYmUgbGVzcyB0aGFuIDIwJywgMTQpO1xuXG4gKiAgICAgZG9jLnZhbGlkYXRlKGZ1bmN0aW9uIChlcnIpIHtcbiAqICAgICAgIGNvbnNvbGUubG9nKGVycilcbiAqICAgICAgIC8vIHByaW50c1xuICogICAgICAgeyBtZXNzYWdlOiAnVmFsaWRhdGlvbiBmYWlsZWQnLFxuICogICAgICAgICBuYW1lOiAnVmFsaWRhdGlvbkVycm9yJyxcbiAqICAgICAgICAgZXJyb3JzOlxuICogICAgICAgICAgeyBzaXplOlxuICogICAgICAgICAgICAgeyBtZXNzYWdlOiAnbXVzdCBiZSBsZXNzIHRoYW4gMjAnLFxuICogICAgICAgICAgICAgICBuYW1lOiAnVmFsaWRhdG9yRXJyb3InLFxuICogICAgICAgICAgICAgICBwYXRoOiAnc2l6ZScsXG4gKiAgICAgICAgICAgICAgIHR5cGU6ICd1c2VyIGRlZmluZWQnLFxuICogICAgICAgICAgICAgICB2YWx1ZTogMTQgfSB9IH1cbiAqICAgICB9KVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIHRoZSBmaWVsZCB0byBpbnZhbGlkYXRlXG4gKiBAcGFyYW0ge1N0cmluZ3xFcnJvcn0gZXJyb3JNc2cgdGhlIGVycm9yIHdoaWNoIHN0YXRlcyB0aGUgcmVhc29uIGBwYXRoYCB3YXMgaW52YWxpZFxuICogQHBhcmFtIHtPYmplY3R8U3RyaW5nfE51bWJlcnxhbnl9IHZhbHVlIG9wdGlvbmFsIGludmFsaWQgdmFsdWVcbiAqIEBhcGkgcHVibGljXG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS5pbnZhbGlkYXRlID0gZnVuY3Rpb24gKHBhdGgsIGVycm9yTXNnLCB2YWx1ZSkge1xuICBpZiAoIXRoaXMuJF9fLnZhbGlkYXRpb25FcnJvcikge1xuICAgIHRoaXMuJF9fLnZhbGlkYXRpb25FcnJvciA9IG5ldyBWYWxpZGF0aW9uRXJyb3IodGhpcyk7XG4gIH1cblxuICBpZiAoIWVycm9yTXNnIHx8ICdzdHJpbmcnID09PSB0eXBlb2YgZXJyb3JNc2cpIHtcbiAgICBlcnJvck1zZyA9IG5ldyBWYWxpZGF0b3JFcnJvcihwYXRoLCBlcnJvck1zZywgJ3VzZXIgZGVmaW5lZCcsIHZhbHVlKTtcbiAgfVxuXG4gIGlmICh0aGlzLiRfXy52YWxpZGF0aW9uRXJyb3IgPT0gZXJyb3JNc2cpIHJldHVybjtcblxuICB0aGlzLiRfXy52YWxpZGF0aW9uRXJyb3IuZXJyb3JzW3BhdGhdID0gZXJyb3JNc2c7XG59O1xuXG4vKipcbiAqIFJlc2V0cyB0aGUgaW50ZXJuYWwgbW9kaWZpZWQgc3RhdGUgb2YgdGhpcyBkb2N1bWVudC5cbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqIEByZXR1cm4ge0RvY3VtZW50fVxuICogQG1ldGhvZCAkX19yZXNldFxuICogQG1lbWJlck9mIERvY3VtZW50XG4gKi9cblxuRG9jdW1lbnQucHJvdG90eXBlLiRfX3Jlc2V0ID0gZnVuY3Rpb24gcmVzZXQgKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgdGhpcy4kX18uYWN0aXZlUGF0aHNcbiAgLm1hcCgnaW5pdCcsICdtb2RpZnknLCBmdW5jdGlvbiAoaSkge1xuICAgIHJldHVybiBzZWxmLmdldFZhbHVlKGkpO1xuICB9KVxuICAuZmlsdGVyKGZ1bmN0aW9uICh2YWwpIHtcbiAgICByZXR1cm4gdmFsICYmIHZhbC5pc1N0b3JhZ2VEb2N1bWVudEFycmF5ICYmIHZhbC5sZW5ndGg7XG4gIH0pXG4gIC5mb3JFYWNoKGZ1bmN0aW9uIChhcnJheSkge1xuICAgIHZhciBpID0gYXJyYXkubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHZhciBkb2MgPSBhcnJheVtpXTtcbiAgICAgIGlmICghZG9jKSBjb250aW51ZTtcbiAgICAgIGRvYy4kX19yZXNldCgpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gQ2xlYXIgJ21vZGlmeScoJ2RpcnR5JykgY2FjaGVcbiAgdGhpcy4kX18uYWN0aXZlUGF0aHMuY2xlYXIoJ21vZGlmeScpO1xuICB0aGlzLiRfXy52YWxpZGF0aW9uRXJyb3IgPSB1bmRlZmluZWQ7XG4gIHRoaXMuZXJyb3JzID0gdW5kZWZpbmVkO1xuICAvL2NvbnNvbGUubG9nKCBzZWxmLiRfXy5hY3RpdmVQYXRocy5zdGF0ZXMucmVxdWlyZSApO1xuICAvL1RPRE86INGC0YPRglxuICB0aGlzLnNjaGVtYS5yZXF1aXJlZFBhdGhzKCkuZm9yRWFjaChmdW5jdGlvbiAocGF0aCkge1xuICAgIHNlbGYuJF9fLmFjdGl2ZVBhdGhzLnJlcXVpcmUocGF0aCk7XG4gIH0pO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuXG4vKipcbiAqIFJldHVybnMgdGhpcyBkb2N1bWVudHMgZGlydHkgcGF0aHMgLyB2YWxzLlxuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICogQG1ldGhvZCAkX19kaXJ0eVxuICogQG1lbWJlck9mIERvY3VtZW50XG4gKi9cblxuRG9jdW1lbnQucHJvdG90eXBlLiRfX2RpcnR5ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgdmFyIGFsbCA9IHRoaXMuJF9fLmFjdGl2ZVBhdGhzLm1hcCgnbW9kaWZ5JywgZnVuY3Rpb24gKHBhdGgpIHtcbiAgICByZXR1cm4geyBwYXRoOiBwYXRoXG4gICAgICAgICAgICwgdmFsdWU6IHNlbGYuZ2V0VmFsdWUoIHBhdGggKVxuICAgICAgICAgICAsIHNjaGVtYTogc2VsZi4kX19wYXRoKCBwYXRoICkgfTtcbiAgfSk7XG5cbiAgLy8gU29ydCBkaXJ0eSBwYXRocyBpbiBhIGZsYXQgaGllcmFyY2h5LlxuICBhbGwuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgIHJldHVybiAoYS5wYXRoIDwgYi5wYXRoID8gLTEgOiAoYS5wYXRoID4gYi5wYXRoID8gMSA6IDApKTtcbiAgfSk7XG5cbiAgLy8gSWdub3JlIFwiZm9vLmFcIiBpZiBcImZvb1wiIGlzIGRpcnR5IGFscmVhZHkuXG4gIHZhciBtaW5pbWFsID0gW11cbiAgICAsIGxhc3RQYXRoXG4gICAgLCB0b3A7XG5cbiAgYWxsLmZvckVhY2goZnVuY3Rpb24oIGl0ZW0gKXtcbiAgICBsYXN0UGF0aCA9IGl0ZW0ucGF0aCArICcuJztcbiAgICBtaW5pbWFsLnB1c2goaXRlbSk7XG4gICAgdG9wID0gaXRlbTtcbiAgfSk7XG5cbiAgdG9wID0gbGFzdFBhdGggPSBudWxsO1xuICByZXR1cm4gbWluaW1hbDtcbn07XG5cbi8qIVxuICogQ29tcGlsZXMgc2NoZW1hcy5cbiAqICjRg9GB0YLQsNC90L7QstC40YLRjCDQs9C10YLRgtC10YDRiy/RgdC10YLRgtC10YDRiyDQvdCwINC/0L7Qu9GPINC00L7QutGD0LzQtdC90YLQsClcbiAqL1xuZnVuY3Rpb24gY29tcGlsZSAoc2VsZiwgdHJlZSwgcHJvdG8sIHByZWZpeCkge1xuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRyZWUpXG4gICAgLCBpID0ga2V5cy5sZW5ndGhcbiAgICAsIGxpbWJcbiAgICAsIGtleTtcblxuICB3aGlsZSAoaS0tKSB7XG4gICAga2V5ID0ga2V5c1tpXTtcbiAgICBsaW1iID0gdHJlZVtrZXldO1xuXG4gICAgZGVmaW5lKHNlbGZcbiAgICAgICAgLCBrZXlcbiAgICAgICAgLCAoKCdPYmplY3QnID09PSB1dGlscy5nZXRGdW5jdGlvbk5hbWUobGltYi5jb25zdHJ1Y3RvcilcbiAgICAgICAgICAgICAgICYmIE9iamVjdC5rZXlzKGxpbWIpLmxlbmd0aClcbiAgICAgICAgICAgICAgICYmICghbGltYi50eXBlIHx8IGxpbWIudHlwZS50eXBlKVxuICAgICAgICAgICAgICAgPyBsaW1iXG4gICAgICAgICAgICAgICA6IG51bGwpXG4gICAgICAgICwgcHJvdG9cbiAgICAgICAgLCBwcmVmaXhcbiAgICAgICAgLCBrZXlzKTtcbiAgfVxufVxuXG4vLyBnZXRzIGRlc2NyaXB0b3JzIGZvciBhbGwgcHJvcGVydGllcyBvZiBgb2JqZWN0YFxuLy8gbWFrZXMgYWxsIHByb3BlcnRpZXMgbm9uLWVudW1lcmFibGUgdG8gbWF0Y2ggcHJldmlvdXMgYmVoYXZpb3IgdG8gIzIyMTFcbmZ1bmN0aW9uIGdldE93blByb3BlcnR5RGVzY3JpcHRvcnMob2JqZWN0KSB7XG4gIHZhciByZXN1bHQgPSB7fTtcblxuICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvYmplY3QpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgcmVzdWx0W2tleV0gPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iamVjdCwga2V5KTtcbiAgICByZXN1bHRba2V5XS5lbnVtZXJhYmxlID0gZmFsc2U7XG4gIH0pO1xuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qIVxuICogRGVmaW5lcyB0aGUgYWNjZXNzb3IgbmFtZWQgcHJvcCBvbiB0aGUgaW5jb21pbmcgcHJvdG90eXBlLlxuICog0YLQsNC8INC20LUsINC/0L7Qu9GPINC00L7QutGD0LzQtdC90YLQsCDRgdC00LXQu9Cw0LXQvCDQvdCw0LHQu9GO0LTQsNC10LzRi9C80LhcbiAqL1xuZnVuY3Rpb24gZGVmaW5lIChzZWxmLCBwcm9wLCBzdWJwcm9wcywgcHJvdG90eXBlLCBwcmVmaXgsIGtleXMpIHtcbiAgcHJlZml4ID0gcHJlZml4IHx8ICcnO1xuICB2YXIgcGF0aCA9IChwcmVmaXggPyBwcmVmaXggKyAnLicgOiAnJykgKyBwcm9wO1xuXG4gIGlmIChzdWJwcm9wcykge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90b3R5cGUsIHByb3AsIHtcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgLCBjb25maWd1cmFibGU6IHRydWVcbiAgICAgICwgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgaWYgKCF0aGlzLiRfXy5nZXR0ZXJzKVxuICAgICAgICAgICAgdGhpcy4kX18uZ2V0dGVycyA9IHt9O1xuXG4gICAgICAgICAgaWYgKCF0aGlzLiRfXy5nZXR0ZXJzW3BhdGhdKSB7XG4gICAgICAgICAgICB2YXIgbmVzdGVkID0gT2JqZWN0LmNyZWF0ZShPYmplY3QuZ2V0UHJvdG90eXBlT2YodGhpcyksIGdldE93blByb3BlcnR5RGVzY3JpcHRvcnModGhpcykpO1xuXG4gICAgICAgICAgICAvLyBzYXZlIHNjb3BlIGZvciBuZXN0ZWQgZ2V0dGVycy9zZXR0ZXJzXG4gICAgICAgICAgICBpZiAoIXByZWZpeCkgbmVzdGVkLiRfXy5zY29wZSA9IHRoaXM7XG5cbiAgICAgICAgICAgIC8vIHNoYWRvdyBpbmhlcml0ZWQgZ2V0dGVycyBmcm9tIHN1Yi1vYmplY3RzIHNvXG4gICAgICAgICAgICAvLyB0aGluZy5uZXN0ZWQubmVzdGVkLm5lc3RlZC4uLiBkb2Vzbid0IG9jY3VyIChnaC0zNjYpXG4gICAgICAgICAgICB2YXIgaSA9IDBcbiAgICAgICAgICAgICAgLCBsZW4gPSBrZXlzLmxlbmd0aDtcblxuICAgICAgICAgICAgZm9yICg7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgICAgICAvLyBvdmVyLXdyaXRlIHRoZSBwYXJlbnRzIGdldHRlciB3aXRob3V0IHRyaWdnZXJpbmcgaXRcbiAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG5lc3RlZCwga2V5c1tpXSwge1xuICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2UgICAvLyBJdCBkb2Vzbid0IHNob3cgdXAuXG4gICAgICAgICAgICAgICAgLCB3cml0YWJsZTogdHJ1ZSAgICAgIC8vIFdlIGNhbiBzZXQgaXQgbGF0ZXIuXG4gICAgICAgICAgICAgICAgLCBjb25maWd1cmFibGU6IHRydWUgIC8vIFdlIGNhbiBPYmplY3QuZGVmaW5lUHJvcGVydHkgYWdhaW4uXG4gICAgICAgICAgICAgICAgLCB2YWx1ZTogdW5kZWZpbmVkICAgIC8vIEl0IHNoYWRvd3MgaXRzIHBhcmVudC5cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5lc3RlZC50b09iamVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KHBhdGgpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29tcGlsZSggc2VsZiwgc3VicHJvcHMsIG5lc3RlZCwgcGF0aCApO1xuICAgICAgICAgICAgdGhpcy4kX18uZ2V0dGVyc1twYXRoXSA9IG5lc3RlZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gdGhpcy4kX18uZ2V0dGVyc1twYXRoXTtcbiAgICAgICAgfVxuICAgICAgLCBzZXQ6IGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgaWYgKHYgaW5zdGFuY2VvZiBEb2N1bWVudCkgdiA9IHYudG9PYmplY3QoKTtcbiAgICAgICAgICByZXR1cm4gKHRoaXMuJF9fLnNjb3BlIHx8IHRoaXMpLnNldCggcGF0aCwgdiApO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgfSBlbHNlIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoIHByb3RvdHlwZSwgcHJvcCwge1xuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAsIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgLCBnZXQ6IGZ1bmN0aW9uICggKSB7IHJldHVybiB0aGlzLmdldC5jYWxsKHRoaXMuJF9fLnNjb3BlIHx8IHRoaXMsIHBhdGgpOyB9XG4gICAgICAsIHNldDogZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHRoaXMuc2V0LmNhbGwodGhpcy4kX18uc2NvcGUgfHwgdGhpcywgcGF0aCwgdik7IH1cbiAgICB9KTtcbiAgfVxuXG4gIHNlbGYuYWRhcHRlckhvb2tzLmRvY3VtZW50RGVmaW5lUHJvcGVydHkuY2FsbCggc2VsZiwgc2VsZiwgcHJvdG90eXBlLCBwcm9wLCBwcmVmaXgsIHBhdGggKTtcbiAgLy9zZWxmLmFkYXB0ZXJIb29rcy5kb2N1bWVudERlZmluZVByb3BlcnR5LmNhbGwoIHNlbGYsIHNlbGYsIHBhdGgsIHByb3RvdHlwZSApO1xufVxuXG4vKipcbiAqIEFzc2lnbnMvY29tcGlsZXMgYHNjaGVtYWAgaW50byB0aGlzIGRvY3VtZW50cyBwcm90b3R5cGUuXG4gKlxuICogQHBhcmFtIHtTY2hlbWF9IHNjaGVtYVxuICogQGFwaSBwcml2YXRlXG4gKiBAbWV0aG9kICRfX3NldFNjaGVtYVxuICogQG1lbWJlck9mIERvY3VtZW50XG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS4kX19zZXRTY2hlbWEgPSBmdW5jdGlvbiAoIHNjaGVtYSApIHtcbiAgdGhpcy5zY2hlbWEgPSBzY2hlbWE7XG4gIGNvbXBpbGUoIHRoaXMsIHNjaGVtYS50cmVlLCB0aGlzICk7XG59O1xuXG4vKipcbiAqIEdldCBhbGwgc3ViZG9jcyAoYnkgYmZzKVxuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICogQG1ldGhvZCAkX19nZXRBbGxTdWJkb2NzXG4gKiBAbWVtYmVyT2YgRG9jdW1lbnRcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLiRfX2dldEFsbFN1YmRvY3MgPSBmdW5jdGlvbiAoKSB7XG4gIERvY3VtZW50QXJyYXkgfHwgKERvY3VtZW50QXJyYXkgPSByZXF1aXJlKCcuL3R5cGVzL2RvY3VtZW50YXJyYXknKSk7XG4gIEVtYmVkZGVkID0gRW1iZWRkZWQgfHwgcmVxdWlyZSgnLi90eXBlcy9lbWJlZGRlZCcpO1xuXG4gIGZ1bmN0aW9uIGRvY1JlZHVjZXIoc2VlZCwgcGF0aCkge1xuICAgIHZhciB2YWwgPSB0aGlzW3BhdGhdO1xuICAgIGlmICh2YWwgaW5zdGFuY2VvZiBFbWJlZGRlZCkgc2VlZC5wdXNoKHZhbCk7XG4gICAgaWYgKHZhbCBpbnN0YW5jZW9mIERvY3VtZW50QXJyYXkpXG4gICAgICB2YWwuZm9yRWFjaChmdW5jdGlvbiBfZG9jUmVkdWNlKGRvYykge1xuICAgICAgICBpZiAoIWRvYyB8fCAhZG9jLl9kb2MpIHJldHVybjtcbiAgICAgICAgaWYgKGRvYyBpbnN0YW5jZW9mIEVtYmVkZGVkKSBzZWVkLnB1c2goZG9jKTtcbiAgICAgICAgc2VlZCA9IE9iamVjdC5rZXlzKGRvYy5fZG9jKS5yZWR1Y2UoZG9jUmVkdWNlci5iaW5kKGRvYy5fZG9jKSwgc2VlZCk7XG4gICAgICB9KTtcbiAgICByZXR1cm4gc2VlZDtcbiAgfVxuXG4gIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kb2MpLnJlZHVjZShkb2NSZWR1Y2VyLmJpbmQodGhpcyksIFtdKTtcbn07XG5cbi8qKlxuICogSGFuZGxlIGdlbmVyaWMgc2F2ZSBzdHVmZi5cbiAqIHRvIHNvbHZlICMxNDQ2IHVzZSB1c2UgaGllcmFyY2h5IGluc3RlYWQgb2YgaG9va3NcbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqIEBtZXRob2QgJF9fcHJlc2F2ZVZhbGlkYXRlXG4gKiBAbWVtYmVyT2YgRG9jdW1lbnRcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLiRfX3ByZXNhdmVWYWxpZGF0ZSA9IGZ1bmN0aW9uICRfX3ByZXNhdmVWYWxpZGF0ZSgpIHtcbiAgLy8gaWYgYW55IGRvYy5zZXQoKSBjYWxscyBmYWlsZWRcblxuICB2YXIgZG9jcyA9IHRoaXMuJF9fZ2V0QXJyYXlQYXRoc1RvVmFsaWRhdGUoKTtcblxuICB2YXIgZTIgPSBkb2NzLm1hcChmdW5jdGlvbiAoZG9jKSB7XG4gICAgcmV0dXJuIGRvYy4kX19wcmVzYXZlVmFsaWRhdGUoKTtcbiAgfSk7XG4gIHZhciBlMSA9IFt0aGlzLiRfXy5zYXZlRXJyb3JdLmNvbmNhdChlMik7XG4gIHZhciBlcnIgPSBlMS5maWx0ZXIoZnVuY3Rpb24gKHgpIHtyZXR1cm4geH0pWzBdO1xuICB0aGlzLiRfXy5zYXZlRXJyb3IgPSBudWxsO1xuXG4gIHJldHVybiBlcnI7XG59O1xuXG4vKipcbiAqIEdldCBhY3RpdmUgcGF0aCB0aGF0IHdlcmUgY2hhbmdlZCBhbmQgYXJlIGFycmF5c1xuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICogQG1ldGhvZCAkX19nZXRBcnJheVBhdGhzVG9WYWxpZGF0ZVxuICogQG1lbWJlck9mIERvY3VtZW50XG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS4kX19nZXRBcnJheVBhdGhzVG9WYWxpZGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgRG9jdW1lbnRBcnJheSB8fCAoRG9jdW1lbnRBcnJheSA9IHJlcXVpcmUoJy4vdHlwZXMvZG9jdW1lbnRhcnJheScpKTtcblxuICAvLyB2YWxpZGF0ZSBhbGwgZG9jdW1lbnQgYXJyYXlzLlxuICByZXR1cm4gdGhpcy4kX18uYWN0aXZlUGF0aHNcbiAgICAubWFwKCdpbml0JywgJ21vZGlmeScsIGZ1bmN0aW9uIChpKSB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRWYWx1ZShpKTtcbiAgICB9LmJpbmQodGhpcykpXG4gICAgLmZpbHRlcihmdW5jdGlvbiAodmFsKSB7XG4gICAgICByZXR1cm4gdmFsICYmIHZhbCBpbnN0YW5jZW9mIERvY3VtZW50QXJyYXkgJiYgdmFsLmxlbmd0aDtcbiAgICB9KS5yZWR1Y2UoZnVuY3Rpb24oc2VlZCwgYXJyYXkpIHtcbiAgICAgIHJldHVybiBzZWVkLmNvbmNhdChhcnJheSk7XG4gICAgfSwgW10pXG4gICAgLmZpbHRlcihmdW5jdGlvbiAoZG9jKSB7cmV0dXJuIGRvY30pO1xufTtcblxuLyoqXG4gKiBSZWdpc3RlcnMgYW4gZXJyb3JcbiAqXG4gKiBAcGFyYW0ge0Vycm9yfSBlcnJcbiAqIEBhcGkgcHJpdmF0ZVxuICogQG1ldGhvZCAkX19lcnJvclxuICogQG1lbWJlck9mIERvY3VtZW50XG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS4kX19lcnJvciA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgdGhpcy4kX18uc2F2ZUVycm9yID0gZXJyO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogUHJvZHVjZXMgYSBzcGVjaWFsIHF1ZXJ5IGRvY3VtZW50IG9mIHRoZSBtb2RpZmllZCBwcm9wZXJ0aWVzIHVzZWQgaW4gdXBkYXRlcy5cbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqIEBtZXRob2QgJF9fZGVsdGFcbiAqIEBtZW1iZXJPZiBEb2N1bWVudFxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuJF9fZGVsdGEgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBkaXJ0eSA9IHRoaXMuJF9fZGlydHkoKTtcblxuICB2YXIgZGVsdGEgPSB7fVxuICAgICwgbGVuID0gZGlydHkubGVuZ3RoXG4gICAgLCBkID0gMDtcblxuICBmb3IgKDsgZCA8IGxlbjsgKytkKSB7XG4gICAgdmFyIGRhdGEgPSBkaXJ0eVsgZCBdO1xuICAgIHZhciB2YWx1ZSA9IGRhdGEudmFsdWU7XG5cbiAgICB2YWx1ZSA9IHV0aWxzLmNsb25lKHZhbHVlLCB7IGRlcG9wdWxhdGU6IDEgfSk7XG4gICAgZGVsdGFbIGRhdGEucGF0aCBdID0gdmFsdWU7XG4gIH1cblxuICByZXR1cm4gZGVsdGE7XG59O1xuXG5Eb2N1bWVudC5wcm90b3R5cGUuJF9faGFuZGxlU2F2ZSA9IGZ1bmN0aW9uKCl7XG4gIC8vINCf0L7Qu9GD0YfQsNC10Lwg0YDQtdGB0YPRgNGBINC60L7Qu9C70LXQutGG0LjQuCwg0LrRg9C00LAg0LHRg9C00LXQvCDRgdC+0YXRgNCw0L3Rj9GC0Ywg0LTQsNC90L3Ri9C1XG4gIHZhciByZXNvdXJjZTtcbiAgaWYgKCB0aGlzLmNvbGxlY3Rpb24gKXtcbiAgICByZXNvdXJjZSA9IHRoaXMuY29sbGVjdGlvbi5hcGk7XG4gIH1cblxuICB2YXIgaW5uZXJQcm9taXNlID0gbmV3ICQuRGVmZXJyZWQoKTtcblxuICBpZiAoIHRoaXMuaXNOZXcgKSB7XG4gICAgLy8gc2VuZCBlbnRpcmUgZG9jXG4gICAgdmFyIG9iaiA9IHRoaXMudG9PYmplY3QoeyBkZXBvcHVsYXRlOiAxIH0pO1xuXG4gICAgaWYgKCAoIG9iaiB8fCB7fSApLmhhc093blByb3BlcnR5KCdfaWQnKSA9PT0gZmFsc2UgKSB7XG4gICAgICAvLyBkb2N1bWVudHMgbXVzdCBoYXZlIGFuIF9pZCBlbHNlIG1vbmdvb3NlIHdvbid0IGtub3dcbiAgICAgIC8vIHdoYXQgdG8gdXBkYXRlIGxhdGVyIGlmIG1vcmUgY2hhbmdlcyBhcmUgbWFkZS4gdGhlIHVzZXJcbiAgICAgIC8vIHdvdWxkbid0IGtub3cgd2hhdCBfaWQgd2FzIGdlbmVyYXRlZCBieSBtb25nb2RiIGVpdGhlclxuICAgICAgLy8gbm9yIHdvdWxkIHRoZSBPYmplY3RJZCBnZW5lcmF0ZWQgbXkgbW9uZ29kYiBuZWNlc3NhcmlseVxuICAgICAgLy8gbWF0Y2ggdGhlIHNjaGVtYSBkZWZpbml0aW9uLlxuICAgICAgaW5uZXJQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ2RvY3VtZW50IG11c3QgaGF2ZSBhbiBfaWQgYmVmb3JlIHNhdmluZycpKTtcbiAgICAgIHJldHVybiBpbm5lclByb21pc2U7XG4gICAgfVxuXG4gICAgLy8g0J/RgNC+0LLQtdGA0LrQsCDQvdCwINC+0LrRgNGD0LbQtdC90LjQtSDRgtC10YHRgtC+0LJcbiAgICAvLyDQpdC+0YLRjyDQvNC+0LbQvdC+INGC0LDQutC40Lwg0L7QsdGA0LDQt9C+0Lwg0L/RgNC+0YHRgtC+INC00LXQu9Cw0YLRjCDQstCw0LvQuNC00LDRhtC40Y4sINC00LDQttC1INC10YHQu9C4INC90LXRgiDQutC+0LvQu9C10LrRhtC40Lgg0LjQu9C4IGFwaVxuICAgIGlmICggIXJlc291cmNlICl7XG4gICAgICBpbm5lclByb21pc2UucmVzb2x2ZSggdGhpcyApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXNvdXJjZS5jcmVhdGUoIG9iaiApLmFsd2F5cyggaW5uZXJQcm9taXNlLnJlc29sdmUgKTtcbiAgICB9XG5cbiAgICB0aGlzLiRfX3Jlc2V0KCk7XG4gICAgdGhpcy5pc05ldyA9IGZhbHNlO1xuICAgIHRoaXMudHJpZ2dlcignaXNOZXcnLCBmYWxzZSk7XG4gICAgLy8gTWFrZSBpdCBwb3NzaWJsZSB0byByZXRyeSB0aGUgaW5zZXJ0XG4gICAgdGhpcy4kX18uaW5zZXJ0aW5nID0gdHJ1ZTtcblxuICB9IGVsc2Uge1xuICAgIC8vIE1ha2Ugc3VyZSB3ZSBkb24ndCB0cmVhdCBpdCBhcyBhIG5ldyBvYmplY3Qgb24gZXJyb3IsXG4gICAgLy8gc2luY2UgaXQgYWxyZWFkeSBleGlzdHNcbiAgICB0aGlzLiRfXy5pbnNlcnRpbmcgPSBmYWxzZTtcblxuICAgIHZhciBkZWx0YSA9IHRoaXMuJF9fZGVsdGEoKTtcblxuICAgIGlmICggIV8uaXNFbXB0eSggZGVsdGEgKSApIHtcbiAgICAgIHRoaXMuJF9fcmVzZXQoKTtcbiAgICAgIC8vINCf0YDQvtCy0LXRgNC60LAg0L3QsCDQvtC60YDRg9C20LXQvdC40LUg0YLQtdGB0YLQvtCyXG4gICAgICAvLyDQpdC+0YLRjyDQvNC+0LbQvdC+INGC0LDQutC40Lwg0L7QsdGA0LDQt9C+0Lwg0L/RgNC+0YHRgtC+INC00LXQu9Cw0YLRjCDQstCw0LvQuNC00LDRhtC40Y4sINC00LDQttC1INC10YHQu9C4INC90LXRgiDQutC+0LvQu9C10LrRhtC40Lgg0LjQu9C4IGFwaVxuICAgICAgaWYgKCAhcmVzb3VyY2UgKXtcbiAgICAgICAgaW5uZXJQcm9taXNlLnJlc29sdmUoIHRoaXMgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc291cmNlKCB0aGlzLmlkICkudXBkYXRlKCBkZWx0YSApLmFsd2F5cyggaW5uZXJQcm9taXNlLnJlc29sdmUgKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy4kX19yZXNldCgpO1xuICAgICAgaW5uZXJQcm9taXNlLnJlc29sdmUoIHRoaXMgKTtcbiAgICB9XG5cbiAgICB0aGlzLnRyaWdnZXIoJ2lzTmV3JywgZmFsc2UpO1xuICB9XG5cbiAgcmV0dXJuIGlubmVyUHJvbWlzZTtcbn07XG5cbi8qKlxuICogQGRlc2NyaXB0aW9uIFNhdmVzIHRoaXMgZG9jdW1lbnQuXG4gKlxuICogQGV4YW1wbGU6XG4gKlxuICogICAgIHByb2R1Y3Quc29sZCA9IERhdGUubm93KCk7XG4gKiAgICAgcHJvZHVjdC5zYXZlKGZ1bmN0aW9uIChlcnIsIHByb2R1Y3QsIG51bWJlckFmZmVjdGVkKSB7XG4gKiAgICAgICBpZiAoZXJyKSAuLlxuICogICAgIH0pXG4gKlxuICogQGRlc2NyaXB0aW9uIFRoZSBjYWxsYmFjayB3aWxsIHJlY2VpdmUgdGhyZWUgcGFyYW1ldGVycywgYGVycmAgaWYgYW4gZXJyb3Igb2NjdXJyZWQsIGBwcm9kdWN0YCB3aGljaCBpcyB0aGUgc2F2ZWQgYHByb2R1Y3RgLCBhbmQgYG51bWJlckFmZmVjdGVkYCB3aGljaCB3aWxsIGJlIDEgd2hlbiB0aGUgZG9jdW1lbnQgd2FzIGZvdW5kIGFuZCB1cGRhdGVkIGluIHRoZSBkYXRhYmFzZSwgb3RoZXJ3aXNlIDAuXG4gKlxuICogVGhlIGBmbmAgY2FsbGJhY2sgaXMgb3B0aW9uYWwuIElmIG5vIGBmbmAgaXMgcGFzc2VkIGFuZCB2YWxpZGF0aW9uIGZhaWxzLCB0aGUgdmFsaWRhdGlvbiBlcnJvciB3aWxsIGJlIGVtaXR0ZWQgb24gdGhlIGNvbm5lY3Rpb24gdXNlZCB0byBjcmVhdGUgdGhpcyBtb2RlbC5cbiAqIEBleGFtcGxlOlxuICogICAgIHZhciBkYiA9IG1vbmdvb3NlLmNyZWF0ZUNvbm5lY3Rpb24oLi4pO1xuICogICAgIHZhciBzY2hlbWEgPSBuZXcgU2NoZW1hKC4uKTtcbiAqICAgICB2YXIgUHJvZHVjdCA9IGRiLm1vZGVsKCdQcm9kdWN0Jywgc2NoZW1hKTtcbiAqXG4gKiAgICAgZGIub24oJ2Vycm9yJywgaGFuZGxlRXJyb3IpO1xuICpcbiAqIEBkZXNjcmlwdGlvbiBIb3dldmVyLCBpZiB5b3UgZGVzaXJlIG1vcmUgbG9jYWwgZXJyb3IgaGFuZGxpbmcgeW91IGNhbiBhZGQgYW4gYGVycm9yYCBsaXN0ZW5lciB0byB0aGUgbW9kZWwgYW5kIGhhbmRsZSBlcnJvcnMgdGhlcmUgaW5zdGVhZC5cbiAqIEBleGFtcGxlOlxuICogICAgIFByb2R1Y3Qub24oJ2Vycm9yJywgaGFuZGxlRXJyb3IpO1xuICpcbiAqIEBkZXNjcmlwdGlvbiBBcyBhbiBleHRyYSBtZWFzdXJlIG9mIGZsb3cgY29udHJvbCwgc2F2ZSB3aWxsIHJldHVybiBhIFByb21pc2UgKGJvdW5kIHRvIGBmbmAgaWYgcGFzc2VkKSBzbyBpdCBjb3VsZCBiZSBjaGFpbmVkLCBvciBob29rIHRvIHJlY2l2ZSBlcnJvcnNcbiAqIEBleGFtcGxlOlxuICogICAgIHByb2R1Y3Quc2F2ZSgpLnRoZW4oZnVuY3Rpb24gKHByb2R1Y3QsIG51bWJlckFmZmVjdGVkKSB7XG4gKiAgICAgICAgLi4uXG4gKiAgICAgfSkub25SZWplY3RlZChmdW5jdGlvbiAoZXJyKSB7XG4gKiAgICAgICAgYXNzZXJ0Lm9rKGVycilcbiAqICAgICB9KVxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb24oZXJyLCBwcm9kdWN0LCBOdW1iZXIpfSBbZG9uZV0gb3B0aW9uYWwgY2FsbGJhY2tcbiAqIEByZXR1cm4ge1Byb21pc2V9IFByb21pc2VcbiAqIEBhcGkgcHVibGljXG4gKiBAc2VlIG1pZGRsZXdhcmUgaHR0cDovL21vbmdvb3NlanMuY29tL2RvY3MvbWlkZGxld2FyZS5odG1sXG4gKi9cbkRvY3VtZW50LnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24gKCBkb25lICkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBmaW5hbFByb21pc2UgPSBuZXcgJC5EZWZlcnJlZCgpLmRvbmUoIGRvbmUgKTtcblxuICAvLyDQodC+0YXRgNCw0L3Rj9GC0Ywg0LTQvtC60YPQvNC10L3RgiDQvNC+0LbQvdC+INGC0L7Qu9GM0LrQviDQtdGB0LvQuCDQvtC9INC90LDRhdC+0LTQuNGC0YHRjyDQsiDQutC+0LvQu9C10LrRhtC40LhcbiAgaWYgKCAhdGhpcy5jb2xsZWN0aW9uICl7XG4gICAgZmluYWxQcm9taXNlLnJlamVjdCggYXJndW1lbnRzICk7XG4gICAgY29uc29sZS5lcnJvcignRG9jdW1lbnQuc2F2ZSBhcGkgaGFuZGxlIGlzIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgICByZXR1cm4gZmluYWxQcm9taXNlO1xuICB9XG5cbiAgLy8gQ2hlY2sgZm9yIHByZVNhdmUgZXJyb3JzICjRgtC+0YfQviDQt9C90LDRjiwg0YfRgtC+INC+0L3QsCDQv9GA0L7QstC10YDRj9C10YIg0L7RiNC40LHQutC4INCyINC80LDRgdGB0LjQstCw0YUgKENhc3RFcnJvcikpXG4gIHZhciBwcmVTYXZlRXJyID0gc2VsZi4kX19wcmVzYXZlVmFsaWRhdGUoKTtcbiAgaWYgKCBwcmVTYXZlRXJyICkge1xuICAgIGZpbmFsUHJvbWlzZS5yZWplY3QoIHByZVNhdmVFcnIgKTtcbiAgICByZXR1cm4gZmluYWxQcm9taXNlO1xuICB9XG5cbiAgLy8gVmFsaWRhdGVcbiAgdmFyIHAwID0gbmV3ICQuRGVmZXJyZWQoKTtcbiAgc2VsZi52YWxpZGF0ZShmdW5jdGlvbiggZXJyICl7XG4gICAgaWYgKCBlcnIgKXtcbiAgICAgIHAwLnJlamVjdCggZXJyICk7XG4gICAgICBmaW5hbFByb21pc2UucmVqZWN0KCBlcnIgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcDAucmVzb2x2ZSgpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8g0KHQvdCw0YfQsNC70LAg0L3QsNC00L4g0YHQvtGF0YDQsNC90LjRgtGMINCy0YHQtSDQv9C+0LTQtNC+0LrRg9C80LXQvdGC0Ysg0Lgg0YHQtNC10LvQsNGC0YwgcmVzb2x2ZSEhIVxuICAvLyBDYWxsIHNhdmUgaG9va3Mgb24gc3ViZG9jc1xuICB2YXIgc3ViRG9jcyA9IHNlbGYuJF9fZ2V0QWxsU3ViZG9jcygpO1xuICB2YXIgd2hlbkNvbmQgPSBzdWJEb2NzLm1hcChmdW5jdGlvbiAoZCkge3JldHVybiBkLnNhdmUoKTt9KTtcbiAgd2hlbkNvbmQucHVzaCggcDAgKTtcblxuICAvLyDQotCw0Log0LzRiyDQv9C10YDQtdC00LDRkdC8INC80LDRgdGB0LjQsiBwcm9taXNlINGD0YHQu9C+0LLQuNC5XG4gIHZhciBwMSA9ICQud2hlbi5hcHBseSggJCwgd2hlbkNvbmQgKTtcblxuICAvLyBIYW5kbGUgc2F2ZSBhbmQgcmVzdWx0c1xuICBwMVxuICAgIC50aGVuKCB0aGlzLiRfX2hhbmRsZVNhdmUuYmluZCggdGhpcyApIClcbiAgICAudGhlbihmdW5jdGlvbigpe1xuICAgICAgcmV0dXJuIGZpbmFsUHJvbWlzZS5yZXNvbHZlKCBzZWxmICk7XG4gICAgfSwgZnVuY3Rpb24gKCBlcnIgKSB7XG4gICAgICAvLyBJZiB0aGUgaW5pdGlhbCBpbnNlcnQgZmFpbHMgcHJvdmlkZSBhIHNlY29uZCBjaGFuY2UuXG4gICAgICAvLyAoSWYgd2UgZGlkIHRoaXMgYWxsIHRoZSB0aW1lIHdlIHdvdWxkIGJyZWFrIHVwZGF0ZXMpXG4gICAgICBpZiAoc2VsZi4kX18uaW5zZXJ0aW5nKSB7XG4gICAgICAgIHNlbGYuaXNOZXcgPSB0cnVlO1xuICAgICAgICBzZWxmLmVtaXQoJ2lzTmV3JywgdHJ1ZSk7XG4gICAgICB9XG4gICAgICBmaW5hbFByb21pc2UucmVqZWN0KCBlcnIgKTtcbiAgICB9KTtcblxuICByZXR1cm4gZmluYWxQcm9taXNlO1xufTtcblxuXG4vKipcbiAqIENvbnZlcnRzIHRoaXMgZG9jdW1lbnQgaW50byBhIHBsYWluIGphdmFzY3JpcHQgb2JqZWN0LCByZWFkeSBmb3Igc3RvcmFnZSBpbiBNb25nb0RCLlxuICpcbiAqIEJ1ZmZlcnMgYXJlIGNvbnZlcnRlZCB0byBpbnN0YW5jZXMgb2YgW21vbmdvZGIuQmluYXJ5XShodHRwOi8vbW9uZ29kYi5naXRodWIuY29tL25vZGUtbW9uZ29kYi1uYXRpdmUvYXBpLWJzb24tZ2VuZXJhdGVkL2JpbmFyeS5odG1sKSBmb3IgcHJvcGVyIHN0b3JhZ2UuXG4gKlxuICogIyMjI09wdGlvbnM6XG4gKlxuICogLSBgZ2V0dGVyc2AgYXBwbHkgYWxsIGdldHRlcnMgKHBhdGggYW5kIHZpcnR1YWwgZ2V0dGVycylcbiAqIC0gYHZpcnR1YWxzYCBhcHBseSB2aXJ0dWFsIGdldHRlcnMgKGNhbiBvdmVycmlkZSBgZ2V0dGVyc2Agb3B0aW9uKVxuICogLSBgbWluaW1pemVgIHJlbW92ZSBlbXB0eSBvYmplY3RzIChkZWZhdWx0cyB0byB0cnVlKVxuICogLSBgdHJhbnNmb3JtYCBhIHRyYW5zZm9ybSBmdW5jdGlvbiB0byBhcHBseSB0byB0aGUgcmVzdWx0aW5nIGRvY3VtZW50IGJlZm9yZSByZXR1cm5pbmdcbiAqXG4gKiAjIyMjR2V0dGVycy9WaXJ0dWFsc1xuICpcbiAqIEV4YW1wbGUgb2Ygb25seSBhcHBseWluZyBwYXRoIGdldHRlcnNcbiAqXG4gKiAgICAgZG9jLnRvT2JqZWN0KHsgZ2V0dGVyczogdHJ1ZSwgdmlydHVhbHM6IGZhbHNlIH0pXG4gKlxuICogRXhhbXBsZSBvZiBvbmx5IGFwcGx5aW5nIHZpcnR1YWwgZ2V0dGVyc1xuICpcbiAqICAgICBkb2MudG9PYmplY3QoeyB2aXJ0dWFsczogdHJ1ZSB9KVxuICpcbiAqIEV4YW1wbGUgb2YgYXBwbHlpbmcgYm90aCBwYXRoIGFuZCB2aXJ0dWFsIGdldHRlcnNcbiAqXG4gKiAgICAgZG9jLnRvT2JqZWN0KHsgZ2V0dGVyczogdHJ1ZSB9KVxuICpcbiAqIFRvIGFwcGx5IHRoZXNlIG9wdGlvbnMgdG8gZXZlcnkgZG9jdW1lbnQgb2YgeW91ciBzY2hlbWEgYnkgZGVmYXVsdCwgc2V0IHlvdXIgW3NjaGVtYXNdKCNzY2hlbWFfU2NoZW1hKSBgdG9PYmplY3RgIG9wdGlvbiB0byB0aGUgc2FtZSBhcmd1bWVudC5cbiAqXG4gKiAgICAgc2NoZW1hLnNldCgndG9PYmplY3QnLCB7IHZpcnR1YWxzOiB0cnVlIH0pXG4gKlxuICogIyMjI1RyYW5zZm9ybVxuICpcbiAqIFdlIG1heSBuZWVkIHRvIHBlcmZvcm0gYSB0cmFuc2Zvcm1hdGlvbiBvZiB0aGUgcmVzdWx0aW5nIG9iamVjdCBiYXNlZCBvbiBzb21lIGNyaXRlcmlhLCBzYXkgdG8gcmVtb3ZlIHNvbWUgc2Vuc2l0aXZlIGluZm9ybWF0aW9uIG9yIHJldHVybiBhIGN1c3RvbSBvYmplY3QuIEluIHRoaXMgY2FzZSB3ZSBzZXQgdGhlIG9wdGlvbmFsIGB0cmFuc2Zvcm1gIGZ1bmN0aW9uLlxuICpcbiAqIFRyYW5zZm9ybSBmdW5jdGlvbnMgcmVjZWl2ZSB0aHJlZSBhcmd1bWVudHNcbiAqXG4gKiAgICAgZnVuY3Rpb24gKGRvYywgcmV0LCBvcHRpb25zKSB7fVxuICpcbiAqIC0gYGRvY2AgVGhlIG1vbmdvb3NlIGRvY3VtZW50IHdoaWNoIGlzIGJlaW5nIGNvbnZlcnRlZFxuICogLSBgcmV0YCBUaGUgcGxhaW4gb2JqZWN0IHJlcHJlc2VudGF0aW9uIHdoaWNoIGhhcyBiZWVuIGNvbnZlcnRlZFxuICogLSBgb3B0aW9uc2AgVGhlIG9wdGlvbnMgaW4gdXNlIChlaXRoZXIgc2NoZW1hIG9wdGlvbnMgb3IgdGhlIG9wdGlvbnMgcGFzc2VkIGlubGluZSlcbiAqXG4gKiAjIyMjRXhhbXBsZVxuICpcbiAqICAgICAvLyBzcGVjaWZ5IHRoZSB0cmFuc2Zvcm0gc2NoZW1hIG9wdGlvblxuICogICAgIGlmICghc2NoZW1hLm9wdGlvbnMudG9PYmplY3QpIHNjaGVtYS5vcHRpb25zLnRvT2JqZWN0ID0ge307XG4gKiAgICAgc2NoZW1hLm9wdGlvbnMudG9PYmplY3QudHJhbnNmb3JtID0gZnVuY3Rpb24gKGRvYywgcmV0LCBvcHRpb25zKSB7XG4gKiAgICAgICAvLyByZW1vdmUgdGhlIF9pZCBvZiBldmVyeSBkb2N1bWVudCBiZWZvcmUgcmV0dXJuaW5nIHRoZSByZXN1bHRcbiAqICAgICAgIGRlbGV0ZSByZXQuX2lkO1xuICogICAgIH1cbiAqXG4gKiAgICAgLy8gd2l0aG91dCB0aGUgdHJhbnNmb3JtYXRpb24gaW4gdGhlIHNjaGVtYVxuICogICAgIGRvYy50b09iamVjdCgpOyAvLyB7IF9pZDogJ2FuSWQnLCBuYW1lOiAnV3JlY2staXQgUmFscGgnIH1cbiAqXG4gKiAgICAgLy8gd2l0aCB0aGUgdHJhbnNmb3JtYXRpb25cbiAqICAgICBkb2MudG9PYmplY3QoKTsgLy8geyBuYW1lOiAnV3JlY2staXQgUmFscGgnIH1cbiAqXG4gKiBXaXRoIHRyYW5zZm9ybWF0aW9ucyB3ZSBjYW4gZG8gYSBsb3QgbW9yZSB0aGFuIHJlbW92ZSBwcm9wZXJ0aWVzLiBXZSBjYW4gZXZlbiByZXR1cm4gY29tcGxldGVseSBuZXcgY3VzdG9taXplZCBvYmplY3RzOlxuICpcbiAqICAgICBpZiAoIXNjaGVtYS5vcHRpb25zLnRvT2JqZWN0KSBzY2hlbWEub3B0aW9ucy50b09iamVjdCA9IHt9O1xuICogICAgIHNjaGVtYS5vcHRpb25zLnRvT2JqZWN0LnRyYW5zZm9ybSA9IGZ1bmN0aW9uIChkb2MsIHJldCwgb3B0aW9ucykge1xuICogICAgICAgcmV0dXJuIHsgbW92aWU6IHJldC5uYW1lIH1cbiAqICAgICB9XG4gKlxuICogICAgIC8vIHdpdGhvdXQgdGhlIHRyYW5zZm9ybWF0aW9uIGluIHRoZSBzY2hlbWFcbiAqICAgICBkb2MudG9PYmplY3QoKTsgLy8geyBfaWQ6ICdhbklkJywgbmFtZTogJ1dyZWNrLWl0IFJhbHBoJyB9XG4gKlxuICogICAgIC8vIHdpdGggdGhlIHRyYW5zZm9ybWF0aW9uXG4gKiAgICAgZG9jLnRvT2JqZWN0KCk7IC8vIHsgbW92aWU6ICdXcmVjay1pdCBSYWxwaCcgfVxuICpcbiAqIF9Ob3RlOiBpZiBhIHRyYW5zZm9ybSBmdW5jdGlvbiByZXR1cm5zIGB1bmRlZmluZWRgLCB0aGUgcmV0dXJuIHZhbHVlIHdpbGwgYmUgaWdub3JlZC5fXG4gKlxuICogVHJhbnNmb3JtYXRpb25zIG1heSBhbHNvIGJlIGFwcGxpZWQgaW5saW5lLCBvdmVycmlkZGluZyBhbnkgdHJhbnNmb3JtIHNldCBpbiB0aGUgb3B0aW9uczpcbiAqXG4gKiAgICAgZnVuY3Rpb24geGZvcm0gKGRvYywgcmV0LCBvcHRpb25zKSB7XG4gKiAgICAgICByZXR1cm4geyBpbmxpbmU6IHJldC5uYW1lLCBjdXN0b206IHRydWUgfVxuICogICAgIH1cbiAqXG4gKiAgICAgLy8gcGFzcyB0aGUgdHJhbnNmb3JtIGFzIGFuIGlubGluZSBvcHRpb25cbiAqICAgICBkb2MudG9PYmplY3QoeyB0cmFuc2Zvcm06IHhmb3JtIH0pOyAvLyB7IGlubGluZTogJ1dyZWNrLWl0IFJhbHBoJywgY3VzdG9tOiB0cnVlIH1cbiAqXG4gKiBfTm90ZTogaWYgeW91IGNhbGwgYHRvT2JqZWN0YCBhbmQgcGFzcyBhbnkgb3B0aW9ucywgdGhlIHRyYW5zZm9ybSBkZWNsYXJlZCBpbiB5b3VyIHNjaGVtYSBvcHRpb25zIHdpbGwgX19ub3RfXyBiZSBhcHBsaWVkLiBUbyBmb3JjZSBpdHMgYXBwbGljYXRpb24gcGFzcyBgdHJhbnNmb3JtOiB0cnVlYF9cbiAqXG4gKiAgICAgaWYgKCFzY2hlbWEub3B0aW9ucy50b09iamVjdCkgc2NoZW1hLm9wdGlvbnMudG9PYmplY3QgPSB7fTtcbiAqICAgICBzY2hlbWEub3B0aW9ucy50b09iamVjdC5oaWRlID0gJ19pZCc7XG4gKiAgICAgc2NoZW1hLm9wdGlvbnMudG9PYmplY3QudHJhbnNmb3JtID0gZnVuY3Rpb24gKGRvYywgcmV0LCBvcHRpb25zKSB7XG4gKiAgICAgICBpZiAob3B0aW9ucy5oaWRlKSB7XG4gKiAgICAgICAgIG9wdGlvbnMuaGlkZS5zcGxpdCgnICcpLmZvckVhY2goZnVuY3Rpb24gKHByb3ApIHtcbiAqICAgICAgICAgICBkZWxldGUgcmV0W3Byb3BdO1xuICogICAgICAgICB9KTtcbiAqICAgICAgIH1cbiAqICAgICB9XG4gKlxuICogICAgIHZhciBkb2MgPSBuZXcgRG9jKHsgX2lkOiAnYW5JZCcsIHNlY3JldDogNDcsIG5hbWU6ICdXcmVjay1pdCBSYWxwaCcgfSk7XG4gKiAgICAgZG9jLnRvT2JqZWN0KCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHsgc2VjcmV0OiA0NywgbmFtZTogJ1dyZWNrLWl0IFJhbHBoJyB9XG4gKiAgICAgZG9jLnRvT2JqZWN0KHsgaGlkZTogJ3NlY3JldCBfaWQnIH0pOyAgICAgICAgICAgICAgICAgIC8vIHsgX2lkOiAnYW5JZCcsIHNlY3JldDogNDcsIG5hbWU6ICdXcmVjay1pdCBSYWxwaCcgfVxuICogICAgIGRvYy50b09iamVjdCh7IGhpZGU6ICdzZWNyZXQgX2lkJywgdHJhbnNmb3JtOiB0cnVlIH0pOyAvLyB7IG5hbWU6ICdXcmVjay1pdCBSYWxwaCcgfVxuICpcbiAqIFRyYW5zZm9ybXMgYXJlIGFwcGxpZWQgdG8gdGhlIGRvY3VtZW50IF9hbmQgZWFjaCBvZiBpdHMgc3ViLWRvY3VtZW50c18uIFRvIGRldGVybWluZSB3aGV0aGVyIG9yIG5vdCB5b3UgYXJlIGN1cnJlbnRseSBvcGVyYXRpbmcgb24gYSBzdWItZG9jdW1lbnQgeW91IG1pZ2h0IHVzZSB0aGUgZm9sbG93aW5nIGd1YXJkOlxuICpcbiAqICAgICBpZiAoJ2Z1bmN0aW9uJyA9PSB0eXBlb2YgZG9jLm93bmVyRG9jdW1lbnQpIHtcbiAqICAgICAgIC8vIHdvcmtpbmcgd2l0aCBhIHN1YiBkb2NcbiAqICAgICB9XG4gKlxuICogVHJhbnNmb3JtcywgbGlrZSBhbGwgb2YgdGhlc2Ugb3B0aW9ucywgYXJlIGFsc28gYXZhaWxhYmxlIGZvciBgdG9KU09OYC5cbiAqXG4gKiBTZWUgW3NjaGVtYSBvcHRpb25zXSgvZG9jcy9ndWlkZS5odG1sI3RvT2JqZWN0KSBmb3Igc29tZSBtb3JlIGRldGFpbHMuXG4gKlxuICogX0R1cmluZyBzYXZlLCBubyBjdXN0b20gb3B0aW9ucyBhcmUgYXBwbGllZCB0byB0aGUgZG9jdW1lbnQgYmVmb3JlIGJlaW5nIHNlbnQgdG8gdGhlIGRhdGFiYXNlLl9cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcmV0dXJuIHtPYmplY3R9IGpzIG9iamVjdFxuICogQHNlZSBtb25nb2RiLkJpbmFyeSBodHRwOi8vbW9uZ29kYi5naXRodWIuY29tL25vZGUtbW9uZ29kYi1uYXRpdmUvYXBpLWJzb24tZ2VuZXJhdGVkL2JpbmFyeS5odG1sXG4gKiBAYXBpIHB1YmxpY1xuICovXG5Eb2N1bWVudC5wcm90b3R5cGUudG9PYmplY3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmRlcG9wdWxhdGUgJiYgdGhpcy4kX18ud2FzUG9wdWxhdGVkKSB7XG4gICAgLy8gcG9wdWxhdGVkIHBhdGhzIHRoYXQgd2Ugc2V0IHRvIGEgZG9jdW1lbnRcbiAgICByZXR1cm4gdXRpbHMuY2xvbmUodGhpcy5faWQsIG9wdGlvbnMpO1xuICB9XG5cbiAgLy8gV2hlbiBpbnRlcm5hbGx5IHNhdmluZyB0aGlzIGRvY3VtZW50IHdlIGFsd2F5cyBwYXNzIG9wdGlvbnMsXG4gIC8vIGJ5cGFzc2luZyB0aGUgY3VzdG9tIHNjaGVtYSBvcHRpb25zLlxuICB2YXIgb3B0aW9uc1BhcmFtZXRlciA9IG9wdGlvbnM7XG4gIGlmICghKG9wdGlvbnMgJiYgJ09iamVjdCcgPT0gdXRpbHMuZ2V0RnVuY3Rpb25OYW1lKG9wdGlvbnMuY29uc3RydWN0b3IpKSB8fFxuICAgIChvcHRpb25zICYmIG9wdGlvbnMuX3VzZVNjaGVtYU9wdGlvbnMpKSB7XG4gICAgb3B0aW9ucyA9IHRoaXMuc2NoZW1hLm9wdGlvbnMudG9PYmplY3RcbiAgICAgID8gY2xvbmUodGhpcy5zY2hlbWEub3B0aW9ucy50b09iamVjdClcbiAgICAgIDoge307XG4gIH1cblxuICBpZiAoIG9wdGlvbnMubWluaW1pemUgPT09IHVuZGVmaW5lZCApe1xuICAgIG9wdGlvbnMubWluaW1pemUgPSB0aGlzLnNjaGVtYS5vcHRpb25zLm1pbmltaXplO1xuICB9XG5cbiAgaWYgKCFvcHRpb25zUGFyYW1ldGVyKSB7XG4gICAgb3B0aW9ucy5fdXNlU2NoZW1hT3B0aW9ucyA9IHRydWU7XG4gIH1cblxuICB2YXIgcmV0ID0gdXRpbHMuY2xvbmUodGhpcy5fZG9jLCBvcHRpb25zKTtcblxuICBpZiAob3B0aW9ucy52aXJ0dWFscyB8fCBvcHRpb25zLmdldHRlcnMgJiYgZmFsc2UgIT09IG9wdGlvbnMudmlydHVhbHMpIHtcbiAgICBhcHBseUdldHRlcnModGhpcywgcmV0LCAndmlydHVhbHMnLCBvcHRpb25zKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmdldHRlcnMpIHtcbiAgICBhcHBseUdldHRlcnModGhpcywgcmV0LCAncGF0aHMnLCBvcHRpb25zKTtcbiAgICAvLyBhcHBseUdldHRlcnMgZm9yIHBhdGhzIHdpbGwgYWRkIG5lc3RlZCBlbXB0eSBvYmplY3RzO1xuICAgIC8vIGlmIG1pbmltaXplIGlzIHNldCwgd2UgbmVlZCB0byByZW1vdmUgdGhlbS5cbiAgICBpZiAob3B0aW9ucy5taW5pbWl6ZSkge1xuICAgICAgcmV0ID0gbWluaW1pemUocmV0KSB8fCB7fTtcbiAgICB9XG4gIH1cblxuICAvLyBJbiB0aGUgY2FzZSB3aGVyZSBhIHN1YmRvY3VtZW50IGhhcyBpdHMgb3duIHRyYW5zZm9ybSBmdW5jdGlvbiwgd2UgbmVlZCB0b1xuICAvLyBjaGVjayBhbmQgc2VlIGlmIHRoZSBwYXJlbnQgaGFzIGEgdHJhbnNmb3JtIChvcHRpb25zLnRyYW5zZm9ybSkgYW5kIGlmIHRoZVxuICAvLyBjaGlsZCBzY2hlbWEgaGFzIGEgdHJhbnNmb3JtICh0aGlzLnNjaGVtYS5vcHRpb25zLnRvT2JqZWN0KSBJbiB0aGlzIGNhc2UsXG4gIC8vIHdlIG5lZWQgdG8gYWRqdXN0IG9wdGlvbnMudHJhbnNmb3JtIHRvIGJlIHRoZSBjaGlsZCBzY2hlbWEncyB0cmFuc2Zvcm0gYW5kXG4gIC8vIG5vdCB0aGUgcGFyZW50IHNjaGVtYSdzXG4gIGlmICh0cnVlID09PSBvcHRpb25zLnRyYW5zZm9ybSB8fFxuICAgICAgKHRoaXMuc2NoZW1hLm9wdGlvbnMudG9PYmplY3QgJiYgb3B0aW9ucy50cmFuc2Zvcm0pKSB7XG4gICAgdmFyIG9wdHMgPSBvcHRpb25zLmpzb25cbiAgICAgID8gdGhpcy5zY2hlbWEub3B0aW9ucy50b0pTT05cbiAgICAgIDogdGhpcy5zY2hlbWEub3B0aW9ucy50b09iamVjdDtcbiAgICBpZiAob3B0cykge1xuICAgICAgb3B0aW9ucy50cmFuc2Zvcm0gPSBvcHRzLnRyYW5zZm9ybTtcbiAgICB9XG4gIH1cblxuICBpZiAoJ2Z1bmN0aW9uJyA9PSB0eXBlb2Ygb3B0aW9ucy50cmFuc2Zvcm0pIHtcbiAgICB2YXIgeGZvcm1lZCA9IG9wdGlvbnMudHJhbnNmb3JtKHRoaXMsIHJldCwgb3B0aW9ucyk7XG4gICAgaWYgKCd1bmRlZmluZWQnICE9IHR5cGVvZiB4Zm9ybWVkKSByZXQgPSB4Zm9ybWVkO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn07XG5cbi8qIVxuICogTWluaW1pemVzIGFuIG9iamVjdCwgcmVtb3ZpbmcgdW5kZWZpbmVkIHZhbHVlcyBhbmQgZW1wdHkgb2JqZWN0c1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgdG8gbWluaW1pemVcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuXG5mdW5jdGlvbiBtaW5pbWl6ZSAob2JqKSB7XG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMob2JqKVxuICAgICwgaSA9IGtleXMubGVuZ3RoXG4gICAgLCBoYXNLZXlzXG4gICAgLCBrZXlcbiAgICAsIHZhbDtcblxuICB3aGlsZSAoaS0tKSB7XG4gICAga2V5ID0ga2V5c1tpXTtcbiAgICB2YWwgPSBvYmpba2V5XTtcblxuICAgIGlmICggXy5pc1BsYWluT2JqZWN0KHZhbCkgKSB7XG4gICAgICBvYmpba2V5XSA9IG1pbmltaXplKHZhbCk7XG4gICAgfVxuXG4gICAgaWYgKHVuZGVmaW5lZCA9PT0gb2JqW2tleV0pIHtcbiAgICAgIGRlbGV0ZSBvYmpba2V5XTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGhhc0tleXMgPSB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGhhc0tleXNcbiAgICA/IG9ialxuICAgIDogdW5kZWZpbmVkO1xufVxuXG4vKiFcbiAqIEFwcGxpZXMgdmlydHVhbHMgcHJvcGVydGllcyB0byBganNvbmAuXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gc2VsZlxuICogQHBhcmFtIHtPYmplY3R9IGpzb25cbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIGVpdGhlciBgdmlydHVhbHNgIG9yIGBwYXRoc2BcbiAqIEByZXR1cm4ge09iamVjdH0gYGpzb25gXG4gKi9cblxuZnVuY3Rpb24gYXBwbHlHZXR0ZXJzIChzZWxmLCBqc29uLCB0eXBlLCBvcHRpb25zKSB7XG4gIHZhciBzY2hlbWEgPSBzZWxmLnNjaGVtYVxuICAgICwgcGF0aHMgPSBPYmplY3Qua2V5cyhzY2hlbWFbdHlwZV0pXG4gICAgLCBpID0gcGF0aHMubGVuZ3RoXG4gICAgLCBwYXRoO1xuXG4gIHdoaWxlIChpLS0pIHtcbiAgICBwYXRoID0gcGF0aHNbaV07XG5cbiAgICB2YXIgcGFydHMgPSBwYXRoLnNwbGl0KCcuJylcbiAgICAgICwgcGxlbiA9IHBhcnRzLmxlbmd0aFxuICAgICAgLCBsYXN0ID0gcGxlbiAtIDFcbiAgICAgICwgYnJhbmNoID0ganNvblxuICAgICAgLCBwYXJ0O1xuXG4gICAgZm9yICh2YXIgaWkgPSAwOyBpaSA8IHBsZW47ICsraWkpIHtcbiAgICAgIHBhcnQgPSBwYXJ0c1tpaV07XG4gICAgICBpZiAoaWkgPT09IGxhc3QpIHtcbiAgICAgICAgYnJhbmNoW3BhcnRdID0gdXRpbHMuY2xvbmUoc2VsZi5nZXQocGF0aCksIG9wdGlvbnMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJhbmNoID0gYnJhbmNoW3BhcnRdIHx8IChicmFuY2hbcGFydF0gPSB7fSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGpzb247XG59XG5cbi8qKlxuICogVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIG1ldGhvZCBpcyB1c2VkIGluIGNhbGxzIHRvIEpTT04uc3RyaW5naWZ5KGRvYykuXG4gKlxuICogVGhpcyBtZXRob2QgYWNjZXB0cyB0aGUgc2FtZSBvcHRpb25zIGFzIFtEb2N1bWVudCN0b09iamVjdF0oI2RvY3VtZW50X0RvY3VtZW50LXRvT2JqZWN0KS4gVG8gYXBwbHkgdGhlIG9wdGlvbnMgdG8gZXZlcnkgZG9jdW1lbnQgb2YgeW91ciBzY2hlbWEgYnkgZGVmYXVsdCwgc2V0IHlvdXIgW3NjaGVtYXNdKCNzY2hlbWFfU2NoZW1hKSBgdG9KU09OYCBvcHRpb24gdG8gdGhlIHNhbWUgYXJndW1lbnQuXG4gKlxuICogICAgIHNjaGVtYS5zZXQoJ3RvSlNPTicsIHsgdmlydHVhbHM6IHRydWUgfSlcbiAqXG4gKiBTZWUgW3NjaGVtYSBvcHRpb25zXSgvZG9jcy9ndWlkZS5odG1sI3RvSlNPTikgZm9yIGRldGFpbHMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqIEBzZWUgRG9jdW1lbnQjdG9PYmplY3QgI2RvY3VtZW50X0RvY3VtZW50LXRvT2JqZWN0XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbkRvY3VtZW50LnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAvLyBjaGVjayBmb3Igb2JqZWN0IHR5cGUgc2luY2UgYW4gYXJyYXkgb2YgZG9jdW1lbnRzXG4gIC8vIGJlaW5nIHN0cmluZ2lmaWVkIHBhc3NlcyBhcnJheSBpbmRleGVzIGluc3RlYWRcbiAgLy8gb2Ygb3B0aW9ucyBvYmplY3RzLiBKU09OLnN0cmluZ2lmeShbZG9jLCBkb2NdKVxuICAvLyBUaGUgc2Vjb25kIGNoZWNrIGhlcmUgaXMgdG8gbWFrZSBzdXJlIHRoYXQgcG9wdWxhdGVkIGRvY3VtZW50cyAob3JcbiAgLy8gc3ViZG9jdW1lbnRzKSB1c2UgdGhlaXIgb3duIG9wdGlvbnMgZm9yIGAudG9KU09OKClgIGluc3RlYWQgb2YgdGhlaXJcbiAgLy8gcGFyZW50J3NcbiAgaWYgKCEob3B0aW9ucyAmJiAnT2JqZWN0JyA9PSB1dGlscy5nZXRGdW5jdGlvbk5hbWUob3B0aW9ucy5jb25zdHJ1Y3RvcikpXG4gICAgICB8fCAoKCFvcHRpb25zIHx8IG9wdGlvbnMuanNvbikgJiYgdGhpcy5zY2hlbWEub3B0aW9ucy50b0pTT04pKSB7XG5cbiAgICBvcHRpb25zID0gdGhpcy5zY2hlbWEub3B0aW9ucy50b0pTT05cbiAgICAgID8gdXRpbHMuY2xvbmUodGhpcy5zY2hlbWEub3B0aW9ucy50b0pTT04pXG4gICAgICA6IHt9O1xuICB9XG4gIG9wdGlvbnMuanNvbiA9IHRydWU7XG5cbiAgcmV0dXJuIHRoaXMudG9PYmplY3Qob3B0aW9ucyk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgRG9jdW1lbnQgc3RvcmVzIHRoZSBzYW1lIGRhdGEgYXMgZG9jLlxuICpcbiAqIERvY3VtZW50cyBhcmUgY29uc2lkZXJlZCBlcXVhbCB3aGVuIHRoZXkgaGF2ZSBtYXRjaGluZyBgX2lkYHMsIHVubGVzcyBuZWl0aGVyXG4gKiBkb2N1bWVudCBoYXMgYW4gYF9pZGAsIGluIHdoaWNoIGNhc2UgdGhpcyBmdW5jdGlvbiBmYWxscyBiYWNrIHRvIHVzaW5nXG4gKiBgZGVlcEVxdWFsKClgLlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvYyBhIGRvY3VtZW50IHRvIGNvbXBhcmVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbkRvY3VtZW50LnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiAoZG9jKSB7XG4gIHZhciB0aWQgPSB0aGlzLmdldCgnX2lkJyk7XG4gIHZhciBkb2NpZCA9IGRvYy5nZXQoJ19pZCcpO1xuICBpZiAoIXRpZCAmJiAhZG9jaWQpIHtcbiAgICByZXR1cm4gZGVlcEVxdWFsKHRoaXMsIGRvYyk7XG4gIH1cbiAgcmV0dXJuIHRpZCAmJiB0aWQuZXF1YWxzXG4gICAgPyB0aWQuZXF1YWxzKGRvY2lkKVxuICAgIDogdGlkID09PSBkb2NpZDtcbn07XG5cbi8qKlxuICogR2V0cyBfaWQocykgdXNlZCBkdXJpbmcgcG9wdWxhdGlvbiBvZiB0aGUgZ2l2ZW4gYHBhdGhgLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICBNb2RlbC5maW5kT25lKCkucG9wdWxhdGUoJ2F1dGhvcicpLmV4ZWMoZnVuY3Rpb24gKGVyciwgZG9jKSB7XG4gKiAgICAgICBjb25zb2xlLmxvZyhkb2MuYXV0aG9yLm5hbWUpICAgICAgICAgLy8gRHIuU2V1c3NcbiAqICAgICAgIGNvbnNvbGUubG9nKGRvYy5wb3B1bGF0ZWQoJ2F1dGhvcicpKSAvLyAnNTE0NGNmODA1MGYwNzFkOTc5YzExOGE3J1xuICogICAgIH0pXG4gKlxuICogSWYgdGhlIHBhdGggd2FzIG5vdCBwb3B1bGF0ZWQsIHVuZGVmaW5lZCBpcyByZXR1cm5lZC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHJldHVybiB7QXJyYXl8T2JqZWN0SWR8TnVtYmVyfEJ1ZmZlcnxTdHJpbmd8dW5kZWZpbmVkfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLnBvcHVsYXRlZCA9IGZ1bmN0aW9uIChwYXRoLCB2YWwsIG9wdGlvbnMpIHtcbiAgLy8gdmFsIGFuZCBvcHRpb25zIGFyZSBpbnRlcm5hbFxuXG4gIC8vVE9ETzog0LTQvtC00LXQu9Cw0YLRjCDRjdGC0YMg0L/RgNC+0LLQtdGA0LrRgywg0L7QvdCwINC00L7Qu9C20L3QsCDQvtC/0LjRgNCw0YLRjNGB0Y8g0L3QtSDQvdCwICRfXy5wb3B1bGF0ZWQsINCwINC90LAg0YLQviwg0YfRgtC+INC90LDRiCDQvtCx0YrQtdC60YIg0LjQvNC10LXRgiDRgNC+0LTQuNGC0LXQu9GPXG4gIC8vINC4INC/0L7RgtC+0Lwg0YPQttC1INCy0YvRgdGC0LDQstC70Y/RgtGMINGB0LLQvtC50YHRgtCy0L4gcG9wdWxhdGVkID09IHRydWVcbiAgaWYgKG51bGwgPT0gdmFsKSB7XG4gICAgaWYgKCF0aGlzLiRfXy5wb3B1bGF0ZWQpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgdmFyIHYgPSB0aGlzLiRfXy5wb3B1bGF0ZWRbcGF0aF07XG4gICAgaWYgKHYpIHJldHVybiB2LnZhbHVlO1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyBpbnRlcm5hbFxuXG4gIGlmICh0cnVlID09PSB2YWwpIHtcbiAgICBpZiAoIXRoaXMuJF9fLnBvcHVsYXRlZCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICByZXR1cm4gdGhpcy4kX18ucG9wdWxhdGVkW3BhdGhdO1xuICB9XG5cbiAgdGhpcy4kX18ucG9wdWxhdGVkIHx8ICh0aGlzLiRfXy5wb3B1bGF0ZWQgPSB7fSk7XG4gIHRoaXMuJF9fLnBvcHVsYXRlZFtwYXRoXSA9IHsgdmFsdWU6IHZhbCwgb3B0aW9uczogb3B0aW9ucyB9O1xuICByZXR1cm4gdmFsO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBmdWxsIHBhdGggdG8gdGhpcyBkb2N1bWVudC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gW3BhdGhdXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqIEBtZXRob2QgJF9fZnVsbFBhdGhcbiAqIEBtZW1iZXJPZiBEb2N1bWVudFxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUuJF9fZnVsbFBhdGggPSBmdW5jdGlvbiAocGF0aCkge1xuICAvLyBvdmVycmlkZGVuIGluIFN1YkRvY3VtZW50c1xuICByZXR1cm4gcGF0aCB8fCAnJztcbn07XG5cbi8qKlxuICog0KPQtNCw0LvQuNGC0Ywg0LTQvtC60YPQvNC10L3RgiDQuCDQstC10YDQvdGD0YLRjCDQutC+0LvQu9C10LrRhtC40Y4uXG4gKlxuICogQGV4YW1wbGVcbiAqIGRvY3VtZW50LnJlbW92ZSgpO1xuICpcbiAqIEBzZWUgQ29sbGVjdGlvbi5yZW1vdmVcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5Eb2N1bWVudC5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24oKXtcbiAgaWYgKCB0aGlzLmNvbGxlY3Rpb24gKXtcbiAgICByZXR1cm4gdGhpcy5jb2xsZWN0aW9uLnJlbW92ZSggdGhpcyApO1xuICB9XG5cbiAgcmV0dXJuIGRlbGV0ZSB0aGlzO1xufTtcblxuXG4vKipcbiAqINCe0YfQuNGJ0LDQtdGCINC00L7QutGD0LzQtdC90YIgKNCy0YvRgdGC0LDQstC70Y/QtdGCINC30L3QsNGH0LXQvdC40LUg0L/QviDRg9C80L7Qu9GH0LDQvdC40Y4g0LjQu9C4IHVuZGVmaW5lZClcbiAqL1xuRG9jdW1lbnQucHJvdG90eXBlLmVtcHR5ID0gZnVuY3Rpb24oKXtcbiAgdmFyIGRvYyA9IHRoaXNcbiAgICAsIHNlbGYgPSB0aGlzXG4gICAgLCBwYXRocyA9IE9iamVjdC5rZXlzKCB0aGlzLnNjaGVtYS5wYXRocyApXG4gICAgLCBwbGVuID0gcGF0aHMubGVuZ3RoXG4gICAgLCBpaSA9IDA7XG5cbiAgZm9yICggOyBpaSA8IHBsZW47ICsraWkgKSB7XG4gICAgdmFyIHAgPSBwYXRoc1tpaV07XG5cbiAgICBpZiAoICdfaWQnID09IHAgKSBjb250aW51ZTtcblxuICAgIHZhciB0eXBlID0gdGhpcy5zY2hlbWEucGF0aHNbIHAgXVxuICAgICAgLCBwYXRoID0gcC5zcGxpdCgnLicpXG4gICAgICAsIGxlbiA9IHBhdGgubGVuZ3RoXG4gICAgICAsIGxhc3QgPSBsZW4gLSAxXG4gICAgICAsIGRvY18gPSBkb2NcbiAgICAgICwgaSA9IDA7XG5cbiAgICBmb3IgKCA7IGkgPCBsZW47ICsraSApIHtcbiAgICAgIHZhciBwaWVjZSA9IHBhdGhbIGkgXVxuICAgICAgICAsIGRlZmF1bHRWYWw7XG5cbiAgICAgIGlmICggaSA9PT0gbGFzdCApIHtcbiAgICAgICAgZGVmYXVsdFZhbCA9IHR5cGUuZ2V0RGVmYXVsdCggc2VsZiwgdHJ1ZSApO1xuXG4gICAgICAgIGRvY19bIHBpZWNlIF0gPSBkZWZhdWx0VmFsIHx8IHVuZGVmaW5lZDtcbiAgICAgICAgc2VsZi4kX18uYWN0aXZlUGF0aHMuZGVmYXVsdCggcCApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZG9jXyA9IGRvY19bIHBpZWNlIF0gfHwgKCBkb2NfWyBwaWVjZSBdID0ge30gKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxuRG9jdW1lbnQuVmFsaWRhdGlvbkVycm9yID0gVmFsaWRhdGlvbkVycm9yO1xubW9kdWxlLmV4cG9ydHMgPSBEb2N1bWVudDtcbiIsIid1c2Ugc3RyaWN0JztcblxuLy90b2RvOiDQv9C+0YDRgtC40YDQvtCy0LDRgtGMINCy0YHQtSDQvtGI0LjQsdC60LghISFcbi8qKlxuICogU3RvcmFnZUVycm9yIGNvbnN0cnVjdG9yXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG1zZyAtIEVycm9yIG1lc3NhZ2VcbiAqIEBpbmhlcml0cyBFcnJvciBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9FcnJvclxuICogaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy83ODM4MTgvaG93LWRvLWktY3JlYXRlLWEtY3VzdG9tLWVycm9yLWluLWphdmFzY3JpcHRcbiAqL1xuZnVuY3Rpb24gU3RvcmFnZUVycm9yICggbXNnICkge1xuICB0aGlzLm1lc3NhZ2UgPSBtc2c7XG4gIHRoaXMubmFtZSA9ICdTdG9yYWdlRXJyb3InO1xufVxuU3RvcmFnZUVycm9yLnByb3RvdHlwZSA9IG5ldyBFcnJvcigpO1xuXG5cbi8qIVxuICogRm9ybWF0cyBlcnJvciBtZXNzYWdlc1xuICovXG5TdG9yYWdlRXJyb3IucHJvdG90eXBlLmZvcm1hdE1lc3NhZ2UgPSBmdW5jdGlvbiAobXNnLCBwYXRoLCB0eXBlLCB2YWwpIHtcbiAgaWYgKCFtc2cpIHRocm93IG5ldyBUeXBlRXJyb3IoJ21lc3NhZ2UgaXMgcmVxdWlyZWQnKTtcblxuICByZXR1cm4gbXNnLnJlcGxhY2UoL3tQQVRIfS8sIHBhdGgpXG4gICAgICAgICAgICAucmVwbGFjZSgve1ZBTFVFfS8sIFN0cmluZyh2YWx8fCcnKSlcbiAgICAgICAgICAgIC5yZXBsYWNlKC97VFlQRX0vLCB0eXBlIHx8ICdkZWNsYXJlZCB0eXBlJyk7XG59O1xuXG4vKiFcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gU3RvcmFnZUVycm9yO1xuXG4vKipcbiAqIFRoZSBkZWZhdWx0IGJ1aWx0LWluIHZhbGlkYXRvciBlcnJvciBtZXNzYWdlcy5cbiAqXG4gKiBAc2VlIEVycm9yLm1lc3NhZ2VzICNlcnJvcl9tZXNzYWdlc19TdG9yYWdlRXJyb3ItbWVzc2FnZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuU3RvcmFnZUVycm9yLm1lc3NhZ2VzID0gcmVxdWlyZSgnLi9lcnJvci9tZXNzYWdlcycpO1xuXG4vKiFcbiAqIEV4cG9zZSBzdWJjbGFzc2VzXG4gKi9cblxuU3RvcmFnZUVycm9yLkNhc3RFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3IvY2FzdCcpO1xuU3RvcmFnZUVycm9yLlZhbGlkYXRpb25FcnJvciA9IHJlcXVpcmUoJy4vZXJyb3IvdmFsaWRhdGlvbicpO1xuU3RvcmFnZUVycm9yLlZhbGlkYXRvckVycm9yID0gcmVxdWlyZSgnLi9lcnJvci92YWxpZGF0b3InKTtcbi8vdG9kbzpcbi8vU3RvcmFnZUVycm9yLlZlcnNpb25FcnJvciA9IHJlcXVpcmUoJy4vZXJyb3IvdmVyc2lvbicpO1xuLy9TdG9yYWdlRXJyb3IuT3ZlcndyaXRlTW9kZWxFcnJvciA9IHJlcXVpcmUoJy4vZXJyb3Ivb3ZlcndyaXRlTW9kZWwnKTtcblN0b3JhZ2VFcnJvci5NaXNzaW5nU2NoZW1hRXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yL21pc3NpbmdTY2hlbWEnKTtcbi8vU3RvcmFnZUVycm9yLkRpdmVyZ2VudEFycmF5RXJyb3IgPSByZXF1aXJlKCcuL2Vycm9yL2RpdmVyZ2VudEFycmF5Jyk7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIVxuICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAqL1xuXG52YXIgU3RvcmFnZUVycm9yID0gcmVxdWlyZSgnLi4vZXJyb3IuanMnKTtcblxuLyoqXG4gKiBDYXN0aW5nIEVycm9yIGNvbnN0cnVjdG9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKiBAcGFyYW0ge1N0cmluZ30gdmFsdWVcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAaW5oZXJpdHMgU3RvcmFnZUVycm9yXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBDYXN0RXJyb3IgKHR5cGUsIHZhbHVlLCBwYXRoKSB7XG4gIFN0b3JhZ2VFcnJvci5jYWxsKHRoaXMsICdDYXN0IHRvICcgKyB0eXBlICsgJyBmYWlsZWQgZm9yIHZhbHVlIFwiJyArIHZhbHVlICsgJ1wiIGF0IHBhdGggXCInICsgcGF0aCArICdcIicpO1xuICB0aGlzLm5hbWUgPSAnQ2FzdEVycm9yJztcbiAgdGhpcy50eXBlID0gdHlwZTtcbiAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB0aGlzLnBhdGggPSBwYXRoO1xufVxuXG4vKiFcbiAqIEluaGVyaXRzIGZyb20gU3RvcmFnZUVycm9yLlxuICovXG5DYXN0RXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggU3RvcmFnZUVycm9yLnByb3RvdHlwZSApO1xuQ2FzdEVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IENhc3RFcnJvcjtcblxuLyohXG4gKiBleHBvcnRzXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBDYXN0RXJyb3I7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVGhlIGRlZmF1bHQgYnVpbHQtaW4gdmFsaWRhdG9yIGVycm9yIG1lc3NhZ2VzLiBUaGVzZSBtYXkgYmUgY3VzdG9taXplZC5cbiAqXG4gKiAgICAgLy8gY3VzdG9taXplIHdpdGhpbiBlYWNoIHNjaGVtYSBvciBnbG9iYWxseSBsaWtlIHNvXG4gKiAgICAgdmFyIG1vbmdvb3NlID0gcmVxdWlyZSgnbW9uZ29vc2UnKTtcbiAqICAgICBtb25nb29zZS5FcnJvci5tZXNzYWdlcy5TdHJpbmcuZW51bSAgPSBcIllvdXIgY3VzdG9tIG1lc3NhZ2UgZm9yIHtQQVRIfS5cIjtcbiAqXG4gKiBBcyB5b3UgbWlnaHQgaGF2ZSBub3RpY2VkLCBlcnJvciBtZXNzYWdlcyBzdXBwb3J0IGJhc2ljIHRlbXBsYXRpbmdcbiAqXG4gKiAtIGB7UEFUSH1gIGlzIHJlcGxhY2VkIHdpdGggdGhlIGludmFsaWQgZG9jdW1lbnQgcGF0aFxuICogLSBge1ZBTFVFfWAgaXMgcmVwbGFjZWQgd2l0aCB0aGUgaW52YWxpZCB2YWx1ZVxuICogLSBge1RZUEV9YCBpcyByZXBsYWNlZCB3aXRoIHRoZSB2YWxpZGF0b3IgdHlwZSBzdWNoIGFzIFwicmVnZXhwXCIsIFwibWluXCIsIG9yIFwidXNlciBkZWZpbmVkXCJcbiAqIC0gYHtNSU59YCBpcyByZXBsYWNlZCB3aXRoIHRoZSBkZWNsYXJlZCBtaW4gdmFsdWUgZm9yIHRoZSBOdW1iZXIubWluIHZhbGlkYXRvclxuICogLSBge01BWH1gIGlzIHJlcGxhY2VkIHdpdGggdGhlIGRlY2xhcmVkIG1heCB2YWx1ZSBmb3IgdGhlIE51bWJlci5tYXggdmFsaWRhdG9yXG4gKlxuICogQ2xpY2sgdGhlIFwic2hvdyBjb2RlXCIgbGluayBiZWxvdyB0byBzZWUgYWxsIGRlZmF1bHRzLlxuICpcbiAqIEBwcm9wZXJ0eSBtZXNzYWdlc1xuICogQHJlY2VpdmVyIFN0b3JhZ2VFcnJvclxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG52YXIgbXNnID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxubXNnLmdlbmVyYWwgPSB7fTtcbm1zZy5nZW5lcmFsLmRlZmF1bHQgPSBcIlZhbGlkYXRvciBmYWlsZWQgZm9yIHBhdGggYHtQQVRIfWAgd2l0aCB2YWx1ZSBge1ZBTFVFfWBcIjtcbm1zZy5nZW5lcmFsLnJlcXVpcmVkID0gXCJQYXRoIGB7UEFUSH1gIGlzIHJlcXVpcmVkLlwiO1xuXG5tc2cuTnVtYmVyID0ge307XG5tc2cuTnVtYmVyLm1pbiA9IFwiUGF0aCBge1BBVEh9YCAoe1ZBTFVFfSkgaXMgbGVzcyB0aGFuIG1pbmltdW0gYWxsb3dlZCB2YWx1ZSAoe01JTn0pLlwiO1xubXNnLk51bWJlci5tYXggPSBcIlBhdGggYHtQQVRIfWAgKHtWQUxVRX0pIGlzIG1vcmUgdGhhbiBtYXhpbXVtIGFsbG93ZWQgdmFsdWUgKHtNQVh9KS5cIjtcblxubXNnLlN0cmluZyA9IHt9O1xubXNnLlN0cmluZy5lbnVtID0gXCJge1ZBTFVFfWAgaXMgbm90IGEgdmFsaWQgZW51bSB2YWx1ZSBmb3IgcGF0aCBge1BBVEh9YC5cIjtcbm1zZy5TdHJpbmcubWF0Y2ggPSBcIlBhdGggYHtQQVRIfWAgaXMgaW52YWxpZCAoe1ZBTFVFfSkuXCI7XG5cbiIsIid1c2Ugc3RyaWN0JztcblxuLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBTdG9yYWdlRXJyb3IgPSByZXF1aXJlKCcuLi9lcnJvci5qcycpO1xuXG4vKiFcbiAqIE1pc3NpbmdTY2hlbWEgRXJyb3IgY29uc3RydWN0b3IuXG4gKlxuICogQGluaGVyaXRzIFN0b3JhZ2VFcnJvclxuICovXG5cbmZ1bmN0aW9uIE1pc3NpbmdTY2hlbWFFcnJvcigpe1xuICB2YXIgbXNnID0gJ1NjaGVtYSBoYXNuXFwndCBiZWVuIHJlZ2lzdGVyZWQgZm9yIGRvY3VtZW50LlxcbidcbiAgICArICdVc2Ugc3RvcmFnZS5Eb2N1bWVudChkYXRhLCBzY2hlbWEpJztcbiAgU3RvcmFnZUVycm9yLmNhbGwodGhpcywgbXNnKTtcblxuICB0aGlzLm5hbWUgPSAnTWlzc2luZ1NjaGVtYUVycm9yJztcbn1cblxuLyohXG4gKiBJbmhlcml0cyBmcm9tIFN0b3JhZ2VFcnJvci5cbiAqL1xuXG5NaXNzaW5nU2NoZW1hRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdG9yYWdlRXJyb3IucHJvdG90eXBlKTtcbk1pc3NpbmdTY2hlbWFFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBTdG9yYWdlRXJyb3I7XG5cbi8qIVxuICogZXhwb3J0c1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gTWlzc2luZ1NjaGVtYUVycm9yOyIsIid1c2Ugc3RyaWN0JztcblxuLyohXG4gKiBNb2R1bGUgcmVxdWlyZW1lbnRzXG4gKi9cblxudmFyIFN0b3JhZ2VFcnJvciA9IHJlcXVpcmUoJy4uL2Vycm9yLmpzJyk7XG5cbi8qKlxuICogRG9jdW1lbnQgVmFsaWRhdGlvbiBFcnJvclxuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICogQHBhcmFtIHtEb2N1bWVudH0gaW5zdGFuY2VcbiAqIEBpbmhlcml0cyBTdG9yYWdlRXJyb3JcbiAqL1xuXG5mdW5jdGlvbiBWYWxpZGF0aW9uRXJyb3IgKGluc3RhbmNlKSB7XG4gIFN0b3JhZ2VFcnJvci5jYWxsKHRoaXMsIFwiVmFsaWRhdGlvbiBmYWlsZWRcIik7XG4gIHRoaXMubmFtZSA9ICdWYWxpZGF0aW9uRXJyb3InO1xuICB0aGlzLmVycm9ycyA9IGluc3RhbmNlLmVycm9ycyA9IHt9O1xufVxuXG4vKiFcbiAqIEluaGVyaXRzIGZyb20gU3RvcmFnZUVycm9yLlxuICovXG5WYWxpZGF0aW9uRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggU3RvcmFnZUVycm9yLnByb3RvdHlwZSApO1xuVmFsaWRhdGlvbkVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFZhbGlkYXRpb25FcnJvcjtcblxuLyohXG4gKiBNb2R1bGUgZXhwb3J0c1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gVmFsaWRhdGlvbkVycm9yO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIFN0b3JhZ2VFcnJvciA9IHJlcXVpcmUoJy4uL2Vycm9yLmpzJyk7XG52YXIgZXJyb3JNZXNzYWdlcyA9IFN0b3JhZ2VFcnJvci5tZXNzYWdlcztcblxuLyoqXG4gKiBTY2hlbWEgdmFsaWRhdG9yIGVycm9yXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEBwYXJhbSB7U3RyaW5nfSBtc2dcbiAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcnxhbnl9IHZhbFxuICogQGluaGVyaXRzIFN0b3JhZ2VFcnJvclxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gVmFsaWRhdG9yRXJyb3IgKHBhdGgsIG1zZywgdHlwZSwgdmFsKSB7XG4gIGlmICghbXNnKSBtc2cgPSBlcnJvck1lc3NhZ2VzLmdlbmVyYWwuZGVmYXVsdDtcbiAgdmFyIG1lc3NhZ2UgPSB0aGlzLmZvcm1hdE1lc3NhZ2UobXNnLCBwYXRoLCB0eXBlLCB2YWwpO1xuICBTdG9yYWdlRXJyb3IuY2FsbCh0aGlzLCBtZXNzYWdlKTtcbiAgdGhpcy5uYW1lID0gJ1ZhbGlkYXRvckVycm9yJztcbiAgdGhpcy5wYXRoID0gcGF0aDtcbiAgdGhpcy50eXBlID0gdHlwZTtcbiAgdGhpcy52YWx1ZSA9IHZhbDtcbn1cblxuLyohXG4gKiB0b1N0cmluZyBoZWxwZXJcbiAqL1xuXG5WYWxpZGF0b3JFcnJvci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLm1lc3NhZ2U7XG59XG5cbi8qIVxuICogSW5oZXJpdHMgZnJvbSBTdG9yYWdlRXJyb3JcbiAqL1xuVmFsaWRhdG9yRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggU3RvcmFnZUVycm9yLnByb3RvdHlwZSApO1xuVmFsaWRhdG9yRXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gVmFsaWRhdG9yRXJyb3I7XG5cbi8qIVxuICogZXhwb3J0c1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gVmFsaWRhdG9yRXJyb3I7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICpcbiAqIEJhY2tib25lLkV2ZW50c1xuXG4gKiBBIG1vZHVsZSB0aGF0IGNhbiBiZSBtaXhlZCBpbiB0byAqYW55IG9iamVjdCogaW4gb3JkZXIgdG8gcHJvdmlkZSBpdCB3aXRoXG4gKiBjdXN0b20gZXZlbnRzLiBZb3UgbWF5IGJpbmQgd2l0aCBgb25gIG9yIHJlbW92ZSB3aXRoIGBvZmZgIGNhbGxiYWNrXG4gKiBmdW5jdGlvbnMgdG8gYW4gZXZlbnQ7IGB0cmlnZ2VyYC1pbmcgYW4gZXZlbnQgZmlyZXMgYWxsIGNhbGxiYWNrcyBpblxuICogc3VjY2Vzc2lvbi5cbiAqXG4gKiB2YXIgb2JqZWN0ID0ge307XG4gKiBfLmV4dGVuZChvYmplY3QsIEV2ZW50cy5wcm90b3R5cGUpO1xuICogb2JqZWN0Lm9uKCdleHBhbmQnLCBmdW5jdGlvbigpeyBhbGVydCgnZXhwYW5kZWQnKTsgfSk7XG4gKiBvYmplY3QudHJpZ2dlcignZXhwYW5kJyk7XG4gKi9cbmZ1bmN0aW9uIEV2ZW50cygpIHt9XG5cbkV2ZW50cy5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBCaW5kIGFuIGV2ZW50IHRvIGEgYGNhbGxiYWNrYCBmdW5jdGlvbi4gUGFzc2luZyBgXCJhbGxcImAgd2lsbCBiaW5kXG4gICAqIHRoZSBjYWxsYmFjayB0byBhbGwgZXZlbnRzIGZpcmVkLlxuICAgKiBAcGFyYW0gbmFtZVxuICAgKiBAcGFyYW0gY2FsbGJhY2tcbiAgICogQHBhcmFtIGNvbnRleHRcbiAgICogQHJldHVybnMge0V2ZW50c31cbiAgICovXG4gIG9uOiBmdW5jdGlvbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgIGlmICghZXZlbnRzQXBpKHRoaXMsICdvbicsIG5hbWUsIFtjYWxsYmFjaywgY29udGV4dF0pIHx8ICFjYWxsYmFjaykgcmV0dXJuIHRoaXM7XG4gICAgdGhpcy5fZXZlbnRzIHx8ICh0aGlzLl9ldmVudHMgPSB7fSk7XG4gICAgdmFyIGV2ZW50cyA9IHRoaXMuX2V2ZW50c1tuYW1lXSB8fCAodGhpcy5fZXZlbnRzW25hbWVdID0gW10pO1xuICAgIGV2ZW50cy5wdXNoKHtjYWxsYmFjazogY2FsbGJhY2ssIGNvbnRleHQ6IGNvbnRleHQsIGN0eDogY29udGV4dCB8fCB0aGlzfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEJpbmQgYW4gZXZlbnQgdG8gb25seSBiZSB0cmlnZ2VyZWQgYSBzaW5nbGUgdGltZS4gQWZ0ZXIgdGhlIGZpcnN0IHRpbWVcbiAgICogdGhlIGNhbGxiYWNrIGlzIGludm9rZWQsIGl0IHdpbGwgYmUgcmVtb3ZlZC5cbiAgICpcbiAgICogQHBhcmFtIG5hbWVcbiAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAqIEBwYXJhbSBjb250ZXh0XG4gICAqIEByZXR1cm5zIHtFdmVudHN9XG4gICAqL1xuICBvbmNlOiBmdW5jdGlvbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgIGlmICghZXZlbnRzQXBpKHRoaXMsICdvbmNlJywgbmFtZSwgW2NhbGxiYWNrLCBjb250ZXh0XSkgfHwgIWNhbGxiYWNrKSByZXR1cm4gdGhpcztcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIG9uY2UgPSBfLm9uY2UoZnVuY3Rpb24oKSB7XG4gICAgICBzZWxmLm9mZihuYW1lLCBvbmNlKTtcbiAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfSk7XG4gICAgb25jZS5fY2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICByZXR1cm4gdGhpcy5vbihuYW1lLCBvbmNlLCBjb250ZXh0KTtcbiAgfSxcblxuICAvKipcbiAgICogUmVtb3ZlIG9uZSBvciBtYW55IGNhbGxiYWNrcy4gSWYgYGNvbnRleHRgIGlzIG51bGwsIHJlbW92ZXMgYWxsXG4gICAqIGNhbGxiYWNrcyB3aXRoIHRoYXQgZnVuY3Rpb24uIElmIGBjYWxsYmFja2AgaXMgbnVsbCwgcmVtb3ZlcyBhbGxcbiAgICogY2FsbGJhY2tzIGZvciB0aGUgZXZlbnQuIElmIGBuYW1lYCBpcyBudWxsLCByZW1vdmVzIGFsbCBib3VuZFxuICAgKiBjYWxsYmFja3MgZm9yIGFsbCBldmVudHMuXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lXG4gICAqIEBwYXJhbSBjYWxsYmFja1xuICAgKiBAcGFyYW0gY29udGV4dFxuICAgKiBAcmV0dXJucyB7RXZlbnRzfVxuICAgKi9cbiAgb2ZmOiBmdW5jdGlvbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgIHZhciByZXRhaW4sIGV2LCBldmVudHMsIG5hbWVzLCBpLCBsLCBqLCBrO1xuICAgIGlmICghdGhpcy5fZXZlbnRzIHx8ICFldmVudHNBcGkodGhpcywgJ29mZicsIG5hbWUsIFtjYWxsYmFjaywgY29udGV4dF0pKSByZXR1cm4gdGhpcztcbiAgICBpZiAoIW5hbWUgJiYgIWNhbGxiYWNrICYmICFjb250ZXh0KSB7XG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBuYW1lcyA9IG5hbWUgPyBbbmFtZV0gOiBfLmtleXModGhpcy5fZXZlbnRzKTtcbiAgICBmb3IgKGkgPSAwLCBsID0gbmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBuYW1lID0gbmFtZXNbaV07XG4gICAgICBpZiAoZXZlbnRzID0gdGhpcy5fZXZlbnRzW25hbWVdKSB7XG4gICAgICAgIHRoaXMuX2V2ZW50c1tuYW1lXSA9IHJldGFpbiA9IFtdO1xuICAgICAgICBpZiAoY2FsbGJhY2sgfHwgY29udGV4dCkge1xuICAgICAgICAgIGZvciAoaiA9IDAsIGsgPSBldmVudHMubGVuZ3RoOyBqIDwgazsgaisrKSB7XG4gICAgICAgICAgICBldiA9IGV2ZW50c1tqXTtcbiAgICAgICAgICAgIGlmICgoY2FsbGJhY2sgJiYgY2FsbGJhY2sgIT09IGV2LmNhbGxiYWNrICYmIGNhbGxiYWNrICE9PSBldi5jYWxsYmFjay5fY2FsbGJhY2spIHx8XG4gICAgICAgICAgICAgIChjb250ZXh0ICYmIGNvbnRleHQgIT09IGV2LmNvbnRleHQpKSB7XG4gICAgICAgICAgICAgIHJldGFpbi5wdXNoKGV2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFyZXRhaW4ubGVuZ3RoKSBkZWxldGUgdGhpcy5fZXZlbnRzW25hbWVdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUcmlnZ2VyIG9uZSBvciBtYW55IGV2ZW50cywgZmlyaW5nIGFsbCBib3VuZCBjYWxsYmFja3MuIENhbGxiYWNrcyBhcmVcbiAgICogcGFzc2VkIHRoZSBzYW1lIGFyZ3VtZW50cyBhcyBgdHJpZ2dlcmAgaXMsIGFwYXJ0IGZyb20gdGhlIGV2ZW50IG5hbWVcbiAgICogKHVubGVzcyB5b3UncmUgbGlzdGVuaW5nIG9uIGBcImFsbFwiYCwgd2hpY2ggd2lsbCBjYXVzZSB5b3VyIGNhbGxiYWNrIHRvXG4gICAqIHJlY2VpdmUgdGhlIHRydWUgbmFtZSBvZiB0aGUgZXZlbnQgYXMgdGhlIGZpcnN0IGFyZ3VtZW50KS5cbiAgICpcbiAgICogQHBhcmFtIG5hbWVcbiAgICogQHJldHVybnMge0V2ZW50c31cbiAgICovXG4gIHRyaWdnZXI6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cykgcmV0dXJuIHRoaXM7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGlmICghZXZlbnRzQXBpKHRoaXMsICd0cmlnZ2VyJywgbmFtZSwgYXJncykpIHJldHVybiB0aGlzO1xuICAgIHZhciBldmVudHMgPSB0aGlzLl9ldmVudHNbbmFtZV07XG4gICAgdmFyIGFsbEV2ZW50cyA9IHRoaXMuX2V2ZW50cy5hbGw7XG4gICAgaWYgKGV2ZW50cykgdHJpZ2dlckV2ZW50cyhldmVudHMsIGFyZ3MpO1xuICAgIGlmIChhbGxFdmVudHMpIHRyaWdnZXJFdmVudHMoYWxsRXZlbnRzLCBhcmd1bWVudHMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUZWxsIHRoaXMgb2JqZWN0IHRvIHN0b3AgbGlzdGVuaW5nIHRvIGVpdGhlciBzcGVjaWZpYyBldmVudHMgLi4uIG9yXG4gICAqIHRvIGV2ZXJ5IG9iamVjdCBpdCdzIGN1cnJlbnRseSBsaXN0ZW5pbmcgdG8uXG4gICAqXG4gICAqIEBwYXJhbSBvYmpcbiAgICogQHBhcmFtIG5hbWVcbiAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAqIEByZXR1cm5zIHtFdmVudHN9XG4gICAqL1xuICBzdG9wTGlzdGVuaW5nOiBmdW5jdGlvbihvYmosIG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGxpc3RlbmluZ1RvID0gdGhpcy5fbGlzdGVuaW5nVG87XG4gICAgaWYgKCFsaXN0ZW5pbmdUbykgcmV0dXJuIHRoaXM7XG4gICAgdmFyIHJlbW92ZSA9ICFuYW1lICYmICFjYWxsYmFjaztcbiAgICBpZiAoIWNhbGxiYWNrICYmIHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JykgY2FsbGJhY2sgPSB0aGlzO1xuICAgIGlmIChvYmopIChsaXN0ZW5pbmdUbyA9IHt9KVtvYmouX2xpc3RlbklkXSA9IG9iajtcbiAgICBmb3IgKHZhciBpZCBpbiBsaXN0ZW5pbmdUbykge1xuICAgICAgb2JqID0gbGlzdGVuaW5nVG9baWRdO1xuICAgICAgb2JqLm9mZihuYW1lLCBjYWxsYmFjaywgdGhpcyk7XG4gICAgICBpZiAocmVtb3ZlIHx8IF8uaXNFbXB0eShvYmouX2V2ZW50cykpIGRlbGV0ZSB0aGlzLl9saXN0ZW5pbmdUb1tpZF07XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG59O1xuXG4vLyBSZWd1bGFyIGV4cHJlc3Npb24gdXNlZCB0byBzcGxpdCBldmVudCBzdHJpbmdzLlxudmFyIGV2ZW50U3BsaXR0ZXIgPSAvXFxzKy87XG5cbi8qKlxuICogSW1wbGVtZW50IGZhbmN5IGZlYXR1cmVzIG9mIHRoZSBFdmVudHMgQVBJIHN1Y2ggYXMgbXVsdGlwbGUgZXZlbnRcbiAqIG5hbWVzIGBcImNoYW5nZSBibHVyXCJgIGFuZCBqUXVlcnktc3R5bGUgZXZlbnQgbWFwcyBge2NoYW5nZTogYWN0aW9ufWBcbiAqIGluIHRlcm1zIG9mIHRoZSBleGlzdGluZyBBUEkuXG4gKlxuICogQHBhcmFtIG9ialxuICogQHBhcmFtIGFjdGlvblxuICogQHBhcmFtIG5hbWVcbiAqIEBwYXJhbSByZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xudmFyIGV2ZW50c0FwaSA9IGZ1bmN0aW9uKG9iaiwgYWN0aW9uLCBuYW1lLCByZXN0KSB7XG4gIGlmICghbmFtZSkgcmV0dXJuIHRydWU7XG5cbiAgLy8gSGFuZGxlIGV2ZW50IG1hcHMuXG4gIGlmICh0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gbmFtZSkge1xuICAgICAgb2JqW2FjdGlvbl0uYXBwbHkob2JqLCBba2V5LCBuYW1lW2tleV1dLmNvbmNhdChyZXN0KSk7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIEhhbmRsZSBzcGFjZSBzZXBhcmF0ZWQgZXZlbnQgbmFtZXMuXG4gIGlmIChldmVudFNwbGl0dGVyLnRlc3QobmFtZSkpIHtcbiAgICB2YXIgbmFtZXMgPSBuYW1lLnNwbGl0KGV2ZW50U3BsaXR0ZXIpO1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gbmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBvYmpbYWN0aW9uXS5hcHBseShvYmosIFtuYW1lc1tpXV0uY29uY2F0KHJlc3QpKTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG4vKipcbiAqIEEgZGlmZmljdWx0LXRvLWJlbGlldmUsIGJ1dCBvcHRpbWl6ZWQgaW50ZXJuYWwgZGlzcGF0Y2ggZnVuY3Rpb24gZm9yXG4gKiB0cmlnZ2VyaW5nIGV2ZW50cy4gVHJpZXMgdG8ga2VlcCB0aGUgdXN1YWwgY2FzZXMgc3BlZWR5IChtb3N0IGludGVybmFsXG4gKiBCYWNrYm9uZSBldmVudHMgaGF2ZSAzIGFyZ3VtZW50cykuXG4gKlxuICogQHBhcmFtIGV2ZW50c1xuICogQHBhcmFtIGFyZ3NcbiAqL1xudmFyIHRyaWdnZXJFdmVudHMgPSBmdW5jdGlvbihldmVudHMsIGFyZ3MpIHtcbiAgdmFyIGV2LCBpID0gLTEsIGwgPSBldmVudHMubGVuZ3RoLCBhMSA9IGFyZ3NbMF0sIGEyID0gYXJnc1sxXSwgYTMgPSBhcmdzWzJdO1xuICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgY2FzZSAwOiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5jYWxsKGV2LmN0eCk7IHJldHVybjtcbiAgICBjYXNlIDE6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4LCBhMSk7IHJldHVybjtcbiAgICBjYXNlIDI6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4LCBhMSwgYTIpOyByZXR1cm47XG4gICAgY2FzZSAzOiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5jYWxsKGV2LmN0eCwgYTEsIGEyLCBhMyk7IHJldHVybjtcbiAgICBkZWZhdWx0OiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5hcHBseShldi5jdHgsIGFyZ3MpO1xuICB9XG59O1xuXG52YXIgbGlzdGVuTWV0aG9kcyA9IHtsaXN0ZW5UbzogJ29uJywgbGlzdGVuVG9PbmNlOiAnb25jZSd9O1xuXG4vLyBJbnZlcnNpb24tb2YtY29udHJvbCB2ZXJzaW9ucyBvZiBgb25gIGFuZCBgb25jZWAuIFRlbGwgKnRoaXMqIG9iamVjdCB0b1xuLy8gbGlzdGVuIHRvIGFuIGV2ZW50IGluIGFub3RoZXIgb2JqZWN0IC4uLiBrZWVwaW5nIHRyYWNrIG9mIHdoYXQgaXQnc1xuLy8gbGlzdGVuaW5nIHRvLlxuXy5lYWNoKGxpc3Rlbk1ldGhvZHMsIGZ1bmN0aW9uKGltcGxlbWVudGF0aW9uLCBtZXRob2QpIHtcbiAgRXZlbnRzW21ldGhvZF0gPSBmdW5jdGlvbihvYmosIG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGxpc3RlbmluZ1RvID0gdGhpcy5fbGlzdGVuaW5nVG8gfHwgKHRoaXMuX2xpc3RlbmluZ1RvID0ge30pO1xuICAgIHZhciBpZCA9IG9iai5fbGlzdGVuSWQgfHwgKG9iai5fbGlzdGVuSWQgPSBfLnVuaXF1ZUlkKCdsJykpO1xuICAgIGxpc3RlbmluZ1RvW2lkXSA9IG9iajtcbiAgICBpZiAoIWNhbGxiYWNrICYmIHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JykgY2FsbGJhY2sgPSB0aGlzO1xuICAgIG9ialtpbXBsZW1lbnRhdGlvbl0obmFtZSwgY2FsbGJhY2ssIHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRzO1xuIiwiKGZ1bmN0aW9uIChCdWZmZXIpe1xuJ3VzZSBzdHJpY3QnO1xuXG4vKiFcbiAqIFN0b3JhZ2UgZG9jdW1lbnRzIHVzaW5nIHNjaGVtYVxuICogaW5zcGlyZWQgYnkgbW9uZ29vc2UgMy44LjQgKGZpeGVkIGJ1Z3MgZm9yIDMuOC4xNilcbiAqXG4gKiBTdG9yYWdlIGltcGxlbWVudGF0aW9uXG4gKiBodHRwOi8vZG9jcy5tZXRlb3IuY29tLyNzZWxlY3RvcnNcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL3RyZWUvbWFzdGVyL3BhY2thZ2VzL21pbmltb25nb1xuICpcbiAqINC/0YDQvtGB0LvQtdC00LjRgtGMINC30LAg0LHQsNCz0L7QvCBnaC0xNjM4ICgzLjguMTYpXG4gKi9cblxuLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG52YXIgQ29sbGVjdGlvbiA9IHJlcXVpcmUoJy4vY29sbGVjdGlvbicpXG4gICwgU2NoZW1hID0gcmVxdWlyZSgnLi9zY2hlbWEnKVxuICAsIFNjaGVtYVR5cGUgPSByZXF1aXJlKCcuL3NjaGVtYXR5cGUnKVxuICAsIFZpcnR1YWxUeXBlID0gcmVxdWlyZSgnLi92aXJ0dWFsdHlwZScpXG4gICwgVHlwZXMgPSByZXF1aXJlKCcuL3R5cGVzJylcbiAgLCBEb2N1bWVudCA9IHJlcXVpcmUoJy4vZG9jdW1lbnQnKVxuICAsIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpXG4gICwgcGtnID0gcmVxdWlyZSgnLi4vcGFja2FnZS5qc29uJyk7XG5cblxuLyoqXG4gKiBTdG9yYWdlIGNvbnN0cnVjdG9yLlxuICpcbiAqIFRoZSBleHBvcnRzIG9iamVjdCBvZiB0aGUgYHN0b3JhZ2VgIG1vZHVsZSBpcyBhbiBpbnN0YW5jZSBvZiB0aGlzIGNsYXNzLlxuICogTW9zdCBhcHBzIHdpbGwgb25seSB1c2UgdGhpcyBvbmUgaW5zdGFuY2UuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuZnVuY3Rpb24gU3RvcmFnZSAoKSB7XG4gIHRoaXMuY29sbGVjdGlvbk5hbWVzID0gW107XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgY29sbGVjdGlvbiBhbmQgZ2V0IGl0XG4gKlxuICogQGV4YW1wbGVcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZVxuICogQHBhcmFtIHtzdG9yYWdlLlNjaGVtYXx1bmRlZmluZWR9IHNjaGVtYVxuICogQHBhcmFtIHtPYmplY3R9IFthcGldIC0g0YHRgdGL0LvQutCwINC90LAg0LDQv9C4INGA0LXRgdGD0YDRgVxuICogQHJldHVybnMge0NvbGxlY3Rpb258dW5kZWZpbmVkfVxuICovXG5TdG9yYWdlLnByb3RvdHlwZS5jcmVhdGVDb2xsZWN0aW9uID0gZnVuY3Rpb24oIG5hbWUsIHNjaGVtYSwgYXBpICl7XG4gIGlmICggdGhpc1sgbmFtZSBdICl7XG4gICAgY29uc29sZS5pbmZvKCdzdG9yYWdlOjpjb2xsZWN0aW9uOiBgJyArIG5hbWUgKyAnYCBhbHJlYWR5IGV4aXN0Jyk7XG4gICAgcmV0dXJuIHRoaXNbIG5hbWUgXTtcbiAgfVxuXG4gIGlmICggJ1NjaGVtYScgIT09IHV0aWxzLmdldEZ1bmN0aW9uTmFtZSggc2NoZW1hLmNvbnN0cnVjdG9yICkgKXtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdgc2NoZW1hYCBtdXN0IGJlIFNjaGVtYSBpbnN0YW5jZScpO1xuICB9XG5cbiAgdGhpcy5jb2xsZWN0aW9uTmFtZXMucHVzaCggbmFtZSApO1xuXG4gIHJldHVybiB0aGlzWyBuYW1lIF0gPSBuZXcgQ29sbGVjdGlvbiggbmFtZSwgc2NoZW1hLCBhcGkgKTtcbn07XG5cbi8qKlxuICogVG8gb2J0YWluIHRoZSBuYW1lcyBvZiB0aGUgY29sbGVjdGlvbnMgaW4gYW4gYXJyYXlcbiAqXG4gKiBAcmV0dXJucyB7QXJyYXkuPHN0cmluZz59IEFuIGFycmF5IGNvbnRhaW5pbmcgYWxsIGNvbGxlY3Rpb25zIGluIHRoZSBzdG9yYWdlLlxuICovXG5TdG9yYWdlLnByb3RvdHlwZS5nZXRDb2xsZWN0aW9uTmFtZXMgPSBmdW5jdGlvbigpe1xuICByZXR1cm4gdGhpcy5jb2xsZWN0aW9uTmFtZXM7XG59O1xuXG4vKipcbiAqIFRoZSBTdG9yYWdlIENvbGxlY3Rpb24gY29uc3RydWN0b3JcbiAqXG4gKiBAbWV0aG9kIENvbGxlY3Rpb25cbiAqIEBhcGkgcHVibGljXG4gKi9cblN0b3JhZ2UucHJvdG90eXBlLkNvbGxlY3Rpb24gPSBDb2xsZWN0aW9uO1xuXG4vKipcbiAqIFRoZSBTdG9yYWdlIHZlcnNpb25cbiAqXG4gKiBAcHJvcGVydHkgdmVyc2lvblxuICogQGFwaSBwdWJsaWNcbiAqL1xuU3RvcmFnZS5wcm90b3R5cGUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG4vKipcbiAqIFRoZSBTdG9yYWdlIFtTY2hlbWFdKCNzY2hlbWFfU2NoZW1hKSBjb25zdHJ1Y3RvclxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgU2NoZW1hID0gc3RvcmFnZS5TY2hlbWE7XG4gKiAgICAgdmFyIENhdFNjaGVtYSA9IG5ldyBTY2hlbWEoLi4pO1xuICpcbiAqIEBtZXRob2QgU2NoZW1hXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TdG9yYWdlLnByb3RvdHlwZS5TY2hlbWEgPSBTY2hlbWE7XG5cbi8qKlxuICogVGhlIFN0b3JhZ2UgW1NjaGVtYVR5cGVdKCNzY2hlbWF0eXBlX1NjaGVtYVR5cGUpIGNvbnN0cnVjdG9yXG4gKlxuICogQG1ldGhvZCBTY2hlbWFUeXBlXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TdG9yYWdlLnByb3RvdHlwZS5TY2hlbWFUeXBlID0gU2NoZW1hVHlwZTtcblxuLyoqXG4gKiBUaGUgdmFyaW91cyBTdG9yYWdlIFNjaGVtYVR5cGVzLlxuICpcbiAqICMjIyNOb3RlOlxuICpcbiAqIF9BbGlhcyBvZiBzdG9yYWdlLlNjaGVtYS5UeXBlcyBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuX1xuICpcbiAqIEBwcm9wZXJ0eSBTY2hlbWFUeXBlc1xuICogQHNlZSBTY2hlbWEuU2NoZW1hVHlwZXMgI3NjaGVtYV9TY2hlbWEuVHlwZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblN0b3JhZ2UucHJvdG90eXBlLlNjaGVtYVR5cGVzID0gU2NoZW1hLlR5cGVzO1xuXG4vKipcbiAqIFRoZSBTdG9yYWdlIFtWaXJ0dWFsVHlwZV0oI3ZpcnR1YWx0eXBlX1ZpcnR1YWxUeXBlKSBjb25zdHJ1Y3RvclxuICpcbiAqIEBtZXRob2QgVmlydHVhbFR5cGVcbiAqIEBhcGkgcHVibGljXG4gKi9cblN0b3JhZ2UucHJvdG90eXBlLlZpcnR1YWxUeXBlID0gVmlydHVhbFR5cGU7XG5cbi8qKlxuICogVGhlIHZhcmlvdXMgU3RvcmFnZSBUeXBlcy5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIGFycmF5ID0gc3RvcmFnZS5UeXBlcy5BcnJheTtcbiAqXG4gKiAjIyMjVHlwZXM6XG4gKlxuICogLSBbT2JqZWN0SWRdKCN0eXBlcy1vYmplY3RpZC1qcylcbiAqIC0gW0J1ZmZlcl0oI3R5cGVzLWJ1ZmZlci1qcylcbiAqIC0gW1N1YkRvY3VtZW50XSgjdHlwZXMtZW1iZWRkZWQtanMpXG4gKiAtIFtBcnJheV0oI3R5cGVzLWFycmF5LWpzKVxuICogLSBbRG9jdW1lbnRBcnJheV0oI3R5cGVzLWRvY3VtZW50YXJyYXktanMpXG4gKlxuICogVXNpbmcgdGhpcyBleHBvc2VkIGFjY2VzcyB0byB0aGUgYE9iamVjdElkYCB0eXBlLCB3ZSBjYW4gY29uc3RydWN0IGlkcyBvbiBkZW1hbmQuXG4gKlxuICogICAgIHZhciBPYmplY3RJZCA9IHN0b3JhZ2UuVHlwZXMuT2JqZWN0SWQ7XG4gKiAgICAgdmFyIGlkMSA9IG5ldyBPYmplY3RJZDtcbiAqXG4gKiBAcHJvcGVydHkgVHlwZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblN0b3JhZ2UucHJvdG90eXBlLlR5cGVzID0gVHlwZXM7XG5cbi8qKlxuICogVGhlIFN0b3JhZ2UgW0RvY3VtZW50XSgjZG9jdW1lbnQtanMpIGNvbnN0cnVjdG9yLlxuICpcbiAqIEBtZXRob2QgRG9jdW1lbnRcbiAqIEBhcGkgcHVibGljXG4gKi9cblN0b3JhZ2UucHJvdG90eXBlLkRvY3VtZW50ID0gRG9jdW1lbnQ7XG5cbi8qKlxuICogVGhlIFtTdG9yYWdlRXJyb3JdKCNlcnJvcl9TdG9yYWdlRXJyb3IpIGNvbnN0cnVjdG9yLlxuICpcbiAqIEBtZXRob2QgRXJyb3JcbiAqIEBhcGkgcHVibGljXG4gKi9cblN0b3JhZ2UucHJvdG90eXBlLkVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpO1xuXG5cblxuU3RvcmFnZS5wcm90b3R5cGUuU3RhdGVNYWNoaW5lID0gcmVxdWlyZSgnLi9zdGF0ZW1hY2hpbmUnKTtcblN0b3JhZ2UucHJvdG90eXBlLnV0aWxzID0gdXRpbHM7XG5TdG9yYWdlLnByb3RvdHlwZS5PYmplY3RJZCA9IFR5cGVzLk9iamVjdElkO1xuU3RvcmFnZS5wcm90b3R5cGUuc2NoZW1hcyA9IFNjaGVtYS5zY2hlbWFzO1xuXG5TdG9yYWdlLnByb3RvdHlwZS5zZXRBZGFwdGVyID0gZnVuY3Rpb24oIGFkYXB0ZXJIb29rcyApe1xuICBEb2N1bWVudC5wcm90b3R5cGUuYWRhcHRlckhvb2tzID0gYWRhcHRlckhvb2tzO1xufTtcblxuXG4vKiFcbiAqIFRoZSBleHBvcnRzIG9iamVjdCBpcyBhbiBpbnN0YW5jZSBvZiBTdG9yYWdlLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gbmV3IFN0b3JhZ2U7XG5cbndpbmRvdy5CdWZmZXIgPSBCdWZmZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcikiLCIndXNlIHN0cmljdCc7XG5cbi8vINCc0LDRiNC40L3QsCDRgdC+0YHRgtC+0Y/QvdC40Lkg0LjRgdC/0L7Qu9GM0LfRg9C10YLRgdGPINC00LvRjyDQv9C+0LzQtdGC0LrQuCwg0LIg0LrQsNC60L7QvCDRgdC+0YHRgtC+0Y/QvdC40Lgg0L3QsNGF0L7QtNGP0YLRgdGPINC/0L7Qu9C1XG4vLyDQndCw0L/RgNC40LzQtdGAOiDQtdGB0LvQuCDQv9C+0LvQtSDQuNC80LXQtdGCINGB0L7RgdGC0L7Rj9C90LjQtSBkZWZhdWx0IC0g0LfQvdCw0YfQuNGCINC10LPQviDQt9C90LDRh9C10L3QuNC10Lwg0Y/QstC70Y/QtdGC0YHRjyDQt9C90LDRh9C10L3QuNC1INC/0L4g0YPQvNC+0LvRh9Cw0L3QuNGOXG4vLyDQn9GA0LjQvNC10YfQsNC90LjQtTog0LTQu9GPINC80LDRgdGB0LjQstC+0LIg0LIg0L7QsdGJ0LXQvCDRgdC70YPRh9Cw0LUg0Y3RgtC+INC+0LfQvdCw0YfQsNC10YIg0L/Rg9GB0YLQvtC5INC80LDRgdGB0LjQslxuXG4vKiFcbiAqIERlcGVuZGVuY2llc1xuICovXG5cbnZhciBTdGF0ZU1hY2hpbmUgPSByZXF1aXJlKCcuL3N0YXRlbWFjaGluZScpO1xuXG52YXIgQWN0aXZlUm9zdGVyID0gU3RhdGVNYWNoaW5lLmN0b3IoJ3JlcXVpcmUnLCAnbW9kaWZ5JywgJ2luaXQnLCAnZGVmYXVsdCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEludGVybmFsQ2FjaGU7XG5cbmZ1bmN0aW9uIEludGVybmFsQ2FjaGUgKCkge1xuICB0aGlzLnN0cmljdE1vZGUgPSB1bmRlZmluZWQ7XG4gIHRoaXMuc2VsZWN0ZWQgPSB1bmRlZmluZWQ7XG4gIHRoaXMuc2F2ZUVycm9yID0gdW5kZWZpbmVkO1xuICB0aGlzLnZhbGlkYXRpb25FcnJvciA9IHVuZGVmaW5lZDtcbiAgdGhpcy5hZGhvY1BhdGhzID0gdW5kZWZpbmVkO1xuICB0aGlzLnJlbW92aW5nID0gdW5kZWZpbmVkO1xuICB0aGlzLmluc2VydGluZyA9IHVuZGVmaW5lZDtcbiAgdGhpcy52ZXJzaW9uID0gdW5kZWZpbmVkO1xuICB0aGlzLmdldHRlcnMgPSB7fTtcbiAgdGhpcy5faWQgPSB1bmRlZmluZWQ7XG4gIHRoaXMucG9wdWxhdGUgPSB1bmRlZmluZWQ7IC8vIHdoYXQgd2Ugd2FudCB0byBwb3B1bGF0ZSBpbiB0aGlzIGRvY1xuICB0aGlzLnBvcHVsYXRlZCA9IHVuZGVmaW5lZDsvLyB0aGUgX2lkcyB0aGF0IGhhdmUgYmVlbiBwb3B1bGF0ZWRcbiAgdGhpcy53YXNQb3B1bGF0ZWQgPSBmYWxzZTsgLy8gaWYgdGhpcyBkb2Mgd2FzIHRoZSByZXN1bHQgb2YgYSBwb3B1bGF0aW9uXG4gIHRoaXMuc2NvcGUgPSB1bmRlZmluZWQ7XG4gIHRoaXMuYWN0aXZlUGF0aHMgPSBuZXcgQWN0aXZlUm9zdGVyO1xuXG4gIC8vIGVtYmVkZGVkIGRvY3NcbiAgdGhpcy5vd25lckRvY3VtZW50ID0gdW5kZWZpbmVkO1xuICB0aGlzLmZ1bGxQYXRoID0gdW5kZWZpbmVkO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFJldHVybnMgdGhlIHZhbHVlIG9mIG9iamVjdCBgb2AgYXQgdGhlIGdpdmVuIGBwYXRoYC5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIG9iaiA9IHtcbiAqICAgICAgICAgY29tbWVudHM6IFtcbiAqICAgICAgICAgICAgIHsgdGl0bGU6ICdleGNpdGluZyEnLCBfZG9jOiB7IHRpdGxlOiAnZ3JlYXQhJyB9fVxuICogICAgICAgICAgICwgeyB0aXRsZTogJ251bWJlciBkb3MnIH1cbiAqICAgICAgICAgXVxuICogICAgIH1cbiAqXG4gKiAgICAgbXBhdGguZ2V0KCdjb21tZW50cy4wLnRpdGxlJywgbykgICAgICAgICAvLyAnZXhjaXRpbmchJ1xuICogICAgIG1wYXRoLmdldCgnY29tbWVudHMuMC50aXRsZScsIG8sICdfZG9jJykgLy8gJ2dyZWF0ISdcbiAqICAgICBtcGF0aC5nZXQoJ2NvbW1lbnRzLnRpdGxlJywgbykgICAgICAgICAgIC8vIFsnZXhjaXRpbmchJywgJ251bWJlciBkb3MnXVxuICpcbiAqICAgICAvLyBzdW1tYXJ5XG4gKiAgICAgbXBhdGguZ2V0KHBhdGgsIG8pXG4gKiAgICAgbXBhdGguZ2V0KHBhdGgsIG8sIHNwZWNpYWwpXG4gKiAgICAgbXBhdGguZ2V0KHBhdGgsIG8sIG1hcClcbiAqICAgICBtcGF0aC5nZXQocGF0aCwgbywgc3BlY2lhbCwgbWFwKVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge09iamVjdH0gb1xuICogQHBhcmFtIHtTdHJpbmd9IFtzcGVjaWFsXSBXaGVuIHRoaXMgcHJvcGVydHkgbmFtZSBpcyBwcmVzZW50IG9uIGFueSBvYmplY3QgaW4gdGhlIHBhdGgsIHdhbGtpbmcgd2lsbCBjb250aW51ZSBvbiB0aGUgdmFsdWUgb2YgdGhpcyBwcm9wZXJ0eS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFttYXBdIE9wdGlvbmFsIGZ1bmN0aW9uIHdoaWNoIHJlY2VpdmVzIGVhY2ggaW5kaXZpZHVhbCBmb3VuZCB2YWx1ZS4gVGhlIHZhbHVlIHJldHVybmVkIGZyb20gYG1hcGAgaXMgdXNlZCBpbiB0aGUgb3JpZ2luYWwgdmFsdWVzIHBsYWNlLlxuICovXG5cbmV4cG9ydHMuZ2V0ID0gZnVuY3Rpb24gKHBhdGgsIG8sIHNwZWNpYWwsIG1hcCkge1xuICB2YXIgbG9va3VwO1xuXG4gIGlmICgnZnVuY3Rpb24nID09IHR5cGVvZiBzcGVjaWFsKSB7XG4gICAgaWYgKHNwZWNpYWwubGVuZ3RoIDwgMikge1xuICAgICAgbWFwID0gc3BlY2lhbDtcbiAgICAgIHNwZWNpYWwgPSB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvb2t1cCA9IHNwZWNpYWw7XG4gICAgICBzcGVjaWFsID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuXG4gIG1hcCB8fCAobWFwID0gSyk7XG5cbiAgdmFyIHBhcnRzID0gJ3N0cmluZycgPT0gdHlwZW9mIHBhdGhcbiAgICA/IHBhdGguc3BsaXQoJy4nKVxuICAgIDogcGF0aDtcblxuICBpZiAoIUFycmF5LmlzQXJyYXkocGFydHMpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBgcGF0aGAuIE11c3QgYmUgZWl0aGVyIHN0cmluZyBvciBhcnJheScpO1xuICB9XG5cbiAgdmFyIG9iaiA9IG9cbiAgICAsIHBhcnQ7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7ICsraSkge1xuICAgIHBhcnQgPSBwYXJ0c1tpXTtcblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iaikgJiYgIS9eXFxkKyQvLnRlc3QocGFydCkpIHtcbiAgICAgIC8vIHJlYWRpbmcgYSBwcm9wZXJ0eSBmcm9tIHRoZSBhcnJheSBpdGVtc1xuICAgICAgdmFyIHBhdGhzID0gcGFydHMuc2xpY2UoaSk7XG5cbiAgICAgIHJldHVybiBvYmoubWFwKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtXG4gICAgICAgICAgPyBleHBvcnRzLmdldChwYXRocywgaXRlbSwgc3BlY2lhbCB8fCBsb29rdXAsIG1hcClcbiAgICAgICAgICA6IG1hcCh1bmRlZmluZWQpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKGxvb2t1cCkge1xuICAgICAgb2JqID0gbG9va3VwKG9iaiwgcGFydCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9iaiA9IHNwZWNpYWwgJiYgb2JqW3NwZWNpYWxdXG4gICAgICAgID8gb2JqW3NwZWNpYWxdW3BhcnRdXG4gICAgICAgIDogb2JqW3BhcnRdO1xuICAgIH1cblxuICAgIGlmICghb2JqKSByZXR1cm4gbWFwKG9iaik7XG4gIH1cblxuICByZXR1cm4gbWFwKG9iaik7XG59O1xuXG4vKipcbiAqIFNldHMgdGhlIGB2YWxgIGF0IHRoZSBnaXZlbiBgcGF0aGAgb2Ygb2JqZWN0IGBvYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHBhcmFtIHsqfSB2YWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvXG4gKiBAcGFyYW0ge1N0cmluZ30gW3NwZWNpYWxdIFdoZW4gdGhpcyBwcm9wZXJ0eSBuYW1lIGlzIHByZXNlbnQgb24gYW55IG9iamVjdCBpbiB0aGUgcGF0aCwgd2Fsa2luZyB3aWxsIGNvbnRpbnVlIG9uIHRoZSB2YWx1ZSBvZiB0aGlzIHByb3BlcnR5LlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW21hcF0gT3B0aW9uYWwgZnVuY3Rpb24gd2hpY2ggaXMgcGFzc2VkIGVhY2ggaW5kaXZpZHVhbCB2YWx1ZSBiZWZvcmUgc2V0dGluZyBpdC4gVGhlIHZhbHVlIHJldHVybmVkIGZyb20gYG1hcGAgaXMgdXNlZCBpbiB0aGUgb3JpZ2luYWwgdmFsdWVzIHBsYWNlLlxuICovXG5cbmV4cG9ydHMuc2V0ID0gZnVuY3Rpb24gKHBhdGgsIHZhbCwgbywgc3BlY2lhbCwgbWFwLCBfY29weWluZykge1xuICB2YXIgbG9va3VwO1xuXG4gIGlmICgnZnVuY3Rpb24nID09IHR5cGVvZiBzcGVjaWFsKSB7XG4gICAgaWYgKHNwZWNpYWwubGVuZ3RoIDwgMikge1xuICAgICAgbWFwID0gc3BlY2lhbDtcbiAgICAgIHNwZWNpYWwgPSB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvb2t1cCA9IHNwZWNpYWw7XG4gICAgICBzcGVjaWFsID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuXG4gIG1hcCB8fCAobWFwID0gSyk7XG5cbiAgdmFyIHBhcnRzID0gJ3N0cmluZycgPT0gdHlwZW9mIHBhdGhcbiAgICA/IHBhdGguc3BsaXQoJy4nKVxuICAgIDogcGF0aDtcblxuICBpZiAoIUFycmF5LmlzQXJyYXkocGFydHMpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBgcGF0aGAuIE11c3QgYmUgZWl0aGVyIHN0cmluZyBvciBhcnJheScpO1xuICB9XG5cbiAgaWYgKG51bGwgPT0gbykgcmV0dXJuO1xuXG4gIC8vIHRoZSBleGlzdGFuY2Ugb2YgJCBpbiBhIHBhdGggdGVsbHMgdXMgaWYgdGhlIHVzZXIgZGVzaXJlc1xuICAvLyB0aGUgY29weWluZyBvZiBhbiBhcnJheSBpbnN0ZWFkIG9mIHNldHRpbmcgZWFjaCB2YWx1ZSBvZlxuICAvLyB0aGUgYXJyYXkgdG8gdGhlIG9uZSBieSBvbmUgdG8gbWF0Y2hpbmcgcG9zaXRpb25zIG9mIHRoZVxuICAvLyBjdXJyZW50IGFycmF5LlxuICB2YXIgY29weSA9IF9jb3B5aW5nIHx8IC9cXCQvLnRlc3QocGF0aClcbiAgICAsIG9iaiA9IG9cbiAgICAsIHBhcnQ7XG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHBhcnRzLmxlbmd0aCAtIDE7IGkgPCBsZW47ICsraSkge1xuICAgIHBhcnQgPSBwYXJ0c1tpXTtcblxuICAgIGlmICgnJCcgPT0gcGFydCkge1xuICAgICAgaWYgKGkgPT0gbGVuIC0gMSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iaikgJiYgIS9eXFxkKyQvLnRlc3QocGFydCkpIHtcbiAgICAgIHZhciBwYXRocyA9IHBhcnRzLnNsaWNlKGkpO1xuICAgICAgaWYgKCFjb3B5ICYmIEFycmF5LmlzQXJyYXkodmFsKSkge1xuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG9iai5sZW5ndGggJiYgaiA8IHZhbC5sZW5ndGg7ICsraikge1xuICAgICAgICAgIC8vIGFzc2lnbm1lbnQgb2Ygc2luZ2xlIHZhbHVlcyBvZiBhcnJheVxuICAgICAgICAgIGV4cG9ydHMuc2V0KHBhdGhzLCB2YWxbal0sIG9ialtqXSwgc3BlY2lhbCB8fCBsb29rdXAsIG1hcCwgY29weSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgb2JqLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgLy8gYXNzaWdubWVudCBvZiBlbnRpcmUgdmFsdWVcbiAgICAgICAgICBleHBvcnRzLnNldChwYXRocywgdmFsLCBvYmpbal0sIHNwZWNpYWwgfHwgbG9va3VwLCBtYXAsIGNvcHkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGxvb2t1cCkge1xuICAgICAgb2JqID0gbG9va3VwKG9iaiwgcGFydCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9iaiA9IHNwZWNpYWwgJiYgb2JqW3NwZWNpYWxdXG4gICAgICAgID8gb2JqW3NwZWNpYWxdW3BhcnRdXG4gICAgICAgIDogb2JqW3BhcnRdO1xuICAgIH1cblxuICAgIGlmICghb2JqKSByZXR1cm47XG4gIH1cblxuICAvLyBwcm9jZXNzIHRoZSBsYXN0IHByb3BlcnR5IG9mIHRoZSBwYXRoXG5cbiAgcGFydCA9IHBhcnRzW2xlbl07XG5cbiAgLy8gdXNlIHRoZSBzcGVjaWFsIHByb3BlcnR5IGlmIGV4aXN0c1xuICBpZiAoc3BlY2lhbCAmJiBvYmpbc3BlY2lhbF0pIHtcbiAgICBvYmogPSBvYmpbc3BlY2lhbF07XG4gIH1cblxuICAvLyBzZXQgdGhlIHZhbHVlIG9uIHRoZSBsYXN0IGJyYW5jaFxuICBpZiAoQXJyYXkuaXNBcnJheShvYmopICYmICEvXlxcZCskLy50ZXN0KHBhcnQpKSB7XG4gICAgaWYgKCFjb3B5ICYmIEFycmF5LmlzQXJyYXkodmFsKSkge1xuICAgICAgZm9yICh2YXIgaXRlbSwgaiA9IDA7IGogPCBvYmoubGVuZ3RoICYmIGogPCB2YWwubGVuZ3RoOyArK2opIHtcbiAgICAgICAgaXRlbSA9IG9ialtqXTtcbiAgICAgICAgaWYgKGl0ZW0pIHtcbiAgICAgICAgICBpZiAobG9va3VwKSB7XG4gICAgICAgICAgICBsb29rdXAoaXRlbSwgcGFydCwgbWFwKHZhbFtqXSkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaXRlbVtzcGVjaWFsXSkgaXRlbSA9IGl0ZW1bc3BlY2lhbF07XG4gICAgICAgICAgICBpdGVtW3BhcnRdID0gbWFwKHZhbFtqXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgb2JqLmxlbmd0aDsgKytqKSB7XG4gICAgICAgIGl0ZW0gPSBvYmpbal07XG4gICAgICAgIGlmIChpdGVtKSB7XG4gICAgICAgICAgaWYgKGxvb2t1cCkge1xuICAgICAgICAgICAgbG9va3VwKGl0ZW0sIHBhcnQsIG1hcCh2YWwpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGl0ZW1bc3BlY2lhbF0pIGl0ZW0gPSBpdGVtW3NwZWNpYWxdO1xuICAgICAgICAgICAgaXRlbVtwYXJ0XSA9IG1hcCh2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAobG9va3VwKSB7XG4gICAgICBsb29rdXAob2JqLCBwYXJ0LCBtYXAodmFsKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ialtwYXJ0XSA9IG1hcCh2YWwpO1xuICAgIH1cbiAgfVxufTtcblxuLyohXG4gKiBSZXR1cm5zIHRoZSB2YWx1ZSBwYXNzZWQgdG8gaXQuXG4gKi9cblxuZnVuY3Rpb24gSyAodikge1xuICByZXR1cm4gdjtcbn0iLCIndXNlIHN0cmljdCc7XG5cbi8qIVxuICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAqL1xuXG52YXIgRXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKVxuICAsIFZpcnR1YWxUeXBlID0gcmVxdWlyZSgnLi92aXJ0dWFsdHlwZScpXG4gICwgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJylcbiAgLCBUeXBlc1xuICAsIHNjaGVtYXM7XG5cbi8qKlxuICogU2NoZW1hIGNvbnN0cnVjdG9yLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgY2hpbGQgPSBuZXcgU2NoZW1hKHsgbmFtZTogU3RyaW5nIH0pO1xuICogICAgIHZhciBzY2hlbWEgPSBuZXcgU2NoZW1hKHsgbmFtZTogU3RyaW5nLCBhZ2U6IE51bWJlciwgY2hpbGRyZW46IFtjaGlsZF0gfSk7XG4gKiAgICAgdmFyIFRyZWUgPSBtb25nb29zZS5tb2RlbCgnVHJlZScsIHNjaGVtYSk7XG4gKlxuICogICAgIC8vIHNldHRpbmcgc2NoZW1hIG9wdGlvbnNcbiAqICAgICBuZXcgU2NoZW1hKHsgbmFtZTogU3RyaW5nIH0sIHsgX2lkOiBmYWxzZSwgYXV0b0luZGV4OiBmYWxzZSB9KVxuICpcbiAqICMjIyNPcHRpb25zOlxuICpcbiAqIC0gW2NvbGxlY3Rpb25dKC9kb2NzL2d1aWRlLmh0bWwjY29sbGVjdGlvbik6IHN0cmluZyAtIG5vIGRlZmF1bHRcbiAqIC0gW2lkXSgvZG9jcy9ndWlkZS5odG1sI2lkKTogYm9vbCAtIGRlZmF1bHRzIHRvIHRydWVcbiAqIC0gYG1pbmltaXplYDogYm9vbCAtIGNvbnRyb2xzIFtkb2N1bWVudCN0b09iamVjdF0oI2RvY3VtZW50X0RvY3VtZW50LXRvT2JqZWN0KSBiZWhhdmlvciB3aGVuIGNhbGxlZCBtYW51YWxseSAtIGRlZmF1bHRzIHRvIHRydWVcbiAqIC0gW3N0cmljdF0oL2RvY3MvZ3VpZGUuaHRtbCNzdHJpY3QpOiBib29sIC0gZGVmYXVsdHMgdG8gdHJ1ZVxuICogLSBbdG9KU09OXSgvZG9jcy9ndWlkZS5odG1sI3RvSlNPTikgLSBvYmplY3QgLSBubyBkZWZhdWx0XG4gKiAtIFt0b09iamVjdF0oL2RvY3MvZ3VpZGUuaHRtbCN0b09iamVjdCkgLSBvYmplY3QgLSBubyBkZWZhdWx0XG4gKiAtIFt2ZXJzaW9uS2V5XSgvZG9jcy9ndWlkZS5odG1sI3ZlcnNpb25LZXkpOiBib29sIC0gZGVmYXVsdHMgdG8gXCJfX3ZcIlxuICpcbiAqICMjIyNOb3RlOlxuICpcbiAqIF9XaGVuIG5lc3Rpbmcgc2NoZW1hcywgKGBjaGlsZHJlbmAgaW4gdGhlIGV4YW1wbGUgYWJvdmUpLCBhbHdheXMgZGVjbGFyZSB0aGUgY2hpbGQgc2NoZW1hIGZpcnN0IGJlZm9yZSBwYXNzaW5nIGl0IGludG8gaXMgcGFyZW50Ll9cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3x1bmRlZmluZWR9IFtuYW1lXSDQndCw0LfQstCw0L3QuNC1INGB0YXQtdC80YtcbiAqIEBwYXJhbSB7U2NoZW1hfSBbYmFzZVNjaGVtYV0g0JHQsNC30L7QstCw0Y8g0YHRhdC10LzQsCDQv9GA0Lgg0L3QsNGB0LvQtdC00L7QstCw0L3QuNC4XG4gKiBAcGFyYW0ge09iamVjdH0gb2JqINCh0YXQtdC80LBcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEBhcGkgcHVibGljXG4gKi9cbmZ1bmN0aW9uIFNjaGVtYSAoIG5hbWUsIGJhc2VTY2hlbWEsIG9iaiwgb3B0aW9ucyApIHtcbiAgaWYgKCAhKHRoaXMgaW5zdGFuY2VvZiBTY2hlbWEpICkge1xuICAgIHJldHVybiBuZXcgU2NoZW1hKCBuYW1lLCBiYXNlU2NoZW1hLCBvYmosIG9wdGlvbnMgKTtcbiAgfVxuXG4gIC8vINCV0YHQu9C4INGN0YLQviDQuNC80LXQvdC+0LLQsNC90LDRjyDRgdGF0LXQvNCwXG4gIGlmICggdHlwZW9mIG5hbWUgPT09ICdzdHJpbmcnICl7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICBzY2hlbWFzWyBuYW1lIF0gPSB0aGlzO1xuICB9IGVsc2Uge1xuICAgIG9wdGlvbnMgPSBvYmo7XG4gICAgb2JqID0gYmFzZVNjaGVtYTtcbiAgICBiYXNlU2NoZW1hID0gbmFtZTtcbiAgICBuYW1lID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKCAhKGJhc2VTY2hlbWEgaW5zdGFuY2VvZiBTY2hlbWEpICl7XG4gICAgb3B0aW9ucyA9IG9iajtcbiAgICBvYmogPSBiYXNlU2NoZW1hO1xuICAgIGJhc2VTY2hlbWEgPSB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyDQodC+0YXRgNCw0L3QuNC8INC+0L/QuNGB0LDQvdC40LUg0YHRhdC10LzRiyDQtNC70Y8g0L/QvtC00LTQtdGA0LbQutC4INC00LjRgdC60YDQuNC80LjQvdCw0YLQvtGA0L7QslxuICB0aGlzLnNvdXJjZSA9IG9iajtcblxuICB0aGlzLnBhdGhzID0ge307XG4gIHRoaXMuc3VicGF0aHMgPSB7fTtcbiAgdGhpcy52aXJ0dWFscyA9IHt9O1xuICB0aGlzLm5lc3RlZCA9IHt9O1xuICB0aGlzLmluaGVyaXRzID0ge307XG4gIHRoaXMuY2FsbFF1ZXVlID0gW107XG4gIHRoaXMubWV0aG9kcyA9IHt9O1xuICB0aGlzLnN0YXRpY3MgPSB7fTtcbiAgdGhpcy50cmVlID0ge307XG4gIHRoaXMuX3JlcXVpcmVkcGF0aHMgPSB1bmRlZmluZWQ7XG4gIHRoaXMuZGlzY3JpbWluYXRvck1hcHBpbmcgPSB1bmRlZmluZWQ7XG5cbiAgdGhpcy5vcHRpb25zID0gdGhpcy5kZWZhdWx0T3B0aW9ucyggb3B0aW9ucyApO1xuXG4gIGlmICggYmFzZVNjaGVtYSBpbnN0YW5jZW9mIFNjaGVtYSApe1xuICAgIGJhc2VTY2hlbWEuZGlzY3JpbWluYXRvciggbmFtZSwgdGhpcyApO1xuICB9XG5cbiAgLy8gYnVpbGQgcGF0aHNcbiAgaWYgKCBvYmogKSB7XG4gICAgdGhpcy5hZGQoIG9iaiApO1xuICB9XG5cbiAgLy8gZW5zdXJlIHRoZSBkb2N1bWVudHMgZ2V0IGFuIGF1dG8gX2lkIHVubGVzcyBkaXNhYmxlZFxuICB2YXIgYXV0b19pZCA9ICF0aGlzLnBhdGhzWydfaWQnXSAmJiAoIXRoaXMub3B0aW9ucy5ub0lkICYmIHRoaXMub3B0aW9ucy5faWQpO1xuICBpZiAoYXV0b19pZCkge1xuICAgIHRoaXMuYWRkKHsgX2lkOiB7dHlwZTogU2NoZW1hLk9iamVjdElkLCBhdXRvOiB0cnVlfSB9KTtcbiAgfVxuXG4gIC8vIGVuc3VyZSB0aGUgZG9jdW1lbnRzIHJlY2VpdmUgYW4gaWQgZ2V0dGVyIHVubGVzcyBkaXNhYmxlZFxuICB2YXIgYXV0b2lkID0gIXRoaXMucGF0aHNbJ2lkJ10gJiYgdGhpcy5vcHRpb25zLmlkO1xuICBpZiAoIGF1dG9pZCApIHtcbiAgICB0aGlzLnZpcnR1YWwoJ2lkJykuZ2V0KCBpZEdldHRlciApO1xuICB9XG59XG5cbi8qIVxuICogUmV0dXJucyB0aGlzIGRvY3VtZW50cyBfaWQgY2FzdCB0byBhIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gaWRHZXR0ZXIgKCkge1xuICBpZiAodGhpcy4kX18uX2lkKSB7XG4gICAgcmV0dXJuIHRoaXMuJF9fLl9pZDtcbiAgfVxuXG4gIHJldHVybiB0aGlzLiRfXy5faWQgPSBudWxsID09IHRoaXMuX2lkXG4gICAgPyBudWxsXG4gICAgOiBTdHJpbmcodGhpcy5faWQpO1xufVxuXG4vKiFcbiAqIEluaGVyaXQgZnJvbSBFdmVudEVtaXR0ZXIuXG4gKi9cblNjaGVtYS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBFdmVudHMucHJvdG90eXBlICk7XG5TY2hlbWEucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gU2NoZW1hO1xuXG4vKipcbiAqIFNjaGVtYSBhcyBmbGF0IHBhdGhzXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKiAgICAge1xuICogICAgICAgICAnX2lkJyAgICAgICAgOiBTY2hlbWFUeXBlLFxuICogICAgICAgLCAnbmVzdGVkLmtleScgOiBTY2hlbWFUeXBlLFxuICogICAgIH1cbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqIEBwcm9wZXJ0eSBwYXRoc1xuICovXG5TY2hlbWEucHJvdG90eXBlLnBhdGhzO1xuXG4vKipcbiAqIFNjaGVtYSBhcyBhIHRyZWVcbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqICAgICB7XG4gKiAgICAgICAgICdfaWQnICAgICA6IE9iamVjdElkXG4gKiAgICAgICAsICduZXN0ZWQnICA6IHtcbiAqICAgICAgICAgICAgICdrZXknIDogU3RyaW5nXG4gKiAgICAgICAgIH1cbiAqICAgICB9XG4gKlxuICogQGFwaSBwcml2YXRlXG4gKiBAcHJvcGVydHkgdHJlZVxuICovXG5TY2hlbWEucHJvdG90eXBlLnRyZWU7XG5cbi8qKlxuICogUmV0dXJucyBkZWZhdWx0IG9wdGlvbnMgZm9yIHRoaXMgc2NoZW1hLCBtZXJnZWQgd2l0aCBgb3B0aW9uc2AuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5TY2hlbWEucHJvdG90eXBlLmRlZmF1bHRPcHRpb25zID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9ICQuZXh0ZW5kKHtcbiAgICAgIHN0cmljdDogdHJ1ZVxuICAgICwgdmVyc2lvbktleTogJ19fdidcbiAgICAsIGRpc2NyaW1pbmF0b3JLZXk6ICdfX3QnXG4gICAgLCBtaW5pbWl6ZTogdHJ1ZVxuICAgIC8vIHRoZSBmb2xsb3dpbmcgYXJlIG9ubHkgYXBwbGllZCBhdCBjb25zdHJ1Y3Rpb24gdGltZVxuICAgICwgX2lkOiB0cnVlXG4gICAgLCBpZDogdHJ1ZVxuICB9LCBvcHRpb25zICk7XG5cbiAgcmV0dXJuIG9wdGlvbnM7XG59O1xuXG4vKipcbiAqIEFkZHMga2V5IHBhdGggLyBzY2hlbWEgdHlwZSBwYWlycyB0byB0aGlzIHNjaGVtYS5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIFRveVNjaGVtYSA9IG5ldyBTY2hlbWE7XG4gKiAgICAgVG95U2NoZW1hLmFkZCh7IG5hbWU6ICdzdHJpbmcnLCBjb2xvcjogJ3N0cmluZycsIHByaWNlOiAnbnVtYmVyJyB9KTtcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJlZml4XG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWEucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIGFkZCAoIG9iaiwgcHJlZml4ICkge1xuICBwcmVmaXggPSBwcmVmaXggfHwgJyc7XG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoIG9iaiApO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7ICsraSkge1xuICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuXG4gICAgaWYgKG51bGwgPT0gb2JqWyBrZXkgXSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCB2YWx1ZSBmb3Igc2NoZW1hIHBhdGggYCcrIHByZWZpeCArIGtleSArJ2AnKTtcbiAgICB9XG5cbiAgICBpZiAoIF8uaXNQbGFpbk9iamVjdChvYmpba2V5XSApXG4gICAgICAmJiAoICFvYmpbIGtleSBdLmNvbnN0cnVjdG9yIHx8ICdPYmplY3QnID09IHV0aWxzLmdldEZ1bmN0aW9uTmFtZShvYmpba2V5XS5jb25zdHJ1Y3RvcikgKVxuICAgICAgJiYgKCAhb2JqWyBrZXkgXS50eXBlIHx8IG9ialsga2V5IF0udHlwZS50eXBlICkgKXtcblxuICAgICAgaWYgKCBPYmplY3Qua2V5cyhvYmpbIGtleSBdKS5sZW5ndGggKSB7XG4gICAgICAgIC8vIG5lc3RlZCBvYmplY3QgeyBsYXN0OiB7IG5hbWU6IFN0cmluZyB9fVxuICAgICAgICB0aGlzLm5lc3RlZFsgcHJlZml4ICsga2V5IF0gPSB0cnVlO1xuICAgICAgICB0aGlzLmFkZCggb2JqWyBrZXkgXSwgcHJlZml4ICsga2V5ICsgJy4nKTtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5wYXRoKCBwcmVmaXggKyBrZXksIG9ialsga2V5IF0gKTsgLy8gbWl4ZWQgdHlwZVxuICAgICAgfVxuXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGF0aCggcHJlZml4ICsga2V5LCBvYmpbIGtleSBdICk7XG4gICAgfVxuICB9XG59O1xuXG4vKipcbiAqIFJlc2VydmVkIGRvY3VtZW50IGtleXMuXG4gKlxuICogS2V5cyBpbiB0aGlzIG9iamVjdCBhcmUgbmFtZXMgdGhhdCBhcmUgcmVqZWN0ZWQgaW4gc2NoZW1hIGRlY2xhcmF0aW9ucyBiL2MgdGhleSBjb25mbGljdCB3aXRoIG1vbmdvb3NlIGZ1bmN0aW9uYWxpdHkuIFVzaW5nIHRoZXNlIGtleSBuYW1lIHdpbGwgdGhyb3cgYW4gZXJyb3IuXG4gKlxuICogICAgICBvbiwgZW1pdCwgX2V2ZW50cywgZGIsIGdldCwgc2V0LCBpbml0LCBpc05ldywgZXJyb3JzLCBzY2hlbWEsIG9wdGlvbnMsIG1vZGVsTmFtZSwgY29sbGVjdGlvbiwgX3ByZXMsIF9wb3N0cywgdG9PYmplY3RcbiAqXG4gKiBfTk9URTpfIFVzZSBvZiB0aGVzZSB0ZXJtcyBhcyBtZXRob2QgbmFtZXMgaXMgcGVybWl0dGVkLCBidXQgcGxheSBhdCB5b3VyIG93biByaXNrLCBhcyB0aGV5IG1heSBiZSBleGlzdGluZyBtb25nb29zZSBkb2N1bWVudCBtZXRob2RzIHlvdSBhcmUgc3RvbXBpbmcgb24uXG4gKlxuICogICAgICB2YXIgc2NoZW1hID0gbmV3IFNjaGVtYSguLik7XG4gKiAgICAgIHNjaGVtYS5tZXRob2RzLmluaXQgPSBmdW5jdGlvbiAoKSB7fSAvLyBwb3RlbnRpYWxseSBicmVha2luZ1xuICovXG5TY2hlbWEucmVzZXJ2ZWQgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG52YXIgcmVzZXJ2ZWQgPSBTY2hlbWEucmVzZXJ2ZWQ7XG5yZXNlcnZlZC5vbiA9XG5yZXNlcnZlZC5kYiA9XG5yZXNlcnZlZC5nZXQgPVxucmVzZXJ2ZWQuc2V0ID1cbnJlc2VydmVkLmluaXQgPVxucmVzZXJ2ZWQuaXNOZXcgPVxucmVzZXJ2ZWQuZXJyb3JzID1cbnJlc2VydmVkLnNjaGVtYSA9XG5yZXNlcnZlZC5vcHRpb25zID1cbnJlc2VydmVkLm1vZGVsTmFtZSA9XG5yZXNlcnZlZC5jb2xsZWN0aW9uID1cbnJlc2VydmVkLnRvT2JqZWN0ID1cbnJlc2VydmVkLmRvbWFpbiA9XG5yZXNlcnZlZC5lbWl0ID0gICAgLy8gRXZlbnRFbWl0dGVyXG5yZXNlcnZlZC5fZXZlbnRzID0gLy8gRXZlbnRFbWl0dGVyXG5yZXNlcnZlZC5fcHJlcyA9IHJlc2VydmVkLl9wb3N0cyA9IDE7IC8vIGhvb2tzLmpzXG5cbi8qKlxuICogR2V0cy9zZXRzIHNjaGVtYSBwYXRocy5cbiAqXG4gKiBTZXRzIGEgcGF0aCAoaWYgYXJpdHkgMilcbiAqIEdldHMgYSBwYXRoIChpZiBhcml0eSAxKVxuICpcbiAqICMjIyNFeGFtcGxlXG4gKlxuICogICAgIHNjaGVtYS5wYXRoKCduYW1lJykgLy8gcmV0dXJucyBhIFNjaGVtYVR5cGVcbiAqICAgICBzY2hlbWEucGF0aCgnbmFtZScsIE51bWJlcikgLy8gY2hhbmdlcyB0aGUgc2NoZW1hVHlwZSBvZiBgbmFtZWAgdG8gTnVtYmVyXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25zdHJ1Y3RvclxuICogQGFwaSBwdWJsaWNcbiAqL1xuU2NoZW1hLnByb3RvdHlwZS5wYXRoID0gZnVuY3Rpb24gKHBhdGgsIG9iaikge1xuICBpZiAob2JqID09IHVuZGVmaW5lZCkge1xuICAgIGlmICh0aGlzLnBhdGhzW3BhdGhdKSByZXR1cm4gdGhpcy5wYXRoc1twYXRoXTtcbiAgICBpZiAodGhpcy5zdWJwYXRoc1twYXRoXSkgcmV0dXJuIHRoaXMuc3VicGF0aHNbcGF0aF07XG5cbiAgICAvLyBzdWJwYXRocz9cbiAgICByZXR1cm4gL1xcLlxcZCtcXC4/LiokLy50ZXN0KHBhdGgpXG4gICAgICA/IGdldFBvc2l0aW9uYWxQYXRoKHRoaXMsIHBhdGgpXG4gICAgICA6IHVuZGVmaW5lZDtcbiAgfVxuXG4gIC8vIHNvbWUgcGF0aCBuYW1lcyBjb25mbGljdCB3aXRoIGRvY3VtZW50IG1ldGhvZHNcbiAgaWYgKHJlc2VydmVkW3BhdGhdKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiYFwiICsgcGF0aCArIFwiYCBtYXkgbm90IGJlIHVzZWQgYXMgYSBzY2hlbWEgcGF0aG5hbWVcIik7XG4gIH1cblxuICAvLyB1cGRhdGUgdGhlIHRyZWVcbiAgdmFyIHN1YnBhdGhzID0gcGF0aC5zcGxpdCgvXFwuLylcbiAgICAsIGxhc3QgPSBzdWJwYXRocy5wb3AoKVxuICAgICwgYnJhbmNoID0gdGhpcy50cmVlO1xuXG4gIHN1YnBhdGhzLmZvckVhY2goZnVuY3Rpb24oc3ViLCBpKSB7XG4gICAgaWYgKCFicmFuY2hbc3ViXSkgYnJhbmNoW3N1Yl0gPSB7fTtcbiAgICBpZiAoJ29iamVjdCcgIT0gdHlwZW9mIGJyYW5jaFtzdWJdKSB7XG4gICAgICB2YXIgbXNnID0gJ0Nhbm5vdCBzZXQgbmVzdGVkIHBhdGggYCcgKyBwYXRoICsgJ2AuICdcbiAgICAgICAgICAgICAgKyAnUGFyZW50IHBhdGggYCdcbiAgICAgICAgICAgICAgKyBzdWJwYXRocy5zbGljZSgwLCBpKS5jb25jYXQoW3N1Yl0pLmpvaW4oJy4nKVxuICAgICAgICAgICAgICArICdgIGFscmVhZHkgc2V0IHRvIHR5cGUgJyArIGJyYW5jaFtzdWJdLm5hbWVcbiAgICAgICAgICAgICAgKyAnLic7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgICB9XG4gICAgYnJhbmNoID0gYnJhbmNoW3N1Yl07XG4gIH0pO1xuXG4gIGJyYW5jaFtsYXN0XSA9IHV0aWxzLmNsb25lKG9iaik7XG5cbiAgdGhpcy5wYXRoc1twYXRoXSA9IFNjaGVtYS5pbnRlcnByZXRBc1R5cGUocGF0aCwgb2JqKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIENvbnZlcnRzIHR5cGUgYXJndW1lbnRzIGludG8gU2NoZW1hIFR5cGVzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIGNvbnN0cnVjdG9yXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuU2NoZW1hLmludGVycHJldEFzVHlwZSA9IGZ1bmN0aW9uIChwYXRoLCBvYmopIHtcbiAgdmFyIGNvbnN0cnVjdG9yTmFtZSA9IHV0aWxzLmdldEZ1bmN0aW9uTmFtZShvYmouY29uc3RydWN0b3IpO1xuICBpZiAoY29uc3RydWN0b3JOYW1lICE9ICdPYmplY3QnKXtcbiAgICBvYmogPSB7IHR5cGU6IG9iaiB9O1xuICB9XG5cbiAgLy8gR2V0IHRoZSB0eXBlIG1ha2luZyBzdXJlIHRvIGFsbG93IGtleXMgbmFtZWQgXCJ0eXBlXCJcbiAgLy8gYW5kIGRlZmF1bHQgdG8gbWl4ZWQgaWYgbm90IHNwZWNpZmllZC5cbiAgLy8geyB0eXBlOiB7IHR5cGU6IFN0cmluZywgZGVmYXVsdDogJ2ZyZXNoY3V0JyB9IH1cbiAgdmFyIHR5cGUgPSBvYmoudHlwZSAmJiAhb2JqLnR5cGUudHlwZVxuICAgID8gb2JqLnR5cGVcbiAgICA6IHt9O1xuXG4gIGlmICgnT2JqZWN0JyA9PSB1dGlscy5nZXRGdW5jdGlvbk5hbWUodHlwZS5jb25zdHJ1Y3RvcikgfHwgJ21peGVkJyA9PSB0eXBlKSB7XG4gICAgcmV0dXJuIG5ldyBUeXBlcy5NaXhlZChwYXRoLCBvYmopO1xuICB9XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkodHlwZSkgfHwgQXJyYXkgPT0gdHlwZSB8fCAnYXJyYXknID09IHR5cGUpIHtcbiAgICAvLyBpZiBpdCB3YXMgc3BlY2lmaWVkIHRocm91Z2ggeyB0eXBlIH0gbG9vayBmb3IgYGNhc3RgXG4gICAgdmFyIGNhc3QgPSAoQXJyYXkgPT0gdHlwZSB8fCAnYXJyYXknID09IHR5cGUpXG4gICAgICA/IG9iai5jYXN0XG4gICAgICA6IHR5cGVbMF07XG5cbiAgICBpZiAoY2FzdCBpbnN0YW5jZW9mIFNjaGVtYSkge1xuICAgICAgcmV0dXJuIG5ldyBUeXBlcy5Eb2N1bWVudEFycmF5KHBhdGgsIGNhc3QsIG9iaik7XG4gICAgfVxuXG4gICAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiBjYXN0KSB7XG4gICAgICBjYXN0ID0gVHlwZXNbY2FzdC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGNhc3Quc3Vic3RyaW5nKDEpXTtcbiAgICB9IGVsc2UgaWYgKGNhc3QgJiYgKCFjYXN0LnR5cGUgfHwgY2FzdC50eXBlLnR5cGUpXG4gICAgICAgICAgICAgICAgICAgICYmICdPYmplY3QnID09IHV0aWxzLmdldEZ1bmN0aW9uTmFtZShjYXN0LmNvbnN0cnVjdG9yKVxuICAgICAgICAgICAgICAgICAgICAmJiBPYmplY3Qua2V5cyhjYXN0KS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBuZXcgVHlwZXMuRG9jdW1lbnRBcnJheShwYXRoLCBuZXcgU2NoZW1hKGNhc3QpLCBvYmopO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgVHlwZXMuQXJyYXkocGF0aCwgY2FzdCB8fCBUeXBlcy5NaXhlZCwgb2JqKTtcbiAgfVxuXG4gIHZhciBuYW1lID0gJ3N0cmluZycgPT0gdHlwZW9mIHR5cGVcbiAgICA/IHR5cGVcbiAgICAvLyBJZiBub3Qgc3RyaW5nLCBgdHlwZWAgaXMgYSBmdW5jdGlvbi4gT3V0c2lkZSBvZiBJRSwgZnVuY3Rpb24ubmFtZVxuICAgIC8vIGdpdmVzIHlvdSB0aGUgZnVuY3Rpb24gbmFtZS4gSW4gSUUsIHlvdSBuZWVkIHRvIGNvbXB1dGUgaXRcbiAgICA6IHV0aWxzLmdldEZ1bmN0aW9uTmFtZSh0eXBlKTtcblxuICBpZiAobmFtZSkge1xuICAgIG5hbWUgPSBuYW1lLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgbmFtZS5zdWJzdHJpbmcoMSk7XG4gIH1cblxuICBpZiAodW5kZWZpbmVkID09IFR5cGVzW25hbWVdKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5kZWZpbmVkIHR5cGUgYXQgYCcgKyBwYXRoICtcbiAgICAgICAgJ2BcXG4gIERpZCB5b3UgdHJ5IG5lc3RpbmcgU2NoZW1hcz8gJyArXG4gICAgICAgICdZb3UgY2FuIG9ubHkgbmVzdCB1c2luZyByZWZzIG9yIGFycmF5cy4nKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgVHlwZXNbbmFtZV0ocGF0aCwgb2JqKTtcbn07XG5cbi8qKlxuICogSXRlcmF0ZXMgdGhlIHNjaGVtYXMgcGF0aHMgc2ltaWxhciB0byBBcnJheSNmb3JFYWNoLlxuICpcbiAqIFRoZSBjYWxsYmFjayBpcyBwYXNzZWQgdGhlIHBhdGhuYW1lIGFuZCBzY2hlbWFUeXBlIGFzIGFyZ3VtZW50cyBvbiBlYWNoIGl0ZXJhdGlvbi5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBjYWxsYmFjayBmdW5jdGlvblxuICogQHJldHVybiB7U2NoZW1hfSB0aGlzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWEucHJvdG90eXBlLmVhY2hQYXRoID0gZnVuY3Rpb24gKGZuKSB7XG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXModGhpcy5wYXRocylcbiAgICAsIGxlbiA9IGtleXMubGVuZ3RoO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICBmbihrZXlzW2ldLCB0aGlzLnBhdGhzW2tleXNbaV1dKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIGFuIEFycmF5IG9mIHBhdGggc3RyaW5ncyB0aGF0IGFyZSByZXF1aXJlZCBieSB0aGlzIHNjaGVtYS5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICogQHJldHVybiB7QXJyYXl9XG4gKi9cblNjaGVtYS5wcm90b3R5cGUucmVxdWlyZWRQYXRocyA9IGZ1bmN0aW9uIHJlcXVpcmVkUGF0aHMgKCkge1xuICBpZiAodGhpcy5fcmVxdWlyZWRwYXRocykgcmV0dXJuIHRoaXMuX3JlcXVpcmVkcGF0aHM7XG5cbiAgdmFyIHBhdGhzID0gT2JqZWN0LmtleXModGhpcy5wYXRocylcbiAgICAsIGkgPSBwYXRocy5sZW5ndGhcbiAgICAsIHJldCA9IFtdO1xuXG4gIHdoaWxlIChpLS0pIHtcbiAgICB2YXIgcGF0aCA9IHBhdGhzW2ldO1xuICAgIGlmICh0aGlzLnBhdGhzW3BhdGhdLmlzUmVxdWlyZWQpIHJldC5wdXNoKHBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXMuX3JlcXVpcmVkcGF0aHMgPSByZXQ7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIHBhdGhUeXBlIG9mIGBwYXRoYCBmb3IgdGhpcyBzY2hlbWEuXG4gKlxuICogR2l2ZW4gYSBwYXRoLCByZXR1cm5zIHdoZXRoZXIgaXQgaXMgYSByZWFsLCB2aXJ0dWFsLCBuZXN0ZWQsIG9yIGFkLWhvYy91bmRlZmluZWQgcGF0aC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuU2NoZW1hLnByb3RvdHlwZS5wYXRoVHlwZSA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gIGlmIChwYXRoIGluIHRoaXMucGF0aHMpIHJldHVybiAncmVhbCc7XG4gIGlmIChwYXRoIGluIHRoaXMudmlydHVhbHMpIHJldHVybiAndmlydHVhbCc7XG4gIGlmIChwYXRoIGluIHRoaXMubmVzdGVkKSByZXR1cm4gJ25lc3RlZCc7XG4gIGlmIChwYXRoIGluIHRoaXMuc3VicGF0aHMpIHJldHVybiAncmVhbCc7XG5cbiAgaWYgKC9cXC5cXGQrXFwufFxcLlxcZCskLy50ZXN0KHBhdGgpICYmIGdldFBvc2l0aW9uYWxQYXRoKHRoaXMsIHBhdGgpKSB7XG4gICAgcmV0dXJuICdyZWFsJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gJ2FkaG9jT3JVbmRlZmluZWQnXG4gIH1cbn07XG5cbi8qIVxuICogaWdub3JlXG4gKi9cbmZ1bmN0aW9uIGdldFBvc2l0aW9uYWxQYXRoIChzZWxmLCBwYXRoKSB7XG4gIHZhciBzdWJwYXRocyA9IHBhdGguc3BsaXQoL1xcLihcXGQrKVxcLnxcXC4oXFxkKykkLykuZmlsdGVyKEJvb2xlYW4pO1xuICBpZiAoc3VicGF0aHMubGVuZ3RoIDwgMikge1xuICAgIHJldHVybiBzZWxmLnBhdGhzW3N1YnBhdGhzWzBdXTtcbiAgfVxuXG4gIHZhciB2YWwgPSBzZWxmLnBhdGgoc3VicGF0aHNbMF0pO1xuICBpZiAoIXZhbCkgcmV0dXJuIHZhbDtcblxuICB2YXIgbGFzdCA9IHN1YnBhdGhzLmxlbmd0aCAtIDFcbiAgICAsIHN1YnBhdGhcbiAgICAsIGkgPSAxO1xuXG4gIGZvciAoOyBpIDwgc3VicGF0aHMubGVuZ3RoOyArK2kpIHtcbiAgICBzdWJwYXRoID0gc3VicGF0aHNbaV07XG5cbiAgICBpZiAoaSA9PT0gbGFzdCAmJiB2YWwgJiYgIXZhbC5zY2hlbWEgJiYgIS9cXEQvLnRlc3Qoc3VicGF0aCkpIHtcbiAgICAgIGlmICh2YWwgaW5zdGFuY2VvZiBUeXBlcy5BcnJheSkge1xuICAgICAgICAvLyBTdHJpbmdTY2hlbWEsIE51bWJlclNjaGVtYSwgZXRjXG4gICAgICAgIHZhbCA9IHZhbC5jYXN0ZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWwgPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyBpZ25vcmUgaWYgaXRzIGp1c3QgYSBwb3NpdGlvbiBzZWdtZW50OiBwYXRoLjAuc3VicGF0aFxuICAgIGlmICghL1xcRC8udGVzdChzdWJwYXRoKSkgY29udGludWU7XG5cbiAgICBpZiAoISh2YWwgJiYgdmFsLnNjaGVtYSkpIHtcbiAgICAgIHZhbCA9IHVuZGVmaW5lZDtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHZhbCA9IHZhbC5zY2hlbWEucGF0aChzdWJwYXRoKTtcbiAgfVxuXG4gIHJldHVybiBzZWxmLnN1YnBhdGhzW3BhdGhdID0gdmFsO1xufVxuXG4vKipcbiAqIEFkZHMgYSBtZXRob2QgY2FsbCB0byB0aGUgcXVldWUuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgbmFtZSBvZiB0aGUgZG9jdW1lbnQgbWV0aG9kIHRvIGNhbGwgbGF0ZXJcbiAqIEBwYXJhbSB7QXJyYXl9IGFyZ3MgYXJndW1lbnRzIHRvIHBhc3MgdG8gdGhlIG1ldGhvZFxuICogQGFwaSBwcml2YXRlXG4gKi9cblNjaGVtYS5wcm90b3R5cGUucXVldWUgPSBmdW5jdGlvbihuYW1lLCBhcmdzKXtcbiAgdGhpcy5jYWxsUXVldWUucHVzaChbbmFtZSwgYXJnc10pO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogRGVmaW5lcyBhIHByZSBob29rIGZvciB0aGUgZG9jdW1lbnQuXG4gKlxuICogIyMjI0V4YW1wbGVcbiAqXG4gKiAgICAgdmFyIHRveVNjaGVtYSA9IG5ldyBTY2hlbWEoLi4pO1xuICpcbiAqICAgICB0b3lTY2hlbWEucHJlKCdzYXZlJywgZnVuY3Rpb24gKG5leHQpIHtcbiAqICAgICAgIGlmICghdGhpcy5jcmVhdGVkKSB0aGlzLmNyZWF0ZWQgPSBuZXcgRGF0ZTtcbiAqICAgICAgIG5leHQoKTtcbiAqICAgICB9KVxuICpcbiAqICAgICB0b3lTY2hlbWEucHJlKCd2YWxpZGF0ZScsIGZ1bmN0aW9uIChuZXh0KSB7XG4gKiAgICAgICBpZiAodGhpcy5uYW1lICE9ICdXb29keScpIHRoaXMubmFtZSA9ICdXb29keSc7XG4gKiAgICAgICBuZXh0KCk7XG4gKiAgICAgfSlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWV0aG9kXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHNlZSBob29rcy5qcyBodHRwczovL2dpdGh1Yi5jb20vYm5vZ3VjaGkvaG9va3MtanMvdHJlZS8zMWVjNTcxY2VmMDMzMmUyMTEyMWVlNzE1N2UwY2Y5NzI4NTcyY2MzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWEucHJvdG90eXBlLnByZSA9IGZ1bmN0aW9uKCl7XG4gIHJldHVybiB0aGlzLnF1ZXVlKCdwcmUnLCBhcmd1bWVudHMpO1xufTtcblxuLyoqXG4gKiBEZWZpbmVzIGEgcG9zdCBmb3IgdGhlIGRvY3VtZW50XG4gKlxuICogUG9zdCBob29rcyBmaXJlIGBvbmAgdGhlIGV2ZW50IGVtaXR0ZWQgZnJvbSBkb2N1bWVudCBpbnN0YW5jZXMgb2YgTW9kZWxzIGNvbXBpbGVkIGZyb20gdGhpcyBzY2hlbWEuXG4gKlxuICogICAgIHZhciBzY2hlbWEgPSBuZXcgU2NoZW1hKC4uKTtcbiAqICAgICBzY2hlbWEucG9zdCgnc2F2ZScsIGZ1bmN0aW9uIChkb2MpIHtcbiAqICAgICAgIGNvbnNvbGUubG9nKCd0aGlzIGZpcmVkIGFmdGVyIGEgZG9jdW1lbnQgd2FzIHNhdmVkJyk7XG4gKiAgICAgfSk7XG4gKlxuICogICAgIHZhciBNb2RlbCA9IG1vbmdvb3NlLm1vZGVsKCdNb2RlbCcsIHNjaGVtYSk7XG4gKlxuICogICAgIHZhciBtID0gbmV3IE1vZGVsKC4uKTtcbiAqICAgICBtLnNhdmUoZnVuY3Rpb24gKGVycikge1xuICogICAgICAgY29uc29sZS5sb2coJ3RoaXMgZmlyZXMgYWZ0ZXIgdGhlIGBwb3N0YCBob29rJyk7XG4gKiAgICAgfSk7XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG1ldGhvZCBuYW1lIG9mIHRoZSBtZXRob2QgdG8gaG9va1xuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gY2FsbGJhY2tcbiAqIEBzZWUgaG9va3MuanMgaHR0cHM6Ly9naXRodWIuY29tL2Jub2d1Y2hpL2hvb2tzLWpzL3RyZWUvMzFlYzU3MWNlZjAzMzJlMjExMjFlZTcxNTdlMGNmOTcyODU3MmNjM1xuICogQGFwaSBwdWJsaWNcbiAqL1xuU2NoZW1hLnByb3RvdHlwZS5wb3N0ID0gZnVuY3Rpb24obWV0aG9kLCBmbil7XG4gIHJldHVybiB0aGlzLnF1ZXVlKCdvbicsIGFyZ3VtZW50cyk7XG59O1xuXG4vKipcbiAqIFJlZ2lzdGVycyBhIHBsdWdpbiBmb3IgdGhpcyBzY2hlbWEuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gcGx1Z2luIGNhbGxiYWNrXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICogQHNlZSBwbHVnaW5zXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWEucHJvdG90eXBlLnBsdWdpbiA9IGZ1bmN0aW9uIChmbiwgb3B0cykge1xuICBmbih0aGlzLCBvcHRzKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEFkZHMgYW4gaW5zdGFuY2UgbWV0aG9kIHRvIGRvY3VtZW50cyBjb25zdHJ1Y3RlZCBmcm9tIE1vZGVscyBjb21waWxlZCBmcm9tIHRoaXMgc2NoZW1hLlxuICpcbiAqICMjIyNFeGFtcGxlXG4gKlxuICogICAgIHZhciBzY2hlbWEgPSBraXR0eVNjaGVtYSA9IG5ldyBTY2hlbWEoLi4pO1xuICpcbiAqICAgICBzY2hlbWEubWV0aG9kKCdtZW93JywgZnVuY3Rpb24gKCkge1xuICogICAgICAgY29uc29sZS5sb2coJ21lZWVlZW9vb29vb29vb29vb3cnKTtcbiAqICAgICB9KVxuICpcbiAqICAgICB2YXIgS2l0dHkgPSBtb25nb29zZS5tb2RlbCgnS2l0dHknLCBzY2hlbWEpO1xuICpcbiAqICAgICB2YXIgZml6eiA9IG5ldyBLaXR0eTtcbiAqICAgICBmaXp6Lm1lb3coKTsgLy8gbWVlZWVlb29vb29vb29vb29vb3dcbiAqXG4gKiBJZiBhIGhhc2ggb2YgbmFtZS9mbiBwYWlycyBpcyBwYXNzZWQgYXMgdGhlIG9ubHkgYXJndW1lbnQsIGVhY2ggbmFtZS9mbiBwYWlyIHdpbGwgYmUgYWRkZWQgYXMgbWV0aG9kcy5cbiAqXG4gKiAgICAgc2NoZW1hLm1ldGhvZCh7XG4gKiAgICAgICAgIHB1cnI6IGZ1bmN0aW9uICgpIHt9XG4gKiAgICAgICAsIHNjcmF0Y2g6IGZ1bmN0aW9uICgpIHt9XG4gKiAgICAgfSk7XG4gKlxuICogICAgIC8vIGxhdGVyXG4gKiAgICAgZml6ei5wdXJyKCk7XG4gKiAgICAgZml6ei5zY3JhdGNoKCk7XG4gKlxuICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBtZXRob2QgbmFtZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2ZuXVxuICogQGFwaSBwdWJsaWNcbiAqL1xuU2NoZW1hLnByb3RvdHlwZS5tZXRob2QgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgaWYgKCdzdHJpbmcnICE9IHR5cGVvZiBuYW1lKVxuICAgIGZvciAodmFyIGkgaW4gbmFtZSlcbiAgICAgIHRoaXMubWV0aG9kc1tpXSA9IG5hbWVbaV07XG4gIGVsc2VcbiAgICB0aGlzLm1ldGhvZHNbbmFtZV0gPSBmbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEFkZHMgc3RhdGljIFwiY2xhc3NcIiBtZXRob2RzIHRvIE1vZGVscyBjb21waWxlZCBmcm9tIHRoaXMgc2NoZW1hLlxuICpcbiAqICMjIyNFeGFtcGxlXG4gKlxuICogICAgIHZhciBzY2hlbWEgPSBuZXcgU2NoZW1hKC4uKTtcbiAqICAgICBzY2hlbWEuc3RhdGljKCdmaW5kQnlOYW1lJywgZnVuY3Rpb24gKG5hbWUsIGNhbGxiYWNrKSB7XG4gKiAgICAgICByZXR1cm4gdGhpcy5maW5kKHsgbmFtZTogbmFtZSB9LCBjYWxsYmFjayk7XG4gKiAgICAgfSk7XG4gKlxuICogICAgIHZhciBEcmluayA9IG1vbmdvb3NlLm1vZGVsKCdEcmluaycsIHNjaGVtYSk7XG4gKiAgICAgRHJpbmsuZmluZEJ5TmFtZSgnc2FucGVsbGVncmlubycsIGZ1bmN0aW9uIChlcnIsIGRyaW5rcykge1xuICogICAgICAgLy9cbiAqICAgICB9KTtcbiAqXG4gKiBJZiBhIGhhc2ggb2YgbmFtZS9mbiBwYWlycyBpcyBwYXNzZWQgYXMgdGhlIG9ubHkgYXJndW1lbnQsIGVhY2ggbmFtZS9mbiBwYWlyIHdpbGwgYmUgYWRkZWQgYXMgc3RhdGljcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAqIEBhcGkgcHVibGljXG4gKi9cblNjaGVtYS5wcm90b3R5cGUuc3RhdGljID0gZnVuY3Rpb24obmFtZSwgZm4pIHtcbiAgaWYgKCdzdHJpbmcnICE9IHR5cGVvZiBuYW1lKVxuICAgIGZvciAodmFyIGkgaW4gbmFtZSlcbiAgICAgIHRoaXMuc3RhdGljc1tpXSA9IG5hbWVbaV07XG4gIGVsc2VcbiAgICB0aGlzLnN0YXRpY3NbbmFtZV0gPSBmbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFNldHMvZ2V0cyBhIHNjaGVtYSBvcHRpb24uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleSBvcHRpb24gbmFtZVxuICogQHBhcmFtIHtPYmplY3R9IFt2YWx1ZV0gaWYgbm90IHBhc3NlZCwgdGhlIGN1cnJlbnQgb3B0aW9uIHZhbHVlIGlzIHJldHVybmVkXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWEucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gIGlmICgxID09PSBhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIHRoaXMub3B0aW9uc1trZXldO1xuICB9XG5cbiAgdGhpcy5vcHRpb25zW2tleV0gPSB2YWx1ZTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogR2V0cyBhIHNjaGVtYSBvcHRpb24uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleSBvcHRpb24gbmFtZVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5TY2hlbWEucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgcmV0dXJuIHRoaXMub3B0aW9uc1trZXldO1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgdmlydHVhbCB0eXBlIHdpdGggdGhlIGdpdmVuIG5hbWUuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEByZXR1cm4ge1ZpcnR1YWxUeXBlfVxuICovXG5cblNjaGVtYS5wcm90b3R5cGUudmlydHVhbCA9IGZ1bmN0aW9uIChuYW1lLCBvcHRpb25zKSB7XG4gIHZhciB2aXJ0dWFscyA9IHRoaXMudmlydHVhbHM7XG4gIHZhciBwYXJ0cyA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgcmV0dXJuIHZpcnR1YWxzW25hbWVdID0gcGFydHMucmVkdWNlKGZ1bmN0aW9uIChtZW0sIHBhcnQsIGkpIHtcbiAgICBtZW1bcGFydF0gfHwgKG1lbVtwYXJ0XSA9IChpID09PSBwYXJ0cy5sZW5ndGgtMSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IG5ldyBWaXJ0dWFsVHlwZShvcHRpb25zLCBuYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDoge30pO1xuICAgIHJldHVybiBtZW1bcGFydF07XG4gIH0sIHRoaXMudHJlZSk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIHZpcnR1YWwgdHlwZSB3aXRoIHRoZSBnaXZlbiBgbmFtZWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge1ZpcnR1YWxUeXBlfVxuICovXG5cblNjaGVtYS5wcm90b3R5cGUudmlydHVhbHBhdGggPSBmdW5jdGlvbiAobmFtZSkge1xuICByZXR1cm4gdGhpcy52aXJ0dWFsc1tuYW1lXTtcbn07XG5cbi8qKlxuICogUmVnaXN0ZXJlZCBkaXNjcmltaW5hdG9ycyBmb3IgdGhpcyBzY2hlbWEuXG4gKlxuICogQHByb3BlcnR5IGRpc2NyaW1pbmF0b3JzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWEuZGlzY3JpbWluYXRvcnM7XG5cbi8qKlxuICog0J3QsNGB0LvQtdC00L7QstCw0L3QuNC1INC+0YIg0YHRhdC10LzRiy5cbiAqIHRoaXMgLSDQsdCw0LfQvtCy0LDRjyDRgdGF0LXQvNCwISEhXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKiAgICAgdmFyIFBlcnNvblNjaGVtYSA9IG5ldyBTY2hlbWEoJ1BlcnNvbicsIHtcbiAqICAgICAgIG5hbWU6IFN0cmluZyxcbiAqICAgICAgIGNyZWF0ZWRBdDogRGF0ZVxuICogICAgIH0pO1xuICpcbiAqICAgICB2YXIgQm9zc1NjaGVtYSA9IG5ldyBTY2hlbWEoJ0Jvc3MnLCBQZXJzb25TY2hlbWEsIHsgZGVwYXJ0bWVudDogU3RyaW5nIH0pO1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lICAgZGlzY3JpbWluYXRvciBuYW1lXG4gKiBAcGFyYW0ge1NjaGVtYX0gc2NoZW1hIGRpc2NyaW1pbmF0b3Igc2NoZW1hXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWEucHJvdG90eXBlLmRpc2NyaW1pbmF0b3IgPSBmdW5jdGlvbiBkaXNjcmltaW5hdG9yIChuYW1lLCBzY2hlbWEpIHtcbiAgaWYgKCEoc2NoZW1hIGluc3RhbmNlb2YgU2NoZW1hKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIllvdSBtdXN0IHBhc3MgYSB2YWxpZCBkaXNjcmltaW5hdG9yIFNjaGVtYVwiKTtcbiAgfVxuXG4gIGlmICggdGhpcy5kaXNjcmltaW5hdG9yTWFwcGluZyAmJiAhdGhpcy5kaXNjcmltaW5hdG9yTWFwcGluZy5pc1Jvb3QgKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRGlzY3JpbWluYXRvciBcXFwiXCIgKyBuYW1lICsgXCJcXFwiIGNhbiBvbmx5IGJlIGEgZGlzY3JpbWluYXRvciBvZiB0aGUgcm9vdCBtb2RlbFwiKTtcbiAgfVxuXG4gIHZhciBrZXkgPSB0aGlzLm9wdGlvbnMuZGlzY3JpbWluYXRvcktleTtcbiAgaWYgKCBzY2hlbWEucGF0aChrZXkpICkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkRpc2NyaW1pbmF0b3IgXFxcIlwiICsgbmFtZSArIFwiXFxcIiBjYW5ub3QgaGF2ZSBmaWVsZCB3aXRoIG5hbWUgXFxcIlwiICsga2V5ICsgXCJcXFwiXCIpO1xuICB9XG5cbiAgLy8gbWVyZ2VzIGJhc2Ugc2NoZW1hIGludG8gbmV3IGRpc2NyaW1pbmF0b3Igc2NoZW1hIGFuZCBzZXRzIG5ldyB0eXBlIGZpZWxkLlxuICAoZnVuY3Rpb24gbWVyZ2VTY2hlbWFzKHNjaGVtYSwgYmFzZVNjaGVtYSkge1xuICAgIHV0aWxzLm1lcmdlKHNjaGVtYSwgYmFzZVNjaGVtYSk7XG5cbiAgICB2YXIgb2JqID0ge307XG4gICAgb2JqW2tleV0gPSB7IHR5cGU6IFN0cmluZywgZGVmYXVsdDogbmFtZSB9O1xuICAgIHNjaGVtYS5hZGQob2JqKTtcbiAgICBzY2hlbWEuZGlzY3JpbWluYXRvck1hcHBpbmcgPSB7IGtleToga2V5LCB2YWx1ZTogbmFtZSwgaXNSb290OiBmYWxzZSB9O1xuXG4gICAgaWYgKGJhc2VTY2hlbWEub3B0aW9ucy5jb2xsZWN0aW9uKSB7XG4gICAgICBzY2hlbWEub3B0aW9ucy5jb2xsZWN0aW9uID0gYmFzZVNjaGVtYS5vcHRpb25zLmNvbGxlY3Rpb247XG4gICAgfVxuXG4gICAgICAvLyB0aHJvd3MgZXJyb3IgaWYgb3B0aW9ucyBhcmUgaW52YWxpZFxuICAgIChmdW5jdGlvbiB2YWxpZGF0ZU9wdGlvbnMoYSwgYikge1xuICAgICAgYSA9IHV0aWxzLmNsb25lKGEpO1xuICAgICAgYiA9IHV0aWxzLmNsb25lKGIpO1xuICAgICAgZGVsZXRlIGEudG9KU09OO1xuICAgICAgZGVsZXRlIGEudG9PYmplY3Q7XG4gICAgICBkZWxldGUgYi50b0pTT047XG4gICAgICBkZWxldGUgYi50b09iamVjdDtcblxuICAgICAgaWYgKCF1dGlscy5kZWVwRXF1YWwoYSwgYikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRGlzY3JpbWluYXRvciBvcHRpb25zIGFyZSBub3QgY3VzdG9taXphYmxlIChleGNlcHQgdG9KU09OICYgdG9PYmplY3QpXCIpO1xuICAgICAgfVxuICAgIH0pKHNjaGVtYS5vcHRpb25zLCBiYXNlU2NoZW1hLm9wdGlvbnMpO1xuXG4gICAgdmFyIHRvSlNPTiA9IHNjaGVtYS5vcHRpb25zLnRvSlNPTlxuICAgICAgLCB0b09iamVjdCA9IHNjaGVtYS5vcHRpb25zLnRvT2JqZWN0O1xuXG4gICAgc2NoZW1hLm9wdGlvbnMgPSB1dGlscy5jbG9uZShiYXNlU2NoZW1hLm9wdGlvbnMpO1xuICAgIGlmICh0b0pTT04pICAgc2NoZW1hLm9wdGlvbnMudG9KU09OID0gdG9KU09OO1xuICAgIGlmICh0b09iamVjdCkgc2NoZW1hLm9wdGlvbnMudG9PYmplY3QgPSB0b09iamVjdDtcblxuICAgIC8vc2NoZW1hLmNhbGxRdWV1ZSA9IGJhc2VTY2hlbWEuY2FsbFF1ZXVlLmNvbmNhdChzY2hlbWEuY2FsbFF1ZXVlKTtcbiAgICBzY2hlbWEuX3JlcXVpcmVkcGF0aHMgPSB1bmRlZmluZWQ7IC8vIHJlc2V0IGp1c3QgaW4gY2FzZSBTY2hlbWEjcmVxdWlyZWRQYXRocygpIHdhcyBjYWxsZWQgb24gZWl0aGVyIHNjaGVtYVxuICB9KShzY2hlbWEsIHRoaXMpO1xuXG4gIGlmICghdGhpcy5kaXNjcmltaW5hdG9ycykge1xuICAgIHRoaXMuZGlzY3JpbWluYXRvcnMgPSB7fTtcbiAgfVxuXG4gIGlmICghdGhpcy5kaXNjcmltaW5hdG9yTWFwcGluZykge1xuICAgIHRoaXMuZGlzY3JpbWluYXRvck1hcHBpbmcgPSB7IGtleToga2V5LCB2YWx1ZTogbnVsbCwgaXNSb290OiB0cnVlIH07XG4gIH1cblxuICBpZiAodGhpcy5kaXNjcmltaW5hdG9yc1tuYW1lXSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkRpc2NyaW1pbmF0b3Igd2l0aCBuYW1lIFxcXCJcIiArIG5hbWUgKyBcIlxcXCIgYWxyZWFkeSBleGlzdHNcIik7XG4gIH1cblxuICB0aGlzLmRpc2NyaW1pbmF0b3JzW25hbWVdID0gc2NoZW1hO1xufTtcblxuLyohXG4gKiBleHBvcnRzXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBTY2hlbWE7XG53aW5kb3cuU2NoZW1hID0gU2NoZW1hO1xuXG4vLyByZXF1aXJlIGRvd24gaGVyZSBiZWNhdXNlIG9mIHJlZmVyZW5jZSBpc3N1ZXNcblxuLyoqXG4gKiBUaGUgdmFyaW91cyBidWlsdC1pbiBTdG9yYWdlIFNjaGVtYSBUeXBlcy5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIG1vbmdvb3NlID0gcmVxdWlyZSgnbW9uZ29vc2UnKTtcbiAqICAgICB2YXIgT2JqZWN0SWQgPSBtb25nb29zZS5TY2hlbWEuVHlwZXMuT2JqZWN0SWQ7XG4gKlxuICogIyMjI1R5cGVzOlxuICpcbiAqIC0gW1N0cmluZ10oI3NjaGVtYS1zdHJpbmctanMpXG4gKiAtIFtOdW1iZXJdKCNzY2hlbWEtbnVtYmVyLWpzKVxuICogLSBbQm9vbGVhbl0oI3NjaGVtYS1ib29sZWFuLWpzKSB8IEJvb2xcbiAqIC0gW0FycmF5XSgjc2NoZW1hLWFycmF5LWpzKVxuICogLSBbRGF0ZV0oI3NjaGVtYS1kYXRlLWpzKVxuICogLSBbT2JqZWN0SWRdKCNzY2hlbWEtb2JqZWN0aWQtanMpIHwgT2lkXG4gKiAtIFtNaXhlZF0oI3NjaGVtYS1taXhlZC1qcykgfCBPYmplY3RcbiAqXG4gKiBVc2luZyB0aGlzIGV4cG9zZWQgYWNjZXNzIHRvIHRoZSBgTWl4ZWRgIFNjaGVtYVR5cGUsIHdlIGNhbiB1c2UgdGhlbSBpbiBvdXIgc2NoZW1hLlxuICpcbiAqICAgICB2YXIgTWl4ZWQgPSBtb25nb29zZS5TY2hlbWEuVHlwZXMuTWl4ZWQ7XG4gKiAgICAgbmV3IG1vbmdvb3NlLlNjaGVtYSh7IF91c2VyOiBNaXhlZCB9KVxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblNjaGVtYS5UeXBlcyA9IHJlcXVpcmUoJy4vc2NoZW1hL2luZGV4Jyk7XG5cbi8vINCl0YDQsNC90LjQu9C40YnQtSDRgdGF0LXQvFxuU2NoZW1hLnNjaGVtYXMgPSBzY2hlbWFzID0ge307XG5cblxuLyohXG4gKiBpZ25vcmVcbiAqL1xuXG5UeXBlcyA9IFNjaGVtYS5UeXBlcztcbnZhciBPYmplY3RJZCA9IFNjaGVtYS5PYmplY3RJZCA9IFR5cGVzLk9iamVjdElkO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIFNjaGVtYVR5cGUgPSByZXF1aXJlKCcuLi9zY2hlbWF0eXBlJylcbiAgLCBDYXN0RXJyb3IgPSBTY2hlbWFUeXBlLkNhc3RFcnJvclxuICAsIFR5cGVzID0ge1xuICAgICAgICBCb29sZWFuOiByZXF1aXJlKCcuL2Jvb2xlYW4nKVxuICAgICAgLCBEYXRlOiByZXF1aXJlKCcuL2RhdGUnKVxuICAgICAgLCBOdW1iZXI6IHJlcXVpcmUoJy4vbnVtYmVyJylcbiAgICAgICwgU3RyaW5nOiByZXF1aXJlKCcuL3N0cmluZycpXG4gICAgICAsIE9iamVjdElkOiByZXF1aXJlKCcuL29iamVjdGlkJylcbiAgICAgICwgQnVmZmVyOiByZXF1aXJlKCcuL2J1ZmZlcicpXG4gICAgfVxuICAsIFN0b3JhZ2VBcnJheSA9IHJlcXVpcmUoJy4uL3R5cGVzL2FycmF5JylcbiAgLCBNaXhlZCA9IHJlcXVpcmUoJy4vbWl4ZWQnKVxuICAsIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKVxuICAsIEVtYmVkZGVkRG9jO1xuXG4vKipcbiAqIEFycmF5IFNjaGVtYVR5cGUgY29uc3RydWN0b3JcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcGFyYW0ge1NjaGVtYVR5cGV9IGNhc3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAaW5oZXJpdHMgU2NoZW1hVHlwZVxuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIFNjaGVtYUFycmF5IChrZXksIGNhc3QsIG9wdGlvbnMpIHtcbiAgaWYgKGNhc3QpIHtcbiAgICB2YXIgY2FzdE9wdGlvbnMgPSB7fTtcblxuICAgIGlmICgnT2JqZWN0JyA9PT0gdXRpbHMuZ2V0RnVuY3Rpb25OYW1lKCBjYXN0LmNvbnN0cnVjdG9yICkgKSB7XG4gICAgICBpZiAoY2FzdC50eXBlKSB7XG4gICAgICAgIC8vIHN1cHBvcnQgeyB0eXBlOiBXb290IH1cbiAgICAgICAgY2FzdE9wdGlvbnMgPSBfLmNsb25lKCBjYXN0ICk7IC8vIGRvIG5vdCBhbHRlciB1c2VyIGFyZ3VtZW50c1xuICAgICAgICBkZWxldGUgY2FzdE9wdGlvbnMudHlwZTtcbiAgICAgICAgY2FzdCA9IGNhc3QudHlwZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhc3QgPSBNaXhlZDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzdXBwb3J0IHsgdHlwZTogJ1N0cmluZycgfVxuICAgIHZhciBuYW1lID0gJ3N0cmluZycgPT0gdHlwZW9mIGNhc3RcbiAgICAgID8gY2FzdFxuICAgICAgOiB1dGlscy5nZXRGdW5jdGlvbk5hbWUoIGNhc3QgKTtcblxuICAgIHZhciBjYXN0ZXIgPSBuYW1lIGluIFR5cGVzXG4gICAgICA/IFR5cGVzW25hbWVdXG4gICAgICA6IGNhc3Q7XG5cbiAgICB0aGlzLmNhc3RlckNvbnN0cnVjdG9yID0gY2FzdGVyO1xuICAgIHRoaXMuY2FzdGVyID0gbmV3IGNhc3RlcihudWxsLCBjYXN0T3B0aW9ucyk7XG5cbiAgICAvLyBsYXp5IGxvYWRcbiAgICBFbWJlZGRlZERvYyB8fCAoRW1iZWRkZWREb2MgPSByZXF1aXJlKCcuLi90eXBlcy9lbWJlZGRlZCcpKTtcblxuICAgIGlmICghKHRoaXMuY2FzdGVyIGluc3RhbmNlb2YgRW1iZWRkZWREb2MpKSB7XG4gICAgICB0aGlzLmNhc3Rlci5wYXRoID0ga2V5O1xuICAgIH1cbiAgfVxuXG4gIFNjaGVtYVR5cGUuY2FsbCh0aGlzLCBrZXksIG9wdGlvbnMpO1xuXG4gIHZhciBzZWxmID0gdGhpc1xuICAgICwgZGVmYXVsdEFyclxuICAgICwgZm47XG5cbiAgaWYgKHRoaXMuZGVmYXVsdFZhbHVlKSB7XG4gICAgZGVmYXVsdEFyciA9IHRoaXMuZGVmYXVsdFZhbHVlO1xuICAgIGZuID0gJ2Z1bmN0aW9uJyA9PSB0eXBlb2YgZGVmYXVsdEFycjtcbiAgfVxuXG4gIHRoaXMuZGVmYXVsdChmdW5jdGlvbigpe1xuICAgIHZhciBhcnIgPSBmbiA/IGRlZmF1bHRBcnIoKSA6IGRlZmF1bHRBcnIgfHwgW107XG4gICAgcmV0dXJuIG5ldyBTdG9yYWdlQXJyYXkoYXJyLCBzZWxmLnBhdGgsIHRoaXMpO1xuICB9KTtcbn1cblxuXG4vKiFcbiAqIEluaGVyaXRzIGZyb20gU2NoZW1hVHlwZS5cbiAqL1xuU2NoZW1hQXJyYXkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggU2NoZW1hVHlwZS5wcm90b3R5cGUgKTtcblNjaGVtYUFycmF5LnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFNjaGVtYUFycmF5O1xuXG4vKipcbiAqIENoZWNrIHJlcXVpcmVkXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdmFsdWVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5TY2hlbWFBcnJheS5wcm90b3R5cGUuY2hlY2tSZXF1aXJlZCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICByZXR1cm4gISEodmFsdWUgJiYgdmFsdWUubGVuZ3RoKTtcbn07XG5cbi8qKlxuICogT3ZlcnJpZGVzIHRoZSBnZXR0ZXJzIGFwcGxpY2F0aW9uIGZvciB0aGUgcG9wdWxhdGlvbiBzcGVjaWFsLWNhc2VcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZVxuICogQGFwaSBwcml2YXRlXG4gKi9cblNjaGVtYUFycmF5LnByb3RvdHlwZS5hcHBseUdldHRlcnMgPSBmdW5jdGlvbiAodmFsdWUsIHNjb3BlKSB7XG4gIGlmICh0aGlzLmNhc3Rlci5vcHRpb25zICYmIHRoaXMuY2FzdGVyLm9wdGlvbnMucmVmKSB7XG4gICAgLy8gbWVhbnMgdGhlIG9iamVjdCBpZCB3YXMgcG9wdWxhdGVkXG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgcmV0dXJuIFNjaGVtYVR5cGUucHJvdG90eXBlLmFwcGx5R2V0dGVycy5jYWxsKHRoaXMsIHZhbHVlLCBzY29wZSk7XG59O1xuXG4vKipcbiAqIENhc3RzIHZhbHVlcyBmb3Igc2V0KCkuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2MgZG9jdW1lbnQgdGhhdCB0cmlnZ2VycyB0aGUgY2FzdGluZ1xuICogQHBhcmFtIHtCb29sZWFufSBpbml0IHdoZXRoZXIgdGhpcyBpcyBhbiBpbml0aWFsaXphdGlvbiBjYXN0XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuU2NoZW1hQXJyYXkucHJvdG90eXBlLmNhc3QgPSBmdW5jdGlvbiAoIHZhbHVlLCBkb2MsIGluaXQgKSB7XG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIGlmICghKHZhbHVlLmlzU3RvcmFnZUFycmF5KSkge1xuICAgICAgdmFsdWUgPSBuZXcgU3RvcmFnZUFycmF5KHZhbHVlLCB0aGlzLnBhdGgsIGRvYyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2FzdGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHZhbHVlLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgIHZhbHVlW2ldID0gdGhpcy5jYXN0ZXIuY2FzdCh2YWx1ZVtpXSwgZG9jLCBpbml0KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyByZXRocm93XG4gICAgICAgIHRocm93IG5ldyBDYXN0RXJyb3IoZS50eXBlLCB2YWx1ZSwgdGhpcy5wYXRoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHRoaXMuY2FzdChbdmFsdWVdLCBkb2MsIGluaXQpO1xuICB9XG59O1xuXG4vKiFcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gU2NoZW1hQXJyYXk7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIVxuICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAqL1xuXG52YXIgU2NoZW1hVHlwZSA9IHJlcXVpcmUoJy4uL3NjaGVtYXR5cGUnKTtcblxuLyoqXG4gKiBCb29sZWFuIFNjaGVtYVR5cGUgY29uc3RydWN0b3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAaW5oZXJpdHMgU2NoZW1hVHlwZVxuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIEJvb2xlYW5TY2hlbWEgKHBhdGgsIG9wdGlvbnMpIHtcbiAgU2NoZW1hVHlwZS5jYWxsKHRoaXMsIHBhdGgsIG9wdGlvbnMpO1xufVxuXG4vKiFcbiAqIEluaGVyaXRzIGZyb20gU2NoZW1hVHlwZS5cbiAqL1xuQm9vbGVhblNjaGVtYS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBTY2hlbWFUeXBlLnByb3RvdHlwZSApO1xuQm9vbGVhblNjaGVtYS5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBCb29sZWFuU2NoZW1hO1xuXG4vKipcbiAqIFJlcXVpcmVkIHZhbGlkYXRvclxuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5Cb29sZWFuU2NoZW1hLnByb3RvdHlwZS5jaGVja1JlcXVpcmVkID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gZmFsc2U7XG59O1xuXG4vKipcbiAqIENhc3RzIHRvIGJvb2xlYW5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5Cb29sZWFuU2NoZW1hLnByb3RvdHlwZS5jYXN0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIGlmIChudWxsID09PSB2YWx1ZSkgcmV0dXJuIHZhbHVlO1xuICBpZiAoJzAnID09PSB2YWx1ZSkgcmV0dXJuIGZhbHNlO1xuICBpZiAoJ3RydWUnID09PSB2YWx1ZSkgcmV0dXJuIHRydWU7XG4gIGlmICgnZmFsc2UnID09PSB2YWx1ZSkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gISEgdmFsdWU7XG59O1xuXG4vKiFcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gQm9vbGVhblNjaGVtYTtcbiIsIihmdW5jdGlvbiAoQnVmZmVyKXtcbid1c2Ugc3RyaWN0JztcblxuLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBTY2hlbWFUeXBlID0gcmVxdWlyZSgnLi4vc2NoZW1hdHlwZScpXG4gICwgQ2FzdEVycm9yID0gU2NoZW1hVHlwZS5DYXN0RXJyb3JcbiAgLCBTdG9yYWdlQnVmZmVyID0gcmVxdWlyZSgnLi4vdHlwZXMnKS5CdWZmZXJcbiAgLCBCaW5hcnkgPSBTdG9yYWdlQnVmZmVyLkJpbmFyeVxuICAsIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKVxuICAsIERvY3VtZW50O1xuXG4vKipcbiAqIEJ1ZmZlciBTY2hlbWFUeXBlIGNvbnN0cnVjdG9yXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHtTY2hlbWFUeXBlfSBjYXN0XG4gKiBAaW5oZXJpdHMgU2NoZW1hVHlwZVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gU2NoZW1hQnVmZmVyIChrZXksIG9wdGlvbnMpIHtcbiAgU2NoZW1hVHlwZS5jYWxsKHRoaXMsIGtleSwgb3B0aW9ucywgJ0J1ZmZlcicpO1xufVxuXG4vKiFcbiAqIEluaGVyaXRzIGZyb20gU2NoZW1hVHlwZS5cbiAqL1xuU2NoZW1hQnVmZmVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIFNjaGVtYVR5cGUucHJvdG90eXBlICk7XG5TY2hlbWFCdWZmZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gU2NoZW1hQnVmZmVyO1xuXG4vKipcbiAqIENoZWNrIHJlcXVpcmVkXG4gKlxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuU2NoZW1hQnVmZmVyLnByb3RvdHlwZS5jaGVja1JlcXVpcmVkID0gZnVuY3Rpb24gKHZhbHVlLCBkb2MpIHtcbiAgaWYgKFNjaGVtYVR5cGUuX2lzUmVmKHRoaXMsIHZhbHVlLCBkb2MsIHRydWUpKSB7XG4gICAgcmV0dXJuIG51bGwgIT0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuICEhKHZhbHVlICYmIHZhbHVlLmxlbmd0aCk7XG4gIH1cbn07XG5cbi8qKlxuICogQ2FzdHMgY29udGVudHNcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvYyBkb2N1bWVudCB0aGF0IHRyaWdnZXJzIHRoZSBjYXN0aW5nXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGluaXRcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cblNjaGVtYUJ1ZmZlci5wcm90b3R5cGUuY2FzdCA9IGZ1bmN0aW9uICh2YWx1ZSwgZG9jLCBpbml0KSB7XG4gIGlmIChTY2hlbWFUeXBlLl9pc1JlZih0aGlzLCB2YWx1ZSwgZG9jLCBpbml0KSkge1xuICAgIC8vIHdhaXQhIHdlIG1heSBuZWVkIHRvIGNhc3QgdGhpcyB0byBhIGRvY3VtZW50XG5cbiAgICBpZiAobnVsbCA9PSB2YWx1ZSkge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIC8vIGxhenkgbG9hZFxuICAgIERvY3VtZW50IHx8IChEb2N1bWVudCA9IHJlcXVpcmUoJy4vLi4vZG9jdW1lbnQnKSk7XG5cbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEb2N1bWVudCkge1xuICAgICAgdmFsdWUuJF9fLndhc1BvcHVsYXRlZCA9IHRydWU7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgLy8gc2V0dGluZyBhIHBvcHVsYXRlZCBwYXRoXG4gICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcih2YWx1ZSkpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKCFfLmlzT2JqZWN0KHZhbHVlKSkge1xuICAgICAgdGhyb3cgbmV3IENhc3RFcnJvcignYnVmZmVyJywgdmFsdWUsIHRoaXMucGF0aCk7XG4gICAgfVxuXG4gICAgLy8gSGFuZGxlIHRoZSBjYXNlIHdoZXJlIHVzZXIgZGlyZWN0bHkgc2V0cyBhIHBvcHVsYXRlZFxuICAgIC8vIHBhdGggdG8gYSBwbGFpbiBvYmplY3Q7IGNhc3QgdG8gdGhlIE1vZGVsIHVzZWQgaW5cbiAgICAvLyB0aGUgcG9wdWxhdGlvbiBxdWVyeS5cbiAgICB2YXIgcGF0aCA9IGRvYy4kX19mdWxsUGF0aCh0aGlzLnBhdGgpO1xuICAgIHZhciBvd25lciA9IGRvYy5vd25lckRvY3VtZW50ID8gZG9jLm93bmVyRG9jdW1lbnQoKSA6IGRvYztcbiAgICB2YXIgcG9wID0gb3duZXIucG9wdWxhdGVkKHBhdGgsIHRydWUpO1xuICAgIHZhciByZXQgPSBuZXcgcG9wLm9wdGlvbnMubW9kZWwodmFsdWUpO1xuICAgIHJldC4kX18ud2FzUG9wdWxhdGVkID0gdHJ1ZTtcbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgLy8gZG9jdW1lbnRzXG4gIGlmICh2YWx1ZSAmJiB2YWx1ZS5faWQpIHtcbiAgICB2YWx1ZSA9IHZhbHVlLl9pZDtcbiAgfVxuXG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsdWUpKSB7XG4gICAgaWYgKCF2YWx1ZSB8fCAhdmFsdWUuaXNTdG9yYWdlQnVmZmVyKSB7XG4gICAgICB2YWx1ZSA9IG5ldyBTdG9yYWdlQnVmZmVyKHZhbHVlLCBbdGhpcy5wYXRoLCBkb2NdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBCaW5hcnkpIHtcbiAgICB2YXIgcmV0ID0gbmV3IFN0b3JhZ2VCdWZmZXIodmFsdWUudmFsdWUodHJ1ZSksIFt0aGlzLnBhdGgsIGRvY10pO1xuICAgIHJldC5zdWJ0eXBlKHZhbHVlLnN1Yl90eXBlKTtcbiAgICAvLyBkbyBub3Qgb3ZlcnJpZGUgQmluYXJ5IHN1YnR5cGVzLiB1c2VycyBzZXQgdGhpc1xuICAgIC8vIHRvIHdoYXRldmVyIHRoZXkgd2FudC5cbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgaWYgKG51bGwgPT09IHZhbHVlKSByZXR1cm4gdmFsdWU7XG5cbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIGlmICgnc3RyaW5nJyA9PSB0eXBlIHx8ICdudW1iZXInID09IHR5cGUgfHwgQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICB2YXIgcmV0ID0gbmV3IFN0b3JhZ2VCdWZmZXIodmFsdWUsIFt0aGlzLnBhdGgsIGRvY10pO1xuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICB0aHJvdyBuZXcgQ2FzdEVycm9yKCdidWZmZXInLCB2YWx1ZSwgdGhpcy5wYXRoKTtcbn07XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBTY2hlbWFCdWZmZXI7XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcikiLCIndXNlIHN0cmljdCc7XG5cbi8qIVxuICogTW9kdWxlIHJlcXVpcmVtZW50cy5cbiAqL1xuXG52YXIgU2NoZW1hVHlwZSA9IHJlcXVpcmUoJy4uL3NjaGVtYXR5cGUnKTtcbnZhciBDYXN0RXJyb3IgPSBTY2hlbWFUeXBlLkNhc3RFcnJvcjtcblxuLyoqXG4gKiBEYXRlIFNjaGVtYVR5cGUgY29uc3RydWN0b3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBpbmhlcml0cyBTY2hlbWFUeXBlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBEYXRlU2NoZW1hIChrZXksIG9wdGlvbnMpIHtcbiAgU2NoZW1hVHlwZS5jYWxsKHRoaXMsIGtleSwgb3B0aW9ucyk7XG59XG5cbi8qIVxuICogSW5oZXJpdHMgZnJvbSBTY2hlbWFUeXBlLlxuICovXG5EYXRlU2NoZW1hLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIFNjaGVtYVR5cGUucHJvdG90eXBlICk7XG5EYXRlU2NoZW1hLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IERhdGVTY2hlbWE7XG5cbi8qKlxuICogUmVxdWlyZWQgdmFsaWRhdG9yIGZvciBkYXRlXG4gKlxuICogQGFwaSBwcml2YXRlXG4gKi9cbkRhdGVTY2hlbWEucHJvdG90eXBlLmNoZWNrUmVxdWlyZWQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgRGF0ZTtcbn07XG5cbi8qKlxuICogQ2FzdHMgdG8gZGF0ZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZSB0byBjYXN0XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuRGF0ZVNjaGVtYS5wcm90b3R5cGUuY2FzdCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09ICcnKVxuICAgIHJldHVybiBudWxsO1xuXG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpXG4gICAgcmV0dXJuIHZhbHVlO1xuXG4gIHZhciBkYXRlO1xuXG4gIC8vIHN1cHBvcnQgZm9yIHRpbWVzdGFtcHNcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgTnVtYmVyIHx8ICdudW1iZXInID09IHR5cGVvZiB2YWx1ZVxuICAgICAgfHwgU3RyaW5nKHZhbHVlKSA9PSBOdW1iZXIodmFsdWUpKVxuICAgIGRhdGUgPSBuZXcgRGF0ZShOdW1iZXIodmFsdWUpKTtcblxuICAvLyBzdXBwb3J0IGZvciBkYXRlIHN0cmluZ3NcbiAgZWxzZSBpZiAodmFsdWUudG9TdHJpbmcpXG4gICAgZGF0ZSA9IG5ldyBEYXRlKHZhbHVlLnRvU3RyaW5nKCkpO1xuXG4gIGlmIChkYXRlLnRvU3RyaW5nKCkgIT0gJ0ludmFsaWQgRGF0ZScpXG4gICAgcmV0dXJuIGRhdGU7XG5cbiAgdGhyb3cgbmV3IENhc3RFcnJvcignZGF0ZScsIHZhbHVlLCB0aGlzLnBhdGggKTtcbn07XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBEYXRlU2NoZW1hO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIFNjaGVtYVR5cGUgPSByZXF1aXJlKCcuLi9zY2hlbWF0eXBlJylcbiAgLCBBcnJheVR5cGUgPSByZXF1aXJlKCcuL2FycmF5JylcbiAgLCBTdG9yYWdlRG9jdW1lbnRBcnJheSA9IHJlcXVpcmUoJy4uL3R5cGVzL2RvY3VtZW50YXJyYXknKVxuICAsIFN1YmRvY3VtZW50ID0gcmVxdWlyZSgnLi4vdHlwZXMvZW1iZWRkZWQnKVxuICAsIERvY3VtZW50ID0gcmVxdWlyZSgnLi4vZG9jdW1lbnQnKVxuICAsIG9pZCA9IHJlcXVpcmUoJy4uL3R5cGVzL29iamVjdGlkJylcbiAgLCB1dGlscyA9IHJlcXVpcmUoJy4uL3V0aWxzJyk7XG5cbi8qKlxuICogU3ViZG9jc0FycmF5IFNjaGVtYVR5cGUgY29uc3RydWN0b3JcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcGFyYW0ge1NjaGVtYX0gc2NoZW1hXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQGluaGVyaXRzIFNjaGVtYUFycmF5XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gRG9jdW1lbnRBcnJheSAoa2V5LCBzY2hlbWEsIG9wdGlvbnMpIHtcblxuICAvLyBjb21waWxlIGFuIGVtYmVkZGVkIGRvY3VtZW50IGZvciB0aGlzIHNjaGVtYVxuICBmdW5jdGlvbiBFbWJlZGRlZERvY3VtZW50ICgpIHtcbiAgICBTdWJkb2N1bWVudC5hcHBseSggdGhpcywgYXJndW1lbnRzICk7XG4gIH1cblxuICBFbWJlZGRlZERvY3VtZW50LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIFN1YmRvY3VtZW50LnByb3RvdHlwZSApO1xuICBFbWJlZGRlZERvY3VtZW50LnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEVtYmVkZGVkRG9jdW1lbnQ7XG4gIEVtYmVkZGVkRG9jdW1lbnQucHJvdG90eXBlLiRfX3NldFNjaGVtYSggc2NoZW1hICk7XG5cbiAgLy8gYXBwbHkgbWV0aG9kc1xuICBmb3IgKHZhciBpIGluIHNjaGVtYS5tZXRob2RzKSB7XG4gICAgRW1iZWRkZWREb2N1bWVudC5wcm90b3R5cGVbaV0gPSBzY2hlbWEubWV0aG9kc1tpXTtcbiAgfVxuXG4gIC8vIGFwcGx5IHN0YXRpY3NcbiAgZm9yICh2YXIgaiBpbiBzY2hlbWEuc3RhdGljcykge1xuICAgIEVtYmVkZGVkRG9jdW1lbnRbal0gPSBzY2hlbWEuc3RhdGljc1tqXTtcbiAgfVxuXG4gIEVtYmVkZGVkRG9jdW1lbnQub3B0aW9ucyA9IG9wdGlvbnM7XG4gIHRoaXMuc2NoZW1hID0gc2NoZW1hO1xuXG4gIEFycmF5VHlwZS5jYWxsKHRoaXMsIGtleSwgRW1iZWRkZWREb2N1bWVudCwgb3B0aW9ucyk7XG5cbiAgdGhpcy5zY2hlbWEgPSBzY2hlbWE7XG4gIHZhciBwYXRoID0gdGhpcy5wYXRoO1xuICB2YXIgZm4gPSB0aGlzLmRlZmF1bHRWYWx1ZTtcblxuICB0aGlzLmRlZmF1bHQoZnVuY3Rpb24oKXtcbiAgICB2YXIgYXJyID0gZm4uY2FsbCh0aGlzKTtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoYXJyKSkgYXJyID0gW2Fycl07XG4gICAgcmV0dXJuIG5ldyBTdG9yYWdlRG9jdW1lbnRBcnJheShhcnIsIHBhdGgsIHRoaXMpO1xuICB9KTtcbn1cblxuLyohXG4gKiBJbmhlcml0cyBmcm9tIEFycmF5VHlwZS5cbiAqL1xuRG9jdW1lbnRBcnJheS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBBcnJheVR5cGUucHJvdG90eXBlICk7XG5Eb2N1bWVudEFycmF5LnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IERvY3VtZW50QXJyYXk7XG5cbi8qKlxuICogUGVyZm9ybXMgbG9jYWwgdmFsaWRhdGlvbnMgZmlyc3QsIHRoZW4gdmFsaWRhdGlvbnMgb24gZWFjaCBlbWJlZGRlZCBkb2NcbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuRG9jdW1lbnRBcnJheS5wcm90b3R5cGUuZG9WYWxpZGF0ZSA9IGZ1bmN0aW9uIChhcnJheSwgZm4sIHNjb3BlKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBTY2hlbWFUeXBlLnByb3RvdHlwZS5kb1ZhbGlkYXRlLmNhbGwodGhpcywgYXJyYXksIGZ1bmN0aW9uIChlcnIpIHtcbiAgICBpZiAoZXJyKSByZXR1cm4gZm4oZXJyKTtcblxuICAgIHZhciBjb3VudCA9IGFycmF5ICYmIGFycmF5Lmxlbmd0aFxuICAgICAgLCBlcnJvcjtcblxuICAgIGlmICghY291bnQpIHJldHVybiBmbigpO1xuXG4gICAgLy8gaGFuZGxlIHNwYXJzZSBhcnJheXMsIGRvIG5vdCB1c2UgYXJyYXkuZm9yRWFjaCB3aGljaCBkb2VzIG5vdFxuICAgIC8vIGl0ZXJhdGUgb3ZlciBzcGFyc2UgZWxlbWVudHMgeWV0IHJlcG9ydHMgYXJyYXkubGVuZ3RoIGluY2x1ZGluZ1xuICAgIC8vIHRoZW0gOihcblxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb3VudDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAvLyBzaWRlc3RlcCBzcGFyc2UgZW50cmllc1xuICAgICAgdmFyIGRvYyA9IGFycmF5W2ldO1xuICAgICAgaWYgKCFkb2MpIHtcbiAgICAgICAgLS1jb3VudCB8fCBmbigpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgIShmdW5jdGlvbiAoaSkge1xuICAgICAgICBkb2MudmFsaWRhdGUoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgIGlmIChlcnIgJiYgIWVycm9yKSB7XG4gICAgICAgICAgICAvLyByZXdyaXRlIHRoZSBrZXlcbiAgICAgICAgICAgIGVyci5rZXkgPSBzZWxmLmtleSArICcuJyArIGkgKyAnLicgKyBlcnIua2V5O1xuICAgICAgICAgICAgcmV0dXJuIGZuKGVycm9yID0gZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLS1jb3VudCB8fCBmbigpO1xuICAgICAgICB9KTtcbiAgICAgIH0pKGkpO1xuICAgIH1cbiAgfSwgc2NvcGUpO1xufTtcblxuLyoqXG4gKiBDYXN0cyBjb250ZW50c1xuICpcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvYyB0aGF0IHRyaWdnZXJzIHRoZSBjYXN0aW5nXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGluaXQgZmxhZ1xuICogQHBhcmFtIHtEb2N1bWVudEFycmF5fSBwcmV2XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuRG9jdW1lbnRBcnJheS5wcm90b3R5cGUuY2FzdCA9IGZ1bmN0aW9uICh2YWx1ZSwgZG9jLCBpbml0LCBwcmV2KSB7XG4gIHZhciBzZWxlY3RlZFxuICAgICwgc3ViZG9jXG4gICAgLCBpO1xuXG4gIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gdGhpcy5jYXN0KFt2YWx1ZV0sIGRvYywgaW5pdCwgcHJldik7XG4gIH1cblxuICAvLyDQldGB0LvQuCDQtNCy0LAg0LzQsNGB0YHQuNCy0LAg0L/RgNC40LzQtdGA0L3QviDQvtC00LjQvdCw0LrQvtCy0YvQtSAtINC90LUg0L3QsNC00L4g0L/QtdGA0LXQt9Cw0L/QuNGB0YvQstCw0YLRjFxuICBpZiAoIHByZXYgJiYgYXBwcm94aW1hdGVseUVxdWFsKCB2YWx1ZSwgcHJldiApICl7XG4gICAgcmV0dXJuIHByZXY7XG4gIH1cblxuICBpZiAoISh2YWx1ZS5pc1N0b3JhZ2VEb2N1bWVudEFycmF5KSkge1xuICAgIHZhbHVlID0gbmV3IFN0b3JhZ2VEb2N1bWVudEFycmF5KHZhbHVlLCB0aGlzLnBhdGgsIGRvYyk7XG4gICAgaWYgKHByZXYgJiYgcHJldi5faGFuZGxlcnMpIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBwcmV2Ll9oYW5kbGVycykge1xuICAgICAgICBkb2Mub2ZmKGtleSwgcHJldi5faGFuZGxlcnNba2V5XSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaSA9IHZhbHVlLmxlbmd0aDtcblxuICB3aGlsZSAoaS0tKSB7XG4gICAgaWYgKCEodmFsdWVbaV0gaW5zdGFuY2VvZiBTdWJkb2N1bWVudCkgJiYgdmFsdWVbaV0pIHtcbiAgICAgIGlmIChpbml0KSB7XG4gICAgICAgIHNlbGVjdGVkIHx8IChzZWxlY3RlZCA9IHNjb3BlUGF0aHModGhpcywgZG9jLiRfXy5zZWxlY3RlZCwgaW5pdCkpO1xuICAgICAgICBzdWJkb2MgPSBuZXcgdGhpcy5jYXN0ZXJDb25zdHJ1Y3RvcihudWxsLCB2YWx1ZSwgdHJ1ZSwgc2VsZWN0ZWQpO1xuICAgICAgICB2YWx1ZVtpXSA9IHN1YmRvYy5pbml0KHZhbHVlW2ldKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgc3ViZG9jID0gcHJldi5pZCh2YWx1ZVtpXS5faWQpO1xuICAgICAgICB9IGNhdGNoKGUpIHt9XG5cbiAgICAgICAgaWYgKHByZXYgJiYgc3ViZG9jKSB7XG4gICAgICAgICAgLy8gaGFuZGxlIHJlc2V0dGluZyBkb2Mgd2l0aCBleGlzdGluZyBpZCBidXQgZGlmZmVyaW5nIGRhdGFcbiAgICAgICAgICAvLyBkb2MuYXJyYXkgPSBbeyBkb2M6ICd2YWwnIH1dXG4gICAgICAgICAgc3ViZG9jLnNldCh2YWx1ZVtpXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3ViZG9jID0gbmV3IHRoaXMuY2FzdGVyQ29uc3RydWN0b3IodmFsdWVbaV0sIHZhbHVlKTtcblxuICAgICAgICAgIHJlc3RvcmVQb3B1bGF0ZWRGaWVsZHMoIHN1YmRvYywgdGhpcy5zY2hlbWEudHJlZSwgdmFsdWVbaV0sIHByZXYgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHNldCgpIGlzIGhvb2tlZCBpdCB3aWxsIGhhdmUgbm8gcmV0dXJuIHZhbHVlXG4gICAgICAgIC8vIHNlZSBnaC03NDZcbiAgICAgICAgdmFsdWVbaV0gPSBzdWJkb2M7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuLyohXG4gKiDQn9GA0LjQsdC70LjQt9C40YLQtdC70YzQvdC+0LUg0YHRgNCw0LLQvdC10L3QuNC1INC00LLRg9GFINC80LDRgdGB0LjQstC+0LJcbiAqXG4gKiDQrdGC0L4g0L3Rg9C20L3QviDQtNC70Y8gcG9wdWxhdGVkINC/0L7Qu9C10LkgLSDQuNGFINC80Ysg0L/RgNC10L7QsdGA0LDQt9C+0LLRi9Cy0LDQtdC8INCyIGlkLlxuICog0KLQsNC6INC20LUg0LIg0YHRgNCw0LLQvdC10L3QuNC4INC90LUg0YPRh9Cw0YHRgtCy0YPQtdGCIGlkINGB0YPRidC10YHRgtCy0YPRjtGJ0LjRhSBFbWJlZGRlZCDQtNC+0LrRg9C80LXQvdGC0L7QsixcbiAqINCV0YHQu9C4INC90LAg0YHQtdGA0LLQtdGA0LUgX2lkOiBmYWxzZSwg0LAg0L3QsCDQutC70LjQtdC90YLQtSDQv9C+INGD0LzQvtC70YfQsNC90LjRjiDQtdGB0YLRjCBfaWQuXG4gKlxuICogQHBhcmFtIHZhbHVlXG4gKiBAcGFyYW0gcHJldlxuICogQHJldHVybnMgeyp9XG4gKi9cbmZ1bmN0aW9uIGFwcHJveGltYXRlbHlFcXVhbCAoIHZhbHVlLCBwcmV2ICkge1xuICBwcmV2ID0gcHJldi50b09iamVjdCh7ZGVwb3B1bGF0ZTogMX0pO1xuXG4gIC8vINCd0LUg0YHRgNCw0LLQvdC40LLQsNGC0Ywg0L/QviBzdWJkb2MgX2lkXG4gIHZhciBpID0gdmFsdWUubGVuZ3RoO1xuICBpZiAoIGkgPT09IHByZXYubGVuZ3RoICl7XG4gICAgXy5mb3JFYWNoKCB2YWx1ZSwgZnVuY3Rpb24oIHN1YmRvYywgaSApe1xuICAgICAgaWYgKCAhc3ViZG9jLl9pZCApe1xuICAgICAgICBkZWxldGUgcHJldlsgaSBdLl9pZFxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHV0aWxzLmRlZXBFcXVhbCggdmFsdWUsIHByZXYgKTtcbn1cblxuLyohXG4gKiBSZXN0b3JlIHBvcHVsYXRpb25cbiAqXG4gKiBAcGFyYW0geyp9IHN1YmRvY1xuICogQHBhcmFtIHtPYmplY3R9IHNjaGVtYVRyZWVcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEBwYXJhbSB7RG9jdW1lbnRBcnJheX0gcHJldlxuICovXG5mdW5jdGlvbiByZXN0b3JlUG9wdWxhdGVkRmllbGRzICggc3ViZG9jLCBzY2hlbWFUcmVlLCB2YWx1ZSwgcHJldiApIHtcbiAgdmFyIHByb3BzO1xuICBfLmZvckVhY2goIHNjaGVtYVRyZWUsIGZ1bmN0aW9uKCBwcm9wLCBrZXkgKXtcbiAgICB2YXIgY3VyVmFsO1xuXG4gICAgaWYgKCBwcm9wLnJlZiApe1xuICAgICAgcHJvcHMgPSB7fTtcbiAgICAgIGN1clZhbCA9IHZhbHVlWyBrZXkgXTtcblxuICAgICAgaWYgKCBjdXJWYWwgJiYgb2lkLmlzVmFsaWQoIGN1clZhbCApICl7XG5cbiAgICAgICAgXy5mb3JFYWNoKCBwcmV2LCBmdW5jdGlvbiggcHJldkRvYyApe1xuICAgICAgICAgIHZhciBwcmV2RG9jUHJvcCA9IHByZXZEb2NbIGtleSBdO1xuXG4gICAgICAgICAgaWYgKCBwcmV2RG9jUHJvcCBpbnN0YW5jZW9mIERvY3VtZW50ICl7XG4gICAgICAgICAgICBpZiAoIHByZXZEb2NQcm9wLl9pZC5lcXVhbHMoIGN1clZhbCApICl7XG4gICAgICAgICAgICAgIHN1YmRvY1sga2V5IF0gPSBwcmV2RG9jUHJvcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG59XG5cbi8qIVxuICogU2NvcGVzIHBhdGhzIHNlbGVjdGVkIGluIGEgcXVlcnkgdG8gdGhpcyBhcnJheS5cbiAqIE5lY2Vzc2FyeSBmb3IgcHJvcGVyIGRlZmF1bHQgYXBwbGljYXRpb24gb2Ygc3ViZG9jdW1lbnQgdmFsdWVzLlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnRBcnJheX0gYXJyYXkgLSB0aGUgYXJyYXkgdG8gc2NvcGUgYGZpZWxkc2AgcGF0aHNcbiAqIEBwYXJhbSB7T2JqZWN0fHVuZGVmaW5lZH0gZmllbGRzIC0gdGhlIHJvb3QgZmllbGRzIHNlbGVjdGVkIGluIHRoZSBxdWVyeVxuICogQHBhcmFtIHtCb29sZWFufHVuZGVmaW5lZH0gaW5pdCAtIGlmIHdlIGFyZSBiZWluZyBjcmVhdGVkIHBhcnQgb2YgYSBxdWVyeSByZXN1bHRcbiAqL1xuZnVuY3Rpb24gc2NvcGVQYXRocyAoYXJyYXksIGZpZWxkcywgaW5pdCkge1xuICBpZiAoIShpbml0ICYmIGZpZWxkcykpIHJldHVybiB1bmRlZmluZWQ7XG5cbiAgdmFyIHBhdGggPSBhcnJheS5wYXRoICsgJy4nXG4gICAgLCBrZXlzID0gT2JqZWN0LmtleXMoZmllbGRzKVxuICAgICwgaSA9IGtleXMubGVuZ3RoXG4gICAgLCBzZWxlY3RlZCA9IHt9XG4gICAgLCBoYXNLZXlzXG4gICAgLCBrZXk7XG5cbiAgd2hpbGUgKGktLSkge1xuICAgIGtleSA9IGtleXNbaV07XG4gICAgaWYgKDAgPT09IGtleS5pbmRleE9mKHBhdGgpKSB7XG4gICAgICBoYXNLZXlzIHx8IChoYXNLZXlzID0gdHJ1ZSk7XG4gICAgICBzZWxlY3RlZFtrZXkuc3Vic3RyaW5nKHBhdGgubGVuZ3RoKV0gPSBmaWVsZHNba2V5XTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gaGFzS2V5cyAmJiBzZWxlY3RlZCB8fCB1bmRlZmluZWQ7XG59XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBEb2N1bWVudEFycmF5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiFcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbmV4cG9ydHMuU3RyaW5nID0gcmVxdWlyZSgnLi9zdHJpbmcnKTtcblxuZXhwb3J0cy5OdW1iZXIgPSByZXF1aXJlKCcuL251bWJlcicpO1xuXG5leHBvcnRzLkJvb2xlYW4gPSByZXF1aXJlKCcuL2Jvb2xlYW4nKTtcblxuZXhwb3J0cy5Eb2N1bWVudEFycmF5ID0gcmVxdWlyZSgnLi9kb2N1bWVudGFycmF5Jyk7XG5cbmV4cG9ydHMuQXJyYXkgPSByZXF1aXJlKCcuL2FycmF5Jyk7XG5cbmV4cG9ydHMuQnVmZmVyID0gcmVxdWlyZSgnLi9idWZmZXInKTtcblxuZXhwb3J0cy5EYXRlID0gcmVxdWlyZSgnLi9kYXRlJyk7XG5cbmV4cG9ydHMuT2JqZWN0SWQgPSByZXF1aXJlKCcuL29iamVjdGlkJyk7XG5cbmV4cG9ydHMuTWl4ZWQgPSByZXF1aXJlKCcuL21peGVkJyk7XG5cbi8vIGFsaWFzXG5cbmV4cG9ydHMuT2lkID0gZXhwb3J0cy5PYmplY3RJZDtcbmV4cG9ydHMuT2JqZWN0ID0gZXhwb3J0cy5NaXhlZDtcbmV4cG9ydHMuQm9vbCA9IGV4cG9ydHMuQm9vbGVhbjtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBTY2hlbWFUeXBlID0gcmVxdWlyZSgnLi4vc2NoZW1hdHlwZScpO1xuXG4vKipcbiAqIE1peGVkIFNjaGVtYVR5cGUgY29uc3RydWN0b3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAaW5oZXJpdHMgU2NoZW1hVHlwZVxuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIE1peGVkIChwYXRoLCBvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZGVmYXVsdCkge1xuICAgIHZhciBkZWYgPSBvcHRpb25zLmRlZmF1bHQ7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZGVmKSAmJiAwID09PSBkZWYubGVuZ3RoKSB7XG4gICAgICAvLyBtYWtlIHN1cmUgZW1wdHkgYXJyYXkgZGVmYXVsdHMgYXJlIGhhbmRsZWRcbiAgICAgIG9wdGlvbnMuZGVmYXVsdCA9IEFycmF5O1xuICAgIH0gZWxzZSBpZiAoIW9wdGlvbnMuc2hhcmVkICYmXG4gICAgICAgICAgICAgICBfLmlzUGxhaW5PYmplY3QoZGVmKSAmJlxuICAgICAgICAgICAgICAgMCA9PT0gT2JqZWN0LmtleXMoZGVmKS5sZW5ndGgpIHtcbiAgICAgIC8vIHByZXZlbnQgb2RkIFwic2hhcmVkXCIgb2JqZWN0cyBiZXR3ZWVuIGRvY3VtZW50c1xuICAgICAgb3B0aW9ucy5kZWZhdWx0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge31cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBTY2hlbWFUeXBlLmNhbGwodGhpcywgcGF0aCwgb3B0aW9ucyk7XG59XG5cbi8qIVxuICogSW5oZXJpdHMgZnJvbSBTY2hlbWFUeXBlLlxuICovXG5NaXhlZC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBTY2hlbWFUeXBlLnByb3RvdHlwZSApO1xuTWl4ZWQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gTWl4ZWQ7XG5cbi8qKlxuICogUmVxdWlyZWQgdmFsaWRhdG9yXG4gKlxuICogQGFwaSBwcml2YXRlXG4gKi9cbk1peGVkLnByb3RvdHlwZS5jaGVja1JlcXVpcmVkID0gZnVuY3Rpb24gKHZhbCkge1xuICByZXR1cm4gKHZhbCAhPT0gdW5kZWZpbmVkKSAmJiAodmFsICE9PSBudWxsKTtcbn07XG5cbi8qKlxuICogQ2FzdHMgYHZhbGAgZm9yIE1peGVkLlxuICpcbiAqIF90aGlzIGlzIGEgbm8tb3BfXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlIHRvIGNhc3RcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5NaXhlZC5wcm90b3R5cGUuY2FzdCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWU7XG59O1xuXG4vKiFcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gTWl4ZWQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIVxuICogTW9kdWxlIHJlcXVpcmVtZW50cy5cbiAqL1xuXG52YXIgU2NoZW1hVHlwZSA9IHJlcXVpcmUoJy4uL3NjaGVtYXR5cGUnKVxuICAsIENhc3RFcnJvciA9IFNjaGVtYVR5cGUuQ2FzdEVycm9yXG4gICwgZXJyb3JNZXNzYWdlcyA9IHJlcXVpcmUoJy4uL2Vycm9yJykubWVzc2FnZXM7XG5cbi8qKlxuICogTnVtYmVyIFNjaGVtYVR5cGUgY29uc3RydWN0b3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBpbmhlcml0cyBTY2hlbWFUeXBlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gTnVtYmVyU2NoZW1hIChrZXksIG9wdGlvbnMpIHtcbiAgU2NoZW1hVHlwZS5jYWxsKHRoaXMsIGtleSwgb3B0aW9ucywgJ051bWJlcicpO1xufVxuXG4vKiFcbiAqIEluaGVyaXRzIGZyb20gU2NoZW1hVHlwZS5cbiAqL1xuTnVtYmVyU2NoZW1hLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIFNjaGVtYVR5cGUucHJvdG90eXBlICk7XG5OdW1iZXJTY2hlbWEucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gTnVtYmVyU2NoZW1hO1xuXG4vKipcbiAqIFJlcXVpcmVkIHZhbGlkYXRvciBmb3IgbnVtYmVyXG4gKlxuICogQGFwaSBwcml2YXRlXG4gKi9cbk51bWJlclNjaGVtYS5wcm90b3R5cGUuY2hlY2tSZXF1aXJlZCA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG4gIGlmICggU2NoZW1hVHlwZS5faXNSZWYoIHRoaXMsIHZhbHVlICkgKSB7XG4gICAgcmV0dXJuIG51bGwgIT0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyB8fCB2YWx1ZSBpbnN0YW5jZW9mIE51bWJlcjtcbiAgfVxufTtcblxuLyoqXG4gKiBTZXRzIGEgbWluaW11bSBudW1iZXIgdmFsaWRhdG9yLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgcyA9IG5ldyBTY2hlbWEoeyBuOiB7IHR5cGU6IE51bWJlciwgbWluOiAxMCB9KVxuICogICAgIHZhciBNID0gZGIubW9kZWwoJ00nLCBzKVxuICogICAgIHZhciBtID0gbmV3IE0oeyBuOiA5IH0pXG4gKiAgICAgbS5zYXZlKGZ1bmN0aW9uIChlcnIpIHtcbiAqICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKSAvLyB2YWxpZGF0b3IgZXJyb3JcbiAqICAgICAgIG0ubiA9IDEwO1xuICogICAgICAgbS5zYXZlKCkgLy8gc3VjY2Vzc1xuICogICAgIH0pXG4gKlxuICogICAgIC8vIGN1c3RvbSBlcnJvciBtZXNzYWdlc1xuICogICAgIC8vIFdlIGNhbiBhbHNvIHVzZSB0aGUgc3BlY2lhbCB7TUlOfSB0b2tlbiB3aGljaCB3aWxsIGJlIHJlcGxhY2VkIHdpdGggdGhlIGludmFsaWQgdmFsdWVcbiAqICAgICB2YXIgbWluID0gWzEwLCAnVGhlIHZhbHVlIG9mIHBhdGggYHtQQVRIfWAgKHtWQUxVRX0pIGlzIGJlbmVhdGggdGhlIGxpbWl0ICh7TUlOfSkuJ107XG4gKiAgICAgdmFyIHNjaGVtYSA9IG5ldyBTY2hlbWEoeyBuOiB7IHR5cGU6IE51bWJlciwgbWluOiBtaW4gfSlcbiAqICAgICB2YXIgTSA9IG1vbmdvb3NlLm1vZGVsKCdNZWFzdXJlbWVudCcsIHNjaGVtYSk7XG4gKiAgICAgdmFyIHM9IG5ldyBNKHsgbjogNCB9KTtcbiAqICAgICBzLnZhbGlkYXRlKGZ1bmN0aW9uIChlcnIpIHtcbiAqICAgICAgIGNvbnNvbGUubG9nKFN0cmluZyhlcnIpKSAvLyBWYWxpZGF0aW9uRXJyb3I6IFRoZSB2YWx1ZSBvZiBwYXRoIGBuYCAoNCkgaXMgYmVuZWF0aCB0aGUgbGltaXQgKDEwKS5cbiAqICAgICB9KVxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSBtaW5pbXVtIG51bWJlclxuICogQHBhcmFtIHtTdHJpbmd9IFttZXNzYWdlXSBvcHRpb25hbCBjdXN0b20gZXJyb3IgbWVzc2FnZVxuICogQHJldHVybiB7U2NoZW1hVHlwZX0gdGhpc1xuICogQHNlZSBDdXN0b21pemVkIEVycm9yIE1lc3NhZ2VzICNlcnJvcl9tZXNzYWdlc19TdG9yYWdlRXJyb3ItbWVzc2FnZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cbk51bWJlclNjaGVtYS5wcm90b3R5cGUubWluID0gZnVuY3Rpb24gKHZhbHVlLCBtZXNzYWdlKSB7XG4gIGlmICh0aGlzLm1pblZhbGlkYXRvcikge1xuICAgIHRoaXMudmFsaWRhdG9ycyA9IHRoaXMudmFsaWRhdG9ycy5maWx0ZXIoZnVuY3Rpb24gKHYpIHtcbiAgICAgIHJldHVybiB2WzBdICE9IHRoaXMubWluVmFsaWRhdG9yO1xuICAgIH0sIHRoaXMpO1xuICB9XG5cbiAgaWYgKG51bGwgIT0gdmFsdWUpIHtcbiAgICB2YXIgbXNnID0gbWVzc2FnZSB8fCBlcnJvck1lc3NhZ2VzLk51bWJlci5taW47XG4gICAgbXNnID0gbXNnLnJlcGxhY2UoL3tNSU59LywgdmFsdWUpO1xuICAgIHRoaXMudmFsaWRhdG9ycy5wdXNoKFt0aGlzLm1pblZhbGlkYXRvciA9IGZ1bmN0aW9uICh2KSB7XG4gICAgICByZXR1cm4gdiA9PT0gbnVsbCB8fCB2ID49IHZhbHVlO1xuICAgIH0sIG1zZywgJ21pbiddKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBTZXRzIGEgbWF4aW11bSBudW1iZXIgdmFsaWRhdG9yLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgcyA9IG5ldyBTY2hlbWEoeyBuOiB7IHR5cGU6IE51bWJlciwgbWF4OiAxMCB9KVxuICogICAgIHZhciBNID0gZGIubW9kZWwoJ00nLCBzKVxuICogICAgIHZhciBtID0gbmV3IE0oeyBuOiAxMSB9KVxuICogICAgIG0uc2F2ZShmdW5jdGlvbiAoZXJyKSB7XG4gKiAgICAgICBjb25zb2xlLmVycm9yKGVycikgLy8gdmFsaWRhdG9yIGVycm9yXG4gKiAgICAgICBtLm4gPSAxMDtcbiAqICAgICAgIG0uc2F2ZSgpIC8vIHN1Y2Nlc3NcbiAqICAgICB9KVxuICpcbiAqICAgICAvLyBjdXN0b20gZXJyb3IgbWVzc2FnZXNcbiAqICAgICAvLyBXZSBjYW4gYWxzbyB1c2UgdGhlIHNwZWNpYWwge01BWH0gdG9rZW4gd2hpY2ggd2lsbCBiZSByZXBsYWNlZCB3aXRoIHRoZSBpbnZhbGlkIHZhbHVlXG4gKiAgICAgdmFyIG1heCA9IFsxMCwgJ1RoZSB2YWx1ZSBvZiBwYXRoIGB7UEFUSH1gICh7VkFMVUV9KSBleGNlZWRzIHRoZSBsaW1pdCAoe01BWH0pLiddO1xuICogICAgIHZhciBzY2hlbWEgPSBuZXcgU2NoZW1hKHsgbjogeyB0eXBlOiBOdW1iZXIsIG1heDogbWF4IH0pXG4gKiAgICAgdmFyIE0gPSBtb25nb29zZS5tb2RlbCgnTWVhc3VyZW1lbnQnLCBzY2hlbWEpO1xuICogICAgIHZhciBzPSBuZXcgTSh7IG46IDQgfSk7XG4gKiAgICAgcy52YWxpZGF0ZShmdW5jdGlvbiAoZXJyKSB7XG4gKiAgICAgICBjb25zb2xlLmxvZyhTdHJpbmcoZXJyKSkgLy8gVmFsaWRhdGlvbkVycm9yOiBUaGUgdmFsdWUgb2YgcGF0aCBgbmAgKDQpIGV4Y2VlZHMgdGhlIGxpbWl0ICgxMCkuXG4gKiAgICAgfSlcbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgbWF4aW11bSBudW1iZXJcbiAqIEBwYXJhbSB7U3RyaW5nfSBbbWVzc2FnZV0gb3B0aW9uYWwgY3VzdG9tIGVycm9yIG1lc3NhZ2VcbiAqIEByZXR1cm4ge1NjaGVtYVR5cGV9IHRoaXNcbiAqIEBzZWUgQ3VzdG9taXplZCBFcnJvciBNZXNzYWdlcyAjZXJyb3JfbWVzc2FnZXNfU3RvcmFnZUVycm9yLW1lc3NhZ2VzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5OdW1iZXJTY2hlbWEucHJvdG90eXBlLm1heCA9IGZ1bmN0aW9uICh2YWx1ZSwgbWVzc2FnZSkge1xuICBpZiAodGhpcy5tYXhWYWxpZGF0b3IpIHtcbiAgICB0aGlzLnZhbGlkYXRvcnMgPSB0aGlzLnZhbGlkYXRvcnMuZmlsdGVyKGZ1bmN0aW9uKHYpe1xuICAgICAgcmV0dXJuIHZbMF0gIT0gdGhpcy5tYXhWYWxpZGF0b3I7XG4gICAgfSwgdGhpcyk7XG4gIH1cblxuICBpZiAobnVsbCAhPSB2YWx1ZSkge1xuICAgIHZhciBtc2cgPSBtZXNzYWdlIHx8IGVycm9yTWVzc2FnZXMuTnVtYmVyLm1heDtcbiAgICBtc2cgPSBtc2cucmVwbGFjZSgve01BWH0vLCB2YWx1ZSk7XG4gICAgdGhpcy52YWxpZGF0b3JzLnB1c2goW3RoaXMubWF4VmFsaWRhdG9yID0gZnVuY3Rpb24odil7XG4gICAgICByZXR1cm4gdiA9PT0gbnVsbCB8fCB2IDw9IHZhbHVlO1xuICAgIH0sIG1zZywgJ21heCddKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBDYXN0cyB0byBudW1iZXJcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWUgdmFsdWUgdG8gY2FzdFxuICogQGFwaSBwcml2YXRlXG4gKi9cbk51bWJlclNjaGVtYS5wcm90b3R5cGUuY2FzdCA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG4gIHZhciB2YWwgPSB2YWx1ZSAmJiB2YWx1ZS5faWRcbiAgICA/IHZhbHVlLl9pZCAvLyBkb2N1bWVudHNcbiAgICA6IHZhbHVlO1xuXG4gIGlmICghaXNOYU4odmFsKSl7XG4gICAgaWYgKG51bGwgPT09IHZhbCkgcmV0dXJuIHZhbDtcbiAgICBpZiAoJycgPT09IHZhbCkgcmV0dXJuIG51bGw7XG4gICAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiB2YWwpIHZhbCA9IE51bWJlcih2YWwpO1xuICAgIGlmICh2YWwgaW5zdGFuY2VvZiBOdW1iZXIpIHJldHVybiB2YWw7XG4gICAgaWYgKCdudW1iZXInID09IHR5cGVvZiB2YWwpIHJldHVybiB2YWw7XG4gICAgaWYgKHZhbC50b1N0cmluZyAmJiAhQXJyYXkuaXNBcnJheSh2YWwpICYmXG4gICAgICAgIHZhbC50b1N0cmluZygpID09IE51bWJlcih2YWwpKSB7XG4gICAgICByZXR1cm4gbmV3IE51bWJlcih2YWwpO1xuICAgIH1cbiAgfVxuXG4gIHRocm93IG5ldyBDYXN0RXJyb3IoJ251bWJlcicsIHZhbHVlLCB0aGlzLnBhdGgpO1xufTtcblxuLyohXG4gKiBNb2R1bGUgZXhwb3J0cy5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IE51bWJlclNjaGVtYTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBTY2hlbWFUeXBlID0gcmVxdWlyZSgnLi4vc2NoZW1hdHlwZScpXG4gICwgQ2FzdEVycm9yID0gU2NoZW1hVHlwZS5DYXN0RXJyb3JcbiAgLCBvaWQgPSByZXF1aXJlKCcuLi90eXBlcy9vYmplY3RpZCcpXG4gICwgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpXG4gICwgRG9jdW1lbnQ7XG5cbi8qKlxuICogT2JqZWN0SWQgU2NoZW1hVHlwZSBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQGluaGVyaXRzIFNjaGVtYVR5cGVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIE9iamVjdElkIChrZXksIG9wdGlvbnMpIHtcbiAgU2NoZW1hVHlwZS5jYWxsKHRoaXMsIGtleSwgb3B0aW9ucywgJ09iamVjdElkJyk7XG59XG5cbi8qIVxuICogSW5oZXJpdHMgZnJvbSBTY2hlbWFUeXBlLlxuICovXG5PYmplY3RJZC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBTY2hlbWFUeXBlLnByb3RvdHlwZSApO1xuT2JqZWN0SWQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gT2JqZWN0SWQ7XG5cbi8qKlxuICogQWRkcyBhbiBhdXRvLWdlbmVyYXRlZCBPYmplY3RJZCBkZWZhdWx0IGlmIHR1cm5PbiBpcyB0cnVlLlxuICogQHBhcmFtIHtCb29sZWFufSB0dXJuT24gYXV0byBnZW5lcmF0ZWQgT2JqZWN0SWQgZGVmYXVsdHNcbiAqIEBhcGkgcHVibGljXG4gKiBAcmV0dXJuIHtTY2hlbWFUeXBlfSB0aGlzXG4gKi9cbk9iamVjdElkLnByb3RvdHlwZS5hdXRvID0gZnVuY3Rpb24gKCB0dXJuT24gKSB7XG4gIGlmICggdHVybk9uICkge1xuICAgIHRoaXMuZGVmYXVsdCggZGVmYXVsdElkICk7XG4gICAgdGhpcy5zZXQoIHJlc2V0SWQgKVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIENoZWNrIHJlcXVpcmVkXG4gKlxuICogQGFwaSBwcml2YXRlXG4gKi9cbk9iamVjdElkLnByb3RvdHlwZS5jaGVja1JlcXVpcmVkID0gZnVuY3Rpb24gKCB2YWx1ZSApIHtcbiAgaWYgKFNjaGVtYVR5cGUuX2lzUmVmKCB0aGlzLCB2YWx1ZSApKSB7XG4gICAgcmV0dXJuIG51bGwgIT0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2Ygb2lkO1xuICB9XG59O1xuXG4vKipcbiAqIENhc3RzIHRvIE9iamVjdElkXG4gKlxuICogQHBhcmFtIHtPYmplY3RJZHxTdHJpbmd9IHZhbHVlXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2NcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gaW5pdFxuICogQHBhcmFtIHtPYmplY3RJZHxEb2N1bWVudH0gcHJpb3JWYWxcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5PYmplY3RJZC5wcm90b3R5cGUuY2FzdCA9IGZ1bmN0aW9uICggdmFsdWUsIGRvYywgaW5pdCwgcHJpb3JWYWwgKSB7XG4gIC8vIGxhenkgbG9hZFxuICBEb2N1bWVudCB8fCAoRG9jdW1lbnQgPSByZXF1aXJlKCcuLy4uL2RvY3VtZW50JykpO1xuXG4gIGlmICggU2NoZW1hVHlwZS5faXNSZWYoIHRoaXMsIHZhbHVlICkgKSB7XG4gICAgLy8gd2FpdCEgd2UgbWF5IG5lZWQgdG8gY2FzdCB0aGlzIHRvIGEgZG9jdW1lbnRcblxuICAgIGlmIChudWxsID09IHZhbHVlKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRG9jdW1lbnQpIHtcbiAgICAgIHZhbHVlLiRfXy53YXNQb3B1bGF0ZWQgPSB0cnVlO1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIC8vIHNldHRpbmcgYSBwb3B1bGF0ZWQgcGF0aFxuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIG9pZCApIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKCAhXy5pc1BsYWluT2JqZWN0KCB2YWx1ZSApICkge1xuICAgICAgdGhyb3cgbmV3IENhc3RFcnJvcignT2JqZWN0SWQnLCB2YWx1ZSwgdGhpcy5wYXRoKTtcbiAgICB9XG5cbiAgICAvLyDQndGD0LbQvdC+INGB0L7Qt9C00LDRgtGMINC00L7QutGD0LzQtdC90YIg0L/QviDRgdGF0LXQvNC1LCDRg9C60LDQt9Cw0L3QvdC+0Lkg0LIg0YHRgdGL0LvQutC1XG4gICAgdmFyIHNjaGVtYSA9IHRoaXMub3B0aW9ucy5yZWY7XG4gICAgaWYgKCAhc2NoZW1hICl7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCfQn9GA0Lgg0YHRgdGL0LvQutC1IChyZWYpINC90LAg0LTQvtC60YPQvNC10L3RgiAnICtcbiAgICAgICAgJ9C90YPQttC90L4g0YPQutCw0LfRi9Cy0LDRgtGMINGB0YXQtdC80YMsINC/0L4g0LrQvtGC0L7RgNC+0Lkg0Y3RgtC+0YIg0LTQvtC60YPQvNC10L3RgiDRgdC+0LfQtNCw0LLQsNGC0YwnKTtcbiAgICB9XG5cbiAgICBpZiAoICFzdG9yYWdlLnNjaGVtYXNbIHNjaGVtYSBdICl7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCfQn9GA0Lgg0YHRgdGL0LvQutC1IChyZWYpINC90LAg0LTQvtC60YPQvNC10L3RgiAnICtcbiAgICAgICAgJ9C90YPQttC90L4g0YPQutCw0LfRi9Cy0LDRgtGMINC90LDQt9Cy0LDQvdC40LUg0YHRhdC10LzRiyDQvdCwINC60L7RgtC+0YDRg9GOINGB0YHRi9C70LDQtdC80YHRjyDQv9GA0Lgg0LXRkSDRgdC+0LfQtNCw0L3QuNC4ICggbmV3IFNjaGVtYShcIm5hbWVcIiwgc2NoZW1hT2JqZWN0KSApJyk7XG4gICAgfVxuXG4gICAgLy8gaW5pdCBkb2NcbiAgICBkb2MgPSBuZXcgRG9jdW1lbnQoIHZhbHVlLCB1bmRlZmluZWQsIHN0b3JhZ2Uuc2NoZW1hc1sgc2NoZW1hIF0sIHVuZGVmaW5lZCwgdHJ1ZSApO1xuICAgIGRvYy4kX18ud2FzUG9wdWxhdGVkID0gdHJ1ZTtcblxuICAgIHJldHVybiBkb2M7XG4gIH1cblxuICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiB2YWx1ZTtcblxuICAvLyDQn9GA0LXQtNC+0YLQstGA0LDRgtC40YLRjCBkZXBvcHVsYXRlXG4gIGlmICggcHJpb3JWYWwgaW5zdGFuY2VvZiBEb2N1bWVudCApe1xuICAgIGlmICggcHJpb3JWYWwuX2lkICYmIHByaW9yVmFsLl9pZC5lcXVhbHMoIHZhbHVlICkgKXtcbiAgICAgIHJldHVybiBwcmlvclZhbDtcbiAgICB9XG4gIH1cblxuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBvaWQpXG4gICAgcmV0dXJuIHZhbHVlO1xuXG4gIGlmICggdmFsdWUuX2lkICYmIHZhbHVlLl9pZCBpbnN0YW5jZW9mIG9pZCApXG4gICAgcmV0dXJuIHZhbHVlLl9pZDtcblxuICBpZiAodmFsdWUudG9TdHJpbmcpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIG9pZC5jcmVhdGVGcm9tSGV4U3RyaW5nKHZhbHVlLnRvU3RyaW5nKCkpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhyb3cgbmV3IENhc3RFcnJvcignT2JqZWN0SWQnLCB2YWx1ZSwgdGhpcy5wYXRoKTtcbiAgICB9XG4gIH1cblxuICB0aHJvdyBuZXcgQ2FzdEVycm9yKCdPYmplY3RJZCcsIHZhbHVlLCB0aGlzLnBhdGgpO1xufTtcblxuLyohXG4gKiBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gZGVmYXVsdElkICgpIHtcbiAgcmV0dXJuIG5ldyBvaWQoKTtcbn1cblxuZnVuY3Rpb24gcmVzZXRJZCAodikge1xuICB0aGlzLiRfXy5faWQgPSBudWxsO1xuICByZXR1cm4gdjtcbn1cblxuLyohXG4gKiBNb2R1bGUgZXhwb3J0cy5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9iamVjdElkO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIFNjaGVtYVR5cGUgPSByZXF1aXJlKCcuLi9zY2hlbWF0eXBlJylcbiAgLCBDYXN0RXJyb3IgPSBTY2hlbWFUeXBlLkNhc3RFcnJvclxuICAsIGVycm9yTWVzc2FnZXMgPSByZXF1aXJlKCcuLi9lcnJvcicpLm1lc3NhZ2VzO1xuXG4vKipcbiAqIFN0cmluZyBTY2hlbWFUeXBlIGNvbnN0cnVjdG9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAaW5oZXJpdHMgU2NoZW1hVHlwZVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gU3RyaW5nU2NoZW1hIChrZXksIG9wdGlvbnMpIHtcbiAgdGhpcy5lbnVtVmFsdWVzID0gW107XG4gIHRoaXMucmVnRXhwID0gbnVsbDtcbiAgU2NoZW1hVHlwZS5jYWxsKHRoaXMsIGtleSwgb3B0aW9ucywgJ1N0cmluZycpO1xufVxuXG4vKiFcbiAqIEluaGVyaXRzIGZyb20gU2NoZW1hVHlwZS5cbiAqL1xuU3RyaW5nU2NoZW1hLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIFNjaGVtYVR5cGUucHJvdG90eXBlICk7XG5TdHJpbmdTY2hlbWEucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gU3RyaW5nU2NoZW1hO1xuXG4vKipcbiAqIEFkZHMgYW4gZW51bSB2YWxpZGF0b3JcbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIHN0YXRlcyA9ICdvcGVuaW5nIG9wZW4gY2xvc2luZyBjbG9zZWQnLnNwbGl0KCcgJylcbiAqICAgICB2YXIgcyA9IG5ldyBTY2hlbWEoeyBzdGF0ZTogeyB0eXBlOiBTdHJpbmcsIGVudW06IHN0YXRlcyB9fSlcbiAqICAgICB2YXIgTSA9IGRiLm1vZGVsKCdNJywgcylcbiAqICAgICB2YXIgbSA9IG5ldyBNKHsgc3RhdGU6ICdpbnZhbGlkJyB9KVxuICogICAgIG0uc2F2ZShmdW5jdGlvbiAoZXJyKSB7XG4gKiAgICAgICBjb25zb2xlLmVycm9yKFN0cmluZyhlcnIpKSAvLyBWYWxpZGF0aW9uRXJyb3I6IGBpbnZhbGlkYCBpcyBub3QgYSB2YWxpZCBlbnVtIHZhbHVlIGZvciBwYXRoIGBzdGF0ZWAuXG4gKiAgICAgICBtLnN0YXRlID0gJ29wZW4nXG4gKiAgICAgICBtLnNhdmUoY2FsbGJhY2spIC8vIHN1Y2Nlc3NcbiAqICAgICB9KVxuICpcbiAqICAgICAvLyBvciB3aXRoIGN1c3RvbSBlcnJvciBtZXNzYWdlc1xuICogICAgIHZhciBlbnUgPSB7XG4gKiAgICAgICB2YWx1ZXM6ICdvcGVuaW5nIG9wZW4gY2xvc2luZyBjbG9zZWQnLnNwbGl0KCcgJyksXG4gKiAgICAgICBtZXNzYWdlOiAnZW51bSB2YWxpZGF0b3IgZmFpbGVkIGZvciBwYXRoIGB7UEFUSH1gIHdpdGggdmFsdWUgYHtWQUxVRX1gJ1xuICogICAgIH1cbiAqICAgICB2YXIgcyA9IG5ldyBTY2hlbWEoeyBzdGF0ZTogeyB0eXBlOiBTdHJpbmcsIGVudW06IGVudSB9KVxuICogICAgIHZhciBNID0gZGIubW9kZWwoJ00nLCBzKVxuICogICAgIHZhciBtID0gbmV3IE0oeyBzdGF0ZTogJ2ludmFsaWQnIH0pXG4gKiAgICAgbS5zYXZlKGZ1bmN0aW9uIChlcnIpIHtcbiAqICAgICAgIGNvbnNvbGUuZXJyb3IoU3RyaW5nKGVycikpIC8vIFZhbGlkYXRpb25FcnJvcjogZW51bSB2YWxpZGF0b3IgZmFpbGVkIGZvciBwYXRoIGBzdGF0ZWAgd2l0aCB2YWx1ZSBgaW52YWxpZGBcbiAqICAgICAgIG0uc3RhdGUgPSAnb3BlbidcbiAqICAgICAgIG0uc2F2ZShjYWxsYmFjaykgLy8gc3VjY2Vzc1xuICogICAgIH0pXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBbYXJncy4uLl0gZW51bWVyYXRpb24gdmFsdWVzXG4gKiBAcmV0dXJuIHtTY2hlbWFUeXBlfSB0aGlzXG4gKiBAc2VlIEN1c3RvbWl6ZWQgRXJyb3IgTWVzc2FnZXMgI2Vycm9yX21lc3NhZ2VzX1N0b3JhZ2VFcnJvci1tZXNzYWdlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuU3RyaW5nU2NoZW1hLnByb3RvdHlwZS5lbnVtID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5lbnVtVmFsaWRhdG9yKSB7XG4gICAgdGhpcy52YWxpZGF0b3JzID0gdGhpcy52YWxpZGF0b3JzLmZpbHRlcihmdW5jdGlvbih2KXtcbiAgICAgIHJldHVybiB2WzBdICE9IHRoaXMuZW51bVZhbGlkYXRvcjtcbiAgICB9LCB0aGlzKTtcbiAgICB0aGlzLmVudW1WYWxpZGF0b3IgPSBmYWxzZTtcbiAgfVxuXG4gIGlmICh1bmRlZmluZWQgPT09IGFyZ3VtZW50c1swXSB8fCBmYWxzZSA9PT0gYXJndW1lbnRzWzBdKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICB2YXIgdmFsdWVzO1xuICB2YXIgZXJyb3JNZXNzYWdlO1xuXG4gIGlmIChfLmlzUGxhaW5PYmplY3QoYXJndW1lbnRzWzBdKSkge1xuICAgIHZhbHVlcyA9IGFyZ3VtZW50c1swXS52YWx1ZXM7XG4gICAgZXJyb3JNZXNzYWdlID0gYXJndW1lbnRzWzBdLm1lc3NhZ2U7XG4gIH0gZWxzZSB7XG4gICAgdmFsdWVzID0gYXJndW1lbnRzO1xuICAgIGVycm9yTWVzc2FnZSA9IGVycm9yTWVzc2FnZXMuU3RyaW5nLmVudW07XG4gIH1cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgIGlmICh1bmRlZmluZWQgIT09IHZhbHVlc1tpXSkge1xuICAgICAgdGhpcy5lbnVtVmFsdWVzLnB1c2godGhpcy5jYXN0KHZhbHVlc1tpXSkpO1xuICAgIH1cbiAgfVxuXG4gIHZhciB2YWxzID0gdGhpcy5lbnVtVmFsdWVzO1xuICB0aGlzLmVudW1WYWxpZGF0b3IgPSBmdW5jdGlvbiAodikge1xuICAgIHJldHVybiB1bmRlZmluZWQgPT09IHYgfHwgfnZhbHMuaW5kZXhPZih2KTtcbiAgfTtcbiAgdGhpcy52YWxpZGF0b3JzLnB1c2goW3RoaXMuZW51bVZhbGlkYXRvciwgZXJyb3JNZXNzYWdlLCAnZW51bSddKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQWRkcyBhIGxvd2VyY2FzZSBzZXR0ZXIuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIHZhciBzID0gbmV3IFNjaGVtYSh7IGVtYWlsOiB7IHR5cGU6IFN0cmluZywgbG93ZXJjYXNlOiB0cnVlIH19KVxuICogICAgIHZhciBNID0gZGIubW9kZWwoJ00nLCBzKTtcbiAqICAgICB2YXIgbSA9IG5ldyBNKHsgZW1haWw6ICdTb21lRW1haWxAZXhhbXBsZS5DT00nIH0pO1xuICogICAgIGNvbnNvbGUubG9nKG0uZW1haWwpIC8vIHNvbWVlbWFpbEBleGFtcGxlLmNvbVxuICpcbiAqIEBhcGkgcHVibGljXG4gKiBAcmV0dXJuIHtTY2hlbWFUeXBlfSB0aGlzXG4gKi9cblN0cmluZ1NjaGVtYS5wcm90b3R5cGUubG93ZXJjYXNlID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5zZXQoZnVuY3Rpb24gKHYsIHNlbGYpIHtcbiAgICBpZiAoJ3N0cmluZycgIT0gdHlwZW9mIHYpIHYgPSBzZWxmLmNhc3Qodik7XG4gICAgaWYgKHYpIHJldHVybiB2LnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIHY7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBBZGRzIGFuIHVwcGVyY2FzZSBzZXR0ZXIuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIHZhciBzID0gbmV3IFNjaGVtYSh7IGNhcHM6IHsgdHlwZTogU3RyaW5nLCB1cHBlcmNhc2U6IHRydWUgfX0pXG4gKiAgICAgdmFyIE0gPSBkYi5tb2RlbCgnTScsIHMpO1xuICogICAgIHZhciBtID0gbmV3IE0oeyBjYXBzOiAnYW4gZXhhbXBsZScgfSk7XG4gKiAgICAgY29uc29sZS5sb2cobS5jYXBzKSAvLyBBTiBFWEFNUExFXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqIEByZXR1cm4ge1NjaGVtYVR5cGV9IHRoaXNcbiAqL1xuU3RyaW5nU2NoZW1hLnByb3RvdHlwZS51cHBlcmNhc2UgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLnNldChmdW5jdGlvbiAodiwgc2VsZikge1xuICAgIGlmICgnc3RyaW5nJyAhPSB0eXBlb2YgdikgdiA9IHNlbGYuY2FzdCh2KTtcbiAgICBpZiAodikgcmV0dXJuIHYudG9VcHBlckNhc2UoKTtcbiAgICByZXR1cm4gdjtcbiAgfSk7XG59O1xuXG4vKipcbiAqIEFkZHMgYSB0cmltIHNldHRlci5cbiAqXG4gKiBUaGUgc3RyaW5nIHZhbHVlIHdpbGwgYmUgdHJpbW1lZCB3aGVuIHNldC5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIHMgPSBuZXcgU2NoZW1hKHsgbmFtZTogeyB0eXBlOiBTdHJpbmcsIHRyaW06IHRydWUgfX0pXG4gKiAgICAgdmFyIE0gPSBkYi5tb2RlbCgnTScsIHMpXG4gKiAgICAgdmFyIHN0cmluZyA9ICcgc29tZSBuYW1lICdcbiAqICAgICBjb25zb2xlLmxvZyhzdHJpbmcubGVuZ3RoKSAvLyAxMVxuICogICAgIHZhciBtID0gbmV3IE0oeyBuYW1lOiBzdHJpbmcgfSlcbiAqICAgICBjb25zb2xlLmxvZyhtLm5hbWUubGVuZ3RoKSAvLyA5XG4gKlxuICogQGFwaSBwdWJsaWNcbiAqIEByZXR1cm4ge1NjaGVtYVR5cGV9IHRoaXNcbiAqL1xuU3RyaW5nU2NoZW1hLnByb3RvdHlwZS50cmltID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5zZXQoZnVuY3Rpb24gKHYsIHNlbGYpIHtcbiAgICBpZiAoJ3N0cmluZycgIT0gdHlwZW9mIHYpIHYgPSBzZWxmLmNhc3Qodik7XG4gICAgaWYgKHYpIHJldHVybiB2LnRyaW0oKTtcbiAgICByZXR1cm4gdjtcbiAgfSk7XG59O1xuXG4vKipcbiAqIFNldHMgYSByZWdleHAgdmFsaWRhdG9yLlxuICpcbiAqIEFueSB2YWx1ZSB0aGF0IGRvZXMgbm90IHBhc3MgYHJlZ0V4cGAudGVzdCh2YWwpIHdpbGwgZmFpbCB2YWxpZGF0aW9uLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgcyA9IG5ldyBTY2hlbWEoeyBuYW1lOiB7IHR5cGU6IFN0cmluZywgbWF0Y2g6IC9eYS8gfX0pXG4gKiAgICAgdmFyIE0gPSBkYi5tb2RlbCgnTScsIHMpXG4gKiAgICAgdmFyIG0gPSBuZXcgTSh7IG5hbWU6ICdJIGFtIGludmFsaWQnIH0pXG4gKiAgICAgbS52YWxpZGF0ZShmdW5jdGlvbiAoZXJyKSB7XG4gKiAgICAgICBjb25zb2xlLmVycm9yKFN0cmluZyhlcnIpKSAvLyBcIlZhbGlkYXRpb25FcnJvcjogUGF0aCBgbmFtZWAgaXMgaW52YWxpZCAoSSBhbSBpbnZhbGlkKS5cIlxuICogICAgICAgbS5uYW1lID0gJ2FwcGxlcydcbiAqICAgICAgIG0udmFsaWRhdGUoZnVuY3Rpb24gKGVycikge1xuICogICAgICAgICBhc3NlcnQub2soZXJyKSAvLyBzdWNjZXNzXG4gKiAgICAgICB9KVxuICogICAgIH0pXG4gKlxuICogICAgIC8vIHVzaW5nIGEgY3VzdG9tIGVycm9yIG1lc3NhZ2VcbiAqICAgICB2YXIgbWF0Y2ggPSBbIC9cXC5odG1sJC8sIFwiVGhhdCBmaWxlIGRvZXNuJ3QgZW5kIGluIC5odG1sICh7VkFMVUV9KVwiIF07XG4gKiAgICAgdmFyIHMgPSBuZXcgU2NoZW1hKHsgZmlsZTogeyB0eXBlOiBTdHJpbmcsIG1hdGNoOiBtYXRjaCB9fSlcbiAqICAgICB2YXIgTSA9IGRiLm1vZGVsKCdNJywgcyk7XG4gKiAgICAgdmFyIG0gPSBuZXcgTSh7IGZpbGU6ICdpbnZhbGlkJyB9KTtcbiAqICAgICBtLnZhbGlkYXRlKGZ1bmN0aW9uIChlcnIpIHtcbiAqICAgICAgIGNvbnNvbGUubG9nKFN0cmluZyhlcnIpKSAvLyBcIlZhbGlkYXRpb25FcnJvcjogVGhhdCBmaWxlIGRvZXNuJ3QgZW5kIGluIC5odG1sIChpbnZhbGlkKVwiXG4gKiAgICAgfSlcbiAqXG4gKiBFbXB0eSBzdHJpbmdzLCBgdW5kZWZpbmVkYCwgYW5kIGBudWxsYCB2YWx1ZXMgYWx3YXlzIHBhc3MgdGhlIG1hdGNoIHZhbGlkYXRvci4gSWYgeW91IHJlcXVpcmUgdGhlc2UgdmFsdWVzLCBlbmFibGUgdGhlIGByZXF1aXJlZGAgdmFsaWRhdG9yIGFsc28uXG4gKlxuICogICAgIHZhciBzID0gbmV3IFNjaGVtYSh7IG5hbWU6IHsgdHlwZTogU3RyaW5nLCBtYXRjaDogL15hLywgcmVxdWlyZWQ6IHRydWUgfX0pXG4gKlxuICogQHBhcmFtIHtSZWdFeHB9IHJlZ0V4cCByZWd1bGFyIGV4cHJlc3Npb24gdG8gdGVzdCBhZ2FpbnN0XG4gKiBAcGFyYW0ge1N0cmluZ30gW21lc3NhZ2VdIG9wdGlvbmFsIGN1c3RvbSBlcnJvciBtZXNzYWdlXG4gKiBAcmV0dXJuIHtTY2hlbWFUeXBlfSB0aGlzXG4gKiBAc2VlIEN1c3RvbWl6ZWQgRXJyb3IgTWVzc2FnZXMgI2Vycm9yX21lc3NhZ2VzX1N0b3JhZ2VFcnJvci1tZXNzYWdlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuU3RyaW5nU2NoZW1hLnByb3RvdHlwZS5tYXRjaCA9IGZ1bmN0aW9uIG1hdGNoIChyZWdFeHAsIG1lc3NhZ2UpIHtcbiAgLy8geWVzLCB3ZSBhbGxvdyBtdWx0aXBsZSBtYXRjaCB2YWxpZGF0b3JzXG5cbiAgdmFyIG1zZyA9IG1lc3NhZ2UgfHwgZXJyb3JNZXNzYWdlcy5TdHJpbmcubWF0Y2g7XG5cbiAgZnVuY3Rpb24gbWF0Y2hWYWxpZGF0b3IgKHYpe1xuICAgIHJldHVybiBudWxsICE9IHYgJiYgJycgIT09IHZcbiAgICAgID8gcmVnRXhwLnRlc3QodilcbiAgICAgIDogdHJ1ZVxuICB9XG5cbiAgdGhpcy52YWxpZGF0b3JzLnB1c2goW21hdGNoVmFsaWRhdG9yLCBtc2csICdyZWdleHAnXSk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBDaGVjayByZXF1aXJlZFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfG51bGx8dW5kZWZpbmVkfSB2YWx1ZVxuICogQGFwaSBwcml2YXRlXG4gKi9cblN0cmluZ1NjaGVtYS5wcm90b3R5cGUuY2hlY2tSZXF1aXJlZCA9IGZ1bmN0aW9uIGNoZWNrUmVxdWlyZWQgKHZhbHVlLCBkb2MpIHtcbiAgaWYgKFNjaGVtYVR5cGUuX2lzUmVmKHRoaXMsIHZhbHVlLCBkb2MsIHRydWUpKSB7XG4gICAgcmV0dXJuIG51bGwgIT0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuICh2YWx1ZSBpbnN0YW5jZW9mIFN0cmluZyB8fCB0eXBlb2YgdmFsdWUgPT0gJ3N0cmluZycpICYmIHZhbHVlLmxlbmd0aDtcbiAgfVxufTtcblxuLyoqXG4gKiBDYXN0cyB0byBTdHJpbmdcbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuU3RyaW5nU2NoZW1hLnByb3RvdHlwZS5jYXN0ID0gZnVuY3Rpb24gKCB2YWx1ZSApIHtcbiAgaWYgKCB2YWx1ZSA9PT0gbnVsbCApIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICBpZiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiB2YWx1ZSkge1xuICAgIC8vIGhhbmRsZSBkb2N1bWVudHMgYmVpbmcgcGFzc2VkXG4gICAgaWYgKHZhbHVlLl9pZCAmJiAnc3RyaW5nJyA9PSB0eXBlb2YgdmFsdWUuX2lkKSB7XG4gICAgICByZXR1cm4gdmFsdWUuX2lkO1xuICAgIH1cbiAgICBpZiAoIHZhbHVlLnRvU3RyaW5nICkge1xuICAgICAgcmV0dXJuIHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IENhc3RFcnJvcignc3RyaW5nJywgdmFsdWUsIHRoaXMucGF0aCk7XG59O1xuXG4vKiFcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gU3RyaW5nU2NoZW1hO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIGVycm9yID0gcmVxdWlyZSgnLi9lcnJvcicpXG4gICwgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbnZhciBlcnJvck1lc3NhZ2VzID0gZXJyb3IubWVzc2FnZXM7XG52YXIgQ2FzdEVycm9yID0gZXJyb3IuQ2FzdEVycm9yO1xudmFyIFZhbGlkYXRvckVycm9yID0gZXJyb3IuVmFsaWRhdG9yRXJyb3I7XG5cbi8qKlxuICogU2NoZW1hVHlwZSBjb25zdHJ1Y3RvclxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge1N0cmluZ30gW2luc3RhbmNlXVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBTY2hlbWFUeXBlIChwYXRoLCBvcHRpb25zLCBpbnN0YW5jZSkge1xuICB0aGlzLnBhdGggPSBwYXRoO1xuICB0aGlzLmluc3RhbmNlID0gaW5zdGFuY2U7XG4gIHRoaXMudmFsaWRhdG9ycyA9IFtdO1xuICB0aGlzLnNldHRlcnMgPSBbXTtcbiAgdGhpcy5nZXR0ZXJzID0gW107XG4gIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgZm9yICh2YXIgaSBpbiBvcHRpb25zKSBpZiAodGhpc1tpXSAmJiAnZnVuY3Rpb24nID09IHR5cGVvZiB0aGlzW2ldKSB7XG4gICAgdmFyIG9wdHMgPSBBcnJheS5pc0FycmF5KG9wdGlvbnNbaV0pXG4gICAgICA/IG9wdGlvbnNbaV1cbiAgICAgIDogW29wdGlvbnNbaV1dO1xuXG4gICAgdGhpc1tpXS5hcHBseSh0aGlzLCBvcHRzKTtcbiAgfVxufVxuXG4vKipcbiAqIFNldHMgYSBkZWZhdWx0IHZhbHVlIGZvciB0aGlzIFNjaGVtYVR5cGUuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIHZhciBzY2hlbWEgPSBuZXcgU2NoZW1hKHsgbjogeyB0eXBlOiBOdW1iZXIsIGRlZmF1bHQ6IDEwIH0pXG4gKiAgICAgdmFyIE0gPSBkYi5tb2RlbCgnTScsIHNjaGVtYSlcbiAqICAgICB2YXIgbSA9IG5ldyBNO1xuICogICAgIGNvbnNvbGUubG9nKG0ubikgLy8gMTBcbiAqXG4gKiBEZWZhdWx0cyBjYW4gYmUgZWl0aGVyIGBmdW5jdGlvbnNgIHdoaWNoIHJldHVybiB0aGUgdmFsdWUgdG8gdXNlIGFzIHRoZSBkZWZhdWx0IG9yIHRoZSBsaXRlcmFsIHZhbHVlIGl0c2VsZi4gRWl0aGVyIHdheSwgdGhlIHZhbHVlIHdpbGwgYmUgY2FzdCBiYXNlZCBvbiBpdHMgc2NoZW1hIHR5cGUgYmVmb3JlIGJlaW5nIHNldCBkdXJpbmcgZG9jdW1lbnQgY3JlYXRpb24uXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIC8vIHZhbHVlcyBhcmUgY2FzdDpcbiAqICAgICB2YXIgc2NoZW1hID0gbmV3IFNjaGVtYSh7IGFOdW1iZXI6IE51bWJlciwgZGVmYXVsdDogXCI0LjgxNTE2MjM0MlwiIH0pXG4gKiAgICAgdmFyIE0gPSBkYi5tb2RlbCgnTScsIHNjaGVtYSlcbiAqICAgICB2YXIgbSA9IG5ldyBNO1xuICogICAgIGNvbnNvbGUubG9nKG0uYU51bWJlcikgLy8gNC44MTUxNjIzNDJcbiAqXG4gKiAgICAgLy8gZGVmYXVsdCB1bmlxdWUgb2JqZWN0cyBmb3IgTWl4ZWQgdHlwZXM6XG4gKiAgICAgdmFyIHNjaGVtYSA9IG5ldyBTY2hlbWEoeyBtaXhlZDogU2NoZW1hLlR5cGVzLk1peGVkIH0pO1xuICogICAgIHNjaGVtYS5wYXRoKCdtaXhlZCcpLmRlZmF1bHQoZnVuY3Rpb24gKCkge1xuICogICAgICAgcmV0dXJuIHt9O1xuICogICAgIH0pO1xuICpcbiAqICAgICAvLyBpZiB3ZSBkb24ndCB1c2UgYSBmdW5jdGlvbiB0byByZXR1cm4gb2JqZWN0IGxpdGVyYWxzIGZvciBNaXhlZCBkZWZhdWx0cyxcbiAqICAgICAvLyBlYWNoIGRvY3VtZW50IHdpbGwgcmVjZWl2ZSBhIHJlZmVyZW5jZSB0byB0aGUgc2FtZSBvYmplY3QgbGl0ZXJhbCBjcmVhdGluZ1xuICogICAgIC8vIGEgXCJzaGFyZWRcIiBvYmplY3QgaW5zdGFuY2U6XG4gKiAgICAgdmFyIHNjaGVtYSA9IG5ldyBTY2hlbWEoeyBtaXhlZDogU2NoZW1hLlR5cGVzLk1peGVkIH0pO1xuICogICAgIHNjaGVtYS5wYXRoKCdtaXhlZCcpLmRlZmF1bHQoe30pO1xuICogICAgIHZhciBNID0gZGIubW9kZWwoJ00nLCBzY2hlbWEpO1xuICogICAgIHZhciBtMSA9IG5ldyBNO1xuICogICAgIG0xLm1peGVkLmFkZGVkID0gMTtcbiAqICAgICBjb25zb2xlLmxvZyhtMS5taXhlZCk7IC8vIHsgYWRkZWQ6IDEgfVxuICogICAgIHZhciBtMiA9IG5ldyBNO1xuICogICAgIGNvbnNvbGUubG9nKG0yLm1peGVkKTsgLy8geyBhZGRlZDogMSB9XG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbnxhbnl9IHZhbCB0aGUgZGVmYXVsdCB2YWx1ZVxuICogQHJldHVybiB7ZGVmYXVsdFZhbHVlfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuU2NoZW1hVHlwZS5wcm90b3R5cGUuZGVmYXVsdCA9IGZ1bmN0aW9uICh2YWwpIHtcbiAgaWYgKDEgPT09IGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICB0aGlzLmRlZmF1bHRWYWx1ZSA9IHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbidcbiAgICAgID8gdmFsXG4gICAgICA6IHRoaXMuY2FzdCggdmFsICk7XG5cbiAgICByZXR1cm4gdGhpcztcblxuICB9IGVsc2UgaWYgKCBhcmd1bWVudHMubGVuZ3RoID4gMSApIHtcbiAgICB0aGlzLmRlZmF1bHRWYWx1ZSA9IF8udG9BcnJheSggYXJndW1lbnRzICk7XG4gIH1cbiAgcmV0dXJuIHRoaXMuZGVmYXVsdFZhbHVlO1xufTtcblxuLyoqXG4gKiBBZGRzIGEgc2V0dGVyIHRvIHRoaXMgc2NoZW1hdHlwZS5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgZnVuY3Rpb24gY2FwaXRhbGl6ZSAodmFsKSB7XG4gKiAgICAgICBpZiAoJ3N0cmluZycgIT0gdHlwZW9mIHZhbCkgdmFsID0gJyc7XG4gKiAgICAgICByZXR1cm4gdmFsLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgdmFsLnN1YnN0cmluZygxKTtcbiAqICAgICB9XG4gKlxuICogICAgIC8vIGRlZmluaW5nIHdpdGhpbiB0aGUgc2NoZW1hXG4gKiAgICAgdmFyIHMgPSBuZXcgU2NoZW1hKHsgbmFtZTogeyB0eXBlOiBTdHJpbmcsIHNldDogY2FwaXRhbGl6ZSB9fSlcbiAqXG4gKiAgICAgLy8gb3IgYnkgcmV0cmVpdmluZyBpdHMgU2NoZW1hVHlwZVxuICogICAgIHZhciBzID0gbmV3IFNjaGVtYSh7IG5hbWU6IFN0cmluZyB9KVxuICogICAgIHMucGF0aCgnbmFtZScpLnNldChjYXBpdGFsaXplKVxuICpcbiAqIFNldHRlcnMgYWxsb3cgeW91IHRvIHRyYW5zZm9ybSB0aGUgZGF0YSBiZWZvcmUgaXQgZ2V0cyB0byB0aGUgcmF3IG1vbmdvZGIgZG9jdW1lbnQgYW5kIGlzIHNldCBhcyBhIHZhbHVlIG9uIGFuIGFjdHVhbCBrZXkuXG4gKlxuICogU3VwcG9zZSB5b3UgYXJlIGltcGxlbWVudGluZyB1c2VyIHJlZ2lzdHJhdGlvbiBmb3IgYSB3ZWJzaXRlLiBVc2VycyBwcm92aWRlIGFuIGVtYWlsIGFuZCBwYXNzd29yZCwgd2hpY2ggZ2V0cyBzYXZlZCB0byBtb25nb2RiLiBUaGUgZW1haWwgaXMgYSBzdHJpbmcgdGhhdCB5b3Ugd2lsbCB3YW50IHRvIG5vcm1hbGl6ZSB0byBsb3dlciBjYXNlLCBpbiBvcmRlciB0byBhdm9pZCBvbmUgZW1haWwgaGF2aW5nIG1vcmUgdGhhbiBvbmUgYWNjb3VudCAtLSBlLmcuLCBvdGhlcndpc2UsIGF2ZW51ZUBxLmNvbSBjYW4gYmUgcmVnaXN0ZXJlZCBmb3IgMiBhY2NvdW50cyB2aWEgYXZlbnVlQHEuY29tIGFuZCBBdkVuVWVAUS5Db00uXG4gKlxuICogWW91IGNhbiBzZXQgdXAgZW1haWwgbG93ZXIgY2FzZSBub3JtYWxpemF0aW9uIGVhc2lseSB2aWEgYSBTdG9yYWdlIHNldHRlci5cbiAqXG4gKiAgICAgZnVuY3Rpb24gdG9Mb3dlciAodikge1xuICogICAgICAgcmV0dXJuIHYudG9Mb3dlckNhc2UoKTtcbiAqICAgICB9XG4gKlxuICogICAgIHZhciBVc2VyU2NoZW1hID0gbmV3IFNjaGVtYSh7XG4gKiAgICAgICBlbWFpbDogeyB0eXBlOiBTdHJpbmcsIHNldDogdG9Mb3dlciB9XG4gKiAgICAgfSlcbiAqXG4gKiAgICAgdmFyIFVzZXIgPSBkYi5tb2RlbCgnVXNlcicsIFVzZXJTY2hlbWEpXG4gKlxuICogICAgIHZhciB1c2VyID0gbmV3IFVzZXIoe2VtYWlsOiAnQVZFTlVFQFEuQ09NJ30pXG4gKiAgICAgY29uc29sZS5sb2codXNlci5lbWFpbCk7IC8vICdhdmVudWVAcS5jb20nXG4gKlxuICogICAgIC8vIG9yXG4gKiAgICAgdmFyIHVzZXIgPSBuZXcgVXNlclxuICogICAgIHVzZXIuZW1haWwgPSAnQXZlbnVlQFEuY29tJ1xuICogICAgIGNvbnNvbGUubG9nKHVzZXIuZW1haWwpIC8vICdhdmVudWVAcS5jb20nXG4gKlxuICogQXMgeW91IGNhbiBzZWUgYWJvdmUsIHNldHRlcnMgYWxsb3cgeW91IHRvIHRyYW5zZm9ybSB0aGUgZGF0YSBiZWZvcmUgaXQgZ2V0cyB0byB0aGUgcmF3IG1vbmdvZGIgZG9jdW1lbnQgYW5kIGlzIHNldCBhcyBhIHZhbHVlIG9uIGFuIGFjdHVhbCBrZXkuXG4gKlxuICogX05PVEU6IHdlIGNvdWxkIGhhdmUgYWxzbyBqdXN0IHVzZWQgdGhlIGJ1aWx0LWluIGBsb3dlcmNhc2U6IHRydWVgIFNjaGVtYVR5cGUgb3B0aW9uIGluc3RlYWQgb2YgZGVmaW5pbmcgb3VyIG93biBmdW5jdGlvbi5fXG4gKlxuICogICAgIG5ldyBTY2hlbWEoeyBlbWFpbDogeyB0eXBlOiBTdHJpbmcsIGxvd2VyY2FzZTogdHJ1ZSB9fSlcbiAqXG4gKiBTZXR0ZXJzIGFyZSBhbHNvIHBhc3NlZCBhIHNlY29uZCBhcmd1bWVudCwgdGhlIHNjaGVtYXR5cGUgb24gd2hpY2ggdGhlIHNldHRlciB3YXMgZGVmaW5lZC4gVGhpcyBhbGxvd3MgZm9yIHRhaWxvcmVkIGJlaGF2aW9yIGJhc2VkIG9uIG9wdGlvbnMgcGFzc2VkIGluIHRoZSBzY2hlbWEuXG4gKlxuICogICAgIGZ1bmN0aW9uIGluc3BlY3RvciAodmFsLCBzY2hlbWF0eXBlKSB7XG4gKiAgICAgICBpZiAoc2NoZW1hdHlwZS5vcHRpb25zLnJlcXVpcmVkKSB7XG4gKiAgICAgICAgIHJldHVybiBzY2hlbWF0eXBlLnBhdGggKyAnIGlzIHJlcXVpcmVkJztcbiAqICAgICAgIH0gZWxzZSB7XG4gKiAgICAgICAgIHJldHVybiB2YWw7XG4gKiAgICAgICB9XG4gKiAgICAgfVxuICpcbiAqICAgICB2YXIgVmlydXNTY2hlbWEgPSBuZXcgU2NoZW1hKHtcbiAqICAgICAgIG5hbWU6IHsgdHlwZTogU3RyaW5nLCByZXF1aXJlZDogdHJ1ZSwgc2V0OiBpbnNwZWN0b3IgfSxcbiAqICAgICAgIHRheG9ub215OiB7IHR5cGU6IFN0cmluZywgc2V0OiBpbnNwZWN0b3IgfVxuICogICAgIH0pXG4gKlxuICogICAgIHZhciBWaXJ1cyA9IGRiLm1vZGVsKCdWaXJ1cycsIFZpcnVzU2NoZW1hKTtcbiAqICAgICB2YXIgdiA9IG5ldyBWaXJ1cyh7IG5hbWU6ICdQYXJ2b3ZpcmlkYWUnLCB0YXhvbm9teTogJ1BhcnZvdmlyaW5hZScgfSk7XG4gKlxuICogICAgIGNvbnNvbGUubG9nKHYubmFtZSk7ICAgICAvLyBuYW1lIGlzIHJlcXVpcmVkXG4gKiAgICAgY29uc29sZS5sb2codi50YXhvbm9teSk7IC8vIFBhcnZvdmlyaW5hZVxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKiBAcmV0dXJuIHtTY2hlbWFUeXBlfSB0aGlzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWFUeXBlLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAoZm4pIHtcbiAgaWYgKCdmdW5jdGlvbicgIT0gdHlwZW9mIGZuKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0Egc2V0dGVyIG11c3QgYmUgYSBmdW5jdGlvbi4nKTtcbiAgdGhpcy5zZXR0ZXJzLnB1c2goZm4pO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQWRkcyBhIGdldHRlciB0byB0aGlzIHNjaGVtYXR5cGUuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIGZ1bmN0aW9uIGRvYiAodmFsKSB7XG4gKiAgICAgICBpZiAoIXZhbCkgcmV0dXJuIHZhbDtcbiAqICAgICAgIHJldHVybiAodmFsLmdldE1vbnRoKCkgKyAxKSArIFwiL1wiICsgdmFsLmdldERhdGUoKSArIFwiL1wiICsgdmFsLmdldEZ1bGxZZWFyKCk7XG4gKiAgICAgfVxuICpcbiAqICAgICAvLyBkZWZpbmluZyB3aXRoaW4gdGhlIHNjaGVtYVxuICogICAgIHZhciBzID0gbmV3IFNjaGVtYSh7IGJvcm46IHsgdHlwZTogRGF0ZSwgZ2V0OiBkb2IgfSlcbiAqXG4gKiAgICAgLy8gb3IgYnkgcmV0cmVpdmluZyBpdHMgU2NoZW1hVHlwZVxuICogICAgIHZhciBzID0gbmV3IFNjaGVtYSh7IGJvcm46IERhdGUgfSlcbiAqICAgICBzLnBhdGgoJ2Jvcm4nKS5nZXQoZG9iKVxuICpcbiAqIEdldHRlcnMgYWxsb3cgeW91IHRvIHRyYW5zZm9ybSB0aGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIGRhdGEgYXMgaXQgdHJhdmVscyBmcm9tIHRoZSByYXcgbW9uZ29kYiBkb2N1bWVudCB0byB0aGUgdmFsdWUgdGhhdCB5b3Ugc2VlLlxuICpcbiAqIFN1cHBvc2UgeW91IGFyZSBzdG9yaW5nIGNyZWRpdCBjYXJkIG51bWJlcnMgYW5kIHlvdSB3YW50IHRvIGhpZGUgZXZlcnl0aGluZyBleGNlcHQgdGhlIGxhc3QgNCBkaWdpdHMgdG8gdGhlIG1vbmdvb3NlIHVzZXIuIFlvdSBjYW4gZG8gc28gYnkgZGVmaW5pbmcgYSBnZXR0ZXIgaW4gdGhlIGZvbGxvd2luZyB3YXk6XG4gKlxuICogICAgIGZ1bmN0aW9uIG9iZnVzY2F0ZSAoY2MpIHtcbiAqICAgICAgIHJldHVybiAnKioqKi0qKioqLSoqKiotJyArIGNjLnNsaWNlKGNjLmxlbmd0aC00LCBjYy5sZW5ndGgpO1xuICogICAgIH1cbiAqXG4gKiAgICAgdmFyIEFjY291bnRTY2hlbWEgPSBuZXcgU2NoZW1hKHtcbiAqICAgICAgIGNyZWRpdENhcmROdW1iZXI6IHsgdHlwZTogU3RyaW5nLCBnZXQ6IG9iZnVzY2F0ZSB9XG4gKiAgICAgfSk7XG4gKlxuICogICAgIHZhciBBY2NvdW50ID0gZGIubW9kZWwoJ0FjY291bnQnLCBBY2NvdW50U2NoZW1hKTtcbiAqXG4gKiAgICAgQWNjb3VudC5maW5kQnlJZChpZCwgZnVuY3Rpb24gKGVyciwgZm91bmQpIHtcbiAqICAgICAgIGNvbnNvbGUubG9nKGZvdW5kLmNyZWRpdENhcmROdW1iZXIpOyAvLyAnKioqKi0qKioqLSoqKiotMTIzNCdcbiAqICAgICB9KTtcbiAqXG4gKiBHZXR0ZXJzIGFyZSBhbHNvIHBhc3NlZCBhIHNlY29uZCBhcmd1bWVudCwgdGhlIHNjaGVtYXR5cGUgb24gd2hpY2ggdGhlIGdldHRlciB3YXMgZGVmaW5lZC4gVGhpcyBhbGxvd3MgZm9yIHRhaWxvcmVkIGJlaGF2aW9yIGJhc2VkIG9uIG9wdGlvbnMgcGFzc2VkIGluIHRoZSBzY2hlbWEuXG4gKlxuICogICAgIGZ1bmN0aW9uIGluc3BlY3RvciAodmFsLCBzY2hlbWF0eXBlKSB7XG4gKiAgICAgICBpZiAoc2NoZW1hdHlwZS5vcHRpb25zLnJlcXVpcmVkKSB7XG4gKiAgICAgICAgIHJldHVybiBzY2hlbWF0eXBlLnBhdGggKyAnIGlzIHJlcXVpcmVkJztcbiAqICAgICAgIH0gZWxzZSB7XG4gKiAgICAgICAgIHJldHVybiBzY2hlbWF0eXBlLnBhdGggKyAnIGlzIG5vdCc7XG4gKiAgICAgICB9XG4gKiAgICAgfVxuICpcbiAqICAgICB2YXIgVmlydXNTY2hlbWEgPSBuZXcgU2NoZW1hKHtcbiAqICAgICAgIG5hbWU6IHsgdHlwZTogU3RyaW5nLCByZXF1aXJlZDogdHJ1ZSwgZ2V0OiBpbnNwZWN0b3IgfSxcbiAqICAgICAgIHRheG9ub215OiB7IHR5cGU6IFN0cmluZywgZ2V0OiBpbnNwZWN0b3IgfVxuICogICAgIH0pXG4gKlxuICogICAgIHZhciBWaXJ1cyA9IGRiLm1vZGVsKCdWaXJ1cycsIFZpcnVzU2NoZW1hKTtcbiAqXG4gKiAgICAgVmlydXMuZmluZEJ5SWQoaWQsIGZ1bmN0aW9uIChlcnIsIHZpcnVzKSB7XG4gKiAgICAgICBjb25zb2xlLmxvZyh2aXJ1cy5uYW1lKTsgICAgIC8vIG5hbWUgaXMgcmVxdWlyZWRcbiAqICAgICAgIGNvbnNvbGUubG9nKHZpcnVzLnRheG9ub215KTsgLy8gdGF4b25vbXkgaXMgbm90XG4gKiAgICAgfSlcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7U2NoZW1hVHlwZX0gdGhpc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuU2NoZW1hVHlwZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGZuKSB7XG4gIGlmICgnZnVuY3Rpb24nICE9IHR5cGVvZiBmbilcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBIGdldHRlciBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gIHRoaXMuZ2V0dGVycy5wdXNoKGZuKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEFkZHMgdmFsaWRhdG9yKHMpIGZvciB0aGlzIGRvY3VtZW50IHBhdGguXG4gKlxuICogVmFsaWRhdG9ycyBhbHdheXMgcmVjZWl2ZSB0aGUgdmFsdWUgdG8gdmFsaWRhdGUgYXMgdGhlaXIgZmlyc3QgYXJndW1lbnQgYW5kIG11c3QgcmV0dXJuIGBCb29sZWFuYC4gUmV0dXJuaW5nIGBmYWxzZWAgbWVhbnMgdmFsaWRhdGlvbiBmYWlsZWQuXG4gKlxuICogVGhlIGVycm9yIG1lc3NhZ2UgYXJndW1lbnQgaXMgb3B0aW9uYWwuIElmIG5vdCBwYXNzZWQsIHRoZSBbZGVmYXVsdCBnZW5lcmljIGVycm9yIG1lc3NhZ2UgdGVtcGxhdGVdKCNlcnJvcl9tZXNzYWdlc19TdG9yYWdlRXJyb3ItbWVzc2FnZXMpIHdpbGwgYmUgdXNlZC5cbiAqXG4gKiAjIyMjRXhhbXBsZXM6XG4gKlxuICogICAgIC8vIG1ha2Ugc3VyZSBldmVyeSB2YWx1ZSBpcyBlcXVhbCB0byBcInNvbWV0aGluZ1wiXG4gKiAgICAgZnVuY3Rpb24gdmFsaWRhdG9yICh2YWwpIHtcbiAqICAgICAgIHJldHVybiB2YWwgPT0gJ3NvbWV0aGluZyc7XG4gKiAgICAgfVxuICogICAgIG5ldyBTY2hlbWEoeyBuYW1lOiB7IHR5cGU6IFN0cmluZywgdmFsaWRhdGU6IHZhbGlkYXRvciB9fSk7XG4gKlxuICogICAgIC8vIHdpdGggYSBjdXN0b20gZXJyb3IgbWVzc2FnZVxuICpcbiAqICAgICB2YXIgY3VzdG9tID0gW3ZhbGlkYXRvciwgJ1VoIG9oLCB7UEFUSH0gZG9lcyBub3QgZXF1YWwgXCJzb21ldGhpbmdcIi4nXVxuICogICAgIG5ldyBTY2hlbWEoeyBuYW1lOiB7IHR5cGU6IFN0cmluZywgdmFsaWRhdGU6IGN1c3RvbSB9fSk7XG4gKlxuICogICAgIC8vIGFkZGluZyBtYW55IHZhbGlkYXRvcnMgYXQgYSB0aW1lXG4gKlxuICogICAgIHZhciBtYW55ID0gW1xuICogICAgICAgICB7IHZhbGlkYXRvcjogdmFsaWRhdG9yLCBtc2c6ICd1aCBvaCcgfVxuICogICAgICAgLCB7IHZhbGlkYXRvcjogYW5vdGhlclZhbGlkYXRvciwgbXNnOiAnZmFpbGVkJyB9XG4gKiAgICAgXVxuICogICAgIG5ldyBTY2hlbWEoeyBuYW1lOiB7IHR5cGU6IFN0cmluZywgdmFsaWRhdGU6IG1hbnkgfX0pO1xuICpcbiAqICAgICAvLyBvciB1dGlsaXppbmcgU2NoZW1hVHlwZSBtZXRob2RzIGRpcmVjdGx5OlxuICpcbiAqICAgICB2YXIgc2NoZW1hID0gbmV3IFNjaGVtYSh7IG5hbWU6ICdzdHJpbmcnIH0pO1xuICogICAgIHNjaGVtYS5wYXRoKCduYW1lJykudmFsaWRhdGUodmFsaWRhdG9yLCAndmFsaWRhdGlvbiBvZiBge1BBVEh9YCBmYWlsZWQgd2l0aCB2YWx1ZSBge1ZBTFVFfWAnKTtcbiAqXG4gKiAjIyMjRXJyb3IgbWVzc2FnZSB0ZW1wbGF0ZXM6XG4gKlxuICogRnJvbSB0aGUgZXhhbXBsZXMgYWJvdmUsIHlvdSBtYXkgaGF2ZSBub3RpY2VkIHRoYXQgZXJyb3IgbWVzc2FnZXMgc3VwcG9ydCBiYXNlaWMgdGVtcGxhdGluZy4gVGhlcmUgYXJlIGEgZmV3IG90aGVyIHRlbXBsYXRlIGtleXdvcmRzIGJlc2lkZXMgYHtQQVRIfWAgYW5kIGB7VkFMVUV9YCB0b28uIFRvIGZpbmQgb3V0IG1vcmUsIGRldGFpbHMgYXJlIGF2YWlsYWJsZSBbaGVyZV0oI2Vycm9yX21lc3NhZ2VzX1N0b3JhZ2VFcnJvci1tZXNzYWdlcylcbiAqXG4gKiAjIyMjQXN5bmNocm9ub3VzIHZhbGlkYXRpb246XG4gKlxuICogUGFzc2luZyBhIHZhbGlkYXRvciBmdW5jdGlvbiB0aGF0IHJlY2VpdmVzIHR3byBhcmd1bWVudHMgdGVsbHMgbW9uZ29vc2UgdGhhdCB0aGUgdmFsaWRhdG9yIGlzIGFuIGFzeW5jaHJvbm91cyB2YWxpZGF0b3IuIFRoZSBmaXJzdCBhcmd1bWVudCBwYXNzZWQgdG8gdGhlIHZhbGlkYXRvciBmdW5jdGlvbiBpcyB0aGUgdmFsdWUgYmVpbmcgdmFsaWRhdGVkLiBUaGUgc2Vjb25kIGFyZ3VtZW50IGlzIGEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCBtdXN0IGNhbGxlZCB3aGVuIHlvdSBmaW5pc2ggdmFsaWRhdGluZyB0aGUgdmFsdWUgYW5kIHBhc3NlZCBlaXRoZXIgYHRydWVgIG9yIGBmYWxzZWAgdG8gY29tbXVuaWNhdGUgZWl0aGVyIHN1Y2Nlc3Mgb3IgZmFpbHVyZSByZXNwZWN0aXZlbHkuXG4gKlxuICogICAgIHNjaGVtYS5wYXRoKCduYW1lJykudmFsaWRhdGUoZnVuY3Rpb24gKHZhbHVlLCByZXNwb25kKSB7XG4gKiAgICAgICBkb1N0dWZmKHZhbHVlLCBmdW5jdGlvbiAoKSB7XG4gKiAgICAgICAgIC4uLlxuICogICAgICAgICByZXNwb25kKGZhbHNlKTsgLy8gdmFsaWRhdGlvbiBmYWlsZWRcbiAqICAgICAgIH0pXG4qICAgICAgfSwgJ3tQQVRIfSBmYWlsZWQgdmFsaWRhdGlvbi4nKTtcbipcbiAqIFlvdSBtaWdodCB1c2UgYXN5bmNocm9ub3VzIHZhbGlkYXRvcnMgdG8gcmV0cmVpdmUgb3RoZXIgZG9jdW1lbnRzIGZyb20gdGhlIGRhdGFiYXNlIHRvIHZhbGlkYXRlIGFnYWluc3Qgb3IgdG8gbWVldCBvdGhlciBJL08gYm91bmQgdmFsaWRhdGlvbiBuZWVkcy5cbiAqXG4gKiBWYWxpZGF0aW9uIG9jY3VycyBgcHJlKCdzYXZlJylgIG9yIHdoZW5ldmVyIHlvdSBtYW51YWxseSBleGVjdXRlIFtkb2N1bWVudCN2YWxpZGF0ZV0oI2RvY3VtZW50X0RvY3VtZW50LXZhbGlkYXRlKS5cbiAqXG4gKiBJZiB2YWxpZGF0aW9uIGZhaWxzIGR1cmluZyBgcHJlKCdzYXZlJylgIGFuZCBubyBjYWxsYmFjayB3YXMgcGFzc2VkIHRvIHJlY2VpdmUgdGhlIGVycm9yLCBhbiBgZXJyb3JgIGV2ZW50IHdpbGwgYmUgZW1pdHRlZCBvbiB5b3VyIE1vZGVscyBhc3NvY2lhdGVkIGRiIFtjb25uZWN0aW9uXSgjY29ubmVjdGlvbl9Db25uZWN0aW9uKSwgcGFzc2luZyB0aGUgdmFsaWRhdGlvbiBlcnJvciBvYmplY3QgYWxvbmcuXG4gKlxuICogICAgIHZhciBjb25uID0gbW9uZ29vc2UuY3JlYXRlQ29ubmVjdGlvbiguLik7XG4gKiAgICAgY29ubi5vbignZXJyb3InLCBoYW5kbGVFcnJvcik7XG4gKlxuICogICAgIHZhciBQcm9kdWN0ID0gY29ubi5tb2RlbCgnUHJvZHVjdCcsIHlvdXJTY2hlbWEpO1xuICogICAgIHZhciBkdmQgPSBuZXcgUHJvZHVjdCguLik7XG4gKiAgICAgZHZkLnNhdmUoKTsgLy8gZW1pdHMgZXJyb3Igb24gdGhlIGBjb25uYCBhYm92ZVxuICpcbiAqIElmIHlvdSBkZXNpcmUgaGFuZGxpbmcgdGhlc2UgZXJyb3JzIGF0IHRoZSBNb2RlbCBsZXZlbCwgYXR0YWNoIGFuIGBlcnJvcmAgbGlzdGVuZXIgdG8geW91ciBNb2RlbCBhbmQgdGhlIGV2ZW50IHdpbGwgaW5zdGVhZCBiZSBlbWl0dGVkIHRoZXJlLlxuICpcbiAqICAgICAvLyByZWdpc3RlcmluZyBhbiBlcnJvciBsaXN0ZW5lciBvbiB0aGUgTW9kZWwgbGV0cyB1cyBoYW5kbGUgZXJyb3JzIG1vcmUgbG9jYWxseVxuICogICAgIFByb2R1Y3Qub24oJ2Vycm9yJywgaGFuZGxlRXJyb3IpO1xuICpcbiAqIEBwYXJhbSB7UmVnRXhwfEZ1bmN0aW9ufE9iamVjdH0gb2JqIHZhbGlkYXRvclxuICogQHBhcmFtIHtTdHJpbmd9IFttZXNzYWdlXSBvcHRpb25hbCBlcnJvciBtZXNzYWdlXG4gKiBAcmV0dXJuIHtTY2hlbWFUeXBlfSB0aGlzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWFUeXBlLnByb3RvdHlwZS52YWxpZGF0ZSA9IGZ1bmN0aW9uIChvYmosIG1lc3NhZ2UsIHR5cGUpIHtcbiAgaWYgKCdmdW5jdGlvbicgPT0gdHlwZW9mIG9iaiB8fCBvYmogJiYgJ1JlZ0V4cCcgPT09IHV0aWxzLmdldEZ1bmN0aW9uTmFtZSggb2JqLmNvbnN0cnVjdG9yICkpIHtcbiAgICBpZiAoIW1lc3NhZ2UpIG1lc3NhZ2UgPSBlcnJvck1lc3NhZ2VzLmdlbmVyYWwuZGVmYXVsdDtcbiAgICBpZiAoIXR5cGUpIHR5cGUgPSAndXNlciBkZWZpbmVkJztcbiAgICB0aGlzLnZhbGlkYXRvcnMucHVzaChbb2JqLCBtZXNzYWdlLCB0eXBlXSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICB2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGhcbiAgICAsIGFyZztcblxuICB3aGlsZSAoaS0tKSB7XG4gICAgYXJnID0gYXJndW1lbnRzW2ldO1xuICAgIGlmICghKGFyZyAmJiAnT2JqZWN0JyA9PSB1dGlscy5nZXRGdW5jdGlvbk5hbWUoIGFyZy5jb25zdHJ1Y3RvciApICkpIHtcbiAgICAgIHZhciBtc2cgPSAnSW52YWxpZCB2YWxpZGF0b3IuIFJlY2VpdmVkICgnICsgdHlwZW9mIGFyZyArICcpICdcbiAgICAgICAgKyBhcmdcbiAgICAgICAgKyAnLiBTZWUgaHR0cDovL21vbmdvb3NlanMuY29tL2RvY3MvYXBpLmh0bWwjc2NoZW1hdHlwZV9TY2hlbWFUeXBlLXZhbGlkYXRlJztcblxuICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gICAgfVxuICAgIHRoaXMudmFsaWRhdGUoYXJnLnZhbGlkYXRvciwgYXJnLm1zZywgYXJnLnR5cGUpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEFkZHMgYSByZXF1aXJlZCB2YWxpZGF0b3IgdG8gdGhpcyBzY2hlbWF0eXBlLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgcyA9IG5ldyBTY2hlbWEoeyBib3JuOiB7IHR5cGU6IERhdGUsIHJlcXVpcmVkOiB0cnVlIH0pXG4gKlxuICogICAgIC8vIG9yIHdpdGggY3VzdG9tIGVycm9yIG1lc3NhZ2VcbiAqXG4gKiAgICAgdmFyIHMgPSBuZXcgU2NoZW1hKHsgYm9ybjogeyB0eXBlOiBEYXRlLCByZXF1aXJlZDogJ3tQQVRIfSBpcyByZXF1aXJlZCEnIH0pXG4gKlxuICogICAgIC8vIG9yIHRocm91Z2ggdGhlIHBhdGggQVBJXG4gKlxuICogICAgIFNjaGVtYS5wYXRoKCduYW1lJykucmVxdWlyZWQodHJ1ZSk7XG4gKlxuICogICAgIC8vIHdpdGggY3VzdG9tIGVycm9yIG1lc3NhZ2luZ1xuICpcbiAqICAgICBTY2hlbWEucGF0aCgnbmFtZScpLnJlcXVpcmVkKHRydWUsICdncnJyIDooICcpO1xuICpcbiAqXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHJlcXVpcmVkIGVuYWJsZS9kaXNhYmxlIHRoZSB2YWxpZGF0b3JcbiAqIEBwYXJhbSB7U3RyaW5nfSBbbWVzc2FnZV0gb3B0aW9uYWwgY3VzdG9tIGVycm9yIG1lc3NhZ2VcbiAqIEByZXR1cm4ge1NjaGVtYVR5cGV9IHRoaXNcbiAqIEBzZWUgQ3VzdG9taXplZCBFcnJvciBNZXNzYWdlcyAjZXJyb3JfbWVzc2FnZXNfU3RvcmFnZUVycm9yLW1lc3NhZ2VzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5TY2hlbWFUeXBlLnByb3RvdHlwZS5yZXF1aXJlZCA9IGZ1bmN0aW9uIChyZXF1aXJlZCwgbWVzc2FnZSkge1xuICBpZiAoZmFsc2UgPT09IHJlcXVpcmVkKSB7XG4gICAgdGhpcy52YWxpZGF0b3JzID0gdGhpcy52YWxpZGF0b3JzLmZpbHRlcihmdW5jdGlvbiAodikge1xuICAgICAgcmV0dXJuIHZbMF0gIT0gdGhpcy5yZXF1aXJlZFZhbGlkYXRvcjtcbiAgICB9LCB0aGlzKTtcblxuICAgIHRoaXMuaXNSZXF1aXJlZCA9IGZhbHNlO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLmlzUmVxdWlyZWQgPSB0cnVlO1xuXG4gIHRoaXMucmVxdWlyZWRWYWxpZGF0b3IgPSBmdW5jdGlvbiAodikge1xuICAgIC8vIGluIGhlcmUsIGB0aGlzYCByZWZlcnMgdG8gdGhlIHZhbGlkYXRpbmcgZG9jdW1lbnQuXG4gICAgLy8gbm8gdmFsaWRhdGlvbiB3aGVuIHRoaXMgcGF0aCB3YXNuJ3Qgc2VsZWN0ZWQgaW4gdGhlIHF1ZXJ5LlxuICAgIGlmICh0aGlzICE9PSB1bmRlZmluZWQgJiYgLy8g0YHQv9C10YbQuNCw0LvRjNC90LDRjyDQv9GA0L7QstC10YDQutCwINC40Lct0LfQsCBzdHJpY3QgbW9kZSDQuCDQvtGB0L7QsdC10L3QvdC+0YHRgtC4IC5jYWxsKHVuZGVmaW5lZClcbiAgICAgICAgJ2lzU2VsZWN0ZWQnIGluIHRoaXMgJiZcbiAgICAgICAgIXRoaXMuaXNTZWxlY3RlZChzZWxmLnBhdGgpICYmXG4gICAgICAgICF0aGlzLmlzTW9kaWZpZWQoc2VsZi5wYXRoKSkgcmV0dXJuIHRydWU7XG5cbiAgICByZXR1cm4gc2VsZi5jaGVja1JlcXVpcmVkKHYsIHRoaXMpO1xuICB9O1xuXG4gIGlmICgnc3RyaW5nJyA9PSB0eXBlb2YgcmVxdWlyZWQpIHtcbiAgICBtZXNzYWdlID0gcmVxdWlyZWQ7XG4gICAgcmVxdWlyZWQgPSB1bmRlZmluZWQ7XG4gIH1cblxuICB2YXIgbXNnID0gbWVzc2FnZSB8fCBlcnJvck1lc3NhZ2VzLmdlbmVyYWwucmVxdWlyZWQ7XG4gIHRoaXMudmFsaWRhdG9ycy5wdXNoKFt0aGlzLnJlcXVpcmVkVmFsaWRhdG9yLCBtc2csICdyZXF1aXJlZCddKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cblxuLyoqXG4gKiBHZXRzIHRoZSBkZWZhdWx0IHZhbHVlXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHNjb3BlIHRoZSBzY29wZSB3aGljaCBjYWxsYmFjayBhcmUgZXhlY3V0ZWRcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gaW5pdFxuICogQGFwaSBwcml2YXRlXG4gKi9cblNjaGVtYVR5cGUucHJvdG90eXBlLmdldERlZmF1bHQgPSBmdW5jdGlvbiAoc2NvcGUsIGluaXQpIHtcbiAgdmFyIHJldCA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiB0aGlzLmRlZmF1bHRWYWx1ZVxuICAgID8gdGhpcy5kZWZhdWx0VmFsdWUuY2FsbChzY29wZSlcbiAgICA6IHRoaXMuZGVmYXVsdFZhbHVlO1xuXG4gIGlmIChudWxsICE9PSByZXQgJiYgdW5kZWZpbmVkICE9PSByZXQpIHtcbiAgICByZXR1cm4gdGhpcy5jYXN0KHJldCwgc2NvcGUsIGluaXQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiByZXQ7XG4gIH1cbn07XG5cbi8qKlxuICogQXBwbGllcyBzZXR0ZXJzXG4gKlxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICogQHBhcmFtIHtPYmplY3R9IHNjb3BlXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGluaXRcbiAqIEBwYXJhbSB7Kn0gcHJpb3JWYWxcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cblNjaGVtYVR5cGUucHJvdG90eXBlLmFwcGx5U2V0dGVycyA9IGZ1bmN0aW9uICh2YWx1ZSwgc2NvcGUsIGluaXQsIHByaW9yVmFsKSB7XG4gIGlmIChTY2hlbWFUeXBlLl9pc1JlZiggdGhpcywgdmFsdWUgKSkge1xuICAgIHJldHVybiBpbml0XG4gICAgICA/IHZhbHVlXG4gICAgICA6IHRoaXMuY2FzdCh2YWx1ZSwgc2NvcGUsIGluaXQsIHByaW9yVmFsKTtcbiAgfVxuXG4gIHZhciB2ID0gdmFsdWVcbiAgICAsIHNldHRlcnMgPSB0aGlzLnNldHRlcnNcbiAgICAsIGxlbiA9IHNldHRlcnMubGVuZ3RoXG4gICAgLCBjYXN0ZXIgPSB0aGlzLmNhc3RlcjtcblxuICBpZiAoQXJyYXkuaXNBcnJheSh2KSAmJiBjYXN0ZXIgJiYgY2FzdGVyLnNldHRlcnMpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHYubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZbaV0gPSBjYXN0ZXIuYXBwbHlTZXR0ZXJzKHZbaV0sIHNjb3BlLCBpbml0LCBwcmlvclZhbCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCFsZW4pIHtcbiAgICBpZiAobnVsbCA9PT0gdiB8fCB1bmRlZmluZWQgPT09IHYpIHJldHVybiB2O1xuICAgIHJldHVybiB0aGlzLmNhc3Qodiwgc2NvcGUsIGluaXQsIHByaW9yVmFsKTtcbiAgfVxuXG4gIHdoaWxlIChsZW4tLSkge1xuICAgIHYgPSBzZXR0ZXJzW2xlbl0uY2FsbChzY29wZSwgdiwgdGhpcyk7XG4gIH1cblxuICBpZiAobnVsbCA9PT0gdiB8fCB1bmRlZmluZWQgPT09IHYpIHJldHVybiB2O1xuXG4gIC8vIGRvIG5vdCBjYXN0IHVudGlsIGFsbCBzZXR0ZXJzIGFyZSBhcHBsaWVkICM2NjVcbiAgdiA9IHRoaXMuY2FzdCh2LCBzY29wZSwgaW5pdCwgcHJpb3JWYWwpO1xuXG4gIHJldHVybiB2O1xufTtcblxuLyoqXG4gKiBBcHBsaWVzIGdldHRlcnMgdG8gYSB2YWx1ZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICogQHBhcmFtIHtPYmplY3R9IHNjb3BlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuU2NoZW1hVHlwZS5wcm90b3R5cGUuYXBwbHlHZXR0ZXJzID0gZnVuY3Rpb24oIHZhbHVlLCBzY29wZSApe1xuICBpZiAoIFNjaGVtYVR5cGUuX2lzUmVmKCB0aGlzLCB2YWx1ZSApICkgcmV0dXJuIHZhbHVlO1xuXG4gIHZhciB2ID0gdmFsdWVcbiAgICAsIGdldHRlcnMgPSB0aGlzLmdldHRlcnNcbiAgICAsIGxlbiA9IGdldHRlcnMubGVuZ3RoO1xuXG4gIGlmICggIWxlbiApIHtcbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIHdoaWxlICggbGVuLS0gKSB7XG4gICAgdiA9IGdldHRlcnNbIGxlbiBdLmNhbGwoc2NvcGUsIHYsIHRoaXMpO1xuICB9XG5cbiAgcmV0dXJuIHY7XG59O1xuXG4vKipcbiAqIFBlcmZvcm1zIGEgdmFsaWRhdGlvbiBvZiBgdmFsdWVgIHVzaW5nIHRoZSB2YWxpZGF0b3JzIGRlY2xhcmVkIGZvciB0aGlzIFNjaGVtYVR5cGUuXG4gKlxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZVxuICogQGFwaSBwcml2YXRlXG4gKi9cblNjaGVtYVR5cGUucHJvdG90eXBlLmRvVmFsaWRhdGUgPSBmdW5jdGlvbiAodmFsdWUsIGNhbGxiYWNrLCBzY29wZSkge1xuICB2YXIgZXJyID0gZmFsc2VcbiAgICAsIHBhdGggPSB0aGlzLnBhdGhcbiAgICAsIGNvdW50ID0gdGhpcy52YWxpZGF0b3JzLmxlbmd0aDtcblxuICBpZiAoIWNvdW50KSByZXR1cm4gY2FsbGJhY2sobnVsbCk7XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGUgKG9rLCBtZXNzYWdlLCB0eXBlLCB2YWwpIHtcbiAgICBpZiAoZXJyKSByZXR1cm47XG4gICAgaWYgKG9rID09PSB1bmRlZmluZWQgfHwgb2spIHtcbiAgICAgIC0tY291bnQgfHwgY2FsbGJhY2sobnVsbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrKGVyciA9IG5ldyBWYWxpZGF0b3JFcnJvcihwYXRoLCBtZXNzYWdlLCB0eXBlLCB2YWwpKTtcbiAgICB9XG4gIH1cblxuICB0aGlzLnZhbGlkYXRvcnMuZm9yRWFjaChmdW5jdGlvbiAodikge1xuICAgIHZhciB2YWxpZGF0b3IgPSB2WzBdXG4gICAgICAsIG1lc3NhZ2UgPSB2WzFdXG4gICAgICAsIHR5cGUgPSB2WzJdO1xuXG4gICAgaWYgKHZhbGlkYXRvciBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgdmFsaWRhdGUodmFsaWRhdG9yLnRlc3QodmFsdWUpLCBtZXNzYWdlLCB0eXBlLCB2YWx1ZSk7XG4gICAgfSBlbHNlIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgdmFsaWRhdG9yKSB7XG4gICAgICBpZiAoMiA9PT0gdmFsaWRhdG9yLmxlbmd0aCkge1xuICAgICAgICB2YWxpZGF0b3IuY2FsbChzY29wZSwgdmFsdWUsIGZ1bmN0aW9uIChvaykge1xuICAgICAgICAgIHZhbGlkYXRlKG9rLCBtZXNzYWdlLCB0eXBlLCB2YWx1ZSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsaWRhdGUodmFsaWRhdG9yLmNhbGwoc2NvcGUsIHZhbHVlKSwgbWVzc2FnZSwgdHlwZSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG59O1xuXG4vKipcbiAqIERldGVybWluZXMgaWYgdmFsdWUgaXMgYSB2YWxpZCBSZWZlcmVuY2UuXG4gKlxuICog0J3QsCDQutC70LjQtdC90YLQtSDQsiDQutCw0YfQtdGB0YLQstC1INGB0YHRi9C70LrQuCDQvNC+0LbQvdC+INGF0YDQsNC90LjRgtGMINC60LDQuiBpZCwg0YLQsNC6INC4INC/0L7Qu9C90YvQtSDQtNC+0LrRg9C80LXQvdGC0YtcbiAqXG4gKiBAcGFyYW0ge1NjaGVtYVR5cGV9IHNlbGZcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5TY2hlbWFUeXBlLl9pc1JlZiA9IGZ1bmN0aW9uKCBzZWxmLCB2YWx1ZSApe1xuICAvLyBmYXN0IHBhdGhcbiAgdmFyIHJlZiA9IHNlbGYub3B0aW9ucyAmJiBzZWxmLm9wdGlvbnMucmVmO1xuXG4gIGlmICggcmVmICkge1xuICAgIGlmICggbnVsbCA9PSB2YWx1ZSApIHJldHVybiB0cnVlO1xuICAgIGlmICggXy5pc09iamVjdCggdmFsdWUgKSApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn07XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBTY2hlbWFUeXBlO1xuXG5TY2hlbWFUeXBlLkNhc3RFcnJvciA9IENhc3RFcnJvcjtcblxuU2NoZW1hVHlwZS5WYWxpZGF0b3JFcnJvciA9IFZhbGlkYXRvckVycm9yO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiFcbiAqIFN0YXRlTWFjaGluZSByZXByZXNlbnRzIGEgbWluaW1hbCBgaW50ZXJmYWNlYCBmb3IgdGhlXG4gKiBjb25zdHJ1Y3RvcnMgaXQgYnVpbGRzIHZpYSBTdGF0ZU1hY2hpbmUuY3RvciguLi4pLlxuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbnZhciBTdGF0ZU1hY2hpbmUgPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIFN0YXRlTWFjaGluZSAoKSB7XG4gIHRoaXMucGF0aHMgPSB7fTtcbiAgdGhpcy5zdGF0ZXMgPSB7fTtcbn07XG5cbi8qIVxuICogU3RhdGVNYWNoaW5lLmN0b3IoJ3N0YXRlMScsICdzdGF0ZTInLCAuLi4pXG4gKiBBIGZhY3RvcnkgbWV0aG9kIGZvciBzdWJjbGFzc2luZyBTdGF0ZU1hY2hpbmUuXG4gKiBUaGUgYXJndW1lbnRzIGFyZSBhIGxpc3Qgb2Ygc3RhdGVzLiBGb3IgZWFjaCBzdGF0ZSxcbiAqIHRoZSBjb25zdHJ1Y3RvcidzIHByb3RvdHlwZSBnZXRzIHN0YXRlIHRyYW5zaXRpb25cbiAqIG1ldGhvZHMgbmFtZWQgYWZ0ZXIgZWFjaCBzdGF0ZS4gVGhlc2UgdHJhbnNpdGlvbiBtZXRob2RzXG4gKiBwbGFjZSB0aGVpciBwYXRoIGFyZ3VtZW50IGludG8gdGhlIGdpdmVuIHN0YXRlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdGF0ZVxuICogQHBhcmFtIHtTdHJpbmd9IFtzdGF0ZV1cbiAqIEByZXR1cm4ge0Z1bmN0aW9ufSBzdWJjbGFzcyBjb25zdHJ1Y3RvclxuICogQHByaXZhdGVcbiAqL1xuXG5TdGF0ZU1hY2hpbmUuY3RvciA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN0YXRlcyA9IF8udG9BcnJheShhcmd1bWVudHMpO1xuXG4gIHZhciBjdG9yID0gZnVuY3Rpb24gKCkge1xuICAgIFN0YXRlTWFjaGluZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIHRoaXMuc3RhdGVOYW1lcyA9IHN0YXRlcztcblxuICAgIHZhciBpID0gc3RhdGVzLmxlbmd0aFxuICAgICAgLCBzdGF0ZTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHN0YXRlID0gc3RhdGVzW2ldO1xuICAgICAgdGhpcy5zdGF0ZXNbc3RhdGVdID0ge307XG4gICAgfVxuICB9O1xuXG4gIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggU3RhdGVNYWNoaW5lLnByb3RvdHlwZSApO1xuICBjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGN0b3I7XG5cbiAgc3RhdGVzLmZvckVhY2goZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgLy8gQ2hhbmdlcyB0aGUgYHBhdGhgJ3Mgc3RhdGUgdG8gYHN0YXRlYC5cbiAgICBjdG9yLnByb3RvdHlwZVtzdGF0ZV0gPSBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgdGhpcy5fY2hhbmdlU3RhdGUocGF0aCwgc3RhdGUpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGN0b3I7XG59O1xuXG4vKiFcbiAqIFRoaXMgZnVuY3Rpb24gaXMgd3JhcHBlZCBieSB0aGUgc3RhdGUgY2hhbmdlIGZ1bmN0aW9uczpcbiAqXG4gKiAtIGByZXF1aXJlKHBhdGgpYFxuICogLSBgbW9kaWZ5KHBhdGgpYFxuICogLSBgaW5pdChwYXRoKWBcbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5TdGF0ZU1hY2hpbmUucHJvdG90eXBlLl9jaGFuZ2VTdGF0ZSA9IGZ1bmN0aW9uIF9jaGFuZ2VTdGF0ZSAocGF0aCwgbmV4dFN0YXRlKSB7XG4gIHZhciBwcmV2QnVja2V0ID0gdGhpcy5zdGF0ZXNbdGhpcy5wYXRoc1twYXRoXV07XG4gIGlmIChwcmV2QnVja2V0KSBkZWxldGUgcHJldkJ1Y2tldFtwYXRoXTtcblxuICB0aGlzLnBhdGhzW3BhdGhdID0gbmV4dFN0YXRlO1xuICB0aGlzLnN0YXRlc1tuZXh0U3RhdGVdW3BhdGhdID0gdHJ1ZTtcbn07XG5cbi8qIVxuICogaWdub3JlXG4gKi9cblxuU3RhdGVNYWNoaW5lLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uIGNsZWFyIChzdGF0ZSkge1xuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuc3RhdGVzW3N0YXRlXSlcbiAgICAsIGkgPSBrZXlzLmxlbmd0aFxuICAgICwgcGF0aDtcblxuICB3aGlsZSAoaS0tKSB7XG4gICAgcGF0aCA9IGtleXNbaV07XG4gICAgZGVsZXRlIHRoaXMuc3RhdGVzW3N0YXRlXVtwYXRoXTtcbiAgICBkZWxldGUgdGhpcy5wYXRoc1twYXRoXTtcbiAgfVxufTtcblxuLyohXG4gKiBDaGVja3MgdG8gc2VlIGlmIGF0IGxlYXN0IG9uZSBwYXRoIGlzIGluIHRoZSBzdGF0ZXMgcGFzc2VkIGluIHZpYSBgYXJndW1lbnRzYFxuICogZS5nLiwgdGhpcy5zb21lKCdyZXF1aXJlZCcsICdpbml0ZWQnKVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdGF0ZSB0aGF0IHdlIHdhbnQgdG8gY2hlY2sgZm9yLlxuICogQHByaXZhdGVcbiAqL1xuXG5TdGF0ZU1hY2hpbmUucHJvdG90eXBlLnNvbWUgPSBmdW5jdGlvbiBzb21lICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgd2hhdCA9IGFyZ3VtZW50cy5sZW5ndGggPyBhcmd1bWVudHMgOiB0aGlzLnN0YXRlTmFtZXM7XG4gIHJldHVybiBBcnJheS5wcm90b3R5cGUuc29tZS5jYWxsKHdoYXQsIGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhzZWxmLnN0YXRlc1tzdGF0ZV0pLmxlbmd0aDtcbiAgfSk7XG59O1xuXG4vKiFcbiAqIFRoaXMgZnVuY3Rpb24gYnVpbGRzIHRoZSBmdW5jdGlvbnMgdGhhdCBnZXQgYXNzaWduZWQgdG8gYGZvckVhY2hgIGFuZCBgbWFwYCxcbiAqIHNpbmNlIGJvdGggb2YgdGhvc2UgbWV0aG9kcyBzaGFyZSBhIGxvdCBvZiB0aGUgc2FtZSBsb2dpYy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gaXRlck1ldGhvZCBpcyBlaXRoZXIgJ2ZvckVhY2gnIG9yICdtYXAnXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cblN0YXRlTWFjaGluZS5wcm90b3R5cGUuX2l0ZXIgPSBmdW5jdGlvbiBfaXRlciAoaXRlck1ldGhvZCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHZhciBudW1BcmdzID0gYXJndW1lbnRzLmxlbmd0aFxuICAgICAgLCBzdGF0ZXMgPSBfLnRvQXJyYXkoYXJndW1lbnRzKS5zbGljZSgwLCBudW1BcmdzLTEpXG4gICAgICAsIGNhbGxiYWNrID0gYXJndW1lbnRzW251bUFyZ3MtMV07XG5cbiAgICBpZiAoIXN0YXRlcy5sZW5ndGgpIHN0YXRlcyA9IHRoaXMuc3RhdGVOYW1lcztcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBwYXRocyA9IHN0YXRlcy5yZWR1Y2UoZnVuY3Rpb24gKHBhdGhzLCBzdGF0ZSkge1xuICAgICAgcmV0dXJuIHBhdGhzLmNvbmNhdChPYmplY3Qua2V5cyhzZWxmLnN0YXRlc1tzdGF0ZV0pKTtcbiAgICB9LCBbXSk7XG5cbiAgICByZXR1cm4gcGF0aHNbaXRlck1ldGhvZF0oZnVuY3Rpb24gKHBhdGgsIGksIHBhdGhzKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2socGF0aCwgaSwgcGF0aHMpO1xuICAgIH0pO1xuICB9O1xufTtcblxuLyohXG4gKiBJdGVyYXRlcyBvdmVyIHRoZSBwYXRocyB0aGF0IGJlbG9uZyB0byBvbmUgb2YgdGhlIHBhcmFtZXRlciBzdGF0ZXMuXG4gKlxuICogVGhlIGZ1bmN0aW9uIHByb2ZpbGUgY2FuIGxvb2sgbGlrZTpcbiAqIHRoaXMuZm9yRWFjaChzdGF0ZTEsIGZuKTsgICAgICAgICAvLyBpdGVyYXRlcyBvdmVyIGFsbCBwYXRocyBpbiBzdGF0ZTFcbiAqIHRoaXMuZm9yRWFjaChzdGF0ZTEsIHN0YXRlMiwgZm4pOyAvLyBpdGVyYXRlcyBvdmVyIGFsbCBwYXRocyBpbiBzdGF0ZTEgb3Igc3RhdGUyXG4gKiB0aGlzLmZvckVhY2goZm4pOyAgICAgICAgICAgICAgICAgLy8gaXRlcmF0ZXMgb3ZlciBhbGwgcGF0aHMgaW4gYWxsIHN0YXRlc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBbc3RhdGVdXG4gKiBAcGFyYW0ge1N0cmluZ30gW3N0YXRlXVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEBwcml2YXRlXG4gKi9cblxuU3RhdGVNYWNoaW5lLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24gZm9yRWFjaCAoKSB7XG4gIHRoaXMuZm9yRWFjaCA9IHRoaXMuX2l0ZXIoJ2ZvckVhY2gnKTtcbiAgcmV0dXJuIHRoaXMuZm9yRWFjaC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuLyohXG4gKiBNYXBzIG92ZXIgdGhlIHBhdGhzIHRoYXQgYmVsb25nIHRvIG9uZSBvZiB0aGUgcGFyYW1ldGVyIHN0YXRlcy5cbiAqXG4gKiBUaGUgZnVuY3Rpb24gcHJvZmlsZSBjYW4gbG9vayBsaWtlOlxuICogdGhpcy5mb3JFYWNoKHN0YXRlMSwgZm4pOyAgICAgICAgIC8vIGl0ZXJhdGVzIG92ZXIgYWxsIHBhdGhzIGluIHN0YXRlMVxuICogdGhpcy5mb3JFYWNoKHN0YXRlMSwgc3RhdGUyLCBmbik7IC8vIGl0ZXJhdGVzIG92ZXIgYWxsIHBhdGhzIGluIHN0YXRlMSBvciBzdGF0ZTJcbiAqIHRoaXMuZm9yRWFjaChmbik7ICAgICAgICAgICAgICAgICAvLyBpdGVyYXRlcyBvdmVyIGFsbCBwYXRocyBpbiBhbGwgc3RhdGVzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IFtzdGF0ZV1cbiAqIEBwYXJhbSB7U3RyaW5nfSBbc3RhdGVdXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHJldHVybiB7QXJyYXl9XG4gKiBAcHJpdmF0ZVxuICovXG5cblN0YXRlTWFjaGluZS5wcm90b3R5cGUubWFwID0gZnVuY3Rpb24gbWFwICgpIHtcbiAgdGhpcy5tYXAgPSB0aGlzLl9pdGVyKCdtYXAnKTtcbiAgcmV0dXJuIHRoaXMubWFwLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbi8vVE9ETzog0L/QvtGH0LjRgdGC0LjRgtGMINC60L7QtFxuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIEVtYmVkZGVkRG9jdW1lbnQgPSByZXF1aXJlKCcuL2VtYmVkZGVkJyk7XG52YXIgRG9jdW1lbnQgPSByZXF1aXJlKCcuLi9kb2N1bWVudCcpO1xudmFyIE9iamVjdElkID0gcmVxdWlyZSgnLi9vYmplY3RpZCcpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcblxuLyoqXG4gKiBTdG9yYWdlIEFycmF5IGNvbnN0cnVjdG9yLlxuICpcbiAqICMjIyNOT1RFOlxuICpcbiAqIF9WYWx1ZXMgYWx3YXlzIGhhdmUgdG8gYmUgcGFzc2VkIHRvIHRoZSBjb25zdHJ1Y3RvciB0byBpbml0aWFsaXplLCBvdGhlcndpc2UgYFN0b3JhZ2VBcnJheSNwdXNoYCB3aWxsIG1hcmsgdGhlIGFycmF5IGFzIG1vZGlmaWVkLl9cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSB2YWx1ZXNcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2MgcGFyZW50IGRvY3VtZW50XG4gKiBAYXBpIHByaXZhdGVcbiAqIEBpbmhlcml0cyBBcnJheVxuICovXG5mdW5jdGlvbiBTdG9yYWdlQXJyYXkgKHZhbHVlcywgcGF0aCwgZG9jKSB7XG4gIHZhciBhcnIgPSBbXTtcbiAgYXJyLnB1c2guYXBwbHkoYXJyLCB2YWx1ZXMpO1xuICBfLm1peGluKCBhcnIsIFN0b3JhZ2VBcnJheS5taXhpbiApO1xuXG4gIGFyci52YWxpZGF0b3JzID0gW107XG4gIGFyci5fcGF0aCA9IHBhdGg7XG4gIGFyci5pc1N0b3JhZ2VBcnJheSA9IHRydWU7XG5cbiAgaWYgKGRvYykge1xuICAgIGFyci5fcGFyZW50ID0gZG9jO1xuICAgIGFyci5fc2NoZW1hID0gZG9jLnNjaGVtYS5wYXRoKHBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIGFycjtcbn1cblxuU3RvcmFnZUFycmF5Lm1peGluID0ge1xuICAvKipcbiAgICogUGFyZW50IG93bmVyIGRvY3VtZW50XG4gICAqXG4gICAqIEBwcm9wZXJ0eSBfcGFyZW50XG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKi9cbiAgX3BhcmVudDogdW5kZWZpbmVkLFxuXG4gIC8qKlxuICAgKiBDYXN0cyBhIG1lbWJlciBiYXNlZCBvbiB0aGlzIGFycmF5cyBzY2hlbWEuXG4gICAqXG4gICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICogQHJldHVybiB2YWx1ZSB0aGUgY2FzdGVkIHZhbHVlXG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKi9cbiAgX2Nhc3Q6IGZ1bmN0aW9uICggdmFsdWUgKSB7XG4gICAgdmFyIG93bmVyID0gdGhpcy5fb3duZXI7XG4gICAgdmFyIHBvcHVsYXRlZCA9IGZhbHNlO1xuXG4gICAgaWYgKHRoaXMuX3BhcmVudCkge1xuICAgICAgLy8gaWYgYSBwb3B1bGF0ZWQgYXJyYXksIHdlIG11c3QgY2FzdCB0byB0aGUgc2FtZSBtb2RlbFxuICAgICAgLy8gaW5zdGFuY2UgYXMgc3BlY2lmaWVkIGluIHRoZSBvcmlnaW5hbCBxdWVyeS5cbiAgICAgIGlmICghb3duZXIpIHtcbiAgICAgICAgb3duZXIgPSB0aGlzLl9vd25lciA9IHRoaXMuX3BhcmVudC5vd25lckRvY3VtZW50XG4gICAgICAgICAgPyB0aGlzLl9wYXJlbnQub3duZXJEb2N1bWVudCgpXG4gICAgICAgICAgOiB0aGlzLl9wYXJlbnQ7XG4gICAgICB9XG5cbiAgICAgIHBvcHVsYXRlZCA9IG93bmVyLnBvcHVsYXRlZCh0aGlzLl9wYXRoLCB0cnVlKTtcbiAgICB9XG5cbiAgICBpZiAocG9wdWxhdGVkICYmIG51bGwgIT0gdmFsdWUpIHtcbiAgICAgIC8vIGNhc3QgdG8gdGhlIHBvcHVsYXRlZCBNb2RlbHMgc2NoZW1hXG4gICAgICB2YXIgTW9kZWwgPSBwb3B1bGF0ZWQub3B0aW9ucy5tb2RlbDtcblxuICAgICAgLy8gb25seSBvYmplY3RzIGFyZSBwZXJtaXR0ZWQgc28gd2UgY2FuIHNhZmVseSBhc3N1bWUgdGhhdFxuICAgICAgLy8gbm9uLW9iamVjdHMgYXJlIHRvIGJlIGludGVycHJldGVkIGFzIF9pZFxuICAgICAgaWYgKCB2YWx1ZSBpbnN0YW5jZW9mIE9iamVjdElkIHx8ICFfLmlzT2JqZWN0KHZhbHVlKSApIHtcbiAgICAgICAgdmFsdWUgPSB7IF9pZDogdmFsdWUgfTtcbiAgICAgIH1cblxuICAgICAgdmFsdWUgPSBuZXcgTW9kZWwodmFsdWUpO1xuICAgICAgcmV0dXJuIHRoaXMuX3NjaGVtYS5jYXN0ZXIuY2FzdCh2YWx1ZSwgdGhpcy5fcGFyZW50LCB0cnVlKVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9zY2hlbWEuY2FzdGVyLmNhc3QodmFsdWUsIHRoaXMuX3BhcmVudCwgZmFsc2UpXG4gIH0sXG5cbiAgLyoqXG4gICAqIE1hcmtzIHRoaXMgYXJyYXkgYXMgbW9kaWZpZWQuXG4gICAqXG4gICAqIElmIGl0IGJ1YmJsZXMgdXAgZnJvbSBhbiBlbWJlZGRlZCBkb2N1bWVudCBjaGFuZ2UsIHRoZW4gaXQgdGFrZXMgdGhlIGZvbGxvd2luZyBhcmd1bWVudHMgKG90aGVyd2lzZSwgdGFrZXMgMCBhcmd1bWVudHMpXG4gICAqXG4gICAqIEBwYXJhbSB7RW1iZWRkZWREb2N1bWVudH0gZW1iZWRkZWREb2MgdGhlIGVtYmVkZGVkIGRvYyB0aGF0IGludm9rZWQgdGhpcyBtZXRob2Qgb24gdGhlIEFycmF5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBlbWJlZGRlZFBhdGggdGhlIHBhdGggd2hpY2ggY2hhbmdlZCBpbiB0aGUgZW1iZWRkZWREb2NcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuICBfbWFya01vZGlmaWVkOiBmdW5jdGlvbiAoZWxlbSwgZW1iZWRkZWRQYXRoKSB7XG4gICAgdmFyIHBhcmVudCA9IHRoaXMuX3BhcmVudFxuICAgICAgLCBkaXJ0eVBhdGg7XG5cbiAgICBpZiAocGFyZW50KSB7XG4gICAgICBkaXJ0eVBhdGggPSB0aGlzLl9wYXRoO1xuXG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICBpZiAobnVsbCAhPSBlbWJlZGRlZFBhdGgpIHtcbiAgICAgICAgICAvLyBhbiBlbWJlZGRlZCBkb2MgYnViYmxlZCB1cCB0aGUgY2hhbmdlXG4gICAgICAgICAgZGlydHlQYXRoID0gZGlydHlQYXRoICsgJy4nICsgdGhpcy5pbmRleE9mKGVsZW0pICsgJy4nICsgZW1iZWRkZWRQYXRoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGRpcmVjdGx5IHNldCBhbiBpbmRleFxuICAgICAgICAgIGRpcnR5UGF0aCA9IGRpcnR5UGF0aCArICcuJyArIGVsZW07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcGFyZW50Lm1hcmtNb2RpZmllZChkaXJ0eVBhdGgpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIC8qKlxuICAgKiBXcmFwcyBbYEFycmF5I3B1c2hgXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9BcnJheS9wdXNoKSB3aXRoIHByb3BlciBjaGFuZ2UgdHJhY2tpbmcuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbYXJncy4uLl1cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG4gIHB1c2g6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdmFsdWVzID0gW10ubWFwLmNhbGwoYXJndW1lbnRzLCB0aGlzLl9jYXN0LCB0aGlzKVxuICAgICAgLCByZXQgPSBbXS5wdXNoLmFwcGx5KHRoaXMsIHZhbHVlcyk7XG5cbiAgICB0aGlzLl9tYXJrTW9kaWZpZWQoKTtcbiAgICByZXR1cm4gcmV0O1xuICB9LFxuXG4gIC8qKlxuICAgKiBXcmFwcyBbYEFycmF5I3BvcGBdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L3BvcCkgd2l0aCBwcm9wZXIgY2hhbmdlIHRyYWNraW5nLlxuICAgKlxuICAgKiAjIyMjTm90ZTpcbiAgICpcbiAgICogX21hcmtzIHRoZSBlbnRpcmUgYXJyYXkgYXMgbW9kaWZpZWQgd2hpY2ggd2lsbCBwYXNzIHRoZSBlbnRpcmUgdGhpbmcgdG8gJHNldCBwb3RlbnRpYWxseSBvdmVyd3JpdHRpbmcgYW55IGNoYW5nZXMgdGhhdCBoYXBwZW4gYmV0d2VlbiB3aGVuIHlvdSByZXRyaWV2ZWQgdGhlIG9iamVjdCBhbmQgd2hlbiB5b3Ugc2F2ZSBpdC5fXG4gICAqXG4gICAqIEBzZWUgU3RvcmFnZUFycmF5IyRwb3AgI3R5cGVzX2FycmF5X1N0b3JhZ2VBcnJheS0lMjRwb3BcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG4gIHBvcDogZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXQgPSBbXS5wb3AuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMuX21hcmtNb2RpZmllZCgpO1xuICAgIHJldHVybiByZXQ7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFdyYXBzIFtgQXJyYXkjc2hpZnRgXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9BcnJheS91bnNoaWZ0KSB3aXRoIHByb3BlciBjaGFuZ2UgdHJhY2tpbmcuXG4gICAqXG4gICAqICMjIyNFeGFtcGxlOlxuICAgKlxuICAgKiAgICAgZG9jLmFycmF5ID0gWzIsM107XG4gICAqICAgICB2YXIgcmVzID0gZG9jLmFycmF5LnNoaWZ0KCk7XG4gICAqICAgICBjb25zb2xlLmxvZyhyZXMpIC8vIDJcbiAgICogICAgIGNvbnNvbGUubG9nKGRvYy5hcnJheSkgLy8gWzNdXG4gICAqXG4gICAqICMjIyNOb3RlOlxuICAgKlxuICAgKiBfbWFya3MgdGhlIGVudGlyZSBhcnJheSBhcyBtb2RpZmllZCwgd2hpY2ggaWYgc2F2ZWQsIHdpbGwgc3RvcmUgaXQgYXMgYSBgJHNldGAgb3BlcmF0aW9uLCBwb3RlbnRpYWxseSBvdmVyd3JpdHRpbmcgYW55IGNoYW5nZXMgdGhhdCBoYXBwZW4gYmV0d2VlbiB3aGVuIHlvdSByZXRyaWV2ZWQgdGhlIG9iamVjdCBhbmQgd2hlbiB5b3Ugc2F2ZSBpdC5fXG4gICAqXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuICBzaGlmdDogZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXQgPSBbXS5zaGlmdC5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5fbWFya01vZGlmaWVkKCk7XG4gICAgcmV0dXJuIHJldDtcbiAgfSxcblxuICAvKipcbiAgICogUHVsbHMgaXRlbXMgZnJvbSB0aGUgYXJyYXkgYXRvbWljYWxseS5cbiAgICpcbiAgICogIyMjI0V4YW1wbGVzOlxuICAgKlxuICAgKiAgICAgZG9jLmFycmF5LnB1bGwoT2JqZWN0SWQpXG4gICAqICAgICBkb2MuYXJyYXkucHVsbCh7IF9pZDogJ3NvbWVJZCcgfSlcbiAgICogICAgIGRvYy5hcnJheS5wdWxsKDM2KVxuICAgKiAgICAgZG9jLmFycmF5LnB1bGwoJ3RhZyAxJywgJ3RhZyAyJylcbiAgICpcbiAgICogVG8gcmVtb3ZlIGEgZG9jdW1lbnQgZnJvbSBhIHN1YmRvY3VtZW50IGFycmF5IHdlIG1heSBwYXNzIGFuIG9iamVjdCB3aXRoIGEgbWF0Y2hpbmcgYF9pZGAuXG4gICAqXG4gICAqICAgICBkb2Muc3ViZG9jcy5wdXNoKHsgX2lkOiA0ODE1MTYyMzQyIH0pXG4gICAqICAgICBkb2Muc3ViZG9jcy5wdWxsKHsgX2lkOiA0ODE1MTYyMzQyIH0pIC8vIHJlbW92ZWRcbiAgICpcbiAgICogT3Igd2UgbWF5IHBhc3NpbmcgdGhlIF9pZCBkaXJlY3RseSBhbmQgbGV0IHN0b3JhZ2UgdGFrZSBjYXJlIG9mIGl0LlxuICAgKlxuICAgKiAgICAgZG9jLnN1YmRvY3MucHVzaCh7IF9pZDogNDgxNTE2MjM0MiB9KVxuICAgKiAgICAgZG9jLnN1YmRvY3MucHVsbCg0ODE1MTYyMzQyKTsgLy8gd29ya3NcbiAgICpcbiAgICogQHBhcmFtIHsqfSBhcmd1bWVudHNcbiAgICogQHNlZSBtb25nb2RiIGh0dHA6Ly93d3cubW9uZ29kYi5vcmcvZGlzcGxheS9ET0NTL1VwZGF0aW5nLyNVcGRhdGluZy0lMjRwdWxsXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuICBwdWxsOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHZhbHVlcyA9IFtdLm1hcC5jYWxsKGFyZ3VtZW50cywgdGhpcy5fY2FzdCwgdGhpcylcbiAgICAgICwgY3VyID0gdGhpcy5fcGFyZW50LmdldCh0aGlzLl9wYXRoKVxuICAgICAgLCBpID0gY3VyLmxlbmd0aFxuICAgICAgLCBtZW07XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBtZW0gPSBjdXJbaV07XG4gICAgICBpZiAobWVtIGluc3RhbmNlb2YgRW1iZWRkZWREb2N1bWVudCkge1xuICAgICAgICBpZiAodmFsdWVzLnNvbWUoZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHYuZXF1YWxzKG1lbSk7IH0gKSkge1xuICAgICAgICAgIFtdLnNwbGljZS5jYWxsKGN1ciwgaSwgMSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAofmN1ci5pbmRleE9mLmNhbGwodmFsdWVzLCBtZW0pKSB7XG4gICAgICAgIFtdLnNwbGljZS5jYWxsKGN1ciwgaSwgMSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fbWFya01vZGlmaWVkKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFdyYXBzIFtgQXJyYXkjc3BsaWNlYF0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvQXJyYXkvc3BsaWNlKSB3aXRoIHByb3BlciBjaGFuZ2UgdHJhY2tpbmcgYW5kIGNhc3RpbmcuXG4gICAqXG4gICAqICMjIyNOb3RlOlxuICAgKlxuICAgKiBfbWFya3MgdGhlIGVudGlyZSBhcnJheSBhcyBtb2RpZmllZCwgd2hpY2ggaWYgc2F2ZWQsIHdpbGwgc3RvcmUgaXQgYXMgYSBgJHNldGAgb3BlcmF0aW9uLCBwb3RlbnRpYWxseSBvdmVyd3JpdHRpbmcgYW55IGNoYW5nZXMgdGhhdCBoYXBwZW4gYmV0d2VlbiB3aGVuIHlvdSByZXRyaWV2ZWQgdGhlIG9iamVjdCBhbmQgd2hlbiB5b3Ugc2F2ZSBpdC5fXG4gICAqXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuICBzcGxpY2U6IGZ1bmN0aW9uIHNwbGljZSAoKSB7XG4gICAgdmFyIHJldCwgdmFscywgaTtcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICB2YWxzID0gW107XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhbHNbaV0gPSBpIDwgMlxuICAgICAgICAgID8gYXJndW1lbnRzW2ldXG4gICAgICAgICAgOiB0aGlzLl9jYXN0KGFyZ3VtZW50c1tpXSk7XG4gICAgICB9XG4gICAgICByZXQgPSBbXS5zcGxpY2UuYXBwbHkodGhpcywgdmFscyk7XG5cbiAgICAgIHRoaXMuX21hcmtNb2RpZmllZCgpO1xuICAgIH1cblxuICAgIHJldHVybiByZXQ7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFdyYXBzIFtgQXJyYXkjdW5zaGlmdGBdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L3Vuc2hpZnQpIHdpdGggcHJvcGVyIGNoYW5nZSB0cmFja2luZy5cbiAgICpcbiAgICogIyMjI05vdGU6XG4gICAqXG4gICAqIF9tYXJrcyB0aGUgZW50aXJlIGFycmF5IGFzIG1vZGlmaWVkLCB3aGljaCBpZiBzYXZlZCwgd2lsbCBzdG9yZSBpdCBhcyBhIGAkc2V0YCBvcGVyYXRpb24sIHBvdGVudGlhbGx5IG92ZXJ3cml0dGluZyBhbnkgY2hhbmdlcyB0aGF0IGhhcHBlbiBiZXR3ZWVuIHdoZW4geW91IHJldHJpZXZlZCB0aGUgb2JqZWN0IGFuZCB3aGVuIHlvdSBzYXZlIGl0Ll9cbiAgICpcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG4gIHVuc2hpZnQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdmFsdWVzID0gW10ubWFwLmNhbGwoYXJndW1lbnRzLCB0aGlzLl9jYXN0LCB0aGlzKTtcbiAgICBbXS51bnNoaWZ0LmFwcGx5KHRoaXMsIHZhbHVlcyk7XG5cbiAgICB0aGlzLl9tYXJrTW9kaWZpZWQoKTtcbiAgICByZXR1cm4gdGhpcy5sZW5ndGg7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFdyYXBzIFtgQXJyYXkjc29ydGBdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L3NvcnQpIHdpdGggcHJvcGVyIGNoYW5nZSB0cmFja2luZy5cbiAgICpcbiAgICogIyMjI05PVEU6XG4gICAqXG4gICAqIF9tYXJrcyB0aGUgZW50aXJlIGFycmF5IGFzIG1vZGlmaWVkLCB3aGljaCBpZiBzYXZlZCwgd2lsbCBzdG9yZSBpdCBhcyBhIGAkc2V0YCBvcGVyYXRpb24sIHBvdGVudGlhbGx5IG92ZXJ3cml0dGluZyBhbnkgY2hhbmdlcyB0aGF0IGhhcHBlbiBiZXR3ZWVuIHdoZW4geW91IHJldHJpZXZlZCB0aGUgb2JqZWN0IGFuZCB3aGVuIHlvdSBzYXZlIGl0Ll9cbiAgICpcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG4gIHNvcnQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmV0ID0gW10uc29ydC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gICAgdGhpcy5fbWFya01vZGlmaWVkKCk7XG4gICAgcmV0dXJuIHJldDtcbiAgfSxcblxuICAvKipcbiAgICogQWRkcyB2YWx1ZXMgdG8gdGhlIGFycmF5IGlmIG5vdCBhbHJlYWR5IHByZXNlbnQuXG4gICAqXG4gICAqICMjIyNFeGFtcGxlOlxuICAgKlxuICAgKiAgICAgY29uc29sZS5sb2coZG9jLmFycmF5KSAvLyBbMiwzLDRdXG4gICAqICAgICB2YXIgYWRkZWQgPSBkb2MuYXJyYXkuYWRkVG9TZXQoNCw1KTtcbiAgICogICAgIGNvbnNvbGUubG9nKGRvYy5hcnJheSkgLy8gWzIsMyw0LDVdXG4gICAqICAgICBjb25zb2xlLmxvZyhhZGRlZCkgICAgIC8vIFs1XVxuICAgKlxuICAgKiBAcGFyYW0geyp9IGFyZ3VtZW50c1xuICAgKiBAcmV0dXJuIHtBcnJheX0gdGhlIHZhbHVlcyB0aGF0IHdlcmUgYWRkZWRcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG4gIGFkZFRvU2V0OiBmdW5jdGlvbiBhZGRUb1NldCAoKSB7XG4gICAgdmFyIHZhbHVlcyA9IFtdLm1hcC5jYWxsKGFyZ3VtZW50cywgdGhpcy5fY2FzdCwgdGhpcylcbiAgICAgICwgYWRkZWQgPSBbXVxuICAgICAgLCB0eXBlID0gdmFsdWVzWzBdIGluc3RhbmNlb2YgRW1iZWRkZWREb2N1bWVudCA/ICdkb2MnIDpcbiAgICAgICAgICAgICAgIHZhbHVlc1swXSBpbnN0YW5jZW9mIERhdGUgPyAnZGF0ZScgOlxuICAgICAgICAgICAgICAgJyc7XG5cbiAgICB2YWx1ZXMuZm9yRWFjaChmdW5jdGlvbiAodikge1xuICAgICAgdmFyIGZvdW5kO1xuICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgJ2RvYyc6XG4gICAgICAgICAgZm91bmQgPSB0aGlzLnNvbWUoZnVuY3Rpb24oZG9jKXsgcmV0dXJuIGRvYy5lcXVhbHModikgfSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2RhdGUnOlxuICAgICAgICAgIHZhciB2YWwgPSArdjtcbiAgICAgICAgICBmb3VuZCA9IHRoaXMuc29tZShmdW5jdGlvbihkKXsgcmV0dXJuICtkID09PSB2YWwgfSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgZm91bmQgPSB+dGhpcy5pbmRleE9mKHYpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWZvdW5kKSB7XG4gICAgICAgIFtdLnB1c2guY2FsbCh0aGlzLCB2KTtcblxuICAgICAgICB0aGlzLl9tYXJrTW9kaWZpZWQoKTtcbiAgICAgICAgW10ucHVzaC5jYWxsKGFkZGVkLCB2KTtcbiAgICAgIH1cbiAgICB9LCB0aGlzKTtcblxuICAgIHJldHVybiBhZGRlZDtcbiAgfSxcblxuICAvKipcbiAgICogU2V0cyB0aGUgY2FzdGVkIGB2YWxgIGF0IGluZGV4IGBpYCBhbmQgbWFya3MgdGhlIGFycmF5IG1vZGlmaWVkLlxuICAgKlxuICAgKiAjIyMjRXhhbXBsZTpcbiAgICpcbiAgICogICAgIC8vIGdpdmVuIGRvY3VtZW50cyBiYXNlZCBvbiB0aGUgZm9sbG93aW5nXG4gICAqICAgICB2YXIgZG9jcyA9IHN0b3JhZ2UuY3JlYXRlQ29sbGVjdGlvbignRG9jJywgbmV3IFNjaGVtYSh7IGFycmF5OiBbTnVtYmVyXSB9KSk7XG4gICAqXG4gICAqICAgICB2YXIgZG9jID0gZG9jcy5hZGQoeyBhcnJheTogWzIsMyw0XSB9KVxuICAgKlxuICAgKiAgICAgY29uc29sZS5sb2coZG9jLmFycmF5KSAvLyBbMiwzLDRdXG4gICAqXG4gICAqICAgICBkb2MuYXJyYXkuc2V0KDEsXCI1XCIpO1xuICAgKiAgICAgY29uc29sZS5sb2coZG9jLmFycmF5KTsgLy8gWzIsNSw0XSAvLyBwcm9wZXJseSBjYXN0IHRvIG51bWJlclxuICAgKiAgICAgZG9jLnNhdmUoKSAvLyB0aGUgY2hhbmdlIGlzIHNhdmVkXG4gICAqXG4gICAqICAgICAvLyBWUyBub3QgdXNpbmcgYXJyYXkjc2V0XG4gICAqICAgICBkb2MuYXJyYXlbMV0gPSBcIjVcIjtcbiAgICogICAgIGNvbnNvbGUubG9nKGRvYy5hcnJheSk7IC8vIFsyLFwiNVwiLDRdIC8vIG5vIGNhc3RpbmdcbiAgICogICAgIGRvYy5zYXZlKCkgLy8gY2hhbmdlIGlzIG5vdCBzYXZlZFxuICAgKlxuICAgKiBAcmV0dXJuIHtBcnJheX0gdGhpc1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cbiAgc2V0OiBmdW5jdGlvbiAoaSwgdmFsKSB7XG4gICAgdGhpc1tpXSA9IHRoaXMuX2Nhc3QodmFsKTtcbiAgICB0aGlzLl9tYXJrTW9kaWZpZWQoaSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBuYXRpdmUganMgQXJyYXkuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEByZXR1cm4ge0FycmF5fVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cbiAgdG9PYmplY3Q6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5kZXBvcHVsYXRlKSB7XG4gICAgICByZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24gKGRvYykge1xuICAgICAgICByZXR1cm4gZG9jIGluc3RhbmNlb2YgRG9jdW1lbnRcbiAgICAgICAgICA/IGRvYy50b09iamVjdChvcHRpb25zKVxuICAgICAgICAgIDogZG9jXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5zbGljZSgpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGluZGV4IG9mIGBvYmpgIG9yIGAtMWAgaWYgbm90IGZvdW5kLlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqIHRoZSBpdGVtIHRvIGxvb2sgZm9yXG4gICAqIEByZXR1cm4ge051bWJlcn1cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG4gIGluZGV4T2Y6IGZ1bmN0aW9uIGluZGV4T2YgKG9iaikge1xuICAgIGlmIChvYmogaW5zdGFuY2VvZiBPYmplY3RJZCkgb2JqID0gb2JqLnRvU3RyaW5nKCk7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRoaXMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgIGlmIChvYmogPT0gdGhpc1tpXSlcbiAgICAgICAgcmV0dXJuIGk7XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfVxufTtcblxuLyoqXG4gKiBBbGlhcyBvZiBbcHVsbF0oI3R5cGVzX2FycmF5X1N0b3JhZ2VBcnJheS1wdWxsKVxuICpcbiAqIEBzZWUgU3RvcmFnZUFycmF5I3B1bGwgI3R5cGVzX2FycmF5X1N0b3JhZ2VBcnJheS1wdWxsXG4gKiBAc2VlIG1vbmdvZGIgaHR0cDovL3d3dy5tb25nb2RiLm9yZy9kaXNwbGF5L0RPQ1MvVXBkYXRpbmcvI1VwZGF0aW5nLSUyNHB1bGxcbiAqIEBhcGkgcHVibGljXG4gKiBAbWVtYmVyT2YgU3RvcmFnZUFycmF5XG4gKiBAbWV0aG9kIHJlbW92ZVxuICovXG5TdG9yYWdlQXJyYXkubWl4aW4ucmVtb3ZlID0gU3RvcmFnZUFycmF5Lm1peGluLnB1bGw7XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBTdG9yYWdlQXJyYXk7XG4iLCIoZnVuY3Rpb24gKEJ1ZmZlcil7XG4ndXNlIHN0cmljdCc7XG5cbi8qIVxuICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAqL1xuXG52YXIgQmluYXJ5ID0gcmVxdWlyZSgnLi4vYmluYXJ5Jyk7XG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xuXG4vKipcbiAqIFN0b3JhZ2UgQnVmZmVyIGNvbnN0cnVjdG9yLlxuICpcbiAqIFZhbHVlcyBhbHdheXMgaGF2ZSB0byBiZSBwYXNzZWQgdG8gdGhlIGNvbnN0cnVjdG9yIHRvIGluaXRpYWxpemUuXG4gKlxuICogQHBhcmFtIHtCdWZmZXJ9IHZhbHVlXG4gKiBAcGFyYW0ge1N0cmluZ30gZW5jb2RlXG4gKiBAcGFyYW0ge051bWJlcn0gb2Zmc2V0XG4gKiBAYXBpIHByaXZhdGVcbiAqIEBpbmhlcml0cyBCdWZmZXJcbiAqL1xuXG5mdW5jdGlvbiBTdG9yYWdlQnVmZmVyICh2YWx1ZSwgZW5jb2RlLCBvZmZzZXQpIHtcbiAgdmFyIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gIHZhciB2YWw7XG5cbiAgaWYgKDAgPT09IGxlbmd0aCB8fCBudWxsID09PSBhcmd1bWVudHNbMF0gfHwgdW5kZWZpbmVkID09PSBhcmd1bWVudHNbMF0pIHtcbiAgICB2YWwgPSAwO1xuICB9IGVsc2Uge1xuICAgIHZhbCA9IHZhbHVlO1xuICB9XG5cbiAgdmFyIGVuY29kaW5nO1xuICB2YXIgcGF0aDtcbiAgdmFyIGRvYztcblxuICBpZiAoQXJyYXkuaXNBcnJheShlbmNvZGUpKSB7XG4gICAgLy8gaW50ZXJuYWwgY2FzdGluZ1xuICAgIHBhdGggPSBlbmNvZGVbMF07XG4gICAgZG9jID0gZW5jb2RlWzFdO1xuICB9IGVsc2Uge1xuICAgIGVuY29kaW5nID0gZW5jb2RlO1xuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIodmFsLCBlbmNvZGluZywgb2Zmc2V0KTtcbiAgXy5taXhpbiggYnVmLCBTdG9yYWdlQnVmZmVyLm1peGluICk7XG4gIGJ1Zi5pc1N0b3JhZ2VCdWZmZXIgPSB0cnVlO1xuXG4gIC8vIG1ha2Ugc3VyZSB0aGVzZSBpbnRlcm5hbCBwcm9wcyBkb24ndCBzaG93IHVwIGluIE9iamVjdC5rZXlzKClcbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoYnVmLCB7XG4gICAgICB2YWxpZGF0b3JzOiB7IHZhbHVlOiBbXSB9XG4gICAgLCBfcGF0aDogeyB2YWx1ZTogcGF0aCB9XG4gICAgLCBfcGFyZW50OiB7IHZhbHVlOiBkb2MgfVxuICB9KTtcblxuICBpZiAoZG9jICYmIFwic3RyaW5nXCIgPT09IHR5cGVvZiBwYXRoKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGJ1ZiwgJ19zY2hlbWEnLCB7XG4gICAgICAgIHZhbHVlOiBkb2Muc2NoZW1hLnBhdGgocGF0aClcbiAgICB9KTtcbiAgfVxuXG4gIGJ1Zi5fc3VidHlwZSA9IDA7XG4gIHJldHVybiBidWY7XG59XG5cbi8qIVxuICogSW5oZXJpdCBmcm9tIEJ1ZmZlci5cbiAqL1xuXG4vL1N0b3JhZ2VCdWZmZXIucHJvdG90eXBlID0gbmV3IEJ1ZmZlcigwKTtcblxuU3RvcmFnZUJ1ZmZlci5taXhpbiA9IHtcblxuICAvKipcbiAgICogUGFyZW50IG93bmVyIGRvY3VtZW50XG4gICAqXG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKiBAcHJvcGVydHkgX3BhcmVudFxuICAgKi9cblxuICBfcGFyZW50OiB1bmRlZmluZWQsXG5cbiAgLyoqXG4gICAqIERlZmF1bHQgc3VidHlwZSBmb3IgdGhlIEJpbmFyeSByZXByZXNlbnRpbmcgdGhpcyBCdWZmZXJcbiAgICpcbiAgICogQGFwaSBwcml2YXRlXG4gICAqIEBwcm9wZXJ0eSBfc3VidHlwZVxuICAgKi9cblxuICBfc3VidHlwZTogdW5kZWZpbmVkLFxuXG4gIC8qKlxuICAgKiBNYXJrcyB0aGlzIGJ1ZmZlciBhcyBtb2RpZmllZC5cbiAgICpcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIF9tYXJrTW9kaWZpZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcGFyZW50ID0gdGhpcy5fcGFyZW50O1xuXG4gICAgaWYgKHBhcmVudCkge1xuICAgICAgcGFyZW50Lm1hcmtNb2RpZmllZCh0aGlzLl9wYXRoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFdyaXRlcyB0aGUgYnVmZmVyLlxuICAgKi9cblxuICB3cml0ZTogZnVuY3Rpb24gKCkge1xuICAgIHZhciB3cml0dGVuID0gQnVmZmVyLnByb3RvdHlwZS53cml0ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gICAgaWYgKHdyaXR0ZW4gPiAwKSB7XG4gICAgICB0aGlzLl9tYXJrTW9kaWZpZWQoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gd3JpdHRlbjtcbiAgfSxcblxuICAvKipcbiAgICogQ29waWVzIHRoZSBidWZmZXIuXG4gICAqXG4gICAqICMjIyNOb3RlOlxuICAgKlxuICAgKiBgQnVmZmVyI2NvcHlgIGRvZXMgbm90IG1hcmsgYHRhcmdldGAgYXMgbW9kaWZpZWQgc28geW91IG11c3QgY29weSBmcm9tIGEgYFN0b3JhZ2VCdWZmZXJgIGZvciBpdCB0byB3b3JrIGFzIGV4cGVjdGVkLiBUaGlzIGlzIGEgd29yayBhcm91bmQgc2luY2UgYGNvcHlgIG1vZGlmaWVzIHRoZSB0YXJnZXQsIG5vdCB0aGlzLlxuICAgKlxuICAgKiBAcmV0dXJuIHtTdG9yYWdlQnVmZmVyfVxuICAgKiBAcGFyYW0ge0J1ZmZlcn0gdGFyZ2V0XG4gICAqL1xuXG4gIGNvcHk6IGZ1bmN0aW9uICh0YXJnZXQpIHtcbiAgICB2YXIgcmV0ID0gQnVmZmVyLnByb3RvdHlwZS5jb3B5LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICBpZiAodGFyZ2V0ICYmIHRhcmdldC5pc1N0b3JhZ2VCdWZmZXIpIHtcbiAgICAgIHRhcmdldC5fbWFya01vZGlmaWVkKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldDtcbiAgfVxufTtcblxuLyohXG4gKiBDb21waWxlIG90aGVyIEJ1ZmZlciBtZXRob2RzIG1hcmtpbmcgdGhpcyBidWZmZXIgYXMgbW9kaWZpZWQuXG4gKi9cblxuOyhcbi8vIG5vZGUgPCAwLjVcbid3cml0ZVVJbnQ4IHdyaXRlVUludDE2IHdyaXRlVUludDMyIHdyaXRlSW50OCB3cml0ZUludDE2IHdyaXRlSW50MzIgJyArXG4nd3JpdGVGbG9hdCB3cml0ZURvdWJsZSBmaWxsICcgK1xuJ3V0ZjhXcml0ZSBiaW5hcnlXcml0ZSBhc2NpaVdyaXRlIHNldCAnICtcblxuLy8gbm9kZSA+PSAwLjVcbid3cml0ZVVJbnQxNkxFIHdyaXRlVUludDE2QkUgd3JpdGVVSW50MzJMRSB3cml0ZVVJbnQzMkJFICcgK1xuJ3dyaXRlSW50MTZMRSB3cml0ZUludDE2QkUgd3JpdGVJbnQzMkxFIHdyaXRlSW50MzJCRSAnICtcbid3cml0ZUZsb2F0TEUgd3JpdGVGbG9hdEJFIHdyaXRlRG91YmxlTEUgd3JpdGVEb3VibGVCRSdcbikuc3BsaXQoJyAnKS5mb3JFYWNoKGZ1bmN0aW9uIChtZXRob2QpIHtcbiAgaWYgKCFCdWZmZXIucHJvdG90eXBlW21ldGhvZF0pIHJldHVybjtcbiAgICBTdG9yYWdlQnVmZmVyLm1peGluW21ldGhvZF0gPSBuZXcgRnVuY3Rpb24oXG4gICAgJ3ZhciByZXQgPSBCdWZmZXIucHJvdG90eXBlLicrbWV0aG9kKycuYXBwbHkodGhpcywgYXJndW1lbnRzKTsnICtcbiAgICAndGhpcy5fbWFya01vZGlmaWVkKCk7JyArXG4gICAgJ3JldHVybiByZXQ7J1xuICApXG59KTtcblxuLyoqXG4gKiBDb252ZXJ0cyB0aGlzIGJ1ZmZlciB0byBpdHMgQmluYXJ5IHR5cGUgcmVwcmVzZW50YXRpb24uXG4gKlxuICogIyMjI1N1YlR5cGVzOlxuICpcbiAqICAgdmFyIGJzb24gPSByZXF1aXJlKCdic29uJylcbiAqICAgYnNvbi5CU09OX0JJTkFSWV9TVUJUWVBFX0RFRkFVTFRcbiAqICAgYnNvbi5CU09OX0JJTkFSWV9TVUJUWVBFX0ZVTkNUSU9OXG4gKiAgIGJzb24uQlNPTl9CSU5BUllfU1VCVFlQRV9CWVRFX0FSUkFZXG4gKiAgIGJzb24uQlNPTl9CSU5BUllfU1VCVFlQRV9VVUlEXG4gKiAgIGJzb24uQlNPTl9CSU5BUllfU1VCVFlQRV9NRDVcbiAqICAgYnNvbi5CU09OX0JJTkFSWV9TVUJUWVBFX1VTRVJfREVGSU5FRFxuICpcbiAqICAgZG9jLmJ1ZmZlci50b09iamVjdChic29uLkJTT05fQklOQVJZX1NVQlRZUEVfVVNFUl9ERUZJTkVEKTtcbiAqXG4gKiBAc2VlIGh0dHA6Ly9ic29uc3BlYy5vcmcvIy9zcGVjaWZpY2F0aW9uXG4gKiBAcGFyYW0ge0hleH0gW3N1YnR5cGVdXG4gKiBAcmV0dXJuIHtCaW5hcnl9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cblN0b3JhZ2VCdWZmZXIubWl4aW4udG9PYmplY3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICB2YXIgc3VidHlwZSA9ICdudW1iZXInID09IHR5cGVvZiBvcHRpb25zXG4gICAgPyBvcHRpb25zXG4gICAgOiAodGhpcy5fc3VidHlwZSB8fCAwKTtcbiAgcmV0dXJuIG5ldyBCaW5hcnkodGhpcywgc3VidHlwZSk7XG59O1xuXG4vKipcbiAqIERldGVybWluZXMgaWYgdGhpcyBidWZmZXIgaXMgZXF1YWxzIHRvIGBvdGhlcmAgYnVmZmVyXG4gKlxuICogQHBhcmFtIHtCdWZmZXJ9IG90aGVyXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5cblN0b3JhZ2VCdWZmZXIubWl4aW4uZXF1YWxzID0gZnVuY3Rpb24gKG90aGVyKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKG90aGVyKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICh0aGlzLmxlbmd0aCAhPT0gb3RoZXIubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKHRoaXNbaV0gIT09IG90aGVyW2ldKSByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8qKlxuICogU2V0cyB0aGUgc3VidHlwZSBvcHRpb24gYW5kIG1hcmtzIHRoZSBidWZmZXIgbW9kaWZpZWQuXG4gKlxuICogIyMjI1N1YlR5cGVzOlxuICpcbiAqICAgdmFyIGJzb24gPSByZXF1aXJlKCdic29uJylcbiAqICAgYnNvbi5CU09OX0JJTkFSWV9TVUJUWVBFX0RFRkFVTFRcbiAqICAgYnNvbi5CU09OX0JJTkFSWV9TVUJUWVBFX0ZVTkNUSU9OXG4gKiAgIGJzb24uQlNPTl9CSU5BUllfU1VCVFlQRV9CWVRFX0FSUkFZXG4gKiAgIGJzb24uQlNPTl9CSU5BUllfU1VCVFlQRV9VVUlEXG4gKiAgIGJzb24uQlNPTl9CSU5BUllfU1VCVFlQRV9NRDVcbiAqICAgYnNvbi5CU09OX0JJTkFSWV9TVUJUWVBFX1VTRVJfREVGSU5FRFxuICpcbiAqICAgZG9jLmJ1ZmZlci5zdWJ0eXBlKGJzb24uQlNPTl9CSU5BUllfU1VCVFlQRV9VVUlEKTtcbiAqXG4gKiBAc2VlIGh0dHA6Ly9ic29uc3BlYy5vcmcvIy9zcGVjaWZpY2F0aW9uXG4gKiBAcGFyYW0ge0hleH0gc3VidHlwZVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5TdG9yYWdlQnVmZmVyLm1peGluLnN1YnR5cGUgPSBmdW5jdGlvbiAoc3VidHlwZSkge1xuICBpZiAoJ251bWJlcicgIT0gdHlwZW9mIHN1YnR5cGUpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIHN1YnR5cGUuIEV4cGVjdGVkIGEgbnVtYmVyJyk7XG4gIH1cblxuICBpZiAodGhpcy5fc3VidHlwZSAhPSBzdWJ0eXBlKSB7XG4gICAgdGhpcy5fbWFya01vZGlmaWVkKCk7XG4gIH1cblxuICB0aGlzLl9zdWJ0eXBlID0gc3VidHlwZTtcbn07XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxuU3RvcmFnZUJ1ZmZlci5CaW5hcnkgPSBCaW5hcnk7XG5cbm1vZHVsZS5leHBvcnRzID0gU3RvcmFnZUJ1ZmZlcjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyKSIsIid1c2Ugc3RyaWN0JztcblxuLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBTdG9yYWdlQXJyYXkgPSByZXF1aXJlKCcuL2FycmF5JylcbiAgLCBPYmplY3RJZCA9IHJlcXVpcmUoJy4vb2JqZWN0aWQnKVxuICAsIE9iamVjdElkU2NoZW1hID0gcmVxdWlyZSgnLi4vc2NoZW1hL29iamVjdGlkJylcbiAgLCB1dGlscyA9IHJlcXVpcmUoJy4uL3V0aWxzJylcbiAgLCBEb2N1bWVudCA9IHJlcXVpcmUoJy4uL2RvY3VtZW50Jyk7XG5cbi8qKlxuICogRG9jdW1lbnRBcnJheSBjb25zdHJ1Y3RvclxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHZhbHVlc1xuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggdGhlIHBhdGggdG8gdGhpcyBhcnJheVxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jIHBhcmVudCBkb2N1bWVudFxuICogQGFwaSBwcml2YXRlXG4gKiBAcmV0dXJuIHtTdG9yYWdlRG9jdW1lbnRBcnJheX1cbiAqIEBpbmhlcml0cyBTdG9yYWdlQXJyYXlcbiAqIEBzZWUgaHR0cDovL2JpdC5seS9mNkNuWlVcbiAqIFRPRE86INC/0L7QtNGH0LjRgdGC0LjRgtGMINC60L7QtFxuICpcbiAqINCS0LXRgdGMINC90YPQttC90YvQuSDQutC+0LQg0YHQutC+0L/QuNGA0L7QstCw0L1cbiAqL1xuZnVuY3Rpb24gU3RvcmFnZURvY3VtZW50QXJyYXkgKHZhbHVlcywgcGF0aCwgZG9jKSB7XG4gIHZhciBhcnIgPSBbXTtcblxuICAvLyBWYWx1ZXMgYWx3YXlzIGhhdmUgdG8gYmUgcGFzc2VkIHRvIHRoZSBjb25zdHJ1Y3RvciB0byBpbml0aWFsaXplLCBzaW5jZVxuICAvLyBvdGhlcndpc2UgU3RvcmFnZUFycmF5I3B1c2ggd2lsbCBtYXJrIHRoZSBhcnJheSBhcyBtb2RpZmllZCB0byB0aGUgcGFyZW50LlxuICBhcnIucHVzaC5hcHBseShhcnIsIHZhbHVlcyk7XG4gIF8ubWl4aW4oIGFyciwgU3RvcmFnZURvY3VtZW50QXJyYXkubWl4aW4gKTtcblxuICBhcnIudmFsaWRhdG9ycyA9IFtdO1xuICBhcnIuX3BhdGggPSBwYXRoO1xuICBhcnIuaXNTdG9yYWdlQXJyYXkgPSB0cnVlO1xuICBhcnIuaXNTdG9yYWdlRG9jdW1lbnRBcnJheSA9IHRydWU7XG5cbiAgaWYgKGRvYykge1xuICAgIGFyci5fcGFyZW50ID0gZG9jO1xuICAgIGFyci5fc2NoZW1hID0gZG9jLnNjaGVtYS5wYXRoKHBhdGgpO1xuICAgIGFyci5faGFuZGxlcnMgPSB7XG4gICAgICBpc05ldzogYXJyLm5vdGlmeSgnaXNOZXcnKSxcbiAgICAgIHNhdmU6IGFyci5ub3RpZnkoJ3NhdmUnKVxuICAgIH07XG5cbiAgICAvLyDQn9GA0L7QsdGA0L7RgSDQuNC30LzQtdC90LXQvdC40Y8g0YHQvtGB0YLQvtGP0L3QuNGPINCyINC/0L7QtNC00L7QutGD0LzQtdC90YJcbiAgICBkb2Mub24oJ3NhdmUnLCBhcnIuX2hhbmRsZXJzLnNhdmUpO1xuICAgIGRvYy5vbignaXNOZXcnLCBhcnIuX2hhbmRsZXJzLmlzTmV3KTtcbiAgfVxuXG4gIHJldHVybiBhcnI7XG59XG5cbi8qIVxuICogSW5oZXJpdHMgZnJvbSBTdG9yYWdlQXJyYXlcbiAqL1xuU3RvcmFnZURvY3VtZW50QXJyYXkubWl4aW4gPSBPYmplY3QuY3JlYXRlKCBTdG9yYWdlQXJyYXkubWl4aW4gKTtcblxuLyoqXG4gKiBPdmVycmlkZXMgU3RvcmFnZUFycmF5I2Nhc3RcbiAqXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuU3RvcmFnZURvY3VtZW50QXJyYXkubWl4aW4uX2Nhc3QgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgdGhpcy5fc2NoZW1hLmNhc3RlckNvbnN0cnVjdG9yKSB7XG4gICAgaWYgKCEodmFsdWUuX19wYXJlbnQgJiYgdmFsdWUuX19wYXJlbnRBcnJheSkpIHtcbiAgICAgIC8vIHZhbHVlIG1heSBoYXZlIGJlZW4gY3JlYXRlZCB1c2luZyBhcnJheS5jcmVhdGUoKVxuICAgICAgdmFsdWUuX19wYXJlbnQgPSB0aGlzLl9wYXJlbnQ7XG4gICAgICB2YWx1ZS5fX3BhcmVudEFycmF5ID0gdGhpcztcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgLy8gaGFuZGxlIGNhc3QoJ3N0cmluZycpIG9yIGNhc3QoT2JqZWN0SWQpIGV0Yy5cbiAgLy8gb25seSBvYmplY3RzIGFyZSBwZXJtaXR0ZWQgc28gd2UgY2FuIHNhZmVseSBhc3N1bWUgdGhhdFxuICAvLyBub24tb2JqZWN0cyBhcmUgdG8gYmUgaW50ZXJwcmV0ZWQgYXMgX2lkXG4gIGlmICggdmFsdWUgaW5zdGFuY2VvZiBPYmplY3RJZCB8fCAhXy5pc09iamVjdCh2YWx1ZSkgKSB7XG4gICAgdmFsdWUgPSB7IF9pZDogdmFsdWUgfTtcbiAgfVxuXG4gIHJldHVybiBuZXcgdGhpcy5fc2NoZW1hLmNhc3RlckNvbnN0cnVjdG9yKHZhbHVlLCB0aGlzKTtcbn07XG5cbi8qKlxuICogU2VhcmNoZXMgYXJyYXkgaXRlbXMgZm9yIHRoZSBmaXJzdCBkb2N1bWVudCB3aXRoIGEgbWF0Y2hpbmcgX2lkLlxuICpcbiAqICMjIyNFeGFtcGxlOlxuICpcbiAqICAgICB2YXIgZW1iZWRkZWREb2MgPSBtLmFycmF5LmlkKHNvbWVfaWQpO1xuICpcbiAqIEByZXR1cm4ge0VtYmVkZGVkRG9jdW1lbnR8bnVsbH0gdGhlIHN1YmRvY3VtZW50IG9yIG51bGwgaWYgbm90IGZvdW5kLlxuICogQHBhcmFtIHtPYmplY3RJZHxTdHJpbmd8TnVtYmVyfSBpZFxuICogQFRPRE8gY2FzdCB0byB0aGUgX2lkIGJhc2VkIG9uIHNjaGVtYSBmb3IgcHJvcGVyIGNvbXBhcmlzb25cbiAqIEBhcGkgcHVibGljXG4gKi9cblN0b3JhZ2VEb2N1bWVudEFycmF5Lm1peGluLmlkID0gZnVuY3Rpb24gKGlkKSB7XG4gIHZhciBjYXN0ZWRcbiAgICAsIHNpZFxuICAgICwgX2lkO1xuXG4gIHRyeSB7XG4gICAgdmFyIGNhc3RlZF8gPSBPYmplY3RJZFNjaGVtYS5wcm90b3R5cGUuY2FzdC5jYWxsKHt9LCBpZCk7XG4gICAgaWYgKGNhc3RlZF8pIGNhc3RlZCA9IFN0cmluZyhjYXN0ZWRfKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNhc3RlZCA9IG51bGw7XG4gIH1cblxuICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgX2lkID0gdGhpc1tpXS5nZXQoJ19pZCcpO1xuXG4gICAgaWYgKF9pZCBpbnN0YW5jZW9mIERvY3VtZW50KSB7XG4gICAgICBzaWQgfHwgKHNpZCA9IFN0cmluZyhpZCkpO1xuICAgICAgaWYgKHNpZCA9PSBfaWQuX2lkKSByZXR1cm4gdGhpc1tpXTtcbiAgICB9IGVsc2UgaWYgKCEoX2lkIGluc3RhbmNlb2YgT2JqZWN0SWQpKSB7XG4gICAgICBzaWQgfHwgKHNpZCA9IFN0cmluZyhpZCkpO1xuICAgICAgaWYgKHNpZCA9PSBfaWQpIHJldHVybiB0aGlzW2ldO1xuICAgIH0gZWxzZSBpZiAoY2FzdGVkID09IF9pZCkge1xuICAgICAgcmV0dXJuIHRoaXNbaV07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYSBuYXRpdmUganMgQXJyYXkgb2YgcGxhaW4ganMgb2JqZWN0c1xuICpcbiAqICMjIyNOT1RFOlxuICpcbiAqIF9FYWNoIHN1Yi1kb2N1bWVudCBpcyBjb252ZXJ0ZWQgdG8gYSBwbGFpbiBvYmplY3QgYnkgY2FsbGluZyBpdHMgYCN0b09iamVjdGAgbWV0aG9kLl9cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIG9wdGlvbmFsIG9wdGlvbnMgdG8gcGFzcyB0byBlYWNoIGRvY3VtZW50cyBgdG9PYmplY3RgIG1ldGhvZCBjYWxsIGR1cmluZyBjb252ZXJzaW9uXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuU3RvcmFnZURvY3VtZW50QXJyYXkubWl4aW4udG9PYmplY3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICByZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24gKGRvYykge1xuICAgIHJldHVybiBkb2MgJiYgZG9jLnRvT2JqZWN0KG9wdGlvbnMpIHx8IG51bGw7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgc3ViZG9jdW1lbnQgY2FzdGVkIHRvIHRoaXMgc2NoZW1hLlxuICpcbiAqIFRoaXMgaXMgdGhlIHNhbWUgc3ViZG9jdW1lbnQgY29uc3RydWN0b3IgdXNlZCBmb3IgY2FzdGluZy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIHRoZSB2YWx1ZSB0byBjYXN0IHRvIHRoaXMgYXJyYXlzIFN1YkRvY3VtZW50IHNjaGVtYVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5TdG9yYWdlRG9jdW1lbnRBcnJheS5taXhpbi5jcmVhdGUgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHJldHVybiBuZXcgdGhpcy5fc2NoZW1hLmNhc3RlckNvbnN0cnVjdG9yKG9iaik7XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYSBmbiB0aGF0IG5vdGlmaWVzIGFsbCBjaGlsZCBkb2NzIG9mIGBldmVudGAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5TdG9yYWdlRG9jdW1lbnRBcnJheS5taXhpbi5ub3RpZnkgPSBmdW5jdGlvbiBub3RpZnkgKGV2ZW50KSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgcmV0dXJuIGZ1bmN0aW9uIG5vdGlmeSAodmFsKSB7XG4gICAgdmFyIGkgPSBzZWxmLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBpZiAoIXNlbGZbaV0pIGNvbnRpbnVlO1xuICAgICAgc2VsZltpXS50cmlnZ2VyKGV2ZW50LCB2YWwpO1xuICAgIH1cbiAgfVxufTtcblxuLyohXG4gKiBNb2R1bGUgZXhwb3J0cy5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0b3JhZ2VEb2N1bWVudEFycmF5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIERvY3VtZW50ID0gcmVxdWlyZSgnLi4vZG9jdW1lbnQnKTtcblxuLyoqXG4gKiBFbWJlZGRlZERvY3VtZW50IGNvbnN0cnVjdG9yLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIGpzIG9iamVjdCByZXR1cm5lZCBmcm9tIHRoZSBkYlxuICogQHBhcmFtIHtTdG9yYWdlRG9jdW1lbnRBcnJheX0gcGFyZW50QXJyIHRoZSBwYXJlbnQgYXJyYXkgb2YgdGhpcyBkb2N1bWVudFxuICogQGluaGVyaXRzIERvY3VtZW50XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gRW1iZWRkZWREb2N1bWVudCAoIGRhdGEsIHBhcmVudEFyciApIHtcbiAgaWYgKHBhcmVudEFycikge1xuICAgIHRoaXMuX19wYXJlbnRBcnJheSA9IHBhcmVudEFycjtcbiAgICB0aGlzLl9fcGFyZW50ID0gcGFyZW50QXJyLl9wYXJlbnQ7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5fX3BhcmVudEFycmF5ID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuX19wYXJlbnQgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBEb2N1bWVudC5jYWxsKCB0aGlzLCBkYXRhLCB1bmRlZmluZWQgKTtcblxuICAvLyDQndGD0LbQvdC+INC00LvRjyDQv9GA0L7QsdGA0L7RgdCwINC40LfQvNC10L3QtdC90LjRjyDQt9C90LDRh9C10L3QuNGPINC40Lcg0YDQvtC00LjRgtC10LvRjNGB0LrQvtCz0L4g0LTQvtC60YPQvNC10L3RgtCwLCDQvdCw0L/RgNC40LzQtdGAINC/0YDQuCDRgdC+0YXRgNCw0L3QtdC90LjQuFxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHRoaXMub24oJ2lzTmV3JywgZnVuY3Rpb24gKHZhbCkge1xuICAgIHNlbGYuaXNOZXcgPSB2YWw7XG4gIH0pO1xufVxuXG4vKiFcbiAqIEluaGVyaXQgZnJvbSBEb2N1bWVudFxuICovXG5FbWJlZGRlZERvY3VtZW50LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIERvY3VtZW50LnByb3RvdHlwZSApO1xuRW1iZWRkZWREb2N1bWVudC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBFbWJlZGRlZERvY3VtZW50O1xuXG4vKipcbiAqIE1hcmtzIHRoZSBlbWJlZGRlZCBkb2MgbW9kaWZpZWQuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIHZhciBkb2MgPSBibG9ncG9zdC5jb21tZW50cy5pZChoZXhzdHJpbmcpO1xuICogICAgIGRvYy5taXhlZC50eXBlID0gJ2NoYW5nZWQnO1xuICogICAgIGRvYy5tYXJrTW9kaWZpZWQoJ21peGVkLnR5cGUnKTtcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCB0aGUgcGF0aCB3aGljaCBjaGFuZ2VkXG4gKiBAYXBpIHB1YmxpY1xuICovXG5FbWJlZGRlZERvY3VtZW50LnByb3RvdHlwZS5tYXJrTW9kaWZpZWQgPSBmdW5jdGlvbiAocGF0aCkge1xuICBpZiAoIXRoaXMuX19wYXJlbnRBcnJheSkgcmV0dXJuO1xuXG4gIHRoaXMuJF9fLmFjdGl2ZVBhdGhzLm1vZGlmeShwYXRoKTtcblxuICBpZiAodGhpcy5pc05ldykge1xuICAgIC8vIE1hcmsgdGhlIFdIT0xFIHBhcmVudCBhcnJheSBhcyBtb2RpZmllZFxuICAgIC8vIGlmIHRoaXMgaXMgYSBuZXcgZG9jdW1lbnQgKGkuZS4sIHdlIGFyZSBpbml0aWFsaXppbmdcbiAgICAvLyBhIGRvY3VtZW50KSxcbiAgICB0aGlzLl9fcGFyZW50QXJyYXkuX21hcmtNb2RpZmllZCgpO1xuICB9IGVsc2VcbiAgICB0aGlzLl9fcGFyZW50QXJyYXkuX21hcmtNb2RpZmllZCh0aGlzLCBwYXRoKTtcbn07XG5cbi8qKlxuICogVXNlZCBhcyBhIHN0dWIgZm9yIFtob29rcy5qc10oaHR0cHM6Ly9naXRodWIuY29tL2Jub2d1Y2hpL2hvb2tzLWpzL3RyZWUvMzFlYzU3MWNlZjAzMzJlMjExMjFlZTcxNTdlMGNmOTcyODU3MmNjMylcbiAqXG4gKiAjIyMjTk9URTpcbiAqXG4gKiBfVGhpcyBpcyBhIG5vLW9wLiBEb2VzIG5vdCBhY3R1YWxseSBzYXZlIHRoZSBkb2MgdG8gdGhlIGRiLl9cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbZm5dXG4gKiBAcmV0dXJuIHtQcm9taXNlfSByZXNvbHZlZCBQcm9taXNlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5FbWJlZGRlZERvY3VtZW50LnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24gKGZuKSB7XG4gIHZhciBwcm9taXNlID0gJC5EZWZlcnJlZCgpLmRvbmUoZm4pO1xuICBwcm9taXNlLnJlc29sdmUoKTtcbiAgcmV0dXJuIHByb21pc2U7XG59XG5cbi8qKlxuICogUmVtb3ZlcyB0aGUgc3ViZG9jdW1lbnQgZnJvbSBpdHMgcGFyZW50IGFycmF5LlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtmbl1cbiAqIEBhcGkgcHVibGljXG4gKi9cbkVtYmVkZGVkRG9jdW1lbnQucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uIChmbikge1xuICBpZiAoIXRoaXMuX19wYXJlbnRBcnJheSkgcmV0dXJuIHRoaXM7XG5cbiAgdmFyIF9pZDtcbiAgaWYgKCF0aGlzLndpbGxSZW1vdmUpIHtcbiAgICBfaWQgPSB0aGlzLl9kb2MuX2lkO1xuICAgIGlmICghX2lkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZvciB5b3VyIG93biBnb29kLCBTdG9yYWdlIGRvZXMgbm90IGtub3cgJyArXG4gICAgICAgICAgICAgICAgICAgICAgJ2hvdyB0byByZW1vdmUgYW4gRW1iZWRkZWREb2N1bWVudCB0aGF0IGhhcyBubyBfaWQnKTtcbiAgICB9XG4gICAgdGhpcy5fX3BhcmVudEFycmF5LnB1bGwoeyBfaWQ6IF9pZCB9KTtcbiAgICB0aGlzLndpbGxSZW1vdmUgPSB0cnVlO1xuICB9XG5cbiAgaWYgKGZuKVxuICAgIGZuKG51bGwpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBPdmVycmlkZSAjdXBkYXRlIG1ldGhvZCBvZiBwYXJlbnQgZG9jdW1lbnRzLlxuICogQGFwaSBwcml2YXRlXG4gKi9cbkVtYmVkZGVkRG9jdW1lbnQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdUaGUgI3VwZGF0ZSBtZXRob2QgaXMgbm90IGF2YWlsYWJsZSBvbiBFbWJlZGRlZERvY3VtZW50cycpO1xufTtcblxuLyoqXG4gKiBNYXJrcyBhIHBhdGggYXMgaW52YWxpZCwgY2F1c2luZyB2YWxpZGF0aW9uIHRvIGZhaWwuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGggdGhlIGZpZWxkIHRvIGludmFsaWRhdGVcbiAqIEBwYXJhbSB7U3RyaW5nfEVycm9yfSBlcnIgZXJyb3Igd2hpY2ggc3RhdGVzIHRoZSByZWFzb24gYHBhdGhgIHdhcyBpbnZhbGlkXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuRW1iZWRkZWREb2N1bWVudC5wcm90b3R5cGUuaW52YWxpZGF0ZSA9IGZ1bmN0aW9uIChwYXRoLCBlcnIsIHZhbCwgZmlyc3QpIHtcbiAgaWYgKCF0aGlzLl9fcGFyZW50KSB7XG4gICAgdmFyIG1zZyA9ICdVbmFibGUgdG8gaW52YWxpZGF0ZSBhIHN1YmRvY3VtZW50IHRoYXQgaGFzIG5vdCBiZWVuIGFkZGVkIHRvIGFuIGFycmF5LidcbiAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgfVxuXG4gIHZhciBpbmRleCA9IHRoaXMuX19wYXJlbnRBcnJheS5pbmRleE9mKHRoaXMpO1xuICB2YXIgcGFyZW50UGF0aCA9IHRoaXMuX19wYXJlbnRBcnJheS5fcGF0aDtcbiAgdmFyIGZ1bGxQYXRoID0gW3BhcmVudFBhdGgsIGluZGV4LCBwYXRoXS5qb2luKCcuJyk7XG5cbiAgLy8gc25pZmZpbmcgYXJndW1lbnRzOlxuICAvLyBuZWVkIHRvIGNoZWNrIGlmIHVzZXIgcGFzc2VkIGEgdmFsdWUgdG8ga2VlcFxuICAvLyBvdXIgZXJyb3IgbWVzc2FnZSBjbGVhbi5cbiAgaWYgKDIgPCBhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgdGhpcy5fX3BhcmVudC5pbnZhbGlkYXRlKGZ1bGxQYXRoLCBlcnIsIHZhbCk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5fX3BhcmVudC5pbnZhbGlkYXRlKGZ1bGxQYXRoLCBlcnIpO1xuICB9XG5cbiAgaWYgKGZpcnN0KVxuICAgIHRoaXMuJF9fLnZhbGlkYXRpb25FcnJvciA9IHRoaXMub3duZXJEb2N1bWVudCgpLiRfXy52YWxpZGF0aW9uRXJyb3I7XG4gIHJldHVybiB0cnVlO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSB0b3AgbGV2ZWwgZG9jdW1lbnQgb2YgdGhpcyBzdWItZG9jdW1lbnQuXG4gKlxuICogQHJldHVybiB7RG9jdW1lbnR9XG4gKi9cbkVtYmVkZGVkRG9jdW1lbnQucHJvdG90eXBlLm93bmVyRG9jdW1lbnQgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLiRfXy5vd25lckRvY3VtZW50KSB7XG4gICAgcmV0dXJuIHRoaXMuJF9fLm93bmVyRG9jdW1lbnQ7XG4gIH1cblxuICB2YXIgcGFyZW50ID0gdGhpcy5fX3BhcmVudDtcbiAgaWYgKCFwYXJlbnQpIHJldHVybiB0aGlzO1xuXG4gIHdoaWxlIChwYXJlbnQuX19wYXJlbnQpIHtcbiAgICBwYXJlbnQgPSBwYXJlbnQuX19wYXJlbnQ7XG4gIH1cblxuICByZXR1cm4gdGhpcy4kX18ub3duZXJEb2N1bWVudCA9IHBhcmVudDtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgZnVsbCBwYXRoIHRvIHRoaXMgZG9jdW1lbnQuIElmIG9wdGlvbmFsIGBwYXRoYCBpcyBwYXNzZWQsIGl0IGlzIGFwcGVuZGVkIHRvIHRoZSBmdWxsIHBhdGguXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IFtwYXRoXVxuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKiBAbWV0aG9kICRfX2Z1bGxQYXRoXG4gKiBAbWVtYmVyT2YgRW1iZWRkZWREb2N1bWVudFxuICovXG5FbWJlZGRlZERvY3VtZW50LnByb3RvdHlwZS4kX19mdWxsUGF0aCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gIGlmICghdGhpcy4kX18uZnVsbFBhdGgpIHtcbiAgICB2YXIgcGFyZW50ID0gdGhpcztcbiAgICBpZiAoIXBhcmVudC5fX3BhcmVudCkgcmV0dXJuIHBhdGg7XG5cbiAgICB2YXIgcGF0aHMgPSBbXTtcbiAgICB3aGlsZSAocGFyZW50Ll9fcGFyZW50KSB7XG4gICAgICBwYXRocy51bnNoaWZ0KHBhcmVudC5fX3BhcmVudEFycmF5Ll9wYXRoKTtcbiAgICAgIHBhcmVudCA9IHBhcmVudC5fX3BhcmVudDtcbiAgICB9XG5cbiAgICB0aGlzLiRfXy5mdWxsUGF0aCA9IHBhdGhzLmpvaW4oJy4nKTtcblxuICAgIGlmICghdGhpcy4kX18ub3duZXJEb2N1bWVudCkge1xuICAgICAgLy8gb3B0aW1pemF0aW9uXG4gICAgICB0aGlzLiRfXy5vd25lckRvY3VtZW50ID0gcGFyZW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXRoXG4gICAgPyB0aGlzLiRfXy5mdWxsUGF0aCArICcuJyArIHBhdGhcbiAgICA6IHRoaXMuJF9fLmZ1bGxQYXRoO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoaXMgc3ViLWRvY3VtZW50cyBwYXJlbnQgZG9jdW1lbnQuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuRW1iZWRkZWREb2N1bWVudC5wcm90b3R5cGUucGFyZW50ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5fX3BhcmVudDtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGlzIHN1Yi1kb2N1bWVudHMgcGFyZW50IGFycmF5LlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cbkVtYmVkZGVkRG9jdW1lbnQucHJvdG90eXBlLnBhcmVudEFycmF5ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5fX3BhcmVudEFycmF5O1xufTtcblxuLyohXG4gKiBNb2R1bGUgZXhwb3J0cy5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVtYmVkZGVkRG9jdW1lbnQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIVxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxuZXhwb3J0cy5BcnJheSA9IHJlcXVpcmUoJy4vYXJyYXknKTtcbmV4cG9ydHMuQnVmZmVyID0gcmVxdWlyZSgnLi9idWZmZXInKTtcblxuZXhwb3J0cy5FbWJlZGRlZCA9IHJlcXVpcmUoJy4vZW1iZWRkZWQnKTtcblxuZXhwb3J0cy5Eb2N1bWVudEFycmF5ID0gcmVxdWlyZSgnLi9kb2N1bWVudGFycmF5Jyk7XG5leHBvcnRzLk9iamVjdElkID0gcmVxdWlyZSgnLi9vYmplY3RpZCcpO1xuIiwiKGZ1bmN0aW9uIChwcm9jZXNzKXtcbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICogQGlnbm9yZVxuICovXG52YXIgQmluYXJ5UGFyc2VyID0gcmVxdWlyZSgnLi4vYmluYXJ5cGFyc2VyJykuQmluYXJ5UGFyc2VyO1xuXG4vKipcbiAqIE1hY2hpbmUgaWQuXG4gKlxuICogQ3JlYXRlIGEgcmFuZG9tIDMtYnl0ZSB2YWx1ZSAoaS5lLiB1bmlxdWUgZm9yIHRoaXNcbiAqIHByb2Nlc3MpLiBPdGhlciBkcml2ZXJzIHVzZSBhIG1kNSBvZiB0aGUgbWFjaGluZSBpZCBoZXJlLCBidXRcbiAqIHRoYXQgd291bGQgbWVhbiBhbiBhc3ljIGNhbGwgdG8gZ2V0aG9zdG5hbWUsIHNvIHdlIGRvbid0IGJvdGhlci5cbiAqIEBpZ25vcmVcbiAqL1xudmFyIE1BQ0hJTkVfSUQgPSBwYXJzZUludChNYXRoLnJhbmRvbSgpICogMHhGRkZGRkYsIDEwKTtcblxuLy8gUmVndWxhciBleHByZXNzaW9uIHRoYXQgY2hlY2tzIGZvciBoZXggdmFsdWVcbnZhciBjaGVja0ZvckhleFJlZ0V4cCA9IG5ldyBSZWdFeHAoXCJeWzAtOWEtZkEtRl17MjR9JFwiKTtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgT2JqZWN0SWQgaW5zdGFuY2VcbiAqXG4gKiBAc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9tb25nb2RiL2pzLWJzb24vYmxvYi9tYXN0ZXIvbGliL2Jzb24vb2JqZWN0aWQuanNcbiAqIEBjbGFzcyBSZXByZXNlbnRzIGEgQlNPTiBPYmplY3RJZCB0eXBlLlxuICogQHBhcmFtIHsoc3RyaW5nfG51bWJlcil9IGlkIENhbiBiZSBhIDI0IGJ5dGUgaGV4IHN0cmluZywgMTIgYnl0ZSBiaW5hcnkgc3RyaW5nIG9yIGEgTnVtYmVyLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGdlbmVyYXRpb25UaW1lIFRoZSBnZW5lcmF0aW9uIHRpbWUgb2YgdGhpcyBPYmplY3RJZCBpbnN0YW5jZVxuICogQHJldHVybiB7T2JqZWN0SWR9IGluc3RhbmNlIG9mIE9iamVjdElkLlxuICovXG5mdW5jdGlvbiBPYmplY3RJZChpZCkge1xuICBpZighKHRoaXMgaW5zdGFuY2VvZiBPYmplY3RJZCkpIHJldHVybiBuZXcgT2JqZWN0SWQoaWQpO1xuICBpZigoaWQgaW5zdGFuY2VvZiBPYmplY3RJZCkpIHJldHVybiBpZDtcblxuICB0aGlzLl9ic29udHlwZSA9ICdPYmplY3RJZCc7XG4gIHZhciB2YWxpZCA9IE9iamVjdElkLmlzVmFsaWQoaWQpO1xuXG4gIC8vIFRocm93IGFuIGVycm9yIGlmIGl0J3Mgbm90IGEgdmFsaWQgc2V0dXBcbiAgaWYoIXZhbGlkICYmIGlkICE9IG51bGwpe1xuICAgIHRocm93IG5ldyBFcnJvcihcIkFyZ3VtZW50IHBhc3NlZCBpbiBtdXN0IGJlIGEgc2luZ2xlIFN0cmluZyBvZiAxMiBieXRlcyBvciBhIHN0cmluZyBvZiAyNCBoZXggY2hhcmFjdGVyc1wiKTtcbiAgfSBlbHNlIGlmKHZhbGlkICYmIHR5cGVvZiBpZCA9PSAnc3RyaW5nJyAmJiBpZC5sZW5ndGggPT0gMjQpIHtcbiAgICByZXR1cm4gT2JqZWN0SWQuY3JlYXRlRnJvbUhleFN0cmluZyhpZCk7XG4gIH0gZWxzZSBpZihpZCA9PSBudWxsIHx8IHR5cGVvZiBpZCA9PSAnbnVtYmVyJykge1xuICAgIC8vIGNvbnZlcnQgdG8gMTIgYnl0ZSBiaW5hcnkgc3RyaW5nXG4gICAgdGhpcy5pZCA9IHRoaXMuZ2VuZXJhdGUoaWQpO1xuICB9IGVsc2UgaWYoaWQgIT0gbnVsbCAmJiBpZC5sZW5ndGggPT09IDEyKSB7XG4gICAgLy8gYXNzdW1lIDEyIGJ5dGUgc3RyaW5nXG4gICAgdGhpcy5pZCA9IGlkO1xuICB9XG5cbiAgaWYoT2JqZWN0SWQuY2FjaGVIZXhTdHJpbmcpIHRoaXMuX19pZCA9IHRoaXMudG9IZXhTdHJpbmcoKTtcbn1cblxuLy8gUHJlY29tcHV0ZWQgaGV4IHRhYmxlIGVuYWJsZXMgc3BlZWR5IGhleCBzdHJpbmcgY29udmVyc2lvblxudmFyIGhleFRhYmxlID0gW107XG5mb3IgKHZhciBpID0gMDsgaSA8IDI1NjsgaSsrKSB7XG4gIGhleFRhYmxlW2ldID0gKGkgPD0gMTUgPyAnMCcgOiAnJykgKyBpLnRvU3RyaW5nKDE2KTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gdGhlIE9iamVjdElkIGlkIGFzIGEgMjQgYnl0ZSBoZXggc3RyaW5nIHJlcHJlc2VudGF0aW9uXG4gKlxuICogQG1ldGhvZFxuICogQHJldHVybiB7c3RyaW5nfSByZXR1cm4gdGhlIDI0IGJ5dGUgaGV4IHN0cmluZyByZXByZXNlbnRhdGlvbi5cbiAqL1xuT2JqZWN0SWQucHJvdG90eXBlLnRvSGV4U3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIGlmKE9iamVjdElkLmNhY2hlSGV4U3RyaW5nICYmIHRoaXMuX19pZCkgcmV0dXJuIHRoaXMuX19pZDtcblxuICB2YXIgaGV4U3RyaW5nID0gJyc7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmlkLmxlbmd0aDsgaSsrKSB7XG4gICAgaGV4U3RyaW5nICs9IGhleFRhYmxlW3RoaXMuaWQuY2hhckNvZGVBdChpKV07XG4gIH1cblxuICBpZihPYmplY3RJZC5jYWNoZUhleFN0cmluZykgdGhpcy5fX2lkID0gaGV4U3RyaW5nO1xuICByZXR1cm4gaGV4U3RyaW5nO1xufTtcblxuLyoqXG4gKiBVcGRhdGUgdGhlIE9iamVjdElkIGluZGV4IHVzZWQgaW4gZ2VuZXJhdGluZyBuZXcgT2JqZWN0SWQncyBvbiB0aGUgZHJpdmVyXG4gKlxuICogQG1ldGhvZFxuICogQHJldHVybiB7bnVtYmVyfSByZXR1cm5zIG5leHQgaW5kZXggdmFsdWUuXG4gKiBAaWdub3JlXG4gKi9cbk9iamVjdElkLnByb3RvdHlwZS5nZXRfaW5jID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBPYmplY3RJZC5pbmRleCA9IChPYmplY3RJZC5pbmRleCArIDEpICUgMHhGRkZGRkY7XG59O1xuXG4vKipcbiAqIFVwZGF0ZSB0aGUgT2JqZWN0SWQgaW5kZXggdXNlZCBpbiBnZW5lcmF0aW5nIG5ldyBPYmplY3RJZCdzIG9uIHRoZSBkcml2ZXJcbiAqXG4gKiBAbWV0aG9kXG4gKiBAcmV0dXJuIHtudW1iZXJ9IHJldHVybnMgbmV4dCBpbmRleCB2YWx1ZS5cbiAqIEBpZ25vcmVcbiAqL1xuT2JqZWN0SWQucHJvdG90eXBlLmdldEluYyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5nZXRfaW5jKCk7XG59O1xuXG4vKipcbiAqIEdlbmVyYXRlIGEgMTIgYnl0ZSBpZCBzdHJpbmcgdXNlZCBpbiBPYmplY3RJZCdzXG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtIHtudW1iZXJ9IFt0aW1lXSBvcHRpb25hbCBwYXJhbWV0ZXIgYWxsb3dpbmcgdG8gcGFzcyBpbiBhIHNlY29uZCBiYXNlZCB0aW1lc3RhbXAuXG4gKiBAcmV0dXJuIHtzdHJpbmd9IHJldHVybiB0aGUgMTIgYnl0ZSBpZCBiaW5hcnkgc3RyaW5nLlxuICovXG5PYmplY3RJZC5wcm90b3R5cGUuZ2VuZXJhdGUgPSBmdW5jdGlvbih0aW1lKSB7XG4gIGlmICgnbnVtYmVyJyAhPSB0eXBlb2YgdGltZSkge1xuICAgIHRpbWUgPSBwYXJzZUludChEYXRlLm5vdygpLzEwMDAsMTApO1xuICB9XG5cbiAgdmFyIHRpbWU0Qnl0ZXMgPSBCaW5hcnlQYXJzZXIuZW5jb2RlSW50KHRpbWUsIDMyLCB0cnVlLCB0cnVlKTtcbiAgLyogZm9yIHRpbWUtYmFzZWQgT2JqZWN0SWQgdGhlIGJ5dGVzIGZvbGxvd2luZyB0aGUgdGltZSB3aWxsIGJlIHplcm9lZCAqL1xuICB2YXIgbWFjaGluZTNCeXRlcyA9IEJpbmFyeVBhcnNlci5lbmNvZGVJbnQoTUFDSElORV9JRCwgMjQsIGZhbHNlKTtcbiAgdmFyIHBpZDJCeXRlcyA9IEJpbmFyeVBhcnNlci5mcm9tU2hvcnQodHlwZW9mIHByb2Nlc3MgPT09ICd1bmRlZmluZWQnID8gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwKSA6IHByb2Nlc3MucGlkKTtcbiAgdmFyIGluZGV4M0J5dGVzID0gQmluYXJ5UGFyc2VyLmVuY29kZUludCh0aGlzLmdldF9pbmMoKSwgMjQsIGZhbHNlLCB0cnVlKTtcblxuICByZXR1cm4gdGltZTRCeXRlcyArIG1hY2hpbmUzQnl0ZXMgKyBwaWQyQnl0ZXMgKyBpbmRleDNCeXRlcztcbn07XG5cbi8qKlxuICogQ29udmVydHMgdGhlIGlkIGludG8gYSAyNCBieXRlIGhleCBzdHJpbmcgZm9yIHByaW50aW5nXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSByZXR1cm4gdGhlIDI0IGJ5dGUgaGV4IHN0cmluZyByZXByZXNlbnRhdGlvbi5cbiAqIEBpZ25vcmVcbiAqL1xuT2JqZWN0SWQucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLnRvSGV4U3RyaW5nKCk7XG59O1xuXG4vKipcbiAqIENvbnZlcnRzIHRvIGl0cyBKU09OIHJlcHJlc2VudGF0aW9uLlxuICpcbiAqIEByZXR1cm4ge1N0cmluZ30gcmV0dXJuIHRoZSAyNCBieXRlIGhleCBzdHJpbmcgcmVwcmVzZW50YXRpb24uXG4gKiBAaWdub3JlXG4gKi9cbk9iamVjdElkLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMudG9IZXhTdHJpbmcoKTtcbn07XG5cbi8qKlxuICogQ29tcGFyZXMgdGhlIGVxdWFsaXR5IG9mIHRoaXMgT2JqZWN0SWQgd2l0aCBgb3RoZXJJRGAuXG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtIHtvYmplY3R9IG90aGVySUQgT2JqZWN0SWQgaW5zdGFuY2UgdG8gY29tcGFyZSBhZ2FpbnN0LlxuICogQHJldHVybiB7Ym9vbGVhbn0gdGhlIHJlc3VsdCBvZiBjb21wYXJpbmcgdHdvIE9iamVjdElkJ3NcbiAqL1xuT2JqZWN0SWQucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAob3RoZXJJRCkge1xuICBpZihvdGhlcklEID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgdmFyIGlkID0gKG90aGVySUQgaW5zdGFuY2VvZiBPYmplY3RJZCB8fCBvdGhlcklELnRvSGV4U3RyaW5nKVxuICAgID8gb3RoZXJJRC5pZFxuICAgIDogT2JqZWN0SWQuY3JlYXRlRnJvbUhleFN0cmluZyhvdGhlcklEKS5pZDtcblxuICByZXR1cm4gdGhpcy5pZCA9PT0gaWQ7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGdlbmVyYXRpb24gZGF0ZSAoYWNjdXJhdGUgdXAgdG8gdGhlIHNlY29uZCkgdGhhdCB0aGlzIElEIHdhcyBnZW5lcmF0ZWQuXG4gKlxuICogQG1ldGhvZFxuICogQHJldHVybiB7ZGF0ZX0gdGhlIGdlbmVyYXRpb24gZGF0ZVxuICovXG5PYmplY3RJZC5wcm90b3R5cGUuZ2V0VGltZXN0YW1wID0gZnVuY3Rpb24oKSB7XG4gIHZhciB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpO1xuICB0aW1lc3RhbXAuc2V0VGltZShNYXRoLmZsb29yKEJpbmFyeVBhcnNlci5kZWNvZGVJbnQodGhpcy5pZC5zdWJzdHJpbmcoMCw0KSwgMzIsIHRydWUsIHRydWUpKSAqIDEwMDApO1xuICByZXR1cm4gdGltZXN0YW1wO1xufTtcblxuLyoqXG4gKiBAaWdub3JlXG4gKi9cbk9iamVjdElkLmluZGV4ID0gcGFyc2VJbnQoTWF0aC5yYW5kb20oKSAqIDB4RkZGRkZGLCAxMCk7XG5cbi8qKlxuICogQGlnbm9yZVxuICovXG5PYmplY3RJZC5jcmVhdGVQayA9IGZ1bmN0aW9uIGNyZWF0ZVBrICgpIHtcbiAgcmV0dXJuIG5ldyBPYmplY3RJZCgpO1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIE9iamVjdElkIGZyb20gYSBzZWNvbmQgYmFzZWQgbnVtYmVyLCB3aXRoIHRoZSByZXN0IG9mIHRoZSBPYmplY3RJZCB6ZXJvZWQgb3V0LiBVc2VkIGZvciBjb21wYXJpc29ucyBvciBzb3J0aW5nIHRoZSBPYmplY3RJZC5cbiAqXG4gKiBAbWV0aG9kXG4gKiBAcGFyYW0ge251bWJlcn0gdGltZSBhbiBpbnRlZ2VyIG51bWJlciByZXByZXNlbnRpbmcgYSBudW1iZXIgb2Ygc2Vjb25kcy5cbiAqIEByZXR1cm4ge09iamVjdElkfSByZXR1cm4gdGhlIGNyZWF0ZWQgT2JqZWN0SWRcbiAqL1xuT2JqZWN0SWQuY3JlYXRlRnJvbVRpbWUgPSBmdW5jdGlvbiBjcmVhdGVGcm9tVGltZSAodGltZSkge1xuICB2YXIgaWQgPSBCaW5hcnlQYXJzZXIuZW5jb2RlSW50KHRpbWUsIDMyLCB0cnVlLCB0cnVlKSArXG4gICAgQmluYXJ5UGFyc2VyLmVuY29kZUludCgwLCA2NCwgdHJ1ZSwgdHJ1ZSk7XG4gIHJldHVybiBuZXcgT2JqZWN0SWQoaWQpO1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIE9iamVjdElkIGZyb20gYSBoZXggc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGFuIE9iamVjdElkLlxuICpcbiAqIEBtZXRob2RcbiAqIEBwYXJhbSB7c3RyaW5nfSBoZXhTdHJpbmcgY3JlYXRlIGEgT2JqZWN0SWQgZnJvbSBhIHBhc3NlZCBpbiAyNCBieXRlIGhleHN0cmluZy5cbiAqIEByZXR1cm4ge09iamVjdElkfSByZXR1cm4gdGhlIGNyZWF0ZWQgT2JqZWN0SWRcbiAqL1xuT2JqZWN0SWQuY3JlYXRlRnJvbUhleFN0cmluZyA9IGZ1bmN0aW9uIGNyZWF0ZUZyb21IZXhTdHJpbmcgKGhleFN0cmluZykge1xuICAvLyBUaHJvdyBhbiBlcnJvciBpZiBpdCdzIG5vdCBhIHZhbGlkIHNldHVwXG4gIGlmKHR5cGVvZiBoZXhTdHJpbmcgPT09ICd1bmRlZmluZWQnIHx8IGhleFN0cmluZyAhPSBudWxsICYmIGhleFN0cmluZy5sZW5ndGggIT0gMjQpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQXJndW1lbnQgcGFzc2VkIGluIG11c3QgYmUgYSBzaW5nbGUgU3RyaW5nIG9mIDEyIGJ5dGVzIG9yIGEgc3RyaW5nIG9mIDI0IGhleCBjaGFyYWN0ZXJzXCIpO1xuXG4gIHZhciBsZW4gPSBoZXhTdHJpbmcubGVuZ3RoO1xuXG4gIGlmKGxlbiA+IDEyKjIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0lkIGNhbm5vdCBiZSBsb25nZXIgdGhhbiAxMiBieXRlcycpO1xuICB9XG5cbiAgdmFyIHJlc3VsdCA9ICcnXG4gICAgLCBzdHJpbmdcbiAgICAsIG51bWJlcjtcblxuICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuOyBpbmRleCArPSAyKSB7XG4gICAgc3RyaW5nID0gaGV4U3RyaW5nLnN1YnN0cihpbmRleCwgMik7XG4gICAgbnVtYmVyID0gcGFyc2VJbnQoc3RyaW5nLCAxNik7XG4gICAgcmVzdWx0ICs9IEJpbmFyeVBhcnNlci5mcm9tQnl0ZShudW1iZXIpO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBPYmplY3RJZChyZXN1bHQsIGhleFN0cmluZyk7XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiBhIHZhbHVlIGlzIGEgdmFsaWQgYnNvbiBPYmplY3RJZFxuICpcbiAqIEBtZXRob2RcbiAqIEByZXR1cm4ge2Jvb2xlYW59IHJldHVybiB0cnVlIGlmIHRoZSB2YWx1ZSBpcyBhIHZhbGlkIGJzb24gT2JqZWN0SWQsIHJldHVybiBmYWxzZSBvdGhlcndpc2UuXG4gKi9cbk9iamVjdElkLmlzVmFsaWQgPSBmdW5jdGlvbiBpc1ZhbGlkKGlkKSB7XG4gIGlmKGlkID09IG51bGwpIHJldHVybiBmYWxzZTtcblxuICBpZihpZCAhPSBudWxsICYmICdudW1iZXInICE9IHR5cGVvZiBpZCAmJiAoaWQubGVuZ3RoICE9IDEyICYmIGlkLmxlbmd0aCAhPSAyNCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0gZWxzZSB7XG4gICAgLy8gQ2hlY2sgc3BlY2lmaWNhbGx5IGZvciBoZXggY29ycmVjdG5lc3NcbiAgICBpZih0eXBlb2YgaWQgPT0gJ3N0cmluZycgJiYgaWQubGVuZ3RoID09IDI0KSByZXR1cm4gY2hlY2tGb3JIZXhSZWdFeHAudGVzdChpZCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn07XG5cbi8qIVxuICogQGlnbm9yZVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoT2JqZWN0SWQucHJvdG90eXBlLCBcImdlbmVyYXRpb25UaW1lXCIsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZVxuICAsIGdldDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBNYXRoLmZsb29yKEJpbmFyeVBhcnNlci5kZWNvZGVJbnQodGhpcy5pZC5zdWJzdHJpbmcoMCw0KSwgMzIsIHRydWUsIHRydWUpKTtcbiAgfVxuICAsIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgdmFyIHZhbHVlID0gQmluYXJ5UGFyc2VyLmVuY29kZUludCh2YWx1ZSwgMzIsIHRydWUsIHRydWUpO1xuICAgIHRoaXMuaWQgPSB2YWx1ZSArIHRoaXMuaWQuc3Vic3RyKDQpO1xuICAgIC8vIGRlbGV0ZSB0aGlzLl9faWQ7XG4gICAgdGhpcy50b0hleFN0cmluZygpO1xuICB9XG59KTtcblxuLyoqXG4gKiBFeHBvc2UuXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gT2JqZWN0SWQ7XG5tb2R1bGUuZXhwb3J0cy5PYmplY3RJZCA9IE9iamVjdElkO1xufSkuY2FsbCh0aGlzLHJlcXVpcmUoJ19wcm9jZXNzJykpIiwiKGZ1bmN0aW9uIChwcm9jZXNzLGdsb2JhbCxCdWZmZXIpe1xuJ3VzZSBzdHJpY3QnO1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIE9iamVjdElkID0gcmVxdWlyZSgnLi90eXBlcy9vYmplY3RpZCcpXG4gICwgbXBhdGggPSByZXF1aXJlKCcuL21wYXRoJylcbiAgLCBTdG9yYWdlQXJyYXlcbiAgLCBEb2N1bWVudDtcblxuZXhwb3J0cy5tcGF0aCA9IG1wYXRoO1xuXG4vKipcbiAqIFBsdXJhbGl6YXRpb24gcnVsZXMuXG4gKlxuICogVGhlc2UgcnVsZXMgYXJlIGFwcGxpZWQgd2hpbGUgcHJvY2Vzc2luZyB0aGUgYXJndW1lbnQgdG8gYHBsdXJhbGl6ZWAuXG4gKlxuICovXG5leHBvcnRzLnBsdXJhbGl6YXRpb24gPSBbXG4gIFsvKG0pYW4kL2dpLCAnJDFlbiddLFxuICBbLyhwZSlyc29uJC9naSwgJyQxb3BsZSddLFxuICBbLyhjaGlsZCkkL2dpLCAnJDFyZW4nXSxcbiAgWy9eKG94KSQvZ2ksICckMWVuJ10sXG4gIFsvKGF4fHRlc3QpaXMkL2dpLCAnJDFlcyddLFxuICBbLyhvY3RvcHx2aXIpdXMkL2dpLCAnJDFpJ10sXG4gIFsvKGFsaWFzfHN0YXR1cykkL2dpLCAnJDFlcyddLFxuICBbLyhidSlzJC9naSwgJyQxc2VzJ10sXG4gIFsvKGJ1ZmZhbHx0b21hdHxwb3RhdClvJC9naSwgJyQxb2VzJ10sXG4gIFsvKFt0aV0pdW0kL2dpLCAnJDFhJ10sXG4gIFsvc2lzJC9naSwgJ3NlcyddLFxuICBbLyg/OihbXmZdKWZlfChbbHJdKWYpJC9naSwgJyQxJDJ2ZXMnXSxcbiAgWy8oaGl2ZSkkL2dpLCAnJDFzJ10sXG4gIFsvKFteYWVpb3V5XXxxdSl5JC9naSwgJyQxaWVzJ10sXG4gIFsvKHh8Y2h8c3N8c2gpJC9naSwgJyQxZXMnXSxcbiAgWy8obWF0cnx2ZXJ0fGluZClpeHxleCQvZ2ksICckMWljZXMnXSxcbiAgWy8oW218bF0pb3VzZSQvZ2ksICckMWljZSddLFxuICBbLyhrbnx3fGwpaWZlJC9naSwgJyQxaXZlcyddLFxuICBbLyhxdWl6KSQvZ2ksICckMXplcyddLFxuICBbL3MkL2dpLCAncyddLFxuICBbLyhbXmEtel0pJC8sICckMSddLFxuICBbLyQvZ2ksICdzJ11cbl07XG52YXIgcnVsZXMgPSBleHBvcnRzLnBsdXJhbGl6YXRpb247XG5cbi8qKlxuICogVW5jb3VudGFibGUgd29yZHMuXG4gKlxuICogVGhlc2Ugd29yZHMgYXJlIGFwcGxpZWQgd2hpbGUgcHJvY2Vzc2luZyB0aGUgYXJndW1lbnQgdG8gYHBsdXJhbGl6ZWAuXG4gKiBAYXBpIHB1YmxpY1xuICovXG5leHBvcnRzLnVuY291bnRhYmxlcyA9IFtcbiAgJ2FkdmljZScsXG4gICdlbmVyZ3knLFxuICAnZXhjcmV0aW9uJyxcbiAgJ2RpZ2VzdGlvbicsXG4gICdjb29wZXJhdGlvbicsXG4gICdoZWFsdGgnLFxuICAnanVzdGljZScsXG4gICdsYWJvdXInLFxuICAnbWFjaGluZXJ5JyxcbiAgJ2VxdWlwbWVudCcsXG4gICdpbmZvcm1hdGlvbicsXG4gICdwb2xsdXRpb24nLFxuICAnc2V3YWdlJyxcbiAgJ3BhcGVyJyxcbiAgJ21vbmV5JyxcbiAgJ3NwZWNpZXMnLFxuICAnc2VyaWVzJyxcbiAgJ3JhaW4nLFxuICAncmljZScsXG4gICdmaXNoJyxcbiAgJ3NoZWVwJyxcbiAgJ21vb3NlJyxcbiAgJ2RlZXInLFxuICAnbmV3cycsXG4gICdleHBlcnRpc2UnLFxuICAnc3RhdHVzJyxcbiAgJ21lZGlhJ1xuXTtcbnZhciB1bmNvdW50YWJsZXMgPSBleHBvcnRzLnVuY291bnRhYmxlcztcblxuLyohXG4gKiBQbHVyYWxpemUgZnVuY3Rpb24uXG4gKlxuICogQGF1dGhvciBUSiBIb2xvd2F5Y2h1ayAoZXh0cmFjdGVkIGZyb20gX2V4dC5qc18pXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyaW5nIHRvIHBsdXJhbGl6ZVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZXhwb3J0cy5wbHVyYWxpemUgPSBmdW5jdGlvbiAoc3RyKSB7XG4gIHZhciBmb3VuZDtcbiAgaWYgKCF+dW5jb3VudGFibGVzLmluZGV4T2Yoc3RyLnRvTG93ZXJDYXNlKCkpKXtcbiAgICBmb3VuZCA9IHJ1bGVzLmZpbHRlcihmdW5jdGlvbihydWxlKXtcbiAgICAgIHJldHVybiBzdHIubWF0Y2gocnVsZVswXSk7XG4gICAgfSk7XG4gICAgaWYgKGZvdW5kWzBdKSByZXR1cm4gc3RyLnJlcGxhY2UoZm91bmRbMF1bMF0sIGZvdW5kWzBdWzFdKTtcbiAgfVxuICByZXR1cm4gc3RyO1xufTtcblxuLyohXG4gKiBEZXRlcm1pbmVzIGlmIGBhYCBhbmQgYGJgIGFyZSBkZWVwIGVxdWFsLlxuICpcbiAqIE1vZGlmaWVkIGZyb20gbm9kZS9saWIvYXNzZXJ0LmpzXG4gKiBNb2RpZmllZCBmcm9tIG1vbmdvb3NlL3V0aWxzLmpzXG4gKlxuICogQHBhcmFtIHsqfSBhIGEgdmFsdWUgdG8gY29tcGFyZSB0byBgYmBcbiAqIEBwYXJhbSB7Kn0gYiBhIHZhbHVlIHRvIGNvbXBhcmUgdG8gYGFgXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cbmV4cG9ydHMuZGVlcEVxdWFsID0gZnVuY3Rpb24gZGVlcEVxdWFsIChhLCBiKSB7XG4gIGlmIChhIGluc3RhbmNlb2YgT2JqZWN0SWQgJiYgYiBpbnN0YW5jZW9mIE9iamVjdElkKSB7XG4gICAgcmV0dXJuIGEudG9TdHJpbmcoKSA9PT0gYi50b1N0cmluZygpO1xuICB9XG5cbiAgLy8gSGFuZGxlIFN0b3JhZ2VOdW1iZXJzXG4gIGlmIChhIGluc3RhbmNlb2YgTnVtYmVyICYmIGIgaW5zdGFuY2VvZiBOdW1iZXIpIHtcbiAgICByZXR1cm4gYS52YWx1ZU9mKCkgPT09IGIudmFsdWVPZigpO1xuICB9XG5cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihhKSkge1xuICAgIHJldHVybiBhLmVxdWFscyhiKTtcbiAgfVxuXG4gIGlmIChpc1N0b3JhZ2VPYmplY3QoYSkpIGEgPSBhLnRvT2JqZWN0KCk7XG4gIGlmIChpc1N0b3JhZ2VPYmplY3QoYikpIGIgPSBiLnRvT2JqZWN0KCk7XG5cbiAgcmV0dXJuIF8uaXNFcXVhbChhLCBiKTtcbn07XG5cblxuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG5mdW5jdGlvbiBpc1JlZ0V4cCAobykge1xuICByZXR1cm4gJ29iamVjdCcgPT0gdHlwZW9mIG9cbiAgICAgICYmICdbb2JqZWN0IFJlZ0V4cF0nID09IHRvU3RyaW5nLmNhbGwobyk7XG59XG5cbmZ1bmN0aW9uIGNsb25lUmVnRXhwIChyZWdleHApIHtcbiAgaWYgKCFpc1JlZ0V4cChyZWdleHApKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignTm90IGEgUmVnRXhwJyk7XG4gIH1cblxuICB2YXIgZmxhZ3MgPSBbXTtcbiAgaWYgKHJlZ2V4cC5nbG9iYWwpIGZsYWdzLnB1c2goJ2cnKTtcbiAgaWYgKHJlZ2V4cC5tdWx0aWxpbmUpIGZsYWdzLnB1c2goJ20nKTtcbiAgaWYgKHJlZ2V4cC5pZ25vcmVDYXNlKSBmbGFncy5wdXNoKCdpJyk7XG4gIHJldHVybiBuZXcgUmVnRXhwKHJlZ2V4cC5zb3VyY2UsIGZsYWdzLmpvaW4oJycpKTtcbn1cblxuLyohXG4gKiBPYmplY3QgY2xvbmUgd2l0aCBTdG9yYWdlIG5hdGl2ZXMgc3VwcG9ydC5cbiAqXG4gKiBJZiBvcHRpb25zLm1pbmltaXplIGlzIHRydWUsIGNyZWF0ZXMgYSBtaW5pbWFsIGRhdGEgb2JqZWN0LiBFbXB0eSBvYmplY3RzIGFuZCB1bmRlZmluZWQgdmFsdWVzIHdpbGwgbm90IGJlIGNsb25lZC4gVGhpcyBtYWtlcyB0aGUgZGF0YSBwYXlsb2FkIHNlbnQgdG8gTW9uZ29EQiBhcyBzbWFsbCBhcyBwb3NzaWJsZS5cbiAqXG4gKiBGdW5jdGlvbnMgYXJlIG5ldmVyIGNsb25lZC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIHRoZSBvYmplY3QgdG8gY2xvbmVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtPYmplY3R9IHRoZSBjbG9uZWQgb2JqZWN0XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZXhwb3J0cy5jbG9uZSA9IGZ1bmN0aW9uIGNsb25lIChvYmosIG9wdGlvbnMpIHtcbiAgaWYgKG9iaiA9PT0gdW5kZWZpbmVkIHx8IG9iaiA9PT0gbnVsbClcbiAgICByZXR1cm4gb2JqO1xuXG4gIGlmICggXy5pc0FycmF5KCBvYmogKSApIHtcbiAgICByZXR1cm4gY2xvbmVBcnJheSggb2JqLCBvcHRpb25zICk7XG4gIH1cblxuICBpZiAoIGlzU3RvcmFnZU9iamVjdCggb2JqICkgKSB7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5qc29uICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBvYmoudG9KU09OKSB7XG4gICAgICByZXR1cm4gb2JqLnRvSlNPTiggb3B0aW9ucyApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gb2JqLnRvT2JqZWN0KCBvcHRpb25zICk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCBvYmouY29uc3RydWN0b3IgKSB7XG4gICAgc3dpdGNoICggZ2V0RnVuY3Rpb25OYW1lKCBvYmouY29uc3RydWN0b3IgKSkge1xuICAgICAgY2FzZSAnT2JqZWN0JzpcbiAgICAgICAgcmV0dXJuIGNsb25lT2JqZWN0KG9iaiwgb3B0aW9ucyk7XG4gICAgICBjYXNlICdEYXRlJzpcbiAgICAgICAgcmV0dXJuIG5ldyBvYmouY29uc3RydWN0b3IoICtvYmogKTtcbiAgICAgIGNhc2UgJ1JlZ0V4cCc6XG4gICAgICAgIHJldHVybiBjbG9uZVJlZ0V4cCggb2JqICk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICAvLyBpZ25vcmVcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgaWYgKCBvYmogaW5zdGFuY2VvZiBPYmplY3RJZCApIHtcbiAgICBpZiAoIG9wdGlvbnMuZGVwb3B1bGF0ZSApe1xuICAgICAgcmV0dXJuIG9iai50b1N0cmluZygpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgT2JqZWN0SWQoIG9iai5pZCApO1xuICB9XG5cbiAgaWYgKCAhb2JqLmNvbnN0cnVjdG9yICYmIF8uaXNPYmplY3QoIG9iaiApICkge1xuICAgIC8vIG9iamVjdCBjcmVhdGVkIHdpdGggT2JqZWN0LmNyZWF0ZShudWxsKVxuICAgIHJldHVybiBjbG9uZU9iamVjdCggb2JqLCBvcHRpb25zICk7XG4gIH1cblxuICBpZiAoIG9iai52YWx1ZU9mICl7XG4gICAgcmV0dXJuIG9iai52YWx1ZU9mKCk7XG4gIH1cbn07XG52YXIgY2xvbmUgPSBleHBvcnRzLmNsb25lO1xuXG4vKiFcbiAqIGlnbm9yZVxuICovXG5mdW5jdGlvbiBjbG9uZU9iamVjdCAob2JqLCBvcHRpb25zKSB7XG4gIHZhciByZXRhaW5LZXlPcmRlciA9IG9wdGlvbnMgJiYgb3B0aW9ucy5yZXRhaW5LZXlPcmRlclxuICAgICwgbWluaW1pemUgPSBvcHRpb25zICYmIG9wdGlvbnMubWluaW1pemVcbiAgICAsIHJldCA9IHt9XG4gICAgLCBoYXNLZXlzXG4gICAgLCBrZXlzXG4gICAgLCB2YWxcbiAgICAsIGtcbiAgICAsIGk7XG5cbiAgaWYgKCByZXRhaW5LZXlPcmRlciApIHtcbiAgICBmb3IgKGsgaW4gb2JqKSB7XG4gICAgICB2YWwgPSBjbG9uZSggb2JqW2tdLCBvcHRpb25zICk7XG5cbiAgICAgIGlmICggIW1pbmltaXplIHx8ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHZhbCkgKSB7XG4gICAgICAgIGhhc0tleXMgfHwgKGhhc0tleXMgPSB0cnVlKTtcbiAgICAgICAgcmV0W2tdID0gdmFsO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBmYXN0ZXJcblxuICAgIGtleXMgPSBPYmplY3Qua2V5cyggb2JqICk7XG4gICAgaSA9IGtleXMubGVuZ3RoO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgayA9IGtleXNbaV07XG4gICAgICB2YWwgPSBjbG9uZShvYmpba10sIG9wdGlvbnMpO1xuXG4gICAgICBpZiAoIW1pbmltaXplIHx8ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHZhbCkpIHtcbiAgICAgICAgaWYgKCFoYXNLZXlzKSBoYXNLZXlzID0gdHJ1ZTtcbiAgICAgICAgcmV0W2tdID0gdmFsO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtaW5pbWl6ZVxuICAgID8gaGFzS2V5cyAmJiByZXRcbiAgICA6IHJldDtcbn1cblxuZnVuY3Rpb24gY2xvbmVBcnJheSAoYXJyLCBvcHRpb25zKSB7XG4gIHZhciByZXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcnIubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgcmV0LnB1c2goIGNsb25lKCBhcnJbaV0sIG9wdGlvbnMgKSApO1xuICB9XG4gIHJldHVybiByZXQ7XG59XG5cbi8qIVxuICogTWVyZ2VzIGBmcm9tYCBpbnRvIGB0b2Agd2l0aG91dCBvdmVyd3JpdGluZyBleGlzdGluZyBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB0b1xuICogQHBhcmFtIHtPYmplY3R9IGZyb21cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5leHBvcnRzLm1lcmdlID0gZnVuY3Rpb24gbWVyZ2UgKHRvLCBmcm9tKSB7XG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZnJvbSlcbiAgICAsIGkgPSBrZXlzLmxlbmd0aFxuICAgICwga2V5O1xuXG4gIHdoaWxlIChpLS0pIHtcbiAgICBrZXkgPSBrZXlzW2ldO1xuICAgIGlmICgndW5kZWZpbmVkJyA9PT0gdHlwZW9mIHRvW2tleV0pIHtcbiAgICAgIHRvW2tleV0gPSBmcm9tW2tleV07XG4gICAgfSBlbHNlIGlmICggXy5pc09iamVjdChmcm9tW2tleV0pICkge1xuICAgICAgbWVyZ2UodG9ba2V5XSwgZnJvbVtrZXldKTtcbiAgICB9XG4gIH1cbn07XG5cbi8qIVxuICogR2VuZXJhdGVzIGEgcmFuZG9tIHN0cmluZ1xuICpcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmV4cG9ydHMucmFuZG9tID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gTWF0aC5yYW5kb20oKS50b1N0cmluZygpLnN1YnN0cigzKTtcbn07XG5cblxuLyohXG4gKiBSZXR1cm5zIGlmIGB2YCBpcyBhIHN0b3JhZ2Ugb2JqZWN0IHRoYXQgaGFzIGEgYHRvT2JqZWN0KClgIG1ldGhvZCB3ZSBjYW4gdXNlLlxuICpcbiAqIFRoaXMgaXMgZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBsaWJzIGxpa2UgRGF0ZS5qcyB3aGljaCBkbyBmb29saXNoIHRoaW5ncyB0byBOYXRpdmVzLlxuICpcbiAqIEBwYXJhbSB7Kn0gdlxuICogQGFwaSBwcml2YXRlXG4gKi9cbmV4cG9ydHMuaXNTdG9yYWdlT2JqZWN0ID0gZnVuY3Rpb24gKCB2ICkge1xuICBEb2N1bWVudCB8fCAoRG9jdW1lbnQgPSByZXF1aXJlKCcuL2RvY3VtZW50JykpO1xuICAvL1N0b3JhZ2VBcnJheSB8fCAoU3RvcmFnZUFycmF5ID0gcmVxdWlyZSgnLi90eXBlcy9hcnJheScpKTtcblxuICByZXR1cm4gdiBpbnN0YW5jZW9mIERvY3VtZW50IHx8XG4gICAgICAgKCB2ICYmIHYuaXNTdG9yYWdlQXJyYXkgKTtcbn07XG52YXIgaXNTdG9yYWdlT2JqZWN0ID0gZXhwb3J0cy5pc1N0b3JhZ2VPYmplY3Q7XG5cbi8qIVxuICogUmV0dXJuIHRoZSB2YWx1ZSBvZiBgb2JqYCBhdCB0aGUgZ2l2ZW4gYHBhdGhgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKi9cblxuZXhwb3J0cy5nZXRWYWx1ZSA9IGZ1bmN0aW9uIChwYXRoLCBvYmosIG1hcCkge1xuICByZXR1cm4gbXBhdGguZ2V0KHBhdGgsIG9iaiwgJ19kb2MnLCBtYXApO1xufTtcblxuLyohXG4gKiBTZXRzIHRoZSB2YWx1ZSBvZiBgb2JqYCBhdCB0aGUgZ2l2ZW4gYHBhdGhgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge0FueXRoaW5nfSB2YWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqL1xuXG5leHBvcnRzLnNldFZhbHVlID0gZnVuY3Rpb24gKHBhdGgsIHZhbCwgb2JqLCBtYXApIHtcbiAgbXBhdGguc2V0KHBhdGgsIHZhbCwgb2JqLCAnX2RvYycsIG1hcCk7XG59O1xuXG52YXIgckZ1bmN0aW9uTmFtZSA9IC9eZnVuY3Rpb25cXHMqKFteXFxzKF0rKS87XG5cbmZ1bmN0aW9uIGdldEZ1bmN0aW9uTmFtZSggY3RvciApe1xuICBpZiAoY3Rvci5uYW1lKSB7XG4gICAgcmV0dXJuIGN0b3IubmFtZTtcbiAgfVxuICByZXR1cm4gKGN0b3IudG9TdHJpbmcoKS50cmltKCkubWF0Y2goIHJGdW5jdGlvbk5hbWUgKSB8fCBbXSlbMV07XG59XG5cbmV4cG9ydHMuZ2V0RnVuY3Rpb25OYW1lID0gZ2V0RnVuY3Rpb25OYW1lO1xuXG5leHBvcnRzLnNldEltbWVkaWF0ZSA9IChmdW5jdGlvbigpIHtcbiAgLy8g0JTQu9GPINC/0L7QtNC00LXRgNC20LrQuCDRgtC10YHRgtC+0LIgKNC+0LrRgNGD0LbQtdC90LjQtSBub2RlLmpzKVxuICBpZiAoIHR5cGVvZiBnbG9iYWwgPT09ICdvYmplY3QnICYmIHByb2Nlc3MubmV4dFRpY2sgKSByZXR1cm4gcHJvY2Vzcy5uZXh0VGljaztcbiAgLy8g0JXRgdC70Lgg0LIg0LHRgNCw0YPQt9C10YDQtSDRg9C20LUg0YDQtdCw0LvQuNC30L7QstCw0L0g0Y3RgtC+0YIg0LzQtdGC0L7QtFxuICBpZiAoIHdpbmRvdy5zZXRJbW1lZGlhdGUgKSByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZTtcblxuICB2YXIgaGVhZCA9IHsgfSwgdGFpbCA9IGhlYWQ7IC8vINC+0YfQtdGA0LXQtNGMINCy0YvQt9C+0LLQvtCyLCAxLdGB0LLRj9C30L3Ri9C5INGB0L/QuNGB0L7QulxuXG4gIHZhciBJRCA9IE1hdGgucmFuZG9tKCk7IC8vINGD0L3QuNC60LDQu9GM0L3Ri9C5INC40LTQtdC90YLQuNGE0LjQutCw0YLQvtGAXG5cbiAgZnVuY3Rpb24gb25tZXNzYWdlKGUpIHtcbiAgICBpZihlLmRhdGEgIT0gSUQpIHJldHVybjsgLy8g0L3QtSDQvdCw0YjQtSDRgdC+0L7QsdGJ0LXQvdC40LVcbiAgICBoZWFkID0gaGVhZC5uZXh0O1xuICAgIHZhciBmdW5jID0gaGVhZC5mdW5jO1xuICAgIGRlbGV0ZSBoZWFkLmZ1bmM7XG4gICAgZnVuYygpO1xuICB9XG5cbiAgaWYod2luZG93LmFkZEV2ZW50TGlzdGVuZXIpIHsgLy8gSUU5Kywg0LTRgNGD0LPQuNC1INCx0YDQsNGD0LfQtdGA0YtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIG9ubWVzc2FnZSwgZmFsc2UpO1xuICB9IGVsc2UgeyAvLyBJRThcbiAgICB3aW5kb3cuYXR0YWNoRXZlbnQoICdvbm1lc3NhZ2UnLCBvbm1lc3NhZ2UgKTtcbiAgfVxuXG4gIHJldHVybiB3aW5kb3cucG9zdE1lc3NhZ2UgPyBmdW5jdGlvbihmdW5jKSB7XG4gICAgdGFpbCA9IHRhaWwubmV4dCA9IHsgZnVuYzogZnVuYyB9O1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShJRCwgXCIqXCIpO1xuICB9IDpcbiAgZnVuY3Rpb24oZnVuYykgeyAvLyBJRTw4XG4gICAgc2V0VGltZW91dChmdW5jLCAwKTtcbiAgfTtcbn0oKSk7XG5cbi8vIFBoYW50b21KUyBkb2Vzbid0IHN1cHBvcnQgYmluZCB5ZXRcbmlmICghRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQpIHtcbiAgRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQgPSBmdW5jdGlvbihvVGhpcykge1xuICAgIGlmICh0eXBlb2YgdGhpcyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgLy8g0LHQu9C40LbQsNC50YjQuNC5INCw0L3QsNC70L7QsyDQstC90YPRgtGA0LXQvdC90LXQuSDRhNGD0L3QutGG0LjQuFxuICAgICAgLy8gSXNDYWxsYWJsZSDQsiBFQ01BU2NyaXB0IDVcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0Z1bmN0aW9uLnByb3RvdHlwZS5iaW5kIC0gd2hhdCBpcyB0cnlpbmcgdG8gYmUgYm91bmQgaXMgbm90IGNhbGxhYmxlJyk7XG4gICAgfVxuXG4gICAgdmFyIGFBcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICAgIGZUb0JpbmQgPSB0aGlzLFxuICAgICAgZk5PUCAgICA9IGZ1bmN0aW9uKCkge30sXG4gICAgICBmQm91bmQgID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBmVG9CaW5kLmFwcGx5KHRoaXMgaW5zdGFuY2VvZiBmTk9QICYmIG9UaGlzXG4gICAgICAgICAgICA/IHRoaXNcbiAgICAgICAgICAgIDogb1RoaXMsXG4gICAgICAgICAgYUFyZ3MuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgIH07XG5cbiAgICBmTk9QLnByb3RvdHlwZSA9IHRoaXMucHJvdG90eXBlO1xuICAgIGZCb3VuZC5wcm90b3R5cGUgPSBuZXcgZk5PUCgpO1xuXG4gICAgcmV0dXJuIGZCb3VuZDtcbiAgfTtcbn1cblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoJ19wcm9jZXNzJyksdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSxyZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcikiLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVmlydHVhbFR5cGUgY29uc3RydWN0b3JcbiAqXG4gKiBUaGlzIGlzIHdoYXQgbW9uZ29vc2UgdXNlcyB0byBkZWZpbmUgdmlydHVhbCBhdHRyaWJ1dGVzIHZpYSBgU2NoZW1hLnByb3RvdHlwZS52aXJ0dWFsYC5cbiAqXG4gKiAjIyMjRXhhbXBsZTpcbiAqXG4gKiAgICAgdmFyIGZ1bGxuYW1lID0gc2NoZW1hLnZpcnR1YWwoJ2Z1bGxuYW1lJyk7XG4gKiAgICAgZnVsbG5hbWUgaW5zdGFuY2VvZiBtb25nb29zZS5WaXJ0dWFsVHlwZSAvLyB0cnVlXG4gKlxuICogQHBhcm1hIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gVmlydHVhbFR5cGUgKG9wdGlvbnMsIG5hbWUpIHtcbiAgdGhpcy5wYXRoID0gbmFtZTtcbiAgdGhpcy5nZXR0ZXJzID0gW107XG4gIHRoaXMuc2V0dGVycyA9IFtdO1xuICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xufVxuXG4vKipcbiAqIERlZmluZXMgYSBnZXR0ZXIuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIHZhciB2aXJ0dWFsID0gc2NoZW1hLnZpcnR1YWwoJ2Z1bGxuYW1lJyk7XG4gKiAgICAgdmlydHVhbC5nZXQoZnVuY3Rpb24gKCkge1xuICogICAgICAgcmV0dXJuIHRoaXMubmFtZS5maXJzdCArICcgJyArIHRoaXMubmFtZS5sYXN0O1xuICogICAgIH0pO1xuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKiBAcmV0dXJuIHtWaXJ0dWFsVHlwZX0gdGhpc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5WaXJ0dWFsVHlwZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGZuKSB7XG4gIHRoaXMuZ2V0dGVycy5wdXNoKGZuKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIERlZmluZXMgYSBzZXR0ZXIuXG4gKlxuICogIyMjI0V4YW1wbGU6XG4gKlxuICogICAgIHZhciB2aXJ0dWFsID0gc2NoZW1hLnZpcnR1YWwoJ2Z1bGxuYW1lJyk7XG4gKiAgICAgdmlydHVhbC5zZXQoZnVuY3Rpb24gKHYpIHtcbiAqICAgICAgIHZhciBwYXJ0cyA9IHYuc3BsaXQoJyAnKTtcbiAqICAgICAgIHRoaXMubmFtZS5maXJzdCA9IHBhcnRzWzBdO1xuICogICAgICAgdGhpcy5uYW1lLmxhc3QgPSBwYXJ0c1sxXTtcbiAqICAgICB9KTtcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7VmlydHVhbFR5cGV9IHRoaXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuVmlydHVhbFR5cGUucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChmbikge1xuICB0aGlzLnNldHRlcnMucHVzaChmbik7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBBcHBsaWVzIGdldHRlcnMgdG8gYHZhbHVlYCB1c2luZyBvcHRpb25hbCBgc2NvcGVgLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICogQHBhcmFtIHtPYmplY3R9IHNjb3BlXG4gKiBAcmV0dXJuIHsqfSB0aGUgdmFsdWUgYWZ0ZXIgYXBwbHlpbmcgYWxsIGdldHRlcnNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuVmlydHVhbFR5cGUucHJvdG90eXBlLmFwcGx5R2V0dGVycyA9IGZ1bmN0aW9uICh2YWx1ZSwgc2NvcGUpIHtcbiAgdmFyIHYgPSB2YWx1ZTtcbiAgZm9yICh2YXIgbCA9IHRoaXMuZ2V0dGVycy5sZW5ndGggLSAxOyBsID49IDA7IGwtLSkge1xuICAgIHYgPSB0aGlzLmdldHRlcnNbbF0uY2FsbChzY29wZSwgdiwgdGhpcyk7XG4gIH1cbiAgcmV0dXJuIHY7XG59O1xuXG4vKipcbiAqIEFwcGxpZXMgc2V0dGVycyB0byBgdmFsdWVgIHVzaW5nIG9wdGlvbmFsIGBzY29wZWAuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlXG4gKiBAcGFyYW0ge09iamVjdH0gc2NvcGVcbiAqIEByZXR1cm4geyp9IHRoZSB2YWx1ZSBhZnRlciBhcHBseWluZyBhbGwgc2V0dGVyc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5WaXJ0dWFsVHlwZS5wcm90b3R5cGUuYXBwbHlTZXR0ZXJzID0gZnVuY3Rpb24gKHZhbHVlLCBzY29wZSkge1xuICB2YXIgdiA9IHZhbHVlO1xuICBmb3IgKHZhciBsID0gdGhpcy5zZXR0ZXJzLmxlbmd0aCAtIDE7IGwgPj0gMDsgbC0tKSB7XG4gICAgdiA9IHRoaXMuc2V0dGVyc1tsXS5jYWxsKHNjb3BlLCB2LCB0aGlzKTtcbiAgfVxuICByZXR1cm4gdjtcbn07XG5cbi8qIVxuICogZXhwb3J0c1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gVmlydHVhbFR5cGU7XG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXMtYXJyYXknKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG52YXIga01heExlbmd0aCA9IDB4M2ZmZmZmZmZcblxuLyoqXG4gKiBJZiBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAobW9zdCBjb21wYXRpYmxlLCBldmVuIElFNilcbiAqXG4gKiBCcm93c2VycyB0aGF0IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssIENocm9tZSA3KywgU2FmYXJpIDUuMSssXG4gKiBPcGVyYSAxMS42KywgaU9TIDQuMisuXG4gKlxuICogTm90ZTpcbiAqXG4gKiAtIEltcGxlbWVudGF0aW9uIG11c3Qgc3VwcG9ydCBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcy5cbiAqICAgRmlyZWZveCA0LTI5IGxhY2tlZCBzdXBwb3J0LCBmaXhlZCBpbiBGaXJlZm94IDMwKy5cbiAqICAgU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzguXG4gKlxuICogIC0gQ2hyb21lIDktMTAgaXMgbWlzc2luZyB0aGUgYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbi5cbiAqXG4gKiAgLSBJRTEwIGhhcyBhIGJyb2tlbiBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYXJyYXlzIG9mXG4gKiAgICBpbmNvcnJlY3QgbGVuZ3RoIGluIHNvbWUgc2l0dWF0aW9ucy5cbiAqXG4gKiBXZSBkZXRlY3QgdGhlc2UgYnVnZ3kgYnJvd3NlcnMgYW5kIHNldCBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgIHRvIGBmYWxzZWAgc28gdGhleSB3aWxsXG4gKiBnZXQgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiwgd2hpY2ggaXMgc2xvd2VyIGJ1dCB3aWxsIHdvcmsgY29ycmVjdGx5LlxuICovXG5CdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCA9IChmdW5jdGlvbiAoKSB7XG4gIHRyeSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcigwKVxuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gNDIgPT09IGFyci5mb28oKSAmJiAvLyB0eXBlZCBhcnJheSBpbnN0YW5jZXMgY2FuIGJlIGF1Z21lbnRlZFxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nICYmIC8vIGNocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICAgICAgICBuZXcgVWludDhBcnJheSgxKS5zdWJhcnJheSgxLCAxKS5ieXRlTGVuZ3RoID09PSAwIC8vIGllMTAgaGFzIGJyb2tlbiBgc3ViYXJyYXlgXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufSkoKVxuXG4vKipcbiAqIENsYXNzOiBCdWZmZXJcbiAqID09PT09PT09PT09PT1cbiAqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGFyZSBhdWdtZW50ZWRcbiAqIHdpdGggZnVuY3Rpb24gcHJvcGVydGllcyBmb3IgYWxsIHRoZSBub2RlIGBCdWZmZXJgIEFQSSBmdW5jdGlvbnMuIFdlIHVzZVxuICogYFVpbnQ4QXJyYXlgIHNvIHRoYXQgc3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXQgcmV0dXJuc1xuICogYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogQnkgYXVnbWVudGluZyB0aGUgaW5zdGFuY2VzLCB3ZSBjYW4gYXZvaWQgbW9kaWZ5aW5nIHRoZSBgVWludDhBcnJheWBcbiAqIHByb3RvdHlwZS5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKHN1YmplY3QsIGVuY29kaW5nLCBub1plcm8pXG5cbiAgdmFyIHR5cGUgPSB0eXBlb2Ygc3ViamVjdFxuXG4gIC8vIEZpbmQgdGhlIGxlbmd0aFxuICB2YXIgbGVuZ3RoXG4gIGlmICh0eXBlID09PSAnbnVtYmVyJylcbiAgICBsZW5ndGggPSBzdWJqZWN0ID4gMCA/IHN1YmplY3QgPj4+IDAgOiAwXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKGVuY29kaW5nID09PSAnYmFzZTY0JylcbiAgICAgIHN1YmplY3QgPSBiYXNlNjRjbGVhbihzdWJqZWN0KVxuICAgIGxlbmd0aCA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN1YmplY3QsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdvYmplY3QnICYmIHN1YmplY3QgIT09IG51bGwpIHsgLy8gYXNzdW1lIG9iamVjdCBpcyBhcnJheS1saWtlXG4gICAgaWYgKHN1YmplY3QudHlwZSA9PT0gJ0J1ZmZlcicgJiYgaXNBcnJheShzdWJqZWN0LmRhdGEpKVxuICAgICAgc3ViamVjdCA9IHN1YmplY3QuZGF0YVxuICAgIGxlbmd0aCA9ICtzdWJqZWN0Lmxlbmd0aCA+IDAgPyBNYXRoLmZsb29yKCtzdWJqZWN0Lmxlbmd0aCkgOiAwXG4gIH0gZWxzZVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ211c3Qgc3RhcnQgd2l0aCBudW1iZXIsIGJ1ZmZlciwgYXJyYXkgb3Igc3RyaW5nJylcblxuICBpZiAodGhpcy5sZW5ndGggPiBrTWF4TGVuZ3RoKVxuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIGFsbG9jYXRlIEJ1ZmZlciBsYXJnZXIgdGhhbiBtYXhpbXVtICcgK1xuICAgICAgJ3NpemU6IDB4JyArIGtNYXhMZW5ndGgudG9TdHJpbmcoMTYpICsgJyBieXRlcycpXG5cbiAgdmFyIGJ1ZlxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBQcmVmZXJyZWQ6IFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgYnVmID0gQnVmZmVyLl9hdWdtZW50KG5ldyBVaW50OEFycmF5KGxlbmd0aCkpXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBUSElTIGluc3RhbmNlIG9mIEJ1ZmZlciAoY3JlYXRlZCBieSBgbmV3YClcbiAgICBidWYgPSB0aGlzXG4gICAgYnVmLmxlbmd0aCA9IGxlbmd0aFxuICAgIGJ1Zi5faXNCdWZmZXIgPSB0cnVlXG4gIH1cblxuICB2YXIgaVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgdHlwZW9mIHN1YmplY3QuYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpIHtcbiAgICAvLyBTcGVlZCBvcHRpbWl6YXRpb24gLS0gdXNlIHNldCBpZiB3ZSdyZSBjb3B5aW5nIGZyb20gYSB0eXBlZCBhcnJheVxuICAgIGJ1Zi5fc2V0KHN1YmplY3QpXG4gIH0gZWxzZSBpZiAoaXNBcnJheWlzaChzdWJqZWN0KSkge1xuICAgIC8vIFRyZWF0IGFycmF5LWlzaCBvYmplY3RzIGFzIGEgYnl0ZSBhcnJheVxuICAgIGlmIChCdWZmZXIuaXNCdWZmZXIoc3ViamVjdCkpIHtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKylcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdC5yZWFkVUludDgoaSlcbiAgICB9IGVsc2Uge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKVxuICAgICAgICBidWZbaV0gPSAoKHN1YmplY3RbaV0gJSAyNTYpICsgMjU2KSAlIDI1NlxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGJ1Zi53cml0ZShzdWJqZWN0LCAwLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgIW5vWmVybykge1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgYnVmW2ldID0gMFxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBidWZcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gKGIpIHtcbiAgcmV0dXJuICEhKGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gTWF0aC5taW4oeCwgeSk7IGkgPCBsZW4gJiYgYVtpXSA9PT0gYltpXTsgaSsrKSB7fVxuICBpZiAoaSAhPT0gbGVuKSB7XG4gICAgeCA9IGFbaV1cbiAgICB5ID0gYltpXVxuICB9XG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCwgdG90YWxMZW5ndGgpIHtcbiAgaWYgKCFpc0FycmF5KGxpc3QpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVc2FnZTogQnVmZmVyLmNvbmNhdChsaXN0WywgbGVuZ3RoXSknKVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKDApXG4gIH0gZWxzZSBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gbGlzdFswXVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKHRvdGFsTGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICB0b3RhbExlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgdG90YWxMZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcih0b3RhbExlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IGxpc3RbaV1cbiAgICBpdGVtLmNvcHkoYnVmLCBwb3MpXG4gICAgcG9zICs9IGl0ZW0ubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZlxufVxuXG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGZ1bmN0aW9uIChzdHIsIGVuY29kaW5nKSB7XG4gIHZhciByZXRcbiAgc3RyID0gc3RyICsgJydcbiAgc3dpdGNoIChlbmNvZGluZyB8fCAndXRmOCcpIHtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdyYXcnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aCAqIDJcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggPj4+IDFcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gdXRmOFRvQnl0ZXMoc3RyKS5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IGJhc2U2NFRvQnl0ZXMoc3RyKS5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGhcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbi8vIHByZS1zZXQgZm9yIHZhbHVlcyB0aGF0IG1heSBleGlzdCBpbiB0aGUgZnV0dXJlXG5CdWZmZXIucHJvdG90eXBlLmxlbmd0aCA9IHVuZGVmaW5lZFxuQnVmZmVyLnByb3RvdHlwZS5wYXJlbnQgPSB1bmRlZmluZWRcblxuLy8gdG9TdHJpbmcoZW5jb2RpbmcsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIHN0YXJ0ID0gc3RhcnQgPj4+IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID09PSBJbmZpbml0eSA/IHRoaXMubGVuZ3RoIDogZW5kID4+PiAwXG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcbiAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKGVuZCA8PSBzdGFydCkgcmV0dXJuICcnXG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gYmluYXJ5U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1dGYxNmxlU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKVxuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiAoYikge1xuICBpZighQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN0ciA9ICcnXG4gIHZhciBtYXggPSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTXG4gIGlmICh0aGlzLmxlbmd0aCA+IDApIHtcbiAgICBzdHIgPSB0aGlzLnRvU3RyaW5nKCdoZXgnLCAwLCBtYXgpLm1hdGNoKC8uezJ9L2cpLmpvaW4oJyAnKVxuICAgIGlmICh0aGlzLmxlbmd0aCA+IG1heClcbiAgICAgIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYilcbn1cblxuLy8gYGdldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLmdldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMucmVhZFVJbnQ4KG9mZnNldClcbn1cblxuLy8gYHNldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKHYsIG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLnNldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMud3JpdGVVSW50OCh2LCBvZmZzZXQpXG59XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKHN0ckxlbiAlIDIgIT09IDApIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGJ5dGUgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKGlzTmFOKGJ5dGUpKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG4gICAgYnVmW29mZnNldCArIGldID0gYnl0ZVxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIGJpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiB1dGYxNmxlV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gU3VwcG9ydCBib3RoIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZylcbiAgLy8gYW5kIHRoZSBsZWdhY3kgKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIGlmICghaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgfSBlbHNlIHsgIC8vIGxlZ2FjeVxuICAgIHZhciBzd2FwID0gZW5jb2RpbmdcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIG9mZnNldCA9IGxlbmd0aFxuICAgIGxlbmd0aCA9IHN3YXBcbiAgfVxuXG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cbiAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpXG5cbiAgdmFyIHJldFxuICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IGhleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICByZXQgPSBiaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IHV0ZjE2bGVXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXMgPSAnJ1xuICB2YXIgdG1wID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgaWYgKGJ1ZltpXSA8PSAweDdGKSB7XG4gICAgICByZXMgKz0gZGVjb2RlVXRmOENoYXIodG1wKSArIFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICAgICAgdG1wID0gJydcbiAgICB9IGVsc2Uge1xuICAgICAgdG1wICs9ICclJyArIGJ1ZltpXS50b1N0cmluZygxNilcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzICsgZGVjb2RlVXRmOENoYXIodG1wKVxufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGJpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgcmV0dXJuIGFzY2lpU2xpY2UoYnVmLCBzdGFydCwgZW5kKVxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW47XG4gICAgaWYgKHN0YXJ0IDwgMClcbiAgICAgIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKVxuICAgICAgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KVxuICAgIGVuZCA9IHN0YXJ0XG5cbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5fYXVnbWVudCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpKVxuICB9IGVsc2Uge1xuICAgIHZhciBzbGljZUxlbiA9IGVuZCAtIHN0YXJ0XG4gICAgdmFyIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZCwgdHJ1ZSlcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgICByZXR1cm4gbmV3QnVmXG4gIH1cbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApXG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ29mZnNldCBpcyBub3QgdWludCcpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBsZW5ndGgpXG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCA4KSB8IHRoaXNbb2Zmc2V0ICsgMV1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSlcbiAgICByZXR1cm4gKHRoaXNbb2Zmc2V0XSlcbiAgcmV0dXJuICgoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTEpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSA8PCAyNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2J1ZmZlciBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWx1ZSBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50OCA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweGZmLCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gdmFsdWVcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgNCk7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgPj4+IChsaXR0bGVFbmRpYW4gPyBpIDogMyAtIGkpICogOCkgJiAweGZmXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9IHZhbHVlXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHg3ZiwgLTB4ODApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9IHZhbHVlXG4gIH0gZWxzZSBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgfSBlbHNlIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSB2YWx1ZVxuICB9IGVsc2Ugb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydClcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA4LCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uICh0YXJnZXQsIHRhcmdldF9zdGFydCwgc3RhcnQsIGVuZCkge1xuICB2YXIgc291cmNlID0gdGhpc1xuXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICghdGFyZ2V0X3N0YXJ0KSB0YXJnZXRfc3RhcnQgPSAwXG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgc291cmNlLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAoZW5kIDwgc3RhcnQpIHRocm93IG5ldyBUeXBlRXJyb3IoJ3NvdXJjZUVuZCA8IHNvdXJjZVN0YXJ0JylcbiAgaWYgKHRhcmdldF9zdGFydCA8IDAgfHwgdGFyZ2V0X3N0YXJ0ID49IHRhcmdldC5sZW5ndGgpXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcigndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gc291cmNlLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwIHx8IGVuZCA+IHNvdXJjZS5sZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpXG4gICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRfc3RhcnQgPCBlbmQgLSBzdGFydClcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0ICsgc3RhcnRcblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcblxuICBpZiAobGVuIDwgMTAwIHx8ICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0X3N0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldF9zdGFydClcbiAgfVxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGlmIChlbmQgPCBzdGFydCkgdGhyb3cgbmV3IFR5cGVFcnJvcignZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcignc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gdmFsdWVcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gdXRmOFRvQnl0ZXModmFsdWUudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGBBcnJheUJ1ZmZlcmAgd2l0aCB0aGUgKmNvcGllZCogbWVtb3J5IG9mIHRoZSBidWZmZXIgaW5zdGFuY2UuXG4gKiBBZGRlZCBpbiBOb2RlIDAuMTIuIE9ubHkgYXZhaWxhYmxlIGluIGJyb3dzZXJzIHRoYXQgc3VwcG9ydCBBcnJheUJ1ZmZlci5cbiAqL1xuQnVmZmVyLnByb3RvdHlwZS50b0FycmF5QnVmZmVyID0gZnVuY3Rpb24gKCkge1xuICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgICByZXR1cm4gKG5ldyBCdWZmZXIodGhpcykpLmJ1ZmZlclxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYnVmID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5sZW5ndGgpXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYnVmLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxKSB7XG4gICAgICAgIGJ1ZltpXSA9IHRoaXNbaV1cbiAgICAgIH1cbiAgICAgIHJldHVybiBidWYuYnVmZmVyXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0J1ZmZlci50b0FycmF5QnVmZmVyIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBicm93c2VyJylcbiAgfVxufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBCUCA9IEJ1ZmZlci5wcm90b3R5cGVcblxuLyoqXG4gKiBBdWdtZW50IGEgVWludDhBcnJheSAqaW5zdGFuY2UqIChub3QgdGhlIFVpbnQ4QXJyYXkgY2xhc3MhKSB3aXRoIEJ1ZmZlciBtZXRob2RzXG4gKi9cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLl9pc0J1ZmZlciA9IHRydWVcblxuICAvLyBzYXZlIHJlZmVyZW5jZSB0byBvcmlnaW5hbCBVaW50OEFycmF5IGdldC9zZXQgbWV0aG9kcyBiZWZvcmUgb3ZlcndyaXRpbmdcbiAgYXJyLl9nZXQgPSBhcnIuZ2V0XG4gIGFyci5fc2V0ID0gYXJyLnNldFxuXG4gIC8vIGRlcHJlY2F0ZWQsIHdpbGwgYmUgcmVtb3ZlZCBpbiBub2RlIDAuMTMrXG4gIGFyci5nZXQgPSBCUC5nZXRcbiAgYXJyLnNldCA9IEJQLnNldFxuXG4gIGFyci53cml0ZSA9IEJQLndyaXRlXG4gIGFyci50b1N0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0xvY2FsZVN0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0pTT04gPSBCUC50b0pTT05cbiAgYXJyLmVxdWFscyA9IEJQLmVxdWFsc1xuICBhcnIuY29tcGFyZSA9IEJQLmNvbXBhcmVcbiAgYXJyLmNvcHkgPSBCUC5jb3B5XG4gIGFyci5zbGljZSA9IEJQLnNsaWNlXG4gIGFyci5yZWFkVUludDggPSBCUC5yZWFkVUludDhcbiAgYXJyLnJlYWRVSW50MTZMRSA9IEJQLnJlYWRVSW50MTZMRVxuICBhcnIucmVhZFVJbnQxNkJFID0gQlAucmVhZFVJbnQxNkJFXG4gIGFyci5yZWFkVUludDMyTEUgPSBCUC5yZWFkVUludDMyTEVcbiAgYXJyLnJlYWRVSW50MzJCRSA9IEJQLnJlYWRVSW50MzJCRVxuICBhcnIucmVhZEludDggPSBCUC5yZWFkSW50OFxuICBhcnIucmVhZEludDE2TEUgPSBCUC5yZWFkSW50MTZMRVxuICBhcnIucmVhZEludDE2QkUgPSBCUC5yZWFkSW50MTZCRVxuICBhcnIucmVhZEludDMyTEUgPSBCUC5yZWFkSW50MzJMRVxuICBhcnIucmVhZEludDMyQkUgPSBCUC5yZWFkSW50MzJCRVxuICBhcnIucmVhZEZsb2F0TEUgPSBCUC5yZWFkRmxvYXRMRVxuICBhcnIucmVhZEZsb2F0QkUgPSBCUC5yZWFkRmxvYXRCRVxuICBhcnIucmVhZERvdWJsZUxFID0gQlAucmVhZERvdWJsZUxFXG4gIGFyci5yZWFkRG91YmxlQkUgPSBCUC5yZWFkRG91YmxlQkVcbiAgYXJyLndyaXRlVUludDggPSBCUC53cml0ZVVJbnQ4XG4gIGFyci53cml0ZVVJbnQxNkxFID0gQlAud3JpdGVVSW50MTZMRVxuICBhcnIud3JpdGVVSW50MTZCRSA9IEJQLndyaXRlVUludDE2QkVcbiAgYXJyLndyaXRlVUludDMyTEUgPSBCUC53cml0ZVVJbnQzMkxFXG4gIGFyci53cml0ZVVJbnQzMkJFID0gQlAud3JpdGVVSW50MzJCRVxuICBhcnIud3JpdGVJbnQ4ID0gQlAud3JpdGVJbnQ4XG4gIGFyci53cml0ZUludDE2TEUgPSBCUC53cml0ZUludDE2TEVcbiAgYXJyLndyaXRlSW50MTZCRSA9IEJQLndyaXRlSW50MTZCRVxuICBhcnIud3JpdGVJbnQzMkxFID0gQlAud3JpdGVJbnQzMkxFXG4gIGFyci53cml0ZUludDMyQkUgPSBCUC53cml0ZUludDMyQkVcbiAgYXJyLndyaXRlRmxvYXRMRSA9IEJQLndyaXRlRmxvYXRMRVxuICBhcnIud3JpdGVGbG9hdEJFID0gQlAud3JpdGVGbG9hdEJFXG4gIGFyci53cml0ZURvdWJsZUxFID0gQlAud3JpdGVEb3VibGVMRVxuICBhcnIud3JpdGVEb3VibGVCRSA9IEJQLndyaXRlRG91YmxlQkVcbiAgYXJyLmZpbGwgPSBCUC5maWxsXG4gIGFyci5pbnNwZWN0ID0gQlAuaW5zcGVjdFxuICBhcnIudG9BcnJheUJ1ZmZlciA9IEJQLnRvQXJyYXlCdWZmZXJcblxuICByZXR1cm4gYXJyXG59XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXitcXC8wLTlBLXpdL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG5mdW5jdGlvbiBpc0FycmF5aXNoIChzdWJqZWN0KSB7XG4gIHJldHVybiBpc0FycmF5KHN1YmplY3QpIHx8IEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSB8fFxuICAgICAgc3ViamVjdCAmJiB0eXBlb2Ygc3ViamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHR5cGVvZiBzdWJqZWN0Lmxlbmd0aCA9PT0gJ251bWJlcidcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIHZhciBiID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBpZiAoYiA8PSAweDdGKSB7XG4gICAgICBieXRlQXJyYXkucHVzaChiKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgc3RhcnQgPSBpXG4gICAgICBpZiAoYiA+PSAweEQ4MDAgJiYgYiA8PSAweERGRkYpIGkrK1xuICAgICAgdmFyIGggPSBlbmNvZGVVUklDb21wb25lbnQoc3RyLnNsaWNlKHN0YXJ0LCBpKzEpKS5zdWJzdHIoMSkuc3BsaXQoJyUnKVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBoLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGJ5dGVBcnJheS5wdXNoKHBhcnNlSW50KGhbal0sIDE2KSlcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoc3RyKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSlcbiAgICAgIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gZGVjb2RlVXRmOENoYXIgKHN0cikge1xuICB0cnkge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSgweEZGRkQpIC8vIFVURiA4IGludmFsaWQgY2hhclxuICB9XG59XG4iLCJ2YXIgbG9va3VwID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nO1xuXG47KGZ1bmN0aW9uIChleHBvcnRzKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuICB2YXIgQXJyID0gKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJylcbiAgICA/IFVpbnQ4QXJyYXlcbiAgICA6IEFycmF5XG5cblx0dmFyIFBMVVMgICA9ICcrJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSCAgPSAnLycuY2hhckNvZGVBdCgwKVxuXHR2YXIgTlVNQkVSID0gJzAnLmNoYXJDb2RlQXQoMClcblx0dmFyIExPV0VSICA9ICdhJy5jaGFyQ29kZUF0KDApXG5cdHZhciBVUFBFUiAgPSAnQScuY2hhckNvZGVBdCgwKVxuXG5cdGZ1bmN0aW9uIGRlY29kZSAoZWx0KSB7XG5cdFx0dmFyIGNvZGUgPSBlbHQuY2hhckNvZGVBdCgwKVxuXHRcdGlmIChjb2RlID09PSBQTFVTKVxuXHRcdFx0cmV0dXJuIDYyIC8vICcrJ1xuXHRcdGlmIChjb2RlID09PSBTTEFTSClcblx0XHRcdHJldHVybiA2MyAvLyAnLydcblx0XHRpZiAoY29kZSA8IE5VTUJFUilcblx0XHRcdHJldHVybiAtMSAvL25vIG1hdGNoXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIgKyAxMClcblx0XHRcdHJldHVybiBjb2RlIC0gTlVNQkVSICsgMjYgKyAyNlxuXHRcdGlmIChjb2RlIDwgVVBQRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gVVBQRVJcblx0XHRpZiAoY29kZSA8IExPV0VSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIExPV0VSICsgMjZcblx0fVxuXG5cdGZ1bmN0aW9uIGI2NFRvQnl0ZUFycmF5IChiNjQpIHtcblx0XHR2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuXG5cdFx0aWYgKGI2NC5sZW5ndGggJSA0ID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0Jylcblx0XHR9XG5cblx0XHQvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuXHRcdC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcblx0XHQvLyByZXByZXNlbnQgb25lIGJ5dGVcblx0XHQvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcblx0XHQvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG5cdFx0dmFyIGxlbiA9IGI2NC5sZW5ndGhcblx0XHRwbGFjZUhvbGRlcnMgPSAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMikgPyAyIDogJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDEpID8gMSA6IDBcblxuXHRcdC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuXHRcdGFyciA9IG5ldyBBcnIoYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuXHRcdGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gYjY0Lmxlbmd0aCAtIDQgOiBiNjQubGVuZ3RoXG5cblx0XHR2YXIgTCA9IDBcblxuXHRcdGZ1bmN0aW9uIHB1c2ggKHYpIHtcblx0XHRcdGFycltMKytdID0gdlxuXHRcdH1cblxuXHRcdGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTgpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgMTIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPDwgNikgfCBkZWNvZGUoYjY0LmNoYXJBdChpICsgMykpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDAwMCkgPj4gMTYpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDApID4+IDgpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0aWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpID4+IDQpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTApIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgNCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA+PiAyKVxuXHRcdFx0cHVzaCgodG1wID4+IDgpICYgMHhGRilcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJyXG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0ICh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoXG5cblx0XHRmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcblx0XHR9XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuXHRcdH1cblxuXHRcdC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcblx0XHRzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0dGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0dGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPSdcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0XG5cdH1cblxuXHRleHBvcnRzLnRvQnl0ZUFycmF5ID0gYjY0VG9CeXRlQXJyYXlcblx0ZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyAodGhpcy5iYXNlNjRqcyA9IHt9KSA6IGV4cG9ydHMpKVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24oYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSxcbiAgICAgIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDEsXG4gICAgICBlTWF4ID0gKDEgPDwgZUxlbikgLSAxLFxuICAgICAgZUJpYXMgPSBlTWF4ID4+IDEsXG4gICAgICBuQml0cyA9IC03LFxuICAgICAgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwLFxuICAgICAgZCA9IGlzTEUgPyAtMSA6IDEsXG4gICAgICBzID0gYnVmZmVyW29mZnNldCArIGldO1xuXG4gIGkgKz0gZDtcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKTtcbiAgcyA+Pj0gKC1uQml0cyk7XG4gIG5CaXRzICs9IGVMZW47XG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpO1xuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpO1xuICBlID4+PSAoLW5CaXRzKTtcbiAgbkJpdHMgKz0gbUxlbjtcbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCk7XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzO1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSk7XG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICBlID0gZSAtIGVCaWFzO1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pO1xufTtcblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjLFxuICAgICAgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMSxcbiAgICAgIGVNYXggPSAoMSA8PCBlTGVuKSAtIDEsXG4gICAgICBlQmlhcyA9IGVNYXggPj4gMSxcbiAgICAgIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKSxcbiAgICAgIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKSxcbiAgICAgIGQgPSBpc0xFID8gMSA6IC0xLFxuICAgICAgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMDtcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKTtcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMDtcbiAgICBlID0gZU1heDtcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMik7XG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tO1xuICAgICAgYyAqPSAyO1xuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gYztcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpO1xuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrKztcbiAgICAgIGMgLz0gMjtcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwO1xuICAgICAgZSA9IGVNYXg7XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pO1xuICAgICAgZSA9IGUgKyBlQmlhcztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pO1xuICAgICAgZSA9IDA7XG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCk7XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbTtcbiAgZUxlbiArPSBtTGVuO1xuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpO1xuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyODtcbn07XG4iLCJcbi8qKlxuICogaXNBcnJheVxuICovXG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcblxuLyoqXG4gKiB0b1N0cmluZ1xuICovXG5cbnZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIFdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiBgdmFsYFxuICogaXMgYW4gYXJyYXkuXG4gKlxuICogZXhhbXBsZTpcbiAqXG4gKiAgICAgICAgaXNBcnJheShbXSk7XG4gKiAgICAgICAgLy8gPiB0cnVlXG4gKiAgICAgICAgaXNBcnJheShhcmd1bWVudHMpO1xuICogICAgICAgIC8vID4gZmFsc2VcbiAqICAgICAgICBpc0FycmF5KCcnKTtcbiAqICAgICAgICAvLyA+IGZhbHNlXG4gKlxuICogQHBhcmFtIHttaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtib29sfVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gaXNBcnJheSB8fCBmdW5jdGlvbiAodmFsKSB7XG4gIHJldHVybiAhISB2YWwgJiYgJ1tvYmplY3QgQXJyYXldJyA9PSBzdHIuY2FsbCh2YWwpO1xufTtcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhbk11dGF0aW9uT2JzZXJ2ZXIgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5NdXRhdGlvbk9ic2VydmVyO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIHZhciBxdWV1ZSA9IFtdO1xuXG4gICAgaWYgKGNhbk11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgICAgICAgdmFyIGhpZGRlbkRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIHZhciBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBxdWV1ZUxpc3QgPSBxdWV1ZS5zbGljZSgpO1xuICAgICAgICAgICAgcXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIHF1ZXVlTGlzdC5mb3JFYWNoKGZ1bmN0aW9uIChmbikge1xuICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgb2JzZXJ2ZXIub2JzZXJ2ZShoaWRkZW5EaXYsIHsgYXR0cmlidXRlczogdHJ1ZSB9KTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIGlmICghcXVldWUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgaGlkZGVuRGl2LnNldEF0dHJpYnV0ZSgneWVzJywgJ25vJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoY2FuUG9zdCkge1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cz17XG4gIFwibmFtZVwiOiBcInN0b3JhZ2UuanNcIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMC4wLjFcIixcbiAgXCJkZXNjcmlwdGlvblwiOiBcInN0b3JhZ2UuanNcIixcbiAgXCJhdXRob3JcIjogXCJDb25zdGFudGluZSBNZWxuaWtvdiA8a2EubWVsbmlrb3ZAZ21haWwuY29tPlwiLFxuICBcIm1haW50YWluZXJzXCI6IFwiQ29uc3RhbnRpbmUgTWVsbmlrb3YgPGthLm1lbG5pa292QGdtYWlsLmNvbT5cIixcbiAgXCJyZXBvc2l0b3J5XCI6IHtcbiAgICBcInR5cGVcIjogXCJnaXRcIixcbiAgICBcInVybFwiOiBcImh0dHBzOi8vZ2l0aHViLmNvbS9hcmNoYW5nZWwtaXJrL3N0b3JhZ2UuZ2l0XCJcbiAgfSxcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcInRlc3RcIjogXCJncnVudCB0ZXN0XCJcbiAgfSxcbiAgXCJkZXZEZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiZ3J1bnRcIjogXCJsYXRlc3RcIixcbiAgICBcImdydW50LWNvbnRyaWItanNoaW50XCI6IFwibGF0ZXN0XCIsXG4gICAgXCJncnVudC1jb250cmliLXVnbGlmeVwiOiBcImxhdGVzdFwiLFxuICAgIFwiZ3J1bnQtY29udHJpYi13YXRjaFwiOiBcImxhdGVzdFwiLFxuICAgIFwiZ3J1bnQtYnJvd3NlcmlmeVwiOiBcImxhdGVzdFwiLFxuICAgIFwiZ3J1bnQta2FybWFcIjogXCJsYXRlc3RcIixcbiAgICBcImdydW50LWthcm1hLWNvdmVyYWxsc1wiOiBcImxhdGVzdFwiLFxuICAgIFwia2FybWFcIjogXCJsYXRlc3RcIixcbiAgICBcImthcm1hLWNvdmVyYWdlXCI6IFwibGF0ZXN0XCIsXG4gICAgXCJrYXJtYS1tb2NoYVwiOiBcImxhdGVzdFwiLFxuICAgIFwia2FybWEtY2hhaVwiOiBcImxhdGVzdFwiLFxuICAgIFwia2FybWEtcGhhbnRvbWpzLWxhdW5jaGVyXCI6IFwibGF0ZXN0XCIsXG4gICAgXCJrYXJtYS1jaHJvbWUtbGF1bmNoZXJcIjogXCJsYXRlc3RcIixcbiAgICBcImthcm1hLWZpcmVmb3gtbGF1bmNoZXJcIjogXCJsYXRlc3RcIixcbiAgICBcImthcm1hLWllLWxhdW5jaGVyXCI6IFwibGF0ZXN0XCIsXG4gICAgXCJrYXJtYS1zYWZhcmktbGF1bmNoZXJcIjogXCJsYXRlc3RcIixcbiAgICBcImthcm1hLXNhdWNlLWxhdW5jaGVyXCI6IFwibGF0ZXN0XCIsXG4gICAgXCJ0aW1lLWdydW50XCI6IFwibGF0ZXN0XCIsXG4gICAgXCJicm93c2VyaWZ5XCI6IFwibGF0ZXN0XCIsXG4gICAgXCJkb3hcIjogXCJsYXRlc3RcIixcbiAgICBcImhpZ2hsaWdodC5qc1wiOiBcImxhdGVzdFwiLFxuICAgIFwiamFkZVwiOiBcImxhdGVzdFwiXG4gIH1cbn0iXX0=
