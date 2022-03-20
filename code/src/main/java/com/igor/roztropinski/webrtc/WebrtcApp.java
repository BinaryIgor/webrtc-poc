package com.igor.roztropinski.webrtc;

import io.vertx.core.Vertx;
import io.vertx.core.http.HttpServerOptions;
import io.vertx.core.net.PemKeyCertOptions;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.StaticHandler;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;

@Slf4j
public class WebrtcApp {

    private static final String STATIC_ROOT_DIR = "WEBRTC_STATIC_ROOT_DIR";
    private static final String USE_HTTPS = "WEBRTC_USE_HTTPS";
    private static final String HTTP_SERVER_PORT = "WEBRTC_HTTP_SERVER_PORT";
    private static final String HTTPS_CERT_PATH = "WEBRTC_HTTPS_CERT_PATH";
    private static final String HTTPS_KEY_PATH = "WEBRTC_HTTPS_KEY_PATH";
    private static final String PARTICIPANTS_ACCESS = "WEBRTC_PARTICIPANTS_ACCESS";
    private static final Map<String, Long> DEFAULT_PARTICIPANTS_ACCESS = Map.of(
            "${A}", 1L,
            "${B}", 2L,
            "${C}", 3L,
            "${D}", 4L,
            "${E}", 5L,
            "${F}", 6L,
            "${G}", 7L,
            "${H}", 8L,
            "${I}", 9L,
            "${J}", 10L);

    public static void main(String... args) {
        log.info("About to start SignalServer for WebrtcPOC, loading config...");

        var staticRootDir = envVariable(STATIC_ROOT_DIR);
        var useHttps = Boolean.parseBoolean(envVariable(USE_HTTPS, "false"));
        var httpServerPort = Integer.parseInt(envVariable(HTTP_SERVER_PORT, useHttps ? "4444" : "8888"));

        String httpsCertPath;
        String httpsKeyPath;
        if (useHttps) {
            httpsCertPath = envVariable(HTTPS_CERT_PATH);
            httpsKeyPath = envVariable(HTTPS_KEY_PATH);
        } else {
            httpsCertPath = null;
            httpsKeyPath = null;
        }

        var participantsAccess = participantsAccess();

        var vertx = Vertx.vertx();
        var router = Router.router(vertx);

        router.route().handler(staticHandler(staticRootDir));

        vertx.exceptionHandler(e -> log.error("There was a problem", e));
        router.route().failureHandler(r -> log.error("Failed on router", r.failure()));

        log.info("Setting up http server");
        var httpServerOptions = new HttpServerOptions()
                .setPort(httpServerPort);
        if (useHttps) {
            log.info("Setting up https");
            setupHttps(httpServerOptions, httpsCertPath, httpsKeyPath);
        }
        var httpServer = vertx.createHttpServer(httpServerOptions);

        var signalingAuthenticator = new SignalingServerAuthenticator(participantsAccess);
        var signalingServer = new SignalingServer(signalingAuthenticator);

        signalingServer.start(httpServer);

        httpServer.requestHandler(router);

        httpServer.listen();

        log.info("Signal server is running!");

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("Shutting down...");
            signalingServer.stop();
        }));
    }

    private static StaticHandler staticHandler(String root) {
        log.info("Taking frontend files from: {}", root);

        return StaticHandler.create()
                .setFilesReadOnly(false)
                .setCachingEnabled(false)
                .setMaxAgeSeconds(0)
                .setAllowRootFileSystemAccess(true)
                .setWebRoot(root);
    }

    private static String envVariable(String key, String defaultValue) {
        var value = System.getenv(key);
        if (value == null) {
            if (defaultValue == null) {
                throw new RuntimeException(String.format("%s must be set to value, but wasn't", key));
            }
            log.info("{} is null, using default value: {}", key, defaultValue);
            return defaultValue;
        }
        log.info("{} has value of: {}", key, key.endsWith(PARTICIPANTS_ACCESS) ? "*****" : value);
        return value;
    }

    private static String envVariable(String key) {
        return envVariable(key, null);
    }

    private static Map<String, Long> participantsAccess() {
        String participants = envVariable(PARTICIPANTS_ACCESS, "");
        if (participants.isEmpty()) {
            log.info("No participants set, using default value");
            return DEFAULT_PARTICIPANTS_ACCESS;
        }

        var secretsIds = new HashMap<String, Long>();

        for (var keyValue : participants.split(",")) {
            var kv = keyValue.split("=");

            var id = Long.parseLong(kv[0]);
            var secret = kv[1];

            secretsIds.put(secret, id);
        }

        return secretsIds;
    }


    private static void setupHttps(HttpServerOptions options, String certPath, String keyPath) {
        var certOptions = new PemKeyCertOptions()
                .setCertPath(certPath)
                .setKeyPath(keyPath);

        options.setPemKeyCertOptions(certOptions)
                .setSsl(true);
    }
}
