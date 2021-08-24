#!/bin/bash
mkdir -p certs
certs_path="${PWD}/certs"
openssl req -x509 -nodes -days 3333 -newkey rsa:2048 -keyout ${certs_path}/selfsigned.key -out ${certs_path}/selfsigned.crt