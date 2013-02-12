/**
 * http连接建立后初始化请求响应对象
 */
var url     = require( 'url' );
var EventEmitter = require( 'events' ).EventEmitter;

var core  = require('../core');
var db      = require( '../db' );
var cache   = require( '../cache' );
var cookie  = require( '../cookie' );
var session = require( '../session' );

var formidable = require( '../3rd/formidable' );



/**
 * 包装原始的req对象
 * @param  {Object} oriReq 原始的request
 * @return {Object} 包装后的request
 */
exports.init = function( req, res ){
  console.log( 'in init module:' );
  console.log( module );
  console.log( 'in init module end.' );
  var app = new Framework( req, res );
  return app;
};

/**
 * 构造Request
 */
function Framework ( req, res )
{
  // 引用原始响应请求
  this.req = req;
  this.res = res;
  // http method GET POST ... 
  this.method = this.req.method;
  //请求开始毫秒数
  try {
    this.startTime = req.socket.server._idleStart.getTime();  
  } catch( e ) {
    this.startTime = (new Date()).getTime();
  }

  // 设置单个事件最多50个监听器，默认为10个
  this._emitter    = new EventEmitter();
  this._emitter.setMaxListeners(50);

  this._SERVER    = parse_SERVER( req );
  this._GET       = this._SERVER.url.query;

  // parse_POST/FILES sub to  parse_form
  parse_POST( this );
  parse_FILES( this );
  parse_FORM( this );

  this._COOKIE    = parse_COOKIE( req );

  init_DB( this );
  init_CACHE( this );

  parse_SESSION( this );
}

////////////////////////////////////////
// Framework.prototype start
////////////////////////////////////////

/**
 *  接收一个消息
 *  @param {String} messageId 消息标识
 *  @param {Function} handler 消息处理函数
 *  @param {Boolean} isOnce 只监听一次，默认true
 */
Framework.prototype.sub = function( messageId, handler, isOnce ) {
  if ( isOnce === false ) {
    this._emitter.on( messageId, handler);
  } else {
    this._emitter.once( messageId, handler);  
  }
};

/**
 * 发布一个消息
 * @param {String} messageId 消息标识
 * @param {Mixed} data 传递给订阅者的数据
 */
Framework.prototype.pub = function( messageId, data ){
  this._emitter.emit( messageId, data );
};

/**
 * SERVER 方法
 */
Framework.prototype.SERVER = function ( key ) {
  if ( !key || typeof key != 'string' ) {
    throw new TypeError( __filename + ' in [Method GET], param key is not a string.' );
  }
  return this._SERVER[key];
};

/**
 * 定义GET方法
 * @param {String} key 字段名，通常只有数字或字符串
 * @param {Mixed} def 默认值
 */
Framework.prototype.GET = function ( key, def ) {
  if ( !key || typeof key != 'string' ) {
    throw new TypeError( __filename + ' in [Method GET], param key is not a string.' );
  }
  // 默认
  if ( def === undefined ) {
    return this._GET[key];
  }
  // 没有值就是默认值
  var value = this._GET[key] || def;
  if ( value !== def ) {
    var typeDef = typeof def;
    switch ( typeDef ) {
      case 'number':
        value = (new Number(value)).valueOf();
        break;
      // 默认字符串
      default :
        value = '' + value;
    }
  }
  return value;
};

/**
 * 定义POST方法
 * @param {String} key 字段名，通常只有数字或字符串
 * @param {Mixed} def 默认值
 */
Framework.prototype.POST = function ( key, def ) {
  if ( !key || typeof key != 'string' ) {
    throw new TypeError( __filename + ' in [Method POST], param key is not a string.' );
  }
  // 默认
  if ( def === undefined ) {
    return this._POST[key];
  }
  // 没有值就是默认值
  var value = this._POST[key] || def;
  if ( value !== def ) {
    var typeDef = typeof def;
    switch ( typeDef ) {
      case 'number':
        value = (new Number(value)).valueOf();
        break;
      // 默认字符串
      default :
        value = '' + value;
    }
  }
  return value;
};

/**
 * REQUEST
 */
Framework.prototype.REQUEST = function( key, def ) {
  if ( !key || typeof key != 'string' ) {
    throw new TypeError( __filename + ' in [Method REQUEST], param key is not a string.' );
  }
  var getVal = this._GET[key];
  if ( getVal !== undefined ) {
    return this.GET( key, def );
  }
  return this.POST(key, def);
};

/**
 * COOKIE
 */
Framework.prototype.COOKIE = function( key ) {
  if ( !key || typeof key != 'string' ) {
    throw new TypeError( __filename + ' in [Method COOKIE], param key is not a string.' );
  }
  return this._COOKIE[key];
};

/**
 * SESSION
 */
Framework.prototype.SESSION = function ( key ) {
  if ( !key || typeof key != 'string' ) {
    throw new TypeError( __filename + ' in [Method SESSION], param key is not a string.' );
  }
  return this._SESSION[key];
};

/**
 * FILES
 */
Framework.prototype.FILES = function( name ) {
  if ( !name || typeof name != 'string' ) {
    throw new TypeError( __filename + ' in [Method FILES], param name is not a string.' );
  }
  return this._FILES[name];
};

////////////////////////////////////////
// Framework.prototype end
////////////////////////////////////////

/**
 * 解析url
 * @param {Object} req 由 Request构造产生的
 */
function parse_URL( req )
{
  var urlStr = req.url;
  // 解析 query 为 obj
  urlObj =  url.parse( urlStr, true );
  return urlObj;
}

/**
 * 设置SERVER环境变量
 * @param {Object} req 由 Request构造产生的
 * request.headers
request.trailers
 */
function parse_SERVER( req )
{
  var server = {
    'url'         : parse_URL( req ),
    'httpVersion' : req.httpVersion,
    'headers'     : req.headers,
    'trailers'    : req.trailers,
    'method'      : req.method
  };

  return server;
}

/**
 * 解析FORM数据
 * @param {Object} req 由 Request构造产生的
 */
function parse_FORM( app )
{
  if ( app.method != 'POST' ) {
    app.pub( 'parse_post_ready', {
      'err'    : null,
      'fields' : {},
      'files'  : {}
    });
    return false;
  }
  var form = new formidable.IncomingForm();
  // handle error event
  form.on( 'error', function(){
    app.pub( 'error', 'init.method [Function parse_FORM] error.' );
  });
  form.parse( app.req, function(err, fields, files) {
    console.log( fields, files );
    app.pub( 'parse_form_ready', {
      'err'    : err,
      'fields' : fields,
      'files'  : files
    });
  });
  return true;
}

/**
 * 解析post
 */
function parse_POST( app ) {
  app.sub( 'parse_form_ready', function( data ){
    app._POST = data.fields;
  });
}

/**
 * 解析files
 * @param {Object} req 由 Request构造产生的
 */
function parse_FILES( app )
{
  app.sub( 'parse_form_ready', function( data ){
    app._FILES = data.files;
  });
}

/**
 * 解析cookie
 * @param {Object} req 由 Request构造产生的
 */
function parse_COOKIE( req )
{
  var cookie = {};
  // @todo
  return cookie;
}

/**
 * 解析session
 * @param {Object} req 由 Request构造产生的
 */
function parse_SESSION( req )
{
  var session = {};
  // @todo
  return session;
}

/**
 * init DB
 */
function init_DB( )
{

}

/**
 * init Cache
 */
function init_CACHE(  )
{

}