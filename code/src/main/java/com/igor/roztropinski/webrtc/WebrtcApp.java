package com.igor.roztropinski.webrtc;

import io.vertx.core.Vertx;
import io.vertx.core.http.HttpServerOptions;
import io.vertx.core.net.PemKeyCertOptions;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.StaticHandler;
import lombok.extern.slf4j.Slf4j;

import java.io.File;

@Slf4j
public class WebrtcApp {

    private static final String STATIC_ROOT_DIR = "WEBRTC_STATIC_ROOT_DIR";
    private static final boolean USE_HTTPS = false;
    private static final String HTTP_SERVER_PORT = "WEBRTC_HTTP_SERVER_PORT";
    private static final String WEB_SOCKETS_PORT = "WEBRTC_WEB_SOCKETS_PORT";
    private static final String HTTPS_CERT_PATH = "WEBRTC_HTTPS_CERT_PATH";
    private static final String HTTPS_KEY_PATH = "WEBRTC_HTTPS_KEY_PATH";
    private static final String RANDOMIZE_PARTICIPANTS_ACCESS = "WEBRTC_RANDOMIZE_PARTICIPANTS_ACCESS";

    public static void main(String... args) {
        log.info("About to start SignalServer for WebrtcPOC...");

        var vertx = Vertx.vertx();
        var router = Router.router(vertx);

        router.route().handler(staticHandler());

        vertx.exceptionHandler(e -> log.error("There was a problem", e));
        router.route().failureHandler(r -> log.error("Failed on router", r.failure()));

        var httpServerOptions = new HttpServerOptions()
                .setPort(Integer.parseInt(envVariable(HTTP_SERVER_PORT, "8080")));

        if (USE_HTTPS) {
            setupHttps(httpServerOptions);
        }

        vertx.createHttpServer(httpServerOptions)
                .requestHandler(router)
                .listen();
    }

    private static StaticHandler staticHandler() {
        var root = envVariable(STATIC_ROOT_DIR);
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
            return defaultValue;
        }
        return value;
    }

    private static String envVariable(String key) {
        return envVariable(key, null);
    }

    private static void setupHttps(HttpServerOptions options) {
        var certOptions = new PemKeyCertOptions()
                .setCertPath(envVariable(HTTPS_CERT_PATH))
                .setKeyPath(envVariable(HTTPS_KEY_PATH));

        options.setPemKeyCertOptions(certOptions)
                .setSsl(true);
    }
}
