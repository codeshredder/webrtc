 $(function () {
    var content = $('#content');
    var status = $('#status');
    var input = $('#input');

    var action = document.getElementById("action");
    action.onclick = startAction;
    var showVideo = document.getElementById("showVideo");
    showVideo.onclick = startVideo;

    var localVideo = document.getElementById("localVideo");
    var remoteVideo = document.getElementById("remoteVideo");

    var localPeerConnection;

    var client = {
        name:false,
        socket:false,
        status:'init',  // init, connected, logined, talking
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

        status.text('login name:');
        $('#action').text('login');
    });

    client.socket.on('register_ack', function(json) {
        console.log('register_ack: ' + JSON.stringify(json));

        var p = '<p style="background:'+client.color+'">system  @ '+ json.time+ ' : ' + json.name + ' register ' + json.result +'</p>';
        content.prepend(p); 
    });

    client.socket.on('login_ack', function(json) {
        console.log('login_ack: ' + JSON.stringify(json));

        if (json.result === 'ok') {
            client.name = json.name;
            client.status = 'logined';

            status.text('call name:');
            $('#action').text('call');
        }

        var p = '<p style="background:'+client.color+'">system  @ '+ json.time+ ' : ' + json.name + ' login ' + json.result +'</p>';
        content.prepend(p); 
    });

    client.socket.on('invite', function(json) {
        console.log('invite: ' + JSON.stringify(json));

        var p = '<p style="background:'+client.color+'">system  @ '+ json.time+ ' : ' + json.caller + ' call ' + json.callee +'</p>';
        content.prepend(p);

        // add user choose accept or refuse

        if (confirm("accept call from " + json.caller + " ?")) {
            client.status = 'talking';
            status.text(client.name + ': ').css('color', json.color);
            $('#action').text('hang off');

            var msg = json;
            msg['result'] = 'ok';
            sendMessage('invite_ack', msg);
        }
        else {
            var msg = json;
            msg['result'] = 'refuse';
            sendMessage('invite_ack', msg);
        }
    });

    client.socket.on('invite_ack', function(json) {
        console.log('invite_ack: ' + JSON.stringify(json));

        if (json.result === 'ok') {
            client.status = 'talking';
            status.text(client.name + ': ').css('color', json.color);
            $('#action').text('hang off');
        }

        var p = '<p style="background:'+client.color+'">system  @ '+ json.time+ ' : ' + json.caller + ' call ' + json.callee + ' '+ json.result +'</p>';
        content.prepend(p); 
    });

    client.socket.on('quit', function(json) {
        console.log('quit: ' + JSON.stringify(json));

        client.status = 'logined';
        status.text('call name:');
        $('#action').text('call');

        mediaStop();

        var p = '<p style="background:'+client.color+'">system  @ '+ json.time+ ' : ' + json.name + ' quit </p>';
        content.prepend(p); 
    });

    client.socket.on('message', function(json) {
        console.log('message: ' + JSON.stringify(json));

        var p = '<p style="color:'+json.color+';">' + json.name+' @ '+ json.time+ ' : '+ json.text +'</p>';
        content.prepend(p); 
    });

     // press 'Enter' to send msg
    input.keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = {};
            var text = $(this).val();

            if (client.status === "talking") {
                if (!text) return;

                msg['name'] = client.name;
                msg['text'] = text;
                sendMessage('message', msg);

                $(this).val('');
            }
        }
    });

    // action
    function startAction () {
        console.log('startAction: ' + input.val());

        var msg = {};
        var text = input.val();

        if (client.status === "connected") {

            if (confirm("register new account?")) {
                var name = prompt("new name", "");
                var password = prompt("new password", "");

                if (name && password)
                {
                    msg['name'] = name;
                    msg['password'] = password;
                    sendMessage('register', msg);
                }
            }
            else {
                var name = prompt("name", "");
                var password = prompt("password", "");

                if (name && password)
                {
                    msg['name'] = name;
                    msg['password'] = password;
                    sendMessage('login', msg);
                }
            }

        } else if (client.status === "logined") {
            if (!text) return;

            msg['caller'] = client.name;
            msg['callee'] = text;
            sendMessage('invite', msg);

            input.val('');
        } else if (client.status === "talking") {

            msg['name'] = client.name;
            sendMessage('quit', msg);

            client.status = 'logined';
            status.text('call name:');
            $('#action').text('call');
        }
    }

    // for media call
    function startVideo () {

        if (client.status === "talking") {
            if (!localPeerConnection) {
              mediaStart();
            }
        }
    }

    var sdpConstraints = {'mandatory': {
        'OfferToReceiveAudio':true,
        'OfferToReceiveVideo':true }};

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
        if (localPeerConnection) {
            localPeerConnection.close();
            localPeerConnection = null;
        }
    }

    function logError(error) {
        console.log(error.name + ": " + error.message);
    }

});