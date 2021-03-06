var DB   = require('./index');
var Test = require('../test').Test;
var util = require('util');

var config = {
  DB: {
    'driver': 'redis',
  },
  PROJECT_NAME: 'test_redis_driver'
}

var db = new DB.DB(config);
var test = new Test();

test.test('console.log db', function(){
  console.log(db);
  test.next();
});

test.test('nstest set and get', function(){

  db.NS('nstest')._set('key1', 'val1', function(err, result){
    db.NS('nstest')._get('key1', function(err, result){
      console.log(err, result);
      test.next();
    });
  });

});

test.test('nstest keys *', function(){
  db.NS('nstest')._keys('*', function(err, result){
    console.log(err, result);
    test.next();
  });   
});

test.test('nstest del key1',function(){

  db.NS('nstest')._get('key1', function(err, result){
    console.log('get', err, result);
    db.NS('nstest')._del('key1', function(err, result){
      console.log('del', err, result);
      test.next();
    });
  });
});

test.test('nstest eval', function(){
  var lua = "redis.pcall('hset', KEYS[1], ARGV[1], ARGV[2]);\nreturn redis.pcall('hgetall', KEYS[1]);";
  db.NS('nstest')._eval(lua, 1, 'testhashkey', 'filed1', 'value1', function(err, result){
    console.log(err, result);
    test.next();
  });
});

test.test('nstest incr', function(){
  db.NS('nstest')._incr('counter', function(err, result){
    console.log(err, result);
    db.NS('nstest')._incr('counter', function(err, result){
      console.log(err, result);
      test.next();
    });
  });
});

// flushdb
test.test('ns flush db', function(){
  db.NS('nstest')._flushdb(function(err, result){
    console.log(err, result);
    test.next();
  });
});

// .K func
test.test('ns.K func', function(){
  db.NS('nstest').key('user').key(1)._set('name', 'testusername', function(err, result){
    console.log(err, result);
    test.next();
  });
});

// multi .K
test.test('ns.K(user:1:pw func', function(){
  db.NS('nstest').key('user:1')._get('name', function(err, result){
    console.log(err, result);
    test.next();
  });
});

// update
test.test('ns user 1 update', function(err, result){
  db.NS('user').key(1).update({
    'user_name':'xlw',
    'password': 'fawefddfawenfiag`'
  }, function(err, result){
    console.log(err, result);
    test.next();
  });
});

// getKeys
test.test('ns user 1 getKeys', function(err, result){
  db.NS('user').key(1).getKeys('user_name', 'password', function(err, data){
    console.log(err, data);
    test.next();
  });
});

// get multi type
test.test('ns user 1 _set getKeys', function(){
  db.NS('user').key(1)._hmset('profile', {
    'qq': '33232',
    'email': 'fawefa@faf.com',
  }, function(err, data){
    console.log(err, data);
    db.NS('user').key(1).getKeys('user_name', 'password', 'profile', function(err, data){
      console.log(err, data);
      test.next();
    });
  });
});

// del
test.test('ns user 1 del', function(){
  db.NS('user').del(1, function(err, data){
    console.log(err, data);
    test.next();
  });
});

// create
test.test('ns create 1 user', function(){
  db.flushdb(function(err, result){
    console.log(err, result);
    db.NS('user').create({
      'user_name': '31楼347',
      'password': 'ddfafaf',
      'email': 'test@test.com',
      'add_time': (new Date).getTime(),
      'status':1,
      'is_admin':1
    }, function(err, result){ 
      console.log(err, result);
      test.next();
    });
  });
});

// get
test.test('ns get 1 user', function(){
  db.NS('user').key(1).getKeys('user_name', 'password', 'email', 'add_time', 'fffff', 'is_admin', 'status', function(err, result){
    console.log(err, result);
    test.next();
  });
});

// 执行测试
test.next();