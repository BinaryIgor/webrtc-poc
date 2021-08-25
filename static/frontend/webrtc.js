import { VideoGridLayout } from "./video-grid-layout.js";

const signalServerConnectionStatus = document.getElementById("signalServerConnection");
const userSelect = document.getElementById("userSelect");
const connectToSignalServerButton = document.getElementById("connectToSignalServer");

const callButton = document.getElementById("call");
const hangupButton = document.getElementById("hangup");

const localVideo = document.getElementById("localVideo");
const remoteContainer = document.getElementById("remoteContainer");
const remoteContainerParent = remoteContainer.parentNode;

const videoGridLayout = new VideoGridLayout(remoteContainer);
videoGridLayout.render();

const mediaButton = document.getElementById("media");
const previewButton = document.getElementById("preview");
const videoButton = document.getElementById("video");
const audioButton = document.getElementById("audio");

const NO_DISPLAY_CLASS = "no-display";

const ON = "ON";
const OFF = "OFF";

const OFFER = "offer";
const ANSWER = "answer";
const CANDIDATE = "candidate";

const USER_AUTHENTICATION = "USER_AUTHENTICATION";
const USER_AUTHENTICATED = "USER_AUTHENTICATED";
const JOIN_ROOM = "JOIN_ROOM";
const LEAVE_ROOM = "LEAVE_ROOM";
const ROOM_MEMBERS = "ROOM_MEMBERS";

const streamConstraints = {
    video: true,
    audio: true
};
const peerConnections = new Map();
const signalServerEndpoint = "ws://localhost:8080";
const webrtcConfiguration = {
    iceServers: [
        {
            urls: [ 
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302"
            ]
        }
    ],
};

let user;
let authenticated = false;
let signalServerSocket;
let localStream;
let inCall = false;
let initiateOffer = true;

callButton.disabled = true;
hangupButton.disabled = true;

connectToSignalServerButton.onclick = connectToSignalServer;

mediaButton.onclick = startVideoStream;
previewButton.onclick = togglePreview;
videoButton.onclick = toggleVideoStream;
audioButton.onclick = toggleAudioStream;
callButton.onclick = call;
hangupButton.onclick = hangup;

localVideo.onloadedmetadata = () => console.log(`Local video videoWidth: ${localVideo.videoWidth}px,  videoHeight: ${localVideo.videoHeight}px`);


function connectToSignalServer() {
    function isServerMessage(message) {
        return message.type;
    }

    const userSecret = userSelect.value;
    if (!userSelect) {
        alert("User need to be selected");
        return;
    }
    user = parseInt(userSelect[userSelect.selectedIndex].text);
    console.log("Connecting as user = " + user);

    if (signalServerSocket) {
        signalServerSocket.close();
        authenticated = false;
        signalServerSocket = null;
        updateSignalServerConnectionStatus(OFF);
    }

    signalServerSocket = new WebSocket(signalServerEndpoint);

    signalServerSocket.onopen = () => {
        alert("SignalServerConnection established, sending credentials");
        sendToSignalServer({
            type: USER_AUTHENTICATION,
            data: userSecret
        });
    };

    signalServerSocket.onmessage = e => {
        const message = JSON.parse(e.data);
        console.log("Message received from SignalServer...", message);
        if (isServerMessage(message)) {
            handleServerMessage(message);
        } else {
            handleEvent(message.from, message.event, message.data);
        }
    };

    signalServerSocket.onerror = e => alert(`SignalServerConnection error: ${e}`);

    signalServerSocket.onclose = e => {
        if (e.wasClean) {
            console.log(`Connection closed cleanly, code=${e.code}, reason=${e.reason}`);
        } else {
            alert(`Connection died, code=${e.code}`);
        }
        authenticated = false;
        updateSignalServerConnectionStatus(OFF);
    };
}

function handleServerMessage(message) {
    if (message.type == USER_AUTHENTICATED) {
        console.log("SignalServerConnection is authenticated");
        authenticated = true;
        updateSignalServerConnectionStatus(ON);
    } else if (message.type == ROOM_MEMBERS) {
        setupPeerConnections(message.data);
    } else {
        console.log("Unknown message type from server, ignoring it");
    }
}

function sendToSignalServer(data) {
    signalServerSocket.send(JSON.stringify(data));
}

function sendEventToSignalServer(to, event, data) {
    sendToSignalServer({
        from: user,
        to: to,
        event: event,
        data: data
    });
}

function updateSignalServerConnectionStatus(status) {
    signalServerConnectionStatus.textContent = status;
}

function handleEvent(from, event, data) {
    if (noPeerConnections()) {
        console.log(`Peers not connected, skipping event ${event} from ${from} peer`);
        return;
    }

    if (!peerConnections.has(from)) {
        console.log(`No peer connection of ${from} id, skipping`);
        console.log("ALl connections..." + peerConnections.keys());
        return;
    }

    console.log(`Handling event from ${from} peer`)

    if (event == OFFER) {
        handleOffer(from, data);
    } else if (event == ANSWER) {
        handleAnswer(from, data);
    } else if (event == CANDIDATE) {
        handleCandidate(from, data);
    } else {
        console.log(`Unknown event (${event}), ignoring it`, data);
    }
}

function noPeerConnections() {
    return peerConnections.size == 0;
}

async function handleOffer(from, offer) {
    const peerConnection = peerConnections.get(from);
    try {
        console.log("Handling offer...");
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    } catch (e) {
        console.log(`Failed to create SDP from remote offer: ${e}`);
    }

    try {
        console.log("Creating answer...");
        const answer = await peerConnection.createAnswer();
        onCreateAnswerSuccess(peerConnection, from, answer);
    } catch (e) {
        console.log(`Failed to create answer to offer: ${e}`);
    }
}

async function onCreateAnswerSuccess(peerConnection, to, answer) {
    console.log("Created answer:\n", answer.sdp);
    console.log("Setting is as local description");
    try {
        await peerConnection.setLocalDescription(answer);
        console.log("Local description from answer created, sending to remote");
        sendEventToSignalServer(to, ANSWER, answer);
    } catch (e) {
        console.log(`Failed to set local session description: ${e}`);
    }
}

function handleAnswer(from, answer) {
    const peerConnection = peerConnections.get(from);
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

function handleCandidate(from, candidate) {
    const peerConnection = peerConnections.get(from);
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));

}

async function startVideoStream() {
    if (localStream) {
        console.log("Stopping local stream...")
        stopVideoStream();
        return;
    }
    console.log("Requesting local stream");
    mediaButton.disabled = true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia(streamConstraints);
        console.log("Received local stream");
        localVideo.srcObject = stream;
        localStream = stream;
        callButton.disabled = false;
    } catch (e) {
        alert(`getUserMedia() error: ${e}`);
    }
    mediaButton.disabled = false;
    videoButton.disabled = false;
    audioButton.disabled = false;
}

function stopVideoStream() {
    localStream.getTracks().forEach(t => t.stop());

    callButton.disabled = true;
    videoButton.disabled = true;
    audioButton.disabled = true;

    setVideoStateButton(true);
    setAudioStateButton(true);

    localStream = null;
}

function togglePreview() {
    localVideo.classList.toggle("hidden");
}

function toggleVideoStream() {
    if (!localStream) {
        return;
    }
    localStream.getVideoTracks().forEach(t => {
        const newState = !t.enabled;
        console.log("Setting video track to enabled = " + newState);
        t.enabled = newState;
        setVideoStateButton(newState);
    });
}

function setVideoStateButton(state) {
    videoButton.textContent = "Video: " + (state ? ON : OFF);
}

function toggleAudioStream() {
    if (!localStream) {
        return;
    }
    localStream.getAudioTracks().forEach(t => {
        const newState = !t.enabled;
        console.log("Setting audio track to enabled = " + newState);
        t.enabled = newState;
        setAudioStateButton(newState);
    });
}

function setAudioStateButton(state) {
    audioButton.textContent = "Audio: " + (state ? ON : OFF);
}

async function call() {
    if (!user) {
        alert("User need to be selected");
        return;
    }
    if (!authenticated) {
        alert("You need to establish connection with SignalServer first");
        return;
    }
    callButton.disabled = true;
    hangupButton.disabled = false;

    console.log("Staring call, sending signal to SignalServer....");

    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();

    if (videoTracks.length > 0) {
        console.log(`Using video device: ${videoTracks[0].label}`);
    }
    if (audioTracks.length > 0) {
        console.log(`Using audio device: ${audioTracks[0].label}`);
    }

    inCall = true;
    sendToSignalServer({ type: JOIN_ROOM });
    remoteContainerParent.classList.remove(NO_DISPLAY_CLASS);
}

function setupPeerConnections(peers) {
    if (!inCall) {
        console.log("Not in call, skipping peers setup")
        return;
    }

    if (initiateOffer) {
        console.log("RTCPeerConnection configuration: ", webrtcConfiguration);
        console.log("Peers to connect: ", peers);
    }

    try {
        for (const pid of peers) {
            if (pid == user) {
                console.log("Skipping user peer = " + pid);
            } else {
                if (peerConnections.has(pid)) {
                    console.log(`Connection to ${pid} exists, skipping`);
                    continue;
                }
                const peerConnection = newPeerConnection(pid);
                console.log("Created local peer connection");
                peerConnections.set(pid, peerConnection);

                console.log("Adding streams to peer connection");
                localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
                console.log("Added local stream to peer connection");

                if (initiateOffer) {
                    createOffer(pid, peerConnection);
                }
            }
        }

        closeInactiveConnections(peers);
    } finally {
        initiateOffer = false;
        videoGridLayout.refresh();
        setupRemoteVideosListeners();
    }
}

function closeInactiveConnections(peers) {
    const toClose = [];

    for (const pid of peerConnections.keys()) {
        if (!peers.includes(pid)) {
            toClose.push(pid);
        }
    }

    toClose.forEach(pid => {
        console.log(`Inactive peer (${pid}), closing`);
        closePeer(pid, peerConnections.get(pid));
        peerConnections.delete(pid);
    });
}

function closePeer(peerId, peerConnection) {
    peerConnection.close();
    removePeerVideo(peerId);
}

function newPeerConnection(peerId) {
    const pc = new RTCPeerConnection(webrtcConfiguration);

    pc.onicecandidate = e => {
        try {
            const candidate = e.candidate;
            if (candidate) {
                console.log('Send ICE candidate:\n', e.candidate);
                sendEventToSignalServer(peerId, CANDIDATE, candidate);
            } else {
                console.log("Skipping null ICE candidate");
            }
        } catch (e) {
            console.log(`Failed to send ICE Candidate: ${e}`);
        }
    };

    pc.oniceconnectionstatechange = e => {
        console.log(`ICE state change event: ${pc.iceConnectionState}`);
    };

    const peerVideo = createPeerVideo(peerId);
    pc.ontrack = e => {
        //For some reason, fired twice
        if (peerVideo.srcObject !== e.streams[0]) {
            peerVideo.srcObject = e.streams[0];
            console.log('Peer connection received remote stream');
        }
    };

    return pc;
}

function createPeerVideo(peerId) {
    const container = document.createElement("div");
    container.className = "remote-video-container";

    const video = document.createElement("video");
    video.autoplay = true;

    const peerDescription = document.createElement("div");
    peerDescription.textContent = peerId;

    container.id = peerVideoId(peerId);
    container.appendChild(video);
    container.appendChild(peerDescription);

    remoteContainer.appendChild(container);

    return video;
}

function peerVideoId(peerId) {
    return `remoteVideo_${peerId}`;
}

function removePeerVideo(peerId) {
    const videoContainer = document.getElementById(peerVideoId(peerId));
    if (videoContainer) {
        videoContainer.remove();
    }
}

async function createOffer(peerId, peerConnection) {
    try {
        console.log("Starting to create an offer for " + peerId);
        const offer = await peerConnection.createOffer();
        await onCreateOfferSuccess(peerId, peerConnection, offer);
    } catch (e) {
        console.log(`Failed to create SDP: ${e}`);
    }
}

async function onCreateOfferSuccess(peerId, peerConnection, offer) {
    console.log("Offer from peerConnection:\n", offer.sdp);
    console.log("Setting it as local description");
    try {
        await peerConnection.setLocalDescription(offer);
        console.log("Offer created, sending it to peer");
        sendEventToSignalServer(peerId, OFFER, offer);
    } catch (e) {
        console.log(`Failed to set local session description: ${e}`);
    }
}

function hangup() {
    console.log("Ending call");

    inCall = false;

    for (const [id, pc] of peerConnections.entries()) {
        console.log(`Closing ${id} peer connection`);
        closePeer(id, pc);
    }

    peerConnections.clear();
    initiateOffer = true;

    console.log("Sending message to SignalServer");
    sendToSignalServer({ type: LEAVE_ROOM });

    hangupButton.disabled = true;
    callButton.disabled = false;

    videoContainer.refresh();
    remoteContainerParent.classList.add(NO_DISPLAY_CLASS);
}

function setupRemoteVideosListeners() {
    for (const rv of remoteContainer.querySelectorAll("video")) {
        rv.onloadedmetadata = () => console.log(`Remote video videoWidth: ${rv.videoWidth}px,  videoHeight: ${rv.videoHeight}px`);
        rv.onresize = () => {
            console.log(`Remote video size changed to ${rv.videoWidth}x${rv.videoHeight} for ${rv.parentNode.id}`);
            //shouldn't we do something more now ?
        };
    }
}