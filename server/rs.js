var mysql = require('mysql'),
  config = require('./config').config,
  spawn = require('child_process').spawn;


var connection = mysql.createConnection({
  host     : config.db.host,
  user     : config.db.user,
  password : config.db.password,
  database : config.db.database
});

connection.connect();

var MIN_UID = 10000;

function createSystemUser(uid, username, cb) {
  // FIXME: lots of hardcoded things here!!!
  console.log('createSystemUser -> adduser');
  spawn('adduser', ['--uid', (MIN_UID + uid).toString(), '--disabled-login', '--disabled-password', '--gecos', '', username]).
    on('close', function(code) {
      if(code == 0) {
        console.log('createSystemUser -> mkdir');
        spawn('mkdir', ['-p', '/data/remotestorage/' + username]).
          on('close', function(mkdircode) {
            if(mkdircode == 0) {
              console.log('createSystemUser -> ln -s');
              spawn('ln', ['-s', '/data/remotestorage/' + username, '/home/' + username + '/storage']).
                on('close', function(lncode) {
                  if(lncode == 0) {
                    console.log('createSystemUser -> chown');
                    spawn('chown', ['-R', username + ':' + username, '/data/remotestorage/' + username]).
                      on('close', function(chowncode) {
                        if(chowncode == 0) {
                          cb();
                        } else {
                          cb('chown exited with status: ' + chowncode);
                        }
                      });
                  } else {
                    cb('ln exited with status: ' + lncode);
                  }
                });
            } else {
              cb("mkdir exited with status: " + mkdircode);
            }
          });
      } else {
        cb("adduser exited with status: " + code);
      }
    });
}

exports.createRemotestorage = function(uid, server, username, quota, cb) {
  connection.query('INSERT INTO `remotestorage` (`uid`, `server`, `username`, `quota`)'
      +' VALUES (?, ?, ?, ?)', [uid, server, username, quota], function(err, data) {
    if(err) {
      cb(err);
    } else {
      console.log(server, username, quota, cb);
      console.log('pretending to setup rsconf...');
      createSystemUser(uid, username, cb);
    }
  });
};
