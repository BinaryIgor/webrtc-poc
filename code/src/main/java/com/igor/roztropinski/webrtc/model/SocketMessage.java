package com.igor.roztropinski.webrtc.model;

import lombok.Value;

@Value
public class SocketMessage<T> {
    SocketMessageType type;
    T data;

    public static SocketMessage<Empty> empty(SocketMessageType type) {
        return new SocketMessage<>(type, Empty.INSTANCE);
    }
}
