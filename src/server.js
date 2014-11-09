
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var uuid = require('node-uuid');

server.listen(8080);
console.log("server start on port 8080");

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendfile('index.html');
});


var sessions = {};
var clients = {};


io.on('connection', function (socket) {
  // tell client connected
  socket.emit('open');

  // console.log(socket.handshake);

  var client = {
    id:false,
    socket:socket,
    name:false,
    session:false,
    color:getColor()
  }
  
  // process signaling
  socket.on('signaling', function(json){
    var msg = {time:getTime(),color:client.color};

    if (json.type === 'register') {
      console.log(json.type + ": " + json.name);

      client.name = json.name;
      client.id = uuid();
      clients[client.id] = client;

      msg['type'] = 'register';
      msg['id'] = client.id;
      msg['name'] = client.name;
      socket.emit('signaling', msg);
    }
    else if (json.type === 'create') {

      // create seesion
      client.session = uuid();
      sessions[client.session] = {};
      sessions[client.session][client.id] = client;

      console.log(json.type + ": " + json.name + ' ' + client.session);

      // notice
      msg['type'] = 'create';
      msg['session'] = client.session;
      socket.emit('signaling', msg);
    }
    else if (json.type === 'join') {
      console.log(json.type + ": " + client.name + " " + json.session);

      if ((json.session)&&(sessions[json.session])) {

        // join session
        client.session = json.session;
        sessions[json.session][client.id] = client;

        // notice session members
        msg['type'] = 'join';
        msg['name'] = client.name;
        msg['session'] = client.session;

        for (var id  in sessions[json.session]) {
          sessions[client.session][id].socket.emit('signaling', msg);
        }
      }
    }
    else if (json.type === 'message') {
      console.log(json.type + ": " + client.name + " " + json.text);

      // notice session members
      msg['type'] = 'message';
      msg['name'] = client.name;
      msg['text'] = json.text;

      for (var id in sessions[client.session]) {
        sessions[client.session][id].socket.emit('signaling', msg);
      }
    }
    else if ((json.type === 'offer') || (json.type === 'answer')) {
      console.log(json.type + ": " + client.name + "\r\n" + json.sdp);

      // notice session members
      msg['type'] = json.type;
      msg['name'] = client.name;
      msg['sdp'] = json.sdp;

      for (var id in sessions[client.session]) {
        sessions[client.session][id].socket.emit('signaling', msg);
      }
    }

  });

  // process disconnect
  socket.on('disconnect', function () {  
    console.log("disconnect: " + client.name + " " + client.id + " " + client.session);

    // quit session
    if ((client.session !== false) && (client.id !== false)) {
      delete sessions[client.session][client.id];
      delete clients[client.id];

      // notice session members
      var msg = {
        time:getTime(),
        color:client.color,
        type:'quit',
        name:client.name
      };

      for (var id in sessions[client.session]) {
        sessions[client.session][id].socket.emit('signaling', msg);
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