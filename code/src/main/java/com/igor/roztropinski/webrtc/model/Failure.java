package com.igor.roztropinski.webrtc.model;

import lombok.Value;

import java.util.List;

@Value
public class Failure {
    SocketMessageType source;
    List<String> errors;
}
