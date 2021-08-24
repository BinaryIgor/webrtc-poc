package com.igor.roztropinski.webrtc.json;

import com.fasterxml.jackson.databind.module.SimpleModule;
import com.igor.roztropinski.webrtc.model.RawSocketMessage;

public class SocketMessageModule extends SimpleModule {

    public SocketMessageModule() {
        addDeserializer(RawSocketMessage.class, new RawSocketMessageDeserializer());
    }
}
