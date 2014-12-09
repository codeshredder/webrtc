
var express = require('express');
var app = express();
var http = require('http');
var server = http.Server(app);
var io = require('socket.io')(server);
var uuid = require('node-uuid');

server.listen(8080);
console.log("server start on port 8080");

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendfile('public/main.html');
});

// for webrtc signalling
var sessions = {};
var clients = {};

function sendMessage(socket, type, message){
    console.log('sendMessage: '+ type + ' ' + JSON.stringify(message));
    // if (typeof message === 'object') {
    //   message = JSON.stringify(message);
    // }
    socket.emit(type, message);
}

io.on('connection', function (socket) {

  var client = {
    name:false,
    socket:socket,
    ip:socket.request.connection.remoteAddress,
    session:false,
    color:getColor()
  }

  console.log(client.ip + ' connected');

  // tell client connected
  socket.emit('connect_ack');

  // update device info
  //getDevices();

  socket.on('register', function(json) {
    console.log('register: ' + JSON.stringify(json));

    var msg = {};
    msg['time'] = getTime();
    msg['color'] = client.color;
    msg['name'] = json.name;

    // add user
    if (!addUser(json.name, json.password)) {
      msg['result'] = 'invalid user';
      sendMessage(client.socket,'register_ack', msg);
      return;
    }

    msg['result'] = 'ok';
    sendMessage(client.socket,'register_ack', msg);
  });

  socket.on('login', function(json) {
    console.log('login: ' + JSON.stringify(json));

    var msg = {};
    msg['time'] = getTime();
    msg['color'] = client.color;
    msg['name'] = json.name;

    // check user
    if (!checkUser(json.name, json.password)) {
      msg['result'] = 'invalid user';
      sendMessage(client.socket,'login_ack', msg);
      return;
    }

    // check device
/*    if (!checkDevice(client.ip)) {
      msg['result'] = 'invalid device';
      sendMessage(client.socket,'login_ack', msg);
      return;
    }*/

    // add client
    client.name = json.name;
    clients[client.name] = client;

    msg['result'] = 'ok';
    sendMessage(client.socket,'login_ack', msg);
  });

  socket.on('invite', function(json) {
    console.log('invite: ' + JSON.stringify(json));

    // call callee
    var msg = json;
    msg['time'] = getTime();
    msg['color'] = client.color;

    if (clients[json.callee]) {

      //check device
/*      if (!checkDevice(clients[json.callee].ip)) {
        msg['result'] = 'invalid device';
        sendMessage(clients[json.caller].socket,'invite_ack', msg);
        return;
      }*/

      sendMessage(clients[json.callee].socket,'invite', msg);

    } else if (clients[json.caller]) {
      msg['result'] = 'not exist';
      sendMessage(clients[json.caller].socket,'invite_ack', msg);
    }
  });

  socket.on('invite_ack', function(json) {
    console.log('invite_ack: ' + JSON.stringify(json));
    
    if (json.result === 'ok') {
      // add session
      var session = uuid();
      sessions[session] = {};
      sessions[session][json.caller] = clients[json.caller];
      sessions[session][json.callee] = clients[json.callee];
      clients[json.caller].session = session;
      clients[json.callee].session = session;
    }

    var msg = json;
    msg['time'] = getTime();
    msg['color'] = client.color;
    sendMessage(clients[json.caller].socket,'invite_ack', msg);
  });

  socket.on('message', function(json) {
    console.log('message: '+ JSON.stringify(json));

    // notice session members
    var msg = json;
    msg['time'] = getTime();
    msg['color'] = client.color;
    for (var name in sessions[client.session]) {
      sendMessage(sessions[client.session][name].socket, 'message', msg);
    }
  });

  socket.on('media', function(json) {
    console.log('media: '+ JSON.stringify(json));

    // notice session members
    var msg = json;
    for (var name in sessions[client.session]) {
      if (sessions[client.session][name].name !== client.name) {
        sendMessage(sessions[client.session][name].socket, 'media', msg);
      }
    }
  });

  // process disconnect
  socket.on('quit', function () {  
    console.log("quit: " + client.name);

    // quit session
    if ((client.session !== false) && (client.name !== false)) {
      delete sessions[client.session][client.name];

      // notice session members
      var msg = {
        time:getTime(),
        color:client.color,
        name:client.name
      };
      for (var name in sessions[client.session]) {
        if (sessions[client.session][name].name !== client.name) {
          sendMessage(sessions[client.session][name].socket, 'quit', msg);
        }
      }

      if (!sessions[client.session]) {
        delete sessions[client.session];
      }
      client.session = false;
    }
  });

  // process disconnect
  socket.on('disconnect', function () {  
    console.log("disconnect: " + client.name);

    // quit session
    if ((client.session !== false) && (client.name !== false)) {
      delete sessions[client.session][client.name];
      delete clients[client.name];

      // notice session members
      var msg = {
        time:getTime(),
        color:client.color,
        name:client.name
      };
      for (var name in sessions[client.session]) {
        if (sessions[client.session][name].name !== client.name) {
          sendMessage(sessions[client.session][name].socket, 'quit', msg);
        }
      }
      client.session = false;
    }
  });
  
});

var getTime=function(){
  var date = new Date();
  return date.getHours()+":"+date.getMinutes()+":"+date.getSeconds();
}

var getColor=function(){
  var colors = ['aliceblue','antiquewhite','aqua','aquamarine','pink','red','green',
                'orange','blue','blueviolet','brown','burlywood','cadetblue'];
  return colors[Math.round(Math.random() * 10000 % colors.length)];
}

// user api
var users = {};

var addUser = function(name, password) {

  users[name] = password;

  return true;
}

var checkUser = function(name, password) {

  if (users[name] === password) {
    return true;
  } else {
    return false;
  }
}


// sweet api

var devices = {};

function getDevices()  {
  var options = {
    hostname: '12.12.12.134',
    port: 8080,
    path: '/controller/nb/v2/sweet/default/devices',
    method: 'GET',
    headers: {
        'Content-type': 'application/json',
      },
    auth: 'admin:admin',
  };

  var req = http.request(options, function(res) {
    console.log('STATUS: ' + res.statusCode);
    console.log('HEADERS: ' + JSON.stringify(res.headers));

    res.setEncoding('utf8');
    res.on('data', function (data) {
      console.log('BODY: ' + data);

      // get devices info
      devices = JSON.parse(data);
    });
  });

  req.on('error', function(err) {
    console.log('request error: ' + err.message);
  });

  // write data to request body
  //req.write('data\n');
  //req.write('data\n');
  req.end();
}

var checkDevice = function(ip) {

  var json = devices;

  console.log('checkDevice: '+ ip + '\r\n' + JSON.stringify(json['devicemaplist']));

  for (var i in json['devicemaplist']) {
    console.log(JSON.stringify(json['devicemaplist'][i]));
    console.log(JSON.stringify(json['devicemaplist'][i]['devicemap']));
    console.log(JSON.stringify(json['devicemaplist'][i]['devicemap']['deviceIp']));

    if (json['devicemaplist'][i]['devicemap']['deviceIp'] === ip) {
      return true;
    }
  }

  return false;
}

