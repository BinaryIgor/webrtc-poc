package com.igor.roztropinski.webrtc.model;

import lombok.Value;

import java.util.List;

@Value
public class PeerLog {
    String peerId;
    String message;
    List<Object> objects;
}
