package com.igor.roztropinski.webrtc.model;

public enum SocketMessageType {
    USER_AUTHENTICATION, USER_AUTHENTICATED,
    FAILURE, UNKNOWN,
    JOIN_ROOM, LEAVE_ROOM, ROOM_MEMBERS,
    PEER_LOG,
    PING, PONG,
    SERVER_CLOSING
}
