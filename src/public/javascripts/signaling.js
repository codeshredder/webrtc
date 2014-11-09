 $(function () {
    var content = $('#content');
    var status = $('#status');
    var input = $('#input');

    var localVideo = document.getElementById("localVideo");
    var remoteVideo = document.getElementById("remoteVideo");
    var startButton = document.getElementById("startButton");
    startButton.onclick = start;

    var localPeerConnection;

    var client = {
        id:false,
        socket:false,
        name:false,
        session:false,
        status:'start',
    }

    //Connecting
    client.status = 'Connecting';
    status.text('Connecting:');
    client.socket = io.connect('http://192.168.1.102:8080');

    //Connected
    client.socket.on('open',function(){
        client.status = 'connected';

        status.text('Choose a name:');
    });

    // process signaling
    client.socket.on('signaling',function(json){
        var p = '';

        if (json.type === 'register') {
            client.name = json.name;
            client.id = json.id;
            client.status = 'registered';

            status.text('Create or join a session:');
        } 
        else if (json.type === 'create') {
            client.session = json.session;
            client.status = 'talking';
            status.text(client.name + ': ').css('color', json.color);

            p = '<p style="background:'+client.color+'">system  @ '+ json.time+ ' : create ' + json.session +'</p>';
        }
        else if (json.type === 'join') {
            if (client.name === json.name) {
                client.session = json.session;
                client.status = 'talking';
                status.text(client.name + ': ').css('color', json.color);
            }

            p = '<p style="background:'+json.color+'">system  @ '+ json.time+ ' : ' + json.name +' join ' + json.session + '</p>';
        }
        else if(json.type == 'quit') {
            if (client.name === json.name) {
                client.session = false;
                client.status = 'registered';
            }

            p = '<p style="background:'+json.color+'">system  @ '+ json.time+ ' : ' + json.name +' quit </p>';
        }
        else if(json.type == 'message') {

            p = '<p><span style="color:'+json.color+';">' + json.name+'</span> @ '+ json.time+ ' : '+ json.text +'</p>';
        }
        else if(json.type == 'video') {

            p = '<p><span style="color:'+json.color+';">' + json.name+'</span> @ '+ json.time+ ' : send video </p>';

            // get remote video
            /*if (json.sdp) {
                if (!localPeerConnection) {
                    var server = null;
                    localPeerConnection = new RTCPeerConnection(server);
                }
                localPeerConnection.setRemoteDescription(new RTCSessionDescription(JSON.stringify({ "sdp": json.sdp})), function () {
                    // if we received an offer, we need to answer
                    if (localPeerConnection.remoteDescription.type == "offer") {
                        localPeerConnection.createAnswer(localDescCreated, logError);
                    }
                }, logError);
            }*/
        }

        content.prepend(p); 
    });

    // press 'Enter' to send msg
    input.keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = {};
            var text = $(this).val();

            if (client.status === "connected") {
                if (!text) return;

                msg['type'] = 'register';
                msg['name'] = text;
                client.socket.emit('signaling', msg);
            } else if (client.status === "registered") {
                if (!text) {
                    msg['type'] = 'create';
                    msg['name'] = client.name;
                    client.socket.emit('signaling', msg);
                } else {
                    msg['type'] = 'join';
                    msg['session'] = text;
                    client.socket.emit('signaling', msg);
                }
            }
            else if (client.status === "talking") {
                if (!text) return;

                msg['type'] = 'message';
                msg['text'] = text;
                client.socket.emit('signaling', msg);
            }

            $(this).val('');
        }
    });


    function start() {
        if (!localPeerConnection) {
            var server = null;
            localPeerConnection = new RTCPeerConnection(server);
        }

        // once remote stream arrives, show it in the remote video element
        localPeerConnection.onaddstream = function (event) {
            remoteVideo.src = URL.createObjectURL(event.stream);
            remoteVideo.play();
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
            var msg = {};
            msg['type'] = desc.type;
            msg['sdp'] = desc.sdp;
            client.socket.emit('signaling', msg);

        }, logError);
    }

    function logError(error) {
        log(error.name + ": " + error.message);
    }
});