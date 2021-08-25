package com.igor.roztropinski.webrtc;

import io.vertx.core.http.WebSocketBase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;
import java.util.Optional;

@Slf4j
@RequiredArgsConstructor
public class SignalingServerAuthenticator  {

    private final Map<String, Long> secretsIds;
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
        onAuthCallback = callback;
    }

    public interface Callback {
        void call(WebSocketBase authenticated, String userId);
    }
}
