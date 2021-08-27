//TODO: randomize this file name/access


//replace_start
const signalServerEndpoint = "wss://10.11.157.139:4444";
//replace_end

//replace_start
//TODO does not work
const webrtcConfiguration = {
    iceTransportPolicy: "all",
    iceServers: [
        {
            url:"stun:stun.l.google.com:19302"
        },
        {
            url: "stun:localhost:3478"
        },
        {
            url: "turn:localhost:3478",
            credential: "test123",
            username: "test"
        }
    ],
};
//replace_end

export const CONFIG = {
    signalServerEndpoint: signalServerEndpoint,
    webrtcConfiguration: webrtcConfiguration
};