package com.igor.roztropinski.webrtc.model;

import lombok.Value;

@Value
public class PeerEvent {
    long from;
    long to;
    String event;
    Object data;
}
