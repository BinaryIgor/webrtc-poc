package com.igor.roztropinski.webrtc.function;

import com.igor.roztropinski.webrtc.Errors;
import com.igor.roztropinski.webrtc.json.JsonMapper;
import com.igor.roztropinski.webrtc.model.RawSocketMessage;
import com.igor.roztropinski.webrtc.model.SocketMessage;
import com.igor.roztropinski.webrtc.model.SocketMessageType;
import io.vertx.core.http.WebSocketBase;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;
import java.util.function.Consumer;

@Slf4j
public class WebSockets {

    public static void send(WebSocketBase socket, SocketMessage<?> message) {
        send(socket, message, t -> log.error("Failed to send socket message", t));
    }

    public static void send(WebSocketBase socket, SocketMessage<?> message, Consumer<Throwable> onFailure) {
        try {
            socket.writeTextMessage(JsonMapper.json(message)).onFailure(onFailure::accept);
        } catch (Exception e) {
            log.error("Failed to write socket message", e);
        }
    }

    public static Optional<RawSocketMessage> message(WebSocketBase socket, String text, boolean sendFailure) {
        try {
            return Optional.of(JsonMapper.object(text, RawSocketMessage.class));
        } catch (Exception e) {
            if (sendFailure) {
                send(socket, SocketMessages.failure(SocketMessageType.UNKNOWN, Errors.INVALID_MESSAGE_FORMAT));
            }
            return Optional.empty();
        }
    }

    public static Optional<RawSocketMessage> message(WebSocketBase socket, String text) {
        return message(socket, text, true);
    }

    public static <T> Optional<T> data(RawSocketMessage message, Class<T> clazz) {
        try {
            return Optional.of(JsonMapper.object(message.dataJson(), clazz));
        } catch (Exception e) {
            log.warn("Invalid type", e);
            return Optional.empty();
        }
    }
}