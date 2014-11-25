
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
  res.sendfile('index.html');
});


// rest api
function getDevice() {

  var options = {
    hostname: '127.0.0.1',
    port: 8888,
    path: '/v2/catalog',
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

  socket.on('register', function(json) {
    console.log('register: ' + json.name);

    // add  client
    client.name = json.name;
    clients[client.name] = client;

    var msg = {};
    msg['time'] = getTime();
    msg['color'] = client.color;
    msg['name'] = client.name;
    msg['result'] = 'ok';
    sendMessage(client.socket,'register_ack', msg);
  });

  socket.on('invite', function(json) {
    console.log('invite: ' + json.caller + ' call ' + json.callee);

    var msg = json;
    msg['time'] = getTime();
    msg['color'] = client.color;
    if (clients[json.callee]) {
      sendMessage(clients[json.callee].socket,'invite', msg);
    } else if (clients[json.caller]) {
      msg['result'] = 'no exist';
      sendMessage(clients[json.caller].socket,'invite_ack', msg);
    }
  });

  socket.on('invite_ack', function(json) {
    console.log('invite_ack: ' + json.caller + ' call ' + json.callee);
    
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
    console.log('message: '+ ": " + client.name + " " + json.text);

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
