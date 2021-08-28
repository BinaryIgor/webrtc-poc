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
            urls: "stun:10.11.157.139:3478"
        },
        {
            urls: "turn:10.11.157.139:3478",
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