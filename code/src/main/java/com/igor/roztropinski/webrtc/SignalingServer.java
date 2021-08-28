package com.igor.roztropinski.webrtc;

import com.igor.roztropinski.webrtc.function.Dates;
import com.igor.roztropinski.webrtc.function.SocketMessages;
import com.igor.roztropinski.webrtc.function.WebSockets;
import com.igor.roztropinski.webrtc.json.JsonMapper;
import com.igor.roztropinski.webrtc.model.*;
import io.vertx.core.http.HttpServer;
import io.vertx.core.http.WebSocketBase;
import lombok.Data;
import lombok.Value;
import lombok.With;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
public class SignalingServer {

    private final Map<String, SocketConnection> newConnections = new ConcurrentHashMap<>();
    private final Map<String, String> authenticatedConnections = new ConcurrentHashMap<>();
    private final Map<String, SocketConnection> idsConnections = new ConcurrentHashMap<>();
    private final Set<Long> roomMembers = Collections.newSetFromMap(new ConcurrentHashMap<>());
    private final SignalingServerAuthenticator authenticator;
    private final int maxConnections;
    private final int authenticationTimeout;
    private final int invalidatorFrequency;
    private boolean started = false;

    public SignalingServer(SignalingServerAuthenticator authenticator,
                           int maxConnections,
                           int authenticationTimeout,
                           int invalidatorFrequency) {
        this.authenticator = authenticator;
        this.maxConnections = maxConnections;
        this.authenticationTimeout = authenticationTimeout;
        this.invalidatorFrequency = invalidatorFrequency;

        this.authenticator.onAuthenticated(this::onAuthenticated);
    }

    public SignalingServer(SignalingServerAuthenticator authenticator, int maxConnections) {
        this(authenticator, maxConnections, 20_000, 60_000);
    }

    public SignalingServer(SignalingServerAuthenticator authenticator) {
        this(authenticator, 10);
    }

    private void onAuthenticated(WebSocketBase authenticated, String userId) {
        newConnections.remove(authenticated.textHandlerID());
        authenticatedConnections.put(authenticated.textHandlerID(), userId);
        var previous = idsConnections.put(userId, new SocketConnection(authenticated, Dates.now()));
        if (previous != null) {
            closeSocket(previous.socket);
        }
        WebSockets.send(authenticated, SocketMessages.userAuthenticated());
    }

    private void closeSocket(WebSocketBase socket) {
        try {
            socket.close();
        } catch (Exception e) {
            //swallow
        }
    }

    private void start() {
        Executors.newScheduledThreadPool(1)
                .scheduleAtFixedRate(this::closeNotAuthenticatedAndNotActiveConnections,
                        0, invalidatorFrequency, TimeUnit.MILLISECONDS);
    }

    private void closeNotAuthenticatedAndNotActiveConnections() {
        var now = Dates.now();

        var toCloseNotAuthenticated = newConnections.values().stream()
                .filter(s -> {
                    var maxDate = s.activeAt.plus(authenticationTimeout, ChronoUnit.MILLIS);
                    return now.isAfter(maxDate);
                })
                .collect(Collectors.toList());

        if (!toCloseNotAuthenticated.isEmpty()) {
            log.info("About to close {} not authenticated connections", toCloseNotAuthenticated.size());
            toCloseNotAuthenticated.forEach(sc -> closeAndRemove(sc.socket));
        }

        var toCloseNotActive = idsConnections.values().stream()
                .filter(s -> {
                    var maxDate = s.activeAt.plus(invalidatorFrequency, ChronoUnit.MILLIS);
                    return now.isAfter(maxDate);
                })
                .collect(Collectors.toList());

        if (!toCloseNotActive.isEmpty()) {
            log.info("About to close {} not active connections", toCloseNotActive.size());
            toCloseNotActive.forEach(sc -> closeAndRemove(sc.socket));
        }

        log.info("Active connections: {}", authenticatedConnections.values());
    }

    private void closeAndRemove(WebSocketBase socket) {
        try {
            closeSocket(socket);
            newConnections.remove(socket.textHandlerID());
            authenticator.invalidate(socket);
        } catch (Exception ignored) {

        }
    }

    public void start(HttpServer server) {
        if (started) {
            return;
        }
        server.webSocketHandler(this::handle);
        start();
        started = true;
    }

    private void handle(WebSocketBase socket) {
        log.info("New connection, address: {}", socket.remoteAddress());

        var openConnections = openConnections();
        if (openConnections >= maxConnections) {
            log.warn("There would be more open connections ({}) than allowed ({}), not accepting new ones",
                    openConnections, maxConnections);
            closeSocket(socket);
            return;
        }

        newConnections.put(socket.textHandlerID(), new SocketConnection(socket, Dates.now()));

        socket.textMessageHandler(msg -> {
            var id = authenticatedConnections.get(socket.textHandlerID());
            WebSockets.message(socket, msg, false).ifPresentOrElse(m -> {
                        handleMessage(socket, m, id);
                    },
                    () -> {
                        if (id != null) {
                            handlePeerEvent(socket, msg);
                        }
                    });
        });

        socket.closeHandler(v -> {
            var socketUserId = authenticatedConnections.remove(socket.textHandlerID());
            log.info("Closing socket for user: {}", socketUserId);
            if (socketUserId != null) {
                idsConnections.remove(socketUserId);
                removeRoomMemberIf(socketUserId);
            }
        });
    }

    private void handleMessage(WebSocketBase socket, RawSocketMessage message, String id) {
        if (isAuthentication(message, id)) {
            handleAuthentication(socket, message);
        } else if (id == null) {
            WebSockets.send(socket,
                    SocketMessages.failure(SocketMessageType.UNKNOWN, Errors.NOT_AUTHENTICATED));
        } else if (message.type() == SocketMessageType.PEER_LOG) {
            handlePeerLogMessage(message, id);
        } else if (message.type() == SocketMessageType.PING) {
              handlePingMessage(id);
        } else {
            handleRoomMessage(message, id);
        }
    }

    private void handlePeerLogMessage(RawSocketMessage message, String id) {
        try {
            WebSockets.data(message, PeerLog.class)
                    .ifPresent(d -> {
                        log.info("Peer log from {} is: {}", id, d);
                    });
        } catch (Exception e) {
            log.warn("Unhandled exception while handling peer log message from: " + id, e);
        }
    }

    private void handlePingMessage(String id) {
        Optional.ofNullable(idsConnections.get(id))
                .ifPresent(c -> {
                    var updated = c.withActiveAt(Dates.now());
                    idsConnections.put(id, updated);
                    WebSockets.send(updated.socket, SocketMessages.pong());
                });
    }

    private void handleRoomMessage(RawSocketMessage message, String id) {
        var idValue = Long.parseLong(id);
        var roomChanged = false;

        if (message.type() == SocketMessageType.JOIN_ROOM) {
            roomChanged = roomMembers.add(idValue);
        } else if (message.type() == SocketMessageType.LEAVE_ROOM) {
            roomChanged = roomMembers.remove(idValue);
        }

        if (roomChanged) {
            sendRoomMembers();
        } else {
            log.info("Room haven't changed by {} message from {} user", message.type(), idValue);
        }
    }

    private void handlePeerEvent(WebSocketBase socket, String message) {
        try {
            var event = JsonMapper.object(message, PeerEvent.class);

            long originUserId = Long.parseLong(authenticatedConnections.get(socket.textHandlerID()));
            long from = event.from();
            if (originUserId != from) {
                log.warn("Origin user id ({}) is not equal to from field ({}), skipping", originUserId, from);
                return;
            }

            long to = event.to();
            var destination = idsConnections.get(String.valueOf(to));
            if (destination == null) {
                log.warn("Destination user ({}) is not connected, skipping", to);
                return;
            }

            destination.socket.writeTextMessage(message).onFailure(t -> log.error("Fail to send message to client", t));
        } catch (Exception e) {
            log.error("Problem while handling peer event", e);
        }
    }

    private void removeRoomMemberIf(String id) {
        try {
            var idValue = Long.parseLong(id);
            if (roomMembers.remove(idValue)) {
                sendRoomMembers();
            }
        } catch (Exception ignored) {

        }
    }

    private void sendRoomMembers() {
        writeToAllSockets(SocketMessages.roomMembers(roomMembers));
    }

    private void writeToAllSockets(SocketMessage<?> message) {
        idsConnections.values().forEach(s -> WebSockets.send(s.socket, message));
    }

    private boolean isAuthentication(RawSocketMessage message, String id) {
        return id == null && message.type() == SocketMessageType.USER_AUTHENTICATION;
    }

    private void handleAuthentication(WebSocketBase socket, RawSocketMessage message) {
        try {
            WebSockets.data(message, String.class)
                    .ifPresent(d -> authenticator.authenticate(socket, d));
        } catch (Exception e) {
            log.warn("Unhandled exception while handling message...", e);
            WebSockets
                    .send(socket, SocketMessages.failure(SocketMessageType.USER_AUTHENTICATION, Errors.UNKNOWN_ERROR));
        }
    }

    private int openConnections() {
        return newConnections.size() + authenticatedConnections.size();
    }

    @Value
    private static class SocketConnection {
        WebSocketBase socket;
        @With
        LocalDateTime activeAt;
    }
}
