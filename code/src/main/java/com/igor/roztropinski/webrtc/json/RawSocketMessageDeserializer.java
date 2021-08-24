package com.igor.roztropinski.webrtc.json;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import com.igor.roztropinski.webrtc.model.RawSocketMessage;
import com.igor.roztropinski.webrtc.model.SocketMessageType;

public class RawSocketMessageDeserializer extends JsonDeserializer<RawSocketMessage> {

    @Override
    public RawSocketMessage deserialize(JsonParser jsonParser, DeserializationContext deserializationContext) {
        try {
            JsonNode node = jsonParser.readValueAsTree();
            var type = node.get("type").asText();
            var dataNode = node.get("data");

            String data;
            if (dataNode == null) {
                data = "{}";
            } else {
                data = dataNode.toString();
            }

            return new RawSocketMessage(SocketMessageType.valueOf(type), data);
        } catch (Exception e) {
            throw new RuntimeException("Failure during socket message deserialization", e);
        }
    }
}
