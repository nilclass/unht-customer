var mysql = require('mysql'),
  memcache = require('memcache'),
  email = require('./email').email,
  spawn = require('child_process').spawn,
  config = require('./config').config;

var DOMAIN = {
  PENDING: 0,
  ACTIVE: 1,
  EXPIRED: 2
};

var connection = mysql.createConnection({
  host     : config.db.host,
  user     : config.db.user,
  password : config.db.password,
  database : config.db.database
});

connection.connect();

function deploy(host, uid, cb) {
  var script = spawn(config.deploy, [host, uid]),
    str = '';
  script.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
    str += data;
  });
  script.stderr.on('data', function (data) { console.log('stderr: ' + data); });
  script.on('close', function (code) {
    console.log('child process exited with code ' + code);
    cb(str);
  });
}

//* make list of reserved names
//  - nic, root, www, example, unhosted,
//  - anything implying authority or officialness
//  - anything <= 3 letters (at least <= 2 letters implies authority, like language/country codes),
//  - http://tools.ietf.org/html/rfc6761
//  - pastefinger.un.ht
//  - ...

exports.createDomain = function(host, uid, admin, tech, ns, cb) {
  deploy(host, 10000+uid, function(key) {
    connection.query('INSERT INTO `domains` (`host`, `uid`, `admin`, `tech`, `ns`) VALUES (?, ?, ?, ?, ?)', 
        [host, uid, admin, tech, ns], function(err, data) {
      connection.query('INSERT INTO `zones` (`host`, `uid`, `editkey`) VALUES (?, ?, ?)', 
          [host, uid, key], cb);
    });
  });
};
exports.updateDomain = function(host, uid, admin, tech, ns, cb) {
  connection.query('UPDATE `domains` SET `uid` = ?, `admin` = ?, `tech` = ?, `ns` =? WHERE host = ?',
        [uid, admin, tech, ns, host], function(err, data) {
  });
};
exports.expireDomain = function(host, cb) {
  connection.query('UPDATE `domains` SET `status` = ? WHERE `host` = ?',
      [DOMAIN.EXPIRED, host], function(err, data) {
    dnr(host, false, cb);
  });
};
