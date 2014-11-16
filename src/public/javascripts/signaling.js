 $(function () {
    var content = $('#content');
    var status = $('#status');
    var input = $('#input');

    var localVideo = document.getElementById("localVideo");
    var remoteVideo = document.getElementById("remoteVideo");
    var videoCall = document.getElementById("videoCall");
    videoCall.onclick = startVideo;

    var localPeerConnection;

    var client = {
        name:false,
        socket:false,
        status:'init',  // init, connected, registered, talking
    }

    //Connecting
    client.status = 'Connecting';
    status.text('Connecting:');
    client.socket = io.connect();

    function sendMessage(type, message) {
        console.log('sendMessage: '+ type + ' ' + JSON.stringify(message));
        // if (typeof message === 'object') {
        //   message = JSON.stringify(message);
        // }
        client.socket.emit(type, message);
    }

    //Connected
    client.socket.on('connect_ack',function() {
        client.status = 'connected';

        status.text('register name:');
    });

    client.socket.on('register_ack', function(json) {
        console.log('register_ack: ' + json.name);

        client.name = json.name;
        client.status = 'registered';

        status.text('call name:');
    });

    client.socket.on('invite', function(json) {
        console.log('invite: ' + json.caller + " call " + json.callee);

        var p = '<p style="background:'+client.color+'">system  @ '+ json.time+ ' : ' + json.caller + ' call ' + json.callee +'</p>';
        content.prepend(p);

        // add user choose accept or refuse
        client.status = 'talking';
        status.text(client.name + ': ').css('color', json.color);

        var msg = json;
        msg['result'] = 'ok';
        sendMessage('invite_ack', msg);
    });

    client.socket.on('invite_ack', function(json) {
        console.log('invite_ack: ' + json.caller + ' call ' + json.callee + ' ' + json.result);

        if (json.result === 'ok') {
            client.status = 'talking';
            status.text(client.name + ': ').css('color', json.color);
        }

        var p = '<p style="background:'+client.color+'">system  @ '+ json.time+ ' : ' + json.caller + ' call ' + json.callee + ' '+ json.result +'</p>';
        content.prepend(p); 
    });

    client.socket.on('quit', function(json) {
        console.log('quit: ' + json.name);

        if (client.name === json.name) {
            client.status = 'registered';
            status.text('call name:');

            mediaStop();
        }

        var p = '<p style="background:'+client.color+'">system  @ '+ json.time+ ' : ' + json.name + ' quit </p>';
        content.prepend(p); 
    });

    client.socket.on('message', function(json) {
        console.log('message: ' + json.name);

        var p = '<p style="color:'+json.color+';">' + json.name+' @ '+ json.time+ ' : '+ json.text +'</p>';
        content.prepend(p); 
    });

     // press 'Enter' to send msg
    input.keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = {};
            var text = $(this).val();

            if (client.status === "connected") {
                if (!text) return;

                msg['name'] = text;
                sendMessage('register', msg);

            } else if (client.status === "registered") {
                if (!text) return;

                msg['caller'] = client.name;
                msg['callee'] = text;
                sendMessage('invite', msg);
            }
            else if (client.status === "talking") {
                if (!text) return;

                msg['name'] = client.name;
                msg['text'] = text;
                sendMessage('message', msg);
            }

            $(this).val('');
        }
    });


    // for media call
    var sdpConstraints = {'mandatory': {
        'OfferToReceiveAudio':true,
        'OfferToReceiveVideo':true }};

    function startVideo () {
        if (!localPeerConnection) {
          mediaStart();
        }
    }

    client.socket.on('media', function(message) {
        console.log('media: ' + JSON.stringify(message));

        if (message.type === 'offer') {
            if (!localPeerConnection) {
              mediaStart();
            }
            localPeerConnection.setRemoteDescription(new RTCSessionDescription(message));
            localPeerConnection.createAnswer(localDescCreated, null, sdpConstraints);
        
        } else if (message.type === 'answer' && localPeerConnection) {
            localPeerConnection.setRemoteDescription(new RTCSessionDescription(message));
        
        } else if (message.type === 'candidate' && localPeerConnection) {
            var candidate = new RTCIceCandidate({
                sdpMLineIndex: message.label,
                candidate: message.candidate
                });
            localPeerConnection.addIceCandidate(candidate);
        }
    });

    function mediaStart() {
        var server = null;
        localPeerConnection = new RTCPeerConnection(server);

        localPeerConnection.onicecandidate = function (event) {
            console.log('handleIceCandidate event: ', event);
            if (event.candidate) {
                sendMessage('media', {
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate});
            } else {
                console.log('End of candidates.');
            }
        };

        // once remote stream arrives, show it in the remote video element
        localPeerConnection.onaddstream = function (event) {
            remoteVideo.src = URL.createObjectURL(event.stream);
            remoteVideo.play();
        };

        localPeerConnection.onremovestream = function (event) {
            console.log('Remote stream removed. Event: ', event);
        };

        // get a local stream, show it in a self-view and add it to be sent
        getUserMedia({ "audio": true, "video": true }, function (stream) {
            localVideo.src = URL.createObjectURL(stream);
            localVideo.play();
            
            localPeerConnection.addStream(stream);
            localPeerConnection.createOffer(localDescCreated, logError);
        }, logError);
    }

    function localDescCreated(desc) {
        localPeerConnection.setLocalDescription(desc, function () {
            console.log('setLocalDescription: ' + desc.type + "\r\n"+ desc.sdp)

            // send sdp to peer
            var msg = desc;
            sendMessage('media', msg);

        }, logError);
    }

    function mediaStop() {
        if (!localPeerConnection) {
            localPeerConnection.close();
            localPeerConnection = null;
        }
    }


    function logError(error) {
        console.log(error.name + ": " + error.message);
    }

});