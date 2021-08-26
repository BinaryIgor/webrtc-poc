FROM adoptopenjdk/openjdk13:x86_64-ubuntu-jdk-13.0.2_8-slim

COPY webrtc-poc-jar-with-dependencies.jar /webrtc-poc-jar-with-dependencies.jar

COPY frontend /frontend
COPY certs /certs

COPY webrtc-poc.bash /webrtc-poc.bash

ENTRYPOINT ["bash", "/webrtc-poc.bash"]