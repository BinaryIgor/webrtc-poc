package com.igor.roztropinski.webrtc.model;

import lombok.Value;

@Value
public class RawSocketMessage {
    SocketMessageType type;
    String dataJson;
}
