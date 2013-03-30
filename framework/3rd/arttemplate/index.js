/**
 * ��װ�Ǳ���atrTemplate
 */

var fs = require('fs');

// ������smarty���﷨���
var arttemplate = require('./lib/template-syntax');

// ���߰�
var utils   = require('../../core/utils');
var Message = require('../../message').Message;


var template = exports;
// pub/sub �����津�������¼�
new Message(false, 50, template);

// �Ƿ��ʼ����
template.initialized = false;

var renderCache = {};
var fileCache = {};

var includeReg = /\{include(.*?)\}/gm;

/**
 * ��ʼ��
 */
template.init = function(config) {
  // �Ƿ�debug
  this.isDebug  = config.isDebug  || true;
  // �Ƿ��ļ�����
  this.cache    = config.cache || true;
  // ģ�壨��Ŀ����·��
  this.rootPath = config.rootPath || '';
  if ( !this.rootPath ) {
    this.pub('error', 'template.init error: config.rootPath is not defined.');
    return;
  }
  this.rootPath = utils.rtrim(this.rootPath, '/');

  // ģ������
  this.theme = config.theme || 'default';

  this.config      = config;
  this.initialized = true;

  // test
  this.cache = true;
}

/**
 * ��data��Ⱦģ��content
 * @param  {String} content ģ��
 * @param  {Object} data    ģ������
 * @return {String}         ��Ⱦ�õ�html�ַ���
 */
template.render = function(content, data) {

  content = content + '';

  var renderMd5 = utils.md5(content);

  // ��Ⱦ
  try {

    if ( !renderCache[renderMd5] ) {
      renderCache[renderMd5] = arttemplate.compile(content, this.isDebug); 
    } else {
      //console.log('render cache');
    }

    return renderCache[renderMd5](data);

  } catch(e) {

    delete renderCache[renderMd5];

    this.pub('error', e);
    
    return '';

  }
};

/**
 * ����include
 * @param {String} file ��Ҫ�����ļ�ȫ·��
 * @param {Function} cb callback �Ὣerr, content���ݸ�cb
 * @return {String} ���ؽ�����ϵ��ַ�����������artTemplate
 */
template.parseInclude = function(file, cb) {

  if (typeof cb != 'function') {
    this.pub('error', 'template.parseInclude error: parsing '+file+' cb is not a function obj.');
    return;
  }
  if (!file) {
    cb('file is empty.');
    return;
  }


  var fileMd5 = utils.md5(file);

  // �ļ�����
  if (fileCache[fileMd5]) {
    //console.log('fileCache: ', Object.keys(fileCache));
    cb(null, fileCache[fileMd5]);
  }

  var that = this;

  fs.readFile(file, 'utf8', function(err, content){
    if (err) {
      cb(err);
      return;
    }

    var matches = content.match(includeReg);
    
    if (!matches) {
      cb(null, content);
      return;
    }

    // ���Ķ���¼�
    var subMsgs = matches.map(function(v){
      return fileMd5 +  '.' + v;
    });
    subMsgs.push(function(message, dataList){

      console.log(message, dataList);

      var ids = message.id.split(',');
      for (var i = 0; i < ids.length; i++) {
        // �������� �������
        var includeInfo = ids.length == 1 ? dataList : dataList[ids[i]];
        if (!includeInfo) {
          cb('in template subMsgs dataList '+ids[i]+' parse error.');
          return;
        }
        if (includeInfo.err) {
          cb(includeInfo.err);
          return;
        }
        var tmpContent = includeInfo.content;
        // md5 32 + 1 (".")
        var include    = ids[i].substring(33);
        content = content.replace(include, tmpContent);
      }
      // ���뻺��
      if(that.cache) fileCache[fileMd5] = content;
      cb(null, content);
    });

    // �����¼�
    that.sub.apply(that, subMsgs);

    try {

      // ���������ж�ȡ�ļ�
      matches.forEach(function(include, k){
        
        var messageId = fileMd5 +  '.' + include; 

        include = include.replace(/\'/g, '"');
        var tmpFile   = include.match(/file\=\"(.+?)\"/);
        var tmpModule = include.match(/module\=\"(.+?)\"/);
        
        if (!tmpFile) {
          that.pub(messageId, { err: new Error('include file not matched'), content: '' });
          return;
        }

        tmpFile = tmpFile[1];
        tmpModule = tmpModule ? tmpModule[1] : '';
        
        if ( tmpModule ) {
          tmpFile = that.rootPath + '/module/' + tmpModule + '/template/' + that.theme + '/' + tmpFile;
        } else {
          tmpFile = that.rootPath + '/template/' + that.theme + '/' + tmpFile; 
        }
        
        var tmpFileMd5 = utils.md5(tmpFile);
        if ( fileCache[tmpFileMd5] ) {
          that.pub(messageId, { err: null, content: fileCache[tmpFileMd5] });
          return;
        }

        // �ݹ��ȡ
        return that.parseInclude(tmpFile, function(err, tmpContent){
          if (err) {
            that.pub(messageId, { err: err, content: '' });
            return;
          }
          // ����cache
          if ( that.cache ) fileCache[tmpFileMd5] = tmpContent;
          //console.log('cache file: ', Object.keys(fileCache));
          that.pub(messageId, { err: null, content: tmpContent });
        });
      });

    } catch(e) {

      that.pub('error', e);

    }
  });

};

/**
 * ���ģ�建��
 * @return {[type]} [description]
 */
template.clearCache = function() {
  renderCache = {};
  fileCache   = {};
};

