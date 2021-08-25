//replace_start
const signalServerEndpoint = "ws://localhost:8888";
//replace_end

//replace_start
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
//replace_end

export const CONFIG = {
    signalServerEndpoint: signalServerEndpoint,
    webrtcConfiguration: webrtcConfiguration
};