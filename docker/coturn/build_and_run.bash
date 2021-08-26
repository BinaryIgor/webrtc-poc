#!bin/bash
set -e
docker run -d --network=host -v coturn.conf:/etc/coturn/turnserver.conf coturn/coturn:4.5.2-debian