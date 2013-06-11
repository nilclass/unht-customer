var mysql = require('mysql'),
  Memcache = require('memcache'),
  email = require('./email').email,
  uuid = require('node-uuid'),
  config = require('./config').config;

var connection = mysql.createConnection({
  host     : config.db.host,
  user     : config.db.user,
  password : config.db.password,
  database : config.db.database
});

connection.connect();

var memcache = new Memcache.Client(config.memcache.port, config.memcache.host);
memcache.connect();

connection.query('SELECT 1 + 1 AS solution', function(err, rows, fields) {
  if (err) throw err;

  console.log('The solution is: ', rows[0].solution);
});

//connection.end();

//customers:
// uid (int), email_address (str), new_email_address (str), password_hash (str), status (int), token (str)
//
//domains:
//uid (int), host (str), admin (url), tech (url), ns (url)
//
//rs:
//uid (int), server (str), username (str), quota (int)

var USER = {
  FRESH: 0,
  VERIFIED: 1,
  CHANGING: 2,
  RESETTING: 3,
  MAXOPEN: 3,//all states up to here are 'open', the ones below will not allow logging in
  SUSPENDED: 4,
  CLOSED: 5
};

function genToken() {
  return uuid();
}

exports.createAccount = function(emailAddress, password, cb) {
  var token = genToken();
  var salt = uuid();
  var hash = crypto.createHash('sha256').update(pwd).update(salt).digest('hex');
  connection.query('INSERT INTO `customers` (`email_address`, `password_hash`, `password_salt`, `token`, `status`) VALUES (?, ?, ?, ?, ?)', [emailAddress, passwordHash, passwordSalt, token, USER.FRESH], function(err, data) {
    if(err) {
      cb(err);
    } else {
      var uid = data.insertId;
      email.verify(emailAddress, token+'_'+uid, function(err2) {
        cb(err2, uid);
      });
    }
  });
};
exports.verifyEmail = function(tokenUid, cb) {
  var parts = tokenUid.split('_');
  connection.query('UPDATE `customers` SET `status`= ?'
      +' WHERE `status` = ? AND `token` = ? AND `uid` = ?',
      [USER.VERIFIED, USER.FRESH, parts[0], parts[1]], cb);
};
exports.startResetPassword = function(emailAddress, cb) {
  var token = genToken();
  connection.query('UPDATE `customers` SET `status` = ?, `token` = ?'
      +' WHERE `email_address` = ?', [USER.RESETTING, token, emailAddress], function(err, data) {
    email.resetPassword(emailAddress, token+'_'+uid, cb);
  });
};
exports.startEmailChange = function(uid, newEmail, cb) {
  var token = genToken();
  connection.query('UPDATE `customers` SET `status` = ?, `new_email_address` = ?,'
      +' `token` = ? WHERE `uid` = ?',
      [USER.CHANGING, newEmail, uid, token], function(err1, data) {
    connection.query('SELECT `email_address` from `customers` WHERE uid = ?', [uid], function(err2, currentEmail) {
      email.changeTo(newEmail, token+'_'+uid, function(err3) {
        email.changeFrom(currentEmail, cb);
      });
    });
  });
};
exports.changePwd = function(emailAddress, newPasswordHash, cb) {
  connection.query('UPDATE `customers` SET `password_hash` = ?'
      +' WHERE `email_address` = ?', [newPasswordHash, emailAddress], function(err, result) {
    memcache.delete('pwd:'+emailAddress);
    cb();
  });
};
exports.checkEmailPwd = function(emailAddress, password, cb) {
  memcache.get('pwd:'+emailAddress, function(err, val) {
    console.log('memcache', err, val);
    if(val && val.passwordHash == passwordHash) {
      cb(null, val.uid);
    } else {
      connection.query('SELECT `uid`, `status`, `password_hash`, `password_salt` FROM `customers`'
          +' WHERE `email_address` = ?',
          [emailAddress], function(err, rows) {
        console.log(err, rows);
        if(err) {
          cb(false);
        } else {
          if(rows.length>=1 && rows[0].status<=USER.MAXOPEN) {
            memcache.set('pwd:'+emailAddress, {
              passwordHash: rows[0].password_hash,
              passwordSalt: rows[0].password_salt,
              uid: rows[0].uid
            });
            var hash = crypto.createHash('sha256').update(password).update(rows[0].password_salt).digest('hex');
            if(hash == rows[0].password_hash) {
              cb(null, rows[0].uid);
            } else {
              cb('wrong email/pwd');
            }
          } else {
            cb('first user not open');
          }
        }
      });
    }
  });
};
exports.deleteUser = function(uid, cb) {
  //todo: remove products
  connection.query('UPDATE `customers` SET `status` = ? WHERE `uid` = ?', [USER.CLOSED, uid], cb);
};
/* dependencies to implement:
https://npmjs.org/package/mysql
https://npmjs.org/package/memcache
SendGrid
domainconf -> see how to interface with ggrin
*/
