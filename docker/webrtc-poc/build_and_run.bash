#!bin/bash
docker build . -t webrtc-poc
docker run --network=host webrtc-poc
