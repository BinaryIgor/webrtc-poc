import { VideoGridLayout } from "./video-grid-layout.js";
import { CONFIG } from "./config.js";

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

const ICE_DISCONNECTED = "disconnected";
const ICE_FAILED = "failed";

const highQualityVideoConstraints = {
    width: { ideal: 640, max: 960 },
    height: { ideal: 480, max: 720 },
    frameRate: 30
};

const mediumQualityVideoContraints = {
    width: { ideal: 320, max: 480 },
    height: { ideal: 240, max: 360 },
    frameRate: 20
};

const lowQualityVideoContraints = {
    width: { ideal: 160, max: 200 },
    height: { ideal: 120, max: 200 },
    frameRate: 20
};


const streamConstraints = {
    video: mediumQualityVideoContraints,
    audio: true
};

const peerConnections = new Map();

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
localVideo.onresize = () => console.log(`Local video size changed to ${localVideo.videoWidth}x${localVideo.videoHeight}`);


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

    signalServerSocket = new WebSocket(CONFIG.signalServerEndpoint);

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

    signalServerSocket.onerror = e => alert(`SignalServerConnection error: ${JSON.stringify(e)}`);

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
        console.log("All connections..." + peerConnections.keys());
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

function updateVideoStreamQuality() {
    if (localStream == null || true) {
        console.log("Local stream is not set, skipping quality change");
        return;
    }
    //FIX it: not working on chrome, firefox not supporting constraints (?) almost at all
    let newContraints;
    if (peerConnections.size <= 2) {
        console.log("Up to 2 peers, using high quality video");
        newContraints = highQualityVideoConstraints;
    } else {
        console.log("More than 2 peers, switching to medium quality");
        newContraints = mediumQualityVideoContraints;
    }

    streamConstraints.video = newContraints;

    localStream.getVideoTracks().forEach(t => {
        console.log("Applying new constraints to stream...", newContraints);
        t.applyConstraints(streamConstraints)
            .then(() => console.log("Constraints applied"))
            .catch(e => console.log("Fail to apply new constraints", e));
    });
}

async function handleOffer(from, offer) {
    const peerConnection = peerConnections.get(from);
    try {
        peerLog(from, "Handling offer...");
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    } catch (e) {
        peerLog(from, `Failed to create SDP from remote offer: ${e}`);
    }

    try {
        peerLog(from, "Creating answer...");
        const answer = await peerConnection.createAnswer();
        onCreateAnswerSuccess(peerConnection, from, answer);
    } catch (e) {
        perLog(from, `Failed to create answer to offer: ${e}`);
    }
}

async function onCreateAnswerSuccess(peerConnection, to, answer) {
    peerLog(to, "Created answer:\n", answer.sdp);
    peerLog(to, "Setting is as local description");
    try {
        await peerConnection.setLocalDescription(answer);
        peerLog(to, "Local description from answer created, sending to remote");
        sendEventToSignalServer(to, ANSWER, answer);
    } catch (e) {
        peerLog(to, `Failed to set local session description: ${e}`);
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
        console.log(`Using video device: ${videoTracks[0].label}, with settings: `, videoTracks[0].getSettings());
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
        console.log("RTCPeerConnection configuration: ", CONFIG.webrtcConfiguration);
        console.log("Peers to connect: ", peers);
    }

    try {
        for (const pid of peers) {
            if (pid == user) {
                peerLog(pid, "Skipping user peer");
            } else {
                if (peerConnections.has(pid)) {
                    console.log(`Connection to ${pid} exists, skipping`);
                    continue;
                }
                const peerConnection = newPeerConnection(pid);
                peerLog(pid, "Created local peer connection");
                peerConnections.set(pid, peerConnection);

                peerLog(pid, "Adding streams to peer connection");
                localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
                peerLog(pid, "Added local stream to peer connection");

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
        updateVideoStreamQuality();
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
        peerLog(pid, 'Closing inactive peer');
        closePeer(pid, peerConnections.get(pid));
        peerConnections.delete(pid);
    });
}

function closePeer(peerId, peerConnection) {
    peerConnection.close();
    removePeerVideo(peerId);
}

function newPeerConnection(peerId) {
    let handlingIceDisonnected = false;
    let handlingIceFailed = false;

    function handleIceDisonnected(pid) {
        if (handlingIceDisonnected) {
            peerLog(pid, `ICE ${ICE_DISCONNECTED} is being handled, returning`);
            return;
        }
        handlingIceDisonnected = true;
        setTimeout(() => {
            handlingIceDisonnected = false;
            const pc = peerConnections.get(pid);
            if (!pc) {
                peerLog(pid, "Peer is no longer active skipping reconnect");
                return;
            }
            if (pc.iceConnectionState != ICE_DISCONNECTED) {
                peerLog(pid, `Connection is no longer ${ICE_DISCONNECTED}, but ${pc.iceConnectionState}, skipping`);
                return;
            }
            pc.restartIce();
            createOffer(pid, pc);
        }, 5000);
    }

    function handleIceFailed(pid) {
        if (handlingIceFailed) {
            peerLog(pid, `ICE ${ICE_FAILED} is being handled, returning`);
            return;
        }
        handlingIceFailed = true;
        setTimeout(() => {
            handlingIceFailed = false;
            const pc = peerConnections.get(pid);
            if (!pc) {
                peerLog(pid, "Peer is no longer active skipping reconnect");
                return;
            }
            if (pc.iceConnectionState != ICE_FAILED) {
                peerLog(pid, `Connection is no longer ${ICE_FAILED}, but ${pc.iceConnectionState}, skipping`);
                return;
            }
            pc.restartIce();
            createOffer(pid, pc);
        }, 3000);
    }

    const pc = new RTCPeerConnection(CONFIG.webrtcConfiguration);

    pc.onicecandidate = e => {
        try {
            const candidate = e.candidate;
            if (candidate) {
                peerLog(peerId, 'Send ICE candidate:\n', e.candidate);
                sendEventToSignalServer(peerId, CANDIDATE, candidate);
            } else {
                peerLog(peerId, "Skipping null ICE candidate");
            }
        } catch (e) {
            peerLog(peerId, `Failed to send ICE Candidate: ${e}`);
        }
    };

    pc.onicecandidateerror = e => peerLog(peerId, "ICE candidate error", e);

    pc.onicegatheringstatechange = () => peerLog(peerId, `ICE gathering state change: ${pc.iceGatheringState}`);

    pc.onsignalingstatechange = () => peerLog(peerId, `ICE signalling state change: ${pc.signalingState}`);

    //TODO reconnection...
    pc.oniceconnectionstatechange = () => {
        peerLog(peerId, `ICE state change event: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState == ICE_DISCONNECTED) {
            handleIceDisonnected(peerId);
        } else if (pc.iceConnectionState == ICE_FAILED) {
            handleIceFailed(peerId);
        }
    };

    const peerVideo = createPeerVideo(peerId);
    pc.ontrack = e => {
        peerLog(peerId, "Received remote streams...", e.streams);
        if (peerVideo.srcObject !== e.streams[0]) {
            peerVideo.srcObject = e.streams[0];
        } else {
            peerLog(peerId, "Peer received same remote stream again, skipping");
        }
    };

    return pc;
}

function peerLog(peerId, message, ...objects) {
    console.log(`${new Date().toISOString()}, Peer: ${peerId} - ${message}`, ...objects);
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

function peerIdFromVideo(video) {
    const prefixId = video.parentNode.id.split("_");
    return prefixId[1];
}

function removePeerVideo(peerId) {
    const videoContainer = document.getElementById(peerVideoId(peerId));
    if (videoContainer) {
        videoContainer.remove();
    }
}

async function createOffer(peerId, peerConnection) {
    try {
        peerLog(peerId, "Starting to create an offer");
        const offer = await peerConnection.createOffer();
        await onCreateOfferSuccess(peerId, peerConnection, offer);
    } catch (e) {
        peerLog(peerId, `Failed to create SDP: ${e}`);
    }
}

async function onCreateOfferSuccess(peerId, peerConnection, offer) {
    peerLog(peerId, "Offer from peerConnection:\n", offer.sdp);
    peerLog(peerId, "Setting it as local description");
    try {
        await peerConnection.setLocalDescription(offer);
        peerLog(peerId, "Offer created, sending it to peer");
        sendEventToSignalServer(peerId, OFFER, offer);
    } catch (e) {
        peerLog(peerId, `Failed to set local session description: ${e}`);
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

    videoGridLayout.refresh();
    remoteContainerParent.classList.add(NO_DISPLAY_CLASS);
}

function setupRemoteVideosListeners() {
    for (const rv of remoteContainer.querySelectorAll("video")) {
        const peerId = peerIdFromVideo(rv);
        rv.onloadedmetadata = () => peerLog(peerId, `Remote video videoWidth: ${rv.videoWidth}px,  videoHeight: ${rv.videoHeight}px`);
        rv.onresize = () => {
            peerLog(peerId, `Remote video size changed to ${rv.videoWidth}x${rv.videoHeight}`);
            //shouldn't we do something more now ?
        };
    }
}