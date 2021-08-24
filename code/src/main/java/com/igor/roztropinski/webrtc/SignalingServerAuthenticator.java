package com.igor.roztropinski.webrtc;

import io.vertx.core.http.WebSocketBase;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;
import java.util.Optional;

@Slf4j
public class SignalingServerAuthenticator  {

    private final Map<String, Long> secretsIds = Map.of(
            "A", 1L,
            "B", 2L,
            "C", 3L,
            "D", 4L,
            "E", 5L,
            "F", 6L,
            "G", 7L,
            "H", 8L,
            "I", 9L,
            "J", 10L);
    private Callback onAuthCallback;

    public void authenticate(WebSocketBase socket, String secret) {
        if (onAuthCallback == null) {
            log.info("Null on auth callback, not doing anything");
            return;
        }

        Optional.ofNullable(secretsIds.get(secret))
                .ifPresentOrElse(id -> {
                    log.info("Authenticating socket with {} id", id);
                    onAuthCallback.call(socket, String.valueOf(id));
                }, () -> log.warn("Invalid credentials: {}", secret));
    }

    public void invalidate(WebSocketBase socket) {
        log.info("Invalidating...{}", socket.textHandlerID());
    }

    public void onAuthenticated(Callback callback) {
        log.info("Setting up callback {}", callback);
        onAuthCallback = callback;
    }

    interface Callback {
        void call(WebSocketBase authenticated, String userId);
    }
}
