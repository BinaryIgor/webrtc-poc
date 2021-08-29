//TODO: randomize this file name/access


//replace_start
const signalServerEndpoint = "wss://10.11.157.139:4444";
//replace_end

//replace_start
//TODO turn not work on mozilla
const webrtcConfiguration = {
    iceTransportPolicy: "all",
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: "turn:10.11.157.139:3478",
            credential: "turner123",
            username: "turner"
        }
    ],
};
//replace_end

export const CONFIG = {
    signalServerEndpoint: signalServerEndpoint,
    webrtcConfiguration: webrtcConfiguration
};