package com.igor.roztropinski.webrtc.function;

import com.igor.roztropinski.webrtc.model.Empty;
import com.igor.roztropinski.webrtc.model.Failure;
import com.igor.roztropinski.webrtc.model.SocketMessage;
import com.igor.roztropinski.webrtc.model.SocketMessageType;

import java.util.Collection;
import java.util.List;

public class SocketMessages {

    public static SocketMessage<Failure> failure(SocketMessageType source, String... errors) {
        return failure(source, List.of(errors));
    }

    public static SocketMessage<Failure> failure(SocketMessageType source, List<String> errors) {
        return new SocketMessage<>(SocketMessageType.FAILURE, new Failure(source, errors));
    }

    public static SocketMessage<Empty> userAuthenticated() {
        return SocketMessage.empty(SocketMessageType.USER_AUTHENTICATED);
    }

    public static SocketMessage<Collection<Long>> roomMembers(Collection<Long> ids) {
        return new SocketMessage<>(SocketMessageType.ROOM_MEMBERS, ids);
    }

    public static SocketMessage<Empty> pong() {
        return SocketMessage.empty(SocketMessageType.PONG);
    }

    public static SocketMessage<Empty> serverClosing() {
        return SocketMessage.empty(SocketMessageType.SERVER_CLOSING);
    }
}
